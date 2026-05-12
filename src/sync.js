import { getRabbitChannel } from './rabbit.js';
import { 
    MAIN_APP_CONFIG_URL, 
    UDP_SERVER_TO_MAIN_APP_API_KEY 
} from '../config/env.js';
import { saveJsonAtomic } from './storage.js';

const NOTIFY_EXCHANGE = 'udp_config_notify_exchange';
const REFRESH_DEBOUNCE_MS = 1000;
const DEVICES_FILE = './config/devices.json';

let refreshTimer = null;

/**
 * Pulls the full device configuration snapshot from the Main App.
 */
export const fetchLatestConfig = async (registry) => {
    console.log(`[Sync] Synchronizing with Main App...`);
    
    try {
        const response = await fetch(MAIN_APP_CONFIG_URL, {
            headers: {
                'x-api-key': UDP_SERVER_TO_MAIN_APP_API_KEY,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const body = await response.json();
        
        if (!body.success || !body.data?.devices) {
            throw new Error('Malformed API response.');
        }

        const devices = body.data.devices;
        
        // Update in-memory registry and local cache
        registry.update(devices);
        await saveJsonAtomic(DEVICES_FILE, devices);
        
        console.log(`[Sync] Config synchronized (${devices.length} devices).`);
    } catch (error) {
        console.error(`[Sync] Pull failed (using local cache):`, error.message);
    }
};

/**
 * Initializes the background listener for configuration change events.
 */
export const initializeSyncService = async (registry) => {
    try {
        const channel = await getRabbitChannel();

        // Ensure exchange exists
        await channel.assertExchange(NOTIFY_EXCHANGE, 'fanout', { durable: true });

        // Create a transient, exclusive queue for this server instance
        const { queue } = await channel.assertQueue('', { exclusive: true });
        await channel.bindQueue(queue, NOTIFY_EXCHANGE, '');

        console.log(`[Sync] Real-time updates enabled.`);

        channel.consume(queue, (msg) => {
            if (!msg) return;

            console.log(`[Sync] Notification received, scheduling refresh...`);
            
            // Debounce logic: wait for burst to end before pulling
            if (refreshTimer) clearTimeout(refreshTimer);
            refreshTimer = setTimeout(() => {
                fetchLatestConfig(registry);
            }, REFRESH_DEBOUNCE_MS);

            channel.ack(msg);
        });

    } catch (error) {
        console.error(`[Sync] Real-time updates unavailable:`, error.message);
    }
};

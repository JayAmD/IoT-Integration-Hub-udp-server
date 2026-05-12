import { getRabbitChannel } from './rabbit.service.js';
import { 
    MAIN_APP_CONFIG_URL, 
    UDP_SERVER_TO_MAIN_APP_API_KEY 
} from '../../config/env.js';

const NOTIFY_EXCHANGE = 'udp_config_notify_exchange';
const REFRESH_DEBOUNCE_MS = 1000;

let refreshTimer = null;

/**
 * Pulls the full device configuration snapshot from the Main App.
 * Now a "Pure" fetcher: it just returns the data without side-effects.
 */
export const fetchLatestConfig = async () => {
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
        
        if (!body.success || !body.data) {
            throw new Error('Malformed API response.');
        }

        return body.data; // Return the full { updatedAt, devices } object
    } catch (error) {
        console.error(`[Sync] API Pull failed:`, error.message);
        return null;
    }
};

/**
 * Initializes the background listener for configuration change events.
 * Now follows the Observer pattern: it notifies a callback when data changes.
 * 
 * @param {Function} onUpdate - Callback function(configData)
 */
export const initializeSyncService = async (onUpdate) => {
    try {
        const channel = await getRabbitChannel();

        // Ensure exchange exists
        await channel.assertExchange(NOTIFY_EXCHANGE, 'fanout', { durable: true });

        // Create a transient, exclusive queue for this server instance
        const { queue } = await channel.assertQueue('', { exclusive: true });
        await channel.bindQueue(queue, NOTIFY_EXCHANGE, '');

        console.log(`[Sync] Real-time updates active.`);

        channel.consume(queue, (msg) => {
            if (!msg) return;

            console.log(`[Sync] Remote change notification received...`);
            
            // Debounce logic: wait for burst to end before pulling
            if (refreshTimer) clearTimeout(refreshTimer);
            refreshTimer = setTimeout(async () => {
                const configData = await fetchLatestConfig();
                if (configData && onUpdate) {
                    onUpdate(configData);
                }
            }, REFRESH_DEBOUNCE_MS);

            channel.ack(msg);
        });

    } catch (error) {
        console.error(`[Sync] Real-time updates disabled:`, error.message);
    }
};

import UDPServer from './core/udp.server.js';
import DeviceRegistry from './services/registry.service.js';
import { fetchLatestConfig, initializeSyncService } from './services/sync.service.js';
import { readJson, saveJsonAtomic } from './services/storage.service.js';
import { handleIncomingMessage } from './handlers/message.processor.js';
import { UDP_HOST, UDP_PORT } from '../config/env.js';

const DEVICES_FILE = './data/devices.json';

/**
 * Orchestrates the bootstrapping of the UDP Parser Server.
 * Follows a High-Availability boot sequence:
 * 1. Load local cache
 * 2. Start UDP listener immediately
 * 3. Sync with backend in the background
 */
async function bootstrap() {
    console.log(`
=========================================
   IoT Integration Hub - UDP Parser
=========================================
[Main] Booting services...`);

    const registry = new DeviceRegistry();

    const applyNewConfiguration = async (configData) => {
        if (!configData || !configData.devices) return;

        // 1. Update in-memory state
        registry.update(configData.devices);

        // 2. Persist to disk for high-availability boot
        await saveJsonAtomic(DEVICES_FILE, configData);

        console.log(`[Main] Configuration applied (${configData.devices.length} devices).`);
    };

    // 1. Initialize from local cache (High-Availability)
    const localCache = await readJson(DEVICES_FILE);
    if (localCache && localCache.devices) {
        console.log(`[Main] Cache: Loaded ${localCache.devices.length} devices from disk.`);
        registry.update(localCache.devices);
    }

    // 2. Start the UDP Server listener 
    // We bind ASAP so we don't miss packets while syncing
    const udpPort = Number(UDP_PORT) || 5002;
    const udpHost = UDP_HOST || "127.0.0.1";

    UDPServer(udpPort, udpHost, registry, (msg, rinfo) =>
        handleIncomingMessage(msg, rinfo, registry)
    );

    // 3. Setup Background Synchronization (Observer Pattern)
    // When the SyncService finds new data, it notifies this orchestrator

    // Perform initial fetch
    fetchLatestConfig().then(applyNewConfiguration);

    // Setup live RabbitMQ listener
    initializeSyncService(applyNewConfiguration);
}

// Global Error Handler
process.on('unhandledRejection', (reason, promise) => {
    console.error('[Main] Unhandled Rejection at:', promise, 'reason:', reason);
});

// Kickoff
bootstrap().catch(err => {
    console.error('[Main] CRITICAL BOOT ERROR:', err);
    process.exit(1);
});

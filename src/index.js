import UDPServer from './UDPServer.js';
import DeviceRegistry from './registry.js';
import { fetchLatestConfig, initializeSyncService } from './sync.js';
import { readJson } from './storage.js';
import { handleIncomingMessage } from './processor.js';
import { UDP_HOST, UDP_PORT } from '../config/env.js';

const DEVICES_FILE = './config/devices.json';

/**
 * Orchestrates the bootstrapping of the UDP Parser Server.
 */
async function bootstrap() {
    console.log(`
=========================================
   IoT Integration Hub - UDP Parser
=========================================
[Main] Booting services...`);

    // 1. Initialize Registry & Load local cache
    const registry = new DeviceRegistry();
    const localDevices = await readJson(DEVICES_FILE);

    if (localDevices) {
        console.log(`[Main] Cache: Loaded ${localDevices.length} devices from disk.`);
        registry.update(localDevices);
    }

    // 2. Initial Sync
    // Ensures we have fresh data from Main App before handling any packets
    await fetchLatestConfig(registry);

    // 3. Real-time Sync
    // Start RabbitMQ listener for dynamic updates
    await initializeSyncService(registry);

    // 4. UDP Listener
    const udpPort = Number(UDP_PORT) || 5002;
    const udpHost = UDP_HOST || "127.0.0.1";

    UDPServer(udpPort, udpHost, registry, (msg, rinfo) =>
        handleIncomingMessage(msg, rinfo, registry)
    );
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

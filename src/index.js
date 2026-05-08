import UDPServer from './UDPServer.js';
import Config from './config.js';
import { publishMessage } from './queue.js';

// Configuration
const UDP_PORT = process.env.UDP_PORT || 5002;
const UDP_HOST = process.env.UDP_HOST || '127.0.0.1'; // '0.0.0.0' binds to all network interfaces

// Initialize config explicitly with devices path and decoders folder
const config = new Config('./config/devices.json', './config/decoders/');

/**
 * Main callback to handle messages received by the UDP server.
 */
async function handleIncomingMessage(msg, rinfo) {
    console.log(`[Main] Processing message from ${rinfo.address}:${rinfo.port} (SN: ${msg.serialNumber})`);

    try {
        const decodeFn = config.getDecoder(msg.serialNumber);
        //TODO see what is the purpose of the decode function, and the other functions instead of class
        if (!decodeFn) {
            throw new Error(`Decoder for SN ${msg.serialNumber} not found/loaded.`);
        }

        const decodedPayload = decodeFn(msg.raw);
        msg.data = decodedPayload;
        console.log(`[Main] Decoded data:`, JSON.stringify(msg.data, null, 2));

        // 1. Prepare the record for RabbitMQ
        const device = config.getDevice(msg.serialNumber);
        const record = {
            serialNumber: msg.serialNumber,
            deviceId: device.id,
            receivedAt: msg.receivedAt,
            data: msg.data
        };

        // 2. Publish to RabbitMQ for reliable forwarding
        await publishMessage(record);

    } catch (error) {
        console.error(`[Main] Failed to process message:`, error.message);
    }
}

// Start the UDP Server
console.log(`Starting UDP Parser Server...`);

UDPServer(UDP_PORT, UDP_HOST, config, handleIncomingMessage);

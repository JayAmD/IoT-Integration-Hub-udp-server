import UDPServer from './servers/UDPServer.js';
import Config from './config.js';

// Configuration
const UDP_PORT = process.env.UDP_PORT || 5002;
const UDP_HOST = process.env.UDP_HOST || '127.0.0.1'; // '0.0.0.0' binds to all network interfaces

// Initialize config explicitly with devices path and decoders folder
const config = new Config('../config/devices.json', '../config/decoders/');

/**
 * Main callback to handle messages received by the UDP server.
 */
function handleIncomingMessage(msg, rinfo) {
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
    } catch (error) {
        console.error(`[Main] Failed to decode payload:`, error.message);
    }
}

// Start the UDP Server
console.log(`Starting UDP Parser Server...`);

UDPServer(UDP_PORT, UDP_HOST, config, handleIncomingMessage);

import UDPServer from './servers/UDPServer.js';
import { createDecoderFromFile } from './decoder.js';

// Configuration
const UDP_PORT = process.env.UDP_PORT || 5002;
const UDP_HOST = process.env.UDP_HOST || '127.0.0.1'; // '0.0.0.0' binds to all network interfaces

// Initialize the decoder
const decodePayload = createDecoderFromFile('cbor-decoder.yaml');

/**
 * Main callback to handle messages received by the UDP server.
 */
function handleIncomingMessage(msg, rinfo) {
    console.log(`[Main] Processing message from ${rinfo.address}:${rinfo.port}`);
    console.log(`[Main] Raw payload buffer:`, msg.raw);

    try {
        const decodedPayload = decodePayload(msg.raw);
        msg.data = decodedPayload;
        console.log(`[Main] Decoded data:`, JSON.stringify(msg.data, null, 2));
    } catch (error) {
        console.error(`[Main] Failed to decode payload:`, error.message);
    }
}

// Start the UDP Server
console.log(`Starting UDP Parser Server...`);

UDPServer(UDP_PORT, UDP_HOST, handleIncomingMessage);

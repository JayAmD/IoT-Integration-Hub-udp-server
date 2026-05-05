import UDPServer from './servers/UDPServer.js';

// Configuration
const UDP_PORT = process.env.UDP_PORT || 5002;
const UDP_HOST = process.env.UDP_HOST || '127.0.0.1'; // '0.0.0.0' binds to all network interfaces

/**
 * Main callback to handle messages received by the UDP server.
 */
function handleIncomingMessage(msg, rinfo) {
    console.log(`[Main] Processing message from ${rinfo.address}:${rinfo.port}`);
    console.log(`[Main] Raw payload:`, msg);
}

// Start the UDP Server
console.log(`Starting UDP Parser Server...`);

UDPServer(UDP_PORT, UDP_HOST, handleIncomingMessage);

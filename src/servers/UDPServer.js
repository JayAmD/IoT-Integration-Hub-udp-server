import dgram from 'dgram';

/**
 * Starts the UDP server to listen for incoming NB-IoT messages.
 * @param {number} port - The port to listen on.
 * @param {string} host - The address to bind to (e.g., '0.0.0.0' or '127.0.0.1').
 * @param {function} onMessage - Callback function to handle incoming messages.
 * @returns {dgram.Socket} The UDP server instance.
 */
export default function UDPServer(port, host, onMessage) {
    const server = dgram.createSocket('udp4');

    server.on('error', (err) => {
        console.error(`[UDP] Server error:\n${err.stack}`);
        server.close();
    });

    server.on('message', (msg, rinfo) => {
        console.log(`[UDP] Received raw message from ${rinfo.address}:${rinfo.port}`);

        if (onMessage) {
            onMessage(msg, rinfo);
        }
    });

    server.on('listening', () => {
        const address = server.address();
        console.log(`[UDP] Server listening on ${address.address}:${address.port}`);
    });

    // Binds the server to the specific port and host address.
    server.bind(port, host);
    return server;
}

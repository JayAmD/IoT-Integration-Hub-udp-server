import dgram from 'dgram';
import crypto from 'crypto';

const HEADER_SIZE = 15; // 8 (hash) + 4 (SN) + 2 (Flags/Seq) + 1 (MsgType)

/**
 * Starts the UDP server to listen for incoming NB-IoT messages.
 * @param {number} port - The port to listen on.
 * @param {string} host - The address to bind to (e.g., '0.0.0.0' or '127.0.0.1').
 * @param {object} config - The initialized config instance.
 * @param {function} onMessage - Callback function to handle incoming messages.
 * @returns {dgram.Socket} The UDP server instance.
 */
export default function UDPServer(port, host, config, onMessage) {
    const server = dgram.createSocket('udp4');

    server.on('error', (err) => {
        console.error(`[UDP] Server error:\n${err.stack}`);
        server.close();
    });

    server.on('message', async (msg, rinfo) => {
        console.log(`[UDP] Received from: ${rinfo.address}:${rinfo.port} l: ${msg.length} data: ${msg.toString('hex')}`);

        try {
            if (msg.length < HEADER_SIZE) {
                throw new Error('Message too short to contain the Hardwario header');
            }

            // 1. Extract the 15-byte header components
            const receivedHash = msg.slice(0, 8);
            const serialNumber = msg.readUInt32BE(8); // Hardwario uses Big-Endian

            const flagsAndSeq = msg.readUInt16BE(12);
            const flags = (flagsAndSeq >> 12) & 0x0F;
            const sequence = flagsAndSeq & 0x0FFF;

            const messageType = msg.readUInt8(14);
            const raw = msg.slice(HEADER_SIZE); // The CBOR payload

            // 2. Fetch the claim token for this specific device
            const device = config.getDevice(serialNumber);
            if (!device) {
                throw new Error(`Device with SN ${serialNumber} not found in devices.json!`);
            }
            
            const claimToken = Buffer.from(device.claimToken, 'hex');

            // 3. Verify the Security Signature (SHA-256 XOR truncated)
            const sha256 = crypto.createHash('sha256');
            sha256.update(claimToken);
            sha256.update(msg.slice(8)); // Hash everything after the 8-byte hash field
            const fullDigest = sha256.digest();

            // Replicate the device's XOR truncation logic
            const calculatedHash = Buffer.alloc(8);
            for (let i = 0; i < 8; i++) {
                calculatedHash[i] = fullDigest[i] ^ fullDigest[8 + i] ^ fullDigest[16 + i] ^ fullDigest[24 + i];
            }

            if (Buffer.compare(receivedHash, calculatedHash) !== 0) {
                throw new Error('Security signature hash does not match!');
                console.warn(`[UDP] Hash mismatch for SN: ${serialNumber} (Expected if using dummy claim token)`);
            }

            // 4. Optionally switch by message type (0x06 is UL_UPLOAD_DATA)


            const decodedData = {
                time: Math.floor((new Date().getTime()) / 1000),
                port: port,
                serialNumber: serialNumber,
                flags: flags,
                sequence: sequence,
                messageType: messageType,
                raw,
            };

            if (onMessage) {
                onMessage(decodedData, rinfo);
            }
        } catch (error) {
            console.warn('[UDP] Server parse error: %s', error.message);
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

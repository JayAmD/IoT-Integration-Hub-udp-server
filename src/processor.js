import { publishMessage } from './queue.js';

/**
 * Orchestrates the processing of IoT messages received via UDP.
 * This is the central "Business Logic" of the UDP Parser.
 */
export async function handleIncomingMessage(msg, rinfo, registry) {
    const { serialNumber } = msg;
    console.log(`[Processor] Processing packet from SN ${serialNumber} (${rinfo.address})`);

    try {
        // 1. Resolve Decoder Logic
        const decodeFn = registry.getDecoder(serialNumber);
        if (!decodeFn) {
            throw new Error(`No decoder found for Serial Number ${serialNumber}`);
        }

        // 2. Decode the binary payload
        const decodedPayload = decodeFn(msg.raw);
        msg.data = decodedPayload;
        
        console.log(`[Processor] Decoded payload:`, JSON.stringify(msg.data));

        // 3. Resolve Device Identity
        const device = registry.getDevice(serialNumber);
        const record = {
            serialNumber: Number(serialNumber),
            deviceId: device?.id, // May be undefined if device is unknown but we still forward
            receivedAt: msg.receivedAt,
            data: msg.data
        };

        // 4. Forward to Backend via RabbitMQ
        await publishMessage(record);

    } catch (error) {
        console.error(`[Processor] Error for SN ${serialNumber}:`, error.message);
    }
}

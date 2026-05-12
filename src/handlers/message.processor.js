import { publishMessage } from '../services/telemetry.publisher.js';

/**
 * Orchestrates the processing of IoT messages received via UDP.
 * This is the central "Business Logic" of the UDP Parser.
 */
export async function handleIncomingMessage(msg, rinfo, registry) {
    const { serialNumber } = msg;
    console.log(`[Processor] Processing packet from SN ${serialNumber} (${rinfo.address})`);

    try {
        // 1. Get decoder logic from registry
        const decoder = registry.getDecoder(serialNumber);
        if (!decoder) {
            throw new Error(`Decoder instance not found for SN ${serialNumber}`);
        }

        // 2. Decode the binary payload
        const decodedPayload = decoder.decode(msg.raw);
        msg.data = decodedPayload;

        console.log(`[Processor] Decoded payload:`, JSON.stringify(msg.data));

        // 3. Resolve Device Identity
        const device = registry.getDevice(serialNumber);
        const record = {
            serialNumber: Number(serialNumber),
            deviceId: device.id,
            receivedAt: msg.receivedAt,
            data: msg.data
        };

        // 4. Forward to Backend via RabbitMQ
        await publishMessage(record);

    } catch (error) {
        console.error(`[Processor] Error for SN ${serialNumber}:`, error.message);
    }
}

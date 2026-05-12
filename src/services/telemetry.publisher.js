import { getRabbitChannel } from './rabbit.service.js';

const QUEUE_NAME = 'iot.telemetry.normalized';

/**
 * Publishes a processed IoT message to the backend queue.
 * @param {object} data - The JSON object to publish.
 */
export async function publishMessage(data) {
    try {
        const channel = await getRabbitChannel();
        const buffer = Buffer.from(JSON.stringify(data));

        // persistent: true ensures the message survives a RabbitMQ crash/restart
        channel.sendToQueue(QUEUE_NAME, buffer, { persistent: true });

        console.log(`[Queue] Message published for SN: ${data.serialNumber}`);
    } catch (error) {
        console.error(`[Queue] Failed to publish message:`, error.message);
    }
}

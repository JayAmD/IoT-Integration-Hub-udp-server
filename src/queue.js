import amqp from 'amqplib';

let channel = null;
let connection = null;

const RABBIT_URL = process.env.RABBIT_URL || 'amqp://guest:guest@localhost:5672';
const QUEUE_NAME = 'udp_parser_server_iot_msgs_queue';

/**
 * Gets or creates a RabbitMQ channel.
 */
export async function getChannel() {
    if (channel) return channel;

    try {
        console.log(`[Queue] Connecting to RabbitMQ at ${RABBIT_URL}...`);
        connection = await amqp.connect(RABBIT_URL);

        connection.on('error', (err) => {
            console.error("[Queue] Connection error:", err.message);
            channel = null;
            connection = null;
        });

        connection.on('close', () => {
            console.warn("[Queue] Connection closed. Will reconnect on next attempt.");
            channel = null;
            connection = null;
        });

        channel = await connection.createChannel();
        await channel.assertQueue(QUEUE_NAME, { durable: true });

        console.log(`[Queue] Connected and queue "${QUEUE_NAME}" is ready.`);
        return channel;
    } catch (err) {
        console.error("[Queue] Failed to connect to RabbitMQ:", err.message);
        throw err;
    }
}

/**
 * Publishes a message to the queue.
 * @param {object} data - The JSON object to publish.
 */
export async function publishMessage(data) {
    try {
        const chan = await getChannel();
        const buffer = Buffer.from(JSON.stringify(data));

        // persistent: true ensures the message survives a RabbitMQ crash/restart
        chan.sendToQueue(QUEUE_NAME, buffer, { persistent: true });

        console.log(`[Queue] Message published to ${QUEUE_NAME}`);
    } catch (error) {
        console.error(`[Queue] Failed to publish message:`, error.message);
        // In a real app, you might want to fall back to local file storage here
    }
}

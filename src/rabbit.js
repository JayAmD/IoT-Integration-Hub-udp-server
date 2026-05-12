import amqp from 'amqplib';
import { RABBIT_URL } from '../config/env.js';

let connection = null;
let channel = null;

/**
 * Shared connection manager for RabbitMQ.
 * Centralizes connection lifecycle and channel creation.
 */
export const getRabbitChannel = async () => {
    if (channel) return channel;

    try {
        if (!connection) {
            console.log(`[Rabbit] Connecting to RabbitMQ at ${RABBIT_URL}...`);
            connection = await amqp.connect(RABBIT_URL);

            connection.on('error', (err) => {
                console.error("[Rabbit] Connection error:", err.message);
                connection = null;
                channel = null;
            });

            connection.on('close', () => {
                console.warn("[Rabbit] Connection closed.");
                connection = null;
                channel = null;
            });
        }

        channel = await connection.createChannel();
        
        // Ensure default IoT messages queue exists
        const IOT_MSGS_QUEUE = 'udp_parser_server_iot_msgs_queue';
        await channel.assertQueue(IOT_MSGS_QUEUE, { durable: true });

        console.log(`[Rabbit] Channel initialized.`);
        return channel;
    } catch (error) {
        console.error("[Rabbit] Failed to initialize RabbitMQ:", error.message);
        throw error;
    }
};

/**
 * Helper to close the connection gracefully
 */
export const closeRabbit = async () => {
    if (connection) {
        await connection.close();
        connection = null;
        channel = null;
    }
};

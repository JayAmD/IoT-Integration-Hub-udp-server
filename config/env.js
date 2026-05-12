import { config } from 'dotenv';

// Load environment-specific file
const envFile = `.env.${process.env.NODE_ENV || 'development'}.local`;
config({ path: envFile });


export const {
    RABBIT_URL,
    MAIN_APP_CONFIG_URL,
    UDP_SERVER_TO_MAIN_APP_API_KEY,
    UDP_PORT,
    UDP_HOST,
} = process.env;

// Log configuration status on load (without sensitive values)
console.log(`[Config] Environment loaded from ${envFile}`);
console.log(`[Config] UDP Server configured for ${UDP_HOST}:${UDP_PORT}`);
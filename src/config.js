import fs from 'fs';
import path from 'path';
import { createDecoderFromFile } from './decoder.js';

export default class Config {
    constructor(devicesPath, decodersDir) {
        this.devices = new Map(); // sn -> device metadata
        this.decoders = new Map(); // filename -> pre-initialized decoder function
        this.decodersDir = decodersDir;

        this.load(devicesPath);
    }

    load(devicesPath) {
        try {
            const absoluteConfigPath = path.resolve(process.cwd(), devicesPath);
            const devicesData = fs.readFileSync(absoluteConfigPath, 'utf8');
            const deviceList = JSON.parse(devicesData);

            deviceList.forEach(device => {
                this.devices.set(device.serialNumber, device);

                // Pre-initialize the decoder if it hasn't been loaded yet
                if (!this.decoders.has(device.decoder)) {
                    // Resolve decoder path relative to the provided decodersDir
                    const decoderPath = path.resolve(process.cwd(), this.decodersDir, device.decoder);
                    try {
                        const decodeFn = createDecoderFromFile(decoderPath);
                        this.decoders.set(device.decoder, decodeFn);
                        console.log(`[Config] Loaded decoder: ${device.decoder} from ${this.decodersDir}`);
                    } catch (err) {
                        console.error(`[Config] Failed to load decoder "${device.decoder}" from ${this.decodersDir}:`, err.message);
                    }
                }
            });

            console.log(`[Config] Successfully loaded ${this.devices.size} devices.`);
        } catch (error) {
            console.error(`[Config] Failed to load devices config from "${devicesPath}":`, error.message);
        }
    }

    /**
     * Get device metadata by Serial Number
     */
    getDevice(sn) {
        return this.devices.get(sn);
    }

    /**
     * Get the decoder function for a specific device Serial Number
     */
    getDecoder(sn) {
        const device = this.getDevice(sn);
        if (!device) return null;
        return this.decoders.get(device.decoder);
    }
}


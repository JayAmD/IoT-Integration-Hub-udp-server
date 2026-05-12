import path from 'path';
import { createDecoderFromFile } from './decoder.js';

/**
 * Manages device metadata and pre-initialized decoder functions.
 */
export default class DeviceRegistry {
    constructor(decodersDir = './config/decoders/') {
        this.devices = new Map(); // serialNumber (Number) -> device metadata
        this.decoders = new Map(); // filename -> pre-initialized decoder function
        this.decodersDir = decodersDir;
    }

    /**
     * Updates the internal registry with a new list of devices.
     * Efficiently reloads only necessary decoders.
     */
    update(deviceList) {
        if (!Array.isArray(deviceList)) {
            throw new Error('[Registry] Invalid device list provided.');
        }

        const newDevices = new Map();

        deviceList.forEach(device => {
            newDevices.set(device.serialNumber, device);

            // Initialize decoder if it's new or not yet loaded
            if (device.decoder && !this.decoders.has(device.decoder)) {
                this._loadDecoder(device.decoder);
            }
        });

        this.devices = newDevices;
        console.log(`[Registry] Updated with ${this.devices.size} devices.`);
    }

    /**
     * Get device metadata by Serial Number
     */
    getDevice(serialNumber) {
        return this.devices.get(Number(serialNumber));
    }

    /**
     * Get the decoder function for a specific device Serial Number
     */
    getDecoder(serialNumber) {
        const device = this.getDevice(serialNumber);
        if (!device || !device.decoder) return null;
        return this.decoders.get(device.decoder);
    }

    _loadDecoder(filename) {
        const decoderPath = path.resolve(process.cwd(), this.decodersDir, filename);
        try {
            const decodeFn = createDecoderFromFile(decoderPath);
            this.decoders.set(filename, decodeFn);
            console.log(`[Registry] Loaded decoder logic: ${filename}`);
        } catch (err) {
            console.error(`[Registry] Failed to load decoder "${filename}":`, err.message);
        }
    }
}

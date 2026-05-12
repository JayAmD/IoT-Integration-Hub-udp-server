import path from 'path';
import { newDecoderFromFile } from '../core/binary.parser.js';

/**
 * Manages device metadata and pre-initialized decoder functions.
 */
export default class DeviceRegistry {
    constructor(decodersDir = './decoders/') {
        this.devices = new Map(); // serialNumber (Number) -> device metadata
        this.decoders = new Map(); // filename -> pre-initialized decoder function
        this.decodersDir = decodersDir;
    }

    /**
     * Updates the internal registry with a new list of devices.
     * Efficiently reloads only necessary decoders.
     */
    update(configInput) {
        let deviceList = [];
        let updatedAt = null;

        if (Array.isArray(configInput)) {
            deviceList = configInput;
        } else if (configInput && Array.isArray(configInput.devices)) {
            deviceList = configInput.devices;
            updatedAt = configInput.updatedAt;
        } else {
            throw new Error('[Registry] Invalid configuration input provided.');
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
        const timeLog = updatedAt ? ` (Synced at: ${updatedAt})` : '';
        console.log(`[Registry] Updated with ${this.devices.size} devices${timeLog}.`);
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
            const decoder = newDecoderFromFile(decoderPath);
            this.decoders.set(filename, decoder);
            console.log(`[Registry] Loaded decoder logic: ${filename}`);
        } catch (err) {
            console.error(`[Registry] Failed to load decoder "${filename}":`, err.message);
        }
    }
}

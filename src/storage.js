import fs from 'fs/promises';
import path from 'path';

/**
 * Service for safe and atomic file operations.
 */
export const readJson = async (filePath) => {
    try {
        const absolutePath = path.resolve(process.cwd(), filePath);
        const data = await fs.readFile(absolutePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return null;
        }
        throw error;
    }
};

export const saveJsonAtomic = async (filePath, data) => {
    const absolutePath = path.resolve(process.cwd(), filePath);
    const tempPath = `${absolutePath}.tmp`;

    try {
        // 1. Write to temporary file
        await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf8');
        
        // 2. Atomic rename (replaces target if it exists)
        await fs.rename(tempPath, absolutePath);
        
        return true;
    } catch (error) {
        // Cleanup temp file on failure
        try {
            await fs.unlink(tempPath);
        } catch (unlinkError) {
            // Ignore unlink errors
        }
        throw error;
    }
};

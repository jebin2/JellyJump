/**
 * ElectronHelper - Utility for Electron-specific operations
 * Provides a clean interface for detecting Electron and accessing its APIs
 */
export class ElectronHelper {
    /**
     * Check if running in Electron environment
     * @returns {boolean}
     */
    static isElectron() {
        return Boolean(window.electronAPI?.isElectron);
    }

    /**
     * Check if a file exists at the given path
     * @param {string} filePath - Absolute path to the file
     * @returns {Promise<boolean>}
     */
    static async fileExists(filePath) {
        if (!this.isElectron()) return false;
        return window.electronAPI.fileExists(filePath);
    }

    /**
     * Read a file from disk
     * @param {string} filePath - Absolute path to the file
     * @returns {Promise<{success: boolean, buffer?: ArrayBuffer, error?: string}>}
     */
    static async readFile(filePath) {
        if (!this.isElectron()) {
            return { success: false, error: 'Not running in Electron' };
        }
        return window.electronAPI.readFile(filePath);
    }

    /**
     * Get file stats
     * @param {string} filePath - Absolute path to the file
     * @returns {Promise<{success: boolean, stats?: Object, error?: string}>}
     */
    static async getFileStats(filePath) {
        if (!this.isElectron()) {
            return { success: false, error: 'Not running in Electron' };
        }
        return window.electronAPI.getFileStats(filePath);
    }

    /**
     * Open native file dialog
     * @param {Object} options - Dialog options
     * @returns {Promise<{success: boolean, files?: Array, canceled?: boolean, error?: string}>}
     */
    static async openFileDialog(options = {}) {
        if (!this.isElectron()) {
            return { success: false, error: 'Not running in Electron' };
        }
        return window.electronAPI.openFileDialog(options);
    }

    /**
     * Read a file and convert to Blob
     * @param {string} filePath - Absolute path to the file
     * @param {string} mimeType - MIME type for the blob
     * @returns {Promise<Blob|null>}
     */
    static async readFileAsBlob(filePath, mimeType = 'video/mp4') {
        const result = await this.readFile(filePath);
        if (!result.success) {
            console.error('[ElectronHelper] Failed to read file:', result.error);
            return null;
        }
        return new Blob([result.buffer], { type: mimeType });
    }
}

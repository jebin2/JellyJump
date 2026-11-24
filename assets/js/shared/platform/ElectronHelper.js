// @ts-check
import { Logger } from "../utils/Logger.js";
import { isDesktop, desktopBridge } from './Platform.js';
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
        return isDesktop();
    }

    /**
     * Check if a file exists at the given path
     * @param {string} filePath - Absolute path to the file
     * @returns {Promise<boolean>}
     */
    static async fileExists(filePath) {
        if (!this.isElectron()) return false;
        return desktopBridge().fileExists(filePath);
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
        return desktopBridge().readFile(filePath);
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
        return desktopBridge().getFileStats(filePath);
    }

    /**
     * Open native file dialog
     * @param {Object} options - Dialog options
     * @returns {Promise<{success: boolean, files?: string[], canceled?: boolean, error?: string}>}
     */
    static async openFileDialog(options = {}) {
        if (!this.isElectron()) {
            return { success: false, error: 'Not running in Electron' };
        }
        return desktopBridge().openFileDialog(options);
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
            Logger.error('[ElectronHelper] Failed to read file:', result.error);
            return null;
        }
        return new Blob([/** @type {ArrayBuffer} */ (result.buffer)], { type: mimeType });
    }
}

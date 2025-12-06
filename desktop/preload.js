const { contextBridge, ipcRenderer } = require('electron');

/**
 * Preload script for JellyJump Electron App
 * Exposes secure file system APIs to the renderer process
 */
contextBridge.exposeInMainWorld('electronAPI', {
    // Flag to detect Electron environment
    isElectron: true,

    /**
     * Read a file from disk and return as ArrayBuffer
     * @param {string} filePath - Absolute path to the file
     * @returns {Promise<{success: boolean, buffer?: ArrayBuffer, error?: string}>}
     */
    readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),

    /**
     * Check if a file exists at the given path
     * @param {string} filePath - Absolute path to the file
     * @returns {Promise<boolean>}
     */
    fileExists: (filePath) => ipcRenderer.invoke('file-exists', filePath),

    /**
     * Get file stats (size, modified time)
     * @param {string} filePath - Absolute path to the file
     * @returns {Promise<{success: boolean, stats?: {size: number, mtime: number}, error?: string}>}
     */
    getFileStats: (filePath) => ipcRenderer.invoke('get-file-stats', filePath)
});

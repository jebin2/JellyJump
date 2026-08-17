/**
 * Scanner host — main-process side of the media scanner.
 *
 * Owns the scanner utilityProcess lifecycle and relays its streamed events to
 * the renderer that asked for the scan. Kept out of main.js so it can be
 * registered on its own, which is also what lets the scanner be tested without
 * booting the whole app window.
 */
const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, ipcMain, utilityProcess } = require('electron');
const libraryIndex = require('./library-index');

let scannerProcess = null;
let scannerWindow = null;

function scannerPath() {
    let scriptPath = path.join(__dirname, 'scanner.js');
    if (app.isPackaged) {
        const unpacked = scriptPath.replace('app.asar', 'app.asar.unpacked');
        if (fs.existsSync(unpacked)) scriptPath = unpacked;
    }
    return scriptPath;
}

function relay(payload) {
    if (scannerWindow && !scannerWindow.isDestroyed()) {
        scannerWindow.webContents.send('media-scan-event', payload);
    }
}

function getScanner() {
    if (scannerProcess) return scannerProcess;

    scannerProcess = utilityProcess.fork(scannerPath(), [], { serviceName: 'JellyJumpScanner' });

    scannerProcess.on('message', (message) => {
        // Keep a copy in the main process. The renderer's list is unreachable
        // from the HTTP server, and rescanning just to answer requests would
        // walk the whole tree twice.
        if (message?.type === 'started') libraryIndex.setRoots(message.roots);
        if (message?.type === 'batch') libraryIndex.addBatch(message.files);
        relay(message);
    });

    // A scanner that dies must not leave the renderer waiting forever, so its
    // exit is reported as a terminal event of the scan itself.
    scannerProcess.on('exit', (code) => {
        scannerProcess = null;
        if (code !== 0) {
            console.error('[Scanner] Exited with code', code);
            relay({ type: 'error', message: `Scanner stopped unexpectedly (code ${code})` });
        }
    });

    return scannerProcess;
}

/**
 * Register the scanner IPC handlers.
 * @param {Object} deps
 * @param {Function} deps.assertTrustedIpcEvent - rejects senders that are not local pages
 * @param {Function} deps.normalizeUserFilePath - resolves and validates a caller-supplied path
 */
function registerScannerIpc({ assertTrustedIpcEvent, normalizeUserFilePath }) {
    ipcMain.handle('start-media-scan', async (event, options = {}) => {
        try {
            assertTrustedIpcEvent(event);
            scannerWindow = BrowserWindow.fromWebContents(event.sender);
            const roots = Array.isArray(options.roots)
                ? options.roots.map(normalizeUserFilePath)
                : undefined;
            getScanner().postMessage({ type: 'scan', roots });
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('cancel-media-scan', async (event) => {
        try {
            assertTrustedIpcEvent(event);
            scannerProcess?.postMessage({ type: 'cancel' });
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    app.on('before-quit', stopScanner);
}

function stopScanner() {
    scannerProcess?.kill();
    scannerProcess = null;
}

module.exports = { registerScannerIpc, stopScanner };

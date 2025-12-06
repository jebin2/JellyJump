const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Resolve preload script path
// In packaged apps, unpacked files are in app.asar.unpacked
let preloadPath = path.join(__dirname, 'preload.js');
if (app.isPackaged) {
    const unpackedPath = preloadPath.replace('app.asar', 'app.asar.unpacked');
    if (fs.existsSync(unpackedPath)) {
        preloadPath = unpackedPath;
    }
}

// ============================================
// IPC Handlers for File System Access
// ============================================

/**
 * Read a file from disk and return as ArrayBuffer
 */
ipcMain.handle('read-file', async (event, filePath) => {
    try {
        console.log('[Electron] Reading file:', filePath);
        const buffer = await fs.promises.readFile(filePath);
        // Convert Node Buffer to ArrayBuffer for transfer
        return {
            success: true,
            buffer: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
        };
    } catch (error) {
        console.error('[Electron] Error reading file:', error.message);
        return { success: false, error: error.message };
    }
});

/**
 * Check if a file exists at the given path
 */
ipcMain.handle('file-exists', async (event, filePath) => {
    try {
        await fs.promises.access(filePath, fs.constants.R_OK);
        return true;
    } catch {
        return false;
    }
});

/**
 * Get file stats (size, modified time)
 */
ipcMain.handle('get-file-stats', async (event, filePath) => {
    try {
        const stats = await fs.promises.stat(filePath);
        return {
            success: true,
            stats: {
                size: stats.size,
                mtime: stats.mtimeMs
            }
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

/**
 * Open file dialog and return file paths with metadata
 */
ipcMain.handle('open-file-dialog', async (event, options = {}) => {
    const { dialog } = require('electron');

    try {
        const result = await dialog.showOpenDialog({
            properties: ['openFile', 'multiSelections'],
            filters: [
                { name: 'Videos', extensions: ['mp4', 'mkv', 'avi', 'webm', 'mov', 'm4v', 'wmv', 'flv'] },
                { name: 'All Files', extensions: ['*'] }
            ],
            ...options
        });

        if (result.canceled) {
            return { success: false, canceled: true };
        }

        // Get file stats for each selected file
        const files = await Promise.all(result.filePaths.map(async (filePath) => {
            const stats = await fs.promises.stat(filePath);
            const name = path.basename(filePath);
            return {
                path: filePath,
                name: name,
                size: stats.size,
                lastModified: stats.mtimeMs
            };
        }));

        return { success: true, files };
    } catch (error) {
        console.error('[Electron] Error opening file dialog:', error);
        return { success: false, error: error.message };
    }
});

// ============================================
// Window Creation
// ============================================

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 720,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true, // Important for loading local resources properly
            preload: preloadPath // Load preload script (handles ASAR unpacking)
        },
        autoHideMenuBar: true,
        title: "JellyJump Player",
        icon: path.join(__dirname, 'build/assets/icons/jelly_jump_logo.png'),
        backgroundColor: '#0a0a0a'
    });

    // Load the index.html from the build folder
    // In development, we might want to load from ../build, but for packaging, 
    // we will copy build to ./build
    const buildPath = path.join(__dirname, 'build/player.html');

    win.loadFile(buildPath).catch(err => {
        console.error('Failed to load index.html:', err);
        // Fallback for dev if not copied yet
        win.loadFile(path.join(__dirname, '../build/index.html'));
    });
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { registerScannerIpc } = require('./scanner-host');
const { registerShareIpc } = require('./share-host');
const { handleCliArgs } = require('./cli');

// Required on Linux AppImage: kernel user-namespace sandboxing is often
// unavailable (restricted sysctl), which causes the network service to crash
// before any file:// navigation can complete.
// NetworkServiceSandbox: the network service process inherits the same
//   sandbox restrictions and fails on systems without user namespaces.
// in-process-gpu: keeps GPU code in the main process to avoid GPU zygote
//   spawn failures on headless / restricted desktops.
if (process.platform === 'linux') {
    app.commandLine.appendSwitch('no-sandbox');
    app.commandLine.appendSwitch('disable-dev-shm-usage');
    app.commandLine.appendSwitch('disable-features', 'NetworkServiceSandbox');

    // Packaged only: in-process-gpu segfaults on launch on ordinary desktop
    // Linux (reproduced on Wayland/Mesa here — removing just this switch makes
    // the app start normally). It exists for the AppImage case, where the GPU
    // zygote cannot spawn, so it stays there and is kept out of `npm start`,
    // which otherwise cannot run at all.
    if (app.isPackaged) {
        app.commandLine.appendSwitch('in-process-gpu');
    }
}

const configPath = path.join(app.getPath('userData'), 'jellyjump.json');

function isTrustedIpcEvent(event) {
    const frameUrl = event.senderFrame?.url;
    if (!frameUrl) return false;

    try {
        const url = new URL(frameUrl);
        return url.protocol === 'file:';
    } catch {
        return false;
    }
}

function assertTrustedIpcEvent(event) {
    if (!isTrustedIpcEvent(event)) {
        throw new Error('Rejected IPC request from untrusted sender');
    }
}

function normalizeUserFilePath(filePath) {
    if (typeof filePath !== 'string' || filePath.trim() === '' || filePath.includes('\0')) {
        throw new Error('Invalid file path');
    }

    return path.resolve(filePath);
}

// Paths the user has explicitly granted through the open-file dialog this
// session. Restored playlist items reference paths from earlier sessions, so
// media-typed files are also allowed; everything else (keys, configs, source
// code) is off-limits to the renderer.
const grantedPaths = new Set();
const MEDIA_EXTENSIONS = new Set([
    '.mp4', '.mkv', '.avi', '.webm', '.mov', '.m4v', '.wmv', '.flv', '.ts', '.m2ts', '.mts', '.3gp', '.ogv',
    '.mp3', '.flac', '.wav', '.m4a', '.aac', '.ogg', '.opus', '.ac3', '.wma',
    '.srt', '.vtt', '.ass', '.ssa',
    '.gif', '.png', '.jpg', '.jpeg', '.webp', '.m3u8'
]);

function assertReadableUserPath(resolvedPath) {
    if (grantedPaths.has(resolvedPath)) return;
    if (MEDIA_EXTENSIONS.has(path.extname(resolvedPath).toLowerCase())) return;
    throw new Error('Access denied: path was not granted by the user');
}

function sanitizeOpenDialogOptions(options = {}) {
    const sanitized = {};

    if (Array.isArray(options.properties)) {
        const allowedProperties = new Set(['openFile', 'multiSelections', 'openDirectory']);
        sanitized.properties = options.properties.filter((property) => allowedProperties.has(property));
    }

    if (Array.isArray(options.filters)) {
        sanitized.filters = options.filters
            .filter((filter) => filter && typeof filter.name === 'string' && Array.isArray(filter.extensions))
            .map((filter) => ({
                name: filter.name,
                extensions: filter.extensions.filter((extension) => typeof extension === 'string')
            }));
    }

    if (typeof options.defaultPath === 'string' && !options.defaultPath.includes('\0')) {
        sanitized.defaultPath = path.resolve(options.defaultPath);
    }

    return sanitized;
}

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
// IPC Handlers for Config File (jellyjump.json)
// ============================================

ipcMain.handle('read-config', async (event) => {
    try {
        assertTrustedIpcEvent(event);
        const data = await fs.promises.readFile(configPath, 'utf8');
        return JSON.parse(data);
    } catch {
        return null;
    }
});

ipcMain.handle('write-config', async (event, data) => {
    try {
        assertTrustedIpcEvent(event);
        // Merge rather than replace. The renderer only knows about its own keys,
        // but the file also holds main-process state — the share token above
        // all. Writing the renderer's object wholesale erased that token on
        // every save, and since the playlist saves once a second during
        // playback, sharing would hand out a brand new token afterwards and
        // silently break every link already pasted on another device.
        let existing = {};
        try {
            existing = JSON.parse(await fs.promises.readFile(configPath, 'utf8'));
        } catch {
            // No config yet, or unreadable; this write creates it.
        }
        const merged = { ...existing, ...data };
        await fs.promises.writeFile(configPath, JSON.stringify(merged, null, 2), 'utf8');
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// ============================================
// IPC Handlers for File System Access
// ============================================

/**
 * Read a file from disk and return as ArrayBuffer
 */
ipcMain.handle('read-file', async (event, filePath) => {
    try {
        assertTrustedIpcEvent(event);
        const resolvedPath = normalizeUserFilePath(filePath);
        assertReadableUserPath(resolvedPath);
        console.log('[Electron] Reading file:', resolvedPath);
        const buffer = await fs.promises.readFile(resolvedPath);
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
        assertTrustedIpcEvent(event);
        const resolvedPath = normalizeUserFilePath(filePath);
        assertReadableUserPath(resolvedPath);
        await fs.promises.access(resolvedPath, fs.constants.R_OK);
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
        assertTrustedIpcEvent(event);
        const resolvedPath = normalizeUserFilePath(filePath);
        assertReadableUserPath(resolvedPath);
        const stats = await fs.promises.stat(resolvedPath);
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
        assertTrustedIpcEvent(event);
        const result = await dialog.showOpenDialog({
            properties: ['openFile', 'multiSelections'],
            filters: [
                { name: 'Videos', extensions: ['mp4', 'mkv', 'avi', 'webm', 'mov', 'm4v', 'wmv', 'flv'] },
                { name: 'All Files', extensions: ['*'] }
            ],
            ...sanitizeOpenDialogOptions(options)
        });

        if (result.canceled) {
            return { success: false, canceled: true };
        }

        // Grant read access to the files the user just picked
        result.filePaths.forEach((filePath) => grantedPaths.add(path.resolve(filePath)));

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

// The scanner runs in its own utilityProcess (see desktop/scanner.js): a tree
// walk here would block the event loop serving every IPC call and window event,
// and one in a renderer would die with the window.
registerScannerIpc({ assertTrustedIpcEvent, normalizeUserFilePath });

// Library sharing is off until switched on: no server, no token, nothing
// served. The token lives in the same config file as everything else, so a link
// already pasted on another device survives a restart.
registerShareIpc({
    assertTrustedIpcEvent,
    readShareToken: async () => {
        try {
            const data = JSON.parse(await fs.promises.readFile(configPath, 'utf8'));
            return data.shareToken || null;
        } catch {
            return null;
        }
    },
    writeShareToken: async (token) => {
        let data = {};
        try {
            data = JSON.parse(await fs.promises.readFile(configPath, 'utf8'));
        } catch {
            // No config yet; the token is the first thing to go in it.
        }
        data.shareToken = token;
        await fs.promises.writeFile(configPath, JSON.stringify(data, null, 2), 'utf8');
    },
});

// ============================================
// Window Creation
// ============================================

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 720,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: true,
            preload: preloadPath
        },
        autoHideMenuBar: true,
        title: "JellyJump Player",
        icon: path.join(__dirname, 'build/assets/icons/jelly_jump_logo.png'),
        backgroundColor: '#0a0a0a'
    });

    // The renderer has Node access (required by @mediabunny/server), so it must
    // never display remote content: open external links in the system browser,
    // block popups, and refuse any navigation away from the bundled files.
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('https://') || url.startsWith('http://')) {
            shell.openExternal(url);
        }
        return { action: 'deny' };
    });
    win.webContents.on('will-navigate', (event, url) => {
        if (!url.startsWith('file://')) {
            event.preventDefault();
            if (url.startsWith('https://') || url.startsWith('http://')) {
                shell.openExternal(url);
            }
        }
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

app.whenReady().then(async () => {
    // A flag means the user wants an answer, not an app — most likely over SSH,
    // where the share link is otherwise unreadable. Handled before any window
    // exists so nothing flashes up on the remote machine's display.
    if (await handleCliArgs(process.argv, configPath)) {
        app.quit();
        return;
    }

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

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { registerScannerIpc } = require('./scanner-host');
const { registerShareIpc } = require('./share-host');
const { handleCliArgs, isTerminalInvocation } = require('./cli');

function hasOzoneSwitch(argv) {
    return argv.some((arg) => arg.startsWith('--ozone-platform'));
}

/**
 * Re-run ourselves with a windowing backend that needs no display.
 *
 * app.commandLine.appendSwitch cannot do this: by the time the main script
 * runs, Chromium has already selected and initialized the ozone platform, so
 * the switch is read too late and ignored. Measured from a bare environment
 * (the SSH case) against the packaged build — appendSwitch and
 * ELECTRON_OZONE_PLATFORM_HINT both still died in aura; only a switch present
 * on the command line at exec time worked. A machine with a desktop session
 * hides this, because ozone then picks Wayland and succeeds anyway.
 *
 * spawnSync rather than spawn: this process must not reach `ready`, and
 * blocking the event loop is what guarantees it cannot.
 *
 * Signals therefore cannot be forwarded — a handler here cannot run while
 * spawnSync blocks (measured: it fires only after the call returns). So the two
 * signals are handled differently on purpose:
 *
 *   SIGINT  — ignored here. Ctrl+C already reaches the child directly through
 *             the terminal's process group, and ignoring it keeps this process
 *             alive to relay the child's shutdown output in the right order.
 *   SIGTERM — left at its default, so `kill` and `systemctl stop` do kill this
 *             process. The child notices its wrapper is gone (JELLYJUMP_WRAPPER_PID)
 *             and shuts down cleanly rather than being orphaned.
 */
function relaunchWithoutDisplay() {
    const { spawnSync } = require('child_process');
    process.on('SIGINT', () => {});
    const child = spawnSync(
        process.execPath,
        // --disable-gpu because nothing is ever drawn, and without it ANGLE
        // still tries to open the X display it does not have, printing an
        // error per attempt around our output.
        [...process.argv.slice(1), '--ozone-platform=headless', '--disable-gpu'],
        {
            stdio: 'inherit',
            // Named rather than inferred from ppid: `nohup jellyjump --no-gui &`
            // is a legitimate way to run this, and there the parent shell is
            // *meant* to go away. Only this wrapper's death means anything.
            env: { ...process.env, JELLYJUMP_WRAPPER_PID: String(process.pid) },
        }
    );
    // 128 + signal is the shell's own convention for a signalled exit.
    process.exit(child.status ?? (child.signal ? 128 + os.constants.signals[child.signal] : 1));
}

// Chosen here, at the top of the file, because by the time `ready` fires the
// windowing backend has already been picked — and on a machine reached over SSH
// there is none. Electron defaults to the X11 backend, finds no $DISPLAY, and
// aura aborts the process with SIGSEGV before any of our code runs. That killed
// every flag on exactly the machine the flags exist for.
const wantsTerminal = isTerminalInvocation(process.argv);
if (process.platform === 'linux' && wantsTerminal && !hasOzoneSwitch(process.argv)) {
    relaunchWithoutDisplay();  // never returns
}

// A GUI asked for where no display exists is the same crash, and it is worth
// saying so: the segfault above gives no hint that --no-gui is what was wanted.
if (process.platform === 'linux' && !wantsTerminal
    && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
    console.error('No display found — JellyJump cannot open a window here.\n\n'
        + 'If you are connected over SSH, run it without a window instead:\n\n'
        + '    jellyjump --no-gui\n');
    process.exit(1);
}

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

    // disable-gpu-sandbox addresses the same failure in-process-gpu was added
    // for — a GPU process that cannot spawn under a restricted sandbox —
    // without forcing GPU work into the main process.
    app.commandLine.appendSwitch('disable-gpu-sandbox');

    // in-process-gpu is opt-in now because it is destructive on an ordinary
    // desktop: measured on Wayland/Mesa, the packaged app emitted ~34,700 GPU
    // raster and EGL errors in 30 seconds against 1 without it, and it
    // segfaults outright in an unpackaged run. Kept behind a flag so a machine
    // that genuinely needs it can still ask.
    if (process.env.JELLYJUMP_IN_PROCESS_GPU === '1') {
        app.commandLine.appendSwitch('in-process-gpu');
    }
}

const configPath = path.join(app.getPath('userData'), 'jellyjump.json');

/**
 * The pid of a headless instance that is actually still alive, if there is one.
 * The recorded pid can be stale — a `kill -9` leaves no chance to clear it — so
 * it is checked rather than trusted.
 * @returns {number|null}
 */
function runningHeadlessPid() {
    try {
        const { headlessPid } = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (!headlessPid) return null;
        process.kill(headlessPid, 0);
        return headlessPid;
    } catch {
        return null;
    }
}

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
    const mode = await handleCliArgs(process.argv, configPath);
    if (mode === 'exit') {
        // app.exit, not app.quit: quit exits 0 regardless of process.exitCode,
        // so a failed --share-status or a rejected option would report success
        // to anything checking $?.
        app.exit(process.exitCode || 0);
        return;
    }
    // Only one instance may run, because sharing is machine-wide state, not
    // per-process: the second instance binds its own local port and points the
    // tailnet address at itself, taking the library over silently — and when it
    // exits it tears the mapping down, leaving the first instance running and
    // convinced it is still sharing while every link is dead. Two full disk
    // scans at once is the smaller half of the problem.
    //
    // Requested here rather than at the top of the file so --share-status and
    // --help still answer while an instance is running; those only read.
    if (!app.requestSingleInstanceLock()) {
        if (mode === 'headless') {
            console.error('JellyJump is already running on this machine.\n\n'
                + 'Only one instance can share the library — a second would take over the\n'
                + 'tailnet address, and stop sharing for the first when it exits.\n\n'
                + '    jellyjump --share-status    whether it is sharing, and the link\n');
            app.exit(1);
            return;
        }

        // A GUI launch normally raises the window the other instance owns. When
        // that instance is headless there is no window to raise, so this would
        // exit silently and look like the app was broken — say what is holding
        // it, and name the process to stop.
        const headlessPid = runningHeadlessPid();
        if (headlessPid) {
            const message = 'JellyJump is sharing this library without a window '
                + `(started with --no-gui, process ${headlessPid}).\n\n`
                + 'Stop it first — Ctrl+C in that terminal, or:\n\n'
                + `    kill ${headlessPid}`;
            // Both, because this launch may have come from a terminal or from a
            // desktop icon, and neither one sees the other's output.
            console.error(`JellyJump is already running.\n${message}\n`);
            require('electron').dialog.showErrorBox('JellyJump is already running', message);
            app.exit(1);
            return;
        }

        app.quit();
        return;
    }

    // A second launch of the GUI now lands here instead of opening a rival
    // window, so it raises the one already open.
    app.on('second-instance', () => {
        const [existing] = BrowserWindow.getAllWindows();
        if (existing) {
            if (existing.isMinimized()) existing.restore();
            existing.focus();
        }
    });

    if (mode === 'headless') {
        // No window at all, so this works on a box with no desktop session.
        const { runHeadless } = require('./headless');
        process.exitCode = await runHeadless(configPath);
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

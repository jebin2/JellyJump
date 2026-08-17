/**
 * Headless mode — share a library with no GUI.
 *
 * For a machine you only reach over SSH: it scans, starts sharing, prints the
 * link, and stays running until stopped. No window is ever created, so it works
 * on a box with no desktop session at all.
 *
 * The scan is driven from here rather than from the renderer, which is what
 * normally asks for it. Nothing else changes: the same scanner process, the
 * same index, the same server.
 */
const fs = require('fs');
const { app } = require('electron');
const { runScan, stopScanner } = require('./scanner-host');
const share = require('./share-host');
const libraryIndex = require('./library-index');

const PHASE_NAMES = { 1: 'media folders', 2: 'drives', 3: 'home directory' };

function readConfig(configPath) {
    try {
        return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch {
        return {};
    }
}

function writeConfig(configPath, data) {
    // Merge, for the same reason the IPC handler does: this file also holds
    // renderer state, and replacing it would drop the playlist.
    const merged = { ...readConfig(configPath), ...data };
    fs.writeFileSync(configPath, JSON.stringify(merged, null, 2), 'utf8');
}

/**
 * Run headless until stopped.
 * @returns {Promise<number>} process exit code, when it stops
 */
async function runHeadless(configPath) {
    share.configureTokens({
        readShareToken: async () => readConfig(configPath).shareToken || null,
        writeShareToken: async (token) => writeConfig(configPath, { shareToken: token }),
    });

    console.log('Scanning for media…');
    try {
        const result = await runScan({
            onPhase: (m) => console.log(`  ${PHASE_NAMES[m.phase] || `pass ${m.phase}`}…`),
        });
        console.log(`Found ${result.found} video${result.found === 1 ? '' : 's'} in ${result.scanned} files (${(result.elapsedMs / 1000).toFixed(1)}s)`);
    } catch (error) {
        console.error(`Scan failed: ${error.message}`);
        return 1;
    }

    const state = await share.enable();
    if (!state.enabled) {
        // The reason is the whole value of this path: on a headless box the
        // usual cause is Tailscale permissions, and the message names the fix.
        console.error(`\nCould not start sharing.\n${state.reason || state.tailscaleReason || 'Unknown reason'}`);
        return 1;
    }

    console.log(`\nSharing ${libraryIndex.size()} files.\n\n    ${state.url}\n`);
    console.log('Paste that into Add Link in JellyJump on any device on your tailnet.');
    console.log('This link is a credential — anyone with it and tailnet access can play your library.');
    console.log('\nRunning. Press Ctrl+C to stop sharing and exit.');

    return new Promise((resolve) => {
        let stopping = false;
        const shutdown = async (signal) => {
            if (stopping) return;
            stopping = true;
            console.log(`\nStopping (${signal})…`);
            // Leaving the tailscale serve mapping behind would keep pointing at
            // a port nothing is listening on, which looks like it still works.
            await share.stopSharing().catch(() => {});
            stopScanner();
            console.log('Stopped sharing.');
            resolve(0);
        };

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        app.on('before-quit', () => shutdown('quit'));
    });
}

module.exports = { runHeadless };

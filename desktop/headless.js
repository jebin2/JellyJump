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

    // Recorded so a later GUI launch can say what is holding the lock, and
    // name the process to stop. Without it that launch just dies silently.
    writeConfig(configPath, { headlessPid: process.pid });

    // Registered before anything long-running starts. The scan can take a while
    // on a slow disk, and Ctrl+C during it used to kill the process outright,
    // leaving the scanner process orphaned.
    const shutdown = installSignalHandlers(configPath);

    // Sharing starts before the scan, not after it. The link is the thing the
    // user came for and it does not depend on the scan: the server answers from
    // the index, which the scanner fills as it goes. Waiting for a full walk
    // before printing anything is what makes people interrupt it.
    const state = await share.enable();
    if (!state.enabled) {
        // The reason is the whole value of this path: on a headless box the
        // usual cause is Tailscale permissions, and the message names the fix.
        console.error(`Could not start sharing.\n${state.reason || state.tailscaleReason || 'Unknown reason'}`);
        return 1;
    }

    console.log(`Sharing.\n\n    ${state.url}\n`);
    console.log('Paste that into Add Link in JellyJump on any device on your tailnet.');
    console.log('This link is a credential — anyone with it and tailnet access can play your library.');
    console.log('\nScanning for media — the library fills in as it goes, so reload it there to see more.');

    let found = 0;
    let lastReport = Date.now();
    runScan({
        onPhase: (m) => console.log(`  ${PHASE_NAMES[m.phase] || `pass ${m.phase}`}…`),
        onBatch: (count) => {
            // Silence on a terminal reads as a hang, which is what makes
            // someone interrupt a scan that was working.
            found += count;
            if (Date.now() - lastReport >= 3000) {
                lastReport = Date.now();
                console.log(`    ${found} found…`);
            }
        },
    }).then((result) => {
        if (shutdown.requested) return;
        console.log(`\nScan complete: ${result.found} video${result.found === 1 ? '' : 's'} in ${result.scanned} files (${(result.elapsedMs / 1000).toFixed(1)}s)`);
        console.log('Running. Press Ctrl+C to stop sharing and exit.');
    }).catch((error) => {
        if (!shutdown.requested) console.error(`Scan failed: ${error.message}`);
    });

    console.log('Press Ctrl+C to stop sharing and exit.\n');

    return shutdown.whenStopped;
}

/**
 * Stop cleanly on Ctrl+C, whatever stage we are at.
 *
 * Leaving the tailscale serve mapping behind would keep pointing at a port
 * nothing is listening on, which from outside looks identical to working.
 * @returns {{requested: boolean, whenStopped: Promise<number>}}
 */
function installSignalHandlers(configPath) {
    const state = { requested: false };
    let resolveStopped;
    state.whenStopped = new Promise((resolve) => { resolveStopped = resolve; });

    let stopping = false;
    const stop = async (signal) => {
        if (stopping) return;
        stopping = true;
        state.requested = true;
        console.log(`\nStopping (${signal})…`);
        await share.stopSharing().catch(() => {});
        stopScanner();
        writeConfig(configPath, { headlessPid: null });
        console.log('Stopped.');
        resolveStopped(0);
    };

    process.on('SIGINT', () => stop('SIGINT'));
    process.on('SIGTERM', () => stop('SIGTERM'));
    app.on('before-quit', () => stop('quit'));
    return state;
}

module.exports = { runHeadless };

/**
 * Share host — main-process side of library sharing.
 *
 * Starts the local library server and fronts it with `tailscale serve`, then
 * hands the renderer a link to copy. Off until switched on: nothing is served
 * and no token exists until the user asks for it.
 *
 * The token persists across restarts so a link already pasted on a phone keeps
 * working; regenerating it is what revokes every link that was handed out.
 */
const crypto = require('crypto');
const os = require('os');
const { app, ipcMain } = require('electron');
const libraryServer = require('./library-server');
const libraryIndex = require('./library-index');
const tailscale = require('./tailscale');

const HTTPS_PORT = 8443;

let shareState = { enabled: false, url: null, dnsName: null, reason: null };
let readToken;
let writeToken;

async function currentToken() {
    let token = await readToken();
    if (!token) {
        token = crypto.randomBytes(32).toString('hex');
        await writeToken(token);
    }
    return token;
}

async function describe() {
    const ts = await tailscale.status();
    return {
        ...shareState,
        tailscaleAvailable: ts.available,
        tailscaleReason: ts.reason || null,
        dnsName: ts.dnsName || shareState.dnsName,
        itemCount: libraryIndex.size(),
    };
}

async function enable() {
    if (shareState.enabled) return describe();

    const ts = await tailscale.status();
    if (!ts.available) {
        // Not an error: no tailnet is an ordinary state, and the reason is what
        // the user needs to see.
        shareState = { enabled: false, url: null, dnsName: ts.dnsName || null, reason: ts.reason };
        return describe();
    }

    const token = await currentToken();
    const { port } = await libraryServer.start({
        token,
        name: ts.dnsName.split('.')[0],
    });

    const served = await tailscale.startServe({ localPort: port, httpsPort: HTTPS_PORT });
    if (!served.ok) {
        await libraryServer.stop();
        // By far the most common cause, and the one a user cannot guess: until
        // an operator is set, Tailscale only lets root publish a service, so
        // the app is refused. Name the exact command — with sudo, which it does
        // need, and the real username rather than a $USER that will not expand
        // when it is read out of a dialog.
        const reason = await tailscale.canServeWithoutSudo()
            ? `Could not start sharing: ${served.error}`
            : 'JellyJump does not have permission to publish on your tailnet yet. '
              + `Run this once in a terminal, then try again:\n\n    sudo tailscale set --operator=${os.userInfo().username}`;
        shareState = { enabled: false, url: null, dnsName: ts.dnsName, reason };
        return describe();
    }

    shareState = {
        enabled: true,
        url: tailscale.shareUrl({ dnsName: ts.dnsName, httpsPort: HTTPS_PORT, token }),
        dnsName: ts.dnsName,
        reason: null,
    };
    return describe();
}

async function disable() {
    await tailscale.stopServe({ httpsPort: HTTPS_PORT });
    await libraryServer.stop();
    shareState = { enabled: false, url: null, dnsName: shareState.dnsName, reason: null };
    return describe();
}

/** Invalidate every link already handed out. */
async function regenerateToken() {
    await writeToken(crypto.randomBytes(32).toString('hex'));
    if (shareState.enabled) {
        await disable();
        return enable();
    }
    return describe();
}

/**
 * @param {Object} deps
 * @param {Function} deps.assertTrustedIpcEvent
 * @param {Function} deps.readShareToken  - () => Promise<string|null>
 * @param {Function} deps.writeShareToken - (token) => Promise<void>
 */
function registerShareIpc({ assertTrustedIpcEvent, readShareToken, writeShareToken }) {
    readToken = readShareToken;
    writeToken = writeShareToken;

    const guarded = (fn) => async (event, ...args) => {
        try {
            assertTrustedIpcEvent(event);
            return { success: true, state: await fn(...args) };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    ipcMain.handle('share-status', guarded(describe));
    ipcMain.handle('share-enable', guarded(enable));
    ipcMain.handle('share-disable', guarded(disable));
    ipcMain.handle('share-regenerate-token', guarded(regenerateToken));

    // Leaving a tailscale serve mapping behind after the app quits would keep
    // pointing at a port nothing is listening on.
    app.on('before-quit', stopSharing);
}

/** Tear down on quit, so nothing is left served after the app closes. */
async function stopSharing() {
    if (shareState.enabled) await disable();
}

module.exports = { registerShareIpc, stopSharing };

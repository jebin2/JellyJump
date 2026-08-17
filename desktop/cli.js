/**
 * Command-line handling for the desktop app.
 *
 * Exists for the case where the machine sharing a library is one you reach over
 * SSH: the link is only readable from that machine, and opening a GUI there to
 * read a string is not always possible.
 *
 * These run before any window is created and exit without one.
 *
 *   jellyjump --share-link    print the current share link
 *   jellyjump --share-status  whether sharing is on, and why not if it is off
 *   jellyjump --help
 *
 * Printing the link does not require sharing to be running: the token is
 * stored and the address comes from Tailscale, so the link can be read and
 * saved before it is ever switched on. It only *works* while the app is
 * running with sharing enabled, which --share-status reports.
 */
const fs = require('fs');
const tailscale = require('./tailscale');

const HTTPS_PORT = 8443;

const USAGE = `JellyJump

  jellyjump                  start the app
  jellyjump --share-link     print the library share link
  jellyjump --share-status   report whether the library is reachable
  jellyjump --help           this message

The share link is a credential: anyone with it and access to your tailnet can
browse and play your library.`;

function readToken(configPath) {
    try {
        return JSON.parse(fs.readFileSync(configPath, 'utf8')).shareToken || null;
    } catch {
        return null;
    }
}

async function shareLink(configPath) {
    const token = readToken(configPath);
    if (!token) {
        return { ok: false, message: 'No share link yet — open JellyJump and start sharing once to create one.' };
    }

    const status = await tailscale.status();
    if (!status.available) {
        return { ok: false, message: `Cannot build the link: ${status.reason}` };
    }

    return { ok: true, message: tailscale.shareUrl({ dnsName: status.dnsName, httpsPort: HTTPS_PORT, token }) };
}

async function shareStatus(configPath) {
    const lines = [];
    const status = await tailscale.status();
    lines.push(`tailscale: ${status.available ? status.dnsName : status.reason}`);

    // `tailscale serve` is the honest signal: it is what actually exposes the
    // library, and it survives independently of whether the app is running.
    const serve = await tailscale.serveStatus(HTTPS_PORT);
    lines.push(`serving:   ${serve.active ? `yes, on port ${HTTPS_PORT}` : 'no'}`);
    lines.push(`token:     ${readToken(configPath) ? 'present' : 'not created yet'}`);

    if (serve.active && serve.target) {
        // A mapping left behind by a killed app points at a port nothing is
        // listening on, which looks identical to working until you try it.
        const reachable = await tailscale.isLocalPortListening(serve.target);
        lines.push(`backend:   ${reachable ? 'reachable' : `NOT reachable (${serve.target}) — the app is probably not running`}`);
    }
    return { ok: true, message: lines.join('\n') };
}

/**
 * Handle a CLI flag if one was given.
 * @returns {Promise<boolean>} true when the process should exit without a window
 */
async function handleCliArgs(argv, configPath) {
    const args = argv.slice(1);

    if (args.includes('--help') || args.includes('-h')) {
        console.log(USAGE);
        return true;
    }
    if (args.includes('--share-link')) {
        const result = await shareLink(configPath);
        console.log(result.message);
        process.exitCode = result.ok ? 0 : 1;
        return true;
    }
    if (args.includes('--share-status')) {
        const result = await shareStatus(configPath);
        console.log(result.message);
        return true;
    }
    return false;
}

module.exports = { handleCliArgs, USAGE };

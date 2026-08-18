/**
 * Command-line handling for the desktop app.
 *
 * Exists for the case where the machine sharing a library is one you reach over
 * SSH: the link is only readable from that machine, and opening a GUI there to
 * read a string is not always possible.
 *
 * These run before any window is created and exit without one.
 *
 *   jellyjump --no-gui        scan, share, print the link, keep running
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

// Electron and Chromium switches that are legitimately passed through to the
// runtime rather than being ours to interpret.
const PASSTHROUGH_SWITCHES = new Set([
    '--no-sandbox', '--disable-gpu', '--disable-gpu-sandbox', '--in-process-gpu',
    '--enable-logging', '--disable-dev-shm-usage', '--user-data-dir',
    '--remote-debugging-port', '--ozone-platform', '--ozone-platform-hint',
    '--trace-warnings', '--inspect', '--inspect-brk', '--lang',
]);

const USAGE = `JellyJump

  jellyjump                  start the app
  jellyjump --no-gui         share the library with no window, and keep running
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
 * Whether this invocation wants an answer on the terminal rather than a window.
 *
 * Must be answerable synchronously and without Electron: it is consulted at the
 * top of main.js, before `ready`, because that is the last moment at which the
 * windowing backend can still be chosen. An unknown option counts — it prints an
 * error, which needs no display either.
 * @returns {boolean}
 */
function isTerminalInvocation(argv) {
    return argv.slice(1).some((arg) => {
        if (arg === '-h') return true;
        if (!arg.startsWith('--')) return false;
        return !PASSTHROUGH_SWITCHES.has(arg.split('=')[0]);
    });
}

/**
 * Handle a CLI flag if one was given.
 * @returns {Promise<'exit'|'headless'|null>} what the caller should do next:
 *   'exit' when the answer has been printed, 'headless' to run without a
 *   window, null to start the app normally
 */
async function handleCliArgs(argv, configPath) {
    const args = argv.slice(1);

    if (args.includes('--help') || args.includes('-h')) {
        console.log(USAGE);
        return 'exit';
    }
    if (args.includes('--no-gui') || args.includes('--headless')) {
        return 'headless';
    }
    if (args.includes('--share-link')) {
        const result = await shareLink(configPath);
        console.log(result.message);
        process.exitCode = result.ok ? 0 : 1;
        return 'exit';
    }
    if (args.includes('--share-status')) {
        const result = await shareStatus(configPath);
        console.log(result.message);
        return 'exit';
    }
    // An option we do not know is an error, not a reason to open a window.
    // Silently launching the GUI is how someone discovers their build predates
    // a flag: they run --no-gui, a window appears, and nothing says why.
    const unknown = args.filter((a) => a.startsWith('--') && !PASSTHROUGH_SWITCHES.has(a.split('=')[0]));
    if (unknown.length > 0) {
        console.error(`Unknown option: ${unknown.join(' ')}\n`);
        console.error('This build may be older than that option — the list below is what it supports.\n');
        console.error(USAGE);
        process.exitCode = 1;
        return 'exit';
    }

    return null;
}

module.exports = { handleCliArgs, isTerminalInvocation, USAGE };

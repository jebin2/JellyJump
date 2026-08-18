/**
 * Command-line handling for the desktop app.
 *
 * Exists for the case where the machine sharing a library is one you reach over
 * SSH: the link is only readable from that machine, and opening a GUI there to
 * read a string is not always possible.
 *
 * These run before any window is created and exit without one.
 *
 *   jellyjump --no-gui        share, print the link, scan, keep running
 *   jellyjump --share-status  whether sharing is on, and the link
 *   jellyjump --help
 *
 * --share-status carries the link rather than a separate --share-link,
 * because the link on its own is misleading: it can always be built (the token
 * is stored, the address comes from Tailscale) but it only *works* while an
 * instance is running with sharing on. Printing it next to that state is the
 * honest answer to "what is my link".
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

// Flags that existed in a shipped build, so someone may have one in a script.
const REPLACED_SWITCHES = { '--share-link': '--share-status' };

const USAGE = `JellyJump

  jellyjump                  start the app
  jellyjump --no-gui         share the library with no window, and keep running
  jellyjump --share-status   whether the library is being shared, and the link
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

async function shareStatus(configPath) {
    const lines = [];
    const status = await tailscale.status();
    lines.push(`tailscale: ${status.available ? status.dnsName : status.reason}`);

    // `tailscale serve` is the honest signal: it is what actually exposes the
    // library, and it survives independently of whether the app is running.
    const serve = await tailscale.serveStatus(HTTPS_PORT);
    lines.push(`serving:   ${serve.active ? `yes, on port ${HTTPS_PORT}` : 'no'}`);

    if (serve.active && serve.target) {
        // A mapping left behind by a killed app points at a port nothing is
        // listening on, which looks identical to working until you try it.
        const reachable = await tailscale.isLocalPortListening(serve.target);
        lines.push(`backend:   ${reachable ? 'reachable' : `NOT reachable (${serve.target}) — the app is probably not running`}`);
    }

    // Last, so it is the easiest line to select and copy — and printed after
    // the state above, which is what says whether it will actually work.
    const token = readToken(configPath);
    if (!token) {
        lines.push('link:      none yet — run jellyjump --no-gui once to create one');
    } else if (!status.available) {
        lines.push(`link:      cannot be built: ${status.reason}`);
    } else {
        lines.push(`link:      ${tailscale.shareUrl({ dnsName: status.dnsName, httpsPort: HTTPS_PORT, token })}`);
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
    if (args.includes('--share-status')) {
        const result = await shareStatus(configPath);
        console.log(result.message);
        return 'exit';
    }
    // A flag that used to exist gets its own answer. The generic message below
    // blames an old build, which is exactly backwards here.
    for (const [gone, replacement] of Object.entries(REPLACED_SWITCHES)) {
        if (args.includes(gone)) {
            console.error(`${gone} has been replaced by ${replacement}, which prints the link along with whether it currently works.`);
            process.exitCode = 1;
            return 'exit';
        }
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

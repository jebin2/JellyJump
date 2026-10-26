/**
 * Command-line handling for the desktop app.
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
  jellyjump --version        which build this is
  jellyjump --help           this message`;

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



/** Whether a pid exists. Signal 0 tests for the process without touching it. */
function isAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        // EPERM means it exists and belongs to someone else, which is still alive.
        return error.code === 'EPERM';
    }
}

/**
 * Whether a pid is one of ours, where the system can say.
 * @returns {boolean|null} null when it cannot be determined
 */
function looksLikeJellyJump(pid) {
    try {
        return fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').toLowerCase().includes('jellyjump');
    } catch {
        // No procfs (macOS, Windows) or no permission to read it.
        return null;
    }
}

/**
 * Whether this invocation wants an answer on the terminal rather than a window.
 * @returns {boolean}
 */
function isTerminalInvocation(argv) {
    return argv.slice(1).some((arg) => {
        if (arg === '-h' || arg === '-v') return true;
        if (!arg.startsWith('--')) return false;
        return !PASSTHROUGH_SWITCHES.has(arg.split('=')[0]);
    });
}

/**
 * Whether this invocation only reads and prints — no window.
 * @returns {boolean}
 */
function isQueryInvocation(argv) {
    if (!isTerminalInvocation(argv)) return false;
    const args = argv.slice(1);
    return !args.includes('--no-gui') && !args.includes('--headless');
}

/**
 * Handle a CLI flag if one was given.
 * @returns {Promise<'exit'|null>} what the caller should do next
 */
async function handleCliArgs(argv, configPath) {
    const args = argv.slice(1);

    if (args.includes('--help') || args.includes('-h')) {
        console.log(USAGE);
        return 'exit';
    }
    if (args.includes('--version') || args.includes('-v')) {
        console.log(process.env.JELLYJUMP_VERSION || require('electron').app.getVersion());
        return 'exit';
    }
    // A flag that used to exist gets its own answer.
    for (const [gone, replacement] of Object.entries(REPLACED_SWITCHES)) {
        if (args.includes(gone)) {
            console.error(`${gone} has been replaced by ${replacement}, which prints the link along with whether it currently works.`);
            process.exitCode = 1;
            return 'exit';
        }
    }

    // An option we do not know is an error
    const unknown = args.filter((a) => a.startsWith('--') && !PASSTHROUGH_SWITCHES.has(a.split('=')[0]));
    if (unknown.length > 0) {
        console.error(`Unknown option: ${unknown.join(' ')}\n`);
        console.error(USAGE);
        process.exitCode = 1;
        return 'exit';
    }

    return null;
}

module.exports = { handleCliArgs, isTerminalInvocation, isQueryInvocation, USAGE };

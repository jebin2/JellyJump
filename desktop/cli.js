/**
 * Command-line handling for the desktop app.
 */
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
  jellyjump --version        which build this is
  jellyjump --help           this message`;

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
 * Handle a CLI flag if one was given.
 * @returns {Promise<'exit'|null>} what the caller should do next
 */
async function handleCliArgs(argv) {
    const args = argv.slice(1);

    if (args.includes('--help') || args.includes('-h')) {
        console.log(USAGE);
        return 'exit';
    }
    if (args.includes('--version') || args.includes('-v')) {
        console.log(process.env.JELLYJUMP_VERSION || require('electron').app.getVersion());
        return 'exit';
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

module.exports = { handleCliArgs, isTerminalInvocation, USAGE };

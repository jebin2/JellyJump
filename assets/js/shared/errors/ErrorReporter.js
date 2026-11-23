// @ts-check
import { AppError } from './AppError.js';
import { Logger } from '../utils/Logger.js';
import { Toast } from '../utils/Toast.js';
import { config } from '../config/index.js';
import { redact } from '../diagnostics/redact.js';

/**
 * The last line of defence: errors nothing else caught.
 *
 * Without it, an exception outside a try/catch vanished unless the console
 * was open. Now every one is recorded in the log, and the user is told once
 * (not once per error — a broken loop must not bury the page in toasts),
 * with "Copy details" to send in a bug report.
 *
 * Errors a tool catches and shows itself never reach here.
 */

/** Browser noise that is not an error of ours. */
const IGNORED = [
    /ResizeObserver loop/i, // a layout settling over two frames; harmless
    /^Script error\.?$/i,   // a cross-origin script's error, with no details to act on
];

const TOAST_GAP_MS = 10000;
let lastToastAt = -Infinity;
let installed = false;

/**
 * A bug report the user can paste: what happened, on what, and the log
 * leading up to it. Addresses, paths and file names are replaced, since
 * they can name the user's files and servers.
 * @param {AppError} error
 * @returns {string}
 */
export function buildReport(error) {
    const lines = [
        `JellyJump ${config.version} (build ${config.buildId})`,
        `Time: ${new Date().toISOString()}`,
        `Browser: ${globalThis.navigator?.userAgent ?? 'unknown'}`,
        `Error: ${error.code}: ${redact(error.message)}`,
        ...(error.cause instanceof Error && error.cause.stack ? ['', redact(error.cause.stack)] : (error.stack ? ['', redact(error.stack)] : [])),
        '',
        'Recent log:',
        ...Logger.entries(100).map((e) => {
            const trace = e.trace ? ` (${Object.entries(e.trace).map(([k, v]) => `${k} ${v}`).join(', ')})` : '';
            return `${new Date(e.time).toISOString()} ${e.level}${trace} ${redact(e.message)}`;
        }),
    ];
    return lines.join('\n');
}

/**
 * Record an error that nothing else handled, and tell the user.
 * @param {unknown} raw
 */
export function reportError(raw) {
    const error = AppError.from(raw);
    if (error.code === 'CANCELLED') return;
    if (IGNORED.some((pattern) => pattern.test(error.message))) return;
    Logger.error('[ErrorReporter] unhandled:', error);

    const now = Date.now();
    if (now - lastToastAt < TOAST_GAP_MS) return;
    lastToastAt = now;
    Toast.show(error.userMessage, 8000, true, {
        action: {
            label: 'Copy details',
            onClick: () => {
                globalThis.navigator?.clipboard?.writeText(buildReport(error))
                    .then(() => Toast.show('Details copied', 2000))
                    .catch(() => Toast.show('Could not copy the details', 3000, true));
            },
        },
    });
}

/** Listen for uncaught errors and unhandled promise rejections, once per page. */
export function installErrorReporter() {
    if (installed || typeof window === 'undefined') return;
    installed = true;
    window.addEventListener('error', (event) => reportError(event.error ?? event.message));
    window.addEventListener('unhandledrejection', (event) => reportError(event.reason));
}

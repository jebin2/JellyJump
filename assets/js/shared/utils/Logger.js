// @ts-check
/**
 * Logger Utility
 * Only logs to console when running on localhost (development mode).
 * In production, all log calls are silently ignored.
 */

import { Settings } from '../settings/Settings.js';

// globalThis.location works in both window and worker contexts
const _hostname = globalThis.location?.hostname ?? '';
const isLocalhost = _hostname === 'localhost' ||
    _hostname === '127.0.0.1' ||
    _hostname.startsWith('192.168.');

/**
 * Logging can also be switched on anywhere, which is the only way to get a log
 * out of the places the awkward faults happen: a deployed build, or a library
 * reached over Tailscale, neither of which is localhost. `?debug=1` turns it on
 * for one load and remembers it; `?debug=0` forgets it again.
 *
 * Workers have no search string of their own, so the flag is read from storage,
 * which the page has already set by the time any worker starts.
 */
function _readDebugFlag() {
    try {
        const search = globalThis.location?.search ?? '';
        if (search) {
            const want = new URLSearchParams(search).get('debug');
            if (want === '1' || want === 'true') {
                Settings.set('debug', true);
                return true;
            }
            if (want === '0' || want === 'false') {
                Settings.remove('debug');
                return false;
            }
        }
        return Settings.get('debug', false) === true;
    } catch {
        // Private windows and blocked storage both land here; the flag is a
        // convenience, so losing it must never break the page.
        return false;
    }
}

const debugRequested = _readDebugFlag();
const loggingOn = isLocalhost || debugRequested;
if (debugRequested && !isLocalhost) {
    console.log('[JellyJump] debug logging is on (add ?debug=0 to turn it off)');
}

/**
 * The last log entries, kept whether or not the console shows them, so a
 * bug report from production has something behind it (Diagnostics → Copy).
 * A fixed ring: old entries are overwritten, never piled up.
 *
 * Plain log lines keep their text only; objects in them are named, not
 * kept, so nothing big (a decoded frame, a file) stays alive because it was
 * logged. Warnings and errors keep a short rendering of their objects.
 */
const MAX_ENTRIES = 3000;
/** @type {Array<{time: number, level: string, scope: string, message: string, trace?: Record<string, string|number>}>} */
const ring = [];
let ringNext = 0;

/**
 * What the app is doing now, stamped on every entry: the playback load
 * (`load`) and the job (`job`) in progress. Jobs run one at a time and a
 * load replaces the one before, so one value per kind is exact; with both,
 * the entries of one load or one job can be picked out of the log.
 * @type {Record<string, string|number>}
 */
const trace = {};

/** @param {unknown} arg @param {boolean} detailed */
function renderArg(arg, detailed) {
    if (typeof arg === 'string') return arg;
    if (typeof arg === 'number' || typeof arg === 'boolean' || arg == null) return String(arg);
    if (arg instanceof Error) {
        const code = /** @type {{code?: string}} */ (arg).code;
        return `${arg.name}${code ? ` [${code}]` : ''}: ${arg.message}`;
    }
    if (!detailed) return `[${arg?.constructor?.name ?? typeof arg}]`;
    try {
        const json = JSON.stringify(arg);
        return json.length > 500 ? `${json.slice(0, 500)}…` : json;
    } catch {
        // Circular or exotic objects are named rather than rendered.
        return `[${arg?.constructor?.name ?? typeof arg}]`;
    }
}

const SECRET_PARAM = /([?&](?:token|sig)=)[^&\s"']+/g;

/** @param {string} level @param {unknown[]} args */
function record(level, args) {
    const detailed = level === 'warn' || level === 'error';
    // A share link's token, or a file's key, never stays in the log: the log
    // is what a bug report is made of.
    const message = args.map((a) => renderArg(a, detailed)).join(' ').replace(SECRET_PARAM, '$1…');
    const scope = /^\[([^\]]+)\]/.exec(message)?.[1] ?? '';
    /** @type {{time: number, level: string, scope: string, message: string, trace?: Record<string, string|number>}} */
    const entry = { time: Date.now(), level, scope, message: message.length > 2000 ? `${message.slice(0, 2000)}…` : message };
    if (Object.keys(trace).length) entry.trace = { ...trace };
    if (ring.length < MAX_ENTRIES) ring.push(entry);
    else ring[ringNext] = entry;
    ringNext = (ringNext + 1) % MAX_ENTRIES;
}

/**
 * Logger with automatic environment detection
 * Logs only appear in the console when running on localhost (or ?debug=1);
 * every entry is also kept in the ring above.
 */
export const Logger = {
    /**
     * Check if logging is enabled
     * @returns {boolean}
     */
    isEnabled() {
        return loggingOn;
    },

    /**
     * Whether `?debug=1` asked for logging (not just localhost): the page
     * then offers its log to save or share (player-main).
     * @returns {boolean}
     */
    isDebugRequested() {
        return debugRequested;
    },

    /**
     * Standard log (console.log)
     * @param  {...any} args 
     */
    log(...args) {
        record('log', args);
        if (loggingOn) {
            console.log(...args);
        }
    },

    /**
     * Warning log (console.warn)
     * @param  {...any} args 
     */
    warn(...args) {
        record('warn', args);
        if (loggingOn) {
            console.warn(...args);
        }
    },

    /**
     * Error log (console.error)
     * Always logs errors, even in production
     * @param  {...any} args 
     */
    error(...args) {
        record('error', args);
        // Errors always get logged
        console.error(...args);
    },

    /**
     * Debug log - more verbose, only in development
     * @param  {...any} args 
     */
    debug(...args) {
        record('debug', args);
        if (loggingOn) {
            console.debug(...args);
        }
    },

    /**
     * Info log (console.info)
     * @param  {...any} args 
     */
    info(...args) {
        record('info', args);
        if (loggingOn) {
            console.info(...args);
        }
    },

    /**
     * Group logs together
     * @param {string} label 
     */
    group(label) {
        if (loggingOn) {
            console.group(label);
        }
    },

    /**
     * End log group
     */
    groupEnd() {
        if (loggingOn) {
            console.groupEnd();
        }
    },

    /**
     * Log with timestamp prefix
     * @param {string} tag - Tag/category for the log
     * @param  {...any} args 
     */
    tagged(tag, ...args) {
        record('log', [`[${tag}]`, ...args]);
        if (loggingOn) {
            console.log(`[${tag}]`, ...args);
        }
    },

    /**
     * The kept entries, oldest first.
     * @param {number} [limit] - only the newest this many
     * @returns {Array<{time: number, level: string, scope: string, message: string, trace?: Record<string, string|number>}>}
     */
    entries(limit = MAX_ENTRIES) {
        const ordered = ring.length < MAX_ENTRIES ? ring.slice() : [...ring.slice(ringNext), ...ring.slice(0, ringNext)];
        return ordered.slice(-limit);
    },

    /**
     * Set or clear what the app is doing now (see `trace` above).
     * @param {'load'|'job'} key
     * @param {string|number|null} value - null to clear
     */
    setTrace(key, value) {
        if (value === null || value === undefined) delete trace[key];
        else trace[key] = value;
    },

    /** Forget the kept entries (tests). */
    clearEntries() {
        ring.length = 0;
        ringNext = 0;
        for (const key of Object.keys(trace)) delete trace[key];
    },
};

export default Logger;

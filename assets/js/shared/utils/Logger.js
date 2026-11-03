/**
 * Logger Utility
 * Only logs to console when running on localhost (development mode).
 * In production, all log calls are silently ignored.
 */

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
                globalThis.localStorage?.setItem('jellyjump-debug', '1');
                return true;
            }
            if (want === '0' || want === 'false') {
                globalThis.localStorage?.removeItem('jellyjump-debug');
                return false;
            }
        }
        return globalThis.localStorage?.getItem('jellyjump-debug') === '1';
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
 * Logger with automatic environment detection
 * Logs only appear when running on localhost
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
     * Standard log (console.log)
     * @param  {...any} args 
     */
    log(...args) {
        if (loggingOn) {
            console.log(...args);
        }
    },

    /**
     * Warning log (console.warn)
     * @param  {...any} args 
     */
    warn(...args) {
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
        // Errors always get logged
        console.error(...args);
    },

    /**
     * Debug log - more verbose, only in development
     * @param  {...any} args 
     */
    debug(...args) {
        if (loggingOn) {
            console.debug(...args);
        }
    },

    /**
     * Info log (console.info)
     * @param  {...any} args 
     */
    info(...args) {
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
        if (loggingOn) {
            console.log(`[${tag}]`, ...args);
        }
    }
};

export default Logger;

/**
 * Logger Utility
 * Only logs to console when running on localhost (development mode).
 * In production, all log calls are silently ignored.
 */

const isLocalhost = window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.startsWith('192.168.');

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
        return isLocalhost;
    },

    /**
     * Standard log (console.log)
     * @param  {...any} args 
     */
    log(...args) {
        if (isLocalhost) {
            console.log(...args);
        }
    },

    /**
     * Warning log (console.warn)
     * @param  {...any} args 
     */
    warn(...args) {
        if (isLocalhost) {
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
        if (isLocalhost) {
            console.debug(...args);
        }
    },

    /**
     * Info log (console.info)
     * @param  {...any} args 
     */
    info(...args) {
        if (isLocalhost) {
            console.info(...args);
        }
    },

    /**
     * Group logs together
     * @param {string} label 
     */
    group(label) {
        if (isLocalhost) {
            console.group(label);
        }
    },

    /**
     * End log group
     */
    groupEnd() {
        if (isLocalhost) {
            console.groupEnd();
        }
    },

    /**
     * Log with timestamp prefix
     * @param {string} tag - Tag/category for the log
     * @param  {...any} args 
     */
    tagged(tag, ...args) {
        if (isLocalhost) {
            console.log(`[${tag}]`, ...args);
        }
    }
};

export default Logger;

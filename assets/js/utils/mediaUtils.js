/**
 * Common Utility Functions
 * Shared helpers for formatting, parsing, and generating IDs
 */

/**
 * Format seconds to time string with millisecond precision
 * @param {number} seconds
 * @returns {string} e.g. "0:00", "1:05.500", "1:02:03.123"
 */
export function formatTime(seconds) {
    if (seconds === null || seconds === undefined || isNaN(seconds)) return '--:--';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.round((seconds % 1) * 1000);
    const msStr = `.${ms.toString().padStart(3, '0')}`;
    if (h > 0) {
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}${msStr}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}${msStr}`;
}

/**
 * Parse time string to seconds
 * @param {string} timeStr - Format: HH:MM:SS.mmm or MM:SS.mmm or SS.mmm
 * @returns {number}
 */
export function parseTime(timeStr) {
    if (typeof timeStr === 'number') return timeStr;
    const parts = timeStr.split(':').map(p => parseFloat(p) || 0);
    if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
    } else {
        return parts[0] || 0;
    }
}

/**
 * Format file size in bytes to human readable
 * @param {number} bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Generate a unique ID
 * @returns {string}
 */
export function generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'id-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

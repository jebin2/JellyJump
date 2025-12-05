/**
 * Common Utility Functions
 * Shared helpers for formatting, parsing, and generating IDs
 */

/**
 * Format seconds to HH:MM:SS string
 * @param {number} seconds
 * @returns {string}
 */
export function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Parse time string to seconds
 * @param {string} timeStr - Format: HH:MM:SS or MM:SS or SS
 * @returns {number}
 */
export function parseTime(timeStr) {
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
 * Format duration in seconds to MM:SS string
 * @param {number} seconds
 * @returns {string}
 */
export function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
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

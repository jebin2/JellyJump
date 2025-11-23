/**
 * MediaBunny Editor - Storage Helper
 * Utilities for managing localStorage with error handling and quota checks.
 * Phase: 37
 */

export class StorageHelper {
    static PREFIX = 'mediabunny_editor_';

    /**
     * Saves data to localStorage
     * @param {string} key 
     * @param {any} value 
     * @returns {boolean} Success status
     */
    static save(key, value) {
        try {
            const serialized = JSON.stringify(value);
            localStorage.setItem(this.PREFIX + key, serialized);
            return true;
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                console.error('Storage quota exceeded. Cannot save data.');
                // In a real app, we might try to clear old data here
            } else {
                console.error('Error saving to localStorage:', e);
            }
            return false;
        }
    }

    /**
     * Loads data from localStorage
     * @param {string} key 
     * @returns {any} Parsed data or null
     */
    static load(key) {
        try {
            const serialized = localStorage.getItem(this.PREFIX + key);
            return serialized ? JSON.parse(serialized) : null;
        } catch (e) {
            console.error('Error loading from localStorage:', e);
            return null;
        }
    }

    /**
     * Removes data from localStorage
     * @param {string} key 
     */
    static remove(key) {
        try {
            localStorage.removeItem(this.PREFIX + key);
        } catch (e) {
            console.error('Error removing from localStorage:', e);
        }
    }

    /**
     * Clears all editor data
     */
    static clear() {
        try {
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith(this.PREFIX)) {
                    localStorage.removeItem(key);
                }
            });
        } catch (e) {
            console.error('Error clearing localStorage:', e);
        }
    }

    /**
     * Checks if storage is available
     * @returns {boolean}
     */
    static isAvailable() {
        try {
            const testKey = '__storage_test__';
            localStorage.setItem(testKey, testKey);
            localStorage.removeItem(testKey);
            return true;
        } catch (e) {
            return false;
        }
    }
}

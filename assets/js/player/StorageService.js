/**
 * Storage Service
 * Handles persistence of playlist and player state using localStorage.
 */
export class StorageService {
    constructor() {
        this.KEYS = {
            PLAYLIST: 'mediabunny_playlist',
            PLAYBACK_STATE: 'mediabunny_playback_state'
        };
    }

    /**
     * Save playlist to storage
     * @param {Array} items - Array of playlist items
     */
    savePlaylist(items) {
        try {
            // Filter out local files (Blob URLs) as they can't be persisted
            // We save the metadata, but mark them as needing re-upload
            const serializableItems = items.map(item => {
                if (item.isLocal) {
                    return {
                        ...item,
                        url: '', // Clear Blob URL
                        needsReload: true
                    };
                }
                return item;
            });

            localStorage.setItem(this.KEYS.PLAYLIST, JSON.stringify(serializableItems));
        } catch (e) {
            console.error('Failed to save playlist:', e);
        }
    }

    /**
     * Load playlist from storage
     * @returns {Array} Array of playlist items or empty array
     */
    loadPlaylist() {
        try {
            const data = localStorage.getItem(this.KEYS.PLAYLIST);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Failed to load playlist:', e);
            return [];
        }
    }

    /**
     * Save playback state
     * @param {number} index - Current playlist index
     * @param {number} time - Current playback time
     */
    savePlaybackState(index, time) {
        try {
            const state = { index, time, timestamp: Date.now() };
            localStorage.setItem(this.KEYS.PLAYBACK_STATE, JSON.stringify(state));
        } catch (e) {
            console.error('Failed to save playback state:', e);
        }
    }

    /**
     * Load playback state
     * @returns {Object|null} Playback state or null
     */
    loadPlaybackState() {
        try {
            const data = localStorage.getItem(this.KEYS.PLAYBACK_STATE);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('Failed to load playback state:', e);
            return null;
        }
    }

    /**
     * Clear all data
     */
    clear() {
        localStorage.removeItem(this.KEYS.PLAYLIST);
        localStorage.removeItem(this.KEYS.PLAYBACK_STATE);
    }
}

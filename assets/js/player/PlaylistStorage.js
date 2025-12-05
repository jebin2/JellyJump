import { IndexedDBService } from './IndexedDBService.js';

/**
 * Playlist Storage Service
 * Handles persistence of playlist data and playback state
 */
export class PlaylistStorage {
    /**
     * Load saved playlist from IndexedDB
     * @returns {Promise<Object>} { items: Array, playbackState: Object }
     */
    static async loadPlaylist() {
        const storage = new IndexedDBService();

        try {
            const savedItems = await storage.loadPlaylist();
            const playbackState = await storage.loadPlaybackState();

            return {
                items: savedItems || [],
                playbackState: playbackState || null
            };
        } catch (e) {
            console.error('Error loading playlist:', e);
            return {
                items: [],
                playbackState: null
            };
        }
    }

    /**
     * Save complete playlist state
     * @param {Array} items - Playlist items
     * @param {number} activeIndex - Currently active item index
     * @param {number} currentTime - Current playback time
     */
    static savePlaylist(items, activeIndex, currentTime = 0) {
        const storage = new IndexedDBService();

        // Save playlist items
        storage.savePlaylist(items);

        // Save playback state
        const activeItem = items[activeIndex];
        if (activeItem) {
            storage.savePlaybackState({
                index: activeIndex,
                activeId: activeItem.id,
                time: currentTime
            });
        }
    }

    /**
     * Save only playback progress (optimized for frequent calls)
     * @param {Object} activeItem - Currently playing item
     * @param {number} activeIndex - Current index
     * @param {number} currentTime - Current playback time
     */
    static savePlaybackProgress(activeItem, activeIndex, currentTime) {
        if (!activeItem) return;

        const storage = new IndexedDBService();

        // 1. Save to IndexedDB (for playlist restoration)
        storage.savePlaybackState({
            index: activeIndex,
            activeId: activeItem.id,
            time: currentTime
        });

        // 2. Save to localStorage (for Player.js internal restoration)
        // This ensures Player.js finds the state on reload
        try {
            const state = {
                videoIdentifier: activeItem.id,
                timestamp: currentTime,
                savedAt: new Date().toISOString()
            };
            localStorage.setItem(`jellyjump-state-${activeItem.id}`, JSON.stringify(state));
        } catch (e) {
            console.warn('Failed to sync state to localStorage:', e);
        }
    }

    /**
     * Clear all saved data
     */
    static async clearStorage() {
        const storage = new IndexedDBService();
        await storage.clearPlaylist();
    }
}

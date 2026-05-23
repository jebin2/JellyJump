import { Logger } from "../../shared/utils/Logger.js";
import { StorageService } from "../../shared/services/StorageService.js";

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
        const storage = new StorageService();

        try {
            const savedItems = await storage.loadPlaylist();
            const playbackState = await storage.loadPlaybackState();

            return {
                items: savedItems || [],
                playbackState: playbackState || null
            };
        } catch (e) {
            Logger.error('Error loading playlist:', e);
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
        const storage = new StorageService();

        // 1. Filter out transient "Live Camera" items (don't save to DB)
        const persistentItems = items.filter(item => !item.isWebcam);

        // Save playlist items
        storage.savePlaylist(persistentItems);

        // 2. Save playback state for the currently active persistent item
        const activeItem = items[activeIndex];
        if (activeItem && !activeItem.isWebcam) {
            // Find correct index in persistent list
            const persistentIndex = persistentItems.findIndex(i => i.id === activeItem.id);

            storage.savePlaybackState({
                index: persistentIndex,
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

        const storage = new StorageService();

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
            Logger.warn('Failed to sync state to localStorage:', e);
        }
    }

    /**
     * Clear all saved data
     */
    static async clearStorage() {
        const storage = new StorageService();
        await storage.clear();
    }
}

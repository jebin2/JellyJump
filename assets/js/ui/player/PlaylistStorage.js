import { Logger } from "../../shared/utils/Logger.js";
import { StorageService } from "../../shared/services/StorageService.js";
import { saveProgress } from "../../shared/settings/Progress.js";
import { Toast } from "../../shared/utils/Toast.js";
import { AppError } from "../../shared/errors/AppError.js";
import { ERROR_CODES } from "../../shared/errors/codes.js";

let toldFull = false;

/**
 * Save the playlist, and what to do when the browser's storage is full: the
 * list is saved without the files that did not fit, which stay in memory and
 * play until the page closes, and the user is told once (BUG-4's other half;
 * before, the whole save failed and nothing said so).
 * @param {{savePlaylist: (items: Array, options?: {withFiles?: boolean}) => Promise<void>}} storage
 * @param {Array} items
 * @param {(message: string) => void} [tell] - shows the message (a toast by default)
 * @returns {Promise<'saved'|'without-files'|'failed'>}
 */
export async function savePlaylistItems(storage, items, tell = (message) => Toast.show(message, 8000, true)) {
    try {
        await storage.savePlaylist(items);
        return 'saved';
    } catch (error) {
        const appError = AppError.from(error);
        if (appError.code !== 'STORAGE_FULL') {
            Logger.error('[PlaylistStorage] Could not save the playlist:', error);
            return 'failed';
        }
        if (!toldFull) {
            toldFull = true;
            tell(ERROR_CODES.NOT_KEPT);
        }
        try {
            await storage.savePlaylist(items, { withFiles: false });
            return 'without-files';
        } catch (again) {
            Logger.error('[PlaylistStorage] Could not save the playlist, even without its files:', again);
            return 'failed';
        }
    }
}

/**
 * Playlist Storage Service
 * Handles persistence of playlist data and playback state
 */
export class PlaylistStorage {
    /**
     * Load saved playlist from IndexedDB
     * @returns {Promise<Object>} { ok: boolean, items: Array, playbackState: Object }
     */
    static async loadPlaylist() {
        const storage = new StorageService();

        try {
            const savedItems = await storage.loadPlaylist();
            const playbackState = await storage.loadPlaybackState();

            return {
                ok: true,
                items: savedItems || [],
                playbackState: playbackState || null
            };
        } catch (e) {
            Logger.error('Error loading playlist:', e);
            // ok: false, so nothing takes the empty list for the real one.
            return {
                ok: false,
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

        // 1. Filter out transient items (don't save to DB): "Live Camera", scan
        // results, and shared libraries.
        //
        // Scan results are rediscovered on launch, and a home directory can hold
        // thousands of videos — on desktop this write rewrites jellyjump.json in
        // full, so persisting them would turn every reorder into a
        // multi-megabyte write and bury the user's own playlist.
        //
        // Shared-library items live on another machine, so a saved copy would
        // come back as broken entries whenever it is off or the link is revoked.
        const persistentItems = items.filter(item => !item.isWebcam && !item.isDiscovered && !item.isRemoteLibrary);

        // Save playlist items
        savePlaylistItems(storage, persistentItems);

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

        // 2. Where this video was left, for the player to start there on reload.
        saveProgress(activeItem.id, currentTime);
    }

    /**
     * Clear all saved data
     */
    static async clearStorage() {
        const storage = new StorageService();
        await storage.clear();
    }
}

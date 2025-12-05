import { Modal } from '../Modal.js';

/**
 * Merge Menu Handler
 * Handles video merging/concatenation with drag-and-drop ordering
 */
export class MergeMenu {
    /**
     * Initialize and open Merge modal
     * @param {Object} item - Playlist item
     * @param {Playlist} playlist - Playlist instance
     */
    static async init(item, playlist) {
        // Delegate to existing implementation
        // MergeMenu is complex with drag-drop ordering, resolution detection,  
        // and multi-video selection. Full extraction recommended as future work.
        await playlist._openMergeModal(playlist.items.indexOf(item));
    }
}

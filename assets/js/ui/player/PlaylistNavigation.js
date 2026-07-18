import { Logger } from "../../shared/utils/Logger.js";

/**
 * Playlist Navigation Helper
 * Handles playlist traversal (next/prev) and position syncing.
 */
export class PlaylistNavigation {
    /**
     * @param {Playlist} playlist - The playlist instance
     */
    constructor(playlist) {
        this.playlist = playlist;
    }

    /**
     * Play next item in playlist
     */
    playNext() {
        if (!this._canGoNext()) return;
        this.playlist.selectItem(this.playlist.activeIndex + 1, true);
    }

    /**
     * Play previous item in playlist
     */
    playPrevious() {
        if (!this._canGoPrevious()) return;
        this.playlist.selectItem(this.playlist.activeIndex - 1, true);
    }

    /**
     * Scroll the playlist to show the currently playing item
     */
    async scrollToPlaying() {
        const p = this.playlist;
        const index = p.activeIndex;
        if (index === -1) return;

        const item = p.items[index];
        if (!item) return;

        // 1. Ensure parent folder is expanded
        if (item.path && item.path.includes('/')) {
            const parts = item.path.split('/');
            let currentPath = '';
            for (let i = 0; i < parts.length - 1; i++) {
                currentPath += (currentPath ? '/' : '') + parts[i];
                if (!p.state.expandedFolders.has(currentPath)) {
                    p.state.toggleFolder(currentPath);
                    p.render();
                }
            }
        }

        // 2. Wait for DOM to catch up
        await new Promise(r => requestAnimationFrame(r));

        // 3. Find element
        const itemEl = p.container.querySelector(`.playlist-item[data-id="${item.id}"]`);
        if (itemEl) {
            itemEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        // 4. If not in DOM, calculate approximate scroll position
        const itemHeight = 72; // Approximate height including margin
        const virtualIndex = this._calculateVirtualIndex(index);
        p.container.scrollTo({
            top: virtualIndex * itemHeight,
            behavior: 'smooth'
        });
    }

    /**
     * Calculate virtual index taking expanded folders into account
     * @private
     */
    _calculateVirtualIndex(targetIndex) {
        const p = this.playlist;
        let virtualIndex = 0;
        const processedFolders = new Set();
        
        for (let i = 0; i < targetIndex; i++) {
            const item = p.items[i];
            if (!item) continue;

            const path = item.path || '';
            const parts = path.split('/');
            
            if (parts.length > 1) {
                // Folder logic
                let currentPath = '';
                let isVisible = true;
                for (let j = 0; j < parts.length - 1; j++) {
                    currentPath += (currentPath ? '/' : '') + parts[j];
                    
                    // Count folder header if we haven't seen it yet
                    if (!processedFolders.has(currentPath)) {
                        virtualIndex++; 
                        processedFolders.add(currentPath);
                    }
                    
                    // If this folder or any parent is collapsed, children are not visible
                    if (!p.state.expandedFolders.has(currentPath)) {
                        isVisible = false;
                    }
                }
                if (isVisible) virtualIndex++;
            } else {
                virtualIndex++;
            }
        }
        return virtualIndex;
    }

    /**
     * Update player's native navigation button states
     */
    updatePlayerNavigationState() {
        if (this.playlist.player && typeof this.playlist.player.updateNavigationButtons === 'function') {
            this.playlist.player.updateNavigationButtons(
                this._canGoPrevious(),
                this._canGoNext()
            );
        }
    }

    /**
     * Check if previous exists
     * @private
     */
    _canGoPrevious() {
        return this.playlist.activeIndex > 0;
    }

    /**
     * Check if next exists
     * @private
     */
    _canGoNext() {
        return this.playlist.activeIndex >= 0 && this.playlist.activeIndex < this.playlist.items.length - 1;
    }
}

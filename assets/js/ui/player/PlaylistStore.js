// @ts-check
import { Settings } from '../../shared/settings/Settings.js';
import { Logger } from '../../shared/utils/Logger.js';
import { Toast } from '../../shared/utils/Toast.js';
import { PlaylistStorage } from './PlaylistStorage.js';
import { sweepStoredFiles } from './PlaylistFiles.js';

/**
 * Saving and restoring the playlist: the saved list on load, saving after a
 * change, where playback is, and the guard that stops a load that crashed
 * the page from being retried on the next start.
 *
 * Part of the playlist (ARCHITECTURE_PLAN.md, phase E). These are
 * `Playlist` methods, kept in a file of their own and added to
 * `Playlist.prototype` (see the end of Playlist.js): `this` is the
 * playlist, and they call each other and the rest of it as before.
 */
export const PlaylistStore = {
    /**
     * Load saved playlist from storage
     * @private
     */
    async _loadSavedPlaylist() {
        try {
            const { ok, items, playbackState } = await PlaylistStorage.loadPlaylist();
            // Once the page has settled: files nothing refers to any more.
            if (ok) {
                setTimeout(() => {
                    sweepStoredFiles(this.storage, () => this.state.items)
                        .catch((error) => Logger.warn('[Playlist] Stored-file sweep failed:', error));
                }, 5000);
            }

            if (items.length > 0) {
                this.items = items;
                this.isLoading = false; // Loaded successfully
                this.render();

                if (playbackState) {
                    let indexToRestore = -1;

                    // Try to restore by ID first (more robust)
                    if (playbackState.activeId) {
                        indexToRestore = this.items.findIndex(item => item.id === playbackState.activeId);
                    }

                    // Fallback to index if ID not found or not present
                    if (indexToRestore === -1 && typeof playbackState.index === 'number') {
                        indexToRestore = playbackState.index;
                    }

                    if (indexToRestore >= 0 && indexToRestore < this.items.length) {
                        const itemToRestore = this.items[indexToRestore];

                        // Crash-loop breaker: if the load guard from the
                        // previous session was never cleared, that session
                        // died (e.g. iOS jetsam on a heavy 4K file) while
                        // loading this very item. Auto-restoring it would
                        // crash again on every launch ("A problem repeatedly
                        // occurred"), so skip it - the item stays in the
                        // playlist and can still be tapped manually.
                        const guard = this._readLoadGuard();
                        if (guard && guard.id === itemToRestore.id) {
                            this._clearLoadGuard();
                            Logger.warn('[Playlist] Not auto-restoring', itemToRestore.title, '- the previous session crashed while loading it');
                            Toast.show(`Skipped auto-loading "${itemToRestore.title}" - it crashed the app last time. Tap it to retry.`, 6000, true);
                        } else {
                            Logger.log('[Playlist] Restoring item:', itemToRestore.title, {
                                isLocal: itemToRestore.isLocal,
                                hasFile: !!itemToRestore.file,
                                url: itemToRestore.url,
                                localPath: itemToRestore.localPath
                            });

                            // Don't auto-play on restore, just load
                            // Use selectItem to handle on-demand loading
                            await this.selectItem(indexToRestore, false);
                        }
                    }
                }
            } else {
                this.isLoading = false; // Loaded empty
                this.render(); // Render empty state
            }
        } catch (e) {
            Logger.error('Error loading playlist:', e);
            this.isLoading = false; // Stop loading on error
            this.render();
        }
    },

    /**
     * Save the playlist and where playback is. Call after changing items.
     */
    save() {
        const currentTime = this.player?.currentTime || 0;
        PlaylistStorage.savePlaylist(this.items, this.activeIndex, currentTime);
    },

    /**
     * Crash-loop breaker guard: set while an item's media is loading and
     * cleared on success. If it survives to the next launch, that load
     * killed the page and the item must not be auto-restored.
     * @private
     */
    _setLoadGuard(item) {
        try {
            Settings.set('loadGuard', { id: item.id, at: Date.now() });
        } catch (e) { /* storage full/blocked - guard is best-effort */ }
    },

    /** @private */
    _clearLoadGuard() {
        try {
            Settings.remove('loadGuard');
        } catch (e) { /* ignore */ }
    },

    /** @private */
    _readLoadGuard() {
        try {
            return Settings.get('loadGuard', null);
        } catch (e) {
            return null;
        }
    },

    /**
     * Save only playback progress (optimized for frequent calls)
     * @private
     */
    _savePlaybackProgress() {
        const activeItem = this.items[this.activeIndex];
        const currentTime = this.player?.currentTime || 0;
        PlaylistStorage.savePlaybackProgress(activeItem, this.activeIndex, currentTime);
    },
};

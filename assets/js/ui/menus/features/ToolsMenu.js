import { Settings } from '../../../shared/settings/Settings.js';
import { Modal } from '../../Modal.js';
import { Logger } from '../../../shared/utils/Logger.js';
import { ConfirmDialog } from '../../../shared/utils/ConfirmDialog.js';
import { renderToolGrid } from '../core/ToolGrid.js';
import { DB_NAME } from '../../../shared/services/IndexedDBService.js';

/**
 * Create & share menu (the header's wrench button)
 * Tools that are not about one playlist item: recording, making a video from
 * several files, and sharing.
 */
export class ToolsMenu {
    /**
     * Show the tools grid modal
     * @param {Playlist} playlist - Playlist instance for context
     */
    static async show(playlist) {
        const modal = new Modal({ maxWidth: '520px' });
        modal.setTitle('Create & share');

        // Built by the same helper as the per-video menu, so the two grids
        // cannot drift apart again.
        const grid = renderToolGrid([
            { heading: 'Create', tools: [
                { action: 'screen-record', icon: 'icon-record', label: 'Record Screen' },
                { action: 'camera-record', icon: 'icon-camera', label: 'Camera', title: 'Camera recording' },
                { action: 'merge', icon: 'icon-copy', label: 'Merge Videos' },
                { action: 'slideshow', icon: 'icon-image', label: 'Slideshow', title: 'Images to video' },
                { action: 'combine-av', icon: 'icon-audio', label: 'Combine A/V', title: 'Combine audio and video' },
            ] },
            { heading: 'Share', tools: [
                { action: 'watch-party', icon: 'icon-link', label: 'Watch Together' },
                { action: 'share', icon: 'icon-folder', label: 'Share Library' },
            ] },
        ], { columns: 5 });

        // Wiping the app is not a tool, and sat in the grid looking like one,
        // a click away from Slideshow. It is a plain link at the bottom now,
        // and asks properly before doing anything.
        const reset = document.createElement('button');
        reset.className = 'tools-reset-link';
        reset.dataset.action = 'reset';
        reset.textContent = 'Reset app…';

        const content = document.createElement('div');
        content.append(grid, reset);
        modal.setBody(content);

        // Sharing serves this machine's scanned library, so it only means
        // anything on the desktop app; in a browser there is nothing to serve.
        const { ShareMenu } = await import('./ShareMenu.js');
        const shareTile = content.querySelector('[data-action="share"]');
        if (!ShareMenu.isSupported()) {
            shareTile?.remove();
        } else if (shareTile) {
            // The Tools button pulses while sharing, but once this grid is open
            // it covers the button — so the tile has to carry the state too, or
            // the sign disappears exactly when the user comes looking for it.
            const { ShareState } = await import('../../../shared/services/ShareState.js');
            const applySharing = (sharing) => {
                shareTile.classList.toggle('sharing-active', sharing);
                const label = shareTile.querySelector('.tools-tile-label');
                if (label) label.textContent = sharing ? 'Sharing' : 'Share Library';
            };
            applySharing(ShareState.isSharing);
            ShareState.refresh().then(applySharing);
        }

        // Handle tile clicks
        content.querySelectorAll('[data-action]').forEach(tile => {
            tile.addEventListener('click', async (e) => {
                const action = tile.dataset.action;
                modal.close();

                if (action === 'screen-record') {
                    const { ScreenRecorderMenu } = await import('./ScreenRecorderMenu.js');
                    ScreenRecorderMenu.showOptions(playlist);
                } else if (action === 'camera-record') {
                    const { ScreenRecorderMenu } = await import('./ScreenRecorderMenu.js');
                    ScreenRecorderMenu.showCameraOptions(playlist);
                } else if (action === 'merge') {
                    const { MergeMenu } = await import('./MergeMenu.js');
                    MergeMenu.init(null, playlist);
                } else if (action === 'slideshow') {
                    const { SlideshowMenu } = await import('./SlideshowMenu.js');
                    SlideshowMenu.init(playlist);
                } else if (action === 'combine-av') {
                    const { CombineAVMenu } = await import('./CombineAVMenu.js');
                    CombineAVMenu.init(playlist);
                } else if (action === 'watch-party') {
                    const { WatchPartyMenu } = await import('./WatchPartyMenu.js');
                    WatchPartyMenu.show(playlist.player);
                } else if (action === 'share') {
                    ShareMenu.show();
                } else if (action === 'reset') {
                    const confirmed = await ConfirmDialog.confirm({
                        title: 'Reset the app?',
                        message: 'This clears your playlist, settings and saved data, then reloads. It cannot be undone.',
                        confirmText: 'Reset',
                        confirmStyle: 'danger',
                    });
                    if (confirmed) {
                        try {
                            // Delete the entire IndexedDB database
                            await new Promise((resolve, reject) => {
                                const request = indexedDB.deleteDatabase(DB_NAME);
                                request.onsuccess = () => resolve();
                                request.onerror = () => reject(request.error);
                                request.onblocked = () => resolve(); // Still proceed if blocked
                            });

                            // Clear all localStorage
                            Settings.clearAll();

                            // Reload the page
                            window.location.reload();
                        } catch (err) {
                            Logger.error('Reset failed:', err);
                            // Still reload even if clearing fails
                            window.location.reload();
                        }
                    }
                }
            });
        });

        modal.open();
    }
}

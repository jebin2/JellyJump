import { Modal } from '../../Modal.js';
import { Logger } from '../../../shared/utils/Logger.js';

/**
 * Tools Menu
 * Handles the display and routing of application-wide utility tools.
 */
export class ToolsMenu {
    /**
     * Show the tools grid modal
     * @param {Playlist} playlist - Playlist instance for context
     */
    static async show(playlist) {
        // The same shape as the per-item tools modal: three columns of small
        // tiles at 480px, rather than two columns of large ones at 320px. Eight
        // tools in two columns was four rows and a scroll; in three it is three
        // rows and none.
        const modal = new Modal({ maxWidth: '480px' });
        modal.setTitle('Tools');

        // Listed rather than written out eight times, which is also how
        // ItemToolsMenu builds its grid -- two copies of the same markup drift,
        // and this one had already picked up a tile with a different icon size
        // and no fill.
        const tools = [
            { action: 'screen-record', icon: 'icon-record', label: 'Record Screen', title: 'Record Screen' },
            { action: 'camera-record', icon: 'icon-camera', label: 'Camera', title: 'Camera Recording' },
            { action: 'merge', icon: 'icon-copy', label: 'Merge Videos', title: 'Merge Videos' },
            { action: 'slideshow', icon: 'icon-image', label: 'Slideshow', title: 'Images to Video' },
            { action: 'combine-av', icon: 'icon-audio', label: 'Combine A/V', title: 'Combine Audio/Video' },
            { action: 'watch-party', icon: 'icon-link', label: 'Watch Together', title: 'Watch Together' },
            { action: 'share', icon: 'icon-link', label: 'Share Library', title: 'Share Library' },
            { action: 'reset', icon: 'icon-trash', label: 'Reset App', title: 'Reset App', danger: true },
        ];

        // Create tools grid content
        const content = document.createElement('div');
        content.className = 'tools-grid tools-grid-3';
        content.innerHTML = tools.map(tool => `
            <button class="tools-tile tools-tile-sm${tool.danger ? ' tools-tile-danger' : ''}"
                    data-action="${tool.action}" title="${tool.title}">
                <div class="tools-tile-icon">
                    <svg width="20" height="20" fill="currentColor" aria-hidden="true">
                        <use href="assets/icons/sprite.svg#${tool.icon}"></use>
                    </svg>
                </div>
                <span class="tools-tile-label">${tool.label}</span>
            </button>
        `).join('');

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
        content.querySelectorAll('.tools-tile').forEach(tile => {
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
                    if (confirm('Reset the app? This will clear all data and reload.')) {
                        try {
                            // Delete the entire IndexedDB database
                            await new Promise((resolve, reject) => {
                                const request = indexedDB.deleteDatabase('JellyJumpDB');
                                request.onsuccess = () => resolve();
                                request.onerror = () => reject(request.error);
                                request.onblocked = () => resolve(); // Still proceed if blocked
                            });

                            // Clear all localStorage
                            localStorage.clear();

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

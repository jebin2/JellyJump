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
        const modal = new Modal({ maxWidth: '320px' });
        modal.setTitle('Tools');

        // Create tools grid content
        const content = document.createElement('div');
        content.className = 'tools-grid';
        content.innerHTML = `
            <button class="tools-tile" data-action="screen-record" title="Record Screen">
                <div class="tools-tile-icon">
                    <svg width="24" height="24" fill="currentColor">
                        <use href="assets/icons/sprite.svg#icon-record"></use>
                    </svg>
                </div>
                <span class="tools-tile-label">Record Screen</span>
            </button>
            <button class="tools-tile" data-action="camera-record" title="Camera Recording">
                <div class="tools-tile-icon">
                    <svg width="24" height="24" fill="currentColor">
                        <use href="assets/icons/sprite.svg#icon-camera"></use>
                    </svg>
                </div>
                <span class="tools-tile-label">Camera</span>
            </button>
            <button class="tools-tile" data-action="merge" title="Merge Videos">
                <div class="tools-tile-icon">
                    <svg width="24" height="24" fill="currentColor">
                        <use href="assets/icons/sprite.svg#icon-copy"></use>
                    </svg>
                </div>
                <span class="tools-tile-label">Merge Videos</span>
            </button>
            <button class="tools-tile" data-action="slideshow" title="Images to Video">
                <div class="tools-tile-icon">
                    <svg width="24" height="24" fill="currentColor">
                        <use href="assets/icons/sprite.svg#icon-image"></use>
                    </svg>
                </div>
                <span class="tools-tile-label">Slideshow</span>
            </button>
            <button class="tools-tile tools-tile-danger" data-action="reset" title="Reset App">
                <div class="tools-tile-icon">
                    <svg width="24" height="24" fill="currentColor">
                        <use href="assets/icons/sprite.svg#icon-trash"></use>
                    </svg>
                </div>
                <span class="tools-tile-label">Reset App</span>
            </button>
        `;

        modal.setBody(content);

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

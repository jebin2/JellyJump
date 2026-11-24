// @ts-check
import { Logger } from "../../shared/utils/Logger.js";
import { Toast } from "../../shared/utils/Toast.js";
import { StorageService } from "../../shared/services/StorageService.js";
import { ConfirmDialog } from '../../shared/utils/ConfirmDialog.js';
import { discardStoredFiles } from './PlaylistFiles.js';
import { MediaMetadata } from '../../shared/utils/MediaMetadata.js';
import { FileDropHandler } from '../../shared/utils/FileDropHandler.js';
import { sanitizeFilename } from '../../shared/utils/mediaUtils.js';
import { PlaylistRenderer } from './PlaylistRenderer.js';
import { PlaylistState } from './PlaylistState.js';
import { PlaylistUI } from './PlaylistUI.js';
import { PlaylistNavigation } from './PlaylistNavigation.js';
import { PlaylistRemoteLibraries } from './PlaylistRemoteLibraries.js';
import { PlaylistProcessor } from "../../shared/services/PlaylistProcessor.js";
import { ShareState } from '../../shared/services/ShareState.js';
import { forgetLink as forgetRemoteLink } from '../../shared/services/RemoteLibrary.js';
import { PlaylistStore } from './PlaylistStore.js';
import { PlaylistMetadata } from './PlaylistMetadata.js';
import { PlaylistIngest } from './PlaylistIngest.js';
import { PlaylistDiscovery } from './PlaylistDiscovery.js';
import { PlaylistPlayback } from './PlaylistPlayback.js';

/**
 * Playlist Manager
 * Handles rendering and interaction for the video playlist.
 */
export class Playlist {
    /**
     * @param {HTMLElement} container - The container element for the playlist
     * @param {import('../../core/Player.js').CorePlayer} player - The player instance
     */
    constructor(container, player) {
        this.container = container;
        this.player = player;
        /**
         * Names a tool's result before it is added (the edit panel sets it, to
         * name its working copy); null keeps the tool's name.
         * @type {((source: Object|null, filename: string) => {title: string, path: string}|null)|null}
         */
        this.nameProcessedItem = null;
        
        // Modularized helpers
        this.state = new PlaylistState();
        this.renderer = new PlaylistRenderer(this);
        this.ui = new PlaylistUI(this);
        this.navigation = new PlaylistNavigation(this);
        this.remoteLibraries = new PlaylistRemoteLibraries(this);
        
        this.processor = PlaylistProcessor;
        this.storage = new StorageService();

        // Initialize UI and Navigation
        this.ui.init();
        this.ui.setupKeyboardShortcuts();
        this._initPlayerNavigation();

        // Start periodic state saving
        this._progressIntervalId = setInterval(() => {
            if (this.player && this.player.isPlaying) {
                this._savePlaybackProgress();
            }
        }, 1000);

        // Setup Drag and Drop
        this.fileDropHandler = new FileDropHandler(this.container, (files) => this.handleFiles(files));

        // Lifecycle management
        this._beforeUnloadHandler = () => {
            this.save();
            this._revokeAllBlobUrls();
        };
        window.addEventListener('beforeunload', this._beforeUnloadHandler);

        // Load saved data, then fill in what a scan finds on disk.
        //
        // Three stages, each guarded on its own. Chained bare, one rejection
        // cancelled everything after it and went nowhere -- an unhandled
        // rejection with no message and a playlist that had simply stopped
        // filling, which is indistinguishable from there being nothing to fill
        // it with.
        (async () => {
            for (const [what, stage] of /** @type {[string, () => unknown][]} */ ([
                ['load the saved playlist', () => this._loadSavedPlaylist()],
                ['restore shared libraries', () => this.remoteLibraries.restore()],
                ['scan for media', () => this._startMediaScan()],
            ])) {
                try {
                    await stage();
                } catch (error) {
                    Logger.error(`[Playlist] Startup: failed to ${what}:`, error);
                }
            }
        })();

        // Sharing can already be on from a previous session, so reflect it
        // on the Tools button without waiting for the menu to be opened.
        ShareState.refresh();

        // Setup player error callback
        if (this.player) {
            this.player.onStreamError = (videoId, error) => {
                this.markItemBroken(videoId, error);
            };
        }
    }

    // The state lives in PlaylistState; these read and write it.
    /** The items, in order. Change them through the methods, not by assigning. @type {import('../../shared/types.js').PlaylistItem[]} */
    get items() { return this.state.items; }
    set items(val) { this.state.setItems(val); }
    /** The index of the item playing, or -1. @type {number} */
    get activeIndex() { return this.state.activeIndex; }
    set activeIndex(val) { this.state.setActiveIndex(val); }
    /** The folder paths open in the list. @type {Set<string>} */
    get expandedFolders() { return this.state.expandedFolders; }
    /** The search box's text; the list shows matches while it is set. @type {string} */
    get searchQuery() { return this.state.searchQuery; }
    set searchQuery(val) { this.state.setSearchQuery(val); }
    /** True while the saved playlist is being restored (the list is hidden). @type {boolean} */
    get isLoading() { return this.state.isLoading; }
    set isLoading(val) { this.state.setIsLoading(val); }

    // While a video is being edited the player is its preview: it stays on
    // that video, whatever asks for the next one (the end of the video, a
    // key, a button), or the edit panel would be taken along to another.
    /** Play the next item (back to the first when the playlist loops), unless editing. */
    playNext() { if (!this.ui?.editPanel?.isOpen) this.navigation.playNext(); }
    /** Play the previous item (to the last when the playlist loops), unless editing. */
    playPrevious() { if (!this.ui?.editPanel?.isOpen) this.navigation.playPrevious(); }
    /** Scroll the list to the item playing, opening its folders. */
    scrollToPlaying() { return this.navigation.scrollToPlaying(); }
    _updatePlayerNavigationState() { this.navigation.updatePlayerNavigationState(); }

    /**
     * Remove a video from the playlist
     * @param {number} index 
     */
    /**
     * Remove item from playlist (Surgical DOM Update)
     * @param {number} index
     */
    removeItem(index) {
        if (index < 0 || index >= this.state.items.length) return;

        // Revoke blob URLs to free memory
        const removedItem = this.state.items[index];
        if (removedItem && removedItem.url && removedItem.url.startsWith('blob:')) {
            URL.revokeObjectURL(removedItem.url);
        }
        if (removedItem && removedItem.blob_url && removedItem.blob_url.startsWith('blob:')) {
            URL.revokeObjectURL(removedItem.blob_url);
            removedItem.blob_url = null;
        }

        // 1. Data Removal (handles activeIndex adjustment)
        const wasActive = this.activeIndex === index;
        this.state.removeItem(index);
        this.save();
        discardStoredFiles(this.storage, [removedItem], this.state.items);
        this._updatePlayerNavigationState();

        // 2. Surgical DOM Removal
        this.renderer.removeItemFromDOM(index);

        // 3. Stop playback if active item was removed
        if (wasActive) {
            this._stopPlayback();
        }
    }

    /**
     * Remove a folder and all its contents (Surgical DOM Update)
     */
    removeFolder(folderPath) {
        const prefix = folderPath + '/';
        const itemsToRemove = this.state.items.filter(item => (item.path || '').startsWith(prefix));
        
        if (itemsToRemove.length === 0) {
            // Even if no items, remove the folder from DOM if it exists
            this.renderer.removeFolderFromDOM(folderPath);
            return;
        }

        // Removing a shared library's folder means "I do not want this
        // library", so stop restoring it on the next load too — otherwise it
        // reappears and looks like the removal did not take.
        for (const source of new Set(itemsToRemove.map(i => i.remoteSource).filter(Boolean))) {
            forgetRemoteLink(source);
            Logger.log('[Playlist] Forgot shared library:', source.split('?')[0]);
        }

        // Active Item Check
        const activeItem = this.state.getActiveItem();
        const isActiveRemoved = activeItem && (activeItem.path || '').startsWith(prefix);

        // Revoke blob URLs to free memory
        itemsToRemove.forEach(item => {
            if (item.url && item.url.startsWith('blob:')) {
                URL.revokeObjectURL(item.url);
            }
        });

        // 1. Filter out items and update state (setItems handles index restoration)
        const newItems = this.state.items.filter(item => !(item.path || '').startsWith(prefix));
        this.state.setItems(newItems);
        
        this.save();
        discardStoredFiles(this.storage, itemsToRemove, newItems);
        this._updatePlayerNavigationState();

        // 2. Surgical DOM Removal
        this.renderer.removeFolderFromDOM(folderPath);

        // 3. Stop playback if active was removed
        if (isActiveRemoved) {
            this._stopPlayback();
        }

        // Always re-render to update data-indices on items
        this.render();
    }

    /**
     * Clear the playlist
     */
    async clear(ask_confirm = true) {
        let confirmed = true;
        if (ask_confirm) {
            confirmed = await ConfirmDialog.confirm({
                title: 'Clear Playlist',
                message: 'Are you sure you want to clear the playlist? This will reset the application state.',
                confirmText: 'Clear All',
                confirmStyle: 'danger'
            });
        }
        
        if (confirmed) {
            // 1. Reset Player State
            this.player.reset();

            // 2. Revoke all blob URLs before clearing
            this._revokeAllBlobUrls();

            // 3. Clear Playlist Data
            this.state.clear();

            // 3. Clear IndexedDB
            await this.storage.clear();

            // 4. Update UI
            this.render();
            this._updatePlayerNavigationState();

            Logger.log('Application state reset successfully');
        }
    }

    /**
     * Revoke all blob URLs to free memory
     * @private
     */
    _revokeAllBlobUrls() {
        for (const item of this.items) {
            if (item.url && item.url.startsWith('blob:')) {
                URL.revokeObjectURL(item.url);
                // item.url = null; // Don't nullify, might be needed for reload? Actually destruct avoids reload
            }
            if (item.subtitleUrl && item.subtitleUrl.startsWith('blob:')) {
                URL.revokeObjectURL(item.subtitleUrl);
                item.subtitleUrl = null;
            }
        }
    }
    /**
     * Destroy the playlist instance
     */
    destroy() {
        // Clear the progress-save interval
        if (this._progressIntervalId) {
            clearInterval(this._progressIntervalId);
            this._progressIntervalId = null;
        }

        // Remove global event listeners
        if (this._beforeUnloadHandler) {
            window.removeEventListener('beforeunload', this._beforeUnloadHandler);
            this._beforeUnloadHandler = null;
        }
        
        // Cleanup UI and D&D
        this.ui.destroy();
        if (this.fileDropHandler) {
            this.fileDropHandler.destroy();
            this.fileDropHandler = null;
        }

        // Revoke all blob URLs
        this._revokeAllBlobUrls();

        Logger.log('[Playlist] destroyed');
    }

    /** Redraw the list from the items (keeping the scroll position and open folders). */
    render() {
        this.renderer.render();
    }

    _toggleFolder(path) {
        // Find wrapper
        const wrappers = /** @type {NodeListOf<HTMLElement>} */ (this.container.querySelectorAll('.playlist-folder'));
        for (const wrapper of wrappers) {
            if (wrapper.dataset.path === path) {
                // Click the header to trigger toggleDrawer
                const header = /** @type {HTMLElement|null} */ (wrapper.querySelector('.playlist-folder-header'));
                if (header) header.click();
                return;
            }
        }
        // If not found in DOM (e.g. collapsed parent), just update state
        if (this.expandedFolders.has(path)) {
            this.expandedFolders.delete(path);
        } else {
            this.expandedFolders.add(path);
        }
        // No render needed if it's hidden
    }

    async _removeFolder(folderData) {
        // Folders are virtual: an item is inside one when its path starts
        // with the folder's path and a slash.
        const prefix = folderData.path + '/';

        const confirmed = await ConfirmDialog.confirm({
            title: 'Delete Folder',
            message: `Delete folder "${folderData.name}" and all contents?`,
            confirmText: 'Delete',
            confirmStyle: 'danger'
        });

        if (confirmed) {
            const countBefore = this.state.items.length;
            const newItems = this.state.items.filter(item => !item.path.startsWith(prefix));

            if (newItems.length < countBefore) {
                const removed = this.state.items.filter(item => item.path.startsWith(prefix));
                this.state.setItems(newItems);
                this.save();
                discardStoredFiles(this.storage, removed, newItems);
                this.render();
            }
        }
    }

    _updateUI() {
        this.renderer.updateUI();
    }

    /**
     * Mark/unmark the active playlist item as recording to hide its action buttons.
     * Called by ScreenRecorderMenu during screen (non-webcam) recording.
     * @param {boolean} isRecording
     */
    setRecordingState(isRecording) {
        this.renderer.setRecordingState(isRecording);
    }

    async _downloadItem(index) {
        if (index < 0 || index >= this.items.length) return;

        const item = this.items[index];
        const downloadBtn = this.container.querySelector(`[data-index="${index}"] .playlist-download-btn`);

        try {
            // Determine filename
            let filename = item.title || 'video';
            if (item.file && item.file.name) filename = item.file.name;

            // Sanitize filename using shared utility
            filename = sanitizeFilename(filename);

            if (!item.blob_url) {
                // Show loading state in UI
                if (downloadBtn) {
                    downloadBtn.classList.add('loading');
                }

                Logger.log(`Getting source for download: ${item.title}`);
                await MediaMetadata.getProcessedSourceURL(item, () => this.save());

                if (downloadBtn) downloadBtn.classList.remove('loading');
            }

            // Trigger download
            const downloadLink = /** @type {HTMLAnchorElement|null} */ (document.getElementById('mb-download-link'));
            if (downloadLink) {
                downloadLink.href = item.blob_url;
                downloadLink.download = filename;
                downloadLink.click();
            }

            Logger.log(`Downloading: ${filename}`);
        } catch (error) {
            Logger.error('Download failed:', error);
            Toast.show(`Failed to download video: ${error.message}`, 4000, true);
            if (downloadBtn) downloadBtn.classList.remove('loading');
        }
    }

    _toggleSettingsMenu(index) {
        // The edit panel, in the sidebar.
        this.ui?.editPanel?.open(index);
    }

    /**
     * Setup Tools button and modal
     * @param {HTMLElement} toolsBtn
     * @private
     */
    _setupToolsButton(toolsBtn) {
        toolsBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (toolsBtn.classList.contains('recording-active')) {
                const { ScreenRecorderMenu } = await import('../menus/features/ScreenRecorderMenu.js');
                ScreenRecorderMenu.stopRecording(this);
                return;
            }
            
            const { ToolsMenu } = await import('../menus/features/ToolsMenu.js');
            ToolsMenu.show(this);
        });

        // Store reference for recording state updates
        this._toolsBtn = toolsBtn;
    }

}

/**
 * The playlist's parts (phase E of ARCHITECTURE_PLAN.md), each in a file of
 * its own, are methods of this class: added to the prototype, not copied
 * values, so getters stay getters, and not enumerable, like methods written
 * in the class body.
 */
for (const part of [PlaylistStore, PlaylistMetadata, PlaylistIngest, PlaylistDiscovery, PlaylistPlayback]) {
    const descriptors = Object.getOwnPropertyDescriptors(part);
    for (const descriptor of Object.values(descriptors)) descriptor.enumerable = false;
    Object.defineProperties(Playlist.prototype, descriptors);
}

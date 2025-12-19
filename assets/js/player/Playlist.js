import { IndexedDBService } from './IndexedDBService.js';
import { MediaBunny } from '../core/MediaBunny.js';
import { MediaProcessor } from '../core/MediaProcessor.js';
import { CorePlayer } from '../core/Player.js';
import { Modal as ConfirmModal } from '../utils/Modal.js'; // Static confirm/alert dialogs
import { Modal as DialogModal } from './Modal.js';         // Instance-based custom dialogs
import { MenuRouter } from './menu/MenuRouter.js';
import { PlaylistStorage } from './PlaylistStorage.js';
import { MediaMetadata } from '../utils/MediaMetadata.js';
import { FileDropHandler } from '../utils/FileDropHandler.js';
import { ElectronHelper } from '../utils/ElectronHelper.js';
import { formatTime, parseTime, formatDuration, formatFileSize, generateId } from '../utils/mediaUtils.js';
import { M3UParser } from '../utils/M3UParser.js';

// Performance config for large playlists (e.g., 10K+ IPTV channels)
const LAZY_FOLDER_THRESHOLD = 50; // Use lazy rendering for folders with more children

/**
 * Playlist Manager
 * Handles rendering and interaction for the video playlist.
 */
export class Playlist {
    /**
     * @param {HTMLElement} container - The container element for the playlist
     * @param {CorePlayer} player - The player instance
     */
    constructor(container, player) {
        this.container = container;
        this.player = player;
        this.items = [];
        this.activeIndex = -1;
        this.storage = new IndexedDBService();
        this.expandedFolders = new Set(); // Track expanded folders

        // Storage
        this.storage = new IndexedDBService();
        this.saveTimeout = null; // For debouncing saves

        // Clear placeholder
        this.container.innerHTML = '';

        // Initialize sortable
        // Initialize sortable
        // this._initSortable(); // Not implemented yet

        // Start periodic state saving (every 1 second)
        setInterval(() => {
            if (this.player && this.player.isPlaying) {
                this._savePlaybackProgress();
            }
        }, 1000);

        // Initialize UI
        this._createHeader();
        this._createListContainer();

        // Setup Drag and Drop
        this.fileDropHandler = new FileDropHandler(this.container, (files) => this.handleFiles(files));

        // Note: Auto-play next would require CorePlayer to emit a custom event
        // when video ends. For now, this is not implemented.
        // TODO: Add player.on('ended', () => this.playNext()) if CorePlayer supports events

        // Save state on beforeunload (works for most cases)
        window.addEventListener('beforeunload', () => {
            console.log('[Playlist] beforeunload - saving state');
            this._saveState();
            console.log('[Playlist] beforeunload - revoking blob URLs');
            // Revoke all blob URLs to help browser release memory
            for (const item of this.items) {
                if (item.url && item.url.startsWith('blob:')) {
                    URL.revokeObjectURL(item.url);
                    item.url = null;
                }
            }
        });

        // Keyboard Shortcuts
        this._initKeyboardShortcuts();

        // Setup player navigation
        this._initPlayerNavigation();

        // Initialize URL Upload
        this._initUrlUpload();

        // Load saved playlist
        this._loadSavedPlaylist();

        // Global click listener to close menus
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.playlist-context-menu') && !e.target.closest('.playlist-settings-btn')) {
                this._closeAllMenus();
            }
        });

        // Global ESC listener
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this._closeAllMenus();
            }
        });
    }

    /**
     * Setup player navigation callbacks
     * @private
     */
    _initPlayerNavigation() {
        if (!this.player) {
            console.error('Playlist: Player instance is missing!');
            return;
        }
        this.player.setNavigationCallbacks(
            () => this.playPrevious(),
            () => this.playNext()
        );

        // Auto-play first item if play button clicked with no video loaded
        this.player.setPlayCallback(() => {
            if (this.items.length > 0) {
                this.selectItem(0);
            }
        });
    }


    /**
     * Initialize Keyboard Shortcuts
     * @private
     */
    _initKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ignore if typing in input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            // Shift + N: Next Video
            if (e.shiftKey && (e.key === 'N' || e.key === 'n')) {
                e.preventDefault();
                this.playNext();
            }

            // Shift + P: Previous Video
            if (e.shiftKey && (e.key === 'P' || e.key === 'p')) {
                e.preventDefault();
                this.playPrevious();
            }

            // Delete: Remove selected/active video
            if (e.key === 'Delete' || e.key === 'Backspace') {
                // Only if not editing text
                if (this.activeIndex >= 0) {
                    // Optional: Confirm before delete via shortcut?
                    // For now, let's just delete to be snappy, or maybe prompt
                    if (confirm('Remove current video from playlist?')) {
                        this.removeItem(this.activeIndex);
                    }
                }
            }

            // Ctrl + U: Upload Files
            if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U')) {
                e.preventDefault();
                const fileInput = document.getElementById('mb-file-input');
                if (fileInput) fileInput.click();
            }
        });
    }

    _createHeader() {
        const template = document.getElementById('playlist-header-controls-template');
        if (!template) {
            console.error('Playlist header template not found!');
            return;
        }

        const clone = template.content.cloneNode(true);

        const header = document.createElement('div');
        header.className = 'playlist-header';
        header.appendChild(clone);

        // Insert before container
        this.container.parentNode.insertBefore(header, this.container);

        // Initialize Sidebar Toggle RIGHT AFTER header is in DOM
        const sidebarElement = document.querySelector('.playlist-section');
        const toggleButton = document.getElementById('sidebar-toggle-btn');

        if (sidebarElement && toggleButton) {
            import('./SidebarToggle.js').then(({ SidebarToggle }) => {
                new SidebarToggle(sidebarElement, toggleButton);
            }).catch(err => {
                console.error('Failed to load SidebarToggle:', err);
            });
        } else {
            console.warn('Sidebar toggle elements not found', { sidebarElement, toggleButton });
        }

        // Attach events
        const addFilesBtn = header.querySelector('#mb-add-files');
        const addFolderBtn = header.querySelector('#mb-add-folder');
        const clearBtn = header.querySelector('#mb-clear-playlist');

        if (addFilesBtn) {
            addFilesBtn.addEventListener('click', async () => {
                // Electron: Use native file dialog to get file paths
                if (ElectronHelper.isElectron()) {
                    const result = await ElectronHelper.openFileDialog();
                    if (result.success && result.files) {
                        this.handleElectronFiles(result.files);
                    }
                } else {
                    // Web: Use HTML file input
                    document.getElementById('mb-file-input').click();
                }
            });
        }

        if (addFolderBtn) {
            addFolderBtn.addEventListener('click', () => {
                document.getElementById('mb-folder-input').click();
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clear();
            });
        }

        // File input events
        const fileInput = document.getElementById('mb-file-input');
        const folderInput = document.getElementById('mb-folder-input');

        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                this.handleFiles(e.target.files);
                e.target.value = ''; // Reset
            });
        }

        if (folderInput) {
            folderInput.addEventListener('change', (e) => {
                this.handleFiles(e.target.files);
                e.target.value = ''; // Reset
            });
        }
    }

    _createListContainer() {
        // The passed container is the list container
        this.container.classList.add('playlist-items');
    }

    /**
     * Initialize mobile drawer toggle
     * @private
     */
    _initMobileDrawer() {
        const toggleBtn = document.getElementById('playlist-toggle');
        const overlay = document.getElementById('playlist-overlay');
        const section = this.container.closest('.playlist-section');

        if (toggleBtn && overlay && section) {
            // Show button only on mobile (handled via CSS usually, but let's force check)
            const checkMobile = () => {
                if (window.innerWidth <= 768) {
                    toggleBtn.style.display = 'flex';
                } else {
                    toggleBtn.style.display = 'none';
                    section.classList.remove('open');
                    overlay.classList.remove('visible');
                }
            };

            window.addEventListener('resize', checkMobile);
            checkMobile();

            const toggleDrawer = () => {
                const isOpen = section.classList.contains('open');
                if (isOpen) {
                    section.classList.remove('open');
                    overlay.classList.remove('visible');
                    toggleBtn.setAttribute('aria-expanded', 'false');
                } else {
                    section.classList.add('open');
                    overlay.classList.add('visible');
                    toggleBtn.setAttribute('aria-expanded', 'true');
                }
            };

            toggleBtn.addEventListener('click', toggleDrawer);
            overlay.addEventListener('click', toggleDrawer);
        }
    }

    /**
     * Initialize keyboard shortcuts
     * @private
     */
    _initKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ignore if typing in input
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;

            if (e.shiftKey && e.key.toLowerCase() === 'n') {
                e.preventDefault();
                this.playNext();
            } else if (e.shiftKey && e.key.toLowerCase() === 'p') {
                e.preventDefault();
                this.playPrevious();
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                // Remove active item if focused or just active? 
                // Let's say if we have a selection concept separate from playing, 
                // but for now let's just remove the currently playing one for simplicity 
                // OR maybe better: remove the one hovered? No, keyboard.
                // Let's skip delete for now to avoid accidental deletion of playing video.
            }
        });
    }

    /**
     * Setup player navigation callbacks
     * @private
     */
    _setupPlayerNavigation() {
        if (this.player && typeof this.player.setNavigationCallbacks === 'function') {
            this.player.setNavigationCallbacks(
                () => this.playPrevious(),
                () => this.playNext()
            );

            // Hook up onEnded for auto-advance
            this.player.onEnded = () => this.playNext();

            this._updatePlayerNavigationState();
        }
    }

    /**
     * Check if can go to previous video
     * @private
     */
    _canGoPrevious() {
        return this.activeIndex > 0 && this.items.length > 0;
    }

    /**
     * Check if can go to next video
     * @private
     */
    _canGoNext() {
        return this.activeIndex >= 0 && this.activeIndex < this.items.length - 1;
    }

    /**
     * Update player navigation button states
     * @private
     */
    _updatePlayerNavigationState() {
        if (this.player && typeof this.player.updateNavigationButtons === 'function') {
            this.player.updateNavigationButtons(this._canGoPrevious(), this._canGoNext());
        }
    }

    /**
     * Play previous video
     */
    playPrevious() {
        if (this.activeIndex > 0) {
            this.selectItem(this.activeIndex - 1);
        }
    }

    /**
     * Load saved playlist from storage
     * @private
     */
    async _loadSavedPlaylist() {
        try {
            const { items, playbackState } = await PlaylistStorage.loadPlaylist();

            if (items.length > 0) {
                this.items = items;
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

                        console.log('[Playlist] Restoring item:', itemToRestore.title, {
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
            } else {
                this.render(); // Render empty state
            }
        } catch (e) {
            console.error('Error loading playlist:', e);
            this.render();
        }
    }

    /**
     * Save current state
     * @private
     */
    _saveState() {
        const currentTime = this.player?.currentTime || 0;
        PlaylistStorage.savePlaylist(this.items, this.activeIndex, currentTime);
    }

    /**
     * Save only playback progress (optimized for frequent calls)
     * @private
     */
    _savePlaybackProgress() {
        const activeItem = this.items[this.activeIndex];
        const currentTime = this.player?.currentTime || 0;
        PlaylistStorage.savePlaybackProgress(activeItem, this.activeIndex, currentTime);
    }

    /**
     * Handle FileList from input or drop
     * @param {FileList} files 
     */
    handleFiles(files) {
        const videoFiles = Array.from(files).filter(file => file.type.startsWith('video/'));

        if (videoFiles.length === 0) {
            alert('Please select valid video files.');
            return;
        }

        const newItems = videoFiles.map(file => {
            // Determine path
            let path = file.webkitRelativePath || file.name;
            // If path doesn't contain separators, it's at root
            if (!path.includes('/')) {
                path = file.name;
            }

            const item = {
                title: file.name,
                url: URL.createObjectURL(file),
                duration: 'Loading...',
                thumbnail: '',
                isLocal: true,
                needsReload: false,
                file: file,
                fileSize: file.size,      // Cache size for InfoMenu (file will be released after IndexedDB save)
                fileType: file.type,      // Cache type for InfoMenu
                mimeType: file.type,      // Store MIME type for blob creation
                path: path,
                id: generateId() // Add unique ID for persistence
            };

            // Electron: Store absolute file path for direct disk access
            // file.path is only available in Electron, not in browsers
            if (file.path) {
                item.localPath = file.path;
                console.log('[Electron] Storing localPath for:', file.name, '->', file.path);
            }

            return item;
        });

        this.addItems(newItems);

        // Process metadata for new items
        this._processMetadata(newItems);

        // If playlist was empty, play the first new file
        if (this.items.length === newItems.length) {
            this.selectItem(0);
        }
    }

    /**
     * Handle files from Electron's native file dialog (has paths)
     * @param {Array<{path: string, name: string, size: number, lastModified: number}>} files 
     */
    async handleElectronFiles(files) {

        const videoExtensions = ['mp4', 'mkv', 'avi', 'webm', 'mov', 'm4v', 'wmv', 'flv'];
        const videoFiles = files.filter(file => {
            const ext = file.name.split('.').pop().toLowerCase();
            return videoExtensions.includes(ext);
        });

        if (videoFiles.length === 0) {
            alert('Please select valid video files.');
            return;
        }

        const newItems = videoFiles.map(file => {
            // Determine MIME type from extension
            const ext = file.name.split('.').pop().toLowerCase();
            const mimeTypes = {
                'mp4': 'video/mp4',
                'mkv': 'video/x-matroska',
                'avi': 'video/x-msvideo',
                'webm': 'video/webm',
                'mov': 'video/quicktime',
                'm4v': 'video/x-m4v',
                'wmv': 'video/x-ms-wmv',
                'flv': 'video/x-flv'
            };
            const mimeType = mimeTypes[ext] || 'video/mp4';

            return {
                title: file.name,
                url: '', // Will be created on-demand from localPath
                duration: 'Loading...',
                thumbnail: '',
                isLocal: true,
                needsReload: false,
                file: null, // File will be loaded from disk on-demand
                fileSize: file.size,
                fileType: mimeType,
                mimeType: mimeType,
                path: file.name,
                localPath: file.path, // The absolute path for disk access
                id: generateId()
            };
        });



        this.addItems(newItems);

        // Process metadata for new items
        this._processMetadata(newItems);

        // If playlist was empty, play the first new file
        if (this.items.length === newItems.length) {
            this.selectItem(0);
        }
    }

    /**
     * Process metadata for local files
     * @param {Array} items
     */
    async _processMetadata(items) {
        await MediaMetadata.processMetadata(
            items,
            (item) => this._updateItemUI(item),
            () => this._saveState()
        );
    }

    /**
     * Ensure metadata exists on item (fetch if not cached)
     * @param {Object} item - Playlist item
     * @returns {Promise<void>}
     * @private
     */
    async _ensureMetadata(item) {
        await MediaMetadata.ensureMetadata(item, () => this._saveState());
    }

    /**
     * Get video duration using MediaBunny
     * @param {File|string} resource - File object or URL string
     * @returns {Promise<number>}
     * @private
     */
    async _getVideoDuration(resource) {
        return await MediaMetadata.getVideoDuration(resource);
    }

    /**
     * Prefetch metadata for a video asynchronously (non-blocking)
     * This improves UX when user opens Video Info or uses operations
     * @param {Object} item - Playlist item
     * @private
     */
    async _prefetchMetadata(item) {
        // Don't prefetch for streams (HLS/M3U8) - MediaBunny doesn't understand them
        if (item.isStream) {
            console.log('[Playlist] Skipping metadata prefetch for stream:', item.title);
            return;
        }

        // Don't prefetch if already cached
        if (item.videoInfo || item.audioInfo) {
            console.log('[Playlist] Metadata already cached for:', item.title);
            return;
        }

        // Don't block - this runs in background
        try {
            console.log('[Playlist] Prefetching metadata for:', item.title);
            await this._ensureMetadata(item);
            console.log('[Playlist] Metadata prefetch complete:', item.title);
        } catch (error) {
            console.warn('[Playlist] Metadata prefetch failed for:', item.title, error);
            // Non-critical error - will retry if user opens info/trim
        }
    }


    _updateItemUI(item) {
        // Find the element
        const index = this.items.indexOf(item);
        if (index === -1) return;

        const el = this.container.querySelector(`.playlist-item[data-index="${index}"]`);
        if (el) {
            // Update overlay
            let overlay = el.querySelector('.playlist-thumbnail-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.className = 'playlist-thumbnail-overlay';
                const thumbEl = el.querySelector('.playlist-thumbnail');
                if (thumbEl) thumbEl.appendChild(overlay);
            }
            if (overlay) overlay.textContent = item.duration;

            // Update thumbnail if available - use background-image on div
            const thumbEl = el.querySelector('.playlist-thumbnail');
            if (thumbEl && item.thumbnail) {
                thumbEl.style.backgroundImage = `url(${item.thumbnail})`;
                thumbEl.style.backgroundSize = 'cover';
                thumbEl.style.backgroundPosition = 'center';

                // Hide placeholder/img, keep overlay
                Array.from(thumbEl.children).forEach(child => {
                    if (!child.classList.contains('playlist-thumbnail-overlay')) {
                        child.style.display = 'none';
                    }
                });
            }
        }
    }

    /**
     * Update stream item metadata after loading (duration and thumbnail)
     * @param {Object} video - Video item
     * @param {number} index - Item index
     * @private
     */
    _updateStreamItemMetadata(video, index) {
        // Determine if it's live or VOD based on player state
        const isLive = this.player.isLive;

        // Update duration display
        if (isLive) {
            video.duration = 'LIVE';
            video.isLive = true;
        } else {
            // VOD stream - get actual duration when available
            const checkDuration = () => {
                if (this.player.duration && this.player.duration > 0) {
                    video.duration = formatDuration(this.player.duration);
                    this._updateItemUI(video);
                    this._saveState();
                }
            };
            // Check after a short delay for metadata to load
            setTimeout(checkDuration, 500);
            setTimeout(checkDuration, 2000); // Retry if first didn't work
        }

        // Capture thumbnail after video starts playing
        this._captureStreamThumbnail(video, index);

        // Update UI immediately for live badge
        this._updateItemUI(video);
    }

    /**
     * Capture thumbnail from stream video
     * @param {Object} video - Video item
     * @param {number} index - Item index
     * @private
     */
    _captureStreamThumbnail(video, index) {
        // Generate a unique capture ID to handle video switches
        const captureId = ++this._thumbnailCaptureId || 1;
        this._thumbnailCaptureId = captureId;

        // Clear any existing stale thumbnail from previous video
        if (video.thumbnail) {
            console.log(`[Playlist] Keeping existing thumbnail for: ${video.title}`);
            return;
        }

        // Define the capture callback
        const captureCallback = (ctx, width, height) => {
            // Check if capture was invalidated (user switched videos)
            if (this._thumbnailCaptureId !== captureId || this.activeIndex !== index) {
                // Remove this callback as it's no longer valid
                this.player.afterFrameRenderCallbacks = this.player.afterFrameRenderCallbacks.filter(cb => cb !== captureCallback);
                return;
            }

            try {
                // Create small thumbnail
                const thumbCanvas = document.createElement('canvas');
                thumbCanvas.width = 80;
                thumbCanvas.height = 45;
                const thumbCtx = thumbCanvas.getContext('2d');
                thumbCtx.drawImage(this.player.canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);

                // Check content (non-black pixels)
                const imageData = thumbCtx.getImageData(0, 0, thumbCanvas.width, thumbCanvas.height);
                const data = imageData.data;
                let nonBlackPixels = 0;
                const threshold = 10;

                for (let i = 0; i < data.length; i += 16) {
                    if (data[i] > threshold || data[i + 1] > threshold || data[i + 2] > threshold) {
                        nonBlackPixels++;
                    }
                }

                const totalPixels = (thumbCanvas.width * thumbCanvas.height) / 4;
                if (nonBlackPixels < totalPixels * 0.05) {
                    // Still black, keep waiting (don't remove callback yet)
                    return;
                }

                // Success!
                video.thumbnail = thumbCanvas.toDataURL('image/jpeg', 0.5);
                this._updateItemUI(video);
                this._saveState();
                console.log(`[Playlist] Captured thumbnail via render loop for: ${video.title}`);

                // Remove the callback since we're done
                this.player.afterFrameRenderCallbacks = this.player.afterFrameRenderCallbacks.filter(cb => cb !== captureCallback);

            } catch (e) {
                console.warn('[Playlist] Failed to capture thumbnail in render loop:', e);
                // Remove callback on error to prevent endless errors
                this.player.afterFrameRenderCallbacks = this.player.afterFrameRenderCallbacks.filter(cb => cb !== captureCallback);
            }
        };

        // Register the callback
        this.player.afterFrameRenderCallbacks.push(captureCallback);

        // Safety timeout: remove callback if it never fires (e.g. stream fails)
        setTimeout(() => {
            this.player.afterFrameRenderCallbacks = this.player.afterFrameRenderCallbacks.filter(cb => cb !== captureCallback);
        }, 60000);
    }

    /**
     * Update local video item metadata after loading (duration and thumbnail)
     * @param {Object} video - Video item
     * @param {number} index - Item index
     * @private
     */
    _updateLocalItemMetadata(video, index) {
        // Update duration when metadata is available
        const updateDuration = () => {
            if (this.player.duration && this.player.duration > 0) {
                const newDuration = formatDuration(this.player.duration);
                if (video.duration !== newDuration) {
                    video.duration = newDuration;
                    this._updateItemUI(video);
                    this._saveState();
                }
            }
        };

        // Check duration after metadata loads
        setTimeout(updateDuration, 300);
        setTimeout(updateDuration, 1000); // Retry if first didn't work

        // Capture thumbnail after first frame renders (only if no thumbnail exists)
        if (!video.thumbnail) {
            setTimeout(() => {
                try {
                    // Skip if thumbnail was added while waiting
                    if (video.thumbnail) return;

                    const canvas = this.player.canvas;
                    if (canvas && canvas.width > 0 && canvas.height > 0) {
                        // Create small thumbnail - optimized for memory
                        const thumbCanvas = document.createElement('canvas');
                        thumbCanvas.width = 80;  // Small for memory efficiency
                        thumbCanvas.height = 45;
                        const ctx = thumbCanvas.getContext('2d');
                        ctx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);

                        // Convert to data URL with low quality for smaller size
                        const thumbnail = thumbCanvas.toDataURL('image/jpeg', 0.5);
                        video.thumbnail = thumbnail;
                        this._updateItemUI(video);
                        this._saveState();
                        console.log(`[Playlist] Captured thumbnail for local file: ${video.title}`);
                    }
                } catch (e) {
                    console.warn('[Playlist] Failed to capture local file thumbnail:', e);
                }
            }, 500); // Wait 500ms for first frame
        }
    }

    /**
     * Add a video to the playlist
     * @param {Object} video - Video object { title, url, duration, thumbnail }
     */
    addItem(video) {
        if (!video.id) video.id = generateId();
        this.items.push(video);
        this._saveState();
        this.render();
        this._updatePlayerNavigationState();
    }

    /**
     * Add multiple videos
     * @param {Array} videos 
     */
    addItems(videos) {
        videos.forEach(v => { if (!v.id) v.id = generateId(); });
        const startIndex = this.items.length;
        this.items = [...this.items, ...videos];
        this._saveState();
        this.render();
        this._updatePlayerNavigationState();

        // Auto-load if single file added (Phase 21)
        if (videos.length === 1) {
            this.selectItem(startIndex);
        }
    }

    /**
     * Remove a video from the playlist
     * @param {number} index 
     */
    removeItem(index) {
        if (index < 0 || index >= this.items.length) return;

        // If removing the currently playing item
        if (index === this.activeIndex) {
            // Try to play next, or stop if it was the last one
            if (this.items.length > 1) {
                if (index < this.items.length - 1) {
                    this.selectItem(index + 1);
                    this.activeIndex--; // Adjust because we're about to splice
                } else {
                    this.selectItem(index - 1);
                }
            } else {
                this.clear(false);
            }
        } else if (index < this.activeIndex) {
            // If removing an item before current, adjust active index
            this.activeIndex--;
        }

        this.items.splice(index, 1);
        this._saveState();
        this.render();
        this._updatePlayerNavigationState();
    }

    /**
     * Clear the playlist
     */
    async clear(ask_confirm = true) {
        if (!ask_confirm || (ask_confirm && confirm('Are you sure you want to clear the playlist? This will reset the application state.'))) {
            // 1. Reset Player State
            this.player.reset();

            // 2. Clear Playlist Data
            this.items = [];
            this.activeIndex = -1;

            // 3. Clear IndexedDB
            await this.storage.clear();

            // 4. Update UI
            this.render();
            this._updatePlayerNavigationState();

            console.log('Application state reset successfully');
        }
    }

    /**
     * Play the next video in the playlist
     */
    playNext() {
        if (this.activeIndex < this.items.length - 1) {
            this.selectItem(this.activeIndex + 1);
        } else {
            // Check if playlist loop is enabled
            if (this.player.loopMode === 'playlist') {
                this.selectItem(0);
            } else {
                console.log('Playlist ended');
            }
        }
    }

    /**
     * Select and play a video by index
     * @param {number} index 
     * @param {boolean} autoplay - Whether to start playing immediately
     */
    async selectItem(index, autoplay = true) {
        if (index < 0 || index >= this.items.length) return;

        // Reset UI immediately for instant feedback
        if (this.player && typeof this.player.resetUI === 'function') {
            this.player.resetUI();
        }

        try {
            // Capture if we were playing before switching
            const wasPlaying = this.player.isPlaying;

            // CRITICAL: Pause current video FIRST and wait for cleanup
            // This prevents audio/video mismatch during rapid switching
            if (this.player.isPlaying || this.player.videoTrack || this.player.audioTrack) {
                this.player.pause(false);
                // Small delay to ensure audio context and iterators are properly cleaned up
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            // Cleanup previous item's resources if it was local
            if (this.activeIndex !== -1 && this.activeIndex !== index) {
                const prevItem = this.items[this.activeIndex];
                if (prevItem && prevItem.isLocal && prevItem.url) {
                    console.log(`Releasing memory for: ${prevItem.title}`);
                    URL.revokeObjectURL(prevItem.url);
                    prevItem.url = null;
                    prevItem.file = null; // Release Blob
                }
            }

            const video = this.items[index];

            if (video.needsReload) {
                alert('This local file needs to be re-uploaded.');
                return;
            }

            this.activeIndex = index;

            // Handle streams (HLS/Live) - load directly without MediaMetadata processing
            if (video.isLive || video.isStream || (video.url && video.url.includes('.m3u8'))) {
                video.isStream = true; // Mark for metadata prefetch skip
                const shouldAutoplay = autoplay && this.player.isPlaying;
                await this.player.load(video.url, shouldAutoplay, video.id, null);

                // Update item metadata after stream loads
                this._updateStreamItemMetadata(video, index);

                this._updateUI();
                this._saveState();
                this._updatePlayerNavigationState();
                if (shouldAutoplay) {
                    this.player.play();
                }
                return;
            }

            // On-Demand Loading: Fetch file from DB if missing OR if URL was revoked
            // Also handles remote URL items that need to load from cache
            if (!video.blob_url) {
                try {
                    // OPTIMIZATION: For remote URLs, check cache first.
                    // If not in cache, play directly from URL and cache in background.
                    if (!video.isLocal && video.url && !video.isStream) {
                        const cachedBlob = await MediaMetadata.checkCache(video);

                        if (cachedBlob) {
                            console.log(`[Playlist] Playing from cache: ${video.title}`);
                            video.blob_url = URL.createObjectURL(cachedBlob);
                            // Mark as having file so we don't try to download again
                            video.file = cachedBlob;
                        } else {
                            console.log(`[Playlist] Playing directly from URL (background caching): ${video.title}`);
                            // Direct playback
                            video.blob_url = video.url;

                            // Trigger background cache
                            MediaMetadata.cacheInBackground(video, () => {
                                console.log(`[Playlist] Background cache complete for: ${video.title}`);
                                this._saveState();
                            });
                        }
                    } else {
                        // Local files or legacy behavior
                        if (this.player.ui && this.player.ui.loader) {
                            this.player.ui.loader.classList.add('visible');
                        }
                        console.log(`Loading file from storage: ${video.title}`);
                        this.player.already_fetching = true;
                        await MediaMetadata.getProcessedSourceURL(video);
                    }

                    if (this.player.already_fetching) {
                        // If we were fetching (local file), clean up after a bit
                        // But for remote URLs we might want to keep the blob_url if it's a blob
                        if (video.blob_url.startsWith('blob:')) {
                            // Keep it for a bit or let the player handle revocation
                        }
                        this.player.already_fetching = false;
                    }
                } catch (e) {
                    console.error('Error loading file from storage:', e);
                    if (this.player.ui && this.player.ui.loader) {
                        this.player.ui.loader.classList.remove('visible');
                    }

                    // Show user-friendly popup for missing file
                    try {
                        console.log('Showing modal for file not found...');
                        const shouldRemove = await ConfirmModal.confirm({
                            title: 'File Not Found',
                            message: `"${video.title}" could not be loaded.\n\nThis file was likely too large to save in browser storage (>500MB) and needs to be re-added to the playlist.`,
                            confirmText: 'Remove',
                            cancelText: 'Keep',
                            confirmStyle: 'danger',
                            icon: '⚠️'
                        });

                        if (shouldRemove) {
                            // Remove the corrupted/missing item
                            this.items.splice(index, 1);
                            if (this.activeIndex >= index) {
                                this.activeIndex = Math.max(-1, this.activeIndex - 1);
                            }
                            this._saveState();
                            this.render();
                            this._updatePlayerNavigationState();
                        }
                    } catch (modalError) {
                        console.error('Error showing modal:', modalError);
                    }
                    return;
                }
            }

            // Final safety check: Ensure we have a valid URL before loading
            if (!video.blob_url) {
                console.error('Video URL is null, cannot load:', video.title);
                return;
            }

            // Load video into player (autoplay based on whether we WERE playing)
            const shouldAutoplay = autoplay && wasPlaying;

            // Set up callback to save subtitles when user uploads them
            this.player.onSubtitleChange = (subtitleTracks) => {
                video.subtitleTracks = subtitleTracks.map(track => ({
                    id: track.id,
                    name: track.name,
                    cues: [...track.cues]
                }));
                this._saveState();
                console.log(`Saved ${subtitleTracks.length} subtitle track(s) for: ${video.title}`);
            };

            // Load video with saved subtitles (if any)
            await this.player.load(video.blob_url, shouldAutoplay, video.id, video.subtitleTracks || null);

            // Update item metadata (duration and thumbnail) after video loads
            this._updateLocalItemMetadata(video, index);

            // Update UI
            this._updateUI();
            this._saveState();
            this._updatePlayerNavigationState();

            // Auto play if requested AND we were playing before
            if (shouldAutoplay) {
                this.player.play();
            }

            // Prefetch metadata asynchronously (non-blocking)
            this._prefetchMetadata(video);
        } finally {
            this._isSelectingItem = false;
        }
    }

    /**
     * Render the playlist
     */
    render() {
        this.container.innerHTML = '';

        if (this.items.length === 0) {
            const template = document.getElementById('playlist-empty-template');
            const clone = template.content.cloneNode(true);
            this.container.appendChild(clone);
            return;
        }

        // Build Tree
        const tree = this._buildTree(this.items);

        // Render Tree
        this.container.appendChild(this._renderTreeLevel(tree));

        // Update Active State
        this._updateUI();
    }

    /**
     * Build hierarchical tree from items
     * @param {Array} items 
     */
    _buildTree(items) {
        const root = { name: 'root', children: {}, items: [] };

        items.forEach((item, index) => {
            const path = item.path || item.title || 'Unknown';
            const parts = path.split('/');
            // If path is just filename, it goes to root items
            if (parts.length === 1) {
                root.items.push({ ...item, originalIndex: index });
                return;
            }

            // Navigate/Create folders
            let current = root;
            for (let i = 0; i < parts.length - 1; i++) {
                const folderName = parts[i];
                if (!current.children[folderName]) {
                    current.children[folderName] = {
                        name: folderName,
                        path: parts.slice(0, i + 1).join('/'),
                        children: {},
                        items: []
                    };
                }
                current = current.children[folderName];
            }

            // Add item to last folder
            current.items.push({ ...item, originalIndex: index });
        });

        return root;
    }

    /**
     * Render a level of the tree
     * @param {Object} node 
     * @returns {HTMLElement}
     */
    _renderTreeLevel(node) {
        const container = document.createElement('div');
        container.className = 'playlist-tree-level';

        // Render Folders
        Object.values(node.children).forEach(folder => {
            container.appendChild(this._createFolderElement(folder));
        });

        // Render Items
        node.items.forEach(item => {
            container.appendChild(this._createPlaylistItemElement(item));
        });

        return container;
    }

    /**
     * Create folder element with header and children
     * Uses LAZY RENDERING for large folders to improve performance
     * @param {Object} folder
     * @returns {HTMLElement}
     * @private
     */
    _createFolderElement(folder) {
        const folderEl = document.createElement('div');
        folderEl.className = 'playlist-folder';

        const isExpanded = this.expandedFolders.has(folder.path);

        // Calculate total children (items + nested folder items)
        const totalChildren = this._countFolderChildren(folder);
        const useLazyRendering = totalChildren > LAZY_FOLDER_THRESHOLD && !isExpanded;

        // Create header with item count badge
        const header = this._createFolderHeader(folder, isExpanded, totalChildren);

        // Create children container
        const childrenContainer = document.createElement('div');
        childrenContainer.className = `playlist-children ${isExpanded ? '' : 'hidden'}`;

        // LAZY RENDERING: Only render children if expanded OR small folder
        if (useLazyRendering) {
            // Mark for lazy loading - will render on first expand
            childrenContainer.dataset.lazyFolder = folder.path;
            childrenContainer.dataset.needsRender = 'true';
            // Store folder data for later rendering
            this._lazyFolderData = this._lazyFolderData || new Map();
            this._lazyFolderData.set(folder.path, folder);
        } else {
            // Render immediately (small folder or already expanded)
            childrenContainer.appendChild(this._renderTreeLevel(folder));
        }

        // Attach events (handles lazy rendering on expand)
        this._attachFolderEvents(header, childrenContainer, folder);

        folderEl.appendChild(header);
        folderEl.appendChild(childrenContainer);
        return folderEl;
    }

    /**
     * Count total items in a folder (recursively)
     * @param {Object} folder
     * @returns {number}
     * @private
     */
    _countFolderChildren(folder) {
        let count = folder.items?.length || 0;
        if (folder.children) {
            for (const child of Object.values(folder.children)) {
                count += this._countFolderChildren(child);
            }
        }
        return count;
    }

    /**
     * Create folder header HTML
     * @param {Object} folder
     * @param {boolean} isExpanded
     * @param {number} itemCount - Total items in folder
     * @returns {HTMLElement}
     * @private
     */
    _createFolderHeader(folder, isExpanded, itemCount = 0) {
        const template = document.getElementById('playlist-folder-header-template');
        const clone = template.content.cloneNode(true);

        const header = clone.querySelector('.playlist-folder-header');
        const toggle = header.querySelector('.playlist-toggle');
        const folderName = header.querySelector('.folder-name');
        const removeBtn = header.querySelector('.folder-remove-btn');

        if (isExpanded) {
            toggle.classList.add('expanded');
        }

        // Show folder name with item count
        folderName.textContent = itemCount > 0 ? `${folder.name} (${itemCount})` : folder.name;
        removeBtn.setAttribute('aria-label', `Remove folder ${folder.name}`);

        return clone.firstElementChild;
    }

    /**
     * Attach event listeners to folder elements
     * Handles LAZY RENDERING: children are rendered on first expand
     * @param {HTMLElement} header
     * @param {HTMLElement} childrenContainer
     * @param {Object} folder
     * @private
     */
    _attachFolderEvents(header, childrenContainer, folder) {
        // Toggle Event - handles lazy rendering
        header.querySelector('.playlist-folder-info').addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = childrenContainer.classList.contains('hidden');

            if (isHidden) {
                // LAZY RENDERING: Render children on first expand
                if (childrenContainer.dataset.needsRender === 'true') {
                    this._renderLazyFolderContent(childrenContainer, folder);
                }

                childrenContainer.classList.remove('hidden');
                header.querySelector('.playlist-toggle').classList.add('expanded');
                this.expandedFolders.add(folder.path);
            } else {
                childrenContainer.classList.add('hidden');
                header.querySelector('.playlist-toggle').classList.remove('expanded');
                this.expandedFolders.delete(folder.path);
            }
        });

        // Remove Folder Event
        header.querySelector('.folder-remove-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Delete folder "${folder.name}" and all its contents?`)) {
                this.removeFolder(folder.path);
            }
        });
    }

    /**
     * Render lazy folder content on first expand
     * Simply defers rendering until needed - no virtual scrolling needed
     * for folders since tree rendering is already efficient after first load
     * @param {HTMLElement} container
     * @param {Object} folder
     * @private
     */
    _renderLazyFolderContent(container, folder) {
        // Mark as rendered
        delete container.dataset.needsRender;
        delete container.dataset.lazyFolder;

        // Simply render the tree level normally - the lazy loading already
        // provides the main performance benefit by deferring this work
        container.appendChild(this._renderTreeLevel(folder));
    }

    /**
     * Create playlist item element with events
     * @param {Object} item
     * @returns {HTMLElement}
     * @private
     */
    _createPlaylistItemElement(item) {
        const fragment = this._createItemHTML(item, item.originalIndex);
        const itemEl = fragment.querySelector('.playlist-item');

        this._attachItemEvents(itemEl);
        return itemEl;
    }

    /**
     * Attach event listeners to playlist item
     * @param {HTMLElement} itemEl
     * @private
     */
    _attachItemEvents(itemEl) {
        // Click to play
        itemEl.addEventListener('click', (e) => {
            if (e.target.closest('.playlist-remove-btn') || e.target.closest('.playlist-download-btn')) return;
            const index = parseInt(itemEl.dataset.index);
            this.selectItem(index);
        });

        // Download button
        const downloadBtn = itemEl.querySelector('.playlist-download-btn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(itemEl.dataset.index);
                this._downloadItem(index);
            });
        }

        // Remove button
        const removeBtn = itemEl.querySelector('.playlist-remove-btn');
        if (removeBtn) {
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(itemEl.dataset.index);
                this.removeItem(index);
            });
        }

        // Settings button
        const settingsBtn = itemEl.querySelector('.playlist-settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(itemEl.dataset.index);
                this._toggleSettingsMenu(index, settingsBtn);
            });
        }
    }

    /**
     * Update active state in UI
     * @private
     */
    _updateUI() {
        // Remove active class from all
        const allItems = this.container.querySelectorAll('.playlist-item');
        allItems.forEach(el => el.classList.remove('active'));

        // Add active class to current index
        if (this.activeIndex >= 0) {
            const activeEl = this.container.querySelector(`.playlist-item[data-index="${this.activeIndex}"]`);
            if (activeEl) {
                activeEl.classList.add('active');
                activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }

    /**
     * Remove a folder and its contents
     * @param {string} folderPath 
     */
    removeFolder(folderPath) {
        // Capture the currently active item before modification
        const activeItem = (this.activeIndex >= 0 && this.activeIndex < this.items.length)
            ? this.items[this.activeIndex]
            : null;

        const originalLength = this.items.length;

        // Filter items
        this.items = this.items.filter(item => {
            const itemPath = item.path || '';
            if (itemPath === folderPath || itemPath.startsWith(folderPath + '/')) {
                return false; // Remove
            }
            return true; // Keep
        });

        if (this.items.length !== originalLength) {
            // Check if active item still exists
            if (activeItem) {
                const newIndex = this.items.indexOf(activeItem);
                if (newIndex === -1) {
                    // Active item was removed
                    this.activeIndex = -1;
                    // Stop playback and reset player
                    if (this.player) {
                        this.player.reset();
                    }
                } else {
                    // Active item still exists, update index
                    this.activeIndex = newIndex;
                }
            } else {
                this.activeIndex = -1;
            }

            this._saveState();
            this.render();
        }
    }

    /**
     * Sanitize filename for download
     * @param {string} filename - Original filename
     * @returns {string} Sanitized filename
     * @private
     */
    _sanitizeFilename(filename) {
        // Remove invalid filename characters
        let sanitized = filename.replace(/[<>:"/\\|?*]/g, '_');

        // Ensure we have a file extension
        if (!sanitized.match(/\.\w+$/)) {
            // Try to get extension from URL or default to .mp4
            sanitized += '.mp4';
        }

        return sanitized;
    }

    /**
     * Download a video from the playlist
     * @param {number} index - Index of video to download
     * @private
     */
    async _downloadItem(index) {
        if (index < 0 || index >= this.items.length) return;

        const item = this.items[index];
        const downloadBtn = this.container.querySelector(`[data-index="${index}"] .playlist-download-btn`);

        try {
            // Determine filename
            let filename = item.title || 'video';

            // If the item has a File object (local upload), try to get original filename
            if (item.file && item.file.name) {
                filename = item.file.name;
            }

            // Sanitize filename
            filename = this._sanitizeFilename(filename);

            if (!item.blob_url) {
                // Show loading state
                if (downloadBtn) {
                    const loadingTemplate = document.getElementById('loading-spinner-template');
                    const loadingIcon = loadingTemplate.content.cloneNode(true);
                    downloadBtn.innerHTML = '';
                    downloadBtn.appendChild(loadingIcon);
                    downloadBtn.style.opacity = '1';
                }

                console.log(`Getting source for download: ${item.title}`);

                await MediaMetadata.getProcessedSourceURL(item, () => this._saveState());

                if (downloadBtn) {
                    downloadBtn.style.opacity = "";
                }
            }

            // Use reusable download anchor from HTML
            const downloadLink = document.getElementById('mb-download-link');
            downloadLink.href = item.blob_url;
            downloadLink.download = filename;
            downloadLink.click();

            // Clean up blob URL if we created one
            if (item.blob_url) {
                setTimeout(() => URL.revokeObjectURL(item.blob_url), 100);
            }

            console.log(`Downloading: ${filename}`);

            // Restore download button icon
            if (downloadBtn) {
                // Clone from template in playlist-templates.html
                const template = document.getElementById('playlist-item-template');
                const tempItem = template.content.cloneNode(true);
                const downloadIcon = tempItem.querySelector('.playlist-download-btn svg').cloneNode(true);
                downloadBtn.innerHTML = '';
                downloadBtn.appendChild(downloadIcon);
            }

        } catch (error) {
            console.error('Download failed:', error);
            alert(`Failed to download video: ${error.message}\n\nThis may be due to CORS restrictions on the remote server.`);

            // Restore download button icon on error
            if (downloadBtn) {
                // Clone from template in playlist-templates.html
                const template = document.getElementById('playlist-item-template');
                const tempItem = template.content.cloneNode(true);
                const downloadIcon = tempItem.querySelector('.playlist-download-btn svg').cloneNode(true);
                downloadBtn.innerHTML = '';
                downloadBtn.appendChild(downloadIcon);
            }
        }
    }

    /**
     * Create HTML for a playlist item
     * @private
     */
    _createItemHTML(item, index) {
        const template = document.getElementById('playlist-item-template');
        const clone = template.content.cloneNode(true);

        const itemEl = clone.querySelector('.playlist-item');
        const thumbnail = itemEl.querySelector('.playlist-thumbnail');
        const title = itemEl.querySelector('.playlist-title');
        const duration = itemEl.querySelector('.playlist-duration');

        // Set attributes
        itemEl.dataset.index = index;
        itemEl.setAttribute('aria-label', `Play ${item.title || 'Unknown Video'}`);

        // Status classes
        if (item.needsReload) itemEl.classList.add('needs-reload');
        if (item.error) itemEl.classList.add('error');

        // Thumbnail
        if (item.thumbnail) {
            thumbnail.style.backgroundImage = `url(${item.thumbnail})`;
            thumbnail.style.backgroundSize = 'cover';
            thumbnail.style.backgroundPosition = 'center';
        } else {
            const placeholderTemplate = document.getElementById('video-placeholder-template');
            const placeholderClone = placeholderTemplate.content.cloneNode(true);
            thumbnail.appendChild(placeholderClone);
        }

        // Add Duration Overlay
        const durationOverlay = document.createElement('div');
        durationOverlay.className = 'playlist-thumbnail-overlay';
        durationOverlay.textContent = item.duration || '--:--';
        thumbnail.appendChild(durationOverlay);

        // Title Sanitization
        let titleText = item.title || 'Unknown Video';
        // Remove extension
        titleText = titleText.replace(/\.[^/.]+$/, "");
        // Replace underscores/hyphens with spaces
        titleText = titleText.replace(/[_-]/g, " ");
        // Capitalize words
        titleText = titleText.replace(/\b\w/g, l => l.toUpperCase());

        title.textContent = titleText;
        title.setAttribute('title', titleText);

        // Status text
        if (item.needsReload) {
            const statusTemplate = document.getElementById('missing-file-status-template');
            const statusSpan = statusTemplate.content.cloneNode(true);
            title.appendChild(statusSpan);
        }

        // Duration (hidden by CSS)
        if (duration) duration.style.display = 'none';

        return clone;
    }

    /**
     * Initialize URL Upload Feature
     * @private
     */
    _initUrlUpload() {
        // Add event listener to "URL" button
        // Note: Header is a sibling of container, so we use getElementById
        const urlBtn = document.getElementById('mb-add-url');
        if (urlBtn) {
            urlBtn.addEventListener('click', () => {
                this._openUrlModal();
            });
        } else {
            console.warn('URL Upload button not found');
        }
    }

    /**
     * Open URL Upload Modal
     * @private
     */
    _openUrlModal() {
        const contentTemplate = document.getElementById('url-upload-content-template');
        const footerTemplate = document.getElementById('url-upload-footer-template');
        if (!contentTemplate || !footerTemplate) return;

        const modal = new DialogModal({ maxWidth: '500px' });
        modal.setTitle('Add Video from URL');
        modal.setBody(contentTemplate.content.cloneNode(true));
        modal.setFooter(footerTemplate.content.cloneNode(true));

        const modalContent = modal.modal;

        const input = modalContent.querySelector('#url-input');
        const addBtn = modalContent.querySelector('.mb-modal-add');
        const cancelBtn = modalContent.querySelector('.mb-modal-cancel');
        const errorDiv = modalContent.querySelector('.mb-modal-error');
        const loadingDiv = modalContent.querySelector('.mb-modal-loading');

        modal.open();

        // Focus input
        setTimeout(() => input.focus(), 100);

        // Validate input
        input.addEventListener('input', () => {
            const isValid = this._isValidUrl(input.value);
            addBtn.disabled = !isValid;
            errorDiv.style.display = 'none';
        });

        // Handle Add
        addBtn.addEventListener('click', async () => {
            const url = input.value.trim();
            if (!url) return;

            // Show loading
            input.disabled = true;
            addBtn.disabled = true;
            cancelBtn.disabled = true;
            modal.closeBtn.disabled = true;
            loadingDiv.style.display = 'flex';
            errorDiv.style.display = 'none';

            try {
                await this._handleUrlUpload(url);
                // Close modal on success
                modal.close();
            } catch (error) {
                // Show error
                input.disabled = false;
                addBtn.disabled = false;
                cancelBtn.disabled = false;
                modal.closeBtn.disabled = false;
                loadingDiv.style.display = 'none';
                errorDiv.textContent = error.message;
                errorDiv.style.display = 'block';
            }
        });

        // Handle Close/Cancel
        cancelBtn.addEventListener('click', () => modal.close());

        // Handle Enter key
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !addBtn.disabled) {
                addBtn.click();
            }
            if (e.key === 'Escape') {
                modal.close();
            }
        });
    }

    /**
     * Validate URL
     * @private
     * @param {string} string 
     * @returns {boolean}
     */
    _isValidUrl(string) {
        try {
            const url = new URL(string);
            return url.protocol === "http:" || url.protocol === "https:";
        } catch (_) {
            return false;
        }
    }

    /**
     * Handle URL Upload logic
     * @private
     * @param {string} url 
     */
    async _handleUrlUpload(url) {
        try {
            const urlLower = url.toLowerCase();

            // Check if it's an M3U playlist (not HLS stream)
            // M3U playlists end with .m3u (not .m3u8)
            const isM3UPlaylist = urlLower.endsWith('.m3u') ||
                (urlLower.includes('.m3u') && !urlLower.includes('.m3u8'));

            if (isM3UPlaylist) {
                await this._handleM3UPlaylist(url);
                return;
            }

            // Check if it's an HLS stream (m3u8)
            const isHLSStream = urlLower.includes('.m3u8') ||
                urlLower.includes('/hls/') ||
                urlLower.includes('/live/');

            if (isHLSStream) {
                // For HLS streams, skip HEAD request validation
                // since many stream servers return different content-types
                const urlPath = new URL(url).pathname;
                let filename = urlPath.split('/').pop() || 'stream';

                // Remove query string from filename
                filename = filename.split('?')[0];

                // Create a display title
                const displayTitle = filename.replace('.m3u8', '') || 'Live Stream';

                const newItem = {
                    title: displayTitle,
                    url: url,
                    blob_url: url, // For streams, blob_url IS the stream URL
                    duration: 'LIVE',
                    thumbnail: '',
                    isLocal: false,
                    isStream: true,
                    file: null,
                    fileType: 'application/vnd.apple.mpegurl',
                    mimeType: 'application/vnd.apple.mpegurl',
                    id: generateId()
                };

                this.addItem(newItem);

                // Select the new item if playlist was empty
                if (this.items.length === 1) {
                    this.selectItem(0);
                }

                return;
            }

            // For regular video files, verify access
            const response = await fetch(url, { method: 'HEAD' });

            if (!response.ok) {
                // Try GET if HEAD fails (some servers don't support HEAD)
                const getResponse = await fetch(url);
                if (!getResponse.ok) {
                    throw new Error(`Failed to fetch video: ${getResponse.statusText}`);
                }
            }

            // Get content type from headers
            const contentType = response.headers.get('content-type') || 'video/mp4';

            // Allow video types and HLS types
            const validTypes = ['video/', 'application/vnd.apple.mpegurl', 'application/x-mpegurl'];
            const isValidType = validTypes.some(type => contentType.toLowerCase().includes(type.toLowerCase()));

            if (!isValidType) {
                throw new Error('The URL does not point to a valid video file or stream.');
            }

            // Extract filename from URL
            const urlPath = new URL(url).pathname;
            const filename = urlPath.split('/').pop() || 'remote-video.mp4';

            // Create item with original URL for re-fetching
            const newItem = {
                title: filename,
                url: url,
                duration: 'Loading...',
                thumbnail: '',
                isLocal: false,
                file: null,
                fileType: contentType,
                mimeType: contentType,
                id: generateId()
            };

            this.addItem(newItem);

            // Process metadata
            this._processMetadata([newItem]);

            // Select the new item
            if (this.items.length === 1) {
                this.selectItem(0);
            }

        } catch (error) {
            if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
                throw new Error('CORS Error: Cannot access this URL. The server must allow cross-origin requests.');
            }
            throw error;
        }
    }

    /**
     * Handle M3U/IPTV Playlist Import
     * Parses the M3U file and adds channels grouped by category as folders
     * @param {string} url - URL to the M3U playlist
     * @private
     */
    async _handleM3UPlaylist(url) {
        try {
            // Fetch and parse the M3U playlist
            const channels = await M3UParser.fetchAndParse(url);

            if (!channels || channels.length === 0) {
                throw new Error('No channels found in this playlist.');
            }

            // Extract playlist name from URL for root folder
            const urlPath = new URL(url).pathname;
            let playlistName = urlPath.split('/').pop() || 'IPTV Playlist';
            playlistName = playlistName.replace('.m3u', '').replace(/_/g, ' ');
            // Capitalize first letter
            playlistName = playlistName.charAt(0).toUpperCase() + playlistName.slice(1);

            // Convert channels to playlist items with folder hierarchy
            const newItems = channels.map(channel => {
                // Build path: PlaylistName/Group/ChannelName
                const group = channel.group || 'Uncategorized';
                const channelName = channel.name || 'Unknown Channel';
                const path = `${playlistName}/${group}/${channelName}`;

                return {
                    title: channelName,
                    url: channel.url,
                    blob_url: channel.url, // For streams, blob_url IS the stream URL
                    duration: 'LIVE',
                    thumbnail: channel.logo || '',
                    isLocal: false,
                    isStream: true,
                    isLive: true,
                    file: null,
                    fileType: 'application/vnd.apple.mpegurl',
                    mimeType: 'application/vnd.apple.mpegurl',
                    path: path,
                    id: channel.id || generateId(),
                    // Store M3U metadata for potential future use
                    m3uData: {
                        tvgId: channel.tvgId,
                        tvgName: channel.tvgName,
                        language: channel.language,
                        country: channel.country,
                        group: channel.group
                    }
                };
            });

            // Add all items at once
            newItems.forEach(item => {
                if (!item.id) item.id = generateId();
            });
            this.items = [...this.items, ...newItems];
            this._saveState();
            this.render();
            this._updatePlayerNavigationState();

            // Show success message
            this._showToast(`Added ${channels.length} channels from ${playlistName}`);

            console.log(`[M3U] Imported ${channels.length} channels from: ${url}`);

        } catch (error) {
            console.error('[M3U] Failed to import playlist:', error);
            if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
                throw new Error('CORS Error: Cannot access this M3U playlist. The server must allow cross-origin requests.');
            }
            throw error;
        }
    }

    /**
     * Toggle settings menu for an item
     * @param {number} index 
     * @param {HTMLElement} buttonEl 
     * @private
     */
    _toggleSettingsMenu(index, buttonEl) {
        // Check if this menu is already open
        const existingMenu = document.querySelector('.playlist-context-menu');
        const isSameMenu = existingMenu && existingMenu.dataset.index == index;

        this._closeAllMenus();

        if (!isSameMenu) {
            this._createSettingsMenu(index, buttonEl);
        }
    }

    /**
     * Create and show settings menu
     * @param {number} index 
     * @param {HTMLElement} buttonEl 
     * @private
     */
    _createSettingsMenu(index, buttonEl) {
        const template = document.getElementById('playlist-settings-menu-template');
        if (!template) return;

        const clone = template.content.cloneNode(true);
        const menu = clone.querySelector('.playlist-context-menu');
        menu.dataset.index = index;

        // Conditional Logic
        const item = this.items[index];

        // Attach Event Listeners
        menu.querySelectorAll('.playlist-menu-item').forEach(menuItem => {
            menuItem.addEventListener('click', (e) => {
                e.stopPropagation();
                if (menuItem.classList.contains('disabled')) return;

                const action = menuItem.dataset.action;
                MenuRouter.init(action, index, this);
                this._closeAllMenus();
                this.player.pause();
            });
        });

        document.body.appendChild(menu);

        // Position the menu
        this._positionSettingsMenu(menu, buttonEl);

        // Show with animation
        requestAnimationFrame(() => {
            menu.classList.add('visible');
        });
    }

    /**
     * Position the settings menu intelligently
     * @param {HTMLElement} menu 
     * @param {HTMLElement} button 
     * @private
     */
    _positionSettingsMenu(menu, button) {
        const rect = button.getBoundingClientRect();
        const menuRect = menu.getBoundingClientRect();
        const viewportHeight = window.innerHeight;

        let top = rect.bottom + 5;
        let left = rect.right - menuRect.width; // Align right edge by default

        // Check vertical overflow (bottom)
        if (top + menuRect.height > viewportHeight - 10) {
            // Position above
            top = rect.top - menuRect.height - 5;
        }

        // Check vertical overflow (top) - ensure menu doesn't go above viewport
        if (top < 10) {
            top = 10;
        }

        // Check horizontal overflow (left side)
        if (left < 10) {
            left = rect.left; // Align left edge
        }

        menu.style.top = `${top}px`;
        menu.style.left = `${left}px`;
    }

    /**
     * Close all open context menus
     * @private
     */
    _closeAllMenus() {
        const menus = document.querySelectorAll('.playlist-context-menu');
        menus.forEach(menu => {
            menu.classList.remove('visible');
            setTimeout(() => {
                if (menu.parentNode) menu.parentNode.removeChild(menu);
            }, 200); // Wait for transition
        });
    }

    /**
     * Get formatted metadata for a file
     * @param {Blob} blob
     * @param {string} filename
     * @returns {Promise<Object>}
     * @private
     */
    async _getFormattedMetadata(blob, filename) {
        return await MediaMetadata.getFormattedMetadata(blob, filename);
    }

    /**
     * Show toast notification
     * @param {string} message 
     * @private
     */
    _showToast(message) {
        // Simple toast implementation or reuse existing if available
        // For now, let's use a simple alert or console log if no toast system exists
        // Actually, let's create a temporary element
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--accent-primary);
            color: #000;
            padding: 10px 20px;
            border-radius: 4px;
            font-weight: bold;
            z-index: 3000;
            opacity: 0;
            transition: opacity 0.3s;
        `;
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.style.opacity = '1');
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => document.body.removeChild(toast), 300);
        }, 2000);
    }
}

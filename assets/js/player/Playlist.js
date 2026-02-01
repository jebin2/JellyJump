import { Logger } from "../utils/Logger.js";
import { IndexedDBService } from './IndexedDBService.js';
import { CorePlayer } from '../core/Player.js';
import { Modal as ConfirmModal } from '../utils/Modal.js'; // Static confirm/alert dialogs
import { Modal as DialogModal } from './Modal.js';         // Instance-based custom dialogs
import { MenuRouter } from './menu/MenuRouter.js';
import { RecordMenu } from './menu/RecordMenu.js';
import { ScreenRecorderMenu } from './menu/ScreenRecorderMenu.js';
import { PlaylistStorage } from './PlaylistStorage.js';
import { MediaMetadata } from '../utils/MediaMetadata.js';
import { FileDropHandler } from '../utils/FileDropHandler.js';
import { ElectronHelper } from '../utils/ElectronHelper.js';
import { formatDuration, generateId } from '../utils/mediaUtils.js';
import { M3UParser } from '../utils/M3UParser.js';
import { HLSPlayer } from '../core/HLSPlayer.js';
import { StreamDetector } from '../utils/StreamDetector.js';

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
        this.searchQuery = ''; // Search query state

        // Initial Loading State
        this.isLoading = true;

        // Note: Do NOT clear container.innerHTML here.
        // We want to keep the "Loading..." placeholder from player.html visible
        // until the first render() call.


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
            Logger.log('[Playlist] beforeunload - saving state');
            this._saveState();
            Logger.log('[Playlist] beforeunload - revoking blob URLs');
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

        // Setup player error callback to mark broken streams
        if (this.player) {
            this.player.onStreamError = (videoId, error) => {
                this.markItemBroken(videoId, error);
            };
        }
    }

    /**
     * Setup player navigation callbacks
     * @private
     */
    _initPlayerNavigation() {
        if (!this.player) {
            Logger.error('Playlist: Player instance is missing!');
            return;
        }
        this.player.setNavigationCallbacks(
            () => this.playPrevious(),
            () => this.playNext()
        );

        // Handle play request when no video is loaded
        this.player.setPlayCallback(() => {
            if (this.items.length > 0 && this.activeIndex === -1) {
                // Playlist has items but none selected - show message
                ConfirmModal.alert({
                    title: 'No Video Selected',
                    message: 'Please select a video from the playlist to play.',
                    confirmText: 'OK',
                    icon: '📺'
                });
            } else if (this.items.length === 0) {
                // Playlist is empty - show message
                ConfirmModal.alert({
                    title: 'Playlist Empty',
                    message: 'Add videos to the playlist using the upload button or paste a URL.',
                    confirmText: 'OK',
                    icon: '📂'
                });
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
            Logger.error('Playlist header template not found!');
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
                Logger.error('Failed to load SidebarToggle:', err);
            });
        } else {
            Logger.warn('Sidebar toggle elements not found', { sidebarElement, toggleButton });
        }

        // Attach events
        const addFilesBtn = header.querySelector('#mb-add-files');
        const addFolderBtn = header.querySelector('#mb-add-folder');
        const screenRecordBtn = header.querySelector('#mb-screen-record');
        const clearBtn = header.querySelector('#mb-clear-playlist');
        const searchInput = header.querySelector('#mb-playlist-search-input');
        const searchClearBtn = header.querySelector('#mb-playlist-search-clear');

        if (screenRecordBtn) {
            screenRecordBtn.addEventListener('click', async () => {
                const { ScreenRecorderMenu } = await import('./menu/ScreenRecorderMenu.js');
                ScreenRecorderMenu.showOptions(this);
            });
        }

        if (searchInput) {
            // Debounce function
            const debounce = (func, wait) => {
                let timeout;
                return function executedFunction(...args) {
                    const later = () => {
                        clearTimeout(timeout);
                        func(...args);
                    };
                    clearTimeout(timeout);
                    timeout = setTimeout(later, wait);
                };
            };

            const handleSearch = debounce((e) => {
                this.searchQuery = e.target.value.trim().toLowerCase();

                // Toggle clear button
                if (this.searchQuery) {
                    searchClearBtn?.classList.remove('hidden');
                } else {
                    searchClearBtn?.classList.add('hidden');
                }

                this.render();
            }, 300); // 300ms delay

            searchInput.addEventListener('input', handleSearch);

            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    searchInput.value = '';
                    this.searchQuery = '';
                    searchClearBtn?.classList.add('hidden');
                    this.render();
                    searchInput.blur();
                }
            });
        }

        if (searchClearBtn) {
            searchClearBtn.addEventListener('click', () => {
                searchInput.value = '';
                this.searchQuery = '';
                searchClearBtn.classList.add('hidden');
                this.render();
                searchInput.focus();
            });
        }

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

        // Scroll to playing button
        const scrollToPlayingBtn = header.querySelector('#mb-scroll-to-playing');
        if (scrollToPlayingBtn) {
            scrollToPlayingBtn.addEventListener('click', () => {
                this.scrollToPlaying();
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
     * Stop playback and show 'Select video to play' message
     * Called when active video/folder is deleted
     * @private
     */
    _stopPlayback() {
        this.activeIndex = -1;
        this.player.reset();
        this._updateUI();
        this._updatePlayerNavigationState();
        Logger.log('[Playlist] Playback stopped - select a video to play');
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
     * Scroll to the currently playing item and highlight it
     */
    async scrollToPlaying() {
        if (this.activeIndex < 0) return;
        const item = this.items[this.activeIndex];
        if (!item) return;

        // 1. Recursive Expansion
        let targetFolderWrapper = this.container;

        if (item.path && item.path.includes('/')) {
            const parts = item.path.split('/');
            // Expand all parents
            for (let i = 0; i < parts.length - 1; i++) {
                const folderPath = parts.slice(0, i + 1).join('/');
                await this._ensureFolderExpanded(folderPath);
            }

            // Find target wrapper
            const parentPath = parts.slice(0, parts.length - 1).join('/');
            const folderEl = this.container.querySelector(`.playlist-folder[data-path="${parentPath}"]`);
            if (folderEl) {
                targetFolderWrapper = folderEl.querySelector('.playlist-children');
            }
        }

        // Wait for render
        await new Promise(r => setTimeout(r, 50));

        // 2. Try Standard Scroll
        let itemEl = this.container.querySelector(`.playlist-item[data-index="${this.activeIndex}"]`);

        // 3. Virtual Scroll Fallback
        if (!itemEl && targetFolderWrapper) {
            const index = this._calculateVirtualIndex(item);
            if (index !== -1) {
                // Estimate height: 40px item + 1px border
                targetFolderWrapper.scrollTop = index * 41;

                // Wait for scroll listener to trigger render
                await new Promise(r => setTimeout(r, 200)); // Generous wait for large lists
                itemEl = this.container.querySelector(`.playlist-item[data-index="${this.activeIndex}"]`);
            }
        }

        if (itemEl) {
            itemEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            itemEl.classList.add('playlist-item--highlight');
            setTimeout(() => itemEl.classList.remove('playlist-item--highlight'), 1500);
        }
    }

    /**
     * Calculate virtual index of an item within its folder (Drawer)
     * Used to scroll virtual lists to the correct position
     */
    _calculateVirtualIndex(targetItem) {
        // Determine parent path
        let parentPath = '';
        if (targetItem.path && targetItem.path.includes('/')) {
            parentPath = targetItem.path.substring(0, targetItem.path.lastIndexOf('/'));
        }
        const prefix = parentPath ? parentPath + '/' : '';

        // 1. Count Sibling Folders (Folders come first in Drawer)
        const siblingFolders = new Set();
        this.items.forEach(i => {
            const p = i.path || '';
            // Check if derivative path
            if (p.startsWith(prefix) && p !== prefix) {
                const relative = p.substring(prefix.length);
                const slashIndex = relative.indexOf('/');
                if (slashIndex !== -1) {
                    siblingFolders.add(relative.substring(0, slashIndex));
                }
            }
        });

        const folderCount = siblingFolders.size;

        // 2. Count Sibling Items (items equal to or before target)
        let itemCountBefore = 0;
        let found = false;

        for (const i of this.items) {
            const p = i.path || '';
            let isDirectSibling = false;
            if (prefix === '') {
                isDirectSibling = !p.includes('/');
            } else {
                isDirectSibling = p.startsWith(prefix) && !p.substring(prefix.length).includes('/');
            }

            if (isDirectSibling) {
                if (i === targetItem) {
                    found = true;
                    break;
                }
                itemCountBefore++;
            }
        }

        if (!found) return -1;

        return folderCount + itemCountBefore;
    }

    /**
     * Recursively ensure a folder is expanded in the DOM
     */
    async _ensureFolderExpanded(path) {
        // Find wrapper
        const folderEl = this.container.querySelector(`.playlist-folder[data-path="${path}"]`);
        if (!folderEl) return;

        const children = folderEl.querySelector('.playlist-children');
        // Check if hidden or not loaded
        if (children && children.classList.contains('hidden')) {
            const header = folderEl.querySelector('.playlist-folder-header');
            if (header) {
                header.click(); // Triggers toggleDrawer -> setupInfiniteScroll
                // Wait a tick for rendering
                await new Promise(r => setTimeout(r, 50));
            }
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
            } else {
                this.isLoading = false; // Loaded empty
                this.render(); // Render empty state
            }
        } catch (e) {
            Logger.error('Error loading playlist:', e);
            this.isLoading = false; // Stop loading on error
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
        // Accept both video and audio files
        const mediaFiles = Array.from(files).filter(file =>
            file.type.startsWith('video/') || file.type.startsWith('audio/')
        );

        if (mediaFiles.length === 0) {
            alert('Please select valid video or audio files.');
            return;
        }

        const newItems = mediaFiles.map(file => {
            // Determine path
            let path = file.webkitRelativePath || file.name;
            // If path doesn't contain separators, it's at root
            if (!path.includes('/')) {
                path = file.name;
            }

            const isAudio = file.type.startsWith('audio/');

            const item = {
                title: file.name,
                url: URL.createObjectURL(file),
                duration: 'Loading...',
                thumbnail: '',
                isLocal: true,
                isAudio: isAudio,
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
                Logger.log('[Electron] Storing localPath for:', file.name, '->', file.path);
            }

            return item;
        });

        this.addItems(newItems);

        // Process metadata for new items
        this._processMetadata(newItems);

        // Note: addItems() handles autoplay, no selectItem needed here
    }

    /**
     * Handle files from Electron's native file dialog (has paths)
     * @param {Array<{path: string, name: string, size: number, lastModified: number}>} files 
     */
    async handleElectronFiles(files) {

        const videoExtensions = ['mp4', 'mkv', 'avi', 'webm', 'mov', 'm4v', 'wmv', 'flv'];
        const audioExtensions = ['mp3', 'flac', 'aac', 'ogg', 'wav', 'm4a', 'opus', 'wma'];
        const allExtensions = [...videoExtensions, ...audioExtensions];

        const mediaFiles = files.filter(file => {
            const ext = file.name.split('.').pop().toLowerCase();
            return allExtensions.includes(ext);
        });

        if (mediaFiles.length === 0) {
            alert('Please select valid video or audio files.');
            return;
        }

        const newItems = mediaFiles.map(file => {
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
                'flv': 'video/x-flv',
                // Audio types
                'mp3': 'audio/mpeg',
                'flac': 'audio/flac',
                'aac': 'audio/aac',
                'ogg': 'audio/ogg',
                'wav': 'audio/wav',
                'm4a': 'audio/mp4',
                'opus': 'audio/opus',
                'wma': 'audio/x-ms-wma'
            };
            const mimeType = mimeTypes[ext] || 'video/mp4';
            const isAudio = ext && audioExtensions.includes(ext);

            return {
                title: file.name,
                url: '', // Will be created on-demand from localPath
                duration: 'Loading...',
                thumbnail: '',
                isLocal: true,
                isAudio: isAudio,
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
            Logger.log('[Playlist] Skipping metadata prefetch for stream:', item.title);
            return;
        }

        // Don't prefetch if already cached
        if (item.videoInfo || item.audioInfo) {
            Logger.log('[Playlist] Metadata already cached for:', item.title);
            return;
        }

        // Don't block - this runs in background
        try {
            Logger.log('[Playlist] Prefetching metadata for:', item.title);
            await this._ensureMetadata(item);
            Logger.log('[Playlist] Metadata prefetch complete:', item.title);
        } catch (error) {
            Logger.warn('[Playlist] Metadata prefetch failed for:', item.title, error);
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
            Logger.log(`[Playlist] Keeping existing thumbnail for: ${video.title}`);
            return;
        }

        // Define the capture callback
        const captureCallback = (canvas, ctx) => {
            // Check if capture was invalidated (user switched videos)
            if (this._thumbnailCaptureId !== captureId || this.activeIndex !== index) {
                // Remove this callback as it's no longer valid
                this.player.afterFrameRenderCallbacks = this.player.afterFrameRenderCallbacks.filter(cb => cb !== captureCallback);
                return;
            }

            try {
                // Check content (simple non-black check) to avoid capturing empty/loading frames
                // We sample the center of the canvas to avoid reading the whole large buffer
                const w = canvas.width;
                const h = canvas.height;
                const sampleW = Math.min(w, 50); // Sample a small center patch
                const sampleH = Math.min(h, 50);
                const sampleX = Math.floor((w - sampleW) / 2);
                const sampleY = Math.floor((h - sampleH) / 2);

                const imageData = ctx.getImageData(sampleX, sampleY, sampleW, sampleH);
                const data = imageData.data;
                let nonBlackPixels = 0;
                const threshold = 15;

                // Check sample
                for (let i = 0; i < data.length; i += 4) {
                    // r,g,b > threshold
                    if (data[i] > threshold || data[i + 1] > threshold || data[i + 2] > threshold) {
                        nonBlackPixels++;
                    }
                }

                // If sample is pitch black, wait
                if (nonBlackPixels < (data.length / 4) * 0.05) {
                    return;
                }

                // Success!
                // Captured directly constitutes a larger thumbnail but meets "Direct" requirement
                // We use 0.7 quality to keep size somewhat reasonable
                video.thumbnail = canvas.toDataURL('image/jpeg', 0.7);

                this._updateItemUI(video);
                this._saveState();
                Logger.log(`[Playlist] Captured thumbnail via render loop for: ${video.title}`);

                // Remove the callback since we're done
                this.player.afterFrameRenderCallbacks = this.player.afterFrameRenderCallbacks.filter(cb => cb !== captureCallback);

            } catch (e) {
                Logger.warn('[Playlist] Failed to capture thumbnail in render loop:', e);
                // Remove callback on error
                this.player.afterFrameRenderCallbacks = this.player.afterFrameRenderCallbacks.filter(cb => cb !== captureCallback);
            }
        };

        // Register the callback
        this.player.afterFrameRenderCallbacks.push(captureCallback);

        // Safety timeout: remove callback if it never fires (e.g. stream fails)
        setTimeout(() => {
            if (this.player.afterFrameRenderCallbacks.includes(captureCallback)) {
                this.player.afterFrameRenderCallbacks = this.player.afterFrameRenderCallbacks.filter(cb => cb !== captureCallback);
            }
        }, 60000);
    }

    /**
     * Update local video item metadata after loading (duration and thumbnail)
     * @param {Object} video - Video item
     * @param {number} index - Item index
     * @private
     */
    async _updateLocalItemMetadata(video, index) {
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

        // Capture thumbnail using render loop (unified method)
        this._captureStreamThumbnail(video, index);
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
     * @param {boolean} autoplay - Whether to auto-play the first item (default: true)
     */
    async addItems(videos, autoplay = true) {
        // Separate M3U playlist URLs from regular items
        const m3uItems = [];
        const regularItems = [];

        for (const v of videos) {
            const url = v.url?.toLowerCase() || '';
            const isM3UPlaylist = url.endsWith('.m3u') ||
                (url.includes('.m3u') && !url.includes('.m3u8'));

            if (isM3UPlaylist) {
                m3uItems.push(v);
            } else {
                if (!v.id) v.id = generateId();
                regularItems.push(v);
            }
        }

        // Disable loading state since we have new items
        this.isLoading = false;

        // Add regular items immediately
        if (regularItems.length > 0) {
            const startIndex = this.items.length;
            this.items = [...this.items, ...regularItems];
            this._saveState();
            this.render();
            this._updatePlayerNavigationState();

            // Auto-play the first item from the batch that was just added
            this.selectItem(startIndex, autoplay);
        }

        // Process M3U playlists asynchronously
        for (const m3u of m3uItems) {
            try {
                Logger.log(`[Playlist] Expanding M3U playlist: ${m3u.title || m3u.url}`);
                await this._handleM3UPlaylist(m3u.url);
            } catch (error) {
                Logger.error(`[Playlist] Failed to expand M3U: ${m3u.url}`, error);
                // Add as a regular item if expansion fails
                if (!m3u.id) m3u.id = generateId();
                this.items.push(m3u);
                this._saveState();
                this.render();
            }
        }
    }

    /**
     * Remove a video from the playlist
     * @param {number} index 
     */
    /**
     * Remove item from playlist (Surgical DOM Update)
     * @param {number} index
     */
    removeItem(index) {
        if (index < 0 || index >= this.items.length) return;

        // If removing the currently playing item, stop playback
        const wasActive = index === this.activeIndex;

        // Adjust activeIndex if removing item before it
        if (index < this.activeIndex) {
            this.activeIndex--;
        } else if (wasActive) {
            // Will stop playback after removal
            this.activeIndex = -1;
        }

        // 1. Data Removal
        this.items.splice(index, 1);
        this._saveState();
        this._updatePlayerNavigationState();

        // 2. Surgical DOM Removal
        const itemEl = this.container.querySelector(`.playlist-item[data-index="${index}"]`);
        if (itemEl) {
            // Update Parent Folder Count
            const folder = itemEl.closest('.playlist-folder');
            if (folder) {
                const header = folder.querySelector('.playlist-folder-header');
                const countSpan = header.querySelector('span:last-child');
                if (countSpan && countSpan.textContent.startsWith('(')) {
                    const currentCount = parseInt(countSpan.textContent.replace(/\D/g, ''));
                    const newCount = Math.max(0, currentCount - 1);
                    countSpan.textContent = `(${newCount})`;
                    if (newCount === 0) folder.remove();
                }
            }
            itemEl.remove();
        }

        // 3. Patch visible indices (collapsed folders use ID-based lookup)
        const allItems = this.container.querySelectorAll('.playlist-item');
        for (const el of allItems) {
            const curr = parseInt(el.dataset.index);
            if (curr > index) {
                el.dataset.index = curr - 1;
            }
        }

        // 4. Stop playback if active item was removed
        if (wasActive) {
            this._stopPlayback();
        }
    }

    /**
     * Remove a folder and all its contents (Surgical DOM Update)
     */
    removeFolder(folderPath) {
        // Find items to remove
        const indicesToRemove = [];
        this.items.forEach((item, idx) => {
            const itemPath = item.path || '';
            if (itemPath === folderPath || itemPath.startsWith(folderPath + '/')) {
                indicesToRemove.push(idx);
            }
        });

        if (indicesToRemove.length === 0) return;

        // Sort desc to splice correctly from end
        indicesToRemove.sort((a, b) => b - a);

        // Active Item Logic
        const originalActive = this.activeIndex >= 0 ? this.items[this.activeIndex] : null;

        // 1. Remove Data
        indicesToRemove.forEach(idx => {
            this.items.splice(idx, 1);
        });

        // 2. Update Active Index
        let wasActiveRemoved = false;
        if (originalActive) {
            const newIndex = this.items.indexOf(originalActive);
            if (newIndex === -1) {
                // Active item was removed - stop playback
                wasActiveRemoved = true;
                this.activeIndex = -1;
            } else {
                this.activeIndex = newIndex;
            }
        } else {
            this.activeIndex = -1;
        }

        this._saveState();
        this._updatePlayerNavigationState();

        // 3. Surgical DOM Removal
        const folderEl = this.container.querySelector(`.playlist-folder[data-path="${folderPath}"]`);
        if (folderEl) {
            folderEl.remove();
        }

        // 4. Patch visible indices (collapsed folders use ID-based lookup)
        const allItems = this.container.querySelectorAll('.playlist-item');
        for (const el of allItems) {
            const oldIdx = parseInt(el.dataset.index);
            let shift = 0;
            for (const removedIdx of indicesToRemove) {
                if (removedIdx < oldIdx) {
                    shift++;
                }
            }
            if (shift > 0) {
                el.dataset.index = oldIdx - shift;
            }
        }

        // 5. Stop playback if active was removed
        if (wasActiveRemoved) {
            this._stopPlayback();
        }
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

            Logger.log('Application state reset successfully');
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
                Logger.log('Playlist ended');
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

        // Show loading immediately for instant feedback
        if (this.player && typeof this.player._setLoading === 'function') {
            this.player._setLoading(true);
        }

        // Reset UI (clear canvas, reset time/progress)
        if (this.player && typeof this.player.resetUI === 'function') {
            this.player.resetUI();
        }

        try {
            // Capture if we were playing before switching
            const wasPlaying = this.player.isPlaying;

            // CRITICAL: Pause current video FIRST and wait for cleanup
            // This prevents audio/video mismatch during rapid switching
            // if (this.player.isPlaying || this.player.videoTrack || this.player.audioTrack) {
            //     this.player.pause(false);
            //     // Small delay to ensure audio context and iterators are properly cleaned up
            //     await new Promise(resolve => setTimeout(resolve, 50));
            // }

            // Cleanup previous item's resources if it was local
            if (this.activeIndex !== -1 && this.activeIndex !== index) {
                const prevItem = this.items[this.activeIndex];
                if (prevItem && prevItem.isLocal && prevItem.url) {
                    Logger.log(`Releasing memory for: ${prevItem.title}`);
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

            // INSTANT FEEDBACK: Update UI immediately
            this._updateUI();
            this._updatePlayerNavigationState();

            // Handle Recording State (Stop if active)
            RecordMenu.handleItemChange(this);

            // Handle Live Webcam Restore
            if (video.isWebcam) {
                Logger.log('[Playlist] Selecting Live Webcam Item');
                if (ScreenRecorderMenu.stream) {
                    Logger.log('[Playlist] Restoring live webcam stream');
                    await this.player.loadWebcamStream(ScreenRecorderMenu.stream);
                    this.activeIndex = index;
                    this._updateUI();
                    this._isSelectingItem = false;
                    return;
                } else {
                    Logger.warn('[Playlist] Webcam item selected but no stream found in ScreenRecorderMenu');
                }
            }

            // Handle streams (HLS/Live) - load directly without MediaMetadata processing
            if (video.isLive || video.isStream || (video.url && video.url.includes('.m3u8'))) {
                video.isStream = true; // Mark for metadata prefetch skip
                // For streams, use autoplay directly - user clicked to play
                await this.player.load(video.url, autoplay, video.id, null);

                // Update item metadata after stream loads
                this._updateStreamItemMetadata(video, index);

                this._saveState();
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
                            Logger.log(`[Playlist] Playing from cache: ${video.title}`);
                            video.blob_url = URL.createObjectURL(cachedBlob);
                            // Mark as having file so we don't try to download again
                            video.file = cachedBlob;
                        } else {
                            Logger.log(`[Playlist] Playing directly from URL (background caching): ${video.title}`);
                            // Direct playback
                            video.blob_url = video.url;

                            // Trigger background cache
                            MediaMetadata.cacheInBackground(video, () => {
                                Logger.log(`[Playlist] Background cache complete for: ${video.title}`);
                                this._saveState();
                            });
                        }
                    } else {
                        // Local files or legacy behavior
                        if (this.player && typeof this.player._setLoading === 'function') {
                            this.player._setLoading(true);
                        } else if (this.player.ui && this.player.ui.loader) {
                            this.player.ui.loader.classList.add('visible');
                        }
                        Logger.log(`Loading file from storage: ${video.title}`);
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
                    Logger.error('Error loading file from storage:', e);
                    if (this.player && typeof this.player._setLoading === 'function') {
                        this.player._setLoading(false);
                    } else if (this.player.ui && this.player.ui.loader) {
                        this.player.ui.loader.classList.remove('visible');
                    }

                    // Auto-remove and skip to next
                    Logger.warn(`File not found: ${video.title}. Removing and skipping.`);

                    this.items.splice(index, 1);
                    this._saveState();
                    this.render();

                    // Since we removed the item at 'index', the next item is now at 'index'
                    if (index < this.items.length) {
                        // Play the next available item
                        this.selectItem(index, autoplay);
                    } else if (this.items.length > 0 && this.player.loopMode === 'playlist') {
                        // Loop back to start if needed
                        this.selectItem(0, autoplay);
                    } else {
                        // End of playlist
                        this._stopPlayback();
                    }
                    return;
                }
            }

            // Final safety check: Ensure we have a valid URL before loading
            if (!video.blob_url) {
                Logger.error('Video URL is null, cannot load:', video.title);
                return;
            }

            // Load video into player (always autoplay if autoplay param is true)
            const shouldAutoplay = autoplay;

            // Set up callback to save subtitles when user uploads them
            this.player.onSubtitleChange = (subtitleTracks) => {
                video.subtitleTracks = subtitleTracks.map(track => ({
                    id: track.id,
                    name: track.name,
                    cues: [...track.cues]
                }));
                this._saveState();
                Logger.log(`Saved ${subtitleTracks.length} subtitle track(s) for: ${video.title}`);
            };

            // Load video with saved subtitles (if any) - pass isAudio for audio files
            await this.player.load(video.blob_url, shouldAutoplay, video.id, video.subtitleTracks || null, { isAudio: video.isAudio });

            // Update item metadata (duration and thumbnail) after video loads
            this._updateLocalItemMetadata(video, index);

            this._saveState();

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
     * Render the playlist using Lazy Drawers (Nested Infinite Scroll)
     */
    render() {
        const sidebar = this.container.closest('.playlist-section');

        if (this.isLoading) {
            if (sidebar) sidebar.classList.add('hidden');
            return;
        } else {
            if (sidebar) sidebar.classList.remove('hidden');
        }

        if (this.items.length === 0) {
            this.container.innerHTML = '';
            const template = document.getElementById('playlist-empty-template');
            const clone = template.content.cloneNode(true);
            this.container.appendChild(clone);
            return;
        }

        // 1. Build Tree
        const tree = this._buildTree(this.items);

        // 2. Setup Root Container
        this.container.innerHTML = '';
        this.container.scrollTop = 0;
        this.container.style.overflowY = 'auto';
        this.container.style.overflowX = 'hidden';

        // 3. Render Root Level (Lazy)
        if (this.searchQuery) {
            this._renderSearchResults(this.searchQuery);
        } else {
            this._setupInfiniteScroll(this.container, tree);
        }

        this._updateUI();
    }

    _renderSearchResults(query) {
        // Filter items and include their original index for proper selection
        const filtered = this.items
            .map((item, index) => ({ ...item, originalIndex: index }))
            .filter(item => item.title.toLowerCase().includes(query));

        if (filtered.length === 0) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'playlist-placeholder';
            emptyDiv.textContent = 'No matches found';
            this.container.appendChild(emptyDiv);
            return;
        }

        // Treat as a flat list node
        const resultsNode = { allContent: filtered.map(item => ({ type: 'item', data: item })) };
        this._setupInfiniteScroll(this.container, resultsNode);
    }

    /**
     * Setup Infinite Scroll for a container (Root or Folder)
     * @param {HTMLElement} container 
     * @param {Object} node (Must have .allContent prepared)
     */
    _setupInfiniteScroll(container, node) {
        container.dataset.renderedCount = '0';
        // Cleanup old listener if any? (DOM replacement handles it)

        // Scroll Listener
        container.addEventListener('scroll', () => {
            const scrollTop = container.scrollTop;
            const scrollHeight = container.scrollHeight;
            const clientHeight = container.clientHeight;

            if (scrollTop + clientHeight >= scrollHeight - 100) { // Threshold
                this._renderBatch(container, node);
            }
        }, { passive: true });

        // Initial Render
        this._renderBatch(container, node);
    }

    /**
     * Render next batch of items into container
     */
    _renderBatch(container, node) {
        if (!node.allContent) return;

        const BATCH_SIZE = 50;
        const currentCount = parseInt(container.dataset.renderedCount || '0');
        const total = node.allContent.length;

        if (currentCount >= total) return;

        const nextBatch = node.allContent.slice(currentCount, currentCount + BATCH_SIZE);

        const fragment = document.createDocumentFragment();
        nextBatch.forEach(entry => {
            if (entry.type === 'folder') {
                fragment.appendChild(this._createFolderElement(entry.data));
            } else {
                fragment.appendChild(this._createPlaylistItemElement(entry.data));
            }
        });

        container.appendChild(fragment);
        container.dataset.renderedCount = (currentCount + nextBatch.length).toString();
    }

    /**
     * Build hierarchical tree from items and prepare allContent for infinite scroll
     * @param {Array} items 
     */
    _buildTree(items) {
        const root = { name: 'root', children: {}, items: [] };

        items.forEach((item, index) => {
            const path = item.path || item.title || 'Unknown';
            const parts = path.split('/');

            if (parts.length === 1) {
                root.items.push({ ...item, originalIndex: index });
                return;
            }

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
            current.items.push({ ...item, originalIndex: index });
        });

        // Tag M3U
        this._tagM3UFolders(root);

        // Finalize: Prepare 'allContent' array for every node
        const finalizeNode = (node) => {
            const childrenFolders = Object.values(node.children)
                .sort((a, b) => a.name.localeCompare(b.name));

            // Recurse first
            childrenFolders.forEach(finalizeNode);

            const folderEntries = childrenFolders.map(f => ({ type: 'folder', data: f }));
            const itemEntries = node.items.map(i => ({ type: 'item', data: i }));

            node.allContent = [...folderEntries, ...itemEntries];
        };

        finalizeNode(root);
        return root;
    }

    /**
     * Recursively identify folders that belong to an M3U playlist
     * @param {Object} node 
     * @returns {string|null} m3uSource if consistent, null otherwise
     */
    _tagM3UFolders(node) {
        let commonSource = undefined; // undefined means not set yet

        // Check Items
        for (const item of node.items) {
            if (!item.m3uSource) {
                commonSource = null;
                break;
            }
            if (commonSource === undefined) {
                commonSource = item.m3uSource;
            } else if (commonSource !== item.m3uSource) {
                commonSource = null;
                break;
            }
        }

        // Check Children Folders
        if (commonSource !== null) {
            for (const child of Object.values(node.children)) {
                const childSource = this._tagM3UFolders(child);
                if (childSource === null) {
                    commonSource = null;
                } else {
                    if (commonSource === undefined) {
                        commonSource = childSource;
                    } else if (commonSource !== childSource) {
                        commonSource = null;
                    }
                }
            }
        } else {
            // Even if parent is mixed, we must process children
            for (const child of Object.values(node.children)) {
                this._tagM3UFolders(child);
            }
        }

        // Tag the node
        if (commonSource && commonSource !== undefined) {
            node.m3uSource = commonSource;
        }

        return commonSource === undefined ? null : commonSource;
    }

    /**
     * Simplified Folder Element for Virtual List
     * No recursive children rendering needed
     */
    /**
     * Create Folder Element (Lazy Drawer)
     */
    _createFolderElement(folderData) {
        const template = document.getElementById('playlist-folder-header-template');
        // Handle template missing case if needed
        const clone = template.content.cloneNode(true);
        const header = clone.querySelector('.playlist-folder-header');

        // Setup Header
        const toggle = header.querySelector('.playlist-toggle');
        const folderName = header.querySelector('.folder-name');
        const removeBtn = header.querySelector('.folder-remove-btn');

        // M3U Sync
        if (folderData.m3uSource) {
            const syncBtn = document.createElement('button');
            syncBtn.className = 'playlist-action-btn folder-sync-btn';
            syncBtn.title = 'Sync M3U Playlist';
            syncBtn.innerHTML = '<svg width="14" height="14" fill="currentColor"><use href="assets/icons/sprite.svg#icon-loop"></use></svg>';
            syncBtn.onclick = (e) => {
                e.stopPropagation();
                this._syncM3UPlaylist(folderData.path, folderData.m3uSource);
            };
            // Insert before remove btn
            header.insertBefore(syncBtn, removeBtn);

            // Validate Streams Button
            const validateBtn = document.createElement('button');
            validateBtn.className = 'playlist-action-btn folder-validate-btn';
            validateBtn.title = 'Validate Streams';
            validateBtn.innerHTML = '<svg width="14" height="14" fill="currentColor"><use href="assets/icons/sprite.svg#icon-search"></use></svg>';
            validateBtn.onclick = (e) => {
                e.stopPropagation();
                this._validateStreams(folderData.path, folderData.m3uSource);
            };
            header.insertBefore(validateBtn, removeBtn);
            removeBtn.style.marginLeft = '5px';
        }

        // Expanded State
        const isExpanded = this.expandedFolders.has(folderData.path);
        if (isExpanded) {
            toggle.classList.add('expanded');
        }

        // Folder Title Layout (Name + Count)
        const count = folderData.totalCount !== undefined ? folderData.totalCount : (folderData.allContent ? folderData.allContent.length : 0);

        // Clear existing content
        folderName.innerHTML = '';

        // 1. Name Span (Flexible, Truncates)
        const nameSpan = document.createElement('span');
        nameSpan.textContent = folderData.name;
        nameSpan.style.overflow = 'hidden';
        nameSpan.style.textOverflow = 'ellipsis';
        nameSpan.style.whiteSpace = 'nowrap';
        // nameSpan.style.flex = '1'; handled by parent flex? No, need to set here if parent is flex.
        // But folderName is the container now? No, folderName IS the element from template.
        // We should treat folderName as the container.
        folderName.style.display = 'flex';
        folderName.style.flex = '1';
        folderName.style.minWidth = '0';
        folderName.style.alignItems = 'center';
        folderName.appendChild(nameSpan);

        // 2. Count Span (Fixed)
        if (count > 0) {
            const countSpan = document.createElement('span');
            countSpan.textContent = `(${count})`;
            countSpan.style.opacity = '0.7';
            countSpan.style.fontSize = '0.9em';
            countSpan.style.marginLeft = '6px';
            countSpan.style.whiteSpace = 'nowrap';
            countSpan.style.flexShrink = '0'; // Don't shrink
            folderName.appendChild(countSpan);
        }

        const info = header.querySelector('.playlist-folder-info');
        info.style.flex = '1';
        info.style.display = 'flex';
        info.style.alignItems = 'center';
        info.style.minWidth = '0';
        info.style.gap = '8px';

        removeBtn.setAttribute('aria-label', `Remove folder ${folderData.name}`);

        // Create Children Drawer
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'playlist-children custom-scroll';
        if (!isExpanded) {
            childrenContainer.classList.add('hidden');
        }

        // Wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'playlist-folder';
        wrapper.dataset.path = folderData.path; // For lookup
        wrapper.appendChild(header);
        wrapper.appendChild(childrenContainer);

        // Toggle Logic
        const toggleDrawer = () => {
            const hidden = childrenContainer.classList.contains('hidden');
            if (hidden) {
                childrenContainer.classList.remove('hidden');
                toggle.classList.add('expanded');
                this.expandedFolders.add(folderData.path);

                // Trigger Lazy Load
                if (!childrenContainer.dataset.renderedCount) {
                    this._setupInfiniteScroll(childrenContainer, folderData);
                }
            } else {
                childrenContainer.classList.add('hidden');
                toggle.classList.remove('expanded');
                this.expandedFolders.delete(folderData.path);
            }
        };

        header.onclick = (e) => {
            e.stopPropagation();
            toggleDrawer();
        };

        info.onclick = (e) => {
            e.stopPropagation();
            toggleDrawer(); // Override template default
        };

        removeBtn.onclick = (e) => {
            e.stopPropagation();
            // Direct remove without confirmation as requested
            this.removeFolder(folderData.path);
        };

        // Initialize children if already expanded
        if (isExpanded) {
            setTimeout(() => {
                if (!childrenContainer.dataset.renderedCount && childrenContainer.isConnected) {
                    this._setupInfiniteScroll(childrenContainer, folderData);
                }
            }, 0);
        }

        return wrapper;
    }

    /**
     * Proxy to toggle folder via DOM lookup
     * Maintains compatibility with external calls
     */
    _toggleFolder(path) {
        // Find wrapper
        const wrappers = this.container.querySelectorAll('.playlist-folder');
        for (const wrapper of wrappers) {
            if (wrapper.dataset.path === path) {
                // Click the header to trigger toggleDrawer
                const header = wrapper.querySelector('.playlist-folder-header');
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

    _removeFolder(folderData) {
        // Find items that start with folder path
        const prefix = folderData.path + '/';
        // And exact path matches? Folders are virtual.
        // Actually filtering strategy:
        // Remove all items where item.path startsWith prefix OR item.path == folderData.path?
        // Items inside: `Playlist/Group/Item`.
        // Folder: `Playlist/Group`.
        // Check if item.path includes the folder segments.

        if (confirm(`Delete folder "${folderData.name}" and all contents?`)) {
            // Deletion logic
            // We need to implement _deleteItemsByPathPrefix
            // For now simple approach:
            const countBefore = this.items.length;
            this.items = this.items.filter(item => {
                // Check if item belongs to folder. 
                // Item path: "Root/Folder/Item"
                // Folder path: "Root/Folder"
                // So item.path starts with folder.path + '/' ?
                // Wait, path separator logic.
                return !item.path.startsWith(folderData.path + '/');
            });

            if (this.items.length < countBefore) {
                this._saveState();
                this.render();
            }
        }
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

        // Add Sync Button if M3U Source
        if (folder.m3uSource) {
            const syncBtn = document.createElement('button');
            syncBtn.className = 'playlist-action-btn folder-sync-btn';
            syncBtn.title = 'Sync Playlist';
            syncBtn.ariaLabel = 'Sync Playlist from Source';
            // Use icon-loop as closest match to sync/refresh
            syncBtn.innerHTML = `
                <svg width="16" height="16" fill="currentColor">
                    <use href="assets/icons/sprite.svg#icon-loop"></use>
                </svg>
            `;
            syncBtn.onclick = (e) => {
                e.stopPropagation();
                this._syncM3UPlaylist(folder.name, folder.m3uSource);
            };
            // Insert before remove button
            removeBtn.parentNode.insertBefore(syncBtn, removeBtn);

            // Add margin to remove button for spacing
            removeBtn.style.marginLeft = '5px';
        }

        if (isExpanded) {
            toggle.classList.add('expanded');
        }

        folderName.innerHTML = folderData.totalCount > 0 ? `${folderData.name} <span style="opacity:0.7; font-size:0.9em">(${folderData.totalCount})</span>` : folderData.name;

        // Add ellipsis style
        folderName.style.whiteSpace = 'nowrap';
        folderName.style.overflow = 'hidden';
        folderName.style.textOverflow = 'ellipsis';
        folderName.style.flex = '1'; /* Take remaining width */
        folderName.style.minWidth = '0';
        folderName.style.display = 'block';

        removeBtn.setAttribute('aria-label', `Remove folder ${folderData.name}`);

        // Click to Toggle
        const info = header.querySelector('.playlist-folder-info');

        // Fix Flexbox for Ellipsis
        info.style.flex = '1';
        info.style.display = 'flex';
        info.style.alignItems = 'center';
        info.style.minWidth = '0'; // Crucial for truncation
        info.style.gap = '8px';

        info.onclick = (e) => {
            e.stopPropagation();
            this._toggleFolder(folderData.path);
        };

        // Wrap in div (virtual item)
        const wrapper = document.createElement('div');
        wrapper.className = 'playlist-folder';
        wrapper.appendChild(header);

        // Indentation
        // Use 30px per depth level for VERY clear hierarchy
        if (folderData.depth > 0) {
            header.style.paddingLeft = `${(folderData.depth * 30) + 10}px`;
        }

        return wrapper;
    }

    // Methods _attachFolderEvents and _renderLazyFolderContent removed (superseded by Virtual Scrolling)

    /**
     * Create playlist item element with events
     * @param {Object} item
     * @returns {HTMLElement}
     * @private
     */
    _createPlaylistItemElement(item) {
        const fragment = this._createItemHTML(item, item.originalIndex);
        const itemEl = fragment.querySelector('.playlist-item');

        // Removed manual indentation logic (handled by CSS .playlist-children padding)

        // Force Ellipsis on Title
        const titleEl = itemEl.querySelector('.playlist-title');
        if (titleEl) {
            titleEl.style.whiteSpace = 'nowrap';
            titleEl.style.overflow = 'hidden';
            titleEl.style.textOverflow = 'ellipsis';
            titleEl.style.display = 'block';
            titleEl.style.maxWidth = '100%';
        }

        // Ensure flex container handles min-width for truncation
        const infoEl = itemEl.querySelector('.playlist-info');
        if (infoEl) {
            infoEl.style.minWidth = '0'; // HTML5 Flexbox hack for truncation
        }

        this._attachItemEvents(itemEl);
        return itemEl;
    }

    /**
     * Attach event listeners to playlist item
     * @param {HTMLElement} itemEl
     * @private
     */
    _attachItemEvents(itemEl) {
        // Helper to get current index by ID (handles stale cached indices in folders)
        const getCurrentIndex = () => {
            const id = itemEl.dataset.id;
            if (id) {
                const index = this.items.findIndex(i => i.id === id);
                if (index !== -1) return index;
            }
            // Fallback to data-index if ID lookup fails
            return parseInt(itemEl.dataset.index);
        };

        // Click to play
        itemEl.addEventListener('click', (e) => {
            if (e.target.closest('.playlist-remove-btn') || e.target.closest('.playlist-download-btn')) return;
            this.selectItem(getCurrentIndex());
        });

        // Download button
        const downloadBtn = itemEl.querySelector('.playlist-download-btn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._downloadItem(getCurrentIndex());
            });
        }

        // Remove button
        const removeBtn = itemEl.querySelector('.playlist-remove-btn');
        if (removeBtn) {
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeItem(getCurrentIndex());
            });
        }

        // Settings button
        const settingsBtn = itemEl.querySelector('.playlist-settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log('[Playlist] Settings button clicked', { index: getCurrentIndex(), btn: settingsBtn });
                this._toggleSettingsMenu(getCurrentIndex(), settingsBtn);
            });
        }
    }

    /**
     * Update active state in UI
     * @private
     */
    _updateUI() {
        // Clear previous active
        const prevActive = this.container.querySelector('.playlist-item.active');
        if (prevActive) prevActive.classList.remove('active');

        if (this.activeIndex === -1) return;

        // Try to find and highlight the active element
        let activeEl = this.container.querySelector(`.playlist-item[data-index="${this.activeIndex}"]`);

        if (activeEl) {
            activeEl.classList.add('active');
        } else {
            // Element not in DOM - likely in collapsed folder or not yet virtualized
            // Use scrollToPlaying() to expand parents and render the item
            this.scrollToPlaying().then(() => {
                // Re-query after scroll/expansion and highlight
                activeEl = this.container.querySelector(`.playlist-item[data-index="${this.activeIndex}"]`);
                if (activeEl) {
                    activeEl.classList.add('active');
                }
            });
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

                Logger.log(`Getting source for download: ${item.title}`);

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

            Logger.log(`Downloading: ${filename}`);

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
            Logger.error('Download failed:', error);
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
        itemEl.dataset.id = item.id; // Store ID for reliable lookup after deletions
        itemEl.setAttribute('aria-label', `Play ${item.title || 'Unknown Video'}`);

        // Status classes
        if (item.needsReload) itemEl.classList.add('needs-reload');
        if (item.error) itemEl.classList.add('error');
        if (item.isBroken) itemEl.classList.add('playlist-item--broken');

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
            Logger.warn('URL Upload button not found');
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

            // Check if it's potentially an M3U8 file (could be HLS or IPTV playlist)
            const hasM3u8Extension = urlLower.includes('.m3u8');
            const looksLikeStream = urlLower.includes('/hls/') || urlLower.includes('/live/');

            // For .m3u8 URLs, we need to inspect content to differentiate IPTV playlists from HLS streams
            // IPTV playlists contain #EXTINF channel entries; HLS manifests contain #EXT-X-* tags
            if (hasM3u8Extension && !looksLikeStream) {
                try {
                    Logger.log('[Playlist] Fetching .m3u8 to determine if IPTV or HLS:', url);
                    const response = await fetch(url);
                    const content = await response.text();

                    // Check for IPTV playlist indicators (#EXTINF with channel info)
                    // vs HLS manifest indicators (#EXT-X-STREAM-INF, #EXT-X-MEDIA-SEQUENCE, .ts segments)
                    const isIPTVPlaylist = content.includes('#EXTINF') &&
                        (content.includes('group-title=') || content.includes('tvg-logo=') || content.includes('tvg-id=')) &&
                        !content.includes('#EXT-X-STREAM-INF') &&
                        !content.includes('#EXT-X-MEDIA-SEQUENCE') &&
                        !content.includes('#EXT-X-TARGETDURATION');

                    if (isIPTVPlaylist) {
                        Logger.log('[Playlist] Detected IPTV playlist in .m3u8 format, parsing as M3U');
                        await this._handleM3UPlaylist(url);
                        return;
                    }
                    Logger.log('[Playlist] Detected HLS stream manifest');
                } catch (fetchError) {
                    Logger.warn('[Playlist] Could not fetch .m3u8 for inspection, treating as HLS stream:', fetchError);
                }
            }

            // Check if it's an HLS stream (m3u8 or /hls/ or /live/ paths)
            const isHLSStream = hasM3u8Extension || looksLikeStream;

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

                // Always select and play the new stream item
                this.selectItem(this.items.length - 1);

                return;
            }

            // Check if it's an audio file
            const audioExtensions = ['.mp3', '.flac', '.aac', '.ogg', '.wav', '.m4a', '.opus', '.wma'];
            const isAudioFile = audioExtensions.some(ext => urlLower.endsWith(ext));

            if (isAudioFile) {
                const urlPath = new URL(url).pathname;
                let filename = urlPath.split('/').pop() || 'audio';
                filename = filename.split('?')[0];

                // Remove extension for display
                const displayTitle = filename.replace(/\.[^/.]+$/, '') || 'Audio Track';

                const newItem = {
                    title: displayTitle,
                    url: url,
                    blob_url: url,
                    duration: 'Loading...',
                    thumbnail: '',
                    isLocal: false,
                    isAudio: true,
                    file: null,
                    fileType: this._getAudioMimeType(urlLower),
                    mimeType: this._getAudioMimeType(urlLower),
                    id: generateId()
                };

                this.addItem(newItem);

                // Always select and play the new audio item
                this.selectItem(this.items.length - 1);

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

            // Always select and play the new video item
            this.selectItem(this.items.length - 1);

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
    async _handleM3UPlaylist(url, isSync = false) {
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
                    m3uSource: url, // Store source for sync
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

            // If syncing, remove OLD items from this source first
            if (isSync) {
                // We do this inside to ensure atomic-ish replacement
                // but actually the caller should handle removal or we do it here.
                // Let's do it here.
                this.items = this.items.filter(item => item.m3uSource !== url);
                Logger.log(`[M3U] Removed old items for sync: ${url}`);
            }

            // Add all items at once
            newItems.forEach(item => {
                if (!item.id) item.id = generateId();
            });
            this.items = [...this.items, ...newItems];
            this._saveState();
            this.render();
            this._updatePlayerNavigationState();

            // Show success message
            this._showToast(`${isSync ? 'Synced' : 'Added'} ${channels.length} channels from ${playlistName}`);

            Logger.log(`[M3U] Imported ${channels.length} channels from: ${url}`);

        } catch (error) {
            Logger.error('[M3U] Failed to import playlist:', error);
            if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
                throw new Error('CORS Error: Cannot access this M3U playlist. The server must allow cross-origin requests.');
            }
            throw error;
        }
    }

    /**
     * Sync/Re-update M3U Playlist
     * @param {string} name - Playlist/Folder name
     * @param {string} url - Source URL
     */
    async _syncM3UPlaylist(name, url) {
        if (!url) return;
        this._showToast(`Syncing ${name}...`);
        try {
            await this._handleM3UPlaylist(url, true);
        } catch (e) {
            this._showToast(`Sync failed: ${e.message}`, 3000, true);
        }
    }

    /**
     * Get MIME type for audio file extension
     * @param {string} url - URL in lowercase
     * @returns {string} MIME type
     * @private
     */
    _getAudioMimeType(url) {
        const mimeTypes = {
            '.mp3': 'audio/mpeg',
            '.flac': 'audio/flac',
            '.aac': 'audio/aac',
            '.ogg': 'audio/ogg',
            '.wav': 'audio/wav',
            '.m4a': 'audio/mp4',
            '.opus': 'audio/opus',
            '.wma': 'audio/x-ms-wma'
        };

        for (const [ext, mime] of Object.entries(mimeTypes)) {
            if (url.endsWith(ext)) return mime;
        }
        return 'audio/mpeg'; // Default
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
        console.log('[Playlist] Creating settings menu for index:', index);
        const template = document.getElementById('playlist-settings-menu-template');
        if (!template) {
            console.error('[Playlist] Template "playlist-settings-menu-template" not found!');
            return;
        }

        const clone = template.content.cloneNode(true);
        const menu = clone.querySelector('.playlist-context-menu');
        menu.dataset.index = index;

        // Conditional Logic
        const item = this.items[index];
        if (!item) {
            console.error('[Playlist] Item not found for index:', index);
            return;
        }
        // Treat streams, IPTV, and live content as restricted (limited menu options)
        const isRestricted = item.isStream || item.isLive || (item.url && (item.url.includes('.m3u8') || item.url.includes('/live/') || item.url.includes('/hls/')));

        menu.querySelectorAll('.playlist-menu-item').forEach(menuItem => {
            const action = menuItem.dataset.action;

            if (isRestricted) {
                // Live Stream: Show ONLY Record and Info
                if (action === 'info' || action === 'record') {
                    menuItem.style.display = 'flex'; // Ensure it's visible

                    // Update Record Item UI based on state
                    if (action === 'record') {
                        if (RecordMenu.isRecording) {
                            menuItem.querySelector('.menu-label').textContent = 'Stop Recording';
                            menuItem.querySelector('.menu-icon').textContent = '⏹️';
                            menuItem.classList.add('text-red-500');
                        } else {
                            menuItem.querySelector('.menu-label').textContent = 'Record Stream...';
                            menuItem.querySelector('.menu-icon').textContent = '🔴';
                            menuItem.classList.remove('text-red-500');
                        }
                    }
                } else {
                    menuItem.style.display = 'none';
                }
            } else {
                // Local File or Remote VOD: Show ALL except Record
                if (action === 'record') {
                    menuItem.style.display = 'none';
                } else {
                    menuItem.style.display = 'flex'; // Ensure it's visible
                }
            }
        });

        // Hide dividers for Live/Streams since we only have 2 items
        if (isRestricted) {
            menu.querySelectorAll('.menu-divider').forEach(divider => {
                divider.style.display = 'none';
            });
        } else {
            // Ensure dividers are visible for VOD
            menu.querySelectorAll('.menu-divider').forEach(divider => {
                divider.style.display = 'block';
            });
        }

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
        console.log('[Playlist] Menu appended to body. document.body.contains(menu):', document.body.contains(menu), 'Z-Index:', window.getComputedStyle(menu).zIndex);

        // Position the menu
        this._positionSettingsMenu(menu, buttonEl);

        // Show with animation
        // Force reflow
        const _ = menu.offsetHeight;

        requestAnimationFrame(() => {
            menu.style.opacity = '1';
            menu.style.zIndex = '100000'; // Insanely high z-index
            menu.classList.add('visible');
            console.log('[Playlist] Menu forced visible. Computed opacity:', window.getComputedStyle(menu).opacity);
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
        console.log(`[Playlist] Positioned menu at top: ${top}px, left: ${left}px (Rect:`, rect, 'MenuRect:', menuRect, 'VP:', viewportHeight, ')');
    }

    /**
     * Close all open context menus
     * @private
     */
    _closeAllMenus() {
        const menus = document.querySelectorAll('.playlist-context-menu');
        if (menus.length > 0) {
            console.trace('[Playlist] _closeAllMenus called. Closing ' + menus.length + ' menus.');
        }
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

    /**
     * Mark a playlist item as broken (stream failed to load)
     * @param {string} itemId - ID of the item to mark as broken
     * @param {string} [error] - Optional error message
     */
    markItemBroken(itemId, error) {
        const item = this.items.find(i => i.id === itemId);
        if (!item || item.isBroken) return;

        item.isBroken = true;
        item.errorMessage = error || 'Stream unavailable';
        Logger.log(`[Playlist] Marked as broken: ${item.title}`);

        // Update UI for this item
        const index = this.items.indexOf(item);
        const itemEl = this.container.querySelector(`.playlist-item[data-index="${index}"]`);
        if (itemEl) {
            itemEl.classList.add('playlist-item--broken');
        }

        this._saveState();
    }

    /**
     * Validate streams in a folder (check if they're accessible)
     * @param {string} folderPath - Path of the folder to validate
     * @param {string} m3uSource - Source URL of the M3U (for reference)
     * @private
     */
    async _validateStreams(folderPath, m3uSource) {
        // Get all stream items in this folder
        const prefix = folderPath + '/';
        const folderItems = this.items.filter(item => {
            const path = item.path || '';
            return path.startsWith(prefix) && item.isStream;
        });

        if (folderItems.length === 0) {
            this._showToast('No streams found in this folder');
            return;
        }

        // Create validation modal
        const modal = this._createValidationModal(folderItems.length);
        document.body.appendChild(modal.overlay);

        let cancelled = false;
        let checkedCount = 0;
        let brokenCount = 0;
        let workingCount = 0;

        modal.okBtn.onclick = () => {
            cancelled = true;
            this._closeValidationModal(modal);
        };

        // Validate each stream one by one
        for (const item of folderItems) {
            if (cancelled) break;

            // Update progress UI
            checkedCount++;
            modal.progressFill.style.width = `${(checkedCount / folderItems.length) * 100}%`;
            modal.status.textContent = `Checking ${checkedCount} of ${folderItems.length}...`;
            modal.currentItem.textContent = item.title;
            modal.brokenCountEl.textContent = brokenCount;
            modal.workingCountEl.textContent = workingCount;

            try {
                // Check stream accessibility with HEAD request + timeout
                const isAccessible = await this._checkStreamAccessibility(item.url);

                if (isAccessible) {
                    workingCount++;
                } else {
                    brokenCount++;
                    this.markItemBroken(item.id, 'Failed to connect');
                }
            } catch (err) {
                brokenCount++;
                this.markItemBroken(item.id, err.message);
            }

            // Small delay to avoid overwhelming the UI and network
            await new Promise(r => setTimeout(r, 50));
        }

        // Final update
        modal.progressFill.style.width = '100%';
        modal.status.textContent = cancelled ? 'Validation cancelled' : 'Validation complete!';
        modal.currentItem.textContent = '';
        modal.brokenCountEl.textContent = brokenCount;
        modal.workingCountEl.textContent = workingCount;

        // Change button to OK
        modal.okBtn.textContent = 'OK';
        modal.okBtn.onclick = () => this._closeValidationModal(modal);

        this._showToast(`Validation complete: ${brokenCount} broken, ${workingCount} working`);
    }

    /**
     * Check if a stream URL is accessible
     * @param {string} url - Stream URL to check
     * @returns {Promise<boolean>} - True if accessible
     * @private
     */
    async _checkStreamAccessibility(url) {
        const streamType = StreamDetector.detect(url);

        // For HLS streams, use HLSPlayer.validate() for accurate checking
        if (streamType === StreamDetector.TYPE_HLS) {
            try {
                return await HLSPlayer.validate(url, 5000);
            } catch {
                return false;
            }
        }

        // TYPE_FILE means URL doesn't look like a valid stream (e.g., twitch.tv/user, youtube.com/channel)
        // In the context of IPTV validation, these are broken - not playable streams
        if (streamType === StreamDetector.TYPE_FILE) {
            return false;
        }

        // For M3U playlists or other types, use fetch-based checking
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        try {
            // Try regular fetch first - this can properly detect 404, 403, etc.
            const response = await fetch(url, {
                method: 'HEAD',
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response.ok; // true for 2xx status codes
        } catch (err) {
            clearTimeout(timeoutId);

            if (err.name === 'AbortError') {
                return false; // Timeout = broken
            }

            // CORS error - try no-cors mode as fallback
            // With no-cors, we can only check if the server responds at all
            // If server returns 404/403, the request still completes (opaque response)
            // So we assume it MIGHT work if no-cors doesn't throw
            try {
                const controller2 = new AbortController();
                const timeoutId2 = setTimeout(() => controller2.abort(), 3000);

                await fetch(url, {
                    method: 'HEAD',
                    signal: controller2.signal,
                    mode: 'no-cors'
                });

                clearTimeout(timeoutId2);
                // no-cors completed without network error - assume working
                // (We can't tell if it's 404 in no-cors mode, but the stream 
                // will be marked broken when user actually tries to play it)
                return true;
            } catch {
                return false; // Network error = definitely broken
            }
        }
    }

    /**
     * Create validation progress modal
     * @param {number} totalCount - Total items to validate
     * @returns {Object} - Modal elements
     * @private
     */
    _createValidationModal(totalCount) {
        const overlay = document.createElement('div');
        overlay.className = 'mb-modal-overlay';
        overlay.innerHTML = `
            <div class="mb-modal" style="max-width: 400px;">
                <div class="mb-modal-header">
                    <h3>Validating Streams</h3>
                </div>
                <div class="validation-modal-content">
                    <div class="validation-progress-container">
                        <div class="validation-progress-bar">
                            <div class="validation-progress-fill"></div>
                        </div>
                        <div class="validation-status">Checking 0 of ${totalCount}...</div>
                        <div class="validation-counts">
                            <span>Broken: <span class="count-broken">0</span></span>
                            <span>Working: <span class="count-working">0</span></span>
                        </div>
                        <div class="validation-current-item"></div>
                    </div>
                    <div class="validation-actions">
                        <button class="validation-ok-btn">Cancel</button>
                    </div>
                </div>
            </div>
        `;

        return {
            overlay,
            progressFill: overlay.querySelector('.validation-progress-fill'),
            status: overlay.querySelector('.validation-status'),
            currentItem: overlay.querySelector('.validation-current-item'),
            brokenCountEl: overlay.querySelector('.count-broken'),
            workingCountEl: overlay.querySelector('.count-working'),
            okBtn: overlay.querySelector('.validation-ok-btn')
        };
    }

    /**
     * Close validation modal
     * @param {Object} modal - Modal elements
     * @private
     */
    _closeValidationModal(modal) {
        modal.overlay.remove();
    }
}

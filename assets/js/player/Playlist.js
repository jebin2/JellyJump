import { IndexedDBService } from './IndexedDBService.js';
import { MediaBunny } from '../core/MediaBunny.js';
import { MediaConverter } from '../core/MediaConverter.js';

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

        // Drag and Drop Events
        this._attachDragEvents();

        // Note: Auto-play next would require CorePlayer to emit a custom event
        // when video ends. For now, this is not implemented.
        // TODO: Add player.on('ended', () => this.playNext()) if CorePlayer supports events

        // Save state on pause or unload
        window.addEventListener('beforeunload', () => {
            this._saveState();
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
            addFilesBtn.addEventListener('click', () => {
                document.getElementById('mb-file-input').click();
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
            const savedItems = await this.storage.loadPlaylist();
            if (savedItems.length > 0) {
                this.items = savedItems;
                this.render();

                // Restore playback state
                const state = await this.storage.loadPlaybackState();

                if (state) {
                    let indexToRestore = -1;

                    // Try to restore by ID first (more robust)
                    if (state.activeId) {
                        indexToRestore = this.items.findIndex(item => item.id === state.activeId);
                    }

                    // Fallback to index if ID not found or not present
                    if (indexToRestore === -1 && typeof state.index === 'number') {
                        indexToRestore = state.index;
                    }

                    if (indexToRestore >= 0 && indexToRestore < this.items.length) {
                        // Don't auto-play on restore, just load
                        this.activeIndex = indexToRestore;
                        const video = this.items[this.activeIndex];

                        if (!video.needsReload) {
                            await this.player.load(video.url, false, video.id); // Autoplay false for restoration, pass ID
                            // Seek is now handled internally by player.load -> _handleInitialFrame
                            this._updateUI();
                            this._updatePlayerNavigationState();
                        }
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
        this.storage.savePlaylist(this.items);

        const activeItem = this.items[this.activeIndex];
        this.storage.savePlaybackState({
            index: this.activeIndex,
            activeId: activeItem ? activeItem.id : null,
            time: this.player.currentTime || 0
        });
    }

    /**
     * Save only playback progress (optimized for frequent calls)
     * @private
     */
    _savePlaybackProgress() {
        const activeItem = this.items[this.activeIndex];
        if (activeItem) {
            const currentTime = this.player.currentTime || 0;

            // 1. Save to IndexedDB (for playlist restoration)
            this.storage.savePlaybackState({
                index: this.activeIndex,
                activeId: activeItem.id,
                time: currentTime
            });

            // 2. Save to localStorage (for Player.js internal restoration)
            // This ensures Player.js finds the state on reload
            try {
                const state = {
                    videoIdentifier: activeItem.id,
                    timestamp: currentTime,
                    savedAt: new Date().toISOString()
                };
                localStorage.setItem(`jellyjump-state-${activeItem.id}`, JSON.stringify(state));
            } catch (e) {
                console.warn('Failed to sync state to localStorage:', e);
            }
        }
    }

    /**
     * Attach drag and drop listeners
     * @private
     */
    _attachDragEvents() {
        const section = this.container.closest('.playlist-section');

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            section.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            section.addEventListener(eventName, () => {
                section.classList.add('drag-over');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            section.addEventListener(eventName, () => {
                section.classList.remove('drag-over');
            }, false);
        });

        section.addEventListener('drop', async (e) => {
            const dt = e.dataTransfer;
            const items = dt.items;

            if (items) {
                // Use DataTransferItemList interface to access the file(s)
                const files = [];
                const queue = [];

                for (let i = 0; i < items.length; i++) {
                    const entry = items[i].webkitGetAsEntry ? items[i].webkitGetAsEntry() : null;
                    if (entry) {
                        queue.push(this._scanEntry(entry));
                    } else if (items[i].kind === 'file') {
                        files.push(items[i].getAsFile());
                    }
                }

                const scannedFiles = await Promise.all(queue);
                const flatScanned = scannedFiles.flat();

                // Combine simple files and scanned entries
                const allFiles = [...files, ...flatScanned];
                this.handleFiles(allFiles);
            } else {
                // Use DataTransfer interface to access the file(s)
                this.handleFiles(dt.files);
            }
        }, false);
    }

    /**
     * Recursively scan a FileSystemEntry
     * @param {FileSystemEntry} entry 
     * @returns {Promise<Array<File>>}
     */
    _scanEntry(entry) {
        return new Promise((resolve) => {
            if (entry.isFile) {
                entry.file(file => {
                    // Patch webkitRelativePath if missing (it usually is for dropped files)
                    if (!file.webkitRelativePath && entry.fullPath) {
                        // entry.fullPath usually starts with /
                        Object.defineProperty(file, 'webkitRelativePath', {
                            value: entry.fullPath.substring(1)
                        });
                    }
                    resolve([file]);
                });
            } else if (entry.isDirectory) {
                const dirReader = entry.createReader();
                dirReader.readEntries(async (entries) => {
                    const promises = entries.map(e => this._scanEntry(e));
                    const results = await Promise.all(promises);
                    resolve(results.flat());
                });
            } else {
                resolve([]);
            }
        });
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

            return {
                title: file.name,
                url: URL.createObjectURL(file),
                duration: 'Loading...',
                thumbnail: '',
                isLocal: true,
                needsReload: false,
                file: file,
                path: path,
                id: this._generateId() // Add unique ID for persistence
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
        for (const item of items) {
            if (item.isLocal && item.file) {
                try {
                    // Use MediaBunny to get duration
                    // We need to create a temporary input
                    // Note: MediaBunny might not be fully exposed here, 
                    // but we can try to use a hidden video element as a fallback if MediaBunny is complex to instantiate just for metadata
                    // Or use the player's method if available.

                    // Simple fallback: use a temporary video element
                    const duration = await this._getVideoDuration(item.file);
                    item.duration = this._formatDuration(duration);

                    // Update UI if this item is rendered
                    this._updateItemUI(item);
                    this._saveState();
                } catch (e) {
                    console.warn('Failed to load metadata for', item.title, e);
                    item.duration = '--:--';
                    this._updateItemUI(item);
                }
            }
        }
    }

    /**
     * Get video duration using MediaBunny
     * @param {File|string} resource - File object or URL string
     * @returns {Promise<number>}
     * @private
     */
    async _getVideoDuration(resource) {
        try {
            // Create appropriate source based on resource type
            const source = resource instanceof File
                ? new MediaBunny.BlobSource(resource)
                : new MediaBunny.UrlSource(resource);

            const input = new MediaBunny.Input({
                source,
                formats: MediaBunny.ALL_FORMATS
            });

            const duration = await input.computeDuration();
            return duration;
        } catch (error) {
            console.error('Error getting video duration:', error);
            return 0;
        }
    }

    _formatDuration(seconds) {
        if (!seconds || isNaN(seconds)) return '--:--';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    _updateItemUI(item) {
        // Find the element
        const index = this.items.indexOf(item);
        if (index === -1) return;

        const el = this.container.querySelector(`.playlist-item[data-index="${index}"]`);
        if (el) {
            const durationEl = el.querySelector('.playlist-duration');
            if (durationEl) durationEl.textContent = item.duration;
        }
    }

    /**
     * Add a video to the playlist
     * @param {Object} video - Video object { title, url, duration, thumbnail }
     */
    addItem(video) {
        if (!video.id) video.id = this._generateId();
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
        videos.forEach(v => { if (!v.id) v.id = this._generateId(); });
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
     */
    async selectItem(index) {
        if (index < 0 || index >= this.items.length) return;

        const video = this.items[index];

        if (video.needsReload) {
            alert('This local file needs to be re-uploaded.');
            return;
        }

        this.activeIndex = index;

        // Load video into player
        await this.player.load(video.url, true, video.id);

        // Update UI
        this._updateUI();
        this._saveState();
        this._updatePlayerNavigationState();

        // Auto play if not the first load (optional logic)
        this.player.play();
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
     * @param {Object} folder
     * @returns {HTMLElement}
     * @private
     */
    _createFolderElement(folder) {
        const folderEl = document.createElement('div');
        folderEl.className = 'playlist-folder';

        const isExpanded = this.expandedFolders.has(folder.path);

        // Create header
        const header = this._createFolderHeader(folder, isExpanded);

        // Create children container
        const childrenContainer = document.createElement('div');
        childrenContainer.className = `playlist-children ${isExpanded ? '' : 'hidden'}`;

        // Recursively render children
        childrenContainer.appendChild(this._renderTreeLevel(folder));

        // Attach events
        this._attachFolderEvents(header, childrenContainer, folder);

        folderEl.appendChild(header);
        folderEl.appendChild(childrenContainer);
        return folderEl;
    }

    /**
     * Create folder header HTML
     * @param {Object} folder
     * @param {boolean} isExpanded
     * @returns {HTMLElement}
     * @private
     */
    _createFolderHeader(folder, isExpanded) {
        const template = document.getElementById('playlist-folder-header-template');
        const clone = template.content.cloneNode(true);

        const header = clone.querySelector('.playlist-folder-header');
        const toggle = header.querySelector('.playlist-toggle');
        const folderName = header.querySelector('.folder-name');
        const removeBtn = header.querySelector('.folder-remove-btn');

        if (isExpanded) {
            toggle.classList.add('expanded');
        }
        folderName.textContent = folder.name;
        removeBtn.setAttribute('aria-label', `Remove folder ${folder.name}`);

        return clone.firstElementChild;
    }

    /**
     * Attach event listeners to folder elements
     * @param {HTMLElement} header
     * @param {HTMLElement} childrenContainer
     * @param {Object} folder
     * @private
     */
    _attachFolderEvents(header, childrenContainer, folder) {
        // Toggle Event
        header.querySelector('.playlist-folder-info').addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = childrenContainer.classList.contains('hidden');

            if (isHidden) {
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

            let downloadUrl = item.url;
            let blobUrl = null;

            // Check if URL is a blob URL or a remote URL
            const isBlobUrl = item.url.startsWith('blob:');

            if (!isBlobUrl) {
                // For remote URLs, fetch as blob to enable proper download
                // Show loading state
                if (downloadBtn) {
                    const loadingTemplate = document.getElementById('loading-spinner-template');
                    const loadingIcon = loadingTemplate.content.cloneNode(true);
                    downloadBtn.innerHTML = '';
                    downloadBtn.appendChild(loadingIcon);
                    downloadBtn.style.opacity = '1';
                }

                console.log(`Fetching remote file: ${item.url}`);

                const response = await fetch(item.url);
                if (!response.ok) {
                    throw new Error(`Failed to fetch file: ${response.statusText}`);
                }

                const blob = await response.blob();
                blobUrl = URL.createObjectURL(blob);
                downloadUrl = blobUrl;
                downloadBtn.style.opacity = "";
            }

            // Use reusable download anchor from HTML
            const downloadLink = document.getElementById('mb-download-link');
            downloadLink.href = downloadUrl;
            downloadLink.download = filename;
            downloadLink.click();

            // Clean up blob URL if we created one
            if (blobUrl) {
                setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
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
            thumbnail.innerHTML = `<img src="${item.thumbnail}" alt="${item.title}" loading="lazy">`;
        } else {
            const placeholderTemplate = document.getElementById('video-placeholder-template');
            const placeholderClone = placeholderTemplate.content.cloneNode(true);
            thumbnail.appendChild(placeholderClone);
        }

        // Title
        const titleText = item.title || 'Unknown Video';
        title.textContent = titleText;
        title.setAttribute('title', titleText);

        // Status text
        if (item.needsReload) {
            const statusTemplate = document.getElementById('missing-file-status-template');
            const statusSpan = statusTemplate.content.cloneNode(true);
            title.appendChild(statusSpan);
        }

        // Duration
        duration.textContent = item.duration || '--:--';

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
        const template = document.getElementById('url-upload-modal-template');
        if (!template) return;

        const modalOverlay = template.content.cloneNode(true).firstElementChild;
        document.body.appendChild(modalOverlay);

        const input = modalOverlay.querySelector('#url-input');
        const addBtn = modalOverlay.querySelector('.mb-modal-add');
        const cancelBtn = modalOverlay.querySelector('.mb-modal-cancel');
        const closeBtn = modalOverlay.querySelector('.mb-modal-close');
        const errorDiv = modalOverlay.querySelector('.mb-modal-error');
        const loadingDiv = modalOverlay.querySelector('.mb-modal-loading');

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
            loadingDiv.style.display = 'flex';
            errorDiv.style.display = 'none';

            try {
                await this._handleUrlUpload(url);
                // Close modal on success
                document.body.removeChild(modalOverlay);
            } catch (error) {
                // Show error
                input.disabled = false;
                addBtn.disabled = false;
                cancelBtn.disabled = false;
                loadingDiv.style.display = 'none';
                errorDiv.textContent = error.message;
                errorDiv.style.display = 'block';
            }
        });

        // Handle Close/Cancel
        const closeModal = () => {
            if (document.body.contains(modalOverlay)) {
                document.body.removeChild(modalOverlay);
            }
        };

        cancelBtn.addEventListener('click', closeModal);
        closeBtn.addEventListener('click', closeModal);

        // Close on click outside
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) closeModal();
        });

        // Handle Enter key
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !addBtn.disabled) {
                addBtn.click();
            }
            if (e.key === 'Escape') {
                closeModal();
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
            // Fetch the video to verify access and get blob
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Failed to fetch video: ${response.statusText}`);
            }

            const blob = await response.blob();

            // Basic validation
            if (!blob.type.startsWith('video/')) {
                throw new Error('The URL does not point to a valid video file.');
            }

            // Create MediaBunny Input to extract metadata
            // Note: For remote URLs, we might want to use UrlSource, but fetching as Blob ensures we have access
            // and avoids some CORS issues during playback if we store the blob.
            // However, storing large blobs in IndexedDB might be heavy.
            // For Phase 20, let's store the URL and re-fetch, OR store the blob if small enough.
            // The requirement says "Add to playlist with URL as identifier".

            // Let's use the Blob for metadata extraction, but store the URL if possible?
            // Actually, if we fetched it as a blob, we have it. Let's use it.
            // But wait, if we refresh, the blob is gone.
            // So we should probably treat it like a local file (store in IndexedDB) OR just store the URL.
            // If we store the URL, we need to handle CORS again on reload.
            // Let's try to store the Blob in IndexedDB (IndexedDBService handles size limits).

            const file = new File([blob], url.split('/').pop() || 'remote-video.mp4', { type: blob.type });

            // Use handleFiles to process the file and create the item object correctly
            this.handleFiles([file]);

        } catch (error) {
            if (error.message.includes('Failed to fetch')) {
                throw new Error('CORS Error: Cannot access this URL. The server must allow cross-origin requests.');
            }
            throw error;
        }
    }

    /**
     * Generate a unique ID
     * @private
     * @returns {string}
     */
    _generateId() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return 'id-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
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

        // Disable "Merge with Next" if last item
        if (index >= this.items.length - 1) {
            const mergeBtn = menu.querySelector('[data-action="merge"]');
            if (mergeBtn) {
                mergeBtn.classList.add('disabled');
                mergeBtn.setAttribute('title', 'Cannot merge: Last item in playlist');
            }
        } else {
            // Show next item name in tooltip
            const nextItem = this.items[index + 1];
            const mergeBtn = menu.querySelector('[data-action="merge"]');
            if (mergeBtn) {
                mergeBtn.setAttribute('title', `Merge with "${nextItem.title}"`);
            }
        }

        // Attach Event Listeners
        menu.querySelectorAll('.playlist-menu-item').forEach(menuItem => {
            menuItem.addEventListener('click', (e) => {
                e.stopPropagation();
                if (menuItem.classList.contains('disabled')) return;

                const action = menuItem.dataset.action;
                this._handleMenuAction(action, index);
                this._closeAllMenus();
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
        const viewportWidth = window.innerWidth;

        let top = rect.bottom + 5;
        let left = rect.right - menuRect.width; // Align right edge by default

        // Check vertical overflow
        if (top + menuRect.height > viewportHeight - 10) {
            // Position above
            top = rect.top - menuRect.height - 5;
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
     * Handle menu actions
     * @param {string} action 
     * @param {number} index 
     * @private
     */
    _handleMenuAction(action, index) {
        const item = this.items[index];
        console.log(`Menu Action: ${action} on item "${item.title}" (Index: ${index})`);

        switch (action) {
            case 'convert':
                this._openConversionModal(index);
                break;
            case 'download-manage':
                this._openTrackManager(index);
                break;
            case 'trim':
            case 'resize':
            case 'info':
            case 'merge':
            case 'create-gif':
                alert(`Feature "${action}" coming in Phase 33+`);
                break;
        }
    }

    /**
     * Open the format conversion modal
     * @param {number} index 
     * @private
     */
    _openConversionModal(index) {
        const item = this.items[index];
        const template = document.getElementById('conversion-modal-template');
        console.log('Opening Conversion Modal', { index, template });
        if (!template) {
            console.error('Conversion modal template not found!');
            return;
        }

        const clone = template.content.cloneNode(true);
        const modalOverlay = clone.querySelector('.mb-modal-overlay');
        const modalContent = clone.querySelector('.mb-modal');

        // Populate Source Info
        const sourceFilename = modalContent.querySelector('.source-filename');
        if (sourceFilename) {
            sourceFilename.textContent = item.title;
            sourceFilename.title = item.title;
        }

        // Elements
        const closeBtn = modalContent.querySelector('.mb-modal-close');
        const convertBtn = modalContent.querySelector('.convert-btn');
        const downloadBtn = modalContent.querySelector('.download-btn');
        const progressSection = modalContent.querySelector('.progress-section');
        const progressBarFill = modalContent.querySelector('.progress-bar-fill');
        const progressPercentage = modalContent.querySelector('.progress-percentage');
        const successMessage = modalContent.querySelector('.success-message');
        const errorMessage = modalContent.querySelector('.error-message');
        const inputs = modalContent.querySelectorAll('input');

        // New Elements
        const qualitySlider = modalContent.querySelector('.quality-slider');
        const qualityValue = modalContent.querySelector('.quality-value');
        const estimatedReduction = modalContent.querySelector('.estimated-reduction');

        // UI Logic: Handle Quality Slider
        const updateQualityLabel = () => {
            const val = parseInt(qualitySlider.value);
            let label = "Medium (60%)";
            let reduction = "~40% smaller";

            if (val === 100) {
                label = "Original (100%)";
                reduction = "No size reduction";
            } else if (val === 80) {
                label = "High (80%)";
                reduction = "~20% smaller";
            } else if (val === 40) {
                label = "Low (40%)";
                reduction = "~60% smaller";
            }

            qualityValue.textContent = label;
            estimatedReduction.textContent = reduction;
        };

        qualitySlider.addEventListener('input', updateQualityLabel);

        // Initialize Slider
        updateQualityLabel();

        // Close Handler
        const closeModal = () => {
            if (convertBtn.disabled && !downloadBtn.classList.contains('hidden')) {
                // Converting... don't close
                return;
            }
            modalOverlay.classList.remove('visible');
            setTimeout(() => {
                if (modalOverlay.parentNode) modalOverlay.parentNode.removeChild(modalOverlay);
            }, 200);
        };

        closeBtn.addEventListener('click', closeModal);
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) closeModal();
        });

        // Convert Handler
        convertBtn.addEventListener('click', async () => {
            const format = modalContent.querySelector('input[name="format"]:checked').value;
            const addToPlaylist = modalContent.querySelector('input[name="addToPlaylist"]').checked;
            const quality = parseInt(qualitySlider.value);

            // Validation: No Op check
            if (format === 'keep' && quality === 100) {
                errorMessage.textContent = "No changes selected. Please choose a different format or reduce quality.";
                errorMessage.classList.remove('hidden');
                return;
            }

            // UI Updates
            inputs.forEach(input => input.disabled = true);
            qualitySlider.disabled = true;
            convertBtn.disabled = true;
            closeBtn.disabled = true; // Prevent closing during conversion
            progressSection.classList.remove('hidden');
            errorMessage.classList.add('hidden');
            successMessage.classList.add('hidden');
            downloadBtn.classList.add('hidden'); // Hide previous download if any

            try {
                await this._startConversion(index, format, quality, addToPlaylist, (progress) => {
                    const percent = Math.round(progress * 100) + '%';
                    progressBarFill.style.width = percent;
                    progressPercentage.textContent = percent;
                });

                // Success
                successMessage.classList.remove('hidden');
                progressSection.classList.add('hidden');

                // Enable Download
                downloadBtn.classList.remove('hidden');
                const downloadFormat = (format === 'keep') ? item.title.split('.').pop() : format;
                // Update download button title/aria-label instead of text content since it's an icon button now
                downloadBtn.title = `Download ${downloadFormat.toUpperCase()}`;
                downloadBtn.setAttribute('aria-label', `Download ${downloadFormat.toUpperCase()}`);

                // Re-enable Inputs for new conversion
                inputs.forEach(input => {
                    if (!input.parentElement.classList.contains('disabled')) {
                        input.disabled = false;
                    }
                });
                qualitySlider.disabled = false;
                convertBtn.disabled = false;

                // Allow closing
                closeBtn.disabled = false;

            } catch (error) {
                console.error('Conversion failed:', error);
                errorMessage.textContent = `Operation failed: ${error.message}`;
                errorMessage.classList.remove('hidden');
                progressSection.classList.add('hidden');

                // Re-enable inputs
                inputs.forEach(input => {
                    if (!input.parentElement.classList.contains('disabled')) {
                        input.disabled = false;
                    }
                });
                qualitySlider.disabled = false;
                convertBtn.disabled = false;
                closeBtn.disabled = false;
            }
        });

        document.body.appendChild(modalOverlay);

        // Animate In
        requestAnimationFrame(() => {
            console.log('Animating modal in');
            modalOverlay.classList.add('visible');
        });
    }

    /**
     * Start the conversion process using MediaBunny
     * @param {number} index 
     * @param {string} format 
     * @param {number} quality - 40, 60, 80, 100
     * @param {boolean} addToPlaylist 
     * @param {Function} onProgress 
     * @private
     */
    /**
     * Start the conversion process using MediaBunny
     * @param {number} index 
     * @param {string} format 
     * @param {number} quality - 40, 60, 80, 100
     * @param {boolean} addToPlaylist 
     * @param {Function} onProgress 
     * @private
     */
    async _startConversion(index, format, quality, addToPlaylist, onProgress) {
        const item = this.items[index];

        // Ensure we have the file blob
        let source;
        if (item.file) {
            source = item.file;
        } else {
            // Fetch from URL
            const response = await fetch(item.url);
            source = await response.blob();
        }

        // Determine Target Format
        let targetFormat = format;
        if (format === 'keep') {
            // Try to detect format from filename
            const ext = item.title.split('.').pop().toLowerCase();
            // Map extension to format string if needed, or use as is if supported
            // Assuming common extensions match format keys
            targetFormat = ext;

            // Fallback for 'keep' if extension is not one of the explicit writers
            if (!['mp4', 'webm', 'mov'].includes(targetFormat)) {
                console.warn(`Format ${targetFormat} not explicitly supported for writing, defaulting to MP4.`);
                targetFormat = 'mp4';
            }
        }

        try {
            const resultBlob = await MediaConverter.convert({
                source: source,
                format: targetFormat,
                quality: quality,
                onProgress: onProgress
            });

            // Handle Success
            this._handleConversionSuccess(resultBlob, item, targetFormat, addToPlaylist);
        } catch (error) {
            console.error("Conversion failed:", error);
            throw error; // Re-throw to be caught by caller
        }
    }

    /**
     * Handle successful conversion
     * @param {Blob} blob 
     * @param {Object} originalItem 
     * @param {string} format 
     * @param {boolean} addToPlaylist 
     * @private
     */
    _handleConversionSuccess(blob, originalItem, format, addToPlaylist) {
        const newFilename = originalItem.title.replace(/\.[^/.]+$/, "") + `-converted.${format}`;
        const url = URL.createObjectURL(blob);

        // Update Download Button in Modal
        const downloadBtn = document.querySelector('.conversion-modal .download-btn');
        if (downloadBtn) {
            downloadBtn.href = url;
            downloadBtn.download = newFilename;
        }

        if (addToPlaylist) {
            const newItem = {
                title: newFilename,
                url: url,
                file: new File([blob], newFilename, { type: blob.type }),
                duration: originalItem.duration, // Approx same duration
                type: 'video'
            };

            // Insert after original item
            const index = this.items.indexOf(originalItem);
            this.items.splice(index + 1, 0, newItem);

            // Re-render playlist
            this.render();
        }
    }


    /**
     * Open track manager modal
     * @param {number} index 
     * @private
     */
    async _openTrackManager(index) {
        const item = this.items[index];
        const template = document.getElementById('track-management-modal-template');
        if (!template) return;

        const clone = template.content.cloneNode(true);
        const modalOverlay = clone.querySelector('.mb-modal-overlay');
        const modal = clone.querySelector('.mb-modal');

        // Populate Source Info
        const sourceFilename = modal.querySelector('.source-filename');
        sourceFilename.textContent = `Source: ${item.title}`;

        // Close Event
        const closeBtn = modal.querySelector('.mb-modal-close');
        const close = () => {
            modalOverlay.classList.remove('visible');
            setTimeout(() => modalOverlay.remove(), 300);
        };
        closeBtn.addEventListener('click', close);
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) close();
        });

        document.body.appendChild(modalOverlay);
        requestAnimationFrame(() => modalOverlay.classList.add('visible'));

        // Fetch Tracks
        try {
            let source;
            if (item.file) {
                source = item.file;
            } else {
                const response = await fetch(item.url);
                source = await response.blob();
            }

            const tracks = await MediaConverter.getTracks(source);

            // Hide loading, show content
            modal.querySelector('.tracks-loading').classList.add('hidden');
            modal.querySelector('.tracks-content').classList.remove('hidden');

            this._renderTracks(tracks, item, modal);
        } catch (e) {
            console.error('Failed to load tracks:', e);
            modal.querySelector('.tracks-loading').classList.add('hidden');
            modal.querySelector('.mb-modal-body').insertAdjacentHTML('beforeend', `<div class="p-md text-danger">Failed to load tracks: ${e.message}</div>`);
        }
    }

    /**
     * Render tracks in the modal
     * @param {Object} tracks 
     * @param {Object} item 
     * @param {HTMLElement} modal 
     * @private
     */
    _renderTracks(tracks, item, modal) {
        const videoList = modal.querySelector('.video-track-list');
        const audioList = modal.querySelector('.audio-track-list');
        const videoCount = modal.querySelector('.video-tracks-section .track-count');
        const audioCount = modal.querySelector('.audio-tracks-section .track-count');
        const noVideoMsg = modal.querySelector('.video-tracks-section .no-tracks-message');
        const noAudioMsg = modal.querySelector('.audio-tracks-section .no-tracks-message');

        videoCount.textContent = tracks.video.length;
        audioCount.textContent = tracks.audio.length;

        if (tracks.video.length === 0) noVideoMsg.classList.remove('hidden');
        if (tracks.audio.length === 0) noAudioMsg.classList.remove('hidden');

        const cardTemplate = document.getElementById('track-card-template');

        const renderList = (list, trackList, type) => {
            list.forEach((track, i) => {
                const card = cardTemplate.content.cloneNode(true);
                const el = card.querySelector('.track-card');

                el.querySelector('.track-index').textContent = i + 1;
                el.querySelector('.meta-codec').textContent = track.codecString || track.codec || 'Unknown';
                el.querySelector('.meta-language').textContent = track.language || 'und';

                let details = '';
                if (type === 'video') {
                    details = `${track.width}x${track.height}`;
                } else {
                    details = `${track.channels}ch, ${track.sampleRate}Hz`;
                }
                el.querySelector('.meta-details').textContent = details;

                // Events
                const downloadBtn = el.querySelector('.download-track-btn');
                const addToPlaylistBtn = el.querySelector('.add-to-playlist-btn');
                const progressContainer = el.querySelector('.progress-container');

                // Determine format based on codec
                let format = 'mp4';
                if (type === 'audio') {
                    const codec = (track.codec || '').toLowerCase();
                    if (codec.includes('mp3')) {
                        format = 'mp3';
                    } else if (codec.includes('aac') || codec.includes('mp4a')) {
                        format = 'aac';
                    } else if (codec.includes('pcm') || codec === '') {
                        format = 'wav'; // Default to WAV for PCM or unknown
                    } else {
                        format = 'm4a'; // Default to M4A (AAC)
                    }
                }

                downloadBtn.addEventListener('click', () => {
                    this._extractTrack(this.items.indexOf(item), i, type, format, false, progressContainer, downloadBtn, addToPlaylistBtn);
                });

                addToPlaylistBtn.addEventListener('click', () => {
                    // Duplicate Check
                    const ext = format;
                    const newFilename = `${item.title.replace(/\.[^/.]+$/, "")}-${type}-track${i + 1}.${ext}`;

                    const exists = this.items.some(it => it.title === newFilename);
                    if (exists) {
                        alert(`Track "${newFilename}" is already in the playlist.`);
                        return;
                    }

                    this._extractTrack(this.items.indexOf(item), i, type, format, true, progressContainer, downloadBtn, addToPlaylistBtn);
                });

                trackList.appendChild(el);
            });
        };

        renderList(tracks.video, videoList, 'video');
        renderList(tracks.audio, audioList, 'audio');
    }

    /**
     * Extract track
     * @param {number} index 
     * @param {number} trackIndex 
     * @param {string} trackType 
     * @param {string} format
     * @param {boolean} addToPlaylist 
     * @param {HTMLElement} progressContainer 
     * @param {HTMLElement} downloadBtn 
     * @param {HTMLElement} addToPlaylistBtn
     * @private
     */
    async _extractTrack(index, trackIndex, trackType, format, addToPlaylist, progressContainer, downloadBtn, addToPlaylistBtn) {
        const item = this.items[index];

        // UI State
        downloadBtn.classList.add('hidden');
        addToPlaylistBtn.classList.add('hidden');
        progressContainer.classList.remove('hidden');

        try {
            let source;
            if (item.file) {
                source = item.file;
            } else {
                const response = await fetch(item.url);
                source = await response.blob();
            }

            // format is passed as argument now

            const blob = await MediaConverter.extractTrack({
                source,
                trackIndex,
                trackType,
                format,
                onProgress: (p) => {
                    // Optional: Update progress text if we had a percentage
                }
            });

            this._handleExtractionSuccess(blob, item, trackType, trackIndex, format, addToPlaylist);
        } catch (e) {
            console.error('Extraction failed:', e);
            alert(`Extraction failed: ${e.message}`);
        } finally {
            downloadBtn.classList.remove('hidden');
            addToPlaylistBtn.classList.remove('hidden');
            progressContainer.classList.add('hidden');
        }
    }

    /**
     * Handle extraction success
     * @param {Blob} blob 
     * @param {Object} originalItem 
     * @param {string} trackType 
     * @param {number} trackIndex 
     * @param {string} format
     * @param {boolean} addToPlaylist 
     * @private
     */
    _handleExtractionSuccess(blob, originalItem, trackType, trackIndex, format, addToPlaylist) {
        const ext = format;
        const newFilename = `${originalItem.title.replace(/\.[^/.]+$/, "")}-${trackType}-track${trackIndex + 1}.${ext}`;
        const url = URL.createObjectURL(blob);

        if (addToPlaylist) {
            const newItem = {
                title: newFilename,
                url: url,
                file: new File([blob], newFilename, { type: blob.type }),
                duration: originalItem.duration, // Approx
                type: trackType === 'video' ? 'video' : 'audio',
                isAudioOnly: trackType === 'audio'
            };

            // Insert after original item
            const index = this.items.indexOf(originalItem);
            this.items.splice(index + 1, 0, newItem);

            // Re-render playlist
            this.render();

            // Scroll to new item
            setTimeout(() => {
                const newEl = this.container.querySelector(`[data-index="${index + 1}"]`);
                if (newEl) newEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 100);
        } else {
            // Trigger Download
            const a = document.createElement('a');
            a.href = url;
            a.download = newFilename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    }
}


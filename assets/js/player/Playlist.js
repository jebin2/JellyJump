import { IndexedDBService } from './IndexedDBService.js';
import { MediaBunny } from '../core/MediaBunny.js';

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
        this._setupPlayerNavigation();

        // Load saved playlist
        this._loadSavedPlaylist();
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
                            await this.player.load(video.url, false); // Autoplay false for restoration
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
        this.items = [...this.items, ...videos];
        this._saveState();
        this.render();
        this._updatePlayerNavigationState();
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
                // List will be empty
                this.player.pause();
                // this.player.mediaElement.src = ''; // CorePlayer doesn't support this directly, pause is enough
                this.activeIndex = -1;
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
    clear() {
        if (confirm('Are you sure you want to clear the playlist?')) {
            this.items = [];
            this.activeIndex = -1;
            this.player.pause();
            // this.player.mediaElement.src = '';
            this.storage.clear();
            this.render();
            this._updatePlayerNavigationState();
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
        await this.player.load(video.url, true);

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
}

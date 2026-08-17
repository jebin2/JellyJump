import { Logger } from "../../shared/utils/Logger.js";
import { Toast } from "../../shared/utils/Toast.js";
import { StorageService } from "../../shared/services/StorageService.js";
import { CorePlayer } from '../../core/Player.js';
import { ConfirmDialog } from '../../shared/utils/ConfirmDialog.js';
import { Modal as DialogModal } from '../Modal.js';
import { MenuRouter } from '../menus/core/MenuRouter.js';
import { RecordMenu } from '../menus/features/RecordMenu.js';
import { ScreenRecorderMenu } from '../menus/features/ScreenRecorderMenu.js';
import { ItemToolsMenu } from "../menus/features/ItemToolsMenu.js";
import { PlaylistStorage } from './PlaylistStorage.js';
import { MediaMetadata } from '../../shared/utils/MediaMetadata.js';
import { FileDropHandler } from '../../shared/utils/FileDropHandler.js';
import { formatTime, generateId, sanitizeFilename } from '../../shared/utils/mediaUtils.js';
import { PlaylistRenderer } from './PlaylistRenderer.js';
import { PlaylistState } from './PlaylistState.js';
import { PlaylistUI } from './PlaylistUI.js';
import { PlaylistNavigation } from './PlaylistNavigation.js';
import { PlaylistProcessor } from "../../shared/services/PlaylistProcessor.js";
import { DiscoveredMedia } from '../../shared/services/DiscoveredMedia.js';

// Folder that scan results are grouped under in the playlist tree.
const DISCOVERED_FOLDER = 'Discovered';

// How many folder levels a discovered file may nest under that. Each level
// indents, so an uncapped filesystem path can push rows off the right edge.
const MAX_DISCOVERED_DEPTH = 3;

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
        
        // Modularized helpers
        this.state = new PlaylistState();
        this.renderer = new PlaylistRenderer(this);
        this.ui = new PlaylistUI(this);
        this.navigation = new PlaylistNavigation(this);
        
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
            this._saveState();
            this._revokeAllBlobUrls();
        };
        window.addEventListener('beforeunload', this._beforeUnloadHandler);

        // Load saved data, then fill in what a scan finds on disk
        this._loadSavedPlaylist().then(() => this._startMediaScan());

        // Setup player error callback
        if (this.player) {
            this.player.onStreamError = (videoId, error) => {
                this.markItemBroken(videoId, error);
            };
        }
    }

    // Compatibility getters for Renderer and external callers
    get items() { return this.state.items; }
    get activeIndex() { return this.state.activeIndex; }
    get expandedFolders() { return this.state.expandedFolders; }
    get searchQuery() { return this.state.searchQuery; }
    get isLoading() { return this.state.isLoading; }

    // Compatibility setters
    set items(val) { this.state.setItems(val); }
    set activeIndex(val) { this.state.setActiveIndex(val); }
    set searchQuery(val) { this.state.setSearchQuery(val); }
    set isLoading(val) { this.state.setIsLoading(val); }




    /**
     * Initialize keyboard and player navigation
     * @private
     */
    async _initPlayerNavigation() {
        if (!this.player) return;
        
        this.player.setNavigationCallbacks(
            () => this.playPrevious(),
            () => this.playNext()
        );

        // Auto-advance when the current item ends (no-op on the last item,
        // so playback simply stops at the end of the playlist)
        this.player.onEnded = () => this.playNext();

        this.player.setPlayCallback(() => {
            if (this.items.length > 0 && this.activeIndex === -1) {
                ConfirmDialog.alert({
                    title: 'No Video Selected',
                    message: 'Please select a video from the playlist to play.',
                    confirmText: 'OK',
                    icon: '📺'
                });
            } else if (this.items.length === 0) {
                ConfirmDialog.alert({
                    title: 'Playlist Empty',
                    message: 'Add videos to the playlist using the upload button or paste a URL.',
                    confirmText: 'OK',
                    icon: '📂'
                });
            }
        });
    }

    // Navigation convenience wrappers
    playNext() { this.navigation.playNext(); }
    playPrevious() { this.navigation.playPrevious(); }
    scrollToPlaying() { return this.navigation.scrollToPlaying(); }
    _updatePlayerNavigationState() { this.navigation.updatePlayerNavigationState(); }

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
     * Scan the user's media folders and list what turns up under a "Discovered"
     * folder in the playlist.
     *
     * These are ordinary playlist items and reuse the whole existing flow —
     * the folder tree is derived from item.path, so nesting them under
     * DISCOVERED_FOLDER is all it takes to group them. They are flagged
     * isDiscovered so PlaylistStorage leaves them out of the saved playlist:
     * a scan can turn up thousands of files, and they come back on next launch
     * anyway.
     * @private
     */
    async _startMediaScan() {
        if (!DiscoveredMedia.isSupported()) return;
        // The browser scanner needs a user gesture and a directory pick, so it
        // is started from the UI rather than on load.
        if (!window.electronAPI?.isElectron) return;

        this._discovered = new DiscoveredMedia();
        this.scanState = { scanning: true, found: 0, failed: false };

        this._discovered.subscribe((event) => {
            if (event.type === 'phase') {
                this.scanState = { ...this.scanState, phase: event.phase };
                this.render();
            }
            if (event.type === 'batch') {
                this.scanState.found = event.total;
                this.addDiscoveredItems(event.files);
            }
            if (event.type === 'error') {
                Logger.warn('[Playlist] Media scan failed:', event.error);
                this.scanState = { scanning: false, found: this.scanState.found, failed: true };
                this.render();
            }
            if (event.type === 'done') {
                this.scanState = {
                    scanning: false,
                    found: event.total,
                    failed: false,
                    cancelled: event.summary?.cancelled ?? false,
                };
                this.render();
            }
        });

        try {
            await this._discovered.scan();
        } catch (error) {
            Logger.warn('[Playlist] Media scan failed:', error);
            this.scanState = { scanning: false, found: this.scanState.found, failed: true };
            this.render();
        }
    }

    /** Folder that scan results are grouped under, for the renderer. */
    get discoveredFolderName() {
        return DISCOVERED_FOLDER;
    }

    /** Stop an in-flight scan. Whatever was already found stays listed. */
    async cancelMediaScan() {
        if (!this._discovered) return;
        await this._discovered.cancel();
        Logger.log('[Playlist] Media scan cancelled by user');
    }

    /**
     * Merge scan results into the playlist.
     * Deliberately does not go through addItems(): that selects and may
     * autoplay the first item added, which would hijack playback every time a
     * batch streams in.
     * @param {Array} files - scan records ({ path, name, size, mtime })
     */
    addDiscoveredItems(files) {
        if (!files || files.length === 0) return;

        const known = new Set(this.state.items.map(i => i.localPath).filter(Boolean));
        const newItems = [];

        for (const file of files) {
            if (known.has(file.path)) continue; // already in the playlist, curated or not
            known.add(file.path);
            newItems.push(this._buildDiscoveredItem(file));
        }

        if (newItems.length === 0) return;
        this.state.addItems(newItems);
        this._renderDiscoveredSoon();
    }

    /**
     * Coalesce redraws while a scan streams in.
     *
     * The home pass delivers many batches, and each render rebuilds the folder
     * tree over every item in the playlist — redrawing per batch makes that
     * cost grow with the list it is already building. One frame's delay is
     * imperceptible and collapses a burst of batches into a single rebuild.
     * @private
     */
    _renderDiscoveredSoon() {
        if (this._discoveredRenderQueued) return;
        this._discoveredRenderQueued = true;
        requestAnimationFrame(() => {
            this._discoveredRenderQueued = false;
            this.render();
            this._updatePlayerNavigationState();
        });
    }

    /**
     * Promote a discovered file into the saved playlist.
     *
     * Clearing isDiscovered is what makes it persist; moving it out of the
     * Discovered folder path is what stops it looking like a scan result that
     * will disappear. Both are needed — leaving the path alone would keep it
     * filed under a folder whose whole meaning is "not kept".
     * @param {string} id
     */
    keepDiscoveredItem(id) {
        const index = this.state.items.findIndex(i => i.id === id);
        if (index === -1) return;

        const item = this.state.items[index];
        if (!item.isDiscovered) return;

        delete item.isDiscovered;
        // Top level, matching how a file added through the open dialog looks.
        item.path = item.title;

        this._saveState();
        this.render();
        this._updatePlayerNavigationState();
        Toast.show(`Kept "${item.title}" in your playlist`);
        Logger.log('[Playlist] Kept discovered item:', item.title);
    }

    /**
     * Turn a scan record into a playlist item.
     * Cheap by design: no metadata probe and no thumbnail, so a scan of
     * thousands of files stays fast. Duration fills in through the normal
     * on-demand path once an item is actually opened.
     * @private
     */
    _buildDiscoveredItem(file) {
        const ext = file.ext?.replace('.', '') || '';
        const mimeType = ext === 'mkv' ? 'video/x-matroska'
            : ext === 'webm' ? 'video/webm'
            : ext === 'ogv' ? 'video/ogg'
            : 'video/mp4';

        return {
            title: file.name,
            url: '',                  // created on demand from localPath
            duration: '',             // unknown until opened; no probe here
            thumbnail: '',
            isLocal: true,
            isAudio: false,
            isDiscovered: true,       // keeps it out of the saved playlist
            needsReload: false,
            file: null,
            fileSize: file.size,
            fileType: mimeType,
            mimeType,
            path: this._discoveredPath(file.path),
            localPath: file.path,
            id: generateId()
        };
    }

    /**
     * Virtual path that places a discovered file in the folder tree, e.g.
     * /home/u/Videos/Trip/clip.mp4 -> Discovered/Videos/Trip/clip.mp4
     * PlaylistRenderer builds folders by splitting this on "/".
     * @private
     */
    _discoveredPath(absolutePath) {
        const parts = absolutePath.split('/').filter(Boolean);
        // Drop the leading home-directory segments; what matters to the user is
        // the media folder the file sits in, not where their home lives.
        const home = parts.indexOf('home');
        const meaningful = home !== -1 ? parts.slice(home + 2) : parts;

        const name = meaningful[meaningful.length - 1];
        let folders = meaningful.slice(0, -1);

        // Cap the nesting. A home scan reaches genuinely deep trees, and every
        // level costs indent width — past a handful the rows run off the edge.
        // Keeping the outermost folders preserves where the file came from,
        // which is what makes the grouping useful; the rest is on the item's
        // localPath if it is ever needed.
        if (folders.length > MAX_DISCOVERED_DEPTH) {
            folders = folders.slice(0, MAX_DISCOVERED_DEPTH);
        }

        return [DISCOVERED_FOLDER, ...folders, name].join('/');
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
     * Crash-loop breaker guard: set while an item's media is loading and
     * cleared on success. If it survives to the next launch, that load
     * killed the page and the item must not be auto-restored.
     * @private
     */
    _setLoadGuard(item) {
        try {
            localStorage.setItem('jellyjump-load-guard', JSON.stringify({ id: item.id, at: Date.now() }));
        } catch (e) { /* storage full/blocked - guard is best-effort */ }
    }

    /** @private */
    _clearLoadGuard() {
        try {
            localStorage.removeItem('jellyjump-load-guard');
        } catch (e) { /* ignore */ }
    }

    /** @private */
    _readLoadGuard() {
        try {
            return JSON.parse(localStorage.getItem('jellyjump-load-guard'));
        } catch (e) {
            return null;
        }
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
    async handleFiles(files) {
        if (!files || files.length === 0) return;

        const newItems = this.processor.processFiles(files);

        if (newItems.length === 0) {
            Toast.show('Please select valid video or audio files.', 3000, true);
            return;
        }

        // On phones, oversized videos are gated BEFORE they enter the
        // playlist: the user can convert to 1080p inside the prompt (the
        // optimized copy is what gets added) or add the original as-is.
        try {
            const { OptimizeMenu } = await import('../menus/features/OptimizeMenu.js');
            await OptimizeMenu.interceptNewItems(newItems);
        } catch (e) {
            Logger.warn('[Playlist] Optimize gate failed, adding originals:', e);
        }

        this.addItems(newItems);
        this._processMetadata(newItems);
    }

    /**
     * Handle files from Electron's native file dialog (has paths)
     * @param {Array<{path: string, name: string, size: number, lastModified: number}>} files 
     */
    async handleElectronFiles(files) {

        const videoExtensions = ['mp4', 'mkv', 'avi', 'webm', 'mov', 'm4v', 'wmv', 'flv'];
        const audioExtensions = ['mp3', 'flac', 'aac', 'ogg', 'wav', 'm4a', 'opus', 'wma'];
        const subtitleExtensions = ['vtt', 'srt']; // Add subtitle extensions
        const allExtensions = [...videoExtensions, ...audioExtensions, ...subtitleExtensions]; // Include subtitles in initial filter

        // Filter valid files first
        const validFiles = files.filter(file => {
            const ext = file.name.split('.').pop().toLowerCase();
            return allExtensions.includes(ext);
        });

        const mediaFiles = validFiles.filter(file => {
            const ext = file.name.split('.').pop().toLowerCase();
            return videoExtensions.includes(ext) || audioExtensions.includes(ext);
        });

        const subtitleFiles = validFiles.filter(file => {
            const ext = file.name.split('.').pop().toLowerCase();
            return subtitleExtensions.includes(ext);
        });

        if (mediaFiles.length === 0) {
            Toast.show('Please select valid video or audio files.', 3000, true);
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

            const item = {
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

            // Check for matching subtitle
            const getBasename = (name) => name.substring(0, name.lastIndexOf('.'));
            const mediaBasename = getBasename(file.name);

            const matchingSubtitle = subtitleFiles.find(subFile =>
                getBasename(subFile.name) === mediaBasename
            );

            if (matchingSubtitle) {
                // For Electron, we store the path to allow direct loading or conversion if needed
                item.subtitlePath = matchingSubtitle.path;
                Logger.log(`[Playlist] Auto-detected subtitle for ${file.name}: ${matchingSubtitle.name} (${matchingSubtitle.path})`);
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

    async _processMetadata(items) {
        await this.processor.processMetadata(
            items,
            (item) => this._updateItemUI(item),
            () => this._saveState()
        );
    }

    async _ensureMetadata(item) {
        await this.processor.ensureMetadata(item, () => this._saveState());
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
        this.renderer.updateItemUI(item);
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
                    video.duration = formatTime(this.player.duration);
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
                const newDuration = formatTime(this.player.duration);
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
        this.state.addItem(video);
        this._saveState();
        this.render();
        this._updatePlayerNavigationState();
    }

    /**
     * Insert a processed result into the playlist after its source item.
     * Centralizes the pattern used by menus after processing (convert, trim, encrypt, etc.)
     * @param {Object} sourceItem - The original playlist item that was processed
     * @param {Blob} blob - The result blob
     * @param {string} filename - Display name / download filename
     * @param {Object} [options]
     * @param {string} [options.type] - File MIME type override (default: blob.type || 'video/mp4')
     * @param {string} [options.mediaType] - Playlist type field ('video', 'audio', 'image/gif', etc.)
     * @param {string|null} [options.duration] - Duration string; null to skip (caller may _ensureMetadata)
     * @param {Object} [options.extra] - Additional fields merged into the item
     * @returns {{ item: Object, url: string }}
     */
    insertProcessedItem(sourceItem, blob, filename, options = {}) {
        const url = URL.createObjectURL(blob);
        const mimeType = options.type || blob.type || 'video/mp4';
        const newItem = {
            id: generateId(),
            title: filename,
            url,
            blob_url: url,
            file: new File([blob], filename, { type: mimeType }),
            duration: options.duration !== undefined ? options.duration : (sourceItem ? sourceItem.duration : null),
            type: options.mediaType || 'video',
            isLocal: true,
            isNew: true,
            path: sourceItem ? (sourceItem.path || sourceItem.title) + '/' + filename : filename,
            ...options.extra,
        };

        const index = sourceItem ? this.state.items.indexOf(sourceItem) : -1;
        if (index !== -1) {
            this.state.insertItem(index + 1, newItem);
        } else {
            this.state.addItem(newItem);
        }

        this.render();
        this._saveState();

        return { item: newItem, url };
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
            const startIndex = this.state.items.length;
            this.state.addItems(regularItems);
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
                this.state.addItem(m3u);
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
        this._saveState();
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
        
        this._saveState();
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
                confirmType: 'danger'
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

            // Cleanup previous item's resources
            if (this.activeIndex !== -1 && this.activeIndex !== index) {
                const prevItem = this.items[this.activeIndex];
                if (prevItem) {
                    // Revoke (not just null) the playback blob URL, otherwise the
                    // blob stays pinned in the browser's blob store for the page
                    // lifetime. getProcessedSourceURL recreates it on revisit.
                    if (prevItem.blob_url && prevItem.blob_url.startsWith('blob:')) {
                        URL.revokeObjectURL(prevItem.blob_url);
                    }
                    prevItem.blob_url = null;

                    if (prevItem.isLocal && prevItem.url) {
                        Logger.log(`Releasing memory for: ${prevItem.title}`);
                        URL.revokeObjectURL(prevItem.url);
                        prevItem.url = null;
                        prevItem.file = null; // Release Blob
                    }
                }
            }

            const video = this.items[index];

            if (video.needsReload) {
                Toast.show('This local file needs to be re-uploaded.', 4000, true);
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

            // Mark this item as "loading" so a hard crash during the load
            // (WebKit killing the page on a too-heavy file) is detectable on
            // the next launch and the item is not auto-restored into a
            // crash loop. Cleared once the player has the media loaded.
            this._setLoadGuard(video);

            // Handle streams (HLS/Live) - load directly without MediaMetadata processing
            if (video.isLive || video.isStream || (video.url && video.url.includes('.m3u8'))) {
                video.isStream = true; // Mark for metadata prefetch skip

                // INSTANT FEEDBACK: Show LIVE badge immediately before load succeeds
                let showLiveImmediately = video.isLive || video.url?.includes('.m3u8');
                if (showLiveImmediately) {
                    this.player.isLive = true;
                    this.player._updateStreamUI?.();
                }

                try {
                    // For streams, use autoplay directly - user clicked to play
                    await this.player.load(video.url, autoplay, video.id, null);
                } catch (e) {
                    // Hide LIVE badge on failure
                    if (showLiveImmediately) {
                        this.player.isLive = false;
                        this.player._updateStreamUI?.();
                    }
                    throw e;
                }

                // Update item metadata after stream loads
                this._updateStreamItemMetadata(video, index);

                this._clearLoadGuard();
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
                    this._clearLoadGuard();
                    Logger.warn(`File not found: ${video.title}. Removing and skipping.`);

                    // 1. Data Removal (handles activeIndex adjustment)
                    this.state.removeItem(index);
                    this._saveState();
                    this.render();

                    // 2. Play next or loop back
                    if (index < this.state.items.length) {
                        this.selectItem(index, autoplay);
                    } else if (this.state.items.length > 0 && this.player.loopMode === 'playlist') {
                        this.selectItem(0, autoplay);
                    } else {
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

            this._clearLoadGuard();

            // [NEW] Auto-load matched subtitle file/path
            if (video.subtitleFile || video.subtitlePath) {
                try {
                    let subUrl = '';
                    if (video.subtitleFile) {
                        // Create Blob URL for File object
                        // Revoke previous if exists to avoid leaks
                        if (video.subtitleUrl) URL.revokeObjectURL(video.subtitleUrl);
                        video.subtitleUrl = URL.createObjectURL(video.subtitleFile);
                        subUrl = video.subtitleUrl;
                    } else if (video.subtitlePath) {
                        // Use path directly (Electron)
                        subUrl = video.subtitlePath;
                    }

                    if (subUrl) {
                        Logger.log(`[Playlist] Loading auto-detected subtitle: ${subUrl}`);
                        await this.player.loadSubtitle(subUrl);
                    }
                } catch (e) {
                    Logger.error('[Playlist] Failed to load auto-detected subtitle:', e);
                }
            }

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

    render() {
        this.renderer.render();
    }

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

    async _removeFolder(folderData) {
        // Find items that start with folder path
        const prefix = folderData.path + '/';
        // And exact path matches? Folders are virtual.
        // Actually filtering strategy:
        // Remove all items where item.path startsWith prefix OR item.path == folderData.path?
        // Items inside: `Playlist/Group/Item`.
        // Folder: `Playlist/Group`.
        // Check if item.path includes the folder segments.

        const confirmed = await ConfirmDialog.confirm({
            title: 'Delete Folder',
            message: `Delete folder "${folderData.name}" and all contents?`,
            confirmText: 'Delete',
            confirmType: 'danger'
        });

        if (confirmed) {
            const countBefore = this.state.items.length;
            const newItems = this.state.items.filter(item => !item.path.startsWith(folderData.path + '/'));

            if (newItems.length < countBefore) {
                this.state.setItems(newItems);
                this._saveState();
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
                await MediaMetadata.getProcessedSourceURL(item, () => this._saveState());

                if (downloadBtn) downloadBtn.classList.remove('loading');
            }

            // Trigger download
            const downloadLink = document.getElementById('mb-download-link');
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


    /**
     * Handle URL Upload logic
     * @private
     * @param {string} url 
     */
    async _handleUrlUpload(url) {
        try {
            const result = await this.processor.processUrl(url);

            // Handle M3U/IPTV Playlist result
            if (result.type === 'm3u') {
                await this._handleM3UPlaylist(result.url);
                return;
            }

            // Add item to playlist
            this.addItem(result);

            // Process metadata if it's a regular file
            if (!result.isStream) {
                PlaylistProcessor.processMetadata([result], (item) => this.render());
            }

            // Always select and play the new item
            this.selectItem(this.items.length - 1);

        } catch (error) {
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
            const newItems = await this.processor.importM3U(url);

            // If syncing, remove OLD items from this source first
            if (isSync) {
                this.state.setItems(this.items.filter(item => item.m3uSource !== url));
                Logger.log(`[M3U] Removed old items for sync: ${url}`);
            }

            // Add all items at once
            this.state.addItems(newItems);
            this._saveState();
            this.render();
            this._updatePlayerNavigationState();

            // Show success message
            Toast.show(`${isSync ? 'Synced' : 'Added'} ${newItems.length} channels`);

        } catch (error) {
            Logger.error('[M3U] Failed to import playlist:', error);
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
        Toast.show(`Syncing ${name}...`);
        try {
            await this._handleM3UPlaylist(url, true);
        } catch (e) {
            Toast.show(`Sync failed: ${e.message}`, 3000, true);
        }
    }


    _toggleSettingsMenu(index) {
        ItemToolsMenu.show(index, this);
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

        this.renderer.markItemBrokenInDOM(item.id);
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
        const folderItems = this.state.items.filter(item => {
            const path = item.path || '';
            return path.startsWith(prefix) && item.isStream;
        });

        const { ValidationModal } = await import('../menus/features/ValidationModal.js');
        await ValidationModal.show({
            items: folderItems,
            processor: this.processor,
            onToast: (msg) => Toast.show(msg),
            onComplete: () => {
                this._saveState();
                this.render();
            }
        });
    }

}

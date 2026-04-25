/**
 * Core Player Class
 * The main controller for video playback using MediaBunny.
 * Supports file-based playback and HLS streaming (via MediaBunny's built-in HLS support).
 */

import { MediaBunny } from './MediaBunny.js';
import {
    PLAYER_CONFIG,
    PLAYER_CONTROL_DEFAULTS,
    PLAYER_CONTROL_PRESETS,
    CONTROL_BAR_MODE_DEFAULT
} from './config.js';
import { SubtitleManager } from './SubtitleManager.js';
import { ScreenshotManager } from '../player/ScreenshotManager.js';
import { initPlayerAudio } from './audio/AudioEngine.js';
import {
    clearPlayerCanvas,
    disposeMediaBunnyResources,
    resetPlayer,
    cleanupPlayerForLoad,
    setupPlayerMediaTracks,
    handlePlayerHlsState,
    cleanupPlayerAudioMode,
    resetPlayerUI,
    cleanupPlayerMediaBunny
} from './playback/MediaLifecycle.js';
import {
    getPlayerPlaybackTime,
    handlePlayerVisibilityChange,
    togglePlayerPlay,
    cyclePlayerSpeed,
    stepPlayerFrame
} from './playback/PlaybackState.js';
import {
    createStreamController,
    getStreamState,
    setStreamState
} from './streaming/StreamController.js';
import { mountPlayerShell } from '../ui/player/PlayerShell.js';
import { createHelpOverlay } from '../ui/player/PlayerOverlays.js';
import { createPlayerControls } from '../ui/player/PlayerControlsView.js';
import { attachPlayerBindings } from '../ui/player/PlayerBindings.js';
import {
    handlePlayerDocumentClick,
    updatePlayerSpeedMenu,
    togglePlayerFilterPanel,
    togglePlayerSpeedPanel,
    togglePlayerSubtitlePanel,
    syncPlayerFilterSliders,
    updatePlayerFiltersButtonState,
    togglePlayerAudioPanel,
    syncPlayerEqSliders,
    updatePlayerAudioButtonState
} from '../ui/player/PlayerPanels.js';
import { PlayerKeyboard } from '../player/PlayerKeyboard.js';
import { PlayerSubtitles } from '../player/PlayerSubtitles.js';
import { PlayerLoopControl } from '../player/PlayerLoopControl.js';
import { PlayerThumbnails } from '../player/PlayerThumbnails.js';
import { PlayerControlBar } from '../player/PlayerControlBar.js';

import { StreamDetector } from '../utils/StreamDetector.js';
import { formatTime, parseTime } from '../utils/mediaUtils.js';
import { Logger } from '../utils/Logger.js';
import { ThumbnailGenerator } from '../player/ThumbnailGenerator.js';

export class CorePlayer {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            Logger.error(`Container with ID "${containerId}" not found.`);
            return;
        }

        this.config = { ...PLAYER_CONFIG, ...options };
        this.canvas = null;
        this.ctx = null;
        this.isPlaying = false;
        this.currentTime = 0;
        this.duration = 0;
        this.playbackRate = parseFloat(localStorage.getItem('jellyjump-speed')) || 1.0;
        this.loopMode = this.config.controls ? this.config.controls.loopMode : 'off';
        this.loopStart = null;
        this.loopEnd = null;
        this.animationFrameId = null;

        // Control bar mode
        this.controlBarMode = options.controlBarMode || CONTROL_BAR_MODE_DEFAULT; // 'overlay' or 'fixed'
        this.autoHideTimer = null;

        this.config.controls = {
            ...PLAYER_CONTROL_DEFAULTS,
            ...this.config.controls
        };

        this.PRESETS = PLAYER_CONTROL_PRESETS;

        // MediaBunny objects
        this.input = null;
        this.videoTrack = null;
        this.videoSink = null;
        this.audioTrack = null;
        this.audioSink = null;
        this.audioIteratorCleanupPromise = null; // Track async cleanup of audio iterator

        // Subtitles - only initialize if captions control is enabled
        this.subtitleManager = null;
        this.isSubtitlesEnabled = false;
        this.subtitleTracks = []; // Array of {id, name, cues}
        this.activeSubtitleTrackId = null;
        this.subtitleTrackCounter = 0;
        this.onSubtitleChange = null; // Callback for when subtitles are added/changed

        // Screenshot Manager - initialized lazily if needed
        this.screenshotManager = null;

        // Web Audio API
        this.audioContext = null;
        this.gainNode = null;
        this.nextAudioTime = 0;
        this.isAudioInitialized = false;
        this.currentAudioSource = null;
        this.activeSources = [];
        this._vodAnchorWall = undefined; // VOD sync anchor (audioContext time when playback started)
        this._vodAnchorContent = undefined; // VOD sync anchor (media position when playback started)
        this.playbackId = 0;

        // New state variables for MediaBunny example pattern
        this.videoFrameIterator = null;
        this.audioBufferIterator = null;
        this.nextFrame = null;
        this.queuedAudioNodes = new Set();
        this.asyncId = 0;
        this.playbackTimeAtStart = 0;
        this.audioContextStartTime = null;

        // Thumbnail Generator (only if enabled)
        this.thumbnailGenerator = null;
        if (this.config.controls.thumbnails) {
            this.thumbnailGenerator = new ThumbnailGenerator();
            this.thumbnailGenerator.progressCallback = () => {
                if (this.ui.thumbnailOverlay && this.ui.thumbnailOverlay.classList.contains('visible')) {
                    this._updateThumbnailImage(this.lastThumbnailHoverTime);
                }
            };
        }
        this.thumbnailGenerationStarted = false;
        this.thumbnailHoverTimer = null;
        this.lastThumbnailHoverTime = 0;

        // Scrubbing state
        this.isScrubbing = false;
        this.scrubWasPlaying = false;

        // Render Callbacks
        this.afterFrameRenderCallbacks = [];



        // UI Elements
        this.ui = {
            controls: null,
            playBtn: null,
            prevBtn: null,
            nextBtn: null,
            progressBar: null,
            progressContainer: null,
            timeDisplay: null,
            volumeSlider: null,
            muteBtn: null,
            fullscreenBtn: null,
            loader: null,
            ccBtn: null,
            ccPanel: null,
            ccInput: null,
            closeCcPanelBtn: null,
            subtitleOptions: null,
            audioBtn: null,
            audioMenu: null,
            speedBtn: null,
            speedPanel: null,
            speedSlider: null,
            speedValue: null,
            resetSpeedBtn: null,
            closeSpeedPanelBtn: null,
            loopBtn: null,
            loopMarkerA: null,
            loopMarkerB: null,
            loopRegion: null,
            loopPanel: null,
            loopStartInput: null,
            loopEndInput: null,
            playOverlay: null,
            bezelOverlay: null
        };

        this.isLoading = false;
        this.bezelTimer = null;

        // Navigation callbacks
        this.onNext = null;
        this.onPrevious = null;
        this.onEnded = null;

        // Current loaded video ID (url)
        this.currentVideoId = null;
        this.sourceUrl = null;

        // Stream / Webcam playback — state owned by PlayerStream (created below)
        this.stream = null; // initialized after all base state is set

        // Audio-only playback
        this.audioVisualizer = null;
        this.isAudioMode = false;
        this.audioElement = null;

        // Global Event Handlers (created conditionally based on which controls are enabled)
        this._handlers = {
            click: (e) => this._handleDocumentClick(e),
            visibilitychange: () => this._handleVisibilityChange()
        };
        // Only create handlers that will be used
        if (this.config.controls.fullscreen) {
            this._handlers.fullscreen = this._updateFullscreenUI.bind(this);
        }
        if (this.config.controls.keyboard) {
            this._handlers.keydown = (e) => this._handleKeyboard(e);
        }

        this.stream = createStreamController(this);
        this.keyboard = new PlayerKeyboard(this);
        this.subtitles = new PlayerSubtitles(this);
        this.loop = new PlayerLoopControl(this);
        this.thumbnails = new PlayerThumbnails(this);
        this.controlBar = new PlayerControlBar(this);
        this._init();
    }

    // ─── Stream state proxies (state lives in PlayerStream) ──────────────────────
    get isStreamMode() { return getStreamState(this, 'isStreamMode'); }
    set isStreamMode(v) { setStreamState(this, 'isStreamMode', v); }
    get isLive() { return getStreamState(this, 'isLive'); }
    set isLive(v) { setStreamState(this, 'isLive', v); }
    get streamVideo() { return getStreamState(this, 'streamVideo'); }
    set streamVideo(v) { setStreamState(this, 'streamVideo', v); }
    get isWebcamMode() { return getStreamState(this, 'isWebcamMode'); }
    set isWebcamMode(v) { setStreamState(this, 'isWebcamMode', v); }
    get _liveStartTimestamp() { return getStreamState(this, '_liveStartTimestamp'); }
    set _liveStartTimestamp(v) { setStreamState(this, '_liveStartTimestamp', v); }
    get _wasMutedForAutoplay() { return getStreamState(this, '_wasMutedForAutoplay'); }
    set _wasMutedForAutoplay(v) { setStreamState(this, '_wasMutedForAutoplay', v); }
    get _isMediaReady() { return getStreamState(this, '_isMediaReady'); }
    set _isMediaReady(v) { setStreamState(this, '_isMediaReady', v); }

    /**
     * Initialize the player
     * @private
     */
    _init() {
        mountPlayerShell(this);

        // Initialize Subtitle Manager only if captions control is enabled
        if (this.config.controls.captions) {
            this.subtitleManager = new SubtitleManager();
        }

        // Initialize Screenshot Manager only if settings control is enabled (screenshot is in settings)
        if (this.config.controls.settings) {
            this.screenshotManager = new ScreenshotManager(this);
        }

        // Create UI
        this._createControls();

        // Only create help overlay if keyboard shortcuts are enabled (since help shows shortcuts)
        if (this.config.controls.keyboard) {
            this._createHelpOverlay();
        }

        // Attach Events
        this._attachEvents();

        // Control bar mode initialization (only if control bar is visible)
        if (this.config.controls.controlBar) {
            this._applyControlBarMode();
        }

        // Initialize ResizeObserver only if fullscreen is enabled (responsive controls needed)
        if (this.config.controls.fullscreen) {
            this._initResizeObserver();
        }
    }

    /**
     * Create Help Overlay
     * @private
     */
    _createHelpOverlay() {
        createHelpOverlay(this);
    }

    /**
     * Create Thumbnail Overlay
     * @private
     */
    _createThumbnailOverlay() { this.thumbnails.createOverlay(); }
    _handleThumbnailHover(e) { this.thumbnails.handleHover(e); }
    _updateThumbnailImage(time) { this.thumbnails.updateImage(time); }
    _handleThumbnailLeave() { this.thumbnails.handleLeave(); }
    async _startThumbnailGeneration() { return this.thumbnails.startGeneration(); }
    _cleanupThumbnails() { this.thumbnails.cleanup(); }

    /**
     * Initialize Audio Context (must be done after user interaction)
     * @private
     */
    _initAudio() {
        initPlayerAudio(this);
    }

    /**
     * Create custom controls UI
     * @private
     */
    _createControls() {
        createPlayerControls(this);
    }

    /**
     * Apply visibility based on config
     * Controls are hidden by default in HTML (control--hidden class)
     * This method removes the class for enabled controls
     * @private
     */
    _applyControlVisibility() {
        if (!this.ui.controls) return;

        const c = this.config.controls;

        // Find all elements with data-control attribute and toggle visibility
        this.ui.controls.querySelectorAll('[data-control]').forEach(el => {
            const controlName = el.dataset.control;
            if (c[controlName]) {
                el.classList.remove('control--hidden');
            }
            // Elements without matching config stay hidden (default from HTML)
        });
    }

    /**
     * Attach event listeners
     * @private
     */
    _attachEvents() {
        attachPlayerBindings(this);
    }

    /**
     * Subscribe to an event
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    on(event, callback) {
        if (!this._events[event]) {
            this._events[event] = [];
        }
        this._events[event].push(callback);
    }

    /**
     * Unsubscribe from an event
     * @param {string} event - Event name
     * @param {Function} callback - Callback function to remove
         */
    off(event, callback) {
        if (!this._events[event]) return;
        this._events[event] = this._events[event].filter(cb => cb !== callback);
    }

    /**
     * Trigger an event
     * @param {string} event - Event name
     * @param {Object} [data] - Data to pass to callbacks
     */
    trigger(event, data = {}) {
        if (!this._events[event]) return;
        this._events[event].forEach(callback => callback(data));
    }

    _handleDocumentClick(e) { handlePlayerDocumentClick(this, e); }
    _updateSpeedMenu() { updatePlayerSpeedMenu(this); }

    /**
     * Toggle Loop Mode: Off -> Playlist -> One -> Off
     */
    toggleLoopMode() { this.loop.toggleLoopMode(); }
    toggleLoopPanel() { this.loop.toggleLoopPanel(); }

    /**
     * Toggle video filters panel visibility
     */
    toggleFilterPanel() { togglePlayerFilterPanel(this); }

    /**
     * Toggle speed panel visibility
     */
    toggleSpeedPanel() { togglePlayerSpeedPanel(this); }

    /**
     * Toggle subtitle panel visibility
     */
    toggleSubtitlePanel() { togglePlayerSubtitlePanel(this); }

    /**
     * Sync filter sliders with current VideoFilters state
     * @private
     */
    _syncFilterSliders() { syncPlayerFilterSliders(this); }

    /**
     * Update filter button to show active state when filters are applied
     * @private
     */
    _updateFiltersButtonState() { updatePlayerFiltersButtonState(this); }

    /**
     * Toggle audio settings panel visibility
     */
    toggleAudioPanel() { togglePlayerAudioPanel(this); }

    /**
     * Sync EQ sliders with current AudioEqualizer state
     * @private
     */
    _syncEqSliders() { syncPlayerEqSliders(this); }

    /**
     * Update Audio button to show active state (mute/volume)
     * @private
     */
    _updateAudioButtonState() { updatePlayerAudioButtonState(this); }

    setLoopStart() { this.loop.setLoopStart(); }
    setLoopEnd() { this.loop.setLoopEnd(); }
    clearLoopMarkers() { this.loop.clearLoopMarkers(); }
    resetLoop() { this.loop.resetLoop(); }
    _updateLoopUI() { this.loop.updateLoopUI(); }

    /**
     * Set playback rate
     * @param {number} rate 
     */
    async setPlaybackRate(rate) {
        if (rate < 0.25 || rate > 2) return;

        const wasPlaying = this.isPlaying;
        const currentPosition = this._getPlaybackTime();

        if (wasPlaying) {
            this.pause();
            // Wait for audio iterator cleanup to complete before changing rate
            if (this.audioIteratorCleanupPromise) {
                await this.audioIteratorCleanupPromise;
            }
        }

        this.playbackRate = rate;
        localStorage.setItem('jellyjump-speed', rate);
        this._updateSpeedMenu();

        if (wasPlaying) {
            // Seek to current position to reset all iterators with new rate
            await this._seekTo(currentPosition);
            await this.play();
        }
    }

    _updateSubtitleMenu() { this.subtitles.updateSubtitleMenu(); }
    _switchSubtitleTrack(trackId) { this.subtitles.switchSubtitleTrack(trackId); }
    async _switchAudioTrack(trackId) { return this.subtitles.switchAudioTrack(trackId); }
    async _updateAudioTracks() { return this.subtitles.updateAudioTracks(); }

    /**
     * Handle keyboard shortcuts
     * @param {KeyboardEvent} e 
     * @private
     */
    _handleKeyboard(e) { this.keyboard.handleKeyboard(e); }
    _toggleHelp() { this.keyboard.toggleHelp(); }

    _cycleSpeed(direction) { cyclePlayerSpeed(this, direction); }

    /**
     * Step forward or backward by frames
     * @param {number} direction - 1 for forward, -1 for backward
     * @private
     */
    _stepFrame(direction) { stepPlayerFrame(this, direction); }

    /**
     * Clear the canvas
     * @private
     */
    _clearCanvas() { clearPlayerCanvas(this); }

    /**
     * Dispose MediaBunny resources (sinks and input)
     * @private
     */
    _disposeMediaBunnyResources() { disposeMediaBunnyResources(this); }

    /**
     * Reset the player state and unload media
     */
    async reset() { return resetPlayer(this); }

    /**
     * Load a media source
     * @param {string} url - URL of the media file or HLS stream
     * @param {boolean} autoplay - Whether to start playing automatically
     * @param {string} videoId - Optional unique identifier for the video
     * @param {Array} savedSubtitles - Optional saved subtitle tracks
     * @param {Object} options - Additional options { isAudio: boolean }
     */
    async load(url, autoplay = false, videoId = null, savedSubtitles = null, options = {}) {
        this.sourceUrl = url;
        try {
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            if (autoplay && isMobile) {
                Logger.log('[Player] Mobile Autoplay requested - enforcing muted playback');
                this.config.muted = true;
                this._updateVolumeUI();
            }

            const isHls = StreamDetector.detect(url) === StreamDetector.TYPE_HLS;

            await this._cleanupForLoad();

            this._setLoading(true);
            Logger.log(`Loading media: ${url}`);
            this.currentVideoId = videoId || url;

            await this._setupMediaTracks(url, isHls);

            if (isHls) await this._handleHLSState();
            if (savedSubtitles?.length > 0) this._restoreSavedSubtitles(savedSubtitles);

            await this._handleInitialFrame(autoplay);
            this._updateSubtitleMenu();

            // Live streams: _startLiveVideoLoop owns loading state, clears it on first frame
            if (!this.isLive) this._setLoading(false);
            Logger.log('Media loaded successfully');

        } catch (error) {
            Logger.error('Error loading media:', error);
            this._setLoading(false);
            if (this.onStreamError && this.currentVideoId) {
                this.onStreamError(this.currentVideoId, error.message || 'Failed to load media');
            }
        }
    }

    async _cleanupForLoad() { return cleanupPlayerForLoad(this); }

    async _setupMediaTracks(url, isHls) { return setupPlayerMediaTracks(this, url, isHls); }

    async _handleHLSState() { return handlePlayerHlsState(this); }

    _restoreSavedSubtitles(savedSubtitles) { this.subtitles.restoreSavedSubtitles(savedSubtitles); }

    /**
     * Cleanup audio-only playback visualizer
     * @private
     */
    _cleanupAudio() { cleanupPlayerAudioMode(this); }



    /**
     * Reset UI elements (canvas, time, progress)
     */
    resetUI() { resetPlayerUI(this); }

    _createStreamVideo() { this.stream.createStreamVideo(); }
    _showStreamVideo() { this.stream.showStreamVideo(); }
    _hideStreamVideo() { this.stream.hideStreamVideo(); }
    _setupStreamVideoEvents() { this.stream.setupStreamVideoEvents(); }
    _startStreamRenderLoop() { this.stream.startStreamRenderLoop(); }
    async loadWebcamStream(stream) { return this.stream.loadWebcamStream(stream); }

    async startCanvasRecording(options = {}) { return this.stream.startCanvasRecording(options); }
    _resumeRecordingSmartPause() { this.stream.resumeRecordingSmartPause(); }
    async stopCanvasRecording() { return this.stream.stopCanvasRecording(); }
    stopWebcamStreamMode() { this.stream.stopWebcamStreamMode(); }
    _stopStreamRenderLoop() { this.stream.stopStreamRenderLoop(); }
    _renderStreamFrame() { this.stream.renderStreamFrame(); }
    _updateStreamUI() { this.stream.updateStreamUI(); }

    _setStreamModeControls(isStreamMode) { this.stream.setStreamModeControls(isStreamMode); }
    _setWebcamModeControls(isWebcamMode) { this.stream.setWebcamModeControls(isWebcamMode); }

    /**
     * Clean up MediaBunny resources when switching to stream mode
     * @private
     */
    async _cleanupMediaBunny() { return cleanupPlayerMediaBunny(this); }

    _cleanupHLS() { this.stream.cleanupHLS(); }
    _createErrorOverlay() { this.stream.createErrorOverlay(); }
    _showStreamError(errorDetails) { this.stream.showStreamError(errorDetails); }
    _hideStreamError() { this.stream.hideStreamError(); }

    /**
     * Load a subtitle file (VTT, SRT, or JSON transcript)
     * @param {string} url - URL of the subtitle file
     */
    async loadSubtitle(url) { return this.subtitles.loadSubtitle(url); }

    async _updateNextFrame() {
        const currentAsyncId = this.asyncId;

        // We have a loop here because we may need to iterate over multiple frames until we reach a frame in the future
        while (true) {
            if (!this.videoFrameIterator) break;
            const result = await this.videoFrameIterator.next();
            const newNextFrame = result.value ?? null;

            if (!newNextFrame) {
                break;
            }

            if (currentAsyncId !== this.asyncId) {
                break;
            }

            const playbackTime = this._getPlaybackTime();
            if (newNextFrame.timestamp <= playbackTime) {
                Logger.log(`[FrameSync] Late frame: ts=${newNextFrame.timestamp.toFixed(3)}, playback=${playbackTime.toFixed(3)}, behind=${((playbackTime - newNextFrame.timestamp) * 1000).toFixed(0)}ms`);
                // Draw it immediately
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                this.ctx.drawImage(newNextFrame.canvas, 0, 0, this.canvas.width, this.canvas.height);

                // Mark media as ready and handle recording resume if needed
                if (!this._isMediaReady) {
                    this._isMediaReady = true;
                    if (this.isPlaying) {
                        this._resumeRecordingSmartPause();
                    }
                }

                // Execute render callbacks
                if (this.afterFrameRenderCallbacks.length > 0) {
                    this.afterFrameRenderCallbacks.forEach(cb => cb(this.canvas, this.ctx));
                }
            } else {
                // Save it for later
                this.nextFrame = newNextFrame;
                break;
            }
        }
    }

    _renderSubtitles(timestamp) { this.subtitles.renderSubtitles(timestamp); }

    /**
     * Returns the current playback time in the media file.
     * To ensure perfect audio-video sync, we always use the audio context's clock to determine playback time.
     * Note: We don't multiply by playbackRate here because audioContext.currentTime advances at real-time,
     * but audio sources play at playbackRate speed, effectively advancing media time faster.
     */
    _getPlaybackTime() { return getPlayerPlaybackTime(this); }

    /**
     * Handle visibility change (tab switching).
     * Prevents video fast-forwarding when returning to the tab.
     * When the tab is hidden, requestAnimationFrame stops but audio continues.
     * When visible again, instantly seek video to current audio position.
     * @private
     */
    /**
     * Handle tab visibility changes.
     * When the tab is hidden, requestAnimationFrame stops but audio continues.
     * When visible again, restart video from current live edge (not where user left).
     * @private
     */
    async _handleVisibilityChange() { return handlePlayerVisibilityChange(this); }

    /**
     * Toggle play/pause
     */
    togglePlay() { togglePlayerPlay(this); }

    async play() {
        this.stream.onPlay();

        const streamHandled = await this.stream.playStream();
        if (streamHandled) return;

        this._updateVolumeUI();

        // Prevent restarting clock if already playing (fixes jump-to-zero on double play call)
        if (this.isPlaying) return;


        if (!this.videoTrack && !this.audioTrack) return;

        Logger.log(`[Play] Starting playback - isAudioMode: ${this.isAudioMode}, playbackTimeAtStart: ${this.playbackTimeAtStart}`);

        // Initialize Audio Context on first user interaction
        try {
            this._initAudio();

            // Resume AudioContext if suspended (e.g., after pause suspends it)
            if (this.audioContext && this.audioContext.state === 'suspended') {
                // Wrap resume in a timeout so we don't hang if browser keeps it pending
                const resumePromise = this.audioContext.resume();
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('AudioContext resume timed out')), 500)
                );
                await Promise.race([resumePromise, timeoutPromise]);
            }
        } catch (e) {
            Logger.warn('[Play] AudioContext blocked/failed:', e);

            // Audio autoplay blocked - always track this and mute if needed
            Logger.log('[Play] Auto-muting due to audio block...');
            this._wasMutedForAutoplay = true;
            if (!this.config.muted) {
                this.config.muted = true;
                // CRITICAL: Also set gainNode to 0 so audio is actually silenced
                if (this.gainNode) {
                    this.gainNode.gain.value = 0;
                }
                if (this.ui.muteBtn) this._updateVolumeUI();
            }
            // We proceed to play using fallbackStartTime defined below
        }

        if (this.isLive) {
            // Fetch current live edge before starting playback
            Logger.log(`[Play:Live] isLive=${this.isLive}, videoTrack=${!!this.videoTrack}, audioContext=${!!this.audioContext}, audioCtxTime=${this.audioContext?.currentTime?.toFixed(3)}`);
            if (this.videoTrack) {
                try {
                    const currentLiveEdge = await this.videoTrack.getDurationFromMetadata({ skipLiveWait: true });
                    const refreshInterval = await this.videoTrack.getLiveRefreshInterval() ?? 7;
                    this._liveStartTimestamp = currentLiveEdge ?? 0;
                    Logger.log(`[Play:Live] Current live edge: ${currentLiveEdge?.toFixed(3)}, starting from: ${this._liveStartTimestamp.toFixed(3)}`);
                } catch (e) {
                    Logger.warn(`[Play:Live] Failed to get duration, using fallback`);
                    // Fallback: use audio context time as proxy for live position
                    if (this.audioContext) {
                        this._liveStartTimestamp = Date.now() / 1000 - 5; // Approximate, fallback to ~5s ago
                    }
                }
            } else {
                Logger.warn(`[Play:Live] No videoTrack, using existing _liveStartTimestamp`);
            }
            // Live HLS: async for-await loop driven by MediaBunny's segment delivery
            this._startLiveVideoLoop();
        } else if (this.duration > 0 && this._getPlaybackTime() >= this.duration - 0.1) {
            // If we're at the end (and duration is known), let's snap back to the start
            this.playbackTimeAtStart = 0;
            await this._startVideoIterator();
        } else if (!this.videoFrameIterator) {
            // If iterator wasn't started (e.g. default frame mode), start it now
            await this._startVideoIterator();
        }

        // Stopwatch clock initialization
        this.fallbackStartTime = performance.now();

        this.isPlaying = true;
        this._updatePlayPauseUI();

        if (this.audioSink) {
            if (this.isLive) {
                // Audio will be started by _startLiveVideoLoop() after the first video frame
                // to guarantee A/V sync by anchoring the AudioContext clock at that moment.
            } else {
                // Capture position BEFORE the async cleanup so elapsed time during
                // audioBufferIterator.return() doesn't skew the audio start point.
                const startTime = this.playbackTimeAtStart;
                if (this.audioBufferIterator) await this.audioBufferIterator.return();
                Logger.log(`[Play] Starting audio iterator at time: ${startTime.toFixed(2)}s`);
                this.audioBufferIterator = this.audioSink.samples(startTime);

                // Prefetch the first audio sample before the render loop starts.
                // Without this, the render loop advances the video ~80-100ms (MediaBunny's
                // decode startup time) before the first audio sample arrives, then the anchor
                // snaps back — causing a persistent initial desync visible on the first few frames.
                const firstResult = await this.audioBufferIterator.next();
                const vodPrefetchedSample = firstResult?.value ?? null;

                // Set anchors now so the render loop (started below) sees the correct clock
                // from its very first tick. Anchor: audio ts=vodPrefetchedSample.timestamp
                // will start playing at audioCtx ≈ currentTime + 0.02s.
                const vodAnchorWall = this.audioContext.currentTime + 0.02;
                const vodAnchorContent = vodPrefetchedSample?.timestamp ?? startTime;
                this._vodAnchorWall = vodAnchorWall;
                this._vodAnchorContent = vodAnchorContent;
                Logger.log(`[Play] VOD anchor prefetched — wall=${vodAnchorWall.toFixed(3)}, content=${vodAnchorContent.toFixed(3)}, sample=${vodPrefetchedSample ? 'ok' : 'null'}`);

                this._runAudioIterator(vodAnchorWall, vodAnchorContent, vodPrefetchedSample);
            }

            // Start visualizer if in audio mode
            if (this.isAudioMode) {
                // Create visualizer if it doesn't exist (may have been cleaned up)
                if (!this.audioVisualizer && this.canvas) {
                    const { AudioVisualizer } = await import('../player/AudioVisualizer.js');
                    this.audioVisualizer = new AudioVisualizer(this.canvas);
                    this.audioVisualizer.connect(this.audioContext, this.gainNode);
                }
                if (this.audioVisualizer) {
                    this.audioVisualizer.start();
                }
            }
        }

        this._startRenderLoop();

        // Start auto-hide timer for overlay mode (even if mouse is stationary)
        if (this.controlBarMode === 'overlay') {
            // Small delay to allow user to see controls when they click play
            setTimeout(() => {
                if (this.isPlaying && this.controlBarMode === 'overlay') {
                    this._startAutoHideTimer();
                }
            }, 500);
        }

        // Hide overlay
        if (this.ui.playOverlay) {
            this.ui.playOverlay.style.display = 'none';
        }
    }

    pause(showOverlay = true) {
        Logger.log("Player.pause() called");

        this.stream.onPause();

        const streamHandled = this.stream.pauseStream(showOverlay);
        if (streamHandled) return;

        // File-based playback (MediaBunny)
        const calculatedTime = this._getPlaybackTime();


        // Sanity check: If calculated time is 0 but we were playing at a later time (e.g. > 1s), use the UI time.
        // This prevents the "progress bar goes to initial" bug if clocks desync on pause.
        if (calculatedTime < 0.1 && this.currentTime > 1.0) {
            Logger.warn(`[Pause] Correction: _getPlaybackTime returned ${calculatedTime} but currentTime is ${this.currentTime}. Keeping ${this.currentTime}.`);
            this.playbackTimeAtStart = this.currentTime;
        } else {
            this.playbackTimeAtStart = calculatedTime;
        }
        this.isPlaying = false;
        this._clearAutoHideTimer();

        // Always update play/pause button (overlay won't show due to isLoading check inside)
        this._updatePlayPauseUI();

        if (this.audioBufferIterator) {
            // Properly await the iterator cleanup to ensure AudioSample objects are closed
            // Using .then() since pause() must be synchronous for event handlers
            const iterator = this.audioBufferIterator;
            this.audioBufferIterator = null;
            this.audioIteratorCleanupPromise = iterator.return().catch(e => {
                // Iterator might already be closed or in error state, ignore
                Logger.debug("Error closing audio iterator:", e);
            }).finally(() => {
                this.audioIteratorCleanupPromise = null;
            });
        }

        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        // Suspend audioContext to stop its clock - keeps audio/video time in sync
        if (this.audioContext && this.audioContext.state === 'running') {
            this.audioContext.suspend();
        }

        // Stop all audio nodes that were already queued to play
        for (const node of this.queuedAudioNodes) {
            try {
                node.stop();
            } catch (e) { }
        }
        this.queuedAudioNodes.clear();

        // Save state
        this._savePlaybackState();

        // Show/Hide overlay - skip if loading
        if (this.ui.playOverlay && !this.isLoading) {
            const shouldShow = showOverlay && this.config.controls.playOverlay;
            this.ui.playOverlay.style.display = shouldShow ? 'flex' : 'none';
        }

        // Stop visualizer if active
        if (this.isAudioMode && this.audioVisualizer) {
            this.audioVisualizer.stop();
        }
    }

    async _startLiveVideoLoop() { return this.stream.startLiveVideoLoop(); }

    /**
     * Creates a new video frame iterator and renders the first video frame.
     */
    async _startVideoIterator() {
        if (!this.videoSink) return;

        this.asyncId++;
        const currentAsyncId = this.asyncId;

        if (this.videoFrameIterator) await this.videoFrameIterator.return(); // Dispose of the current iterator

        this.videoFrameIterator = this.videoSink.canvases(this._getPlaybackTime());

        // Get the first two frames
        let firstFrame = null, secondFrame = null;
        try {
            firstFrame = (await this.videoFrameIterator.next()).value ?? null;
            secondFrame = (await this.videoFrameIterator.next()).value ?? null;
        } catch (e) {
            Logger.warn('[VideoIterator] Failed to get initial frames, will retry on next play:', e);
            this.videoFrameIterator = null;
            return;
        }

        // Prevent race conditions if asyncId changed while awaiting
        if (currentAsyncId !== this.asyncId) return;

        this.nextFrame = secondFrame;

        if (firstFrame) {
            // Draw the first frame
            this.ctx.drawImage(firstFrame.canvas, 0, 0, this.canvas.width, this.canvas.height);

            // Execute render callbacks
            if (this.afterFrameRenderCallbacks.length > 0) {
                this.afterFrameRenderCallbacks.forEach(cb => cb(this.canvas, this.ctx));
            }
        }
    }

    _startRenderLoop() {
        // Prevent starting multiple render loops
        if (this.animationFrameId) {
            return;
        }

        const loop = () => {
            if (this.isPlaying) {
                const playbackTime = this._getPlaybackTime();
                this.currentTime = playbackTime; // Update internal time for UI
                
                if (this._frameSyncLogCount === undefined) this._frameSyncLogCount = 0;
                this._frameSyncLogCount++;
                if (this._frameSyncLogCount % 60 === 0 && this._vodAnchorWall !== undefined && !this.isLive) {
                    const nextTs = this.nextFrame?.timestamp;
                    const drift = nextTs !== undefined ? ((nextTs - playbackTime) * 1000).toFixed(0) : 'n/a';
                    Logger.log(`[FrameSync] frame=${this._frameSyncLogCount}, playback=${playbackTime.toFixed(3)}, nextFrameTs=${nextTs?.toFixed(3) ?? 'none'}, drift=${drift}ms, audioCtx=${this.audioContext?.currentTime?.toFixed(3)}`);
                }

                // Trigger timeupdate event
                this.trigger('timeupdate', { currentTime: this.currentTime });

                if (!this.isLive && playbackTime >= this.duration) {
                    if (this.loopMode === 'one') {
                        this._seekTo(0);
                        return; // Restart loop
                    } else {
                        // Pause playback once the end is reached
                        this.pause();
                        this.playbackTimeAtStart = this.duration;

                        // Notify ended
                        if (this.onEnded) {
                            this.onEnded();
                        }
                    }
                }

                // Check Loop A-B (within Current Video mode)
                if (this.loopMode === 'one' && this.loopStart !== null && this.loopEnd !== null) {
                    if (playbackTime >= this.loopEnd) {
                        this._seekTo(this.loopStart);
                        return;
                    }
                }

                // Check if the current playback time has caught up to the next frame
                if (this.nextFrame && this.nextFrame.timestamp <= playbackTime) {
                    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                    this.ctx.drawImage(this.nextFrame.canvas, 0, 0, this.canvas.width, this.canvas.height);

                    // Execute render callbacks
                    if (this.afterFrameRenderCallbacks.length > 0) {
                        this.afterFrameRenderCallbacks.forEach(cb => cb(this.canvas, this.ctx));
                    }

                    this.nextFrame = null;

                    // Request the next frame
                    this._updateNextFrame();
                }

                // Update UI
                this._updateProgress();

                if (this.isSubtitlesEnabled) {
                    this._renderSubtitles(playbackTime);
                }
            }

            this.animationFrameId = requestAnimationFrame(loop);
        };

        this.animationFrameId = requestAnimationFrame(loop);
    }

    /**
     * Loops over the audio buffer iterator, scheduling the audio to be played in the audio context.
     */
    async _runAudioIterator(anchorWall, anchorContent, prefetchedSample) {
        if (!this.audioSink) return;

        // Save anchors for _getPlaybackTime() to use
        if (anchorWall !== undefined) this._vodAnchorWall = anchorWall;
        if (anchorContent !== undefined) this._vodAnchorContent = anchorContent;
        
        const myIterator = this.audioBufferIterator;
        // Live mode: anchorWall/anchorContent are set.
        //   nextAudioTime is initialized to the anchor-relative position of the first sample,
        //   then samples are scheduled sequentially. This guarantees perfect initial A/V sync
        //   while preventing drift accumulation when live segments arrive late.
        // VOD mode: no anchors; linear sequential scheduling from audioContext.currentTime.
        const isLiveMode = anchorWall !== undefined && anchorContent !== undefined;
        // For live mode, nextAudioTime is aligned to the first sample below; use anchorWall
        // as a temporary sentinel so VOD fallback keeps working until the first sample runs.
        // nextAudioTime is the audioContext clock time when the first sample should start playing.
        // For live/VOD with anchors: align to anchorWall (adjusted for any elapsed time since anchor was set).
        let nextAudioTime;
        if (isLiveMode && prefetchedSample) {
            nextAudioTime = anchorWall + (prefetchedSample.timestamp - anchorContent);
        } else if (isLiveMode) {
            nextAudioTime = anchorWall + (this.audioContext.currentTime - anchorWall);
        } else {
            nextAudioTime = (this.audioContext?.currentTime || 0) + 0.1;
        }
        let sampleCount = 0;
        let firstSampleScheduled = false;

        const _audioLogTag = this.isLive ? 'Live' : 'VOD';
        Logger.log(`[${_audioLogTag}:Audio] Iterator started — anchorWall=${anchorWall?.toFixed(3)}, anchorContent=${anchorContent?.toFixed(3)}, nextAudioTime=${nextAudioTime.toFixed(3)}, audioCtx=${this.audioContext?.currentTime?.toFixed(3)}, audioCtxState=${this.audioContext?.state}`);

        const scheduleOne = (audioSample) => {
            if (!this.isPlaying) { audioSample.close(); return; }

            const buffer = audioSample.toAudioBuffer();
            const timestamp = audioSample.timestamp;
            audioSample.close();

            const audioSource = this.audioContext.createBufferSource();
            audioSource.buffer = buffer;
            audioSource.playbackRate.value = this.playbackRate;

            if (this.audioEqualizer && this.audioEqualizer.isInitialized) {
                audioSource.connect(this.audioEqualizer.getInputNode());
            } else {
                audioSource.connect(this.gainNode);
            }

            // Absolute timestamp scheduling: each sample maps independently to audioCtx time.
            // A network stall that delays a segment causes a brief skip/silence rather than
            // accumulating drift (as sequential scheduling would).
            const targetTime = anchorWall + (timestamp - anchorContent) / this.playbackRate;
            if (!firstSampleScheduled) {
                firstSampleScheduled = true;
                Logger.log(`[${_audioLogTag}:Audio] First sample — ts=${timestamp.toFixed(3)}, targetTime=${targetTime.toFixed(3)}, audioCtx=${this.audioContext.currentTime.toFixed(3)}, bufDur=${buffer.duration.toFixed(3)}s`);
            }
            if (targetTime >= this.audioContext.currentTime) {
                audioSource.start(targetTime);
            } else {
                const bufferOffset = (this.audioContext.currentTime - targetTime) * this.playbackRate;
                if (bufferOffset < buffer.duration) {
                    audioSource.start(this.audioContext.currentTime, bufferOffset);
                } else {
                    return; // Entirely in the past — skip
                }
            }
            nextAudioTime = targetTime + buffer.duration / this.playbackRate;
            this._liveNextAudioTime = nextAudioTime;

            this.queuedAudioNodes.add(audioSource);
            audioSource.onended = () => this.queuedAudioNodes.delete(audioSource);
        };

        if (prefetchedSample) scheduleOne(prefetchedSample);

        try {
            for await (const audioSample of myIterator) {
                if (!this.isPlaying) { audioSample.close(); break; }

                sampleCount++;
                const timestamp = audioSample.timestamp;
                scheduleOne(audioSample);

                if (sampleCount === 1) {
                    Logger.log(`[${_audioLogTag}:Audio] First iterator sample — ts=${timestamp.toFixed(3)}, audioCtx=${this.audioContext?.currentTime?.toFixed(3)}, nextAudioTime=${nextAudioTime.toFixed(3)}`);
                }
                if (sampleCount % 100 === 0) {
                    Logger.log(`[${_audioLogTag}:Audio] ${sampleCount} samples — ts=${timestamp.toFixed(3)}, audioCtx=${this.audioContext?.currentTime?.toFixed(3)}, nextAudioTime=${nextAudioTime.toFixed(3)}, bufferAhead=${((nextAudioTime - this.audioContext.currentTime) * 1000).toFixed(0)}ms`);
                }

                // Throttle audio decode to stay ~300ms ahead of playback position.
                // Use this sample's targetTime (not nextAudioTime) so stalls that cause
                // skipped samples don't leave nextAudioTime stale and disable the throttle.
                // isLiveMode guarantees anchorWall/anchorContent are defined; don't use them
                // as truthiness checks because anchorContent=0 is falsy (start of file).
                if (isLiveMode && this.audioContext) {
                    const sampleTargetTime = anchorWall + (timestamp - anchorContent) / this.playbackRate;
                    const aheadMs = (sampleTargetTime - this.audioContext.currentTime) * 1000;
                    if (aheadMs > 300) {
                        const waitMs = aheadMs - 300;
                        if (sampleCount % 200 === 0) {
                            Logger.log(`[${_audioLogTag}:Audio] Audio ${aheadMs.toFixed(0)}ms ahead — throttling ${waitMs.toFixed(0)}ms`);
                        }
                        await new Promise(r => setTimeout(r, waitMs));
                    } else if (aheadMs < -1000 && this.isPlaying && this.isLive) {
                        // Audio fell >1s behind (segment stall caused anchor drift) — jump to live edge.
                        // Mirrors the video loop's deep-resync at PlayerStream.js startLiveVideoLoop.
                        Logger.warn(`[${_audioLogTag}:Audio] Audio ${(-aheadMs).toFixed(0)}ms behind — triggering live resync`);
                        this._setLoading(true);
                        if (this.videoTrack) {
                            const currentLiveEdge = await this.videoTrack.getDurationFromMetadata({ skipLiveWait: true });
                            this._liveStartTimestamp = currentLiveEdge ?? this._liveStartTimestamp;
                            Logger.log(`[${_audioLogTag}:Audio] Jumping to live edge: ${this._liveStartTimestamp?.toFixed(3)}`);
                        }
                        this._startLiveVideoLoop();
                        break;
                    }
                }

                // VOD only: throttle decode to stay within 3s of playback position
                if (!isLiveMode && timestamp - this._getPlaybackTime() >= 3) {
                    await new Promise((resolve) => {
                        const id = setInterval(() => {
                            if (!this.isPlaying || this.isLive || timestamp - this._getPlaybackTime() < 2) {
                                clearInterval(id);
                                resolve();
                            }
                        }, 100);
                    });
                }
            }
            Logger.log(`[${_audioLogTag}:Audio] Iterator completed after ${sampleCount} samples`);
        } catch (error) {
            if (error.name !== 'InputDisposedError' && !error.message?.includes('Input has been disposed')) {
                Logger.error(`[${_audioLogTag}:Audio] Iterator error after ${sampleCount} samples:`, error);
            } else {
                Logger.log(`[${_audioLogTag}:Audio] Iterator stopped (input disposed) after ${sampleCount} samples`);
            }
        } finally {
            Logger.log(`[${_audioLogTag}:Audio] Cleanup — sampleCount=${sampleCount}, isOurIterator=${this.audioBufferIterator === myIterator}`);
            if (this.audioBufferIterator === myIterator) {
                try { await myIterator.return(); } catch (e) { }
            }
        }
    }

    async _seekTo(time) {
        Logger.log(`[Seek] _seekTo time=${time.toFixed(3)}, vodAnchorWall=${this._vodAnchorWall?.toFixed(3)}, vodAnchorContent=${this._vodAnchorContent?.toFixed(3)}, playbackTime=${this._getPlaybackTime().toFixed(3)}`);

        this._setLoading(true);

        const wasPlaying = this.isPlaying;

        if (wasPlaying) {
            this.pause(false); // Don't show overlay during seek pause
        }

        this.playbackTimeAtStart = Math.max(0, Math.min(this.duration, time));
        this.currentTime = this.playbackTimeAtStart; // Sync internal currentTime for UI
        this._updateProgress(); // Update UI immediately

        // Clear VOD sync anchors so _getPlaybackTime() uses the new playbackTimeAtStart
        this._vodAnchorWall = undefined;
        this._vodAnchorContent = undefined;

        try {
            await this._startVideoIterator();
        } finally {
            this._setLoading(false);
        }

        if (wasPlaying && this.playbackTimeAtStart < this.duration) {
            await this.play();
        }
    }

    _seek(e) {
        const rect = this.ui.progressContainer.getBoundingClientRect();
        // Clamp position between 0 and 1
        let pos = (e.clientX - rect.left) / rect.width;
        pos = Math.max(0, Math.min(1, pos));
        this._seekTo(pos * this.duration);
    }

    _onScrubStart(e) {
        this.isScrubbing = true;
        this.scrubWasPlaying = this.isPlaying;

        // Pause playback but don't show overlay
        if (this.isPlaying) {
            this.pause(false);
        }

        // Seek to initial position
        this._seek(e);

        // Attach global listeners
        this._scrubMoveHandler = (e) => this._onScrubMove(e);
        this._scrubEndHandler = (e) => this._onScrubEnd(e);

        document.addEventListener('mousemove', this._scrubMoveHandler);
        document.addEventListener('mouseup', this._scrubEndHandler);
    }

    _onScrubMove(e) {
        if (!this.isScrubbing) return;
        e.preventDefault(); // Prevent text selection
        this._seek(e);
    }

    _onScrubEnd(e) {
        if (!this.isScrubbing) return;

        this.isScrubbing = false;
        document.removeEventListener('mousemove', this._scrubMoveHandler);
        document.removeEventListener('mouseup', this._scrubEndHandler);

        // Resume if it was playing before scrub
        if (this.scrubWasPlaying) {
            this.play();
        }
    }

    /**
     * Seek to a specific time
     * @param {number} time - Time in seconds
     */
    seek(time) {
        this._seekTo(time);
    }

    toggleFullscreen() {
        // iOS requires native video fullscreen
        const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
        if (isIOS && this.isStreamMode && this.streamVideo && this.streamVideo.webkitEnterFullscreen) {
            this.streamVideo.webkitEnterFullscreen();
            return;
        }

        if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.mozFullScreenElement && !document.msFullscreenElement) {
            if (this.container.requestFullscreen) {
                this.container.requestFullscreen().catch(err => {
                    Logger.error(`Error attempting to enable fullscreen: ${err.message}`);
                });
            } else if (this.container.webkitRequestFullscreen) {
                this.container.webkitRequestFullscreen();
            } else if (this.container.mozRequestFullScreen) {
                this.container.mozRequestFullScreen();
            } else if (this.container.msRequestFullscreen) {
                this.container.msRequestFullscreen();
            } else {
                // Fallback: CSS Fullscreen
                this.container.classList.toggle('fullscreen-fallback');
                document.body.classList.toggle('fullscreen-active');
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }

            // Remove fallback classes
            this.container.classList.remove('fullscreen-fallback');
            document.body.classList.remove('fullscreen-active');
        }

        // Update UI immediately for fallback case (native events handle the rest)
        this._updateFullscreenUI();
    }

    _updatePlayPauseUI() {
        if (!this.ui.playBtn) return;

        const use = this.ui.playBtn.querySelector('use');
        if (this.isPlaying) {
            this.ui.playBtn.setAttribute('aria-label', 'Pause');
            this.ui.playBtn.setAttribute('aria-pressed', 'true');
            if (use) use.setAttribute('href', 'assets/icons/sprite.svg#icon-pause');

            // Hide overlay when playing
            if (this.ui.playOverlay) this.ui.playOverlay.style.display = 'none';
        } else {
            this.ui.playBtn.setAttribute('aria-label', 'Play');
            this.ui.playBtn.setAttribute('aria-pressed', 'false');
            if (use) use.setAttribute('href', 'assets/icons/sprite.svg#icon-play');

            // Show overlay when paused, BUT ONLY IF NOT LOADING
            if (this.ui.playOverlay) {
                const isVisible = !this.isLoading && this.config.controls.playOverlay;
                this.ui.playOverlay.style.display = isVisible ? 'flex' : 'none';
            }
        }
    }

    _updateProgress() {
        if (!this.ui.progressBar || !this.ui.progressContainer) return;

        let percent = (this.currentTime / this.duration) * 100;
        if (!isFinite(percent)) percent = 0;

        this.ui.progressBar.style.width = `${percent}%`;
        this.ui.progressContainer.setAttribute('aria-valuenow', Math.round(percent));
        this._updateTimeDisplay();
    }

    _updateTimeDisplay() {
        if (!this.ui.timeDisplay) return;

        const current = formatTime(this.currentTime);
        const duration = formatTime(this.duration);
        this.ui.timeDisplay.textContent = `${current} / ${duration}`;
    }


    _updateFullscreenUI() {
        if (!this.ui.fullscreenBtn) return;

        const use = this.ui.fullscreenBtn.querySelector('use');
        const isFullscreen = document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement ||
            this.container.classList.contains('fullscreen-fallback');

        if (isFullscreen) {
            this.ui.fullscreenBtn.setAttribute('aria-label', 'Exit Fullscreen');
            if (use) use.setAttribute('href', 'assets/icons/sprite.svg#icon-fullscreen-exit');
        } else {
            this.ui.fullscreenBtn.setAttribute('aria-label', 'Fullscreen');
            if (use) use.setAttribute('href', 'assets/icons/sprite.svg#icon-fullscreen');
        }
    }

    /**
     * Set volume (0.0 to 1.0)
     * @param {number} value 
     */
    /**
     * Set loading state
     * Handles mutually exclusive visibility of loader and play overlay
     * @param {boolean} isLoading 
     */
    _setLoading(isLoading) {
        this.isLoading = isLoading;
        if (!this.ui.loader) return;

        if (isLoading) {
            this.ui.loader.style.display = 'block';
            this.ui.loader.classList.add('visible');
            if (this.ui.playOverlay) {
                this.ui.playOverlay.style.display = 'none';
            }
        } else {
            this.ui.loader.style.display = 'none';
            this.ui.loader.classList.remove('visible');
        }
    }

    /**
     * Show bezel overlay (e.g. for volume)
     * @param {string} icon - SVG icon ID (e.g. 'icon-volume-high')
     * @param {string} text - Text to display (e.g. '50%')
     */
    _showBezel(icon, text) {
        if (!this.ui.bezelOverlay) return;

        const iconContainer = this.ui.bezelOverlay.querySelector('.bezel-icon');
        const textContainer = this.ui.bezelOverlay.querySelector('.bezel-text');

        // Update Icon
        if (iconContainer) {
            iconContainer.innerHTML = `
                <svg width="100%" height="100%" fill="currentColor">
                    <use href="assets/icons/sprite.svg#${icon}"></use>
                </svg>`;
        }

        // Update Text
        if (textContainer) {
            textContainer.textContent = text;
        }

        // Show Overlay
        this.ui.bezelOverlay.style.display = 'flex';
        this.ui.bezelOverlay.style.opacity = '1';

        // Clear previous timer
        if (this.bezelTimer) {
            clearTimeout(this.bezelTimer);
        }

        // Hide after delay
        this.bezelTimer = setTimeout(() => {
            this.ui.bezelOverlay.style.opacity = '0';
            setTimeout(() => {
                // Only hide display if opacity is still 0 (timer wasn't reset)
                if (this.ui.bezelOverlay.style.opacity === '0') {
                    this.ui.bezelOverlay.style.display = 'none';
                }
            }, 200); // Wait for transition
            this.bezelTimer = null;
        }, 800);
    }

    setVolume(value) {
        this.config.volume = Math.max(0, Math.min(1, value));
        if (this.config.volume > 0) {
            this.config.muted = false;
        }

        // Handle stream mode volume
        if (this.isStreamMode && this.streamVideo) {
            this.streamVideo.volume = this.config.volume;
            this.streamVideo.muted = this.config.muted;
            if (this.config.muted) {
                this.streamVideo.setAttribute('muted', '');
            } else {
                this.streamVideo.removeAttribute('muted');
            }
        }

        if (this.gainNode) {
            this.gainNode.gain.value = this.config.muted ? 0 : this.config.volume;
        }

        this._updateVolumeUI();

        // Show bezel
        const volumePercent = Math.round(this.config.volume * 100);
        let icon = 'icon-volume-high';
        if (this.config.muted || this.config.volume === 0) icon = 'icon-volume-mute';

        const text = this.config.muted ? 'Muted' : `${volumePercent}%`;
        this._showBezel(icon, text);
    }

    /**
     * Toggle mute state
     */
    toggleMute() {
        this.config.muted = !this.config.muted;

        // Handle stream mode mute
        if (this.isStreamMode && this.streamVideo) {
            this.streamVideo.muted = this.config.muted;
            if (this.config.muted) {
                this.streamVideo.setAttribute('muted', '');
            } else {
                this.streamVideo.removeAttribute('muted');
            }
        }

        if (this.gainNode) {
            this.gainNode.gain.value = this.config.muted ? 0 : this.config.volume;
        }

        this._updateVolumeUI();
    }

    get volume() {
        return this.config.volume;
    }

    get isMuted() {
        return this.config.muted;
    }

    _updateVolumeUI() {
        // Update panel slider and value
        if (this.ui.panelVolumeSlider) {
            this.ui.panelVolumeSlider.value = this.volume;
            // Update background size for slider fill effect if needed, or just value
        }
        if (this.ui.panelVolumeValue) {
            this.ui.panelVolumeValue.textContent = `${Math.round(this.volume * 100)}%`;
        }

        // Update panel mute button icon
        if (this.ui.panelMuteBtn) {
            const use = this.ui.panelMuteBtn.querySelector('use');
            if (use) {
                if (this.isMuted || this.volume === 0) {
                    use.setAttribute('href', 'assets/icons/sprite.svg#icon-volume-mute');
                    this.ui.panelMuteBtn.setAttribute('aria-label', 'Unmute');
                } else {
                    use.setAttribute('href', 'assets/icons/sprite.svg#icon-volume-high');
                    this.ui.panelMuteBtn.setAttribute('aria-label', 'Mute');
                }
            }
        }

        // Update main audio button state
        Logger.log(`[VolumeUI] isMuted=${this.isMuted}, volume=${this.volume}, config.muted=${this.config.muted}, gainValue=${this.gainNode?.gain?.value}, audioSettingsBtn=${!!this.ui.audioSettingsBtn}, muteBtn=${!!this.ui.muteBtn}`);
        this._updateAudioButtonState();
    }

    /**
     * Set callback for when play is requested but no video is loaded
     * @param {Function} callback 
     */
    setPlayCallback(callback) {
        this.onPlayRequest = callback;
    }

    /**
     * Set navigation callbacks for playlist integration
     * @param {Function} onPrevious - Callback for previous video
     * @param {Function} onNext - Callback for next video
     */
    setNavigationCallbacks(onPrevious, onNext) {
        this.onPrevious = onPrevious;
        this.onNext = onNext;
    }

    /**
     * Update navigation button states
     * @param {boolean} canGoPrev - Whether previous navigation is available
     * @param {boolean} canGoNext - Whether next navigation is available
     */
    updateNavigationButtons(canGoPrev, canGoNext) {
        if (this.ui.prevBtn) {
            this.ui.prevBtn.disabled = !canGoPrev;
            this.ui.prevBtn.style.opacity = canGoPrev ? '1' : '0.4';
            this.ui.prevBtn.style.cursor = canGoPrev ? 'pointer' : 'not-allowed';
        }
        if (this.ui.nextBtn) {
            this.ui.nextBtn.disabled = !canGoNext;
            this.ui.nextBtn.style.opacity = canGoNext ? '1' : '0.4';
            this.ui.nextBtn.style.cursor = canGoNext ? 'pointer' : 'not-allowed';
        }
    }
    /**
     * Destroy the player and clean up all resources
     */
    async destroy() {
        // Full reset (stops playback, disposes MediaBunny resources)
        await this.reset();

        // Clear events
        this._events = {};

        // Clean up audio context
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        // Remove global event listeners
        if (this.config.controls.fullscreen) {
            document.removeEventListener('fullscreenchange', this._handlers.fullscreen);
            document.removeEventListener('webkitfullscreenchange', this._handlers.fullscreen);
            document.removeEventListener('mozfullscreenchange', this._handlers.fullscreen);
            document.removeEventListener('MSFullscreenChange', this._handlers.fullscreen);
        }
        document.removeEventListener('visibilitychange', this._handlers.visibilitychange);
        document.removeEventListener('click', this._handlers.click);
        if (this.config.controls.keyboard) {
            document.removeEventListener('keydown', this._handlers.keydown);
        }

        // Remove ResizeObserver
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }

        // Clean up Thumbnail Generator
        if (this.thumbnailGenerator) {
            this.thumbnailGenerator.destroy();
            this.thumbnailGenerator = null;
        }

        // Clean up DOM elements
        if (this.canvas) {
            this.canvas.remove();
            this.canvas = null;
        }
        if (this.ui.controls) {
            this.ui.controls.remove();
        }
        if (this.ui.helpOverlay) {
            this.ui.helpOverlay.remove();
        }
        if (this.ui.loader) {
            this.ui.loader.remove();
        }

        this.container.classList.remove('jellyjump-container');
        this.container = null;
    }

    // ========================================
    // Control Bar Mode Methods
    // ========================================

    /**
     * Load control bar mode from localStorage
     * @private
     */
    _loadControlBarMode() { this.controlBar.loadMode(); }
    _saveControlBarMode() { this.controlBar.saveMode(); }
    toggleControlBarMode() { this.controlBar.toggleMode(); }
    _applyControlBarMode() { this.controlBar.applyMode(); }
    _handleMouseMove(e) { this.controlBar.handleMouseMove(e); }
    _startAutoHideTimer() { this.controlBar.startAutoHideTimer(); }
    _clearAutoHideTimer() { this.controlBar.clearAutoHideTimer(); }
    /**
     * Set controls configuration
     * @param {Object} config - Configuration object with boolean flags for each control
     */
    setControlsConfig(config) {
        this.config.controls = { ...this.config.controls, ...config };
        this._applyControlVisibility();
    }

    /**
     * Toggle a specific control
     * @param {string} name - Name of the control (e.g., 'volume', 'fullscreen')
     * @param {boolean} visible - Whether the control should be visible
     */
    toggleControl(name, visible) {
        if (this.config.controls.hasOwnProperty(name)) {
            this.config.controls[name] = visible;
            this._applyControlVisibility();
        } else {
            Logger.warn(`Control '${name}' not found in configuration.`);
        }
    }

    /**
     * Get current controls configuration
     * @returns {Object}
     */
    getControlsConfig() {
        return { ...this.config.controls };
    }

    /**
     * Set controls preset
     * @param {string} presetName - Name of the preset ('player', 'editor', 'minimal')
     */
    setControlsPreset(presetName) {
        if (this.PRESETS[presetName]) {
            this.setControlsConfig(this.PRESETS[presetName]);
        } else {
            Logger.warn(`Preset '${presetName}' not found.`);
        }
    }

    /**
     * Initialize ResizeObserver to handle responsive layout
     * @private
     */
    _initResizeObserver() {
        if (!this.ui.controls) return;

        this.resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                this._handleResize(entry);
            }
        });

        // Observe the controls container itself to react to its width changes
        this.resizeObserver.observe(this.ui.controls);
    }

    /**
     * Handle resize events
     * @param {ResizeObserverEntry} entry 
     * @private
     */
    _handleResize(entry) {
        const width = entry.contentRect.width;

        // Breakpoints
        const COMPACT_WIDTH = 600;
        const MINIMAL_WIDTH = 400;

        // Reset classes
        this.ui.controls.classList.remove('size-compact', 'size-minimal');

        if (width < MINIMAL_WIDTH) {
            this.ui.controls.classList.add('size-minimal');
        } else if (width < COMPACT_WIDTH) {
            this.ui.controls.classList.add('size-compact');
        }
    }

    // ========================================
    // Phase 19: Default Frame & State
    // ========================================

    /**
     * Handle initial frame display (Saved state or Default)
     * @param {boolean} autoplay - Whether to autoplay
     */
    async _handleInitialFrame(autoplay = false) {
        // Live streams have no meaningful start timestamp — just play
        if (this.isLive) {
            if (autoplay) await this.play().catch(e => Logger.warn('Live autoplay failed:', e));
            return;
        }

        const savedState = this._loadPlaybackState();
        let startTimestamp = 0;

        if (savedState && savedState.videoIdentifier === this.currentVideoId) {
            Logger.log('Restoring playback state:', savedState);
            startTimestamp = savedState.timestamp;
        } else {
            // Default: 50% frame
            Logger.log('No saved state, using default frame');

            if (!autoplay) {
                const middleTimestamp = this.duration * 0.5;
                if (this.videoTrack) {
                    await this._extractAndDrawFrame(middleTimestamp);
                }
                return;
            }
        }

        // If we have a saved state, we seek to it
        this.playbackTimeAtStart = startTimestamp;
        this.currentTime = startTimestamp;
        this._updateProgress();

        Logger.log(`[InitialFrame] Restored state - isAudioMode: ${this.isAudioMode}, playbackTimeAtStart: ${this.playbackTimeAtStart}, currentTime: ${this.currentTime}`);

        // If autoplay is requested, we play immediately
        if (autoplay) {
            try {
                // Race play against a timeout to prevent hanging on iOS/Autoplay restrictions
                const playPromise = this.play();
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Autoplay timeout')), 10000)
                );
                await Promise.race([playPromise, timeoutPromise]);
            } catch (e) {
                Logger.warn('Autoplay failed or timed out:', e);

                // If we failed and weren't muted, try muting and playing again (AutoPlay Policy often allows muted)
                if (!this.config.muted) {
                    Logger.log('Attempting fallback to muted autoplay...');
                    this.config.muted = true;
                    if (this.ui.muteBtn) this._updateVolumeUI(); // Update UI

                    try {
                        // Reset audio context state if needed before retry
                        if (this.audioContext && this.audioContext.state === 'running') {
                            try { await this.audioContext.suspend(); } catch (ignore) { }
                        }
                        await this.play();
                        return; // Success! Return early
                    } catch (retryErr) {
                        Logger.warn('Muted autoplay fallback also failed:', retryErr);
                    }
                }

                Logger.warn('Falling back to paused state.');
                // Ensure we are in a clean state
                this.isPlaying = false;
                this._updatePlayPauseUI();

                // Clean up audio state to ensure next play() works correctly
                if (this.audioBufferIterator) {
                    this.audioBufferIterator.return().catch(() => { });
                    this.audioBufferIterator = null;
                }
                // Suspend AudioContext if it was started
                if (this.audioContext && this.audioContext.state === 'running') {
                    try {
                        await this.audioContext.suspend();
                    } catch (e) {
                        // Ignore suspend errors if already closed/suspended
                    }
                }

                // Clear any queued audio nodes
                for (const node of this.queuedAudioNodes) {
                    try { node.stop(); } catch (e) { }
                }
                this.queuedAudioNodes.clear();

                // Reset audio initialization completely so next play() creates fresh audio nodes
                // This is needed because AudioContext created in suspended state may have issues
                if (this.audioContext) {
                    try { this.audioContext.close(); } catch (e) { }
                    this.audioContext = null;
                    this.gainNode = null;
                    this.isAudioInitialized = false;
                }

                // Fallback: Draw frame and show overlay
                try {
                    await this._startVideoIterator();
                } catch (e) {
                    Logger.warn('Fallback video iterator failed:', e);
                }

                if (this.ui.playOverlay && this.config.controls.playOverlay) this.ui.playOverlay.style.display = 'flex';
                this.isPlaying = false; // Ensure state is correct
            }
        } else {
            try {
                // Otherwise just draw the frame
                await this._startVideoIterator(); // This draws the frame at startTimestamp
            } catch (e) {
                Logger.warn('Initial video iterator failed:', e);
            }
        }
        this._updateVolumeUI();
    }

    /**
     * Extract and draw a frame at a specific timestamp without changing playback state
     * @param {number} timestamp 
     */
    async _extractAndDrawFrame(timestamp) {
        if (!this.videoSink) return;

        // Create a temporary iterator just for this frame
        const iterator = this.videoSink.canvases(timestamp);
        const result = await iterator.next();
        const frame = result.value;

        if (frame) {
            this.ctx.drawImage(frame.canvas, 0, 0, this.canvas.width, this.canvas.height);

            // Execute render callbacks
            if (this.afterFrameRenderCallbacks.length > 0) {
                this.afterFrameRenderCallbacks.forEach(cb => cb(this.canvas, this.ctx));
            }
        }

        await iterator.return();
    }

    _savePlaybackState() {
        if (!this.currentVideoId || this.duration < 1) return;

        const state = {
            videoIdentifier: this.currentVideoId,
            timestamp: this.currentTime,
            savedAt: new Date().toISOString()
        };

        try {
            localStorage.setItem(`jellyjump-state-${this.currentVideoId}`, JSON.stringify(state));
        } catch (e) {
            Logger.warn('Failed to save playback state:', e);
        }
    }

    _loadPlaybackState() {
        if (!this.currentVideoId) return null;
        try {
            const item = localStorage.getItem(`jellyjump-state-${this.currentVideoId}`);
            return item ? JSON.parse(item) : null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Add a callback to be executed after each frame render
     * @param {Function} callback 
     */
    addRenderCallback(callback) {
        if (typeof callback === 'function') {
            this.afterFrameRenderCallbacks.push(callback);
        }
    }

    /**
     * Remove a render callback
     * @param {Function} callback 
     */
    removeRenderCallback(callback) {
        const index = this.afterFrameRenderCallbacks.indexOf(callback);
        if (index !== -1) {
            this.afterFrameRenderCallbacks.splice(index, 1);
        }
    }
}

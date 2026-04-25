/**
 * Core Player Class
 * Composition root — delegates to focused sub-modules for audio, rendering,
 * playback state, UI updates, and stream/media lifecycle management.
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
import { initPlayerAudio, runPlayerAudioIterator } from './audio/AudioEngine.js';
import {
    clearPlayerCanvas,
    disposeMediaBunnyResources,
    resetPlayer,
    cleanupPlayerForLoad,
    setupPlayerMediaTracks,
    handlePlayerHlsState,
    cleanupPlayerAudioMode,
    resetPlayerUI,
    cleanupPlayerMediaBunny,
    startPlayerVideoIterator,
    extractAndDrawPlayerFrame,
    handlePlayerInitialFrame
} from './playback/MediaLifecycle.js';
import {
    getPlayerPlaybackTime,
    handlePlayerVisibilityChange,
    togglePlayerPlay,
    cyclePlayerSpeed,
    stepPlayerFrame,
    seekPlayerTo,
    playerSeek,
    playerScrubStart,
    playerScrubMove,
    playerScrubEnd,
    savePlayerPlaybackState,
    loadPlayerPlaybackState
} from './playback/PlaybackState.js';
import {
    startPlayerRenderLoop,
    updatePlayerNextFrame
} from './playback/RenderLoop.js';
import {
    createStreamController,
    getStreamState,
    setStreamState
} from './streaming/StreamController.js';
import {
    mountPlayerShell,
    initPlayerResizeObserver,
    handlePlayerResize,
    togglePlayerFullscreen
} from '../ui/player/PlayerShell.js';
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
import {
    updatePlayerPlayPauseUI,
    updatePlayerProgress,
    updatePlayerTimeDisplay,
    updatePlayerFullscreenUI,
    setPlayerLoading,
    showPlayerBezel,
    updatePlayerVolumeUI
} from '../ui/player/PlayerUIUpdates.js';
import { PlayerKeyboard } from '../player/PlayerKeyboard.js';
import { PlayerSubtitles } from '../player/PlayerSubtitles.js';
import { PlayerLoopControl } from '../player/PlayerLoopControl.js';
import { PlayerThumbnails } from '../player/PlayerThumbnails.js';
import { PlayerControlBar } from '../player/PlayerControlBar.js';

import { StreamDetector } from '../utils/StreamDetector.js';
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

        this.controlBarMode = options.controlBarMode || CONTROL_BAR_MODE_DEFAULT;
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
        this.audioIteratorCleanupPromise = null;

        // Subtitles
        this.subtitleManager = null;
        this.isSubtitlesEnabled = false;
        this.subtitleTracks = [];
        this.activeSubtitleTrackId = null;
        this.subtitleTrackCounter = 0;
        this.onSubtitleChange = null;

        // Screenshot Manager — lazily initialized
        this.screenshotManager = null;

        // Web Audio API
        this.audioContext = null;
        this.gainNode = null;
        this.nextAudioTime = 0;
        this.isAudioInitialized = false;
        this.currentAudioSource = null;
        this.activeSources = [];
        this._vodAnchorWall = undefined;
        this._vodAnchorContent = undefined;
        this.playbackId = 0;

        // MediaBunny playback state
        this.videoFrameIterator = null;
        this.audioBufferIterator = null;
        this.nextFrame = null;
        this.queuedAudioNodes = new Set();
        this.asyncId = 0;
        this.playbackTimeAtStart = 0;
        this.audioContextStartTime = null;

        // Thumbnail Generator
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

        this.currentVideoId = null;
        this.sourceUrl = null;

        // Stream / Webcam playback
        this.stream = null;

        // Audio-only playback
        this.audioVisualizer = null;
        this.isAudioMode = false;
        this.audioElement = null;

        // Global Event Handlers
        this._handlers = {
            click: (e) => this._handleDocumentClick(e),
            visibilitychange: () => this._handleVisibilityChange()
        };
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

    // ─── Stream state proxies ────────────────────────────────────────────────────
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

    _init() {
        mountPlayerShell(this);

        if (this.config.controls.captions) {
            this.subtitleManager = new SubtitleManager();
        }
        if (this.config.controls.settings) {
            this.screenshotManager = new ScreenshotManager(this);
        }

        this._createControls();

        if (this.config.controls.keyboard) {
            this._createHelpOverlay();
        }

        this._attachEvents();

        if (this.config.controls.controlBar) {
            this._applyControlBarMode();
        }
        if (this.config.controls.fullscreen) {
            this._initResizeObserver();
        }
    }

    // ─── UI Shell ────────────────────────────────────────────────────────────────
    _createHelpOverlay() { createHelpOverlay(this); }
    _createControls() { createPlayerControls(this); }
    _attachEvents() { attachPlayerBindings(this); }
    _initResizeObserver() { initPlayerResizeObserver(this); }
    _handleResize(entry) { handlePlayerResize(this, entry); }
    toggleFullscreen() { togglePlayerFullscreen(this); }

    _applyControlVisibility() {
        if (!this.ui.controls) return;
        const c = this.config.controls;
        this.ui.controls.querySelectorAll('[data-control]').forEach(el => {
            const controlName = el.dataset.control;
            if (c[controlName]) el.classList.remove('control--hidden');
        });
    }

    // ─── Event emitter ───────────────────────────────────────────────────────────
    on(event, callback) {
        if (!this._events[event]) this._events[event] = [];
        this._events[event].push(callback);
    }

    off(event, callback) {
        if (!this._events[event]) return;
        this._events[event] = this._events[event].filter(cb => cb !== callback);
    }

    trigger(event, data = {}) {
        if (!this._events[event]) return;
        this._events[event].forEach(callback => callback(data));
    }

    // ─── UI Updates ──────────────────────────────────────────────────────────────
    _updatePlayPauseUI() { updatePlayerPlayPauseUI(this); }
    _updateProgress() { updatePlayerProgress(this); }
    _updateTimeDisplay() { updatePlayerTimeDisplay(this); }
    _updateFullscreenUI() { updatePlayerFullscreenUI(this); }
    _setLoading(isLoading) { setPlayerLoading(this, isLoading); }
    _showBezel(icon, text) { showPlayerBezel(this, icon, text); }
    _updateVolumeUI() { updatePlayerVolumeUI(this); }

    // ─── Panel helpers ───────────────────────────────────────────────────────────
    _handleDocumentClick(e) { handlePlayerDocumentClick(this, e); }
    _updateSpeedMenu() { updatePlayerSpeedMenu(this); }
    toggleFilterPanel() { togglePlayerFilterPanel(this); }
    toggleSpeedPanel() { togglePlayerSpeedPanel(this); }
    toggleSubtitlePanel() { togglePlayerSubtitlePanel(this); }
    _syncFilterSliders() { syncPlayerFilterSliders(this); }
    _updateFiltersButtonState() { updatePlayerFiltersButtonState(this); }
    toggleAudioPanel() { togglePlayerAudioPanel(this); }
    _syncEqSliders() { syncPlayerEqSliders(this); }
    _updateAudioButtonState() { updatePlayerAudioButtonState(this); }

    // ─── Loop ────────────────────────────────────────────────────────────────────
    toggleLoopMode() { this.loop.toggleLoopMode(); }
    toggleLoopPanel() { this.loop.toggleLoopPanel(); }
    setLoopStart() { this.loop.setLoopStart(); }
    setLoopEnd() { this.loop.setLoopEnd(); }
    clearLoopMarkers() { this.loop.clearLoopMarkers(); }
    resetLoop() { this.loop.resetLoop(); }
    _updateLoopUI() { this.loop.updateLoopUI(); }

    // ─── Thumbnail helpers ───────────────────────────────────────────────────────
    _createThumbnailOverlay() { this.thumbnails.createOverlay(); }
    _handleThumbnailHover(e) { this.thumbnails.handleHover(e); }
    _updateThumbnailImage(time) { this.thumbnails.updateImage(time); }
    _handleThumbnailLeave() { this.thumbnails.handleLeave(); }
    async _startThumbnailGeneration() { return this.thumbnails.startGeneration(); }
    _cleanupThumbnails() { this.thumbnails.cleanup(); }

    // ─── Subtitle / audio track helpers ─────────────────────────────────────────
    _updateSubtitleMenu() { this.subtitles.updateSubtitleMenu(); }
    _switchSubtitleTrack(trackId) { this.subtitles.switchSubtitleTrack(trackId); }
    async _switchAudioTrack(trackId) { return this.subtitles.switchAudioTrack(trackId); }
    async _updateAudioTracks() { return this.subtitles.updateAudioTracks(); }
    _restoreSavedSubtitles(savedSubtitles) { this.subtitles.restoreSavedSubtitles(savedSubtitles); }
    async loadSubtitle(url) { return this.subtitles.loadSubtitle(url); }
    _renderSubtitles(timestamp) { this.subtitles.renderSubtitles(timestamp); }

    // ─── Keyboard ────────────────────────────────────────────────────────────────
    _handleKeyboard(e) { this.keyboard.handleKeyboard(e); }
    _toggleHelp() { this.keyboard.toggleHelp(); }

    // ─── Control Bar Mode ────────────────────────────────────────────────────────
    _loadControlBarMode() { this.controlBar.loadMode(); }
    _saveControlBarMode() { this.controlBar.saveMode(); }
    toggleControlBarMode() { this.controlBar.toggleMode(); }
    _applyControlBarMode() { this.controlBar.applyMode(); }
    _handleMouseMove(e) { this.controlBar.handleMouseMove(e); }
    _startAutoHideTimer() { this.controlBar.startAutoHideTimer(); }
    _clearAutoHideTimer() { this.controlBar.clearAutoHideTimer(); }

    // ─── Stream helpers ──────────────────────────────────────────────────────────
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
    async _cleanupMediaBunny() { return cleanupPlayerMediaBunny(this); }
    _cleanupHLS() { this.stream.cleanupHLS(); }
    _createErrorOverlay() { this.stream.createErrorOverlay(); }
    _showStreamError(errorDetails) { this.stream.showStreamError(errorDetails); }
    _hideStreamError() { this.stream.hideStreamError(); }
    async _startLiveVideoLoop() { return this.stream.startLiveVideoLoop(); }

    // ─── Audio ───────────────────────────────────────────────────────────────────
    _initAudio() { initPlayerAudio(this); }
    _cleanupAudio() { cleanupPlayerAudioMode(this); }
    async _runAudioIterator(anchorWall, anchorContent, prefetchedSample) {
        return runPlayerAudioIterator(this, anchorWall, anchorContent, prefetchedSample);
    }

    // ─── Render loop ─────────────────────────────────────────────────────────────
    _startRenderLoop() { startPlayerRenderLoop(this); }
    async _updateNextFrame() { return updatePlayerNextFrame(this); }

    // ─── Media Lifecycle ─────────────────────────────────────────────────────────
    _clearCanvas() { clearPlayerCanvas(this); }
    _disposeMediaBunnyResources() { disposeMediaBunnyResources(this); }
    async reset() { return resetPlayer(this); }
    async _cleanupForLoad() { return cleanupPlayerForLoad(this); }
    async _setupMediaTracks(url, isHls) { return setupPlayerMediaTracks(this, url, isHls); }
    async _handleHLSState() { return handlePlayerHlsState(this); }
    resetUI() { resetPlayerUI(this); }
    async _startVideoIterator() { return startPlayerVideoIterator(this); }
    async _extractAndDrawFrame(timestamp) { return extractAndDrawPlayerFrame(this, timestamp); }
    async _handleInitialFrame(autoplay = false) { return handlePlayerInitialFrame(this, autoplay); }

    // ─── Playback State ──────────────────────────────────────────────────────────
    _getPlaybackTime() { return getPlayerPlaybackTime(this); }
    async _handleVisibilityChange() { return handlePlayerVisibilityChange(this); }
    togglePlay() { togglePlayerPlay(this); }
    _cycleSpeed(direction) { cyclePlayerSpeed(this, direction); }
    _stepFrame(direction) { stepPlayerFrame(this, direction); }
    async _seekTo(time) { return seekPlayerTo(this, time); }
    _seek(e) { playerSeek(this, e); }
    _onScrubStart(e) { playerScrubStart(this, e); }
    _onScrubMove(e) { playerScrubMove(this, e); }
    _onScrubEnd(e) { playerScrubEnd(this, e); }
    seek(time) { this._seekTo(time); }
    _savePlaybackState() { savePlayerPlaybackState(this); }
    _loadPlaybackState() { return loadPlayerPlaybackState(this); }

    // ─── Load ────────────────────────────────────────────────────────────────────
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

    // ─── Play ────────────────────────────────────────────────────────────────────
    async play() {
        this.stream.onPlay();

        const streamHandled = await this.stream.playStream();
        if (streamHandled) return;

        this._updateVolumeUI();

        if (this.isPlaying) return;
        if (!this.videoTrack && !this.audioTrack) return;

        Logger.log(`[Play] Starting playback - isAudioMode: ${this.isAudioMode}, playbackTimeAtStart: ${this.playbackTimeAtStart}`);

        try {
            this._initAudio();

            if (this.audioContext && this.audioContext.state === 'suspended') {
                const resumePromise = this.audioContext.resume();
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('AudioContext resume timed out')), 500)
                );
                await Promise.race([resumePromise, timeoutPromise]);
            }
        } catch (e) {
            Logger.warn('[Play] AudioContext blocked/failed:', e);
            Logger.log('[Play] Auto-muting due to audio block...');
            this._wasMutedForAutoplay = true;
            if (!this.config.muted) {
                this.config.muted = true;
                if (this.gainNode) this.gainNode.gain.value = 0;
                if (this.ui.muteBtn) this._updateVolumeUI();
            }
        }

        if (this.isLive) {
            Logger.log(`[Play:Live] isLive=${this.isLive}, videoTrack=${!!this.videoTrack}, audioContext=${!!this.audioContext}, audioCtxTime=${this.audioContext?.currentTime?.toFixed(3)}`);
            if (this.videoTrack) {
                try {
                    const currentLiveEdge = await this.videoTrack.getDurationFromMetadata({ skipLiveWait: true });
                    this._liveStartTimestamp = currentLiveEdge ?? 0;
                    Logger.log(`[Play:Live] Current live edge: ${currentLiveEdge?.toFixed(3)}, starting from: ${this._liveStartTimestamp.toFixed(3)}`);
                } catch (e) {
                    Logger.warn(`[Play:Live] Failed to get duration, using fallback`);
                    if (this.audioContext) {
                        this._liveStartTimestamp = Date.now() / 1000 - 5;
                    }
                }
            } else {
                Logger.warn(`[Play:Live] No videoTrack, using existing _liveStartTimestamp`);
            }
            this._startLiveVideoLoop();
        } else if (this.duration > 0 && this._getPlaybackTime() >= this.duration - 0.1) {
            this.playbackTimeAtStart = 0;
            await this._startVideoIterator();
        } else if (!this.videoFrameIterator) {
            await this._startVideoIterator();
        }

        this.fallbackStartTime = performance.now();

        this.isPlaying = true;
        this._updatePlayPauseUI();

        if (this.audioSink) {
            if (!this.isLive) {
                const startTime = this.playbackTimeAtStart;
                if (this.audioBufferIterator) await this.audioBufferIterator.return();
                Logger.log(`[Play] Starting audio iterator at time: ${startTime.toFixed(2)}s`);
                this.audioBufferIterator = this.audioSink.samples(startTime);

                const firstResult = await this.audioBufferIterator.next();
                const vodPrefetchedSample = firstResult?.value ?? null;

                const vodAnchorWall = this.audioContext.currentTime + 0.02;
                const vodAnchorContent = vodPrefetchedSample?.timestamp ?? startTime;
                this._vodAnchorWall = vodAnchorWall;
                this._vodAnchorContent = vodAnchorContent;
                Logger.log(`[Play] VOD anchor prefetched — wall=${vodAnchorWall.toFixed(3)}, content=${vodAnchorContent.toFixed(3)}, sample=${vodPrefetchedSample ? 'ok' : 'null'}`);

                this._runAudioIterator(vodAnchorWall, vodAnchorContent, vodPrefetchedSample);
            }

            if (this.isAudioMode) {
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

        if (this.controlBarMode === 'overlay') {
            setTimeout(() => {
                if (this.isPlaying && this.controlBarMode === 'overlay') {
                    this._startAutoHideTimer();
                }
            }, 500);
        }

        if (this.ui.playOverlay) {
            this.ui.playOverlay.style.display = 'none';
        }
    }

    // ─── Pause ───────────────────────────────────────────────────────────────────
    pause(showOverlay = true) {
        Logger.log("Player.pause() called");

        this.stream.onPause();

        const streamHandled = this.stream.pauseStream(showOverlay);
        if (streamHandled) return;

        const calculatedTime = this._getPlaybackTime();

        if (calculatedTime < 0.1 && this.currentTime > 1.0) {
            Logger.warn(`[Pause] Correction: _getPlaybackTime returned ${calculatedTime} but currentTime is ${this.currentTime}. Keeping ${this.currentTime}.`);
            this.playbackTimeAtStart = this.currentTime;
        } else {
            this.playbackTimeAtStart = calculatedTime;
        }
        this.isPlaying = false;
        this._clearAutoHideTimer();

        this._updatePlayPauseUI();

        if (this.audioBufferIterator) {
            const iterator = this.audioBufferIterator;
            this.audioBufferIterator = null;
            this.audioIteratorCleanupPromise = iterator.return().catch(e => {
                Logger.debug("Error closing audio iterator:", e);
            }).finally(() => {
                this.audioIteratorCleanupPromise = null;
            });
        }

        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        if (this.audioContext && this.audioContext.state === 'running') {
            this.audioContext.suspend();
        }

        for (const node of this.queuedAudioNodes) {
            try { node.stop(); } catch (e) { }
        }
        this.queuedAudioNodes.clear();

        this._savePlaybackState();

        if (this.ui.playOverlay && !this.isLoading) {
            const shouldShow = showOverlay && this.config.controls.playOverlay;
            this.ui.playOverlay.style.display = shouldShow ? 'flex' : 'none';
        }

        if (this.isAudioMode && this.audioVisualizer) {
            this.audioVisualizer.stop();
        }
    }

    // ─── Playback Rate ───────────────────────────────────────────────────────────
    async setPlaybackRate(rate) {
        if (rate < 0.25 || rate > 2) return;

        const wasPlaying = this.isPlaying;
        const currentPosition = this._getPlaybackTime();

        if (wasPlaying) {
            this.pause();
            if (this.audioIteratorCleanupPromise) {
                await this.audioIteratorCleanupPromise;
            }
        }

        this.playbackRate = rate;
        localStorage.setItem('jellyjump-speed', rate);
        this._updateSpeedMenu();

        if (wasPlaying) {
            await this._seekTo(currentPosition);
            await this.play();
        }
    }

    // ─── Volume / Mute ───────────────────────────────────────────────────────────
    get volume() { return this.config.volume; }
    get isMuted() { return this.config.muted; }

    setVolume(value) {
        this.config.volume = Math.max(0, Math.min(1, value));
        if (this.config.volume > 0) this.config.muted = false;

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

        const volumePercent = Math.round(this.config.volume * 100);
        let icon = 'icon-volume-high';
        if (this.config.muted || this.config.volume === 0) icon = 'icon-volume-mute';
        this._showBezel(icon, this.config.muted ? 'Muted' : `${volumePercent}%`);
    }

    toggleMute() {
        this.config.muted = !this.config.muted;

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

    // ─── Navigation ──────────────────────────────────────────────────────────────
    setPlayCallback(callback) { this.onPlayRequest = callback; }

    setNavigationCallbacks(onPrevious, onNext) {
        this.onPrevious = onPrevious;
        this.onNext = onNext;
    }

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

    // ─── Controls Config ─────────────────────────────────────────────────────────
    setControlsConfig(config) {
        this.config.controls = { ...this.config.controls, ...config };
        this._applyControlVisibility();
    }

    toggleControl(name, visible) {
        if (this.config.controls.hasOwnProperty(name)) {
            this.config.controls[name] = visible;
            this._applyControlVisibility();
        } else {
            Logger.warn(`Control '${name}' not found in configuration.`);
        }
    }

    getControlsConfig() { return { ...this.config.controls }; }

    setControlsPreset(presetName) {
        if (this.PRESETS[presetName]) {
            this.setControlsConfig(this.PRESETS[presetName]);
        } else {
            Logger.warn(`Preset '${presetName}' not found.`);
        }
    }

    // ─── Render Callbacks ────────────────────────────────────────────────────────
    addRenderCallback(callback) {
        if (typeof callback === 'function') {
            this.afterFrameRenderCallbacks.push(callback);
        }
    }

    removeRenderCallback(callback) {
        const index = this.afterFrameRenderCallbacks.indexOf(callback);
        if (index !== -1) {
            this.afterFrameRenderCallbacks.splice(index, 1);
        }
    }

    // ─── Destroy ─────────────────────────────────────────────────────────────────
    async destroy() {
        await this.reset();

        this._events = {};

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

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

        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }

        if (this.thumbnailGenerator) {
            this.thumbnailGenerator.destroy();
            this.thumbnailGenerator = null;
        }

        if (this.canvas) {
            this.canvas.remove();
            this.canvas = null;
        }
        if (this.ui.controls) this.ui.controls.remove();
        if (this.ui.helpOverlay) this.ui.helpOverlay.remove();
        if (this.ui.loader) this.ui.loader.remove();

        this.container.classList.remove('jellyjump-container');
        this.container = null;
    }
}

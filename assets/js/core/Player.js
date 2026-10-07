/**
 * Core Player Class
 * Composition root — delegates to focused sub-modules for audio, rendering,
 * playback state, UI updates, and stream/media lifecycle management.
 */

import { MediaBunny } from './MediaBunny.js';
import {
    onPlayerEvent,
    offPlayerEvent,
    triggerPlayerEvent
} from './PlayerEvents.js';
import {
    PLAYER_CONFIG,
    PLAYER_CONTROL_DEFAULTS,
    PLAYER_CONTROL_PRESETS,
    CONTROL_BAR_MODE_DEFAULT
} from './config.js';
import { ScreenshotManager } from '../ui/player/ScreenshotManager.js';
import { hasOverlays } from '../ui/player/OverlayCompositor.js';
import {
    closePlayerAudioBufferIterator,
    closePlayerAudioBufferIteratorSoon,
    closePlayerAudioContext,
    initPlayerAudio,
    restorePlayerAutoplayAudio,
    runPlayerAudioIterator,
    startPlayerAudioVisualizer,
    stopPlayerQueuedAudio,
    suspendPlayerAudioContext,
    syncPlayerAudioGain
} from './audio/AudioEngine.js';
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
    handlePlayerInitialFrame,
    loadPlayerMedia,
} from './playback/MediaLifecycle.js';
import {
    getPlayerPlaybackTime,
    handlePlayerVisibilityChange,
    togglePlayerPlay,
    cyclePlayerSpeed,
    stepPlayerFrame,
    seekPlayerTo,
    requestPlayerSeek,
    completePlayerMedia,
    playerSeek,
    playerScrubStart,
    playerScrubMove,
    playerScrubEnd,
    savePlayerPlaybackState,
    loadPlayerPlaybackState
} from './playback/PlaybackState.js';
import {
    playPlayer,
    pausePlayer,
    setPlayerPlaybackRate
} from './playback/PlaybackTransport.js';
import {
    startPlayerRenderLoop,
    updatePlayerNextFrame
} from './playback/RenderLoop.js';
import { parseYouTubeUrl } from '../shared/utils/YouTubeUrl.js';
import {
    loadPlayerYouTube,
    cancelYouTubeAutoplayRetry,
    suspendPlayerYouTube,
    teardownPlayerYouTube,
    syncYouTubeAudio
} from './youtube/YouTubePlayback.js';
import { PlayerStream } from './streaming/PlayerStream.js';
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
import { PlayerKeyboard } from '../ui/player/PlayerKeyboard.js';
import { PlayerSubtitles } from '../ui/player/PlayerSubtitles.js';
import { PlayerLoopControl } from '../ui/player/PlayerLoopControl.js';
import { PlayerThumbnails } from '../ui/player/PlayerThumbnails.js';
import { PlayerControlBar } from '../ui/player/PlayerControlBar.js';

import { StreamDetector } from '../shared/utils/StreamDetector.js';
import { Logger } from '../shared/utils/Logger.js';
import { MediaTracks } from './playback/MediaTracks.js';
import { PlaybackEpoch } from './playback/PlaybackEpoch.js';
import { PlaybackAnchor } from './playback/PlaybackAnchor.js';
import { BroadcastStream } from './streaming/BroadcastStream.js';
import { WatchParty } from './streaming/WatchParty.js';
import { VideoFrameQueue } from './playback/VideoFrameQueue.js';
import { AudioBufferQueue } from './audio/AudioBufferQueue.js';

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

        // Which pipeline is playing. 'mediabunny' decodes and paints frames
        // itself; 'youtube' hands the video to YouTube's iframe and can only
        // drive it. Features ask capabilities rather than testing this, so a
        // third engine later does not mean editing every menu again.
        this.engine = 'mediabunny';
        this.capabilities = { canvasFrames: true, audioGraph: true };
        this.youtube = null;

        this.controlBarMode = options.controlBarMode || CONTROL_BAR_MODE_DEFAULT;
        this.autoHideTimer = null;

        this.config.controls = {
            ...PLAYER_CONTROL_DEFAULTS,
            ...this.config.controls
        };

        this.PRESETS = PLAYER_CONTROL_PRESETS;

        // The demuxed source and what is read from it. Owned by the
        // component; exposed below as read-only views so the nine files that
        // read these keep working untouched.
        this.media = new MediaTracks();

        // Subtitles
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
        this.vodAnchor = new PlaybackAnchor();
        this.playbackId = 0;

        // MediaBunny playback state
        this.queuedAudioNodes = new Set();
        this.epoch = new PlaybackEpoch();
        this.frames = new VideoFrameQueue(this.epoch);
        this.audioBuffers = new AudioBufferQueue();
        this.broadcast = new BroadcastStream(this);
        this.watchParty = new WatchParty(this);
        this.playbackTimeAtStart = 0;
        this.audioContextStartTime = null;

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

        this.stream = new PlayerStream(this);
        this.keyboard = new PlayerKeyboard(this);
        this.subtitles = new PlayerSubtitles(this);
        this.loop = new PlayerLoopControl(this);
        this.thumbnails = new PlayerThumbnails(this);
        this.controlBar = new PlayerControlBar(this);
        this._init();
    }

    _init() {
        mountPlayerShell(this);

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
    on(event, callback) { onPlayerEvent(this, event, callback); }
    off(event, callback) { offPlayerEvent(this, event, callback); }
    trigger(event, data = {}) { triggerPlayerEvent(this, event, data); }

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
    async loadSubtitle(url, name) { return this.subtitles.loadSubtitle(url, name); }
    async generateSubtitles(opts) { return this.subtitles.generateSubtitles(opts); }
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
    _setupStreamVideoEvents() { this.stream.setupStreamVideoEvents(); }
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
    async _startLiveVideoLoop(force = false) { return this.stream.startLiveVideoLoop(force); }

    // ─── Audio ───────────────────────────────────────────────────────────────────
    _initAudio() { initPlayerAudio(this); }
    _cleanupAudio() { cleanupPlayerAudioMode(this); }
    _syncAudioGain() {
        // Every volume and mute change funnels through here, so this is the one
        // place the embed needs telling — branching in setVolume and toggleMute
        // separately would be the same fix written twice.
        if (this.engine === 'youtube') return syncYouTubeAudio(this);
        return syncPlayerAudioGain(this);
    }
    async _closeAudioContext() { return closePlayerAudioContext(this); }
    async _suspendAudioContext() { return suspendPlayerAudioContext(this); }
    _stopQueuedAudio() { stopPlayerQueuedAudio(this); }
    async _closeAudioBufferIterator() { return closePlayerAudioBufferIterator(this); }
    _closeAudioBufferIteratorSoon() { closePlayerAudioBufferIteratorSoon(this); }
    _restoreAutoplayAudio(sourceLabel) { return restorePlayerAutoplayAudio(this, sourceLabel); }
    async _runAudioIterator(iterator, anchorWall, anchorContent, prefetchedSample) {
        return runPlayerAudioIterator(this, iterator, anchorWall, anchorContent, prefetchedSample);
    }

    // ─── Render loop ─────────────────────────────────────────────────────────────
    _startRenderLoop() { startPlayerRenderLoop(this); }
    async _updateNextFrame() { return updatePlayerNextFrame(this); }

    // ─── Media Lifecycle ─────────────────────────────────────────────────────────
    _clearCanvas() { clearPlayerCanvas(this); }
    _disposeMediaBunnyResources() { disposeMediaBunnyResources(this); }
    async reset() {
        // A reset is the end of playback, not a step between two videos, so
        // the kept-alive embed goes with it.
        teardownPlayerYouTube(this);
        return resetPlayer(this);
    }
    async _cleanupForLoad() {
        // Always, not only when leaving YouTube: this runs before every load,
        // and a playing iframe left visible would sit on top of the next video.
        // Suspended rather than destroyed — load() destroys it once it knows
        // the next video is not another YouTube link.
        suspendPlayerYouTube(this);
        return cleanupPlayerForLoad(this);
    }
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
    async _seekTo(time) {
        if (this.engine === 'youtube') {
            this.youtube?.seek(time);
            this.currentTime = Math.max(0, time);
            this._updateProgress();
            return;
        }
        return seekPlayerTo(this, time);
    }
    _requestSeek(time) { requestPlayerSeek(this, time); }
    _completeMedia() { completePlayerMedia(this); }
    _seek(e) { playerSeek(this, e); }
    _onScrubStart(e) { playerScrubStart(this, e); }
    _onScrubMove(e) { playerScrubMove(this, e); }
    _onScrubEnd(e) { playerScrubEnd(this, e); }
    seek(time) { this._seekTo(time); }
    _savePlaybackState() { savePlayerPlaybackState(this); }
    _loadPlaybackState() { return loadPlayerPlaybackState(this); }

    // ─── Load ────────────────────────────────────────────────────────────────────
    async load(url, autoplay = false, videoId = null, savedSubtitles = null) {
        return loadPlayerMedia(this, url, autoplay, videoId, savedSubtitles);
    }

    // ─── Play ────────────────────────────────────────────────────────────────────
    async play() {
        if (this.engine === 'youtube') { this.youtube?.play(); return; }
        return playPlayer(this);
    }

    // ─── Pause ───────────────────────────────────────────────────────────────────
    pause(showOverlay = true) {
        if (this.engine === 'youtube') {
            // Pausing overrules a pending autoplay retry: without this, a video
            // stopped within the retry window would start itself again.
            cancelYouTubeAutoplayRetry(this);
            this.youtube?.pause();
            return;
        }
        return pausePlayer(this, showOverlay);
    }

    // ─── Playback Rate ───────────────────────────────────────────────────────────
    async setPlaybackRate(rate) {
        if (this.engine === 'youtube') {
            this.playbackRate = rate;
            this.youtube?.setRate(rate);
            return;
        }
        return setPlayerPlaybackRate(this, rate);
    }

    // ─── Volume / Mute ───────────────────────────────────────────────────────────
    get volume() { return this.config.volume; }
    get isMuted() { return this.config.muted; }

    setVolume(value) {
        this.config.volume = Math.max(0, Math.min(1, value));
        if (this.config.volume > 0) this.config.muted = false;

        this.stream.syncVolumeState();

        this._syncAudioGain();

        this._updateVolumeUI();

        const volumePercent = Math.round(this.config.volume * 100);
        let icon = 'icon-volume-high';
        if (this.config.muted || this.config.volume === 0) icon = 'icon-volume-mute';
        this._showBezel(icon, this.config.muted ? 'Muted' : `${volumePercent}%`);
    }

    toggleMute() {
        this.config.muted = !this.config.muted;

        this.stream.syncVolumeState();

        this._syncAudioGain();

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

    /**
     * The clock that animated overlays run on.
     *
     * A file has a timeline, so its decorations must follow that rather than
     * the wall clock: otherwise seeking backwards does not take them back with
     * you, playing the same file twice gives different results, and a
     * screenshot -- which re-composites the frame and reads the clock again --
     * saves a different moment of the animation than the one on screen.
     *
     * A camera or a live stream has no timeline to be consistent with, so
     * there the wall clock is the only sensible answer. Paused, a file's
     * decorations hold still along with the picture, which is what makes the
     * screenshot match.
     *
     * @returns {number} milliseconds
     */
    overlayTimeMs() {
        if (this.isStreamMode) return performance.now();
        return (this.currentTime || 0) * 1000;
    }

    /**
     * Decide whether the colour effects go into the pixels or onto the element.
     *
     * A filter treats the footage; a sticker is a thing put on top of it. So a
     * flower stays pink over a black-and-white clip rather than going grey
     * with it -- which is what every camera app does, and what this app's own
     * camera and export have always done. Playback was the odd one out: its
     * colour is a CSS filter over the whole canvas, stickers included.
     *
     * Baking is the only way to get that order right, and it costs a filter
     * per frame on the main thread. So it is switched on exactly when
     * something has to sit above the colour -- which means a plain filtered
     * video, however large, never pays for it. The camera always bakes
     * regardless: its recorder reads canvas pixels and a CSS filter is
     * invisible to it.
     */
    _syncOverlayBaking() {
        if (!this.videoFilters) return;
        const needed = !!this.isStreamMode
            || hasOverlays({ stickers: this.stickers, decorations: this.decorations });
        this.videoFilters.setCanvasMode(needed);
    }

    // ─── The current source ──────────────────────────────────────────────────────
    //
    // Read-only on purpose. Everything that writes these goes through
    // player.media -- the load pipeline, and one place in the subtitle code
    // that swaps the audio track.
    //
    // Assigning to one of these cannot shadow the component: the getter keeps
    // returning the real value either way. Inside the app it also fails
    // loudly, since every file is an ES module and therefore strict -- checked
    // in a browser, a strict-mode assignment throws TypeError while the same
    // line typed into a console is silently discarded. Worth knowing before
    // concluding from the console that the write worked.

    /**
     * Whether playback is running.
     *
     * An accessor rather than a field because four engines write it -- the
     * transport, the live stream, the webcam path and the YouTube embed, in
     * five files and eighteen places -- and the play/pause button has to
     * follow every one of them. Twelve of those writes remembered to call
     * _updatePlayPauseUI() on the next line. The other five did not, and
     * relied on something nearby doing it: the webcam path plays immediately
     * afterwards, and one is a redundant second assignment of a value already
     * set. That leaves the three YouTube sites -- load, suspend and teardown
     * -- where nothing visibly pairs with the write. Measuring those needs the
     * real embed, so whether the button was ever actually stale there is
     * unverified.
     *
     * Making it a setter turns the convention into something the code cannot
     * forget, whichever of those five was a latent bug and which was merely
     * fragile. On every path that can be driven in a test -- load, play,
     * pause, seek both ways, reaching the end, reload while playing, and the
     * webcam -- the button behaves exactly as it did before.
     *
     * Every existing write keeps its exact syntax, and the explicit
     * calls that were already there are left alone -- they also refresh the
     * overlay, which depends on isLoading and so can need updating when the
     * flag itself has not moved.
     */
    get isPlaying() { return this._isPlaying; }
    set isPlaying(value) {
        if (this._isPlaying === value) return;
        this._isPlaying = value;
        // The constructor sets this before `ui` is built, and the reset paths
        // can run while it is being rebuilt.
        if (this.ui) this._updatePlayPauseUI();
    }

    // ─── Stream state ────────────────────────────────────────────────────────────
    // These live on PlayerStream, and the player exposes them because the UI,
    // the render loop and the transport all ask the player. They used to be
    // installed onto each instance by a loop over a key list in
    // StreamController, which meant that grepping Player.js for `isLive` --
    // read 27 times across the app, four of them every frame -- found nothing
    // at all, and the only way to learn the property existed was to find the
    // list. Written out, the player's surface is its source.
    //
    // The getters tolerate a missing stream: there is a window in the
    // constructor, between `this.stream = null` and the real one being built,
    // where nothing reads them today but a read would otherwise throw.
    get isStreamMode() { return this.stream?.isStreamMode; }
    set isStreamMode(value) { this.stream.isStreamMode = value; }

    get isLive() { return this.stream?.isLive; }
    set isLive(value) { this.stream.isLive = value; }

    get streamVideo() { return this.stream?.streamVideo; }
    set streamVideo(value) { this.stream.streamVideo = value; }

    get isWebcamMode() { return this.stream?.isWebcamMode; }
    set isWebcamMode(value) { this.stream.isWebcamMode = value; }

    get _liveStartTimestamp() { return this.stream?._liveStartTimestamp; }
    set _liveStartTimestamp(value) { this.stream._liveStartTimestamp = value; }

    get _wasMutedForAutoplay() { return this.stream?._wasMutedForAutoplay; }
    set _wasMutedForAutoplay(value) { this.stream._wasMutedForAutoplay = value; }

    get _isMediaReady() { return this.stream?._isMediaReady; }
    set _isMediaReady(value) { this.stream._isMediaReady = value; }

    get input() { return this.media.input; }
    get videoTrack() { return this.media.videoTrack; }
    get videoSink() { return this.media.videoSink; }
    get audioTrack() { return this.media.audioTrack; }
    get audioSink() { return this.media.audioSink; }

    // ─── Frame presentation ──────────────────────────────────────────────────────

    /**
     * Put one frame on screen. The single way anything reaches the canvas:
     * decoded file frames, live frames and the camera all come through here.
     *
     * It exists because the three steps -- draw the frame, apply the effects,
     * run whatever draws over it -- were hand-copied at nine call sites, and a
     * copy that forgets the third step is invisible until someone tries to
     * draw over that path. The camera was one such copy, and three sites in
     * the live loop still were.
     *
     * @param {CanvasImageSource} source
     * @param {{clear?: boolean}} [options] - clear first, for sources that may
     *   not cover the canvas (a resolution change mid-stream leaves a border
     *   of the previous frame otherwise).
     */
    presentFrame(source, { clear = false } = {}) {
        if (!source || !this.ctx || !this.canvas) return;

        if (clear) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.videoFilters) {
            this.videoFilters.drawFrame(this.ctx, source, this.canvas.width, this.canvas.height);
        } else {
            this.ctx.drawImage(source, 0, 0, this.canvas.width, this.canvas.height);
        }

        for (const cb of this.afterFrameRenderCallbacks) {
            try { cb(this.canvas, this.ctx); } catch (e) { Logger.warn('After-frame callback error:', e); }
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

        await this._closeAudioContext();

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

        // The component owns the generator, which holds decoded frames.
        this.thumbnails?.destroy();

        if (this.videoFilters) {
            this.videoFilters.destroy?.();
            this.videoFilters = null;
        }

        if (this.stickers) {
            // Holds decoded GIF frames, which outlive the reference to them.
            this.stickers.destroy?.();
            this.stickers = null;
        }

        if (this.decorations) {
            this.decorations.destroy?.();
            this.decorations = null;
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

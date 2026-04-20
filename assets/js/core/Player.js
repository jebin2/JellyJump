/**
 * Core Player Class
 * The main controller for video playback using MediaBunny.
 * Supports file-based playback and HLS streaming (via MediaBunny's built-in HLS support).
 */

import { MediaBunny } from './MediaBunny.js';
import { PLAYER_CONFIG } from './config.js';
import { SubtitleManager } from './SubtitleManager.js';
import { ScreenshotManager } from '../player/ScreenshotManager.js';
import { VideoFilters } from '../player/VideoFilters.js';
import { AudioEqualizer } from '../player/AudioEqualizer.js';
import { PlayerStream } from '../player/PlayerStream.js';
import { PlayerKeyboard } from '../player/PlayerKeyboard.js';
import { PlayerSubtitles } from '../player/PlayerSubtitles.js';

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
        this.controlBarMode = options.controlBarMode || 'overlay'; // 'overlay' or 'fixed'
        this.autoHideTimer = null;

        // Controls Configuration
        this.config.controls = {
            controlBar: true,  // Show/hide the entire control bar
            playOverlay: true, // Show/hide the big play overlay
            playPause: true,
            navigation: true,  // Enable/disable prev/next buttons
            volume: true,
            time: true,
            progress: true,
            thumbnails: true,  // Enable/disable thumbnail preview on hover
            captions: true,
            settings: true,
            fullscreen: true,
            loop: true,
            speed: true,
            filters: true,
            equalizer: true,
            volumeOnly: false,  // When true, Audio Settings panel shows only volume (no EQ)
            modeToggle: true,
            keyboard: true,  // Enable/disable keyboard shortcuts
            ...this.config.controls
        };

        // Controls Presets
        this.PRESETS = {
            player: {
                playPause: true,
                volume: true,
                time: true,
                progress: true,
                captions: true,
                settings: true,
                fullscreen: true,
                loop: true,
                speed: true,
                filters: true,
                equalizer: true,
                modeToggle: true
            },
            editor: {
                playPause: true,
                volume: true,
                time: true,
                progress: true,
                captions: true,
                settings: false,
                fullscreen: true,
                loop: false,
                speed: true,
                modeToggle: false
            },
            minimal: {
                playPause: true,
                time: true,
                progress: true,
                volume: false,
                captions: false,
                settings: false,
                fullscreen: false,
                loop: false,
                speed: false,
                modeToggle: false
            }
        };

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
        this.playbackId = 0;

        // New state variables for MediaBunny example pattern
        this.videoFrameIterator = null;
        this.audioBufferIterator = null;
        this.nextFrame = null;
        this.queuedAudioNodes = new Set();
        this.asyncId = 0;
        this.playbackTimeAtStart = 0;
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

        this.stream = new PlayerStream(this);
        this.keyboard = new PlayerKeyboard(this);
        this.subtitles = new PlayerSubtitles(this);
        this._init();
    }

    // ─── Stream state proxies (state lives in PlayerStream) ──────────────────────
    get isStreamMode() { return this.stream.isStreamMode; }
    set isStreamMode(v) { this.stream.isStreamMode = v; }
    get isLive() { return this.stream.isLive; }
    set isLive(v) { this.stream.isLive = v; }
    get streamVideo() { return this.stream.streamVideo; }
    set streamVideo(v) { this.stream.streamVideo = v; }
    get isWebcamMode() { return this.stream.isWebcamMode; }
    set isWebcamMode(v) { this.stream.isWebcamMode = v; }
    get _liveStartTimestamp() { return this.stream._liveStartTimestamp; }
    set _liveStartTimestamp(v) { this.stream._liveStartTimestamp = v; }
    get _wasMutedForAutoplay() { return this.stream._wasMutedForAutoplay; }
    set _wasMutedForAutoplay(v) { this.stream._wasMutedForAutoplay = v; }
    get _isMediaReady() { return this.stream._isMediaReady; }
    set _isMediaReady(v) { this.stream._isMediaReady = v; }

    /**
     * Initialize the player
     * @private
     */
    _init() {
        this.container.classList.add('jellyjump-container');

        // Create canvas element using template
        const canvasTemplate = document.getElementById('player-canvas-template');
        const canvasClone = canvasTemplate.content.cloneNode(true);
        this.canvas = canvasClone.querySelector('canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        this.container.appendChild(canvasClone);

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
        const template = document.getElementById('player-help-overlay-template');
        const clone = template.content.cloneNode(true);

        // Configure sections based on mode
        const navSection = clone.getElementById('help-navigation-section');
        const editorSection = clone.getElementById('help-editor-section');

        if (this.config.mode === 'player') {
            if (navSection) navSection.style.display = 'block';
            if (editorSection) editorSection.style.display = 'none';
        } else if (this.config.mode === 'editor') {
            if (navSection) navSection.style.display = 'none';
            if (editorSection) editorSection.style.display = 'block';
        }

        // Update title
        const title = clone.querySelector('.jellyjump-help-title');
        if (title) {
            title.textContent = `Keyboard Shortcuts ${this.config.mode === 'editor' ? '(Editor Mode)' : '(Player Mode)'}`;
        }

        this.container.appendChild(clone);

        this.ui.helpOverlay = this.container.querySelector('.jellyjump-help-overlay');
        this.ui.closeHelpBtn = this.container.querySelector('.jellyjump-close-help');

        this.ui.closeHelpBtn.addEventListener('click', () => this._toggleHelp());
        this.ui.helpOverlay.addEventListener('click', (e) => {
            if (e.target === this.ui.helpOverlay) this._toggleHelp();
        });
    }

    /**
     * Create Thumbnail Overlay
     * @private
     */
    _createThumbnailOverlay() {
        if (this.ui.thumbnailOverlay) return;

        const overlay = document.createElement('div');
        overlay.className = 'jellyjump-thumbnail-overlay';
        overlay.innerHTML = `
            <div class="jelly-loader"></div>
            <div class="jellyjump-thumbnail-time">00:00</div>
        `;

        // Append to progress container so it moves relative to it? 
        // No, absolute pos based on mouse is better, but inside progressContainer makes scoping easier.
        // But progressContainer might overflow hidden? No, usually not.
        // Let's append to container and position manually for safety.
        this.container.appendChild(overlay);
        this.ui.thumbnailOverlay = overlay;
        this.ui.thumbnailTime = overlay.querySelector('.jellyjump-thumbnail-time');
        this.ui.thumbnailLoader = overlay.querySelector('.jelly-loader');
    }

    _handleThumbnailHover(e) {
        if (this.isStreamMode || !this.ui.thumbnailOverlay) return;

        const rect = this.ui.progressContainer.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const pos = Math.max(0, Math.min(1, offsetX / rect.width));
        const time = pos * this.duration;

        // Show overlay
        this.ui.thumbnailOverlay.classList.add('visible');

        // Position overlay (centered above cursor)
        const overlayRect = this.ui.thumbnailOverlay.getBoundingClientRect();
        let overlayLeft = e.clientX - rect.left - (overlayRect.width / 2);

        // Clamp to container bounds
        overlayLeft = Math.max(0, Math.min(overlayLeft, rect.width - overlayRect.width));

        // Update CSS variables or left/bottom if not relative
        // Since we appended to container, coordinate system is container
        // But e.clientX is viewport.
        // Let's calculate relative to container
        const containerRect = this.container.getBoundingClientRect();
        const relativeLeft = e.clientX - containerRect.left - (overlayRect.width / 2);
        const clampedRelLeft = Math.max(10, Math.min(relativeLeft, containerRect.width - overlayRect.width - 10));

        this.ui.thumbnailOverlay.style.left = `${clampedRelLeft}px`;

        // Dynamic bottom position: distance from container bottom to progress top + 15px
        const bottomOffset = containerRect.bottom - rect.top + 15;
        this.ui.thumbnailOverlay.style.bottom = `${bottomOffset}px`;

        // Update time text
        this.ui.thumbnailTime.textContent = formatTime(time);

        // Store for live updates
        this.lastThumbnailHoverTime = time;

        // Check/Get Thumbnail
        this._updateThumbnailImage(time);
    }

    _updateThumbnailImage(time) {
        if (!this.ui.thumbnailOverlay || !this.thumbnailGenerator) return;

        const thumb = this.thumbnailGenerator.getThumbnail(time);
        if (thumb) {
            this.ui.thumbnailOverlay.style.backgroundImage = `url(${thumb})`;
            this.ui.thumbnailLoader.style.display = 'none';
        } else {
            this.ui.thumbnailOverlay.style.backgroundImage = 'none';
            this.ui.thumbnailLoader.style.display = 'block';

            // Trigger generation if not started
            if (!this.thumbnailGenerationStarted && !this.thumbnailHoverTimer) {
                // Wait 300ms of hover to start heavy process
                this.thumbnailHoverTimer = setTimeout(() => {
                    this._startThumbnailGeneration();
                }, 300);
            }
        }
    }

    _handleThumbnailLeave() {
        if (this.ui.thumbnailOverlay) {
            this.ui.thumbnailOverlay.classList.remove('visible');
        }
        if (this.thumbnailHoverTimer) {
            clearTimeout(this.thumbnailHoverTimer);
            this.thumbnailHoverTimer = null;
        }
    }

    async _startThumbnailGeneration() {
        if (this.thumbnailGenerationStarted) return;
        this.thumbnailGenerationStarted = true;

        // Use current video source
        const url = this.sourceUrl;
        if (!url) return;

        Logger.log('[Thumbnails] Starting generation with URL:', url);

        try {
            await this.thumbnailGenerator.generate(url, this.duration, {
                width: 160,
                count: 100 // Target ~100 thumbnails regardless of duration
            });
            Logger.log('[Thumbnails] Generation complete');
            // Force update if still hovering?
            // User moving mouse will trigger update
        } catch (e) {
            Logger.warn('[Thumbnails] Generation failed:', e);
            this.thumbnailGenerationStarted = false;
        }
    }

    _cleanupThumbnails() {
        if (this.thumbnailGenerator) {
            this.thumbnailGenerator.cancel();
        }
        this.thumbnailGenerationStarted = false;
        if (this.thumbnailHoverTimer) {
            clearTimeout(this.thumbnailHoverTimer);
            this.thumbnailHoverTimer = null;
        }
        if (this.ui.thumbnailOverlay) {
            this.ui.thumbnailOverlay.style.backgroundImage = 'none';
        }
    }

    /**
     * Initialize Audio Context (must be done after user interaction)
     * @private
     */
    _initAudio() {
        if (this.isAudioInitialized) return;

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioContext = new AudioContext();

        // Create Gain Node (Volume)
        this.gainNode = this.audioContext.createGain();

        // Initialize Equalizer if enabled
        if (this.config.controls.equalizer) {
            this.audioEqualizer = new AudioEqualizer(this.audioContext);
            const eqInput = this.audioEqualizer.init();
            const eqOutput = this.audioEqualizer.getOutputNode();

            // Chain: EQ Output -> Gain Node
            // Note: Source connection happens in _runAudioIterator
            eqOutput.connect(this.gainNode);
        }

        // Connect gainNode to destination for audio output
        this.gainNode.connect(this.audioContext.destination);

        // Set initial volume
        this.gainNode.gain.value = this.config.muted ? 0 : this.config.volume;

        // Lazy-load AudioVisualizer (taps into gainNode for analysis)
        if (!this.audioVisualizer && this.canvas) {
            import('../player/AudioVisualizer.js').then(({ AudioVisualizer }) => {
                if (!this.audioVisualizer && this.canvas && this.audioContext && this.gainNode) {
                    this.audioVisualizer = new AudioVisualizer(this.canvas);
                    this.audioVisualizer.connect(this.audioContext, this.gainNode);
                }
            });
        }

        this.isInitialized = true;
        this.isAudioInitialized = true;
    }

    /**
     * Create custom controls UI
     * @private
     */
    _createControls() {
        const mount = (id) => {
            const t = document.getElementById(id);
            if (t) this.container.appendChild(t.content.cloneNode(true));
        };
        const q = (sel) => this.container.querySelector(sel);

        mount('player-loader-template');
        this.ui.loader = q('.jellyjump-loader');

        mount('player-controls-template');
        if (this.config.controls.loop) mount('player-loop-panel-template');

        if (this.screenshotManager) this.screenshotManager.init();

        this.ui.controls = q('.jellyjump-controls');
        this.ui.playOverlay = q('.jellyjump-play-overlay');
        this.ui.bezelOverlay = q('.jellyjump-bezel-overlay');

        if (!this.config.controls.playOverlay && this.ui.playOverlay) {
            this.ui.playOverlay.style.display = 'none';
        }

        if (this.config.controls.playPause) this.ui.playBtn = q('#mb-play-btn');
        if (this.config.controls.navigation) {
            this.ui.prevBtn = q('#mb-prev-btn');
            this.ui.nextBtn = q('#mb-next-btn');
        }
        if (this.config.controls.progress) {
            this.ui.progressContainer = q('.jellyjump-progress-container');
            this.ui.progressBar = q('.jellyjump-progress-bar');
        }
        if (this.config.controls.time) this.ui.timeDisplay = q('#mb-time-display');
        if (this.config.controls.fullscreen) this.ui.fullscreenBtn = q('#mb-fullscreen-btn');
        if (this.config.controls.modeToggle) this.ui.modeToggleBtn = q('#mb-mode-toggle-btn');

        if (this.config.controls.captions) this._initCaptionsPanel();
        if (this.config.controls.speed) this._initSpeedPanel();
        if (this.config.controls.loop) this._initLoopPanel();
        if (this.config.controls.filters) this._initFiltersPanel();
        if (this.config.controls.equalizer) this._initEqualizerPanel();

        this._createErrorOverlay();
        this._createThumbnailOverlay();
        this._applyControlVisibility();
        if (this.config.controls.speed) this._updateSpeedMenu();
    }

    _initCaptionsPanel() {
        const t = document.getElementById('player-subtitle-panel-template');
        if (t) this.container.appendChild(t.content.cloneNode(true));
        const q = (sel) => this.container.querySelector(sel);
        this.ui.ccBtn = q('#mb-cc-btn');
        this.ui.ccPanel = q('.jellyjump-subtitle-panel');
        this.ui.ccInput = q('#mb-cc-input');
        this.ui.closeCcPanelBtn = q('.jellyjump-subtitle-panel .jellyjump-close-btn');
        this.ui.subtitleOptions = q('.subtitle-options');
        this.ui.audioContainer = q('#mb-audio-container');
        this.ui.audioBtn = q('#mb-audio-btn');
        this.ui.audioMenu = q('#mb-audio-menu');
    }

    _initSpeedPanel() {
        const t = document.getElementById('player-speed-panel-template');
        if (t) this.container.appendChild(t.content.cloneNode(true));
        const q = (sel) => this.container.querySelector(sel);
        this.ui.speedBtn = q('#mb-speed-btn');
        this.ui.speedPanel = q('.jellyjump-speed-panel');
        this.ui.speedSlider = q('#mb-speed-slider');
        this.ui.speedValue = q('#mb-speed-value');
        this.ui.resetSpeedBtn = q('#mb-reset-speed-btn');
        this.ui.closeSpeedPanelBtn = q('.jellyjump-speed-panel .jellyjump-close-btn');
    }

    _initLoopPanel() {
        const q = (sel) => this.container.querySelector(sel);
        this.ui.loopBtn = q('#mb-loop-btn');
        this.ui.loopMarkerA = q('.jellyjump-marker.marker-a');
        this.ui.loopMarkerB = q('.jellyjump-marker.marker-b');
        this.ui.loopRegion = q('.jellyjump-loop-region');
        this.ui.loopPanel = q('.jellyjump-loop-panel');
        this.ui.loopStartInput = q('#mb-loop-start');
        this.ui.loopEndInput = q('#mb-loop-end');
        this.ui.loopModeRadios = this.container.querySelectorAll('input[name="loop-mode"]');
        this.ui.loopAbSection = q('.loop-ab-section');
        this.ui.setABtn = q('#mb-set-a-btn');
        this.ui.setBBtn = q('#mb-set-b-btn');
        this.ui.clearLoopBtn = q('#mb-clear-loop-btn');
        this.ui.closeLoopPanelBtn = q('.jellyjump-loop-panel .jellyjump-close-btn');
    }

    _initFiltersPanel() {
        const t = document.getElementById('player-filter-panel-template');
        if (t) this.container.appendChild(t.content.cloneNode(true));
        const q = (sel) => this.container.querySelector(sel);
        this.ui.filtersBtn = q('#mb-filters-btn');
        this.ui.filterPanel = q('.jellyjump-filter-panel');
        this.ui.brightnessSlider = q('#mb-filter-brightness');
        this.ui.contrastSlider = q('#mb-filter-contrast');
        this.ui.saturationSlider = q('#mb-filter-saturation');
        this.ui.brightnessValue = q('#mb-brightness-value');
        this.ui.contrastValue = q('#mb-contrast-value');
        this.ui.saturationValue = q('#mb-saturation-value');
        this.ui.resetFiltersBtn = q('#mb-reset-filters-btn');
        this.ui.closeFilterPanelBtn = q('.jellyjump-filter-panel .jellyjump-close-btn');
        this.videoFilters = new VideoFilters(this.canvas);
    }

    _initEqualizerPanel() {
        const t = document.getElementById('player-audio-panel-template');
        if (t) this.container.appendChild(t.content.cloneNode(true));
        const q = (sel) => this.container.querySelector(sel);
        this.ui.audioSettingsBtn = q('#mb-audio-settings-btn');
        this.ui.audioPanel = q('.jellyjump-eq-panel');
        this.ui.panelMuteBtn = q('#mb-panel-mute-btn');
        this.ui.panelVolumeSlider = q('#mb-panel-volume-slider');
        this.ui.panelVolumeValue = q('#mb-panel-volume-value');
        this.ui.eqBassSlider = q('#mb-eq-bass');
        this.ui.eqMidSlider = q('#mb-eq-mid');
        this.ui.eqTrebleSlider = q('#mb-eq-treble');
        this.ui.eqBassValue = q('#mb-bass-value');
        this.ui.eqMidValue = q('#mb-mid-value');
        this.ui.eqTrebleValue = q('#mb-treble-value');
        this.ui.resetEqBtn = q('#mb-reset-eq-btn');
        this.ui.closeAudioPanelBtn = q('.jellyjump-eq-panel .jellyjump-close-btn');

        if (this.config.controls.volumeOnly) {
            ['.eq-section-divider', '.eq-sliders', '.eq-presets', '.eq-actions'].forEach(sel => {
                const el = this.ui.audioPanel.querySelector(sel);
                if (el) el.style.display = 'none';
            });
        }
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
        // Play/Pause (only if enabled)
        if (this.config.controls.playPause && this.ui.playBtn) {
            this.ui.playBtn.addEventListener('click', () => this.togglePlay());
        }
        this.canvas.addEventListener('click', () => {
            if (this.config.controls.playOverlay) this.togglePlay();
        });
        if (this.ui.playOverlay) {
            this.ui.playOverlay.addEventListener('click', () => this.togglePlay());
        }

        // Navigation (only if buttons exist - not needed for modal players)
        if (this.ui.prevBtn) {
            this.ui.prevBtn.addEventListener('click', () => {
                if (!this.ui.prevBtn.disabled && this.onPrevious) {
                    this.onPrevious();
                }
            });
        }
        if (this.ui.nextBtn) {
            this.ui.nextBtn.addEventListener('click', () => {
                if (!this.ui.nextBtn.disabled && this.onNext) {
                    this.onNext();
                }
            });
        }

        if (this.config.controls.progress && this.ui.progressContainer) {
            // Mouse down to start scrubbing
            this.ui.progressContainer.addEventListener('mousedown', (e) => {
                this._onScrubStart(e);
            });

            // Thumbnail Preview (Hover) - only if enabled
            if (this.config.controls.thumbnails) {
                this.ui.progressContainer.addEventListener('mousemove', (e) => this._handleThumbnailHover(e));
                this.ui.progressContainer.addEventListener('mouseleave', () => this._handleThumbnailLeave());
            }
        }

        // Volume (only if enabled)
        if (this.config.controls.volume && this.ui.volumeSlider) {
            this.ui.volumeSlider.addEventListener('input', (e) => {
                this.config.volume = parseFloat(e.target.value);
                this.config.muted = false;

                if (this.gainNode) {
                    this.gainNode.gain.value = this.config.volume;
                }
                this._updateVolumeUI();
            });
        }

        if (this.config.controls.volume && this.ui.muteBtn) {
            this.ui.muteBtn.addEventListener('click', () => {
                this.config.muted = !this.config.muted;

                if (this.gainNode) {
                    this.gainNode.gain.value = this.config.muted ? 0 : this.config.volume;
                }
                this._updateVolumeUI();
            });
        }

        // Fullscreen (only if enabled)
        if (this.config.controls.fullscreen && this.ui.fullscreenBtn) {
            this.ui.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        }

        // Control Bar Mode Toggle (only if fullscreen enabled, since it's for main player)
        if (this.config.controls.fullscreen && this.ui.modeToggleBtn) {
            this.ui.modeToggleBtn.addEventListener('click', () => this.toggleControlBarMode());
        }

        // Auto-hide for overlay mode (only if fullscreen enabled - modal players don't need this)
        if (this.config.controls.fullscreen) {
            this.container.addEventListener('mousemove', (e) => this._handleMouseMove(e));

            // Rule 2: On cursor enter canvas/video the control bar should appear immediately
            this.container.addEventListener('mouseenter', () => {
                if (this.controlBarMode === 'overlay') {
                    this.ui.controls.classList.add('visible');
                    this._clearAutoHideTimer();
                    if (this.isPlaying) this._startAutoHideTimer();
                }
            });

            // Rule 4: When the cursor move out of the canvas /video the control bar should hide immediately
            this.container.addEventListener('mouseleave', () => {
                if (this.controlBarMode === 'overlay' && this.isPlaying) {
                    this._clearAutoHideTimer();
                    this.ui.controls.classList.remove('visible');
                    this.container.classList.add('hide-cursor');
                }
            });

            // Keep controls visible when hovering over them (Rule 3)
            this.ui.controls.addEventListener('mouseenter', () => this._clearAutoHideTimer());
            this.ui.controls.addEventListener('mouseleave', () => {
                if (this.isPlaying && this.controlBarMode === 'overlay') {
                    this._startAutoHideTimer();
                }
            });
        }

        // Subtitles (only if captions enabled)
        if (this.config.controls.captions && this.ui.ccBtn && this.ui.ccPanel) {
            // Toggle subtitle panel
            this.ui.ccBtn.addEventListener('click', () => this.toggleSubtitlePanel());
            this.ui.closeCcPanelBtn.addEventListener('click', () => this.toggleSubtitlePanel());

            // Radio button selection
            this.ui.subtitleOptions.addEventListener('change', (e) => {
                if (e.target.type === 'radio') {
                    const value = e.target.value;
                    if (value === 'off') {
                        this.isSubtitlesEnabled = false;
                    } else {
                        this._switchSubtitleTrack(value);
                    }
                    this._updateSubtitleMenu();
                }
            });

            // File upload
            this.ui.ccInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const url = URL.createObjectURL(file);
                    this.loadSubtitle(url);
                }
            });

            // Audio Tracks
            this.ui.audioBtn.addEventListener('click', () => {
                this.ui.audioMenu.classList.toggle('visible');
                this.ui.audioBtn.setAttribute('aria-expanded', this.ui.audioMenu.classList.contains('visible'));
            });

            this.ui.audioMenu.addEventListener('click', (e) => {
                const item = e.target.closest('.jellyjump-menu-item');
                if (!item) return;

                const trackId = parseInt(item.dataset.value);
                this._switchAudioTrack(trackId);
                this.ui.audioMenu.classList.remove('visible');
            });
        }

        // Speed Panel (only if enabled)
        if (this.config.controls.speed && this.ui.speedBtn && this.ui.speedPanel) {
            // Toggle speed panel
            this.ui.speedBtn.addEventListener('click', () => this.toggleSpeedPanel());
            this.ui.closeSpeedPanelBtn.addEventListener('click', () => this.toggleSpeedPanel());

            // Speed slider
            this.ui.speedSlider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                this.ui.speedValue.textContent = `${value.toFixed(2)}x`;
            });

            this.ui.speedSlider.addEventListener('change', (e) => {
                const value = parseFloat(e.target.value);
                this.setPlaybackRate(value);
            });

            // Reset speed button
            this.ui.resetSpeedBtn.addEventListener('click', () => {
                this.setPlaybackRate(1);
                this.ui.speedSlider.value = 1;
                this.ui.speedValue.textContent = '1.00x';
            });

            // Initialize slider with current speed
            this.ui.speedSlider.value = this.playbackRate;
            this.ui.speedValue.textContent = `${this.playbackRate.toFixed(2)}x`;
        }

        // Fullscreen Change Events (only if fullscreen enabled)
        if (this.config.controls.fullscreen) {
            document.addEventListener('fullscreenchange', this._handlers.fullscreen);
            document.addEventListener('webkitfullscreenchange', this._handlers.fullscreen);
            document.addEventListener('mozfullscreenchange', this._handlers.fullscreen);
            document.addEventListener('MSFullscreenChange', this._handlers.fullscreen);
        }

        // Visibility Change Event - prevents video fast-forward when switching tabs
        document.addEventListener('visibilitychange', this._handlers.visibilitychange);

        // Loop Control (only if loop enabled)
        if (this.config.controls.loop) {
            this._updateLoopUI();

            // Click to toggle loop panel
            this.ui.loopBtn.addEventListener('click', () => this.toggleLoopPanel());

            // Loop Panel Events
            this.ui.closeLoopPanelBtn.addEventListener('click', () => this.toggleLoopPanel());

            // Radio button mode selection
            this.ui.loopModeRadios.forEach(radio => {
                radio.addEventListener('change', (e) => {
                    this.loopMode = e.target.value;
                    // Show A-B section only for 'one' mode
                    if (this.ui.loopAbSection) {
                        this.ui.loopAbSection.style.display = this.loopMode === 'one' ? 'block' : 'none';
                    }
                    this._updateLoopUI();
                });
            });

            // A-B Loop Events
            this.ui.setABtn.addEventListener('click', () => this.setLoopStart());
            this.ui.setBBtn.addEventListener('click', () => this.setLoopEnd());
            this.ui.clearLoopBtn.addEventListener('click', () => this.clearLoopMarkers());

            this.ui.loopStartInput.addEventListener('change', (e) => {
                const time = parseTime(e.target.value);
                if (time !== null && this.loopMode === 'one') {
                    this.loopStart = time;
                    this._updateLoopUI();
                }
            });

            this.ui.loopEndInput.addEventListener('change', (e) => {
                const time = parseTime(e.target.value);
                if (time !== null && this.loopMode === 'one') {
                    this.loopEnd = time;
                    this._updateLoopUI();
                }
            });
        }

        // Filter Control (only if enabled)
        if (this.config.controls.filters && this.ui.filtersBtn) {
            // Toggle filter panel
            this.ui.filtersBtn.addEventListener('click', () => this.toggleFilterPanel());

            // Close button
            if (this.ui.closeFilterPanelBtn) {
                this.ui.closeFilterPanelBtn.addEventListener('click', () => this.toggleFilterPanel());
            }

            // Brightness slider
            if (this.ui.brightnessSlider) {
                this.ui.brightnessSlider.addEventListener('input', (e) => {
                    const value = parseInt(e.target.value);
                    this.videoFilters.setBrightness(value);
                    this.ui.brightnessValue.textContent = `${value}%`;
                    this._updateFiltersButtonState();
                });
            }

            // Contrast slider
            if (this.ui.contrastSlider) {
                this.ui.contrastSlider.addEventListener('input', (e) => {
                    const value = parseInt(e.target.value);
                    this.videoFilters.setContrast(value);
                    this.ui.contrastValue.textContent = `${value}%`;
                    this._updateFiltersButtonState();
                });
            }

            // Saturation slider
            if (this.ui.saturationSlider) {
                this.ui.saturationSlider.addEventListener('input', (e) => {
                    const value = parseInt(e.target.value);
                    this.videoFilters.setSaturation(value);
                    this.ui.saturationValue.textContent = `${value}%`;
                    this._updateFiltersButtonState();
                });
            }

            // Preset buttons
            this.container.querySelectorAll('.filter-preset-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const preset = btn.dataset.preset;
                    this.videoFilters.applyPreset(preset);
                    this._syncFilterSliders();
                    this._updateFiltersButtonState();
                });
            });

            // Reset button
            if (this.ui.resetFiltersBtn) {
                this.ui.resetFiltersBtn.addEventListener('click', () => {
                    this.videoFilters.reset();
                    this._syncFilterSliders();
                    this._updateFiltersButtonState();
                });
            }
        }

        // Equalizer Control (only if enabled)
        // Audio/Equalizer Control (only if enabled)
        if (this.config.controls.equalizer && this.ui.audioSettingsBtn) {
            // Toggle Audio panel
            this.ui.audioSettingsBtn.addEventListener('click', () => this.toggleAudioPanel());

            // Close button
            if (this.ui.closeAudioPanelBtn) {
                this.ui.closeAudioPanelBtn.addEventListener('click', () => this.toggleAudioPanel());
            }

            // Panel Mute Button
            if (this.ui.panelMuteBtn) {
                this.ui.panelMuteBtn.addEventListener('click', () => this.toggleMute());
            }

            // Panel Volume Slider
            if (this.ui.panelVolumeSlider) {
                this.ui.panelVolumeSlider.addEventListener('input', (e) => {
                    const volume = parseFloat(e.target.value);
                    this.setVolume(volume);
                });
            }

            // Bass slider
            if (this.ui.eqBassSlider) {
                this.ui.eqBassSlider.addEventListener('input', (e) => {
                    const value = parseInt(e.target.value);
                    if (this.audioEqualizer) {
                        this.audioEqualizer.setBass(value);
                    }
                    this.ui.eqBassValue.textContent = value;
                });
            }

            // Mid slider
            if (this.ui.eqMidSlider) {
                this.ui.eqMidSlider.addEventListener('input', (e) => {
                    const value = parseInt(e.target.value);
                    if (this.audioEqualizer) {
                        this.audioEqualizer.setMid(value);
                    }
                    this.ui.eqMidValue.textContent = value;
                });
            }

            // Treble slider
            if (this.ui.eqTrebleSlider) {
                this.ui.eqTrebleSlider.addEventListener('input', (e) => {
                    const value = parseInt(e.target.value);
                    if (this.audioEqualizer) {
                        this.audioEqualizer.setTreble(value);
                    }
                    this.ui.eqTrebleValue.textContent = value;
                });
            }

            // Preset buttons
            this.container.querySelectorAll('.eq-preset-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (!this.audioEqualizer) return;
                    const preset = btn.dataset.preset;
                    this.audioEqualizer.applyPreset(preset);
                    this._syncEqSliders();
                });
            });

            // Reset button
            if (this.ui.resetEqBtn) {
                this.ui.resetEqBtn.addEventListener('click', () => {
                    if (!this.audioEqualizer) return;
                    this.audioEqualizer.reset();
                    this._syncEqSliders();
                });
            }
        }

        // Close menus when clicking outside
        document.addEventListener('click', this._handlers.click);

        // Keyboard Shortcuts (only if enabled in config)
        if (this.config.controls.keyboard) {
            document.addEventListener('keydown', this._handlers.keydown);
        }

        // Initialize Event Emitter
        this._events = {};
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

    _handleDocumentClick(e) {
        // Hide subtitle panel when clicking outside
        if (this.ui.ccPanel && this.ui.ccBtn &&
            !this.ui.ccBtn.contains(e.target) && !this.ui.ccPanel.contains(e.target)) {
            this.ui.ccPanel.style.display = 'none';
        }
        if (this.ui.audioBtn && this.ui.audioMenu && !this.ui.audioBtn.contains(e.target) && !this.ui.audioMenu.contains(e.target)) {
            this.ui.audioMenu.classList.remove('visible');
        }
        // Hide speed panel when clicking outside
        if (this.ui.speedPanel && this.ui.speedBtn &&
            !this.ui.speedBtn.contains(e.target) && !this.ui.speedPanel.contains(e.target)) {
            this.ui.speedPanel.style.display = 'none';
        }
        // Hide filter panel when clicking outside
        if (this.ui.filterPanel && this.ui.filtersBtn &&
            !this.ui.filtersBtn.contains(e.target) && !this.ui.filterPanel.contains(e.target)) {
            this.ui.filterPanel.style.display = 'none';
        }
        // Hide Audio panel when clicking outside
        if (this.ui.audioPanel && this.ui.audioSettingsBtn &&
            !this.ui.audioSettingsBtn.contains(e.target) && !this.ui.audioPanel.contains(e.target)) {
            this.ui.audioPanel.style.display = 'none';
        }
        // Hide Loop panel when clicking outside
        if (this.ui.loopPanel && this.ui.loopBtn &&
            !this.ui.loopBtn.contains(e.target) && !this.ui.loopPanel.contains(e.target)) {
            this.ui.loopPanel.style.display = 'none';
        }
        // Restore audio if muted for autoplay on proper user interaction (not during loading)
        if (this._wasMutedForAutoplay && this.gainNode && !this._isLoading) {
            Logger.log('[Autoplay] User interaction restoring audio...');
            this.config.muted = false;
            this.gainNode.gain.value = this.config.volume;
            this._wasMutedForAutoplay = false;
            this._updateVolumeUI();
        }
    }

    _updateSpeedMenu() {
        // Skip if speed control is disabled
        if (!this.ui.speedBtn) return;

        // Update button text
        this.ui.speedBtn.textContent = this.playbackRate === 1 ? '1x' : `${this.playbackRate}x`;
        if (this.playbackRate !== 1) {
            this.ui.speedBtn.style.color = 'var(--accent-primary)';
        } else {
            this.ui.speedBtn.style.color = '';
        }

        // Update slider and value display if panel exists
        if (this.ui.speedSlider) {
            this.ui.speedSlider.value = this.playbackRate;
        }
        if (this.ui.speedValue) {
            this.ui.speedValue.textContent = `${this.playbackRate.toFixed(2)}x`;
        }
    }

    /**
     * Toggle Loop Mode: Off -> Playlist -> One -> Off
     */
    toggleLoopMode() {
        // If we were in A-B, this cycle exits it.
        // If we want to clear A-B markers when leaving A-B mode via button:
        if (this.loopStart !== null || this.loopEnd !== null) {
            // Optional: Keep markers but disable A-B? Or clear?
            // Let's clear for simplicity if user cycles modes.
            this.loopStart = null;
            this.loopEnd = null;
        }
        this._updateLoopUI();
    }

    toggleLoopPanel() {
        const isVisible = this.ui.loopPanel.style.display !== 'none';
        this.ui.loopPanel.style.display = isVisible ? 'none' : 'block';
        if (!isVisible) {
            this._updateLoopUI(); // Ensure inputs are synced
        }
    }

    /**
     * Toggle video filters panel visibility
     */
    toggleFilterPanel() {
        if (!this.ui.filterPanel) return;
        const isVisible = this.ui.filterPanel.style.display !== 'none';
        this.ui.filterPanel.style.display = isVisible ? 'none' : 'block';
        if (!isVisible) {
            this._syncFilterSliders(); // Ensure sliders match current state
        }
    }

    /**
     * Toggle speed panel visibility
     */
    toggleSpeedPanel() {
        if (!this.ui.speedPanel) return;
        const isVisible = this.ui.speedPanel.style.display !== 'none';
        this.ui.speedPanel.style.display = isVisible ? 'none' : 'block';
        if (!isVisible) {
            // Sync slider with current speed
            this.ui.speedSlider.value = this.playbackRate;
            this.ui.speedValue.textContent = `${this.playbackRate.toFixed(2)}x`;
        }
    }

    /**
     * Toggle subtitle panel visibility
     */
    toggleSubtitlePanel() {
        if (!this.ui.ccPanel) return;
        const isVisible = this.ui.ccPanel.style.display !== 'none';
        this.ui.ccPanel.style.display = isVisible ? 'none' : 'block';
        if (!isVisible) {
            this._updateSubtitleMenu();
        }
    }

    /**
     * Sync filter sliders with current VideoFilters state
     * @private
     */
    _syncFilterSliders() {
        if (!this.videoFilters) return;
        const state = this.videoFilters.getState();

        if (this.ui.brightnessSlider) {
            this.ui.brightnessSlider.value = state.brightness;
            this.ui.brightnessValue.textContent = `${state.brightness}%`;
        }
        if (this.ui.contrastSlider) {
            this.ui.contrastSlider.value = state.contrast;
            this.ui.contrastValue.textContent = `${state.contrast}%`;
        }
        if (this.ui.saturationSlider) {
            this.ui.saturationSlider.value = state.saturation;
            this.ui.saturationValue.textContent = `${state.saturation}%`;
        }
    }

    /**
     * Update filter button to show active state when filters are applied
     * @private
     */
    _updateFiltersButtonState() {
        if (!this.ui.filtersBtn || !this.videoFilters) return;

        if (this.videoFilters.isActive()) {
            this.ui.filtersBtn.style.color = 'var(--accent-primary)';
            this.ui.filtersBtn.setAttribute('aria-label', 'Video Filters (Active)');
        } else {
            this.ui.filtersBtn.style.color = '';
            this.ui.filtersBtn.setAttribute('aria-label', 'Video Filters');
        }
    }

    /**
     * Toggle audio settings panel visibility
     */
    toggleAudioPanel() {
        if (!this.ui.audioPanel) return;
        const isVisible = this.ui.audioPanel.style.display !== 'none';
        this.ui.audioPanel.style.display = isVisible ? 'none' : 'block';
        if (!isVisible) {
            this._syncEqSliders(); // Ensure sliders match current state
            this._updateVolumeUI(); // Ensure volume UI is synced
        }
    }

    /**
     * Sync EQ sliders with current AudioEqualizer state
     * @private
     */
    _syncEqSliders() {
        if (!this.audioEqualizer) return;
        const state = this.audioEqualizer.getState();

        if (this.ui.eqBassSlider) {
            this.ui.eqBassSlider.value = state.bass;
            this.ui.eqBassValue.textContent = state.bass;
        }
        if (this.ui.eqMidSlider) {
            this.ui.eqMidSlider.value = state.mid;
            this.ui.eqMidValue.textContent = state.mid;
        }
        if (this.ui.eqTrebleSlider) {
            this.ui.eqTrebleSlider.value = state.treble;
            this.ui.eqTrebleValue.textContent = state.treble;
        }
    }

    /**
     * Update Audio button to show active state (mute/volume)
     * @private
     */
    _updateAudioButtonState() {
        if (!this.ui.audioSettingsBtn) return;

        const iconUse = this.ui.audioSettingsBtn.querySelector('use');
        if (!iconUse) return;

        if (this.isMuted || this.volume === 0) {
            iconUse.setAttribute('href', 'assets/icons/sprite.svg#icon-volume-mute');
            this.ui.audioSettingsBtn.setAttribute('aria-label', 'Audio Settings (Muted)');
            // this.ui.audioSettingsBtn.style.color = 'var(--accent-warning)'; // Removed to use default/theme color
        } else {
            iconUse.setAttribute('href', 'assets/icons/sprite.svg#icon-volume-high');
            this.ui.audioSettingsBtn.setAttribute('aria-label', 'Audio Settings');

            // Highlight if EQ is active
            if (this.audioEqualizer && this.audioEqualizer.isActive()) {
                this.ui.audioSettingsBtn.style.color = 'var(--accent-primary)';
            } else {
                this.ui.audioSettingsBtn.style.color = '';
            }
        }
    }

    setLoopStart() {
        this.loopStart = this.currentTime;
        if (this.loopEnd !== null && this.loopStart >= this.loopEnd) {
            this.loopEnd = null; // Reset end if start is after it
        }
        // Keep in 'one' mode (A-B is a feature within Current Video mode)
        if (this.loopMode !== 'one') {
            this.loopMode = 'one';
        }
        this._updateLoopUI();
        Logger.log('Loop Start set:', this.loopStart);
    }

    setLoopEnd() {
        if (this.loopStart === null) {
            this.setLoopStart(); // If no start, set start instead
            return;
        }
        if (this.currentTime <= this.loopStart) {
            Logger.warn('Loop End must be after Loop Start');
            return;
        }
        this.loopEnd = this.currentTime;
        // Keep in 'one' mode (A-B is a feature within Current Video mode)
        if (this.loopMode !== 'one') {
            this.loopMode = 'one';
        }
        this._updateLoopUI();
        Logger.log('Loop End set:', this.loopEnd);
    }

    clearLoopMarkers() {
        this.loopStart = null;
        this.loopEnd = null;
        // Keep mode as is, or switch to off? 
        // Requirement says "Keeps A-B loop mode active but prompts for new markers"
        // But if markers are null, A-B loop effectively does nothing.
        this._updateLoopUI();
    }

    resetLoop() {
        this.loopStart = null;
        this.loopEnd = null;
        this.loopMode = 'off';
        this._updateLoopUI();
    }

    _updateLoopUI() {
        // Update Button Icon & Color
        const btn = this.ui.loopBtn;
        const use = btn.querySelector('use');
        const hasAbLoop = this.loopStart !== null && this.loopEnd !== null;

        if (this.loopMode === 'off') {
            btn.style.color = '';
            btn.setAttribute('aria-label', 'Loop Mode: Off');
            use.setAttribute('href', 'assets/icons/sprite.svg#icon-loop');
        } else if (this.loopMode === 'playlist') {
            btn.style.color = 'var(--accent-primary)';
            btn.setAttribute('aria-label', 'Loop Mode: Playlist');
            use.setAttribute('href', 'assets/icons/sprite.svg#icon-loop-playlist');
        } else if (this.loopMode === 'one') {
            btn.style.color = 'var(--accent-primary)';
            // Show A-B icon if A-B markers are set, otherwise show loop-one
            if (hasAbLoop) {
                btn.setAttribute('aria-label', 'Loop Mode: A-B');
                use.setAttribute('href', 'assets/icons/sprite.svg#icon-loop-ab');
            } else {
                btn.setAttribute('aria-label', 'Loop Mode: One');
                use.setAttribute('href', 'assets/icons/sprite.svg#icon-loop-one');
            }
        }

        // Update Radio Buttons
        if (this.ui.loopModeRadios) {
            this.ui.loopModeRadios.forEach(radio => {
                radio.checked = radio.value === this.loopMode;
            });
        }

        // Show/Hide A-B Section
        if (this.ui.loopAbSection) {
            this.ui.loopAbSection.style.display = this.loopMode === 'one' ? 'block' : 'none';
        }

        // Update A-B Inputs
        if (this.ui.loopStartInput) {
            this.ui.loopStartInput.value = this.loopStart !== null ? formatTime(this.loopStart) : '';
        }
        if (this.ui.loopEndInput) {
            this.ui.loopEndInput.value = this.loopEnd !== null ? formatTime(this.loopEnd) : '';
        }

        // Update Markers
        if (this.duration > 0) {
            if (this.loopStart !== null) {
                this.ui.loopMarkerA.style.display = 'block';
                this.ui.loopMarkerA.style.left = `${(this.loopStart / this.duration) * 100}%`;
            } else {
                this.ui.loopMarkerA.style.display = 'none';
            }

            if (this.loopEnd !== null) {
                this.ui.loopMarkerB.style.display = 'block';
                this.ui.loopMarkerB.style.left = `${(this.loopEnd / this.duration) * 100}%`;
            } else {
                this.ui.loopMarkerB.style.display = 'none';
            }

            if (this.loopStart !== null && this.loopEnd !== null) {
                this.ui.loopRegion.style.display = 'block';
                const startPct = (this.loopStart / this.duration) * 100;
                const endPct = (this.loopEnd / this.duration) * 100;
                this.ui.loopRegion.style.left = `${startPct}%`;
                this.ui.loopRegion.style.width = `${endPct - startPct}%`;
            } else {
                this.ui.loopRegion.style.display = 'none';
            }
        }
    }

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

    _cycleSpeed(direction) {
        const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
        let index = speeds.indexOf(this.playbackRate);
        if (index === -1) index = 3; // Default to 1x if weird value

        index += direction;
        if (index >= 0 && index < speeds.length) {
            this.setPlaybackRate(speeds[index]);
        }
    }

    /**
     * Step forward or backward by frames
     * @param {number} direction - 1 for forward, -1 for backward
     * @private
     */
    _stepFrame(direction) {
        // Use actual frame rate if available, otherwise default to 30fps
        const fps = this.frameRate || 30;
        const frameDuration = 1 / fps;
        const newTime = this.currentTime + (direction * frameDuration);
        this._seekTo(Math.max(0, Math.min(this.duration, newTime)));
    }

    /**
     * Clear the canvas
     * @private
     */
    _clearCanvas() {
        if (this.ctx && this.canvas) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    /**
     * Dispose MediaBunny resources (sinks and input)
     * @private
     */
    _disposeMediaBunnyResources() {
        if (this.videoSink?.dispose) {
            try { this.videoSink.dispose(); } catch (e) { }
        }
        if (this.audioSink?.dispose) {
            try { this.audioSink.dispose(); } catch (e) { }
        }
        if (this.input?.dispose) {
            try { this.input.dispose(); } catch (e) { }
        }
        this.videoSink = null;
        this.audioSink = null;
        this.input = null;
    }

    /**
     * Reset the player state and unload media
     */
    async reset() {
        this.pause();

        // Clean up live/stream UI if active
        if (this.isLive || this.isStreamMode) {
            this._cleanupHLS();
        }

        // Clean up audio-only mode
        if (this.isAudioMode) {
            this._cleanupAudio();
        }

        // Clear canvas
        this._clearCanvas();

        // Reset state
        this.currentTime = 0;
        this.duration = 0;
        this.audioContextStartTime = null;
        this.fallbackStartTime = undefined;

        this._cleanupThumbnails();

        // Await iterator cleanup BEFORE disposing resources to prevent orphaned VideoFrames
        try {
            if (this.videoFrameIterator) {
                await this.videoFrameIterator.return();
            }
        } catch (e) { /* ignore */ }
        try {
            if (this.audioBufferIterator) {
                await this.audioBufferIterator.return();
            }
        } catch (e) { /* ignore */ }

        // Dispose MediaBunny resources (safe now that iterators are closed)
        this._disposeMediaBunnyResources();

        this.videoTrack = null;
        this.audioTrack = null;
        this.videoFrameIterator = null;
        this.audioBufferIterator = null;
        this.nextFrame = null;
        this.currentVideoId = null;

        // Update UI
        this._updateTimeDisplay();
        this._updateProgress();
        if (this.ui?.loader) this.ui.loader.style.display = 'none';

        // Reset Audio Context if needed
        if (this.audioContext) {
            this.activeSources.forEach(source => {
                try { source.stop(); } catch (e) { }
            });
            this.activeSources = [];
        }

        Logger.log('[Player] Reset complete - select a video to play');
    }

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

    async _cleanupForLoad() {
        this._isMediaReady = false;
        this.pause(false);
        this._cleanupThumbnails();
        this._cleanupAudio();
        this._cleanupHLS();
        this.stream.resetForLoad();
        this._setWebcamModeControls(false);
        this.currentTime = 0;

        if (this.videoFrameIterator) await this.videoFrameIterator.return();
        if (this.audioIteratorCleanupPromise) await this.audioIteratorCleanupPromise;
        if (this.audioBufferIterator) await this.audioBufferIterator.return();
        this.videoFrameIterator = null;
        this.audioBufferIterator = null;
        this.nextFrame = null;
        this.asyncId++;
        this.playbackTimeAtStart = 0;
        this.audioContextStartTime = null;
        this.queuedAudioNodes.clear();

        this._clearCanvas();
        this._updateTimeDisplay();
        this._disposeMediaBunnyResources();

        this.subtitleTracks = [];
        this.subtitleTrackCounter = 0;
        this.activeSubtitleTrackId = null;
        this.isSubtitlesEnabled = false;
        if (this.subtitleManager) this.subtitleManager.cues = [];
    }

    async _setupMediaTracks(url, isHls) {
        this.input = MediaBunny.createInputFrom(url, [...MediaBunny.HLS_FORMATS, ...MediaBunny.ALL_FORMATS]);

        if (!isHls) {
            this.duration = await this.input.computeDuration();
            this._updateTimeDisplay();
        }

        this.videoTrack = await this.input.getPrimaryVideoTrack();
        if (this.videoTrack) {
            if (!isHls) {
                try {
                    const stats = await this.videoTrack.computePacketStats();
                    this.frameRate = stats.averagePacketRate || 30;
                    Logger.log(`Detected frame rate: ${this.frameRate} fps`);
                } catch (e) {
                    Logger.warn("Could not compute frame rate, defaulting to 30fps", e);
                    this.frameRate = 30;
                }
            } else {
                this.frameRate = 30;
            }

            this.videoSink = new MediaBunny.CanvasSink(this.videoTrack, {
                poolSize: isHls ? 6 : 2,
                fit: 'contain'
            });
            this.canvas.width = this.videoTrack.displayWidth;
            this.canvas.height = this.videoTrack.displayHeight;
        } else {
            Logger.log('No video track found - enabling Audio Mode');
            this.isAudioMode = true;
            const containerRect = this.container.getBoundingClientRect();
            this.canvas.width = containerRect.width || 1280;
            this.canvas.height = containerRect.height || 720;
        }

        this.audioTrack = await this.input.getPrimaryAudioTrack();
        if (!this.audioTrack) {
            const audioTracks = await this.input.getAudioTracks();
            if (audioTracks.length > 0) this.audioTrack = audioTracks[0];
        }

        if (this.audioTrack) {
            // AudioSampleSink avoids a MediaBunny bug where AudioSamples aren't closed properly
            this.audioSink = new MediaBunny.AudioSampleSink(this.audioTrack);
        }

        this._updateAudioTracks();
    }

    async _handleHLSState() {
        this.isLive = this.videoTrack ? await this.videoTrack.isLive() : false;
        Logger.log(`[Live:Load] isLive=${this.isLive}, videoTrack=${!!this.videoTrack}, audioTrack=${!!this.audioTrack}, audioSink=${!!this.audioSink}`);

        if (this.isLive) {
            const [currentDur, refreshInterval] = await Promise.all([
                this.videoTrack.getDurationFromMetadata({ skipLiveWait: true }),
                this.videoTrack.getLiveRefreshInterval(),
            ]);
            this._liveStartTimestamp = currentDur ?? 0;
            Logger.log(`[Live:Load] liveStartTs=${this._liveStartTimestamp.toFixed(3)}, liveEdge=${(currentDur ?? 0).toFixed(3)}, refreshInterval=${refreshInterval ?? 6}s`);
            this.duration = 0;
        } else {
            this._liveStartTimestamp = null;
            this.duration = await this.input.getDurationFromMetadata() ?? 0;
            Logger.log(`[Live:Load] VOD duration=${this.duration.toFixed(3)}s`);
        }

        this._updateTimeDisplay();
        this._updateStreamUI();
    }

    _restoreSavedSubtitles(savedSubtitles) { this.subtitles.restoreSavedSubtitles(savedSubtitles); }

    /**
     * Cleanup audio-only playback visualizer
     * @private
     */
    _cleanupAudio() {
        this.isAudioMode = false;

        if (this.audioVisualizer) {
            this.audioVisualizer.disconnect();
            this.audioVisualizer = null;
        }
    }



    /**
     * Reset UI elements (canvas, time, progress)
     */
    resetUI() {
        this._clearCanvas();

        // Reset time and duration
        this.currentTime = 0;
        this.duration = 0;
        this._updateTimeDisplay();
        this._updateProgress();

        // Note: Don't hide loader here - let the caller control loading state
    }

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
    async _cleanupMediaBunny() {
        // Await iterator cleanup before disposing resources
        try {
            if (this.videoFrameIterator) {
                await this.videoFrameIterator.return();
            }
        } catch (e) { /* ignore */ }
        this.videoFrameIterator = null;

        try {
            if (this.audioBufferIterator) {
                await this.audioBufferIterator.return();
            }
        } catch (e) { /* ignore */ }
        this.audioBufferIterator = null;

        // Dispose sinks and input (safe now that iterators are closed)
        this._disposeMediaBunnyResources();

        this.videoTrack = null;
        this.audioTrack = null;
        this.nextFrame = null;
    }

    _cleanupHLS() { this.stream.cleanupHLS(); }
    _createErrorOverlay() { this.stream.createErrorOverlay(); }
    _showStreamError(errorDetails) { this.stream.showStreamError(errorDetails); }
    _hideStreamError() { this.stream.hideStreamError(); }

    /**
     * Load a subtitle file (VTT, SRT, or JSON transcript)
     * @param {string} url - URL of the subtitle file
     */
    async loadSubtitle(url) { return this.subtitles.loadSubtitle(url); }

    /**
     * Render a specific frame
     * @param {number} timestamp
     * @param {boolean} updateTime - Whether to update the player's current time from the frame
     */
    /**
     * Iterates over the video frame iterator until it finds a video frame in the future.
     */
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
    _getPlaybackTime() {
        // Stream mode (HLS) delegates to video element
        if (this.isStreamMode && this.streamVideo) {
            return this.streamVideo.currentTime;
        }

        // File-based playback (MediaBunny) - Stopwatch Mode
        // We use performance.now() as the Master Clock to ensure linearity and prevent jumps.
        if (this.isPlaying && this.fallbackStartTime !== undefined) {
            const elapsedRealTime = (performance.now() - this.fallbackStartTime) / 1000;
            return elapsedRealTime * this.playbackRate + this.playbackTimeAtStart;
        }

        return this.playbackTimeAtStart;
    }

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
    async _handleVisibilityChange() {
        // Skip for stream mode - native video element handles this
        if (this.isStreamMode) return;

        // Only handle if we're currently playing
        if (!this.isPlaying) return;

        if (document.hidden) {
            // Tab is now hidden - remember state but don't pause (audio continues)
            this._wasHiddenWhilePlaying = true;
            Logger.log(`[Visibility] Tab hidden at playback time: ${this._getPlaybackTime().toFixed(2)}s`);
        } else if (this._wasHiddenWhilePlaying) {
            // Tab is now visible again - use live edge (audio throttle will keep sync)
            this._setLoading(true);
            if (this.isLive && this.videoTrack) {
                const currentLiveEdge = await this.videoTrack.getDurationFromMetadata({ skipLiveWait: true });
                this._liveStartTimestamp = currentLiveEdge ?? 0;
                Logger.log(`[Visibility:Visible:Live] Live edge ${currentLiveEdge?.toFixed(3)}`);
                this._startLiveVideoLoop();
            } else if (this.isLive) {
                // Fallback: just restart
                this._startLiveVideoLoop();
            } else {
                // For VOD: restart video from where audio is
                const currentTime = this._getPlaybackTime();
                Logger.log(`[Visibility] Tab visible, syncing video to: ${currentTime.toFixed(2)}s`);
                this._startVideoIterator();
            }

            // Clear the flag
            this._wasHiddenWhilePlaying = false;
        }
    }

    /**
     * Toggle play/pause
     */
    togglePlay() {
        // Restore audio if muted for autoplay (user is now interacting)
        if (this._wasMutedForAutoplay && this.gainNode) {
            Logger.log('[Autoplay] Play button pressed, restoring audio...');
            this.config.muted = false;
            this.gainNode.gain.value = this.config.volume;
            this._wasMutedForAutoplay = false;
            this._updateVolumeUI();
        }

        // If no video loaded (neither file nor stream), try to request play from playlist
        if (!this.videoTrack && !this.audioTrack && !this.isStreamMode && !this.currentVideoId) {
            if (this.onPlayRequest) {
                this.onPlayRequest();
            }
            return;
        }

        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

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
                if (this.audioBufferIterator) await this.audioBufferIterator.return();
                const startTime = this._getPlaybackTime();
                Logger.log(`[Play] Starting audio iterator at time: ${startTime.toFixed(2)}s`);
                this.audioBufferIterator = this.audioSink.samples(startTime);
                this._runAudioIterator();
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
        const firstFrame = (await this.videoFrameIterator.next()).value ?? null;
        const secondFrame = (await this.videoFrameIterator.next()).value ?? null;

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

        const myIterator = this.audioBufferIterator;
        // Live mode: anchorWall/anchorContent are set.
        //   nextAudioTime is initialized to the anchor-relative position of the first sample,
        //   then samples are scheduled sequentially. This guarantees perfect initial A/V sync
        //   while preventing drift accumulation when live segments arrive late.
        // VOD mode: no anchors; linear sequential scheduling from audioContext.currentTime.
        const isLiveMode = anchorWall !== undefined && anchorContent !== undefined;
        // For live mode, nextAudioTime is aligned to the first sample below; use anchorWall
        // as a temporary sentinel so VOD fallback keeps working until the first sample runs.
        let nextAudioTime = isLiveMode && prefetchedSample
            ? anchorWall + (prefetchedSample.timestamp - anchorContent)
            : (anchorWall ?? ((this.audioContext?.currentTime || 0) + 0.1));
        let sampleCount = 0;

        Logger.log(`[Live:Audio] Iterator started — mode=${isLiveMode ? 'live' : 'vod'}, anchorWall=${anchorWall?.toFixed(3)}, anchorContent=${anchorContent?.toFixed(3)}, nextAudioTime=${nextAudioTime.toFixed(3)}, audioCtx=${this.audioContext?.currentTime?.toFixed(3)}, audioCtxState=${this.audioContext?.state}`);

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

            const startAt = Math.max(nextAudioTime, this.audioContext.currentTime + 0.02);

            if (isLiveMode && sampleCount === 0) {
                const theoreticalTarget = anchorWall + (timestamp - anchorContent);
                Logger.log(`[Live:Audio] First sample — ts=${timestamp.toFixed(3)}, theoreticalTarget=${theoreticalTarget.toFixed(3)}, startAt=${startAt.toFixed(3)}, drift=${((startAt - theoreticalTarget) * 1000).toFixed(1)}ms, bufDur=${buffer.duration.toFixed(3)}s`);
            }

            audioSource.start(startAt);
            nextAudioTime = startAt + buffer.duration / this.playbackRate;
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
                    Logger.log(`[Live:Audio] First iterator sample — ts=${timestamp.toFixed(3)}, audioCtx=${this.audioContext?.currentTime?.toFixed(3)}, nextAudioTime=${nextAudioTime.toFixed(3)}`);
                }
                if (sampleCount % 100 === 0) {
                    Logger.log(`[Live:Audio] ${sampleCount} samples — ts=${timestamp.toFixed(3)}, audioCtx=${this.audioContext?.currentTime?.toFixed(3)}, nextAudioTime=${nextAudioTime.toFixed(3)}, buffer=${((nextAudioTime - this.audioContext.currentTime) * 1000).toFixed(0)}ms`);
                }

// Live mode: throttle to keep audio close to video position
                // For live streams, audio should stay ~300ms ahead to allow video to catch up
                if (isLiveMode && this.audioContext && anchorWall && anchorContent) {
                    const videoContentTime = anchorContent + (this.audioContext.currentTime - anchorWall);
                    const audioContentTime = anchorContent + (nextAudioTime - anchorWall);
                    const audioAheadMs = (audioContentTime - videoContentTime) * 1000;
                    if (audioAheadMs > 300) {
                        const waitMs = audioAheadMs - 300;
                        if (sampleCount % 200 === 0) {
                            Logger.log(`[Live:Audio] Audio ${audioAheadMs.toFixed(0)}ms ahead — throttling ${waitMs.toFixed(0)}ms`);
                        }
                        await new Promise(r => setTimeout(r, waitMs));
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
            Logger.log(`[Live:Audio] Iterator completed after ${sampleCount} samples`);
        } catch (error) {
            if (error.name !== 'InputDisposedError' && !error.message?.includes('Input has been disposed')) {
                Logger.error(`[Live:Audio] Iterator error after ${sampleCount} samples:`, error);
            } else {
                Logger.log(`[Live:Audio] Iterator stopped (input disposed) after ${sampleCount} samples`);
            }
        } finally {
            Logger.log(`[Live:Audio] Cleanup — sampleCount=${sampleCount}, isOurIterator=${this.audioBufferIterator === myIterator}`);
            if (this.audioBufferIterator === myIterator) {
                try { await myIterator.return(); } catch (e) { }
            }
        }
    }

    async _seekTo(time) {
        Logger.log(`_seekTo called with time: ${time}`);

        this._setLoading(true);

        const wasPlaying = this.isPlaying;

        if (wasPlaying) {
            this.pause(false); // Don't show overlay during seek pause
        }

        this.playbackTimeAtStart = Math.max(0, Math.min(this.duration, time));
        this.currentTime = this.playbackTimeAtStart; // Sync internal currentTime for UI
        this._updateProgress(); // Update UI immediately

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
    _loadControlBarMode() {
        try {
            const savedMode = localStorage.getItem('controlBarMode');
            if (savedMode === 'fixed' || savedMode === 'overlay') {
                this.controlBarMode = savedMode;
            }
        } catch (e) {
            Logger.warn('Failed to load control bar mode:', e);
        }
        this._applyControlBarMode();
    }

    /**
     * Save control bar mode to localStorage
     * @private
     */
    _saveControlBarMode() {
        try {
            localStorage.setItem('controlBarMode', this.controlBarMode);
        } catch (e) {
            Logger.warn('Failed to save control bar mode:', e);
        }
    }

    /**
     * Toggle between overlay and fixed control bar modes
     */
    toggleControlBarMode() {
        this.controlBarMode = this.controlBarMode === 'overlay' ? 'fixed' : 'overlay';
        this._applyControlBarMode();
        this._saveControlBarMode();
    }

    /**
     * Apply the current control bar mode
     * @private
     */
    _applyControlBarMode() {
        // Remove both classes
        this.container.classList.remove('mode-overlay', 'mode-fixed');

        // Add current mode class
        this.container.classList.add(`mode-${this.controlBarMode}`);

        // Update button aria-label and aria-pressed (only if button exists)
        if (this.ui.modeToggleBtn) {
            const isFixed = this.controlBarMode === 'fixed';
            this.ui.modeToggleBtn.setAttribute('aria-label', isFixed ? 'Unpin controls' : 'Pin controls');
            this.ui.modeToggleBtn.setAttribute('aria-pressed', isFixed.toString());
            this.ui.modeToggleBtn.setAttribute('title', isFixed ? 'Unpin controls' : 'Pin controls');
        }

        // Handle auto-hide
        if (this.controlBarMode === 'overlay') {
            // Show controls initially
            this.ui.controls.classList.add('visible');
            this._startAutoHideTimer();
        } else {
            this._clearAutoHideTimer();
            this.ui.controls.classList.add('visible');
        }

        // Resize canvas to fill container in audio mode when pin changes
        if (this.isAudioMode) {
            const containerRect = this.container.getBoundingClientRect();
            this.canvas.width = containerRect.width || 1280;
            this.canvas.height = containerRect.height || 720;

            // Redraw static background if not playing
            if (!this.isPlaying && this.audioVisualizer) {
                this.audioVisualizer.drawStaticBackground();
            }
        }
    }

    /**
     * Handle mouse movement for auto-hide
     * @private
     */
    _handleMouseMove(e) {
        if (this.controlBarMode !== 'overlay') return;

        // Show controls (Rule 2 & 3)
        this.ui.controls.classList.add('visible');

        // Reset timer
        this._clearAutoHideTimer();

        // Don't auto-hide if paused
        if (!this.isPlaying) return;

        // Check if mouse is over controls (using coordinates for reliability)
        const controlsRect = this.ui.controls.getBoundingClientRect();
        const isOverControls = e.clientY >= controlsRect.top &&
            e.clientY <= controlsRect.bottom &&
            e.clientX >= controlsRect.left &&
            e.clientX <= controlsRect.right;

        // Only start auto-hide timer if NOT over controls (Rule 1 & 3)
        if (!isOverControls) {
            this._startAutoHideTimer();
        }
    }

    /**
     * Start auto-hide timer (3 seconds)
     * @private
     */
    _startAutoHideTimer() {
        if (this.controlBarMode !== 'overlay') return;
        if (!this.isPlaying) return; // Don't hide when paused

        this._clearAutoHideTimer();
        this.autoHideTimer = setTimeout(() => {
            this.ui.controls.classList.remove('visible');
            // Also hide cursor
            this.container.classList.add('hide-cursor');
        }, 3000);
    }

    /**
     * Clear auto-hide timer
     * @private
     */
    _clearAutoHideTimer() {
        if (this.autoHideTimer) {
            clearTimeout(this.autoHideTimer);
            this.autoHideTimer = null;
        }
        // Show cursor when timer is cleared
        this.container.classList.remove('hide-cursor');
    }
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

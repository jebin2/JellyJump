/**
 * Core Player Class
 * The main controller for video playback using MediaBunny.
 */

import { MediaBunny } from './MediaBunny.js';
import { PLAYER_CONFIG } from './config.js';
import { SubtitleManager } from './SubtitleManager.js';
import { ScreenshotManager } from '../player/ScreenshotManager.js';
import { VideoFilters } from '../player/VideoFilters.js';
import { AudioEqualizer } from '../player/AudioEqualizer.js';

export class CorePlayer {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`Container with ID "${containerId}" not found.`);
            return;
        }

        this.config = { ...PLAYER_CONFIG, ...options };
        this.canvas = null;
        this.ctx = null;
        this.isPlaying = false;
        this.currentTime = 0;
        this.duration = 0;
        this.playbackRate = parseFloat(localStorage.getItem('jellyjump-speed')) || 1.0;
        this.loopMode = 'off'; // 'off', 'all', 'ab'
        this.loopStart = null;
        this.loopEnd = null;
        this.animationFrameId = null;

        // Control bar mode
        this.controlBarMode = options.controlBarMode || 'overlay'; // 'overlay' or 'fixed'
        this.autoHideTimer = null;

        // Controls Configuration
        this.config.controls = {
            controlBar: true,  // Show/hide the entire control bar
            playPause: true,
            navigation: true,  // Enable/disable prev/next buttons
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
        this.audioContextStartTime = null;

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
            ccMenu: null,
            ccMenu: null,
            audioBtn: null,
            audioMenu: null,
            speedBtn: null,
            speedMenu: null,
            loopBtn: null,
            loopMarkerA: null,
            loopMarkerB: null,
            loopRegion: null,
            loopPanel: null,
            loopStartInput: null,
            loopStartInput: null,
            loopEndInput: null,
            playOverlay: null
        };

        // Navigation callbacks
        this.onNext = null;
        this.onPrevious = null;
        this.onEnded = null;

        // Current loaded video ID (url)
        this.currentVideoId = null;

        // Global Event Handlers (created conditionally based on which controls are enabled)
        this._handlers = {
            click: (e) => this._handleDocumentClick(e)
        };
        // Only create handlers that will be used
        if (this.config.controls.fullscreen) {
            this._handlers.fullscreen = this._updateFullscreenUI.bind(this);
        }
        if (this.config.controls.keyboard) {
            this._handlers.keydown = (e) => this._handleKeyboard(e);
        }

        this._init();
    }

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

            // Chain: EQ Output -> Gain Node -> Destination
            // Note: Source connection happens in _setupAudioNodes
            eqOutput.connect(this.gainNode);
        }

        this.gainNode.connect(this.audioContext.destination);

        // Set initial volume
        this.gainNode.gain.value = this.config.muted ? 0 : this.config.volume;

        this.isInitialized = true; // Fix: Use isAudioInitialized? No, existing code used isAudioInitialized
        this.isAudioInitialized = true;
    }

    /**
     * Create custom controls UI
     * @private
     */
    _createControls() {
        // ... (existing code)
    }

    // ... inside _createControls or similar where UI is cached ...
    // Wait, I need to find where UI caching happens. It's in the constructor usually or _createControls.
    // Let's look at the previous view of Player.js.
    // UI caching is in the constructor after _createControls.

    // I will split this into two edits if needed, but I can probably do it in one if I target the right lines.
    // The previous view showed _initAudio at line 280.
    // The UI caching was around line 316.

    // Let's stick to _initAudio first.


    /**
     * Create custom controls UI
     * @private
     */
    _createControls() {
        // Loader
        const loaderTemplate = document.getElementById('player-loader-template');
        this.container.appendChild(loaderTemplate.content.cloneNode(true));
        this.ui.loader = this.container.querySelector('.jellyjump-loader');

        // Controls
        const controlsTemplate = document.getElementById('player-controls-template');
        this.container.appendChild(controlsTemplate.content.cloneNode(true));

        // Loop Panel (only if loop control is enabled)
        if (this.config.controls.loop) {
            const loopPanelTemplate = document.getElementById('player-loop-panel-template');
            this.container.appendChild(loopPanelTemplate.content.cloneNode(true));
        }

        // Initialize Screenshot Manager UI (must be after controls, before caching)
        if (this.screenshotManager) {
            this.screenshotManager.init();
        }

        // Cache control container and play overlay (always needed)
        this.ui.controls = this.container.querySelector('.jellyjump-controls');
        this.ui.playOverlay = this.container.querySelector('.jellyjump-play-overlay');

        // Cache elements only if their control is enabled
        // Visibility is handled by data-control attributes (hidden by default in HTML)
        if (this.config.controls.playPause) {
            this.ui.playBtn = this.container.querySelector('#mb-play-btn');
        }

        if (this.config.controls.navigation) {
            this.ui.prevBtn = this.container.querySelector('#mb-prev-btn');
            this.ui.nextBtn = this.container.querySelector('#mb-next-btn');
        }

        if (this.config.controls.progress) {
            this.ui.progressContainer = this.container.querySelector('.jellyjump-progress-container');
            this.ui.progressBar = this.container.querySelector('.jellyjump-progress-bar');
        }

        if (this.config.controls.time) {
            this.ui.timeDisplay = this.container.querySelector('#mb-time-display');
        }

        if (this.config.controls.volume) {
            this.ui.muteBtn = this.container.querySelector('#mb-mute-btn');
            this.ui.volumeSlider = this.container.querySelector('#mb-volume-slider');
        }

        if (this.config.controls.fullscreen) {
            this.ui.fullscreenBtn = this.container.querySelector('#mb-fullscreen-btn');
        }

        if (this.config.controls.modeToggle) {
            this.ui.modeToggleBtn = this.container.querySelector('#mb-mode-toggle-btn');
        }

        if (this.config.controls.captions) {
            this.ui.ccBtn = this.container.querySelector('#mb-cc-btn');
            this.ui.ccMenu = this.container.querySelector('#mb-cc-menu');
            this.ui.ccInput = this.container.querySelector('#mb-cc-input');
            this.ui.audioContainer = this.container.querySelector('#mb-audio-container');
            this.ui.audioBtn = this.container.querySelector('#mb-audio-btn');
            this.ui.audioMenu = this.container.querySelector('#mb-audio-menu');
        }

        if (this.config.controls.speed) {
            this.ui.speedBtn = this.container.querySelector('#mb-speed-btn');
            this.ui.speedMenu = this.container.querySelector('#mb-speed-menu');
        }

        if (this.config.controls.loop) {
            this.ui.loopBtn = this.container.querySelector('#mb-loop-btn');
            this.ui.loopMarkerA = this.container.querySelector('.jellyjump-marker.marker-a');
            this.ui.loopMarkerB = this.container.querySelector('.jellyjump-marker.marker-b');
            this.ui.loopRegion = this.container.querySelector('.jellyjump-loop-region');
            this.ui.loopPanel = this.container.querySelector('.jellyjump-loop-panel');
            this.ui.loopStartInput = this.container.querySelector('#mb-loop-start');
            this.ui.loopEndInput = this.container.querySelector('#mb-loop-end');
            this.ui.loopStatus = this.container.querySelector('#mb-loop-status');
            this.ui.setABtn = this.container.querySelector('#mb-set-a-btn');
            this.ui.setBBtn = this.container.querySelector('#mb-set-b-btn');
            this.ui.clearLoopBtn = this.container.querySelector('#mb-clear-loop-btn');
            this.ui.closeLoopPanelBtn = this.container.querySelector('.jellyjump-loop-panel .jellyjump-close-btn');
        }

        // Filter Panel (only if filters control is enabled)
        if (this.config.controls.filters) {
            const filterPanelTemplate = document.getElementById('player-filter-panel-template');
            if (filterPanelTemplate) {
                this.container.appendChild(filterPanelTemplate.content.cloneNode(true));
            }

            this.ui.filtersBtn = this.container.querySelector('#mb-filters-btn');
            this.ui.filterPanel = this.container.querySelector('.jellyjump-filter-panel');
            this.ui.brightnessSlider = this.container.querySelector('#mb-filter-brightness');
            this.ui.contrastSlider = this.container.querySelector('#mb-filter-contrast');
            this.ui.saturationSlider = this.container.querySelector('#mb-filter-saturation');
            this.ui.brightnessValue = this.container.querySelector('#mb-brightness-value');
            this.ui.contrastValue = this.container.querySelector('#mb-contrast-value');
            this.ui.saturationValue = this.container.querySelector('#mb-saturation-value');
            this.ui.resetFiltersBtn = this.container.querySelector('#mb-reset-filters-btn');
            this.ui.closeFilterPanelBtn = this.container.querySelector('.jellyjump-filter-panel .jellyjump-close-btn');

            // Initialize VideoFilters
            this.videoFilters = new VideoFilters(this.canvas);
        }

        // Equalizer Panel (only if equalizer control is enabled)
        if (this.config.controls.equalizer) {
            const eqPanelTemplate = document.getElementById('player-eq-panel-template');
            if (eqPanelTemplate) {
                this.container.appendChild(eqPanelTemplate.content.cloneNode(true));
            }

            this.ui.eqBtn = this.container.querySelector('#mb-eq-btn');
            this.ui.eqPanel = this.container.querySelector('.jellyjump-eq-panel');
            this.ui.eqBassSlider = this.container.querySelector('#mb-eq-bass');
            this.ui.eqMidSlider = this.container.querySelector('#mb-eq-mid');
            this.ui.eqTrebleSlider = this.container.querySelector('#mb-eq-treble');
            this.ui.eqBassValue = this.container.querySelector('#mb-bass-value');
            this.ui.eqMidValue = this.container.querySelector('#mb-mid-value');
            this.ui.eqTrebleValue = this.container.querySelector('#mb-treble-value');
            this.ui.resetEqBtn = this.container.querySelector('#mb-reset-eq-btn');
            this.ui.closeEqPanelBtn = this.container.querySelector('.jellyjump-eq-panel .jellyjump-close-btn');
        }

        // Apply visibility based on config (removes control--hidden class for enabled controls)
        this._applyControlVisibility();

        // Only update speed menu if speed is enabled
        if (this.config.controls.speed) {
            this._updateSpeedMenu();
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
        this.canvas.addEventListener('click', () => this.togglePlay());
        if (this.ui.playOverlay) {
            this.ui.playOverlay.addEventListener('click', () => this.play());
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

        // Seek (only if progress enabled)
        if (this.config.controls.progress && this.ui.progressContainer) {
            this.ui.progressContainer.addEventListener('click', (e) => this._seek(e));
        }

        // Volume (only if enabled)
        if (this.config.controls.volume && this.ui.volumeSlider) {
            this.ui.volumeSlider.addEventListener('input', (e) => {
                this.config.volume = parseFloat(e.target.value);
                this.config.muted = false;

                if (this.gainNode) {
                    this.gainNode.gain.value = this.config.volume;
                }
                this._updateVolumeIcon();
            });
        }

        if (this.config.controls.volume && this.ui.muteBtn) {
            this.ui.muteBtn.addEventListener('click', () => {
                this.config.muted = !this.config.muted;

                if (this.gainNode) {
                    this.gainNode.gain.value = this.config.muted ? 0 : this.config.volume;
                }
                this._updateVolumeIcon();
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
        if (this.config.controls.captions && this.ui.ccBtn) {
            this.ui.ccBtn.addEventListener('click', () => {
                this.ui.ccMenu.classList.toggle('visible');
                this.ui.ccBtn.setAttribute('aria-expanded', this.ui.ccMenu.classList.contains('visible'));
            });

            this.ui.ccMenu.addEventListener('click', (e) => {
                const item = e.target.closest('.jellyjump-menu-item');
                if (!item) return;

                if (item.id === 'mb-upload-cc') {
                    this.ui.ccInput.click();
                } else {
                    const value = item.dataset.value;
                    if (value === 'off') {
                        this.isSubtitlesEnabled = false;
                    } else {
                        // Handle track selection if multiple tracks supported
                    }
                    this._updateSubtitleMenu();
                    this.ui.ccMenu.classList.remove('visible');
                }
            });

            this.ui.ccInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const url = URL.createObjectURL(file);
                    this.loadSubtitle(url);
                    this.ui.ccMenu.classList.remove('visible');
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

        // Speed (only if enabled)
        if (this.config.controls.speed && this.ui.speedBtn) {
            this.ui.speedBtn.addEventListener('click', () => {
                this.ui.speedMenu.classList.toggle('visible');
                this.ui.speedBtn.setAttribute('aria-expanded', this.ui.speedMenu.classList.contains('visible'));
            });

            this.ui.speedMenu.addEventListener('click', (e) => {
                const item = e.target.closest('.jellyjump-menu-item');
                if (!item) return;

                const speed = parseFloat(item.dataset.value);
                this.setPlaybackRate(speed);
                this.ui.speedMenu.classList.remove('visible');
            });
        }

        // Fullscreen Change Events (only if fullscreen enabled)
        if (this.config.controls.fullscreen) {
            document.addEventListener('fullscreenchange', this._handlers.fullscreen);
            document.addEventListener('webkitfullscreenchange', this._handlers.fullscreen);
            document.addEventListener('mozfullscreenchange', this._handlers.fullscreen);
            document.addEventListener('MSFullscreenChange', this._handlers.fullscreen);
        }

        // Loop Control (only if loop enabled)
        if (this.config.controls.loop) {
            this.ui.loopBtn.addEventListener('click', () => this.toggleLoopMode());
            // Context menu to open loop panel
            this.ui.loopBtn.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.toggleLoopPanel();
            });

            // Loop Panel Events
            this.ui.closeLoopPanelBtn.addEventListener('click', () => this.toggleLoopPanel());
            this.ui.setABtn.addEventListener('click', () => this.setLoopStart());
            this.ui.setBBtn.addEventListener('click', () => this.setLoopEnd());
            this.ui.clearLoopBtn.addEventListener('click', () => this.clearLoopMarkers());

            this.ui.loopStartInput.addEventListener('change', (e) => {
                const time = this._parseTime(e.target.value);
                if (time !== null) {
                    this.loopStart = time;
                    this.loopMode = 'ab';
                    this._updateLoopUI();
                }
            });

            this.ui.loopEndInput.addEventListener('change', (e) => {
                const time = this._parseTime(e.target.value);
                if (time !== null) {
                    this.loopEnd = time;
                    this.loopMode = 'ab';
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
        if (this.config.controls.equalizer && this.ui.eqBtn) {
            // Toggle EQ panel
            this.ui.eqBtn.addEventListener('click', () => this.toggleEqPanel());

            // Close button
            if (this.ui.closeEqPanelBtn) {
                this.ui.closeEqPanelBtn.addEventListener('click', () => this.toggleEqPanel());
            }

            // Bass slider
            if (this.ui.eqBassSlider) {
                this.ui.eqBassSlider.addEventListener('input', (e) => {
                    const value = parseInt(e.target.value);
                    this.audioEqualizer.setBass(value);
                    this.ui.eqBassValue.textContent = value;
                    this._updateEqButtonState();
                });
            }

            // Mid slider
            if (this.ui.eqMidSlider) {
                this.ui.eqMidSlider.addEventListener('input', (e) => {
                    const value = parseInt(e.target.value);
                    this.audioEqualizer.setMid(value);
                    this.ui.eqMidValue.textContent = value;
                    this._updateEqButtonState();
                });
            }

            // Treble slider
            if (this.ui.eqTrebleSlider) {
                this.ui.eqTrebleSlider.addEventListener('input', (e) => {
                    const value = parseInt(e.target.value);
                    this.audioEqualizer.setTreble(value);
                    this.ui.eqTrebleValue.textContent = value;
                    this._updateEqButtonState();
                });
            }

            // Preset buttons
            this.container.querySelectorAll('.eq-preset-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const preset = btn.dataset.preset;
                    this.audioEqualizer.applyPreset(preset);
                    this._syncEqSliders();
                    this._updateEqButtonState();
                });
            });

            // Reset button
            if (this.ui.resetEqBtn) {
                this.ui.resetEqBtn.addEventListener('click', () => {
                    this.audioEqualizer.reset();
                    this._syncEqSliders();
                    this._updateEqButtonState();
                });
            }
        }

        // Close menus when clicking outside
        document.addEventListener('click', this._handlers.click);

        // Keyboard Shortcuts (only if enabled in config)
        if (this.config.controls.keyboard) {
            document.addEventListener('keydown', this._handlers.keydown);
        }
    }

    _handleDocumentClick(e) {
        // Only check elements that exist
        if (this.ui.ccBtn && this.ui.ccMenu && !this.ui.ccBtn.contains(e.target) && !this.ui.ccMenu.contains(e.target)) {
            this.ui.ccMenu.classList.remove('visible');
        }
        if (this.ui.audioBtn && this.ui.audioMenu && !this.ui.audioBtn.contains(e.target) && !this.ui.audioMenu.contains(e.target)) {
            this.ui.audioMenu.classList.remove('visible');
        }
        if (this.ui.speedBtn && this.ui.speedMenu && !this.ui.speedBtn.contains(e.target) && !this.ui.speedMenu.contains(e.target)) {
            this.ui.speedMenu.classList.remove('visible');
        }
        // Hide filter panel when clicking outside
        if (this.ui.filterPanel && this.ui.filtersBtn &&
            !this.ui.filtersBtn.contains(e.target) && !this.ui.filterPanel.contains(e.target)) {
            this.ui.filterPanel.style.display = 'none';
        }
        // Hide EQ panel when clicking outside
        if (this.ui.eqPanel && this.ui.eqBtn &&
            !this.ui.eqBtn.contains(e.target) && !this.ui.eqPanel.contains(e.target)) {
            this.ui.eqPanel.style.display = 'none';
        }
    }

    _updateSpeedMenu() {
        // Skip if speed control is disabled
        if (!this.ui.speedMenu || !this.ui.speedBtn) return;

        const items = this.ui.speedMenu.querySelectorAll('.jellyjump-menu-item');
        items.forEach(item => {
            const speed = parseFloat(item.dataset.value);
            if (speed === this.playbackRate) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        this.ui.speedBtn.textContent = this.playbackRate === 1 ? '1x' : `${this.playbackRate}x`;
        if (this.playbackRate !== 1) {
            this.ui.speedBtn.style.color = 'var(--accent-primary)';
        } else {
            this.ui.speedBtn.style.color = '';
        }
    }

    /**
     * Toggle Loop Mode: Off -> Playlist -> One -> Off
     */
    toggleLoopMode() {
        if (this.loopMode === 'off') {
            this.loopMode = 'playlist';
        } else if (this.loopMode === 'playlist') {
            this.loopMode = 'one';
        } else {
            this.loopMode = 'off';
        }
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
     * Toggle audio equalizer panel visibility
     */
    toggleEqPanel() {
        if (!this.ui.eqPanel) return;
        const isVisible = this.ui.eqPanel.style.display !== 'none';
        this.ui.eqPanel.style.display = isVisible ? 'none' : 'block';
        if (!isVisible) {
            this._syncEqSliders(); // Ensure sliders match current state
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
     * Update EQ button to show active state when EQ is applied
     * @private
     */
    _updateEqButtonState() {
        if (!this.ui.eqBtn || !this.audioEqualizer) return;

        if (this.audioEqualizer.isActive()) {
            this.ui.eqBtn.style.color = 'var(--accent-primary)';
            this.ui.eqBtn.setAttribute('aria-label', 'Audio Equalizer (Active)');
        } else {
            this.ui.eqBtn.style.color = '';
            this.ui.eqBtn.setAttribute('aria-label', 'Audio Equalizer');
        }
    }

    setLoopStart() {
        this.loopStart = this.currentTime;
        if (this.loopEnd !== null && this.loopStart >= this.loopEnd) {
            this.loopEnd = null; // Reset end if start is after it
        }
        this.loopMode = 'ab'; // Auto-enable A-B mode
        this._updateLoopUI();
        console.log('Loop Start set:', this.loopStart);
    }

    setLoopEnd() {
        if (this.loopStart === null) {
            this.setLoopStart(); // If no start, set start instead
            return;
        }
        if (this.currentTime <= this.loopStart) {
            console.warn('Loop End must be after Loop Start');
            return;
        }
        this.loopEnd = this.currentTime;
        this.loopMode = 'ab'; // Auto-enable A-B mode
        this._updateLoopUI();
        console.log('Loop End set:', this.loopEnd);
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
        // Update Button
        const btn = this.ui.loopBtn;
        const use = btn.querySelector('use');
        let statusText = 'Off';

        if (this.loopMode === 'off') {
            btn.style.color = '';
            btn.setAttribute('aria-label', 'Loop Mode: Off');
            use.setAttribute('href', 'assets/icons/sprite.svg#icon-loop');
            statusText = 'Off';
        } else if (this.loopMode === 'playlist') {
            btn.style.color = 'var(--accent-primary)';
            btn.setAttribute('aria-label', 'Loop Mode: Playlist');
            use.setAttribute('href', 'assets/icons/sprite.svg#icon-loop-playlist');
            statusText = 'Playlist';
        } else if (this.loopMode === 'one') {
            btn.style.color = 'var(--accent-primary)';
            btn.setAttribute('aria-label', 'Loop Mode: One');
            use.setAttribute('href', 'assets/icons/sprite.svg#icon-loop-one');
            statusText = 'Current Video';
        } else if (this.loopMode === 'ab') {
            btn.style.color = 'var(--accent-primary)';
            btn.setAttribute('aria-label', 'Loop Mode: A-B');
            use.setAttribute('href', 'assets/icons/sprite.svg#icon-loop-ab');
            statusText = 'A-B Loop';
        }

        // Update Panel
        if (this.ui.loopStatus) {
            this.ui.loopStatus.textContent = statusText;
            this.ui.loopStartInput.value = this.loopStart !== null ? this._formatTime(this.loopStart) : '';
            this.ui.loopEndInput.value = this.loopEnd !== null ? this._formatTime(this.loopEnd) : '';
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

    _updateSubtitleMenu() {
        // Skip if captions control is disabled
        if (!this.ui.ccMenu || !this.ui.ccBtn) return;

        // Remove old custom track items (keep Off and Upload)
        const oldCustomItems = this.ui.ccMenu.querySelectorAll('[data-value^="custom-"]');
        oldCustomItems.forEach(item => item.remove());

        // Clear active states
        this.ui.ccMenu.querySelectorAll('.jellyjump-menu-item').forEach(item => {
            item.classList.remove('active');
        });

        // Add menu items for each subtitle track
        const uploadItem = this.ui.ccMenu.querySelector('#mb-upload-cc');
        this.subtitleTracks.forEach(track => {
            const trackItem = document.createElement('div');
            trackItem.className = 'jellyjump-menu-item';
            trackItem.setAttribute('data-value', track.id);
            trackItem.setAttribute('role', 'menuitem');
            trackItem.setAttribute('tabindex', '0');
            trackItem.textContent = track.name;

            // Insert before upload button
            if (uploadItem) {
                this.ui.ccMenu.insertBefore(trackItem, uploadItem);
            } else {
                this.ui.ccMenu.appendChild(trackItem);
            }

            // Add click handler
            trackItem.addEventListener('click', () => {
                this._switchSubtitleTrack(track.id);
                this.ui.ccMenu.classList.remove('visible');
            });
        });

        // Update active states
        if (!this.isSubtitlesEnabled) {
            this.ui.ccMenu.querySelector('[data-value="off"]').classList.add('active');
            this.ui.ccBtn.classList.remove('active');
        } else {
            const activeItem = this.ui.ccMenu.querySelector(`[data-value="${this.activeSubtitleTrackId}"]`);
            if (activeItem) {
                activeItem.classList.add('active');
            }
            this.ui.ccBtn.classList.add('active');
        }
    }

    /**
     * Switch to a different subtitle track
     * @param {string} trackId 
     * @private
     */
    _switchSubtitleTrack(trackId) {
        const track = this.subtitleTracks.find(t => t.id === trackId);
        if (!track) return;

        // Load the cues into the subtitle manager
        this.subtitleManager.cues = [...track.cues];
        this.activeSubtitleTrackId = trackId;
        this.isSubtitlesEnabled = true;
        this._updateSubtitleMenu();
        console.log(`Switched to subtitle track: ${track.name}`);
    }

    async _switchAudioTrack(trackId) {
        if (!this.input) return;

        const audioTracks = await this.input.getAudioTracks();
        const track = audioTracks.find(t => t.id === trackId);

        if (track) {
            this.audioTrack = track;

            // Re-create sink
            if (this.audioSink) {
                // Ideally we should destroy the old sink if method exists, 
                // but JS GC should handle it if we drop reference
            }
            // Use AudioSampleSink instead of AudioBufferSink to avoid MediaBunny bug
            // where AudioSamples aren't closed properly
            this.audioSink = new MediaBunny.AudioSampleSink(this.audioTrack);

            // Update UI
            this._updateAudioTracks();
            console.log(`Switched to audio track: ${track.id}`);
        }
    }

    async _updateAudioTracks() {
        // Skip if captions control is disabled (audio tracks are under captions)
        if (!this.ui.audioMenu || !this.ui.audioContainer) return;

        this.ui.audioMenu.textContent = '';
        const tracks = this.input ? await this.input.getAudioTracks() : [];

        if (tracks.length <= 1) {
            this.ui.audioContainer.style.display = 'none';
            return;
        }

        this.ui.audioContainer.style.display = 'block';
        const template = document.getElementById('player-menu-item-template');

        tracks.forEach((track, index) => {
            const item = template.content.cloneNode(true).querySelector('.jellyjump-menu-item');
            item.textContent = track.languageCode || `Track ${index + 1}`;
            item.dataset.value = track.id;

            if (this.audioTrack && this.audioTrack.id === track.id) {
                item.classList.add('active');
            }

            this.ui.audioMenu.appendChild(item);
        });
    }

    /**
     * Handle keyboard shortcuts
     * @param {KeyboardEvent} e 
     * @private
     */
    _handleKeyboard(e) {
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
        if (e.ctrlKey || e.altKey || e.metaKey) return;

        const key = e.key.toLowerCase();

        switch (key) {
            // Playback Controls
            case ' ':
            case 'k':
                e.preventDefault();
                this.togglePlay();
                break;
            case 'j':
                e.preventDefault();
                this._seekTo(Math.max(0, this.currentTime - 10));
                break;
            case 'l':
                if (e.shiftKey) {
                    e.preventDefault();
                    this.clearLoopMarkers();
                } else {
                    e.preventDefault();
                    this._seekTo(Math.min(this.duration, this.currentTime + 10));
                }
                break;
            case 'arrowleft':
                e.preventDefault();
                this._seekTo(Math.max(0, this.currentTime - 5));
                break;
            case 'arrowright':
                e.preventDefault();
                this._seekTo(Math.min(this.duration, this.currentTime + 5));
                break;
            case 'home':
                e.preventDefault();
                this._seekTo(0);
                break;
            case 'end':
                e.preventDefault();
                this._seekTo(this.duration);
                break;

            // Number Keys - Seek to percentage
            case '0': case '1': case '2': case '3': case '4':
            case '5': case '6': case '7': case '8': case '9':
                e.preventDefault();
                const percent = parseInt(key) / 10;
                this._seekTo(this.duration * percent);
                break;

            // Audio Controls
            case 'arrowup':
                e.preventDefault();
                this.config.volume = Math.min(1, this.config.volume + 0.1);
                this.config.muted = false;
                this.ui.volumeSlider.value = this.config.volume;
                if (this.gainNode) this.gainNode.gain.value = this.config.volume;
                this._updateVolumeIcon();
                break;
            case 'arrowdown':
                e.preventDefault();
                this.config.volume = Math.max(0, this.config.volume - 0.1);
                this.ui.volumeSlider.value = this.config.volume;
                if (this.gainNode) this.gainNode.gain.value = this.config.volume;
                this._updateVolumeIcon();
                break;
            case 'm':
                e.preventDefault();
                this.config.muted = !this.config.muted;
                if (this.gainNode) this.gainNode.gain.value = this.config.muted ? 0 : this.config.volume;
                this._updateVolumeIcon();
                break;

            // Display Controls
            case 'f':
                e.preventDefault();
                this.toggleFullscreen();
                break;
            case 'c':
                e.preventDefault();
                this.isSubtitlesEnabled = !this.isSubtitlesEnabled;
                this._updateSubtitleMenu();
                break;
            case 'escape':
                if (document.fullscreenElement) {
                    document.exitFullscreen();
                } else if (this.screenshotManager && this.screenshotManager.isModalOpen()) {
                    this.screenshotManager.closeModal();
                } else if (this.ui.helpOverlay.style.display !== 'none') {
                    this._toggleHelp();
                }
                break;

            // Help
            case '?':
                e.preventDefault();
                this._toggleHelp();
                break;

            // Screenshot
            case 's':
                e.preventDefault();
                if (this.screenshotManager) {
                    this.screenshotManager.capture();
                }
                break;

            // Navigation (Player Mode)
            case 'n':
                if (e.shiftKey && this.config.mode === 'player') {
                    e.preventDefault();
                    if (!this.ui.nextBtn.disabled && this.onNext) {
                        this.onNext();
                    }
                }
                break;
            case 'p':
                if (e.shiftKey && this.config.mode === 'player') {
                    e.preventDefault();
                    if (!this.ui.prevBtn.disabled && this.onPrevious) {
                        this.onPrevious();
                    }
                }
                break;
            case '<':
                if (e.shiftKey) {
                    e.preventDefault();
                    this._cycleSpeed(-1);
                }
                break;
            case '>':
                if (e.shiftKey) {
                    e.preventDefault();
                    this._cycleSpeed(1);
                }
                break;

            // Editor Mode Controls
            case ',':
                if (this.config.mode === 'editor') {
                    e.preventDefault();
                    this._stepFrame(-1);
                }
                break;
            case '.':
                if (this.config.mode === 'editor') {
                    e.preventDefault();
                    this._stepFrame(1);
                }
                break;
            case 'i':
                e.preventDefault();
                this.setLoopStart();
                break;
            case 'o':
                e.preventDefault();
                this.setLoopEnd();
                break;
            case 'r':
                e.preventDefault();
                this.resetLoop();
                break;
        }
    }

    /**
     * Toggle help overlay
     * @private
     */
    _toggleHelp() {
        const isVisible = this.ui.helpOverlay.style.display !== 'none';
        this.ui.helpOverlay.style.display = isVisible ? 'none' : 'flex';
    }

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
     * Reset the player state and unload media
     */
    reset() {
        this.pause();

        // Clear canvas
        if (this.ctx && this.canvas) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }

        // Reset state
        this.currentTime = 0;
        this.duration = 0;
        // Dispose MediaBunny resources
        if (this.videoSink && typeof this.videoSink.dispose === 'function') {
            try { this.videoSink.dispose(); } catch (e) { console.warn('Error disposing videoSink:', e); }
        }
        if (this.audioSink && typeof this.audioSink.dispose === 'function') {
            try { this.audioSink.dispose(); } catch (e) { console.warn('Error disposing audioSink:', e); }
        }
        if (this.input && typeof this.input.dispose === 'function') {
            try { this.input.dispose(); } catch (e) { console.warn('Error disposing input:', e); }
        }

        this.input = null;
        this.videoSink = null;
        this.audioSink = null;
        this.videoTrack = null;
        this.audioTrack = null;
        this.videoFrameIterator = null;
        this.audioBufferIterator = null;
        this.nextFrame = null;
        this.currentVideoId = null; // Clear current video ID

        // Update UI
        this._updateTimeDisplay();
        this._updateProgress();
        this.ui.loader.style.display = 'none';

        // Reset Audio Context if needed
        if (this.audioContext) {
            this.activeSources.forEach(source => {
                try { source.stop(); } catch (e) { }
            });
            this.activeSources = [];
        }
    }

    /**
     * Destroy the player and clean up listeners
     */
    destroy() {
        this.reset();

        // Remove global listeners (only those that were added)
        if (this.config.controls.fullscreen) {
            document.removeEventListener('fullscreenchange', this._handlers.fullscreen);
            document.removeEventListener('webkitfullscreenchange', this._handlers.fullscreen);
            document.removeEventListener('mozfullscreenchange', this._handlers.fullscreen);
            document.removeEventListener('MSFullscreenChange', this._handlers.fullscreen);
        }
        document.removeEventListener('click', this._handlers.click);
        if (this.config.controls.keyboard) {
            document.removeEventListener('keydown', this._handlers.keydown);
        }

        // Remove ResizeObserver
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }

        // Remove elements if needed (optional, but good for cleanup)
        this.container.innerHTML = '';
    }

    /**
     * Load a media source
     * @param {string} url - URL of the media file
     * @param {boolean} autoplay - Whether to start playing automatically
     */
    async load(url, autoplay = false, videoId = null, savedSubtitles = null) {
        try {
            // Stop any current playback
            this.pause(false);
            this.currentTime = 0;

            // Reset new state
            if (this.videoFrameIterator) await this.videoFrameIterator.return();
            // Wait for any pending audio iterator cleanup from pause()
            if (this.audioIteratorCleanupPromise) await this.audioIteratorCleanupPromise;
            if (this.audioBufferIterator) await this.audioBufferIterator.return();
            this.videoFrameIterator = null;
            this.audioBufferIterator = null;
            this.nextFrame = null;
            this.asyncId++;
            this.playbackTimeAtStart = 0;
            this.audioContextStartTime = null;
            this.queuedAudioNodes.clear();

            // Clear canvas and reset UI immediately
            if (this.ctx && this.canvas) {
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            }
            this._updateTimeDisplay();

            // Dispose previous resources
            if (this.videoSink && typeof this.videoSink.dispose === 'function') {
                try { this.videoSink.dispose(); } catch (e) { console.warn('Error disposing videoSink:', e); }
            }
            if (this.audioSink && typeof this.audioSink.dispose === 'function') {
                try { this.audioSink.dispose(); } catch (e) { console.warn('Error disposing audioSink:', e); }
            }
            if (this.input && typeof this.input.dispose === 'function') {
                try { this.input.dispose(); } catch (e) { console.warn('Error disposing input:', e); }
            }

            this.videoSink = null;
            this.audioSink = null;
            this.input = null;

            // Reset subtitle state for new video
            this.subtitleTracks = [];
            this.subtitleTrackCounter = 0;
            this.activeSubtitleTrackId = null;
            this.isSubtitlesEnabled = false;
            if (this.subtitleManager) {
                this.subtitleManager.cues = [];
            }

            this.ui.loader.classList.add('visible');
            console.log(`Loading media: ${url}`);
            this.currentVideoId = videoId || url;

            // Initialize MediaBunny Input with UrlSource
            this.input = new MediaBunny.Input({
                source: new MediaBunny.UrlSource(url),
                formats: MediaBunny.ALL_FORMATS
            });

            // Get Metadata
            this.duration = await this.input.computeDuration();
            this._updateTimeDisplay();

            // Get Video Track
            this.videoTrack = await this.input.getPrimaryVideoTrack();
            if (this.videoTrack) {
                // Compute frame rate from metadata
                try {
                    const stats = await this.videoTrack.computePacketStats();
                    this.frameRate = stats.averagePacketRate || 30;
                    console.log(`Detected frame rate: ${this.frameRate} fps`);
                } catch (e) {
                    console.warn("Could not compute frame rate, defaulting to 30fps", e);
                    this.frameRate = 30;
                }

                // Setup Canvas Sink with pool size for memory efficiency
                this.videoSink = new MediaBunny.CanvasSink(this.videoTrack, {
                    poolSize: 2, // Only keep 2 canvases - current and next frame
                    fit: 'contain' // Handle videos that may change dimensions
                });

                // Set canvas size
                this.canvas.width = this.videoTrack.displayWidth;
                this.canvas.height = this.videoTrack.displayHeight;

                // Render first frame or saved state
                await this._handleInitialFrame(autoplay);

                // Ensure overlay is visible if not autoplaying
                if (!autoplay && this.ui.playOverlay) {
                    this.ui.playOverlay.style.display = 'flex';
                }
            }

            // Setup Audio Track
            this.audioTrack = await this.input.getPrimaryAudioTrack();
            if (!this.audioTrack) {
                const audioTracks = await this.input.getAudioTracks();
                if (audioTracks.length > 0) {
                    this.audioTrack = audioTracks[0];
                }
            }

            if (this.audioTrack) {
                // Use AudioSampleSink instead of AudioBufferSink to avoid MediaBunny bug
                // where AudioSamples aren't closed properly
                this.audioSink = new MediaBunny.AudioSampleSink(this.audioTrack);
            }

            this._updateAudioTracks();

            // Restore saved subtitles for this video
            if (savedSubtitles && savedSubtitles.length > 0) {
                this.subtitleTracks = savedSubtitles.map(track => ({
                    id: track.id,
                    name: track.name,
                    cues: [...track.cues]
                }));
                // Find max counter from restored tracks
                this.subtitleTrackCounter = savedSubtitles.reduce((max, track) => {
                    const match = track.id.match(/custom-(\d+)/);
                    return match ? Math.max(max, parseInt(match[1])) : max;
                }, 0);
                console.log(`Restored ${savedSubtitles.length} subtitle track(s) for video`);
            }

            this._updateSubtitleMenu();

            this.ui.loader.classList.remove('visible');
            console.log('Media loaded successfully');

        } catch (error) {
            console.error('Error loading media:', error);
            this.ui.loader.classList.remove('visible');
        }
    }

    /**
     * Load a subtitle file (VTT, SRT, or JSON transcript)
     * @param {string} url - URL of the subtitle file
     */
    async loadSubtitle(url) {
        if (!this.subtitleManager) {
            console.warn('Subtitle manager not initialized (captions disabled)');
            return;
        }
        try {
            console.log(`Loading subtitles: ${url}`);
            const response = await fetch(url);
            const content = await response.text();

            // Detect if content is JSON (transcript format)
            let vttContent = content;
            if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
                try {
                    const { parseTranscriptJSON, jsonToVTT } = await import('./SubtitleConverter.js');
                    const words = parseTranscriptJSON(content);
                    vttContent = jsonToVTT(words);
                    console.log('Converted JSON transcript to VTT format');
                } catch (jsonError) {
                    console.warn('Failed to parse as JSON transcript, treating as VTT:', jsonError);
                }
            }

            // Parse the subtitle content
            this.subtitleManager.parse(vttContent);

            // Store as a new track with incrementing name
            this.subtitleTrackCounter++;
            const trackId = `custom-${this.subtitleTrackCounter}`;
            const trackName = `Custom ${this.subtitleTrackCounter}`;

            this.subtitleTracks.push({
                id: trackId,
                name: trackName,
                cues: [...this.subtitleManager.cues] // Copy cues
            });

            // Set this track as active
            this.activeSubtitleTrackId = trackId;
            this.isSubtitlesEnabled = true;
            this._updateSubtitleMenu();
            console.log(`Subtitles loaded successfully as "${trackName}"`);

            // Notify callback (for playlist to persist subtitles)
            if (this.onSubtitleChange) {
                this.onSubtitleChange(this.subtitleTracks);
            }
        } catch (error) {
            console.error('Error loading subtitles:', error);
        }
    }

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

                // Execute render callbacks
                if (this.afterFrameRenderCallbacks.length > 0) {
                    this.afterFrameRenderCallbacks.forEach(cb => cb(this.ctx, this.canvas.width, this.canvas.height));
                }
            } else {
                // Save it for later
                this.nextFrame = newNextFrame;
                break;
            }
        }
    }

    /**
     * Render subtitles on the canvas
     * @param {number} timestamp 
     * @private
     */
    _renderSubtitles(timestamp) {
        if (!this.subtitleManager) return;

        const activeCues = this.subtitleManager.getActiveCues(timestamp);
        if (activeCues.length === 0) return;

        const fontSize = Math.max(22, this.canvas.height * 0.055);
        const lineHeight = fontSize * 1.35;
        const bottomMargin = this.canvas.height * 0.08;
        const x = this.canvas.width / 2;

        // Collect all lines from all active cues
        const allLines = [];
        activeCues.forEach(cue => {
            cue.text.split('\n').forEach(line => {
                if (line.trim()) allLines.push(line.trim());
            });
        });

        if (allLines.length === 0) return;

        // Calculate starting Y position (draw from bottom up)
        let y = this.canvas.height - bottomMargin;

        // Setup text styling - Netflix/YouTube style with thick outline
        this.ctx.font = `bold ${fontSize}px "Segoe UI", Roboto, Arial, sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'bottom';
        this.ctx.lineJoin = 'round';
        this.ctx.miterLimit = 2;

        // Draw lines from bottom to top
        for (let i = allLines.length - 1; i >= 0; i--) {
            const line = allLines[i];

            // Draw thick black outline
            this.ctx.strokeStyle = '#000000';
            this.ctx.lineWidth = fontSize * 0.15;
            this.ctx.strokeText(line, x, y);

            // Draw white fill
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fillText(line, x, y);

            y -= lineHeight;
        }
    }

    /**
     * Returns the current playback time in the media file.
     * To ensure perfect audio-video sync, we always use the audio context's clock to determine playback time.
     * Note: We don't multiply by playbackRate here because audioContext.currentTime advances at real-time,
     * but audio sources play at playbackRate speed, effectively advancing media time faster.
     */
    _getPlaybackTime() {
        if (this.isPlaying && this.audioContext) {
            const elapsedRealTime = this.audioContext.currentTime - this.audioContextStartTime;
            // Media time advances at playbackRate speed
            return elapsedRealTime * this.playbackRate + this.playbackTimeAtStart;
        } else {
            return this.playbackTimeAtStart;
        }
    }

    /**
     * Toggle play/pause
     */
    togglePlay() {
        // If no video loaded, try to request play from playlist
        if (!this.videoTrack && !this.audioTrack && !this.currentVideoId) {
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
        if (!this.videoTrack && !this.audioTrack) return;

        // Initialize Audio Context on first user interaction
        this._initAudio();

        if (this.audioContext && this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }

        if (this._getPlaybackTime() >= this.duration) {
            // If we're at the end, let's snap back to the start
            this.playbackTimeAtStart = 0;
            await this._startVideoIterator();
        } else if (!this.videoFrameIterator) {
            // If iterator wasn't started (e.g. default frame mode), start it now
            await this._startVideoIterator();
        }

        this.audioContextStartTime = this.audioContext.currentTime;
        this.isPlaying = true;
        this._updatePlayPauseUI();

        if (this.audioSink) {
            // Start the audio iterator
            if (this.audioBufferIterator) await this.audioBufferIterator.return();
            // Use samples() instead of buffers() since we're using AudioSampleSink
            this.audioBufferIterator = this.audioSink.samples(this._getPlaybackTime());
            this._runAudioIterator();
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
        console.log("Player.pause() called");
        this.playbackTimeAtStart = this._getPlaybackTime();
        this.isPlaying = false;
        this._clearAutoHideTimer();
        this._updatePlayPauseUI();

        if (this.audioBufferIterator) {
            // Properly await the iterator cleanup to ensure AudioSample objects are closed
            // Using .then() since pause() must be synchronous for event handlers
            const iterator = this.audioBufferIterator;
            this.audioBufferIterator = null;
            this.audioIteratorCleanupPromise = iterator.return().catch(e => {
                // Iterator might already be closed or in error state, ignore
                console.debug("Error closing audio iterator:", e);
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

        // Show/Hide overlay
        if (this.ui.playOverlay) {
            this.ui.playOverlay.style.display = showOverlay ? 'flex' : 'none';
        }
    }

    /**
     * Creates a new video frame iterator and renders the first video frame.
     */
    async _startVideoIterator() {
        if (!this.videoSink) return;

        this.asyncId++;
        const currentAsyncId = this.asyncId;

        if (this.videoFrameIterator) await this.videoFrameIterator.return(); // Dispose of the current iterator

        // Create a new iterator
        this.videoFrameIterator = this.videoSink.canvases(this._getPlaybackTime());

        // Get the first two frames
        const firstFrame = (await this.videoFrameIterator.next()).value ?? null;
        const secondFrame = (await this.videoFrameIterator.next()).value ?? null;

        // Prevent race conditions if asyncId changed while awaiting
        if (currentAsyncId !== this.asyncId) return;

        this.nextFrame = secondFrame;

        if (firstFrame) {
            // Draw the first frame
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.drawImage(firstFrame.canvas, 0, 0, this.canvas.width, this.canvas.height);

            // Execute render callbacks
            if (this.afterFrameRenderCallbacks.length > 0) {
                this.afterFrameRenderCallbacks.forEach(cb => cb(this.ctx, this.canvas.width, this.canvas.height));
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

                if (playbackTime >= this.duration) {
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

                // Check Loop A-B
                if (this.loopMode === 'ab' && this.loopStart !== null && this.loopEnd !== null) {
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
                        this.afterFrameRenderCallbacks.forEach(cb => cb(this.ctx, this.canvas.width, this.canvas.height));
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
    async _runAudioIterator() {
        if (!this.audioSink) return;

        try {
            // Iterating over AudioSamples
            for await (const audioSample of this.audioBufferIterator) {
                if (!this.isPlaying) {
                    // Close the AudioSample before breaking
                    audioSample.close();
                    break;
                }

                // Convert AudioSample to AudioBuffer and CLOSE the sample
                const buffer = audioSample.toAudioBuffer();
                const timestamp = audioSample.timestamp;
                audioSample.close(); // Critical: Close AudioSample after converting

                // Create AudioBufferSourceNode
                const audioSource = this.audioContext.createBufferSource();
                audioSource.buffer = buffer;
                audioSource.playbackRate.value = this.playbackRate; // Apply playback rate

                // Connect to EQ input if available, otherwise gain node
                if (this.audioEqualizer && this.audioEqualizer.isInitialized) {
                    audioSource.connect(this.audioEqualizer.getInputNode());
                } else {
                    audioSource.connect(this.gainNode);
                }

                // Calculate when this buffer should start playing
                // 'timestamp' is in media time, but audioContext.currentTime is real time
                // At faster playback rates, real-time delay is shorter than media-time delay
                const now = this.audioContext.currentTime;
                const mediaTimeDelay = timestamp - this._getPlaybackTime();
                const realTimeDelay = mediaTimeDelay / this.playbackRate;
                const startTime = now + Math.max(0, realTimeDelay);

                // Queue the buffer with proper timing
                if (realTimeDelay >= 0) {
                    // Sample is in the future - schedule it
                    audioSource.start(startTime);
                } else {
                    // Sample is in the past - play only the remaining audible portion
                    const offset = -realTimeDelay;  // How far into the buffer to start
                    if (offset < buffer.duration / this.playbackRate) {
                        // There's still some audio left to play
                        audioSource.start(now, offset * this.playbackRate);
                    }
                    // If offset >= buffer duration, skip this sample entirely
                }

                // Track source for cleanup
                this.queuedAudioNodes.add(audioSource);
                audioSource.onended = () => this.queuedAudioNodes.delete(audioSource);

                // If we're more than a second ahead of the current playback time, let's slow down the loop until time has
                // passed.
                if (timestamp - this._getPlaybackTime() >= 1) {
                    await new Promise((resolve) => {
                        const id = setInterval(() => {
                            if (!this.isPlaying || timestamp - this._getPlaybackTime() < 1) {
                                clearInterval(id);
                                resolve();
                            }
                        }, 100);
                    });
                }
            }
        } catch (error) {
            // Ignore InputDisposedError as it happens during reset/unload
            if (error.name === 'InputDisposedError' || error.message.includes('Input has been disposed')) {
                // console.debug('Audio iterator stopped due to input disposal');
            } else {
                console.error("Error in audio iterator:", error);
            }
        } finally {
            // Ensure the iterator is properly closed to clean up any AudioSample objects
            // This is critical to prevent memory leaks as per MediaBunny's resource management requirements
            if (this.audioBufferIterator) {
                try {
                    await this.audioBufferIterator.return();
                } catch (e) {
                    // Iterator might already be closed, ignore errors
                }
            }
        }
    }

    async _seekTo(time) {
        console.log(`_seekTo called with time: ${time}`);

        // Show loader during seek
        this.ui.loader.classList.add('visible');

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
            this.ui.loader.classList.remove('visible');
        }

        if (wasPlaying && this.playbackTimeAtStart < this.duration) {
            await this.play();
        }
    }

    _seek(e) {
        const rect = this.ui.progressContainer.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        this._seekTo(pos * this.duration);
    }

    /**
     * Seek to a specific time
     * @param {number} time - Time in seconds
     */
    seek(time) {
        this._seekTo(time);
    }

    toggleFullscreen() {
        if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.mozFullScreenElement && !document.msFullscreenElement) {
            if (this.container.requestFullscreen) {
                this.container.requestFullscreen().catch(err => {
                    console.error(`Error attempting to enable fullscreen: ${err.message}`);
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
        const use = this.ui.playBtn.querySelector('use');
        if (this.isPlaying) {
            this.ui.playBtn.setAttribute('aria-label', 'Pause');
            this.ui.playBtn.setAttribute('aria-pressed', 'true');
            use.setAttribute('href', 'assets/icons/sprite.svg#icon-pause');
        } else {
            this.ui.playBtn.setAttribute('aria-label', 'Play');
            this.ui.playBtn.setAttribute('aria-pressed', 'false');
            use.setAttribute('href', 'assets/icons/sprite.svg#icon-play');
        }
    }

    _updateProgress() {
        const percent = (this.currentTime / this.duration) * 100;
        this.ui.progressBar.style.width = `${percent}%`;
        this.ui.progressContainer.setAttribute('aria-valuenow', Math.round(percent));
        this._updateTimeDisplay();
    }

    _updateTimeDisplay() {
        const current = this._formatTime(this.currentTime);
        const duration = this._formatTime(this.duration);
        this.ui.timeDisplay.textContent = `${current} / ${duration}`;
    }

    _formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    _updateFullscreenUI() {
        const use = this.ui.fullscreenBtn.querySelector('use');
        const isFullscreen = document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement ||
            this.container.classList.contains('fullscreen-fallback');

        if (isFullscreen) {
            this.ui.fullscreenBtn.setAttribute('aria-label', 'Exit Fullscreen');
            use.setAttribute('href', 'assets/icons/sprite.svg#icon-fullscreen-exit');
        } else {
            this.ui.fullscreenBtn.setAttribute('aria-label', 'Fullscreen');
            use.setAttribute('href', 'assets/icons/sprite.svg#icon-fullscreen');
        }
    }

    _updateVolumeIcon() {
        // Visual update only for now
        const use = this.ui.muteBtn.querySelector('use');
        if (this.config.muted || this.config.volume === 0) {
            use.setAttribute('href', 'assets/icons/sprite.svg#icon-volume-mute');
        } else {
            use.setAttribute('href', 'assets/icons/sprite.svg#icon-volume-high');
        }
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

    destroy() {
        // Stop playback
        this.pause();

        // Clean up audio context
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        // Clean up MediaBunny resources
        if (this.videoSink) {
            this.videoSink = null; // Let GC handle cleanup
        }
        if (this.audioSink) {
            this.audioSink = null;
        }
        if (this.input) {
            this.input = null;
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

        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
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
            console.warn('Failed to load control bar mode:', e);
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
            console.warn('Failed to save control bar mode:', e);
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
            console.warn(`Control '${name}' not found in configuration.`);
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
            console.warn(`Preset '${presetName}' not found.`);
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
        if (!this.videoTrack) return;

        const savedState = this._loadPlaybackState();
        let startTimestamp = 0;

        if (savedState && savedState.videoIdentifier === this.currentVideoId) {
            console.log('Restoring playback state:', savedState);
            startTimestamp = savedState.timestamp;
        } else {
            // Default: 50% frame
            console.log('No saved state, using default frame');

            if (!autoplay) {
                // We want to show the 50% frame, but start playback from 0
                // So we'll extract and draw the 50% frame, but keep playbackTimeAtStart at 0
                const middleTimestamp = this.duration * 0.5;
                await this._extractAndDrawFrame(middleTimestamp);
                return; // Done, we stay at 0 for playback
            }
            // If autoplaying, we skip the default frame and start from 0
        }

        // If we have a saved state, we seek to it
        this.playbackTimeAtStart = startTimestamp;
        this.currentTime = startTimestamp;
        this._updateProgress();

        // If autoplay is requested, we play immediately
        if (autoplay) {
            try {
                // Race play against a timeout to prevent hanging on iOS/Autoplay restrictions
                const playPromise = this.play();
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Autoplay timeout')), 1000)
                );
                await Promise.race([playPromise, timeoutPromise]);
            } catch (e) {
                console.warn('Autoplay failed or timed out, falling back to paused state:', e);
                // Ensure we are in a clean state
                this.isPlaying = false;
                this._updatePlayPauseUI();

                // Fallback: Draw frame and show overlay
                await this._startVideoIterator();
                if (this.ui.playOverlay) this.ui.playOverlay.style.display = 'flex';
            }
        } else {
            // Otherwise just draw the frame
            await this._startVideoIterator(); // This draws the frame at startTimestamp
        }
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
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.drawImage(frame.canvas, 0, 0, this.canvas.width, this.canvas.height);

            // Execute render callbacks
            if (this.afterFrameRenderCallbacks.length > 0) {
                this.afterFrameRenderCallbacks.forEach(cb => cb(this.ctx, this.canvas.width, this.canvas.height));
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
            console.warn('Failed to save playback state:', e);
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

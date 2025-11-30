/**
 * Core Player Class
 * The main controller for video playback using MediaBunny.
 */

import { MediaBunny } from './MediaBunny.js';
import { PLAYER_CONFIG } from './config.js';
import { SubtitleManager } from './SubtitleManager.js';
import { ScreenshotManager } from '../player/ScreenshotManager.js';

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
        this.playbackRate = parseFloat(localStorage.getItem('mediabunny-speed')) || 1.0;
        this.loopMode = 'off'; // 'off', 'all', 'ab'
        this.loopStart = null;
        this.loopEnd = null;
        this.animationFrameId = null;

        // Control bar mode
        this.controlBarMode = 'overlay'; // 'overlay' or 'fixed'
        this.autoHideTimer = null;

        // Controls Configuration
        this.config.controls = {
            playPause: true,
            volume: true,
            time: true,
            progress: true,
            captions: true,
            settings: true,
            fullscreen: true,
            loop: true,
            speed: true,
            modeToggle: true,
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
                volume: false,
                time: true,
                progress: true,
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

        // Subtitles
        this.subtitleManager = new SubtitleManager();
        this.isSubtitlesEnabled = false;

        // Screenshot Manager
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

        this._init();
    }

    /**
     * Initialize the player
     * @private
     */
    _init() {
        this.container.classList.add('mediabunny-container');

        // Create canvas element using template
        const canvasTemplate = document.getElementById('player-canvas-template');
        const canvasClone = canvasTemplate.content.cloneNode(true);
        this.canvas = canvasClone.querySelector('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.container.appendChild(canvasClone);

        // Initialize Screenshot Manager (before creating controls)
        this.screenshotManager = new ScreenshotManager(this);

        // Create UI
        this._createControls();
        this._createHelpOverlay();

        // Attach Events
        this._attachEvents();

        // Load control bar mode preference
        this._loadControlBarMode();

        // Initialize ResizeObserver for responsive controls
        this._initResizeObserver();
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
        const title = clone.querySelector('.mediabunny-help-title');
        if (title) {
            title.textContent = `Keyboard Shortcuts ${this.config.mode === 'editor' ? '(Editor Mode)' : '(Player Mode)'}`;
        }

        this.container.appendChild(clone);

        this.ui.helpOverlay = this.container.querySelector('.mediabunny-help-overlay');
        this.ui.closeHelpBtn = this.container.querySelector('.mediabunny-close-help');

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
        this.gainNode = this.audioContext.createGain();
        this.gainNode.connect(this.audioContext.destination);

        // Set initial volume
        this.gainNode.gain.value = this.config.muted ? 0 : this.config.volume;

        this.isAudioInitialized = true;
    }

    /**
     * Create custom controls UI
     * @private
     */
    _createControls() {
        // Loader
        const loaderTemplate = document.getElementById('player-loader-template');
        this.container.appendChild(loaderTemplate.content.cloneNode(true));
        this.ui.loader = this.container.querySelector('.mediabunny-loader');

        // Controls
        const controlsTemplate = document.getElementById('player-controls-template');
        this.container.appendChild(controlsTemplate.content.cloneNode(true));

        // Loop Panel
        const loopPanelTemplate = document.getElementById('player-loop-panel-template');
        this.container.appendChild(loopPanelTemplate.content.cloneNode(true));

        // Initialize Screenshot Manager UI (must be after controls, before caching)
        if (this.screenshotManager) {
            this.screenshotManager.init();
        }

        // Cache elements
        this.ui.controls = this.container.querySelector('.mediabunny-controls');
        this.ui.playOverlay = this.container.querySelector('.mediabunny-play-overlay');
        this.ui.playBtn = this.container.querySelector('#mb-play-btn');
        this.ui.prevBtn = this.container.querySelector('#mb-prev-btn');
        this.ui.nextBtn = this.container.querySelector('#mb-next-btn');
        this.ui.progressContainer = this.container.querySelector('.mediabunny-progress-container');
        this.ui.progressBar = this.container.querySelector('.mediabunny-progress-bar');
        this.ui.timeDisplay = this.container.querySelector('#mb-time-display');
        this.ui.muteBtn = this.container.querySelector('#mb-mute-btn');
        this.ui.volumeSlider = this.container.querySelector('#mb-volume-slider');
        this.ui.fullscreenBtn = this.container.querySelector('#mb-fullscreen-btn');
        this.ui.modeToggleBtn = this.container.querySelector('#mb-mode-toggle-btn');
        this.ui.ccBtn = this.container.querySelector('#mb-cc-btn');
        this.ui.ccMenu = this.container.querySelector('#mb-cc-menu');
        this.ui.ccInput = this.container.querySelector('#mb-cc-input');
        this.ui.audioContainer = this.container.querySelector('#mb-audio-container');
        this.ui.audioBtn = this.container.querySelector('#mb-audio-btn');
        this.ui.audioMenu = this.container.querySelector('#mb-audio-menu');
        this.ui.speedBtn = this.container.querySelector('#mb-speed-btn');
        this.ui.speedMenu = this.container.querySelector('#mb-speed-menu');
        this.ui.loopBtn = this.container.querySelector('#mb-loop-btn');
        this.ui.loopMarkerA = this.container.querySelector('.mediabunny-marker.marker-a');
        this.ui.loopMarkerB = this.container.querySelector('.mediabunny-marker.marker-b');
        this.ui.loopRegion = this.container.querySelector('.mediabunny-loop-region');

        this.ui.loopPanel = this.container.querySelector('.mediabunny-loop-panel');
        this.ui.loopStartInput = this.container.querySelector('#mb-loop-start');
        this.ui.loopEndInput = this.container.querySelector('#mb-loop-end');
        this.ui.loopStatus = this.container.querySelector('#mb-loop-status');
        this.ui.setABtn = this.container.querySelector('#mb-set-a-btn');
        this.ui.setBBtn = this.container.querySelector('#mb-set-b-btn');
        this.ui.clearLoopBtn = this.container.querySelector('#mb-clear-loop-btn');
        this.ui.closeLoopPanelBtn = this.container.querySelector('.mediabunny-loop-panel .mediabunny-close-btn');

        this._updateSpeedMenu();
    }

    /**
     * Attach event listeners
     * @private
     */
    _attachEvents() {
        // Play/Pause
        this.ui.playBtn.addEventListener('click', () => this.togglePlay());
        this.canvas.addEventListener('click', () => this.togglePlay());
        if (this.ui.playOverlay) {
            this.ui.playOverlay.addEventListener('click', () => this.play());
        }

        // Navigation
        this.ui.prevBtn.addEventListener('click', () => {
            if (!this.ui.prevBtn.disabled && this.onPrevious) {
                this.onPrevious();
            }
        });
        this.ui.nextBtn.addEventListener('click', () => {
            if (!this.ui.nextBtn.disabled && this.onNext) {
                this.onNext();
            }
        });

        // Seek
        this.ui.progressContainer.addEventListener('click', (e) => this._seek(e));

        // Volume
        this.ui.volumeSlider.addEventListener('input', (e) => {
            this.config.volume = parseFloat(e.target.value);
            this.config.muted = false;

            if (this.gainNode) {
                this.gainNode.gain.value = this.config.volume;
            }
            this._updateVolumeIcon();
        });

        this.ui.muteBtn.addEventListener('click', () => {
            this.config.muted = !this.config.muted;

            if (this.gainNode) {
                this.gainNode.gain.value = this.config.muted ? 0 : this.config.volume;
            }
            this._updateVolumeIcon();
        });

        // Fullscreen
        this.ui.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());

        // Control Bar Mode Toggle
        this.ui.modeToggleBtn.addEventListener('click', () => this.toggleControlBarMode());

        // Auto-hide for overlay mode
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

        // Subtitles
        this.ui.ccBtn.addEventListener('click', () => {
            this.ui.ccMenu.classList.toggle('visible');
            this.ui.ccBtn.setAttribute('aria-expanded', this.ui.ccMenu.classList.contains('visible'));
        });

        this.ui.ccMenu.addEventListener('click', (e) => {
            const item = e.target.closest('.mediabunny-menu-item');
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
            const item = e.target.closest('.mediabunny-menu-item');
            if (!item) return;

            const trackId = parseInt(item.dataset.value);
            this._switchAudioTrack(trackId);
            this.ui.audioMenu.classList.remove('visible');
        });

        // Speed Control
        this.ui.speedBtn.addEventListener('click', () => {
            this.ui.speedMenu.classList.toggle('visible');
            this.ui.speedBtn.setAttribute('aria-expanded', this.ui.speedMenu.classList.contains('visible'));
        });

        this.ui.speedMenu.addEventListener('click', (e) => {
            const item = e.target.closest('.mediabunny-menu-item');
            if (!item) return;

            const speed = parseFloat(item.dataset.value);
            this.setPlaybackRate(speed);
            this.ui.speedMenu.classList.remove('visible');
        });

        // Loop Control
        this.ui.loopBtn.addEventListener('click', () => this.toggleLoopMode());
        // Long press or right click to open panel? Or just a separate button?
        // Let's make right click open panel for now, or maybe just double click?
        // Actually, let's add a context menu listener to the loop button
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

        // Close menus when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.ui.ccBtn.contains(e.target) && !this.ui.ccMenu.contains(e.target)) {
                this.ui.ccMenu.classList.remove('visible');
            }
            if (!this.ui.audioBtn.contains(e.target) && !this.ui.audioMenu.contains(e.target)) {
                this.ui.audioMenu.classList.remove('visible');
            }
            if (!this.ui.speedBtn.contains(e.target) && !this.ui.speedMenu.contains(e.target)) {
                this.ui.speedMenu.classList.remove('visible');
            }
        });

        // Keyboard Shortcuts
        document.addEventListener('keydown', (e) => this._handleKeyboard(e));
    }

    _updateSpeedMenu() {
        const items = this.ui.speedMenu.querySelectorAll('.mediabunny-menu-item');
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
        if (wasPlaying) {
            this.pause();
        }

        this.playbackRate = rate;
        localStorage.setItem('mediabunny-speed', rate);
        this._updateSpeedMenu();

        if (wasPlaying) {
            await this.play();
        }
    }

    _updateSubtitleMenu() {
        const items = this.ui.ccMenu.querySelectorAll('.mediabunny-menu-item');
        items.forEach(item => item.classList.remove('active'));

        if (!this.isSubtitlesEnabled) {
            this.ui.ccMenu.querySelector('[data-value="off"]').classList.add('active');
            this.ui.ccBtn.classList.remove('active');
        } else {
            // For now, just activate upload item or custom track if we had one
            // Since we only support one external track at a time via upload/loadSubtitle:
            this.ui.ccBtn.classList.add('active');
        }
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
            this.audioSink = new MediaBunny.AudioBufferSink(this.audioTrack);

            // Update UI
            this._updateAudioTracks();
            console.log(`Switched to audio track: ${track.id}`);
        }
    }

    async _updateAudioTracks() {
        if (!this.ui.audioMenu) return;

        this.ui.audioMenu.textContent = '';
        const tracks = this.input ? await this.input.getAudioTracks() : [];

        if (tracks.length <= 1) {
            this.ui.audioContainer.style.display = 'none';
            return;
        }

        this.ui.audioContainer.style.display = 'block';
        const template = document.getElementById('player-menu-item-template');

        tracks.forEach((track, index) => {
            const item = template.content.cloneNode(true).querySelector('.mediabunny-menu-item');
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
        this.input = null;
        this.videoTrack = null;
        this.audioTrack = null;
        this.videoFrameIterator = null;
        this.audioBufferIterator = null;
        this.nextFrame = null;

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
     * Load a media source
     * @param {string} url - URL of the media file
     * @param {boolean} autoplay - Whether to start playing automatically
     */
    async load(url, autoplay = false) {
        try {
            // Stop any current playback
            this.pause(false);
            this.currentTime = 0;

            // Reset new state
            if (this.videoFrameIterator) await this.videoFrameIterator.return();
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

            this.videoSink = null;
            this.audioSink = null;

            this.ui.loader.classList.add('visible');
            console.log(`Loading media: ${url}`);
            this.currentVideoId = url;

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

                // Setup Canvas Sink
                this.videoSink = new MediaBunny.CanvasSink(this.videoTrack);

                // Set canvas size
                this.canvas.width = this.videoTrack.displayWidth;
                this.canvas.height = this.videoTrack.displayHeight;

                // Render first frame or saved state
                await this._handleInitialFrame(autoplay);
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
                this.audioSink = new MediaBunny.AudioBufferSink(this.audioTrack);
            }

            this._updateAudioTracks();
            this._updateSubtitleMenu();

            this.ui.loader.classList.remove('visible');
            console.log('Media loaded successfully');

        } catch (error) {
            console.error('Error loading media:', error);
            this.ui.loader.classList.remove('visible');
        }
    }

    /**
     * Load a subtitle file
     * @param {string} url - URL of the subtitle file (VTT or SRT)
     */
    async loadSubtitle(url) {
        try {
            console.log(`Loading subtitles: ${url}`);
            const response = await fetch(url);
            const content = await response.text();
            this.subtitleManager.parse(content);
            this.isSubtitlesEnabled = true;
            this._updateSubtitleMenu();
            console.log('Subtitles loaded successfully');
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
        const activeCues = this.subtitleManager.getActiveCues(timestamp);
        if (activeCues.length === 0) return;

        const fontSize = this.canvas.height * 0.05; // Responsive font size
        this.ctx.font = `${fontSize}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'bottom';
        this.ctx.fillStyle = 'white';
        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = fontSize * 0.1;

        const bottomMargin = this.canvas.height * 0.1;
        const x = this.canvas.width / 2;
        let y = this.canvas.height - bottomMargin;

        activeCues.forEach(cue => {
            const lines = cue.text.split('\n');
            // Draw from bottom up
            for (let i = lines.length - 1; i >= 0; i--) {
                this.ctx.strokeText(lines[i], x, y);
                this.ctx.fillText(lines[i], x, y);
                y -= fontSize * 1.2;
            }
        });
    }

    /**
     * Returns the current playback time in the media file.
     * To ensure perfect audio-video sync, we always use the audio context's clock to determine playback time, even
     * when there is no audio track.
     */
    _getPlaybackTime() {
        if (this.isPlaying && this.audioContext) {
            return (this.audioContext.currentTime - this.audioContextStartTime) * this.playbackRate + this.playbackTimeAtStart;
        } else {
            return this.playbackTimeAtStart;
        }
    }

    /**
     * Toggle playback state
     */
    togglePlay() {
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
            this.audioBufferIterator = this.audioSink.buffers(this._getPlaybackTime());
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
            this.audioBufferIterator.return(); // This stops any for-loops that are iterating the iterator
            this.audioBufferIterator = null;
        }

        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        if (this.audioContext) {
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
            // To play back audio, we loop over all audio chunks (typically very short) of the file and play them at the correct
            // timestamp. The result is a continuous, uninterrupted audio signal.
            for await (const { buffer, timestamp } of this.audioBufferIterator) {
                if (!this.isPlaying) break;

                const node = this.audioContext.createBufferSource();
                node.buffer = buffer;
                node.playbackRate.value = this.playbackRate;
                node.connect(this.gainNode);

                // Calculate when this chunk should play in AudioContext time
                // Formula: startTimestamp = audioContextStartTime + (mediaTimestamp - playbackTimeAtStart) / playbackRate
                const startTimestamp = this.audioContextStartTime + (timestamp - this.playbackTimeAtStart) / this.playbackRate;

                // Two cases: Either, the audio starts in the future or in the past
                if (startTimestamp >= this.audioContext.currentTime) {
                    // If the audio starts in the future, easy, we just schedule it
                    node.start(startTimestamp);
                } else {
                    // If it starts in the past, then let's only play the audible section that remains from here on out
                    // We need to offset into the buffer by how much time has passed * playbackRate
                    const timePassed = this.audioContext.currentTime - startTimestamp;
                    const offset = timePassed * this.playbackRate;

                    if (offset < buffer.duration) {
                        node.start(this.audioContext.currentTime, offset);
                    }
                }

                this.queuedAudioNodes.add(node);
                node.onended = () => {
                    this.queuedAudioNodes.delete(node);
                };

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
            console.error("Error in audio iterator:", error);
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
        if (!document.fullscreenElement) {
            this.container.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
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

        this.container.classList.remove('mediabunny-container');
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

        // Update button aria-label and aria-pressed
        const isFixed = this.controlBarMode === 'fixed';
        this.ui.modeToggleBtn.setAttribute('aria-label', isFixed ? 'Unpin controls' : 'Pin controls');
        this.ui.modeToggleBtn.setAttribute('aria-pressed', isFixed.toString());
        this.ui.modeToggleBtn.setAttribute('title', isFixed ? 'Unpin controls' : 'Pin controls');

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
     * Apply control visibility based on configuration
     * @private
     */
    _applyControlVisibility() {
        if (!this.ui.controls) return;

        Object.entries(this.config.controls).forEach(([name, visible]) => {
            const element = this.ui.controls.querySelector(`[data-control="${name}"]`);
            if (element) {
                if (visible) {
                    element.classList.remove('control--hidden');
                } else {
                    element.classList.add('control--hidden');
                }
            }
        });
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
            await this.play();
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
            localStorage.setItem(`mediabunny-state-${this.currentVideoId}`, JSON.stringify(state));
        } catch (e) {
            console.warn('Failed to save playback state:', e);
        }
    }

    _loadPlaybackState() {
        if (!this.currentVideoId) return null;
        try {
            const item = localStorage.getItem(`mediabunny-state-${this.currentVideoId}`);
            return item ? JSON.parse(item) : null;
        } catch (e) {
            return null;
        }
    }
}

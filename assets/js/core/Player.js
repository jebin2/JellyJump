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
            loopEndInput: null
        };

        // Navigation callbacks
        this.onNext = null;
        this.onPrevious = null;
        this.onEnded = null;

        this._init();
    }

    /**
     * Initialize the player
     * @private
     */
    _init() {
        this.container.classList.add('mediabunny-container');

        // Create canvas element
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'mediabunny-video';
        this.ctx = this.canvas.getContext('2d');
        this.container.appendChild(this.canvas);

        // Initialize Screenshot Manager (before creating controls)
        this.screenshotManager = new ScreenshotManager(this);

        // Create UI
        this._createControls();
        this._createHelpOverlay();

        // Attach Events
        this._attachEvents();
    }

    /**
     * Create Help Overlay
     * @private
     */
    _createHelpOverlay() {
        const navigationSection = this.config.mode === 'player' ? `
            <div class="mediabunny-help-section">
                <h3>Navigation</h3>
                <ul>
                    <li><span class="key">Shift</span> + <span class="key">N</span> Next Video</li>
                    <li><span class="key">Shift</span> + <span class="key">P</span> Previous Video</li>
                </ul>
            </div>
        ` : '';

        const editorSection = this.config.mode === 'editor' ? `
            <div class="mediabunny-help-section">
                <h3>Editor</h3>
                <ul>
                    <li><span class="key">,</span> / <span class="key">.</span> Prev/Next Frame</li>
                    <li><span class="key">I</span> / <span class="key">O</span> In/Out Point</li>
                </ul>
            </div>
        ` : '';

        const loopSection = `
            <div class="mediabunny-help-section">
                <h3>Looping</h3>
                <ul>
                    <li><span class="key">I</span> Set Loop Start (A)</li>
                    <li><span class="key">O</span> Set Loop End (B)</li>
                    <li><span class="key">R</span> Reset Loop</li>
                </ul>
            </div>
        `;

        const helpHTML = `
            <div class="mediabunny-help-overlay" style="display: none;">
                <div class="mediabunny-help-content">
                    <h2 class="mediabunny-help-title">Keyboard Shortcuts ${this.config.mode === 'editor' ? '(Editor Mode)' : '(Player Mode)'}</h2>
                    <div class="mediabunny-help-grid">
                        <div class="mediabunny-help-section">
                            <h3>Playback</h3>
                            <ul>
                                <li><span class="key">Space</span> / <span class="key">K</span> Play/Pause</li>
                                <li><span class="key">J</span> / <span class="key">L</span> -/+ 10s</li>
                                <li><span class="key">←</span> / <span class="key">→</span> -/+ 5s</li>
                                <li><span class="key">0</span>-<span class="key">9</span> Seek 0-90%</li>
                                <li><span class="key">Home</span> / <span class="key">End</span> Start/End</li>
                            </ul>
                        </div>
                        <div class="mediabunny-help-section">
                            <h3>Audio & Display</h3>
                            <ul>
                                <li><span class="key">↑</span> / <span class="key">↓</span> Volume +/-</li>
                                <li><span class="key">M</span> Mute Toggle</li>
                                <li><span class="key">F</span> Fullscreen</li>
                                <li><span class="key">C</span> Captions Toggle</li>
                                <li><span class="key">?</span> Toggle Help</li>
                            </ul>
                        </div>
                        ${navigationSection}
                        ${editorSection}
                        ${loopSection}
                    </div>
                    <button class="mediabunny-close-help">Close</button>
                </div>
            </div>
            <style>
                .mediabunny-help-overlay {
                    position: absolute;
                    top: 0; left: 0; width: 100%; height: 100%;
                    background: rgba(0, 0, 0, 0.85);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 100;
                    backdrop-filter: blur(5px);
                }
                .mediabunny-help-content {
                    background: var(--bg-secondary, #1a1a1a);
                    border: 2px solid var(--accent-primary, #00ff88);
                    padding: 30px;
                    max-width: 600px;
                    width: 90%;
                    box-shadow: 8px 8px 0 0 var(--accent-primary, #00ff88);
                    color: var(--text-primary, #fff);
                    font-family: var(--font-primary, sans-serif);
                }
                .mediabunny-help-title {
                    margin-top: 0;
                    border-bottom: 1px solid var(--border-dark, #333);
                    padding-bottom: 15px;
                    margin-bottom: 20px;
                    text-transform: uppercase;
                }
                .mediabunny-help-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                    gap: 20px;
                    margin-bottom: 20px;
                }
                .mediabunny-help-section h3 {
                    color: var(--accent-primary, #00ff88);
                    font-size: 0.9rem;
                    text-transform: uppercase;
                    margin-bottom: 10px;
                }
                .mediabunny-help-section ul {
                    list-style: none;
                    padding: 0;
                }
                .mediabunny-help-section li {
                    margin-bottom: 8px;
                    font-size: 0.9rem;
                    display: flex;
                    align-items: center;
                }
                .key {
                    background: var(--bg-tertiary, #333);
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-family: monospace;
                    margin-right: 5px;
                    border: 1px solid var(--border-dark, #555);
                }
                .mediabunny-close-help {
                    background: transparent;
                    border: 2px solid var(--accent-primary, #00ff88);
                    color: var(--accent-primary, #00ff88);
                    padding: 8px 20px;
                    text-transform: uppercase;
                    font-weight: bold;
                    cursor: pointer;
                    width: 100%;
                }
                .mediabunny-close-help:hover {
                    background: var(--accent-primary, #00ff88);
                    color: black;
                }
            </style>
        `;
        this.container.insertAdjacentHTML('beforeend', helpHTML);

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
        // Loading Spinner
        const loaderHTML = `<div class="mediabunny-loader"></div>`;
        this.container.insertAdjacentHTML('beforeend', loaderHTML);
        this.ui.loader = this.container.querySelector('.mediabunny-loader');

        const controlsHTML = `
            <div class="mediabunny-controls">
                <div class="mediabunny-progress-container" role="slider" aria-label="Seek" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" tabindex="0">
                    <div class="mediabunny-progress-bar"></div>
                    <div class="mediabunny-loop-region" style="display: none;"></div>
                    <div class="mediabunny-marker marker-a" style="display: none;"></div>
                    <div class="mediabunny-marker marker-b" style="display: none;"></div>
                </div>
                <div class="mediabunny-controls-row">
                    <div style="display: flex; align-items: center;">
                        <button class="mediabunny-btn" id="mb-play-btn" aria-label="Play" aria-pressed="false">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                        </button>
                        <button class="mediabunny-btn" id="mb-prev-btn" aria-label="Previous Video" disabled>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
                        </button>
                        <button class="mediabunny-btn" id="mb-next-btn" aria-label="Next Video" disabled>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
                        </button>
                        <div class="mediabunny-time" id="mb-time-display">0:00 / 0:00</div>
                    </div>
                    
                    <div class="mediabunny-volume-container">
                        <button class="mediabunny-btn" id="mb-mute-btn" aria-label="Mute" aria-pressed="false">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                        </button>
                        <input type="range" class="mediabunny-volume-slider" id="mb-volume-slider" min="0" max="1" step="0.05" value="${this.config.volume}" aria-label="Volume">
                        
                        <!-- Audio Track Menu -->
                        <div class="mediabunny-menu-btn" id="mb-audio-container" style="display: none;">
                            <button class="mediabunny-btn" id="mb-audio-btn" aria-label="Audio Tracks" aria-haspopup="true" aria-expanded="false">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v9.28c-.47-.17-.97-.28-1.5-.28C8.01 12 6 14.01 6 16.5S8.01 21 10.5 21c2.31 0 4.2-1.75 4.45-4H15V6h4V3h-7z"/></svg>
                            </button>
                            <div class="mediabunny-menu" id="mb-audio-menu" role="menu"></div>
                        </div>

                        <!-- Subtitle Menu -->
                        <div class="mediabunny-menu-btn">
                            <button class="mediabunny-btn" id="mb-cc-btn" aria-label="Subtitles" aria-haspopup="true" aria-expanded="false">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1zm7 0h-1.5v-.5h-2v3h2V13H18v1c0 .55-.45 1-1 1h-3c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1z"/></svg>
                            </button>
                            <div class="mediabunny-menu" id="mb-cc-menu" role="menu">
                                <div class="mediabunny-menu-item active" data-value="off" role="menuitem" tabindex="0">Off</div>
                                <div class="mediabunny-menu-item" id="mb-upload-cc" role="menuitem" tabindex="0">
                                    <span>Upload Subtitle</span>
                                    <input type="file" id="mb-cc-input" accept=".vtt,.srt" style="display: none;">
                                </div>
                            </div>
                        </div>

                        <!-- Speed Menu -->
                        <div class="mediabunny-menu-btn" id="mb-speed-container">
                            <button class="mediabunny-btn" id="mb-speed-btn" aria-label="Playback Speed" aria-haspopup="true" aria-expanded="false" style="font-size: 0.8rem; font-weight: bold; width: auto; padding: 0 8px;">
                                1x
                            </button>
                            <div class="mediabunny-menu" id="mb-speed-menu" role="menu">
                                <div class="mediabunny-menu-item" data-value="0.25" role="menuitem" tabindex="0">0.25x</div>
                                <div class="mediabunny-menu-item" data-value="0.5" role="menuitem" tabindex="0">0.5x</div>
                                <div class="mediabunny-menu-item" data-value="0.75" role="menuitem" tabindex="0">0.75x</div>
                                <div class="mediabunny-menu-item" data-value="1" role="menuitem" tabindex="0">Normal</div>
                                <div class="mediabunny-menu-item" data-value="1.25" role="menuitem" tabindex="0">1.25x</div>
                                <div class="mediabunny-menu-item" data-value="1.5" role="menuitem" tabindex="0">1.5x</div>
                                <div class="mediabunny-menu-item" data-value="1.75" role="menuitem" tabindex="0">1.75x</div>
                                <div class="mediabunny-menu-item" data-value="2" role="menuitem" tabindex="0">2x</div>
                            </div>
                        </div>

                        <button class="mediabunny-btn" id="mb-loop-btn" aria-label="Loop Mode: Off">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>
                        </button>

                        <button class="mediabunny-btn" id="mb-fullscreen-btn" aria-label="Fullscreen">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
                        </button>
                    </div>
                </div>
            </div>
        `;

        const loopPanelHTML = `
            <div class="mediabunny-loop-panel" style="display: none;">
                <div class="loop-panel-header">
                    <span>Loop Controls</span>
                    <button class="mediabunny-close-btn" aria-label="Close Loop Panel">×</button>
                </div>
                <div class="loop-panel-content">
                    <div class="loop-status">Mode: <span id="mb-loop-status">Off</span></div>
                    <div class="loop-inputs">
                        <div class="input-group">
                            <label for="mb-loop-start">Start (A)</label>
                            <div class="input-row">
                                <input type="text" id="mb-loop-start" placeholder="MM:SS" class="mediabunny-input">
                                <button class="mediabunny-btn-small" id="mb-set-a-btn">Set</button>
                            </div>
                        </div>
                        <div class="input-group">
                            <label for="mb-loop-end">End (B)</label>
                            <div class="input-row">
                                <input type="text" id="mb-loop-end" placeholder="MM:SS" class="mediabunny-input">
                                <button class="mediabunny-btn-small" id="mb-set-b-btn">Set</button>
                            </div>
                        </div>
                    </div>
                    <div class="loop-actions">
                        <button class="mediabunny-btn-text" id="mb-clear-loop-btn">Clear Markers</button>
                    </div>
                </div>
            </div>
        `;

        this.container.insertAdjacentHTML('beforeend', controlsHTML);
        this.container.insertAdjacentHTML('beforeend', loopPanelHTML);

        // Initialize Screenshot Manager UI (must be after controls, before caching)
        if (this.screenshotManager) {
            this.screenshotManager.init();
        }

        // Cache elements
        this.ui.controls = this.container.querySelector('.mediabunny-controls');
        this.ui.playBtn = this.container.querySelector('#mb-play-btn');
        this.ui.prevBtn = this.container.querySelector('#mb-prev-btn');
        this.ui.nextBtn = this.container.querySelector('#mb-next-btn');
        this.ui.progressContainer = this.container.querySelector('.mediabunny-progress-container');
        this.ui.progressBar = this.container.querySelector('.mediabunny-progress-bar');
        this.ui.timeDisplay = this.container.querySelector('#mb-time-display');
        this.ui.muteBtn = this.container.querySelector('#mb-mute-btn');
        this.ui.volumeSlider = this.container.querySelector('#mb-volume-slider');
        this.ui.fullscreenBtn = this.container.querySelector('#mb-fullscreen-btn');
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
        let statusText = 'Off';

        if (this.loopMode === 'off') {
            btn.style.color = '';
            btn.setAttribute('aria-label', 'Loop Mode: Off');
            btn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>';
            statusText = 'Off';
        } else if (this.loopMode === 'playlist') {
            btn.style.color = 'var(--accent-primary)';
            btn.setAttribute('aria-label', 'Loop Mode: Playlist');
            btn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/><text x="12" y="16" font-size="8" text-anchor="middle" fill="currentColor" font-weight="bold">LIST</text></svg>';
            statusText = 'Playlist';
        } else if (this.loopMode === 'one') {
            btn.style.color = 'var(--accent-primary)';
            btn.setAttribute('aria-label', 'Loop Mode: One');
            btn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/><text x="12" y="16" font-size="8" text-anchor="middle" fill="currentColor" font-weight="bold">1</text></svg>';
            statusText = 'Current Video';
        } else if (this.loopMode === 'ab') {
            btn.style.color = 'var(--accent-primary)';
            btn.setAttribute('aria-label', 'Loop Mode: A-B');
            btn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/><text x="12" y="16" font-size="8" text-anchor="middle" fill="currentColor" font-weight="bold">A-B</text></svg>';
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
            this._updateAudioTrackMenu();
            console.log(`Switched to audio track: ${track.id}`);
        }
    }

    async _updateAudioTrackMenu() {
        if (!this.input) return;

        const audioTracks = await this.input.getAudioTracks();

        if (audioTracks.length <= 1) {
            this.ui.audioContainer.style.display = 'none';
            return;
        }

        this.ui.audioContainer.style.display = 'block';
        this.ui.audioMenu.innerHTML = '';

        audioTracks.forEach((track, index) => {
            const isActive = this.audioTrack && this.audioTrack.id === track.id;
            const label = track.languageCode || `Track ${index + 1}`;

            const item = document.createElement('div');
            item.className = `mediabunny-menu-item ${isActive ? 'active' : ''}`;
            item.dataset.value = track.id;
            item.textContent = label;
            item.setAttribute('role', 'menuitem');
            item.setAttribute('tabindex', '0');

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
     * Load a media source
     * @param {string} url - URL of the media file
     */
    async load(url) {
        try {
            // Stop any current playback
            this.pause();
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

                // Render first frame
                await this._startVideoIterator();
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

            this._updateAudioTrackMenu();
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
        }

        this.audioContextStartTime = this.audioContext.currentTime;
        this.isPlaying = true;
        this._updatePlayIcon();

        if (this.audioSink) {
            // Start the audio iterator
            if (this.audioBufferIterator) await this.audioBufferIterator.return();
            this.audioBufferIterator = this.audioSink.buffers(this._getPlaybackTime());
            this._runAudioIterator();
        }

        this._startRenderLoop();
    }

    pause() {
        console.log("Player.pause() called");
        this.playbackTimeAtStart = this._getPlaybackTime();
        this.isPlaying = false;
        this._updatePlayIcon();

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

        const wasPlaying = this.isPlaying;

        if (wasPlaying) {
            this.pause();
        }

        this.playbackTimeAtStart = Math.max(0, Math.min(this.duration, time));
        this.currentTime = this.playbackTimeAtStart; // Sync internal currentTime for UI
        this._updateProgress(); // Update UI immediately

        await this._startVideoIterator();

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

    _updatePlayIcon() {
        if (!this.isPlaying) {
            this.ui.playBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
            this.ui.playBtn.setAttribute('aria-label', 'Play');
            this.ui.playBtn.setAttribute('aria-pressed', 'false');
        } else {
            this.ui.playBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
            this.ui.playBtn.setAttribute('aria-label', 'Pause');
            this.ui.playBtn.setAttribute('aria-pressed', 'true');
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
        if (this.config.muted || this.config.volume === 0) {
            this.ui.muteBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>';
        } else {
            this.ui.muteBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';
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
    }
}

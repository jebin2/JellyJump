/**
 * Core Player Class
 * The main controller for video playback using MediaBunny.
 */

import { MediaBunny } from './MediaBunny.js';
import { PLAYER_CONFIG } from './config.js';

export class CorePlayer {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`Container with ID "${containerId}" not found.`);
            return;
        }

        this.config = { ...PLAYER_CONFIG, ...options };
        this.mediaElement = null;
        this.isPlaying = false;

        // UI Elements
        this.ui = {
            controls: null,
            playBtn: null,
            progressBar: null,
            progressContainer: null,
            timeDisplay: null,
            volumeSlider: null,
            muteBtn: null,
            fullscreenBtn: null
        };

        this._init();
    }

    /**
     * Initialize the player
     * @private
     */
    _init() {
        this.container.classList.add('mediabunny-container');

        // Create video element
        this.mediaElement = document.createElement('video');
        this.mediaElement.className = 'mediabunny-video';
        this.mediaElement.controls = false; // We use custom controls

        // Apply config
        this.mediaElement.volume = this.config.volume;
        this.mediaElement.muted = this.config.muted;
        this.mediaElement.loop = this.config.loop;

        this.container.appendChild(this.mediaElement);

        // Create UI
        this._createControls();

        // Attach Events
        this._attachEvents();
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
                </div>
                <div class="mediabunny-controls-row">
                    <div style="display: flex; align-items: center;">
                        <button class="mediabunny-btn" id="mb-play-btn" aria-label="Play" aria-pressed="false">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                        </button>
                        <div class="mediabunny-time" id="mb-time-display">0:00 / 0:00</div>
                    </div>
                    
                    <div class="mediabunny-volume-container">
                        <button class="mediabunny-btn" id="mb-mute-btn" aria-label="Mute" aria-pressed="false">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                        </button>
                        <input type="range" class="mediabunny-volume-slider" id="mb-volume-slider" min="0" max="1" step="0.05" value="${this.config.volume}" aria-label="Volume">
                        
                        <div class="mediabunny-menu-btn">
                            <button class="mediabunny-btn" id="mb-cc-btn" aria-label="Subtitles" aria-haspopup="true" aria-expanded="false">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1zm7 0h-1.5v-.5h-2v3h2V13H18v1c0 .55-.45 1-1 1h-3c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1z"/></svg>
                            </button>
                            <div class="mediabunny-menu" id="mb-cc-menu" role="menu">
                                <div class="mediabunny-menu-item active" data-value="off" role="menuitem" tabindex="0">Off</div>
                            </div>
                        </div>

                        <button class="mediabunny-btn" id="mb-fullscreen-btn" aria-label="Fullscreen">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
                        </button>
                    </div>
                </div>
            </div>
        `;

        this.container.insertAdjacentHTML('beforeend', controlsHTML);

        // Cache elements
        this.ui.controls = this.container.querySelector('.mediabunny-controls');
        this.ui.playBtn = this.container.querySelector('#mb-play-btn');
        this.ui.progressContainer = this.container.querySelector('.mediabunny-progress-container');
        this.ui.progressBar = this.container.querySelector('.mediabunny-progress-bar');
        this.ui.timeDisplay = this.container.querySelector('#mb-time-display');
        this.ui.muteBtn = this.container.querySelector('#mb-mute-btn');
        this.ui.volumeSlider = this.container.querySelector('#mb-volume-slider');
        this.ui.fullscreenBtn = this.container.querySelector('#mb-fullscreen-btn');
        this.ui.ccBtn = this.container.querySelector('#mb-cc-btn');
        this.ui.ccMenu = this.container.querySelector('#mb-cc-menu');
    }

    /**
     * Attach event listeners
     * @private
     */
    _attachEvents() {
        // Play/Pause
        this.ui.playBtn.addEventListener('click', () => this.togglePlay());
        this.mediaElement.addEventListener('click', () => this.togglePlay());

        // Time Update (Throttled with requestAnimationFrame)
        this.mediaElement.addEventListener('timeupdate', () => {
            if (!this.isDragging) {
                window.requestAnimationFrame(() => this._updateProgress());
            }
        });

        // Loading States
        this.mediaElement.addEventListener('waiting', () => {
            this.ui.loader.classList.add('visible');
        });

        this.mediaElement.addEventListener('playing', () => {
            this.ui.loader.classList.remove('visible');
        });

        this.mediaElement.addEventListener('canplay', () => {
            this.ui.loader.classList.remove('visible');
        });

        this.mediaElement.addEventListener('error', (e) => {
            console.error('Media Error:', e);
            this.ui.loader.classList.remove('visible');
            // Could show a user-friendly error message here
        });

        // Metadata Loaded
        this.mediaElement.addEventListener('loadedmetadata', () => {
            this._updateTimeDisplay();
            this._updateProgress();
        });

        // Seek
        this.ui.progressContainer.addEventListener('click', (e) => this._seek(e));

        // Volume
        this.ui.volumeSlider.addEventListener('input', (e) => {
            this.mediaElement.volume = e.target.value;
            this.mediaElement.muted = false;
            this._updateVolumeIcon();
        });

        this.ui.muteBtn.addEventListener('click', () => {
            this.mediaElement.muted = !this.mediaElement.muted;
            this._updateVolumeIcon();
        });

        // Fullscreen
        this.ui.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());

        // Subtitles
        this.ui.ccBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isExpanded = this.ui.ccBtn.getAttribute('aria-expanded') === 'true';
            this.ui.ccBtn.setAttribute('aria-expanded', !isExpanded);
            this.ui.ccMenu.classList.toggle('visible');
        });

        // Close menus on click outside
        document.addEventListener('click', (e) => {
            if (!this.ui.ccBtn.contains(e.target) && !this.ui.ccMenu.contains(e.target)) {
                this.ui.ccMenu.classList.remove('visible');
                this.ui.ccBtn.setAttribute('aria-expanded', 'false');
            }
        });

        // Subtitle Selection
        this.ui.ccMenu.addEventListener('click', (e) => {
            const item = e.target.closest('.mediabunny-menu-item');
            if (item) {
                const value = item.dataset.value;
                this._setSubtitleTrack(value);
                this.ui.ccMenu.classList.remove('visible');
            }
        });

        // Keyboard Shortcuts
        document.addEventListener('keydown', (e) => this._handleKeyboard(e));
    }

    /**
     * Handle keyboard shortcuts
     * @param {KeyboardEvent} e 
     * @private
     */
    _handleKeyboard(e) {
        // Ignore if user is typing in an input
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
            return;
        }

        // Ignore if modifier keys are pressed (except Shift for some potential future shortcuts)
        if (e.ctrlKey || e.altKey || e.metaKey) return;

        switch (e.key.toLowerCase()) {
            case ' ':
            case 'k':
                e.preventDefault(); // Prevent scrolling for Space
                this.togglePlay();
                break;

            case 'f':
                this.toggleFullscreen();
                break;

            case 'm':
                this.mediaElement.muted = !this.mediaElement.muted;
                this._updateVolumeIcon();
                break;

            case 'arrowleft':
                this.mediaElement.currentTime = Math.max(0, this.mediaElement.currentTime - 5);
                break;

            case 'arrowright':
                this.mediaElement.currentTime = Math.min(this.mediaElement.duration, this.mediaElement.currentTime + 5);
                break;

            case 'j':
                this.mediaElement.currentTime = Math.max(0, this.mediaElement.currentTime - 10);
                break;

            case 'l':
                this.mediaElement.currentTime = Math.min(this.mediaElement.duration, this.mediaElement.currentTime + 10);
                break;

            case 'arrowup':
                e.preventDefault();
                this.mediaElement.volume = Math.min(1, this.mediaElement.volume + 0.1);
                this.mediaElement.muted = false;
                this.ui.volumeSlider.value = this.mediaElement.volume;
                this._updateVolumeIcon();
                break;

            case 'arrowdown':
                e.preventDefault();
                this.mediaElement.volume = Math.max(0, this.mediaElement.volume - 0.1);
                this.ui.volumeSlider.value = this.mediaElement.volume;
                this._updateVolumeIcon();
                break;

            case 'c':
                // Toggle captions (if tracks exist)
                if (this.mediaElement.textTracks.length > 0) {
                    const currentMode = this.mediaElement.textTracks[0].mode;
                    // Simple toggle for the first track or "off"
                    // In a real app, we'd likely toggle the *last selected* track
                    // For now, we'll just toggle the first one if nothing is showing, or turn off if showing
                    let anyShowing = false;
                    for (let i = 0; i < this.mediaElement.textTracks.length; i++) {
                        if (this.mediaElement.textTracks[i].mode === 'showing') {
                            anyShowing = true;
                            break;
                        }
                    }

                    if (anyShowing) {
                        this._setSubtitleTrack('off');
                    } else {
                        this._setSubtitleTrack(0); // Default to first track
                    }
                }
                break;

            case 'home':
                this.mediaElement.currentTime = 0;
                break;

            case 'end':
                this.mediaElement.currentTime = this.mediaElement.duration;
                break;

            // Editor Mode Shortcuts
            case ',': // Step back 1 frame
                if (this.config.mode === 'editor') {
                    this.stepFrame(-1);
                }
                break;

            case '.': // Step forward 1 frame
                if (this.config.mode === 'editor') {
                    this.stepFrame(1);
                }
                break;

            case 'i': // Set In-point
                if (this.config.mode === 'editor') {
                    console.log('Set In-point at:', this.mediaElement.currentTime);
                    // Logic to be implemented in Editor phase
                }
                break;

            case 'o': // Set Out-point
                if (this.config.mode === 'editor') {
                    console.log('Set Out-point at:', this.mediaElement.currentTime);
                    // Logic to be implemented in Editor phase
                }
                break;
        }

        // Number keys 0-9 for percentage
        if (!isNaN(parseInt(e.key)) && e.key.length === 1) {
            const percent = parseInt(e.key) * 10;
            this.mediaElement.currentTime = (percent / 100) * this.mediaElement.duration;
        }
    }

    /**
     * Step forward or backward by frames
     * @param {number} frames - Number of frames to step (positive or negative)
     */
    stepFrame(frames) {
        if (!this.mediaElement.paused) {
            this.pause();
        }
        // Assuming 30fps for now as a default if frame rate isn't known
        const frameDuration = 1 / 30;
        this.mediaElement.currentTime = Math.max(0, Math.min(this.mediaElement.duration, this.mediaElement.currentTime + (frames * frameDuration)));
    }

    /**
     * Load a subtitle track
     * @param {string} url - URL of the VTT file
     * @param {string} label - Label for the track (e.g., "English")
     * @param {string} lang - Language code (e.g., "en")
     */
    loadSubtitles(url, label, lang) {
        const track = document.createElement('track');
        track.kind = 'subtitles';
        track.label = label;
        track.srclang = lang;
        track.src = url;
        track.default = false;

        this.mediaElement.appendChild(track);

        // Add to menu
        const index = this.mediaElement.textTracks.length - 1;
        const menuItem = document.createElement('div');
        menuItem.className = 'mediabunny-menu-item';
        menuItem.dataset.value = index;
        menuItem.textContent = label;
        this.ui.ccMenu.appendChild(menuItem);
    }

    /**
     * Set active subtitle track
     * @param {string|number} index - Index of the track or 'off'
     * @private
     */
    _setSubtitleTrack(index) {
        // Reset all tracks
        for (let i = 0; i < this.mediaElement.textTracks.length; i++) {
            this.mediaElement.textTracks[i].mode = 'hidden';
        }

        // Update UI
        const items = this.ui.ccMenu.querySelectorAll('.mediabunny-menu-item');
        items.forEach(item => item.classList.remove('active'));

        if (index === 'off') {
            this.ui.ccBtn.classList.remove('active');
            this.ui.ccMenu.querySelector('[data-value="off"]').classList.add('active');
        } else {
            this.mediaElement.textTracks[index].mode = 'showing';
            this.ui.ccBtn.classList.add('active');
            this.ui.ccMenu.querySelector(`[data-value="${index}"]`).classList.add('active');
        }
    }

    /**
     * Toggle playback state
     */
    togglePlay() {
        if (this.mediaElement.paused) {
            this.play();
        } else {
            this.pause();
        }
    }

    play() {
        this.mediaElement.play()
            .then(() => {
                this.isPlaying = true;
                this._updatePlayIcon();
            })
            .catch(e => console.error('Play failed:', e));
    }

    pause() {
        this.mediaElement.pause();
        this.isPlaying = false;
        this._updatePlayIcon();
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

    /**
     * Update play/pause icon
     * @private
     */
    _updatePlayIcon() {
        if (this.mediaElement.paused) {
            this.ui.playBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
            this.ui.playBtn.setAttribute('aria-label', 'Play');
            this.ui.playBtn.setAttribute('aria-pressed', 'false');
        } else {
            this.ui.playBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
            this.ui.playBtn.setAttribute('aria-label', 'Pause');
            this.ui.playBtn.setAttribute('aria-pressed', 'true');
        }
    }

    /**
     * Update progress bar and time
     * @private
     */
    _updateProgress() {
        const current = this.mediaElement.currentTime;
        const duration = this.mediaElement.duration || 0;
        const percent = (current / duration) * 100;

        this.ui.progressBar.style.width = `${percent}%`;
        this.ui.progressContainer.setAttribute('aria-valuenow', Math.round(percent));
        this._updateTimeDisplay();
    }

    /**
     * Update time text
     * @private
     */
    _updateTimeDisplay() {
        const current = this._formatTime(this.mediaElement.currentTime);
        const duration = this._formatTime(this.mediaElement.duration || 0);
        this.ui.timeDisplay.textContent = `${current} / ${duration}`;
    }

    /**
     * Format seconds to MM:SS
     * @param {number} seconds 
     * @returns {string}
     * @private
     */
    _formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    /**
     * Seek to position
     * @param {Event} e 
     * @private
     */
    _seek(e) {
        const rect = this.ui.progressContainer.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        this.mediaElement.currentTime = pos * this.mediaElement.duration;
    }

    /**
     * Update volume icon based on state
     * @private
     */
    _updateVolumeIcon() {
        if (this.mediaElement.muted || this.mediaElement.volume === 0) {
            this.ui.muteBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>';
        } else {
            this.ui.muteBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';
        }
    }

    /**
     * Load a media source
     * @param {string} url - URL of the media file
     */
    async load(url) {
        if (!this.mediaElement) return;

        try {
            console.log(`Loading media: ${url}`);
            this.mediaElement.src = url;
        } catch (error) {
            console.error('Error loading media:', error);
        }
    }

    /**
     * Clean up resources
     */
    destroy() {
        if (this.mediaElement) {
            this.mediaElement.remove();
            this.mediaElement = null;
        }
        if (this.ui.controls) {
            this.ui.controls.remove();
        }
        this.container.classList.remove('mediabunny-container');
        this.container = null;
    }
}

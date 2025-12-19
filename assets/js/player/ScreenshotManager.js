/**
 * Screenshot Manager
 * Handles video frame capture, preview, and download functionality  
 * Phase 17: Player Frame Capture
 */

export class ScreenshotManager {
    constructor(player) {
        this.player = player;
        this.wasPlayingBeforeCapture = false;
        this.screenshotDataUrl = null;
        this.screenshotTimestamp = null;

        this.ui = {
            btn: null,
            modal: null,
            preview: null,
            timestamp: null,
            downloadBtn: null,
            cancelBtn: null,
            closeBtn: null,
            prevBtn: null,
            nextBtn: null
        };
    }

    /**
     * Initialize screenshot UI and attach event listeners
     */
    init() {
        this._createUI();
        this._cacheElements();
        this._attachEvents();
    }

    /**
     * Create screenshot UI elements
     * @private
     */
    /**
     * Create screenshot UI elements
     * @private
     */
    _createUI() {
        // Insert button before fullscreen button
        const fullscreenBtn = this.player.container.querySelector('#mb-fullscreen-btn');
        if (fullscreenBtn) {
            const btnTemplate = document.getElementById('screenshot-button-template');
            const btnClone = btnTemplate.content.cloneNode(true);
            fullscreenBtn.parentNode.insertBefore(btnClone, fullscreenBtn);
        }

        // Insert modal at end of body to avoid layout constraints
        const modalTemplate = document.getElementById('screenshot-modal-template');
        const modalClone = modalTemplate.content.cloneNode(true);
        document.body.appendChild(modalClone);
    }



    /**
     * Cache DOM elements
     * @private
     */
    _cacheElements() {
        const container = this.player.container;
        this.ui.btn = container.querySelector('#mb-screenshot-btn');
        this.ui.modal = document.querySelector('.jellyjump-screenshot-modal');
        // Note: Preview and other elements are inside the modal, so we should query from modal
        if (this.ui.modal) {
            this.ui.preview = this.ui.modal.querySelector('#mb-screenshot-preview');
            this.ui.timestamp = this.ui.modal.querySelector('#mb-screenshot-timestamp');
            this.ui.downloadBtn = this.ui.modal.querySelector('#mb-screenshot-download');
            this.ui.cancelBtn = this.ui.modal.querySelector('#mb-screenshot-cancel');
            this.ui.closeBtn = this.ui.modal.querySelector('#mb-screenshot-close');
            this.ui.prevBtn = this.ui.modal.querySelector('#mb-screenshot-prev');
            this.ui.nextBtn = this.ui.modal.querySelector('#mb-screenshot-next');
        }
    }

    /**
     * Attach event listeners
     * @private
     */
    _attachEvents() {
        if (this.ui.btn) {
            this.ui.btn.addEventListener('click', () => this.capture());
        }

        if (this.ui.downloadBtn) {
            this.ui.downloadBtn.addEventListener('click', () => this.download());
        }

        if (this.ui.cancelBtn) {
            this.ui.cancelBtn.addEventListener('click', () => this.closeModal());
        }

        if (this.ui.closeBtn) {
            this.ui.closeBtn.addEventListener('click', () => this.closeModal());
        }

        if (this.ui.prevBtn) {
            this.ui.prevBtn.addEventListener('click', () => this.captureAdjacentFrame(-1));
        }

        if (this.ui.nextBtn) {
            this.ui.nextBtn.addEventListener('click', () => this.captureAdjacentFrame(1));
        }

        if (this.ui.modal) {
            this.ui.modal.addEventListener('click', (e) => {
                if (e.target === this.ui.modal) {
                    this.closeModal();
                }
            });
        }
    }

    /**
     * Capture current video frame as screenshot
     * Works in both MediaBunny mode and stream mode (canvas-based)
     */
    async capture() {
        // Check if we have something to capture
        const isStreamMode = this.player.isStreamMode;
        const hasMediaBunny = this.player.videoSink && this.player.videoTrack;
        const hasCanvas = this.player.canvas && this.player.ctx;

        if (!hasMediaBunny && !hasCanvas) {
            console.warn('No video loaded');
            return;
        }

        try {
            // Track if video was playing
            this.wasPlayingBeforeCapture = this.player.isPlaying;

            // Pause video if playing
            if (this.player.isPlaying) {
                this.player.pause();
            }

            let dataUrl;
            let timestamp;

            if (isStreamMode && hasCanvas) {
                // Stream mode: capture directly from canvas
                dataUrl = this.player.canvas.toDataURL('image/png');
                timestamp = this.player.currentTime || 0;
                console.log('[Screenshot] Captured from stream canvas');
            } else if (hasMediaBunny) {
                // MediaBunny mode: use videoSink
                const frame = await this.player.videoSink.getCanvas(this.player.currentTime);

                if (!frame || !frame.canvas) {
                    console.error('Failed to capture frame');
                    return;
                }

                dataUrl = frame.canvas.toDataURL('image/png');
                timestamp = frame.timestamp;
            } else {
                console.error('No capture method available');
                return;
            }

            // Show modal with preview
            this.showModal(dataUrl, timestamp);
        } catch (error) {
            console.error('Error capturing frame:', error);
        }
    }

    /**
     * Capture adjacent frame (previous or next)
     * @param {number} direction - -1 for previous, 1 for next
     */
    async captureAdjacentFrame(direction) {
        if (!this.player.videoSink || !this.player.videoTrack) {
            return;
        }

        try {
            // Calculate frame duration based on frame rate
            const fps = this.player.frameRate || 30;
            const frameDuration = 1 / fps;

            // Calculate new timestamp
            const currentTimestamp = this.screenshotTimestamp || this.player.currentTime;
            let newTimestamp = currentTimestamp + (direction * frameDuration);

            // Clamp to video duration
            newTimestamp = Math.max(0, Math.min(this.player.duration, newTimestamp));

            // Get frame at new timestamp
            const frame = await this.player.videoSink.getCanvas(newTimestamp);

            if (!frame || !frame.canvas) {
                console.error('Failed to capture adjacent frame');
                return;
            }

            // Convert canvas to data URL
            const dataUrl = frame.canvas.toDataURL('image/png');

            // Update modal with new frame (don't close/reopen)
            this.ui.preview.src = dataUrl;
            this.screenshotDataUrl = dataUrl;
            this.screenshotTimestamp = frame.timestamp;

            // Update timestamp display
            const timeStr = this._formatTime(frame.timestamp);
            this.ui.timestamp.textContent = `at ${timeStr}`;
        } catch (error) {
            console.error('Error capturing adjacent frame:', error);
        }
    }

    /**
     * Show screenshot modal with preview
     * @param {string} imageData - Data URL of the screenshot
     * @param {number} timestamp - Frame timestamp
     */
    showModal(imageData, timestamp) {
        if (!this.ui.modal) return;

        // Set preview image
        this.ui.preview.src = imageData;
        this.screenshotDataUrl = imageData;
        this.screenshotTimestamp = timestamp;

        // Update timestamp display
        const timeStr = this._formatTime(timestamp);
        this.ui.timestamp.textContent = `at ${timeStr}`;

        // Prevent body scroll
        document.body.style.overflow = 'hidden';

        // Show modal
        this.ui.modal.style.display = 'flex';
    }

    /**
     * Close screenshot modal
     */
    closeModal() {
        if (!this.ui.modal) return;

        // Hide modal
        this.ui.modal.style.display = 'none';

        // Restore body scroll
        document.body.style.overflow = '';

        // Clean up
        this.ui.preview.src = '';
        this.screenshotDataUrl = null;
        this.screenshotTimestamp = null;

        // Resume playback if it was playing before
        if (this.wasPlayingBeforeCapture) {
            this.player.play();
            this.wasPlayingBeforeCapture = false;
        }
    }

    /**
     * Download screenshot as PNG file
     */
    download() {
        if (!this.screenshotDataUrl) return;

        try {
            // Generate filename with timestamp
            const timestamp = Math.floor(this.screenshotTimestamp || this.player.currentTime);
            const filename = `screenshot-${timestamp}s.png`;

            // Use reusable download anchor from HTML
            const link = document.getElementById('mb-download-link');
            link.href = this.screenshotDataUrl;
            link.download = filename;
            link.click();

            // Close modal
            this.closeModal();
        } catch (error) {
            console.error('Error downloading screenshot:', error);
        }
    }

    /**
     * Check if modal is currently open
     * @returns {boolean}
     */
    isModalOpen() {
        return this.ui.modal && this.ui.modal.style.display !== 'none';
    }

    /**
     * Format time in MM:SS format
     * @param {number} seconds
     * @returns {string}
     * @private
     */
    _formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }
}

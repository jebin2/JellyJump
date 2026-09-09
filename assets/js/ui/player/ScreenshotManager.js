import { Toast } from "../../shared/utils/Toast.js";
import { Logger } from "../../shared/utils/Logger.js";
import { Modal } from "../Modal.js";
import { formatTime } from "../../shared/utils/mediaUtils.js";

/**
 * Screenshot Manager
 * Handles video frame capture, preview, and download functionality  
 */
export class ScreenshotManager {
    constructor(player) {
        this.player = player;
        this.wasPlayingBeforeCapture = false;
        this.screenshotDataUrl = null;
        this.screenshotTimestamp = null;
        this.modalInstance = null;

        this.ui = {
            btn: null,
            preview: null,
            timestamp: null,
            downloadBtn: null,
            cancelBtn: null,
            prevBtn: null,
            nextBtn: null
        };
    }

    /**
     * Initialize screenshot button
     */
    init() {
        // Insert button before fullscreen button
        const fullscreenBtn = this.player.container.querySelector('#mb-fullscreen-btn');
        if (fullscreenBtn) {
            const btnTemplate = document.getElementById('screenshot-button-template');
            if (btnTemplate) {
                const btnClone = btnTemplate.content.cloneNode(true);
                fullscreenBtn.parentNode.insertBefore(btnClone, fullscreenBtn);
            }
        }

        this.ui.btn = this.player.container.querySelector('#mb-screenshot-btn');
        if (this.ui.btn) {
            this.ui.btn.addEventListener('click', () => this.capture());
        }
    }

    /**
     * A frame with everything that was on screen over it.
     *
     * A screenshot of a file does not come from the player canvas -- it is
     * decoded fresh from the sink, at the file's own resolution, so it arrives
     * clean. Without this, filtering a video and taking a screenshot saved the
     * unfiltered original, and a sticker you had placed was simply absent.
     *
     * Nothing is copied when there is nothing to add, so an unfiltered
     * screenshot still costs exactly one toDataURL.
     *
     * @param {HTMLCanvasElement} source
     * @param {{stickersAlreadyDrawn: boolean}} options
     * @returns {string} a PNG data URL
     * @private
     */
    _composite(source, { stickersAlreadyDrawn }) {
        const filters = this.player.videoFilters;
        const stickers = this.player.stickers;

        // In canvas mode the colour is already in the pixels; in CSS mode it
        // lives on the element and has to be put back on here.
        const needsColour = !!filters && !filters.canvasMode && filters.isActive();
        const needsStickers = !stickersAlreadyDrawn && (stickers?.stickers.length > 0);
        if (!needsColour && !needsStickers) return source.toDataURL('image/png');

        const out = document.createElement('canvas');
        out.width = source.width;
        out.height = source.height;
        const ctx = out.getContext('2d');

        if (needsColour) filters.bakeInto(ctx, source, out.width, out.height);
        else ctx.drawImage(source, 0, 0, out.width, out.height);

        if (needsStickers) stickers.drawInto(out, ctx);

        return out.toDataURL('image/png');
    }

    /**
     * Capture current video frame as screenshot
     */
    async capture() {
        // Nothing can be read out of a cross-origin embed, and the canvas is
        // still there holding whatever was last drawn — so without this a
        // screenshot of a YouTube video saves a blank or stale frame rather
        // than failing honestly. Reachable from the keyboard even while the
        // control bar is hidden, which is why the guard is here and not on the
        // button.
        if (this.player.capabilities && !this.player.capabilities.canvasFrames) {
            Toast.show('Screenshots are not available for a YouTube video — its frames belong to YouTube.', 4000);
            return;
        }

        const isStreamMode = this.player.isStreamMode;
        const hasMediaBunny = this.player.videoSink && this.player.videoTrack;
        const hasCanvas = this.player.canvas && this.player.ctx;

        if (!hasMediaBunny && !hasCanvas) {
            Logger.warn('No video loaded');
            return;
        }

        try {
            this.wasPlayingBeforeCapture = this.player.isPlaying;
            if (this.player.isPlaying) this.player.pause();

            let dataUrl;
            let timestamp;

            if (isStreamMode && hasCanvas) {
                // The player canvas already has the stickers on it: the render
                // loop draws them into every frame it presents.
                dataUrl = this._composite(this.player.canvas, { stickersAlreadyDrawn: true });
                timestamp = this.player.currentTime || 0;
            } else if (hasMediaBunny) {
                const frame = await this.player.videoSink.getCanvas(this.player.currentTime);
                if (!frame || !frame.canvas) {
                    Logger.error('Failed to capture frame');
                    return;
                }
                dataUrl = this._composite(frame.canvas, { stickersAlreadyDrawn: false });
                timestamp = frame.timestamp;
            } else {
                Logger.error('No capture method available');
                return;
            }

            this.showModal(dataUrl, timestamp);
        } catch (error) {
            Logger.error('Error capturing frame:', error);
        }
    }

    /**
     * Show screenshot modal with preview
     * @param {string} imageData - Data URL of the screenshot
     * @param {number} timestamp - Frame timestamp
     */
    showModal(imageData, timestamp) {
        const template = document.getElementById('screenshot-content-template');
        const footerTemplate = document.getElementById('screenshot-footer-template');
        if (!template || !footerTemplate) return;

        this.modalInstance = new Modal({
            splitLayout: true,
            onClose: () => this._onClose()
        });

        this.modalInstance.setTitle('Screenshot Preview');
        this.modalInstance.setBody(template.content.cloneNode(true));
        this.modalInstance.setFooter(footerTemplate.content.cloneNode(true));

        const modal = this.modalInstance.modal;

        // Cache UI elements
        this.ui.preview = modal.querySelector('#mb-screenshot-preview');
        this.ui.timestamp = modal.querySelector('#mb-screenshot-timestamp');
        this.ui.downloadBtn = modal.querySelector('#mb-screenshot-download');
        this.ui.cancelBtn = modal.querySelector('#mb-screenshot-cancel');
        this.ui.prevBtn = modal.querySelector('#mb-screenshot-prev');
        this.ui.nextBtn = modal.querySelector('#mb-screenshot-next');

        // Initial Data
        this.ui.preview.src = imageData;
        this.screenshotDataUrl = imageData;
        this.screenshotTimestamp = timestamp;
        this.ui.timestamp.textContent = formatTime(timestamp);

        // Events
        this.ui.downloadBtn.addEventListener('click', () => this.download());
        if (this.ui.cancelBtn) this.ui.cancelBtn.addEventListener('click', () => this.modalInstance.close());
        this.ui.prevBtn.addEventListener('click', () => this.captureAdjacentFrame(-1));
        this.ui.nextBtn.addEventListener('click', () => this.captureAdjacentFrame(1));

        // Close button in footer
        const closeBtn = modal.querySelector('.mb-modal-close-btn');
        if (closeBtn) closeBtn.addEventListener('click', () => this.modalInstance.close());

        this.modalInstance.open();

        // Keyboard navigation
        this._keydownHandler = this._handleKeydown.bind(this);
        document.addEventListener('keydown', this._keydownHandler);
    }

    /**
     * Internal close handler
     * @private
     */
    _onClose() {
        if (this._keydownHandler) {
            document.removeEventListener('keydown', this._keydownHandler);
            this._keydownHandler = null;
        }

        // Clean up Large Data
        this.screenshotDataUrl = null;
        this.screenshotTimestamp = null;

        // Resume playback
        if (this.wasPlayingBeforeCapture) {
            this.player.play();
            this.wasPlayingBeforeCapture = false;
        }
    }

    /**
     * Capture adjacent frame
     * @param {number} direction 
     */
    async captureAdjacentFrame(direction) {
        if (!this.player.videoSink || !this.player.videoTrack) return;

        try {
            const fps = this.player.frameRate || 30;
            const frameDuration = 1 / fps;
            const currentTimestamp = this.screenshotTimestamp ?? this.player.currentTime;
            const duration = this.player.duration;

            // Already at boundary
            if ((direction < 0 && currentTimestamp <= 0) || (direction > 0 && currentTimestamp >= duration)) return;

            // Overshoot slightly for forward seeks since getCanvas returns frame at-or-before timestamp
            const step = direction > 0 ? frameDuration + 0.001 : frameDuration;
            const seekTime = Math.max(0, Math.min(duration, currentTimestamp + (direction * step)));

            const frame = await this.player.videoSink.getCanvas(seekTime);
            if (!frame || !frame.canvas) return;

            const dataUrl = this._composite(frame.canvas, { stickersAlreadyDrawn: false });
            this.ui.preview.src = dataUrl;
            this.screenshotDataUrl = dataUrl;
            this.screenshotTimestamp = frame.timestamp;
            this.ui.timestamp.textContent = formatTime(frame.timestamp);
        } catch (error) {
            Logger.error('Error capturing adjacent frame:', error);
        }
    }

    /**
     * Download screenshot
     */
    /**
     * Download screenshot
     */
    download() {
        if (!this.screenshotDataUrl || !this.ui.downloadBtn) return;

        try {
            const timestamp = Math.floor(this.screenshotTimestamp || this.player.currentTime);
            const filename = `screenshot-${timestamp}s.png`;

            // Update anchor attributes for direct download
            this.ui.downloadBtn.href = this.screenshotDataUrl;
            this.ui.downloadBtn.download = filename;

            Logger.log('Screenshot download triggered:', filename);

            // Optional: Close modal after download start
            // this.modalInstance.close();
        } catch (error) {
            Logger.error('Error downloading screenshot:', error);
        }
    }

    /**
     * Keyboard navigation handler
     * @private
     */
    _handleKeydown(e) {
        if (!this.modalInstance) return;

        switch (e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                this.captureAdjacentFrame(-1);
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.captureAdjacentFrame(1);
                break;
            case 'Escape':
                e.preventDefault();
                this.modalInstance.close();
                break;
        }
    }

    /**
     * Check if modal is currently open
     * @returns {boolean}
     */
    isModalOpen() {
        return !!this.modalInstance;
    }

}

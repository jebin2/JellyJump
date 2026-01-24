import { Logger } from "../utils/Logger.js";

/**
 * Generates thumbnails for a video by seeking and capturing frames.
 */
export class ThumbnailGenerator {
    constructor() {
        this.video = document.createElement('video');
        this.video.muted = true;
        this.video.playsInline = true;
        this.video.crossOrigin = "anonymous"; // Handle CORS if needed
        this.video.style.display = 'none'; // Ensure hidden

        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');

        this.thumbnails = []; // Array of { time, url }
        this.isGenerating = false;
        this.abortController = null;
        this.progressCallback = null;
    }

    /**
     * Start generating thumbnails
     * @param {string} videoUrl - Blob URL or src
     * @param {number} duration - Video duration in seconds
     * @param {Object} options - { interval: number, width: number, height: number }
     * @returns {Promise<Array>} - Resolves with thumbnails array
     */
    async generate(videoUrl, duration, options = {}) {
        if (this.isGenerating) {
            this.cancel();
        }

        this.isGenerating = true;
        this.thumbnails = [];
        this.abortController = new AbortController();
        const signal = this.abortController.signal;

        const interval = options.interval || 1; // Default 1 second
        this.generationInterval = interval;
        const width = options.width || 160;

        // Calculate aspect ratio later once video loads
        // We'll generate times: 0, 1, 2, ... duration
        const times = [];
        for (let t = 0; t < duration; t += interval) {
            times.push(t);
        }
        // Always include the very end? Maybe not needed.

        return new Promise((resolve, reject) => {
            if (signal.aborted) return reject(new Error('Aborted'));

            // Cleanup handler
            const cleanup = () => {
                this.video.removeAttribute('src');
                this.video.load();
                this.isGenerating = false;
                this.abortController = null;
            };

            this.video.onloadedmetadata = () => {
                if (signal.aborted) {
                    cleanup();
                    return reject(new Error('Aborted'));
                }

                // Set canvas size
                const aspect = this.video.videoWidth / this.video.videoHeight;
                this.canvas.width = width;
                this.canvas.height = width / aspect;

                // Start processing
                this._processNextFrame(times, 0, resolve, reject, signal, cleanup);
            };

            this.video.onerror = (e) => {
                cleanup();
                Logger.error('Thumbnail generation failed:', e);
                reject(e);
            };

            this.video.src = videoUrl;
            this.video.load();
        });
    }

    _processNextFrame(times, index, resolve, reject, signal, cleanup) {
        if (signal.aborted) {
            cleanup();
            reject(new Error('Aborted'));
            return;
        }

        if (index >= times.length) {
            // Done
            cleanup();
            resolve(this.thumbnails);
            return;
        }

        const time = times[index];

        // Seek
        this.video.currentTime = time;

        const onSeeked = () => {
            // Capture frame
            this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);

            // To Blob URL (efficient for memory?)
            this.canvas.toBlob((blob) => {
                if (signal.aborted) return;

                const url = URL.createObjectURL(blob);
                this.thumbnails.push({ time, url });

                // Notify progress
                if (this.progressCallback) {
                    this.progressCallback(this.thumbnails.length / times.length);
                }

                // Next frame
                this._processNextFrame(times, index + 1, resolve, reject, signal, cleanup);
            }, 'image/jpeg', 0.7); // Low quality JPEG for thumbnails is fine
        };

        // One-time listener
        this.video.addEventListener('seeked', onSeeked, { once: true });
    }

    cancel() {
        if (this.abortController) {
            this.abortController.abort();
        }
        this.isGenerating = false;
        this._revokeThumbnails();
        this.thumbnails = [];
    }

    _revokeThumbnails() {
        if (this.thumbnails) {
            this.thumbnails.forEach(t => URL.revokeObjectURL(t.url));
        }
    }

    destroy() {
        this.cancel();
        this.video = null;
        this.canvas = null;
        this.ctx = null;
    }

    /**
     * Get thumbnail for a specific time
     * @param {number} time 
     * @returns {string|null} URL of the closest thumbnail
     */
    getThumbnail(time) {
        if (!this.thumbnails.length) return null;

        // Find closest
        // Since sorted by time, we can just find locally
        // Assuming generated at regular intervals

        // Ideally binary search, but linear scan is fine for < 100 items
        let closest = this.thumbnails[0];
        let minDiff = Math.abs(time - closest.time);

        for (let i = 1; i < this.thumbnails.length; i++) {
            const t = this.thumbnails[i];
            const diff = Math.abs(time - t.time);
            if (diff < minDiff) {
                minDiff = diff;
                closest = t;
            } else {
                // Since sorted, if diff starts increasing, we found it
                break;
            }
        }

        // Check tolerance
        const tolerance = (this.generationInterval || 1) * 0.7;
        if (minDiff > tolerance) return null;

        return closest ? closest.url : null;
    }
}

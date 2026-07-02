import { Logger } from "../../shared/utils/Logger.js";
import { MediaBunny } from "../../core/MediaBunny.js";

const { Input, BlobSource, UrlSource, ALL_FORMATS, CanvasSink, EncodedPacketSink } = MediaBunny;

/**
 * Generates thumbnails for a video using Mediabunny.
 */
export class ThumbnailGenerator {
    constructor() {
        this.thumbnails = []; // Array of { time, url }
        this.isGenerating = false;
        this.progressCallback = null;
        this.generationInterval = 1;
        this._input = null; // Track for cleanup
    }

    /**
     * Start generating thumbnails (Mediabunny version)
     * @param {string|File|Blob} resource - Video URL or File/Blob
     * @param {number} duration - Video duration in seconds (optional fallback)
     * @param {Object} options - { interval: number, width: number }
     */
    async generate(resource, duration, options = {}) {
        if (this.isGenerating) {
            this.cancel();
        }

        this.isGenerating = true;
        this.thumbnails = [];
        // Determine optimization strategy
        const width = options.width || 160;
        const count = options.count || 100; // Target number of thumbnails

        // Calculate interval: if not provided, adapt to duration/count
        let interval = options.interval;
        if (!interval) {
            // Target ~100 thumbnails for the whole video
            // But ensure min interval of 1s to avoid excessive processing on short cliips
            interval = Math.max(1, duration / count);
        }
        this.generationInterval = interval;

        Logger.log('[ThumbnailGenerator] Generating with settings:', { width, interval, duration });

        try {
            // 1. Setup Mediabunny Input
            // Handle File/Blob vs String URL
            const source = (resource instanceof File || resource instanceof Blob)
                ? new BlobSource(resource)
                : new UrlSource(resource);

            // Dispose previous Input if re-generating
            this._disposeInput();

            this._input = new Input({
                formats: ALL_FORMATS,
                source,
            });

            // 2. Get Video Track
            const videoTrack = await this._input.getPrimaryVideoTrack();
            if (!videoTrack) {
                Logger.warn('[Thumbnails] No video track found');
                return;
            }

            if (!(await videoTrack.canDecode())) {
                Logger.warn('[Thumbnails] Browser cannot decode video track');
                return;
            }

            // 3. Setup CanvasSink
            // We just specify width, let height be auto-calculated if supported, 
            // or we could calculate if needed. CanvasSink usually handles aspect ratio.
            const sink = new CanvasSink(videoTrack, {
                width: width,
                // fit: 'contain' // Optional
                // Keep the hardware decoder free for playback; thumbnails are
                // small background work that software decoding handles fine.
                decoderOptions: { hardwareAcceleration: 'prefer-software' },
            });

            // 4. Calculate timestamps
            // Use track's actual start time and duration if available
            let startTimestamp = await videoTrack.getFirstTimestamp();
            try {
                const encodedSink = new EncodedPacketSink(videoTrack);
                const firstKeyPacket = await encodedSink.getFirstKeyPacket();
                if (firstKeyPacket) startTimestamp = firstKeyPacket.timestamp;
            } catch (e) {
                Logger.warn('[ThumbnailGenerator] getFirstKeyPacket failed, using getFirstTimestamp():', e);
            }
            const trackDuration = await videoTrack.computeDuration();

            // Generate timestamps
            const timestamps = [];
            // If duration was passed roughly, adhere to interval, but bounded by track limits
            // Using logic: generate every 'interval' seconds starting from startTimestamp

            const endTimestamp = startTimestamp + (duration || trackDuration);

            for (let t = startTimestamp; t < endTimestamp; t += this.generationInterval) {
                timestamps.push(t);
            }

            // 5. Generate via iterator
            const iterator = sink.canvasesAtTimestamps(timestamps);
            let processedCount = 0;

            for await (const result of iterator) {
                if (!this.isGenerating) break;

                // Skip null results
                if (!result) continue;

                const { canvas, timestamp } = result;

                if (!canvas) continue;

                // Convert canvas to blob URL
                let blobUrl;
                if (canvas.convertToBlob) {
                    const b = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.7 });
                    blobUrl = URL.createObjectURL(b);
                } else if (canvas.toBlob) {
                    blobUrl = await new Promise(resolve =>
                        canvas.toBlob(b => resolve(URL.createObjectURL(b)), 'image/jpeg', 0.7)
                    );
                } else {
                    Logger.warn('[Thumbnails] Canvas conversion not supported');
                    continue;
                }

                this.thumbnails.push({ time: timestamp, url: blobUrl });

                processedCount++;
                if (this.progressCallback) {
                    this.progressCallback(processedCount / timestamps.length);
                }
            }

        } catch (e) {
            if (this.isGenerating) {
                Logger.error('[Thumbnails] Generation error:', e);
            }
        } finally {
            this.isGenerating = false;
            this._disposeInput();
        }
    }

    cancel() {
        this.isGenerating = false;
        this._disposeInput();
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
    }

    /**
     * Dispose the MediaBunny Input to release decoded video memory.
     * @private
     */
    _disposeInput() {
        if (this._input && typeof this._input.dispose === 'function') {
            try {
                this._input.dispose();
            } catch (e) { /* ignore */ }
        }
        this._input = null;
    }

    /**
     * Get thumbnail for a specific time
     * @param {number} time 
     * @returns {string|null} URL of the closest thumbnail
     */
    getThumbnail(time) {
        if (!this.thumbnails.length) return null;

        // Find closest
        let closest = this.thumbnails[0];
        let minDiff = Math.abs(time - closest.time);

        for (let i = 1; i < this.thumbnails.length; i++) {
            const t = this.thumbnails[i];
            const diff = Math.abs(time - t.time);
            if (diff < minDiff) {
                minDiff = diff;
                closest = t;
            } else {
                break;
            }
        }

        // Check tolerance
        const tolerance = (this.generationInterval || 1) * 0.7;
        if (minDiff > tolerance) return null;

        return closest ? closest.url : null;
    }
}

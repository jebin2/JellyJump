import { Logger } from "../utils/Logger.js";
import { MediaBunny } from "../core/MediaBunny.js";

const { Input, BlobSource, UrlSource, ALL_FORMATS, CanvasSink } = MediaBunny;

/**
 * Detects hard cuts (scene changes) in a video by comparing histogram differences between frames.
 */
export class HardCutDetector {
    constructor() {
        this.isDetecting = false;
        this.progressCallback = null; // (progress: number) => void
    }

    /**
     * Start detecting hard cuts.
     * @param {string|File|Blob} resource - Video URL or File/Blob
     * @param {Object} options - Configuration options
     * @param {number} [options.threshold=0.15] - Difference threshold (0.0 to 1.0) to consider a hard cut.
     * @param {number} [options.sampleRate=0.5] - How many seconds between frame checks. Lower = more accurate but slower.
     * @param {number} [options.width=64] - Width to downscale frames to for comparison (performance optimization).
     * @returns {Promise<number[]>} - Array of timestamps (in seconds) where cuts were detected.
     */
    async detect(resource, options = {}) {
        if (this.isDetecting) {
            this.cancel();
        }

        this.isDetecting = true;
        const cuts = [];

        // Options
        const threshold = options.threshold || 0.15;
        const interval = options.sampleRate || 0.5;
        const processingWidth = options.width || 64; // Small width is enough for color histogram/diff

        Logger.log('[HardCutDetector] Starting detection...', { threshold, interval, processingWidth });

        try {
            // 1. Setup Input
            const source = (resource instanceof File || resource instanceof Blob)
                ? new BlobSource(resource)
                : new UrlSource(resource);

            const input = new Input({
                formats: ALL_FORMATS,
                source,
            });

            // 2. Get Video Track
            const videoTrack = await input.getPrimaryVideoTrack();
            if (!videoTrack) {
                Logger.warn('[HardCutDetector] No video track found');
                return [];
            }

            if (!(await videoTrack.canDecode())) {
                Logger.warn('[HardCutDetector] Browser cannot decode video track');
                return [];
            }

            // 3. Setup CanvasSink
            // Auto-calculate height to maintain aspect ratio, but for pure difference check, 
            // exact AR might not be critical, but let's be nice.
            // CanvasSink creates a canvas internally.
            const sink = new CanvasSink(videoTrack, {
                width: processingWidth
            });

            // 4. Generate timestamps to check
            const startTimestamp = await videoTrack.getFirstTimestamp();
            const duration = await videoTrack.computeDuration();
            const endTimestamp = startTimestamp + duration;

            const timestamps = [];
            for (let t = startTimestamp; t < endTimestamp; t += interval) {
                timestamps.push(t);
            }

            // 5. Process Frames
            const iterator = sink.canvasesAtTimestamps(timestamps);

            let previousData = null;
            let processedCount = 0;

            for await (const result of iterator) {
                if (!this.isDetecting) break;

                const { canvas, timestamp } = result;
                if (!canvas) continue;

                // Get pixel data
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const currentData = imageData.data;

                // Compare with previous frame
                if (previousData) {
                    const diff = this._calculateFrameDifference(previousData, currentData);

                    // Logger.debug(`[HardCutDetector] Time: ${timestamp.toFixed(2)}s, Diff: ${diff.toFixed(4)}`);

                    if (diff > threshold) {
                        Logger.log(`[HardCutDetector] Cut detected at ${timestamp.toFixed(2)}s (Diff: ${diff.toFixed(4)})`);
                        cuts.push(timestamp);
                    }
                }

                // Store current data for next iteration
                // Note: ImageData.data is a Uint8ClampedArray. 
                // We need to copy it because the canvas might be reused or cleared by the sink implementation?
                // Actually CanvasSink returns a new canvas or reuses? 
                // Wrapper usually returns a wrapped canvas.
                // To be safe, we keep a copy or just reference if we know it persists.
                // Uint8ClampedArray.from() creates a copy.
                previousData = new Uint8ClampedArray(currentData);

                processedCount++;
                if (this.progressCallback) {
                    this.progressCallback(processedCount / timestamps.length);
                }
            }

        } catch (e) {
            Logger.error('[HardCutDetector] Detection error:', e);
        } finally {
            this.isDetecting = false;
        }

        Logger.log(`[HardCutDetector] Finished. Found ${cuts.length} cuts.`);
        return cuts;
    }

    /**
     * Calculates the normalized difference between two frames.
     * Uses a simple Mean Absolute Difference (MAD) normalized to 0-1.
     */
    _calculateFrameDifference(data1, data2) {
        if (data1.length !== data2.length) return 1.0; // Size mismatch = max diff

        let totalDiff = 0;
        const len = data1.length;

        // data structure is [R, G, B, A, R, G, B, A, ...]
        // We only care about R, G, B. Alpha is usually 255.
        // Step by 4.
        for (let i = 0; i < len; i += 4) {
            const rDiff = Math.abs(data1[i] - data2[i]);
            const gDiff = Math.abs(data1[i + 1] - data2[i + 1]);
            const bDiff = Math.abs(data1[i + 2] - data2[i + 2]);

            totalDiff += (rDiff + gDiff + bDiff);
        }

        // Normalize
        // Max diff per pixel = 255 + 255 + 255 = 765
        // Number of pixels = len / 4
        const numPixels = len / 4;
        const maxTotalDiff = numPixels * 765;

        return totalDiff / maxTotalDiff;
    }

    cancel() {
        this.isDetecting = false;
    }
}

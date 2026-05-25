import { Logger } from "../utils/Logger.js";
import { MediaBunny } from "../../core/MediaBunny.js";

const { Input, BlobSource, UrlSource, ALL_FORMATS, CanvasSink, EncodedPacketSink } = MediaBunny;

/**
 * Detects motion in a video by comparing frame differences over time.
 * Identifies intervals (segments) where significant motion is occurring.
 */
export class MotionDetector {
    constructor() {
        this.isDetecting = false;
        this.progressCallback = null; // (progress: number) => void
        this._input = null; // Track for cleanup
    }

    /**
     * Start detecting motion segments.
     * @param {string|File|Blob} resource - Video URL or File/Blob
     * @param {Object} options - Configuration options
     * @param {number} [options.threshold=0.05] - Difference threshold (0.0 to 1.0) to consider "motion".
     * @param {number} [options.sampleRate=0.25] - Second interval (e.g. 0.25 = 4 checks per second).
     * @param {number} [options.width=64] - Processing width.
     * @param {number} [options.minDuration=1.0] - Minimum duration of a segment to be kept.
     * @param {number} [options.mergeGap=1.0] - Max gap between motion frames to merge into one segment.
     * @returns {Promise<Object[]>} - Array of segments { start: number, end: number, score: number }
     */
    async detect(resource, options = {}) {
        if (this.isDetecting) {
            this.cancel();
        }

        this.isDetecting = true;
        const segments = [];

        // Options (Lower threshold for motion than hard cut)
        const threshold = options.threshold || 0.05;
        const interval = options.sampleRate || 0.25;
        const processingWidth = options.width || 64;
        const mergeGap = options.mergeGap !== undefined ? options.mergeGap : 1.0;
        const minDuration = options.minDuration !== undefined ? options.minDuration : 1.0;

        Logger.log('[MotionDetector] Starting detection...', { threshold, interval });

        try {
            // Dispose previous Input if re-running detection
            this._disposeInput();

            // 1. Setup Input
            const source = (resource instanceof File || resource instanceof Blob)
                ? new BlobSource(resource)
                : new UrlSource(resource);

            this._input = new Input({
                formats: ALL_FORMATS,
                source,
            });

            // 2. Get Video Track
            const videoTrack = await this._input.getPrimaryVideoTrack();
            if (!videoTrack) {
                Logger.warn('[MotionDetector] No video track found');
                return [];
            }
            if (!(await videoTrack.canDecode())) {
                Logger.warn('[MotionDetector] Browser cannot decode video track');
                return [];
            }

            // 3. Setup CanvasSink
            const sink = new CanvasSink(videoTrack, { width: processingWidth });

            // 4. Generate timestamps
            let startTimestamp = await videoTrack.getFirstTimestamp();
            try {
                const encodedSink = new EncodedPacketSink(videoTrack);
                const firstKeyPacket = await encodedSink.getFirstKeyPacket();
                if (firstKeyPacket) startTimestamp = firstKeyPacket.timestamp;
            } catch (e) {
                Logger.warn('[MotionDetector] getFirstKeyPacket failed, using getFirstTimestamp():', e);
            }
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

            // Current segment builder
            let currentSegment = null;

            for await (const result of iterator) {
                if (!this.isDetecting) break;

                const { canvas, timestamp } = result;
                if (!canvas) continue;

                // Get pixel data
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const currentData = imageData.data;

                // Compare
                let isMotion = false;
                let diff = 0;

                if (previousData) {
                    diff = this._calculateFrameDifference(previousData, currentData);
                    if (diff > threshold) {
                        isMotion = true;
                    }
                }

                if (isMotion) {
                    if (currentSegment) {
                        // Check if we can just extend the current segment
                        if (timestamp - currentSegment.end <= mergeGap) {
                            currentSegment.end = timestamp;
                            // Keep max score? or avg?
                            currentSegment.score = Math.max(currentSegment.score, diff);
                        } else {
                            // Gap too big, push current and start new
                            segments.push(currentSegment);
                            currentSegment = { start: timestamp, end: timestamp, score: diff };
                        }
                    } else {
                        // Start new segment (start time is technically previous timestamp to current, but approx current is fine)
                        // Or maybe (timestamp - interval) to be safer? Let's use current.
                        currentSegment = { start: timestamp, end: timestamp, score: diff };
                    }
                } else {
                    // No motion. 
                    // If we have a current segment, we don't close it immediately unless gap exceeds mergeGap.
                    // But here we are iterating. We only close if next motion is too far.
                    // Actually, if this frame has NO motion, we just continue. 
                    // The "Gap" logic handles the closure when the *next* motion frame arrives.
                    // BUT: if we reach end of video, we must close.
                }

                previousData = new Uint8ClampedArray(currentData);
                processedCount++;
                if (this.progressCallback) {
                    this.progressCallback(processedCount / timestamps.length);
                }
            }

            // Push last segment if exists
            if (currentSegment) {
                segments.push(currentSegment);
            }

            // 6. Filter by min duration
            const finalSegments = segments.filter(s => (s.end - s.start) >= minDuration);

            // Fix start/end times approx? 
            // Frame difference is between T-1 and T. So motion happened in (T-interval, T).
            // So start should probably be start - interval?
            // Let's adjust slightly for better UX.
            finalSegments.forEach(s => {
                s.start = Math.max(0, s.start - interval);
            });

            Logger.log(`[MotionDetector] Finished. Found ${finalSegments.length} segments.`);
            return finalSegments;

        } catch (e) {
            Logger.error('[MotionDetector] Detection error:', e);
            return [];
        } finally {
            this.isDetecting = false;
            this._disposeInput();
        }
    }

    cancel() {
        this.isDetecting = false;
        this._disposeInput();
    }

    /**
     * Dispose the MediaBunny Input to release decoded video memory.
     * @private
     */
    _disposeInput() {
        if (this._input && typeof this._input.dispose === 'function') {
            try {
                this._input.dispose();
            } catch (e) {
                Logger.warn('[MotionDetector] Error disposing input:', e);
            }
        }
        this._input = null;
    }

    _calculateFrameDifference(data1, data2) {
        if (data1.length !== data2.length) return 1.0;
        let totalDiff = 0;
        const len = data1.length;
        for (let i = 0; i < len; i += 4) {
            const rDiff = Math.abs(data1[i] - data2[i]);
            const gDiff = Math.abs(data1[i + 1] - data2[i + 1]);
            const bDiff = Math.abs(data1[i + 2] - data2[i + 2]);
            totalDiff += (rDiff + gDiff + bDiff);
        }
        const numPixels = len / 4;
        const maxTotalDiff = numPixels * 765;
        return totalDiff / maxTotalDiff;
    }

}

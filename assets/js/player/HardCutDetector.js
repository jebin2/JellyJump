import { Logger } from "../utils/Logger.js";
import { MediaBunny } from "../core/MediaBunny.js";

const { Input, BlobSource, UrlSource, ALL_FORMATS, CanvasSink } = MediaBunny;

/**
 * Detects hard cuts (scene changes) in a video using histogram-based comparison.
 * Inspired by PySceneDetect's ContentDetector algorithm for accurate hardcut detection.
 * 
 * Uses a combination of:
 * - HSV color histogram comparison
 * - Edge detection (Sobel-like gradients)
 * - Minimum scene length filtering
 * - Adaptive thresholding via two-pass detection
 */
export class HardCutDetector {
    constructor() {
        this.isDetecting = false;
        this.progressCallback = null; // (progress: number) => void
        this.lastStats = null; // Store statistics from last detection
        this._input = null; // Track for cleanup
    }

    /**
     * Start detecting hard cuts with adaptive or fixed threshold.
     * @param {string|File|Blob} resource - Video URL or File/Blob
     * @param {Object} options - Configuration options
     * @param {boolean} [options.adaptiveMode=true] - Use two-pass adaptive thresholding
     * @param {number} [options.sensitivity=2] - Sensitivity level: 1=High, 2=Medium, 3=Low (maps to stddev multiplier)
     * @param {number} [options.threshold=30.0] - Fixed threshold (used when adaptiveMode=false)
     * @param {number} [options.minSceneLen=10] - Minimum frames between cuts
     * @param {number} [options.sampleRate=0.04] - Seconds between frame checks
     * @param {number} [options.width=64] - Processing width for performance
     * @returns {Promise<Array<{timestamp: number, confidence: number}>>} - Cuts with confidence scores
     */
    async detect(resource, options = {}) {
        if (this.isDetecting) {
            this.cancel();
        }

        this.isDetecting = true;

        // Options
        const adaptiveMode = options.adaptiveMode ?? true;
        const sensitivity = options.sensitivity ?? 2; // 1=High, 2=Medium, 3=Low
        const fixedThreshold = options.threshold ?? 30.0;
        const minSceneLen = options.minSceneLen ?? 10;
        const interval = options.sampleRate ?? 0.04;
        const processingWidth = options.width ?? 64;

        // Sensitivity maps to stddev multiplier: Low sensitivity = higher multiplier = fewer cuts
        const sensitivityMultipliers = { 1: 1.5, 2: 2.0, 3: 2.5 };
        const multiplier = sensitivityMultipliers[sensitivity] ?? 2.0;

        Logger.log('[HardCutDetector] Starting detection...', {
            adaptiveMode, sensitivity, multiplier, minSceneLen, interval
        });

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
                Logger.warn('[HardCutDetector] No video track found');
                return [];
            }

            if (!(await videoTrack.canDecode())) {
                Logger.warn('[HardCutDetector] Browser cannot decode video track');
                return [];
            }

            // 3. Generate timestamps
            const startTimestamp = await videoTrack.getFirstTimestamp();
            const duration = await videoTrack.computeDuration();
            const endTimestamp = startTimestamp + duration;

            const timestamps = [];
            for (let t = startTimestamp; t < endTimestamp; t += interval) {
                timestamps.push(t);
            }

            if (adaptiveMode) {
                // TWO-PASS DETECTION
                return await this._detectTwoPass(
                    videoTrack, timestamps, processingWidth, minSceneLen, multiplier
                );
            } else {
                // SINGLE-PASS with fixed threshold
                return await this._detectSinglePass(
                    videoTrack, timestamps, processingWidth, minSceneLen, fixedThreshold
                );
            }

        } catch (e) {
            Logger.error('[HardCutDetector] Detection error:', e);
            return [];
        } finally {
            this.isDetecting = false;
            this._disposeInput();
        }
    }

    /**
     * Two-pass adaptive detection:
     * Pass 1: Collect content score statistics (coarse sampling)
     * Pass 2: Detect cuts using adaptive threshold = mean + (multiplier * stddev)
     */
    async _detectTwoPass(videoTrack, timestamps, processingWidth, minSceneLen, multiplier) {
        const cuts = [];

        // PASS 1: Coarse analysis to collect statistics
        // Use every 3rd frame for speed (~33% of frames)
        const coarseTimestamps = timestamps.filter((_, i) => i % 3 === 0);

        Logger.log(`[HardCutDetector] Pass 1: Analyzing ${coarseTimestamps.length} frames for statistics...`);

        const sink1 = new CanvasSink(videoTrack, { width: processingWidth });
        const iterator1 = sink1.canvasesAtTimestamps(coarseTimestamps);

        const contentScores = [];
        let previousHistogram = null;
        let previousEdges = null;
        let passOneCount = 0;

        for await (const result of iterator1) {
            if (!this.isDetecting) break;

            const { canvas } = result;
            if (!canvas) continue;

            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            const currentHistogram = this._computeHSVHistogram(imageData);
            const currentEdges = this._computeEdgeMagnitude(imageData, canvas.width, canvas.height);

            if (previousHistogram && previousEdges !== null) {
                const histDiff = this._compareHistograms(previousHistogram, currentHistogram);
                const edgeDiff = Math.abs(currentEdges - previousEdges);
                const contentScore = (histDiff * 0.7 + edgeDiff * 0.3) * 100;
                contentScores.push(contentScore);
            }

            previousHistogram = currentHistogram;
            previousEdges = currentEdges;
            passOneCount++;

            // Progress: 0-40% for pass 1
            if (this.progressCallback) {
                this.progressCallback(0.4 * (passOneCount / coarseTimestamps.length));
            }
        }

        // Calculate statistics
        const mean = contentScores.reduce((a, b) => a + b, 0) / contentScores.length;
        const variance = contentScores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / contentScores.length;
        const stddev = Math.sqrt(variance);
        const adaptiveThreshold = mean + (multiplier * stddev);

        // Store stats for debugging/UI
        this.lastStats = {
            mean: mean.toFixed(2),
            stddev: stddev.toFixed(2),
            threshold: adaptiveThreshold.toFixed(2),
            multiplier,
            sampleCount: contentScores.length
        };

        Logger.log(`[HardCutDetector] Pass 1 Complete - Mean: ${mean.toFixed(2)}, StdDev: ${stddev.toFixed(2)}, Adaptive Threshold: ${adaptiveThreshold.toFixed(2)}`);

        // PASS 2: Fine-grained detection with adaptive threshold
        Logger.log(`[HardCutDetector] Pass 2: Detecting cuts with threshold ${adaptiveThreshold.toFixed(2)}...`);

        const sink2 = new CanvasSink(videoTrack, { width: processingWidth });
        const iterator2 = sink2.canvasesAtTimestamps(timestamps);

        previousHistogram = null;
        previousEdges = null;
        let processedCount = 0;
        let lastCutFrame = -minSceneLen;

        for await (const result of iterator2) {
            if (!this.isDetecting) break;

            const { canvas, timestamp } = result;
            if (!canvas) continue;

            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            const currentHistogram = this._computeHSVHistogram(imageData);
            const currentEdges = this._computeEdgeMagnitude(imageData, canvas.width, canvas.height);

            if (previousHistogram && previousEdges !== null) {
                const histDiff = this._compareHistograms(previousHistogram, currentHistogram);
                const edgeDiff = Math.abs(currentEdges - previousEdges);
                const contentScore = (histDiff * 0.7 + edgeDiff * 0.3) * 100;

                const framesSinceLastCut = processedCount - lastCutFrame;

                if (contentScore > adaptiveThreshold && framesSinceLastCut >= minSceneLen) {
                    // Calculate confidence: how far above threshold (normalized 0-1)
                    const confidence = Math.min((contentScore - adaptiveThreshold) / adaptiveThreshold, 1.0);

                    Logger.log(`[HardCutDetector] Cut at ${timestamp.toFixed(2)}s (Score: ${contentScore.toFixed(2)}, Confidence: ${(confidence * 100).toFixed(0)}%)`);
                    cuts.push({ timestamp, confidence, score: contentScore });
                    lastCutFrame = processedCount;
                }
            }

            previousHistogram = currentHistogram;
            previousEdges = currentEdges;
            processedCount++;

            // Progress: 40-100% for pass 2
            if (this.progressCallback) {
                this.progressCallback(0.4 + 0.6 * (processedCount / timestamps.length));
            }
        }

        Logger.log(`[HardCutDetector] Finished. Found ${cuts.length} cuts with adaptive threshold.`);

        // Return just timestamps for backward compatibility, but with confidence info accessible
        return cuts.map(c => c.timestamp);
    }

    /**
     * Single-pass detection with fixed threshold (original behavior)
     */
    async _detectSinglePass(videoTrack, timestamps, processingWidth, minSceneLen, threshold) {
        const cuts = [];

        const sink = new CanvasSink(videoTrack, { width: processingWidth });
        const iterator = sink.canvasesAtTimestamps(timestamps);

        let previousHistogram = null;
        let previousEdges = null;
        let processedCount = 0;
        let lastCutFrame = -minSceneLen;

        for await (const result of iterator) {
            if (!this.isDetecting) break;

            const { canvas, timestamp } = result;
            if (!canvas) continue;

            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            const currentHistogram = this._computeHSVHistogram(imageData);
            const currentEdges = this._computeEdgeMagnitude(imageData, canvas.width, canvas.height);

            if (previousHistogram && previousEdges !== null) {
                const histDiff = this._compareHistograms(previousHistogram, currentHistogram);
                const edgeDiff = Math.abs(currentEdges - previousEdges);
                const contentScore = (histDiff * 0.7 + edgeDiff * 0.3) * 100;

                const framesSinceLastCut = processedCount - lastCutFrame;

                if (contentScore > threshold && framesSinceLastCut >= minSceneLen) {
                    Logger.log(`[HardCutDetector] Cut at ${timestamp.toFixed(2)}s (Score: ${contentScore.toFixed(2)})`);
                    cuts.push(timestamp);
                    lastCutFrame = processedCount;
                }
            }

            previousHistogram = currentHistogram;
            previousEdges = currentEdges;
            processedCount++;

            if (this.progressCallback) {
                this.progressCallback(processedCount / timestamps.length);
            }
        }

        Logger.log(`[HardCutDetector] Finished. Found ${cuts.length} cuts with fixed threshold.`);
        return cuts;
    }

    /**
     * Get statistics from the last adaptive detection run
     * @returns {Object|null} Stats object with mean, stddev, threshold, multiplier
     */
    getLastStats() {
        return this.lastStats;
    }

    /**
     * Compute HSV histogram for color-based comparison.
     * Uses 12 hue bins, 5 saturation bins, 5 value bins = 300 bins total.
     * This is much more robust to lighting changes than raw RGB comparison.
     */
    _computeHSVHistogram(imageData) {
        const data = imageData.data;
        const HUE_BINS = 12;
        const SAT_BINS = 5;
        const VAL_BINS = 5;

        const histogram = new Float32Array(HUE_BINS * SAT_BINS * VAL_BINS);
        const numPixels = data.length / 4;

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i] / 255;
            const g = data[i + 1] / 255;
            const b = data[i + 2] / 255;

            // Convert RGB to HSV
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const delta = max - min;

            // Hue
            let h = 0;
            if (delta !== 0) {
                if (max === r) {
                    h = ((g - b) / delta) % 6;
                } else if (max === g) {
                    h = (b - r) / delta + 2;
                } else {
                    h = (r - g) / delta + 4;
                }
                h = h / 6;
                if (h < 0) h += 1;
            }

            // Saturation
            const s = max === 0 ? 0 : delta / max;

            // Value
            const v = max;

            // Quantize to bins
            const hBin = Math.min(Math.floor(h * HUE_BINS), HUE_BINS - 1);
            const sBin = Math.min(Math.floor(s * SAT_BINS), SAT_BINS - 1);
            const vBin = Math.min(Math.floor(v * VAL_BINS), VAL_BINS - 1);

            const binIndex = hBin * SAT_BINS * VAL_BINS + sBin * VAL_BINS + vBin;
            histogram[binIndex]++;
        }

        // Normalize histogram
        for (let i = 0; i < histogram.length; i++) {
            histogram[i] /= numPixels;
        }

        return histogram;
    }

    /**
     * Compare two histograms using chi-squared distance.
     * Returns a value between 0 (identical) and 1 (completely different).
     */
    _compareHistograms(hist1, hist2) {
        let distance = 0;
        const eps = 1e-10; // Avoid division by zero

        for (let i = 0; i < hist1.length; i++) {
            const sum = hist1[i] + hist2[i];
            if (sum > eps) {
                const diff = hist1[i] - hist2[i];
                distance += (diff * diff) / sum;
            }
        }

        // Chi-squared distance is already naturally bounded, but we normalize
        // to approximately 0-1 range for combining with edge score
        return Math.min(distance / 2, 1.0);
    }

    /**
     * Compute average edge magnitude using Sobel-like gradient.
     * Higher values indicate more edges/detail in the frame.
     */
    _computeEdgeMagnitude(imageData, width, height) {
        const data = imageData.data;
        let totalMagnitude = 0;
        let pixelCount = 0;

        // Convert to grayscale and compute gradients
        const gray = new Float32Array(width * height);
        for (let i = 0; i < data.length; i += 4) {
            const pixelIndex = i / 4;
            // Luminance formula
            gray[pixelIndex] = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
        }

        // Simple Sobel-like edge detection
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;

                // Horizontal gradient (Gx)
                const gx =
                    -gray[idx - width - 1] + gray[idx - width + 1] +
                    -2 * gray[idx - 1] + 2 * gray[idx + 1] +
                    -gray[idx + width - 1] + gray[idx + width + 1];

                // Vertical gradient (Gy)
                const gy =
                    -gray[idx - width - 1] - 2 * gray[idx - width] - gray[idx - width + 1] +
                    gray[idx + width - 1] + 2 * gray[idx + width] + gray[idx + width + 1];

                // Magnitude
                const magnitude = Math.sqrt(gx * gx + gy * gy);
                totalMagnitude += magnitude;
                pixelCount++;
            }
        }

        return pixelCount > 0 ? totalMagnitude / pixelCount : 0;
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
                Logger.warn('[HardCutDetector] Error disposing input:', e);
            }
        }
        this._input = null;
    }
}

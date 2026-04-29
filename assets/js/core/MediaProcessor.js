import { Logger } from "../utils/Logger.js";
import { MediaBunny } from './MediaBunny.js';
import { getMetadata as getProcessingMetadata, getVideoStats as getProcessingVideoStats } from '../processing/metadata/MetadataService.js';
import { createMediaBunnyInput, AUDIO_BITRATE_BPS } from '../processing/shared/InputFactory.js';
import { createGif as createGifMedia } from '../processing/export/GifService.js';
import { processHls as processHlsMedia } from '../processing/hls/HlsService.js';
import { losslessTrim as losslessTrimMedia } from '../processing/trim/TrimService.js';
import { reverseVideo as reverseProcessedVideo, changeVideoSpeed as changeProcessedVideoSpeed } from '../processing/speed/SpeedService.js';
import {
    extractTrackStreamCopy as extractProcessedTrackStreamCopy,
    extractTrackWithSpeed as extractProcessedTrackWithSpeed
} from '../processing/tracks/TrackExtractionService.js';
import { createSlideshowVideo as createSlideshowVideoMedia } from '../processing/slideshow/SlideshowService.js';
import { merge as mergeVideosMedia } from '../processing/merge/MergeService.js';
import { buildFrameProcessor as buildMediaFrameProcessor, applyChromaKey as applyMediaChromaKey } from '../processing/frame/FrameProcessorService.js';

/**
 * MediaProcessor
 * Core service for handling video format conversion and optimization.
 */
export class MediaProcessor {
    /**
     * Calculate target bitrate based on quality and resolution
     * @param {number|string} quality - 0-100 or 'high'/'medium'/'low'
     * @param {number} pixelCount - Width * Height
     * @param {number} [sourceBitrate] - Optional actual bitrate of the source
     * @returns {number} Bitrate in bits per second
     */
    static _getBitrate(quality, pixelCount, sourceBitrate = 0) {
        let q = 100;
        if (typeof quality === 'number') {
            q = quality;
        } else if (quality === 'high') {
            q = 100;
        } else if (quality === 'medium') {
            q = 60;
        } else if (quality === 'low') {
            q = 30;
        }

        let targetBitrate;
        if (sourceBitrate > 0) {
            // If we have source bitrate, 100% quality means matching the original bitrate
            targetBitrate = sourceBitrate * (q / 100);
        } else {
            // Fallback: resolution-based scaling (4.0 Mbps for 720p reference)
            const basePixels = 1280 * 720;
            const standardBitrate = 4000000;
            const pixelFactor = pixelCount > 0 ? pixelCount / basePixels : 1;
            targetBitrate = standardBitrate * pixelFactor * (q / 100);
        }

        // Return target bitrate exactly as calculated by the quality percentage
        return Math.floor(targetBitrate);
    }



    /**
     * Process video (transcode, trim, resize, crop, etc.)
     * @param {Object} options
     * @param {Blob|File} options.source
     * @param {string} options.format - 'mp4', 'webm', 'mov'
     * @param {number} options.quality - 0-100
     * @param {Object} [options.trim] - { start, end } in seconds
     * @param {Object} [options.resolution] - { width, height }
     * @param {Object} [options.crop] - { left, top, width, height } in pixels
     * @param {Object} [options.removeBackgroundOptions] - { colors, bgType, bgColor }
     * @param {Function} [options.onProgress]
     * @returns {Promise<Blob>}
     */
    static async process({ source, format = 'mp4', quality = 'high', resolution = null, trim = null, crop = null, removeBackgroundOptions = null, watermark = null, blur = null, rotate = 0, flip = null, onProgress }) {
        Logger.log('[MediaProcessor] Starting processing...', { format, quality, resolution, trim, crop, removeBackgroundOptions, watermark, blur });

        let conversion = null;
        let videoUrl = null;
        let input = null;
        let output = null;
        // Normalize watermark input to items array
        let watermarkItems = null;
        if (watermark) {
            watermarkItems = (watermark.items && Array.isArray(watermark.items))
                ? watermark.items
                : [{ ...watermark, startTime: -Infinity, endTime: Infinity }];
        }

        const watermarkImages = new Map();

        // If removing background, we need to handle it via the process callback
        // and potentially force transcoding to a format that supports alpha (WebM) if transparent
        if (removeBackgroundOptions && removeBackgroundOptions.bgType === 'transparent') {
            format = 'webm';
        }

        try {
            // Pre-load ALL watermark images
            if (watermarkItems) {
                for (const wm of watermarkItems) {
                    if (wm.type === 'image' && wm.image) {
                        try {
                            const img = await createImageBitmap(wm.image);
                            watermarkImages.set(wm.id || wm, img);
                        } catch (e) {
                            Logger.error('Failed to load watermark image:', e);
                        }
                    }
                }
            }

            input = MediaProcessor._createInput(source);

            // Get video track to determine dimensions if needed
            const videoTrack = await input.getPrimaryVideoTrack();
            if (!videoTrack) throw new Error('No video track found');

            const originalWidth = videoTrack.displayWidth || videoTrack.codedWidth;
            const originalHeight = videoTrack.displayHeight || videoTrack.codedHeight;
            const nativeRotation = videoTrack.rotation || 0;

            // Get original bitrate to make quality settings "respective to video"
            let originalBitrate = 0;
            try {
                const stats = await videoTrack.computePacketStats(50);
                originalBitrate = stats.averageBitrate;
                Logger.log(`[MediaProcessor] Source analysis: ${originalWidth}x${originalHeight} (Rot: ${nativeRotation}°), ${(originalBitrate / 1000000).toFixed(2)} Mbps`);
            } catch (e) {
                Logger.warn('[MediaProcessor] Could not compute original bitrate, using resolution-based defaults.');
            }

            // Get first timestamp for blur/watermark time calculations
            let firstTimestamp = 0;
            if (blur || watermarkItems) {
                try {
                    firstTimestamp = await videoTrack.getFirstTimestamp();
                } catch (e) {
                    Logger.warn('[MediaProcessor] Could not get first timestamp for blur:', e);
                }
            }

            // Configure Output Format
            let outputFormat;
            if (format === 'gif') {
                return this.createGif({ source, trim, onProgress });
            } else if (format === 'webm') {
                outputFormat = new MediaBunny.WebMOutputFormat();
            } else if (format === 'mov') {
                outputFormat = new MediaBunny.MovOutputFormat();
            } else if (format === 'mkv') {
                outputFormat = new MediaBunny.MkvOutputFormat();
            } else {
                outputFormat = new MediaBunny.Mp4OutputFormat();
            }

            output = new MediaBunny.Output({
                format: outputFormat,
                target: new MediaBunny.BufferTarget()
            });

            // Configure Video Options
            const needsBitrateControl = (typeof quality === 'number' && quality < 100) ||
                (typeof quality === 'string' && quality !== 'high');
            const videoConfig = {};

            if (needsBitrateControl) {
                videoConfig.codec = (format === 'webm' || format === 'mkv') ? 'vp9' : 'avc';
                videoConfig.bitrate = this._getBitrate(quality, originalWidth * originalHeight, originalBitrate);
            }

            // Resolution / Rotation dimensions
            // Only set codec/bitrate when the user explicitly wants lower quality (e.g. convert).
            // For full-quality ops: leave unset so MediaBunny uses QUALITY_HIGH (quality-based
            // encoding) which is visually superior to a fixed bitrate target.
            // Crop/resize/process callback already force transcoding when present.
            // (MediaBunny docs: "If bitrate is set, transcoding will always happen")
            if (resolution) {
                videoConfig.width = resolution.width;
                videoConfig.height = resolution.height;
                videoConfig.fit = 'fill';
            } else if (rotate && Math.abs(rotate) % 180 === 90) {
                // If user rotates 90/270, swap the current display dimensions
                videoConfig.width = originalHeight;
                videoConfig.height = originalWidth;
                videoConfig.fit = 'fill';
            }

            // Crop
            if (crop) {
                videoConfig.crop = {
                    left: Math.round(crop.left),
                    top: Math.round(crop.top),
                    width: Math.round(crop.width),
                    height: Math.round(crop.height)
                };
            }

            if (removeBackgroundOptions || watermarkItems || blur || needsRotation) {
                videoConfig.process = MediaProcessor._buildFrameProcessor({
                    removeBackgroundOptions, watermarkItems, watermarkImages,
                    blur, rotate, flip, nativeRotation,
                    originalWidth, originalHeight, firstTimestamp,
                    rotatedOutputWidth: videoConfig.width,
                    rotatedOutputHeight: videoConfig.height
                });
            }

            // Initialize Conversion
            const conversionOptions = {
                input: input,
                output: output,
                video: videoConfig
            };

            if (trim) {
                conversionOptions.trim = trim;
            }

            conversion = await MediaBunny.Conversion.init(conversionOptions);

            if (onProgress) {
                conversion.onProgress = onProgress;
            }

            await conversion.execute();

            return new Blob([output.target.buffer], { type: `video/${format}` });
        } finally {
            // CRITICAL: Clean up all MediaBunny resources to prevent memory leaks
            if (conversion && typeof conversion.dispose === 'function') {
                try {
                    conversion.dispose();
                } catch (e) {
                    Logger.warn('Error disposing conversion:', e);
                }
            }

            if (output && typeof output.dispose === 'function') {
                try {
                    output.dispose();
                } catch (e) {
                    Logger.warn('Error disposing output:', e);
                }
            }

            if (input && typeof input.dispose === 'function') {
                try {
                    input.dispose();
                } catch (e) {
                    Logger.warn('Error disposing input:', e);
                }
            }

            // Dispose watermark ImageBitmaps
            for (const img of watermarkImages.values()) {
                if (img && typeof img.close === 'function') img.close();
            }
            watermarkImages.clear();

            conversion = null;
        }
    }

    /**
     * Lossless trim using packet-level APIs — no re-encoding.
     * Snaps trim start to the nearest keyframe at or before the requested start time.
     * @param {Object} options
     * @param {Blob|File|string} options.source
     * @param {{ start: number, end: number }} options.trim - In seconds
     * @param {Function} [options.onProgress]
     * @returns {Promise<Blob>} MP4 blob
     */
    static _createInput(source) {
        return createMediaBunnyInput(source);
    }


    static async losslessTrim({ source, trim, onProgress }) {
        return losslessTrimMedia({ source, trim, onProgress });
    }

    /**
     * Get video packet statistics
     * @param {Blob|File} source
     * @param {number} count - Number of packets to analyze
     * @returns {Promise<Object>}
     */
    static async getVideoStats(source, count = 50) {
        return getProcessingVideoStats(source, count);
    }



    /**
     * Get formatted metadata for caching
     * Returns videoInfo and audioInfo objects ready to be stored on playlist items
     * @param {Blob|File|string} source 
     * @returns {Promise<{videoInfo: Object|null, audioInfo: Object|null, duration: number, videoTracks: Array, audioTracks: Array}>}
     */
    static async getMetadata(source) {
        return getProcessingMetadata(source);
    }

    /**
     * Extract a specific track
     * @param {Object} options
     * @param {Blob|File} options.source
     * @param {number} options.trackIndex - Index of the track in its type list (0-based)
     * @param {string} options.trackType - 'video' or 'audio'
     * @param {string} options.format - 'mp4' (video) or 'm4a'/'mp3' (audio)
     * @param {number} [options.speed=1] - Playback speed multiplier (0.25 to 2)
     * @param {Function} [options.onProgress]
     * @returns {Promise<Blob>}
     */
    static async extractTrack({ source, trackIndex, trackType, format, speed = 1, onProgress }) {
        // Clamp speed to valid range
        const clampedSpeed = Math.max(0.25, Math.min(2, speed));

        // FLAC requires re-encoding (lossless, incompatible with stream copy from other codecs)
        // For all other formats at speed=1, use fast stream copy
        if (clampedSpeed === 1 && format !== 'flac') {
            return this._extractTrackStreamCopy({ source, trackIndex, trackType, format, onProgress });
        } else {
            return this._extractTrackWithSpeed({ source, trackIndex, trackType, format, speed: clampedSpeed, onProgress });
        }
    }

    /**
     * Extract track using stream copy (fast, no re-encoding)
     * @private
     */
    static async _extractTrackStreamCopy({ source, trackIndex, trackType, format, onProgress }) {
        return extractProcessedTrackStreamCopy({ source, trackIndex, trackType, format, onProgress });
    }

    /**
     * Convert a video to HLS format.
     * Returns a Map<string, ArrayBuffer> of all files: master.m3u8, playlist-N.m3u8, segment-N-M.ts
     * @param {Object} options
     * @param {Blob|File|string} options.source
     * @param {number} [options.quality] - 1-100, 100 = original bitrate
     * @param {Function} [options.onProgress]
     * @returns {Promise<Map<string, ArrayBuffer>>}
     */
    static async processHls({ source, quality = 100, onProgress }) {
        return processHlsMedia({ source, quality, onProgress });
    }

    /**
     * Extract track with speed adjustment (requires re-encoding)
     * @private
     */
    static async _extractTrackWithSpeed({ source, trackIndex, trackType, format, speed, onProgress }) {
        return extractProcessedTrackWithSpeed({ source, trackIndex, trackType, format, speed, onProgress });
    }


    /**
     * Create GIF from video segment using gif.js library
     * Extracts frames from video using Canvas API and encodes to animated GIF
     * 
     * @param {Object} options
     * @param {Blob|File} options.input - Source video file
     * @param {number} options.startTime - Start time in seconds
     * @param {number} options.duration - Duration in seconds
     * @param {number} options.fps - Target frame rate
     * @param {number} options.width - Target width
     * @param {number} options.height - Target height
     * @param {number} options.quality - Quality (40-100)
     * @param {Function} [options.onProgress] - Progress callback
     * @returns {Promise<Blob>} Actual GIF blob
     */
    static async createGif(options) {
        return createGifMedia(options);
    }
    /**
     * Reverse video playback using MediaBunny's samplesAtTimestamps for efficiency.
     * Uses VideoSampleSink to efficiently retrieve frames in reverse order,
     * letting MediaBunny handle the seeking/decoding optimizations internally.
     * 
     * @param {Object} options
     * @param {Blob|File} options.source
     * @param {boolean} options.includeAudio
     * @param {number} [options.speed=1] - Playback speed multiplier (0.25 to 2)
     * @param {Function} [options.onProgress]
     * @returns {Promise<Blob>}
     */
    static async reverseVideo({ source, includeAudio = false, speed = 1, onProgress }) {
        return reverseProcessedVideo({ source, includeAudio, speed, onProgress });
    }

    /**
     * Change video speed (slow motion / fast forward)
     * @param {Object} options
     * @param {Blob|File} options.source
     * @param {number} options.speed - Speed multiplier (0.1 to 10)
     * @param {Function} [options.onProgress]
     * @returns {Promise<Blob>}
     */
    static async changeVideoSpeed({ source, speed = 1, onProgress, includeAudio = true }) {
        return changeProcessedVideoSpeed({ source, speed, onProgress, includeAudio });
    }


    static async createSlideshowVideo(options) {
        return createSlideshowVideoMedia(options);
    }

    static _buildFrameProcessor(options) {
        return buildMediaFrameProcessor(options);
    }

    static async merge(options) {
        return mergeVideosMedia(options);
    }

    static applyChromaKey(imageData, colors, bgType, bgColor) {
        return applyMediaChromaKey(imageData, colors, bgType, bgColor);
    }


}

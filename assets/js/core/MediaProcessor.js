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
import { process as transcodeMedia } from '../processing/transcode/TranscodeService.js';

/**
 * MediaProcessor
 * Core service for handling video format conversion and optimization.
 */
export class MediaProcessor {



    static async process(options) {
        return transcodeMedia(options);
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

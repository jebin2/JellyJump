import { Logger } from "../shared/utils/Logger.js";
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
import { combineAudioVideo as combineAudioVideoMedia } from '../processing/combine/CombineAVService.js';
import { buildFrameProcessor as buildMediaFrameProcessor, applyChromaKey as applyMediaChromaKey } from '../processing/frame/FrameProcessorService.js';
import { process as transcodeMedia } from '../processing/transcode/TranscodeService.js';
import { canUseWorker, runInWorker } from '../processing/worker/WorkerClient.js';

// Above this, a job is too big to be quietly rerun on the main thread: doing so
// locks the UI for the entire encode (hours, for a multi-GB payload) and tends
// to take the tab's memory with it.
const INLINE_FALLBACK_MAX_BYTES = 64 * 1024 * 1024;

/** Total bytes of the media inputs in an options bag, across op shapes. */
function payloadBytes(options) {
    const sources = [options?.blob, options?.source, ...(options?.inputs ?? [])];
    let total = 0;
    for (const s of sources) {
        if (s && typeof s.size === 'number') total += s.size;
    }
    return total;
}

/**
 * Run an operation in the media worker when available (browser), falling back
 * to the main thread only when that is actually safe. Genuine processing
 * errors are rethrown, not retried.
 * On desktop the inline path is always used: processing there goes through
 * @mediabunny/server's FFmpeg threads, which need Node in the renderer.
 *
 * A worker that dies partway through a large job has almost certainly run out
 * of memory. Rerunning it inline would then freeze the UI for the whole encode
 * and likely OOM the tab as well, so large jobs fail loudly instead.
 */
async function dispatch(op, options, inlineFn) {
    if (!canUseWorker()) {
        return inlineFn(options);
    }
    try {
        return await runInWorker(op, options);
    } catch (error) {
        if (!error.isWorkerCrash) throw error;

        const bytes = payloadBytes(options);
        if (error.workerNeverStarted || bytes <= INLINE_FALLBACK_MAX_BYTES) {
            Logger.warn(`[MediaProcessor] Worker unavailable for ${op}, running on main thread:`, error.message);
            return inlineFn(options);
        }

        const mb = (bytes / 1048576).toFixed(0);
        Logger.error(`[MediaProcessor] Worker died during ${op} on a ${mb} MB payload — not retrying on the main thread`);
        throw new Error(
            `The media worker stopped while processing ${mb} MB, most likely out of memory. ` +
            `Retrying on the main thread would freeze the app, so the operation was stopped.`
        );
    }
}

/**
 * MediaProcessor
 * Core service for handling video format conversion and optimization.
 */
export class MediaProcessor {



    static async process(options) {
        // GIF creation drives a DOM <video> element and must stay on the main thread
        if (options.format === 'gif') {
            return transcodeMedia(options);
        }
        return dispatch('process', options, transcodeMedia);
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

        if (clampedSpeed === 1) {
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
        return dispatch('processHls', { source, quality, onProgress }, processHlsMedia);
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
        const options = { source, includeAudio, speed, onProgress };
        // Audio processing uses Web Audio (AudioBuffer/OfflineAudioContext),
        // which is not available in workers on all browsers — keep it inline.
        if (includeAudio) {
            return reverseProcessedVideo(options);
        }
        return dispatch('reverseVideo', options, reverseProcessedVideo);
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
        const options = { source, speed, onProgress, includeAudio };
        // See reverseVideo: Web Audio-dependent paths stay on the main thread.
        if (includeAudio) {
            return changeProcessedVideoSpeed(options);
        }
        return dispatch('changeVideoSpeed', options, changeProcessedVideoSpeed);
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

    static async combineAudioVideo(options) {
        return combineAudioVideoMedia(options);
    }

    static applyChromaKey(imageData, colors, bgType, bgColor) {
        return applyMediaChromaKey(imageData, colors, bgType, bgColor);
    }

    /**
     * Encrypt a file into a JJC4 carrier MP4 (heavy: synthesizes and encodes
     * the carrier video). Runs in the media worker in the browser.
     * @param {Blob} blob
     * @param {string} password
     * @param {Object} [opts] - { filename, mimeType, hint, onProgress, signal }
     * @returns {Promise<Blob>}
     */
    static async encryptPlatform(blob, password, opts = {}) {
        const { onProgress, signal, ...rest } = opts;
        return dispatch(
            'encryptPlatform',
            { blob, password, opts: rest, onProgress, signal },
            async () => {
                const { PlatformCrypto } = await import('../shared/utils/PlatformCrypto.js');
                return PlatformCrypto.encrypt(blob, password, opts);
            }
        );
    }

    /**
     * Decrypt a JJC4 carrier MP4 (heavy: decodes every carrier frame).
     * Runs in the media worker in the browser.
     * @returns {Promise<{blob: Blob, metadata: Object}>}
     */
    static async decryptPlatform(blob, password, onProgress, signal) {
        return dispatch(
            'decryptPlatform',
            { blob, password, onProgress, signal },
            async () => {
                const { PlatformCrypto } = await import('../shared/utils/PlatformCrypto.js');
                return PlatformCrypto.decrypt(blob, password, onProgress, signal);
            }
        );
    }


}

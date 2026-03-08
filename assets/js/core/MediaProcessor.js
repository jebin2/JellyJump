import { Logger } from "../utils/Logger.js";
import { MediaBunny } from './MediaBunny.js';
import GIF from '../lib/gif.js';

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

            let inputSource;
            if (typeof source === 'string') {
                inputSource = new MediaBunny.UrlSource(source);
            } else {
                inputSource = new MediaBunny.BlobSource(source);
            }
            input = new MediaBunny.Input({
                source: inputSource,
                formats: MediaBunny.ALL_FORMATS
            });

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

            // Only attach a process callback when frame manipulation is needed.
            // Without it, MediaBunny can stream-copy video data for lossless trim/remux.
            const needsRotation = rotate || flip || nativeRotation !== 0;
            if (removeBackgroundOptions || watermarkItems || blur || needsRotation) {
                const useOffscreen = typeof OffscreenCanvas !== 'undefined';
                let canvas = null;
                let ctx = null;

                videoConfig.process = (sample) => {
                    const width = sample.codedWidth;
                    const height = sample.codedHeight;

                    // When rotation/flip is active, use configured output dimensions.
                    // Otherwise use coded dimensions to preserve existing behavior.
                    const outputWidth = needsRotation ? (videoConfig.width || width) : width;
                    const outputHeight = needsRotation ? (videoConfig.height || height) : height;

                    if (!canvas || canvas.width !== outputWidth || canvas.height !== outputHeight) {
                        if (useOffscreen) {
                            canvas = new OffscreenCanvas(outputWidth, outputHeight);
                        } else {
                            canvas = document.createElement('canvas');
                            canvas.width = outputWidth;
                            canvas.height = outputHeight;
                        }
                        ctx = canvas.getContext('2d', { willReadFrequently: true });
                    }

                    ctx.clearRect(0, 0, outputWidth, outputHeight);

                    if (needsRotation) {
                        // Apply rotation/flip transforms
                        ctx.save();
                        ctx.translate(outputWidth / 2, outputHeight / 2);

                        if (rotate) {
                            ctx.rotate((rotate * Math.PI) / 180);
                        }

                        if (flip) {
                            ctx.scale(flip.horizontal ? -1 : 1, flip.vertical ? -1 : 1);
                        }

                        if (nativeRotation) {
                            ctx.rotate((nativeRotation * Math.PI) / 180);
                        }

                        // Draw raw video centered — swap draw dims if native rotation is 90/270
                        let drawWidth, drawHeight;
                        if (Math.abs(nativeRotation) % 180 === 90) {
                            drawWidth = originalHeight;
                            drawHeight = originalWidth;
                        } else {
                            drawWidth = originalWidth;
                            drawHeight = originalHeight;
                        }

                        sample.draw(ctx, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
                        ctx.restore();
                    } else {
                        // No rotation — draw frame directly (preserves existing behavior)
                        ctx.clearRect(0, 0, width, height);
                        sample.draw(ctx, 0, 0, width, height);
                    }

                    // --- 1. Background Removal ---
                    if (removeBackgroundOptions) {
                        const imageData = ctx.getImageData(0, 0, width, height);
                        const { colors, bgType, bgColor } = removeBackgroundOptions;
                        MediaProcessor.applyChromaKey(imageData, colors, bgType, bgColor);
                        ctx.putImageData(imageData, 0, 0);
                    }

                    // --- 2. Watermarks ---
                    if (watermarkItems) {
                        const currentTimeWm = sample.timestamp - firstTimestamp;
                        for (const wm of watermarkItems) {
                            if (currentTimeWm < wm.startTime || currentTimeWm > wm.endTime) continue;

                            ctx.save();
                            ctx.globalAlpha = wm.opacity || 1.0;

                            if (wm.type === 'image') {
                                const img = watermarkImages.get(wm.id || wm);
                                if (img) {
                                    ctx.drawImage(img, wm.x, wm.y, wm.width, wm.height);
                                }
                            } else if (wm.type === 'text' && wm.text) {
                                ctx.font = wm.font;
                                ctx.fillStyle = wm.fillStyle;
                                ctx.strokeStyle = wm.strokeStyle;
                                ctx.lineWidth = wm.lineWidth;
                                ctx.textAlign = wm.textAlign;
                                ctx.textBaseline = wm.textBaseline;

                                ctx.strokeText(wm.text, wm.x, wm.y);
                                ctx.fillText(wm.text, wm.x, wm.y);
                            }

                            ctx.restore();
                        }
                    }

                    // --- 3. Blur Regions ---
                    if (blur && blur.areas && blur.areas.length > 0) {
                        const currentTime = sample.timestamp - firstTimestamp;
                        const intensity = blur.intensity || 15;

                        for (const area of blur.areas) {
                            if (currentTime < area.startTime || currentTime > area.endTime) continue;

                            // Scale from original video dimensions to coded dimensions
                            const sx = width / originalWidth;
                            const sy = height / originalHeight;

                            const bx = area.x * sx;
                            const by = area.y * sy;
                            const bw = area.width * sx;
                            const bh = area.height * sy;

                            ctx.save();
                            ctx.beginPath();
                            ctx.rect(bx, by, bw, bh);
                            ctx.clip();
                            ctx.filter = `blur(${intensity}px)`;
                            ctx.drawImage(canvas, 0, 0, width, height);
                            ctx.restore();
                        }
                    }

                    return canvas;
                };
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
     * Get video packet statistics
     * @param {Blob|File} source
     * @param {number} count - Number of packets to analyze
     * @returns {Promise<Object>}
     */
    static async getVideoStats(source, count = 50) {
        const blobSource = new MediaBunny.BlobSource(source);
        const input = new MediaBunny.Input({
            source: blobSource,
            formats: MediaBunny.ALL_FORMATS
        });

        try {
            const videoTrack = await input.getPrimaryVideoTrack();
            if (!videoTrack) return null;

            return await videoTrack.computePacketStats(count);
        } finally {
            if (input && typeof input.dispose === 'function') {
                try {
                    input.dispose();
                } catch (e) {
                    Logger.warn('Error disposing input in getVideoStats:', e);
                }
            }
        }
    }

    /**
     * Get track details from an input
     * @param {MediaBunny.Input} input
     * @returns {Promise<{video: Array, audio: Array}>}
     * @private
     */
    static async _getTrackDetails(input) {
        const videoTracks = await input.getVideoTracks();
        const audioTracks = await input.getAudioTracks();

        const formatTrackInfo = async (tracks) => {
            return Promise.all(tracks.map(async (track) => {
                const duration = await track.computeDuration();
                const codecString = await track.getCodecParameterString();
                return {
                    id: track.id,
                    type: track.type,
                    language: track.languageCode,
                    codec: track.codec,
                    codecString: codecString,
                    duration: duration,
                    width: track.width || track.displayWidth,
                    height: track.height || track.displayHeight,
                    displayWidth: track.displayWidth,
                    displayHeight: track.displayHeight,
                    codedWidth: track.codedWidth,
                    codedHeight: track.codedHeight,
                    rotation: track.rotation || 0,
                    channels: track.numberOfChannels,
                    sampleRate: track.sampleRate,
                    // Keep reference to track for internal use if needed (e.g. in getMetadata)
                    _track: track
                };
            }));
        };

        const videoTracksInfo = await formatTrackInfo(videoTracks);
        const audioTracksInfo = await formatTrackInfo(audioTracks);

        return {
            video: videoTracksInfo,
            audio: audioTracksInfo
        };
    }



    /**
     * Get formatted metadata for caching
     * Returns videoInfo and audioInfo objects ready to be stored on playlist items
     * @param {Blob|File|string} source 
     * @returns {Promise<{videoInfo: Object|null, audioInfo: Object|null, duration: number, videoTracks: Array, audioTracks: Array}>}
     */
    static async getMetadata(source) {
        let inputSource;
        if (typeof source === 'string') {
            inputSource = new MediaBunny.UrlSource(source);
        } else {
            inputSource = new MediaBunny.BlobSource(source);
        }

        const input = new MediaBunny.Input({
            source: inputSource,
            formats: MediaBunny.ALL_FORMATS
        });

        try {
            const { video, audio } = await this._getTrackDetails(input);

            let videoInfo = null;
            let audioInfo = null;
            let duration = 0;

            // Extract video metadata
            if (video && video.length > 0) {
                const videoTrackInfo = video[0]; // Use primary track
                const videoTrack = videoTrackInfo._track;
                duration = videoTrackInfo.duration;

                videoInfo = {
                    width: videoTrackInfo.width,
                    height: videoTrackInfo.height,
                    displayWidth: videoTrack.displayWidth,
                    displayHeight: videoTrack.displayHeight,
                    codedWidth: videoTrack.codedWidth,
                    codedHeight: videoTrack.codedHeight,
                    codec: videoTrackInfo.codec,
                    rotation: videoTrack.rotation || 0,
                    hasHDR: false // Computed on-demand if needed
                };

                // Calculate FPS and Bitrate
                try {
                    const stats = await videoTrack.computePacketStats(50);
                    videoInfo.fps = Math.round(stats.averagePacketRate);
                    videoInfo.bitrate = stats.averageBitrate;
                } catch (e) {
                    Logger.warn('Failed to compute packet stats:', e);
                    videoInfo.fps = 0;
                    videoInfo.bitrate = 0;
                }
            }

            // Extract audio metadata
            if (audio && audio.length > 0) {
                const audioTrackInfo = audio[0]; // Use primary track
                if (!duration) {
                    duration = audioTrackInfo.duration;
                }

                audioInfo = {
                    codec: audioTrackInfo.codec,
                    channels: audioTrackInfo.channels,
                    sampleRate: audioTrackInfo.sampleRate,
                    languageCode: audioTrackInfo.language
                };
            }

            // Prepare full track lists for return (removing internal references)
            const videoTracks = video.map(t => {
                const { _track, ...rest } = t;
                return rest;
            });
            const audioTracks = audio.map(t => {
                const { _track, ...rest } = t;
                return rest;
            });

            return { videoInfo, audioInfo, duration, videoTracks, audioTracks };
        } finally {
            // MediaBunny handles cleanup
            if (input && typeof input.dispose === 'function') {
                try {
                    input.dispose();
                } catch (e) {
                    Logger.warn('Error disposing input in getMetadata:', e);
                }
            }
        }
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

        // If speed is 1, use fast stream copy; otherwise re-encode with time-stretch
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
        const blobSource = source instanceof Blob ? new MediaBunny.BlobSource(source) : new MediaBunny.BufferSource(source);
        const input = new MediaBunny.Input({
            source: blobSource,
            formats: MediaBunny.ALL_FORMATS
        });

        let outputFormat;
        switch (format) {
            case 'mp4':
            case 'm4a':
                outputFormat = new MediaBunny.Mp4OutputFormat();
                break;
            case 'mp3':
                outputFormat = new MediaBunny.Mp3OutputFormat();
                break;
            case 'aac':
                outputFormat = new MediaBunny.AdtsOutputFormat();
                break;
            case 'wav':
                outputFormat = new MediaBunny.WavOutputFormat();
                break;
            default:
                throw new Error(`Unsupported format: ${format}`);
        }

        const output = new MediaBunny.Output({
            format: outputFormat,
            target: new MediaBunny.BufferTarget()
        });

        let conversion = null;

        try {
            const config = {
                input: input,
                output: output,
                video: (t, i) => {
                    const keep = trackType === 'video' && (i - 1) === trackIndex;
                    Logger.log(`[MediaProcessor] Video track ${i} (${t.codec}): ${keep ? 'KEEP' : 'DISCARD'}`);
                    return keep ? {} : { discard: true };
                },
                audio: (t, i) => {
                    const keep = trackType === 'audio' && (i - 1) === trackIndex;
                    Logger.log(`[MediaProcessor] Audio track ${i} (${t.codec}): ${keep ? 'KEEP' : 'DISCARD'}`);
                    return keep ? {} : { discard: true };
                }
            };

            conversion = await MediaBunny.Conversion.init(config);

            if (!conversion.isValid) {
                Logger.error('Conversion invalid:', conversion.discardedTracks);
                const reasons = conversion.discardedTracks.map(d => `${d.track.type}: ${d.reason}`).join(', ');
                throw new Error(`Cannot execute conversion: ${reasons}`);
            }

            if (onProgress) {
                conversion.onProgress = onProgress;
            }

            await conversion.execute();

            const mimeType = trackType === 'video' ? `video/${format}` : `audio/${format}`;
            return new Blob([output.target.buffer], { type: mimeType });
        } finally {
            // Cleanup all MediaBunny resources
            if (conversion && typeof conversion.dispose === 'function') {
                try {
                    conversion.dispose();
                } catch (e) {
                    Logger.warn('Error disposing conversion in extractTrack:', e);
                }
            }

            if (output && typeof output.dispose === 'function') {
                try {
                    output.dispose();
                } catch (e) {
                    Logger.warn('Error disposing output in extractTrack:', e);
                }
            }

            if (input && typeof input.dispose === 'function') {
                try {
                    input.dispose();
                } catch (e) {
                    Logger.warn('Error disposing input in extractTrack:', e);
                }
            }
        }
    }

    /**
     * Extract track with speed adjustment (requires re-encoding)
     * @private
     */
    static async _extractTrackWithSpeed({ source, trackIndex, trackType, format, speed, onProgress }) {
        Logger.log(`[MediaProcessor] Extracting ${trackType} track ${trackIndex} with speed ${speed}x`);

        const blobSource = source instanceof Blob ? new MediaBunny.BlobSource(source) : new MediaBunny.BufferSource(source);
        const input = new MediaBunny.Input({
            source: blobSource,
            formats: MediaBunny.ALL_FORMATS
        });

        let output = null;
        let canvasSource = null;
        let audioSource = null;
        let canvas = null;

        try {
            if (trackType === 'video') {
                // Extract and speed-adjust video track
                const videoTracks = await input.getVideoTracks();
                if (trackIndex >= videoTracks.length) {
                    throw new Error(`Video track ${trackIndex} not found`);
                }
                const videoTrack = videoTracks[trackIndex];

                const width = videoTrack.displayWidth || videoTrack.codedWidth;
                const height = videoTrack.displayHeight || videoTrack.codedHeight;
                const duration = await videoTrack.computeDuration();
                const firstTimestamp = await videoTrack.getFirstTimestamp();

                let sourceFps = 30;
                try {
                    const stats = await videoTrack.computePacketStats();
                    sourceFps = stats.averagePacketRate || 30;
                } catch (e) {
                    Logger.warn('[MediaProcessor] Could not compute frame rate, defaulting to 30fps');
                }

                const outputDuration = duration / speed;
                const outputFps = sourceFps;
                const frameDuration = 1 / outputFps;
                const totalOutputFrames = Math.ceil(outputDuration * outputFps);

                Logger.log(`[MediaProcessor] Video: ${width}x${height}, ${duration.toFixed(2)}s -> ${outputDuration.toFixed(2)}s at ${speed}x`);

                // Setup output
                const outputFormat = format === 'webm' ? new MediaBunny.WebMOutputFormat() : new MediaBunny.Mp4OutputFormat();
                output = new MediaBunny.Output({
                    format: outputFormat,
                    target: new MediaBunny.BufferTarget()
                });

                canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });

                canvasSource = new MediaBunny.CanvasSource(canvas, {
                    codec: format === 'webm' ? 'vp9' : 'avc',
                    bitrate: MediaBunny.QUALITY_HIGH,
                    // frameRate: outputFps
                });

                output.addVideoTrack(canvasSource);
                await output.start();

                // Sample frames with speed adjustment
                const videoSink = new MediaBunny.VideoSampleSink(videoTrack);
                const timestampGenerator = (async function* () {
                    for (let outputFrame = 0; outputFrame < totalOutputFrames; outputFrame++) {
                        const outputProgress = outputFrame / totalOutputFrames;
                        const sourceTime = duration * outputProgress;
                        yield firstTimestamp + sourceTime;
                    }
                })();

                let outputTimestamp = 0;
                let frameCount = 0;

                for await (const sample of videoSink.samplesAtTimestamps(timestampGenerator)) {
                    if (sample) {
                        sample.draw(ctx, 0, 0, width, height);
                        await canvasSource.add(outputTimestamp, frameDuration);
                        outputTimestamp += frameDuration;
                        sample.close();
                        frameCount++;

                        if (onProgress) {
                            onProgress(frameCount / totalOutputFrames);
                        }
                    }
                }

                Logger.log(`[MediaProcessor] Encoded ${frameCount} video frames`);
                canvasSource.close();
                await output.finalize();

                return new Blob([output.target.buffer], { type: `video/${format}` });

            } else {
                // Extract and speed-adjust audio track
                const audioTracks = await input.getAudioTracks();
                if (trackIndex >= audioTracks.length) {
                    throw new Error(`Audio track ${trackIndex} not found`);
                }
                const audioTrack = audioTracks[trackIndex];

                // Collect all audio samples
                const audioSink = new MediaBunny.AudioSampleSink(audioTrack);
                const samples = [];
                for await (const sample of audioSink.samples()) {
                    samples.push(sample);
                }

                Logger.log(`[MediaProcessor] Collected ${samples.length} audio samples for speed adjustment`);

                // Setup output
                let outputFormat;
                switch (format) {
                    case 'm4a':
                        outputFormat = new MediaBunny.Mp4OutputFormat();
                        break;
                    case 'mp3':
                        outputFormat = new MediaBunny.Mp3OutputFormat();
                        break;
                    case 'wav':
                        outputFormat = new MediaBunny.WavOutputFormat();
                        break;
                    default:
                        outputFormat = new MediaBunny.Mp4OutputFormat();
                }

                output = new MediaBunny.Output({
                    format: outputFormat,
                    target: new MediaBunny.BufferTarget()
                });

                const supportedCodecs = await MediaBunny.getEncodableAudioCodecs(['aac', 'opus', 'mp3']);
                if (supportedCodecs.length === 0) {
                    throw new Error('No supported audio codecs found');
                }

                audioSource = new MediaBunny.AudioSampleSource({
                    codec: supportedCodecs[0],
                    bitrate: 128000
                });
                output.addAudioTrack(audioSource);
                await output.start();

                let outputTimestamp = 0;
                const totalSamples = samples.length;

                for (let i = 0; i < samples.length; i++) {
                    const sample = samples[i];
                    const buffer = sample.toAudioBuffer();

                    // Time-stretch using OfflineAudioContext
                    let finalBuffer = buffer;
                    try {
                        const targetDuration = buffer.duration / speed;
                        const targetFrames = Math.ceil(targetDuration * buffer.sampleRate);

                        const offlineCtx = new OfflineAudioContext(
                            buffer.numberOfChannels,
                            targetFrames,
                            buffer.sampleRate
                        );

                        const source = offlineCtx.createBufferSource();
                        source.buffer = buffer;
                        source.playbackRate.value = speed;
                        source.connect(offlineCtx.destination);
                        source.start(0);

                        finalBuffer = await offlineCtx.startRendering();
                    } catch (e) {
                        Logger.warn('[MediaProcessor] Audio time-stretch failed, using original:', e);
                    }

                    const processedSamples = MediaBunny.AudioSample.fromAudioBuffer(finalBuffer, outputTimestamp);
                    const samplesToAdd = Array.isArray(processedSamples) ? processedSamples : [processedSamples];

                    for (const s of samplesToAdd) {
                        await audioSource.add(s);
                        outputTimestamp += s.duration;
                        s.close();
                    }

                    sample.close();

                    if (onProgress && i % 100 === 0) {
                        onProgress(i / totalSamples);
                    }
                }

                Logger.log('[MediaProcessor] Audio speed adjustment complete');
                audioSource.close();
                await output.finalize();

                if (onProgress) onProgress(1.0);

                return new Blob([output.target.buffer], { type: `audio/${format}` });
            }
        } finally {
            // Cleanup
            if (input && typeof input.dispose === 'function') {
                try { input.dispose(); } catch (e) { Logger.warn('Error disposing input:', e); }
            }
            if (output && typeof output.dispose === 'function') {
                try { output.dispose(); } catch (e) { Logger.warn('Error disposing output:', e); }
            }
            if (canvasSource && typeof canvasSource.dispose === 'function') {
                try { canvasSource.dispose(); } catch (e) { Logger.warn('Error disposing canvasSource:', e); }
            }
            if (audioSource && typeof audioSource.dispose === 'function') {
                try { audioSource.dispose(); } catch (e) { Logger.warn('Error disposing audioSource:', e); }
            }
        }
    }

    /**
     * Merge multiple videos using MediaBunny
     * 
     * @param {Object} options
     * @param {Array<Blob|File>} options.inputs - List of input files/blobs
     * @param {string} options.format - 'mp4', 'webm', etc.
     * @param {Object} [options.resolution] - { width: number, height: number }
     * @param {Function} [options.onProgress]
     * @returns {Promise<Blob>}
     */
    static _calculateScale(videoWidth, videoHeight, targetWidth, targetHeight, scaleMode) {
        if (scaleMode === 'fill') {
            // Fill entire canvas (may distort)
            return {
                x: 0,
                y: 0,
                width: targetWidth,
                height: targetHeight
            };
        }

        if (scaleMode === 'center') {
            // Keep original size, center placement
            return {
                x: (targetWidth - videoWidth) / 2,
                y: (targetHeight - videoHeight) / 2,
                width: videoWidth,
                height: videoHeight
            };
        }

        // Default: 'proportional' - fit within canvas, maintain aspect ratio
        const videoAspect = videoWidth / videoHeight;
        const targetAspect = targetWidth / targetHeight;

        let drawWidth, drawHeight;
        if (videoAspect > targetAspect) {
            // Video is wider - fit to width
            drawWidth = targetWidth;
            drawHeight = targetWidth / videoAspect;
        } else {
            // Video is taller/same - fit to height
            drawHeight = targetHeight;
            drawWidth = targetHeight * videoAspect;
        }

        return {
            x: (targetWidth - drawWidth) / 2,
            y: (targetHeight - drawHeight) / 2,
            width: drawWidth,
            height: drawHeight
        };
    }

    static async merge({ inputs, format = 'mp4', resolution, scaleMode = 'proportional', backgroundColor = '#000000', onProgress }) {
        if (!inputs || inputs.length < 2) {
            throw new Error('At least 2 videos are required for merging.');
        }

        Logger.log('[MediaProcessor] Starting merge of', inputs.length, 'videos');

        // Track all objects for cleanup
        const inputObjects = [];
        let output = null;
        let canvasSource = null;
        let audioSource = null;
        const canvas = document.createElement('canvas');

        try {
            // Step 1: Analyze all input videos
            Logger.log('[MediaProcessor] Step 1: Analyzing input videos...');
            const videoInfos = [];
            let maxWidth = 0;
            let maxHeight = 0;
            for (let i = 0; i < inputs.length; i++) {
                const input = new MediaBunny.Input({
                    source: new MediaBunny.BlobSource(inputs[i]),
                    formats: MediaBunny.ALL_FORMATS
                });
                inputObjects.push(input); // Track for cleanup

                const videoTrack = await input.getPrimaryVideoTrack();
                if (!videoTrack) {
                    throw new Error(`No video track found in input file ${i + 1}`);
                }

                const duration = await videoTrack.computeDuration();
                const width = videoTrack.displayWidth || videoTrack.codedWidth;
                const height = videoTrack.displayHeight || videoTrack.codedHeight;

                Logger.log(`[MediaProcessor] Video ${i + 1}: ${width}x${height}, ${duration}s, codec: ${videoTrack.codec}`);

                maxWidth = Math.max(maxWidth, width);
                maxHeight = Math.max(maxHeight, height);

                videoInfos.push({
                    index: i,
                    input: input,
                    width,
                    height,
                    duration,
                    codec: videoTrack.codec
                });

                if (onProgress) {
                    onProgress((i + 1) / (inputs.length * 2));
                }
            }

            const targetWidth = resolution?.width || maxWidth;
            const targetHeight = resolution?.height || maxHeight;
            const targetFps = 30;

            Logger.log(`[MediaProcessor] Target specs: ${targetWidth}x${targetHeight} @ ${targetFps}fps`);

            // Step 2: Create output
            Logger.log('[MediaProcessor] Step 2: Setting up output...');

            let outputFormat;
            switch (format) {
                case 'mp4':
                    outputFormat = new MediaBunny.Mp4OutputFormat();
                    break;
                case 'webm':
                    outputFormat = new MediaBunny.WebMOutputFormat();
                    break;
                case 'mov':
                    outputFormat = new MediaBunny.QuickTimeOutputFormat();
                    break;
                default:
                    throw new Error(`Unsupported format: ${format}`);
            }

            output = new MediaBunny.Output({
                format: outputFormat,
                target: new MediaBunny.BufferTarget()
            });

            // Setup canvas for video
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const ctx = canvas.getContext('2d');

            canvasSource = new MediaBunny.CanvasSource(canvas, {
                codec: format === 'webm' ? 'vp9' : 'avc',
                bitrate: MediaBunny.QUALITY_HIGH,
                // frameRate: targetFps
            });

            output.addVideoTrack(canvasSource);

            // Setup audio with codec detection
            let audioCodec;
            let audioBitrate = 128000;
            const targetSampleRate = 48000; // Standard sample rate for merged audio
            const targetChannels = 2; // Stereo

            if (format === 'webm') {
                audioCodec = 'opus';
            } else {
                const supportedCodecs = await MediaBunny.getEncodableAudioCodecs(['aac', 'opus', 'mp3']);

                if (supportedCodecs.length === 0) {
                    Logger.warn('[MediaProcessor] No supported audio codecs found, merge will be video-only');
                    audioCodec = null;
                } else {
                    audioCodec = supportedCodecs[0];
                    Logger.log(`[MediaProcessor] Using audio codec: ${audioCodec}`);
                }
            }

            if (audioCodec) {
                audioSource = new MediaBunny.AudioSampleSource({
                    codec: audioCodec,
                    bitrate: audioBitrate
                });
                output.addAudioTrack(audioSource);
                Logger.log(`[MediaProcessor] Audio output: ${targetChannels} channels @ ${targetSampleRate}Hz`);
            }

            await output.start();

            // Step 3: Process each video
            let currentTimestamp = 0;

            for (let i = 0; i < videoInfos.length; i++) {
                Logger.log(`[MediaProcessor] Processing video ${i + 1}/${videoInfos.length}...`);

                const info = videoInfos[i];
                const input = info.input;

                const videoTrack = await input.getPrimaryVideoTrack();
                const audioTrack = await input.getPrimaryAudioTrack();

                // Process video
                const canDecodeVideo = await videoTrack.canDecode();
                if (!canDecodeVideo) {
                    throw new Error(`Cannot decode video ${i + 1}. Codec ${videoTrack.codec} not supported.`);
                }

                const videoSink = new MediaBunny.VideoSampleSink(videoTrack);
                const videoStartTime = await videoTrack.getFirstTimestamp();
                let frameCount = 0;

                for await (const sample of videoSink.samples()) {
                    try {
                        const relativeTimestamp = sample.timestamp - videoStartTime;
                        const absoluteTimestamp = currentTimestamp + relativeTimestamp;
                        const duration = sample.duration || (1 / targetFps);

                        //Fill canvas with background color
                        ctx.fillStyle = backgroundColor;
                        ctx.fillRect(0, 0, targetWidth, targetHeight);

                        // Calculate scaling based on selected mode
                        const scaleParams = MediaProcessor._calculateScale(
                            sample.displayWidth,
                            sample.displayHeight,
                            targetWidth,
                            targetHeight,
                            scaleMode
                        );

                        // Draw frame with calculated parameters
                        sample.draw(ctx, scaleParams.x, scaleParams.y, scaleParams.width, scaleParams.height);
                        await canvasSource.add(absoluteTimestamp, duration);

                        frameCount++;
                    } finally {
                        sample.close();
                    }
                }

                Logger.log(`[MediaProcessor] Processed ${frameCount} frames from video ${i + 1}`);

                // Process audio
                if (audioSource && audioTrack) {
                    const canDecodeAudio = await audioTrack.canDecode();
                    if (canDecodeAudio) {
                        Logger.log(`[MediaProcessor] Processing audio from video ${i + 1}...`);

                        const audioSink = new MediaBunny.AudioSampleSink(audioTrack);
                        const audioStartTime = await audioTrack.getFirstTimestamp();
                        let audioSampleCount = 0;

                        // Check if audio needs resampling or channel remixing
                        const needsResampling = audioTrack.sampleRate !== targetSampleRate;
                        const needsRemixing = audioTrack.numberOfChannels !== targetChannels;

                        if (needsResampling || needsRemixing) {
                            Logger.log(`[MediaProcessor] Audio conversion needed: ${audioTrack.numberOfChannels}ch @ ${audioTrack.sampleRate}Hz -> ${targetChannels}ch @ ${targetSampleRate}Hz`);
                        }

                        for await (const sample of audioSink.samples()) {
                            const relativeTimestamp = sample.timestamp - audioStartTime;
                            const absoluteTimestamp = currentTimestamp + relativeTimestamp;

                            let processedSample = sample;

                            // Resample/remix if needed using Web Audio API
                            if (needsResampling || needsRemixing) {
                                try {
                                    // Create an offline audio context for resampling
                                    const offlineCtx = new OfflineAudioContext(
                                        targetChannels,
                                        Math.ceil(sample.numberOfFrames * (targetSampleRate / sample.sampleRate)),
                                        targetSampleRate
                                    );

                                    // Convert sample to AudioBuffer
                                    const sourceBuffer = sample.toAudioBuffer();

                                    // Create source node
                                    const source = offlineCtx.createBufferSource();
                                    source.buffer = sourceBuffer;
                                    source.connect(offlineCtx.destination);
                                    source.start(0);

                                    // Render the resampled audio
                                    const resampledBuffer = await offlineCtx.startRendering();

                                    // Convert back to AudioSample with adjusted timestamp
                                    const resampledSamples = MediaBunny.AudioSample.fromAudioBuffer(
                                        resampledBuffer,
                                        absoluteTimestamp
                                    );

                                    // fromAudioBuffer can return multiple samples, use the first one
                                    processedSample = Array.isArray(resampledSamples) ? resampledSamples[0] : resampledSamples;

                                    sample.close(); // Close original sample
                                } catch (resampleError) {
                                    Logger.error(`[MediaProcessor] Error resampling audio:`, resampleError);
                                    sample.close();
                                    throw resampleError;
                                }
                            } else {
                                // No resampling needed, just adjust timestamp
                                processedSample.setTimestamp(absoluteTimestamp);
                            }

                            await audioSource.add(processedSample);

                            // Close the processed sample if it's different from the original
                            if (processedSample !== sample) {
                                processedSample.close();
                            }

                            audioSampleCount++;
                        }

                        Logger.log(`[MediaProcessor] Processed ${audioSampleCount} audio samples from video ${i + 1}`);
                    } else {
                        Logger.warn(`[MediaProcessor] Cannot decode audio from video ${i + 1}, skipping`);
                    }
                } else if (!audioSource && audioTrack) {
                    Logger.log(`[MediaProcessor] No audio encoder available, skipping audio`);
                }

                // Update timestamp for next video
                currentTimestamp += info.duration;

                if (onProgress) {
                    const overallProgress = 0.5 + ((i + 1) / (videoInfos.length * 2));
                    onProgress(overallProgress);
                }
            }

            // Step 4: Finalize
            Logger.log('[MediaProcessor] Finalizing merge...');
            canvasSource.close();
            if (audioSource) {
                audioSource.close();
            }
            await output.finalize();

            if (onProgress) onProgress(1.0);

            Logger.log('[MediaProcessor] Merge complete!');
            return new Blob([output.target.buffer], { type: `video/${format}` });

        } catch (error) {
            Logger.error('[MediaProcessor] Merge failed:', error);
            throw new Error(`Video merge failed: ${error.message}`);
        } finally {
            // CRITICAL: Clean up all MediaBunny resources to prevent memory leaks
            Logger.log('[MediaProcessor] Cleaning up resources...');

            // Dispose Output
            if (output && typeof output.dispose === 'function') {
                try {
                    output.dispose();
                } catch (e) {
                    Logger.warn('Error disposing output during merge cleanup:', e);
                }
            }

            // Dispose CanvasSource
            if (canvasSource && typeof canvasSource.dispose === 'function') {
                try {
                    canvasSource.dispose();
                } catch (e) {
                    Logger.warn('Error disposing canvasSource during merge cleanup:', e);
                }
            }

            // Dispose AudioSource
            if (audioSource && typeof audioSource.dispose === 'function') {
                try {
                    audioSource.dispose();
                } catch (e) {
                    Logger.warn('Error disposing audioSource during merge cleanup:', e);
                }
            }

            // Dispose all Input objects
            for (const input of inputObjects) {
                if (input && typeof input.dispose === 'function') {
                    try {
                        input.dispose();
                    } catch (e) {
                        Logger.warn('Error disposing input during merge cleanup:', e);
                    }
                }
            }
            inputObjects.length = 0;

            // Clean up canvas context
            if (canvas) {
                const context = canvas.getContext('2d');
                if (context) {
                    context.clearRect(0, 0, canvas.width, canvas.height);
                }
            }

            // Nullify references to help garbage collection
            output = null;
            canvasSource = null;
            audioSource = null;

            Logger.log('[MediaProcessor] Cleanup complete');
        }
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
        const {
            input,
            startTime,
            duration,
            fps,
            width,
            height,
            quality,
            onProgress
        } = options;

        // Create video element to extract frames
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;

        // Load video
        const videoUrl = URL.createObjectURL(input);
        video.src = videoUrl;

        try {
            // Wait for video to load
            await new Promise((resolve, reject) => {
                video.onloadedmetadata = resolve;
                video.onerror = reject;
            });

            // Create canvas for frame extraction
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });

            // Initialize GIF encoder with gif.js
            const gif = new GIF({
                workers: 2,
                quality: Math.max(1, Math.round((100 - quality) / 10)), // gif.js quality: 1=best, 30=worst
                workerScript: 'assets/js/lib/gif.worker.js',
                width: width,
                height: height
            });

            // Calculate frame timing
            const frameDelay = Math.round(1000 / fps); // Delay in milliseconds
            const totalFrames = Math.ceil(duration * fps);
            const frameInterval = duration / totalFrames;

            let framesProcessed = 0;

            // Extract and encode frames
            for (let i = 0; i < totalFrames; i++) {
                const currentTime = startTime + (i * frameInterval);

                // Seek to frame time
                video.currentTime = currentTime;
                await new Promise(resolve => {
                    video.onseeked = resolve;
                });

                // Draw frame to canvas
                ctx.drawImage(video, 0, 0, width, height);

                // Add frame to GIF
                gif.addFrame(canvas, { delay: frameDelay, copy: true });

                framesProcessed++;

                // Update progress (50% for frame extraction, 50% for encoding)
                if (onProgress) {
                    onProgress(framesProcessed / totalFrames * 0.5);
                }
            }

            // Render GIF asynchronously
            return new Promise((resolve, reject) => {
                gif.on('finished', (blob) => {
                    if (onProgress) onProgress(1.0);
                    resolve(blob);
                });

                gif.on('progress', (p) => {
                    if (onProgress) {
                        // 0.5 (frame extraction done) + 0.5 (encoding progress)
                        onProgress(0.5 + (p * 0.5));
                    }
                });

                gif.on('error', reject);

                gif.render();
            });

        } finally {
            // Cleanup
            URL.revokeObjectURL(videoUrl);
            video.src = '';
            video.load(); // Force release of video resources
        }
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
        Logger.log('[MediaProcessor] Starting video reversal with samplesAtTimestamps...');

        const blobSource = new MediaBunny.BlobSource(source);
        const input = new MediaBunny.Input({
            source: blobSource,
            formats: MediaBunny.ALL_FORMATS
        });

        let output = null;
        let canvasSource = null;
        let audioSource = null;
        let canvas = null;

        try {
            // Step 1: Analyze input
            const videoTrack = await input.getPrimaryVideoTrack();
            if (!videoTrack) throw new Error('No video track found');

            const width = videoTrack.displayWidth || videoTrack.codedWidth;
            const height = videoTrack.displayHeight || videoTrack.codedHeight;
            const duration = await videoTrack.computeDuration();
            const firstTimestamp = await videoTrack.getFirstTimestamp();

            // Compute frame rate and source bitrate from metadata
            let sourceFps = 30;
            let sourceBitrate = 0;
            try {
                const stats = await videoTrack.computePacketStats();
                sourceFps = stats.averagePacketRate || 30;
                sourceBitrate = stats.averageBitrate || 0;
            } catch (e) {
                Logger.warn("[MediaProcessor] Could not compute frame rate, defaulting to 30fps", e);
            }

            // Clamp speed to valid range
            const clampedSpeed = Math.max(0.25, Math.min(2, speed));

            // Output FPS stays the same, but we adjust frame sampling based on speed
            // At 2x speed: output half the duration (skip frames)
            // At 0.5x speed: output double the duration (duplicate frames or interpolate)
            const outputFps = sourceFps;
            const sourceDuration = duration;
            const outputDuration = sourceDuration / clampedSpeed;

            // Frame parameters
            const frameDuration = 1 / outputFps;
            const totalOutputFrames = Math.ceil(outputDuration * outputFps);

            Logger.log(`[MediaProcessor] Source: ${width}x${height}, ${duration.toFixed(2)}s, ${sourceFps.toFixed(1)}fps, ${(sourceBitrate / 1000000).toFixed(2)} Mbps`);
            Logger.log(`[MediaProcessor] Speed: ${clampedSpeed}x, Output: ${outputDuration.toFixed(2)}s, ${totalOutputFrames} frames`);

            // Step 2: Setup Output
            const outputFormat = new MediaBunny.Mp4OutputFormat();
            output = new MediaBunny.Output({
                format: outputFormat,
                target: new MediaBunny.BufferTarget()
            });

            // Setup Canvas for encoding
            canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });

            canvasSource = new MediaBunny.CanvasSource(canvas, {
                codec: 'avc',
                bitrate: MediaBunny.QUALITY_HIGH,
                // frameRate: outputFps
            });

            output.addVideoTrack(canvasSource);

            // Setup Audio (if requested)
            if (includeAudio) {
                const audioTrack = await input.getPrimaryAudioTrack();
                if (audioTrack) {
                    const supportedCodecs = await MediaBunny.getEncodableAudioCodecs(['aac', 'opus', 'mp3']);
                    if (supportedCodecs.length > 0) {
                        audioSource = new MediaBunny.AudioSampleSource({
                            codec: supportedCodecs[0],
                            bitrate: 128000
                        });
                        output.addAudioTrack(audioSource);
                    }
                }
            }

            await output.start();

            // Step 3: Use samplesAtTimestamps with reverse timestamp generator
            Logger.log('[MediaProcessor] Extracting frames in reverse order using samplesAtTimestamps...');

            const videoSink = new MediaBunny.VideoSampleSink(videoTrack);

            // Generate timestamps in REVERSE order (from end to start)
            // Speed affects which frames we sample from source:
            // - At speed 1x: sample all frames in reverse
            // - At speed 2x: sample every other frame (faster playback)
            // - At speed 0.5x: sample frames with smaller steps (slower playback)
            const reverseTimestampGenerator = (async function* () {
                for (let outputFrame = 0; outputFrame < totalOutputFrames; outputFrame++) {
                    // Map output frame to source time (reversed)
                    // outputFrame 0 -> end of source video
                    // outputFrame N -> start of source video  
                    const outputProgress = outputFrame / totalOutputFrames;
                    const sourceTime = sourceDuration * (1 - outputProgress);
                    yield firstTimestamp + sourceTime;
                }
            })();

            let outputTimestamp = 0;
            let frameCount = 0;

            // samplesAtTimestamps efficiently handles seeking and decoding
            for await (const sample of videoSink.samplesAtTimestamps(reverseTimestampGenerator)) {
                if (sample) {
                    // Draw the sample to canvas
                    sample.draw(ctx, 0, 0, width, height);

                    // Encode the frame
                    await canvasSource.add(outputTimestamp, frameDuration);
                    outputTimestamp += frameDuration;

                    sample.close();
                    frameCount++;

                    // Update progress (0-80% for video)
                    if (onProgress) {
                        onProgress(frameCount / totalOutputFrames * 0.8);
                    }
                }
            }

            Logger.log(`[MediaProcessor] Encoded ${frameCount} frames`);

            // Step 4: Handle Audio (if requested)
            if (includeAudio && audioSource) {
                Logger.log('[MediaProcessor] Reversing audio...');
                try {
                    const audioTrack = await input.getPrimaryAudioTrack();
                    if (audioTrack) {
                        await MediaProcessor._reverseAudioWithSink(audioTrack, audioSource, duration, clampedSpeed, onProgress);
                        Logger.log('[MediaProcessor] Audio reversal complete');
                    }
                } catch (e) {
                    Logger.warn('[MediaProcessor] Audio reversal failed:', e);
                }
            }

            // Step 5: Finalize
            Logger.log('[MediaProcessor] Finalizing...');
            canvasSource.close();
            if (audioSource) audioSource.close();
            await output.finalize();

            if (onProgress) onProgress(1.0);

            Logger.log('[MediaProcessor] Reverse complete!');
            return new Blob([output.target.buffer], { type: 'video/mp4' });

        } finally {
            // Cleanup
            if (input && typeof input.dispose === 'function') {
                try { input.dispose(); } catch (e) { Logger.warn('Error disposing input:', e); }
            }
            if (output && typeof output.dispose === 'function') {
                try { output.dispose(); } catch (e) { Logger.warn('Error disposing output:', e); }
            }
            if (canvasSource && typeof canvasSource.dispose === 'function') {
                try { canvasSource.dispose(); } catch (e) { Logger.warn('Error disposing canvasSource:', e); }
            }
            if (audioSource && typeof audioSource.dispose === 'function') {
                try { audioSource.dispose(); } catch (e) { Logger.warn('Error disposing audioSource:', e); }
            }
        }
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
        Logger.log(`[MediaProcessor] Changing speed to ${speed}x...`);

        const blobSource = new MediaBunny.BlobSource(source);
        const input = new MediaBunny.Input({
            source: blobSource,
            formats: MediaBunny.ALL_FORMATS
        });

        let output = null;
        let canvasSource = null;
        let canvas = null;

        try {
            // Analyze input
            const videoTrack = await input.getPrimaryVideoTrack();
            if (!videoTrack) throw new Error('No video track found');

            const width = videoTrack.displayWidth || videoTrack.codedWidth;
            const height = videoTrack.displayHeight || videoTrack.codedHeight;
            const duration = await videoTrack.computeDuration();
            const firstTimestamp = await videoTrack.getFirstTimestamp();

            // Compute frame rate
            let sourceFps = 30;
            try {
                const stats = await videoTrack.computePacketStats();
                sourceFps = stats.averagePacketRate || 30;
            } catch (e) {
                Logger.warn("[MediaProcessor] Could not compute frame rate, defaulting to 30fps", e);
            }

            // Calculations
            const clampedSpeed = Math.max(0.1, Math.min(10, speed));
            const outputFps = sourceFps;
            const sourceDuration = duration;
            const outputDuration = sourceDuration / clampedSpeed;
            const frameDuration = 1 / outputFps;
            const totalOutputFrames = Math.ceil(outputDuration * outputFps);

            Logger.log(`[MediaProcessor] Speed: ${clampedSpeed}x, Output: ${outputDuration.toFixed(2)}s, ${totalOutputFrames} frames`);

            // Setup Output
            const outputFormat = new MediaBunny.Mp4OutputFormat();
            output = new MediaBunny.Output({
                format: outputFormat,
                target: new MediaBunny.BufferTarget()
            });

            // Setup Canvas
            canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });

            canvasSource = new MediaBunny.CanvasSource(canvas, {
                codec: 'avc',
                bitrate: MediaBunny.QUALITY_HIGH,
                // frameRate: outputFps
            });

            output.addVideoTrack(canvasSource);

            // Setup Audio (if requested)
            let audioSource = null;
            if (includeAudio) {
                const audioTrack = await input.getPrimaryAudioTrack();
                if (audioTrack) {
                    const supportedCodecs = await MediaBunny.getEncodableAudioCodecs(['aac', 'opus', 'mp3']);
                    if (supportedCodecs.length > 0) {
                        try {
                            // Determine audio config
                            // Note: Simple re-encoding doesn't change pitch/speed yet.
                            // Ideally we would resample, but for now we follow the reverseVideo pattern 
                            // which likely just includes the track.
                            // However, we must ensure duration matches or it will be out of sync.
                            // If we can't change speed, let's at least include it.
                            audioSource = new MediaBunny.AudioSampleSource({
                                codec: supportedCodecs[0],
                                bitrate: 128000
                            });
                            output.addAudioTrack(audioSource);
                            Logger.log('[MediaProcessor] Audio track added (experimental speed sync)');
                        } catch (e) {
                            Logger.warn('[MediaProcessor] Failed to setup audio:', e);
                        }
                    }
                }
            }

            await output.start();

            // Process Video
            Logger.log('[MediaProcessor] Processing video frames...');

            // Generate timestamps for speed adjustment
            const videoSink = new MediaBunny.VideoSampleSink(videoTrack);
            const timestampGenerator = (async function* () {
                for (let outputFrame = 0; outputFrame < totalOutputFrames; outputFrame++) {
                    const outputProgress = outputFrame / totalOutputFrames;
                    const sourceTime = sourceDuration * outputProgress;
                    yield firstTimestamp + sourceTime;
                }
            })();

            let outputTimestamp = 0;
            let frameCount = 0;

            for await (const sample of videoSink.samplesAtTimestamps(timestampGenerator)) {
                if (sample) {
                    sample.draw(ctx, 0, 0, width, height);
                    await canvasSource.add(outputTimestamp, frameDuration);
                    outputTimestamp += frameDuration;
                    sample.close();
                    frameCount++;

                    if (onProgress) {
                        onProgress(frameCount / totalOutputFrames);
                    }
                }
            }

            Logger.log(`[MediaProcessor] Encoded ${frameCount} frames`);

            // Step 4: Handle Audio (if requested)
            if (includeAudio && audioSource) {
                Logger.log('[MediaProcessor] Processing audio...');
                try {
                    const audioTrack = await input.getPrimaryAudioTrack();
                    if (audioTrack) {
                        // We use a helper to process audio samples (resampling for speed)
                        await MediaProcessor._processAudioWithSpeed(audioTrack, audioSource, speed, onProgress);
                        Logger.log('[MediaProcessor] Audio processing complete');
                    }
                } catch (e) {
                    Logger.warn('[MediaProcessor] Audio processing failed:', e);
                }
            }

            await output.finalize();
            return new Blob([output.target.buffer], { type: 'video/mp4' });

        } finally {
            if (input && typeof input.dispose === 'function') input.dispose();
            if (output && typeof output.dispose === 'function') output.dispose();
            if (canvasSource && typeof canvasSource.dispose === 'function') canvasSource.dispose();
        }
    }

    /**
     * Process audio with speed change (resampling)
     * @param {Object} audioTrack
     * @param {Object} audioSource
     * @param {number} speed
     * @param {Function} [onProgress]
     * @private
     */
    static async _processAudioWithSpeed(audioTrack, audioSource, speed = 1, onProgress) {
        const audioSink = new MediaBunny.AudioSampleSink(audioTrack);
        let outputTimestamp = 0;
        let sampleCount = 0;

        for await (const sample of audioSink.samples()) {
            let finalBuffer = sample.toAudioBuffer();

            // Time-stretch if speed != 1
            if (speed !== 1) {
                try {
                    // At 2x speed, audio duration is halved, pitch is higher
                    const originalDuration = finalBuffer.duration;
                    const targetDuration = originalDuration / speed;
                    const targetFrames = Math.ceil(targetDuration * finalBuffer.sampleRate);

                    const offlineCtx = new OfflineAudioContext(
                        finalBuffer.numberOfChannels,
                        targetFrames,
                        finalBuffer.sampleRate
                    );

                    const source = offlineCtx.createBufferSource();
                    source.buffer = finalBuffer;
                    source.playbackRate.value = speed;
                    source.connect(offlineCtx.destination);
                    source.start(0);

                    finalBuffer = await offlineCtx.startRendering();
                } catch (e) {
                    Logger.warn('[MediaProcessor] Audio time-stretch failed, using original:', e);
                }
            }

            // Create new sample(s)
            const processedSamples = MediaBunny.AudioSample.fromAudioBuffer(finalBuffer, outputTimestamp);
            const samplesToAdd = Array.isArray(processedSamples) ? processedSamples : [processedSamples];

            for (const s of samplesToAdd) {
                await audioSource.add(s);
                outputTimestamp += s.duration;
                s.close();
            }

            sample.close();
            sampleCount++;
        }
    }

    /**
     * Reverse audio using AudioSampleSink with chunked encoding.
     * Collects samples, reverses them, then encodes in chunks to limit memory.
     * 
     * @param {Object} audioTrack - MediaBunny audio track
     * @param {Object} audioSource - MediaBunny AudioSampleSource to write to
     * @param {number} duration - Total duration in seconds
     * @param {number} [speed=1] - Speed multiplier (affects audio playback speed)
     * @param {Function} [onProgress] - Progress callback
     * @private
     */
    static async _reverseAudioWithSink(audioTrack, audioSource, duration, speed = 1, onProgress) {
        const audioSink = new MediaBunny.AudioSampleSink(audioTrack);

        // Collect all audio samples (audio is much smaller than video)
        const samples = [];
        for await (const sample of audioSink.samples()) {
            samples.push(sample);
        }

        Logger.log(`[MediaProcessor] Collected ${samples.length} audio samples`);

        // Reverse order
        samples.reverse();

        let outputTimestamp = 0;
        const totalSamples = samples.length;

        for (let i = 0; i < samples.length; i++) {
            const sample = samples[i];

            // Convert to AudioBuffer
            const buffer = sample.toAudioBuffer();

            // Reverse data in each channel
            for (let c = 0; c < buffer.numberOfChannels; c++) {
                const data = buffer.getChannelData(c);
                data.reverse();
            }

            // Time-stretch audio if speed != 1
            // At 2x speed, audio duration is halved
            // At 0.5x speed, audio duration is doubled
            let finalBuffer = buffer;
            if (speed !== 1) {
                try {
                    const originalDuration = buffer.duration;
                    const targetDuration = originalDuration / speed;
                    const targetFrames = Math.ceil(targetDuration * buffer.sampleRate);

                    // Use OfflineAudioContext for resampling
                    const offlineCtx = new OfflineAudioContext(
                        buffer.numberOfChannels,
                        targetFrames,
                        buffer.sampleRate
                    );

                    const source = offlineCtx.createBufferSource();
                    source.buffer = buffer;
                    source.playbackRate.value = speed;
                    source.connect(offlineCtx.destination);
                    source.start(0);

                    finalBuffer = await offlineCtx.startRendering();
                } catch (e) {
                    Logger.warn('[MediaProcessor] Audio time-stretch failed, using original:', e);
                }
            }

            // Create new sample(s) from processed buffer
            const reversedSamples = MediaBunny.AudioSample.fromAudioBuffer(finalBuffer, outputTimestamp);
            const samplesToAdd = Array.isArray(reversedSamples) ? reversedSamples : [reversedSamples];

            for (const s of samplesToAdd) {
                await audioSource.add(s);
                outputTimestamp += s.duration;
                s.close();
            }

            sample.close();

            // Update progress (80-100% for audio)
            if (onProgress && i % 100 === 0) {
                onProgress(0.8 + (i / totalSamples) * 0.2);
            }
        }
    }

    /**
     * Reverse audio in chunks for memory efficiency.
     * Processes audio in 5-second chunks instead of loading entire audio into memory.
     * 
     * @param {Blob|File} source - Source video/audio file
     * @param {Object} audioSource - MediaBunny AudioSampleSource to write to
     * @param {number} duration - Total duration in seconds
     * @param {Function} [onProgress] - Progress callback
     * @private
     */
    static async _reverseAudioInChunks(source, audioSource, duration, onProgress) {
        const CHUNK_DURATION = 5; // Process 5 seconds at a time
        const totalChunks = Math.ceil(duration / CHUNK_DURATION);

        // We need to decode audio using Web Audio API
        const audioContext = new AudioContext();

        try {
            // Decode the entire audio file (this is necessary for Web Audio API)
            // But we'll process it in chunks to limit memory during encoding
            const arrayBuffer = await source.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

            const sampleRate = audioBuffer.sampleRate;
            const numberOfChannels = audioBuffer.numberOfChannels;

            Logger.log(`[MediaProcessor] Audio: ${numberOfChannels} channels @ ${sampleRate}Hz`);

            let outputTimestamp = 0;

            // Process chunks in reverse order
            for (let chunkIndex = totalChunks - 1; chunkIndex >= 0; chunkIndex--) {
                const chunkStart = chunkIndex * CHUNK_DURATION;
                const chunkEnd = Math.min(chunkStart + CHUNK_DURATION, duration);
                const chunkDuration = chunkEnd - chunkStart;

                const startSample = Math.floor(chunkStart * sampleRate);
                const endSample = Math.min(Math.floor(chunkEnd * sampleRate), audioBuffer.length);
                const chunkSamples = endSample - startSample;

                if (chunkSamples <= 0) continue;

                // Create a new buffer for this chunk
                const chunkBuffer = audioContext.createBuffer(
                    numberOfChannels,
                    chunkSamples,
                    sampleRate
                );

                // Copy and reverse the chunk data
                for (let channel = 0; channel < numberOfChannels; channel++) {
                    const sourceData = audioBuffer.getChannelData(channel);
                    const chunkData = chunkBuffer.getChannelData(channel);

                    // Copy in reverse order
                    for (let i = 0; i < chunkSamples; i++) {
                        chunkData[i] = sourceData[endSample - 1 - i];
                    }
                }

                // Convert to MediaBunny AudioSample
                const samples = MediaBunny.AudioSample.fromAudioBuffer(chunkBuffer, outputTimestamp);
                const samplesToAdd = Array.isArray(samples) ? samples : [samples];

                for (const sample of samplesToAdd) {
                    await audioSource.add(sample);
                    outputTimestamp += sample.duration;
                    sample.close();
                }

                // Update progress (80-100% for audio)
                if (onProgress) {
                    const audioProgress = (totalChunks - chunkIndex) / totalChunks;
                    onProgress(0.8 + audioProgress * 0.2);
                }
            }
        } finally {
            await audioContext.close();
        }
    }

    /**
     * Create a slideshow MP4 video from a list of images.
     * @param {Object} options
     * @param {Blob[]|File[]} options.imageBlobs - Ordered list of image files
     * @param {number[]} options.imageDurations - Duration in seconds for each image
     * @param {string} [options.transition='cut'] - 'cut'|'crossfade'|'slide-left'|'slide-right'|'slide-up'|'slide-down'|'fade-to-black'|'wipe-left'|'wipe-right'|'zoom'|'zoom-out'|'flip'
     * @param {number} [options.transitionDuration=0.5] - Transition duration in seconds
     * @param {Blob|File|null} [options.audioBlob] - Optional background music
     * @param {boolean} [options.audioLoop=true] - Loop audio to fill video duration
     * @param {number} [options.fps=30] - Output frame rate
     * @param {Function} [options.onProgress] - Progress callback (0-1)
     * @returns {Promise<Blob>}
     */
    static async createSlideshowVideo({
        imageBlobs,
        imageDurations,
        transition = 'cut',
        transitionDuration = 0.5,
        audioBlob = null,
        audioLoop = true,
        fps = 30,
        onProgress
    }) {
        Logger.log('[MediaProcessor] createSlideshowVideo start', { count: imageBlobs.length, transition, fps });

        let output = null;
        let canvasSource = null;
        let audioSource = null;

        try {
            // Step 1: Load all images as ImageBitmap
            const bitmaps = await Promise.all(imageBlobs.map(b => createImageBitmap(b)));

            // Determine canvas size (max dimensions, rounded to even)
            let canvasW = 0;
            let canvasH = 0;
            for (const bm of bitmaps) {
                canvasW = Math.max(canvasW, bm.width);
                canvasH = Math.max(canvasH, bm.height);
            }
            canvasW = canvasW % 2 === 0 ? canvasW : canvasW + 1;
            canvasH = canvasH % 2 === 0 ? canvasH : canvasH + 1;
            if (canvasW === 0 || canvasH === 0) throw new Error('Images have zero dimensions');

            Logger.log(`[MediaProcessor] Canvas: ${canvasW}x${canvasH}`);

            // Effective transition duration: only if transition !== cut and at least 2 images
            const useTransition = transition !== 'cut' && bitmaps.length > 1;
            const transDur = useTransition ? transitionDuration : 0;
            const frameDur = 1 / fps;

            // Total video duration
            let totalDuration = 0;
            for (let i = 0; i < bitmaps.length; i++) {
                const dur = imageDurations[i] || 3;
                totalDuration += dur;
                if (i < bitmaps.length - 1) totalDuration += transDur;
            }

            // Step 2: Setup output
            output = new MediaBunny.Output({
                format: new MediaBunny.Mp4OutputFormat(),
                target: new MediaBunny.BufferTarget()
            });

            const canvas = document.createElement('canvas');
            canvas.width = canvasW;
            canvas.height = canvasH;
            const ctx = canvas.getContext('2d');

            canvasSource = new MediaBunny.CanvasSource(canvas, {
                codec: 'avc',
                bitrate: MediaBunny.QUALITY_HIGH,
            });
            output.addVideoTrack(canvasSource);

            // Step 3: Optional audio (set up AudioSampleSource if audioBlob provided)
            if (audioBlob) {
                try {
                    const supportedCodecs = await MediaBunny.getEncodableAudioCodecs(['aac', 'opus', 'mp3']);
                    if (supportedCodecs.length > 0) {
                        audioSource = new MediaBunny.AudioSampleSource({
                            codec: supportedCodecs[0],
                            bitrate: 128000
                        });
                        output.addAudioTrack(audioSource);
                    }
                } catch (e) {
                    Logger.warn('[MediaProcessor] Failed to set up audio for slideshow, skipping:', e);
                    audioSource = null;
                }
            }

            await output.start();

            // Step 4: Render frames
            let outputTimestamp = 0;
            let totalFramesRendered = 0;
            const totalFrames = Math.ceil(totalDuration * fps);

            // Returns centered draw rect for a bitmap at optional scale factor
            const getCenteredRect = (bm, w, h, scaleFactor = 1) => {
                const scale = Math.min(w / bm.width, h / bm.height) * scaleFactor;
                const dw = bm.width * scale;
                const dh = bm.height * scale;
                return { dx: (w - dw) / 2, dy: (h - dh) / 2, dw, dh };
            };

            const drawImageCentered = (ctx, bm, w, h) => {
                ctx.fillStyle = '#000000';
                ctx.fillRect(0, 0, w, h);
                const { dx, dy, dw, dh } = getCenteredRect(bm, w, h);
                ctx.drawImage(bm, dx, dy, dw, dh);
            };

            // rectA/rectB are pre-computed per transition pair — not recomputed each frame
            const renderTransitionFrame = (ctx, bmA, bmB, rectA, rectB, progress, transType, w, h) => {
                switch (transType) {
                    case 'crossfade': {
                        ctx.fillStyle = '#000000';
                        ctx.fillRect(0, 0, w, h);
                        ctx.globalAlpha = 1 - progress;
                        ctx.drawImage(bmA, rectA.dx, rectA.dy, rectA.dw, rectA.dh);
                        ctx.globalAlpha = progress;
                        ctx.drawImage(bmB, rectB.dx, rectB.dy, rectB.dw, rectB.dh);
                        ctx.globalAlpha = 1;
                        break;
                    }
                    case 'slide-left':
                    case 'slide-right':
                    case 'slide-up':
                    case 'slide-down': {
                        const isH = transType === 'slide-left' || transType === 'slide-right';
                        const dir = (transType === 'slide-left' || transType === 'slide-up') ? -1 : 1;
                        const span = isH ? w : h;
                        ctx.save();
                        ctx.beginPath();
                        ctx.rect(0, 0, w, h);
                        ctx.clip();
                        ctx.fillStyle = '#000000';
                        ctx.fillRect(0, 0, w, h);
                        const aOff = dir * progress * span;
                        const bOff = -dir * (1 - progress) * span;
                        if (isH) {
                            ctx.drawImage(bmA, rectA.dx + aOff, rectA.dy, rectA.dw, rectA.dh);
                            ctx.drawImage(bmB, rectB.dx + bOff, rectB.dy, rectB.dw, rectB.dh);
                        } else {
                            ctx.drawImage(bmA, rectA.dx, rectA.dy + aOff, rectA.dw, rectA.dh);
                            ctx.drawImage(bmB, rectB.dx, rectB.dy + bOff, rectB.dw, rectB.dh);
                        }
                        ctx.restore();
                        break;
                    }
                    case 'fade-to-black': {
                        // Two-phase: A fades to black (0→0.5), B fades from black (0.5→1)
                        ctx.fillStyle = '#000000';
                        ctx.fillRect(0, 0, w, h);
                        if (progress < 0.5) {
                            ctx.globalAlpha = 1 - progress * 2;
                            ctx.drawImage(bmA, rectA.dx, rectA.dy, rectA.dw, rectA.dh);
                        } else {
                            ctx.globalAlpha = (progress - 0.5) * 2;
                            ctx.drawImage(bmB, rectB.dx, rectB.dy, rectB.dw, rectB.dh);
                        }
                        ctx.globalAlpha = 1;
                        break;
                    }
                    case 'wipe-left':
                    case 'wipe-right': {
                        // A stays; B revealed behind an expanding edge
                        drawImageCentered(ctx, bmA, w, h);
                        ctx.save();
                        ctx.beginPath();
                        if (transType === 'wipe-left') {
                            ctx.rect(0, 0, progress * w, h);
                        } else {
                            ctx.rect((1 - progress) * w, 0, progress * w, h);
                        }
                        ctx.clip();
                        ctx.drawImage(bmB, rectB.dx, rectB.dy, rectB.dw, rectB.dh);
                        ctx.restore();
                        break;
                    }
                    case 'zoom-out': {
                        // A shrinks to nothing; B fades in at 1.0x
                        const shrink = 1 - progress;
                        ctx.fillStyle = '#000000';
                        ctx.fillRect(0, 0, w, h);
                        ctx.globalAlpha = shrink;
                        ctx.drawImage(bmA,
                            rectA.dx + rectA.dw * progress / 2,
                            rectA.dy + rectA.dh * progress / 2,
                            rectA.dw * shrink, rectA.dh * shrink);
                        ctx.globalAlpha = progress;
                        ctx.drawImage(bmB, rectB.dx, rectB.dy, rectB.dw, rectB.dh);
                        ctx.globalAlpha = 1;
                        break;
                    }
                    case 'flip': {
                        // Horizontal flip: A narrows to nothing (0→0.5), B widens from nothing (0.5→1)
                        ctx.fillStyle = '#000000';
                        ctx.fillRect(0, 0, w, h);
                        const scaleX = progress < 0.5 ? 1 - 2 * progress : 2 * progress - 1;
                        const { dx, dy, dw, dh } = progress < 0.5 ? rectA : rectB;
                        ctx.save();
                        ctx.translate(w / 2, h / 2);
                        ctx.scale(scaleX, 1);
                        ctx.translate(-w / 2, -h / 2);
                        ctx.drawImage(progress < 0.5 ? bmA : bmB, dx, dy, dw, dh);
                        ctx.restore();
                        break;
                    }
                    case 'zoom': {
                        // rectA is at 1.06x (final Ken Burns state) — fades out without snapping
                        ctx.fillStyle = '#000000';
                        ctx.fillRect(0, 0, w, h);
                        ctx.globalAlpha = 1 - progress;
                        ctx.drawImage(bmA, rectA.dx, rectA.dy, rectA.dw, rectA.dh);
                        // B fades in at 1.0x — Ken Burns zooms it in during static frames
                        ctx.globalAlpha = progress;
                        ctx.drawImage(bmB, rectB.dx, rectB.dy, rectB.dw, rectB.dh);
                        ctx.globalAlpha = 1;
                        break;
                    }
                    default:
                        drawImageCentered(ctx, bmB, w, h);
                }
            };

            const isZoom = transition === 'zoom';

            for (let i = 0; i < bitmaps.length; i++) {
                const imgDuration = imageDurations[i] || 3;
                const staticFrames = Math.round(imgDuration * fps);
                const bmA = bitmaps[i];
                // Hoist base scale outside the per-frame loop (same bitmap/canvas every frame)
                const kbBaseScale = isZoom ? Math.min(canvasW / bmA.width, canvasH / bmA.height) : 0;

                // Static frames
                for (let f = 0; f < staticFrames; f++) {
                    if (isZoom) {
                        // Ken Burns: slow zoom from 1.0x to 1.06x, centered
                        const progress = f / Math.max(staticFrames - 1, 1);
                        const scale = kbBaseScale * (1 + progress * 0.06);
                        const dw = bmA.width * scale;
                        const dh = bmA.height * scale;
                        ctx.fillStyle = '#000000';
                        ctx.fillRect(0, 0, canvasW, canvasH);
                        ctx.drawImage(bmA, (canvasW - dw) / 2, (canvasH - dh) / 2, dw, dh);
                    } else {
                        drawImageCentered(ctx, bmA, canvasW, canvasH);
                    }
                    await canvasSource.add(outputTimestamp, frameDur);
                    outputTimestamp += frameDur;
                    totalFramesRendered++;
                    if (onProgress) onProgress(totalFramesRendered / totalFrames * 0.85);
                }

                // Transition to next image
                if (useTransition && i < bitmaps.length - 1) {
                    const bmB = bitmaps[i + 1];
                    // Pre-compute rects once per transition pair (zoom case uses 1.06x for A)
                    const rectA = getCenteredRect(bmA, canvasW, canvasH, isZoom ? 1.06 : 1);
                    const rectB = getCenteredRect(bmB, canvasW, canvasH);
                    const transFrames = Math.round(transDur * fps);
                    for (let f = 0; f < transFrames; f++) {
                        const progress = transFrames > 1 ? f / (transFrames - 1) : 1;
                        renderTransitionFrame(ctx, bmA, bmB, rectA, rectB, progress, transition, canvasW, canvasH);
                        await canvasSource.add(outputTimestamp, frameDur);
                        outputTimestamp += frameDur;
                        totalFramesRendered++;
                        if (onProgress) onProgress(totalFramesRendered / totalFrames * 0.85);
                    }
                }
            }

            Logger.log(`[MediaProcessor] Rendered ${totalFramesRendered} frames, total ts: ${outputTimestamp.toFixed(3)}s`);

            // Step 5: Audio — decode via Web Audio API, loop if needed
            if (audioSource && audioBlob) {
                const audioContext = new AudioContext();
                try {
                    Logger.log('[MediaProcessor] Adding background music...');
                    const arrayBuffer = await audioBlob.arrayBuffer();
                    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

                    const sampleRate = audioBuffer.sampleRate;
                    const numChannels = audioBuffer.numberOfChannels;
                    const trackDur = audioBuffer.duration;

                    if (trackDur > 0) {
                        let outputTs = 0;
                        let passStart = 0; // offset into audioBuffer in seconds

                        while (outputTs < totalDuration) {
                            const remaining = totalDuration - outputTs;
                            const chunkDur = Math.min(trackDur - passStart, remaining);
                            if (chunkDur <= 0) break;

                            const startSample = Math.floor(passStart * sampleRate);
                            const chunkSamples = Math.ceil(chunkDur * sampleRate);
                            const endSample = Math.min(startSample + chunkSamples, audioBuffer.length);
                            const actualSamples = endSample - startSample;
                            if (actualSamples <= 0) break;

                            const chunkBuffer = audioContext.createBuffer(numChannels, actualSamples, sampleRate);
                            for (let ch = 0; ch < numChannels; ch++) {
                                const src = audioBuffer.getChannelData(ch);
                                const dst = chunkBuffer.getChannelData(ch);
                                dst.set(src.subarray(startSample, endSample));
                            }

                            const samples = MediaBunny.AudioSample.fromAudioBuffer(chunkBuffer, outputTs);
                            const samplesArr = Array.isArray(samples) ? samples : [samples];
                            for (const sample of samplesArr) {
                                await audioSource.add(sample);
                                sample.close();
                            }

                            outputTs += chunkDur;
                            passStart += chunkDur;

                            // Start next loop pass
                            if (passStart >= trackDur) {
                                if (!audioLoop) break;
                                passStart = 0;
                            }
                        }
                    }
                } catch (e) {
                    Logger.warn('[MediaProcessor] Audio processing failed for slideshow:', e);
                } finally {
                    await audioContext.close();
                }
            }

            // Step 6: Finalize
            canvasSource.close();
            if (audioSource) audioSource.close();
            await output.finalize();

            if (onProgress) onProgress(1.0);

            Logger.log('[MediaProcessor] Slideshow complete!');
            return new Blob([output.target.buffer], { type: 'video/mp4' });

        } finally {
            if (output && typeof output.dispose === 'function') {
                try { output.dispose(); } catch (e) { Logger.warn('Error disposing output:', e); }
            }
            if (canvasSource && typeof canvasSource.dispose === 'function') {
                try { canvasSource.dispose(); } catch (e) { Logger.warn('Error disposing canvasSource:', e); }
            }
            if (audioSource && typeof audioSource.dispose === 'function') {
                try { audioSource.dispose(); } catch (e) { Logger.warn('Error disposing audioSource:', e); }
            }
        }
    }

    /**
     * Apply chroma key to image data
     * @param {ImageData} imageData - The image data to modify in-place
     * @param {Array} colors - Array of {r, g, b, tolerance} objects
     * @param {string} bgType - 'transparent' or 'custom'
     * @param {string} bgColor - Hex color string for custom background
     */
    static applyChromaKey(imageData, colors, bgType = 'transparent', bgColor = '#000000') {
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        const maxDist = 441.67; // Sqrt(255^2 + 255^2 + 255^2)

        // Parse custom background color if needed
        let bgR = 0, bgG = 0, bgB = 0;
        if (bgType === 'custom') {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(bgColor);
            if (result) {
                bgR = parseInt(result[1], 16);
                bgG = parseInt(result[2], 16);
                bgB = parseInt(result[3], 16);
            }
        }

        // Optimization: Pre-calculate key color values
        const keyColors = colors.map(c => ({
            r: c.r,
            g: c.g,
            b: c.b,
            similarity: c.similarity !== undefined ? c.similarity : 0.0, // 0.4
            smoothness: c.smoothness !== undefined ? c.smoothness : 0.08,
            spill: c.spill !== undefined ? c.spill : 0.1
        }));

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            let finalAlpha = 1.0;
            let finalR = r;
            let finalG = g;
            let finalB = b;

            // Check against all selected colors
            for (const key of keyColors) {
                const dist = Math.sqrt((r - key.r) ** 2 + (g - key.g) ** 2 + (b - key.b) ** 2);
                const normalizedDist = dist / maxDist;

                let alpha = 1.0;
                if (normalizedDist < key.similarity) {
                    alpha = 0.0;
                } else if (normalizedDist < key.similarity + key.smoothness) {
                    alpha = (normalizedDist - key.similarity) / key.smoothness;
                }

                // If this color matches better (lower alpha), use its result
                if (alpha < finalAlpha) {
                    finalAlpha = alpha;

                    // Spill suppression
                    if (alpha < 1.0 && key.spill > 0) {
                        const gray = (r * 0.299 + g * 0.587 + b * 0.114);
                        const spillFactor = key.spill * (1.0 - normalizedDist); // Simple spill model
                        if (spillFactor > 0) {
                            finalR = r * (1 - spillFactor) + gray * spillFactor;
                            finalG = g * (1 - spillFactor) + gray * spillFactor;
                            finalB = b * (1 - spillFactor) + gray * spillFactor;
                        }
                    }
                }
            }

            // Apply result
            if (bgType === 'transparent') {
                data[i] = finalR;
                data[i + 1] = finalG;
                data[i + 2] = finalB;
                data[i + 3] = finalAlpha * 255;
            } else {
                // Composite with custom background
                // Result = Foreground * Alpha + Background * (1 - Alpha)
                data[i] = finalR * finalAlpha + bgR * (1 - finalAlpha);
                data[i + 1] = finalG * finalAlpha + bgG * (1 - finalAlpha);
                data[i + 2] = finalB * finalAlpha + bgB * (1 - finalAlpha);
                data[i + 3] = 255; // Full opacity for custom background
            }
        }
    }


}

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
     * @returns {number} Bitrate in bits per second
     */
    static _getBitrate(quality, pixelCount) {
        let q = 80;
        if (typeof quality === 'number') {
            q = quality;
        } else if (quality === 'high') {
            q = 90;
        } else if (quality === 'medium') {
            q = 60;
        } else if (quality === 'low') {
            q = 30;
        }

        // Base bitrate for 720p (approx 0.9M pixels)
        const basePixels = 1280 * 720;
        const baseBitrate = 2500000; // 2.5 Mbps

        // Scale by pixel count
        const pixelFactor = pixelCount > 0 ? pixelCount / basePixels : 1;

        // Calculate target
        let targetBitrate = baseBitrate * pixelFactor * (q / 80);

        // Clamp limits (500 Kbps - 50 Mbps)
        return Math.floor(Math.max(500000, Math.min(50000000, targetBitrate)));
    }

    /**
     * Process video (transcode, trim, resize, etc.)
     * @param {Object} options
     * @param {Blob|File} options.source
     * @param {string} options.format - 'mp4', 'webm', 'mov'
     * @param {number} options.quality - 0-100
     * @param {Object} [options.trim] - { start, end } in seconds
     * @param {Object} [options.resolution] - { width, height }
     * @param {Object} [options.removeBackgroundOptions] - { colors, bgType, bgColor }
     * @param {Function} [options.onProgress]
     * @returns {Promise<Blob>}
     */
    static async process({ source, format = 'mp4', quality = 'high', resolution = null, trim = null, removeBackgroundOptions = null, onProgress }) {
        console.log('[MediaProcessor] Starting processing...', { format, quality, resolution, trim, removeBackgroundOptions });

        let conversion = null;
        let videoUrl = null;
        let input = null;
        let output = null;

        // If removing background, we need to handle it via the process callback
        // and potentially force transcoding to a format that supports alpha (WebM) if transparent
        if (removeBackgroundOptions && removeBackgroundOptions.bgType === 'transparent') {
            format = 'webm';
        }

        try {
            const blobSource = new MediaBunny.BlobSource(source);
            input = new MediaBunny.Input({
                source: blobSource,
                formats: MediaBunny.ALL_FORMATS
            });

            // Get video track to determine dimensions if needed
            const videoTrack = await input.getPrimaryVideoTrack();
            if (!videoTrack) throw new Error('No video track found');

            const originalWidth = videoTrack.displayWidth || videoTrack.codedWidth;
            const originalHeight = videoTrack.displayHeight || videoTrack.codedHeight;

            // Configure Output Format
            let outputFormat;
            if (format === 'gif') {
                // ... GIF logic remains separate for now as it uses a different pipeline ...
                return this.createGif({ source, trim, onProgress });
            } else if (format === 'webm') {
                outputFormat = new MediaBunny.WebMOutputFormat();
            } else {
                outputFormat = new MediaBunny.Mp4OutputFormat();
            }

            output = new MediaBunny.Output({
                format: outputFormat,
                target: new MediaBunny.BufferTarget()
            });

            // Configure Video Options
            const videoConfig = {
                codec: format === 'webm' ? 'vp9' : 'avc', // VP9 for WebM (alpha support), AVC for MP4
                bitrate: this._getBitrate(quality, originalWidth * originalHeight),
                forceTranscode: true // Ensure quality settings are applied
            };

            // Resolution
            if (resolution) {
                videoConfig.width = resolution.width;
                videoConfig.height = resolution.height;
                videoConfig.fit = 'fill'; // Use fill as requested
            }

            // Process callback for frame manipulation
            // We define this generically so it can be extended for other features
            const useOffscreen = typeof OffscreenCanvas !== 'undefined';
            let canvas = null;
            let ctx = null;

            videoConfig.process = (sample) => {
                // If no processing options are active, return sample as-is
                if (!removeBackgroundOptions) {
                    return sample;
                }

                const width = sample.codedWidth;
                const height = sample.codedHeight;

                if (!canvas || canvas.width !== width || canvas.height !== height) {
                    if (useOffscreen) {
                        canvas = new OffscreenCanvas(width, height);
                    } else {
                        canvas = document.createElement('canvas');
                        canvas.width = width;
                        canvas.height = height;
                    }
                    ctx = canvas.getContext('2d', { willReadFrequently: true });
                }

                // Draw frame
                ctx.clearRect(0, 0, width, height);
                sample.draw(ctx, 0, 0, width, height);

                // Get image data
                const imageData = ctx.getImageData(0, 0, width, height);

                // Apply Background Removal if requested
                if (removeBackgroundOptions) {
                    const { colors, bgType, bgColor } = removeBackgroundOptions;
                    MediaProcessor.applyChromaKey(imageData, colors, bgType, bgColor);
                }

                // Put modified data back
                ctx.putImageData(imageData, 0, 0);

                return canvas;
            };

            // Initialize Conversion
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
                    console.warn('Error disposing conversion:', e);
                }
            }

            if (output && typeof output.dispose === 'function') {
                try {
                    output.dispose();
                } catch (e) {
                    console.warn('Error disposing output:', e);
                }
            }

            if (input && typeof input.dispose === 'function') {
                try {
                    input.dispose();
                } catch (e) {
                    console.warn('Error disposing input:', e);
                }
            }

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
                    console.warn('Error disposing input in getVideoStats:', e);
                }
            }
        }
    }

    /**
     * Get tracks from media
     * @param {Blob|File} source
     * @returns {Promise<{video: Array, audio: Array}>}
     */
    static async getTracks(source) {
        const blobSource = new MediaBunny.BlobSource(source);
        const input = new MediaBunny.Input({
            source: blobSource,
            formats: MediaBunny.ALL_FORMATS
        });

        try {
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
                        width: track.displayWidth,
                        height: track.displayHeight,
                        channels: track.numberOfChannels,
                        sampleRate: track.sampleRate,
                    };
                }));
            };

            const videoTracksInfo = await formatTrackInfo(videoTracks);
            const audioTracksInfo = await formatTrackInfo(audioTracks);

            return {
                video: videoTracksInfo,
                audio: audioTracksInfo
            };
        } finally {
            // Clean up
            // MediaBunny handles cleanup internally
        }
    }

    /**
     * Get formatted metadata for caching
     * Returns videoInfo and audioInfo objects ready to be stored on playlist items
     * @param {Blob|File} source 
     * @returns {Promise<{videoInfo: Object|null, audioInfo: Object|null, duration: number}>}
     */
    static async getMetadata(source) {
        const blobSource = new MediaBunny.BlobSource(source);
        const input = new MediaBunny.Input({
            source: blobSource,
            formats: MediaBunny.ALL_FORMATS
        });

        try {
            const videoTracks = await input.getVideoTracks();
            const audioTracks = await input.getAudioTracks();

            let videoInfo = null;
            let audioInfo = null;
            let duration = 0;

            // Extract video metadata
            if (videoTracks && videoTracks.length > 0) {
                const videoTrack = videoTracks[0]; // Use primary track
                duration = await videoTrack.computeDuration();

                videoInfo = {
                    width: videoTrack.width || videoTrack.displayWidth,
                    height: videoTrack.height || videoTrack.displayHeight,
                    displayWidth: videoTrack.displayWidth,
                    displayHeight: videoTrack.displayHeight,
                    codedWidth: videoTrack.codedWidth,
                    codedHeight: videoTrack.codedHeight,
                    codec: videoTrack.codec,
                    rotation: videoTrack.rotation || 0,
                    hasHDR: false // Computed on-demand if needed
                };

                // Calculate FPS and Bitrate
                try {
                    const stats = await videoTrack.computePacketStats(50);
                    videoInfo.fps = Math.round(stats.averagePacketRate);
                    videoInfo.bitrate = stats.averageBitrate;
                } catch (e) {
                    console.warn('Failed to compute packet stats:', e);
                    videoInfo.fps = 0;
                    videoInfo.bitrate = 0;
                }
            }

            // Extract audio metadata
            if (audioTracks && audioTracks.length > 0) {
                const audioTrack = audioTracks[0]; // Use primary track
                if (!duration) {
                    duration = await audioTrack.computeDuration();
                }

                audioInfo = {
                    codec: audioTrack.codec,
                    channels: audioTrack.numberOfChannels,
                    sampleRate: audioTrack.sampleRate,
                    languageCode: audioTrack.languageCode
                };
            }

            return { videoInfo, audioInfo, duration };
        } finally {
            // MediaBunny handles cleanup
            if (input && typeof input.dispose === 'function') {
                try {
                    input.dispose();
                } catch (e) {
                    console.warn('Error disposing input in getMetadata:', e);
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
     * @param {Function} [options.onProgress]
     * @returns {Promise<Blob>}
     */
    static async extractTrack({ source, trackIndex, trackType, format, onProgress }) {
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
                    console.log(`[MediaProcessor] Video track ${i} (${t.codec}): ${keep ? 'KEEP' : 'DISCARD'}`);
                    return keep ? {} : { discard: true };
                },
                audio: (t, i) => {
                    const keep = trackType === 'audio' && (i - 1) === trackIndex;
                    console.log(`[MediaProcessor] Audio track ${i} (${t.codec}): ${keep ? 'KEEP' : 'DISCARD'}`);
                    return keep ? {} : { discard: true };
                }
            };

            conversion = await MediaBunny.Conversion.init(config);

            if (!conversion.isValid) {
                console.error('Conversion invalid:', conversion.discardedTracks);
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
                    console.warn('Error disposing conversion in extractTrack:', e);
                }
            }

            if (output && typeof output.dispose === 'function') {
                try {
                    output.dispose();
                } catch (e) {
                    console.warn('Error disposing output in extractTrack:', e);
                }
            }

            if (input && typeof input.dispose === 'function') {
                try {
                    input.dispose();
                } catch (e) {
                    console.warn('Error disposing input in extractTrack:', e);
                }
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

        console.log('[MediaProcessor] Starting merge of', inputs.length, 'videos');

        // Track all objects for cleanup
        const inputObjects = [];
        let output = null;
        let canvasSource = null;
        let audioSource = null;
        const canvas = document.createElement('canvas');

        try {
            // Step 1: Analyze all input videos
            console.log('[MediaProcessor] Step 1: Analyzing input videos...');
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

                console.log(`[MediaProcessor] Video ${i + 1}: ${width}x${height}, ${duration}s, codec: ${videoTrack.codec}`);

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

            console.log(`[MediaProcessor] Target specs: ${targetWidth}x${targetHeight} @ ${targetFps}fps`);

            // Step 2: Create output
            console.log('[MediaProcessor] Step 2: Setting up output...');

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
                bitrate: 5000000,
                frameRate: targetFps
            });

            output.addVideoTrack(canvasSource, { frameRate: targetFps });

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
                    console.warn('[MediaProcessor] No supported audio codecs found, merge will be video-only');
                    audioCodec = null;
                } else {
                    audioCodec = supportedCodecs[0];
                    console.log(`[MediaProcessor] Using audio codec: ${audioCodec}`);
                }
            }

            if (audioCodec) {
                audioSource = new MediaBunny.AudioSampleSource({
                    codec: audioCodec,
                    bitrate: audioBitrate
                });
                output.addAudioTrack(audioSource);
                console.log(`[MediaProcessor] Audio output: ${targetChannels} channels @ ${targetSampleRate}Hz`);
            }

            await output.start();

            // Step 3: Process each video
            let currentTimestamp = 0;

            for (let i = 0; i < videoInfos.length; i++) {
                console.log(`[MediaProcessor] Processing video ${i + 1}/${videoInfos.length}...`);

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

                console.log(`[MediaProcessor] Processed ${frameCount} frames from video ${i + 1}`);

                // Process audio
                if (audioSource && audioTrack) {
                    const canDecodeAudio = await audioTrack.canDecode();
                    if (canDecodeAudio) {
                        console.log(`[MediaProcessor] Processing audio from video ${i + 1}...`);

                        const audioSink = new MediaBunny.AudioSampleSink(audioTrack);
                        const audioStartTime = await audioTrack.getFirstTimestamp();
                        let audioSampleCount = 0;

                        // Check if audio needs resampling or channel remixing
                        const needsResampling = audioTrack.sampleRate !== targetSampleRate;
                        const needsRemixing = audioTrack.numberOfChannels !== targetChannels;

                        if (needsResampling || needsRemixing) {
                            console.log(`[MediaProcessor] Audio conversion needed: ${audioTrack.numberOfChannels}ch @ ${audioTrack.sampleRate}Hz -> ${targetChannels}ch @ ${targetSampleRate}Hz`);
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
                                    console.error(`[MediaProcessor] Error resampling audio:`, resampleError);
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

                        console.log(`[MediaProcessor] Processed ${audioSampleCount} audio samples from video ${i + 1}`);
                    } else {
                        console.warn(`[MediaProcessor] Cannot decode audio from video ${i + 1}, skipping`);
                    }
                } else if (!audioSource && audioTrack) {
                    console.log(`[MediaProcessor] No audio encoder available, skipping audio`);
                }

                // Update timestamp for next video
                currentTimestamp += info.duration;

                if (onProgress) {
                    const overallProgress = 0.5 + ((i + 1) / (videoInfos.length * 2));
                    onProgress(overallProgress);
                }
            }

            // Step 4: Finalize
            console.log('[MediaProcessor] Finalizing merge...');
            canvasSource.close();
            if (audioSource) {
                audioSource.close();
            }
            await output.finalize();

            if (onProgress) onProgress(1.0);

            console.log('[MediaProcessor] Merge complete!');
            return new Blob([output.target.buffer], { type: `video/${format}` });

        } catch (error) {
            console.error('[MediaProcessor] Merge failed:', error);
            throw new Error(`Video merge failed: ${error.message}`);
        } finally {
            // CRITICAL: Clean up all MediaBunny resources to prevent memory leaks
            console.log('[MediaProcessor] Cleaning up resources...');

            // Dispose Output
            if (output && typeof output.dispose === 'function') {
                try {
                    output.dispose();
                } catch (e) {
                    console.warn('Error disposing output during merge cleanup:', e);
                }
            }

            // Dispose CanvasSource
            if (canvasSource && typeof canvasSource.dispose === 'function') {
                try {
                    canvasSource.dispose();
                } catch (e) {
                    console.warn('Error disposing canvasSource during merge cleanup:', e);
                }
            }

            // Dispose AudioSource
            if (audioSource && typeof audioSource.dispose === 'function') {
                try {
                    audioSource.dispose();
                } catch (e) {
                    console.warn('Error disposing audioSource during merge cleanup:', e);
                }
            }

            // Dispose all Input objects
            for (const input of inputObjects) {
                if (input && typeof input.dispose === 'function') {
                    try {
                        input.dispose();
                    } catch (e) {
                        console.warn('Error disposing input during merge cleanup:', e);
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

            console.log('[MediaProcessor] Cleanup complete');
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
     * Reverse video playback
     * @param {Object} options
     * @param {Blob|File} options.source
     * @param {boolean} options.includeAudio
     * @param {Function} [options.onProgress]
     * @returns {Promise<Blob>}
     */
    static async reverseVideo({ source, includeAudio = false, onProgress }) {
        console.log('[MediaProcessor] Starting video reversal...');

        const blobSource = new MediaBunny.BlobSource(source);
        const input = new MediaBunny.Input({
            source: blobSource,
            formats: MediaBunny.ALL_FORMATS
        });

        let output = null;
        let canvasSource = null;
        let audioSource = null;

        // Use OffscreenCanvas if available, otherwise regular canvas
        const useOffscreen = typeof OffscreenCanvas !== 'undefined';
        let canvas = null;
        let ctx = null;

        try {
            // Step 1: Analyze input
            const videoTrack = await input.getPrimaryVideoTrack();
            if (!videoTrack) throw new Error('No video track found');

            const width = videoTrack.displayWidth || videoTrack.codedWidth;
            const height = videoTrack.displayHeight || videoTrack.codedHeight;
            const duration = await videoTrack.computeDuration();

            // Compute frame rate from metadata
            let fps = 30;
            try {
                const stats = await videoTrack.computePacketStats();
                fps = stats.averagePacketRate || 30;
            } catch (e) {
                console.warn("[MediaProcessor] Could not compute frame rate, defaulting to 30fps", e);
            }

            console.log(`[MediaProcessor] Source: ${width}x${height}, ${duration}s, ${fps}fps`);

            // Step 2: Setup Output
            const outputFormat = new MediaBunny.Mp4OutputFormat();
            output = new MediaBunny.Output({
                format: outputFormat,
                target: new MediaBunny.BufferTarget()
            });

            // Setup Canvas for encoding
            if (useOffscreen) {
                canvas = new OffscreenCanvas(width, height);
            } else {
                canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
            }
            ctx = canvas.getContext('2d', { willReadFrequently: true });

            canvasSource = new MediaBunny.CanvasSource(canvas, {
                codec: 'avc',
                bitrate: 5000000, // 5 Mbps
                frameRate: fps
            });

            output.addVideoTrack(canvasSource, { frameRate: fps });

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

            // Step 3: Extract Frames
            console.log('[MediaProcessor] Extracting frames...');
            const frames = [];
            const videoSink = new MediaBunny.VideoSampleSink(videoTrack);

            let extractedCount = 0;

            // Temporary canvas for extraction
            let tempCanvas;
            let tempCtx;
            if (useOffscreen) {
                tempCanvas = new OffscreenCanvas(width, height);
            } else {
                tempCanvas = document.createElement('canvas');
                tempCanvas.width = width;
                tempCanvas.height = height;
            }
            tempCtx = tempCanvas.getContext('2d');

            for await (const sample of videoSink.samples()) {
                // Update progress (0-40%)
                if (onProgress) onProgress(extractedCount / (duration * fps) * 0.4);

                // Draw to temp canvas
                sample.draw(tempCtx, 0, 0, width, height);

                // Create bitmap
                const bitmap = await createImageBitmap(tempCanvas);
                frames.push({
                    bitmap: bitmap,
                    duration: sample.duration || (1 / fps)
                });

                sample.close();
                extractedCount++;
            }

            console.log(`[MediaProcessor] Extracted ${frames.length} frames`);

            // Step 4: Reverse and Encode
            console.log('[MediaProcessor] Encoding reversed frames...');

            // Reverse frames array
            frames.reverse();

            let currentTime = 0;
            for (let i = 0; i < frames.length; i++) {
                const frame = frames[i];

                // Update progress (40-90%)
                if (onProgress) onProgress(0.4 + (i / frames.length * 0.5));

                // Draw bitmap to encoding canvas
                ctx.drawImage(frame.bitmap, 0, 0);

                // Add to output
                await canvasSource.add(currentTime, frame.duration);

                currentTime += frame.duration;

                // Cleanup bitmap
                frame.bitmap.close();
            }

            // Step 5: Handle Audio (if requested)
            if (includeAudio && audioSource) {
                console.log('[MediaProcessor] Reversing audio...');
                try {
                    const audioTrack = await input.getPrimaryAudioTrack();
                    if (audioTrack) {
                        const audioSink = new MediaBunny.AudioSampleSink(audioTrack);
                        const samples = [];

                        // Collect all samples
                        for await (const sample of audioSink.samples()) {
                            samples.push(sample);
                        }

                        console.log(`[MediaProcessor] Collected ${samples.length} audio samples`);

                        // Reverse order
                        samples.reverse();

                        let currentAudioTime = 0;

                        for (const sample of samples) {
                            // Convert to AudioBuffer
                            const buffer = await sample.toAudioBuffer();

                            // Reverse data in each channel
                            for (let c = 0; c < buffer.numberOfChannels; c++) {
                                const data = buffer.getChannelData(c);
                                data.reverse();
                            }

                            // Create new sample(s)
                            const reversedSamples = MediaBunny.AudioSample.fromAudioBuffer(buffer, currentAudioTime);

                            const samplesToAdd = Array.isArray(reversedSamples) ? reversedSamples : [reversedSamples];

                            for (const s of samplesToAdd) {
                                await audioSource.add(s);
                                currentAudioTime += s.duration;
                                if (s !== sample) s.close(); // Close new sample after adding
                            }

                            sample.close(); // Close original sample
                        }
                        console.log('[MediaProcessor] Audio reversal complete');
                    }
                } catch (e) {
                    console.warn('[MediaProcessor] Audio reversal failed:', e);
                }
            }

            // Step 6: Finalize
            console.log('[MediaProcessor] Finalizing...');
            canvasSource.close();
            if (audioSource) audioSource.close();
            await output.finalize();

            if (onProgress) onProgress(1.0);

            return new Blob([output.target.buffer], { type: 'video/mp4' });

        } finally {
            // Cleanup
            if (input && typeof input.dispose === 'function') {
                try { input.dispose(); } catch (e) { console.warn('Error disposing input:', e); }
            }
            if (output && typeof output.dispose === 'function') {
                try { output.dispose(); } catch (e) { console.warn('Error disposing output:', e); }
            }
            if (canvasSource && typeof canvasSource.dispose === 'function') {
                try { canvasSource.dispose(); } catch (e) { console.warn('Error disposing canvasSource:', e); }
            }
            if (audioSource && typeof audioSource.dispose === 'function') {
                try { audioSource.dispose(); } catch (e) { console.warn('Error disposing audioSource:', e); }
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
            similarity: c.similarity !== undefined ? c.similarity : 0.4,
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

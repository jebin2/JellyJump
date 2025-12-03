import { MediaBunny } from './MediaBunny.js';

/**
 * MediaProcessor
 * Core service for handling video format conversion and optimization.
 */
export class MediaProcessor {
    /**
     * Process video (transcode, trim, etc.)
     * @param {Object} options
     * @param {Blob|File} options.source
     * @param {string} options.format - 'mp4', 'webm', 'mov', 'keep'
     * @param {number} options.quality - 0-100
     * @param {Object} [options.trim] - { start: number, end: number }
     * @param {Function} [options.onProgress]
     * @returns {Promise<Blob>}
     */
    /**
     * Process video (transcode, trim, resize, etc.)
     * @param {Object} options
     * @param {Blob|File} options.source
     * @param {string} options.format - 'mp4', 'webm', 'mov', 'keep'
     * @param {number} options.quality - 0-100
     * @param {Object} [options.trim] - { start: number, end: number }
     * @param {Object} [options.resize] - { width: number, height: number }
     * @param {Function} [options.onProgress]
     * @returns {Promise<Blob>}
     */
    static async process({ source, format, quality, trim, resize, onProgress }) {
        const blobSource = new MediaBunny.BlobSource(source);
        const input = new MediaBunny.Input({ source: blobSource, formats: MediaBunny.ALL_FORMATS });

        // Determine Output Format
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

        const output = new MediaBunny.Output({
            format: outputFormat,
            target: new MediaBunny.BufferTarget()
        });

        // Configure Video Encoder
        let videoConfig = {};

        if (quality < 100) {
            // Simple bitrate calculation based on quality
            // 100 = Copy (if possible) or High Bitrate
            // 80 = High
            // 60 = Medium
            // 40 = Low
            let bitrate;
            if (quality >= 80) bitrate = 2500000; // 2.5 Mbps
            else if (quality >= 60) bitrate = 1500000; // 1.5 Mbps
            else bitrate = 800000; // 800 Kbps

            videoConfig = {
                bitrate: bitrate,
                forceTranscode: true
            };
        }

        // Configure Resize
        if (resize && resize.width && resize.height) {
            videoConfig.width = resize.width;
            videoConfig.height = resize.height;
            videoConfig.fit = 'fill'; // Match exact dimensions
            videoConfig.forceTranscode = true;
        }

        const conversion = await MediaBunny.Conversion.init({
            input: input,
            output: output,
            video: videoConfig,
            trim: trim // Pass trim options directly to init
        });

        if (onProgress) {
            conversion.onProgress = onProgress;
        }

        await conversion.execute();

        return new Blob([output.target.buffer], { type: `video/${format}` });
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

        const videoTracks = await input.getVideoTracks();
        const audioTracks = await input.getAudioTracks();

        // Enrich tracks with computed duration and codec string
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
                    // Video specific
                    width: track.displayWidth,
                    height: track.displayHeight,
                    // Audio specific
                    channels: track.numberOfChannels,
                    sampleRate: track.sampleRate,
                    // Original track object for reference if needed (but avoid passing complex objects if possible)
                    // We'll use index for selection which is safer
                };
            }));
        };

        return {
            video: await formatTrackInfo(videoTracks),
            audio: await formatTrackInfo(audioTracks)
        };
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

        const config = {
            input: input,
            output: output,
            video: (t, i) => {
                // MediaBunny uses 1-based indexing for tracks in the callback
                const keep = trackType === 'video' && (i - 1) === trackIndex;
                console.log(`[MediaProcessor] Video track ${i} (${t.codec}): ${keep ? 'KEEP' : 'DISCARD'} (Target: ${trackType} #${trackIndex})`);
                return keep ? {} : { discard: true };
            },
            audio: (t, i) => {
                // MediaBunny uses 1-based indexing for tracks in the callback
                const keep = trackType === 'audio' && (i - 1) === trackIndex;
                console.log(`[MediaProcessor] Audio track ${i} (${t.codec}): ${keep ? 'KEEP' : 'DISCARD'} (Target: ${trackType} #${trackIndex})`);
                return keep ? {} : { discard: true };
            }
        };

        const conversion = await MediaBunny.Conversion.init(config);

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
    }

    /**
     * Merge multiple videos using MediaBunny Output API
     * Based on working implementation that uses CanvasSource and manual frame processing
     * 
     * @param {Object} options
     * @param {Array<Blob|File>} options.inputs - List of input files/blobs
     * @param {string} options.format - 'mp4', 'webm', etc.
     * @param {Object} [options.resolution] - { width: number, height: number } (Optional target resolution)
     * @param {Function} [options.onProgress]
     * @returns {Promise<Blob>}
     */
    static async merge({ inputs, format = 'mp4', resolution, onProgress }) {
        if (!inputs || inputs.length < 2) {
            throw new Error('At least 2 videos are required for merging.');
        }

        console.log('[MediaProcessor] Starting merge of', inputs.length, 'videos');

        // Skip standardization - work with source files directly
        // MediaBunny Output API will handle format normalization
        const sourceFiles = inputs;

        // Step 1: Gather metadata from source clips
        console.log('[MediaProcessor] Gathering metadata...');
        const clipMetadata = [];
        for (const file of sourceFiles) {
            const input = new MediaBunny.Input({
                source: new MediaBunny.BlobSource(file),
                formats: MediaBunny.ALL_FORMATS
            });
            const videoTrack = await input.getPrimaryVideoTrack();
            if (!videoTrack) throw new Error('No video track found in input file');

            // TODO: Audio support - currently disabled due to timestamp concatenation issues
            // Will need to decode/re-encode audio instead of direct packet concatenation
            const audioTrack = null;
            const audioConfig = null;

            const videoConfig = await videoTrack.getDecoderConfig();
            const duration = await videoTrack.computeDuration();

            clipMetadata.push({ duration, videoTrack, audioTrack, videoConfig, audioConfig });
        }

        // Step 2: Setup output
        const outputFps = 30; // Standard 30fps for merged output
        const standardFormat = {
            videoCodec: 'avc',
            audioCodec: 'opus',
            audioSampleRate: 48000
        };

        const firstClip = clipMetadata[0];
        const outputWidth = resolution?.width || firstClip.videoConfig.codedWidth;
        const outputHeight = resolution?.height || firstClip.videoConfig.codedHeight;
        // Setup output with video track only (audio support coming later)
        const output = new MediaBunny.Output({
            target: new MediaBunny.BufferTarget(),
            format: new MediaBunny.Mp4OutputFormat()
        });

        // Step 3: Setup canvas for video processing
        const canvas = document.createElement('canvas');
        canvas.width = outputWidth;
        canvas.height = outputHeight;
        const ctx = canvas.getContext('2d');

        const canvasSource = new MediaBunny.CanvasSource(canvas, {
            codec: standardFormat.videoCodec,
            bitrate: 10000000 // 10 Mbps
        });
        output.addVideoTrack(canvasSource, { frameRate: outputFps });

        await output.start();

        // Step 4: Process video clips
        console.log('[MediaProcessor] Processing video frames...');
        let currentVideoTimestamp = 0;
        let maxVideoTimestamp = 0;
        let processedClips = 0;

        for (const clip of clipMetadata) {
            const frames = [];
            let decoderError = null;

            // Log the decoder config we're trying to use
            console.log('[MediaProcessor] Decoder config:', JSON.stringify(clip.videoConfig, null, 2));

            // Check codec support
            const codecSupport = await VideoDecoder.isConfigSupported(clip.videoConfig);
            console.log('[MediaProcessor] Codec support:', codecSupport);

            if (!codecSupport.supported) {
                throw new Error(`Video codec not supported: ${clip.videoConfig.codec}`);
            }

            const decoder = new VideoDecoder({
                output: (frame) => frames.push(frame),
                error: (e) => {
                    console.error('[MediaProcessor] Video decoder error:', e);
                    decoderError = e; // Store error instead of throwing
                }
            });

            try {
                decoder.configure(clip.videoConfig);

                const videoPacketSink = new MediaBunny.EncodedPacketSink(clip.videoTrack);
                let packetIndex = 0;

                for await (const packet of videoPacketSink.packets()) {
                    // Log first few packets
                    if (packetIndex < 3) {
                        console.log(`[MediaProcessor] Packet ${packetIndex}:`, {
                            isKeyframe: packet.isKeyframe,
                            timestamp: packet.timestamp,
                            dataSize: packet.data?.byteLength || 0
                        });
                    }

                    // Check if decoder encountered an error
                    if (decoderError) {
                        throw new Error(`Decoding failed at packet ${packetIndex}: ${decoderError.message}`);
                    }

                    // Skip very small packets (likely metadata/SEI that causes decoder errors)
                    if (packet.data?.byteLength < 50) {
                        packetIndex++;
                        continue;
                    }

                    // MediaBunny packets may not have isKeyframe marked
                    // Treat first packet as keyframe, all others as delta
                    const isKey = (packetIndex === 0);

                    decoder.decode(new EncodedVideoChunk({
                        type: isKey ? 'key' : 'delta',
                        timestamp: packet.timestamp * 1_000_000,
                        duration: packet.duration ? packet.duration * 1_000_000 : undefined,
                        data: packet.data
                    }));

                    packetIndex++;
                }

                console.log('[MediaProcessor] Processed', packetIndex, 'packets, flushing...');
                await decoder.flush();

                // Check for errors after flush
                if (decoderError) {
                    throw new Error(`Decoding failed during flush: ${decoderError.message}`);
                }
            } finally {
                // Only close if decoder is not already closed
                if (decoder.state !== 'closed') {
                    decoder.close();
                }
            }

            // Sort frames by timestamp to ensure correct order
            frames.sort((a, b) => a.timestamp - b.timestamp);

            if (frames.length > 0) {
                const firstFrameTs = frames[0].timestamp;

                for (let i = 0; i < frames.length; i++) {
                    const frame = frames[i];

                    // Calculate relative timestamp from start of this clip (in seconds)
                    const relativeTs = (frame.timestamp - firstFrameTs) / 1_000_000;
                    const newTimestamp = currentVideoTimestamp + relativeTs;

                    // Determine duration: use frame duration if available, or calculate from next frame
                    let duration;
                    if (frame.duration) {
                        duration = frame.duration / 1_000_000;
                    } else if (i < frames.length - 1) {
                        duration = (frames[i + 1].timestamp - frame.timestamp) / 1_000_000;
                    } else {
                        // Last frame: default to 1/30s or previous frame's duration
                        duration = 1 / 30;
                    }

                    ctx.drawImage(frame, 0, 0, outputWidth, outputHeight);
                    await canvasSource.add(newTimestamp, duration);
                    maxVideoTimestamp = Math.max(maxVideoTimestamp, newTimestamp + duration);
                    frame.close();
                }
            }

            // Update timestamp for next clip based on actual frames processed
            // Add a small buffer (e.g., 1 frame duration approx 33ms) to ensure no overlap
            currentVideoTimestamp = maxVideoTimestamp + (1 / 30);

            processedClips++;
            if (onProgress) {
                onProgress(processedClips / (clipMetadata.length * 2)); // Video is first half
            }
        }

        // TODO: Step 5: Process audio clips (disabled - needs re-encoding approach)
        // Current issue: Direct encoded packet concatenation creates timestamp conflicts
        // Solution: Decode audio to PCM, concatenate, then re-encode
        // For now, merged videos are video-only
        console.log('[MediaProcessor] Audio processing skipped (video-only merge)');

        // Step 6: Finalize
        console.log('[MediaProcessor] Finalizing merge...');
        canvasSource.close();
        await output.finalize();

        if (onProgress) onProgress(1.0);
        console.log('[MediaProcessor] Merge complete!');

        return new Blob([output.target.buffer], { type: `video/${format}` });
    }
}

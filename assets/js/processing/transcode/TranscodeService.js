import { Logger } from "../../shared/utils/Logger.js";
import { MediaBunny, ensureEncoders } from '../../core/MediaBunny.js';
import { createMediaBunnyInput, getBitrate } from '../shared/InputFactory.js';
import { createGif } from '../export/GifService.js';
import { buildFrameProcessor } from '../frame/FrameProcessorService.js';
import { recordTransparentWebM } from './AlphaRecorder.js';
import { buildOverlayStage } from '../../ui/player/OverlayCompositor.js';

/**
 * Process video (transcode, trim, resize, crop, etc.)
 * @param {Object} options
 * @returns {Promise<Blob>}
 */
export async function process({ 
    source, 
    format = 'mp4', 
    quality = 'high', 
    resolution = null, 
    trim = null, 
    crop = null, 
    removeBackgroundOptions = null, 
    watermark = null, 
    blur = null, 
    rotate = 0, 
    flip = null, 
    overlays = null,
    onProgress 
}) {
    Logger.log('[TranscodeService] Starting processing...', { format, quality, resolution, trim, crop, removeBackgroundOptions, watermark, blur });

    await ensureEncoders();

    let conversion = null;
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

        input = createMediaBunnyInput(source);

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
            Logger.log(`[TranscodeService] Source analysis: ${originalWidth}x${originalHeight} (Rot: ${nativeRotation}°), ${(originalBitrate / 1000000).toFixed(2)} Mbps`);
        } catch (e) {
            Logger.warn('[TranscodeService] Could not compute original bitrate, using resolution-based defaults.');
        }

        // Get first timestamp for blur/watermark time calculations
        let firstTimestamp = 0;
        if (blur || watermarkItems || overlays) {
            try {
                firstTimestamp = await videoTrack.getFirstTimestamp();
            } catch (e) {
                Logger.warn('[TranscodeService] Could not get first timestamp for blur:', e);
            }
        }

        // Transparency cannot survive the WebCodecs encoder everything else
        // goes through -- Chrome reports alpha:'keep' unsupported for every
        // WebM codec -- so it takes a different road entirely. Awaited rather
        // than returned, because the finally below disposes the input this
        // still needs to read.
        if (removeBackgroundOptions && removeBackgroundOptions.bgType === 'transparent') {
            if (!firstTimestamp) {
                try {
                    firstTimestamp = await videoTrack.getFirstTimestamp();
                } catch (e) {
                    Logger.warn('[TranscodeService] Could not get first timestamp:', e);
                }
            }
            return await recordTransparentWebM({
                input, videoTrack,
                width: originalWidth, height: originalHeight, nativeRotation,
                removeBackgroundOptions, watermarkItems, watermarkImages, blur,
                firstTimestamp,
                onProgress,
            });
        }

        // Configure Output Format
        let outputFormat;
        if (format === 'gif') {
            return createGif({ source, trim, onProgress });
        } else if (format === 'webm') {
            outputFormat = new MediaBunny.WebMOutputFormat();
        } else if (format === 'mov' || format === 'prores') {
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

        // Bitrate must budget for the OUTPUT pixel count. When downscaling
        // (e.g. 4K -> 1080p) the source bitrate is scaled by the pixel
        // ratio first, otherwise the output carries 4K-class bitrate at
        // 1080p and barely shrinks.
        let outputWidth = originalWidth;
        let outputHeight = originalHeight;
        if (resolution) {
            const aspect = originalWidth / originalHeight;
            outputWidth = resolution.width || Math.round(resolution.height * aspect);
            outputHeight = resolution.height || Math.round(resolution.width / aspect);
        }
        const pixelRatio = Math.min(1, (outputWidth * outputHeight) / (originalWidth * originalHeight));
        const outputPixels = outputWidth * outputHeight;
        const scaledSourceBitrate = originalBitrate * pixelRatio;

        // Held separately from videoConfig.quality purely so the log below can
        // report the number: a Quality wraps it and doesn't expose it back.
        let targetBitrate = null;

        if (format === 'prores') {
            // ProRes always re-encodes; only the desktop app has an encoder for it.
            videoConfig.codec = 'prores';
            if (needsBitrateControl) {
                targetBitrate = getBitrate(quality, outputPixels, scaledSourceBitrate);
                videoConfig.quality = new MediaBunny.Quality({ bitrate: targetBitrate });
            } else {
                videoConfig.quality = MediaBunny.QUALITY_VERY_HIGH;
            }
        } else if (needsBitrateControl) {
            videoConfig.codec = (format === 'webm' || format === 'mkv') ? 'vp9' : 'avc';
            targetBitrate = getBitrate(quality, outputPixels, scaledSourceBitrate);
            videoConfig.quality = new MediaBunny.Quality({ bitrate: targetBitrate });
        }

        if (targetBitrate) {
            Logger.log(`[TranscodeService] Target: ${outputWidth}x${outputHeight} @ ${(targetBitrate / 1000000).toFixed(2)} Mbps (pixel ratio ${pixelRatio.toFixed(3)})`);
        }

        // Resolution / Rotation dimensions
        if (resolution) {
            // A single dimension lets mediabunny derive the other from the
            // source aspect ratio - exact ratio preservation. fit is only
            // valid (and only needed) when both dimensions are forced.
            if (resolution.width) videoConfig.width = resolution.width;
            if (resolution.height) videoConfig.height = resolution.height;
            if (resolution.width && resolution.height) videoConfig.fit = 'fill';
        }
        // No manual dimension swap for quarter turns: Mediabunny's width and
        // height are post-rotation, so it sizes the output itself.

        // Crop
        if (crop) {
            videoConfig.crop = {
                left: Math.round(crop.left),
                top: Math.round(crop.top),
                width: Math.round(crop.width),
                height: Math.round(crop.height)
            };
        }

        // Rotation and flipping are Mediabunny's job as of 1.57, and handing
        // them over removes the last hand-rolled transform here.
        //
        // Mediabunny's `rotate` is documented as applying on top of whatever
        // rotation the input file already carries, which is the behaviour
        // wanted here.
        //
        // By inspection -- not measurement -- the old path looked like the
        // same trap the comment above this block describes for native
        // rotation: the processor was handed `nativeRotation` and re-applied
        // it to samples that, per that comment, already arrive display
        // oriented. I could not build a fixture carrying rotation metadata to
        // confirm it (this ffmpeg bakes the rotation instead of tagging it),
        // so it is recorded as a reading of the code, not a measured fact.
        // Note the processor is still handed `nativeRotation` below for the
        // watermark, blur and background paths, so if that reading is right,
        // those combinations still have it.
        //
        // Mediabunny flips horizontally only, after rotating. A vertical flip
        // is that same horizontal flip composed with a half turn, and flipping
        // both ways is just a half turn -- so the two-axis flip this app
        // offers maps onto it exactly, with no third case.
        const flipH = !!flip?.horizontal;
        const flipV = !!flip?.vertical;
        const halfTurn = flipV ? 180 : 0;
        const rotation = (((rotate || 0) + halfTurn) % 360 + 360) % 360;
        if (rotation) videoConfig.rotate = rotation;
        if (flipH !== flipV) videoConfig.flip = true;
        if (rotation || flipH || flipV) {
            // Kept baked into the pixels, as it always has been. Mediabunny
            // would rather write orientation metadata and copy the packets --
            // faster and lossless, but it only looks right in players that
            // honour the metadata, and these files get downloaded and opened
            // elsewhere.
            videoConfig.allowTransformationMetadata = false;
        }

        if (removeBackgroundOptions || watermarkItems || blur || overlays) {
            videoConfig.process = buildFrameProcessor({
                removeBackgroundOptions, watermarkItems, watermarkImages,
                blur, rotate: 0, flip: null, nativeRotation,
                originalWidth, originalHeight, firstTimestamp,
            });
        }

        // Everything the viewer had on screen, put into the pixels. Wrapped
        // around whatever the processor already does rather than replacing it,
        // so an export can trim, key a background and carry stickers in one
        // decode/encode pass instead of several.
        //
        // Driven by each frame's own timestamp, never by the wall clock: that
        // is what makes the file agree with the preview it came from.
        if (overlays) {
            const drawFrame = videoConfig.process;
            const stage = buildOverlayStage(overlays);
            videoConfig.process = (sample) => {
                const canvas = drawFrame(sample);
                stage(canvas, (sample.timestamp - firstTimestamp) * 1000);
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

        return new Blob([output.target.buffer], { type: format === 'prores' ? 'video/quicktime' : `video/${format}` });
    } finally {
        // CRITICAL: Clean up all MediaBunny resources to prevent memory leaks
        if (conversion && typeof conversion.dispose === 'function') {
            try { conversion.dispose(); } catch (e) { Logger.warn('Error disposing conversion:', e); }
        }
        if (output && typeof output.dispose === 'function') {
            try { output.dispose(); } catch (e) { Logger.warn('Error disposing output:', e); }
        }
        if (input && typeof input.dispose === 'function') {
            try { input.dispose(); } catch (e) { Logger.warn('Error disposing input:', e); }
        }

        // Dispose watermark ImageBitmaps
        for (const img of watermarkImages.values()) {
            if (img && typeof img.close === 'function') img.close();
        }
        watermarkImages.clear();
    }
}

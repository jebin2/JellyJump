import { Logger } from "../../shared/utils/Logger.js";
import { MediaBunny, ensureEncoders } from '../../core/MediaBunny.js';
import { createMediaBunnyInput, getBitrate } from '../shared/InputFactory.js';
import { createGif } from '../export/GifService.js';
import { buildFrameProcessor } from '../frame/FrameProcessorService.js';

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
        if (blur || watermarkItems) {
            try {
                firstTimestamp = await videoTrack.getFirstTimestamp();
            } catch (e) {
                Logger.warn('[TranscodeService] Could not get first timestamp for blur:', e);
            }
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

        if (format === 'prores') {
            // ProRes always re-encodes; only the desktop app has an encoder for it.
            videoConfig.codec = 'prores';
            videoConfig.bitrate = needsBitrateControl
                ? getBitrate(quality, outputPixels, scaledSourceBitrate)
                : MediaBunny.QUALITY_VERY_HIGH;
        } else if (needsBitrateControl) {
            videoConfig.codec = (format === 'webm' || format === 'mkv') ? 'vp9' : 'avc';
            videoConfig.bitrate = getBitrate(quality, outputPixels, scaledSourceBitrate);
        }

        if (videoConfig.bitrate && typeof videoConfig.bitrate === 'number') {
            Logger.log(`[TranscodeService] Target: ${outputWidth}x${outputHeight} @ ${(videoConfig.bitrate / 1000000).toFixed(2)} Mbps (pixel ratio ${pixelRatio.toFixed(3)})`);
        }

        // Resolution / Rotation dimensions
        if (resolution) {
            // A single dimension lets mediabunny derive the other from the
            // source aspect ratio - exact ratio preservation. fit is only
            // valid (and only needed) when both dimensions are forced.
            if (resolution.width) videoConfig.width = resolution.width;
            if (resolution.height) videoConfig.height = resolution.height;
            if (resolution.width && resolution.height) videoConfig.fit = 'fill';
        } else if (rotate && Math.abs(rotate) % 180 === 90) {
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

        // Native (metadata) rotation is handled by mediabunny itself: decoded
        // samples arrive display-oriented and the conversion carries the
        // orientation through. Hand-baking it in the frame processor rotated
        // frames a second time and center-cropped resized output (rotated,
        // distorted videos). Only user-requested edits need the processor.
        const needsRotation = rotate || flip;
        if (removeBackgroundOptions || watermarkItems || blur || needsRotation) {
            videoConfig.process = buildFrameProcessor({
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

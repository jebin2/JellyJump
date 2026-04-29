import { Logger } from "../../shared/utils/Logger.js";

/**
 * Apply chroma key to image data
 * @param {ImageData} imageData - The image data to modify in-place
 * @param {Array} colors - Array of {r, g, b, tolerance} objects
 * @param {string} bgType - 'transparent' or 'custom'
 * @param {string} bgColor - Hex color string for custom background
 */
export function applyChromaKey(imageData, colors, bgType = 'transparent', bgColor = '#000000') {
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

/**
 * Build the per-frame canvas process callback for process().
 * @param {Object} options
 * @returns {Function}
 */
export function buildFrameProcessor({
    removeBackgroundOptions, watermarkItems, watermarkImages,
    blur, rotate, flip, nativeRotation,
    originalWidth, originalHeight, firstTimestamp,
    rotatedOutputWidth, rotatedOutputHeight
}) {
    const useOffscreen = typeof OffscreenCanvas !== 'undefined';
    const needsRotation = rotate || flip || nativeRotation !== 0;
    let canvas = null;
    let ctx = null;

    return (sample) => {
        const width = sample.squarePixelWidth || sample.codedWidth;
        const height = sample.squarePixelHeight || sample.codedHeight;
        const outputWidth = needsRotation ? (rotatedOutputWidth || width) : width;
        const outputHeight = needsRotation ? (rotatedOutputHeight || height) : height;

        if (!canvas || canvas.width !== outputWidth || canvas.height !== outputHeight) {
            canvas = useOffscreen
                ? new OffscreenCanvas(outputWidth, outputHeight)
                : Object.assign(document.createElement('canvas'), { width: outputWidth, height: outputHeight });
            ctx = canvas.getContext('2d', { willReadFrequently: true });
        }

        ctx.clearRect(0, 0, outputWidth, outputHeight);

        if (needsRotation) {
            ctx.save();
            ctx.translate(outputWidth / 2, outputHeight / 2);
            if (rotate) ctx.rotate((rotate * Math.PI) / 180);
            if (flip) ctx.scale(flip.horizontal ? -1 : 1, flip.vertical ? -1 : 1);
            if (nativeRotation) ctx.rotate((nativeRotation * Math.PI) / 180);

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
            ctx.clearRect(0, 0, width, height);
            sample.draw(ctx, 0, 0, width, height);
        }

        if (removeBackgroundOptions) {
            const imageData = ctx.getImageData(0, 0, width, height);
            const { colors, bgType, bgColor } = removeBackgroundOptions;
            applyChromaKey(imageData, colors, bgType, bgColor);
            ctx.putImageData(imageData, 0, 0);
        }

        if (watermarkItems) {
            const currentTimeWm = sample.timestamp - firstTimestamp;
            for (const wm of watermarkItems) {
                if (currentTimeWm < wm.startTime || currentTimeWm > wm.endTime) continue;
                ctx.save();
                ctx.globalAlpha = wm.opacity || 1.0;
                if (wm.type === 'image') {
                    const img = watermarkImages.get(wm.id || wm);
                    if (img) ctx.drawImage(img, wm.x, wm.y, wm.width, wm.height);
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

        if (blur && blur.areas && blur.areas.length > 0) {
            const currentTime = sample.timestamp - firstTimestamp;
            const intensity = blur.intensity || 15;
            for (const area of blur.areas) {
                if (currentTime < area.startTime || currentTime > area.endTime) continue;
                const sx = width / originalWidth;
                const sy = height / originalHeight;
                ctx.save();
                ctx.beginPath();
                ctx.rect(area.x * sx, area.y * sy, area.width * sx, area.height * sy);
                ctx.clip();
                ctx.filter = `blur(${intensity}px)`;
                ctx.drawImage(canvas, 0, 0, width, height);
                ctx.restore();
            }
        }

        return canvas;
    };
}

/**
 * Visualizer Shape Primitives
 * Draws the individual pieces of the night-sky scene: twinkling stars,
 * their sparkle cross on the brightest ones, shooting-star streaks, and
 * the moon.
 *
 * Deliberately avoids ctx.shadowBlur / ctx.filter blur: real per-shape blur
 * is one of the most expensive Canvas2D operations, and this scene can have
 * hundreds of stars on screen per frame. Gradients and small dots stand in
 * for the glow far more cheaply.
 */
export class VisualizerShapes {
    /**
     * @param {AudioVisualizer} visualizer - The main visualizer instance
     */
    constructor(visualizer) {
        this.visualizer = visualizer;
    }

    /**
     * Draw a single star. Small stars are a flat dot (cheapest possible
     * draw); only the handful of bright ones pay for a radial-gradient glow.
     * `colorRgb` is a real star color like "255,244,214" (sun-like white),
     * not a hue — real starlight colors don't map cleanly onto the hue wheel.
     */
    drawStar(cx, cy, radius, brightness, colorRgb) {
        const ctx = this.visualizer.ctx;
        const alpha = Math.min(1, brightness);

        if (radius < 1.3) {
            ctx.fillStyle = `rgba(${colorRgb}, ${alpha})`;
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.fill();
            return;
        }

        // Tight core glow only — no big soft "spread" halo. The spike
        // sparkle (drawSparkleCross) is what sells brightness, not a blob.
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.6);
        grad.addColorStop(0, `rgba(${colorRgb}, ${alpha})`);
        grad.addColorStop(0.5, `rgba(${colorRgb}, ${alpha * 0.35})`);
        grad.addColorStop(1, `rgba(${colorRgb}, 0)`);

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 1.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    /**
     * Diffraction-spike sparkle for bright stars — four tapered spikes
     * radiating from the center (like a real bright star's lens flare),
     * not a soft glow blob.
     */
    drawSparkleCross(cx, cy, size, brightness, colorRgb) {
        const ctx = this.visualizer.ctx;
        const alpha = Math.min(1, brightness);

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(${colorRgb}, ${alpha})`;

        const drawSpike = (angle, length, width) => {
            const dx = Math.cos(angle), dy = Math.sin(angle);
            const px = -dy, py = dx;
            ctx.beginPath();
            ctx.moveTo(cx + px * width, cy + py * width);
            ctx.lineTo(cx + dx * length, cy + dy * length);
            ctx.lineTo(cx - px * width, cy - py * width);
            ctx.closePath();
            ctx.fill();
        };

        // Long main axis spikes, shorter diagonal ones — the classic
        // 4-point star sparkle look.
        drawSpike(0, size, size * 0.05);
        drawSpike(Math.PI / 2, size, size * 0.05);
        drawSpike(Math.PI, size, size * 0.05);
        drawSpike(-Math.PI / 2, size, size * 0.05);
        drawSpike(Math.PI / 4, size * 0.45, size * 0.035);
        drawSpike(Math.PI * 0.75, size * 0.45, size * 0.035);
        drawSpike(-Math.PI / 4, size * 0.45, size * 0.035);
        drawSpike(-Math.PI * 0.75, size * 0.45, size * 0.035);

        ctx.restore();
    }

    /**
     * Draw a shooting star as a fading gradient trail with a bright head.
     */
    drawShootingStar(headX, headY, tailX, tailY, alpha, colorRgb) {
        const ctx = this.visualizer.ctx;
        const grad = ctx.createLinearGradient(tailX, tailY, headX, headY);
        grad.addColorStop(0, `rgba(${colorRgb}, 0)`);
        grad.addColorStop(1, `rgba(${colorRgb}, ${alpha})`);

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(headX, headY);
        ctx.stroke();

        ctx.fillStyle = `rgba(${colorRgb}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(headX, headY, 1.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    /**
     * The moon: a disc with limb darkening, and a scattering
     * of small irregular craters/maria (precomputed once per scene, passed
     * in as `craters`) clipped to the disc so surface detail reads as
     * texture rather than a few oversized cartoon blobs. No outer halo —
     * that read as an artificial glowing circle around the disc.
     */
    drawMoon(cx, cy, radius, craters) {
        const ctx = this.visualizer.ctx;

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.clip();

        // Base disc with off-center highlight and limb darkening
        const disc = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, radius * 0.1, cx, cy, radius * 1.05);
        disc.addColorStop(0, 'rgba(238, 236, 230, 0.95)');
        disc.addColorStop(0.7, 'rgba(210, 210, 204, 0.92)');
        disc.addColorStop(1, 'rgba(174, 176, 182, 0.9)');
        ctx.fillStyle = disc;
        ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

        // Scattered craters/maria for organic surface texture
        if (craters) {
            for (const c of craters) {
                ctx.fillStyle = `rgba(150, 150, 156, ${c.alpha})`;
                ctx.beginPath();
                ctx.arc(cx + c.xr * radius, cy + c.yr * radius, c.rr * radius, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.restore();
    }
}

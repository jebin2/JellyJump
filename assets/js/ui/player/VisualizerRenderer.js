/**
 * Night Sky Renderer
 * A realistic-leaning star field: skewed brightness distribution (mostly
 * dim stars, a few bright ones), real star colors, a denser diagonal
 * cluster of stars, a moon, gentle atmospheric twinkle, and a very slow
 * overall rotation (as if watching the sky turn). All of it still pulses
 * with the music, and shooting stars streak across more often on strong
 * beats.
 */

// Real star colors by spectral class, roughly by rarity (O/B blue-white are
// rare and hot; K/M orange-red are common but dim; most visible stars read
// as white to slightly warm-white to the eye).
const STAR_COLORS = [
    { rgb: '255,255,255', weight: 0.5 },   // white (A/F type)
    { rgb: '255,244,214', weight: 0.22 },  // warm white / sun-like (G type)
    { rgb: '202,216,255', weight: 0.15 },  // blue-white (B type)
    { rgb: '255,210,161', weight: 0.09 },  // orange (K type)
    { rgb: '255,163,140', weight: 0.04 },  // red (M type)
];

function pickStarColor() {
    const r = Math.random();
    let acc = 0;
    for (const c of STAR_COLORS) {
        acc += c.weight;
        if (r < acc) return c.rgb;
    }
    return STAR_COLORS[0].rgb;
}

export class VisualizerRenderer {
    /**
     * @param {AudioVisualizer} visualizer - The main visualizer instance
     */
    constructor(visualizer) {
        this.visualizer = visualizer;
        this.lastShootingStarAt = 0;
        this.moon = null;
    }

    /**
     * (Re)generate the star field and moon for the current canvas size.
     */
    initScene(width, height) {
        const v = this.visualizer;
        v.sceneWidth = width;
        v.sceneHeight = height;

        const count = Math.min(320, Math.floor((width * height) / 4800));
        v.stars = [];
        for (let i = 0; i < count; i++) {
            v.stars.push(this._makeStar(Math.random() * width, Math.random() * height * 0.94));
        }

        // A diagonal band of denser star clustering across the sky (no haze
        // glow — that read as a blurry smudge, just extra small stars).
        const angle = Math.PI * 0.2 + Math.random() * 0.25;
        const dx = Math.cos(angle), dy = Math.sin(angle);
        const bandLength = Math.hypot(width, height) * 1.3;
        const bandWidth = Math.min(width, height) * 0.32;
        const cx = width / 2, cy = height / 2;
        const startX = cx - dx * bandLength / 2;
        const startY = cy - dy * bandLength / 2;

        const bandStarCount = Math.floor(count * 0.4);
        for (let i = 0; i < bandStarCount; i++) {
            const t = Math.random();
            const perp = ((Math.random() + Math.random()) / 2 - 0.5) * bandWidth;
            const px = startX + dx * bandLength * t - dy * perp;
            const py = startY + dy * bandLength * t + dx * perp;
            if (px < -20 || px > width + 20 || py < -20 || py > height + 20) continue;
            const star = this._makeStar(px, py);
            star.baseRadius = Math.min(star.baseRadius, 0.9); // band stars stay small/dim
            v.stars.push(star);
        }

        const moonRadius = Math.min(width, height) * 0.045;
        const craters = [];
        for (let i = 0; i < 20; i++) {
            // Rejection-sample points inside the unit circle so craters
            // never spill past the disc edge.
            let xr, yr;
            do {
                xr = (Math.random() - 0.5) * 1.7;
                yr = (Math.random() - 0.5) * 1.7;
            } while (xr * xr + yr * yr > 0.75);
            craters.push({ xr, yr, rr: 0.04 + Math.random() * 0.1, alpha: 0.12 + Math.random() * 0.28 });
        }

        this.moon = {
            x: width * (0.85 + Math.random() * 0.08),
            y: height * (0.14 + Math.random() * 0.08),
            radius: moonRadius,
            craters,
        };

        v.shootingStars = [];
    }

    _makeStar(x, y) {
        // Skewed magnitude distribution: most stars are small/dim, very few
        // are large/bright — matches how a real sky actually looks.
        const roll = Math.random();
        let baseRadius;
        if (roll > 0.985) baseRadius = 1.8 + Math.random() * 0.8;
        else if (roll > 0.92) baseRadius = 1.0 + Math.random() * 0.6;
        else baseRadius = 0.3 + Math.random() * 0.6;

        return {
            x, y,
            baseRadius,
            phase: Math.random() * Math.PI * 2,
            speed: 0.25 + Math.random() * 0.9,
            trebleWeight: Math.random(),
            flicker: 0,
            sparkleLife: Infinity,
            sparkleMaxLife: 0,
            color: pickStarColor(),
        };
    }

    /**
     * Main draw call
     */
    draw(width, height) {
        const v = this.visualizer;
        const ctx = v.ctx;
        const cx = width / 2;
        const cy = height / 2;

        this.drawSky(width, height);

        // Very slow whole-sky rotation, like watching stars turn overhead.
        const rotation = v.simTime * 0.0025;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rotation);
        ctx.translate(-cx, -cy);

        this.drawStars();

        ctx.restore();

        this.drawMoon();

        this.updateAndDrawShootingStars(width, height);
        this.maybeSpawnShootingStar(width, height);
    }

    /**
     * Deep night-sky gradient background, redrawn fully each frame — stars
     * are pinpoints and shouldn't smear, and each shooting star already
     * draws its own trail line.
     */
    drawSky(width, height) {
        const ctx = this.visualizer.ctx;
        const v = this.visualizer;
        const grad = ctx.createLinearGradient(0, 0, 0, height);
        const glow = v.bassLevel * 0.04;
        grad.addColorStop(0, `rgba(${4 + glow * 30}, ${6 + glow * 16}, ${20 + glow * 24}, 1)`);
        grad.addColorStop(1, `rgba(2, 3, 10, 1)`);

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
    }

    /**
     * Update twinkle (a gentle sine plus a slow random flicker, like real
     * atmospheric scintillation) and draw every star.
     */
    drawStars() {
        const v = this.visualizer;
        const t = v.simTime;

        for (const star of v.stars) {
            star.flicker += (Math.random() - 0.5) * 0.06;
            star.flicker *= 0.9;

            const twinkle = 0.5 + 0.5 * Math.sin(t * star.speed + star.phase);
            const sparkleBoost = star.trebleWeight * v.trebleLevel * 1.1;
            const brightness = star.baseRadius * 0.3
                + twinkle * 0.35
                + star.flicker
                + sparkleBoost
                + v.beatKick * 0.25 * star.trebleWeight;

            const radius = star.baseRadius * (1 + v.beatKick * 0.3 * star.trebleWeight);
            v.shapes.drawStar(star.x, star.y, radius, Math.max(0.1, Math.min(1.3, brightness)), star.color);

            // Sparkle ignition is an independent random roll per star per
            // frame — not gated to a fixed size tier — so it's a different
            // random handful of stars each time, not always the same ones.
            // Bigger stars are just somewhat more likely to catch it. Once
            // lit, it's a slow burn: a smooth rise-then-fall envelope over
            // ~1.5-2.5s, not an instant flash.
            star.sparkleLife++;
            const igniteChance = 0.00025 + v.beatKick * 0.012;
            if (star.sparkleLife > star.sparkleMaxLife && Math.random() < igniteChance * (0.4 + star.baseRadius * 0.5)) {
                star.sparkleLife = 0;
                star.sparkleMaxLife = 90 + Math.random() * 60;
            }

            if (star.sparkleLife < star.sparkleMaxLife) {
                const envelope = Math.sin(Math.PI * star.sparkleLife / star.sparkleMaxLife);
                const spikeSize = radius * (6 + star.baseRadius * 3) * envelope;
                v.shapes.drawSparkleCross(star.x, star.y, spikeSize, envelope, star.color);
            }
        }
    }

    drawMoon() {
        if (!this.moon) return;
        this.visualizer.shapes.drawMoon(this.moon.x, this.moon.y, this.moon.radius, this.moon.craters);
    }

    /**
     * Advance and draw active shooting stars, dropping finished ones.
     */
    updateAndDrawShootingStars(width, height) {
        const v = this.visualizer;

        for (const s of v.shootingStars) {
            s.x += s.vx;
            s.y += s.vy;
            s.life++;

            const lifeRatio = s.life / s.maxLife;
            const alpha = lifeRatio < 0.15 ? lifeRatio / 0.15 : 1 - (lifeRatio - 0.15) / 0.85;

            const tailX = s.x - s.vx * s.trailFrames;
            const tailY = s.y - s.vy * s.trailFrames;
            v.shapes.drawShootingStar(s.x, s.y, tailX, tailY, Math.max(0, alpha), s.color);
        }

        v.shootingStars = v.shootingStars.filter(s =>
            s.life < s.maxLife && s.x > -50 && s.x < width + 50 && s.y > -50 && s.y < height + 50);
    }

    /**
     * Spawn a shooting star: rarely at random, more likely right after a
     * strong beat (with a cooldown so they don't spam).
     */
    maybeSpawnShootingStar(width, height) {
        const v = this.visualizer;
        const now = performance.now();
        if (now - this.lastShootingStarAt < 900) return;

        const ambientChance = 0.004;
        const beatChance = v.beatKick > 0.7 ? 0.12 : 0;
        if (Math.random() >= ambientChance + beatChance) return;

        this.lastShootingStarAt = now;

        const startFromTop = Math.random() < 0.7;
        const x = startFromTop ? Math.random() * width * 0.8 : -20;
        const y = startFromTop ? -20 : Math.random() * height * 0.5;
        const angle = Math.PI * 0.22 + Math.random() * 0.18;
        const speed = 9 + Math.random() * 7 + v.bassLevel * 6;

        v.shootingStars.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 0,
            maxLife: 30 + Math.random() * 20,
            trailFrames: 8 + Math.random() * 6,
            color: pickStarColor(),
        });
    }

    /**
     * Draw the static (idle) background shown before playback starts.
     */
    drawStaticBackground(width, height) {
        const ctx = this.visualizer.ctx;
        const bg = ctx.createLinearGradient(0, 0, 0, height);
        bg.addColorStop(0, '#050614');
        bg.addColorStop(1, '#02030a');

        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = 'rgba(210, 220, 255, 0.75)';
        ctx.font = `${Math.max(30, Math.min(width, height) * 0.15)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('♫', width / 2, height / 2 - 8);

        ctx.font = '14px sans-serif';
        ctx.fillStyle = 'rgba(220, 225, 255, 0.8)';
        ctx.fillText('Press play to start visualization', width / 2, height / 2 + 36);
    }
}

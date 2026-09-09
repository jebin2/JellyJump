import { emojiSprites } from '../../shared/utils/EmojiSprites.js';

/**
 * DecorationLayer - things that cover the whole frame rather than sit
 * somewhere in it: a border around the picture, and pieces falling across it.
 *
 * Separate from StickerLayer because the interaction is different, not the
 * drawing. A sticker is *placed* -- dragged, resized, given handles. A border
 * and a shower of flowers are *chosen*; there is nothing to drag, and giving
 * them a position and handles would be inventing state that means nothing.
 *
 * Nothing here is stored between frames. Each falling piece's position is a
 * pure function of its index and the clock, so the whole scene is a function
 * of time: it seeks correctly, it is identical on every replay, a screenshot
 * catches exactly what was on screen, and there is no array to churn. An
 * accumulating particle system would give up all four for the same cost.
 */

/** Borders: a frame, plus glyphs spaced around the edge. */
export const BORDER_PRESETS = {
    flowers: { label: '🌸 Flowers', glyphs: ['🌸', '🌺', '🌼'], colour: 'rgba(255,183,206,0.9)', count: 28 },
    hearts: { label: '💖 Hearts', glyphs: ['💖', '💗'], colour: 'rgba(255,140,170,0.9)', count: 26 },
    stars: { label: '⭐ Stars', glyphs: ['⭐', '✨'], colour: 'rgba(255,214,102,0.9)', count: 26 },
    leaves: { label: '🍀 Leaves', glyphs: ['🍀', '🌿'], colour: 'rgba(140,220,150,0.9)', count: 26 },
};

/** Rain: what falls. */
export const RAIN_PRESETS = {
    flowers: { label: '🌸 Flower drop', glyphs: ['🌸', '🌺', '🌼', '🌷'] },
    hearts: { label: '💖 Hearts', glyphs: ['💖', '💕', '❤️'] },
    confetti: { label: '🎉 Confetti', glyphs: ['🎉', '🎊', '✨', '⭐'] },
    snow: { label: '❄️ Snow', glyphs: ['❄️', '🤍'] },
};

/** Pieces on screen at once. ~0.3ms a frame at 720p on a modest GPU. */
export const DEFAULT_DENSITY = 60;
export const MAX_DENSITY = 300;

/**
 * A stable, unrelated number in [0,1) for piece `i`, trait `salt`.
 * Cheap integer hash; the point is only that traits do not correlate and that
 * the same piece gets the same answer every time it is asked.
 */
function hash01(i, salt) {
    let h = (i * 374761393 + salt * 668265263) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class DecorationLayer {
    /** @param {Object} player - CorePlayer */
    constructor(player) {
        this.player = player;
        this.border = null;
        this.rain = null;
        this.density = DEFAULT_DENSITY;

        this._back = this.drawBehind.bind(this);
        this._front = this.drawFront.bind(this);
        // The falling pieces go on before the stickers; see registerFrontPass.
        this.player.addRenderCallback?.(this._back);
    }

    /**
     * The border goes on last, over the stickers, so it frames everything.
     * Called after StickerLayer is constructed, because overlay callbacks run
     * in the order they were added.
     */
    registerFrontPass() {
        this.player.addRenderCallback?.(this._front);
    }

    setBorder(name) { this.border = BORDER_PRESETS[name] ? name : null; this._repaint(); }
    setRain(name) { this.rain = RAIN_PRESETS[name] ? name : null; this._repaint(); }

    setDensity(n) {
        this.density = Math.max(1, Math.min(MAX_DENSITY, Math.round(Number(n) || DEFAULT_DENSITY)));
        this._repaint();
    }

    isActive() { return !!(this.border || this.rain); }

    clear() { this.border = null; this.rain = null; this._repaint(); }

    destroy() {
        this.player.removeRenderCallback?.(this._back);
        this.player.removeRenderCallback?.(this._front);
    }

    /** @private */
    _repaint() {
        const player = this.player;
        if (player.isPlaying) return;
        if (player.isStreamMode) { player._renderStreamFrame?.(); return; }
        if (player.videoTrack) player._extractAndDrawFrame?.(player.currentTime);
    }

    /** @private */
    _clock() {
        return (this.player.overlayTimeMs?.() ?? performance.now()) / 1000;
    }

    // --- passes ----------------------------------------------------------

    /** The pass that goes on before the stickers. */
    drawBehind(canvas, ctx) {
        if (this.rain) this.drawRain(canvas, ctx);
    }

    /** The pass that goes on after them, so the border frames everything. */
    drawFront(canvas, ctx) {
        if (this.border) this.drawBorder(canvas, ctx);
    }

    /**
     * Both passes with nothing between them. For a still with no stickers, and
     * for tests; a screenshot with stickers calls the two passes either side
     * of them, the way the render callbacks do.
     */
    drawInto(canvas, ctx) {
        this.drawBehind(canvas, ctx);
        this.drawFront(canvas, ctx);
    }

    // --- rain ------------------------------------------------------------

    /** @private */
    drawRain(canvas, ctx) {
        const preset = RAIN_PRESETS[this.rain];
        if (!preset) return;
        const t = this._clock();
        const { width: W, height: H } = canvas;

        ctx.save();
        for (let i = 0; i < this.density; i++) {
            const column = hash01(i, 1);
            const size = (0.035 + hash01(i, 2) * 0.045) * W;
            // Falls a screen-height every 6 to 16 seconds, each at its own pace.
            const fall = 1 / (6 + hash01(i, 3) * 10);
            const phase = hash01(i, 4);
            const spin = (hash01(i, 5) - 0.5) * 1.6;
            const glyph = preset.glyphs[Math.floor(hash01(i, 6) * preset.glyphs.length)];

            // Wrapped rather than accumulated: position is a function of t, so
            // seeking to any time gives the arrangement that belongs there.
            const progress = (t * fall + phase) % 1;
            const y = progress * (H + size * 2) - size;
            const sway = Math.sin(t * (0.6 + hash01(i, 7)) + phase * 6.283) * W * 0.025;
            const x = column * W + sway;

            ctx.save();
            ctx.globalAlpha = 0.85;
            ctx.translate(x, y);
            ctx.rotate(t * spin + phase * 6.283);
            ctx.drawImage(emojiSprites.get(glyph), -size / 2, -size / 2, size, size);
            ctx.restore();
        }
        ctx.restore();
    }

    // --- border ----------------------------------------------------------

    /** @private */
    drawBorder(canvas, ctx) {
        const preset = BORDER_PRESETS[this.border];
        if (!preset) return;
        const t = this._clock();
        const { width: W, height: H } = canvas;
        const inset = Math.max(4, W * 0.012);

        ctx.save();
        ctx.lineWidth = inset;
        ctx.strokeStyle = preset.colour;
        ctx.strokeRect(inset / 2, inset / 2, W - inset, H - inset);

        // Spread by perimeter rather than by side, so a wide frame does not
        // crowd the short edges.
        const perimeter = 2 * (W + H);
        const size = Math.max(18, W * 0.055);
        for (let i = 0; i < preset.count; i++) {
            const along = ((i + 0.5) / preset.count) * perimeter;
            let x, y;
            if (along < W) { x = along; y = 0; }
            else if (along < W + H) { x = W; y = along - W; }
            else if (along < 2 * W + H) { x = W - (along - W - H); y = H; }
            else { x = 0; y = H - (along - 2 * W - H); }

            // A slow breath so the frame is alive without being distracting.
            const scale = 1 + Math.sin(t * 1.2 + i) * 0.08;
            const glyph = preset.glyphs[i % preset.glyphs.length];
            const s = size * scale;

            ctx.drawImage(emojiSprites.get(glyph), x - s / 2, y - s / 2, s, s);
        }
        ctx.restore();
    }
}

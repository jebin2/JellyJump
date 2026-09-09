/**
 * EmojiSprites - each emoji glyph rasterised once, for drawing many of them.
 *
 * Measured at 1280x720 with 300 pieces on screen: 1.2ms a frame through
 * fillText, 0.6ms through a pre-rendered bitmap. That gap is why this exists,
 * and it is also why placed stickers do *not* use it -- a sticker can be half
 * the frame wide, where a 96px sprite would be visibly soft, and there are
 * only ever a handful of them. Sprites are for the decorations: dozens of
 * small pieces, all the same few glyphs.
 *
 * A bitmap is produced asynchronously, so a canvas of the same glyph is
 * cached synchronously and used until the bitmap arrives. Drawing never waits
 * and never skips a frame for want of a sprite.
 */

/** Big enough for a decoration at any sane density; 36KB a glyph as RGBA. */
const SPRITE_PX = 96;
/** Cache ceiling. Well past the built-in sets, and bounded on purpose. */
const MAX_SPRITES = 48;

const FONT = `${SPRITE_PX}px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;

export class EmojiSprites {
    constructor() {
        /** @type {Map<string, {source: CanvasImageSource, bitmap: ImageBitmap|null}>} */
        this._cache = new Map();
    }

    /**
     * A drawable source for one glyph, ready to use on the calling frame.
     * @param {string} char
     * @returns {CanvasImageSource}
     */
    get(char) {
        const hit = this._cache.get(char);
        if (hit) {
            // Re-inserted so the ceiling evicts what is least recently drawn
            // rather than what was made first.
            this._cache.delete(char);
            this._cache.set(char, hit);
            return hit.bitmap || hit.source;
        }

        const canvas = document.createElement('canvas');
        canvas.width = SPRITE_PX;
        canvas.height = SPRITE_PX;
        const ctx = canvas.getContext('2d');
        ctx.font = FONT;
        ctx.textBaseline = 'top';
        ctx.fillText(char, 0, 0);

        const entry = { source: canvas, bitmap: null };
        this._cache.set(char, entry);
        this._evictIfNeeded();

        // The faster form, swapped in when it is ready. Failure is not worth
        // reporting: the canvas already draws correctly.
        createImageBitmap(canvas).then(bitmap => {
            if (this._cache.get(char) === entry) entry.bitmap = bitmap;
            else bitmap.close();
        }).catch(() => {});

        return canvas;
    }

    /** @private */
    _evictIfNeeded() {
        while (this._cache.size > MAX_SPRITES) {
            const oldest = this._cache.keys().next().value;
            this._cache.get(oldest)?.bitmap?.close();
            this._cache.delete(oldest);
        }
    }

    /** Releases every rasterised glyph. */
    destroy() {
        for (const entry of this._cache.values()) entry.bitmap?.close();
        this._cache.clear();
    }
}

/** One cache for the whole page: the same glyphs serve every player. */
export const emojiSprites = new EmojiSprites();

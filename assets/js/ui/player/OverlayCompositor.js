/**
 * OverlayCompositor - one definition of "the picture, with everything on it".
 *
 * A screenshot and an export have to agree with the preview and with each
 * other, and the only way to guarantee that is for all three to run the same
 * code in the same order: colour into the pixels, rain behind, stickers, then
 * the border over the lot -- the order the render callbacks run in.
 *
 * The layers only ever read `width` and `height` off the canvas they are
 * given, so a plain `{width, height}` stands in for one. That is what lets an
 * export composite at the file's own resolution rather than the player's.
 *
 * Every layer is a function of the time passed in, never of `now`. Render the
 * frame that belongs to timestamp T and you get exactly what playback shows at
 * T -- which is what makes an export match the preview instead of drifting
 * from it.
 */

/**
 * @param {CanvasRenderingContext2D} ctx - destination
 * @param {CanvasImageSource} source - the frame to draw
 * @param {number} width
 * @param {number} height
 * @param {Object} options
 * @param {Object} [options.filters] - VideoFilters
 * @param {Object} [options.stickers] - StickerLayer
 * @param {Object} [options.decorations] - DecorationLayer
 * @param {number} [options.timeMs] - the moment this frame belongs to
 * @param {boolean} [options.bakeColour] - false when the colour is already in
 *   the source pixels, as it is on the camera's canvas
 */
export function composeFrame(ctx, source, width, height, {
    filters, stickers, decorations, timeMs, bakeColour = true,
} = {}) {
    const frame = { width, height };

    if (bakeColour && filters) filters.bakeInto(ctx, source, width, height);
    else ctx.drawImage(source, 0, 0, width, height);

    decorations?.drawBehind(frame, ctx, timeMs);
    stickers?.drawInto(frame, ctx, timeMs);
    decorations?.drawFront(frame, ctx, timeMs);
}

/**
 * True when something is drawn *on top of* the frame.
 *
 * Deliberately blind to the colour effects. Colour is a treatment of the
 * frame, not a thing above it, and it is this answer that decides whether the
 * colour gets baked into the pixels -- so counting it here would make a plain
 * filtered video bake itself for no reason, at full cost on every frame.
 */
export function hasOverlays({ stickers, decorations } = {}) {
    return !!(stickers?.stickers?.length > 0 || decorations?.isActive?.());
}

/**
 * A frame stage for the transcoder: takes the canvas a decoded frame has been
 * drawn into and puts everything else on top of it, at that frame's own time.
 *
 * The frame is copied to a scratch canvas first rather than filtered in place,
 * because `ctx.filter` reads while it writes and a canvas drawn onto itself
 * through a filter is not defined to give the right answer.
 *
 * @returns {(canvas: HTMLCanvasElement|OffscreenCanvas, timeMs: number) => void}
 */
export function buildOverlayStage({ filters, stickers, decorations }) {
    let scratch = null;
    let scratchCtx = null;

    return (canvas, timeMs) => {
        const { width, height } = canvas;
        if (!scratch || scratch.width !== width || scratch.height !== height) {
            scratch = document.createElement('canvas');
            scratch.width = width;
            scratch.height = height;
            scratchCtx = scratch.getContext('2d');
        }

        scratchCtx.clearRect(0, 0, width, height);
        scratchCtx.drawImage(canvas, 0, 0);

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, width, height);
        composeFrame(ctx, scratch, width, height, { filters, stickers, decorations, timeMs });
    };
}

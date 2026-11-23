// @ts-check
/**
 * Putting frames on the player's canvas, and the overlays drawn over them
 * (moved out of core/Player.js, ARCHITECTURE_PLAN.md H4). The player keeps
 * one-line methods for each: `presentFrame`, `addRenderCallback`,
 * `removeRenderCallback`, `overlayTimeMs`, `_syncOverlayBaking`.
 */
import { hasOverlays } from '../../shared/media/OverlayCompositor.js';
import { Logger } from '../../shared/utils/Logger.js';

/**
 * Put one frame on screen. The single way anything reaches the canvas:
 * decoded file frames, live frames and the camera all come through here.
 *
 * It exists because the three steps -- draw the frame, apply the effects,
 * run whatever draws over it -- were hand-copied at nine call sites, and a
 * copy that forgets the third step is invisible until someone tries to
 * draw over that path. The camera was one such copy, and three sites in
 * the live loop still were.
 *
 * @param {any} player
 * @param {CanvasImageSource} source
 * @param {{clear?: boolean}} [options] - clear first, for sources that may
 *   not cover the canvas (a resolution change mid-stream leaves a border
 *   of the previous frame otherwise).
 */
export function presentPlayerFrame(player, source, { clear = false } = {}) {
    const { canvas, ctx } = player;
    if (!source || !ctx || !canvas) return;
    player.timing.framePresented();

    if (clear) ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (player.videoFilters) {
        player.videoFilters.drawFrame(ctx, source, canvas.width, canvas.height);
    } else {
        ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    }

    for (const cb of player.afterFrameRenderCallbacks) {
        try { cb(canvas, ctx); } catch (e) { Logger.warn('After-frame callback error:', e); }
    }
}

/** Run `callback(canvas, ctx)` after every frame. @param {any} player @param {Function} callback */
export function addPlayerRenderCallback(player, callback) {
    if (typeof callback === 'function') player.afterFrameRenderCallbacks.push(callback);
}

/** @param {any} player @param {Function} callback */
export function removePlayerRenderCallback(player, callback) {
    const index = player.afterFrameRenderCallbacks.indexOf(callback);
    if (index !== -1) player.afterFrameRenderCallbacks.splice(index, 1);
}

/**
 * The clock that animated overlays run on.
 *
 * A file has a timeline, so its decorations must follow that rather than
 * the wall clock: otherwise seeking backwards does not take them back with
 * you, playing the same file twice gives different results, and a
 * screenshot -- which re-composites the frame and reads the clock again --
 * saves a different moment of the animation than the one on screen.
 *
 * A camera or a live stream has no timeline to be consistent with, so
 * there the wall clock is the only sensible answer. Paused, a file's
 * decorations hold still along with the picture, which is what makes the
 * screenshot match.
 *
 * @param {any} player
 * @returns {number} milliseconds
 */
export function playerOverlayTimeMs(player) {
    if (player.isStreamMode) return performance.now();
    return (player.currentTime || 0) * 1000;
}

/**
 * Decide whether the colour effects go into the pixels or onto the element.
 *
 * A filter treats the footage; a sticker is a thing put on top of it. So a
 * flower stays pink over a black-and-white clip rather than going grey
 * with it -- which is what every camera app does, and what this app's own
 * camera and export have always done. Playback was the odd one out: its
 * colour is a CSS filter over the whole canvas, stickers included.
 *
 * Baking is the only way to get that order right, and it costs a filter
 * per frame on the main thread. So it is switched on exactly when
 * something has to sit above the colour -- which means a plain filtered
 * video, however large, never pays for it. The camera always bakes
 * regardless: its recorder reads canvas pixels and a CSS filter is
 * invisible to it.
 *
 * @param {any} player
 */
export function syncPlayerOverlayBaking(player) {
    if (!player.videoFilters) return;
    const needed = !!player.isStreamMode
        || hasOverlays({ stickers: player.stickers, decorations: player.decorations });
    player.videoFilters.setCanvasMode(needed);
}

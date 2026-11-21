// @ts-check
/**
 * The main player as a timeline tool's preview, in the edit panel.
 *
 * Cut, Multi-Cut and GIF each opened a dialog with a small player of its own,
 * to find the start and the end on. In the edit panel the video is already in
 * the big player beside it, so they use that one: its timeline shows the
 * range, and the range plays on a loop. What the player was doing with its
 * own loop is put back when the tool closes.
 */

/**
 * Lend the main player to a tool for as long as it is open.
 * @param {{onCleanup: (cb: () => void) => void}} surface - the tool's panel surface
 * @param {Object} playlist
 * @returns {Object|null} the player, or null when there is none
 */
export function borrowMainPlayer(surface, playlist) {
    const player = playlist.player;
    if (!player) return null;
    const saved = { loopMode: player.loopMode, loopStart: player.loopStart, loopEnd: player.loopEnd };
    player.pause?.();
    surface.onCleanup(() => {
        clearTimeout(player._previewRangeTimer);
        Object.assign(player, saved);
        player._updateLoopUI?.();
    });
    return player;
}

/**
 * Show a range on the player's timeline, and loop it while it plays.
 * @param {Object|null} player
 * @param {number} start - seconds
 * @param {number} end - seconds
 */
export function setPreviewRange(player, start, end) {
    if (!player) return;
    player.loopMode = 'one';
    player.loopStart = start;
    player.loopEnd = end;
    draw(player);
}

/** The markers are placed against the duration, which a video still loading does not have yet. */
function draw(player, tries = 0) {
    clearTimeout(player._previewRangeTimer);
    player._updateLoopUI?.();
    if (!(player.duration > 0) && tries < 50) {
        player._previewRangeTimer = setTimeout(() => draw(player, tries + 1), 100);
    }
}

/**
 * The main player's picture, for a tool that draws on the video: Crop's box,
 * Blur's and Watermark's areas, Remove BG's colour picker. The tool puts its
 * layers over the picture and its effects into the frames the player draws;
 * both go when the tool closes, and the frame is drawn again without them.
 *
 * It waits for the player to finish loading the item (the panel selects the
 * item just before the tool opens), since the tool works in the video's
 * pixels and the canvas is sized to them only once the video is loaded.
 *
 * @param {{onCleanup: (cb: () => void) => void}} surface
 * @param {Object} playlist
 * @returns {Promise<{player: Object, wrapper: HTMLElement, canvas: HTMLCanvasElement,
 *   video: {width: number, height: number},
 *   adopt: (el: HTMLElement) => void,
 *   addRenderCallback: (cb: Function) => void,
 *   redraw: () => void}|null>} null when there is no player, or the tool
 *   closed while the video was loading
 */
export async function lendPicture(surface, playlist) {
    const player = borrowMainPlayer(surface, playlist);
    const canvas = player?.canvas;
    const wrapper = canvas?.parentElement;
    if (!player || !canvas || !wrapper) return null;

    let closed = false;
    /** @type {HTMLElement[]} */
    const layers = [];
    /** @type {Function[]} */
    const callbacks = [];
    const redraw = () => { if (!player.isPlaying) player.seek?.(player.currentTime); };

    // Controls laid over the picture stay up while it is paused, which it is
    // while editing, and would cover the bottom of it. Pinned below, the
    // whole picture can be drawn on. Not saved: it is the user's setting.
    const pinned = player.controlBarMode === 'overlay' && player.controlBar;
    if (pinned) {
        player.controlBarMode = 'fixed';
        player.controlBar.applyMode();
    }

    surface.onCleanup(() => {
        closed = true;
        for (const cb of callbacks) player.removeRenderCallback?.(cb);
        for (const el of layers) el.remove();
        // Unless the user changed it meanwhile, with the pin button.
        if (pinned && player.controlBarMode === 'fixed') {
            player.controlBarMode = 'overlay';
            player.controlBar.applyMode();
        }
        redraw();
    });

    for (let i = 0; i < 150 && !closed; i++) {
        if (!player.isLoading && player.duration > 0 && canvas.width > 0) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (closed) return null;

    return {
        player, wrapper, canvas,
        video: { width: canvas.width, height: canvas.height },
        adopt(el) {
            el.classList.add('jj-edit-layer');
            wrapper.appendChild(el);
            layers.push(el);
        },
        addRenderCallback(cb) {
            player.addRenderCallback(cb);
            callbacks.push(cb);
        },
        redraw,
    };
}

/**
 * Where a pointer is on a canvas drawn `object-fit: contain`, in the canvas's
 * own pixels; null over the bars beside the picture.
 * @param {HTMLCanvasElement} canvas
 * @param {{clientX: number, clientY: number}} e
 * @returns {{x: number, y: number}|null}
 */
export function canvasPoint(canvas, e) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height || !canvas.width || !canvas.height) return null;
    const scale = Math.min(rect.width / canvas.width, rect.height / canvas.height);
    const left = rect.left + (rect.width - canvas.width * scale) / 2;
    const top = rect.top + (rect.height - canvas.height * scale) / 2;
    const x = Math.floor((e.clientX - left) / scale);
    const y = Math.floor((e.clientY - top) / scale);
    if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return null;
    return { x, y };
}

/**
 * Mark stretches of the player's timeline, the ones Multi-Cut takes out.
 * @param {Object|null} player
 * @param {{onCleanup: (cb: () => void) => void}} surface
 * @returns {(ranges: Array<{start: number, end: number}>, duration: number) => void} redraws the marks
 */
export function timelineMarks(player, surface) {
    const track = player?.ui?.progressContainer;
    if (!track) return () => {};
    const layer = document.createElement('div');
    layer.className = 'jj-timeline-marks';
    track.appendChild(layer);
    surface.onCleanup(() => layer.remove());
    return (ranges, duration) => {
        layer.replaceChildren(...(duration > 0 ? ranges : []).map((r) => {
            const mark = document.createElement('div');
            mark.className = 'jj-timeline-cut';
            mark.style.left = `${(r.start / duration) * 100}%`;
            mark.style.width = `${(Math.max(0, r.end - r.start) / duration) * 100}%`;
            return mark;
        }));
    };
}

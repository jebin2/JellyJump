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
    // The loop is the tool's while it is open (setPreviewRange), and the
    // player's own comes back when it closes.
    const release = player.override?.({ loop: { mode: player.loopMode, start: player.loopStart, end: player.loopEnd } });
    player.pause?.();
    surface.onCleanup(() => release?.());
    return player;
}

/**
 * Show a range on the player's timeline, and loop it while it plays.
 * @param {Object|null} player
 * @param {number} start - seconds
 * @param {number} end - seconds
 */
export function setPreviewRange(player, start, end) {
    // The markers are drawn again when the duration arrives
    // (PlayerUIListeners), so a video still loading needs nothing more.
    player?.setLoop?.('one', start, end);
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

    // The controls are pinned below the picture while the edit panel is
    // open (EditPanel._holdPlayer), so the whole picture can be drawn on.

    surface.onCleanup(() => {
        closed = true;
        for (const cb of callbacks) player.removeRenderCallback?.(cb);
        for (const el of layers) el.remove();
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

/**
 * Scenes and Motion list the stretches they find. Clicking a row plays that
 * stretch in the main player, on a loop; the player goes back to how it was
 * when the tool closes.
 * @param {Object} surface - the tool's panel surface
 * @param {Object} playlist
 * @param {HTMLElement} list - the rows, each with its Add button holding the times
 */
export function playRowsOnClick(surface, playlist, list) {
    const player = borrowMainPlayer(surface, playlist);
    if (!player) return;
    list.addEventListener('click', (e) => {
        const target = /** @type {Element} */ (e.target);
        const row = target.closest('.segment-item');
        const times = /** @type {HTMLElement|null} */ (row?.querySelector('.add-segment-btn'))?.dataset;
        if (!row || !times || target.closest('.add-segment-btn')) return;
        const start = parseFloat(times.start);
        const end = parseFloat(times.end);
        if (!(end > start)) return;
        for (const other of list.querySelectorAll('.segment-item.is-previewing')) other.classList.remove('is-previewing');
        row.classList.add('is-previewing');
        setPreviewRange(player, start, end);
        player.seek(start);
        player.play?.();
    });
}

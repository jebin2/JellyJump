/**
 * Tests the camera sticker layer and the animated-image decoding behind it.
 *
 * Two things are worth asserting here. Geometry: positions are stored as
 * fractions of the frame, so that a sticker lands in the same place in the
 * recording as on screen whatever size the window is — storing screen pixels
 * is the obvious mistake and it only shows up once you play the file back.
 * And memory: an AnimatedImage holds decoded frames that dropping a reference
 * does not give back, so removing a sticker has to close them.
 *
 *   node scripts/sticker-test.mjs
 */
import { AnimatedImage } from '../assets/js/shared/utils/AnimatedImage.js';

let pass = 0, fail = 0;
const check = (ok, label) => {
    if (ok) { pass++; console.log(`  PASS  ${label}`); }
    else { fail++; console.log(`  FAIL  ${label}`); }
};

// --- enough DOM for the layer to run ---------------------------------------

const makeEl = () => {
    const el = {
        style: {}, dataset: {}, children: [], innerHTML: '',
        classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
            toggle(c, on) { on ? this._s.add(c) : this._s.delete(c); }, contains(c) { return this._s.has(c); } },
        appendChild(c) { el.children.push(c); c.parentElement = el; return c; },
        remove() { const i = el.parentElement?.children.indexOf(el); if (i > -1) el.parentElement.children.splice(i, 1); },
        addEventListener() {}, removeEventListener() {}, setPointerCapture() {},
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 450 }),
        querySelector: () => null,
    };
    return el;
};
globalThis.document = { createElement: makeEl, getElementById: () => ({}), body: makeEl() };
globalThis.ResizeObserver = undefined;

const { StickerLayer } = await import('../assets/js/ui/player/StickerLayer.js');

function makePlayer(canvasW = 1280, canvasH = 720) {
    const wrapper = makeEl();
    const canvas = { width: canvasW, height: canvasH,
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 450 }) };
    const callbacks = [];
    return {
        canvas, callbacks, currentTime: 0, isStreamMode: false,
        container: { querySelector: sel => (sel === '.jellyjump-video-wrapper' ? wrapper : null) },
        addRenderCallback: cb => callbacks.push(cb),
        removeRenderCallback: cb => callbacks.splice(callbacks.indexOf(cb), 1),
        // The real rule, copied from Player.overlayTimeMs.
        overlayTimeMs() { return this.isStreamMode ? 1e9 : this.currentTime * 1000; },
    };
}

/**
 * Records draws with the transform folded in, so an assertion about where a
 * sticker landed keeps meaning what it meant before motions existed: drawing
 * at (0,0) after translating to (320,360) is drawing at (320,360).
 */
const recordingCtx = () => {
    const calls = [];
    const stack = [];
    let tx = 0, ty = 0, scale = 1, rotate = 0;
    return {
        calls, globalAlpha: 1, font: '', textBaseline: '',
        save() { stack.push([tx, ty, scale, rotate]); },
        restore() { [tx, ty, scale, rotate] = stack.pop() || [0, 0, 1, 0]; },
        translate(x, y) { tx += x; ty += y; },
        scale(x) { scale *= x; },
        rotate(r) { rotate += r; },
        fillText(t, x, y) { calls.push({ op: 'fillText', args: [t, tx + x, ty + y], scale, rotate }); },
        drawImage(img, x, y, w, h) {
            calls.push({ op: 'drawImage', args: [img, tx + x, ty + y, w, h], scale, rotate });
        },
    };
};

// --- geometry ---------------------------------------------------------------

console.log('\na sticker is placed in the frame, not on the screen');
{
    const player = makePlayer(1280, 720);
    const layer = new StickerLayer(player);
    const s = layer.addEmoji('🌸');
    s.x = 0.25; s.y = 0.5; s.w = 0.2;

    const ctx = recordingCtx();
    player.callbacks[0](player.canvas, ctx);
    const drawn = ctx.calls[0];
    check(drawn?.op === 'fillText' && drawn.args[1] === 320 && drawn.args[2] === 360,
        `a quarter across a 1280x720 frame is x=320, y=360 (got ${drawn?.args[1]}, ${drawn?.args[2]})`);

    // The same fractions on a camera that switched resolution mid-session.
    player.canvas.width = 640; player.canvas.height = 480;
    const ctx2 = recordingCtx();
    player.callbacks[0](player.canvas, ctx2);
    check(ctx2.calls[0].args[1] === 160 && ctx2.calls[0].args[2] === 240,
        'and a quarter across a 640x480 frame is x=160, y=240 — the same place');
    layer.destroy();
}

console.log('\nnothing is drawn when there is nothing to draw');
{
    const player = makePlayer();
    const layer = new StickerLayer(player);
    const ctx = recordingCtx();
    player.callbacks[0](player.canvas, ctx);
    check(ctx.calls.length === 0, 'an empty layer costs one array check a frame');
    layer.destroy();
}

// --- memory -----------------------------------------------------------------

console.log('\ndecoded frames are given back');
{
    const player = makePlayer();
    const layer = new StickerLayer(player);
    let closed = 0;
    const fakeFrames = [1, 2, 3].map(() => ({ width: 64, height: 64, close: () => closed++ }));
    const s = layer.addEmoji('🌸');
    s.kind = 'image';
    s.media = new AnimatedImage(fakeFrames, [100, 100, 100]);

    layer.remove(s.id);
    check(closed === 3, `removing a sticker closes its frames (${closed}/3)`);

    closed = 0;
    const s2 = layer.addEmoji('🌻');
    s2.kind = 'image';
    s2.media = new AnimatedImage([{ close: () => closed++, width: 1, height: 1 }], [100]);
    layer.clear();
    check(closed === 1, 'and so does clearing the layer when the camera stops');
    layer.destroy();
}

// --- animation --------------------------------------------------------------

console.log('\nGIF frames advance on the caller’s clock');
{
    // Driven by the clock the frames are drawn on, not a timer of its own, so
    // what is recorded is what was on screen.
    const frames = ['a', 'b', 'c'].map(id => ({ id, width: 10, height: 10, close() {} }));
    const img = new AnimatedImage(frames, [100, 200, 100]);
    check(img.totalMs === 400, 'the loop is as long as its frames say');
    check(img.frameAt(0).id === 'a', 't=0 is the first frame');
    check(img.frameAt(150).id === 'b', 't=150 is inside the second, which runs 100-300');
    check(img.frameAt(350).id === 'c', 't=350 is the third');
    check(img.frameAt(400).id === 'a', 't=400 wraps to the start of the loop');
    check(img.frameAt(450).id === 'a', 'and t=450 is 50ms in, still the first frame');
    check(img.frameAt(550).id === 'b', 'while t=550 is 150ms in, the second');
}

console.log('\na still image is one frame, and never asks for a decoder');
{
    const one = new AnimatedImage([{ width: 8, height: 8, close() {} }], [100]);
    check(one.animated === false, 'a single frame is not animated');
    check(one.frameAt(99999) !== undefined, 'and answers for any time without arithmetic on zero');
}

// --- the clock ---------------------------------------------------------------

console.log('\nan animation follows the video, not the wall clock');
{
    const player = makePlayer();
    const layer = new StickerLayer(player);
    const s = layer.addEmoji('x');
    s.kind = 'image';
    // Three frames of 100ms: which one is asked for says which clock was read.
    const frames = ['a', 'b', 'c'].map(id => ({ id, width: 10, height: 10, close() {} }));
    s.media = new AnimatedImage(frames, [100, 100, 100]);

    const frameAt = (t) => {
        player.currentTime = t;
        const ctx = recordingCtx();
        player.callbacks[0](player.canvas, ctx);
        return ctx.calls.find(c => c.op === 'drawImage').args[0].id;
    };

    check(frameAt(0.15) === 'b', 'at 0.15s into the file, the second frame');
    check(frameAt(0.25) === 'c', 'at 0.25s, the third');
    check(frameAt(0.15) === 'b', 'and seeking back to 0.15s gives the second again');

    // Twice at the same timestamp is the same picture -- which is what makes a
    // screenshot match the frame it was taken from.
    check(frameAt(0.05) === frameAt(0.05), 'the same timestamp always draws the same frame');

    // A camera has no timeline to be consistent with, so currentTime must
    // stop mattering entirely -- which frame the wall clock lands on is not
    // something to assert, but that it ignores the timeline is.
    player.isStreamMode = true;
    check(frameAt(0.15) === frameAt(0.25),
        'a camera ignores currentTime and reads the wall clock instead');
    layer.destroy();
}

// --- screenshots -------------------------------------------------------------

console.log('\na screenshot saves what was on screen');
{
    const { ScreenshotManager } = await import('../assets/js/ui/player/ScreenshotManager.js');
    const composite = ScreenshotManager.prototype._composite;

    const madeCanvases = [];
    const realCreate = globalThis.document.createElement;
    globalThis.document.createElement = () => {
        const el = realCreate();
        el.width = 0; el.height = 0;
        el.ops = [];
        el.getContext = () => ({
            filter: 'none', globalAlpha: 1, imageSmoothingEnabled: true, font: '', textBaseline: '',
            save() {}, restore() {}, translate() {}, scale() {},
            createLinearGradient: () => ({ addColorStop() {} }),
            createRadialGradient: () => ({ addColorStop() {} }),
            createPattern: () => ({}),
            fillRect() {}, fillText(...a) { el.ops.push({ op: 'fillText', args: a }); },
            // The filter at the moment of the draw is the whole point here:
            // recording only that a draw happened cannot tell a composited
            // screenshot from an untouched one.
            drawImage(...a) { el.ops.push({ op: 'drawImage', filter: this.filter, args: a }); },
        });
        el.toDataURL = () => 'data:composited';
        madeCanvases.push(el);
        return el;
    };

    const sourceFrame = { width: 1920, height: 1080, toDataURL: () => 'data:untouched' };

    // Nothing to add: the frame is saved as it was decoded, with no copy.
    const bare = composite.call({ player: { videoFilters: null, stickers: null } },
        sourceFrame, { stickersAlreadyDrawn: false });
    check(bare === 'data:untouched', 'an unfiltered, stickerless frame is saved untouched');

    // A filtered file: the decoded frame is clean, so the colour has to go on.
    const player = makePlayer(1280, 720);
    const layer = new StickerLayer(player);
    layer.addEmoji('🌸');
    const { VideoFilters } = await import('../assets/js/ui/player/VideoFilters.js');
    const filters = new VideoFilters(null);
    filters.canvas = makeEl();
    filters.canvas.style = {};
    filters.applyPreset('sepia');

    madeCanvases.length = 0;
    const shot = composite.call({ player: { videoFilters: filters, stickers: layer } },
        sourceFrame, { stickersAlreadyDrawn: false });
    const out = madeCanvases[0];
    check(shot === 'data:composited', 'a filtered frame is composited instead');
    check(out.width === 1920 && out.height === 1080,
        `at the file's own resolution, not the player canvas's (${out.width}x${out.height})`);
    const composited = out.ops.find(o => o.op === 'drawImage');
    check(composited?.filter?.includes('sepia(1)'),
        `the frame is drawn through the colour that was on the element (${composited?.filter})`);
    check(out.ops.some(o => o.op === 'fillText'), 'and the sticker goes on over it');

    // The camera: its canvas already carries both, so nothing is re-drawn.
    madeCanvases.length = 0;
    filters.setCanvasMode(true);
    const live = composite.call({ player: { videoFilters: filters, stickers: layer } },
        { width: 640, height: 480, toDataURL: () => 'data:live-canvas' },
        { stickersAlreadyDrawn: true });
    check(live === 'data:live-canvas',
        'the camera canvas is saved as-is — the effects and stickers are already in it');
    check(madeCanvases.length === 0, 'with no second canvas allocated');

    globalThis.document.createElement = realCreate;
    layer.destroy();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

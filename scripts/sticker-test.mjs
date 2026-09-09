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
globalThis.document = { createElement: makeEl };
globalThis.ResizeObserver = undefined;

const { StickerLayer } = await import('../assets/js/ui/player/StickerLayer.js');

function makePlayer(canvasW = 1280, canvasH = 720) {
    const wrapper = makeEl();
    const canvas = { width: canvasW, height: canvasH,
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 450 }) };
    const callbacks = [];
    return {
        canvas, callbacks,
        container: { querySelector: sel => (sel === '.jellyjump-video-wrapper' ? wrapper : null) },
        addRenderCallback: cb => callbacks.push(cb),
        removeRenderCallback: cb => callbacks.splice(callbacks.indexOf(cb), 1),
    };
}

const recordingCtx = () => {
    const calls = [];
    return { calls, save() {}, restore() {}, globalAlpha: 1, font: '', textBaseline: '',
        fillText(...a) { calls.push({ op: 'fillText', args: a }); },
        drawImage(...a) { calls.push({ op: 'drawImage', args: a }); } };
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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

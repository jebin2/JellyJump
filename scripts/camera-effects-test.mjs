/**
 * Tests the camera's baked effects.
 *
 * The whole feature turns on one fact: the webcam recorder wraps the player
 * canvas in a MediaBunny CanvasSource, which reads canvas *pixels*, while a
 * CSS filter on the canvas *element* is composited afterwards and never
 * reaches them. So an effect that only sets `canvas.style.filter` shows up in
 * the preview and is missing from the recording — which is why the filters
 * button was hidden in camera mode to begin with.
 *
 * These assert the two modes stay honest: CSS mode leaves the pixels alone,
 * canvas mode puts everything in them and nothing on the element, and neither
 * applies the same adjustment twice.
 *
 *   node scripts/camera-effects-test.mjs
 */
import { VideoFilters } from '../assets/js/ui/player/VideoFilters.js';

let pass = 0, fail = 0;
const check = (ok, label) => {
    if (ok) { pass++; console.log(`  PASS  ${label}`); }
    else { fail++; console.log(`  FAIL  ${label}`); }
};

// --- the least stubbing that lets the real class run ------------------------

function makeCanvas(width = 1280, height = 720) {
    const classes = new Set();
    return {
        tagName: 'CANVAS', width, height, clientWidth: width / 2,
        style: { filter: '' },
        classList: {
            add: c => classes.add(c), remove: c => classes.delete(c),
            contains: c => classes.has(c), _all: classes,
        },
        getContext: () => makeCtx(),
    };
}

/** Records what was asked of it; that is all these tests need to see. */
function makeCtx() {
    const calls = [];
    return {
        filter: 'none', globalAlpha: 1, imageSmoothingEnabled: true, fillStyle: null,
        get log() { return calls; },
        drawImage(...a) { calls.push({ op: 'drawImage', filter: this.filter, args: a }); },
        fillRect(...a) { calls.push({ op: 'fillRect', filter: this.filter, alpha: this.globalAlpha, args: a }); },
        save() { calls.push({ op: 'save' }); },
        restore() { calls.push({ op: 'restore' }); },
        translate() {}, scale() {},
        createLinearGradient: () => ({ addColorStop() {} }),
        createRadialGradient: () => ({ addColorStop() {} }),
        createPattern: () => ({ pattern: true }),
    };
}

// document is only reached for the pixelate buffer and the scanline tile.
globalThis.document = { createElement: () => makeCanvas(1, 4), getElementById: () => ({}) };

function filtersOn(canvas) {
    const f = new VideoFilters(canvas);
    f.canvas = canvas;      // the raw-canvas constructor path already does this
    return f;
}

const drawn = ctx => ctx.log.filter(c => c.op === 'drawImage');
const SOURCE = { source: true };

// --- playback is unchanged --------------------------------------------------

console.log('\nCSS mode leaves the pixels alone');
{
    const canvas = makeCanvas(), ctx = makeCtx();
    const f = filtersOn(canvas);
    f.applyPreset('vivid');
    f.drawFrame(ctx, SOURCE, 1280, 720);

    check(drawn(ctx).length === 1, 'one drawImage, as before');
    check(drawn(ctx)[0].filter === 'none', 'with no filter on the context');
    check(canvas.style.filter.includes('saturate(1.4)'),
        'the preset is on the element, where screenshots and exports stay clean of it');
}

// --- the camera ------------------------------------------------------------

console.log('\ncanvas mode bakes the adjustments into the frame');
{
    const canvas = makeCanvas(), ctx = makeCtx();
    const f = filtersOn(canvas);
    f.applyPreset('vivid');
    f.setCanvasMode(true);
    f.drawFrame(ctx, SOURCE, 1280, 720);

    const filter = drawn(ctx)[0].filter;
    check(filter.includes('saturate(1.4)') && filter.includes('contrast(1.2)'),
        `the preset is on the context, so the recorder sees it (${filter})`);
    check(canvas.style.filter === 'none',
        'and off the element — on both it would be applied twice');
    check(drawn(ctx).length === 1, 'still one drawImage: no second pass, no extra buffer');
}

console.log('\nthe SVG-backed FX carry over unchanged');
{
    const canvas = makeCanvas(), ctx = makeCtx();
    const f = filtersOn(canvas);
    f.setCanvasMode(true);
    f.applyEffect('matrix');
    f.drawFrame(ctx, SOURCE, 1280, 720);
    // ctx.filter accepts the same url(#id) references CSS does — verified
    // against real output pixels in a browser, not assumed here.
    check(drawn(ctx)[0].filter.includes('url(#jj-fx-matrix)'),
        'Matrix goes to the context by the same reference CSS used');
    check(!canvas.style.filter.includes('url(#jj-fx-matrix)'),
        'and is not left on the element as well');
}

console.log('\nthe three effects that are not a filter string');
{
    // Psychedelic: a CSS keyframe animation in the other mode, so in this one
    // it has to come off the clock.
    const f = filtersOn(makeCanvas());
    f.setCanvasMode(true);
    f.applyEffect('psychedelic');
    const a = makeCtx(), b = makeCtx();
    f.drawFrame(a, SOURCE, 1280, 720);
    const spin = () => { const t = Date.now(); while (Date.now() - t < 60); };
    spin();
    f.drawFrame(b, SOURCE, 1280, 720);
    check(/hue-rotate\(\d+deg\)/.test(drawn(a)[0].filter), 'psychedelic is a hue rotation');
    check(drawn(a)[0].filter !== drawn(b)[0].filter, 'that moves between frames');
}
{
    // Pixelate: the low-res overlay element, done as down-then-up.
    const canvas = makeCanvas(), ctx = makeCtx();
    const f = filtersOn(canvas);
    f.setCanvasMode(true);
    f.applyEffect('pixelate');
    f.drawFrame(ctx, SOURCE, 1280, 720);
    const up = drawn(ctx)[0];
    check(drawn(ctx).length === 1 && up.args[3] === 1280 && up.args[4] === 720,
        'the frame is drawn back up to full size');
    check(ctx.imageSmoothingEnabled === true,
        'and smoothing is restored afterwards, so nothing else renders blocky');
}
{
    // Scanlines: the overlay div.
    const ctx = makeCtx();
    const f = filtersOn(makeCanvas());
    f.setCanvasMode(true);
    f.applyEffect('crt');
    f.drawFrame(ctx, SOURCE, 1280, 720);
    const fills = ctx.log.filter(c => c.op === 'fillRect');
    check(fills.length === 1 && fills[0].args[2] === 1280, 'scanlines are painted over the frame');
    check(fills[0].alpha > 0.85 && fills[0].alpha <= 1,
        `the CSS flicker keyframes are reproduced (alpha ${fills[0].alpha.toFixed(3)})`);
}

console.log('\nan effect the machine cannot afford is dropped to preview, out loud');
{
    const canvas = makeCanvas(), ctx = makeCtx();
    const f = filtersOn(canvas);
    f.setCanvasMode(true);
    f.applyEffect('robot');

    let told = null;
    f.onBakeFallback = (label, ms) => { told = { label, ms }; };

    // Robot is a per-pixel convolution: ~2.5ms a frame on a GPU, 163ms with
    // canvas acceleration off. The cost is inside the draw, so that is where
    // it has to be simulated — timing anything else would not be timing this.
    ctx.drawImage = function (...a) {
        const t = performance.now();
        while (performance.now() - t < 9);
        this.log.push({ op: 'drawImage', filter: this.filter, args: a });
    };
    for (let i = 0; i < 40 && !told; i++) f.drawFrame(ctx, SOURCE, 1280, 720);

    check(told !== null, 'the drop is reported rather than left to be discovered in the file');
    check(told?.label === 'Robot', `named by its label (${told?.label})`);

    const after = makeCtx();
    f.drawFrame(after, SOURCE, 1280, 720);
    check(!drawn(after)[0].filter.includes('url(#jj-fx-robot)'),
        'and it stops being baked, so the frame rate recovers');
    check(canvas.style.filter.includes('url(#jj-fx-robot)'),
        'while staying on screen through CSS, where the compositor does the work');
}

console.log('\nleaving the camera puts playback back as it was');
{
    const canvas = makeCanvas(), ctx = makeCtx();
    const f = filtersOn(canvas);
    f.applyPreset('warm');
    f.setCanvasMode(true);
    f.setCanvasMode(false);
    f.drawFrame(ctx, SOURCE, 1280, 720);

    check(canvas.style.filter.includes('sepia(0.15)'), 'the adjustments are back on the element');
    check(drawn(ctx)[0].filter === 'none', 'and no longer on the context — never both');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

/**
 * Tests the full-frame decorations: borders, falling pieces, and the motions
 * a placed sticker can be given.
 *
 * The property worth defending is that the whole scene is a function of the
 * clock. Nothing is stored between frames, so seeking to a moment gives the
 * arrangement that belongs there, a screenshot catches exactly what was on
 * screen, and playing the same file twice looks the same both times. An
 * accumulating particle system would give up all three for the same drawing
 * cost, and would do it invisibly -- it looks correct until you scrub.
 *
 *   node scripts/decoration-test.mjs
 */
let pass = 0, fail = 0;
const check = (ok, label) => {
    if (ok) { pass++; console.log(`  PASS  ${label}`); }
    else { fail++; console.log(`  FAIL  ${label}`); }
};

// Sprites are rasterised glyphs; here they only need to be identifiable.
globalThis.document = {
    createElement: () => ({
        width: 0, height: 0,
        getContext: () => ({ font: '', textBaseline: '', fillText() {} }),
    }),
};
globalThis.createImageBitmap = () => Promise.reject(new Error('not in node'));

const { DecorationLayer, RAIN_PRESETS, BORDER_PRESETS, DEFAULT_DENSITY, MAX_DENSITY }
    = await import('../assets/js/ui/player/DecorationLayer.js');
const { STICKER_MOTIONS } = await import('../assets/js/ui/player/StickerLayer.js');

const makePlayer = () => ({
    canvas: { width: 1280, height: 720 }, currentTime: 0, isStreamMode: false, isPlaying: true,
    callbacks: [],
    addRenderCallback(cb) { this.callbacks.push(cb); },
    removeRenderCallback(cb) { this.callbacks.splice(this.callbacks.indexOf(cb), 1); },
    overlayTimeMs() { return this.isStreamMode ? performance.now() : this.currentTime * 1000; },
});

const spyCtx = () => {
    const calls = [];
    let tx = 0, ty = 0; const stack = [];
    return { calls, globalAlpha: 1, lineWidth: 0, strokeStyle: '',
        save() { stack.push([tx, ty]); }, restore() { [tx, ty] = stack.pop() || [0, 0]; },
        translate(x, y) { tx += x; ty += y; }, rotate() {}, scale() {},
        strokeRect(...a) { calls.push({ op: 'strokeRect', args: a }); },
        drawImage(img, x, y, w) { calls.push({ op: 'drawImage', x: tx + x, y: ty + y, w }); } };
};

const canvas = { width: 1280, height: 720 };
const layout = (layer, t) => {
    layer.player.currentTime = t;
    const ctx = spyCtx();
    layer.drawInto(canvas, ctx);
    return ctx.calls.filter(c => c.op === 'drawImage')
        .map(c => `${c.x.toFixed(2)},${c.y.toFixed(2)},${c.w.toFixed(2)}`).join('|');
};

// --- the property that matters ---------------------------------------------

console.log('\nfalling pieces are a function of the clock');
{
    const layer = new DecorationLayer(makePlayer());
    layer.registerFrontPass();
    layer.setRain('flowers');

    check(layout(layer, 1.0) === layout(layer, 1.0),
        'the same moment always draws the same arrangement');
    check(layout(layer, 1.0) !== layout(layer, 1.4), 'a later moment differs');
    check(layout(layer, 2.5) !== '' && layout(layer, 1.0) === layout(layer, 1.0),
        'and going back to an earlier moment restores it exactly — this is what makes seeking work');

    // Two separate layers at the same time agree, which is the same property
    // seen from the other side: nothing is carried in an instance.
    const other = new DecorationLayer(makePlayer());
    other.setRain('flowers');
    check(layout(layer, 3.3) === layout(other, 3.3),
        'a second layer at the same moment draws the identical scene');
    layer.destroy(); other.destroy();
}

console.log('\ndensity changes how many, not which');
{
    const layer = new DecorationLayer(makePlayer());
    layer.setRain('hearts');
    layer.setDensity(20);
    const twenty = layout(layer, 2.0).split('|');
    layer.setDensity(60);
    const sixty = layout(layer, 2.0).split('|');

    check(twenty.length === 20 && sixty.length === 60, `20 and 60 pieces (${twenty.length}, ${sixty.length})`);
    check(sixty.slice(0, 20).join('|') === twenty.join('|'),
        'turning it up adds pieces without moving the ones already falling');
    layer.setDensity(99999);
    check(layer.density === MAX_DENSITY, `density is capped at ${MAX_DENSITY}`);
    check(DEFAULT_DENSITY === 60, 'and defaults to 60, which measured ~0.3ms a frame at 720p');
    layer.destroy();
}

console.log('\npieces stay on the frame and wrap round it');
{
    const layer = new DecorationLayer(makePlayer());
    layer.setRain('confetti');
    let offFrame = 0, seen = 0;
    for (let t = 0; t < 40; t += 0.37) {
        for (const piece of layout(layer, t).split('|')) {
            const [x, y] = piece.split(',').map(Number);
            seen++;
            if (x < -200 || x > 1480 || y < -200 || y > 920) offFrame++;
        }
    }
    check(seen > 5000 && offFrame === 0,
        `across 40 seconds no piece drifts off into nowhere (${seen} sampled, ${offFrame} stray)`);
    layer.destroy();
}

// --- borders ----------------------------------------------------------------

console.log('\na border frames the picture');
{
    const layer = new DecorationLayer(makePlayer());
    layer.registerFrontPass();
    layer.setBorder('flowers');
    const ctx = spyCtx();
    layer.drawInto(canvas, ctx);

    const frame = ctx.calls.find(c => c.op === 'strokeRect');
    const glyphs = ctx.calls.filter(c => c.op === 'drawImage');
    check(!!frame, 'the frame itself is stroked');
    check(glyphs.length === BORDER_PRESETS.flowers.count,
        `with ${BORDER_PRESETS.flowers.count} glyphs around it (${glyphs.length})`);

    // Spread by perimeter, so all four edges are used.
    const edges = { top: 0, right: 0, bottom: 0, left: 0 };
    for (const g of glyphs) {
        const cx = g.x + g.w / 2, cy = g.y + g.w / 2;
        if (cy < 40) edges.top++;
        else if (cx > 1240) edges.right++;
        else if (cy > 680) edges.bottom++;
        else edges.left++;
    }
    check(Object.values(edges).every(n => n > 0),
        `every edge gets glyphs (top ${edges.top}, right ${edges.right}, bottom ${edges.bottom}, left ${edges.left})`);
    layer.destroy();
}

console.log('\nnothing is drawn when nothing is chosen');
{
    const layer = new DecorationLayer(makePlayer());
    layer.registerFrontPass();
    const ctx = spyCtx();
    layer.drawInto(canvas, ctx);
    check(ctx.calls.length === 0 && !layer.isActive(), 'an idle layer draws nothing at all');
    layer.setRain('snow');
    layer.clear();
    const after = spyCtx();
    layer.drawInto(canvas, after);
    check(after.calls.length === 0, 'and clearing it goes back to nothing');
    layer.destroy();
}

// --- sticker motions --------------------------------------------------------

console.log('\na sticker’s motion is a function of the clock too');
{
    for (const [name, motion] of Object.entries(STICKER_MOTIONS)) {
        const a = motion.at(1.0), b = motion.at(1.0), c = motion.at(1.7);
        const same = a.dx === b.dx && a.dy === b.dy && a.scale === b.scale && a.rotate === b.rotate;
        const moved = a.dx !== c.dx || a.dy !== c.dy || a.scale !== c.scale || a.rotate !== c.rotate;
        check(same && moved, `${name}: repeatable at a given time, and moves between times`);
    }
    check(STICKER_MOTIONS.pulse.at(0).scale >= 1, 'pulse only ever grows, never shrinks below its size');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

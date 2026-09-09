/**
 * VideoFilters - visual effects for the video canvas, in one of two modes.
 *
 * CSS mode (playback, the default) is display-only: it never touches decoded
 * frame pixels, so screenshots and exports of a file stay clean.
 *  - Numeric adjustments + colour presets  -> CSS `filter` string on the canvas
 *  - "Fun" FX (robot/comic/thermal/...)     -> SVG filters referenced via CSS
 *  - Scanlines / vignette / grain           -> a pointer-events:none overlay div
 *  - Pixelate                               -> a low-res overlay <canvas> that the
 *                                              browser upscales nearest-neighbour
 *  - Psychedelic                            -> a CSS keyframe hue animation
 *
 * Canvas mode (the camera) draws the same effects into the 2D context instead,
 * through `drawFrame`. It has to: the webcam recorder wraps the canvas in a
 * MediaBunny CanvasSource, which reads canvas *pixels*, while a CSS filter on
 * the canvas *element* is composited afterwards and never reaches them. In CSS
 * mode the recording would come out plain while the preview looked filtered.
 *
 * The effect definitions below are shared by both modes -- `ctx.filter` accepts
 * the same `url(#jj-fx-*)` references CSS does. Only the three effects that are
 * not a filter string (pixelate, psychedelic, the overlay div) need a canvas
 * equivalent, and each is written beside its CSS counterpart.
 */

// Inline SVG filter defs, injected once per document. Referenced from CSS as
// `filter: url(#id)` — display-only and GPU-composited by the browser.
const SVG_DEFS = `
<svg id="jj-fx-svg" width="0" height="0" style="position:absolute;pointer-events:none" aria-hidden="true">
  <defs>
    <filter id="jj-fx-posterize" color-interpolation-filters="sRGB">
      <feComponentTransfer>
        <feFuncR type="discrete" tableValues="0 0.25 0.5 0.75 1"/>
        <feFuncG type="discrete" tableValues="0 0.25 0.5 0.75 1"/>
        <feFuncB type="discrete" tableValues="0 0.25 0.5 0.75 1"/>
      </feComponentTransfer>
    </filter>
    <filter id="jj-fx-robot" color-interpolation-filters="sRGB">
      <feConvolveMatrix order="3" preserveAlpha="true"
        kernelMatrix="0 -1 0  -1 4 -1  0 -1 0"/>
      <feComponentTransfer>
        <feFuncR type="linear" slope="3"/>
        <feFuncG type="linear" slope="3"/>
        <feFuncB type="linear" slope="3"/>
      </feComponentTransfer>
      <feColorMatrix type="matrix"
        values="0 0 0 0 0   1 1 1 0 0   0.1 0.1 0.1 0 0   0 0 0 1 0"/>
    </filter>
    <filter id="jj-fx-matrix" color-interpolation-filters="sRGB">
      <feColorMatrix type="matrix"
        values="0 0 0 0 0   0.35 0.6 0.15 0 0   0 0 0 0 0   0 0 0 1 0"/>
    </filter>
    <filter id="jj-fx-emboss" color-interpolation-filters="sRGB">
      <feConvolveMatrix order="3" preserveAlpha="true" bias="0.5"
        kernelMatrix="-2 -1 0  -1 1 1  0 1 2"/>
    </filter>
    <filter id="jj-fx-thermal" color-interpolation-filters="sRGB">
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer>
        <feFuncR type="table" tableValues="0 0 0.4 0.8 1 1 1"/>
        <feFuncG type="table" tableValues="0 0.1 0.4 0.7 0.6 0.3 0.9"/>
        <feFuncB type="table" tableValues="0.3 0.7 1 0.5 0.1 0 0.2"/>
      </feComponentTransfer>
    </filter>
  </defs>
</svg>`;

// Fun-effect definitions. `css` tokens are appended to the CSS filter string.
const EFFECTS = {
    pixelate:    { label: 'Pixelate',    css: [],                                        pixelate: 14 },
    robot:       { label: 'Robot',       css: ['url(#jj-fx-robot)', 'contrast(1.4)'],    overlay: 'scanlines' },
    matrix:      { label: 'Matrix',      css: ['url(#jj-fx-matrix)', 'contrast(1.25)', 'brightness(1.1)'], overlay: 'scanlines' },
    comic:       { label: 'Comic',       css: ['url(#jj-fx-posterize)', 'saturate(1.6)', 'contrast(1.1)'] },
    emboss:      { label: 'Metal',       css: ['url(#jj-fx-emboss)'] },
    thermal:     { label: 'Thermal',     css: ['url(#jj-fx-thermal)'] },
    negative:    { label: 'Negative',    css: ['invert(1)'] },
    noir:        { label: 'Noir',        css: ['grayscale(1)', 'contrast(1.4)', 'brightness(0.95)'], overlay: 'vignette' },
    vaporwave:   { label: 'Vaporwave',   css: ['hue-rotate(280deg)', 'saturate(1.8)', 'contrast(1.05)'] },
    dreamy:      { label: 'Dreamy',      css: ['blur(2px)', 'brightness(1.12)', 'saturate(1.15)'], overlay: 'vignette' },
    crt:         { label: 'CRT',         css: ['contrast(1.15)', 'saturate(1.25)'],      overlay: 'scanlines' },
    psychedelic: { label: 'Psychedelic', css: [], psychedelic: true },
};

/**
 * Effects built on a per-pixel convolution. Measured at 1280x720: ~2.5ms a
 * frame on a GPU, but 163ms with canvas acceleration off -- a 16.7ms budget
 * blown ten times over, which would drop the camera to a slideshow. So they
 * are timed on the machine actually running them rather than assumed, and
 * dropped to preview-only if that machine cannot afford them.
 */
const HEAVY_EFFECTS = new Set(['robot', 'emboss']);

/** A baked effect may take this much of a frame before it is judged too slow. */
const BAKE_BUDGET_MS = 8;
/** Frames timed before judging, after discarding warm-up (shader compiles). */
const BAKE_PROBE_FRAMES = 24;
const BAKE_PROBE_WARMUP = 6;

/** CSS `.fx-scanlines` is a 4px cycle; matched here so both modes look alike. */
const SCANLINE_CYCLE = 4;

export class VideoFilters {
    /**
     * @param {Object} player - the CorePlayer (needs .canvas, .container, frame hook)
     */
    constructor(player) {
        // Accept a raw canvas too, for backwards-compat, but the fun FX need the player.
        if (player && player.tagName === 'CANVAS') {
            this.canvas = player;
            this.player = null;
        } else {
            this.player = player;
            this.canvas = player?.canvas || null;
        }

        this.brightness = 100;
        this.contrast = 100;
        this.saturation = 100;
        this.sepia = 0;
        this.grayscale = 0;
        this.hueRotate = 0;
        this.blur = 0;      // px
        this.invert = 0;    // 0-100
        this.effect = null; // key of EFFECTS or null

        this.presets = {
            'reset': { brightness: 100, contrast: 100, saturation: 100, sepia: 0, grayscale: 0, hueRotate: 0 },
            'night': { brightness: 80, contrast: 110, saturation: 80, sepia: 20, grayscale: 0, hueRotate: 0 },
            'vivid': { brightness: 105, contrast: 120, saturation: 140, sepia: 0, grayscale: 0, hueRotate: 0 },
            'grayscale': { brightness: 100, contrast: 100, saturation: 0, sepia: 0, grayscale: 100, hueRotate: 0 },
            'sepia': { brightness: 100, contrast: 100, saturation: 100, sepia: 100, grayscale: 0, hueRotate: 0 },
            'cool': { brightness: 100, contrast: 105, saturation: 110, sepia: 0, grayscale: 0, hueRotate: 180 },
            'warm': { brightness: 105, contrast: 105, saturation: 110, sepia: 15, grayscale: 0, hueRotate: 0 }
        };

        this.effects = EFFECTS;

        /** Draw effects into the 2D context instead of onto the element. */
        this.canvasMode = false;
        /** Effects this machine proved too slow to bake; preview-only instead. */
        this._bakeUnaffordable = new Set();
        this._bakeProbe = null;
        /** Called with (label, msPerFrame) when an effect is dropped to preview. */
        this.onBakeFallback = null;
        this._pixelBuffer = null;
        this._scanlines = null;

        this._ensureSvgDefs();
        this._ensureFx();
    }

    /**
     * Switch between drawing effects onto the element (playback) and into the
     * context (camera, where the recorder reads pixels).
     * @param {boolean} enabled
     */
    setCanvasMode(enabled) {
        const on = !!enabled;
        if (on === this.canvasMode) return;
        this.canvasMode = on;
        // A mode change must not leave the other mode's output behind, or the
        // effect is applied twice -- once in the pixels, once over them.
        if (on) this._startBakeProbe();
        this._apply();
    }

    // --- numeric setters -------------------------------------------------
    setBrightness(v) { this.brightness = this._clamp(v, 0, 200); this._apply(); }
    setContrast(v) { this.contrast = this._clamp(v, 0, 200); this._apply(); }
    setSaturation(v) { this.saturation = this._clamp(v, 0, 200); this._apply(); }
    setBlur(v) { this.blur = this._clamp(v, 0, 20); this._apply(); }
    setInvert(v) { this.invert = this._clamp(v, 0, 100); this._apply(); }

    _clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, Number(v) || 0)); }

    // --- presets / effects ----------------------------------------------
    applyPreset(presetName) {
        const preset = this.presets[presetName];
        if (!preset) return;
        this.brightness = preset.brightness;
        this.contrast = preset.contrast;
        this.saturation = preset.saturation;
        this.sepia = preset.sepia;
        this.grayscale = preset.grayscale;
        this.hueRotate = preset.hueRotate;
        this._apply();
    }

    /** Toggle a fun effect. Passing the currently-active effect clears it. */
    applyEffect(name) {
        if (!this.effects[name]) return;
        this.effect = (this.effect === name) ? null : name;
        this._startBakeProbe();
        this._apply();
    }

    reset() {
        this.brightness = 100; this.contrast = 100; this.saturation = 100;
        this.sepia = 0; this.grayscale = 0; this.hueRotate = 0;
        this.blur = 0; this.invert = 0; this.effect = null;
        this._apply();
    }

    getState() {
        return {
            brightness: this.brightness, contrast: this.contrast, saturation: this.saturation,
            sepia: this.sepia, grayscale: this.grayscale, hueRotate: this.hueRotate,
            blur: this.blur, invert: this.invert, effect: this.effect
        };
    }

    setState(state) {
        if (!state) return;
        this.brightness = state.brightness ?? 100;
        this.contrast = state.contrast ?? 100;
        this.saturation = state.saturation ?? 100;
        this.sepia = state.sepia ?? 0;
        this.grayscale = state.grayscale ?? 0;
        this.hueRotate = state.hueRotate ?? 0;
        this.blur = state.blur ?? 0;
        this.invert = state.invert ?? 0;
        this.effect = (state.effect && this.effects[state.effect]) ? state.effect : null;
        this._apply();
    }

    isActive() {
        return this.brightness !== 100 || this.contrast !== 100 || this.saturation !== 100 ||
            this.sepia !== 0 || this.grayscale !== 0 || this.hueRotate !== 0 ||
            this.blur !== 0 || this.invert !== 0 || this.effect !== null;
    }

    // --- rendering -------------------------------------------------------

    /**
     * The numeric adjustments, as filter tokens. Shared by both modes: the
     * same string is valid on `element.style.filter` and on `ctx.filter`.
     * @private
     */
    _adjustmentTokens() {
        const tokens = [];
        if (this.brightness !== 100) tokens.push(`brightness(${this.brightness / 100})`);
        if (this.contrast !== 100) tokens.push(`contrast(${this.contrast / 100})`);
        if (this.saturation !== 100) tokens.push(`saturate(${this.saturation / 100})`);
        if (this.sepia > 0) tokens.push(`sepia(${this.sepia / 100})`);
        if (this.grayscale > 0) tokens.push(`grayscale(${this.grayscale / 100})`);
        if (this.hueRotate !== 0) tokens.push(`hue-rotate(${this.hueRotate}deg)`);
        if (this.blur > 0) tokens.push(`blur(${this.blur}px)`);
        if (this.invert > 0) tokens.push(`invert(${this.invert / 100})`);
        return tokens;
    }

    _apply() {
        if (!this.canvas) return;
        const eff = this.effect ? this.effects[this.effect] : null;

        // What stays on the element. In canvas mode that is nothing the
        // recorder can already see -- only an effect this machine turned out
        // to be too slow to bake, which is preview-only by definition.
        const cssEff = this.canvasMode
            ? (this.effect && this._bakeUnaffordable.has(this.effect) ? eff : null)
            : eff;

        // Overlay (scanlines / vignette / grain)
        if (this._overlay) {
            this._overlay.className = 'jellyjump-fx-overlay' + (cssEff?.overlay ? ` fx-${cssEff.overlay}` : '');
        }

        // Pixelate overlay canvas
        this._setPixelate(cssEff?.pixelate || 0);

        // Psychedelic runs as a CSS keyframe animation on `filter`, so we must
        // NOT set an inline filter (inline would override the animation).
        if (cssEff?.psychedelic) {
            this.canvas.classList.add('jj-fx-psychedelic');
            this.canvas.style.filter = '';
            return;
        }
        this.canvas.classList.remove('jj-fx-psychedelic');

        const tokens = [];
        if (cssEff?.css) tokens.push(...cssEff.css);
        // In canvas mode the adjustments are baked, so applying them here too
        // would double them on screen.
        if (!this.canvasMode) tokens.push(...this._adjustmentTokens());

        this.canvas.style.filter = tokens.length ? tokens.join(' ') : 'none';
    }

    // --- canvas mode -----------------------------------------------------

    /**
     * Draw one frame, with every affordable effect baked into the pixels.
     * The single drawImage the render loop already made, plus a `ctx.filter`
     * on it -- no second buffer and no extra pass in the common case.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {CanvasImageSource} source
     * @param {number} w
     * @param {number} h
     */
    drawFrame(ctx, source, w, h) {
        if (!this.canvasMode) {
            ctx.drawImage(source, 0, 0, w, h);
            return;
        }

        const key = this.effect;
        const eff = (key && !this._bakeUnaffordable.has(key)) ? this.effects[key] : null;
        const timing = eff && HEAVY_EFFECTS.has(key) && this._bakeProbe;
        const started = timing ? performance.now() : 0;

        const filter = this._canvasFilter(eff);

        if (eff?.pixelate) {
            this._drawPixelated(ctx, source, w, h, eff.pixelate, filter);
        } else {
            ctx.filter = filter;
            ctx.drawImage(source, 0, 0, w, h);
            ctx.filter = 'none';
        }

        if (eff?.overlay) this._drawOverlay(ctx, w, h, eff.overlay);

        if (timing) this._recordBakeSample(performance.now() - started);
    }

    /**
     * The filter string for a baked frame. Psychedelic is a CSS keyframe
     * animation in the other mode; here it is driven off the clock instead,
     * which also stops it drifting from the frames being recorded.
     * @private
     */
    _canvasFilter(eff) {
        const tokens = [];
        if (eff?.psychedelic) {
            const deg = Math.round(((performance.now() % 4000) / 4000) * 360);
            tokens.push(`hue-rotate(${deg}deg)`, 'saturate(1.6)');
        } else if (eff?.css) {
            tokens.push(...eff.css);
        }
        tokens.push(...this._adjustmentTokens());
        return tokens.length ? tokens.join(' ') : 'none';
    }

    /**
     * Down then up with smoothing off — the canvas equivalent of the low-res
     * overlay element. The colour work happens on the small draw, where it is
     * cheapest.
     * @private
     */
    _drawPixelated(ctx, source, w, h, level, filter) {
        const bw = Math.max(8, Math.round(w / level));
        const bh = Math.max(8, Math.round(h / level));
        if (!this._pixelBuffer) {
            this._pixelBuffer = document.createElement('canvas');
            this._pixelBufferCtx = this._pixelBuffer.getContext('2d');
        }
        const buf = this._pixelBuffer, bctx = this._pixelBufferCtx;
        if (buf.width !== bw || buf.height !== bh) { buf.width = bw; buf.height = bh; }

        bctx.filter = filter;
        bctx.drawImage(source, 0, 0, bw, bh);
        bctx.filter = 'none';

        const smoothing = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(buf, 0, 0, w, h);
        ctx.imageSmoothingEnabled = smoothing;
    }

    /**
     * The scanline / vignette overlay, drawn rather than layered as a div.
     * Both reproduce `.jellyjump-fx-overlay` in player.css, including the
     * flicker keyframes, so the two modes look the same.
     * @private
     */
    _drawOverlay(ctx, w, h, kind) {
        if (kind === 'scanlines') {
            // Scaled to how big the canvas is *displayed*: the CSS version's
            // 4px cycle is in screen pixels, and at 720p backing resolution an
            // unscaled cycle would come out twice as fine as it looks now.
            const shown = this.canvas?.clientWidth || w;
            const cycle = Math.max(2, Math.round(SCANLINE_CYCLE * (w / shown)));
            const pattern = this._scanlinePattern(ctx, cycle);
            if (!pattern) return;
            const phase = (performance.now() % 3000) / 3000;
            const stepped = Math.floor(phase * 60) / 60;
            ctx.save();
            ctx.globalAlpha = 0.9 + 0.1 * (1 - Math.abs(stepped * 2 - 1));
            ctx.fillStyle = pattern;
            ctx.fillRect(0, 0, w, h);
            ctx.restore();
            return;
        }
        if (kind === 'vignette') {
            ctx.save();
            ctx.translate(w / 2, h / 2);
            ctx.scale(w / 2, h / 2);
            const g = ctx.createRadialGradient(0, 0, 0.45, 0, 0, 1);
            g.addColorStop(0, 'rgba(0,0,0,0)');
            g.addColorStop(1, 'rgba(0,0,0,0.55)');
            ctx.fillStyle = g;
            ctx.fillRect(-1, -1, 2, 2);
            ctx.restore();
        }
    }

    /** @private */
    _scanlinePattern(ctx, cycle) {
        if (this._scanlines?.cycle !== cycle) {
            const tile = document.createElement('canvas');
            tile.width = 1;
            tile.height = cycle;
            const tctx = tile.getContext('2d');
            // The stops of the repeating-linear-gradient in player.css, as
            // fractions of the cycle: clear for half, ramping to 0.28, solid.
            const g = tctx.createLinearGradient(0, 0, 0, cycle);
            g.addColorStop(0, 'rgba(0,0,0,0)');
            g.addColorStop(0.5, 'rgba(0,0,0,0)');
            g.addColorStop(0.75, 'rgba(0,0,0,0.28)');
            g.addColorStop(1, 'rgba(0,0,0,0.28)');
            tctx.fillStyle = g;
            tctx.fillRect(0, 0, 1, cycle);
            this._scanlines = { cycle, pattern: ctx.createPattern(tile, 'repeat') };
        }
        return this._scanlines.pattern;
    }

    // --- affordability probe ---------------------------------------------

    /** @private */
    _startBakeProbe() {
        this._bakeProbe = (this.canvasMode && this.effect && HEAVY_EFFECTS.has(this.effect)
            && !this._bakeUnaffordable.has(this.effect))
            ? { key: this.effect, skip: BAKE_PROBE_WARMUP, times: [] }
            : null;
    }

    /** @private */
    _recordBakeSample(ms) {
        const probe = this._bakeProbe;
        if (!probe || probe.key !== this.effect) return;
        if (probe.skip > 0) { probe.skip--; return; }

        probe.times.push(ms);
        if (probe.times.length < BAKE_PROBE_FRAMES) return;

        this._bakeProbe = null;
        const sorted = probe.times.slice().sort((a, b) => a - b);
        const median = sorted[sorted.length >> 1];
        if (median <= BAKE_BUDGET_MS) return;

        // Too slow to bake here. Keep the effect on screen through CSS, where
        // the compositor does the work, and say that the recording will not
        // have it -- silently dropping either the effect or the frame rate
        // would both be worse than saying which.
        this._bakeUnaffordable.add(probe.key);
        this._apply();
        this.onBakeFallback?.(this.effects[probe.key]?.label || probe.key, median);
    }

    // --- fun-fx plumbing -------------------------------------------------
    _ensureSvgDefs() {
        if (typeof document === 'undefined' || document.getElementById('jj-fx-svg')) return;
        const holder = document.createElement('div');
        holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
        holder.innerHTML = SVG_DEFS;
        document.body.appendChild(holder);
    }

    _ensureFx() {
        const wrapper = this.player?.container?.querySelector('.jellyjump-video-wrapper');
        if (!wrapper) return;

        this._overlay = document.createElement('div');
        this._overlay.className = 'jellyjump-fx-overlay';
        wrapper.appendChild(this._overlay);

        this._pixelCanvas = document.createElement('canvas');
        this._pixelCanvas.className = 'jellyjump-fx-pixel';
        this._pixelCanvas.style.display = 'none';
        this._pixelCtx = this._pixelCanvas.getContext('2d');
        wrapper.appendChild(this._pixelCanvas);

        // Keep the pixelate buffer in sync with each presented frame.
        this._pixelateLevel = 0;
        this._frameCb = () => { if (this._pixelateLevel > 0) this._renderPixelate(); };
        if (this.player?.afterFrameRenderCallbacks) {
            this.player.afterFrameRenderCallbacks.push(this._frameCb);
        }
    }

    _setPixelate(level) {
        this._pixelateLevel = level;
        if (!this._pixelCanvas) return;
        if (level > 0) {
            this._pixelCanvas.style.display = 'block';
            this._renderPixelate(); // one-shot so it works while paused
        } else {
            this._pixelCanvas.style.display = 'none';
        }
    }

    _renderPixelate() {
        const src = this.canvas, fx = this._pixelCanvas, fctx = this._pixelCtx;
        if (!src || !fx || !fctx || !src.width || !src.height) return;
        const level = this._pixelateLevel || 14;
        const w = Math.max(8, Math.round(src.width / level));
        const h = Math.max(8, Math.round(src.height / level));
        if (fx.width !== w) fx.width = w;
        if (fx.height !== h) fx.height = h;
        fctx.imageSmoothingEnabled = false;
        fctx.clearRect(0, 0, w, h);
        try { fctx.drawImage(src, 0, 0, w, h); } catch { /* frame not ready */ }
    }

    destroy() {
        if (this._frameCb && this.player?.afterFrameRenderCallbacks) {
            const i = this.player.afterFrameRenderCallbacks.indexOf(this._frameCb);
            if (i !== -1) this.player.afterFrameRenderCallbacks.splice(i, 1);
        }
        this._overlay?.remove();
        this._pixelCanvas?.remove();
        this._pixelBuffer = null;
        this._pixelBufferCtx = null;
        this._scanlines = null;
    }
}

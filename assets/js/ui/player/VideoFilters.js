/**
 * VideoFilters - Manages preview-only visual effects for the video canvas.
 *
 * Everything here is display-only (it never touches decoded frame pixels, so
 * screenshots/exports stay clean):
 *  - Numeric adjustments + colour presets  -> CSS `filter` string on the canvas
 *  - "Fun" FX (robot/comic/thermal/...)     -> SVG filters referenced via CSS
 *  - Scanlines / vignette / grain           -> a pointer-events:none overlay div
 *  - Pixelate                               -> a low-res overlay <canvas> that the
 *                                              browser upscales nearest-neighbour
 *  - Psychedelic                            -> a CSS keyframe hue animation
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

        this._ensureSvgDefs();
        this._ensureFx();
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
    _apply() {
        if (!this.canvas) return;
        const eff = this.effect ? this.effects[this.effect] : null;

        // Overlay (scanlines / vignette / grain)
        if (this._overlay) {
            this._overlay.className = 'jellyjump-fx-overlay' + (eff?.overlay ? ` fx-${eff.overlay}` : '');
        }

        // Pixelate overlay canvas
        this._setPixelate(eff?.pixelate || 0);

        // Psychedelic runs as a CSS keyframe animation on `filter`, so we must
        // NOT set an inline filter (inline would override the animation).
        if (eff?.psychedelic) {
            this.canvas.classList.add('jj-fx-psychedelic');
            this.canvas.style.filter = '';
            return;
        }
        this.canvas.classList.remove('jj-fx-psychedelic');

        const tokens = [];
        if (eff?.css) tokens.push(...eff.css);
        if (this.brightness !== 100) tokens.push(`brightness(${this.brightness / 100})`);
        if (this.contrast !== 100) tokens.push(`contrast(${this.contrast / 100})`);
        if (this.saturation !== 100) tokens.push(`saturate(${this.saturation / 100})`);
        if (this.sepia > 0) tokens.push(`sepia(${this.sepia / 100})`);
        if (this.grayscale > 0) tokens.push(`grayscale(${this.grayscale / 100})`);
        if (this.hueRotate !== 0) tokens.push(`hue-rotate(${this.hueRotate}deg)`);
        if (this.blur > 0) tokens.push(`blur(${this.blur}px)`);
        if (this.invert > 0) tokens.push(`invert(${this.invert / 100})`);

        this.canvas.style.filter = tokens.length ? tokens.join(' ') : 'none';
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
    }
}

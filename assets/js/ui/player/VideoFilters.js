/**
 * VideoFilters - Manages CSS filters for the video canvas
 * Provides real-time visual adjustments without processing
 */
export class VideoFilters {
    /**
     * @param {HTMLCanvasElement} canvas - The video canvas element
     */
    constructor(canvas) {
        this.canvas = canvas;

        // Filter values (100 = no change)
        this.brightness = 100;
        this.contrast = 100;
        this.saturation = 100;
        this.sepia = 0;
        this.grayscale = 0;
        this.hueRotate = 0;

        // Presets
        this.presets = {
            'reset': { brightness: 100, contrast: 100, saturation: 100, sepia: 0, grayscale: 0, hueRotate: 0 },
            'night': { brightness: 80, contrast: 110, saturation: 80, sepia: 20, grayscale: 0, hueRotate: 0 },
            'vivid': { brightness: 105, contrast: 120, saturation: 140, sepia: 0, grayscale: 0, hueRotate: 0 },
            'grayscale': { brightness: 100, contrast: 100, saturation: 0, sepia: 0, grayscale: 100, hueRotate: 0 },
            'sepia': { brightness: 100, contrast: 100, saturation: 100, sepia: 100, grayscale: 0, hueRotate: 0 },
            'cool': { brightness: 100, contrast: 105, saturation: 110, sepia: 0, grayscale: 0, hueRotate: 180 },
            'warm': { brightness: 105, contrast: 105, saturation: 110, sepia: 15, grayscale: 0, hueRotate: 0 }
        };
    }

    /**
     * Set brightness (0-200, 100 = normal)
     * @param {number} value
     */
    setBrightness(value) {
        this.brightness = Math.max(0, Math.min(200, value));
        this._apply();
    }

    /**
     * Set contrast (0-200, 100 = normal)
     * @param {number} value
     */
    setContrast(value) {
        this.contrast = Math.max(0, Math.min(200, value));
        this._apply();
    }

    /**
     * Set saturation (0-200, 100 = normal)
     * @param {number} value
     */
    setSaturation(value) {
        this.saturation = Math.max(0, Math.min(200, value));
        this._apply();
    }

    /**
     * Apply a preset filter configuration
     * @param {string} presetName
     */
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

    /**
     * Reset all filters to default
     */
    reset() {
        this.applyPreset('reset');
    }

    /**
     * Get current filter values
     * @returns {Object}
     */
    getState() {
        return {
            brightness: this.brightness,
            contrast: this.contrast,
            saturation: this.saturation,
            sepia: this.sepia,
            grayscale: this.grayscale,
            hueRotate: this.hueRotate
        };
    }

    /**
     * Set state from saved values
     * @param {Object} state
     */
    setState(state) {
        if (!state) return;
        this.brightness = state.brightness ?? 100;
        this.contrast = state.contrast ?? 100;
        this.saturation = state.saturation ?? 100;
        this.sepia = state.sepia ?? 0;
        this.grayscale = state.grayscale ?? 0;
        this.hueRotate = state.hueRotate ?? 0;
        this._apply();
    }

    /**
     * Check if any filter is active
     * @returns {boolean}
     */
    isActive() {
        return this.brightness !== 100 ||
            this.contrast !== 100 ||
            this.saturation !== 100 ||
            this.sepia !== 0 ||
            this.grayscale !== 0 ||
            this.hueRotate !== 0;
    }

    /**
     * Apply filters to the canvas
     * @private
     */
    _apply() {
        if (!this.canvas) return;

        const filters = [];

        if (this.brightness !== 100) {
            filters.push(`brightness(${this.brightness / 100})`);
        }
        if (this.contrast !== 100) {
            filters.push(`contrast(${this.contrast / 100})`);
        }
        if (this.saturation !== 100) {
            filters.push(`saturate(${this.saturation / 100})`);
        }
        if (this.sepia > 0) {
            filters.push(`sepia(${this.sepia / 100})`);
        }
        if (this.grayscale > 0) {
            filters.push(`grayscale(${this.grayscale / 100})`);
        }
        if (this.hueRotate !== 0) {
            filters.push(`hue-rotate(${this.hueRotate}deg)`);
        }

        this.canvas.style.filter = filters.length > 0 ? filters.join(' ') : 'none';
    }
}

/**
 * AudioEqualizer - Manages audio equalization using Web Audio API
 * Provides 3-band EQ: Bass, Mid, Treble using BiquadFilterNodes
 */
export class AudioEqualizer {
    /**
     * @param {AudioContext} audioContext - The Web Audio API context
     */
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.isInitialized = false;

        // EQ bands (gain in dB, range: -12 to +12)
        this.bands = {
            bass: 0,
            mid: 0,
            treble: 0
        };

        // Filter nodes will be created when initialized
        this.bassFilter = null;
        this.midFilter = null;
        this.trebleFilter = null;

        // Presets
        this.presets = {
            'flat': { bass: 0, mid: 0, treble: 0 },
            'bass-boost': { bass: 8, mid: 0, treble: 0 },
            'treble-boost': { bass: 0, mid: 0, treble: 8 },
            'voice': { bass: -4, mid: 6, treble: 2 },
            'rock': { bass: 6, mid: -2, treble: 4 },
            'electronic': { bass: 8, mid: 2, treble: 6 },
            'acoustic': { bass: 2, mid: 0, treble: 4 }
        };
    }

    /**
     * Initialize the EQ filter chain
     * @returns {BiquadFilterNode} The first node in the chain (connect your source to this)
     */
    init() {
        if (this.isInitialized) return this.bassFilter;

        // Bass filter (lowshelf at 60Hz)
        this.bassFilter = this.audioContext.createBiquadFilter();
        this.bassFilter.type = 'lowshelf';
        this.bassFilter.frequency.value = 60;
        this.bassFilter.gain.value = this.bands.bass;

        // Mid filter (peaking at 1kHz)
        this.midFilter = this.audioContext.createBiquadFilter();
        this.midFilter.type = 'peaking';
        this.midFilter.frequency.value = 1000;
        this.midFilter.Q.value = 1;
        this.midFilter.gain.value = this.bands.mid;

        // Treble filter (highshelf at 14kHz)
        this.trebleFilter = this.audioContext.createBiquadFilter();
        this.trebleFilter.type = 'highshelf';
        this.trebleFilter.frequency.value = 14000;
        this.trebleFilter.gain.value = this.bands.treble;

        // Chain: source -> bass -> mid -> treble -> (output)
        this.bassFilter.connect(this.midFilter);
        this.midFilter.connect(this.trebleFilter);

        this.isInitialized = true;
        return this.bassFilter;
    }

    /**
     * Get the output node (connect this to destination/gain)
     * @returns {BiquadFilterNode}
     */
    getOutputNode() {
        return this.trebleFilter;
    }

    /**
     * Get the input node (connect source to this)
     * @returns {BiquadFilterNode}
     */
    getInputNode() {
        return this.bassFilter;
    }

    /**
     * Set bass gain (-12 to +12 dB)
     * @param {number} value
     */
    setBass(value) {
        this.bands.bass = Math.max(-12, Math.min(12, value));
        if (this.bassFilter) {
            this.bassFilter.gain.value = this.bands.bass;
        }
    }

    /**
     * Set mid gain (-12 to +12 dB)
     * @param {number} value
     */
    setMid(value) {
        this.bands.mid = Math.max(-12, Math.min(12, value));
        if (this.midFilter) {
            this.midFilter.gain.value = this.bands.mid;
        }
    }

    /**
     * Set treble gain (-12 to +12 dB)
     * @param {number} value
     */
    setTreble(value) {
        this.bands.treble = Math.max(-12, Math.min(12, value));
        if (this.trebleFilter) {
            this.trebleFilter.gain.value = this.bands.treble;
        }
    }

    /**
     * Apply a preset EQ configuration
     * @param {string} presetName
     */
    applyPreset(presetName) {
        const preset = this.presets[presetName];
        if (!preset) return;

        this.setBass(preset.bass);
        this.setMid(preset.mid);
        this.setTreble(preset.treble);
    }

    /**
     * Reset all bands to flat (0 dB)
     */
    reset() {
        this.applyPreset('flat');
    }

    /**
     * Get current EQ values
     * @returns {Object}
     */
    getState() {
        return { ...this.bands };
    }

    /**
     * Check if any EQ is applied
     * @returns {boolean}
     */
    isActive() {
        return this.bands.bass !== 0 || this.bands.mid !== 0 || this.bands.treble !== 0;
    }
}

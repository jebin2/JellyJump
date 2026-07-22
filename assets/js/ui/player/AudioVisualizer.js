import { Logger } from "../../shared/utils/Logger.js";
import { VisualizerRenderer } from './VisualizerRenderer.js';
import { VisualizerShapes } from './VisualizerShapes.js';
import { VisualizerMath } from './VisualizerMath.js';

/**
 * Audio visualizer tuned for beat response.
 * Features:
 * - Adaptive beat detection (low-end energy + spectral flux)
 * - Pitch estimation via autocorrelation
 * - Night sky scene: a twinkling star field that pulses with the music,
 *   plus shooting stars spawned at random and more often on strong beats
 */
export class AudioVisualizer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: false });

        // Modularized helpers
        this.renderer = new VisualizerRenderer(this);
        this.shapes = new VisualizerShapes(this);
        this.math = new VisualizerMath(this);

        this.isRunning = false;
        this.animationId = null;
        this.frameCounter = 0;

        // Audio Data
        this.analyser = null;
        this.freqData = null;
        this.timeData = null;
        this.lastFreqData = null;

        // Features
        this.bassLevel = 0;
        this.midLevel = 0;
        this.trebleLevel = 0;
        this.rmsLevel = 0;
        this.currentPitchHz = 0;
        this.pitchSmoothedHz = 0;
        this.lastBeatAt = 0;
        this.beatKick = 0;

        // History for beat detection
        this.energyHistory = [];
        this.fluxHistory = [];

        // Scene state (populated by the renderer)
        this.stars = [];
        this.shootingStars = [];
        this.sceneWidth = 0;
        this.sceneHeight = 0;

        this.simTime = 0;
        this.simulatedMode = false;

        Logger.log("[AudioVisualizer] Created");
    }

    /**
     * Connect to an audio source
     */
    connect(audioContext, source) {
        this.analyser = audioContext.createAnalyser();
        this.analyser.fftSize = 2048;
        this.analyser.smoothingTimeConstant = 0.65;
        source.connect(this.analyser);

        const freqLen = this.analyser.frequencyBinCount;
        this.freqData = new Uint8Array(freqLen);
        this.timeData = new Float32Array(this.analyser.fftSize);
        this.lastFreqData = new Uint8Array(freqLen);

        Logger.log("[AudioVisualizer] Connected");
    }

    /**
     * Start the visualization
     */
    start() {
        if (this.isRunning) return;

        this.simulatedMode = !this.analyser;
        this.isRunning = true;
        this._animate();
        Logger.log(`[AudioVisualizer] Started (${this.simulatedMode ? "simulated" : "audio"})`);
    }

    /**
     * Stop the visualization
     */
    stop() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        Logger.log("[AudioVisualizer] Stopped");
    }

    /**
     * Disconnect and cleanup
     */
    disconnect() {
        this.stop();
        if (this.analyser) {
            this.analyser.disconnect();
            this.analyser = null;
        }
        this.freqData = null;
        this.timeData = null;
        this.lastFreqData = null;
        Logger.log("[AudioVisualizer] Disconnected");
    }

    /**
     * Internal animation loop
     * @private
     */
    _animate() {
        if (!this.isRunning) return;

        this._updateAudioFeatures();
        this._drawFrame();
        this.animationId = requestAnimationFrame(() => this._animate());
    }

    /**
     * Analyze audio data to extract features
     * @private
     */
    _updateAudioFeatures() {
        if (this.simulatedMode || !this.analyser || !this.freqData || !this.timeData) {
            this._updateSimulatedFeatures();
            return;
        }

        this.analyser.getByteFrequencyData(this.freqData);
        this.analyser.getFloatTimeDomainData(this.timeData);

        const len = this.freqData.length;
        const bassEnd = Math.floor(len * 0.1);
        const midEnd = Math.floor(len * 0.5);

        let bassSum = 0, midSum = 0, trebleSum = 0;
        for (let i = 0; i < len; i++) {
            const val = this.freqData[i] / 255;
            if (i < bassEnd) bassSum += val;
            else if (i < midEnd) midSum += val;
            else trebleSum += val;
        }

        this.bassLevel = bassSum / bassEnd;
        this.midLevel = midSum / (midEnd - bassEnd);
        this.trebleLevel = trebleSum / (len - midEnd);

        let rms = 0;
        for (let i = 0; i < this.timeData.length; i++) {
            rms += this.timeData[i] * this.timeData[i];
        }
        this.rmsLevel = Math.sqrt(rms / this.timeData.length);

        let flux = 0;
        for (let i = 0; i < len; i++) {
            const delta = this.freqData[i] - this.lastFreqData[i];
            if (delta > 0) flux += delta;
        }
        flux /= (len * 255);
        this.lastFreqData.set(this.freqData);

        const now = performance.now();
        const beat = this.math.detectBeat(this.bassLevel, flux, now);

        this.beatKick *= 0.88;
        if (beat) {
            this.beatKick = Math.min(1, this.beatKick + 0.6 + this.bassLevel * 0.4);
        }

        if (this.frameCounter % 4 === 0) {
            this.currentPitchHz = this.math.estimatePitchHz(this.timeData, this.analyser.context.sampleRate);
            if (this.currentPitchHz > 0) {
                this.pitchSmoothedHz = this.pitchSmoothedHz === 0 ? this.currentPitchHz : this.pitchSmoothedHz * 0.8 + this.currentPitchHz * 0.2;
            }
        }

        this.frameCounter++;
        this.simTime += 0.016;
    }

    /**
     * Simulated feature update for when no audio is playing
     * @private
     */
    _updateSimulatedFeatures() {
        this.simTime += 0.016;
        this.bassLevel = 0.15 + Math.sin(this.simTime * 0.8) * 0.1;
        this.midLevel = 0.1 + Math.sin(this.simTime * 1.2) * 0.05;
        this.trebleLevel = 0.05 + Math.sin(this.simTime * 2.1) * 0.03;
        this.rmsLevel = this.bassLevel * 0.8;
        this.beatKick *= 0.88;

        if (Math.sin(this.simTime * 1.7) > 0.98) {
            const now = performance.now();
            if (now - this.lastBeatAt > 1500) {
                this.lastBeatAt = now;
                this.beatKick = Math.min(1, this.beatKick + 0.6);
            }
        }
    }

    /**
     * Draw the current frame to the canvas
     * @private
     */
    _drawFrame() {
        const width = this.canvas.width;
        const height = this.canvas.height;
        if (!width || !height) return;

        if (this.sceneWidth !== width || this.sceneHeight !== height) {
            this.renderer.initScene(width, height);
        }

        this.renderer.draw(width, height);
    }

    /**
     * Draw the static (idle) background
     */
    drawStaticBackground() {
        this.renderer.drawStaticBackground(this.canvas.width, this.canvas.height);
    }
}

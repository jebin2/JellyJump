import { Logger } from "../utils/Logger.js";

/**
 * Audio visualizer tuned for beat response.
 * Features:
 * - Adaptive beat detection (low-end energy + spectral flux)
 * - Pitch estimation via autocorrelation
 * - Mirrored spectrum bars + waveform + beat pulse flashes
 */
export class AudioVisualizer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");

        this.analyser = null;
        this.freqData = null;
        this.timeData = null;

        this.animationId = null;
        this.isRunning = false;
        this.simulatedMode = false;
        this.simTime = 0;

        this.barCount = 64;
        this.barPeaks = new Float32Array(this.barCount);

        this.bassLevel = 0;
        this.midLevel = 0;
        this.highLevel = 0;
        this.rmsLevel = 0;
        this.fluxLevel = 0;

        this.prevSpectrum = null;
        this.energyHistory = [];
        this.fluxHistory = [];
        this.lastBeatAt = 0;
        this.beatCooldownMs = 120;
        this.beatPulse = 0;
        this.flashAlpha = 0;

        this.currentPitchHz = 0;
        this.pitchSmoothedHz = 0;

        this.pulseRings = [];

        Logger.log("[AudioVisualizer] Created");
    }

    connect(audioContext, source) {
        this.analyser = audioContext.createAnalyser();
        this.analyser.fftSize = 2048;
        this.analyser.smoothingTimeConstant = 0.65;
        this.analyser.minDecibels = -100;
        this.analyser.maxDecibels = -10;

        source.connect(this.analyser);

        const freqLen = this.analyser.frequencyBinCount;
        this.freqData = new Uint8Array(freqLen);
        this.timeData = new Float32Array(this.analyser.fftSize);
        this.prevSpectrum = new Float32Array(freqLen);

        Logger.log("[AudioVisualizer] Connected");
    }

    start() {
        if (this.isRunning) return;

        this.simulatedMode = !this.analyser;
        this.isRunning = true;
        this.lastBeatAt = 0;
        this.energyHistory.length = 0;
        this.fluxHistory.length = 0;
        this.pulseRings.length = 0;
        this.barPeaks.fill(0);

        this._animate();
        Logger.log(`[AudioVisualizer] Started (${this.simulatedMode ? "simulated" : "audio"})`);
    }

    stop() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        Logger.log("[AudioVisualizer] Stopped");
    }

    disconnect() {
        this.stop();
        if (this.analyser) {
            this.analyser.disconnect();
            this.analyser = null;
        }

        this.freqData = null;
        this.timeData = null;
        this.prevSpectrum = null;
        this.pulseRings.length = 0;

        Logger.log("[AudioVisualizer] Disconnected");
    }

    _animate() {
        if (!this.isRunning) return;

        this.animationId = requestAnimationFrame(() => this._animate());
        this._updateAudioFeatures();
        this._drawFrame();
    }

    _updateAudioFeatures() {
        if (this.simulatedMode || !this.analyser || !this.freqData || !this.timeData) {
            this._updateSimulatedFeatures();
            return;
        }

        this.analyser.getByteFrequencyData(this.freqData);
        this.analyser.getFloatTimeDomainData(this.timeData);

        const len = this.freqData.length;
        const nyquist = this.analyser.context.sampleRate / 2;
        const hzPerBin = nyquist / len;

        const bassEnd = Math.max(1, Math.floor(180 / hzPerBin));
        const midEnd = Math.max(bassEnd + 1, Math.floor(2200 / hzPerBin));

        let bass = 0;
        let mid = 0;
        let high = 0;
        let lowEnergy = 0;

        for (let i = 0; i < len; i++) {
            const n = this.freqData[i] / 255;
            if (i < bassEnd) {
                bass += n;
                lowEnergy += n * n;
            } else if (i < midEnd) {
                mid += n;
            } else {
                high += n;
            }
        }

        this.bassLevel = bass / bassEnd;
        this.midLevel = mid / (midEnd - bassEnd);
        this.highLevel = high / Math.max(1, len - midEnd);

        let sumSq = 0;
        for (let i = 0; i < this.timeData.length; i++) {
            const v = this.timeData[i];
            sumSq += v * v;
        }
        this.rmsLevel = Math.min(1, Math.sqrt(sumSq / this.timeData.length) * 2.2);

        let flux = 0;
        for (let i = 0; i < len; i++) {
            const current = this.freqData[i] / 255;
            const delta = current - this.prevSpectrum[i];
            if (delta > 0) flux += delta;
            this.prevSpectrum[i] = current;
        }
        this.fluxLevel = flux / len;

        const now = performance.now();
        const beat = this._detectBeat(lowEnergy / bassEnd, this.fluxLevel, now);
        if (beat) {
            this.beatPulse = 1;
            this.flashAlpha = 0.65;
            this._spawnPulseRing();
            this.lastBeatAt = now;
        }

        this.currentPitchHz = this._estimatePitchHz(this.timeData, this.analyser.context.sampleRate);
        if (this.currentPitchHz > 0) {
            if (this.pitchSmoothedHz === 0) {
                this.pitchSmoothedHz = this.currentPitchHz;
            } else {
                this.pitchSmoothedHz = this.pitchSmoothedHz * 0.8 + this.currentPitchHz * 0.2;
            }
        } else {
            this.pitchSmoothedHz *= 0.98;
            if (this.pitchSmoothedHz < 30) this.pitchSmoothedHz = 0;
        }

        this.beatPulse *= 0.9;
        this.flashAlpha *= 0.84;
    }

    _updateSimulatedFeatures() {
        this.simTime += 0.03;

        const beatWave = (Math.sin(this.simTime * 1.7) + 1) * 0.5;
        const midWave = (Math.sin(this.simTime * 2.5 + 0.7) + 1) * 0.5;
        const highWave = (Math.sin(this.simTime * 4.2 + 1.8) + 1) * 0.5;

        this.bassLevel = 0.2 + beatWave * 0.6;
        this.midLevel = 0.15 + midWave * 0.55;
        this.highLevel = 0.1 + highWave * 0.5;
        this.rmsLevel = (this.bassLevel + this.midLevel + this.highLevel) / 3;
        this.fluxLevel = 0.06 + Math.abs(Math.sin(this.simTime * 3.4)) * 0.08;

        if (Math.sin(this.simTime * 1.7) > 0.98) {
            this.beatPulse = 1;
            this.flashAlpha = 0.45;
            this._spawnPulseRing();
        }

        const note = 130 + Math.sin(this.simTime * 0.9) * 90 + Math.sin(this.simTime * 0.27) * 45;
        this.pitchSmoothedHz = Math.max(60, note);

        this.beatPulse *= 0.9;
        this.flashAlpha *= 0.86;
    }

    _detectBeat(lowEnergy, flux, now) {
        this.energyHistory.push(lowEnergy);
        this.fluxHistory.push(flux);

        if (this.energyHistory.length > 45) this.energyHistory.shift();
        if (this.fluxHistory.length > 45) this.fluxHistory.shift();

        const energyAvg = this._avg(this.energyHistory);
        const fluxAvg = this._avg(this.fluxHistory);

        const energyPeak = lowEnergy > energyAvg * 1.25 + 0.01;
        const fluxPeak = flux > fluxAvg * 1.35 + 0.002;
        const cooldownDone = now - this.lastBeatAt >= this.beatCooldownMs;

        return cooldownDone && ((energyPeak && fluxPeak) || (this.bassLevel > 0.72 && fluxPeak));
    }

    _drawFrame() {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const ctx = this.ctx;

        const pitch = this.pitchSmoothedHz || 180;
        const pitchNorm = Math.max(0, Math.min(1, (pitch - 70) / 700));

        const baseHue = 200 + pitchNorm * 120;
        const accentHue = (baseHue + 55) % 360;

        const bg = ctx.createLinearGradient(0, 0, 0, height);
        bg.addColorStop(0, `hsl(${(baseHue + 300) % 360}, 45%, 7%)`);
        bg.addColorStop(0.5, `hsl(${baseHue}, 50%, 9%)`);
        bg.addColorStop(1, `hsl(${accentHue}, 55%, 8%)`);
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, width, height);

        this._drawBeatGlow(width, height, baseHue);
        this._drawSpectrumBars(width, height, baseHue, accentHue);
        this._drawWaveform(width, height, accentHue);
        this._drawPulseRings(width, height, accentHue);
        this._drawPitchLabel(width, height);
        this._drawFlash(width, height);
    }

    _drawBeatGlow(width, height, hue) {
        const intensity = this.rmsLevel * 0.35 + this.beatPulse * 0.65;
        const radius = Math.min(width, height) * (0.24 + intensity * 0.4);
        const grad = this.ctx.createRadialGradient(width / 2, height * 0.58, 0, width / 2, height * 0.58, radius);

        grad.addColorStop(0, `hsla(${hue}, 90%, 64%, ${0.18 + intensity * 0.25})`);
        grad.addColorStop(0.6, `hsla(${(hue + 25) % 360}, 95%, 56%, ${0.08 + intensity * 0.12})`);
        grad.addColorStop(1, "rgba(0, 0, 0, 0)");

        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, width, height);
    }

    _drawSpectrumBars(width, height, hueA, hueB) {
        const ctx = this.ctx;
        const top = height * 0.22;
        const maxH = height * 0.48;
        const centerX = width / 2;
        const half = this.barCount / 2;
        const gap = Math.max(2, width / this.barCount * 0.16);
        const barW = Math.max(2, width / this.barCount - gap);

        for (let i = 0; i < this.barCount; i++) {
            const spectrumIndex = Math.floor((i / this.barCount) * (this.freqData ? this.freqData.length : 128));
            const raw = this.freqData ? this.freqData[spectrumIndex] / 255 : (0.25 + 0.75 * Math.abs(Math.sin(this.simTime + i * 0.16)));
            const eased = Math.pow(raw, 1.25);
            const barH = Math.max(2, eased * maxH * (0.65 + this.rmsLevel * 0.9));

            this.barPeaks[i] = Math.max(this.barPeaks[i] * 0.92, barH);

            const distance = Math.abs(i - half) / half;
            const x = i < half
                ? centerX - (half - i) * (barW + gap)
                : centerX + (i - half) * (barW + gap);
            const y = top + (maxH - barH);

            const h = hueA + (hueB - hueA) * (1 - distance);
            ctx.fillStyle = `hsla(${h}, 95%, ${52 + raw * 26}%, ${0.35 + raw * 0.55})`;
            ctx.fillRect(x, y, barW, barH);

            const peakY = top + (maxH - this.barPeaks[i]);
            ctx.fillStyle = `hsla(${h}, 100%, 78%, 0.9)`;
            ctx.fillRect(x, peakY, barW, 2);
        }
    }

    _drawWaveform(width, height, hue) {
        const ctx = this.ctx;
        const centerY = height * 0.82;
        const amplitude = height * (0.08 + this.rmsLevel * 0.12 + this.beatPulse * 0.08);

        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = `hsla(${hue}, 100%, 72%, 0.85)`;

        const points = 220;
        for (let i = 0; i < points; i++) {
            const t = i / (points - 1);
            const x = t * width;

            let sample = 0;
            if (this.timeData) {
                const idx = Math.min(this.timeData.length - 1, Math.floor(t * this.timeData.length));
                sample = this.timeData[idx];
            } else {
                sample = Math.sin(this.simTime * 2.4 + t * Math.PI * 8) * 0.5;
            }

            const y = centerY + sample * amplitude;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }

        ctx.stroke();
    }

    _drawPulseRings(width, height, hue) {
        const cx = width / 2;
        const cy = height * 0.58;

        for (let i = this.pulseRings.length - 1; i >= 0; i--) {
            const ring = this.pulseRings[i];
            ring.radius += ring.speed;
            ring.alpha *= 0.95;

            if (ring.alpha < 0.02) {
                this.pulseRings.splice(i, 1);
                continue;
            }

            this.ctx.beginPath();
            this.ctx.ellipse(cx, cy, ring.radius, ring.radius * 0.48, 0, 0, Math.PI * 2);
            this.ctx.lineWidth = ring.width;
            this.ctx.strokeStyle = `hsla(${hue}, 95%, 74%, ${ring.alpha})`;
            this.ctx.stroke();
        }
    }

    _drawFlash(width, height) {
        if (this.flashAlpha <= 0.01) return;

        const g = this.ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height));
        g.addColorStop(0, `rgba(255, 255, 255, ${this.flashAlpha * 0.35})`);
        g.addColorStop(0.35, `rgba(195, 225, 255, ${this.flashAlpha * 0.25})`);
        g.addColorStop(1, "rgba(120, 180, 255, 0)");

        this.ctx.fillStyle = g;
        this.ctx.fillRect(0, 0, width, height);
    }

    _drawPitchLabel(width, height) {
        const pitch = this.pitchSmoothedHz;
        if (!pitch || pitch < 40) return;

        this.ctx.font = "12px monospace";
        this.ctx.fillStyle = "rgba(220, 240, 255, 0.75)";
        this.ctx.textAlign = "right";
        this.ctx.fillText(`${Math.round(pitch)} Hz`, width - 14, height - 14);
    }

    _spawnPulseRing() {
        this.pulseRings.push({
            radius: Math.max(24, Math.min(this.canvas.width, this.canvas.height) * 0.08),
            speed: 4 + this.bassLevel * 9,
            alpha: 0.5 + this.bassLevel * 0.35,
            width: 1.5 + this.rmsLevel * 2.5
        });

        if (this.pulseRings.length > 8) {
            this.pulseRings.shift();
        }
    }

    _estimatePitchHz(timeData, sampleRate) {
        const size = timeData.length;
        if (!size) return 0;

        let rms = 0;
        for (let i = 0; i < size; i++) rms += timeData[i] * timeData[i];
        rms = Math.sqrt(rms / size);
        if (rms < 0.015) return 0;

        let bestOffset = -1;
        let bestCorr = 0;

        const minHz = 70;
        const maxHz = 900;
        const minOffset = Math.floor(sampleRate / maxHz);
        const maxOffset = Math.floor(sampleRate / minHz);

        for (let offset = minOffset; offset <= maxOffset; offset++) {
            let corr = 0;
            for (let i = 0; i < size - offset; i++) {
                corr += timeData[i] * timeData[i + offset];
            }

            corr /= (size - offset);
            if (corr > bestCorr) {
                bestCorr = corr;
                bestOffset = offset;
            }
        }

        if (bestOffset === -1 || bestCorr < 0.01) return 0;
        return sampleRate / bestOffset;
    }

    _avg(arr) {
        if (!arr.length) return 0;
        let sum = 0;
        for (let i = 0; i < arr.length; i++) sum += arr[i];
        return sum / arr.length;
    }

    drawStaticBackground() {
        const width = this.canvas.width;
        const height = this.canvas.height;

        const bg = this.ctx.createLinearGradient(0, 0, 0, height);
        bg.addColorStop(0, "#0b1020");
        bg.addColorStop(1, "#09070f");
        this.ctx.fillStyle = bg;
        this.ctx.fillRect(0, 0, width, height);

        this.ctx.fillStyle = "rgba(120, 170, 255, 0.4)";
        this.ctx.font = `${Math.max(30, Math.min(width, height) * 0.15)}px sans-serif`;
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText("♫", width / 2, height / 2 - 8);

        this.ctx.font = "14px sans-serif";
        this.ctx.fillStyle = "rgba(190, 215, 255, 0.58)";
        this.ctx.fillText("Press play to start visualization", width / 2, height / 2 + 36);
    }
}

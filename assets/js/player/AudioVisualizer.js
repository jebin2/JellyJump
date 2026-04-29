import { Logger } from "../shared/utils/Logger.js";

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
        this.frameCounter = 0;

        this.currentPitchHz = 0;
        this.pitchSmoothedHz = 0;

        this.pulseRings = [];
        this.raindrops = [];
        this.clouds = [];
        this.trees = [];
        this.publicChairs = [];
        this.balloons = [];
        this.woman = {
            x: -50,
            y: 0,
            width: 0,
            height: 0,
            speed: 1.5,
            state: "walking_to_balloon", // "walking_to_balloon", "taking_balloon", "walking_away", "waiting"
            frame: 0,
            hasBalloon: false,
            waitTimer: 0
        };
        this.lightningBolts = [];
        this.sceneWidth = 0;
        this.sceneHeight = 0;
        this.lastLightningAt = 0;
        this.lightningCooldownMs = 180;
        this.windOffset = 0;
        this.sceneComposition = {
            treeCount: 11,
            chairXRatio: 0.62,
            chairYRatio: 0.895,
            chairWidthRatio: 0.14,
            chairHeightRatio: 0.095
        };

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
        this.raindrops.length = 0;
        this.clouds.length = 0;
        this.trees.length = 0;
        this.publicChairs.length = 0;
        this.balloons.length = 0;
        this.lightningBolts.length = 0;
        this.sceneWidth = 0;
        this.sceneHeight = 0;
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
        this.raindrops.length = 0;
        this.clouds.length = 0;
        this.trees.length = 0;
        this.publicChairs.length = 0;
        this.balloons.length = 0;
        this.lightningBolts.length = 0;

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
            if (now - this.lastLightningAt > this.lightningCooldownMs && Math.random() < 0.85) {
                this._spawnLightningBolt(0.8 + this.bassLevel * 0.6);
                this.lastLightningAt = now;
            }
            this.lastBeatAt = now;
        }

        this.frameCounter++;
        if (this.frameCounter % 3 === 0) {
            this.currentPitchHz = this._estimatePitchHz(this.timeData, this.analyser.context.sampleRate);
        }

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
        this.simTime += 0.015;
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
            if (Math.random() < 0.5) this._spawnLightningBolt(0.7);
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
        if (!width || !height) return;

        const pitch = this.pitchSmoothedHz || 180;
        const pitchNorm = Math.max(0, Math.min(1, (pitch - 70) / 700));

        if (this.sceneWidth !== width || this.sceneHeight !== height || this.raindrops.length === 0) {
            this._initScene(width, height);
        }

        const duskHue = 224 + pitchNorm * 22;
        const stormHue = 242 + pitchNorm * 12;
        const rainHue = 204 + pitchNorm * 14;

        this.windOffset += (this.midLevel - 0.5) * 0.35;

        this._drawSky(width, height, duskHue, stormHue);
        this._drawMoon(width, height, duskHue);
        this._drawClouds(width, height, stormHue);
        this._drawBeatGlow(width, height, rainHue, duskHue);
        this._drawRain(width, height, rainHue);
        this._drawStormMist(width, height, rainHue);
        this._drawLightningBolts(width, height);
        this._drawForegroundSilhouettes(width, height);
        this._drawPulseRings(width, height, rainHue);
        this._drawPitchLabel(width, height);
        this._drawFlash(width, height);
    }

    _initScene(width, height) {
        this.sceneWidth = width;
        this.sceneHeight = height;
        this.raindrops = [];
        this.clouds = [];
        this.trees = [];
        this.publicChairs = [];
        this.balloons = [];
        this.woman = {
            ...this.woman,
            x: -width * 0.1,
            y: height * 0.9, // Ground level
            width: width * 0.05,
            height: height * 0.18,
            speed: width * 0.0012,
            state: "walking_to_balloon",
            frame: 0,
            hasBalloon: false,
            waitTimer: 0
        };

        const cloudCount = 9;
        for (let i = 0; i < cloudCount; i++) {
            this.clouds.push({
                x: Math.random() * width * 1.3 - width * 0.15,
                y: Math.random() * height * 0.34,
                w: 140 + Math.random() * 220,
                h: 35 + Math.random() * 50,
                speed: 0.12 + Math.random() * 0.3,
                depth: 0.35 + Math.random() * 0.65,
                puffSeed: Math.random() * Math.PI * 2
            });
        }

        const layerConfig = [
            { count: 130, speed: 2.4, alpha: 0.24, len: 10, thick: 1.0 },
            { count: 160, speed: 3.8, alpha: 0.35, len: 16, thick: 1.25 },
            { count: 120, speed: 5.2, alpha: 0.52, len: 24, thick: 1.6 }
        ];
        for (const layer of layerConfig) {
            for (let i = 0; i < layer.count; i++) {
                this.raindrops.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    speed: layer.speed * (0.7 + Math.random() * 0.8),
                    len: layer.len * (0.7 + Math.random() * 0.8),
                    alpha: layer.alpha * (0.8 + Math.random() * 0.4),
                    thick: layer.thick,
                    drift: 0.3 + Math.random() * 0.9
                });
            }
        }

        const treeCount = this.sceneComposition.treeCount;
        for (let i = 0; i < treeCount; i++) {
            const t = treeCount <= 1 ? 0.5 : i / (treeCount - 1);
            // Push trees away from center so chair silhouette remains readable.
            const centered = t * 2 - 1;
            const pushed = Math.sign(centered) * Math.pow(Math.abs(centered), 0.72);
            const centerShift = ((pushed + 1) * 0.5) * width;
            this.trees.push({
                x: centerShift + (Math.random() - 0.5) * width * 0.06,
                h: height * (0.2 + Math.random() * 0.22),
                w: width * (0.03 + Math.random() * 0.03),
                lean: (Math.random() - 0.5) * 0.08
            });
        }

        this.publicChairs.push({
            x: width * this.sceneComposition.chairXRatio,
            y: height * this.sceneComposition.chairYRatio,
            w: width * this.sceneComposition.chairWidthRatio,
            h: height * this.sceneComposition.chairHeightRatio
        });

        // Add a red balloon tied to the chair
        for (const chair of this.publicChairs) {
            this.balloons.push({
                tieX: chair.x - chair.w * 0.4,
                tieY: chair.y - chair.h * 0.74,
                width: chair.w * 0.18,
                height: chair.h * 0.28,
                stringLen: chair.h * 1.4,
                hue: 0, // Red
                seed: Math.random() * Math.PI * 2
            });
        }
    }

    _drawSky(width, height, duskHue, stormHue) {
        const ctx = this.ctx;
        const horizonY = height * 0.7;

        const sky = ctx.createLinearGradient(0, 0, 0, height);
        sky.addColorStop(0, `hsl(${stormHue}, 42%, 9%)`);
        sky.addColorStop(0.5, `hsl(${duskHue}, 50%, 13%)`);
        sky.addColorStop(0.73, "hsl(266, 64%, 22%)");
        sky.addColorStop(1, "hsl(17, 72%, 24%)");
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, width, height);

        const haze = ctx.createRadialGradient(width * 0.5, horizonY, 0, width * 0.5, horizonY, width * 0.58);
        haze.addColorStop(0, `rgba(255, 180, 120, ${0.1 + this.rmsLevel * 0.12})`);
        haze.addColorStop(1, "rgba(255, 180, 120, 0)");
        ctx.fillStyle = haze;
        ctx.fillRect(0, 0, width, height);
    }

    _drawMoon(width, height, duskHue) {
        const ctx = this.ctx;
        const beat = this.beatPulse;
        const energy = Math.min(1, this.rmsLevel * 0.8 + this.highLevel * 0.5);
        const moonX = width * 0.16 + Math.sin(this.simTime * 0.35) * width * 0.004;
        const moonY = height * 0.16 - beat * height * 0.008;
        const moonR = Math.max(16, Math.min(width, height) * 0.055);
        const flashLift = Math.min(0.24, this.flashAlpha * 0.52);
        const pulse = 0.9 + beat * 0.35 + energy * 0.15;

        const halo = ctx.createRadialGradient(moonX, moonY, moonR * 0.25, moonX, moonY, moonR * (2.5 + beat * 0.65));
        halo.addColorStop(0, `rgba(220, 232, 255, ${0.09 + energy * 0.09 + flashLift * 0.16})`);
        halo.addColorStop(1, "rgba(210, 225, 255, 0)");
        ctx.fillStyle = halo;
        ctx.fillRect(moonX - moonR * 3, moonY - moonR * 3, moonR * 6, moonR * 6);

        const moon = ctx.createRadialGradient(
            moonX - moonR * 0.25,
            moonY - moonR * 0.3,
            moonR * 0.2,
            moonX,
            moonY,
            moonR
        );
        moon.addColorStop(0, `hsla(${duskHue - 14}, 34%, ${90 + pulse * 3}%, ${0.82 + flashLift * 0.15})`);
        moon.addColorStop(1, `hsla(${duskHue - 10}, 26%, ${76 + pulse * 2}%, ${0.7 + flashLift * 0.12})`);
        ctx.fillStyle = moon;
        ctx.beginPath();
        ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
        ctx.fill();

        // Crater dots for a more moon-like texture.
        ctx.fillStyle = "rgba(126, 146, 176, 0.2)";
        const craters = [
            { dx: -0.28, dy: 0.2, r: 0.14 },
            { dx: 0.22, dy: -0.1, r: 0.11 },
            { dx: 0.02, dy: 0.03, r: 0.08 },
            { dx: -0.08, dy: -0.24, r: 0.06 },
            { dx: 0.32, dy: 0.2, r: 0.05 }
        ];
        for (const crater of craters) {
            ctx.beginPath();
            ctx.arc(
                moonX + moonR * crater.dx,
                moonY + moonR * crater.dy,
                moonR * crater.r,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }

        // Proper phase shading using a clipped gradient (no hard black circle overlay).
        ctx.save();
        ctx.beginPath();
        ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
        ctx.clip();
        const phase = ctx.createLinearGradient(moonX - moonR, moonY, moonX + moonR * 1.2, moonY);
        phase.addColorStop(0, "rgba(18, 25, 40, 0)");
        phase.addColorStop(0.45, "rgba(24, 32, 50, 0.18)");
        phase.addColorStop(1, "rgba(28, 35, 56, 0.4)");
        ctx.fillStyle = phase;
        ctx.fillRect(moonX - moonR, moonY - moonR, moonR * 2.4, moonR * 2);
        ctx.restore();
    }

    _drawClouds(width, height, stormHue) {
        const ctx = this.ctx;
        const wind = this.windOffset * 0.02 + (this.midLevel - 0.35) * 0.22;
        const flashLift = Math.min(0.32, this.flashAlpha * 0.6);

        for (const cloud of this.clouds) {
            cloud.x += cloud.speed + wind * cloud.depth;
            if (cloud.x > width + cloud.w) cloud.x = -cloud.w;
            if (cloud.x < -cloud.w) cloud.x = width + cloud.w;

            const driftWave = Math.sin(this.simTime * 0.35 + cloud.puffSeed) * 0.5 + 0.5;
            const toneLift = driftWave * 4 + flashLift * 14;
            const cloudLightness = 12 + cloud.depth * 9 + toneLift;
            const alpha = 0.1 + cloud.depth * 0.2 + this.rmsLevel * 0.05 + flashLift * 0.14;

            // Main mass with internal gradient gives volume.
            const bodyGrad = ctx.createRadialGradient(
                cloud.x - cloud.w * 0.14,
                cloud.y - cloud.h * 0.16,
                cloud.h * 0.1,
                cloud.x,
                cloud.y + cloud.h * 0.05,
                cloud.w * 0.62
            );
            bodyGrad.addColorStop(0, `hsla(${stormHue - 6}, 24%, ${cloudLightness + 4}%, ${alpha + flashLift * 0.08})`);
            bodyGrad.addColorStop(1, `hsla(${stormHue + 4}, 20%, ${cloudLightness - 6}%, ${Math.max(0.06, alpha - 0.08)})`);
            ctx.fillStyle = bodyGrad;
            ctx.beginPath();
            ctx.ellipse(cloud.x, cloud.y, cloud.w * 0.56, cloud.h * 0.62, 0, 0, Math.PI * 2);
            ctx.fill();

            // Sub masses for irregular storm shape.
            const puffOffsets = [
                { ox: -0.34, oy: 0.12, sx: 0.32, sy: 0.46 },
                { ox: -0.1, oy: -0.18, sx: 0.36, sy: 0.5 },
                { ox: 0.24, oy: -0.08, sx: 0.38, sy: 0.5 },
                { ox: 0.43, oy: 0.13, sx: 0.28, sy: 0.4 }
            ];
            for (const puff of puffOffsets) {
                ctx.fillStyle = `hsla(${stormHue - 2}, 22%, ${cloudLightness - 2 + Math.random() * 2}%, ${alpha * 0.9})`;
                ctx.beginPath();
                ctx.ellipse(
                    cloud.x + cloud.w * puff.ox,
                    cloud.y + cloud.h * puff.oy,
                    cloud.w * puff.sx,
                    cloud.h * puff.sy,
                    0,
                    0,
                    Math.PI * 2
                );
                ctx.fill();
            }

            // Subtle underside shadow to avoid flat cloud shapes.
            ctx.fillStyle = `rgba(10, 16, 24, ${0.1 + cloud.depth * 0.12})`;
            ctx.beginPath();
            ctx.ellipse(cloud.x + cloud.w * 0.02, cloud.y + cloud.h * 0.24, cloud.w * 0.46, cloud.h * 0.26, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    _drawBeatGlow(width, height, rainHue, duskHue) {
        const intensity = this.rmsLevel * 0.35 + this.beatPulse * 0.65;
        const radius = Math.min(width, height) * (0.26 + intensity * 0.36);
        const grad = this.ctx.createRadialGradient(width / 2, height * 0.6, 0, width / 2, height * 0.6, radius);

        grad.addColorStop(0, `hsla(${rainHue}, 95%, 70%, ${0.08 + intensity * 0.14})`);
        grad.addColorStop(0.5, `hsla(${duskHue}, 88%, 62%, ${0.04 + intensity * 0.08})`);
        grad.addColorStop(1, "rgba(0, 0, 0, 0)");

        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, width, height);
    }

    _drawRain(width, height, rainHue) {
        const ctx = this.ctx;
        const rainBoost = 1 + this.bassLevel * 1.9 + this.rmsLevel * 0.8;
        const wind = (this.windOffset + (this.midLevel - 0.45) * 26) * 0.08;

        ctx.beginPath();
        ctx.strokeStyle = `hsla(${rainHue}, 90%, 74%, 0.35)`;
        ctx.lineWidth = 1.2;

        for (const drop of this.raindrops) {
            drop.y += drop.speed * rainBoost;
            drop.x += wind * drop.drift;

            if (drop.y > height + 10) {
                drop.y = -drop.len - Math.random() * 20;
                drop.x = Math.random() * width;

                if (Math.random() < 0.08 + this.rmsLevel * 0.22) {
                    this._spawnPulseRing(drop.x, height - 8, 0.45);
                }
            }

            if (drop.x < -20) drop.x = width + 20;
            if (drop.x > width + 20) drop.x = -20;

            ctx.moveTo(drop.x, drop.y);
            ctx.lineTo(drop.x + wind * 0.35, drop.y + drop.len);
        }
        ctx.stroke();
    }

    _drawStormMist(width, height, rainHue) {
        const ctx = this.ctx;
        const groundY = height * 0.8;
        const mist = ctx.createLinearGradient(0, groundY, 0, height);
        mist.addColorStop(0, `hsla(${rainHue}, 72%, 65%, ${0.03 + this.rmsLevel * 0.06})`);
        mist.addColorStop(1, "rgba(20, 28, 42, 0.45)");
        ctx.fillStyle = mist;
        ctx.fillRect(0, groundY, width, height - groundY);
    }

    _drawLightningBolts(width, height) {
        for (let i = this.lightningBolts.length - 1; i >= 0; i--) {
            const bolt = this.lightningBolts[i];
            bolt.alpha *= 0.84;
            bolt.glow *= 0.86;
            if (bolt.alpha < 0.04) {
                this.lightningBolts.splice(i, 1);
                continue;
            }

            const cloudLight = this.ctx.createRadialGradient(
                bolt.cloudX,
                bolt.cloudY,
                0,
                bolt.cloudX,
                bolt.cloudY,
                Math.max(width, height) * 0.35
            );
            cloudLight.addColorStop(0, `rgba(200, 225, 255, ${bolt.glow * 0.35})`);
            cloudLight.addColorStop(1, "rgba(180, 220, 255, 0)");
            this.ctx.fillStyle = cloudLight;
            this.ctx.fillRect(0, 0, width, height);

            this.ctx.beginPath();
            this.ctx.strokeStyle = `rgba(230, 245, 255, ${bolt.alpha})`;
            this.ctx.lineWidth = bolt.width;
            this.ctx.lineJoin = "round";
            this.ctx.lineCap = "round";

            this.ctx.moveTo(bolt.points[0].x, bolt.points[0].y);
            for (let j = 1; j < bolt.points.length; j++) {
                this.ctx.lineTo(bolt.points[j].x, bolt.points[j].y);
            }
            this.ctx.stroke();

            this.ctx.shadowColor = `rgba(180, 220, 255, ${bolt.glow})`;
            this.ctx.shadowBlur = 28;
            this.ctx.stroke();
            this.ctx.shadowBlur = 0;

            for (const fork of bolt.forks) {
                this.ctx.beginPath();
                this.ctx.strokeStyle = `rgba(210, 235, 255, ${bolt.alpha * 0.8})`;
                this.ctx.lineWidth = Math.max(0.7, bolt.width * 0.55);
                this.ctx.moveTo(fork[0].x, fork[0].y);
                for (let j = 1; j < fork.length; j++) {
                    this.ctx.lineTo(fork[j].x, fork[j].y);
                }
                this.ctx.stroke();
            }
        }
    }

    _drawForegroundSilhouettes(width, height) {
        const ctx = this.ctx;
        const groundY = height * 0.9;
        const flashLift = Math.min(0.25, this.flashAlpha * 0.5);

        const ground = ctx.createLinearGradient(0, groundY, 0, height);
        ground.addColorStop(0, `rgba(10, 14, 20, ${0.72 - flashLift * 0.2})`);
        ground.addColorStop(1, `rgba(6, 10, 15, ${0.96 - flashLift * 0.15})`);
        ctx.fillStyle = ground;
        ctx.fillRect(0, groundY, width, height - groundY);

        for (const tree of this.trees) {
            const sway = Math.sin(this.simTime * 0.8 + tree.x * 0.003) * 0.02 + this.windOffset * 0.0008;
            const lean = tree.lean + sway;
            const trunkTopX = tree.x + tree.h * lean;
            const trunkTopY = groundY - tree.h;

            ctx.strokeStyle = `rgba(8, 12, 16, ${0.95 - flashLift * 0.18})`;
            ctx.lineWidth = Math.max(2, tree.w * 0.18);
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(tree.x, groundY);
            ctx.lineTo(trunkTopX, trunkTopY);
            ctx.stroke();

            ctx.fillStyle = `rgba(12, 18, 22, ${0.92 - flashLift * 0.15})`;
            ctx.beginPath();
            ctx.ellipse(trunkTopX, trunkTopY + tree.h * 0.18, tree.w, tree.h * 0.22, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(trunkTopX - tree.w * 0.55, trunkTopY + tree.h * 0.3, tree.w * 0.8, tree.h * 0.18, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(trunkTopX + tree.w * 0.5, trunkTopY + tree.h * 0.31, tree.w * 0.86, tree.h * 0.19, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        for (const chair of this.publicChairs) {
            this._drawPublicChair(chair, groundY, flashLift);
        }

        for (const balloon of this.balloons) {
            // Only draw if balloon is not with the woman or has been reset
            if (!this.woman.hasBalloon) {
                this._drawBalloon(balloon, flashLift);
            }
        }

        this._drawWoman(width, height, flashLift);
    }

    _drawWoman(width, height, flashLift) {
        const ctx = this.ctx;
        const w = this.woman;
        const color = `rgba(6, 8, 12, ${0.97 - flashLift * 0.14})`;

        // === STATE MACHINE ===
        // frameStep: derived from the no-foot-sliding condition at mid-stance.
        // At phase=0, d(ankleX)/dphase = 0.42*(thighLen + 0.48*shinLen) ≈ H×0.162
        // No sliding → speed = H×0.162 × 2.5 × frameStep → frameStep = speed/(H×0.405)
        const frameStep = w.speed / (w.height * 0.405);
        if (w.state === "walking_to_balloon") {
            const targetX = width * this.sceneComposition.chairXRatio - w.height * 0.6;
            if (w.x < targetX) { w.x += w.speed; w.frame += frameStep; }
            else { w.state = "taking_balloon"; w.waitTimer = 70; }
        } else if (w.state === "taking_balloon") {
            if (--w.waitTimer <= 0) { w.hasBalloon = true; w.state = "walking_away"; }
        } else if (w.state === "walking_away") {
            w.x += w.speed; w.frame += frameStep;
            if (w.x > width + w.height) { w.state = "waiting"; w.waitTimer = 180; w.hasBalloon = false; }
        } else if (w.state === "waiting") {
            if (--w.waitTimer <= 0) { w.x = -w.height; w.state = "walking_to_balloon"; }
        }

        const isWalking = w.state === "walking_to_balloon" || w.state === "walking_away";
        const t = w.frame * 2.5;
        const walkCycle = Math.sin(t);
        // Body bobs up once per step (2x per stride) — |sin(t)| gives that frequency
        const bob = isWalking ? Math.abs(Math.sin(t)) * 2.5 : 0;

        // Proportional measurements — all relative to figure height H
        const H = w.height;
        const hipY      = -H * 0.51;
        const waistY    = -H * 0.63;
        const shoulderY = -H * 0.82;
        const headCY    = -H * 0.93;
        const headR     =  H * 0.075;
        const thighLen  =  H * 0.27;
        const shinLen   =  H * 0.24;
        const footLen   =  H * 0.08;
        const hipHW     =  H * 0.052;   // hip half-width
        const shoulderHW =  H * 0.115;  // shoulder half-width
        const waistHW   =  H * 0.065;   // waist half-width

        // Right hand position in local coords (tracked for balloon placement)
        let rHandLX = shoulderHW + H * 0.12;
        let rHandLY = shoulderY - H * 0.08;

        ctx.save();
        ctx.fillStyle = color;
        ctx.strokeStyle = color;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.translate(w.x, w.y - bob);

        // --- 2-segment leg using forward kinematics ---
        // Both legs share one hip pivot at center (correct for side-view silhouette).
        // phase: -1 = fully back (stance/push-off), 0 = straight down, +1 = forward (swing)
        const drawLeg = (phase) => {
            const thighA = phase * 0.42;
            let shinA;
            if (phase >= 0) {
                // Swing: knee bends via sin-curve — peaks at mid-swing, straight at heel-strike
                // Cap kneeBend so ankle doesn't cross behind the knee at mid-swing
                const kneeBend = Math.sin(phase * Math.PI) * 0.72;
                shinA = thighA - kneeBend;
            } else {
                // Stance/push-off: ankle stays more under the hip than the knee does
                shinA = thighA * 0.46;
            }

            // Joint positions
            const kx = Math.sin(thighA) * thighLen;          // hip at x=0
            const ky = hipY + Math.cos(thighA) * thighLen;   // downward from hipY
            const ax = kx + Math.sin(shinA) * shinLen;
            const ay = ky + Math.cos(shinA) * shinLen;

            // Foot direction: flat during stance; toe lifts slightly at heel-strike
            const heelLift = phase > 0.65 ? (phase - 0.65) / 0.35 * 0.28 : 0;
            const fx = ax + Math.cos(heelLift) * footLen;
            const fy = ay - Math.sin(heelLift) * footLen;

            // Thigh
            ctx.lineWidth = H * 0.044;
            ctx.beginPath();
            ctx.moveTo(0, hipY);
            ctx.lineTo(kx, ky);
            ctx.stroke();

            // Shin
            ctx.lineWidth = H * 0.034;
            ctx.beginPath();
            ctx.moveTo(kx, ky);
            ctx.lineTo(ax, ay);
            ctx.stroke();

            // Foot
            ctx.lineWidth = H * 0.030;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(fx, fy);
            ctx.stroke();

            // Knee cap — small dot makes the bend joint clearly visible
            ctx.beginPath();
            ctx.arc(kx, ky, H * 0.020, 0, Math.PI * 2);
            ctx.fill();
        };

        // Back leg drawn first (behind skirt)
        drawLeg(-walkCycle);

        // === SKIRT (covers hip joint, flows with stride) ===
        const skirtHemY = hipY + H * 0.21;
        const hemFlare  = H * 0.165 + (isWalking ? Math.abs(walkCycle) * H * 0.024 : 0);
        const skirtSway = isWalking ? walkCycle * H * 0.013 : 0;

        ctx.beginPath();
        ctx.moveTo(-hipHW * 1.85 + skirtSway * 0.4, hipY - H * 0.012);
        ctx.bezierCurveTo(
            -hipHW * 2.4 + skirtSway * 0.3,  hipY + H * 0.065,
            -hemFlare * 1.1 + skirtSway * 0.15, skirtHemY - H * 0.018,
            -hemFlare * 0.62 + skirtSway * 0.1, skirtHemY
        );
        ctx.lineTo(hemFlare * 0.62 + skirtSway * 0.1, skirtHemY);
        ctx.bezierCurveTo(
            hemFlare * 1.1 + skirtSway * 0.15, skirtHemY - H * 0.018,
            hipHW * 2.4 + skirtSway * 0.3,  hipY + H * 0.065,
            hipHW * 1.85 + skirtSway * 0.4, hipY - H * 0.012
        );
        ctx.closePath();
        ctx.fill();

        // Front leg (drawn over skirt hem)
        drawLeg(walkCycle);

        // === TORSO — hourglass silhouette ===
        const torsoBobX = isWalking ? walkCycle * H * 0.007 : 0;
        ctx.beginPath();
        ctx.moveTo(-hipHW * 1.6 + torsoBobX, hipY);
        ctx.bezierCurveTo(
            -hipHW * 1.85 + torsoBobX, hipY - H * 0.04,
            -waistHW * 1.1, waistY + H * 0.022,
            -waistHW, waistY
        );
        ctx.bezierCurveTo(
            -waistHW, waistY - H * 0.018,
            -shoulderHW, shoulderY + H * 0.038,
            -shoulderHW, shoulderY
        );
        ctx.lineTo(shoulderHW, shoulderY);
        ctx.bezierCurveTo(
            shoulderHW, shoulderY + H * 0.038,
            waistHW, waistY - H * 0.018,
            waistHW, waistY
        );
        ctx.bezierCurveTo(
            waistHW * 1.1, waistY + H * 0.022,
            hipHW * 1.85 + torsoBobX, hipY - H * 0.04,
            hipHW * 1.6 + torsoBobX, hipY
        );
        ctx.closePath();
        ctx.fill();

        // === NECK ===
        ctx.lineWidth = H * 0.038;
        ctx.beginPath();
        ctx.moveTo(0, shoulderY);
        ctx.lineTo(0, headCY + headR * 0.9);
        ctx.stroke();

        // === HEAD ===
        ctx.beginPath();
        ctx.arc(0, headCY, headR, 0, Math.PI * 2);
        ctx.fill();

        // === HAIR — upswept bun + side strand ===
        // Bun atop head
        ctx.beginPath();
        ctx.arc(headR * 0.05, headCY - headR * 0.78, headR * 0.46, 0, Math.PI * 2);
        ctx.fill();
        // Side strand flowing back
        ctx.lineWidth = headR * 0.5;
        ctx.beginPath();
        ctx.moveTo(-headR * 0.52, headCY - headR * 0.38);
        ctx.quadraticCurveTo(-headR * 1.05, headCY + headR * 0.28, -headR * 0.55, headCY + headR * 0.86);
        ctx.stroke();

        // === LEFT ARM — holds umbrella (raised, elbow out to the side) ===
        const lShX = -shoulderHW;
        // Elbow points outward-back at roughly shoulder height
        const uElbX = lShX - H * 0.11;
        const uElbY = shoulderY + H * 0.005;
        // Forearm rises from elbow up to grip the shaft above head
        const uHandX = lShX - H * 0.02;
        const uHandY = -H * 0.955;

        ctx.lineWidth = H * 0.038;
        ctx.beginPath();
        ctx.moveTo(lShX, shoulderY);
        ctx.lineTo(uElbX, uElbY);
        ctx.stroke();
        ctx.lineWidth = H * 0.030;
        ctx.beginPath();
        ctx.moveTo(uElbX, uElbY);
        ctx.lineTo(uHandX, uHandY);
        ctx.stroke();

        // === RIGHT ARM — natural counter-swing (or raised for balloon) ===
        const rShX = shoulderHW;
        const armSwing = isWalking ? -walkCycle * 0.36 : 0;
        const upperArmL = H * 0.185;
        const foreArmL  = H * 0.155;

        const rElbX = rShX + Math.sin(armSwing) * upperArmL;
        const rElbY = shoulderY + Math.cos(armSwing) * upperArmL * 0.44;

        if (w.hasBalloon) {
            rHandLX = rShX + H * 0.14;
            rHandLY = shoulderY - H * 0.18;
        } else {
            const foreA = armSwing * 0.5;
            rHandLX = rElbX + Math.sin(foreA) * foreArmL;
            rHandLY = rElbY + Math.cos(foreA) * foreArmL * 0.62;
        }

        ctx.lineWidth = H * 0.038;
        ctx.beginPath();
        ctx.moveTo(rShX, shoulderY);
        ctx.lineTo(rElbX, rElbY);
        ctx.stroke();
        ctx.lineWidth = H * 0.030;
        ctx.beginPath();
        ctx.moveTo(rElbX, rElbY);
        ctx.lineTo(rHandLX, rHandLY);
        ctx.stroke();

        // === UMBRELLA ===
        ctx.save();
        ctx.translate(uHandX, uHandY);

        const umbR = H * 0.265;

        // Crook handle at bottom
        ctx.lineWidth = H * 0.018;
        ctx.beginPath();
        ctx.arc(H * 0.02, H * 0.018, H * 0.02, Math.PI * 0.5, Math.PI * 1.5, true);
        ctx.stroke();

        // Shaft
        ctx.lineWidth = H * 0.016;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -H * 0.18);
        ctx.stroke();

        // Canopy
        ctx.beginPath();
        ctx.arc(0, -H * 0.18, umbR, Math.PI, 0);
        ctx.fill();

        // Rib lines
        ctx.lineWidth = H * 0.009;
        for (let i = 0; i <= 6; i++) {
            const ra = Math.PI + (i / 6) * Math.PI;
            ctx.beginPath();
            ctx.moveTo(0, -H * 0.18);
            ctx.lineTo(Math.cos(ra) * umbR, -H * 0.18 + Math.sin(ra) * umbR * 0.22);
            ctx.stroke();
        }

        // Scalloped hem
        const numSc = 8;
        const scW = (umbR * 2) / numSc;
        ctx.beginPath();
        ctx.moveTo(-umbR, -H * 0.18);
        for (let i = 0; i < numSc; i++) {
            ctx.quadraticCurveTo(
                -umbR + (i + 0.5) * scW, -H * 0.18 + umbR * 0.14,
                -umbR + (i + 1) * scW,   -H * 0.18
            );
        }
        ctx.fill();

        // Tip spike at right edge
        ctx.lineWidth = H * 0.013;
        ctx.beginPath();
        ctx.moveTo(umbR, -H * 0.18);
        ctx.lineTo(umbR + H * 0.018, -H * 0.18 - H * 0.014);
        ctx.stroke();

        ctx.restore();
        ctx.restore();

        // === HELD BALLOON — absolute canvas coordinates ===
        if (w.hasBalloon) {
            const bx = w.x + rHandLX;
            const by = w.y - bob + rHandLY;
            const balloon = this.balloons[0];
            if (balloon) {
                this._drawBalloon({ ...balloon, tieX: bx, tieY: by, stringLen: balloon.stringLen * 0.6 }, flashLift);
            }
        }
    }

    _drawPublicChair(chair, groundY, flashLift) {
        const ctx = this.ctx;
        const x = chair.x;
        const y = chair.y;
        const w = chair.w;
        const h = chair.h;
        const color = `rgba(10, 13, 18, ${0.94 - flashLift * 0.18})`;
        ctx.fillStyle = color;
        ctx.strokeStyle = color;

        ctx.fillRect(x - w * 0.5, y - h * 0.42, w, h * 0.16);
        ctx.fillRect(x - w * 0.52, y - h * 0.78, w * 1.04, h * 0.14);

        const slatCount = 5;
        for (let i = 0; i < slatCount; i++) {
            const lx = x - w * 0.5 + (i * w) / (slatCount - 1);
            ctx.fillRect(lx - w * 0.015, y - h * 0.78, w * 0.03, h * 0.52);
        }

        ctx.lineWidth = Math.max(2, w * 0.04);
        ctx.beginPath();
        ctx.moveTo(x - w * 0.4, y - h * 0.25);
        ctx.lineTo(x - w * 0.45, groundY);
        ctx.moveTo(x + w * 0.4, y - h * 0.25);
        ctx.lineTo(x + w * 0.45, groundY);
        ctx.stroke();
    }

    _drawBalloon(balloon, flashLift) {
        const ctx = this.ctx;
        const time = this.simTime;
        const t = time + balloon.seed;

        // Float motion (oscillation)
        const swayX = Math.sin(t * 0.8) * 9;
        const swayY = Math.cos(t * 0.6) * 6;
        const floatY = -balloon.stringLen + Math.sin(t * 0.5) * 5;

        const bx = balloon.tieX + swayX;
        const by = balloon.tieY + floatY + swayY;

        // Draw the string
        ctx.beginPath();
        ctx.strokeStyle = `rgba(180, 210, 255, ${0.34 - flashLift * 0.1})`;
        ctx.lineWidth = 1;
        ctx.moveTo(balloon.tieX, balloon.tieY);
        // Slightly curved string towards the balloon
        ctx.quadraticCurveTo(
            balloon.tieX + swayX * 0.5,
            balloon.tieY + floatY * 0.5,
            bx, by + balloon.height * 0.5
        );
        ctx.stroke();

        // Draw the balloon body
        const grad = ctx.createRadialGradient(
            bx - balloon.width * 0.2,
            by - balloon.height * 0.2,
            balloon.width * 0.1,
            bx, by,
            balloon.width * 0.8
        );
        const alpha = 0.8 - flashLift * 0.2;
        grad.addColorStop(0, `hsla(${balloon.hue}, 90%, 65%, ${alpha})`);
        grad.addColorStop(1, `hsla(${balloon.hue}, 100%, 30%, ${alpha})`);

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(bx, by, balloon.width, balloon.height, swayX * 0.01, 0, Math.PI * 2);
        ctx.fill();

        // Highlight
        ctx.fillStyle = `rgba(255, 255, 255, ${0.4 - flashLift * 0.1})`;
        ctx.beginPath();
        ctx.ellipse(
            bx - balloon.width * 0.3,
            by - balloon.height * 0.3,
            balloon.width * 0.2,
            balloon.height * 0.2,
            Math.PI * 0.25 + swayX * 0.01,
            0, Math.PI * 2
        );
        ctx.fill();

        // Knot at the bottom
        ctx.fillStyle = `hsla(${balloon.hue}, 100%, 25%, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(bx, by + balloon.height);
        ctx.lineTo(bx - 3, by + balloon.height + 4);
        ctx.lineTo(bx + 3, by + balloon.height + 4);
        ctx.closePath();
        ctx.fill();
    }

    _drawSpectrumBars(width, height, rainHue) {
        const ctx = this.ctx;
        const groundY = height * 0.94;
        const maxH = height * 0.13;
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
            const y = groundY - barH;

            const hueShift = rainHue + (1 - distance) * 10;
            ctx.fillStyle = `hsla(${hueShift}, 84%, ${62 + raw * 16}%, ${0.2 + raw * 0.42})`;
            ctx.fillRect(x, y, barW, barH);

            const peakY = groundY - this.barPeaks[i];
            ctx.fillStyle = `hsla(${rainHue + 6}, 100%, 86%, 0.65)`;
            ctx.fillRect(x, peakY, barW, 2);
        }
    }

    _drawWaveform(width, height, hue) {
        const ctx = this.ctx;
        const centerY = height * 0.86;
        const amplitude = height * (0.026 + this.rmsLevel * 0.045 + this.beatPulse * 0.022);

        ctx.beginPath();
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = `hsla(${hue}, 88%, 86%, 0.6)`;

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
        for (let i = this.pulseRings.length - 1; i >= 0; i--) {
            const ring = this.pulseRings[i];
            ring.radius += ring.speed;
            ring.alpha *= 0.95;

            if (ring.alpha < 0.02) {
                this.pulseRings.splice(i, 1);
                continue;
            }

            this.ctx.beginPath();
            this.ctx.ellipse(ring.x, ring.y, ring.radius, ring.radius * ring.flatten, 0, 0, Math.PI * 2);
            this.ctx.lineWidth = ring.width;
            this.ctx.strokeStyle = `hsla(${hue}, 95%, 86%, ${ring.alpha})`;
            this.ctx.stroke();
        }
    }

    _drawFlash(width, height) {
        if (this.flashAlpha <= 0.01) return;

        const g = this.ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height));
        g.addColorStop(0, `rgba(255, 255, 255, ${this.flashAlpha * 0.4})`);
        g.addColorStop(0.35, `rgba(190, 220, 255, ${this.flashAlpha * 0.26})`);
        g.addColorStop(1, "rgba(120, 170, 255, 0)");

        this.ctx.fillStyle = g;
        this.ctx.fillRect(0, 0, width, height);
    }

    _drawPitchLabel(width, height) {
        const pitch = this.pitchSmoothedHz;
        if (!pitch || pitch < 40) return;

        this.ctx.font = "12px monospace";
        this.ctx.fillStyle = "rgba(208, 226, 255, 0.74)";
        this.ctx.textAlign = "right";
        this.ctx.fillText(`${Math.round(pitch)} Hz`, width - 14, height - 14);
    }

    _spawnPulseRing(x, y, scale = 1) {
        const px = x ?? (this.canvas.width * (0.2 + Math.random() * 0.6));
        const py = y ?? (this.canvas.height * 0.9);

        this.pulseRings.push({
            x: px,
            y: py,
            radius: Math.max(8, Math.min(this.canvas.width, this.canvas.height) * 0.026 * scale),
            speed: (1.4 + this.bassLevel * 4.6) * scale,
            alpha: (0.28 + this.bassLevel * 0.28) * scale,
            width: 1 + this.rmsLevel * 1.6,
            flatten: 0.28 + Math.random() * 0.18
        });

        if (this.pulseRings.length > 40) {
            this.pulseRings.shift();
        }
    }

    _spawnLightningBolt(intensity = 1) {
        const width = this.canvas.width;
        const height = this.canvas.height;
        if (!width || !height) return;

        const points = [];
        const startX = width * (0.18 + Math.random() * 0.64);
        const maxY = height * (0.45 + Math.random() * 0.2);
        const segments = 7 + Math.floor(Math.random() * 5);
        const dy = maxY / segments;
        let x = startX;
        let y = 0;
        points.push({ x, y });

        for (let i = 0; i < segments; i++) {
            x += (Math.random() - 0.5) * (35 + intensity * 20);
            y += dy;
            points.push({ x, y });
        }

        const forks = [];
        const forkCount = 1 + Math.floor(Math.random() * 3);
        for (let f = 0; f < forkCount; f++) {
            const startIndex = 1 + Math.floor(Math.random() * (points.length - 3));
            const start = points[startIndex];
            const fork = [{ x: start.x, y: start.y }];
            const forkSeg = 2 + Math.floor(Math.random() * 3);
            let fx = start.x;
            let fy = start.y;
            for (let s = 0; s < forkSeg; s++) {
                fx += (Math.random() - 0.5) * (42 + intensity * 14) + (Math.random() > 0.5 ? 14 : -14);
                fy += dy * (0.45 + Math.random() * 0.45);
                fork.push({ x: fx, y: fy });
            }
            forks.push(fork);
        }

        this.lightningBolts.push({
            points,
            forks,
            cloudX: startX,
            cloudY: height * (0.12 + Math.random() * 0.12),
            alpha: 0.5 + Math.min(0.45, intensity * 0.3),
            glow: 0.55 + intensity * 0.4,
            width: 1.2 + intensity * 1.6
        });

        if (this.lightningBolts.length > 4) this.lightningBolts.shift();
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
        bg.addColorStop(0, "#0f1628");
        bg.addColorStop(0.62, "#1d2541");
        bg.addColorStop(1, "#4b2b2b");
        this.ctx.fillStyle = bg;
        this.ctx.fillRect(0, 0, width, height);

        this.ctx.fillStyle = "rgba(173, 205, 255, 0.75)";
        this.ctx.font = `${Math.max(30, Math.min(width, height) * 0.15)}px sans-serif`;
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText("♫", width / 2, height / 2 - 8);

        this.ctx.font = "14px sans-serif";
        this.ctx.fillStyle = "rgba(214, 228, 255, 0.8)";
        this.ctx.fillText("Press play to start visualization", width / 2, height / 2 + 36);
    }
}

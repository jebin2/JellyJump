/**
 * Visualizer Math Utilities
 * Handles beat detection, pitch estimation, and physics-based spawning logic.
 */
export class VisualizerMath {
    /**
     * @param {AudioVisualizer} visualizer - The main visualizer instance
     */
    constructor(visualizer) {
        this.visualizer = visualizer;
    }

    /**
     * Detect beats based on energy flux
     */
    detectBeat(lowEnergy, flux, now) {
        const v = this.visualizer;
        if (v.energyHistory.length > 45) v.energyHistory.shift();
        if (v.fluxHistory.length > 45) v.fluxHistory.shift();

        const avgEnergy = this.avg(v.energyHistory);
        const avgFlux = this.avg(v.fluxHistory);

        v.energyHistory.push(lowEnergy);
        v.fluxHistory.push(flux);

        const isBeat = (lowEnergy > avgEnergy * 1.34 && lowEnergy > 0.16) ||
                       (flux > avgFlux * 1.48 && flux > 0.28);

        if (isBeat && (now - v.lastBeatAt > 280)) {
            v.lastBeatAt = now;
            return true;
        }
        return false;
    }

    /**
     * Autocorrelation-based pitch estimation
     */
    estimatePitchHz(timeData, sampleRate) {
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

    /**
     * Spawn a lightning bolt based on intensity
     */
    spawnLightningBolt(intensity = 1) {
        const v = this.visualizer;
        const width = v.canvas.width;
        const height = v.canvas.height;
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

        v.lightningBolts.push({
            points,
            forks,
            cloudX: startX,
            cloudY: height * (0.12 + Math.random() * 0.12),
            alpha: 0.5 + Math.min(0.45, intensity * 0.3),
            glow: 0.55 + intensity * 0.4,
            width: 1.2 + intensity * 1.6
        });

        if (v.lightningBolts.length > 4) v.lightningBolts.shift();
    }

    /**
     * Spawn an expanding pulse ring
     */
    spawnPulseRing(x, y, scale = 1) {
        const v = this.visualizer;
        const px = x ?? (v.canvas.width * (0.2 + Math.random() * 0.6));
        const py = y ?? (v.canvas.height * 0.9);

        v.pulseRings.push({
            x: px,
            y: py,
            radius: Math.max(8, Math.min(v.canvas.width, v.canvas.height) * 0.026 * scale),
            speed: (1.4 + v.bassLevel * 4.6) * scale,
            alpha: (0.28 + v.bassLevel * 0.28) * scale,
            width: 1 + v.rmsLevel * 1.6,
            flatten: 0.28 + Math.random() * 0.18
        });

        if (v.pulseRings.length > 40) {
            v.pulseRings.shift();
        }
    }

    /**
     * Helper to average array values
     */
    avg(arr) {
        if (!arr.length) return 0;
        let sum = 0;
        for (let i = 0; i < arr.length; i++) sum += arr[i];
        return sum / arr.length;
    }
}

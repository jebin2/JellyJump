/**
 * Visualizer Math Utilities
 * Pure audio-analysis helpers: beat detection and pitch estimation.
 * Scene/spawn logic lives in the renderer, not here.
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
     * Helper to average array values
     */
    avg(arr) {
        if (!arr.length) return 0;
        let sum = 0;
        for (let i = 0; i < arr.length; i++) sum += arr[i];
        return sum / arr.length;
    }
}

/**
 * Audio Visualizer Component
 * Renders rain effect visualization that responds to audio
 */
export class AudioVisualizer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.analyser = null;
        this.dataArray = null;
        this.animationId = null;
        this.isRunning = false;

        // Rain particles
        this.raindrops = [];
        this.maxRaindrops = 200;

        // Audio sensitivity
        this.smoothing = 0.8;
        this.bassLevel = 0;
        this.midLevel = 0;
        this.highLevel = 0;

        // Simulated mode (fallback when audio analysis fails)
        this.simulatedMode = false;
        this.simulatedTime = 0;

        console.log('[AudioVisualizer] Created for canvas:', canvas.width, 'x', canvas.height);
    }

    /**
     * Connect to an audio context and source
     * @param {AudioContext} audioContext
     * @param {MediaElementAudioSourceNode} source
     */
    connect(audioContext, source) {
        // Create analyser node
        this.analyser = audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = this.smoothing;

        // Connect: source -> analyser -> destination
        source.connect(this.analyser);
        this.analyser.connect(audioContext.destination);

        // Create data array for frequency data
        const bufferLength = this.analyser.frequencyBinCount;
        this.dataArray = new Uint8Array(bufferLength);

        // Initialize raindrops
        this._initRaindrops();

        console.log('[AudioVisualizer] Connected - Rain mode');
    }

    /**
     * Initialize raindrop particles
     * @private
     */
    _initRaindrops() {
        this.raindrops = [];
        for (let i = 0; i < this.maxRaindrops; i++) {
            this.raindrops.push(this._createRaindrop());
        }
    }

    /**
     * Create a single raindrop
     * @private
     */
    _createRaindrop() {
        return {
            x: Math.random() * this.canvas.width,
            y: Math.random() * this.canvas.height - this.canvas.height,
            speed: 2 + Math.random() * 3,
            length: 10 + Math.random() * 20,
            opacity: 0.2 + Math.random() * 0.5,
            thickness: 1 + Math.random() * 2
        };
    }

    /**
     * Start visualization (works with or without audio analyser)
     */
    start() {
        if (this.isRunning) return;

        // If no analyser, use simulated mode
        if (!this.analyser) {
            this.simulatedMode = true;
            console.log('[AudioVisualizer] Starting in simulated mode');
        }

        this.isRunning = true;
        this._initRaindrops();
        this._animate();
        console.log('[AudioVisualizer] Started');
    }

    /**
     * Stop visualization
     */
    stop() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        console.log('[AudioVisualizer] Stopped');
    }

    /**
     * Animation loop
     * @private
     */
    _animate() {
        if (!this.isRunning) return;

        this.animationId = requestAnimationFrame(() => this._animate());
        this._updateAudioLevels();
        this._draw();
    }

    /**
     * Update audio levels from frequency data (or simulate)
     * @private
     */
    _updateAudioLevels() {
        if (this.simulatedMode || !this.analyser) {
            // Simulated pulsing effect
            this.simulatedTime += 0.05;
            const pulse = (Math.sin(this.simulatedTime) + 1) / 2;
            const pulse2 = (Math.sin(this.simulatedTime * 1.5) + 1) / 2;
            const pulse3 = (Math.sin(this.simulatedTime * 2.2) + 1) / 2;

            this.bassLevel = 0.3 + pulse * 0.5;
            this.midLevel = 0.2 + pulse2 * 0.4;
            this.highLevel = 0.1 + pulse3 * 0.3;
            return;
        }

        this.analyser.getByteFrequencyData(this.dataArray);

        // Calculate bass (low frequencies), mid, and high levels
        const len = this.dataArray.length;
        let bass = 0, mid = 0, high = 0;

        const bassEnd = Math.floor(len * 0.15);
        const midEnd = Math.floor(len * 0.5);

        for (let i = 0; i < len; i++) {
            if (i < bassEnd) {
                bass += this.dataArray[i];
            } else if (i < midEnd) {
                mid += this.dataArray[i];
            } else {
                high += this.dataArray[i];
            }
        }

        // Normalize to 0-1 range
        this.bassLevel = (bass / (bassEnd * 255)) * 1.5; // Boost bass
        this.midLevel = (mid / ((midEnd - bassEnd) * 255));
        this.highLevel = (high / ((len - midEnd) * 255));
    }

    /**
     * Draw rain effect
     * @private
     */
    _draw() {
        const width = this.canvas.width;
        const height = this.canvas.height;

        // Dark gradient background
        const bgGradient = this.ctx.createLinearGradient(0, 0, 0, height);
        bgGradient.addColorStop(0, '#0a0a12');
        bgGradient.addColorStop(1, '#1a1a2e');
        this.ctx.fillStyle = bgGradient;
        this.ctx.fillRect(0, 0, width, height);

        // Speed multiplier based on bass
        const speedMultiplier = 1 + this.bassLevel * 4;

        // Rain intensity based on overall volume
        const overallLevel = (this.bassLevel + this.midLevel + this.highLevel) / 3;
        const activeDrops = Math.floor(this.maxRaindrops * (0.3 + overallLevel * 0.7));

        // Update and draw raindrops
        for (let i = 0; i < Math.min(activeDrops, this.raindrops.length); i++) {
            const drop = this.raindrops[i];

            // Move raindrop down
            drop.y += drop.speed * speedMultiplier;

            // Add slight horizontal movement based on mid frequencies
            drop.x += (this.midLevel - 0.5) * 2;

            // Reset raindrop if it goes off screen
            if (drop.y > height) {
                drop.y = -drop.length;
                drop.x = Math.random() * width;
            }

            // Wrap horizontal
            if (drop.x < 0) drop.x = width;
            if (drop.x > width) drop.x = 0;

            // Draw raindrop
            this._drawRaindrop(drop, overallLevel);
        }

        // Draw subtle ground reflection/splash
        this._drawGroundEffect(overallLevel);
    }

    /**
     * Draw a single raindrop
     * @private
     */
    _drawRaindrop(drop, intensity) {
        // Color based on intensity (blue to cyan)
        const hue = 200 + intensity * 40;
        const alpha = drop.opacity * (0.5 + intensity * 0.5);

        this.ctx.beginPath();
        this.ctx.strokeStyle = `hsla(${hue}, 80%, 60%, ${alpha})`;
        this.ctx.lineWidth = drop.thickness;
        this.ctx.lineCap = 'round';

        this.ctx.moveTo(drop.x, drop.y);
        this.ctx.lineTo(drop.x, drop.y + drop.length);
        this.ctx.stroke();
    }

    /**
     * Draw ground reflection effect
     * @private
     */
    _drawGroundEffect(intensity) {
        const width = this.canvas.width;
        const height = this.canvas.height;

        // Subtle glow at bottom
        const glowHeight = 60 + intensity * 40;
        const glowGradient = this.ctx.createLinearGradient(0, height, 0, height - glowHeight);
        glowGradient.addColorStop(0, `rgba(50, 150, 255, ${0.1 + intensity * 0.2})`);
        glowGradient.addColorStop(1, 'transparent');

        this.ctx.fillStyle = glowGradient;
        this.ctx.fillRect(0, height - glowHeight, width, glowHeight);

        // Random splash particles
        if (intensity > 0.3) {
            const splashCount = Math.floor(intensity * 10);
            for (let i = 0; i < splashCount; i++) {
                const x = Math.random() * width;
                const y = height - 5 - Math.random() * 15;
                const size = 1 + Math.random() * 2;

                this.ctx.beginPath();
                this.ctx.arc(x, y, size, 0, Math.PI * 2);
                this.ctx.fillStyle = `rgba(100, 200, 255, ${0.2 + intensity * 0.3})`;
                this.ctx.fill();
            }
        }
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
        this.dataArray = null;
        this.raindrops = [];
        console.log('[AudioVisualizer] Disconnected');
    }

    /**
     * Clear the canvas with a static rain background
     */
    drawStaticBackground() {
        const width = this.canvas.width;
        const height = this.canvas.height;

        // Dark gradient background
        const bgGradient = this.ctx.createRadialGradient(
            width / 2, height / 2, 0,
            width / 2, height / 2, Math.max(width, height) / 2
        );
        bgGradient.addColorStop(0, '#1a1a2e');
        bgGradient.addColorStop(1, '#0a0a12');
        this.ctx.fillStyle = bgGradient;
        this.ctx.fillRect(0, 0, width, height);

        // Draw static raindrops
        for (let i = 0; i < 50; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const length = 10 + Math.random() * 15;

            this.ctx.beginPath();
            this.ctx.strokeStyle = `rgba(100, 180, 255, ${0.1 + Math.random() * 0.2})`;
            this.ctx.lineWidth = 1;
            this.ctx.moveTo(x, y);
            this.ctx.lineTo(x, y + length);
            this.ctx.stroke();
        }

        // Draw music note icon
        this.ctx.save();
        this.ctx.translate(width / 2, height / 2 - 20);
        this.ctx.fillStyle = 'rgba(100, 200, 255, 0.6)';
        this.ctx.font = `${Math.min(width, height) / 4}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('♪', 0, 0);
        this.ctx.restore();

        // Draw "Press Play" text
        this.ctx.fillStyle = 'rgba(150, 200, 255, 0.5)';
        this.ctx.font = '14px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Press play to start', width / 2, height / 2 + 50);
    }
}

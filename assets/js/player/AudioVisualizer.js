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

        // Lightning flash effect
        this.lightningAlpha = 0;
        this.lastBassLevel = 0;
        this.lightningThreshold = 0.7; // Bass level to trigger lightning

        // Clouds and trees
        this.clouds = [];
        this.trees = [];
        this.cloudsInitialized = false;

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

        // Initialize raindrops in layers
        this._initRaindrops();

        // Initialize ripple array
        this.ripples = [];

        console.log('[AudioVisualizer] Connected - Rain mode with depth layers');
    }

    /**
     * Initialize raindrop particles in 3 depth layers
     * @private
     */
    _initRaindrops() {
        this.raindrops = [];

        // Create 3 layers: background (slow/faint), middle, foreground (fast/bright)
        const layers = [
            { count: 60, speedMult: 0.5, opacityMult: 0.4, thicknessMult: 0.6 },  // Background
            { count: 80, speedMult: 1.0, opacityMult: 0.7, thicknessMult: 1.0 },  // Middle
            { count: 60, speedMult: 1.5, opacityMult: 1.0, thicknessMult: 1.3 }   // Foreground
        ];

        layers.forEach((layer, layerIndex) => {
            for (let i = 0; i < layer.count; i++) {
                this.raindrops.push(this._createRaindrop(layer, layerIndex));
            }
        });
    }

    /**
     * Create a single raindrop with layer properties
     * @param {Object} layer - Layer multipliers
     * @param {number} layerIndex - Layer index (0=back, 2=front)
     * @private
     */
    _createRaindrop(layer = {}, layerIndex = 1) {
        const speedMult = layer.speedMult || 1;
        const opacityMult = layer.opacityMult || 1;
        const thicknessMult = layer.thicknessMult || 1;

        return {
            x: Math.random() * this.canvas.width,
            y: Math.random() * this.canvas.height - this.canvas.height,
            speed: (2 + Math.random() * 3) * speedMult,
            length: (10 + Math.random() * 20) * (0.7 + layerIndex * 0.15),
            opacity: (0.2 + Math.random() * 0.5) * opacityMult,
            thickness: (1 + Math.random() * 2) * thicknessMult,
            layer: layerIndex
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

        // Detect bass hit (sudden increase in bass)
        const bassHit = this.bassLevel > this.lightningThreshold &&
            this.bassLevel > this.lastBassLevel + 0.2;
        this.lastBassLevel = this.bassLevel;

        // Trigger lightning on bass hit
        if (bassHit) {
            this.lightningAlpha = 0.8 + Math.random() * 0.2;
        }

        // Dark gradient background (stormy sky)
        const bgGradient = this.ctx.createLinearGradient(0, 0, 0, height);
        bgGradient.addColorStop(0, '#050510');
        bgGradient.addColorStop(0.4, '#0a0a1a');
        bgGradient.addColorStop(1, '#151525');
        this.ctx.fillStyle = bgGradient;
        this.ctx.fillRect(0, 0, width, height);

        // Initialize clouds and trees if not done
        if (!this.cloudsInitialized || this.clouds.length === 0) {
            this._initCloudsAndTrees(width, height);
        }

        // Draw and update clouds (behind rain)
        this._drawClouds(width, height);

        // Draw trees silhouette (behind rain but in front of ground)
        this._drawTrees(width, height);

        // Speed multiplier based on bass
        const speedMultiplier = 1 + this.bassLevel * 4;

        // Rain intensity based on overall volume
        const overallLevel = (this.bassLevel + this.midLevel + this.highLevel) / 3;
        const activeDrops = this.raindrops.length;

        // Update and draw raindrops by layer (back to front)
        for (let i = 0; i < activeDrops; i++) {
            const drop = this.raindrops[i];

            // Move raindrop down (layer affects speed)
            drop.y += drop.speed * speedMultiplier;

            // Add slight horizontal movement based on mid frequencies
            drop.x += (this.midLevel - 0.5) * 2 * (drop.layer === 2 ? 1.5 : 1);

            // Reset raindrop if it goes off screen - create ripple
            if (drop.y > height) {
                // Create ripple at impact point (only for middle and foreground)
                if (drop.layer >= 1 && Math.random() > 0.5) {
                    this.ripples.push({
                        x: drop.x,
                        y: height - 5,
                        radius: 2,
                        maxRadius: 15 + Math.random() * 10,
                        opacity: 0.6 + overallLevel * 0.3
                    });
                }

                drop.y = -drop.length;
                drop.x = Math.random() * width;
            }

            // Wrap horizontal
            if (drop.x < 0) drop.x = width;
            if (drop.x > width) drop.x = 0;

            // Draw raindrop
            this._drawRaindrop(drop, overallLevel);
        }

        // Update and draw ripples
        this._updateAndDrawRipples();

        // Draw subtle ground reflection/splash
        this._drawGroundEffect(overallLevel);

        // Draw lightning flash overlay
        if (this.lightningAlpha > 0) {
            this._drawLightning(width, height);
            this.lightningAlpha *= 0.85; // Fade out quickly
            if (this.lightningAlpha < 0.05) this.lightningAlpha = 0;
        }
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
     * Update and draw puddle ripples
     * @private
     */
    _updateAndDrawRipples() {
        const height = this.canvas.height;

        // Process ripples
        for (let i = this.ripples.length - 1; i >= 0; i--) {
            const ripple = this.ripples[i];

            // Expand ripple
            ripple.radius += 0.8;
            ripple.opacity *= 0.92;

            // Remove if too faded or too large
            if (ripple.opacity < 0.05 || ripple.radius > ripple.maxRadius) {
                this.ripples.splice(i, 1);
                continue;
            }

            // Draw ripple as ellipse (perspective effect)
            this.ctx.beginPath();
            this.ctx.ellipse(
                ripple.x,
                ripple.y,
                ripple.radius,
                ripple.radius * 0.3, // Flatten for perspective
                0, 0, Math.PI * 2
            );
            this.ctx.strokeStyle = `rgba(150, 200, 255, ${ripple.opacity})`;
            this.ctx.lineWidth = 1.5;
            this.ctx.stroke();
        }

        // Limit max ripples for performance
        if (this.ripples.length > 50) {
            this.ripples = this.ripples.slice(-50);
        }
    }

    /**
     * Initialize clouds and trees
     * @private
     */
    _initCloudsAndTrees(width, height) {
        // Create clouds
        this.clouds = [];
        const cloudCount = 8 + Math.floor(Math.random() * 5);
        for (let i = 0; i < cloudCount; i++) {
            this.clouds.push({
                x: Math.random() * width * 1.5 - width * 0.25,
                y: Math.random() * height * 0.25,
                width: 100 + Math.random() * 150,
                height: 30 + Math.random() * 40,
                speed: 0.2 + Math.random() * 0.3,
                opacity: 0.3 + Math.random() * 0.3
            });
        }

        // Create tree silhouettes
        this.trees = [];
        const treeCount = 12 + Math.floor(Math.random() * 8);
        for (let i = 0; i < treeCount; i++) {
            this.trees.push({
                x: (i / treeCount) * width + (Math.random() - 0.5) * 80,
                height: 60 + Math.random() * 100,
                width: 20 + Math.random() * 30,
                type: Math.random() > 0.5 ? 'pine' : 'round'
            });
        }

        this.cloudsInitialized = true;
    }

    /**
     * Draw and update clouds
     * @private
     */
    _drawClouds(width, height) {
        for (const cloud of this.clouds) {
            // Move cloud slowly
            cloud.x += cloud.speed * (1 + this.midLevel * 0.5);

            // Wrap around
            if (cloud.x > width + cloud.width) {
                cloud.x = -cloud.width;
            }

            // Draw cloud as layered ellipses
            this.ctx.fillStyle = `rgba(30, 35, 50, ${cloud.opacity})`;

            // Main body
            this.ctx.beginPath();
            this.ctx.ellipse(cloud.x, cloud.y, cloud.width / 2, cloud.height / 2, 0, 0, Math.PI * 2);
            this.ctx.fill();

            // Left bump
            this.ctx.beginPath();
            this.ctx.ellipse(cloud.x - cloud.width * 0.3, cloud.y + 5, cloud.width * 0.3, cloud.height * 0.4, 0, 0, Math.PI * 2);
            this.ctx.fill();

            // Right bump
            this.ctx.beginPath();
            this.ctx.ellipse(cloud.x + cloud.width * 0.25, cloud.y + 8, cloud.width * 0.35, cloud.height * 0.35, 0, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    /**
     * Draw tree silhouettes
     * @private
     */
    _drawTrees(width, height) {
        const groundY = height - 5;

        for (const tree of this.trees) {
            this.ctx.fillStyle = 'rgba(10, 12, 20, 0.9)';

            if (tree.type === 'pine') {
                // Pine tree (triangle shape)
                this.ctx.beginPath();
                this.ctx.moveTo(tree.x, groundY - tree.height);
                this.ctx.lineTo(tree.x - tree.width / 2, groundY);
                this.ctx.lineTo(tree.x + tree.width / 2, groundY);
                this.ctx.closePath();
                this.ctx.fill();

                // Second layer (smaller)
                this.ctx.beginPath();
                this.ctx.moveTo(tree.x, groundY - tree.height * 1.1);
                this.ctx.lineTo(tree.x - tree.width * 0.35, groundY - tree.height * 0.4);
                this.ctx.lineTo(tree.x + tree.width * 0.35, groundY - tree.height * 0.4);
                this.ctx.closePath();
                this.ctx.fill();
            } else {
                // Round tree (trunk + circle canopy)
                // Trunk
                const trunkWidth = tree.width * 0.2;
                this.ctx.fillRect(tree.x - trunkWidth / 2, groundY - tree.height * 0.4, trunkWidth, tree.height * 0.4);

                // Canopy
                this.ctx.beginPath();
                this.ctx.arc(tree.x, groundY - tree.height * 0.6, tree.width * 0.4, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
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
     * Draw lightning flash effect
     * @private
     */
    _drawLightning(width, height) {
        // Full screen flash with gradient
        const flashGradient = this.ctx.createRadialGradient(
            width / 2, height / 3, 0,
            width / 2, height / 3, Math.max(width, height)
        );
        flashGradient.addColorStop(0, `rgba(255, 255, 255, ${this.lightningAlpha})`);
        flashGradient.addColorStop(0.3, `rgba(200, 220, 255, ${this.lightningAlpha * 0.7})`);
        flashGradient.addColorStop(1, `rgba(100, 150, 255, ${this.lightningAlpha * 0.2})`);

        this.ctx.fillStyle = flashGradient;
        this.ctx.fillRect(0, 0, width, height);

        // Draw lightning bolt (optional, adds visual interest)
        if (this.lightningAlpha > 0.5) {
            this._drawLightningBolt(width, height);
        }
    }

    /**
     * Draw a jagged lightning bolt
     * @private
     */
    _drawLightningBolt(width, height) {
        const startX = width * (0.3 + Math.random() * 0.4);
        const startY = 0;
        const endY = height * 0.6;

        this.ctx.beginPath();
        this.ctx.strokeStyle = `rgba(255, 255, 255, ${this.lightningAlpha})`;
        this.ctx.lineWidth = 2 + Math.random() * 2;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        let x = startX;
        let y = startY;
        this.ctx.moveTo(x, y);

        const segments = 8 + Math.floor(Math.random() * 5);
        const segmentHeight = endY / segments;

        for (let i = 0; i < segments; i++) {
            x += (Math.random() - 0.5) * 60;
            y += segmentHeight;
            this.ctx.lineTo(x, y);

            // Occasional branch
            if (Math.random() > 0.7) {
                const branchX = x + (Math.random() - 0.5) * 80;
                const branchY = y + segmentHeight * 0.5;
                this.ctx.moveTo(x, y);
                this.ctx.lineTo(branchX, branchY);
                this.ctx.moveTo(x, y);
            }
        }

        this.ctx.stroke();

        // Glow effect
        this.ctx.shadowColor = 'rgba(150, 200, 255, 0.8)';
        this.ctx.shadowBlur = 20;
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
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

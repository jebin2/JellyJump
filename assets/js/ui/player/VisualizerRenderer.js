/**
 * Visualizer Main Renderer
 * Handles the background, environmental effects (rain, clouds, lightning), and the main draw loop.
 */
export class VisualizerRenderer {
    /**
     * @param {AudioVisualizer} visualizer - The main visualizer instance
     */
    constructor(visualizer) {
        this.visualizer = visualizer;
    }

    /**
     * Initialize scene elements (clouds, raindrops, etc.)
     */
    initScene(width, height) {
        const v = this.visualizer;
        
        // 1. Clouds
        v.clouds = [];
        const cloudCount = Math.floor(width / 180);
        for (let i = 0; i < cloudCount; i++) {
            v.clouds.push({
                x: Math.random() * width,
                y: height * (0.05 + Math.random() * 0.15),
                w: 120 + Math.random() * 100,
                h: 40 + Math.random() * 30,
                speed: 0.2 + Math.random() * 0.4
            });
        }

        // 2. Raindrops
        v.raindrops = [];
        const layerConfig = [
            { count: 180, speedMult: 1.0, alpha: 0.18, len: 12 },
            { count: 120, speedMult: 1.4, alpha: 0.28, len: 18 },
            { count: 60,  speedMult: 2.0, alpha: 0.42, len: 26 }
        ];

        for (const layer of layerConfig) {
            for (let i = 0; i < layer.count; i++) {
                v.raindrops.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    speed: (8 + Math.random() * 4) * layer.speedMult,
                    alpha: layer.alpha,
                    len: layer.len
                });
            }
        }

        // 3. Environment Items
        v.sceneComposition = {
            mistDensity: 0.4 + Math.random() * 0.4,
            rainIntensity: 0.6 + Math.random() * 0.4,
            chairXRatio: 0.72 + Math.random() * 0.1
        };

        v.trees = [];
        const treeCount = 4 + Math.floor(Math.random() * 3);
        for (let i = 0; i < treeCount; i++) {
            v.trees.push({
                xRatio: 0.1 + (i / treeCount) * 0.8 + (Math.random() - 0.5) * 0.1,
                yRatio: 0.88 + Math.random() * 0.05,
                hRatio: 0.18 + Math.random() * 0.12
            });
        }

        v.publicChairs = [
            { xRatio: v.sceneComposition.chairXRatio, yRatio: 0.92, hasBalloon: true }
        ];

        v.sceneWidth = width;
        v.sceneHeight = height;
    }

    /**
     * Main draw call
     */
    draw(width, height) {
        const v = this.visualizer;
        const ctx = v.ctx;

        const lightningFlash = this._getLightningFlash();
        const duskHue = 215 + Math.sin(v.simTime * 0.2) * 15;
        const stormHue = 230 + v.bassLevel * 20;
        const rainHue = 210 + v.trebleLevel * 30;

        // 1. Sky & Moon
        this.drawSky(width, height, duskHue, stormHue, lightningFlash);
        this.drawMoon(width, height, duskHue);

        // 2. Clouds
        this.drawClouds(width, height, stormHue);

        // 3. Environmental Objects
        v.characters.drawPublicChair(v.publicChairs[0], width, height);
        for (const tree of v.trees) {
            v.characters.drawTree(tree, width, height);
        }

        // 4. Character
        v.characters.drawWoman(width, height, lightningFlash);

        // 5. FX
        this.drawLightning(ctx);
        this.drawBeatGlow(width, height, rainHue, duskHue);
        this.drawRain(width, height, rainHue);
        this.drawMist(width, height, lightningFlash);
        this.drawPulseRings(ctx);
        this.drawPitchLabel(width, height);
    }

    /**
     * Calculate global flash intensity from active lightning
     */
    _getLightningFlash() {
        let flash = 0;
        for (const bolt of this.visualizer.lightningBolts) {
            bolt.alpha -= 0.045;
            if (bolt.alpha > 0) flash = Math.max(flash, bolt.alpha);
        }
        this.visualizer.lightningBolts = this.visualizer.lightningBolts.filter(b => b.alpha > 0);
        return flash;
    }

    drawSky(width, height, duskHue, stormHue, lightningFlash) {
        const ctx = this.visualizer.ctx;
        const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
        const intensity = 0.12 + this.visualizer.bassLevel * 0.18 + lightningFlash * 0.5;
        
        skyGrad.addColorStop(0, `hsl(${stormHue}, 35%, ${10 + intensity * 40}%)`);
        skyGrad.addColorStop(0.6, `hsl(${duskHue}, 30%, ${18 + intensity * 20}%)`);
        skyGrad.addColorStop(1, `hsl(${duskHue - 20}, 25%, ${28 + intensity * 15}%)`);
        
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, width, height);
    }

    drawMoon(width, height, duskHue) {
        const v = this.visualizer;
        const ctx = v.ctx;
        const mx = width * 0.82;
        const my = height * 0.18;
        const mr = Math.min(width, height) * 0.055;

        ctx.save();
        ctx.shadowBlur = 40 + v.bassLevel * 60;
        ctx.shadowColor = `hsla(${duskHue}, 80%, 90%, 0.4)`;
        ctx.fillStyle = `hsla(${duskHue}, 30%, 95%, 0.85)`;
        ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    drawClouds(width, height, stormHue) {
        const v = this.visualizer;
        const ctx = v.ctx;
        ctx.fillStyle = `hsla(${stormHue}, 20%, 15%, 0.35)`;
        
        for (const cloud of v.clouds) {
            cloud.x += cloud.speed;
            if (cloud.x > width + cloud.w) cloud.x = -cloud.w;
            
            ctx.beginPath();
            ctx.ellipse(cloud.x, cloud.y, cloud.w, cloud.h, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    drawRain(width, height, rainHue) {
        const v = this.visualizer;
        const ctx = v.ctx;
        ctx.strokeStyle = `hsla(${rainHue}, 60%, 85%, 0.3)`;
        ctx.lineWidth = 1;

        for (const drop of v.raindrops) {
            drop.y += drop.speed + v.bassLevel * 5;
            if (drop.y > height) { drop.y = -20; drop.x = Math.random() * width; }
            
            ctx.globalAlpha = drop.alpha;
            ctx.beginPath();
            ctx.moveTo(drop.x, drop.y);
            ctx.lineTo(drop.x + 1, drop.y + drop.len);
            ctx.stroke();
        }
        ctx.globalAlpha = 1.0;
    }

    drawLightning(ctx) {
        for (const bolt of this.visualizer.lightningBolts) {
            ctx.save();
            ctx.strokeStyle = `rgba(220, 235, 255, ${bolt.alpha})`;
            ctx.shadowBlur = 20 * bolt.glow;
            ctx.shadowColor = "rgba(160, 200, 255, 0.8)";
            ctx.lineWidth = bolt.width;

            const drawPoints = (pts) => {
                ctx.beginPath();
                ctx.moveTo(pts[0].x, pts[0].y);
                for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
                ctx.stroke();
            };

            drawPoints(bolt.points);
            for (const fork of bolt.forks) drawPoints(fork);
            ctx.restore();
        }
    }

    drawMist(width, height, lightningFlash) {
        const v = this.visualizer;
        const ctx = v.ctx;
        const mistGrad = ctx.createLinearGradient(0, height * 0.7, 0, height);
        const alpha = (0.15 + v.sceneComposition.mistDensity * 0.2 + v.bassLevel * 0.15 + lightningFlash * 0.2);
        
        mistGrad.addColorStop(0, "rgba(200, 210, 230, 0)");
        mistGrad.addColorStop(1, `rgba(180, 190, 210, ${alpha})`);
        
        ctx.fillStyle = mistGrad;
        ctx.fillRect(0, height * 0.6, width, height * 0.4);
    }

    drawPulseRings(ctx) {
        const v = this.visualizer;
        for (const ring of v.pulseRings) {
            ring.radius += ring.speed;
            ring.alpha -= 0.008;
            
            if (ring.alpha > 0) {
                ctx.strokeStyle = `rgba(180, 210, 255, ${ring.alpha})`;
                ctx.lineWidth = ring.width;
                ctx.beginPath();
                ctx.ellipse(ring.x, ring.y, ring.radius, ring.radius * ring.flatten, 0, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
        v.pulseRings = v.pulseRings.filter(r => r.alpha > 0);
    }

    drawBeatGlow(width, height, rainHue, duskHue) {
        const v = this.visualizer;
        const ctx = v.ctx;
        if (v.bassLevel < 0.3) return;
        
        const g = ctx.createRadialGradient(width/2, height, 0, width/2, height, height * 0.8);
        g.addColorStop(0, `hsla(${rainHue}, 70%, 60%, ${v.bassLevel * 0.15})`);
        g.addColorStop(1, `hsla(${duskHue}, 40%, 10%, 0)`);
        
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, width, height);
    }

    drawPitchLabel(width, height) {
        const pitch = this.visualizer.pitchSmoothedHz;
        if (!pitch || pitch < 40) return;

        const ctx = this.visualizer.ctx;
        ctx.font = "12px monospace";
        ctx.fillStyle = "rgba(208, 226, 255, 0.74)";
        ctx.textAlign = "right";
        ctx.fillText(`${Math.round(pitch)} Hz`, width - 14, height - 14);
    }

    drawStaticBackground(width, height) {
        const ctx = this.visualizer.ctx;
        const bg = ctx.createLinearGradient(0, 0, 0, height);
        bg.addColorStop(0, "#0f1628");
        bg.addColorStop(0.62, "#1d2541");
        bg.addColorStop(1, "#4b2b2b");
        
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = "rgba(173, 205, 255, 0.75)";
        ctx.font = `${Math.max(30, Math.min(width, height) * 0.15)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("♫", width / 2, height / 2 - 8);

        ctx.font = "14px sans-serif";
        ctx.fillStyle = "rgba(214, 228, 255, 0.8)";
        ctx.fillText("Press play to start visualization", width / 2, height / 2 + 36);
    }
}

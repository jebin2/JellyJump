/**
 * Visualizer Characters and Objects
 * Handles rendering of complex scene elements like the woman, trees, chairs, and balloons.
 */
export class VisualizerCharacters {
    /**
     * @param {AudioVisualizer} visualizer - The main visualizer instance
     */
    constructor(visualizer) {
        this.visualizer = visualizer;
    }

    /**
     * Draw the walking woman character
     */
    drawWoman(width, height, flashLift) {
        const v = this.visualizer;
        const ctx = v.ctx;
        const w = v.woman;
        const color = `rgba(6, 8, 12, ${0.97 - flashLift * 0.14})`;

        // State Machine
        const frameStep = w.speed / (w.height * 0.405);
        if (w.state === "walking_to_balloon") {
            const targetX = width * v.sceneComposition.chairXRatio - w.height * 0.6;
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
        const bob = isWalking ? Math.abs(Math.sin(t)) * 2.5 : 0;

        const H = w.height;
        const hipY      = -H * 0.51;
        const waistY    = -H * 0.63;
        const shoulderY = -H * 0.82;
        const headCY    = -H * 0.93;
        const headR     =  H * 0.075;
        const thighLen  =  H * 0.27;
        const shinLen   =  H * 0.24;
        const footLen   =  H * 0.08;
        const hipHW     =  H * 0.052;
        const shoulderHW =  H * 0.115;
        const waistHW   =  H * 0.065;

        let rHandLX = shoulderHW + H * 0.12;
        let rHandLY = shoulderY - H * 0.08;

        ctx.save();
        ctx.fillStyle = color;
        ctx.strokeStyle = color;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.translate(w.x, w.y - bob);

        const drawLeg = (phase) => {
            const thighA = phase * 0.42;
            let shinA;
            if (phase >= 0) {
                const kneeBend = Math.sin(phase * Math.PI) * 0.72;
                shinA = thighA - kneeBend;
            } else {
                shinA = thighA * 0.46;
            }

            const kx = Math.sin(thighA) * thighLen;
            const ky = hipY + Math.cos(thighA) * thighLen;
            const ax = kx + Math.sin(shinA) * shinLen;
            const ay = ky + Math.cos(shinA) * shinLen;

            const heelLift = phase > 0.65 ? (phase - 0.65) / 0.35 * 0.28 : 0;
            const fx = ax + Math.cos(heelLift) * footLen;
            const fy = ay - Math.sin(heelLift) * footLen;

            ctx.lineWidth = H * 0.044;
            ctx.beginPath(); ctx.moveTo(0, hipY); ctx.lineTo(kx, ky); ctx.stroke();
            ctx.lineWidth = H * 0.034;
            ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(ax, ay); ctx.stroke();
            ctx.lineWidth = H * 0.030;
            ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(fx, fy); ctx.stroke();
            ctx.beginPath(); ctx.arc(kx, ky, H * 0.020, 0, Math.PI * 2); ctx.fill();
        };

        drawLeg(-walkCycle);
        
        // Skirt
        const skirtHemY = hipY + H * 0.21;
        const hemFlare  = H * 0.165 + (isWalking ? Math.abs(walkCycle) * H * 0.024 : 0);
        const skirtSway = isWalking ? walkCycle * H * 0.013 : 0;
        ctx.beginPath();
        ctx.moveTo(-hipHW * 1.85 + skirtSway * 0.4, hipY - H * 0.012);
        ctx.bezierCurveTo(-hipHW * 2.4 + skirtSway * 0.3,  hipY + H * 0.065, -hemFlare * 1.1 + skirtSway * 0.15, skirtHemY - H * 0.018, -hemFlare * 0.62 + skirtSway * 0.1, skirtHemY);
        ctx.lineTo(hemFlare * 0.62 + skirtSway * 0.1, skirtHemY);
        ctx.bezierCurveTo(hemFlare * 1.1 + skirtSway * 0.15, skirtHemY - H * 0.018, hipHW * 2.4 + skirtSway * 0.3,  hipY + H * 0.065, hipHW * 1.85 + skirtSway * 0.4, hipY - H * 0.012);
        ctx.closePath(); ctx.fill();

        drawLeg(walkCycle);

        // Torso
        const torsoBobX = isWalking ? walkCycle * H * 0.007 : 0;
        ctx.beginPath();
        ctx.moveTo(-hipHW * 1.6 + torsoBobX, hipY);
        ctx.bezierCurveTo(-hipHW * 1.85 + torsoBobX, hipY - H * 0.04, -waistHW * 1.1, waistY + H * 0.022, -waistHW, waistY);
        ctx.bezierCurveTo(-waistHW, waistY - H * 0.018, -shoulderHW, shoulderY + H * 0.038, -shoulderHW, shoulderY);
        ctx.lineTo(shoulderHW, shoulderY);
        ctx.bezierCurveTo(shoulderHW, shoulderY + H * 0.038, waistHW, waistY - H * 0.018, waistHW, waistY);
        ctx.bezierCurveTo(waistHW * 1.1, waistY + H * 0.022, hipHW * 1.85 + torsoBobX, hipY - H * 0.04, hipHW * 1.6 + torsoBobX, hipY);
        ctx.closePath(); ctx.fill();

        // Neck & Head
        ctx.lineWidth = H * 0.038; ctx.beginPath(); ctx.moveTo(0, shoulderY); ctx.lineTo(0, headCY + headR * 0.9); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, headCY, headR, 0, Math.PI * 2); ctx.fill();

        // Hair
        ctx.beginPath(); ctx.arc(headR * 0.05, headCY - headR * 0.78, headR * 0.46, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = headR * 0.5; ctx.beginPath(); ctx.moveTo(-headR * 0.52, headCY - headR * 0.38); ctx.quadraticCurveTo(-headR * 1.05, headCY + headR * 0.28, -headR * 0.55, headCY + headR * 0.86); ctx.stroke();

        // Arms
        const lShX = -shoulderHW;
        const uElbX = lShX - H * 0.11;
        const uElbY = shoulderY + H * 0.005;
        const uHandX = lShX - H * 0.02;
        const uHandY = -H * 0.955;
        ctx.lineWidth = H * 0.038; ctx.beginPath(); ctx.moveTo(lShX, shoulderY); ctx.lineTo(uElbX, uElbY); ctx.stroke();
        ctx.lineWidth = H * 0.030; ctx.beginPath(); ctx.moveTo(uElbX, uElbY); ctx.lineTo(uHandX, uHandY); ctx.stroke();

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
        ctx.lineWidth = H * 0.038; ctx.beginPath(); ctx.moveTo(rShX, shoulderY); ctx.lineTo(rElbX, rElbY); ctx.stroke();
        ctx.lineWidth = H * 0.030; ctx.beginPath(); ctx.moveTo(rElbX, rElbY); ctx.lineTo(rHandLX, rHandLY); ctx.stroke();

        // Umbrella
        ctx.save();
        ctx.translate(uHandX, uHandY);
        ctx.rotate(-0.06);
        const uR = H * 0.46;
        ctx.fillStyle = `rgba(18, 22, 34, ${0.98 - flashLift * 0.14})`;
        ctx.beginPath(); ctx.moveTo(-uR, 0); ctx.quadraticCurveTo(0, -uR * 0.72, uR, 0); ctx.closePath(); ctx.fill();
        ctx.lineWidth = H * 0.015; ctx.beginPath(); ctx.moveTo(0, -uR * 0.35); ctx.lineTo(0, H * 0.4); ctx.stroke();
        ctx.restore();

        // Balloon
        if (w.hasBalloon) {
            this.drawBalloon(rHandLX, rHandLY, true);
        }

        ctx.restore();
    }

    /**
     * Draw a balloon
     */
    drawBalloon(x, y, isHeld = false) {
        const v = this.visualizer;
        const ctx = v.ctx;
        const sway = Math.sin(v.simTime * 1.8) * 12;
        const bx = x + (isHeld ? 0 : sway);
        const by = y - (isHeld ? v.woman.height * 0.45 : 0) - 80 - v.bassLevel * 30;

        ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + sway * 0.5, y - 40, bx, by + 18); ctx.stroke();

        const grad = ctx.createRadialGradient(bx - 6, by - 8, 2, bx, by, 22);
        grad.addColorStop(0, "#ff6b81");
        grad.addColorStop(1, "#c02c44");
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.ellipse(bx, by, 18, 22, 0, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
        ctx.beginPath(); ctx.ellipse(bx - 6, by - 8, 5, 8, 0.4, 0, Math.PI * 2); ctx.fill();
    }

    /**
     * Draw a public park chair
     */
    drawPublicChair(chair, width, height) {
        const v = this.visualizer;
        const ctx = v.ctx;
        const x = width * chair.xRatio;
        const y = height * chair.yRatio;
        const w = width * 0.06;
        const h = height * 0.045;

        ctx.strokeStyle = "rgba(12, 16, 24, 0.95)";
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y - h, w, h);
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x, y - h * 0.5); ctx.lineTo(x + w, y - h * 0.5); ctx.stroke();

        if (chair.hasBalloon && !v.woman.hasBalloon && v.woman.state !== "taking_balloon") {
            this.drawBalloon(x + w * 0.7, y - h);
        }
    }

    /**
     * Draw a stylized tree
     */
    drawTree(tree, width, height) {
        const v = this.visualizer;
        const ctx = v.ctx;
        const x = width * tree.xRatio;
        const y = height * tree.yRatio;
        const h = height * tree.hRatio;

        ctx.fillStyle = "rgba(8, 12, 18, 0.98)";
        ctx.fillRect(x - 4, y - h, 8, h);

        ctx.beginPath();
        ctx.moveTo(x, y - h * 1.2);
        ctx.lineTo(x - h * 0.4, y - h * 0.4);
        ctx.lineTo(x + h * 0.4, y - h * 0.4);
        ctx.closePath();
        ctx.fill();
    }
}

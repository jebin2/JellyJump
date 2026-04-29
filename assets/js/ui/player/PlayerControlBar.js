import { Logger } from '../../shared/utils/Logger.js';

export class PlayerControlBar {
    constructor(player) {
        this.player = player;
    }

    loadMode() {
        const p = this.player;
        try {
            const savedMode = localStorage.getItem('controlBarMode');
            if (savedMode === 'fixed' || savedMode === 'overlay') {
                p.controlBarMode = savedMode;
            }
        } catch (e) {
            Logger.warn('Failed to load control bar mode:', e);
        }
        this.applyMode();
    }

    saveMode() {
        const p = this.player;
        try {
            localStorage.setItem('controlBarMode', p.controlBarMode);
        } catch (e) {
            Logger.warn('Failed to save control bar mode:', e);
        }
    }

    toggleMode() {
        const p = this.player;
        p.controlBarMode = p.controlBarMode === 'overlay' ? 'fixed' : 'overlay';
        this.applyMode();
        this.saveMode();
    }

    applyMode() {
        const p = this.player;
        p.container.classList.remove('mode-overlay', 'mode-fixed');
        p.container.classList.add(`mode-${p.controlBarMode}`);

        if (p.ui.modeToggleBtn) {
            const isFixed = p.controlBarMode === 'fixed';
            p.ui.modeToggleBtn.setAttribute('aria-label', isFixed ? 'Unpin controls' : 'Pin controls');
            p.ui.modeToggleBtn.setAttribute('aria-pressed', isFixed.toString());
            p.ui.modeToggleBtn.setAttribute('title', isFixed ? 'Unpin controls' : 'Pin controls');
        }

        if (p.controlBarMode === 'overlay') {
            p.ui.controls.classList.add('visible');
            this.startAutoHideTimer();
        } else {
            this.clearAutoHideTimer();
            p.ui.controls.classList.add('visible');
        }

        if (p.isAudioMode) {
            const containerRect = p.container.getBoundingClientRect();
            p.canvas.width = containerRect.width || 1280;
            p.canvas.height = containerRect.height || 720;
            if (!p.isPlaying && p.audioVisualizer) {
                p.audioVisualizer.drawStaticBackground();
            }
        }
    }

    handleMouseMove(e) {
        const p = this.player;
        if (p.controlBarMode !== 'overlay') return;

        p.ui.controls.classList.add('visible');
        this.clearAutoHideTimer();

        if (!p.isPlaying) return;

        const controlsRect = p.ui.controls.getBoundingClientRect();
        const isOverControls = e.clientY >= controlsRect.top &&
            e.clientY <= controlsRect.bottom &&
            e.clientX >= controlsRect.left &&
            e.clientX <= controlsRect.right;

        if (!isOverControls) this.startAutoHideTimer();
    }

    startAutoHideTimer() {
        const p = this.player;
        if (p.controlBarMode !== 'overlay') return;
        if (!p.isPlaying) return;

        this.clearAutoHideTimer();
        p.autoHideTimer = setTimeout(() => {
            p.ui.controls.classList.remove('visible');
            p.container.classList.add('hide-cursor');
        }, 3000);
    }

    clearAutoHideTimer() {
        const p = this.player;
        if (p.autoHideTimer) {
            clearTimeout(p.autoHideTimer);
            p.autoHideTimer = null;
        }
        p.container.classList.remove('hide-cursor');
    }
}

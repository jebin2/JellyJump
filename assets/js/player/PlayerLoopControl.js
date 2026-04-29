import { Logger } from '../shared/utils/Logger.js';
import { formatTime } from '../shared/utils/mediaUtils.js';

export class PlayerLoopControl {
    constructor(player) {
        this.player = player;
    }

    setLoopStart() {
        const p = this.player;
        p.loopStart = p.currentTime;
        if (p.loopEnd !== null && p.loopStart >= p.loopEnd) {
            p.loopEnd = null;
        }
        if (p.loopMode !== 'one') p.loopMode = 'one';
        this.updateLoopUI();
        Logger.log('Loop Start set:', p.loopStart);
    }

    setLoopEnd() {
        const p = this.player;
        if (p.loopStart === null) {
            this.setLoopStart();
            return;
        }
        if (p.currentTime <= p.loopStart) {
            Logger.warn('Loop End must be after Loop Start');
            return;
        }
        p.loopEnd = p.currentTime;
        if (p.loopMode !== 'one') p.loopMode = 'one';
        this.updateLoopUI();
        Logger.log('Loop End set:', p.loopEnd);
    }

    clearLoopMarkers() {
        const p = this.player;
        p.loopStart = null;
        p.loopEnd = null;
        this.updateLoopUI();
    }

    resetLoop() {
        const p = this.player;
        p.loopStart = null;
        p.loopEnd = null;
        p.loopMode = 'off';
        this.updateLoopUI();
    }

    toggleLoopMode() {
        const p = this.player;
        if (p.loopStart !== null || p.loopEnd !== null) {
            p.loopStart = null;
            p.loopEnd = null;
        }
        this.updateLoopUI();
    }

    toggleLoopPanel() {
        const p = this.player;
        const isVisible = p.ui.loopPanel.style.display !== 'none';
        p.ui.loopPanel.style.display = isVisible ? 'none' : 'block';
        if (!isVisible) this.updateLoopUI();
    }

    updateLoopUI() {
        const p = this.player;
        const btn = p.ui.loopBtn;
        if (!btn) return;

        const use = btn.querySelector('use');
        const hasAbLoop = p.loopStart !== null && p.loopEnd !== null;

        if (p.loopMode === 'off') {
            btn.style.color = '';
            btn.setAttribute('aria-label', 'Loop Mode: Off');
            use.setAttribute('href', 'assets/icons/sprite.svg#icon-loop');
        } else if (p.loopMode === 'playlist') {
            btn.style.color = 'var(--accent-primary)';
            btn.setAttribute('aria-label', 'Loop Mode: Playlist');
            use.setAttribute('href', 'assets/icons/sprite.svg#icon-loop-playlist');
        } else if (p.loopMode === 'one') {
            btn.style.color = 'var(--accent-primary)';
            if (hasAbLoop) {
                btn.setAttribute('aria-label', 'Loop Mode: A-B');
                use.setAttribute('href', 'assets/icons/sprite.svg#icon-loop-ab');
            } else {
                btn.setAttribute('aria-label', 'Loop Mode: One');
                use.setAttribute('href', 'assets/icons/sprite.svg#icon-loop-one');
            }
        }

        if (p.ui.loopModeRadios) {
            p.ui.loopModeRadios.forEach(radio => {
                radio.checked = radio.value === p.loopMode;
            });
        }

        if (p.ui.loopAbSection) {
            p.ui.loopAbSection.style.display = p.loopMode === 'one' ? 'block' : 'none';
        }

        if (p.ui.loopStartInput) {
            p.ui.loopStartInput.value = p.loopStart !== null ? formatTime(p.loopStart) : '';
        }
        if (p.ui.loopEndInput) {
            p.ui.loopEndInput.value = p.loopEnd !== null ? formatTime(p.loopEnd) : '';
        }

        if (p.duration > 0) {
            if (p.loopStart !== null) {
                p.ui.loopMarkerA.style.display = 'block';
                p.ui.loopMarkerA.style.left = `${(p.loopStart / p.duration) * 100}%`;
            } else {
                p.ui.loopMarkerA.style.display = 'none';
            }

            if (p.loopEnd !== null) {
                p.ui.loopMarkerB.style.display = 'block';
                p.ui.loopMarkerB.style.left = `${(p.loopEnd / p.duration) * 100}%`;
            } else {
                p.ui.loopMarkerB.style.display = 'none';
            }

            if (p.loopStart !== null && p.loopEnd !== null) {
                p.ui.loopRegion.style.display = 'block';
                const startPct = (p.loopStart / p.duration) * 100;
                const endPct = (p.loopEnd / p.duration) * 100;
                p.ui.loopRegion.style.left = `${startPct}%`;
                p.ui.loopRegion.style.width = `${endPct - startPct}%`;
            } else {
                p.ui.loopRegion.style.display = 'none';
            }
        }
    }
}

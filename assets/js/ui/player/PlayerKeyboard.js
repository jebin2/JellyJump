export class PlayerKeyboard {
    constructor(player) {
        this.player = player;
    }

    handleKeyboard(e) {
        const p = this.player;

        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
        if (e.ctrlKey || e.altKey || e.metaKey) return;

        // Block player keyboard controls if screenshot modal is open
        if (p.screenshotManager && p.screenshotManager.isModalOpen()) return;

        const key = e.key.toLowerCase();

        switch (key) {
            // Playback Controls
            case ' ':
            case 'k':
                e.preventDefault();
                // Restore audio if muted for autoplay (user is now interacting)
                p._restoreAutoplayAudio('Keyboard play');
                p.togglePlay();
                break;
            case 'j':
                e.preventDefault();
                p._seekTo(Math.max(0, p.currentTime - 10));
                break;
            case 'l':
                if (e.shiftKey) {
                    e.preventDefault();
                    p.clearLoopMarkers();
                } else {
                    e.preventDefault();
                    p._seekTo(Math.min(p.duration, p.currentTime + 10));
                }
                break;
            case 'arrowleft':
                e.preventDefault();
                p._seekTo(Math.max(0, p.currentTime - 5));
                break;
            case 'arrowright':
                e.preventDefault();
                p._seekTo(Math.min(p.duration, p.currentTime + 5));
                break;
            case 'home':
                e.preventDefault();
                p._seekTo(0);
                break;
            case 'end':
                e.preventDefault();
                p._seekTo(p.duration);
                break;

            // Number Keys - Seek to percentage
            case '0': case '1': case '2': case '3': case '4':
            case '5': case '6': case '7': case '8': case '9': {
                e.preventDefault();
                const percent = parseInt(key) / 10;
                p._seekTo(p.duration * percent);
                break;
            }

            // Audio Controls
            case 'arrowup':
                e.preventDefault();
                p.setVolume(p.config.volume + 0.1);
                break;
            case 'arrowdown':
                e.preventDefault();
                p.setVolume(p.config.volume - 0.1);
                break;
            case 'm':
                e.preventDefault();
                p.toggleMute();
                break;

            // Display Controls
            case 'f':
                e.preventDefault();
                p.toggleFullscreen();
                break;
            case 'c':
                e.preventDefault();
                p.isSubtitlesEnabled = !p.isSubtitlesEnabled;
                p._updateSubtitleMenu();
                break;
            case 'escape':
                if (document.fullscreenElement) {
                    document.exitFullscreen();
                } else if (p.ui.helpOverlay?.style.display !== 'none') {
                    this.toggleHelp();
                }
                break;

            // Help
            case '?':
                e.preventDefault();
                this.toggleHelp();
                break;

            // Screenshot
            case 's':
                e.preventDefault();
                if (p.screenshotManager) p.screenshotManager.capture();
                break;

            // Navigation (Player Mode)
            case 'n':
                if (e.shiftKey && p.config.mode === 'player') {
                    e.preventDefault();
                    if (!p.ui.nextBtn?.disabled && p.onNext) p.onNext();
                }
                break;
            case 'p':
                if (e.shiftKey && p.config.mode === 'player') {
                    e.preventDefault();
                    if (!p.ui.prevBtn?.disabled && p.onPrevious) p.onPrevious();
                }
                break;
            case '<':
                if (e.shiftKey) { e.preventDefault(); p._cycleSpeed(-1); }
                break;
            case '>':
                if (e.shiftKey) { e.preventDefault(); p._cycleSpeed(1); }
                break;

            // Editor Mode Controls
            case ',':
                if (p.config.mode === 'editor') { e.preventDefault(); p._stepFrame(-1); }
                break;
            case '.':
                if (p.config.mode === 'editor') { e.preventDefault(); p._stepFrame(1); }
                break;
            case 'i':
                e.preventDefault();
                p.setLoopStart();
                break;
            case 'o':
                e.preventDefault();
                p.setLoopEnd();
                break;
            case 'r':
                e.preventDefault();
                p.resetLoop();
                break;
        }
    }

    toggleHelp() {
        const overlay = this.player.ui.helpOverlay;
        if (!overlay) return;
        const isVisible = overlay.style.display !== 'none';
        overlay.style.display = isVisible ? 'none' : 'flex';
    }
}

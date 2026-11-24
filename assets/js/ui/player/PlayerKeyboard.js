import { Toast } from '../../shared/utils/Toast.js';
import { cyclePlayerSpeed } from '../../core/playback/PlaybackState.js';
import { togglePlayerFullscreen } from './PlayerShell.js';

/**
 * Keys that do nothing while a video is being edited (the edit panel open),
 * as their buttons are put away then: another video, playing backwards,
 * speed, subtitles, and the loop, which the tools set for themselves.
 * @param {string} key - lower case
 * @param {boolean} shift
 */
function blockedWhileEditing(key, shift) {
    if (shift && ['j', 'l', 'n', 'p'].includes(key)) return true;
    return ['<', '>', 'c', 'i', 'o', 'r'].includes(key);
}

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
        const editing = !!p.container?.classList.contains('jj-editing');
        if (editing && blockedWhileEditing(key, e.shiftKey)) return;

        switch (key) {
            // Playback Controls
            case ' ':
            case 'k':
                e.preventDefault();
                // Restore audio if muted for autoplay (user is now interacting)
                p.restoreAutoplayAudio('Keyboard play');
                p.togglePlay();
                break;
            // The four relative-seek keys go through requestSeek rather
            // than seek: these are the ones people hold down, and the OS repeats
            // them far faster than a seek can complete.
            case 'j':
                e.preventDefault();
                // Shift+J plays backwards (and stops doing so); J alone steps back.
                if (e.shiftKey) {
                    p.toggleDirection().then(result => {
                        if (result?.reason) Toast.show(result.reason, 3500);
                    });
                }
                else p.requestSeek(p.currentTime - 10);
                break;
            case 'l':
                if (e.shiftKey) {
                    e.preventDefault();
                    p.clearLoopMarkers();
                } else {
                    e.preventDefault();
                    p.requestSeek(p.currentTime + 10);
                }
                break;
            case 'arrowleft':
                e.preventDefault();
                p.requestSeek(p.currentTime - 5);
                break;
            case 'arrowright':
                e.preventDefault();
                p.requestSeek(p.currentTime + 5);
                break;
            case 'home':
                e.preventDefault();
                p.seek(0);
                break;
            case 'end':
                e.preventDefault();
                p.seek(p.duration);
                break;

            // Number Keys - Seek to percentage
            case '0': case '1': case '2': case '3': case '4':
            case '5': case '6': case '7': case '8': case '9': {
                e.preventDefault();
                const percent = parseInt(key) / 10;
                p.seek(p.duration * percent);
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
                togglePlayerFullscreen(p);
                break;
            case 'c':
                e.preventDefault();
                p.subtitles.toggle(); // announces trackschange
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
                if (e.shiftKey) { e.preventDefault(); cyclePlayerSpeed(p, -1); }
                break;
            case '>':
                if (e.shiftKey) { e.preventDefault(); cyclePlayerSpeed(p, 1); }
                break;

            // Editor Mode Controls
            // Frame by frame, in the editor and while editing (to place a cut).
            case ',':
                if (p.config.mode === 'editor' || editing) { e.preventDefault(); p.stepFrame(-1); }
                break;
            case '.':
                if (p.config.mode === 'editor' || editing) { e.preventDefault(); p.stepFrame(1); }
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

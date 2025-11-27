/**
 * PlaybackManager
 * Orchestrates synchronization between the PreviewPlayer and TimelineManager.
 * Handles the main playback loop.
 */
class PlaybackManager {
    constructor() {
        this.isPlaying = false;
        this.animationFrameId = null;
        this.lastTime = 0;

        this.init();
    }

    init() {
        // Listen for toggle requests from UI
        window.addEventListener('timeline-play-toggle', () => this.togglePlay());

        // Listen for seek requests (if any external ones come in)
        // window.addEventListener('timeline-seek', (e) => this.seek(e.detail.time));

        console.log('PlaybackManager initialized');
    }

    togglePlay() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    async play() {
        if (this.isPlaying) return;

        const player = window.previewPlayer;
        if (!player) {
            console.warn('PreviewPlayer not found');
            return;
        }

        try {
            await player.play();
            this.isPlaying = true;
            this.startLoop();
            this.dispatchStateChange();
        } catch (err) {
            console.error('Failed to play:', err);
        }
    }

    pause() {
        if (!this.isPlaying) return;

        const player = window.previewPlayer;
        if (player) {
            player.pause();
        }

        this.isPlaying = false;
        this.stopLoop();
        this.dispatchStateChange();

        // One final update to ensure exact position
        this.updateSync();
    }

    seek(time) {
        const player = window.previewPlayer;
        const timeline = window.timelineManager;

        if (player) {
            player.seek(time);
        }

        if (timeline) {
            timeline.updatePlayheadPosition(time);
            timeline.updateTime(time);
        }
    }

    startLoop() {
        const loop = () => {
            this.updateSync();

            if (this.isPlaying) {
                this.animationFrameId = requestAnimationFrame(loop);
            }
        };
        this.animationFrameId = requestAnimationFrame(loop);
    }

    stopLoop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    updateSync() {
        const player = window.previewPlayer;
        const timeline = window.timelineManager;
        const clipManager = window.clipManager;

        if (!player || !timeline) return;

        const currentTime = player.getCurrentTime();
        const duration = clipManager ? clipManager.projectDuration : 60;

        // Update timeline visual
        timeline.updatePlayheadPosition(currentTime);
        timeline.updateTime(currentTime);

        // Check for end of project
        if (currentTime >= duration && this.isPlaying) {
            this.pause();
            this.seek(0); // Optional: loop or stop at end. Let's stop at end for now, or loop? 
            // Requirements say "Snap playhead to end (or loop if enabled)". 
            // Let's just pause for now.
        }
    }

    dispatchStateChange() {
        const event = new CustomEvent('preview-player-state-change', {
            detail: { isPlaying: this.isPlaying }
        });
        window.dispatchEvent(event);
    }
}

// Initialize
window.playbackManager = new PlaybackManager();
export default window.playbackManager;

/**
 * TimelineManager
 * Handles timeline header controls and synchronization with the PreviewPlayer.
 */
class TimelineManager {
    constructor() {
        // Elements
        this.playBtn = document.getElementById('timeline-play-btn');
        this.currentTimeDisplay = document.getElementById('timeline-current-time');
        this.totalDurationDisplay = document.getElementById('timeline-total-duration');

        this.zoomOutBtn = document.getElementById('timeline-zoom-out');
        this.zoomInBtn = document.getElementById('timeline-zoom-in');
        this.zoomLevelDisplay = document.getElementById('timeline-zoom-level');

        this.settingsBtn = document.getElementById('timeline-settings-btn');
        this.ruler = document.querySelector('.timeline__ruler');

        // State
        this.zoomLevel = 100;
        this.isPlaying = false;
        this.duration = 60; // Increased to 60 seconds to force scroll
        this.pixelsPerSecond = 50; // Default at 100% zoom

        this.init();
    }

    init() {
        this.attachEventListeners();
        this.updateRuler();
        console.log('TimelineManager initialized');
    }

    updateRuler() {
        if (this.ruler) {
            const width = this.duration * this.pixelsPerSecond * (this.zoomLevel / 100);
            // Create a content div if it doesn't exist to force scroll width
            let content = this.ruler.querySelector('.timeline__ruler-content');
            if (!content) {
                content = document.createElement('div');
                content.className = 'timeline__ruler-content';
                content.style.height = '100%';
                this.ruler.appendChild(content);
            }
            content.style.width = `${width}px`;
        }
    }

    attachEventListeners() {
        // Zoom
        if (this.zoomOutBtn) {
            this.zoomOutBtn.addEventListener('click', () => this.handleZoom(-25));
        }
        if (this.zoomInBtn) {
            this.zoomInBtn.addEventListener('click', () => this.handleZoom(25));
        }

        // Settings
        if (this.settingsBtn) {
            this.settingsBtn.addEventListener('click', () => {
                console.log('Timeline settings clicked');
                // Future: Open settings menu
            });
        }

        // Listen for Preview Player events (dispatched from window/document)
        window.addEventListener('preview-player-state-change', (e) => {
            this.updatePlayState(e.detail.isPlaying);
        });

        window.addEventListener('preview-player-time-update', (e) => {
            this.updateTime(e.detail.currentTime);
        });
    }

    togglePlay() {
        // Dispatch event to notify PreviewPlayer
        const event = new CustomEvent('timeline-play-toggle');
        window.dispatchEvent(event);
    }

    updatePlayState(isPlaying) {
        this.isPlaying = isPlaying;
        if (this.playBtn) {
            const icon = this.playBtn.querySelector('.icon');
            if (icon) {
                icon.textContent = isPlaying ? '⏸️' : '▶️';
            }
        }
    }

    updateTime(time) {
        if (this.currentTimeDisplay) {
            this.currentTimeDisplay.textContent = this.formatTime(time);
        }
    }

    updateDuration(duration) {
        if (this.totalDurationDisplay) {
            this.totalDurationDisplay.textContent = this.formatTime(duration);
        }
    }

    handleZoom(change) {
        let newZoom = this.zoomLevel + change;
        // Clamp between 25% and 400%
        newZoom = Math.max(25, Math.min(400, newZoom));

        if (newZoom !== this.zoomLevel) {
            this.zoomLevel = newZoom;
            if (this.zoomLevelDisplay) {
                this.zoomLevelDisplay.textContent = `${this.zoomLevel}%`;
            }
            console.log(`Zoom level: ${this.zoomLevel}%`);

            // Dispatch zoom event for future use
            const event = new CustomEvent('timeline-zoom-change', {
                detail: { zoomLevel: this.zoomLevel }
            });
            window.dispatchEvent(event);
        }
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.timelineManager = new TimelineManager();
});

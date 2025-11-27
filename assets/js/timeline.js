/**
 * TimelineManager
 * Handles timeline header controls, ruler, tracks, and synchronization.
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
        this.trackContainer = document.getElementById('timeline-tracks');

        // State
        this.zoomLevel = 100;
        this.isPlaying = false;
        this.duration = 60; // Default duration
        this.pixelsPerSecond = 50; // Default at 100% zoom
        this.tracks = []; // Store track data

        this.init();
    }

    init() {
        this.attachEventListeners();
        this.createTrackContainer();
        this.updateRuler();
        this.syncHorizontalScroll();
        console.log('TimelineManager initialized');
    }

    createTrackContainer() {
        if (!this.trackContainer) return;

        // Clear existing
        this.trackContainer.innerHTML = '';
        this.tracks = [];

        // Add default tracks
        this.addTrack('video', 'Video Track 1');
        this.addTrack('video', 'Video Track 2');
        this.addTrack('audio', 'Audio Track 1');
    }

    addTrack(type, name) {
        const trackId = `track-${this.tracks.length + 1}`;
        const trackEl = document.createElement('div');
        trackEl.className = `timeline-track timeline-track--${type}`;
        trackEl.dataset.trackId = trackId;
        trackEl.dataset.trackType = type;
        trackEl.dataset.empty = 'true';
        trackEl.dataset.emptyText = 'Drag media here';

        // Track Header
        const header = document.createElement('div');
        header.className = 'timeline-track__header';

        const info = document.createElement('div');
        info.className = 'timeline-track__info';

        const icon = document.createElement('span');
        icon.className = 'timeline-track__icon';
        icon.textContent = type === 'video' ? '🎬' : '🎵';

        const nameEl = document.createElement('span');
        nameEl.className = 'timeline-track__name';
        nameEl.textContent = name;
        nameEl.title = name;

        info.appendChild(icon);
        info.appendChild(nameEl);

        const controls = document.createElement('div');
        controls.className = 'timeline-track__controls';

        // Placeholder controls
        const muteBtn = document.createElement('button');
        muteBtn.className = 'track-btn';
        muteBtn.innerHTML = '🔇';
        muteBtn.title = 'Mute';

        const soloBtn = document.createElement('button');
        soloBtn.className = 'track-btn';
        soloBtn.innerHTML = 'S';
        soloBtn.title = 'Solo';

        const lockBtn = document.createElement('button');
        lockBtn.className = 'track-btn';
        lockBtn.innerHTML = '🔒';
        lockBtn.title = 'Lock';

        controls.appendChild(muteBtn);
        controls.appendChild(soloBtn);
        controls.appendChild(lockBtn);

        header.appendChild(info);
        header.appendChild(controls);

        // Track Content
        const content = document.createElement('div');
        content.className = 'timeline-track__content';

        trackEl.appendChild(header);
        trackEl.appendChild(content);

        this.trackContainer.appendChild(trackEl);
        this.tracks.push({ id: trackId, type, name, element: trackEl });

        // Update width of new track content
        this.updateTrackWidth();
    }

    updateRuler() {
        if (this.ruler) {
            const width = this.calculateWidth();

            // Create a content div if it doesn't exist to force scroll width
            let content = this.ruler.querySelector('.timeline__ruler-content');
            if (!content) {
                content = document.createElement('div');
                content.className = 'timeline__ruler-content';
                content.style.height = '100%';
                this.ruler.appendChild(content);
            }
            content.style.width = `${width}px`;

            this.generateTimeMarkers(content);
            this.updateTrackWidth();
        }
    }

    calculateWidth() {
        return this.duration * this.pixelsPerSecond * (this.zoomLevel / 100);
    }

    updateTrackWidth() {
        const width = this.calculateWidth();
        const trackContents = document.querySelectorAll('.timeline-track__content');
        trackContents.forEach(content => {
            content.style.width = `${width}px`;
        });
    }

    generateTimeMarkers(container) {
        // Clear existing markers
        container.innerHTML = '';

        const zoomRatio = this.zoomLevel / 100;
        const pxPerSec = this.pixelsPerSecond * zoomRatio;

        // Determine interval based on zoom (Phase 63 requirement)
        let majorInterval = 5; // seconds
        let minorInterval = 1; // seconds

        // Adjust intervals for zoom levels
        if (pxPerSec < 20) {
            majorInterval = 10;
            minorInterval = 5;
        } else if (pxPerSec < 10) {
            majorInterval = 30;
            minorInterval = 10;
        }

        const fragment = document.createDocumentFragment();

        for (let t = 0; t <= this.duration; t += minorInterval) {
            const position = t * pxPerSec;
            const isMajor = t % majorInterval === 0;

            if (isMajor) {
                // Major Tick & Label
                const marker = document.createElement('div');
                marker.className = 'timeline__marker';
                marker.style.left = `${position}px`;

                const label = document.createElement('span');
                label.className = 'timeline__label';
                label.textContent = this.formatTimeLabel(t);
                marker.appendChild(label);

                const tick = document.createElement('div');
                tick.className = 'timeline__tick timeline__tick--major';
                marker.appendChild(tick);

                fragment.appendChild(marker);
            } else {
                // Minor Tick
                const marker = document.createElement('div');
                marker.className = 'timeline__marker';
                marker.style.left = `${position}px`;

                const tick = document.createElement('div');
                tick.className = 'timeline__tick timeline__tick--minor';
                marker.appendChild(tick);

                fragment.appendChild(marker);
            }
        }

        container.appendChild(fragment);
    }

    syncHorizontalScroll() {
        if (!this.ruler || !this.trackContainer) return;

        let isSyncingRuler = false;
        let isSyncingTracks = false;

        // Ruler scroll -> Track scroll
        this.ruler.addEventListener('scroll', () => {
            if (!isSyncingRuler) {
                isSyncingTracks = true;
                this.trackContainer.scrollLeft = this.ruler.scrollLeft;
            }
            isSyncingRuler = false;
        });

        // Track scroll -> Ruler scroll
        this.trackContainer.addEventListener('scroll', () => {
            if (!isSyncingTracks) {
                isSyncingRuler = true;
                this.ruler.scrollLeft = this.trackContainer.scrollLeft;
            }
            isSyncingTracks = false;
        });
    }

    formatTimeLabel(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
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

            this.updateRuler();

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

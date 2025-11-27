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
        this.createPlayhead();
        this.attachScrubHandlers();
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

    formatTime(seconds) {
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

        // Project duration change
        window.addEventListener('project-duration-change', (e) => {
            this.duration = e.detail.duration;
            this.updateRuler();
        });

        this.attachDropHandlers();

        // Wheel Zoom
        if (this.trackContainer) {
            this.trackContainer.addEventListener('wheel', (e) => this.handleWheelZoom(e), { passive: false });
        }
        if (this.ruler) {
            this.ruler.addEventListener('wheel', (e) => this.handleWheelZoom(e), { passive: false });
        }

        // Clip Selection (Delegation)
        if (this.trackContainer) {
            this.trackContainer.addEventListener('click', (e) => this.handleClipSelection(e));
        }
    }

    handleClipSelection(e) {
        // If dragging, ignore click
        if (this.isDragging) return;

        const clipEl = e.target.closest('.timeline-clip');

        if (clipEl) {
            // Clicked on a clip
            const clipId = clipEl.dataset.clipId;
            const isMultiSelect = e.ctrlKey || e.metaKey;
            this.selectClip(clipId, isMultiSelect);
        } else {
            // Clicked on empty space
            this.deselectAll();
        }
    }

    selectClip(clipId, isMultiSelect = false) {
        // Initialize Set if needed (or ensure it's a Set)
        if (!this.selectedClipIds) {
            this.selectedClipIds = new Set();
        }

        if (isMultiSelect) {
            // Toggle
            if (this.selectedClipIds.has(clipId)) {
                this.selectedClipIds.delete(clipId);
                const clipEl = document.querySelector(`.timeline-clip[data-clip-id="${clipId}"]`);
                if (clipEl) clipEl.classList.remove('selected');
            } else {
                this.selectedClipIds.add(clipId);
                const clipEl = document.querySelector(`.timeline-clip[data-clip-id="${clipId}"]`);
                if (clipEl) clipEl.classList.add('selected');
            }
        } else {
            // Single select
            this.deselectAll();
            this.selectedClipIds.add(clipId);
            const clipEl = document.querySelector(`.timeline-clip[data-clip-id="${clipId}"]`);
            if (clipEl) clipEl.classList.add('selected');
        }

        // Dispatch event
        const selectedIds = Array.from(this.selectedClipIds);
        const event = new CustomEvent('timeline-selection-changed', {
            detail: { selectedClipIds: selectedIds }
        });
        window.dispatchEvent(event);
    }

    deselectAll() {
        if (this.selectedClipIds) {
            this.selectedClipIds.forEach(id => {
                const el = document.querySelector(`.timeline-clip[data-clip-id="${id}"]`);
                if (el) el.classList.remove('selected');
            });
            this.selectedClipIds.clear();
        } else {
            this.selectedClipIds = new Set();
        }

        const event = new CustomEvent('timeline-selection-changed', {
            detail: { selectedClipIds: [] }
        });
        window.dispatchEvent(event);
    }

    attachDropHandlers() {
        if (!this.trackContainer) return;

        // Delegate drag events to tracks
        this.trackContainer.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.trackContainer.addEventListener('drop', (e) => this.handleDrop(e));
        this.trackContainer.addEventListener('dragleave', (e) => this.handleDragLeave(e));
    }

    handleDragOver(e) {
        e.preventDefault(); // Allow drop

        const trackContent = e.target.closest('.timeline-track__content');
        if (!trackContent) return;

        const track = trackContent.closest('.timeline-track');
        if (!track) return;

        // Validate media type (assuming we can get type from drag data or state)
        // Note: DataTransfer data is not available in dragover for security, 
        // so we might need a global state or just allow visual feedback for now.

        track.classList.add('drag-over');

        // Calculate and show drop indicator
        const dropTime = this.calculateDropTime(e, trackContent);
        this.showDropIndicator(trackContent, dropTime);
    }

    handleDragLeave(e) {
        const trackContent = e.target.closest('.timeline-track__content');
        if (!trackContent) return;

        const track = trackContent.closest('.timeline-track');
        if (track) {
            track.classList.remove('drag-over');
            track.classList.remove('drag-error');
        }
        this.hideDropIndicator(trackContent);
    }

    async handleDrop(e) {
        e.preventDefault();

        const trackContent = e.target.closest('.timeline-track__content');
        if (!trackContent) return;

        const track = trackContent.closest('.timeline-track');
        if (!track) return;

        // Cleanup visual feedback
        track.classList.remove('drag-over');
        this.hideDropIndicator(trackContent);

        // Get drag data
        const mediaId = e.dataTransfer.getData('text/plain');
        if (!mediaId) return;

        // Retrieve media details (mocking retrieval or using a helper if available)
        // In a real app, we'd fetch from IndexedDB. For now, we'll assume success 
        // or use a global helper if one exists. 
        // Since we don't have direct DB access here synchronously, we'll simulate or use what we have.
        // Ideally, we should have a `MediaService.getMediaById(mediaId)`.

        // For this phase, we'll assume we can get basic info or just create the clip
        // with the ID and some defaults, relying on the ClipManager to handle details later
        // or fetching it here if possible.

        // Let's try to find the media element in the library to get duration/type if possible,
        // or fetch from DB.

        try {
            // We'll use the ID to create the clip. 
            // We need duration and type. 
            // For now, we'll fetch from DB using the helper if available globally
            // or just use placeholder values if we can't access DB easily here.

            // Note: In Phase 42 we created IndexedDBHelper. 
            // Let's assume window.indexedDBHelper is available or we import it.
            // It is imported in editor.html.

            let media = null;
            if (window.indexedDBHelper) {
                media = await window.indexedDBHelper.getMedia(mediaId);
            }

            if (!media) {
                console.error('Media not found for ID:', mediaId);
                return;
            }

            // Validate type
            const trackType = track.dataset.trackType;
            let isValid = false;
            if (trackType === 'video' && (media.type.startsWith('video') || media.type.startsWith('image'))) {
                isValid = true;
            } else if (trackType === 'audio' && media.type.startsWith('audio')) {
                isValid = true;
            }

            if (!isValid) {
                console.warn(`Invalid media type ${media.type} for track ${trackType}`);
                // Show error feedback (flash red maybe)
                return;
            }

            const dropTime = this.calculateDropTime(e, trackContent);
            const trackId = track.dataset.trackId;

            // Create clip
            if (window.clipManager) {
                const clip = window.clipManager.createClip(
                    mediaId,
                    trackId,
                    dropTime,
                    media.duration || 5, // Default 5s for images
                    media.type.startsWith('video') ? 'video' : (media.type.startsWith('audio') ? 'audio' : 'image'),
                    media.name
                );
                window.clipManager.addClip(clip);

                // Remove empty state if present
                if (track.dataset.empty === 'true') {
                    track.dataset.empty = 'false';
                    // We don't remove the text via CSS, but we could update the attribute
                    // The CSS handles hiding it if we change the structure or attribute
                }
            }

        } catch (err) {
            console.error('Error handling drop:', err);
        }
    }

    calculateDropTime(e, trackContent) {
        const rect = trackContent.getBoundingClientRect();
        const offsetX = e.clientX - rect.left + this.trackContainer.scrollLeft;

        // Convert pixels to seconds
        const zoomRatio = this.zoomLevel / 100;
        const pxPerSec = this.pixelsPerSecond * zoomRatio;

        let time = offsetX / pxPerSec;

        // Clamp to 0
        time = Math.max(0, time);

        // Snap to grid (optional, simple rounding for now)
        // Round to nearest 0.1s
        time = Math.round(time * 10) / 10;

        return time;
    }

    showDropIndicator(trackContent, time) {
        let indicator = trackContent.querySelector('.drop-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'drop-indicator';
            trackContent.appendChild(indicator);
        }

        const zoomRatio = this.zoomLevel / 100;
        const pxPerSec = this.pixelsPerSecond * zoomRatio;
        const position = time * pxPerSec;

        indicator.style.left = `${position}px`;
    }

    hideDropIndicator(trackContent) {
        const indicator = trackContent.querySelector('.drop-indicator');
        if (indicator) {
            indicator.remove();
        }
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
        this.updatePlayheadPosition(time);
    }

    updateDuration(duration) {
        if (this.totalDurationDisplay) {
            this.totalDurationDisplay.textContent = this.formatTime(duration);
        }
    }

    handleZoom(change) {
        let newZoom = this.zoomLevel + change;
        // Clamp between 10% and 400%
        newZoom = Math.max(10, Math.min(400, newZoom));

        if (newZoom !== this.zoomLevel) {
            this.setZoom(newZoom);
        }
    }

    handleWheelZoom(e) {
        if (!e.ctrlKey) return;
        e.preventDefault();

        const delta = -Math.sign(e.deltaY) * 10; // 10% steps
        this.handleZoom(delta);
    }

    setZoom(level) {
        this.zoomLevel = level;
        if (this.zoomLevelDisplay) {
            this.zoomLevelDisplay.textContent = `${this.zoomLevel}%`;
        }
        console.log(`Zoom level: ${this.zoomLevel}%`);

        // Store previous scroll center time to restore focus?
        // For now, simple re-render.

        this.updateRuler();
        this.updatePlayheadPosition(this.currentTime || 0);

        // Refresh clips
        if (window.clipRenderer) {
            window.clipRenderer.refresh();
        }

        // Dispatch zoom event
        const event = new CustomEvent('timeline-zoom-change', {
            detail: { zoomLevel: this.zoomLevel }
        });
        window.dispatchEvent(event);
    }

    createPlayhead() {
        // Create Head in Ruler
        if (this.ruler) {
            let rulerContent = this.ruler.querySelector('.timeline__ruler-content');
            if (rulerContent) {
                this.playheadHead = document.createElement('div');
                this.playheadHead.className = 'timeline-playhead__head';
                rulerContent.appendChild(this.playheadHead);
            }
        }

        // Create Line in Track Container
        if (this.trackContainer) {
            this.playheadLine = document.createElement('div');
            this.playheadLine.className = 'timeline-playhead__line';
            this.trackContainer.appendChild(this.playheadLine);
        }
    }

    updatePlayheadPosition(time) {
        this.currentTime = time;
        const zoomRatio = this.zoomLevel / 100;
        const pxPerSec = this.pixelsPerSecond * zoomRatio;
        const position = time * pxPerSec;

        if (this.playheadHead) {
            this.playheadHead.style.transform = `translateX(${position}px) translateX(-50%)`;
        }

        if (this.playheadLine) {
            this.playheadLine.style.transform = `translateX(${position}px)`;
            // Ensure line height covers all tracks
            this.playheadLine.style.height = `${this.trackContainer.scrollHeight}px`;
        }
    }

    attachScrubHandlers() {
        // Click to Seek (Ruler)
        if (this.ruler) {
            this.ruler.addEventListener('mousedown', (e) => this.onRulerClick(e));
        }

        // Drag to Scrub (Playhead)
        if (this.playheadHead) {
            this.playheadHead.addEventListener('mousedown', (e) => this.onPlayheadDragStart(e));
        }

        // Keyboard Navigation
        document.addEventListener('keydown', (e) => this.handleKeyboardNav(e));
    }

    onRulerClick(e) {
        // Ignore if clicking the playhead handle (let drag handler handle it)
        if (e.target.closest('.timeline-playhead__head')) return;

        const rulerContent = this.ruler.querySelector('.timeline__ruler-content');
        if (!rulerContent) return;

        const rect = rulerContent.getBoundingClientRect();
        const offsetX = e.clientX - rect.left; // Scroll is handled by rect if content is scrolled? 
        // Actually, rulerContent is the scrollable inner part. 
        // If we click on ruler container, we need to account for scroll.
        // If we click on rulerContent, offsetX is relative to it? No, clientX is viewport.
        // Let's use the event target or container logic.

        // Better: Calculate time from click position relative to the content start
        // The ruler container scrolls. The content is inside.
        // If we click on the ruler container (visible area):
        // time = (clientX - rulerRect.left + scrollLeft) / pxPerSec

        const rulerRect = this.ruler.getBoundingClientRect();
        const clickX = e.clientX - rulerRect.left + this.ruler.scrollLeft;

        const zoomRatio = this.zoomLevel / 100;
        const pxPerSec = this.pixelsPerSecond * zoomRatio;

        let time = clickX / pxPerSec;
        time = Math.max(0, Math.min(time, this.duration));

        if (window.playbackManager) {
            window.playbackManager.seek(time);
        }
    }

    onPlayheadDragStart(e) {
        e.preventDefault();
        e.stopPropagation();

        this.isDragging = true;

        // Pause if playing
        if (window.playbackManager && window.playbackManager.isPlaying) {
            this.wasPlaying = true;
            window.playbackManager.pause();
        } else {
            this.wasPlaying = false;
        }

        // Add global listeners
        this.dragMoveHandler = (e) => this.onPlayheadDragMove(e);
        this.dragEndHandler = (e) => this.onPlayheadDragEnd(e);

        document.addEventListener('mousemove', this.dragMoveHandler);
        document.addEventListener('mouseup', this.dragEndHandler);

        // Add active class
        this.playheadHead.classList.add('active');
    }

    onPlayheadDragMove(e) {
        if (!this.isDragging) return;

        const rulerRect = this.ruler.getBoundingClientRect();
        const clickX = e.clientX - rulerRect.left + this.ruler.scrollLeft;

        const zoomRatio = this.zoomLevel / 100;
        const pxPerSec = this.pixelsPerSecond * zoomRatio;

        let time = clickX / pxPerSec;
        time = Math.max(0, Math.min(time, this.duration));

        // Update visually immediately
        this.updatePlayheadPosition(time);

        // Seek player (could be throttled, but for now direct)
        if (window.playbackManager) {
            window.playbackManager.seek(time);
        }

        // Auto-scroll if near edges
        // (Optional enhancement for later)
    }

    onPlayheadDragEnd(e) {
        if (!this.isDragging) return;

        this.isDragging = false;
        this.playheadHead.classList.remove('active');

        document.removeEventListener('mousemove', this.dragMoveHandler);
        document.removeEventListener('mouseup', this.dragEndHandler);

        // Resume if was playing? Usually scrubbing leaves it paused, 
        // but user preference might vary. Let's leave it paused for precision.
        // if (this.wasPlaying && window.playbackManager) {
        //     window.playbackManager.play();
        // }
    }

    handleKeyboardNav(e) {
        // Only if not editing text
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        if (!window.playbackManager) return;

        const FRAME_TIME = 1 / 30; // Approx 30fps
        const JUMP_TIME = 1; // 1 second

        let newTime = this.currentTime || 0;

        switch (e.key) {
            case 'ArrowLeft':
                if (e.shiftKey) newTime -= JUMP_TIME;
                else newTime -= FRAME_TIME;
                e.preventDefault();
                break;
            case 'ArrowRight':
                if (e.shiftKey) newTime += JUMP_TIME;
                else newTime += FRAME_TIME;
                e.preventDefault();
                break;
            case 'Home':
                newTime = 0;
                e.preventDefault();
                break;
            case 'End':
                newTime = this.duration;
                e.preventDefault();
                break;
            case ' ': // Spacebar to toggle play
                e.preventDefault();
                window.playbackManager.togglePlay();
                return; // togglePlay handles its own seek/sync
            default:
                return;
        }

        newTime = Math.max(0, Math.min(newTime, this.duration));
        window.playbackManager.seek(newTime);
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

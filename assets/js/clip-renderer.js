/**
 * ClipRenderer
 * Handles visual rendering of clips on the timeline.
 */
class ClipRenderer {
    constructor() {
        this.minClipWidth = 20; // px
        this.setupThumbnailListener();
    }

    setupThumbnailListener() {
        window.addEventListener('thumbnail-ready', (e) => {
            const { mediaId, thumbnail } = e.detail;
            this.updateClipThumbnails(mediaId, thumbnail);
        });
    }

    updateClipThumbnails(mediaId, thumbnail) {
        const clips = document.querySelectorAll(`.timeline-clip[data-media-id="${mediaId}"]`);
        clips.forEach(el => {
            el.style.backgroundImage = `url(${thumbnail})`;
            el.classList.add('timeline-clip--has-thumbnail');
        });
    }

    /**
     * Render a single clip
     * @param {Object} clip - Clip data object
     */
    renderClip(clip) {
        const track = document.querySelector(`.timeline-track[data-track-id="${clip.trackId}"]`);
        if (!track) {
            console.warn(`Track not found for clip: ${clip.id}`);
            return;
        }

        const trackContent = track.querySelector('.timeline-track__content');
        if (!trackContent) return;

        // Create element
        const el = document.createElement('div');
        el.className = `timeline-clip timeline-clip--${clip.type}`;
        el.dataset.clipId = clip.id;
        el.dataset.mediaId = clip.mediaId;
        el.dataset.trackId = clip.trackId;
        el.dataset.startTime = clip.startTime;
        el.dataset.duration = clip.duration;

        // Label
        const label = document.createElement('span');
        label.className = 'timeline-clip__label';
        label.textContent = clip.name;
        el.appendChild(label);

        // Position and Size
        this.updateElementPosition(el, clip);

        // Handles (Phase 75)
        const handleLeft = document.createElement('div');
        handleLeft.className = 'clip-handle handle-left';
        handleLeft.dataset.action = 'trim-left';
        el.appendChild(handleLeft);

        const handleRight = document.createElement('div');
        handleRight.className = 'clip-handle handle-right';
        handleRight.dataset.action = 'trim-right';
        el.appendChild(handleRight);

        // Apply thumbnail if available
        if (clip.type === 'video' && window.thumbnailExtractor) {
            const thumbnail = window.thumbnailExtractor.getThumbnail(clip.mediaId);
            if (thumbnail) {
                el.style.backgroundImage = `url(${thumbnail})`;
                el.classList.add('timeline-clip--has-thumbnail');
            }
        }

        // Re-query track content safely to avoid any stale references or nesting issues
        const targetTrackContent = document.querySelector(`.timeline-track[data-track-id="${clip.trackId}"] .timeline-track__content`);

        if (targetTrackContent) {
            targetTrackContent.appendChild(el);
            console.log(`Rendered clip ${clip.id} to track ${clip.trackId}`);
        } else {
            console.error(`Track content not found for track ${clip.trackId} when rendering clip ${clip.id}`);
        }
    }

    /**
     * Render all clips provided
     * @param {Array} clips 
     */
    renderAllClips(clips) {
        this.clearClips();
        clips.forEach(clip => this.renderClip(clip));
    }

    /**
     * Clear all clips from the DOM
     */
    clearClips() {
        const clips = document.querySelectorAll('.timeline-clip');
        clips.forEach(el => el.remove());
    }

    /**
     * Update position and width of a clip element
     * @param {HTMLElement} el 
     * @param {Object} clip 
     */
    updateElementPosition(el, clip) {
        const timelineManager = window.timelineManager;
        if (!timelineManager) return;

        const zoomRatio = timelineManager.zoomLevel / 100;
        const pxPerSec = timelineManager.pixelsPerSecond * zoomRatio;

        const left = clip.startTime * pxPerSec;
        let width = clip.duration * pxPerSec;

        // Enforce minimum width
        if (width < this.minClipWidth) {
            width = this.minClipWidth;
            el.classList.add('timeline-clip--short');
        } else {
            el.classList.remove('timeline-clip--short');
        }

        el.style.left = `${left}px`;
        el.style.width = `${width}px`;
    }

    /**
     * Re-render all clips (e.g. on zoom)
     */
    refresh() {
        if (window.clipManager) {
            const clips = window.clipManager.getClips();
            // We can either clear and re-render, or just update positions.
            // Updating positions is more efficient if elements exist.

            clips.forEach(clip => {
                const el = document.querySelector(`.timeline-clip[data-clip-id="${clip.id}"]`);
                if (el) {
                    this.updateElementPosition(el, clip);
                } else {
                    this.renderClip(clip);
                }
            });
        }
    }
}

// Initialize
window.clipRenderer = new ClipRenderer();
export default window.clipRenderer;

/**
 * ClipManager
 * Manages clip data structures and project state.
 */
class ClipManager {
    constructor() {
        this.clips = [];
        this.projectDuration = 0;
    }

    /**
     * Create a new clip object
     * @param {string} mediaId - ID of the source media
     * @param {string} trackId - ID of the target track
     * @param {number} startTime - Start time on timeline in seconds
     * @param {number} duration - Duration of the clip in seconds
     * @param {string} type - 'video' or 'audio'
     * @param {string} name - Name of the clip
     */
    createClip(mediaId, trackId, startTime, duration, type, name) {
        const clip = {
            id: crypto.randomUUID(),
            mediaId: mediaId,
            trackId: trackId,
            startTime: startTime,
            duration: duration,
            trimStart: 0,
            trimEnd: duration,
            volume: 1.0,
            muted: false,
            locked: false,
            visible: true,
            type: type,
            name: name,
            effects: []
        };
        return clip;
    }

    /**
     * Add a clip to the project
     * @param {Object} clip - The clip object to add
     */
    addClip(clip) {
        this.clips.push(clip);
        this.updateProjectDuration();
        console.log('Clip added:', clip);

        // Render visual clip
        if (window.clipRenderer) {
            window.clipRenderer.renderClip(clip);
        }

        // Dispatch event for UI updates
        const event = new CustomEvent('clip-added', { detail: { clip } });
        window.dispatchEvent(event);
    }

    /**
     * Get all clips
     * @returns {Array} Array of clip objects
     */
    getClips() {
        return this.clips;
    }

    /**
     * Get clips for a specific track
     * @param {string} trackId 
     */
    getClipsByTrack(trackId) {
        return this.clips.filter(clip => clip.trackId === trackId);
    }

    /**
     * Get a specific clip by ID
     * @param {string} clipId 
     */
    getClip(clipId) {
        return this.clips.find(clip => clip.id === clipId);
    }

    /**
     * Update clip properties
     * @param {string} clipId 
     * @param {Object} updates 
     */
    updateClip(clipId, updates) {
        const clip = this.getClip(clipId);
        if (!clip) return;

        Object.assign(clip, updates);

        // If timing changed, update project duration
        if (updates.startTime !== undefined || updates.duration !== undefined) {
            this.updateProjectDuration();
        }

        // Dispatch update event
        const event = new CustomEvent('clip-updated', {
            detail: { clipId, updates, clip }
        });
        window.dispatchEvent(event);
    }

    /**
     * Update project duration based on clips
     */
    updateProjectDuration() {
        let maxEndTime = 0;
        this.clips.forEach(clip => {
            const endTime = clip.startTime + clip.duration;
            if (endTime > maxEndTime) {
                maxEndTime = endTime;
            }
        });

        // Ensure minimum duration (e.g., 60s)
        this.projectDuration = Math.max(60, maxEndTime);

        // Notify timeline to update ruler
        const event = new CustomEvent('project-duration-change', {
            detail: { duration: this.projectDuration }
        });
        window.dispatchEvent(event);
    }
}

// Initialize
window.clipManager = new ClipManager();
export default window.clipManager;

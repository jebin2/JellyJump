/**
 * Preview Player Module
 * Phase 49: MediaBunny Player Integration
 * 
 * Manages the CorePlayer instance in the editor preview panel
 */

import { CorePlayer } from './core/Player.js';

class PreviewPlayerManager {
    constructor() {
        this.player = null;
        this.currentVideoId = null;
        this.currentBlobUrl = null;
        this.templatesLoaded = false;
    }

    /**
     * Load player templates
     * @private
     */
    async _loadTemplates() {
        if (this.templatesLoaded) return;

        try {
            // Load player templates
            const playerResponse = await fetch('assets/templates/player-templates.html');
            const playerHTML = await playerResponse.text();

            // Load screenshot templates
            const screenshotResponse = await fetch('assets/templates/screenshot-templates.html');
            const screenshotHTML = await screenshotResponse.text();

            // Create a temporary container and insert templates
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = playerHTML + screenshotHTML;
            document.body.append(...tempDiv.children);

            this.templatesLoaded = true;
            console.log('Player and screenshot templates loaded');
        } catch (error) {
            console.error('Failed to load templates:', error);
            throw error;
        }
    }

    /**
     * Initialize the CorePlayer in the preview container
     */
    async init() {
        // Load templates first
        await this._loadTemplates();

        // Create CorePlayer instance with editor mode
        this.player = new CorePlayer('preview-player-container', {
            mode: 'editor', // Editor mode (not player mode)
            controls: true, // Use built-in controls
            autoplay: false,
            loop: false
        });

        // Create metadata overlay
        this.metadataOverlay = document.createElement('div');
        this.metadataOverlay.className = 'preview-metadata-overlay';
        this.metadataOverlay.style.display = 'none';
        document.getElementById('preview-player-container').appendChild(this.metadataOverlay);

        // Setup sync with timeline
        this._setupTimelineSync();

        console.log('CorePlayer initialized in preview panel');
    }

    /**
     * Setup synchronization with Timeline
     * @private
     */
    _setupTimelineSync() {
        if (!this.player) return;

        // Listen for timeline play toggle
        window.addEventListener('timeline-play-toggle', () => {
            if (this.player.videoElement.paused) {
                this.player.play();
            } else {
                this.player.pause();
            }
        });

        // Dispatch state changes to timeline
        this.player.videoElement.addEventListener('play', () => {
            window.dispatchEvent(new CustomEvent('preview-player-state-change', {
                detail: { isPlaying: true }
            }));
        });

        this.player.videoElement.addEventListener('pause', () => {
            window.dispatchEvent(new CustomEvent('preview-player-state-change', {
                detail: { isPlaying: false }
            }));
        });

        this.player.videoElement.addEventListener('timeupdate', () => {
            window.dispatchEvent(new CustomEvent('preview-player-time-update', {
                detail: { currentTime: this.player.videoElement.currentTime }
            }));
        });

        this.player.videoElement.addEventListener('loadedmetadata', () => {
            // Update duration on timeline if needed (Phase 61 requirement)
            // For now, just logging or could dispatch duration
        });
    }

    /**
     * Load video from blob
     * @param {Blob} videoBlob - Video blob from IndexedDB
     * @param {string} videoId - Video ID for tracking
     * @param {string} videoName - Video filename
     */
    async loadVideo(videoBlob, videoId, videoName) {
        if (!this.player) {
            console.error('Player not initialized');
            return;
        }

        try {
            // Revoke previous blob URL to free memory
            if (this.currentBlobUrl) {
                URL.revokeObjectURL(this.currentBlobUrl);
            }

            // Create blob URL
            this.currentBlobUrl = URL.createObjectURL(videoBlob);

            // Load video into CorePlayer
            await this.player.load(this.currentBlobUrl);

            // Update metadata display
            this._updateMetadataDisplay();

            this.currentVideoId = videoId;
            console.log(`Loaded video: ${videoName}`);
        } catch (error) {
            console.error('Failed to load video:', error);
            throw error;
        }
    }

    /**
     * Update metadata display with resolution and FPS
     * @private
     */
    _updateMetadataDisplay() {
        if (!this.player || !this.metadataOverlay) return;

        const track = this.player.videoTrack;
        if (track) {
            const width = track.displayWidth || track.width || 0;
            const height = track.displayHeight || track.height || 0;
            const fps = Math.round(this.player.frameRate || 0);

            this.metadataOverlay.textContent = `${width}x${height} @ ${fps}fps`;
            this.metadataOverlay.style.display = 'block';
        } else {
            this.metadataOverlay.style.display = 'none';
        }
    }

    /**
     * Get CorePlayer instance
     * @returns {CorePlayer} - Player instance
     */
    getPlayer() {
        return this.player;
    }

    /**
     * Get current video ID
     * @returns {string|null} - Current video ID
     */
    getCurrentVideoId() {
        return this.currentVideoId;
    }
}

// Create singleton instance
export const previewPlayerManager = new PreviewPlayerManager();

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await previewPlayerManager.init();
    } catch (error) {
        console.error('Failed to initialize preview player:', error);
    }
});

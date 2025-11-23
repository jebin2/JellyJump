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
            const response = await fetch('assets/templates/player-templates.html');
            const templatesHTML = await response.text();
            
            // Create a temporary container and insert templates
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = templatesHTML;
            document.body.append(...tempDiv.children);
            
            this.templatesLoaded = true;
            console.log('Player templates loaded');
        } catch (error) {
            console.error('Failed to load player templates:', error);
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

        console.log('CorePlayer initialized in preview panel');
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
            await this.player.loadMedia(this.currentBlobUrl);
            
            this.currentVideoId = videoId;
            console.log(`Loaded video: ${videoName}`);
        } catch (error) {
            console.error('Failed to load video:', error);
            throw error;
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

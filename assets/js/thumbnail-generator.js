/**
 * Thumbnail Generator Module
 * Phase 46: Video Thumbnail Generation
 * 
 * Generates thumbnail images from video files using HTML5 video element
 */

export class ThumbnailGenerator {
    constructor() {
        this.thumbnailWidth = 200;
        this.thumbnailHeight = 150;
        this.thumbnailQuality = 0.75;
        this.seekTime = 0.1; // Seek to 0.1s to avoid black frames
    }

    /**
     * Generate thumbnail from video blob
     * @param {Blob} videoBlob - The video file blob
     * @returns {Promise<Blob>} - Thumbnail image blob
     */
    async generateThumbnail(videoBlob) {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.muted = true;

            let videoUrl = null;

            const cleanup = () => {
                if (videoUrl) {
                    URL.revokeObjectURL(videoUrl);
                }
                video.remove();
            };

            video.onerror = () => {
                cleanup();
                reject(new Error('Failed to load video for thumbnail generation'));
            };

            video.onseeked = async () => {
                try {
                    const thumbnailBlob = await this.captureFrame(video);
                    cleanup();
                    resolve(thumbnailBlob);
                } catch (error) {
                    cleanup();
                    reject(error);
                }
            };

            video.onloadedmetadata = () => {
                // Seek to specified time (avoid potential black frames at start)
                video.currentTime = this.seekTime;
            };

            videoUrl = URL.createObjectURL(videoBlob);
            video.src = videoUrl;
        });
    }

    /**
     * Capture current video frame to canvas and export as blob
     * @param {HTMLVideoElement} video - Video element
     * @returns {Promise<Blob>} - Thumbnail image blob
     */
    captureFrame(video) {
        return new Promise((resolve, reject) => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = this.thumbnailWidth;
                canvas.height = this.thumbnailHeight;

                const ctx = canvas.getContext('2d');

                // Calculate scaling to maintain aspect ratio (cover mode)
                const videoAspect = video.videoWidth / video.videoHeight;
                const canvasAspect = this.thumbnailWidth / this.thumbnailHeight;

                let sourceX = 0;
                let sourceY = 0;
                let sourceWidth = video.videoWidth;
                let sourceHeight = video.videoHeight;

                if (videoAspect > canvasAspect) {
                    // Video is wider - crop sides
                    sourceWidth = video.videoHeight * canvasAspect;
                    sourceX = (video.videoWidth - sourceWidth) / 2;
                } else {
                    // Video is taller - crop top/bottom
                    sourceHeight = video.videoWidth / canvasAspect;
                    sourceY = (video.videoHeight - sourceHeight) / 2;
                }

                // Draw the cropped portion
                ctx.drawImage(
                    video,
                    sourceX, sourceY, sourceWidth, sourceHeight,
                    0, 0, this.thumbnailWidth, this.thumbnailHeight
                );

                // Export as JPEG blob
                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error('Failed to export canvas to blob'));
                        }
                    },
                    'image/jpeg',
                    this.thumbnailQuality
                );
            } catch (error) {
                reject(error);
            }
        });
    }
}

// Create singleton instance
export const thumbnailGenerator = new ThumbnailGenerator();

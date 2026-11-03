/**
 * Stream Detection Utility
 * Identifies stream types from URLs for IPTV/HLS support
 */
export class StreamDetector {
    // Stream type constants
    static TYPE_FILE = 'file';
    static TYPE_HLS = 'hls';
    static TYPE_M3U = 'm3u';

    /**
     * Detect stream type from URL
     * @param {string} url
     * @returns {string} Stream type constant
     */
    static detect(url) {
        if (!url) return this.TYPE_FILE;

        const lowerUrl = url.toLowerCase();

        // JellyJump's own share links serve whole files from /api/stream/<id>,
        // which the '/stream/' pattern below would otherwise claim as HLS. That
        // misread every file played from a shared library: the frame rate was
        // forced to 30 where the file was 23.976, the frame-rate probe and the
        // decodability check were both skipped, and the item started out marked
        // live before being corrected.
        if (/\/api\/stream\/[a-f0-9]{16}/.test(lowerUrl)) return this.TYPE_FILE;

        // HLS manifest (.m3u8 or common HLS path patterns)
        if (lowerUrl.includes('.m3u8') ||
            lowerUrl.includes('/hls/') ||
            lowerUrl.includes('/live/') ||
            lowerUrl.includes('playlist.m3u8') ||
            lowerUrl.includes('/manifest/') ||
            lowerUrl.includes('/stream/') ||
            lowerUrl.includes('playouts') ||      // Common in Amagi/streaming CDNs
            lowerUrl.includes('.now.') ||         // now.amagi.tv pattern
            lowerUrl.includes('/master.') ||
            lowerUrl.includes('/index.') && lowerUrl.includes('m3u')) {
            return this.TYPE_HLS;
        }

        // M3U playlist (IPTV channel list)
        if (lowerUrl.endsWith('.m3u')) {
            return this.TYPE_M3U;
        }

        return this.TYPE_FILE;
    }

    /**
     * Check if URL is a live stream
     * @param {string} url
     * @returns {boolean}
     */
    static isStream(url) {
        const type = this.detect(url);
        return type === this.TYPE_HLS;
    }

    /**
     * Check if URL is an M3U playlist
     * @param {string} url
     * @returns {boolean}
     */
    static isPlaylist(url) {
        return this.detect(url) === this.TYPE_M3U;
    }

    /**
     * Check if HLS is supported in current browser
     * @returns {boolean}
     */
    static isHLSSupported() {
        // Safari supports HLS natively
        const video = document.createElement('video');
        if (video.canPlayType('application/vnd.apple.mpegurl')) {
            return true;
        }
        // Other browsers need MSE for HLS
        return 'MediaSource' in window;
    }

    /**
     * Check if native HLS is supported (Safari)
     * @returns {boolean}
     */
    static isNativeHLSSupported() {
        const video = document.createElement('video');
        return !!video.canPlayType('application/vnd.apple.mpegurl');
    }
}

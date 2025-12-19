/**
 * HLS Player Wrapper
 * Handles HLS/IPTV stream playback using hls.js
 */
import Hls from '../lib/hls.js';

export class HLSPlayer {
    constructor(videoElement) {
        this.video = videoElement;
        this.hls = null;
        this.isLive = false;
        this.currentUrl = null;
        this.currentLevel = -1; // Auto

        // Event callbacks
        this.onError = null;
        this.onLevelLoaded = null;
        this.onManifestParsed = null;
        this.onQualityChange = null;
    }

    /**
     * Check if HLS.js is supported
     * @returns {boolean}
     */
    static isSupported() {
        return Hls.isSupported();
    }

    /**
     * Load an HLS stream
     * @param {string} url - M3U8 manifest URL
     * @returns {Promise<void>}
     */
    async load(url) {
        this.destroy(); // Clean up previous instance
        this.currentUrl = url;

        // Check native HLS support (Safari)
        if (this.video.canPlayType('application/vnd.apple.mpegurl')) {
            console.log('[HLS] Using native HLS support');
            this.video.src = url;
            return this._waitForMetadata();
        }

        // Use hls.js for other browsers
        if (!Hls.isSupported()) {
            throw new Error('HLS is not supported in this browser');
        }

        console.log('[HLS] Using hls.js');
        this.hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90,
            maxBufferLength: 30,
            maxMaxBufferLength: 60,
            startLevel: -1, // Auto
        });

        return new Promise((resolve, reject) => {
            this.hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
                console.log('[HLS] Manifest parsed:', data.levels.length, 'quality levels');
                this.isLive = !data.levels[0]?.details?.endSN;
                this.onManifestParsed?.(data);
                resolve();
            });

            this.hls.on(Hls.Events.LEVEL_LOADED, (event, data) => {
                this.isLive = data.details.live;
                this.onLevelLoaded?.(data);
            });

            this.hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
                this.currentLevel = data.level;
                this.onQualityChange?.(data.level);
            });

            this.hls.on(Hls.Events.ERROR, (event, data) => {
                console.warn('[HLS] Error:', data.type, data.details);
                if (data.fatal) {
                    this._handleFatalError(data);
                    reject(new Error(data.details));
                }
                this.onError?.(data);
            });

            this.hls.loadSource(url);
            this.hls.attachMedia(this.video);
        });
    }

    /**
     * Handle fatal HLS errors with recovery attempts
     * @param {Object} data
     * @private
     */
    _handleFatalError(data) {
        switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
                console.warn('[HLS] Network error, attempting recovery...');
                this.hls.startLoad();
                break;
            case Hls.ErrorTypes.MEDIA_ERROR:
                console.warn('[HLS] Media error, attempting recovery...');
                this.hls.recoverMediaError();
                break;
            default:
                console.error('[HLS] Unrecoverable error:', data);
                this.destroy();
        }
    }

    /**
     * Wait for video metadata (native HLS in Safari)
     * @returns {Promise<void>}
     * @private
     */
    _waitForMetadata() {
        return new Promise((resolve, reject) => {
            const onLoaded = () => {
                this.video.removeEventListener('loadedmetadata', onLoaded);
                this.video.removeEventListener('error', onError);
                this.isLive = !isFinite(this.video.duration);
                resolve();
            };
            const onError = (e) => {
                this.video.removeEventListener('loadedmetadata', onLoaded);
                this.video.removeEventListener('error', onError);
                reject(new Error('Failed to load stream: ' + (e.target?.error?.message || 'Unknown error')));
            };
            this.video.addEventListener('loadedmetadata', onLoaded);
            this.video.addEventListener('error', onError);
        });
    }

    /**
     * Get available quality levels
     * @returns {Array<Object>}
     */
    getLevels() {
        if (!this.hls) {
            // Native HLS (Safari) - no level control
            return [];
        }
        return this.hls.levels.map((level, index) => ({
            index,
            height: level.height,
            width: level.width,
            bitrate: level.bitrate,
            label: level.height ? `${level.height}p` : `${Math.round(level.bitrate / 1000)}kbps`
        }));
    }

    /**
     * Get current quality level
     * @returns {number} -1 for auto
     */
    getCurrentLevel() {
        if (!this.hls) return -1;
        return this.hls.currentLevel;
    }

    /**
     * Set quality level
     * @param {number} levelIndex - -1 for auto
     */
    setLevel(levelIndex) {
        if (this.hls) {
            this.hls.currentLevel = levelIndex;
            console.log('[HLS] Quality level set to:', levelIndex === -1 ? 'Auto' : this.getLevels()[levelIndex]?.label);
        }
    }

    /**
     * Check if auto quality is enabled
     * @returns {boolean}
     */
    isAutoLevel() {
        if (!this.hls) return true;
        return this.hls.autoLevelEnabled;
    }

    /**
     * Play the stream
     * @returns {Promise<void>}
     */
    async play() {
        try {
            await this.video.play();
        } catch (e) {
            console.warn('[HLS] Play failed:', e.message);
            throw e;
        }
    }

    /**
     * Pause the stream
     */
    pause() {
        this.video.pause();
    }

    /**
     * Get current playback time
     * @returns {number}
     */
    get currentTime() {
        return this.video.currentTime;
    }

    /**
     * Set current playback time
     * @param {number} time
     */
    set currentTime(time) {
        this.video.currentTime = time;
    }

    /**
     * Get stream duration
     * @returns {number}
     */
    get duration() {
        return this.video.duration;
    }

    /**
     * Get volume
     * @returns {number}
     */
    get volume() {
        return this.video.volume;
    }

    /**
     * Set volume
     * @param {number} vol
     */
    set volume(vol) {
        this.video.volume = vol;
    }

    /**
     * Get muted state
     * @returns {boolean}
     */
    get muted() {
        return this.video.muted;
    }

    /**
     * Set muted state
     * @param {boolean} mute
     */
    set muted(mute) {
        this.video.muted = mute;
    }

    /**
     * Get paused state
     * @returns {boolean}
     */
    get paused() {
        return this.video.paused;
    }

    /**
     * Seek to live edge (for live streams)
     */
    seekToLive() {
        if (this.hls && this.isLive) {
            const liveEdge = this.hls.liveSyncPosition;
            if (liveEdge) {
                this.video.currentTime = liveEdge;
            }
        }
    }

    /**
     * Get latency from live edge
     * @returns {number} Seconds behind live
     */
    getLiveLatency() {
        if (!this.hls || !this.isLive) return 0;
        return this.hls.latency || 0;
    }

    /**
     * Clean up resources
     */
    destroy() {
        if (this.hls) {
            this.hls.destroy();
            this.hls = null;
        }
        this.video.src = '';
        this.video.load(); // Reset video element
        this.currentUrl = null;
        this.isLive = false;
        this.currentLevel = -1;
    }
}

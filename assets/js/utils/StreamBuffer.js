/**
 * StreamBuffer - Captures HLS segments for DVR-style playback
 * Uses XHR interception to capture raw segment data from HLS.js
 * Builds a growing buffer that can be fed to MediaBunny.
 */
export class StreamBuffer {
    constructor() {
        this.segments = [];        // Array of {url: string, data: Uint8Array, timestamp: number}
        this.totalBytes = 0;        // Total buffered size
        this.maxBytes = 100 * 1024 * 1024; // Max 100MB buffer
        this.isCapturing = false;

        // Callbacks
        this.onSegmentAdded = null;
        this.onBufferFull = null;
    }

    /**
     * Get HLS.js config with XHR interception for segment capture
     * @returns {Object} HLS.js config object
     */
    getHLSConfig() {
        const self = this;

        return {
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90,
            maxBufferLength: 30,
            maxMaxBufferLength: 60,
            startLevel: -1,

            // Intercept XHR to capture segment data
            xhrSetup: (xhr, url) => {
                // Only capture TS segments
                if (self.isCapturing && (url.includes('.ts') || url.includes('.m4s'))) {
                    const originalOnLoad = xhr.onload;

                    xhr.onload = function () {
                        // Capture the response before passing to HLS.js
                        if (xhr.response && xhr.response instanceof ArrayBuffer) {
                            self._addSegment({
                                url: url,
                                data: new Uint8Array(xhr.response),
                                timestamp: Date.now()
                            });
                        }

                        // Call original handler
                        if (originalOnLoad) {
                            originalOnLoad.apply(this, arguments);
                        }
                    };
                }
            }
        };
    }

    /**
     * Start capturing segments
     */
    startCapture() {
        this.isCapturing = true;
        console.log('[StreamBuffer] Capture started');
    }

    /**
     * Stop capturing segments
     */
    stopCapture() {
        this.isCapturing = false;
        console.log('[StreamBuffer] Capture stopped');
    }

    /**
     * Add a segment to the buffer
     * @param {Object} segment
     * @private
     */
    _addSegment(segment) {
        // Check if segment already exists (by URL)
        if (this.segments.some(s => s.url === segment.url)) {
            return; // Skip duplicate
        }

        // Add segment
        this.segments.push(segment);
        this.totalBytes += segment.data.byteLength;

        console.log(`[StreamBuffer] Captured segment: ${(segment.data.byteLength / 1024).toFixed(1)}KB. Total: ${this.segments.length} segments, ${(this.totalBytes / 1024 / 1024).toFixed(2)}MB`);

        // Trim old segments if buffer is too large
        this._trimBuffer();

        // Callback
        if (this.onSegmentAdded) {
            this.onSegmentAdded(segment, this.segments.length, this.totalBytes);
        }
    }

    /**
     * Trim buffer to maxBytes
     * @private
     */
    _trimBuffer() {
        while (this.totalBytes > this.maxBytes && this.segments.length > 1) {
            const removed = this.segments.shift();
            this.totalBytes -= removed.data.byteLength;
            console.log(`[StreamBuffer] Trimmed segment, buffer now ${(this.totalBytes / 1024 / 1024).toFixed(2)}MB`);
        }
    }

    /**
     * Get the buffered content as a single Blob
     * @returns {Blob}
     */
    toBlob() {
        if (this.segments.length === 0) {
            return null;
        }

        // Concatenate all segment data
        const arrays = this.segments.map(s => s.data);
        const blob = new Blob(arrays, { type: 'video/mp2t' });

        console.log(`[StreamBuffer] Created blob: ${(blob.size / 1024 / 1024).toFixed(2)}MB from ${this.segments.length} segments`);
        return blob;
    }

    /**
     * Get a URL for the buffered content
     * @returns {string}
     */
    toBlobURL() {
        const blob = this.toBlob();
        if (!blob) return null;
        return URL.createObjectURL(blob);
    }

    /**
     * Check if we have enough data to attempt playback
     * @returns {boolean}
     */
    hasEnoughData() {
        // Need at least 3 segments (typically ~6-18 seconds)
        return this.segments.length >= 3;
    }

    /**
     * Get buffer stats
     * @returns {Object}
     */
    getStats() {
        return {
            segmentCount: this.segments.length,
            totalBytes: this.totalBytes,
            totalMB: (this.totalBytes / 1024 / 1024).toFixed(2),
            isCapturing: this.isCapturing,
            hasEnoughData: this.hasEnoughData()
        };
    }

    /**
     * Clear the buffer
     */
    clear() {
        this.segments = [];
        this.totalBytes = 0;
        console.log('[StreamBuffer] Buffer cleared');
    }

    /**
     * Set max buffer size in MB
     * @param {number} megabytes
     */
    setMaxSize(megabytes) {
        this.maxBytes = megabytes * 1024 * 1024;
        this._trimBuffer();
    }
}

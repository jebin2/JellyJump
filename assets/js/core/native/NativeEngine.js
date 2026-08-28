import { Logger } from '../../shared/utils/Logger.js';

/**
 * Playback through the browser's own <video> element.
 *
 * The decode pipeline this sits beside pulls packets out of a file and paints
 * them from an animation frame, with audio scheduled by hand through an
 * AudioContext. That buys frame-accurate control, and it is what makes the
 * editing features possible — but it also means playback exists only for as
 * long as the page is being animated. A hidden tab stops animation frames
 * outright, so playing a video with the screen off, or from another app, cannot
 * work that way no matter how the loop is written.
 *
 * A <video> element is playing media the browser itself owns. It keeps going
 * when the tab hides, it registers with the operating system's media session so
 * the lock screen can drive it, and none of that depends on this code still
 * being run. That is the whole reason this engine exists.
 *
 * What it gives up is the decoder: only what the browser can play natively goes
 * through here, which the caller decides before constructing one. Everything
 * else — MKV, exotic codecs, HLS, a webcam — still belongs to the decode path.
 *
 * The element is a *source*, not the picture. It is mounted transparent behind
 * the canvas and painted onto it, the way webcam mode already works, so filters,
 * screenshots and canvas recording keep reading the surface they always have.
 * When the tab hides and the paint loop stops, nothing is lost: nobody is
 * looking at the pixels, and the audio was never the loop's responsibility.
 */

/**
 * How long to wait for a file to describe itself before giving up on it.
 *
 * canPlayType is advisory — a browser can claim a container and then fail on
 * the codec inside it — and a file that will never load often produces no error
 * at all, just silence. This bounds that silence so the caller can fall back to
 * the decoder instead of showing a player that never starts.
 */
const METADATA_TIMEOUT_MS = 8000;

export class NativeEngine {
    /**
     * @param {Object} options
     * @param {HTMLElement} options.mount - element to attach the video to
     * @param {boolean} [options.withCredentials]
     * @param {Function} [options.onReady] - (durationSeconds) metadata has arrived
     * @param {Function} [options.onStateChange] - ('playing'|'paused'|'waiting'|'ended')
     * @param {Function} [options.onSeeked] - a seek has landed and can be shown
     * @param {Function} [options.onError] - (message)
     * @param {number} [options.metadataTimeoutMs] - override, for tests
     */
    constructor(options) {
        this.options = options;
        this.metadataTimeoutMs = options.metadataTimeoutMs ?? METADATA_TIMEOUT_MS;
        // While a load is in flight its own promise reports failure, and the
        // caller answers by falling back. Reporting the same failure through
        // onError as well would show the user "this cannot be played" about a
        // file that is, a moment later, playing through the decoder.
        this.loading = false;
        this.el = null;
        this.destroyed = false;
        this.duration = 0;
        this.url = null;
        this._metadataTimer = null;
        this._pendingStart = 0;
    }

    /**
     * Whether this element can be handed another file instead of being replaced.
     *
     * Same reasoning that keeps sound working across YouTube videos, for the
     * same reason: a media element carries the permission the user's tap granted
     * it, and on a phone it also carries the operating system's media session.
     * Replacing it between videos throws both away — so the next video in a
     * playlist would need a permission nobody is there to give, which is exactly
     * the case that matters here, because the whole point is that the screen is
     * off when it happens.
     *
     * @param {HTMLElement} mount - where the caller wants the video
     */
    canLoadAnother(mount) {
        return !this.destroyed && !!this.el && this.el.parentElement === mount;
    }

    /** Create the element. Safe to call again; it only builds once. */
    create() {
        if (this.el) return this.el;

        const el = document.createElement('video');
        // Shares the class the canvas and the stream video carry, so the
        // stylesheet's sizing and effect rules apply without a new selector.
        el.className = 'jellyjump-native-video jellyjump-video';
        // Both spellings: the unprefixed one is the standard, the prefixed one
        // is what older iOS reads, and without them iOS takes the video
        // fullscreen the moment it plays.
        el.setAttribute('playsinline', '');
        el.setAttribute('webkit-playsinline', '');
        el.preload = 'auto';
        // Matches how the stream video is set up. Painting the element onto the
        // canvas taints it unless the response allows it, and a tainted canvas
        // makes screenshots and recording throw rather than degrade.
        el.crossOrigin = this.options.withCredentials ? 'use-credentials' : 'anonymous';

        // Behind the canvas and invisible: the canvas is the picture, this is
        // where the frames and the sound come from. Clicks belong to the
        // overlay above it.
        el.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;opacity:0;z-index:-1';

        // A phone will not decode a video it believes is not on screen, so it
        // is laid out at full size and simply made transparent. On a desktop
        // that is wasted compositing, so there it really is one pixel.
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile) {
            el.style.width = '100%';
            el.style.height = '100%';
            el.style.visibility = 'visible';
        } else {
            el.style.width = '1px';
            el.style.height = '1px';
            el.style.visibility = 'hidden';
        }

        this.el = el;
        this._bindEvents();
        this.options.mount.appendChild(el);
        return el;
    }

    _bindEvents() {
        const el = this.el;

        el.addEventListener('loadedmetadata', () => {
            if (this.destroyed) return;
            this._clearMetadataTimer();
            this.duration = Number.isFinite(el.duration) ? el.duration : 0;
            // Applied here rather than before the load: currentTime is ignored
            // until the element knows how long the file is.
            if (this._pendingStart > 0) {
                try { el.currentTime = this._pendingStart; } catch { /* out of range */ }
                this._pendingStart = 0;
            }
            this.options.onReady?.(this.duration);
        });

        el.addEventListener('playing', () => {
            if (!this.destroyed) this.options.onStateChange?.('playing');
        });
        el.addEventListener('pause', () => {
            // The pause fired as a video ends is not the user pausing, and
            // reporting it as one leaves the button showing "play" for a
            // moment before the playlist moves on.
            if (!this.destroyed && !el.ended) this.options.onStateChange?.('paused');
        });
        // A seek is not done when currentTime is assigned — the element still
        // has to decode the new position. Painting before this fires draws the
        // frame it was already showing, so scrubbing a paused video moves the
        // bar over a picture that never changes.
        el.addEventListener('seeked', () => {
            if (!this.destroyed) this.options.onSeeked?.();
        });

        el.addEventListener('waiting', () => {
            if (!this.destroyed) this.options.onStateChange?.('waiting');
        });
        el.addEventListener('ended', () => {
            if (!this.destroyed) this.options.onStateChange?.('ended');
        });

        el.addEventListener('error', () => {
            if (this.destroyed || this.loading) return;
            this._clearMetadataTimer();
            this.options.onError?.(describeError(el.error));
        });
    }

    /**
     * Play a file in this element.
     *
     * Resolves once the browser has read the file's metadata, and rejects if it
     * cannot — which is the signal the caller needs to fall back to the decoder
     * while there is still time to do so invisibly.
     *
     * @param {{url: string, start?: number}} next
     * @returns {Promise<number>} the duration, in seconds
     */
    load(next) {
        this.create();

        this.url = next.url;
        this.duration = 0;
        this.loading = true;
        this._pendingStart = Math.max(0, next.start || 0);

        return new Promise((resolve, reject) => {
            const el = this.el;

            const settle = (fn, value) => {
                el.removeEventListener('loadedmetadata', onMeta);
                el.removeEventListener('error', onErr);
                this._clearMetadataTimer();
                this.loading = false;
                fn(value);
            };
            const onMeta = () => settle(resolve, Number.isFinite(el.duration) ? el.duration : 0);
            const onErr = () => settle(reject, new Error(describeError(el.error)));

            el.addEventListener('loadedmetadata', onMeta);
            el.addEventListener('error', onErr);

            this._metadataTimer = setTimeout(() => {
                settle(reject, new Error('The browser did not start reading this file.'));
            }, this.metadataTimeoutMs);

            el.src = next.url;
            // Discards whatever the element was doing with the previous file;
            // without it a src swap can be serviced from the old buffer.
            el.load();
        });
    }

    _clearMetadataTimer() {
        if (!this._metadataTimer) return;
        clearTimeout(this._metadataTimer);
        this._metadataTimer = null;
    }

    /** Hide without tearing down, so the element can be reused for the next file. */
    setVisible(visible) {
        if (this.el) this.el.style.display = visible ? '' : 'none';
    }

    /** Natural size, once known — 0 before that. */
    getWidth() { return this.el?.videoWidth || 0; }
    getHeight() { return this.el?.videoHeight || 0; }

    /** The element itself, for the paint loop and for anything reading frames. */
    getElement() { return this.el; }

    // ─── Transport ───────────────────────────────────────────────────────────

    /**
     * @returns {Promise<void>} rejects when the browser refuses to start, which
     * is the one honest autoplay signal a media element gives — unlike an
     * embed, this needs no watchdog to notice a refusal.
     */
    play() {
        const started = this.el?.play?.();
        return started instanceof Promise ? started : Promise.resolve();
    }

    pause() { this.el?.pause?.(); }

    seek(seconds) {
        if (!this.el) return;
        const target = Math.max(0, seconds);
        // Before metadata, currentTime is not writable — remember it for the
        // load handler instead of dropping the seek on the floor.
        if (!this.duration) { this._pendingStart = target; return; }
        try { this.el.currentTime = Math.min(target, this.duration); } catch { /* not seekable yet */ }
    }

    getTime() { return this.el?.currentTime ?? 0; }
    getDuration() { return this.duration || (Number.isFinite(this.el?.duration) ? this.el.duration : 0); }

    setVolume(value01) {
        if (this.el) this.el.volume = Math.max(0, Math.min(1, value01));
    }

    setMuted(muted) {
        if (!this.el) return;
        this.el.muted = !!muted;
        // The attribute as well as the property: iOS reads the attribute when
        // deciding whether a play() may start without a gesture.
        if (muted) this.el.setAttribute('muted', '');
        else this.el.removeAttribute('muted');
    }

    isMuted() { return this.el ? this.el.muted : null; }

    setRate(rate) {
        if (this.el) this.el.playbackRate = rate;
    }

    destroy() {
        this.destroyed = true;
        this._clearMetadataTimer();

        if (this.el) {
            try {
                this.el.pause();
                // Emptying the source before dropping the element is what
                // actually releases the decoder and the buffered data; a
                // detached element holding a src can keep both alive.
                this.el.removeAttribute('src');
                this.el.load();
            } catch (error) {
                Logger.warn('[Native] Error releasing video element:', error);
            }
            this.el.remove();
        }
        this.el = null;
        this.url = null;
    }
}

/** MediaError, as something a user can act on. */
function describeError(error) {
    switch (error?.code) {
        case 1: return 'Loading this video was cancelled.';
        case 2: return 'The video could not be reached.';
        case 3: return 'This video could not be decoded.';
        case 4: return 'This video format is not supported here.';
        default: return 'This video could not be played.';
    }
}

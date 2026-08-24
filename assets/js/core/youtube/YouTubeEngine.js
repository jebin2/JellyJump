import { Logger } from '../../shared/utils/Logger.js';

/**
 * YouTube playback, through YouTube's own player.
 *
 * A YouTube video cannot be demuxed the way a file can — there is no media
 * stream to fetch, and extracting one is both against their terms and fragile.
 * What is supported is embedding, so this hands the video to YouTube's iframe
 * player and drives it through the IFrame API.
 *
 * The consequence is that this engine owns none of the pixels or the audio.
 * The iframe is cross-origin, so nothing can read frames out of it and no
 * AudioContext can be attached — which is why the player marks canvasFrames and
 * audioGraph unavailable while it is active, and the features built on them
 * turn themselves off rather than silently doing nothing.
 *
 * The API has no timeupdate, so position has to be polled. That is done by the
 * caller's animation frame, not here, to keep one clock driving the UI.
 */

const API_SRC = 'https://www.youtube.com/iframe_api';

/** YT.PlayerState, inlined so this module can be reasoned about without it. */
const STATE = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 };

let apiPromise = null;

/**
 * The page's origin, when it has one YouTube will accept.
 *
 * A page loaded from file:// reports an origin of "null", which is not an
 * origin YouTube can check against — sending it is worse than sending nothing.
 * @returns {string|null}
 */
function webOrigin() {
    const origin = typeof location !== 'undefined' ? location.origin : null;
    return origin && /^https?:\/\//.test(origin) ? origin : null;
}

/**
 * Load the IFrame API once per page.
 *
 * It signals readiness by calling a global, so an existing callback is chained
 * rather than replaced — clobbering someone else's would break them silently.
 */
function loadApi() {
    if (apiPromise) return apiPromise;

    apiPromise = new Promise((resolve, reject) => {
        if (window.YT?.Player) return resolve(window.YT);

        const previous = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
            if (typeof previous === 'function') previous();
            resolve(window.YT);
        };

        const existing = document.querySelector(`script[src="${API_SRC}"]`);
        if (existing) return; // already loading; the callback above will fire

        const script = document.createElement('script');
        script.src = API_SRC;
        script.async = true;
        script.onerror = () => reject(new Error('Could not load the YouTube player'));
        document.head.appendChild(script);
    });

    return apiPromise;
}

export class YouTubeEngine {
    /**
     * @param {Object} options
     * @param {HTMLElement} options.mount - element the iframe replaces content in
     * @param {string} options.videoId
     * @param {number} [options.start] - seconds to begin at
     * @param {boolean} [options.autoplay]
     * @param {boolean} [options.muted] - start muted, which is what lets a phone autoplay
     * @param {Function} [options.onReady] - the embed is ready to be driven
     * @param {Function} [options.onDuration] - (seconds) once the length is known
     * @param {Function} [options.onStateChange] - ('playing'|'paused'|'ended'|'buffering')
     * @param {Function} [options.onError] - (message)
     */
    constructor(options) {
        this.options = options;
        this.player = null;
        this.host = null;
        this.destroyed = false;
        this.duration = 0;
        this.videoId = options.videoId;
    }

    /**
     * Whether this embed can be handed another video instead of being replaced.
     *
     * This is what keeps sound working past the first video. A browser tracks
     * user activation per frame, so a brand-new iframe has none — it has never
     * been touched, and a tap on the page outside it does not count. Every
     * video getting its own iframe therefore starts from the most restricted
     * state the browser has, which is muted. Loading into the frame that is
     * already there keeps whatever the user has granted it.
     *
     * @param {HTMLElement} mount - where the caller wants the video
     */
    canLoadAnother(mount) {
        return !this.destroyed
            && this.host?.parentElement === mount
            && typeof this.player?.loadVideoById === 'function';
    }

    /**
     * Play a different video in this same embed.
     * @param {{videoId: string, start?: number, autoplay?: boolean}} next
     */
    load(next) {
        if (!this.canLoadAnother(this.host?.parentElement)) return false;

        this.videoId = next.videoId;
        this.duration = 0;

        const request = {
            videoId: next.videoId,
            startSeconds: Math.max(0, Math.floor(next.start || 0)),
        };
        // cue leaves it ready but not started, which is what a non-autoplay
        // load means; load starts it.
        if (next.autoplay) this.player.loadVideoById(request);
        else this.player.cueVideoById(request);

        this._resolveDuration();
        return true;
    }

    /** Hide without tearing down, so the embed can be reused for the next video. */
    setVisible(visible) {
        if (this.host) this.host.style.display = visible ? '' : 'none';
    }

    async mount() {
        const YT = await loadApi();
        if (this.destroyed) return;

        // A wrapper we own, holding the iframe. destroy() only exists once the
        // player has finished initialising, and an embed that never gets there
        // would otherwise leave its iframe behind — removing our own wrapper
        // cleans up either way.
        this.host = document.createElement('div');
        this.host.className = 'jellyjump-youtube';
        // Sits where the canvas does, so the surrounding layout, controls and
        // fullscreen behaviour are unchanged.
        this.host.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;';

        // The iframe is built here rather than left to the API, for one reason:
        // this app is cross-origin isolated (the service worker sets COEP so
        // Whisper can use SharedArrayBuffer), and under COEP a cross-origin
        // frame is refused unless it carries its own COEP or is marked
        // `credentialless`. YouTube sends no COEP, so an iframe the API creates
        // is blocked outright — the browser renders "refused to connect".
        // Marking it here is the only way to set that attribute before it loads.
        const target = document.createElement('iframe');
        target.setAttribute('credentialless', '');
        target.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen');
        target.setAttribute('allowfullscreen', '');
        target.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
        target.style.cssText = 'width:100%;height:100%;border:0;display:block;';
        target.src = this._embedUrl();
        this.host.appendChild(target);
        this.options.mount.appendChild(this.host);

        // Handed the existing iframe, the API adopts it instead of replacing
        // it — which is what keeps the attribute above.
        // Only events here: an adopted iframe already carries the video id and
        // every parameter in its src, and the API does not re-read them.
        this.player = new YT.Player(target, {
            events: {
                onReady: () => {
                    if (this.destroyed) return;
                    this.options.onReady?.();
                    // getDuration is 0 until the embed has loaded enough of the
                    // video to know it, which is usually after onReady and, for
                    // a video nobody has started yet, may be well after. Without
                    // this the scrub bar sits at 0:00 until the first play.
                    this._resolveDuration();
                },
                onStateChange: (event) => {
                    if (this.destroyed) return;
                    // Duration is not always known at onReady for a video that
                    // has not started buffering.
                    if (!this.duration) this._resolveDuration();

                    switch (event.data) {
                        case STATE.PLAYING: this.options.onStateChange?.('playing'); break;
                        case STATE.PAUSED: this.options.onStateChange?.('paused'); break;
                        case STATE.ENDED: this.options.onStateChange?.('ended'); break;
                        case STATE.BUFFERING: this.options.onStateChange?.('buffering'); break;
                        default: break;
                    }
                },
                onError: (event) => {
                    if (this.destroyed) return;
                    this.options.onError?.(describeError(event?.data));
                },
            },
        });
    }

    /**
     * The embed URL, with everything the player needs baked in.
     *
     * Built here rather than handed to the API as playerVars because the API
     * only applies those when it creates the iframe itself — and it cannot be
     * allowed to do that, or the credentialless attribute is lost.
     */
    _embedUrl() {
        const params = new URLSearchParams({
            // Without this the iframe never talks back, and every method on the
            // player object stays undefined.
            enablejsapi: '1',
            // Required for iOS, which otherwise takes the video fullscreen the
            // moment it plays.
            playsinline: '1',
            autoplay: this.options.autoplay ? '1' : '0',
            // Set in the URL, not through the API afterwards: a phone decides
            // whether to allow autoplay when the player starts, and by the time
            // mute() could be called it has already refused.
            mute: this.options.muted ? '1' : '0',
            start: String(Math.max(0, Math.floor(this.options.start || 0))),
            rel: '0',
            modestbranding: '1',
        });

        // Sent only for a real web origin: the desktop build runs from file://,
        // where the origin is "null" and passing it makes YouTube reject the
        // embed rather than fall back.
        const origin = webOrigin();
        if (origin) params.set('origin', origin);

        return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(this.options.videoId)}?${params}`;
    }

    /**
     * Resolve the duration, retrying until the embed knows it.
     *
     * Bounded rather than open-ended: if it is still unknown after this, the
     * video is very likely unplayable here, and polling forever would keep a
     * timer alive for a video nobody can watch.
     */
    _resolveDuration(attemptsLeft = 20) {
        if (this.destroyed || this.duration) return;

        const duration = this.player?.getDuration?.() || 0;
        if (duration) {
            this.duration = duration;
            this.options.onDuration?.(duration);
            return;
        }
        if (attemptsLeft <= 0) return;
        setTimeout(() => this._resolveDuration(attemptsLeft - 1), 250);
    }

    // ─── Transport ───────────────────────────────────────────────────────────
    // Every call is guarded: the API methods only exist once the iframe has
    // finished initialising, and the transport can be driven before then.

    play() { this.player?.playVideo?.(); }
    pause() { this.player?.pauseVideo?.(); }
    seek(seconds) { this.player?.seekTo?.(Math.max(0, seconds), true); }

    getTime() { return this.player?.getCurrentTime?.() ?? 0; }
    getDuration() { return this.player?.getDuration?.() || this.duration || 0; }

    setVolume(value01) { this.player?.setVolume?.(Math.round(Math.max(0, Math.min(1, value01)) * 100)); }
    setMuted(muted) { muted ? this.player?.mute?.() : this.player?.unMute?.(); }
    /**
     * What the embed is actually doing, which is not always what it was asked
     * to do: unMute() is a request a phone can ignore outright, and inferring
     * success from "it is still playing" cannot tell that apart from working.
     * @returns {boolean|null} null when the embed cannot be asked yet
     */
    isMuted() {
        if (typeof this.player?.isMuted !== 'function') return null;
        try { return this.player.isMuted(); } catch { return null; }
    }
    setRate(rate) { this.player?.setPlaybackRate?.(rate); }

    destroy() {
        this.destroyed = true;
        try {
            this.player?.destroy?.();
        } catch (error) {
            Logger.warn('[YouTube] Error destroying player:', error);
        }
        this.player = null;
        // The wrapper is ours and still attached whatever the API did inside
        // it, so removing it takes the iframe with it — including when the
        // player never initialised far enough to have a destroy() at all.
        this.host?.remove();
        this.host = null;
    }
}

/** The API's numeric error codes, as something a user can act on. */
function describeError(code) {
    switch (code) {
        case 2: return 'That YouTube link is not valid.';
        case 5: return 'YouTube could not play this video here.';
        case 100: return 'That video is unavailable — it may have been removed or made private.';
        case 101:
        case 150: return 'The owner does not allow this video to be played outside YouTube.';
        default: return 'YouTube could not play this video.';
    }
}

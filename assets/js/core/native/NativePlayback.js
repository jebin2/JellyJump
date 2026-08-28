import { NativeEngine } from './NativeEngine.js';
import { Logger } from '../../shared/utils/Logger.js';

/**
 * Driving the browser's own <video> element as one of the player's engines.
 *
 * This is the counterpart to YouTubePlayback: the same shape — apply a mode,
 * load, suspend, tear down — around a very different thing being driven. Where
 * the embed owns pixels this code can never touch, the element here is ours;
 * what it owns instead is the clock and the audio, which is the entire point.
 * Playback that the browser is running does not stop when the page stops being
 * animated, so it survives a locked screen and a switch to another app.
 *
 * The canvas stays the picture. The element is painted onto it every frame,
 * exactly as webcam mode already does, so filters, screenshots and canvas
 * recording go on reading the surface they always have. That paint loop dying
 * in a hidden tab is not a failure here — it is the arrangement working.
 */

/**
 * Containers this engine will offer the browser, and how to ask about each.
 *
 * The probe string matters. Asked about a bare "video/mp4" every browser
 * answers "maybe", because the question is unanswerable — an MP4 can hold
 * almost anything. Asked about mainstream H.264 and AAC inside that container
 * it answers "probably", which is a real answer to a real question. So each
 * container is probed with the codecs that make up the overwhelming majority of
 * files in it, and the honest reading of a pass is "this browser plays ordinary
 * files of this kind", not "this browser plays this exact file".
 *
 * The rest is handled by falling back: a file that turns out to hold something
 * unusual fails to load and goes to the decoder, which can play far more than
 * any browser can. That is why this list can afford to be short.
 */
const NATIVE_TYPES = [
    { extensions: ['.mp4', '.m4v'], probe: 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"' },
    { extensions: ['.mov'], probe: 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"' },
    { extensions: ['.webm'], probe: 'video/webm; codecs="vp8, vorbis"' },
    { extensions: ['.m4a'], probe: 'audio/mp4; codecs="mp4a.40.2"' },
    { extensions: ['.mp3'], probe: 'audio/mpeg' },
    { extensions: ['.wav'], probe: 'audio/wav; codecs="1"' },
    { extensions: ['.ogg', '.oga'], probe: 'audio/ogg; codecs="vorbis"' },
];

/** Declared types that map onto the list above, for sources with no filename. */
const NATIVE_TYPES_BY_MIME = {
    'video/mp4': 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
    'video/quicktime': 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
    'video/webm': 'video/webm; codecs="vp8, vorbis"',
    'audio/mp4': 'audio/mp4; codecs="mp4a.40.2"',
    'audio/mpeg': 'audio/mpeg',
    'audio/wav': 'audio/wav; codecs="1"',
    'audio/x-wav': 'audio/wav; codecs="1"',
    'audio/ogg': 'audio/ogg; codecs="vorbis"',
};

/**
 * Whether the browser should be given this file directly.
 *
 * A blob: URL has no extension, which is how most of the library arrives, so
 * the type the library recorded is consulted first and the filename is only a
 * fallback. If neither says anything recognisable the answer is no — guessing
 * costs a visible stall before the fallback runs, and the decoder was always
 * going to handle it fine.
 *
 * @param {string} url
 * @param {string} [declaredMime] - the library's own idea of the type, if any
 * @returns {boolean}
 */
export function canPlayNatively(url, declaredMime) {
    if (typeof document === 'undefined') return false;
    if (!url || typeof url !== 'string') return false;

    const probe = nativeProbeFor(url, declaredMime);
    if (!probe) return false;

    try {
        return document.createElement('video').canPlayType(probe) === 'probably';
    } catch {
        return false;
    }
}

/**
 * The string to ask canPlayType about, or null if this is not a type to offer.
 *
 * A declared type that already names its codecs is trusted as it stands — the
 * caller knows more about the file than an extension does.
 */
export function nativeProbeFor(url, declaredMime) {
    const mime = String(declaredMime || '').toLowerCase().trim();
    if (mime) {
        if (mime.includes('codecs=')) return mime;
        const known = NATIVE_TYPES_BY_MIME[mime.split(';')[0].trim()];
        if (known) return known;
    }

    // Query strings and fragments first: a signed URL from the home server ends
    // in a token, not in ".mp4", and matching the raw string would send every
    // such file to the decoder.
    const path = String(url).split('#')[0].split('?')[0].toLowerCase();
    for (const entry of NATIVE_TYPES) {
        if (entry.extensions.some((extension) => path.endsWith(extension))) return entry.probe;
    }
    return null;
}

/**
 * Switch the player between the decode pipeline and the element.
 *
 * Unlike the YouTube mode, the control bar stays exactly where it is: this
 * engine drives a normal video with normal controls, and only what genuinely
 * cannot work changes.
 */
export function applyNativeMode(player, on) {
    player.engine = on ? 'native' : 'mediabunny';
    // The canvas is still painted every frame, so everything reading frames off
    // it keeps working. The audio graph is what goes: routing the element
    // through an AudioContext would put playback back behind a context that a
    // backgrounded page suspends, which is the exact thing being escaped here.
    player.capabilities = { canvasFrames: true, audioGraph: !on };
}

/**
 * Play a file through the browser.
 *
 * @param {Object} player
 * @param {string} url
 * @param {boolean} autoplay
 * @param {{title?: string, artwork?: string}} [meta] - for the lock screen
 * @returns {Promise<boolean>} false when the browser could not take the file,
 *   which is the caller's cue to load it through the decoder instead. Nothing
 *   is left mounted in that case.
 */
export async function loadPlayerNative(player, url, autoplay, meta = {}) {
    const mount = player.canvas?.parentElement;
    if (!mount) return false;

    const start = player.currentTime || 0;
    const reusing = player.native?.canLoadAnother(mount);

    if (!reusing) {
        teardownPlayerNative(player);
        player.native = new NativeEngine({
            mount,
            withCredentials: player.config.withCredentials,
            onReady: (duration) => {
                player.duration = duration;
                player._updateProgress();
            },
            onStateChange: (state) => handleNativeState(player, state),
            onSeeked: () => {
                if (player.engine !== 'native') return;
                player.currentTime = player.native.getTime();
                player._updateProgress();
                // Only when paused: while playing, the ticker is already
                // painting and would race this.
                if (!player.isPlaying) paintNativeFrame(player);
            },
            onError: (message) => {
                // Only worth reporting once the file was accepted — a failure
                // during load is answered by falling back, not by an error.
                if (player.engine !== 'native') return;
                Logger.error('[Native]', message);
                player._setLoading(false);
                if (player.onStreamError && player.currentVideoId) {
                    player.onStreamError(player.currentVideoId, message);
                }
            },
        });
    }

    applyNativeMode(player, true);
    player.duration = 0;
    player.currentTime = start;
    player.isPlaying = false;
    // The browser does not report a frame rate, and the previous file's would
    // make frame stepping step by the wrong amount. 30 is the assumption the
    // decode path already falls back to.
    player.frameRate = 30;

    try {
        player.duration = await player.native.load({ url, start });
    } catch (error) {
        // The browser said it could probably play this and then could not.
        // Undo everything and let the decoder have it — the user sees a load
        // that took a moment, not a failure.
        Logger.log(`[Native] Falling back to the decoder: ${error.message}`);
        teardownPlayerNative(player);
        return false;
    }

    player.native.setVisible(true);
    sizeCanvasToNative(player);
    syncNativeAudio(player);
    if (player.playbackRate !== 1) player.native.setRate(player.playbackRate);
    setNativeMediaSession(player, { ...meta, title: meta.title || nativeTitleFor(url) });
    player._updateProgress();
    player._setLoading(false);

    // One frame drawn now, so a video that is loaded but not started shows
    // itself instead of the previous video or an empty canvas.
    paintNativeFrame(player);

    if (autoplay) await startNativePlayback(player);
    else showNativeOverlay(player, true);

    Logger.log(`[Native] ${reusing ? 'Reused element for' : 'Playing'} ${url}`);
    return true;
}

/** Match the canvas to the file, so the painted frame is not stretched. */
function sizeCanvasToNative(player) {
    const width = player.native?.getWidth();
    const height = player.native?.getHeight();
    if (!width || !height || !player.canvas) return;
    player.canvas.width = width;
    player.canvas.height = height;
}

function showNativeOverlay(player, visible) {
    if (!player.ui?.playOverlay || !player.config.controls.playOverlay) return;
    player.ui.playOverlay.style.display = visible ? 'flex' : 'none';
}

/**
 * Start playback, giving up sound rather than giving up playing.
 *
 * A media element rejects play() when the browser refuses it, which is a far
 * better signal than an embed gives — there is nothing to guess at and no
 * watchdog needed. The refusal is almost always about sound, so that is what is
 * offered up, and it is recorded as owed so the next interaction restores it.
 */
async function startNativePlayback(player) {
    try {
        await player.native.play();
        return true;
    } catch (error) {
        if (player.config.muted) {
            Logger.log(`[Native] Playback was refused even muted: ${error?.message || error}`);
            showNativeOverlay(player, true);
            return false;
        }

        Logger.log('[Native] Playback was refused with sound; retrying muted');
        player.config.muted = true;
        player._wasMutedForAutoplay = true;
        player._syncAudioGain();
        player._updateVolumeUI();

        try {
            await player.native.play();
            return true;
        } catch (retryError) {
            Logger.log(`[Native] Muted playback was refused too: ${retryError?.message || retryError}`);
            showNativeOverlay(player, true);
            return false;
        }
    }
}

function handleNativeState(player, state) {
    if (player.engine !== 'native') return;

    if (state === 'playing') {
        player.isPlaying = true;
        player._setLoading(false);
        showNativeOverlay(player, false);
        player._updatePlayPauseUI();
        startNativeTicker(player);
        // The restriction is on starting with sound, not on unmuting something
        // already playing — so a mute taken to get started is given back here.
        player._restoreAutoplayAudio('Native playback started');
        updateNativeSessionState(player, 'playing');
    } else if (state === 'waiting') {
        player._setLoading(true);
    } else if (state === 'paused') {
        player.isPlaying = false;
        player._updatePlayPauseUI();
        stopNativeTicker(player);
        showNativeOverlay(player, true);
        updateNativeSessionState(player, 'paused');
    } else if (state === 'ended') {
        player.isPlaying = false;
        player._updatePlayPauseUI();
        stopNativeTicker(player);
        // Same completion as any other engine: the playlist advances and
        // loop-one restarts without either being special-cased here. This
        // arrives as an element event rather than from a timer, so it still
        // fires with the tab hidden — which is what lets a playlist keep going
        // with the screen off.
        player._completeMedia();
    }
}

/**
 * Paint the element onto the canvas and move the UI along with it.
 *
 * One loop for both, so there is a single clock: the same frame that reaches
 * the screen is the one the scrub bar and the subtitles are told about. It runs
 * only while playing, and stops on its own when the tab hides — at which point
 * the browser goes on playing without it.
 */
export function startNativeTicker(player) {
    if (player._nativeTicker) return;

    const tick = () => {
        if (player.engine !== 'native' || !player.native) return stopNativeTicker(player);
        if (!player.isPlaying) return stopNativeTicker(player);

        player.currentTime = player.native.getTime();
        if (!player.duration) player.duration = player.native.getDuration();

        // A-B looping, on the same terms the render loop applies it to a file.
        if (player.loopMode === 'one' && player.loopStart !== null && player.loopEnd !== null
            && player.currentTime >= player.loopEnd) {
            player.native.seek(player.loopStart);
            player.currentTime = player.loopStart;
        }

        paintNativeFrame(player);
        player._updateProgress();
        player.trigger('timeupdate', { currentTime: player.currentTime });

        player._nativeTicker = requestAnimationFrame(tick);
    };

    player._nativeTicker = requestAnimationFrame(tick);
}

export function stopNativeTicker(player) {
    if (!player._nativeTicker) return;
    cancelAnimationFrame(player._nativeTicker);
    player._nativeTicker = null;
}

/** Draw the current frame. Silent on failure: a frame not yet decodable is normal. */
export function paintNativeFrame(player) {
    const element = player.native?.getElement();
    if (!element || !player.ctx || !player.canvas) return;
    if (!element.videoWidth || !element.videoHeight) return;

    if (player.canvas.width !== element.videoWidth || player.canvas.height !== element.videoHeight) {
        player.canvas.width = element.videoWidth;
        player.canvas.height = element.videoHeight;
    }

    try {
        player.ctx.drawImage(element, 0, 0, player.canvas.width, player.canvas.height);
    } catch (error) {
        Logger.warn('[Native] Could not paint frame:', error);
    }
}

/**
 * Stop the current file and get out of the way, keeping the element.
 *
 * Called before every load, which cannot yet know what is coming. Nothing is
 * destroyed because the next file may also be one the browser can play, and
 * dropping the element would drop the permission and the media session with it
 * — the thing that has to survive precisely when nobody is watching to grant it
 * again.
 */
export function suspendPlayerNative(player) {
    if (!player.native) return;

    stopNativeTicker(player);
    player.native.pause();
    player.native.setVisible(false);
    player.isPlaying = false;
    applyNativeMode(player, false);
}

/** Drop the element entirely. Called once the player knows it is not needed. */
export function teardownPlayerNative(player) {
    if (player.engine !== 'native' && !player.native) return;

    stopNativeTicker(player);
    player.native?.destroy();
    player.native = null;

    clearNativeMediaSession(player);
    applyNativeMode(player, false);
    player.isPlaying = false;
}

/**
 * Push the player's volume and mute to the element.
 *
 * Called from the player's own volume funnel: the slider moves a Web Audio gain
 * node, which this engine does not go through, so without this the control
 * would appear to do nothing.
 */
export function syncNativeAudio(player) {
    if (player.engine !== 'native' || !player.native) return;
    player.native.setMuted(player.config.muted || player.config.volume === 0);
    player.native.setVolume(player.config.volume);
}

// ─── Media session ───────────────────────────────────────────────────────────
// What the lock screen and the notification shade show, and the buttons there.
// This only means anything because a real media element is playing: the browser
// hands the operating system a session for one, and these are its controls.
// It is also the whole answer on iOS, where backgrounding still pauses — with a
// session, that becomes one tap to resume and it keeps going.

/**
 * A readable name for a file, for when the caller has no better one.
 *
 * The lock screen shows whatever this returns, so "video.mp4" beats a signed
 * URL and both beat an empty line where the title should be.
 */
export function nativeTitleFor(url) {
    try {
        const path = String(url).split('#')[0].split('?')[0];
        const name = decodeURIComponent(path.split('/').pop() || '');
        return name.replace(/\.[^.]+$/, '') || 'JellyJump';
    } catch {
        return 'JellyJump';
    }
}

function setNativeMediaSession(player, meta = {}) {
    const session = typeof navigator !== 'undefined' ? navigator.mediaSession : null;
    if (!session) return;

    try {
        if (window.MediaMetadata) {
            session.metadata = new window.MediaMetadata({
                title: meta.title || 'JellyJump',
                artist: meta.artist || '',
                album: meta.album || '',
                artwork: meta.artwork ? [{ src: meta.artwork }] : [],
            });
        }

        // Bound to the player's own transport rather than the element, so the
        // lock screen goes through the same path as the on-screen buttons and
        // the UI cannot drift out of step with it.
        session.setActionHandler('play', () => player.play());
        session.setActionHandler('pause', () => player.pause());
        session.setActionHandler('seekto', (details) => {
            if (details?.seekTime != null) player._seekTo(details.seekTime);
        });
        // Only offered when there is somewhere to go: an enabled button that
        // does nothing is worse than no button.
        session.setActionHandler('previoustrack', player.onPrevious ? () => player.onPrevious() : null);
        session.setActionHandler('nexttrack', player.onNext ? () => player.onNext() : null);
    } catch (error) {
        Logger.warn('[Native] Could not set up media session:', error);
    }
}

function updateNativeSessionState(player, state) {
    const session = typeof navigator !== 'undefined' ? navigator.mediaSession : null;
    if (!session) return;
    try {
        session.playbackState = state;
    } catch { /* not supported */ }
}

function clearNativeMediaSession(player) {
    const session = typeof navigator !== 'undefined' ? navigator.mediaSession : null;
    if (!session) return;
    try {
        session.metadata = null;
        session.playbackState = 'none';
        for (const action of ['play', 'pause', 'seekto', 'previoustrack', 'nexttrack']) {
            session.setActionHandler(action, null);
        }
    } catch { /* not supported */ }
}

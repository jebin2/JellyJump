// @ts-check
/**
 * Waiting for data instead of playing on without it.
 *
 * The clock is the AudioContext's (ADR 0003): position = anchor + elapsed
 * context time. Nothing stopped it when the source could not keep up -- a
 * remote file on a slow link, after a seek -- so the time went on counting
 * while the sound ran out and the picture stopped. And once behind, it could
 * never catch up: audio that arrives after its moment is dropped
 * (AudioEngine) and so are late frames (RenderLoop), so every buffer that
 * did arrive was already too late. The picture and the sound stayed stuck
 * while the timer ran.
 *
 * Now, while playing a file (not live), the render loop asks on every frame
 * whether the data is running out:
 * - the audio scheduled ahead of the clock is under STALL_AT, or
 * - no frame has been shown for VIDEO_GAP while the decoder is still
 *   working on the next one (none is waiting),
 * and if so suspends the AudioContext. That stops the clock and the audio
 * already scheduled together, at the same instant, so what arrives while
 * waiting is on time, not late. The spinner shows. Playback goes on once
 * RESUME_AT of audio is scheduled ahead and the next frame is decoded.
 *
 * Play, pause, seek and load clear it: play resumes the context itself.
 */
import { Logger } from '../../shared/utils/Logger.js';

/** Stall when less audio than this (seconds) is scheduled ahead. */
export const STALL_AT = 0.1;
/** Go on when this much (seconds) is. */
export const RESUME_AT = 1.0;
/** Stall when no frame has been shown for this long (seconds of clock) and the next is still being decoded. */
export const VIDEO_GAP = 0.5;
/** Not judged in the first moments after the audio starts: it is still filling. */
const AUDIO_GRACE = 0.5;
/** Background work (seek-bar thumbnails) waits for this much audio ahead. */
export const HEADROOM = 1.5;   // the audio pump keeps 2–3 s ahead while it can

/**
 * Per player: where the scheduled audio ends (AudioContext time), when the
 * current audio iterator started, and whether it has run to the end.
 * @typedef {{until: number, startedAt: number, finished: boolean}} AudioAhead
 */
/** @type {WeakMap<object, AudioAhead>} */
const audioAhead = new WeakMap();
/** AudioContext time of the last frame shown, per player. @type {WeakMap<object, number>} */
const lastFrameAt = new WeakMap();
/** Players waiting for data. @type {WeakSet<object>} */
const stalled = new WeakSet();

/**
 * A new audio iterator started (AudioEngine).
 * @param {any} player
 */
export function noteAudioStarted(player) {
    const now = player.audioContext?.currentTime ?? 0;
    audioAhead.set(player, { until: now, startedAt: now, finished: false });
}

/**
 * Audio is scheduled up to `until` (AudioContext time).
 * @param {any} player
 * @param {number} until
 */
export function noteAudioScheduled(player, until) {
    const state = audioAhead.get(player);
    if (state) state.until = Math.max(state.until, until);
}

/**
 * The audio iterator ran to the end of the file: nothing more will come.
 * @param {any} player
 */
export function noteAudioFinished(player) {
    const state = audioAhead.get(player);
    if (state) state.finished = true;
}

/**
 * A frame was shown (RenderLoop).
 * @param {any} player
 */
export function noteFramePresented(player) {
    lastFrameAt.set(player, player.audioContext?.currentTime ?? 0);
}

/**
 * Whether the player is waiting for data (the clock is held).
 * @param {any} player
 */
export function isPlayerStalled(player) {
    return stalled.has(player);
}

/**
 * Leave the waiting state without resuming anything: play, pause, seek and
 * load take over the AudioContext themselves.
 * @param {any} player
 */
export function clearPlayerStall(player) {
    if (!stalled.delete(player)) return;
    player.setLoading?.(false);
}

/**
 * Seconds of audio scheduled ahead of the clock; Infinity when there is no
 * audio to wait for (none in the file, or the iterator reached the end).
 * @param {any} player
 */
function secondsOfAudioAhead(player) {
    if (!player.audioSink) return Infinity;
    const state = audioAhead.get(player);
    if (!state || state.finished) return Infinity;
    return (state.until - player.audioContext.currentTime) * (player.playbackRate || 1);
}

/** @param {any} player */
function audioStillFilling(player) {
    const state = audioAhead.get(player);
    return !state || player.audioContext.currentTime - state.startedAt < AUDIO_GRACE;
}

/**
 * The decoder is working on the next frame, none is waiting, and none has
 * been shown for VIDEO_GAP.
 * @param {any} player
 */
function videoStarved(player) {
    const frames = player.frames;
    if (!player.videoTrack || !frames?.isOpen || frames.pending || !frames.isFetching) return false;
    const shown = lastFrameAt.get(player);
    if (shown === undefined) return false;
    return (player.audioContext.currentTime - shown) * (player.playbackRate || 1) > VIDEO_GAP;
}

/**
 * Called by the render loop on each frame while playing.
 * @param {any} player
 */
export function checkPlayerBuffering(player) {
    const ctx = player.audioContext;
    if (!ctx || player.isLive || player.isStreamMode || !player.vodAnchor?.isAnchored) return;
    if (!player.isPlaying) { clearPlayerStall(player); return; }

    const ahead = secondsOfAudioAhead(player);
    if (!stalled.has(player)) {
        if (ctx.state !== 'running') return;
        const audioLow = ahead < STALL_AT && !audioStillFilling(player);
        if (!audioLow && !videoStarved(player)) return;
        stalled.add(player);
        Logger.log(`[Buffering] Waiting for data at ${player.currentTime?.toFixed(3)}s `
            + `(audio ahead ${Number.isFinite(ahead) ? `${(ahead * 1000).toFixed(0)}ms` : 'n/a'}, `
            + `video ${videoStarved(player) ? 'starved' : 'ok'})`);
        player.setLoading(true);
        ctx.suspend().catch(() => { /* closed: the next load makes a new one */ });
        return;
    }

    const frameReady = !player.videoTrack || !player.frames?.isOpen || !!player.frames.pending;
    if (ahead >= RESUME_AT && frameReady) {
        stalled.delete(player);
        Logger.log(`[Buffering] Data caught up — playing on from ${player.currentTime?.toFixed(3)}s`);
        player.setLoading(false);
        ctx.resume().catch(() => { /* play() resumes it if this did not */ });
    }
}

/**
 * Resolves when background work on the same source (seek-bar thumbnails) can
 * go on without starving playback: the player is paused, or is not waiting
 * and has HEADROOM of audio scheduled ahead. Polled; `isCancelled` ends it.
 * @param {any} player
 * @param {() => boolean} [isCancelled]
 * @returns {Promise<void>}
 */
export async function whenPlayerHasHeadroom(player, isCancelled = () => false) {
    for (;;) {
        if (isCancelled() || !player.isPlaying || player.isLive) return;
        if (!stalled.has(player) && secondsOfAudioAhead(player) >= HEADROOM) return;
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
}

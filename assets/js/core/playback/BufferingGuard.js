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
 *   working on the next one (none is waiting), or
 * - the frames the decoder hands over are already VIDEO_LAG behind the clock
 *   (they would be skipped as late, one after another),
 * and if so suspends the AudioContext. That stops the clock and the audio
 * already scheduled together, at the same instant, so what arrives while
 * waiting is on time, not late. The spinner shows. Playback goes on once
 * enough audio is scheduled ahead and the next frame is decoded: RESUME_AT
 * the first time, twice as much each time it has to wait again soon after
 * (up to MAX_RESUME_AT) -- on a link slower than the video, a few longer
 * waits rather than one every couple of seconds.
 *
 * Play, pause, seek and load clear it: play resumes the context itself.
 *
 * **A wait sized to the link** (ARCHITECTURE_PLAN.md U5). For a remote file
 * played through the buffer, the store measures the link and the downloader
 * knows the video's bitrate. When the link is slower than the video (with
 * MARGIN to spare), waiting 1–4 s at a time means stopping every few seconds:
 * instead the wait lasts until the bytes downloaded ahead cover HORIZON_S of
 * play (or the rest of the file) without another stop, `(bitrate − link) ×
 * horizon`, but never longer than MAX_WAIT_S, recomputed as the link changes. The time left is announced
 * (`bufferwaitchange`, shown under the spinner), and `playNow()` goes on at
 * once, with the short waits for the rest of this stretch (until the next
 * seek or load). On a link faster than the video it is the wait it was.
 */
import { Logger } from '../../shared/utils/Logger.js';

/** Stall when less audio than this (seconds) is scheduled ahead. */
export const STALL_AT = 0.1;
/** Go on when this much (seconds) is... */
export const RESUME_AT = 1.0;
/** ...doubled for each wait that comes within REPEAT_WINDOW of the last, up to this. */
export const MAX_RESUME_AT = 4.0;
/** A wait this soon (ms) after the last one ended counts as a repeat. */
const REPEAT_WINDOW_MS = 10000;
/** How far ahead the audio pump reads normally (seconds); AudioEngine. */
const NORMAL_LEAD = 3.0;
/** Stall when no frame has been shown for this long (seconds of clock) and the next is still being decoded. */
export const VIDEO_GAP = 0.5;
/** Stall when the frames decoded are this far (seconds) behind the clock. */
export const VIDEO_LAG = 0.3;
/** Not judged in the first moments after the audio starts: it is still filling. */
const AUDIO_GRACE = 0.5;
/** The video plays this many seconds without stopping after a sized wait... */
export const HORIZON_S = 600;
/**
 * ...unless that takes longer than this to download: a wait is never sized
 * past half a minute. On a device (link 0.6 MB/s, film 0.95 MB/s) the full
 * horizon meant a countdown of several minutes, and Play now was pressed
 * each time after about 20 s; half a minute's wait buys about three
 * quarters of a minute of play there.
 */
export const MAX_WAIT_S = 30;
/** The link counts as fast enough above this share of the video's bitrate. */
export const MARGIN = 1.1;
/** Background work (seek-bar thumbnails) waits for this much audio ahead. */
export const HEADROOM = 2.5;   // the audio pump keeps 2–3 s ahead when the source keeps up

/**
 * Per player: where the scheduled audio ends (AudioContext time), when the
 * current audio iterator started, and whether it has run to the end.
 * @typedef {{until: number, startedAt: number, finished: boolean}} AudioAhead
 */
/** @type {WeakMap<object, AudioAhead>} */
const audioAhead = new WeakMap();
/** AudioContext time of the last frame shown, per player. @type {WeakMap<object, number>} */
const lastFrameAt = new WeakMap();
/** How far (seconds) behind the clock the last frame decoded was; 0 when on time. @type {WeakMap<object, number>} */
const videoLag = new WeakMap();
/** Players waiting for data. @type {WeakSet<object>} */
const stalled = new WeakSet();
/**
 * Players whose AudioContext is being resumed. They stay `stalled` until it
 * is running: in between, the context is still suspended, and a clock that
 * no longer counted it as held fell back to its wall-clock reckoning from
 * the last play -- after a long wait, seconds ahead, which ran the file to
 * its end in an instant.
 * @type {WeakSet<object>}
 */
const resuming = new WeakSet();
/**
 * Per player: the audio wanted ahead before playing on, when the current wait
 * began, and when the last one ended (performance.now()).
 * @type {WeakMap<object, {goal: number, since: number, endedAt: number}>}
 */
const waits = new WeakMap();
/** Players told to go on (playNow) until the next seek or load. @type {WeakSet<object>} */
const quick = new WeakSet();
/** Seconds left of a sized wait, as last announced, per player. @type {WeakMap<object, number|null>} */
const announced = new WeakMap();

/**
 * The bytes a sized wait wants downloaded ahead before playing on, and how
 * many are; null when there is nothing to size (not a buffered remote file,
 * the link not measured yet, or fast enough).
 * @param {any} player
 * @returns {{want: number, have: number, rate: number}|null}
 */
export function sizedWait(player) {
    const remote = player.media?.remote;
    if (!remote || quick.has(player)) return null;
    const rate = remote.file.linkRate();
    const byteRate = remote.downloader.byteRate;
    if (!rate || !byteRate) return null;
    const need = byteRate * (player.playbackRate || 1) * MARGIN;
    if (rate >= need) return null;
    const horizon = Math.max(0, Math.min(HORIZON_S, (player.duration || 0) - (player.currentTime || 0)));
    const file = remote.file;
    const cursor = remote.downloader.cursor;
    // Never more than the downloader will fetch ahead, nor than there is
    // left of the file from where it reads: the reads run ahead of the
    // picture, so near the end the bytes for the rest of the time can be
    // more than the file has left after them (a wait that never ended).
    const ahead = remote.downloader.aheadPieces() * file.pieceSize * 0.9;
    const left = Math.max(0, file.size - cursor * file.pieceSize);
    const want = Math.min((need - rate) * horizon, rate * MAX_WAIT_S, ahead, left);
    const have = file.contiguousFrom(cursor);
    return { want, have, rate };
}

/**
 * Seconds left of the current wait, when it is a sized one; null otherwise.
 * @param {any} player
 * @returns {number|null}
 */
export function bufferWaitSecondsLeft(player) {
    if (!stalled.has(player)) return null;
    const sized = sizedWait(player);
    if (!sized || sized.have >= sized.want) return null;
    return Math.ceil((sized.want - sized.have) / sized.rate);
}

/** @param {any} player */
function announceWait(player) {
    const left = bufferWaitSecondsLeft(player);
    if (announced.get(player) === left) return;
    announced.set(player, left);
    player.trigger?.('bufferwaitchange', { waiting: stalled.has(player), secondsLeft: left });
}

/**
 * Go on now, while waiting for data (the "Play now" button): the short waits
 * apply for the rest of this stretch, until the next seek or load.
 * @param {any} player
 */
export function skipBufferWait(player) {
    if (stalled.has(player)) Logger.log(`[Buffering] Play now at ${player.currentTime?.toFixed(3)}s: short waits until the next seek or load`);
    quick.add(player);
    const wait = waits.get(player);
    if (wait) wait.goal = RESUME_AT;
    checkPlayerBuffering(player);
}

/**
 * A seek or a load: a sized wait applies again.
 * @param {any} player
 */
export function resetBufferWaitChoice(player) {
    quick.delete(player);
}

/**
 * How far ahead of the clock the audio pump may read (seconds): further
 * while waiting for a bigger cushion than it would normally keep.
 * @param {any} player
 */
export function audioLeadLimit(player) {
    const goal = waits.get(player)?.goal ?? RESUME_AT;
    return Math.max(NORMAL_LEAD, goal + 0.5);
}

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
 * Playback (re)started: nothing is behind yet. RenderLoop.
 * @param {any} player
 */
export function notePlaybackStarted(player) {
    noteFramePresented(player);
    videoLag.set(player, 0);
}

/**
 * A frame came from the decoder `lag` seconds behind the clock (0: on time,
 * it waits for its moment). RenderLoop.
 * @param {any} player
 * @param {number} lag
 */
export function noteFrameLag(player, lag) {
    videoLag.set(player, lag);
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
    resuming.delete(player);
    if (!stalled.delete(player)) return;
    player.setLoading?.(false);
    announceWait(player);
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
    if ((videoLag.get(player) ?? 0) > VIDEO_LAG) return true;
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
        const now = performance.now();
        const last = waits.get(player);
        const repeat = !!last && now - last.endedAt < REPEAT_WINDOW_MS;
        const goal = repeat ? Math.min(last.goal * 2, MAX_RESUME_AT) : RESUME_AT;
        waits.set(player, { goal, since: now, endedAt: last?.endedAt ?? -Infinity });
        const sized = sizedWait(player);
        Logger.log(`[Buffering] Waiting for data at ${player.currentTime?.toFixed(3)}s `
            + `(audio ahead ${Number.isFinite(ahead) ? `${(ahead * 1000).toFixed(0)}ms` : 'n/a'}, `
            + `video ${videoStarved(player) ? 'starved' : 'ok'}; playing on with ${goal.toFixed(1)}s ahead`
            + `${sized ? `, and ${(sized.want / 1048576).toFixed(0)} MB downloaded ahead: the link gives `
                + `${(sized.rate / 1024).toFixed(0)} KB/s, the video needs more` : ''})`);
        player.setLoading(true);
        ctx.suspend().catch(() => { /* closed: the next load makes a new one */ });
        announceWait(player);
        return;
    }

    const wait = waits.get(player);
    const goal = wait?.goal ?? RESUME_AT;
    const frameReady = !player.videoTrack || !player.frames?.isOpen || !!player.frames.pending;
    // On a link slower than the video: enough downloaded to play on for a while.
    const sized = sizedWait(player);
    const enoughAhead = !sized || sized.have >= sized.want;
    announceWait(player);
    // At the end of the file there is no more to wait for.
    if ((ahead >= goal || ahead === Infinity) && frameReady && enoughAhead && !resuming.has(player)) {
        resuming.add(player);
        const finish = () => {
            // Paused, seeked or reloaded meanwhile: they own the context now.
            if (!resuming.delete(player) || !stalled.delete(player)) return;
            const now = performance.now();
            if (wait) wait.endedAt = now;
            Logger.log(`[Buffering] Data caught up — playing on from ${player.currentTime?.toFixed(3)}s `
                + `after ${wait ? ((now - wait.since) / 1000).toFixed(1) : '?'}s`);
            player.setLoading(false);
        };
        ctx.resume().then(finish, finish);   // a failed resume: play() resumes it
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

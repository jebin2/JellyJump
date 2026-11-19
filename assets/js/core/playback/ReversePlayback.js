import { Logger } from '../../shared/utils/Logger.js';
import { BackwardFrameReader } from '../../processing/shared/BackwardFrames.js';

/**
 * ReversePlayback - plays the loaded video backwards, from wherever it is.
 *
 * Kept apart from the forward pipeline rather than threaded through it. That
 * pipeline is driven by the audio clock, a forward frame queue and decoder
 * rebuilds, all of which assume time moves forwards; reverse playback has its
 * own clock and its own frames, and when it stops it hands the position back
 * so play, seek and pause carry on from there as normal.
 *
 * Frames come from BackwardFrameReader, which decodes a stretch forwards once
 * and hands it out backwards. Two readers take turns: while one is being
 * shown, the other decodes the stretch before it, so the picture does not
 * stall at every key frame. Each holds fewer frames than the reader's default,
 * since together they hold twice as many.
 *
 * What they hold are screen-sized copies, not the decoder's own frames: each
 * decoded frame is drawn (with the file's rotation, as the forward path's
 * CanvasSink applies it) and released straight away. A hardware decoder keeps
 * only a few frames of its own and can stop producing more while they are
 * held -- invisible in software decoding, where this was first measured, and
 * exactly a reverse play that never starts on a real GPU.
 *
 * Silent: reversed audio is not played.
 */

/** Frames each reader holds; two readers run at once. */
const FRAMES_PER_READER = 24;
/** Start decoding the next stretch back when this little is left, in seconds. */
const PREFETCH_LEAD = 0.5;
/** Two timestamps this close are the same instant. */
const EPSILON = 1e-6;
/** Closer than this to the start, there is nothing to play back from. */
const AT_START = 0.05;
/** Give up on starting if the first frames take longer than this. */
const START_TIMEOUT_MS = 8000;

export class ReversePlayback {
    constructor(player) {
        this.player = player;
        this.active = false;
        this._raf = null;
        this._readers = null;
        this._canvas = null;
    }

    /** Why the loaded media cannot be played backwards, or null if it can. */
    get unavailableReason() {
        const p = this.player;
        if (p.engine === 'youtube') return 'YouTube videos cannot be played backwards.';
        if (p.isLive || p.isStreamMode) return 'A live stream cannot be played backwards.';
        if (!p.videoTrack) return 'There is no video to play backwards.';
        return null;
    }

    /**
     * Start playing backwards from the current position -- or from the end,
     * when at the start, where there is nothing behind to play.
     * @returns {Promise<{started: boolean, reason?: string}>} a reason, meant
     *   for the user, when it did not start
     */
    async start() {
        const p = this.player;
        if (this.active) return { started: true };
        const unavailable = this.unavailableReason;
        if (unavailable) return { started: false, reason: unavailable };
        if (p.isPlaying) p.pause(false);
        // The forward pipeline's decoder is let go: a GPU allows only a few
        // hardware decoders at once, and a third one opening behind the paused
        // player's can wait for ever. Stopping rebuilds it at the new position.
        p.frames?.abandon?.();

        this._start = Math.max(0, await p.videoTrack.getFirstTimestamp().catch(() => 0));
        const end = p.duration || 0;
        let from = Math.min(p.currentTime || 0, end);
        if (from <= this._start + AT_START) from = end;
        if (!(from > this._start + AT_START)) return { started: false, reason: 'This video is too short to play backwards.' };

        const toHeld = (sample) => this._copy(sample);
        this._readers = [0, 1].map(() => new BackwardFrameReader(p.videoTrack, { maxFrames: FRAMES_PER_READER, toHeld }));
        this._shown = this._readers[0];
        this._lastDrawn = null;
        this._origin = { position: from, wall: performance.now(), rate: p.playbackRate || 1 };
        this.position = from;
        this.active = true;
        p._updatePlayPauseUI();
        p.trigger?.('reversechange', { active: true });
        Logger.log(`[Reverse] Playing backwards from ${from.toFixed(3)}s at ${this._origin.rate}x`);

        // The first stretch is waited for, so the picture starts moving at
        // once -- but not for ever: a decoder that never delivers would
        // otherwise leave a button that seems to do nothing.
        let timer;
        const timedOut = new Promise(resolve => { timer = setTimeout(() => resolve('timeout'), START_TIMEOUT_MS); });
        let outcome;
        try {
            outcome = await Promise.race([this._fillLogged(this._shown, from).then(() => 'ok'), timedOut]);
        } catch (error) {
            Logger.warn('[Reverse] Could not decode the first stretch:', error);
            outcome = 'error';
        } finally {
            clearTimeout(timer);
        }
        if (!this.active) return { started: false };
        if (outcome !== 'ok' || this._shown.peek(from) === undefined) {
            Logger.warn(`[Reverse] Gave up starting (${outcome})`);
            await this.stop({ reposition: false });
            return { started: false, reason: 'This video could not be decoded backwards here.' };
        }
        this._raf = requestAnimationFrame(() => this._tick());
        return { started: true };
    }

    /**
     * Stop, and leave the player paused where reverse playback got to.
     * @param {{ reposition?: boolean }} [options] - false when the media is
     *   being replaced, so there is nothing to reposition
     */
    async stop({ reposition = true } = {}) {
        if (!this.active) return;
        const p = this.player;
        this.active = false;
        cancelAnimationFrame(this._raf);
        this._raf = null;
        for (const reader of this._readers ?? []) reader.close();
        this._readers = null;
        p._updatePlayPauseUI();
        p.trigger?.('reversechange', { active: false });
        Logger.log(`[Reverse] Stopped at ${this.position.toFixed(3)}s`);

        if (reposition) {
            // The forward pipeline is rebuilt at the new position, so the next
            // play, step or seek starts from here rather than from where
            // forward playback last was.
            await p._seekTo(this.position);
        }
    }

    /** @private */
    _tick() {
        if (!this.active) return;
        const p = this.player;
        const { position, wall, rate } = this._origin;
        const t = Math.max(this._start, position - ((performance.now() - wall) / 1000) * rate);
        this.position = t;

        this._show(t);

        p.currentTime = t;
        p.playbackTimeAtStart = t;
        p.trigger?.('timeupdate', { currentTime: t });
        p._updateProgress();
        if (p.subtitles?.enabled) p._renderSubtitles(t);

        if (t <= this._start + EPSILON) {
            this.stop();
            return;
        }
        this._raf = requestAnimationFrame(() => this._tick());
    }

    /**
     * Draw the frame for `t` if it is held, swap to the other reader when it
     * has the stretch, and keep the stretch before decoding.
     * @private
     */
    _show(t) {
        const [a, b] = this._readers;
        const other = this._shown === a ? b : a;

        let frame = this._shown.peek(t);
        if (frame === undefined && other.peek(t) !== undefined) {
            this._shown = other;
            frame = this._shown.peek(t);
        }
        // One decoder at a time, for the same reason the forward one was let
        // go: never two fills at once.
        const decoding = a.busy || b.busy;
        if (frame === undefined) {
            // Neither has it: fetched now, and the last frame stays up until
            // it arrives. Only happens if decoding falls behind.
            if (!decoding) this._fillLogged(this._shown, t).catch(error => Logger.warn('[Reverse] Decoding failed:', error));
            return;
        }
        if (frame && frame !== this._lastDrawn) {
            this._draw(frame);
            this._lastDrawn = frame;
        }

        // Nearly through the held stretch: the idle reader decodes the one
        // before it.
        const next = this._shown === a ? b : a;
        const oldest = this._shown.oldest;
        const lead = PREFETCH_LEAD * this._origin.rate;
        if (oldest !== null && oldest > this._start + EPSILON && t - oldest < lead
            && !decoding && next.peek(oldest - EPSILON) === undefined) {
            this._fillLogged(next, oldest - EPSILON).catch(error => Logger.warn('[Reverse] Prefetch failed:', error));
        }
    }

    /**
     * fill(), with a line before and after: where reverse playback is waiting,
     * when it waits, is the first thing to know.
     * @private
     */
    async _fillLogged(reader, t) {
        const began = performance.now();
        const decodedBefore = reader.decodedFrames;
        Logger.log(`[Reverse] Decoding the stretch up to ${t.toFixed(3)}s`);
        await reader.fill(t);
        Logger.log(`[Reverse] Ready up to ${t.toFixed(3)}s: ${reader.held.length} frames held, `
            + `${reader.decodedFrames - decodedBefore} decoded, ${Math.round(performance.now() - began)}ms`);
    }

    /**
     * A decoded frame as a screen-sized image, so the decoder's frame can be
     * released at once. Drawn with the file's rotation and flip, as the
     * forward path's CanvasSink draws it.
     * @private
     */
    async _copy(sample) {
        const p = this.player;
        const width = p.canvas?.width || sample.displayWidth;
        const height = p.canvas?.height || sample.displayHeight;
        if (!this._canvas || this._canvas.width !== width || this._canvas.height !== height) {
            this._canvas = new OffscreenCanvas(width, height);
            this._canvasCtx = this._canvas.getContext('2d');
        }
        this._canvasCtx.clearRect(0, 0, width, height);
        sample.drawWithFit(this._canvasCtx, { fit: 'contain' });
        // Synchronous, so two readers filling at once cannot interleave on
        // the shared canvas.
        const bitmap = this._canvas.transferToImageBitmap();
        return { timestamp: sample.timestamp, bitmap, close: () => bitmap.close() };
    }

    /** Through the player's own presentFrame, so filters and overlays apply. @private */
    _draw(frame) {
        this.player.presentFrame(frame.bitmap, { clear: true });
    }
}

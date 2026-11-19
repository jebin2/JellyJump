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
 * Silent: reversed audio is not played.
 */

/** Frames each reader holds; two readers run at once. */
const FRAMES_PER_READER = 24;
/** Start decoding the next stretch back when this little is left, in seconds. */
const PREFETCH_LEAD = 0.5;
/** Two timestamps this close are the same instant. */
const EPSILON = 1e-6;

export class ReversePlayback {
    constructor(player) {
        this.player = player;
        this.active = false;
        this._raf = null;
        this._readers = null;
        this._scratch = null;
    }

    /** Whether the loaded media can be played backwards. */
    get available() {
        const p = this.player;
        return !!p.videoTrack && !p.isLive && !p.isStreamMode && p.engine !== 'youtube';
    }

    /**
     * Start playing backwards from the current position.
     * @returns {Promise<boolean>} whether it started
     */
    async start() {
        const p = this.player;
        if (this.active || !this.available) return false;
        if (p.isPlaying) p.pause(false);

        this._start = Math.max(0, await p.videoTrack.getFirstTimestamp().catch(() => 0));
        const from = Math.min(p.currentTime || 0, p.duration || Infinity);
        if (from <= this._start + EPSILON) return false;

        this._readers = [0, 1].map(() => new BackwardFrameReader(p.videoTrack, { maxFrames: FRAMES_PER_READER }));
        this._shown = this._readers[0];
        this._lastDrawn = null;
        this._origin = { position: from, wall: performance.now(), rate: p.playbackRate || 1 };
        this.position = from;
        this.active = true;
        p._updatePlayPauseUI();
        p.trigger?.('reversechange', { active: true });
        Logger.log(`[Reverse] Playing backwards from ${from.toFixed(3)}s at ${this._origin.rate}x`);

        // The first stretch is waited for, so the picture starts moving at once.
        await this._shown.fill(from);
        if (!this.active) return false;
        this._raf = requestAnimationFrame(() => this._tick());
        return true;
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
        if (frame === undefined) {
            // Neither has it: fetched now, and the last frame stays up until
            // it arrives. Only happens if decoding falls behind.
            if (!this._shown.busy) this._shown.fill(t);
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
            && !next.busy && next.peek(oldest - EPSILON) === undefined) {
            next.fill(oldest - EPSILON).catch(error => Logger.warn('[Reverse] Prefetch failed:', error));
        }
    }

    /** Through the player's own presentFrame, so filters and overlays apply. @private */
    _draw(frame) {
        const p = this.player;
        if (!p.canvas) return;
        if (!this._scratch || this._scratch.width !== p.canvas.width || this._scratch.height !== p.canvas.height) {
            this._scratch = new OffscreenCanvas(p.canvas.width, p.canvas.height);
            this._scratchCtx = this._scratch.getContext('2d');
        }
        this._scratchCtx.clearRect(0, 0, this._scratch.width, this._scratch.height);
        // Applies the file's rotation and flip, as the forward path's
        // CanvasSink does.
        frame.drawWithFit(this._scratchCtx, { fit: 'contain' });
        p.presentFrame(this._scratch, { clear: true });
    }
}

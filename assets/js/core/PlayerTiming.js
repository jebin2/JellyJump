// @ts-check
/**
 * The player's timings for Diagnostics (ARCHITECTURE_PLAN.md P3): how long
 * from load() to the first frame on screen, from a seek to the frame at the
 * new position, and how many frames playback had to skip for being late.
 *
 * Fed from three places only: Player.load and Player._seekTo start a timing,
 * Player.presentFrame ends it, and the render loop reports each late frame
 * it skips. It reads nothing from the player and changes nothing.
 */
import { Metrics } from '../shared/diagnostics/Metrics.js';

/**
 * After a load or seek the frame iterator starts behind the clock and skips
 * ahead to catch up. Those skips are the seek, not dropped frames.
 */
const CATCH_UP_MS = 500;

const now = () => globalThis.performance?.now() ?? Date.now();

export class PlayerTiming {
    constructor() {
        /** @type {{kind: 'firstFrame'|'seek', stop: () => number}|null} */
        this.pending = null;
        this.settledAt = -Infinity;
    }

    loadStarted() {
        this.pending = { kind: 'firstFrame', stop: Metrics.start('firstFrame') };
    }

    seekStarted() {
        // A load still waiting for its first frame is not a seek.
        if (this.pending?.kind === 'firstFrame') return;
        // A newer seek replaces one still in flight: scrubbing is measured
        // from the last position asked for.
        this.pending = { kind: 'seek', stop: Metrics.start('seek') };
    }

    framePresented() {
        if (this.pending) {
            this.pending.stop();
            this.pending = null;
            this.settledAt = now();
        }
        Metrics.count('framesShown');
    }

    /** The render loop skipped a frame for being behind the clock. */
    lateFrame() {
        if (this.pending || now() - this.settledAt < CATCH_UP_MS) return;
        Metrics.count('droppedFrames');
    }
}

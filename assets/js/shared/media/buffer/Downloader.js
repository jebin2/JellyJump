// @ts-check
/**
 * Keeps fetching a remote file ahead of where the player reads it
 * (ARCHITECTURE_PLAN.md phase U, ADR 0013), playing or paused.
 *
 * Where the player is comes from its reads, not from a guess of which byte
 * a time is at: the demuxer reads what it is about to play, whatever the
 * container. So the downloader follows a seek by itself.
 *
 * - **Load.** The reads made while a file opens (its header, and its index,
 *   which an MP4 not made "faststart" or an MKV keep at the end) are pinned:
 *   they are read again on every seek, so they stay as long as the file does.
 *   Reads of pinned pieces never move where the downloader works.
 * - **Ahead.** From the piece being read, in order, one piece at a time, up
 *   to `ahead` (AHEAD_SECONDS of the video, from its average bitrate, within
 *   the file's share of the budget). A piece a reader waits on is the
 *   store's to fetch at once; this is the read-ahead, and it starts only when
 *   nothing else of the file is being fetched. Two requests side by side
 *   share the link: after a seek, the piece the player was waiting on came
 *   in at half the link's rate, under the video's on a link faster than it
 *   (seen on a device: ~1.2 MB/s link, ~0.95 MB/s film, waits of up to 7 s).
 * - **A jump** (a seek: a read outside the window) counts once reads settle
 *   (SETTLE_MS), so dragging the seek bar does not start and abort a fetch
 *   per step. Then fetches the jump left behind are aborted.
 * - **Room.** The file may keep up to its share of the budget. Over it, the
 *   pieces furthest from where it reads go first, the ones behind before the
 *   ones ahead; never pinned ones, never those within BEHIND_SECONDS behind.
 *   A file that fits keeps everything, and once complete plays without the
 *   network.
 * - **Phone data.** On a metered connection (`navigator.connection.saveData`,
 *   or a cellular one where the browser says so) it reads METERED_AHEAD_S
 *   ahead and nothing while paused.
 * - **Failures** are retried with a growing wait (up to MAX_RETRY_S), and at
 *   once when the page comes back online or to the front.
 */
import { Logger } from '../../utils/Logger.js';

/** How far ahead to fetch, in seconds of the video. */
export const AHEAD_SECONDS = 20 * 60;
/** How far behind to keep, in seconds of the video. */
export const BEHIND_SECONDS = 5 * 60;
/** Before the duration is known, fetch this many pieces ahead. */
const AHEAD_PIECES_UNKNOWN = 4;
/** A jump counts once reads have stayed there this long (ms). */
export const SETTLE_MS = 300;
/** The most one file may keep, as a share of the budget. */
export const FILE_SHARE = 0.8;
/** Longest wait between retries (s). */
const MAX_RETRY_S = 16;
/** How far ahead on a metered connection (s of video). */
export const METERED_AHEAD_S = 120;

/** Whether the connection costs per byte, as far as the browser says. */
export function isMetered() {
    const connection = /** @type {any} */ (globalThis.navigator)?.connection;
    return !!connection && (connection.saveData === true || connection.type === 'cellular');
}

/** @typedef {import('./PieceStore.js').BufferedFile} BufferedFile */

export class Downloader {
    /**
     * @param {BufferedFile} file
     * @param {{budget: number, aheadSeconds?: number, behindSeconds?: number,
     *   isPlaying?: () => boolean, metered?: () => boolean}} options - the
     *   store's budget (bytes), the window (seconds of video), whether the
     *   player is playing, and whether the connection is metered
     */
    constructor(file, { budget, aheadSeconds = AHEAD_SECONDS, behindSeconds = BEHIND_SECONDS,
        isPlaying = () => true, metered = isMetered }) {
        this.file = file;
        this.isPlaying = isPlaying;
        this.metered = metered;
        this.aheadSeconds = aheadSeconds;
        this.behindSeconds = behindSeconds;
        /** Bytes this file may keep. */
        this.allowance = Math.max(file.pieceSize * 4, Math.floor(budget * FILE_SHARE));
        /** Bytes of video per second; null until the duration is known. */
        this.byteRate = /** @type {number|null} */ (null);
        /** While the file opens, every piece read is pinned. */
        this.loading = true;
        /** The piece the player reads (where the window is). */
        this.cursor = 0;
        /** The last read outside the window, waiting to settle; null if none. */
        this.jumpTo = /** @type {number|null} */ (null);
        /** @type {ReturnType<typeof setTimeout>|null} */
        this.jumpTimer = null;
        this.running = false;
        this.stopped = false;
        this.failures = 0;
        /** @type {(() => void)|null} wakes the loop */
        this.wakeUp = null;
        this.onOnline = () => { this.failures = 0; this.wake(); };
        this.onVisible = () => { if (document.visibilityState === 'visible') this.onOnline(); };
    }

    /** Start fetching. */
    start() {
        if (this.running || this.stopped) return;
        this.running = true;
        globalThis.addEventListener?.('online', this.onOnline);
        globalThis.document?.addEventListener('visibilitychange', this.onVisible);
        this.loop().catch((error) => Logger.warn('[Buffer] The downloader stopped:', error));
    }

    /** Stop for good: fetches it started are aborted, the file is the caller's to close. */
    stop() {
        this.stopped = true;
        this.running = false;
        if (this.jumpTimer) clearTimeout(this.jumpTimer);
        globalThis.removeEventListener?.('online', this.onOnline);
        globalThis.document?.removeEventListener('visibilitychange', this.onVisible);
        this.file.abortExcept(() => false);
        this.wake();
    }

    /**
     * The duration, once known: sizes the window in seconds of video.
     * @param {number} seconds
     */
    setDuration(seconds) {
        if (seconds > 0 && Number.isFinite(seconds)) this.byteRate = this.file.size / seconds;
        this.wake();
    }

    /** The file is open and playing: reads from now on are playback, not its index. */
    loaded() {
        this.loading = false;
        this.wake();
    }

    /** Pieces ahead of the cursor to fetch. */
    aheadPieces() {
        const piece = this.file.pieceSize;
        if (!this.byteRate) return AHEAD_PIECES_UNKNOWN;
        const seconds = this.metered() ? Math.min(this.aheadSeconds, METERED_AHEAD_S) : this.aheadSeconds;
        const bytes = Math.min(this.byteRate * seconds, this.allowance * 0.75);
        return Math.max(1, Math.ceil(bytes / piece));
    }

    /** Pieces behind the cursor always kept. */
    behindPieces() {
        if (!this.byteRate) return 1;
        const bytes = Math.min(this.byteRate * this.behindSeconds, this.allowance * 0.2);
        return Math.max(1, Math.ceil(bytes / this.file.pieceSize));
    }

    /**
     * The player read bytes [start, end).
     * @param {number} start
     * @param {number} end
     */
    noteRead(start, end) {
        const file = this.file;
        const first = file.pieceAt(start);
        const last = file.pieceAt(Math.max(start, end - 1));
        if (this.loading) {
            for (let i = first; i <= last; i++) file.pin(i);
            this.cursor = Math.min(this.cursor, first);
            return;
        }
        const pinned = file.record.meta.pinned;
        if (pinned.includes(first) && pinned.includes(last) && this.cursor !== first) {
            // The file's index, read on a seek: not where playback is.
            return;
        }
        if (last >= this.cursor - this.behindPieces() && first <= this.cursor + this.aheadPieces()) {
            // Within the window: playback moving on.
            if (last > this.cursor) { this.cursor = last; this.wake(); }
            this.jumpTo = null;
            return;
        }
        // Outside it: a seek, or a step of a drag. Counted once reads settle.
        this.jumpTo = first;
        if (this.jumpTimer) clearTimeout(this.jumpTimer);
        this.jumpTimer = setTimeout(() => {
            this.jumpTimer = null;
            if (this.jumpTo === null) return;
            this.cursor = this.jumpTo;
            this.jumpTo = null;
            const from = this.cursor;
            const to = this.cursor + this.aheadPieces();
            this.file.abortExcept((index) => index >= from && index <= to);
            this.wake();
        }, SETTLE_MS);
    }

    wake() {
        const wakeUp = this.wakeUp;
        this.wakeUp = null;
        wakeUp?.();
    }

    /**
     * Wait for wake() or `ms`.
     * @param {number} [ms]
     */
    sleep(ms) {
        return new Promise((resolve) => {
            /** @type {ReturnType<typeof setTimeout>|undefined} */
            let timer;
            this.wakeUp = () => { if (timer) clearTimeout(timer); resolve(undefined); };
            if (ms !== undefined) timer = setTimeout(() => this.wake(), ms);
        });
    }

    /** The next piece to fetch: the first missing one from the cursor, within the window. */
    nextPiece() {
        const file = this.file;
        const end = Math.min(file.pieceCount - 1, this.cursor + this.aheadPieces());
        for (let i = Math.max(0, this.cursor); i <= end; i++) {
            if (!file.has(i) && !file.isFetching(i)) return i;
        }
        return -1;
    }

    /** Over the allowance, delete the pieces furthest from the cursor. */
    async makeRoom() {
        const file = this.file;
        const piece = file.pieceSize;
        let over = file.usage() + piece - this.allowance;
        if (over <= 0) return;
        const keepFrom = this.cursor - this.behindPieces();
        const keepTo = this.cursor + this.aheadPieces();
        const kept = [...file.record.pieces.keys(), ...file.memoryPieces.keys()]
            .filter((i) => i < keepFrom || i > keepTo)
            // Behind first (furthest first), then ahead past the window (furthest first).
            .sort((a, b) => {
                const behindA = a < this.cursor;
                const behindB = b < this.cursor;
                if (behindA !== behindB) return behindA ? -1 : 1;
                return Math.abs(b - this.cursor) - Math.abs(a - this.cursor);
            });
        /** @type {number[]} */
        const drop = [];
        for (const index of kept) {
            if (over <= 0) break;
            if (file.record.meta.pinned.includes(index)) continue;
            drop.push(index);
            over -= piece;
        }
        if (drop.length) await file.forget(drop);
    }

    async loop() {
        while (!this.stopped) {
            if (this.loading) { await this.sleep(); continue; }
            // Paid-for data is not spent on what may never be watched.
            if (this.metered() && !this.isPlaying()) { await this.sleep(1000); continue; }
            // One request at a time: a reader's comes first.
            if (this.file.linkBusy()) { await this.file.whenIdle(); continue; }
            const index = this.nextPiece();
            if (index < 0) {
                // The window is full: finish a piece a seek left behind, if any.
                if (this.file.resumeBackground()) { await this.file.whenIdle(); continue; }
                await this.sleep();
                continue;
            }
            await this.makeRoom();
            try {
                await this.file.ensure(index);
                this.failures = 0;
            } catch (raw) {
                if (this.stopped) return;
                const error = /** @type {{code?: string, message?: string}} */ (raw);
                if (error.code === 'CANCELLED') continue;   // aborted by a jump
                if (error.code === 'SOURCE_CHANGED' || error.code === 'NO_RANGES') {
                    Logger.warn(`[Buffer] Stopped fetching ${this.file.key}: ${error.message}`);
                    return;
                }
                this.failures++;
                const wait = Math.min(MAX_RETRY_S, 2 ** (this.failures - 1));
                Logger.warn(`[Buffer] Fetching piece ${index} failed (${error.message}); trying again in ${wait}s`);
                await this.sleep(wait * 1000);
            }
        }
    }
}

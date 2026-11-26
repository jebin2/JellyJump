// @ts-check
/**
 * The parts of a remote file downloaded, announced for the seek bar
 * (ARCHITECTURE_PLAN.md U4): `bufferchange` with `{ranges}`, time ranges
 * [start, end) in seconds, where a seek plays without the network.
 *
 * Announced once a file is open, then as pieces are kept or let go (at most
 * every THROTTLE_MS: on a fast link pieces come several a second), and empty
 * when the media is let go, so a local file, a stream or a failed load
 * shows none.
 *
 * **Bytes to time.** The store knows bytes; the bar shows time. The share of
 * the file is not the share of the duration: on a device, a seek to 76.5% of
 * an episode read at 79.2% of its bytes, and the shading sat 90 s of the
 * film away from the playhead (behind it, under the played part, after
 * another seek). So the player's own reads place it: every SAMPLE_MS, where
 * the downloader has read up to and the time then, taken only while that
 * pair is steady (playing on at the clock's pace, or paused with neither
 * moving; never during a seek, a wait or a load). Between points, and
 * past the last, a straight line (from the start and to the end of the
 * file).
 *
 * A part only shows once a point is in it (or a piece before it), or when it
 * holds the start of the file: a guess by the share of the file put it in
 * the wrong place for the second or two after a seek, then it jumped to the
 * right one as the video played.
 */
import { isPlayerStalled } from './BufferingGuard.js';

/** At most one announcement this often while pieces come in (ms). */
export const THROTTLE_MS = 500;
/** How often the read position and the time are paired (ms). */
export const SAMPLE_MS = 1000;
/** Playing, the clock may differ from the wall clock by this much between samples (s) and still be steady. */
const STEADY_S = 0.5;
/** Points kept per file; past it, the oldest go. */
const MAX_POINTS = 400;

/**
 * Where in time each byte of a file plays, from points seen: [byte, seconds].
 */
export class ByteClock {
    /**
     * @param {number} size - bytes
     */
    constructor(size) {
        this.size = size;
        /** Sorted by byte, and so by time. @type {Array<{byte: number, time: number, seen: number}>} */
        this.points = [];
        this.seen = 0;
    }

    /**
     * The player read up to `byte` at `time`. Points it contradicts (an
     * earlier byte at a later time, or the reverse) go: the newest is right.
     * @param {number} byte
     * @param {number} time
     * @returns {boolean} whether it is new
     */
    note(byte, time) {
        if (!(byte >= 0 && byte <= this.size) || !(time >= 0) || !Number.isFinite(time)) return false;
        if (this.points.some((p) => p.byte === byte && p.time === time)) return false;
        this.points = this.points.filter((p) => (p.byte < byte && p.time < time) || (p.byte > byte && p.time > time));
        const at = this.points.findIndex((p) => p.byte > byte);
        const point = { byte, time, seen: this.seen++ };
        if (at < 0) this.points.push(point); else this.points.splice(at, 0, point);
        if (this.points.length > MAX_POINTS) {
            const oldest = this.points.reduce((a, b) => (b.seen < a.seen ? b : a));
            this.points.splice(this.points.indexOf(oldest), 1);
        }
        return true;
    }

    /**
     * Whether the bytes [start, end) have been placed: a point seen in them,
     * or within `lead` bytes before (a seek reads from inside a piece, which
     * is then not kept whole).
     * @param {number} start
     * @param {number} end
     * @param {number} [lead]
     */
    placed(start, end, lead = 0) {
        return this.points.some((p) => p.byte >= start - lead && p.byte <= end);
    }

    /**
     * The time a byte plays at.
     * @param {number} byte
     * @param {number} duration - seconds
     */
    timeAt(byte, duration) {
        let before = { byte: 0, time: 0 };
        let after = { byte: this.size, time: duration };
        for (const p of this.points) {
            if (p.time > duration) continue;   // from a longer duration guessed before; never past the end
            if (p.byte <= byte) before = p;
            else { after = p; break; }
        }
        if (after.byte <= before.byte) return before.time;
        const share = (byte - before.byte) / (after.byte - before.byte);
        return Math.min(duration, Math.max(0, before.time + share * (after.time - before.time)));
    }
}

/**
 * A file's downloaded parts that play, as time ranges [start, end) in seconds.
 * @param {{size: number, pieceSize?: number, playableRanges: () => Array<[number, number]>}} file
 * @param {number} duration - seconds
 * @param {ByteClock} [clock] - points seen; without, a byte's share of the
 *   size is its share of the duration
 * @param {{placedOnly?: boolean}} [options] - `placedOnly`: only the parts
 *   the clock has placed, and the one at the start of the file
 * @returns {Array<[number, number]>}
 */
export function downloadedTimeRanges(file, duration, clock = new ByteClock(file.size), { placedOnly = false } = {}) {
    if (!(duration > 0) || !Number.isFinite(duration) || !(file.size > 0)) return [];
    const lead = file.pieceSize ?? 0;
    return file.playableRanges()
        .filter(([start, end]) => !placedOnly || start === 0 || clock.placed(start, end, lead))
        .map(([start, end]) => /** @type {[number, number]} */ ([clock.timeAt(start, duration), clock.timeAt(end, duration)]))
        .filter(([start, end]) => end > start);
}

/** Per player: stops watching the open file. @type {WeakMap<object, () => void>} */
const watching = new WeakMap();

/**
 * Start announcing the downloaded parts of the file just opened (none for
 * a file not played through the buffer).
 * @param {any} player
 */
export function watchDownloadedRanges(player) {
    stopWatching(player);
    const remote = player.media?.remote;
    if (!remote) { player.trigger?.('bufferchange', { ranges: [] }); return; }
    const clock = new ByteClock(remote.file.size);
    const announce = () => {
        if (player.media?.remote !== remote) return;
        player.trigger?.('bufferchange', { ranges: downloadedTimeRanges(remote.file, player.duration, clock, { placedOnly: true }) });
    };
    /** @type {ReturnType<typeof setTimeout>|null} */
    let timer = null;
    const soon = () => {
        if (timer) return;
        timer = setTimeout(() => { timer = null; announce(); }, THROTTLE_MS);
    };
    const stopListening = remote.file.onChange(soon);

    /** The last sample: read position, time, wall clock (ms); null after an unsteady one. */
    let last = /** @type {{byte: number, time: number, at: number}|null} */ (null);
    const sample = () => {
        const downloader = remote.downloader;
        const now = { byte: downloader.readByte, time: player.currentTime, at: performance.now() };
        const settled = !downloader.loading && downloader.jumpTo === null && !isPlayerStalled(player) && !player.isLoading;
        const previous = last;
        last = settled ? now : null;
        if (!previous || !settled) return;
        const steady = player.isPlaying
            ? Math.abs((now.time - previous.time) - ((now.at - previous.at) / 1000) * (player.playbackRate || 1)) < STEADY_S
                && now.byte >= previous.byte
            : now.time === previous.time && now.byte === previous.byte;
        if (steady && clock.note(now.byte, now.time)) soon();
    };
    const sampler = setInterval(sample, SAMPLE_MS);

    watching.set(player, () => {
        stopListening();
        clearInterval(sampler);
        if (timer) clearTimeout(timer);
    });
    announce();
}

/**
 * The media is let go: stop, and clear the shading.
 * @param {any} player
 */
export function stopDownloadedRanges(player) {
    if (!stopWatching(player)) return;
    player.trigger?.('bufferchange', { ranges: [] });
}

/**
 * @param {any} player
 * @returns {boolean} whether it was watching
 */
function stopWatching(player) {
    const stop = watching.get(player);
    if (!stop) return false;
    watching.delete(player);
    stop();
    return true;
}

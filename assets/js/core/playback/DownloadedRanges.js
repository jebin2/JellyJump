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
 */

/** At most one announcement this often while pieces come in (ms). */
export const THROTTLE_MS = 500;

/**
 * A file's downloaded parts that play, as time ranges [start, end) in
 * seconds, placed by its average bitrate: a byte's share of the size is its
 * share of the duration (a few seconds out where the bitrate swings).
 * @param {{size: number, playableRanges: () => Array<[number, number]>}} file
 * @param {number} duration - seconds
 * @returns {Array<[number, number]>}
 */
export function downloadedTimeRanges(file, duration) {
    if (!(duration > 0) || !Number.isFinite(duration) || !(file.size > 0)) return [];
    return file.playableRanges().map(([start, end]) => [(start / file.size) * duration, (end / file.size) * duration]);
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
    const announce = () => {
        if (player.media?.remote !== remote) return;
        player.trigger?.('bufferchange', { ranges: downloadedTimeRanges(remote.file, player.duration) });
    };
    /** @type {ReturnType<typeof setTimeout>|null} */
    let timer = null;
    const stopListening = remote.file.onChange(() => {
        if (timer) return;
        timer = setTimeout(() => { timer = null; announce(); }, THROTTLE_MS);
    });
    watching.set(player, () => {
        stopListening();
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

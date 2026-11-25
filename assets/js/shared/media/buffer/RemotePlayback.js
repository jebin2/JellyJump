// @ts-check
/**
 * A remote file opened for playback through the buffer (ARCHITECTURE_PLAN.md
 * phase U, ADR 0013): its BufferedFile, the Downloader that fetches ahead of
 * it, and the MediaBunny source the player's Input reads through.
 *
 * The files open for playback are listed, so another reader of the same file
 * (its details, read for the playlist and the Info panel) reads the pieces
 * already there instead of fetching them again; such reads never move the
 * downloader.
 *
 * `openRemotePlayback` throws AppError NO_RANGES for a server that cannot
 * send part of a file, and the error of a server not reached for a file
 * never kept; the player then opens it as it did before the buffer.
 */
import { MediaBunny } from '../MediaBunny.js';
import { Logger } from '../../utils/Logger.js';
import { Settings } from '../../settings/Settings.js';
import { Downloader, AHEAD_SECONDS, BEHIND_SECONDS } from './Downloader.js';
import { getRemoteBuffer } from './RemoteBuffer.js';
import { remoteFileKey } from './PieceStore.js';

/** @typedef {import('./PieceStore.js').BufferedFile} BufferedFile */

/** Files open for playback, by key. @type {Map<string, BufferedFile>} */
const openFiles = new Map();

/**
 * A MediaBunny source reading a buffered file.
 * @param {BufferedFile} file
 * @param {(start: number, end: number) => void} [onRead]
 * @returns {any} a MediaBunny CustomSource
 */
export function createBufferedSource(file, onRead) {
    return new MediaBunny.CustomSource({
        getSize: () => file.size,
        read: (/** @type {number} */ start, /** @type {number} */ end) => {
            onRead?.(start, end);
            return file.read(start, end);
        },
        // Exactly what MediaBunny asks for. Its read-ahead (64 KB either side
        // for files, megabytes for networks) would make a reader wait for
        // bytes it does not need, which on a slow link is seconds after a
        // seek; the downloader reads ahead instead, and kept pieces are
        // read from disk.
        prefetchProfile: 'none',
    });
}

/**
 * The open playback file for this URL, if one is open.
 * @param {string} url
 */
export function findOpenRemote(url) {
    return openFiles.get(remoteFileKey(url)) ?? null;
}

/**
 * @typedef {object} RemotePlaybackHandle
 * @property {any} source - the MediaBunny source for the player's Input
 * @property {BufferedFile} file
 * @property {Downloader} downloader
 * @property {(seconds: number) => void} setDuration
 * @property {() => void} loaded - the file is open: start reading ahead
 * @property {() => void} close
 */

/**
 * Open a remote file for playback.
 * @param {string} url
 * @param {{init?: RequestInit}} [options]
 * @returns {Promise<RemotePlaybackHandle>}
 */
export async function openRemotePlayback(url, { init } = {}) {
    const store = await getRemoteBuffer();
    const key = remoteFileKey(url);
    const file = await store.open({ url, key, init });
    const chosen = Settings.get('buffer') ?? {};
    const downloader = new Downloader(file, {
        budget: store.budget,
        aheadSeconds: positive(chosen.ahead) ?? AHEAD_SECONDS,
        behindSeconds: positive(chosen.behind) ?? BEHIND_SECONDS,
    });
    const source = createBufferedSource(file, (start, end) => downloader.noteRead(start, end));
    openFiles.set(key, file);
    downloader.start();
    Logger.log(`[Buffer] Playing ${key} through the buffer (${(file.size / 1048576).toFixed(1)} MB, `
        + `${(file.usage() / 1048576).toFixed(1)} MB already kept, ${store.backend.kind})`);
    let closed = false;
    return {
        source,
        file,
        downloader,
        setDuration: (seconds) => downloader.setDuration(seconds),
        loaded: () => downloader.loaded(),
        close: () => {
            if (closed) return;
            closed = true;
            downloader.stop();
            file.close();
            if (openFiles.get(key) === file) openFiles.delete(key);
        },
    };
}

/**
 * @param {unknown} value
 * @returns {number|undefined}
 */
function positive(value) {
    return typeof value === 'number' && value > 0 && Number.isFinite(value) ? value : undefined;
}

/**
 * Delete what the buffer keeps of a file (its playlist item was removed).
 * @param {string} url
 */
export async function dropRemoteBuffer(url) {
    if (!/^https?:/i.test(url)) return;
    const store = await getRemoteBuffer();
    await store.drop(remoteFileKey(url));
}

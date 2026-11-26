// @ts-check
/**
 * The remote playback buffer's storage (ARCHITECTURE_PLAN.md phase U, ADR 0013).
 *
 * A remote file is cut into fixed pieces (PIECE_SIZE). Each piece is fetched
 * with a range request of its own, which can be aborted cleanly, and kept by
 * a backend: the browser's private file system (OPFS) when it can be used,
 * memory when not. A finished piece is never written again.
 *
 * - `PieceStore` holds every file's pieces, keeps all of them under a budget
 *   (the least recently played file goes first), and opens files.
 * - `BufferedFile` is one open file: `read(start, end)` answers from the
 *   pieces kept and fetches the missing ones, once, however many readers want
 *   them; a reader waiting on a piece being fetched gets its bytes as soon as
 *   they have arrived, not when the whole piece has. Which pieces to fetch
 *   ahead, and which to let go, is the caller's (the downloader, U2): this
 *   only does what it is told, and measures the link while it does.
 *
 * A file is known by a key (`remoteFileKey`), and checked against what the
 * server says it is now: its size and validator (ETag, else Last-Modified),
 * on open and on every piece. A file that changed drops its pieces. One
 * without a validator is kept for the page's session only.
 *
 * Two tabs may open the same file: one holds its lock and keeps its pieces;
 * the other reads those and keeps what it fetches itself in memory.
 */
import { AppError } from '../../errors/AppError.js';
import { Logger } from '../../utils/Logger.js';
import { MemoryBackend } from './MemoryBackend.js';

/** Bytes per piece, at most: what a large file is cut into. */
export const PIECE_SIZE = 4 * 1024 * 1024;
/** Bytes per piece, at least: a small file is cut finer. */
export const MIN_PIECE_SIZE = 64 * 1024;

/**
 * The piece size for a file: a 64th of it, between MIN_PIECE_SIZE and
 * PIECE_SIZE, in whole multiples of 64 KB. A large file gets 4 MB pieces (a
 * film is ~1,500); a small one is not fetched in pieces bigger than itself,
 * and reading its header costs a fraction of it.
 * @param {number} size
 */
export function pieceSizeFor(size) {
    const step = MIN_PIECE_SIZE;
    return Math.min(PIECE_SIZE, Math.max(MIN_PIECE_SIZE, Math.floor(size / 64 / step) * step));
}

/** Attempts for a piece a reader is waiting on, and the wait before each retry (s). */
const READ_RETRY_DELAYS = [1, 2, 4];
/** How long samples of the link are kept (ms). */
const RATE_WINDOW_MS = 30000;
/**
 * The link's rate is over the last this much receiving time (ms). Not the
 * whole window: when the link drops, the seconds before the drop carried
 * most of the bytes and kept the average high for as long as they stayed in
 * it (seen on a device: 10 MB/s, then 0.5 MB/s, still measured as fast).
 */
const RATE_RECENT_MS = 3000;

/**
 * What is kept about a file besides its pieces.
 * @typedef {object} FileMeta
 * @property {string} id - the key's hash: the file's folder name
 * @property {string} key - remoteFileKey(...)
 * @property {number} size - bytes
 * @property {number} pieceSize - the size it was cut with (pieceSizeFor, or the store's fixed one)
 * @property {string} validator - `etag:<value>`, `modified:<value>`, or '' (none)
 * @property {number} lastUsed - Date.now() when last opened or read
 * @property {number[]} pinned - pieces kept whatever the window (the file's index)
 */

/**
 * Where pieces live. Both backends answer the same calls.
 * @typedef {object} PieceBackend
 * @property {'opfs'|'memory'} kind
 * @property {() => Promise<Array<{meta: FileMeta, pieces: Map<number, number>}>>} load
 *   every file kept, with the size of each piece (only whole pieces count; the caller checks)
 * @property {(meta: FileMeta) => Promise<void>} writeMeta
 * @property {(id: string, index: number, bytes: Uint8Array) => Promise<void>} writePiece
 * @property {(id: string, index: number, start: number, end: number) => Promise<Uint8Array|null>} readPiece
 *   bytes [start, end) of the piece; null when it is gone
 * @property {(id: string, index: number) => Promise<Blob|null>} pieceBlob
 *   the whole piece as a Blob (on disk: the file itself, nothing copied); null when gone
 * @property {(id: string, index: number) => Promise<void>} deletePiece
 * @property {(id: string) => Promise<void>} deleteFile
 */

/**
 * @typedef {object} FileRecord
 * @property {FileMeta} meta
 * @property {Map<number, number>} pieces - index -> bytes, for whole pieces only
 * @property {number} openCount
 */

/**
 * A short hash of a string, for a folder name (two FNV-1a 32-bit runs).
 * @param {string} text
 */
export function hashKey(text) {
    let a = 0x811c9dc5;
    let b = 0x01000193 ^ 0x5bd1e995;
    for (let i = 0; i < text.length; i++) {
        const c = text.charCodeAt(i);
        a = Math.imul(a ^ c, 0x01000193) >>> 0;
        b = Math.imul(b ^ c, 0x5bd1e995) >>> 0;
        b = (b ^ (b >>> 15)) >>> 0;
    }
    return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}

/** Query parameters that only carry access, not which file. */
const ACCESS_PARAMS = ['sig', 'token'];

/**
 * What a remote file is known by, the same however it is reached: a shared
 * library's file by its server and id (its URL's key changes with the share
 * token), any other URL by itself without the access parameters.
 * @param {string} url
 * @param {{remoteServer?: string, remoteId?: string}} [item]
 */
export function remoteFileKey(url, item = {}) {
    if (item.remoteServer && item.remoteId) return `library:${item.remoteServer}:${item.remoteId}`;
    try {
        const parsed = new URL(url);
        for (const name of ACCESS_PARAMS) parsed.searchParams.delete(name);
        parsed.hash = '';
        return `url:${parsed.href}`;
    } catch {
        return `url:${url}`;
    }
}

/**
 * What a response says the file is: its total size and validator.
 * @param {Response} response
 * @returns {{size: number|null, validator: string}}
 */
function describe(response) {
    const range = /\/(\d+)\s*$/.exec(response.headers.get('content-range') || '');
    const size = range ? Number(range[1])
        : response.status === 200 && response.headers.has('content-length') ? Number(response.headers.get('content-length'))
            : null;
    const etag = response.headers.get('etag');
    const modified = response.headers.get('last-modified');
    // A weak ETag is fine here: the same file, byte for byte, is all we ask.
    const validator = etag ? `etag:${etag.replace(/^W\//, '')}` : modified ? `modified:${modified}` : '';
    return { size, validator };
}

export class PieceStore {
    /**
     * @param {{backend: PieceBackend, budget: number, fetchFn?: typeof fetch,
     *   pieceSize?: number, now?: () => number, lockPrefix?: string,
     *   retryDelays?: number[]}} options - `pieceSize` fixes the size for
     *   every file (tests); without it each file gets pieceSizeFor(its size).
     *   `retryDelays`: seconds before each retry of a piece a reader waits on
     */
    constructor({ backend, budget, fetchFn, pieceSize, now = () => Date.now(), lockPrefix = 'jj-buffer', retryDelays = READ_RETRY_DELAYS }) {
        this.backend = backend;
        /** Bytes all files' pieces may take together. */
        this.budget = budget;
        this.fetchFn = fetchFn ?? ((input, init) => fetch(input, init));
        /** @type {number|undefined} */
        this.pieceSize = pieceSize;
        this.retryDelays = retryDelays;
        this.now = now;
        this.lockPrefix = lockPrefix;
        /** @type {Map<string, FileRecord>} */
        this.files = new Map();
        this.loaded = false;
        /**
         * Pieces are stored one after another: each makes room for itself
         * before writing, which pieces arriving side by side would otherwise
         * all do against the same, not yet updated, usage.
         * @type {Promise<unknown>}
         */
        this.writing = Promise.resolve();
    }

    /** Resolves once every piece fetched so far is stored (tests, clearing). */
    async settled() {
        await this.writing;
    }

    /**
     * Run `task` after the writes before it.
     * @template T
     * @param {() => Promise<T>} task
     * @returns {Promise<T>}
     */
    queueWrite(task) {
        const run = this.writing.then(task, task);
        this.writing = run.catch(() => {});
        return run;
    }

    /**
     * Read what the backend keeps. Pieces of the wrong size and files of an
     * earlier piece size are dropped; so are files without a validator, which
     * are kept only for the session that fetched them (unless another tab is
     * playing one now).
     */
    async load() {
        const held = await heldLocks();
        for (const { meta, pieces } of await this.backend.load()) {
            const busy = held.has(this.lockName(meta.id));
            const cut = this.pieceSize ?? pieceSizeFor(meta.size);
            if (!busy && (meta.pieceSize !== cut || !meta.validator || meta.id !== hashKey(meta.key))) {
                await this.backend.deleteFile(meta.id).catch(() => {});
                continue;
            }
            const whole = new Map();
            for (const [index, bytes] of pieces) {
                if (bytes === pieceLength(meta.size, meta.pieceSize, index)) whole.set(index, bytes);
            }
            this.files.set(meta.id, { meta, pieces: whole, openCount: 0 });
        }
        this.loaded = true;
        return this;
    }

    /** @param {string} id */
    lockName(id) { return `${this.lockPrefix}:${id}`; }

    /** Bytes kept by this store's backend, all files. */
    usage() {
        let total = 0;
        for (const record of this.files.values()) for (const bytes of record.pieces.values()) total += bytes;
        return total;
    }

    /**
     * Open a remote file. Asks the server what it is now (one byte); a file
     * kept from before whose size or validator differ is dropped. With the
     * network down, a file kept from before opens as it was, so what was
     * downloaded still plays.
     *
     * Throws AppError NO_RANGES when the server cannot answer a range
     * request: such a file is played as it was before the buffer.
     * @param {{url: string, key: string, init?: RequestInit}} source
     * @returns {Promise<BufferedFile>}
     */
    async open({ url, key, init = {} }) {
        if (!this.loaded) await this.load();
        const id = hashKey(key);
        let record = this.files.get(id);

        /** @type {{size: number|null, validator: string}|null} */
        let now = null;
        try {
            const probe = await this.fetchFn(url, withRange(init, 0, 0));
            await probe.body?.cancel().catch(() => {});
            if (probe.status !== 206) {
                throw new AppError('NO_RANGES', { context: { status: probe.status } });
            }
            now = describe(probe);
            if (!now.size) throw new AppError('NO_RANGES', { message: 'The server did not say how big the file is' });
        } catch (error) {
            if (error instanceof AppError || !record?.pieces.size) throw AppError.from(error);
            Logger.warn('[Buffer] Server not reachable; playing what was kept of', key);
        }

        if (record && now && (record.meta.size !== now.size || record.meta.validator !== now.validator)) {
            Logger.log('[Buffer] The file changed on the server; dropping what was kept of', key);
            await this.dropFile(id);
            record = undefined;
        }
        if (!record) {
            if (!now?.size) throw new AppError('NETWORK');
            record = {
                meta: { id, key, size: now.size, pieceSize: this.pieceSize ?? pieceSizeFor(now.size), validator: now.validator, lastUsed: this.now(), pinned: [] },
                pieces: new Map(),
                openCount: 0,
            };
            this.files.set(id, record);
        }
        record.meta.lastUsed = this.now();
        record.openCount++;

        // A memory store is this tab's alone: nothing to share, nothing to lock.
        const lock = this.backend.kind === 'memory'
            ? { held: true, release: () => {} }
            : await takeLock(this.lockName(id));
        const file = new BufferedFile(this, record, { url, init, ownsPieces: lock.held, release: lock.release });
        // A file kept only for this session is written the same way; load()
        // drops it next time.
        if (lock.held) await this.backend.writeMeta(record.meta).catch(() => {});
        return file;
    }

    /**
     * Keep all files under the budget: the least recently used ones that
     * are not open go first, whole. Returns whether it is under.
     * @param {number} [extra] - bytes about to be written
     */
    async enforceBudget(extra = 0) {
        if (this.usage() + extra <= this.budget) return true;
        const closed = [...this.files.values()]
            .filter((record) => record.openCount === 0)
            .sort((a, b) => a.meta.lastUsed - b.meta.lastUsed);
        for (const record of closed) {
            if (this.usage() + extra <= this.budget) break;
            Logger.log(`[Buffer] Over budget: letting go of ${record.meta.key}`);
            await this.dropFile(record.meta.id);
        }
        return this.usage() + extra <= this.budget;
    }

    /**
     * Forget a file and delete its pieces (its playlist item was removed).
     * @param {string} key
     */
    async drop(key) {
        await this.dropFile(hashKey(key));
    }

    /** @param {string} id */
    async dropFile(id) {
        this.files.delete(id);
        await this.backend.deleteFile(id).catch(() => {});
    }

    /** Delete every file that is not open. */
    async clear() {
        for (const record of [...this.files.values()]) {
            if (record.openCount === 0) await this.dropFile(record.meta.id);
        }
    }
}

/**
 * @param {number} size
 * @param {number} pieceSize
 * @param {number} index
 */
function pieceLength(size, pieceSize, index) {
    return Math.max(0, Math.min(pieceSize, size - index * pieceSize));
}

/**
 * @param {RequestInit} init
 * @param {number} start
 * @param {number} end - inclusive
 * @returns {RequestInit}
 */
function withRange(init, start, end) {
    const headers = new Headers(init.headers);
    headers.set('Range', `bytes=${start}-${end}`);
    return { ...init, headers };
}

/** @returns {Promise<Set<string>>} the names of the locks held anywhere in this origin */
async function heldLocks() {
    try {
        const state = await globalThis.navigator?.locks?.query();
        return new Set((state?.held ?? []).map((lock) => lock.name ?? ''));
    } catch {
        return new Set();
    }
}

/**
 * Hold the named lock until released, when there is no other holder.
 * Without Web Locks (Node, old browsers) it is always held.
 * @param {string} name
 * @returns {Promise<{held: boolean, release: () => void}>}
 */
async function takeLock(name) {
    const locks = globalThis.navigator?.locks;
    if (!locks) return { held: true, release: () => {} };
    /** @type {() => void} */
    let release = () => {};
    const held = await new Promise((resolve) => {
        locks.request(name, { ifAvailable: true }, (lock) => {
            if (!lock) { resolve(false); return undefined; }
            resolve(true);
            return new Promise((done) => { release = () => done(undefined); });
        }).catch(() => resolve(false));
    });
    return { held, release };
}

/**
 * One range request filling part of a piece: bytes [start, end) of it, the
 * next to arrive at `pos`. `end` may be moved down while it runs, when a
 * reader started another part further on.
 * @typedef {object} PiecePart
 * @property {number} start
 * @property {number} end
 * @property {number} pos
 * @property {AbortController} controller
 * @property {boolean} [yielded] - stopped for a reader's request; its bytes so far are kept
 */

/**
 * A piece being fetched: its bytes so far, which of them have arrived (as
 * [start, end) ranges within the piece), the requests filling it, and who
 * waits for which bytes. Usually one request from the start; a reader that
 * needs bytes further in starts one where it needs them, and the start is
 * filled in after, so a seek never waits for a piece's beginning first.
 * @typedef {object} PieceFetch
 * @property {number} index
 * @property {Uint8Array} bytes
 * @property {Array<[number, number]>} filled
 * @property {Set<PiecePart>} parts
 * @property {Set<{from: number, to: number, resolve: () => void, reject: (e: unknown) => void}>} waiters
 * @property {boolean} finished
 * @property {number} [readerFrom] - where in the piece the first reader
 *   started (a seek landing in it): the bytes before it are behind the
 *   picture, and fetched only when nothing else is
 * @property {boolean} [background] - left behind by a seek: fetched only when
 *   nothing else is (resumeBackground), though a reader from before the seek
 *   may still be waiting on it
 * @property {Promise<void>} done - resolves once the piece is whole and kept
 * @property {() => void} resolve
 * @property {(e: unknown) => void} reject
 */

/**
 * A reader this far (bytes; at most a 16th of a piece) or less ahead of a
 * running request waits for it rather than starting its own.
 */
const JOIN_DISTANCE = 64 * 1024;

/**
 * Whether [from, to) is inside the merged ranges.
 * @param {Array<[number, number]>} ranges
 * @param {number} from
 * @param {number} to
 */
function covered(ranges, from, to) {
    return ranges.some(([a, b]) => a <= from && to <= b);
}

/**
 * Add [from, to) to the merged ranges.
 * @param {Array<[number, number]>} ranges
 * @param {number} from
 * @param {number} to
 */
function addRange(ranges, from, to) {
    if (to <= from) return;
    ranges.push([from, to]);
    ranges.sort((x, y) => x[0] - y[0]);
    for (let k = ranges.length - 1; k > 0; k--) {
        if (ranges[k][0] <= ranges[k - 1][1]) {
            ranges[k - 1][1] = Math.max(ranges[k - 1][1], ranges[k][1]);
            ranges.splice(k, 1);
        }
    }
}

export class BufferedFile {
    /**
     * @param {PieceStore} store
     * @param {FileRecord} record
     * @param {{url: string, init: RequestInit, ownsPieces: boolean, release: () => void}} options
     */
    constructor(store, record, { url, init, ownsPieces, release }) {
        this.store = store;
        this.record = record;
        this.url = url;
        this.init = init;
        /**
         * Whether this tab keeps the file's pieces. Not: another tab holds
         * them, and this one keeps what it fetches in memory, read-only to
         * the shared ones.
         */
        this.ownsPieces = ownsPieces;
        this.release = release;
        /** Where this file's own fetches go when it does not own the pieces. */
        this.memory = ownsPieces ? null : new MemoryBackend();
        /** @type {Map<number, number>} pieces this tab fetched into memory */
        this.memoryPieces = new Map();
        /** @type {Map<number, PieceFetch>} */
        this.fetching = new Map();
        /** @type {Array<{at: number, bytes: number, ms: number}>} for linkRate() */
        this.samples = [];
        this.closed = false;
        /** @type {Set<(start: number, end: number) => void>} */
        this.changeListeners = new Set();
        /** Pieces waiting for an idle link to fill in their gaps. @type {Set<PieceFetch>} */
        this.parked = new Set();
        /** @type {Array<() => void>} whenIdle() callers */
        this.idleWaiters = [];
    }

    get id() { return this.record.meta.id; }
    get key() { return this.record.meta.key; }
    get size() { return this.record.meta.size; }
    get pieceSize() { return this.record.meta.pieceSize; }
    get pieceCount() { return Math.ceil(this.size / this.pieceSize); }

    /** @param {number} offset */
    pieceAt(offset) { return Math.floor(offset / this.pieceSize); }

    /** @param {number} index */
    has(index) { return this.record.pieces.has(index) || this.memoryPieces.has(index); }

    /** @param {number} index */
    isFetching(index) { return this.fetching.has(index); }

    /** Every piece kept, whole: whether the file can be read without the network. */
    isComplete() {
        for (let i = 0; i < this.pieceCount; i++) if (!this.has(i)) return false;
        return true;
    }

    /**
     * Bytes there without a gap from byte `offset` on: kept pieces, and what
     * has arrived of the piece being fetched at `offset`.
     * @param {number} offset
     */
    contiguousFromByte(offset) {
        let end = offset;
        for (let i = this.pieceAt(offset); i < this.pieceCount; i++) {
            const start = i * this.pieceSize;
            if (this.has(i)) { end = start + pieceLength(this.size, this.pieceSize, i); continue; }
            const job = this.fetching.get(i);
            const range = job?.filled.find(([a, b]) => a <= end - start && end - start < b);
            if (range) end = start + range[1];
            break;
        }
        return Math.max(0, end - offset);
    }

    /**
     * Bytes kept without a gap from the start of piece `index` on.
     * @param {number} index
     */
    contiguousFrom(index) {
        let bytes = 0;
        for (let i = Math.max(0, index); i < this.pieceCount && this.has(i); i++) {
            bytes += pieceLength(this.size, this.pieceSize, i);
        }
        return bytes;
    }

    /**
     * The bytes kept, as [start, end) ranges, merged.
     * @returns {Array<[number, number]>}
     */
    downloadedRanges() {
        /** @type {Array<[number, number]>} */
        const ranges = [];
        for (let i = 0; i < this.pieceCount; i++) {
            if (!this.has(i)) continue;
            const start = i * this.pieceSize;
            const end = Math.min(this.size, start + this.pieceSize);
            const last = ranges[ranges.length - 1];
            if (last && last[1] === start) last[1] = end;
            else ranges.push([start, end]);
        }
        return ranges;
    }

    /**
     * The bytes kept that play, as [start, end) ranges, merged: whole pieces
     * only, so never more than is kept. A run made only of pinned pieces is
     * left out unless the file starts with it: past the start, pinned pieces
     * are the file's index (an MKV's cues, or the index of an MP4 not made
     * "faststart", both at the end), kept for seeking, not video that plays;
     * the first piece holds the header and the first seconds of the video.
     * @returns {Array<[number, number]>}
     */
    playableRanges() {
        const pinned = new Set(this.record.meta.pinned);
        /** @type {Array<[number, number]>} */
        const ranges = [];
        let runStart = -1;
        let plays = false;
        for (let i = 0; i <= this.pieceCount; i++) {
            if (i < this.pieceCount && this.has(i)) {
                if (runStart < 0) { runStart = i; plays = i === 0; }
                if (!pinned.has(i)) plays = true;
                continue;
            }
            if (runStart >= 0 && plays) ranges.push([runStart * this.pieceSize, Math.min(this.size, i * this.pieceSize)]);
            runStart = -1;
        }
        return ranges;
    }

    /**
     * Called with the byte range of each piece kept or let go.
     * @param {(start: number, end: number) => void} listener
     * @returns {() => void} removes it
     */
    onChange(listener) {
        this.changeListeners.add(listener);
        return () => this.changeListeners.delete(listener);
    }

    /** @param {number} index */
    notifyChange(index) {
        const start = index * this.pieceSize;
        const end = Math.min(this.size, start + this.pieceSize);
        for (const listener of this.changeListeners) {
            try { listener(start, end); } catch (error) { Logger.warn('[Buffer] change listener threw', error); }
        }
    }

    /**
     * Keep a piece whatever the window: the file's index, read on every seek.
     * @param {number} index
     */
    pin(index) {
        const pinned = this.record.meta.pinned;
        if (pinned.includes(index)) return;
        pinned.push(index);
        if (this.ownsPieces) this.store.backend.writeMeta(this.record.meta).catch(() => {});
    }

    /**
     * Bytes [start, end) of the file, from the pieces kept or fetched now.
     * @param {number} start
     * @param {number} end
     * @returns {Promise<Uint8Array>}
     */
    async read(start, end) {
        if (this.closed) throw new AppError('CANCELLED', { message: 'The file was closed' });
        end = Math.min(end, this.size);
        const out = new Uint8Array(Math.max(0, end - start));
        const parts = [];
        for (let index = this.pieceAt(start); index * this.pieceSize < end; index++) {
            const pieceStart = index * this.pieceSize;
            const from = Math.max(start, pieceStart) - pieceStart;
            const to = Math.min(end, pieceStart + this.pieceSize) - pieceStart;
            parts.push(this.readFromPiece(index, from, to).then((bytes) => {
                out.set(bytes, pieceStart + from - start);
            }));
        }
        await Promise.all(parts);
        this.record.meta.lastUsed = this.store.now();
        return out;
    }

    /**
     * Bytes [from, to) of one piece.
     * @param {number} index
     * @param {number} from
     * @param {number} to
     * @returns {Promise<Uint8Array>}
     */
    async readFromPiece(index, from, to) {
        for (let attempt = 0; ; attempt++) {
            const kept = await this.readKept(index, from, to);
            if (kept) return kept;
            const job = this.fetchPiece(index, from, true);
            try {
                await new Promise((resolve, reject) => {
                    if (covered(job.filled, from, to)) { resolve(undefined); return; }
                    job.waiters.add({ from, to, resolve: () => resolve(undefined), reject });
                });
                return job.bytes.slice(from, to);
            } catch (raw) {
                // A blip on the link is retried for a reader, as UrlSource
                // did: a few times, waiting longer each time. A refusal, a
                // changed file or a close is the answer.
                const error = AppError.from(raw);
                const delay = this.store.retryDelays[attempt];
                if (this.closed || delay === undefined || !['NETWORK', 'TIMEOUT'].includes(error.code)) throw error;
                Logger.warn(`[Buffer] Piece ${index} of ${this.key} failed (${error.message}); trying again in ${delay}s`);
                await new Promise((resolve) => setTimeout(resolve, delay * 1000));
            }
        }
    }

    /**
     * A kept piece's bytes, or null when it is not kept (or was taken away:
     * the browser may clear its storage, so the list is not trusted).
     * @param {number} index
     * @param {number} from
     * @param {number} to
     */
    async readKept(index, from, to) {
        if (this.record.pieces.has(index)) {
            const bytes = await this.store.backend.readPiece(this.id, index, from, to).catch(() => null);
            if (bytes && bytes.length === to - from) return bytes;
            this.record.pieces.delete(index);
            this.notifyChange(index);
        }
        if (this.memory && this.memoryPieces.has(index)) {
            const bytes = await this.memory.readPiece(this.id, index, from, to);
            if (bytes) return bytes;
            this.memoryPieces.delete(index);
        }
        return null;
    }

    /**
     * A kept piece as a Blob (on disk, the piece file itself: nothing is
     * read or copied); null when it is not kept whole.
     * @param {number} index
     * @returns {Promise<Blob|null>}
     */
    async pieceBlob(index) {
        const length = pieceLength(this.size, this.pieceSize, index);
        /** @type {Blob|null} */
        let blob = null;
        if (this.record.pieces.has(index)) blob = await this.store.backend.pieceBlob(this.id, index).catch(() => null);
        if (!blob && this.memory && this.memoryPieces.has(index)) blob = await this.memory.pieceBlob(this.id, index);
        return blob && blob.size === length ? blob : null;
    }

    /**
     * Bytes [start, end) straight from the server as a Blob, checked like a
     * piece but not kept (a tool reading the whole file must not push the
     * file playing out of the buffer).
     * @param {number} start
     * @param {number} end
     * @returns {Promise<Blob>}
     */
    async fetchRangeBlob(start, end) {
        const response = await this.store.fetchFn(this.url, withRange(this.init, start, end - 1));
        if (response.status !== 206 && !(response.status === 200 && start === 0 && end === this.size)) {
            await response.body?.cancel().catch(() => {});
            throw new AppError(response.status === 200 ? 'NO_RANGES' : 'NETWORK', { context: { status: response.status } });
        }
        const now = describe(response);
        if ((now.size !== null && now.size !== this.size) || (now.validator && now.validator !== this.record.meta.validator)) {
            await response.body?.cancel().catch(() => {});
            throw new AppError('SOURCE_CHANGED', { context: { key: this.key } });
        }
        const blob = await response.blob();
        if (blob.size !== end - start) throw new AppError('NETWORK', { message: `Got ${blob.size} of ${end - start} bytes` });
        return blob;
    }

    /**
     * Resolves when no piece of this file is being fetched (or the file is
     * closed): the downloader reads ahead only on an idle link.
     * @returns {Promise<void>}
     */
    async whenIdle() {
        if (this.closed || !this.linkBusy()) return;
        await new Promise((resolve) => this.idleWaiters.push(() => resolve(undefined)));
    }

    /**
     * Whether a request of this file is running (other than `except`'s).
     * @param {PieceFetch} [except]
     */
    linkBusy(except) {
        for (const job of this.fetching.values()) if (job !== except && job.parts.size > 0) return true;
        return false;
    }

    /**
     * A request ended: when none is running any more, fill in a piece that
     * was waiting for the link (parked), else tell whoever waits for an idle
     * link (the downloader).
     */
    settleLink() {
        if (this.closed || this.linkBusy()) return;
        for (const job of this.parked) {
            if (job.background && !job.finished) continue;   // resumeBackground's
            this.parked.delete(job);
            if (job.finished) continue;
            this.afterPart(job);
            if (this.linkBusy()) return;
        }
        const waiters = this.idleWaiters.splice(0);
        for (const resolve of waiters) resolve();
    }

    /**
     * Fetch a piece unless it is kept or already being fetched. Resolves when
     * it is kept; the caller (the downloader) does not wait on bytes.
     * @param {number} index
     * @returns {Promise<void>}
     */
    async ensure(index) {
        if (index < 0 || index >= this.pieceCount || this.has(index)) return;
        await this.fetchPiece(index).done;
    }

    /**
     * The piece's fetch, started if it is not running, and made to deliver
     * byte `from` (within the piece) soon: by a request already running that
     * is about to reach it, or by a new one starting there.
     * @param {number} index
     * @param {number} [from]
     * @param {boolean} [urgent] - a reader waits on it: requests for bytes
     *   nobody waits on stop (keeping what they had) and finish later
     * @returns {PieceFetch}
     */
    fetchPiece(index, from = 0, urgent = false) {
        let job = this.fetching.get(index);
        if (!job) {
            /** @type {(e: unknown) => void} */
            let reject = () => {};
            /** @type {() => void} */
            let resolve = () => {};
            const done = new Promise((res, rej) => { resolve = () => res(undefined); reject = rej; });
            job = {
                index,
                bytes: new Uint8Array(pieceLength(this.size, this.pieceSize, index)),
                filled: [],
                parts: new Set(),
                waiters: new Set(),
                finished: false,
                done,
                resolve,
                reject,
            };
            // A failure is the waiters' to handle; a fetch nobody awaits must
            // not be an unhandled rejection.
            job.done.catch(() => {});
            this.fetching.set(index, job);
        }
        if (urgent) {
            job.background = false;   // a reader wants it now
            if (!job.filled.length && !job.parts.size) job.readerFrom = Math.min(job.readerFrom ?? from, from);
        }
        if (urgent && !covered(job.filled, from, from + 1)) this.yieldTo(job);
        this.cover(job, from);
        return job;
    }

    /**
     * Stop the requests of pieces nobody waits on (the read-ahead), keeping
     * the bytes they had: the reader's request gets the whole link. They are
     * picked up again once it is idle (settleLink).
     * @param {PieceFetch} reader
     */
    yieldTo(reader) {
        for (const job of this.fetching.values()) {
            if (job === reader || job.finished || (job.waiters.size > 0 && !job.background)) continue;
            for (const part of job.parts) {
                part.yielded = true;
                part.controller.abort();
            }
        }
    }

    /**
     * Make sure some request will deliver byte `from` of the piece soon.
     * @param {PieceFetch} job
     * @param {number} from
     */
    cover(job, from) {
        if (job.finished || covered(job.filled, from, from + 1)) return;
        for (const part of job.parts) {
            if (part.start <= from && from < part.end && from - part.pos <= Math.min(JOIN_DISTANCE, this.pieceSize / 16)) return;
        }
        // Up to where the bytes already there (or coming) begin.
        let end = job.bytes.length;
        for (const [a] of job.filled) if (a > from) { end = Math.min(end, a); break; }
        for (const part of job.parts) {
            if (part.start > from) end = Math.min(end, part.start);
            // A request heading through this point stops here; this one
            // takes over from it.
            else if (part.end > from) part.end = from;
        }
        this.startPart(job, from, end);
    }

    /**
     * @param {PieceFetch} job
     * @param {number} start
     * @param {number} end
     */
    startPart(job, start, end) {
        /** @type {PiecePart} */
        const part = { start, end, pos: start, controller: new AbortController() };
        job.parts.add(part);
        this.parked.delete(job);
        this.runPart(job, part).then(() => {
            job.parts.delete(part);
            this.afterPart(job);
            this.settleLink();
        }, (raw) => {
            job.parts.delete(part);
            if (part.yielded && !job.finished && !this.closed) {
                if (job.parts.size === 0) this.parked.add(job);
            } else {
                this.failJob(job, AppError.from(raw));
            }
            this.settleLink();
        });
    }

    /**
     * A request ended: keep the piece if it is whole, else fill the first gap
     * left (when nothing else is running).
     * @param {PieceFetch} job
     */
    afterPart(job) {
        if (job.finished) return;
        if (covered(job.filled, 0, job.bytes.length)) {
            job.finished = true;
            this.keep(job.index, job.bytes).then(() => {
                if (this.fetching.get(job.index) === job) this.fetching.delete(job.index);
                job.resolve();
            }, (error) => this.failJob(job, AppError.from(error)));
            return;
        }
        if (job.parts.size > 0) return;
        // Bytes nobody is waiting for (the start of a piece a seek landed
        // in) wait for the link: fetched now, they would halve the rate of
        // the piece the player needs next.
        if ((job.waiters.size === 0 && this.linkBusy(job)) || job.background) {
            this.parked.add(job);
            return;
        }
        let gap = 0;
        for (const [a, b] of job.filled) {
            if (a > gap) break;
            gap = Math.max(gap, b);
        }
        // The start of a piece a seek landed in is behind the picture: seen on
        // a device, fetching it during a wait spent ten seconds of a slow
        // link on video already passed. Only once the window is full.
        if (job.waiters.size === 0 && job.readerFrom !== undefined && gap < job.readerFrom) {
            job.background = true;
            this.parked.add(job);
            return;
        }
        this.cover(job, gap);
    }

    /**
     * @param {PieceFetch} job
     * @param {AppError} error
     */
    failJob(job, error) {
        if (job.finished) return;
        job.finished = true;
        this.parked.delete(job);
        for (const part of job.parts) part.controller.abort();
        job.parts.clear();
        for (const waiter of job.waiters) waiter.reject(error);
        job.waiters.clear();
        if (this.fetching.get(job.index) === job) this.fetching.delete(job.index);
        job.reject(error);
    }

    /**
     * Fetch bytes [part.start, part.end) of the piece into it.
     * @param {PieceFetch} job
     * @param {PiecePart} part
     */
    async runPart(job, part) {
        const pieceStart = job.index * this.pieceSize;
        const start = pieceStart + part.start;
        const end = pieceStart + part.end - 1;
        const init = withRange({ ...this.init, signal: part.controller.signal }, start, end);
        const began = performance.now();
        const response = await this.store.fetchFn(this.url, init);
        if (response.status !== 206 && !(response.status === 200 && start === 0 && end === this.size - 1)) {
            await response.body?.cancel().catch(() => {});
            throw new AppError(response.status === 200 ? 'NO_RANGES' : 'NETWORK', { context: { status: response.status } });
        }
        const now = describe(response);
        if ((now.size !== null && now.size !== this.size) || (now.validator && now.validator !== this.record.meta.validator)) {
            await response.body?.cancel().catch(() => {});
            await this.store.dropFile(this.id);
            throw new AppError('SOURCE_CHANGED', { context: { key: this.key } });
        }
        if (!response.body) throw new AppError('NETWORK', { message: 'The response had no body' });

        const reader = response.body.getReader();
        let last = began;
        try {
            while (part.pos < part.end) {
                const { done, value } = await reader.read();
                if (done) break;
                if (job.finished) return;
                // `end` may have moved down meanwhile: keep only up to it.
                const take = Math.min(value.length, part.end - part.pos);
                if (take <= 0) break;
                job.bytes.set(take === value.length ? value : value.subarray(0, take), part.pos);
                addRange(job.filled, part.pos, part.pos + take);
                part.pos += take;
                const at = performance.now();
                this.sample(take, at - last);
                last = at;
                for (const waiter of [...job.waiters]) {
                    if (covered(job.filled, waiter.from, waiter.to)) { job.waiters.delete(waiter); waiter.resolve(); }
                }
            }
        } finally {
            // Stopped short (another request took over, the piece is done) or
            // ended: either way the connection's rest is not wanted.
            reader.cancel().catch(() => {});
        }
        if (part.pos < part.end) {
            throw new AppError('NETWORK', { message: `Piece ${job.index} ended early (${part.pos} of ${part.end} bytes)` });
        }
    }

    /**
     * Store a fetched piece: with the store when this tab owns the file and
     * there is room, in memory when not.
     * @param {number} index
     * @param {Uint8Array} bytes
     */
    async keep(index, bytes) {
        // A piece that arrived whole is kept even if the file was closed
        // meanwhile (a reader had its bytes and moved on): it was paid for.
        if (this.ownsPieces) {
            try {
                const kept = await this.store.queueWrite(async () => {
                    // Dropped meanwhile (changed on the server, cleared): not kept.
                    if (!this.store.files.has(this.id)) return false;
                    await this.store.enforceBudget(bytes.length);
                    await this.store.backend.writePiece(this.id, index, bytes);
                    this.record.pieces.set(index, bytes.length);
                    return true;
                });
                if (kept) this.notifyChange(index);
                return;
            } catch (error) {
                Logger.warn(`[Buffer] Could not keep piece ${index} of ${this.key}; keeping it in memory`, error);
            }
        }
        if (this.closed) return;
        this.memory ??= new MemoryBackend();
        await this.memory.writePiece(this.id, index, bytes);
        this.memoryPieces.set(index, bytes.length);
        this.notifyChange(index);
    }

    /**
     * @param {number} bytes
     * @param {number} ms
     */
    sample(bytes, ms) {
        const at = performance.now();
        this.samples.push({ at, bytes, ms });
        while (this.samples.length && at - this.samples[0].at > RATE_WINDOW_MS) this.samples.shift();
    }

    /**
     * The link's rate over the last RATE_RECENT_MS of receiving (bytes per
     * second), counting only the time spent receiving; null before a second
     * of it.
     */
    linkRate() {
        let bytes = 0;
        let ms = 0;
        // The most recent RATE_RECENT_MS of receiving, newest first.
        for (let i = this.samples.length - 1; i >= 0 && ms < RATE_RECENT_MS; i--) {
            bytes += this.samples[i].bytes;
            ms += this.samples[i].ms;
        }
        // A second of receiving is a measure at any rate; counting bytes
        // instead never measured a link slower than they arrive in the window.
        if (bytes === 0 || ms < 1000) return null;
        return bytes / (ms / 1000);
    }

    /**
     * Abort the fetches that nobody is waiting on and `keep` does not want:
     * after a seek, the downloader lets go of what the jump left behind.
     * @param {(index: number) => boolean} keep
     */
    abortExcept(keep) {
        for (const [index, job] of [...this.fetching]) {
            if (job.finished || keep(index)) continue;
            if (job.waiters.size === 0) {
                this.failJob(job, new AppError('CANCELLED', { message: 'No longer wanted' }));
                continue;
            }
            // Someone still waits on it: after a seek, nearly always the
            // reader from before it, which MediaBunny leaves waiting rather
            // than cancelling. Seen on a device: that piece kept coming in
            // beside the one the seek needed, both at half the link's rate.
            // Its request stops, keeping the bytes it had, and it finishes
            // only when nothing else is to be fetched.
            job.background = true;
            for (const part of job.parts) {
                part.yielded = true;
                part.controller.abort();
            }
        }
    }

    /**
     * Fetch one piece left behind by a seek (abortExcept), when nothing else
     * is: the downloader calls this once its window is full. Returns whether
     * it started one.
     */
    resumeBackground() {
        if (this.closed || this.linkBusy()) return false;
        for (const job of this.parked) {
            if (!job.background || job.finished) continue;
            this.parked.delete(job);
            job.background = false;
            job.readerFrom = undefined;   // its turn now, behind the picture or not
            this.afterPart(job);
            return true;
        }
        return false;
    }

    /**
     * Delete the kept pieces outside [from, to] (piece indexes), except the
     * pinned ones: the window moved on.
     * @param {number} from
     * @param {number} to
     */
    async keepOnly(from, to) {
        const pinned = new Set(this.record.meta.pinned);
        for (const index of [...this.record.pieces.keys()]) {
            if (index >= from && index <= to || pinned.has(index)) continue;
            if (!this.ownsPieces) continue;   // another tab's pieces are its to let go
            this.record.pieces.delete(index);
            await this.store.backend.deletePiece(this.id, index).catch(() => {});
            this.notifyChange(index);
        }
        for (const index of [...this.memoryPieces.keys()]) {
            if (index >= from && index <= to || pinned.has(index)) continue;
            this.memoryPieces.delete(index);
            await this.memory?.deletePiece(this.id, index);
            this.notifyChange(index);
        }
    }

    /**
     * Delete these kept pieces (the downloader making room), except pinned
     * ones and ones another tab keeps.
     * @param {number[]} indexes
     */
    async forget(indexes) {
        const pinned = new Set(this.record.meta.pinned);
        for (const index of indexes) {
            if (pinned.has(index)) continue;
            if (this.ownsPieces && this.record.pieces.delete(index)) {
                await this.store.backend.deletePiece(this.id, index).catch(() => {});
                this.notifyChange(index);
            } else if (this.memoryPieces.delete(index)) {
                await this.memory?.deletePiece(this.id, index);
                this.notifyChange(index);
            }
        }
    }

    /** Bytes this file keeps, in the store and in memory. */
    usage() {
        let total = 0;
        for (const bytes of this.record.pieces.values()) total += bytes;
        for (const bytes of this.memoryPieces.values()) total += bytes;
        return total;
    }

    /** Stop every fetch, let go of the lock. The kept pieces stay. */
    close() {
        if (this.closed) return;
        this.closed = true;
        for (const job of [...this.fetching.values()]) {
            // A piece already whole is still being stored: let it finish.
            if (!job.finished) this.failJob(job, new AppError('CANCELLED', { message: 'The file was closed' }));
        }
        this.fetching.clear();
        this.parked.clear();
        for (const resolve of this.idleWaiters.splice(0)) resolve();
        this.record.openCount = Math.max(0, this.record.openCount - 1);
        this.memory = null;
        this.memoryPieces.clear();
        this.changeListeners.clear();
        this.release();
    }
}

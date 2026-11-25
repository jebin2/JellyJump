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

/** Bytes per piece. */
export const PIECE_SIZE = 4 * 1024 * 1024;
/** How far back the link's rate is measured (ms). */
const RATE_WINDOW_MS = 10000;

/**
 * What is kept about a file besides its pieces.
 * @typedef {object} FileMeta
 * @property {string} id - the key's hash: the file's folder name
 * @property {string} key - remoteFileKey(...)
 * @property {number} size - bytes
 * @property {number} pieceSize - the PIECE_SIZE it was cut with
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
     *   pieceSize?: number, now?: () => number, lockPrefix?: string}} options
     */
    constructor({ backend, budget, fetchFn, pieceSize = PIECE_SIZE, now = () => Date.now(), lockPrefix = 'jj-buffer' }) {
        this.backend = backend;
        /** Bytes all files' pieces may take together. */
        this.budget = budget;
        this.fetchFn = fetchFn ?? ((input, init) => fetch(input, init));
        this.pieceSize = pieceSize;
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
            if (!busy && (meta.pieceSize !== this.pieceSize || !meta.validator || meta.id !== hashKey(meta.key))) {
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
                meta: { id, key, size: now.size, pieceSize: this.pieceSize, validator: now.validator, lastUsed: this.now(), pinned: [] },
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
 * A piece being fetched: its bytes so far, and who waits for which of them.
 * @typedef {object} PieceFetch
 * @property {number} index
 * @property {Uint8Array} bytes
 * @property {number} received
 * @property {AbortController} controller
 * @property {Set<{need: number, resolve: () => void, reject: (e: unknown) => void}>} waiters
 * @property {Promise<void>} done
 */

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
        const kept = await this.readKept(index, from, to);
        if (kept) return kept;
        const job = this.fetchPiece(index);
        await new Promise((resolve, reject) => {
            if (job.received >= to) { resolve(undefined); return; }
            const waiter = { need: to, resolve: () => resolve(undefined), reject };
            job.waiters.add(waiter);
        });
        return job.bytes.slice(from, to);
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
     * The piece's fetch, started if it is not running.
     * @param {number} index
     * @returns {PieceFetch}
     */
    fetchPiece(index) {
        const running = this.fetching.get(index);
        if (running) return running;
        const length = pieceLength(this.size, this.pieceSize, index);
        /** @type {PieceFetch} */
        const job = {
            index,
            bytes: new Uint8Array(length),
            received: 0,
            controller: new AbortController(),
            waiters: new Set(),
            done: Promise.resolve(),
        };
        this.fetching.set(index, job);
        job.done = this.download(job).then(() => {
            for (const waiter of job.waiters) waiter.resolve();
        }, (raw) => {
            // A fetch that failed (TypeError), was aborted, or was refused,
            // as the app's one error type.
            const error = AppError.from(raw);
            for (const waiter of job.waiters) waiter.reject(error);
            throw error;
        }).finally(() => {
            job.waiters.clear();
            if (this.fetching.get(index) === job) this.fetching.delete(index);
        });
        // A failure is the waiters' to handle; a fetch nobody awaits must not
        // be an unhandled rejection.
        job.done.catch(() => {});
        return job;
    }

    /**
     * @param {PieceFetch} job
     */
    async download(job) {
        const start = job.index * this.pieceSize;
        const end = start + job.bytes.length - 1;
        const init = withRange({ ...this.init, signal: job.controller.signal }, start, end);
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
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            if (job.received + value.length > job.bytes.length) {
                await reader.cancel().catch(() => {});
                throw new AppError('NETWORK', { message: 'The server sent more than was asked for' });
            }
            job.bytes.set(value, job.received);
            job.received += value.length;
            const at = performance.now();
            this.sample(value.length, at - last);
            last = at;
            for (const waiter of [...job.waiters]) {
                if (job.received >= waiter.need) { job.waiters.delete(waiter); waiter.resolve(); }
            }
        }
        if (job.received !== job.bytes.length) {
            throw new AppError('NETWORK', { message: `Piece ${job.index} ended early (${job.received} of ${job.bytes.length} bytes)` });
        }
        await this.keep(job.index, job.bytes);
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
     * The link's rate over the last few seconds of fetching (bytes per
     * second), counting only the time spent receiving; null before enough
     * has been fetched to say.
     */
    linkRate() {
        let bytes = 0;
        let ms = 0;
        for (const sample of this.samples) { bytes += sample.bytes; ms += sample.ms; }
        if (bytes < 64 * 1024 || ms < 200) return null;
        return bytes / (ms / 1000);
    }

    /**
     * Abort the fetches that nobody is waiting on and `keep` does not want:
     * after a seek, the downloader lets go of what the jump left behind.
     * @param {(index: number) => boolean} keep
     */
    abortExcept(keep) {
        for (const [index, job] of [...this.fetching]) {
            if (job.waiters.size === 0 && !keep(index)) {
                job.controller.abort();
                this.fetching.delete(index);
            }
        }
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
        for (const job of this.fetching.values()) {
            job.controller.abort();
            for (const waiter of job.waiters) waiter.reject(new AppError('CANCELLED', { message: 'The file was closed' }));
            job.waiters.clear();
        }
        this.fetching.clear();
        this.record.openCount = Math.max(0, this.record.openCount - 1);
        this.memory = null;
        this.memoryPieces.clear();
        this.changeListeners.clear();
        this.release();
    }
}

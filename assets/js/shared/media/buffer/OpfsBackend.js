// @ts-check
/**
 * The remote buffer's pieces on disk, in the origin private file system
 * (PieceStore.js, ADR 0013). Layout, under one folder per site (namespaced
 * for previews, which share the site's origin):
 *
 *     jj-buffer[-<namespace>]/<file id>/meta.json
 *                                      /<piece index>.p
 *
 * Writes go through PieceStoreWorker.js. Reads happen here: a piece is
 * written once, whole, and never again, so reading it needs no lock.
 */

/** @typedef {import('./PieceStore.js').FileMeta} FileMeta */

/** Pieces whose File objects are kept for reading. */
const RECENT_PIECES = 16;

export class OpfsBackend {
    /**
     * @param {FileSystemDirectoryHandle} base - the buffer's folder
     * @param {Worker} worker
     */
    constructor(base, worker) {
        /** @type {'opfs'} */
        this.kind = 'opfs';
        this.base = base;
        this.worker = worker;
        this.nextId = 1;
        /** @type {Map<number, {resolve: (v: unknown) => void, reject: (e: unknown) => void}>} */
        this.pending = new Map();
        /** @type {Map<string, FileSystemDirectoryHandle>} */
        this.folders = new Map();
        /**
         * The last pieces read, as File objects: the player reads a packet
         * at a time, and a piece never changes once written, so its File
         * stays good until it is deleted.
         * @type {Map<string, File>}
         */
        this.recent = new Map();
        worker.onmessage = (event) => {
            const { id, ok, error, name } = event.data;
            const call = this.pending.get(id);
            if (!call) return;
            this.pending.delete(id);
            if (ok) call.resolve(undefined);
            else call.reject(Object.assign(new Error(error), { name }));
        };
        worker.onerror = (event) => {
            for (const call of this.pending.values()) call.reject(new Error(event.message || 'The buffer worker failed'));
            this.pending.clear();
        };
    }

    /**
     * Open the buffer's folder and start its worker. Throws where OPFS or
     * workers cannot be used (the caller falls back to memory).
     * @param {string} rootName
     */
    static async open(rootName) {
        const root = await navigator.storage.getDirectory();
        const base = await root.getDirectoryHandle(rootName, { create: true });
        const worker = new Worker(new URL('./PieceStoreWorker.js', import.meta.url), { type: 'module' });
        const backend = new OpfsBackend(base, worker);
        await backend.call({ op: 'init', root: rootName });
        return backend;
    }

    /**
     * @param {Record<string, unknown>} message
     * @param {Transferable[]} [transfer]
     */
    call(message, transfer = []) {
        const id = this.nextId++;
        return new Promise((resolve, reject) => {
            this.pending.set(id, { resolve, reject });
            this.worker.postMessage({ ...message, id }, transfer);
        });
    }

    /** @param {string} id */
    async folder(id) {
        let handle = this.folders.get(id);
        if (!handle) {
            handle = await this.base.getDirectoryHandle(id);
            this.folders.set(id, handle);
        }
        return handle;
    }

    async load() {
        /** @type {Array<{meta: FileMeta, pieces: Map<number, number>}>} */
        const out = [];
        for await (const [name, handle] of /** @type {any} */ (this.base).entries()) {
            if (handle.kind !== 'directory') continue;
            /** @type {FileMeta|null} */
            let meta = null;
            /** @type {Map<number, number>} */
            const pieces = new Map();
            try {
                for await (const [entry, file] of handle.entries()) {
                    if (file.kind !== 'file') continue;
                    if (entry === 'meta.json') meta = JSON.parse(await (await file.getFile()).text());
                    else if (/^\d+\.p$/.test(entry)) pieces.set(Number(entry.slice(0, -2)), (await file.getFile()).size);
                }
            } catch {
                meta = null;   // unreadable: dropped below
            }
            if (!meta || meta.id !== name) {
                await this.deleteFile(name).catch(() => {});
                continue;
            }
            this.folders.set(name, handle);
            out.push({ meta, pieces });
        }
        return out;
    }

    /** @param {FileMeta} meta */
    async writeMeta(meta) {
        const bytes = new TextEncoder().encode(JSON.stringify(meta));
        await this.call({ op: 'write', dir: meta.id, name: 'meta.json', bytes }, [bytes.buffer]);
    }

    /**
     * @param {string} id
     * @param {number} index
     * @param {Uint8Array} bytes - copied: the caller keeps its own
     */
    async writePiece(id, index, bytes) {
        const copy = bytes.slice();
        await this.call({ op: 'write', dir: id, name: `${index}.p`, bytes: copy }, [copy.buffer]);
    }

    /**
     * @param {string} id
     * @param {number} index
     * @param {number} start
     * @param {number} end
     */
    async readPiece(id, index, start, end) {
        const name = `${id}/${index}`;
        try {
            let file = this.recent.get(name);
            if (file) {
                this.recent.delete(name);
            } else {
                const handle = await (await this.folder(id)).getFileHandle(`${index}.p`);
                file = await handle.getFile();
            }
            this.recent.set(name, file);
            if (this.recent.size > RECENT_PIECES) this.recent.delete(/** @type {string} */ (this.recent.keys().next().value));
            return new Uint8Array(await file.slice(start, end).arrayBuffer());
        } catch {
            this.recent.delete(name);
            return null;
        }
    }

    /**
     * The piece file itself: a Blob backed by the disk, nothing read.
     * @param {string} id
     * @param {number} index
     */
    async pieceBlob(id, index) {
        try {
            const handle = await (await this.folder(id)).getFileHandle(`${index}.p`);
            return await handle.getFile();
        } catch {
            return null;
        }
    }

    /**
     * @param {string} id
     * @param {number} index
     */
    async deletePiece(id, index) {
        this.recent.delete(`${id}/${index}`);
        await this.call({ op: 'delete', dir: id, name: `${index}.p` });
    }

    /** @param {string} id */
    async deleteFile(id) {
        this.folders.delete(id);
        for (const name of [...this.recent.keys()]) if (name.startsWith(`${id}/`)) this.recent.delete(name);
        await this.call({ op: 'delete', dir: id });
    }
}

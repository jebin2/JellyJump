// @ts-check
/**
 * The remote buffer's pieces kept in memory (PieceStore.js): where there is
 * no usable file storage (a private window, OPFS refused, too little quota),
 * for a tab whose file another tab already keeps, and in the tests.
 * Nothing survives the page.
 */

/** @typedef {import('./PieceStore.js').FileMeta} FileMeta */

export class MemoryBackend {
    constructor() {
        /** @type {'memory'} */
        this.kind = 'memory';
        /** @type {Map<string, {meta: FileMeta|null, pieces: Map<number, Uint8Array>}>} */
        this.files = new Map();
    }

    /** @param {string} id */
    file(id) {
        let file = this.files.get(id);
        if (!file) { file = { meta: null, pieces: new Map() }; this.files.set(id, file); }
        return file;
    }

    async load() {
        /** @type {Array<{meta: FileMeta, pieces: Map<number, number>}>} */
        const out = [];
        for (const { meta, pieces } of this.files.values()) {
            if (!meta) continue;
            out.push({ meta: structuredClone(meta), pieces: new Map([...pieces].map(([i, b]) => [i, b.length])) });
        }
        return out;
    }

    /** @param {FileMeta} meta */
    async writeMeta(meta) {
        this.file(meta.id).meta = structuredClone(meta);
    }

    /**
     * @param {string} id
     * @param {number} index
     * @param {Uint8Array} bytes
     */
    async writePiece(id, index, bytes) {
        this.file(id).pieces.set(index, bytes.slice());
    }

    /**
     * @param {string} id
     * @param {number} index
     * @param {number} start
     * @param {number} end
     */
    async readPiece(id, index, start, end) {
        const bytes = this.files.get(id)?.pieces.get(index);
        return bytes ? bytes.slice(start, end) : null;
    }

    /**
     * @param {string} id
     * @param {number} index
     */
    async deletePiece(id, index) {
        this.files.get(id)?.pieces.delete(index);
    }

    /** @param {string} id */
    async deleteFile(id) {
        this.files.delete(id);
    }
}

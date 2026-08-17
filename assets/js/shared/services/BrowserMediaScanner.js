import { Logger } from '../utils/Logger.js';

const VIDEO_EXTENSIONS = new Set([
    '.mp4', '.mkv', '.avi', '.webm', '.mov', '.m4v', '.wmv',
    '.flv', '.ts', '.m2ts', '.mts', '.3gp', '.ogv',
]);

const BATCH_SIZE = 200;

/**
 * BrowserMediaScanner
 * The browser half of the scanner junction.
 *
 * A page cannot enumerate the filesystem on its own, so where desktop starts
 * from the platform's media folders, this starts from a directory the user
 * picks — showDirectoryPicker() needs a user gesture, so scan() must be called
 * from a click. Everything above this (batching, the record shape, the
 * discovered list) is identical in both runtimes.
 *
 * Records carry a `file` handle instead of a `path`: there is no filesystem
 * path to hand out, and the File is what the player can actually open.
 */
export class BrowserMediaScanner {
    constructor() {
        this._cancelled = false;
        this._scanning = false;
    }

    static isSupported() {
        return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
    }

    get isScanning() {
        return this._scanning;
    }

    async scan({ onBatch, onDone, onError, directoryHandle } = {}) {
        if (this._scanning) return;
        this._scanning = true;
        this._cancelled = false;

        const started = performance.now();
        let found = 0;
        let scanned = 0;
        let batch = [];

        const flush = () => {
            if (batch.length === 0) return;
            onBatch?.(batch);
            batch = [];
        };

        try {
            const root = directoryHandle ?? await window.showDirectoryPicker({ id: 'jellyjump-media' });

            for await (const record of this._walk(root, root.name)) {
                scanned++;
                if (!record) continue;
                batch.push(record);
                found++;
                if (batch.length >= BATCH_SIZE) flush();
            }
            flush();
        } catch (error) {
            // An aborted picker is the user declining, not a failure.
            if (error?.name !== 'AbortError') {
                Logger.error('[Scanner]', error);
                onError?.(error);
            }
        } finally {
            this._scanning = false;
            onDone?.({
                found,
                scanned,
                cancelled: this._cancelled,
                elapsedMs: Math.round(performance.now() - started),
            });
        }
    }

    /**
     * Depth-first walk of a directory handle, yielding a record per video file
     * and null for everything else (so the caller can still count what it saw).
     */
    async *_walk(directoryHandle, prefix) {
        for await (const [name, handle] of directoryHandle.entries()) {
            if (this._cancelled) return;

            if (handle.kind === 'directory') {
                if (name.startsWith('.')) continue;
                yield* this._walk(handle, `${prefix}/${name}`);
                continue;
            }

            const dot = name.lastIndexOf('.');
            const ext = dot === -1 ? '' : name.slice(dot).toLowerCase();
            if (!VIDEO_EXTENSIONS.has(ext)) {
                yield null;
                continue;
            }

            try {
                const file = await handle.getFile();
                yield {
                    path: `${prefix}/${name}`, // display only; not a filesystem path
                    name,
                    size: file.size,
                    mtime: file.lastModified,
                    ext,
                    file,
                };
            } catch {
                yield null; // permission revoked or file vanished mid-walk
            }
        }
    }

    async cancel() {
        this._cancelled = true;
    }
}

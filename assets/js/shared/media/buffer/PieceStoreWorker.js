// @ts-check
/**
 * Writes the remote buffer's files into the origin private file system
 * (OpfsBackend.js). A worker because a synchronous access handle, the one
 * way to write there that every current browser has (Safari included), is
 * only given to workers.
 *
 * Messages: {id, op: 'write', dir, name, bytes} writes a file whole (it is
 * replaced, never appended to); {id, op: 'delete', dir, name?} removes a file,
 * or the folder with everything in it. Answers {id, ok} or {id, error, name}.
 * `root` names the folder all of it lives in, set once by {op: 'init'}.
 */

/** @type {string} */
let rootName = 'jj-buffer';

/** @param {string} dir */
async function folder(dir) {
    const root = await navigator.storage.getDirectory();
    const base = await root.getDirectoryHandle(rootName, { create: true });
    return base.getDirectoryHandle(dir, { create: true });
}

/**
 * @param {string} dir
 * @param {string} name
 * @param {Uint8Array} bytes
 */
async function write(dir, name, bytes) {
    const handle = await (await folder(dir)).getFileHandle(name, { create: true });
    const access = await /** @type {any} */ (handle).createSyncAccessHandle();
    try {
        access.truncate(0);
        let at = 0;
        while (at < bytes.length) at += access.write(bytes.subarray(at), { at });
        access.flush();
    } finally {
        access.close();
    }
}

/**
 * @param {string} dir
 * @param {string} [name]
 */
async function remove(dir, name) {
    const root = await navigator.storage.getDirectory();
    const base = await root.getDirectoryHandle(rootName, { create: true });
    try {
        if (name) await (await base.getDirectoryHandle(dir)).removeEntry(name);
        else await base.removeEntry(dir, { recursive: true });
    } catch (error) {
        if (/** @type {Error} */ (error).name !== 'NotFoundError') throw error;
    }
}

self.onmessage = async (event) => {
    const { id, op, dir, name, bytes, root } = event.data;
    try {
        if (op === 'init') rootName = root;
        else if (op === 'write') await write(dir, name, bytes);
        else if (op === 'delete') await remove(dir, name);
        else throw new Error(`Unknown op ${op}`);
        self.postMessage({ id, ok: true });
    } catch (error) {
        const err = /** @type {Error} */ (error);
        self.postMessage({ id, error: err.message || String(error), name: err.name || 'Error' });
    }
};

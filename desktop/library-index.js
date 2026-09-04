/**
 * Library index — what the media scan found, held in the main process.
 *
 * The renderer keeps its own copy for the playlist, but that one is unreachable
 * from the HTTP server, and a second scan just to answer requests would be
 * wasteful. The scanner host already relays every batch through here, so this
 * accumulates them as they pass.
 *
 * The index doubles as the sharing allowlist: a request names an id, never a
 * path, so nothing outside what the scan actually walked can be addressed. That
 * matters because the app's read-file IPC deliberately allows any media file on
 * disk — fine for a local renderer, far too broad to expose over a network.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/** @type {Map<string, {id, path, name, size, mtime, ext}>} */
const byId = new Map();

/**
 * Link lists, kept apart from the files on purpose.
 *
 * byId doubles as the sharing allowlist — resolveServable answers from it, so
 * anything in there can be fetched by id. A .jjlist must never be fetchable, so
 * it lives here instead and is only ever sent as text inside the listing.
 *
 * The text is shipped rather than parsed because the parser is the renderer's
 * ESM module and this is a CommonJS process: a second copy here is how the two
 * would drift.
 *
 * @type {Map<string, {path, name, text, mtime}>}
 */
const linkListsByPath = new Map();
/** Resolved roots the scan was allowed to walk, for the containment check. */
let scanRoots = [];

/**
 * Stable id for a file path. Stable matters: a link shared with another device
 * keeps working across restarts, and ids must not shift when a rescan reorders
 * results.
 */
function idFor(filePath) {
    return crypto.createHash('sha256').update(filePath).digest('hex').slice(0, 16);
}

function setRoots(roots) {
    scanRoots = (roots || [])
        .map((r) => {
            try {
                return fs.realpathSync(r);
            } catch {
                return null;
            }
        })
        .filter(Boolean);
}

function addBatch(files) {
    for (const file of files || []) {
        if (!file?.path) continue;
        const id = idFor(file.path);
        byId.set(id, { id, ...file });
    }
}

function addLinkList(file) {
    if (!file?.path || typeof file.text !== 'string') return;
    linkListsByPath.set(file.path, {
        path: file.path,
        name: file.name,
        text: file.text,
        mtime: file.mtime,
    });
}

/** For a client: the name and contents, never the path. */
function listLinkLists() {
    return [...linkListsByPath.values()].map((l) => ({ name: l.name, text: l.text }));
}

function clear() {
    byId.clear();
    linkListsByPath.clear();
}

function size() {
    return byId.size;
}

/** Listing for a client: no absolute paths, which are not the client's business. */
function list() {
    return [...byId.values()].map((f) => ({
        id: f.id,
        name: f.name,
        size: f.size,
        mtime: f.mtime,
        ext: f.ext,
        // Folder path relative to the scan root, so a remote client can group
        // the same way the desktop playlist does.
        folder: relativeFolder(f.path),
    }));
}

function relativeFolder(filePath) {
    const root = scanRoots.find((r) => filePath.startsWith(r + path.sep));
    const rest = root ? filePath.slice(root.length + 1) : path.basename(filePath);
    const parts = rest.split(path.sep);
    parts.pop();
    return parts.join('/');
}

/**
 * Resolve an id to a file that is still safe to serve.
 *
 * Re-checked at request time rather than trusted from the scan: a symlink could
 * have been repointed since, and the file may be gone. Returns null rather than
 * throwing so callers answer 404 without leaking why.
 */
function resolveServable(id) {
    const entry = byId.get(id);
    if (!entry) return null;

    let real;
    try {
        real = fs.realpathSync(entry.path);
    } catch {
        return null; // deleted or unreadable since the scan
    }

    const contained = scanRoots.some((root) => real === root || real.startsWith(root + path.sep));
    if (!contained) return null;

    let stat;
    try {
        stat = fs.statSync(real);
    } catch {
        return null;
    }
    if (!stat.isFile()) return null;

    return { ...entry, realPath: real, size: stat.size };
}

module.exports = {
    addBatch, addLinkList, setRoots, clear, list, listLinkLists, size,
    resolveServable, idFor,
};

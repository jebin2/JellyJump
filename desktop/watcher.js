/**
 * Library watcher -- keeps the shared index current while sharing is on.
 *
 * One inotify watch per *directory*, never per file. A file appearing, going or
 * changing is reported by the directory that holds it, so watching the files
 * themselves buys nothing -- and costs everything on the libraries this exists
 * for: a recordings drive with tens of thousands of clips exhausted the
 * system's watch limit (8192 by default on many servers) and printed an error
 * per file. The cost here is the number of folders, which is orders of
 * magnitude smaller.
 *
 * When the system's watches run out anyway -- the limit is a root-only setting
 * and not something this app can or should ask a person to change -- the
 * folders that did not get one are checked on a timer instead. A folder's
 * modification time changes whenever something is added to or removed from it,
 * so a pass costs one stat per folder and a listing only for the ones that
 * moved. Slower to notice, never missing, and nobody has to do anything.
 *
 * Off by default and only wanted while a library is being shared: share-host
 * turns it on and off, and a rescan only moves it to the new roots.
 *
 * What it admits is decided by scan-rules, the same module the scanner uses, so
 * a file the scan would have refused cannot arrive through here instead -- and
 * the directories the scan never enters are never watched at all.
 */
const fs = require('fs');
const path = require('path');
const libraryIndex = require('./library-index');
const rules = require('./scan-rules');

// A file still being written keeps reporting changes. Waiting for this long
// without one is how it is known to be finished -- a half-copied video added to
// the index would be served truncated.
const SETTLE_MS = 800;
const FLUSH_MS = 300;
// How often folders without a watch of their own are looked at again.
let sweepMs = 30000;

/** dir -> FSWatcher */
let watchers = new Map();
let watchedRoots = [];
// Whether sharing wants a watcher at all. Separate from `watchers` because the
// scan may not have produced roots yet when sharing is switched on.
let wanted = false;
let generation = 0;
let exhausted = false;
/** dir -> its modification time when last looked at, for folders with no watch */
let unwatched = new Map();
let sweepTimer = null;
let sweeping = false;
const settling = new Map();   // path -> timer
const pendingAdds = new Map();
let addTimer = null;

async function admit(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === rules.LINK_LIST_EXTENSION) {
        const list = await rules.readLinkList(filePath);
        if (list) libraryIndex.addLinkList(list);
        return null;
    }
    const video = await rules.inspectVideo(filePath);
    if (!video) return null;
    const sidecars = rules.sidecarsFor(video.name, await rules.subtitlesIn(path.dirname(filePath)));
    return { ...video, ...(sidecars.length > 0 ? { subtitles: sidecars } : {}) };
}

function flushAdds() {
    if (addTimer) {
        clearTimeout(addTimer);
        addTimer = null;
    }
    const files = Array.from(pendingAdds.values());
    pendingAdds.clear();
    if (files.length > 0) libraryIndex.addBatch(files);
}

function queueAdd(filePath, mine) {
    admit(filePath).then((info) => {
        // A watcher that was stopped or moved while this was in flight must not
        // add to an index it no longer belongs to.
        if (!info || mine !== generation) return;
        pendingAdds.set(filePath, info);
        if (addTimer) clearTimeout(addTimer);
        addTimer = setTimeout(flushAdds, FLUSH_MS);
    }).catch(() => {});
}

function unwatch(dir) {
    // The directory and everything under it.
    for (const [watched, handle] of watchers) {
        if (watched === dir || watched.startsWith(dir + path.sep)) {
            handle.close();
            watchers.delete(watched);
        }
    }
}

/** Said once, not once per folder; the fallback needs no action from anyone. */
function reportExhausted() {
    if (exhausted) return;
    exhausted = true;
    console.error(`[Watcher] Out of file watches after ${watchers.size} folders; `
        + `checking the rest every ${Math.round(sweepMs / 1000)}s instead.`);
}

function watchDirectory(dir, mine) {
    if (watchers.has(dir) || exhausted) return false;
    try {
        const handle = fs.watch(dir, { persistent: true }, (_event, name) => {
            if (name) onChange(path.join(dir, String(name)), mine);
        });
        // A folder that disappears or becomes unreadable is routine.
        handle.on('error', () => unwatch(dir));
        watchers.set(dir, handle);
        return true;
    } catch (error) {
        if (error.code === 'ENOSPC') reportExhausted();
        return false; // unreadable, or gone since it was listed
    }
}

/** Watch a directory and every directory under it that the scan would enter. */
async function watchTree(root, mine) {
    const queue = [root];
    while (queue.length > 0) {
        if (mine !== generation) return;
        const dir = queue.shift();
        if (!watchDirectory(dir, mine) && !watchers.has(dir)) {
            // Out of watches is not out of folders: this one is still part of
            // the library, so it is looked at on a timer instead.
            if (!exhausted) continue;
            try {
                unwatched.set(dir, (await fs.promises.stat(dir)).mtimeMs);
            } catch {
                continue;
            }
            startSweeping(mine);
        }
        let entries;
        try {
            entries = await fs.promises.readdir(dir, { withFileTypes: true });
        } catch {
            continue;
        }
        for (const entry of entries) {
            // isDirectory() is false for a symlink to one, so nothing is
            // followed out of a root.
            if (entry.isDirectory() && !rules.isSkippedName(entry.name)) {
                queue.push(path.join(dir, entry.name));
            }
        }
    }
}

function onChange(fullPath, mine) {
    if (mine !== generation) return;
    // Everything waits for quiet, not only files: a directory being moved in
    // reports as it arrives, and its contents are not all there yet.
    clearTimeout(settling.get(fullPath));
    settling.set(fullPath, setTimeout(() => {
        settling.delete(fullPath);
        settled(fullPath, mine);
    }, SETTLE_MS));
}

async function settled(fullPath, mine) {
    if (mine !== generation) return;
    let stat;
    try {
        stat = await fs.promises.lstat(fullPath);
    } catch {
        // Gone: a file leaves the index, a folder stops being watched.
        pendingAdds.delete(fullPath);
        libraryIndex.removePath(fullPath);
        unwatch(fullPath);
        return;
    }
    if (stat.isDirectory()) {
        if (rules.isSkippedName(path.basename(fullPath)) || watchers.has(fullPath)) return;
        await watchTree(fullPath, mine);
        // Files that arrived with the folder, before anything was watching it.
        await admitExisting(fullPath, mine);
        return;
    }
    if (!stat.isFile()) return;
    const ext = path.extname(fullPath).toLowerCase();
    if (rules.VIDEO_EXTENSIONS.has(ext) || ext === rules.LINK_LIST_EXTENSION) {
        queueAdd(fullPath, mine);
    }
}

async function admitExisting(dir, mine) {
    const stack = [dir];
    while (stack.length > 0 && mine === generation) {
        const current = stack.pop();
        let entries;
        try {
            entries = await fs.promises.readdir(current, { withFileTypes: true });
        } catch {
            continue;
        }
        for (const entry of entries) {
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) {
                if (!rules.isSkippedName(entry.name)) stack.push(full);
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (rules.VIDEO_EXTENSIONS.has(ext) || ext === rules.LINK_LIST_EXTENSION) {
                    queueAdd(full, mine);
                }
            }
        }
    }
}

function startSweeping(mine) {
    if (sweepTimer) return;
    sweepTimer = setInterval(() => { sweep(mine).catch(() => {}); }, sweepMs);
    sweepTimer.unref?.();
}

/** One pass over the folders that have no watch of their own. */
async function sweep(mine) {
    if (sweeping || mine !== generation) return;
    sweeping = true;
    try {
        for (const dir of Array.from(unwatched.keys())) {
            if (mine !== generation) return;
            let stat;
            try {
                stat = await fs.promises.stat(dir);
            } catch {
                // The folder is gone, and so is everything it held.
                unwatched.delete(dir);
                for (const gone of libraryIndex.pathsIn(dir)) libraryIndex.removePath(gone);
                continue;
            }
            if (stat.mtimeMs === unwatched.get(dir)) continue;
            unwatched.set(dir, stat.mtimeMs);

            let entries;
            try {
                entries = await fs.promises.readdir(dir, { withFileTypes: true });
            } catch {
                continue;
            }
            const present = new Set();
            for (const entry of entries) {
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    if (!rules.isSkippedName(entry.name) && !watchers.has(full) && !unwatched.has(full)) {
                        // New folder: walked now, so what is already in it is not
                        // waiting a further pass.
                        await watchTree(full, mine);
                        await admitExisting(full, mine);
                    }
                } else if (entry.isFile()) {
                    present.add(full);
                    const ext = path.extname(entry.name).toLowerCase();
                    const wanted = rules.VIDEO_EXTENSIONS.has(ext) || ext === rules.LINK_LIST_EXTENSION;
                    if (wanted && !libraryIndex.hasPath(full)) onChange(full, mine);
                }
            }
            for (const known of libraryIndex.pathsIn(dir)) {
                if (!present.has(known)) libraryIndex.removePath(known);
            }
        }
    } finally {
        sweeping = false;
    }
}

function begin() {
    const roots = libraryIndex.getRoots();
    if (roots.length === 0) return;
    const mine = ++generation;
    watchedRoots = roots;
    exhausted = false;
    // Sequential, not parallel: roots are walked in order so a limit that runs
    // out is spent on the first (media) folders rather than split at random.
    (async () => {
        for (const root of roots) {
            if (mine !== generation) return;
            await watchTree(root, mine);
        }
    })().catch((error) => console.error('[Watcher] Failed to start:', error.message));
}

function close() {
    generation++;
    if (addTimer) {
        clearTimeout(addTimer);
        addTimer = null;
    }
    for (const timer of settling.values()) clearTimeout(timer);
    settling.clear();
    pendingAdds.clear();
    for (const handle of watchers.values()) handle.close();
    watchers = new Map();
    watchedRoots = [];
    unwatched = new Map();
    if (sweepTimer) {
        clearInterval(sweepTimer);
        sweepTimer = null;
    }
}

const sameRoots = (a, b) => a.length === b.length && a.every((r, i) => r === b[i]);

/** Sharing wants the library watched. Safe to call repeatedly. */
function start() {
    wanted = true;
    if (watchedRoots.length > 0 && sameRoots(watchedRoots, libraryIndex.getRoots())) return;
    close();
    begin();
}

/** Sharing is off, or the app is quitting. */
function stop() {
    wanted = false;
    close();
}

/** A scan has settled on its roots. Moves the watcher only if one is wanted. */
function rootsChanged() {
    if (wanted) start();
}

function isRunning() {
    return watchers.size > 0 || unwatched.size > 0;
}

/** For tests and diagnostics: how many folders are watched, and whether it ran out. */
function stats() {
    return { folders: watchers.size, polled: unwatched.size, exhausted };
}

/** For tests: how often unwatched folders are looked at. */
function setSweepInterval(ms) {
    sweepMs = ms;
}

module.exports = { start, stop, rootsChanged, isRunning, stats, setSweepInterval };

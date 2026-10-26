/**
 * Library watcher -- keeps the shared index current while sharing is on.
 *
 * Off by default and only wanted while a library is being shared: it holds an
 * inotify watch per directory under every scan root, which on a home directory
 * is a real cost for a feature nobody is using. share-host turns it on and off;
 * a rescan only moves it to the new roots.
 *
 * What it admits is decided by scan-rules, the same module the scanner uses, so
 * a file the scan would have refused cannot arrive through here instead.
 */
const path = require('path');
const chokidar = require('chokidar');
const libraryIndex = require('./library-index');
const rules = require('./scan-rules');

let watcher = null;
let watchedRoots = [];
// Whether sharing wants a watcher at all. Separate from `watcher` because the
// scan may not have produced roots yet when sharing is switched on.
let wanted = false;
let generation = 0;
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
        addTimer = setTimeout(flushAdds, 300);
    }).catch(() => {});
}

function begin() {
    const roots = libraryIndex.getRoots();
    if (roots.length === 0) return;

    const mine = ++generation;
    watchedRoots = roots;
    try {
        watcher = chokidar.watch(roots, {
            // Not just dotfiles: the same directories the scan never enters.
            ignored: (filePath) => rules.isUnderSkipped(filePath, roots),
            persistent: true,
            ignoreInitial: true,
            ignorePermissionErrors: true,
            // A link out of a root is not a reason to start watching what is
            // on the other end of it.
            followSymlinks: false,
            depth: 15,
            awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
        });

        watcher
            .on('add', (filePath) => {
                const ext = path.extname(filePath).toLowerCase();
                if (rules.VIDEO_EXTENSIONS.has(ext) || ext === rules.LINK_LIST_EXTENSION) {
                    queueAdd(filePath, mine);
                }
            })
            .on('unlink', (filePath) => {
                pendingAdds.delete(filePath);
                libraryIndex.removePath(filePath);
            })
            .on('error', (error) => {
                console.error('[Watcher] Error:', error.message);
                if (error.code === 'ENOSPC') {
                    console.error('[Watcher] inotify watch limit reached. Increase fs.inotify.max_user_watches');
                }
            });
    } catch (error) {
        console.error('[Watcher] Failed to start:', error.message);
    }
}

function close() {
    generation++;
    if (addTimer) {
        clearTimeout(addTimer);
        addTimer = null;
    }
    pendingAdds.clear();
    if (watcher) {
        watcher.close();
        watcher = null;
    }
}

const sameRoots = (a, b) => a.length === b.length && a.every((r, i) => r === b[i]);

/** Sharing wants the library watched. Safe to call repeatedly. */
function start() {
    wanted = true;
    if (watcher && sameRoots(watchedRoots, libraryIndex.getRoots())) return;
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
    return !!watcher;
}

module.exports = { start, stop, rootsChanged, isRunning };

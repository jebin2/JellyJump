/**
 * Media scanner (Electron utilityProcess).
 *
 * Walks the user's media folders and streams back the video files it finds.
 * Runs as its own Node process rather than in the main process or a renderer:
 * a tree walk would otherwise block the event loop that serves every IPC call
 * and window event, and a scan that hits a pathological directory or a
 * permissions wall dies here without touching the player.
 *
 * The pass is deliberately cheap — path, size and mtime only. Duration and
 * codecs cost a demux per file, which is seconds on a large one, so those are
 * filled in later on demand by the renderer.
 *
 * Protocol (over parentPort):
 *   in   { type: 'scan', roots?: string[] }   start a scan
 *   in   { type: 'cancel' }                   stop the current scan
 *   out  { type: 'started', roots }
 *   out  { type: 'phase', phase, roots }      1 = media folders, 2 = drives,
 *                                            3 = home
 *   out  { type: 'batch', files: [...] }      streamed, never one big array
 *   out  { type: 'linklist', file }           a .jjlist and its text, relayed
 *                                             to the renderer but never added
 *                                             to the shared index
 *   out  { type: 'done', found, scanned, cancelled, elapsedMs }
 *   out  { type: 'error', message }
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
    VIDEO_EXTENSIONS, LINK_LIST_EXTENSION,
    isSkippedName, inspectVideo, inspectSubtitle, sidecarsFor, readLinkList,
} = require('./scan-rules');

// Streaming keeps memory flat and lets the UI fill in as results arrive, rather
// than sitting empty until the whole tree is walked.
const BATCH_SIZE = 200;
const BATCH_INTERVAL_MS = 250;

let cancelled = false;
let scanning = false;

const send = (message) => process.parentPort.postMessage(message);

/**
 * The conventional media folders for this platform, filtered to those that
 * actually exist. The later home walk excludes these so nothing is visited
 * twice.
 */
function defaultRoots() {
    const home = os.homedir();
    const candidates = [
        path.join(home, 'Videos'),
        path.join(home, 'Movies'),
        path.join(home, 'Downloads'),
        path.join(home, 'Desktop'),
        path.join(home, 'Documents'),
        path.join(home, 'Public'),
    ];
    return candidates.filter((dir) => {
        try {
            return fs.statSync(dir).isDirectory();
        } catch {
            return false; // missing or unreadable — not an error, just absent
        }
    });
}

/**
 * Walk a directory tree, yielding video files.
 *
 * Iterative rather than recursive so a deep tree cannot blow the stack, and
 * symlinks are resolved against a visited set so a cycle cannot loop forever.
 */
async function* walk(root, visited, counters) {
    const queue = [root];

    while (queue.length > 0) {
        if (cancelled) return;
        const dir = queue.shift();

        let entries;
        try {
            entries = await fs.promises.readdir(dir, { withFileTypes: true });
        } catch {
            continue; // unreadable directory is normal, not fatal
        }

        const subtitles = [];
        for (const entry of entries) {
            if (!entry.isFile() && !entry.isSymbolicLink()) continue;
            const subtitle = await inspectSubtitle(path.join(dir, entry.name), entry.name);
            if (subtitle) subtitles.push(subtitle);
        }

        for (const entry of entries) {
            if (cancelled) return;
            const full = path.join(dir, entry.name);

            if (entry.isSymbolicLink()) {
                // Resolve before deciding: a symlink can point at an ancestor,
                // or at a tree already covered by another root.
                let resolved;
                try {
                    resolved = await fs.promises.realpath(full);
                } catch {
                    continue;
                }
                if (visited.has(resolved)) continue;
                visited.add(resolved);
                let stat;
                try {
                    stat = await fs.promises.stat(resolved);
                } catch {
                    continue;
                }
                if (stat.isDirectory()) {
                    if (!isSkippedName(entry.name)) {
                        queue.push(resolved);
                    }
                    continue;
                }
            } else if (entry.isDirectory()) {
                if (isSkippedName(entry.name)) continue;
                if (visited.has(full)) continue;
                visited.add(full);
                queue.push(full);
                continue;
            } else if (!entry.isFile()) {
                continue; // sockets, fifos, devices
            }

            counters.scanned++;
            // Extension first: it rules out the overwhelming majority without
            // a syscall, and stat() is the expensive part of this loop.
            const ext = path.extname(entry.name).toLowerCase();

            if (ext === LINK_LIST_EXTENSION) {
                // Unreadable or vanished is null; a playlist file is not worth
                // failing a scan over.
                const list = await readLinkList(full, entry.name);
                if (list) yield list;
                continue;
            }

            if (!VIDEO_EXTENSIONS.has(ext)) continue;

            const video = await inspectVideo(full, entry.name);
            if (!video) continue;
            const sidecars = sidecarsFor(entry.name, subtitles);
            yield { ...video, ...(sidecars.length > 0 ? { subtitles: sidecars } : {}) };
        }
    }
}

/**
 * Mounted volumes: external drives, USB sticks, network shares.
 *
 * A media library very often lives on one of these rather than in the home
 * directory, and nothing under the home tree would ever reach them. Each
 * mount is listed as its own root instead of walking the parent, so an empty
 * placeholder directory costs nothing.
 */
function mountedVolumeRoots() {
    const roots = [];

    if (process.platform === 'win32') {
        // Drive letters, skipping C: which is the system drive the home pass
        // already covers.
        for (let code = 'D'.charCodeAt(0); code <= 'Z'.charCodeAt(0); code++) {
            const drive = `${String.fromCharCode(code)}:\\`;
            try {
                if (fs.statSync(drive).isDirectory()) roots.push(drive);
            } catch {
                // Not present, which is the normal case for most letters.
            }
        }
        return roots;
    }

    // Where Linux and macOS put mounts. The user-scoped ones are where desktop
    // environments actually mount removable media.
    const parents = [
        '/mnt', '/media', '/Volumes',
        path.join('/media', os.userInfo().username ?? ''),
        path.join('/run/media', os.userInfo().username ?? ''),
    ];

    for (const parent of parents) {
        let entries;
        try {
            entries = fs.readdirSync(parent, { withFileTypes: true });
        } catch {
            continue; // absent on this platform, or not readable
        }
        for (const entry of entries) {
            if (entry.name.startsWith('.')) continue;
            const full = path.join(parent, entry.name);
            try {
                if (fs.statSync(full).isDirectory()) roots.push(full);
            } catch {
                // A stale or disconnected mount; skip rather than hang on it.
            }
        }
    }
    return roots;
}

/**
 * Scan in three passes when no explicit roots are given:
 *
 *   1. the conventional media folders — small, high signal, results in a moment
 *   2. mounted volumes — where a media library most often actually lives
 *   3. everything else under the home directory
 *
 * Ordered so the files most likely to be wanted appear first, rather than after
 * a full-tree walk; the home pass is both the slowest and the noisiest, so it
 * goes last. All passes share one visited set, which is what stops a later pass
 * re-walking what an earlier one covered: those resolved paths are already
 * marked, so the walker skips them as it descends.
 */
function scanPhases(explicitRoots) {
    if (explicitRoots && explicitRoots.length > 0) {
        return [{ phase: 1, roots: explicitRoots }];
    }

    const phases = [{ phase: 1, roots: defaultRoots() }];

    const volumes = mountedVolumeRoots();
    if (volumes.length > 0) phases.push({ phase: 2, roots: volumes });

    try {
        if (fs.statSync(os.homedir()).isDirectory()) {
            phases.push({ phase: 3, roots: [os.homedir()] });
        }
    } catch {
        // No readable home directory; the other passes are all there is.
    }
    return phases;
}

async function scan(explicitRoots) {
    const started = Date.now();
    const visited = new Set();
    const counters = { scanned: 0 };
    let batch = [];
    let found = 0;
    let lastFlush = Date.now();

    const flush = () => {
        if (batch.length === 0) return;
        send({ type: 'batch', files: batch });
        batch = [];
        lastFlush = Date.now();
    };

    const phases = scanPhases(explicitRoots);
    send({ type: 'started', roots: phases.flatMap(p => p.roots) });

    for (const { phase, roots } of phases) {
        if (cancelled) break;
        send({ type: 'phase', phase, roots });

        for (const root of roots) {
            if (cancelled) break;
            let resolvedRoot;
            try {
                resolvedRoot = await fs.promises.realpath(root);
            } catch {
                continue;
            }
            if (visited.has(resolvedRoot)) continue;
            visited.add(resolvedRoot);

            for await (const file of walk(resolvedRoot, visited, counters)) {
                if (file.kind === 'linklist') {
                    // Not counted as a find: it is a playlist, and the count
                    // reported to the user means videos.
                    send({ type: 'linklist', file });
                    continue;
                }
                batch.push(file);
                found++;
                if (batch.length >= BATCH_SIZE || Date.now() - lastFlush >= BATCH_INTERVAL_MS) {
                    flush();
                }
            }
        }
        // Pass 1's results should land before the long pass starts.
        flush();
    }

    flush();
    send({
        type: 'done',
        found,
        scanned: counters.scanned,
        cancelled,
        elapsedMs: Date.now() - started,
    });
}

process.parentPort.on('message', async (event) => {
    const message = event.data;

    if (message?.type === 'cancel') {
        cancelled = true;
        return;
    }

    if (message?.type !== 'scan') return;
    if (scanning) return; // one scan at a time; a second request is a no-op

    scanning = true;
    cancelled = false;
    try {
        // Passed through as-is: scan() decides between an explicit-roots scan
        // and the default two-pass one. Resolving the defaults here would make
        // every scan look explicit and silently skip the home pass.
        await scan(Array.isArray(message.roots) ? message.roots : null);
    } catch (error) {
        send({ type: 'error', message: error?.message || String(error) });
    } finally {
        scanning = false;
    }
});

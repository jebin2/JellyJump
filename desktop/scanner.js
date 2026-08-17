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
 *   out  { type: 'phase', phase, roots }      1 = media folders, 2 = home
 *   out  { type: 'batch', files: [...] }      streamed, never one big array
 *   out  { type: 'done', found, scanned, cancelled, elapsedMs }
 *   out  { type: 'error', message }
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

// Video containers only. The renderer's MEDIA_EXTENSIONS also covers audio,
// subtitles and images, which is the right set for "may this be read" but the
// wrong one for "is this a video worth listing".
const VIDEO_EXTENSIONS = new Set([
    '.mp4', '.mkv', '.avi', '.webm', '.mov', '.m4v', '.wmv',
    '.flv', '.ts', '.m2ts', '.mts', '.3gp', '.ogv',
]);

// Extensions that are not only video. ".ts" is MPEG transport stream and also
// TypeScript, and a home directory holds thousands of the latter — including
// generated ones like CMake's compiler_depend.ts. Extension alone would list
// source files as videos, so these are confirmed by content.
const AMBIGUOUS_EXTENSIONS = new Set(['.ts']);

// MPEG-TS is 188-byte packets, each starting with this sync byte. Three in a row
// at the right stride is conclusive enough and needs only the first 377 bytes.
const TS_SYNC_BYTE = 0x47;
const TS_PACKET_SIZE = 188;
const TS_SYNC_CHECKS = 3;
const TS_PROBE_BYTES = TS_PACKET_SIZE * (TS_SYNC_CHECKS - 1) + 1;

/**
 * Whether a file with an ambiguous extension really is video.
 * Cheap by design: a size check rules out source files for free, and only what
 * survives that is opened.
 */
async function looksLikeTransportStream(filePath, size) {
    if (size < TS_PROBE_BYTES) return false;

    let handle;
    try {
        handle = await fs.promises.open(filePath, 'r');
        const { buffer, bytesRead } = await handle.read(Buffer.alloc(TS_PROBE_BYTES), 0, TS_PROBE_BYTES, 0);
        if (bytesRead < TS_PROBE_BYTES) return false;
        for (let i = 0; i < TS_SYNC_CHECKS; i++) {
            if (buffer[i * TS_PACKET_SIZE] !== TS_SYNC_BYTE) return false;
        }
        return true;
    } catch {
        return false;
    } finally {
        await handle?.close().catch(() => {});
    }
}

// Directory names never worth descending into. This matters most on the home
// pass, which would otherwise spend the bulk of its time inside dependency
// trees and caches. Dotfolders are skipped wholesale by the walker, so these
// are the ones that are not hidden.
const SKIP_DIRECTORIES = new Set([
    'node_modules', '.git', '.svn', '.hg', '.cache', '.npm', '.venv',
    '__pycache__', 'Library', 'AppData', 'System Volume Information',
    '$RECYCLE.BIN', '.Trash', '.local', 'snap', '.thumbnails',
]);

// Streaming keeps memory flat and lets the UI fill in as results arrive, rather
// than sitting empty until the whole tree is walked.
const BATCH_SIZE = 200;
const BATCH_INTERVAL_MS = 250;

let cancelled = false;
let scanning = false;

const send = (message) => process.parentPort.postMessage(message);

/**
 * The conventional media folders for this platform, filtered to those that
 * actually exist. Phase 2 (the full home walk) will exclude these so nothing
 * is visited twice.
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
                    if (!SKIP_DIRECTORIES.has(entry.name) && !entry.name.startsWith('.')) {
                        queue.push(resolved);
                    }
                    continue;
                }
            } else if (entry.isDirectory()) {
                if (SKIP_DIRECTORIES.has(entry.name) || entry.name.startsWith('.')) continue;
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
            if (!VIDEO_EXTENSIONS.has(ext)) continue;

            try {
                const stat = await fs.promises.stat(full);
                if (!stat.isFile() || stat.size === 0) continue;
                if (AMBIGUOUS_EXTENSIONS.has(ext)
                    && !(await looksLikeTransportStream(full, stat.size))) {
                    continue;
                }
                yield {
                    path: full,
                    name: entry.name,
                    size: stat.size,
                    mtime: stat.mtimeMs,
                    ext,
                };
            } catch {
                // Vanished or unreadable between readdir and stat.
            }
        }
    }
}

/**
 * Scan in two passes when no explicit roots are given:
 *
 *   1. the conventional media folders — small, high signal, results in a moment
 *   2. everything else under the home directory
 *
 * Ordered this way so the files most likely to be wanted appear first, rather
 * than after a full-tree walk. Both passes share one visited set, which is what
 * keeps pass 2 from re-walking the folders pass 1 already covered: their
 * resolved paths are already marked, so the walker skips them as it descends.
 */
function scanPhases(explicitRoots) {
    if (explicitRoots && explicitRoots.length > 0) {
        return [{ phase: 1, roots: explicitRoots }];
    }
    const media = defaultRoots();
    const phases = [{ phase: 1, roots: media }];
    try {
        const home = fs.statSync(os.homedir()).isDirectory() ? os.homedir() : null;
        if (home) phases.push({ phase: 2, roots: [home] });
    } catch {
        // No readable home directory; the media folders are all there is.
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

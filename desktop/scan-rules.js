/**
 * What the library accepts, in one place.
 *
 * The scanner builds the library and the watcher keeps it current, and both
 * feed the same index -- which is the sharing allowlist, so anything it holds
 * can be fetched by a friend. They had each grown their own idea of what
 * belongs: the watcher listed every .ts file under the home directory (almost
 * all of them TypeScript), walked into node_modules and caches the scan had
 * deliberately skipped, and never attached subtitles. Rules that decide what is
 * shareable must not be able to disagree, so there is one copy.
 *
 * Loaded by the scanner utility process as well as the main process, so it must
 * stay free of anything Electron-only.
 */
const fs = require('fs');
const path = require('path');

// Video containers only. The renderer's MEDIA_EXTENSIONS also covers audio,
// subtitles and images, which is the right set for "may this be read" but the
// wrong one for "is this a video worth listing".
const VIDEO_EXTENSIONS = new Set([
    '.mp4', '.mkv', '.avi', '.webm', '.mov', '.m4v', '.wmv',
    '.flv', '.ts', '.m2ts', '.mts', '.3gp', '.ogv',
]);

const SUBTITLE_EXTENSIONS = new Set(['.srt', '.vtt']);

// Extensions that are not only video. ".ts" is MPEG transport stream and also
// TypeScript, and a home directory holds thousands of the latter -- including
// generated ones like CMake's compiler_depend.ts. Extension alone would list
// source files as videos, so these are confirmed by content.
const AMBIGUOUS_EXTENSIONS = new Set(['.ts']);

// Our own link-list files. Deliberately our own extension rather than .txt: a
// media drive holds recovery codes and password exports, and any rule that
// opens text files to see whether they are interesting opens those too. Nothing
// but .jjlist is ever read.
const LINK_LIST_EXTENSION = '.jjlist';

// A hand-written playlist is small. The cap is not about disk -- it is what
// stops a file that happens to carry this extension from being read into memory
// and posted across the process boundary.
const LINK_LIST_MAX_BYTES = 256 * 1024;

// Directory names never worth descending into. This matters most on the home
// pass, which would otherwise spend the bulk of its time inside dependency
// trees and caches. Dotfolders are skipped wholesale as well, so these are the
// ones that are not hidden.
const SKIP_DIRECTORIES = new Set([
    'node_modules', '.git', '.svn', '.hg', '.cache', '.npm', '.venv',
    '__pycache__', 'Library', 'AppData', 'System Volume Information',
    '$RECYCLE.BIN', '.Trash', '.local', 'snap', '.thumbnails',
]);

/** Whether a directory (or file) of this name is outside the library. */
function isSkippedName(name) {
    return SKIP_DIRECTORIES.has(name) || name.startsWith('.');
}

/**
 * Whether anything between a root and a path is skipped.
 * @param {string} filePath
 * @param {string[]} roots resolved scan roots
 */
function isUnderSkipped(filePath, roots) {
    const root = roots.find((r) => filePath === r || filePath.startsWith(r + path.sep));
    // Outside every root is not this function's call; the index containment
    // check owns that.
    if (!root) return false;
    return filePath.slice(root.length + 1).split(path.sep).some((part) => part && isSkippedName(part));
}

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

/**
 * A video as the library records it, or null if it does not qualify: not a
 * regular file, empty, or an ambiguous extension that is not really video.
 * @param {string} full  absolute path
 * @param {string} [name] defaults to the basename
 */
async function inspectVideo(full, name = path.basename(full)) {
    const ext = path.extname(name).toLowerCase();
    if (!VIDEO_EXTENSIONS.has(ext)) return null;
    try {
        const stat = await fs.promises.stat(full);
        if (!stat.isFile() || stat.size === 0) return null;
        if (AMBIGUOUS_EXTENSIONS.has(ext) && !(await looksLikeTransportStream(full, stat.size))) {
            return null;
        }
        return { path: full, name, size: stat.size, mtime: stat.mtimeMs, ext };
    } catch {
        return null; // vanished or unreadable between the event and the stat
    }
}

/** A subtitle file as the library records it, or null. */
async function inspectSubtitle(full, name = path.basename(full)) {
    const ext = path.extname(name).toLowerCase();
    if (!SUBTITLE_EXTENSIONS.has(ext)) return null;
    try {
        const stat = await fs.promises.stat(full);
        if (!stat.isFile() || stat.size === 0) return null;
        return { path: full, name, size: stat.size, mtime: stat.mtimeMs, ext };
    } catch {
        return null;
    }
}

/** The subtitles, out of a directory's, that belong to this video. */
function sidecarsFor(videoName, subtitles) {
    const mediaBase = videoName.slice(0, -path.extname(videoName).length).toLowerCase();
    return subtitles.filter((subtitle) => {
        const subtitleBase = subtitle.name.slice(0, -subtitle.ext.length).toLowerCase();
        return subtitleBase === mediaBase || subtitleBase.startsWith(`${mediaBase}.`);
    });
}

/** Every qualifying subtitle in one directory, for callers without a readdir of their own. */
async function subtitlesIn(dir) {
    let names;
    try {
        names = await fs.promises.readdir(dir);
    } catch {
        return [];
    }
    const found = await Promise.all(names.map((n) => inspectSubtitle(path.join(dir, n), n)));
    return found.filter(Boolean);
}

/**
 * A link list and its text, or null. Read only here, and only up to the cap.
 * Sent as text, not parsed: the parser lives in the renderer's shared module
 * and a second copy is how the two drift apart.
 */
async function readLinkList(full, name = path.basename(full)) {
    try {
        const stat = await fs.promises.stat(full);
        if (!stat.isFile() || stat.size === 0 || stat.size > LINK_LIST_MAX_BYTES) return null;
        return {
            kind: 'linklist', path: full, name, mtime: stat.mtimeMs,
            text: await fs.promises.readFile(full, 'utf8'),
        };
    } catch {
        return null;
    }
}

module.exports = {
    VIDEO_EXTENSIONS, SUBTITLE_EXTENSIONS, AMBIGUOUS_EXTENSIONS, LINK_LIST_EXTENSION,
    LINK_LIST_MAX_BYTES, SKIP_DIRECTORIES,
    isSkippedName, isUnderSkipped, looksLikeTransportStream,
    inspectVideo, inspectSubtitle, sidecarsFor, subtitlesIn, readLinkList,
};

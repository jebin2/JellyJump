/**
 * Which files on disk the window may read (ARCHITECTURE_PLAN.md, O5).
 *
 * The renderer shows web content: shared libraries from other machines, M3U
 * lists, names from files. If it were ever made to run a script it did not
 * mean to, the read-file IPC is what that script could reach. It used to
 * allow any file with a media extension, which is every photo and video on
 * the disk. Now a file is readable only when the user has pointed at it:
 *
 * - picked in the open-file dialog (remembered across restarts, so the
 *   playlist plays again after one);
 * - found by the media scan (the library index), or a media file inside a
 *   folder the scan covers (one added since the scan);
 * - a subtitle file beside a video that is readable, named after it
 *   (`movie.mp4` → `movie.srt`, `movie.en.srt`).
 *
 * The remembered picks are kept in their own file, not in jellyjump.json,
 * which the renderer writes: what the renderer may read is not the
 * renderer's to decide.
 */
const fs = require('fs');
const path = require('path');

const MEDIA_EXTENSIONS = new Set([
    '.mp4', '.mkv', '.avi', '.webm', '.mov', '.m4v', '.wmv', '.flv', '.ts', '.m2ts', '.mts', '.3gp', '.ogv',
    '.mp3', '.flac', '.wav', '.m4a', '.aac', '.ogg', '.opus', '.ac3', '.wma',
    '.gif', '.png', '.jpg', '.jpeg', '.webp', '.m3u8',
]);
const SUBTITLE_EXTENSIONS = new Set(['.srt', '.vtt', '.ass', '.ssa']);

/** Picks kept at most; the oldest go first. */
const MAX_GRANTS = 5000;

const extOf = (p) => path.extname(p).toLowerCase();
const isMedia = (p) => MEDIA_EXTENSIONS.has(extOf(p));
const isSubtitle = (p) => SUBTITLE_EXTENSIONS.has(extOf(p));

/**
 * @param {Object} options
 * @param {string} options.file - where the picks are kept
 * @param {string} [options.configPath] - jellyjump.json, read once to keep
 *   the playlist that was there before this file existed playable
 * @param {{hasPath: (p: string) => boolean, getRoots: () => string[]}} options.index - the library index
 */
function createReadGrants({ file, configPath, index }) {
    /** @type {Set<string>} insertion order = oldest first */
    let granted = new Set();

    function load() {
        try {
            const data = JSON.parse(fs.readFileSync(file, 'utf8'));
            granted = new Set(Array.isArray(data?.paths) ? data.paths.filter((p) => typeof p === 'string') : []);
            return;
        } catch {
            // No file yet: the first run with grants. What the playlist
            // already held was picked by the user before grants existed.
        }
        try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            for (const item of config?.playlist ?? []) {
                if (typeof item?.localPath === 'string' && isMedia(item.localPath)) granted.add(path.resolve(item.localPath));
            }
        } catch { /* no config either: nothing to keep */ }
        save();
    }

    function save() {
        try {
            fs.mkdirSync(path.dirname(file), { recursive: true });
            fs.writeFileSync(file, JSON.stringify({ paths: [...granted] }), 'utf8');
        } catch (error) {
            console.error('[ReadGrants] Could not save:', error.message);
        }
    }

    /** @param {string[]} paths - resolved, picked by the user */
    function grant(paths) {
        for (const p of paths) {
            granted.delete(p); // moves it to the newest end
            granted.add(p);
        }
        while (granted.size > MAX_GRANTS) granted.delete(granted.values().next().value);
        save();
    }

    function underScanRoot(p) {
        return index.getRoots().some((root) => p === root || p.startsWith(root + path.sep));
    }

    /** @param {string} p - resolved */
    function allowsMedia(p) {
        if (granted.has(p) || index.hasPath(p)) return true;
        return isMedia(p) && underScanRoot(p);
    }

    /**
     * A subtitle named after a readable video in the same folder:
     * `<video name without extension>[.<anything>].<subtitle extension>`.
     * @param {string} p - resolved
     */
    function allowsSidecar(p) {
        if (!isSubtitle(p)) return false;
        const dir = path.dirname(p);
        const name = path.basename(p, path.extname(p));
        let entries;
        try { entries = fs.readdirSync(dir); } catch { return false; }
        return entries.some((entry) => {
            const video = path.join(dir, entry);
            if (!isMedia(video)) return false;
            const stem = path.basename(entry, path.extname(entry));
            return (name === stem || name.startsWith(stem + '.')) && allowsMedia(video);
        });
    }

    /**
     * @param {string} p - resolved
     * @returns {boolean}
     */
    function allows(p) {
        return allowsMedia(p) || allowsSidecar(p);
    }

    load();
    return { allows, grant, size: () => granted.size };
}

module.exports = { createReadGrants, MEDIA_EXTENSIONS };

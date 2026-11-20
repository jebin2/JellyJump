// @ts-check
import { generateId } from '../../shared/utils/mediaUtils.js';

/**
 * Playlist items for the files a media scan finds. Kept apart from the
 * Playlist so the mapping can be read, and tested, on its own.
 */

/** Folder that scan results are grouped under in the playlist tree. */
export const DISCOVERED_FOLDER = 'Discovered';

// How many folder levels a discovered file may nest under that. Each level
// indents, so an uncapped filesystem path can push rows off the right edge.
const MAX_DISCOVERED_DEPTH = 3;

/**
 * Turn a scan record into a playlist item.
 * Cheap by design: no metadata probe and no thumbnail, so a scan of
 * thousands of files stays fast. Duration fills in through the normal
 * on-demand path once an item is actually opened.
 */
export function discoveredItemFromScan(file) {
    const ext = file.ext?.replace('.', '') || '';
    const mimeType = ext === 'mkv' ? 'video/x-matroska'
        : ext === 'webm' ? 'video/webm'
        : ext === 'ogv' ? 'video/ogg'
        : 'video/mp4';

    return {
        title: file.name,
        url: '',                  // created on demand from localPath
        duration: '',             // unknown until opened; no probe here
        thumbnail: '',
        isLocal: true,
        isAudio: false,
        isDiscovered: true,       // keeps it out of the saved playlist
        needsReload: false,
        file: null,
        fileSize: file.size,
        fileType: mimeType,
        mimeType,
        path: discoveredPath(file.path),
        localPath: file.path,
        id: generateId(),
        ...(Array.isArray(file.subtitles) && file.subtitles.length > 0
            ? { subtitlePaths: file.subtitles.map((subtitle) => subtitle.path) }
            : {}),
    };
}

/**
 * Virtual path that places a discovered file in the folder tree, e.g.
 * /home/u/Videos/Trip/clip.mp4 -> Discovered/Videos/Trip/clip.mp4
 * PlaylistRenderer builds folders by splitting this on "/".
 */
export function discoveredPath(absolutePath) {
    const parts = absolutePath.split('/').filter(Boolean);
    // Drop the leading home-directory segments; what matters to the user is
    // the media folder the file sits in, not where their home lives.
    const home = parts.indexOf('home');
    const meaningful = home !== -1 ? parts.slice(home + 2) : parts;

    const name = meaningful[meaningful.length - 1];
    let folders = meaningful.slice(0, -1);

    // Cap the nesting. A home scan reaches genuinely deep trees, and every
    // level costs indent width — past a handful the rows run off the edge.
    // Keeping the outermost folders preserves where the file came from,
    // which is what makes the grouping useful; the rest is on the item's
    // localPath if it is ever needed.
    if (folders.length > MAX_DISCOVERED_DEPTH) {
        folders = folders.slice(0, MAX_DISCOVERED_DEPTH);
    }

    return [DISCOVERED_FOLDER, ...folders, name].join('/');
}

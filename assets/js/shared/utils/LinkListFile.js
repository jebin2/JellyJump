import { parseYouTubeUrl } from './YouTubeUrl.js';

/**
 * Link-list files: a playlist written by hand.
 *
 * A .jjlist file is one video per line, optionally named:
 *
 *     Cigarettes After Sex (Full Album) : https://www.youtube.com/watch?v=8scL5oJX6CM
 *     https://youtu.be/1PukR-byRZg
 *
 * Both forms are accepted, because a file people edit by hand will contain
 * both. A name is used when given and the video's own title is looked up when
 * it is not.
 *
 * The separator is " : " with spaces, not ":", because a URL contains a colon
 * and a title may too — splitting on the first colon would cut "https" off the
 * front of an unnamed line.
 */

/**
 * Our own extension, so a file is only ever opened when it was written for us.
 *
 * Not .txt. A media drive holds recovery codes, password exports and private
 * notes, and any rule that opens .txt files to see whether they are interesting
 * opens those too — whether it matches on contents or on a hopeful pattern in
 * the name. An extension nobody else uses means the question never arises: the
 * user names the file .jjlist, and nothing else is read.
 */
export const LINK_LIST_EXTENSION = '.jjlist';

/** The folder a list's entries are grouped under: its name without our extension. */
export function linkListFolderName(filename) {
    return filename.replace(new RegExp(`\\${LINK_LIST_EXTENSION}$`, 'i'), '');
}

/**
 * Parse the contents of such a file.
 *
 * Anything that is not a YouTube link is skipped rather than reported: these
 * files are hand-edited, so blank lines, comments and stray notes are normal
 * and are not errors.
 *
 * @param {string} text
 * @returns {Array<{id: string, start: number, url: string, name: string}>}
 */
export function parseLinkListFile(text) {
    if (typeof text !== 'string') return [];

    const entries = [];
    const seen = new Set();

    for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;

        const { name, url } = splitNameAndUrl(line);
        const parsed = parseYouTubeUrl(url);
        if (!parsed) continue;

        // The same video listed twice is one entry: a hand-edited file
        // accumulates duplicates, and two identical rows help nobody.
        const key = `${parsed.id}@${parsed.start}`;
        if (seen.has(key)) continue;
        seen.add(key);

        entries.push({ id: parsed.id, start: parsed.start, url, name });
    }

    return entries;
}

/**
 * Split "Name : https://…" into its parts.
 *
 * Split on the last " : " rather than the first, so a name containing a colon
 * survives. A line with no separator is all URL and has no name.
 */
function splitNameAndUrl(line) {
    const at = line.lastIndexOf(' : ');
    if (at === -1) return { name: '', url: line };

    return {
        name: line.slice(0, at).trim(),
        url: line.slice(at + 3).trim(),
    };
}

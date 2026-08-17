import { Logger } from '../utils/Logger.js';

/**
 * RemoteLibrary
 * Turns a JellyJump share link into playlist items.
 *
 * A share link is not a media URL: opening it returns a page, and handing it to
 * the demuxer produces "unsupported or unrecognizable format" — the file it
 * fetched was HTML. So it has to be recognised before the normal URL path gets
 * hold of it.
 *
 * Items point at the server's stream endpoint and play through the existing
 * remote-URL path, which issues range requests rather than downloading whole
 * files. Nothing is persisted: the library lives on the other machine, and a
 * saved copy would come back as broken entries whenever that machine is off.
 */

/** Cheap, specific signal: our links always carry a token. */
export function looksLikeShareLink(rawUrl) {
    try {
        const url = new URL(rawUrl);
        return (url.protocol === 'https:' || url.protocol === 'http:') && !!url.searchParams.get('token');
    } catch {
        return false;
    }
}

/**
 * Confirm a URL is a JellyJump library and return what it says about itself.
 * @returns {Promise<{ok: boolean, name?: string, count?: number, error?: string}>}
 */
export async function probe(rawUrl) {
    let url;
    try {
        url = new URL(rawUrl);
    } catch {
        return { ok: false, error: 'Not a valid URL' };
    }

    const token = url.searchParams.get('token');
    if (!token) return { ok: false, error: 'Link has no token' };

    try {
        const response = await fetch(`${url.origin}/api/info?token=${encodeURIComponent(token)}`);
        if (response.status === 401) return { ok: false, error: 'This link is no longer valid' };
        if (!response.ok) return { ok: false, error: `Server responded ${response.status}` };

        const info = await response.json();
        if (typeof info?.count !== 'number') return { ok: false, error: 'Not a JellyJump library' };
        return { ok: true, name: info.name || url.hostname, count: info.count };
    } catch (error) {
        // A blocked mixed-content request or an unreachable host both land here,
        // and the difference matters to the user.
        const hint = url.protocol === 'http:' && location.protocol === 'https:'
            ? ' (this page is https, so it cannot load an http library)'
            : '';
        return { ok: false, error: `Could not reach the library${hint}` };
    }
}

/**
 * Fetch the listing and shape it into playlist items.
 * @returns {Promise<Array>}
 */
export async function fetchItems(rawUrl) {
    const url = new URL(rawUrl);
    const token = url.searchParams.get('token');

    const response = await fetch(`${url.origin}/api/library?token=${encodeURIComponent(token)}`);
    if (!response.ok) throw new Error(`Library request failed (${response.status})`);

    const data = await response.json();
    const serverName = data.name || url.hostname;
    const items = Array.isArray(data.items) ? data.items : [];

    Logger.log(`[RemoteLibrary] ${items.length} item(s) from ${serverName}`);

    return items.map((item) => ({
        title: item.name,
        // The stream URL carries the token: mediabunny's UrlSource issues its
        // own range requests and cannot attach headers to them.
        url: `${url.origin}/api/stream/${item.id}?token=${encodeURIComponent(token)}`,
        duration: '',
        thumbnail: '',
        isLocal: false,
        isStream: false,
        isRemoteLibrary: true,
        needsReload: false,
        fileSize: item.size,
        // Grouped under the server so remote files are visibly not local ones.
        path: [serverName, item.folder, item.name].filter(Boolean).join('/'),
        remoteId: item.id,
    }));
}

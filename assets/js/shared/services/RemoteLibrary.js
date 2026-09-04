import { Logger } from '../utils/Logger.js';
import { parseLinkListFile, linkListFolderName } from '../utils/LinkListFile.js';
import { buildYouTubeItem } from '../utils/YouTubeUrl.js';

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
    const lists = Array.isArray(data.linkLists) ? data.linkLists : [];

    const shaped = items.map((item) => shapeItem(item, url, token, serverName, rawUrl));
    for (const list of lists) shaped.push(...shapeLinkList(list, serverName, rawUrl));

    Logger.log(`[RemoteLibrary] ${shaped.length} item(s) from ${serverName}`);

    return shaped;
}

/**
 * A .jjlist from the other machine, as playlist items.
 *
 * The host sends the file's text rather than parsed entries, so the rules for
 * reading one live in a single module instead of being restated in a process
 * that cannot import it. These play through YouTube like any other YouTube
 * item — there is no file on the other machine to stream, and nothing is
 * fetched from it for them.
 */
function shapeLinkList(list, serverName, rawUrl) {
    const folder = linkListFolderName(list.name || 'Links');

    return parseLinkListFile(list.text).map((entry) => buildYouTubeItem(entry, entry.url, {
        title: entry.name,
        path: [serverName, folder, entry.name || entry.id].join('/'),
        extra: {
            // Grouped with the rest of the library, so the folder's reload and
            // remove act on these too.
            remoteSource: rawUrl,
            remoteServer: serverName,
            // These belong to the other machine's library exactly as its video
            // files do, and this is the flag that keeps a library out of local
            // storage. Without it they were the one part of a shared library
            // that got saved: on the next launch they came back from the
            // database and were then fetched again, so the folder was already
            // on screen before the listing started -- no loading row, and every
            // entry listed twice once it finished.
            isRemoteLibrary: true,
        },
    }));
}

/**
 * One listing entry as a playlist item. Shared by both fetch paths so a
 * streamed library and a whole-response one are indistinguishable afterwards.
 */
function shapeItem(item, url, token, serverName, rawUrl) {
    return {
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
        // Lets the folder offer a refresh: the listing is a snapshot, and the
        // other machine keeps scanning after it was taken.
        remoteSource: rawUrl,
        remoteServer: serverName,
    };
}

/**
 * Fetch the listing progressively, handing over each batch as it arrives.
 *
 * fetchItems waits for the whole response, so nothing appears until the last
 * byte lands. A library of tens of thousands of files is megabytes, and over a
 * tailnet that is a long stare at an empty playlist for a request that was
 * always going to succeed.
 *
 * The host is a different machine on whatever build it happens to be running,
 * so the streaming endpoint may simply not be there. Anything other than a
 * readable NDJSON stream — a 404 from an older host, an unreachable one, a
 * captive portal answering 200 with a login page — falls back to fetchItems,
 * which either succeeds or throws an error worth showing. Callers do not have
 * to care which path ran.
 *
 * @param {string} rawUrl
 * @param {(items: Array) => void} onBatch - called with each batch, in order
 * @returns {Promise<{total: number, expected: number|null, complete: boolean}>}
 *   how many arrived, how many the host said it had, and whether the stream
 *   ended where it should have. A caller that added items as they arrived needs
 *   `complete` to know whether what it is showing is the whole library.
 */
export async function fetchItemsStreaming(rawUrl, onBatch) {
    const url = new URL(rawUrl);
    const token = url.searchParams.get('token');
    const endpoint = `${url.origin}/api/library/stream?token=${encodeURIComponent(token)}`;

    const wholeResponse = async () => {
        const all = await fetchItems(rawUrl);
        if (all.length) onBatch(all);
        return { total: all.length, expected: all.length, complete: true };
    };

    let response;
    try {
        response = await fetch(endpoint);
    } catch {
        // Unreachable host, blocked mixed content, CORS. The plain endpoint
        // fails the same way and reports it properly, so let it.
        return wholeResponse();
    }

    if (!response.ok || !response.body) return wholeResponse();

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let header = null;
    let total = 0;
    let batch = [];

    const flush = () => {
        if (!batch.length) return;
        onBatch(batch);
        batch = [];
    };

    // Set when the first line is not a library header, meaning whatever
    // answered is not speaking NDJSON. Checked here rather than only after the
    // chunk so that not one item from a bogus stream is ever handed over — the
    // fallback would then add them a second time.
    let bogus = false;

    const consume = (line) => {
        if (bogus || !line) return;
        let parsed;
        try {
            parsed = JSON.parse(line);
        } catch {
            // Mid-stream this is a truncated line from a host that died; on the
            // first line it means this is not our NDJSON at all.
            if (!header) bogus = true;
            return;
        }
        if (!header) {
            if (typeof parsed?.count !== 'number') {
                bogus = true;
                return;
            }
            header = parsed;
            return;
        }
        if (parsed?.kind === 'linklist') {
            const expanded = shapeLinkList(parsed, header.name || url.hostname, rawUrl);
            batch.push(...expanded);
            total += expanded.length;
            return;
        }
        batch.push(shapeItem(parsed, url, token, header.name || url.hostname, rawUrl));
        total++;
        // Handed over in batches rather than per item: the caller re-renders on
        // each one, and a render per file would spend the whole download
        // rebuilding the tree.
        if (batch.length >= 250) flush();
    };

    let complete = false;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let newline;
            while ((newline = buffer.indexOf('\n')) !== -1) {
                consume(buffer.slice(0, newline));
                buffer = buffer.slice(newline + 1);
            }

            // A proxy or captive portal answering 200 with a page. Nothing has
            // been handed over, so the plain endpoint can still be tried
            // cleanly — stop reading the rest of whatever this is.
            if (bogus) {
                reader.cancel().catch(() => {});
                Logger.warn('[RemoteLibrary] Streaming endpoint did not answer with a library, falling back');
                return wholeResponse();
            }

            flush();
        }
        consume(buffer.trim());
        flush();
        complete = true;
    } catch (error) {
        // The connection dropped partway. What arrived is real and already
        // handed over, so it is kept rather than discarded — but the caller is
        // told this is not the whole library, because silently showing a
        // fraction of someone's files as if it were all of them is worse than
        // saying so.
        flush();
        Logger.warn(`[RemoteLibrary] Listing stopped after ${total} item(s):`, error?.message || error);
    }

    // A response short enough to end inside the first chunk reaches here rather
    // than the in-loop check above.
    if (bogus || !header) return wholeResponse();

    const expected = typeof header.count === 'number' ? header.count : null;
    // The host keeps scanning while it serves, so arriving with more than the
    // header promised is normal and not a truncation.
    if (complete && expected !== null && total < expected) complete = false;

    Logger.log(`[RemoteLibrary] ${total} item(s) streamed from ${header?.name || url.hostname}`
        + (complete ? '' : ` (incomplete, expected ${expected ?? '?'})`));
    return { total, expected, complete };
}

const SAVED_LINKS_KEY = 'jellyjump-remote-libraries';

/**
 * Share links to restore on next load.
 *
 * The link is saved rather than the items it produced. Items point at another
 * machine, so a saved copy comes back stale — files renamed or deleted there
 * would linger here as entries that fail when clicked. Re-fetching from the
 * link gives whatever is actually on the other machine now, and costs one
 * request.
 *
 * The link contains the token, so this is a credential at rest. It sits beside
 * the rest of the app's local state, which is the same exposure as the saved
 * playlist itself.
 */
/**
 * The machine a share link points at, for saying which library is missing
 * without putting its token on screen — the link is a credential.
 * @param {string} rawUrl
 * @returns {string}
 */
export function hostOf(rawUrl) {
    try {
        return new URL(rawUrl).host;
    } catch {
        return 'that machine';
    }
}

export function savedLinks() {
    try {
        const raw = JSON.parse(localStorage.getItem(SAVED_LINKS_KEY));
        return Array.isArray(raw) ? raw : [];
    } catch {
        return [];
    }
}

export function rememberLink(rawUrl) {
    const links = savedLinks();
    if (links.includes(rawUrl)) return;
    links.push(rawUrl);
    try {
        localStorage.setItem(SAVED_LINKS_KEY, JSON.stringify(links));
    } catch {
        // Storage full or blocked; the library still works this session.
    }
}

export function forgetLink(rawUrl) {
    try {
        localStorage.setItem(SAVED_LINKS_KEY, JSON.stringify(savedLinks().filter(l => l !== rawUrl)));
    } catch {
        // Nothing to do; it simply stays remembered.
    }
}

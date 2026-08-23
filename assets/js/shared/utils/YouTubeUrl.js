/**
 * Recognising YouTube links.
 *
 * A YouTube page is not a media file: handing one to the demuxer fetches HTML
 * and fails with "unsupported or unrecognizable format", which tells the user
 * nothing. So a link has to be recognised before the normal URL path gets hold
 * of it — the same reason share links are sniffed first.
 *
 * Parsing only. Nothing here touches the network or the DOM, so the rules are
 * testable on their own.
 */

/** Video ids are exactly 11 characters from this alphabet. */
const ID = /^[A-Za-z0-9_-]{11}$/;

const HOSTS = new Set([
    'youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com',
    'youtube-nocookie.com', 'www.youtube-nocookie.com',
    'youtu.be', 'www.youtu.be',
]);

/**
 * A start offset, which YouTube writes several ways: plain seconds (t=90) or
 * a duration (t=1m30s, t=1h2m3s). Anything unparseable is simply no offset —
 * a link that plays from the beginning beats refusing the link.
 */
function parseStart(value) {
    if (!value) return 0;

    if (/^\d+$/.test(value)) return parseInt(value, 10);

    const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(value);
    if (!match || (!match[1] && !match[2] && !match[3])) return 0;

    return (parseInt(match[1] || '0', 10) * 3600)
        + (parseInt(match[2] || '0', 10) * 60)
        + parseInt(match[3] || '0', 10);
}

/**
 * @param {string} rawUrl
 * @returns {{id: string, start: number}|null} null when this is not a YouTube
 *   video link — including YouTube URLs that are not a single video, like a
 *   channel or a search, which have nothing to embed.
 */
export function parseYouTubeUrl(rawUrl) {
    if (typeof rawUrl !== 'string') return null;

    let url;
    try {
        url = new URL(rawUrl.trim());
    } catch {
        return null;
    }

    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (!HOSTS.has(url.hostname)) return null;

    const start = parseStart(url.searchParams.get('t') || url.searchParams.get('start'));
    const path = url.pathname;

    // youtu.be/<id>
    if (url.hostname.endsWith('youtu.be')) {
        const id = path.slice(1).split('/')[0];
        return ID.test(id) ? { id, start } : null;
    }

    // /watch?v=<id>
    if (path === '/watch') {
        const id = url.searchParams.get('v');
        return id && ID.test(id) ? { id, start } : null;
    }

    // /embed/<id>, /shorts/<id>, /live/<id>, /v/<id>
    const match = /^\/(embed|shorts|live|v)\/([^/?#]+)/.exec(path);
    if (match && ID.test(match[2])) return { id: match[2], start };

    return null;
}

/** Cheap yes/no for callers that only need to route. */
export function looksLikeYouTubeUrl(rawUrl) {
    return parseYouTubeUrl(rawUrl) !== null;
}

/**
 * Title and thumbnail for a video, via oEmbed.
 *
 * oEmbed rather than the Data API: no key, no quota, no account. It is only
 * used to make the playlist row readable, so a failure falls back to the id
 * rather than refusing to add the video.
 *
 * @returns {Promise<{title: string, thumbnail: string, author: string}>}
 */
export async function fetchYouTubeInfo(id) {
    const fallback = { title: `YouTube ${id}`, thumbnail: thumbnailUrl(id), author: '' };
    try {
        const response = await fetch(
            `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`
        );
        if (!response.ok) return fallback;

        const data = await response.json();
        return {
            title: data.title || fallback.title,
            thumbnail: data.thumbnail_url || fallback.thumbnail,
            author: data.author_name || '',
        };
    } catch {
        // Offline, blocked, or rate limited. The video may still play.
        return fallback;
    }
}

/** Predictable thumbnail URL, used when oEmbed cannot be reached. */
export function thumbnailUrl(id) {
    return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

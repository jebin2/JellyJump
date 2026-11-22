// @ts-check
/**
 * The Content-Security-Policy of each page, in one place (ARCHITECTURE_PLAN.md,
 * O3). The build writes it into the page's <meta> tag (vite.config.js), so
 * the four pages cannot drift apart, and every allowed source says why.
 *
 * Outside services come from services.js: a service added there and used
 * from a page is allowed here by name, not by a hand-copied address.
 */
import { SERVICES } from './services.js';

/** @param {string} url */
const origin = (url) => new URL(url).origin;

/** @typedef {Record<string, string[]>} Policy */

/** @type {Policy} */
const APP = {
    'default-src': ["'self'"],
    // The decoders are WebAssembly (AC-3, DTS, TrueHD, the subtitle model).
    'script-src': ["'self'", "'wasm-unsafe-eval'"],
    // The code sets element styles (positions, sizes, progress widths).
    'style-src': ["'self'", "'unsafe-inline'"],
    // Thumbnails and posters from whatever server a stream, an M3U list or a
    // shared library is on, which can be any host, and plain http on a LAN.
    'img-src': ["'self'", 'blob:', 'data:', 'https:', 'http:'],
    'media-src': ["'self'", 'blob:', 'data:', 'https:', 'http:'],
    // A video URL, an M3U list, a shared library (another machine), the
    // subtitle model: any host, chosen by the user.
    'connect-src': ['*', 'blob:', 'data:'],
    // The media worker; MediaBunny's decoders start workers from blobs.
    'worker-src': ["'self'", 'blob:'],
    'font-src': ["'self'", 'data:'],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
};

/** The pages that play YouTube links: its iframe API, and its player in a frame. */
const WITH_YOUTUBE = {
    ...APP,
    'script-src': [...APP['script-src'], origin(SERVICES.youtubeIframeApi)],
    'frame-src': [origin(SERVICES.youtubeEmbed), origin(SERVICES.youtubeWatch)],
};

/** @type {Record<string, Policy>} */
const PAGES = {
    /** The landing page. */
    index: APP,
    player: WITH_YOUTUBE,
    embed: WITH_YOUTUBE,
    /**
     * A friend's Watch Party view: shows a peer-to-peer stream and nothing
     * else, so it allows much less. connect-src * for the signalling server
     * and the peer connection.
     */
    watch: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:'],
        'font-src': ["'self'"],
        'media-src': ["'self'", 'blob:', 'mediastream:'],
        'connect-src': ['*'],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'none'"],
    },
};

/**
 * @param {string} page - the page's file name without `.html`
 * @returns {string} the policy, as the <meta> tag's content
 */
export function cspFor(page) {
    const policy = PAGES[page];
    if (!policy) throw new Error(`No Content-Security-Policy for the page "${page}"`);
    return Object.entries(policy).map(([directive, sources]) => `${directive} ${sources.join(' ')}`).join('; ');
}

export const CSP_PAGES = Object.keys(PAGES);

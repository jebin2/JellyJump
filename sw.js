// JellyJump service worker.
//
// 1. Cross-origin isolation. Adds Cross-Origin-Opener/Embedder-Policy headers
//    to this site's responses, so the page is isolated even on static hosts
//    that cannot set headers (GitHub Pages). Isolation unlocks multi-threaded
//    WASM (SharedArrayBuffer), which roughly halves CPU subtitle
//    transcription time and speeds up mediabunny. `credentialless` keeps
//    cross-origin CDN/model downloads working without CORP headers on them.
//
// 2. Offline (ARCHITECTURE_PLAN.md Q4). After a first visit the player opens
//    and plays a local file with the network off:
//    - once the worker is active, the build's precache list is stored in the
//      background: the pages, the code they load at start and the chunks
//      they import directly (the player, the playlist, MediaBunny), and the
//      on-demand DTS and TrueHD decoders;
//    - a hashed build file (it never changes under its name) is answered from
//      the cache, and stored the first time it is fetched: a tool used once
//      works offline after;
//    - a page, or any other file of the site, comes from the network when
//      there is one, so a deploy shows at once, and from the cache when not.
//    The build writes BUILD below (vite.config.js, jellyjump-sw). Each build
//    changes this file, so the browser installs the new worker, which stores
//    the new build and drops what no build file is any more. version.json,
//    media (.mp4), source maps and range requests are never stored.
//
// A pull request's preview lives under previews/<n>/ with its own worker and
// caches; this one leaves those paths' caching alone.

/** @type {{id: string, precache: string[], files: string[]}|null} null in dev */
const BUILD = {"id":"015194a8","precache":["assets/DecorationLayer-2xZwzBIJ.js","assets/DiagnosticsView-lAQ36D7Y.js","assets/ErrorReporter-CkkKVcRy.css","assets/ErrorReporter-DH4TIt8B.js","assets/JobQueue-X4gFAD3x.js","assets/Logger-DQc-mQPg.js","assets/MetadataService-D-qPDeET.js","assets/Metrics-BvVG6ZZO.js","assets/Modal-D2hlmO3y.js","assets/OverlayCompositor-CQKrgLk8.js","assets/PieceStoreWorker-B5EsCZLn.js","assets/Playlist-BYY8kUHs.js","assets/SpaceGrotesk-Bold-Bx5ssXV-.ttf","assets/SpaceGrotesk-Medium-DnsmCY5X.ttf","assets/SpaceGrotesk-Regular-DpFQlKNO.ttf","assets/SpaceGrotesk-SemiBold-DjqJml4C.ttf","assets/SpaceMono-Bold-Ca3FXji2.ttf","assets/SpaceMono-Regular-CWgeSjJ4.ttf","assets/StreamDetector-SpBNQhAX.js","assets/Templates-DuKuTQ0b.js","assets/WatchParty-kxKE06BN.js","assets/coi-CmEwtEfQ.js","assets/coi-DgKzoTlh.css","assets/createPlayer-DD9p5rxm.js","assets/dashboard-CV4EScCw.css","assets/dashboard-DRYUvN90.js","assets/html-BLzzGjX8.js","assets/icons/jelly_jump_logo.png","assets/icons/sprite.svg","assets/jelly_jump_logo-jF-iEcbg.gif","assets/jelly_jump_logo-qiMeMAa9.png","assets/jelly_play-BM5NAVCG.webp","assets/js/lib/gif.worker.js","assets/mediabunny-dts-BoTykjrq.js","assets/mediabunny-truehd-CNXKqY_4.js","assets/player-CdGYV_A8.js","assets/player-DyUqVfoJ.css","assets/preload-helper-B8YEJJ5A.css","assets/preload-helper-qai7ov5E.js","assets/reload-on-stale-chunks-Bi7PYhxx.js","assets/rolldown-runtime-CEoa-xHZ.js","assets/templates/player-templates.html","assets/templates/playlist-templates.html","assets/templates/screenshot-templates.html","dashboard.html","favicon.ico","icon-192.png","icon-512.png","index.html","manifest.json","player.html"],"files":["assets/AudioVisualizer-Bqe04Wj_.js","assets/BlurMenu-B4WvbUgl.js","assets/BoxEditorUtils-B_XI4FH-.js","assets/CancellableJob-2Bn8GMPZ.js","assets/CombineAVMenu-DGsxjc13.js","assets/ConfirmDialog-XqkTBE4W.js","assets/ConvertMenu-C-hDpPB-.js","assets/CropMenu-CYLpB29r.js","assets/CustomDropdown-Cs7Q8MM2.js","assets/CutDetectionMenu-pLDunhsJ.js","assets/DecorationLayer-2xZwzBIJ.js","assets/DiagnosticsView-lAQ36D7Y.js","assets/EncryptMenu-D1dFr4ZV.js","assets/ErrorReporter-CkkKVcRy.css","assets/ErrorReporter-DH4TIt8B.js","assets/ExportMenu-C_QkFaer.js","assets/FileBlob-7MRLQ6TG-BvRk9kiK.js","assets/GifMenu-3axF2mjG.js","assets/InfoMenu-Bu8bTWNQ.js","assets/JobQueue-X4gFAD3x.js","assets/Logger-DQc-mQPg.js","assets/MediaProcessor-BbfM62Vo.js","assets/MenuJob-DgQuQ0Hx.js","assets/MergeMenu-B2MSdVvF.js","assets/MetadataService-D-qPDeET.js","assets/Metrics-BvVG6ZZO.js","assets/Modal-D2hlmO3y.js","assets/MotionDetectionMenu-zhGG_5rh.js","assets/MultiCutMenu-DQ_86CqI.js","assets/OptimizeMenu-BVPZSGAf.js","assets/OverlayCompositor-CQKrgLk8.js","assets/PieceStoreWorker-B5EsCZLn.js","assets/PlatformCrypto-BtMoSovF.js","assets/Playlist-BYY8kUHs.js","assets/PreviewPlayer-C4lUVsTQ.js","assets/RecordMenu-C-oSw0ei.js","assets/RemoveBackgroundMenu-hPvAnqPu.js","assets/ResizeMenu-BJw90WXl.js","assets/RotateMenu-NugRZCOO.js","assets/ScreenRecorderMenu-BKHfPOIz.js","assets/ShareMenu-ChjtSyD6.js","assets/ShareState-jV8c7vlq.js","assets/SidebarToggle-xoIATlju.js","assets/SlideshowMenu-Dtg5B2Ng.js","assets/SpaceGrotesk-Bold-Bx5ssXV-.ttf","assets/SpaceGrotesk-Medium-DnsmCY5X.ttf","assets/SpaceGrotesk-Regular-DpFQlKNO.ttf","assets/SpaceGrotesk-SemiBold-DjqJml4C.ttf","assets/SpaceMono-Bold-Ca3FXji2.ttf","assets/SpaceMono-Regular-CWgeSjJ4.ttf","assets/SpeedReverseMenu-sle6S6Of.js","assets/StreamDetector-SpBNQhAX.js","assets/SubtitleConverter-DGtgNNM5.js","assets/SubtitleGenerator-xVIYsVqx.js","assets/Templates-DuKuTQ0b.js","assets/ToolsMenu-DUJhaRGH.js","assets/TrackManagerMenu-DGjjq8RA.js","assets/TrimMenu-sRMtj10o.js","assets/ValidationModal-DxwlAL7n.js","assets/WatchParty-kxKE06BN.js","assets/WatchPartyMenu-BzFbHgMa.js","assets/WatermarkMenu-WH3Np_2l.js","assets/WhisperWorker-D_y01kRL.js","assets/coi-CmEwtEfQ.js","assets/coi-DgKzoTlh.css","assets/createPlayer-DD9p5rxm.js","assets/dashboard-CV4EScCw.css","assets/dashboard-DRYUvN90.js","assets/detection-Boiipo-s.js","assets/embed-Cnvnr77q.js","assets/html-BLzzGjX8.js","assets/jelly_jump_logo-jF-iEcbg.gif","assets/jelly_jump_logo-qiMeMAa9.png","assets/jelly_play-BM5NAVCG.webp","assets/media-worker-nbOW-wUy.js","assets/mediabunny-aac-encoder-BJ4coZhd.js","assets/mediabunny-aac-encoder-D5FOHQ2k.js","assets/mediabunny-dts-BoTykjrq.js","assets/mediabunny-flac-encoder-B13PRSho.js","assets/mediabunny-flac-encoder-BS_J37nx.js","assets/mediabunny-mp3-encoder-D9Axralo.js","assets/mediabunny-mp3-encoder-DZlQmrtE.js","assets/mediabunny-truehd-CNXKqY_4.js","assets/ort-wasm-simd-threaded.asyncify-CxOG5pUO.wasm","assets/player-CdGYV_A8.js","assets/player-DyUqVfoJ.css","assets/preload-helper-B8YEJJ5A.css","assets/preload-helper-qai7ov5E.js","assets/reload-on-stale-chunks-Bi7PYhxx.js","assets/rolldown-runtime-CEoa-xHZ.js","assets/sha256-node-TNZ2WHTI-BvRk9kiK.js","assets/sha256-wrapper-DYTB3MXW-BiAm_zHy.js","assets/sprite-DJq0wWlQ.svg","assets/sub-paths-F6TP7MGR-BvRk9kiK.js","assets/watch-CXKj5lP3.js"]};

const SCOPE = self.registration.scope;
const PREFIX = `jj-offline:${SCOPE}:`;
const PRECACHE = `${PREFIX}precache:${BUILD?.id ?? 'dev'}`;
const RUNTIME = `${PREFIX}runtime`;
const HASHED = new Set((BUILD?.files ?? []).map((file) => new URL(file, SCOPE).href));

self.addEventListener('install', () => self.skipWaiting());

/** @type {Promise<void>|null} the precache being stored, in this run of the worker */
let precaching = null;

/**
 * Store the precache in the background. Not part of install or activate:
 * the page waits for the worker to be active (coi.js reloads then, to be
 * isolated), and a few megabytes would hold that reload up while the user is
 * already using the page. Each file on its own, and only those not stored
 * yet: a file that fails (a flaky network) is tried again the next time the
 * worker runs, and the worker stopped halfway picks up where it was.
 */
function ensurePrecached() {
    if (!BUILD) return Promise.resolve();
    const files = BUILD.precache;
    precaching ??= (async () => {
        const cache = await caches.open(PRECACHE);
        await Promise.all(files.map(async (file) => {
            const url = new URL(file, SCOPE).href;
            try {
                if (await cache.match(url)) return;
                const response = await fetch(url, { cache: 'no-cache' });
                if (keepable(response)) await cache.put(url, response);
            } catch { /* tried again the next time the worker runs */ }
        }));
    })();
    return precaching;
}

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        await self.clients.claim();
        if (!BUILD) return;
        // Earlier builds' precaches go; stored files stay while this build
        // still has them (a tool used last week), the rest go.
        for (const name of await caches.keys()) {
            if (name.startsWith(`${PREFIX}precache:`) && name !== PRECACHE) await caches.delete(name);
        }
        const runtime = await caches.open(RUNTIME);
        for (const request of await runtime.keys()) {
            if (isHashedPath(request.url) && !HASHED.has(request.url)) await runtime.delete(request);
        }
    })());
    // Started, not waited for (see ensurePrecached); the page's requests keep
    // the worker running until it is done.
    ensurePrecached();
});

self.addEventListener('fetch', (event) => {
    const req = event.request;

    // Range/`only-if-cached` requests in non-same-origin mode must pass through.
    if (req.cache === 'only-if-cached' && req.mode !== 'same-origin') return;

    const url = new URL(req.url);

    // Only touch real network (http/https) responses. Never intercept blob:/data:
    // etc. — mediabunny reads video data through those and must not be re-wrapped.
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

    // Cross-origin requests (HF model, CDN wasm, remote video) are left alone;
    // `credentialless` COEP lets them load without CORP headers.
    if (url.origin !== self.location.origin) return;

    event.respondWith(respond(req, url).then(isolated));
    if (BUILD) event.waitUntil(ensurePrecached());
});

/**
 * @param {Request} req
 * @param {URL} url
 * @returns {Promise<Response>}
 */
async function respond(req, url) {
    if (!BUILD || !storable(req, url)) return fetch(req);
    const key = url.href.split('#')[0];
    if (HASHED.has(key)) {
        const hit = await caches.match(key);
        if (hit) return hit;
        const response = await fetch(req);
        if (keepable(response)) await put(key, response.clone());
        return response;
    }
    try {
        const response = await fetch(req);
        if (keepable(response)) await put(key, response.clone());
        return response;
    } catch (error) {
        // Offline: the stored copy, this build's own first (a page stored
        // under an earlier build may name files that are gone). The query is
        // not part of what a file is here: a page asked for with one
        // (player.html?debug=1) is the same page, and the templates are
        // fetched with ?v=<build> only to get past the HTTP cache.
        const options = { ignoreSearch: true };
        // A folder is its index.html: the site's root is the player, stored by that name.
        const page = url.pathname.endsWith('/') ? new URL('index.html', url).href : key;
        const hit = await (await caches.open(PRECACHE)).match(page, options) ?? await caches.match(page, options);
        if (hit) return hit;
        throw error;
    }
}

/**
 * @param {Request} req
 * @param {URL} url
 */
function storable(req, url) {
    if (req.method !== 'GET' || req.headers.has('range')) return false;
    if (!url.href.startsWith(SCOPE)) return false;
    const path = url.href.slice(SCOPE.length).split(/[?#]/)[0];
    if (path.startsWith('previews/')) return false;
    if (path === 'version.json' || path === 'sw.js') return false;
    return !/\.(mp4|map)$/i.test(path);
}

/**
 * A response worth storing: a whole same-origin one. A redirected one would
 * be refused when it answered a page load.
 * @param {Response} response
 */
function keepable(response) {
    return response.ok && response.type === 'basic' && !response.redirected && response.status === 200;
}

/** A file the build names with a content hash (assets/name-HASH.ext). */
function isHashedPath(href) {
    return /\/assets\/[^/]+-[A-Za-z0-9_-]{8}\.[a-z0-9]+$/i.test(href.split(/[?#]/)[0]);
}

/**
 * @param {string} key
 * @param {Response} response
 */
async function put(key, response) {
    try {
        await (await caches.open(RUNTIME)).put(key, response);
    } catch { /* storage full: served from the network as before */ }
}

/**
 * The response with the isolation headers. Redirects and opaque responses
 * cannot be rebuilt, so they pass as they are.
 * @param {Response} res
 */
function isolated(res) {
    if (res.status === 0 || res.type === 'opaqueredirect' || res.type === 'opaque') return res;
    const headers = new Headers(res.headers);
    headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    headers.set('Cross-Origin-Embedder-Policy', 'credentialless');
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

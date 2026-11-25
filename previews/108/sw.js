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
const BUILD = {"id":"pr108-89067787","precache":["assets/DecorationLayer-BO5QjZUL.js","assets/DiagnosticsView-DzXTe9Mc.js","assets/ErrorReporter-D47Dymdg.css","assets/ErrorReporter-DkqcP43G.js","assets/JobQueue-BY7Wt2U1.js","assets/Logger-B83JeH6l.js","assets/MetadataService-DTrywdPC.js","assets/Metrics-BvVG6ZZO.js","assets/Modal-DR4XwvVr.js","assets/OverlayCompositor-Dbe1hJdd.js","assets/PieceStoreWorker-B5EsCZLn.js","assets/Playlist-DnVynq5i.js","assets/SpaceGrotesk-Bold-Bx5ssXV-.ttf","assets/SpaceGrotesk-Medium-DnsmCY5X.ttf","assets/SpaceGrotesk-Regular-DpFQlKNO.ttf","assets/SpaceGrotesk-SemiBold-DjqJml4C.ttf","assets/SpaceMono-Bold-Ca3FXji2.ttf","assets/SpaceMono-Regular-CWgeSjJ4.ttf","assets/StreamDetector-ClLq70Or.js","assets/Templates-DuKuTQ0b.js","assets/WatchParty-BaHMFrkE.js","assets/coi-CwPqCn7p.js","assets/coi-DgKzoTlh.css","assets/createPlayer-BlM2Av3A.js","assets/html-BLzzGjX8.js","assets/icons/jelly_jump_logo.png","assets/icons/sprite.svg","assets/jelly_jump_logo-jF-iEcbg.gif","assets/jelly_jump_logo-qiMeMAa9.png","assets/jelly_play-BM5NAVCG.webp","assets/js/lib/gif.worker.js","assets/main-awPzW3YG.js","assets/main-vqDXxngW.css","assets/mediabunny-D3TGndiP.svg","assets/mediabunny-dts-DluCuCaD.js","assets/mediabunny-truehd-DR1C9j-q.js","assets/player-D8P1Bibf.js","assets/player-DyUqVfoJ.css","assets/preload-helper-CCJYESOX.js","assets/preload-helper-CYrrSMBq.css","assets/reload-on-stale-chunks-_pbgUTsl.js","assets/rolldown-runtime-CEoa-xHZ.js","assets/templates/player-templates.html","assets/templates/playlist-templates.html","assets/templates/screenshot-templates.html","favicon.ico","icon-192.png","icon-512.png","index.html","manifest.json","player.html","poster.webp"],"files":["assets/AudioVisualizer-DsojZL9l.js","assets/BlurMenu-BELnvaiY.js","assets/BoxEditorUtils-B_XI4FH-.js","assets/CancellableJob-Dk2SmsE4.js","assets/CombineAVMenu-BFha9EPZ.js","assets/ConfirmDialog-C1auTPgr.js","assets/ConvertMenu-ewcmslLT.js","assets/CropMenu-BjFhiYbI.js","assets/CustomDropdown-Cs7Q8MM2.js","assets/CutDetectionMenu-H7fLZIyT.js","assets/DecorationLayer-BO5QjZUL.js","assets/DiagnosticsView-DzXTe9Mc.js","assets/EncryptMenu-DThbiipg.js","assets/ErrorReporter-D47Dymdg.css","assets/ErrorReporter-DkqcP43G.js","assets/ExportMenu-DfTAO958.js","assets/FileBlob-7MRLQ6TG-BvRk9kiK.js","assets/GifMenu-DHzUigEd.js","assets/InfoMenu-D6i7eXvt.js","assets/JobQueue-BY7Wt2U1.js","assets/Logger-B83JeH6l.js","assets/MediaProcessor-BMHok_Tc.js","assets/MenuJob-9G2x_o_4.js","assets/MergeMenu-mphLdLob.js","assets/MetadataService-DTrywdPC.js","assets/Metrics-BvVG6ZZO.js","assets/Modal-DR4XwvVr.js","assets/MotionDetectionMenu-Cy7voQiY.js","assets/MultiCutMenu-1kv19l7m.js","assets/OptimizeMenu-muNuEbqS.js","assets/OverlayCompositor-Dbe1hJdd.js","assets/PieceStoreWorker-B5EsCZLn.js","assets/PlatformCrypto-CfSsKh3g.js","assets/Playlist-DnVynq5i.js","assets/PreviewPlayer-C4lUVsTQ.js","assets/RecordMenu-DKyMmTBs.js","assets/RemoveBackgroundMenu-pDYY9rQr.js","assets/ResizeMenu-D7xnxy4F.js","assets/RotateMenu-C4QH4VoA.js","assets/ScreenRecorderMenu-DVz1dPwO.js","assets/ShareMenu-Nd1_khi5.js","assets/ShareState-B3Ujlhgx.js","assets/SidebarToggle-q97kqwWD.js","assets/SlideshowMenu-DtaFquLb.js","assets/SpaceGrotesk-Bold-Bx5ssXV-.ttf","assets/SpaceGrotesk-Medium-DnsmCY5X.ttf","assets/SpaceGrotesk-Regular-DpFQlKNO.ttf","assets/SpaceGrotesk-SemiBold-DjqJml4C.ttf","assets/SpaceMono-Bold-Ca3FXji2.ttf","assets/SpaceMono-Regular-CWgeSjJ4.ttf","assets/SpeedReverseMenu-AGvLY5Wg.js","assets/StreamDetector-ClLq70Or.js","assets/SubtitleConverter-DGtgNNM5.js","assets/SubtitleGenerator-BVtxfg-2.js","assets/Templates-DuKuTQ0b.js","assets/ToolsMenu-CIu3yV5h.js","assets/TrackManagerMenu-DhKYGH1-.js","assets/TrimMenu-DdBQrbY4.js","assets/ValidationModal-DxwlAL7n.js","assets/WatchParty-BaHMFrkE.js","assets/WatchPartyMenu-HLeljYXX.js","assets/WatermarkMenu-CowpOzW5.js","assets/WhisperWorker-D_y01kRL.js","assets/coi-CwPqCn7p.js","assets/coi-DgKzoTlh.css","assets/createPlayer-BlM2Av3A.js","assets/detection-B2hFc8Ec.js","assets/embed-CBrvO5Mf.js","assets/html-BLzzGjX8.js","assets/jelly_jump_logo-jF-iEcbg.gif","assets/jelly_jump_logo-qiMeMAa9.png","assets/jelly_play-BM5NAVCG.webp","assets/main-awPzW3YG.js","assets/main-vqDXxngW.css","assets/media-worker-B5-sCxpy.js","assets/mediabunny-D3TGndiP.svg","assets/mediabunny-aac-encoder-CEqXqr0T.js","assets/mediabunny-aac-encoder-CkF6MF5E.js","assets/mediabunny-dts-DluCuCaD.js","assets/mediabunny-flac-encoder-CgaChtsi.js","assets/mediabunny-flac-encoder-Hbq1_7B1.js","assets/mediabunny-mp3-encoder-BmstVHrH.js","assets/mediabunny-mp3-encoder-CPJPUmeg.js","assets/mediabunny-truehd-DR1C9j-q.js","assets/ort-wasm-simd-threaded.asyncify-CxOG5pUO.wasm","assets/player-D8P1Bibf.js","assets/player-DyUqVfoJ.css","assets/preload-helper-CCJYESOX.js","assets/preload-helper-CYrrSMBq.css","assets/reload-on-stale-chunks-_pbgUTsl.js","assets/rolldown-runtime-CEoa-xHZ.js","assets/sha256-node-TNZ2WHTI-BvRk9kiK.js","assets/sha256-wrapper-DYTB3MXW-BiAm_zHy.js","assets/sprite-DJq0wWlQ.svg","assets/sub-paths-F6TP7MGR-BvRk9kiK.js","assets/watch-Cax7cHNL.js"]};

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
        const hit = await (await caches.open(PRECACHE)).match(key, options) ?? await caches.match(key, options);
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

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
const BUILD = {"id":"pr109-fb5cf208","precache":["assets/DecorationLayer-DmO7ozlR.js","assets/DiagnosticsView-D6gWt7Q2.js","assets/ErrorReporter-CIs8YSHc.js","assets/ErrorReporter-D47Dymdg.css","assets/JobQueue-C8O2OfED.js","assets/Logger-BugK5WR1.js","assets/MetadataService-BV3O4oo4.js","assets/Metrics-BvVG6ZZO.js","assets/Modal-JbxPyNE2.js","assets/OverlayCompositor-TBancsSK.js","assets/PieceStoreWorker-B5EsCZLn.js","assets/Playlist-CmfxFIck.js","assets/SpaceGrotesk-Bold-Bx5ssXV-.ttf","assets/SpaceGrotesk-Medium-DnsmCY5X.ttf","assets/SpaceGrotesk-Regular-DpFQlKNO.ttf","assets/SpaceGrotesk-SemiBold-DjqJml4C.ttf","assets/SpaceMono-Bold-Ca3FXji2.ttf","assets/SpaceMono-Regular-CWgeSjJ4.ttf","assets/StreamDetector-Dmt3TASM.js","assets/Templates-DuKuTQ0b.js","assets/WatchParty-49pzFfF4.js","assets/coi-DgKzoTlh.css","assets/coi-KZa9M469.js","assets/createPlayer-DxhTIuYU.js","assets/html-BLzzGjX8.js","assets/icons/jelly_jump_logo.png","assets/icons/sprite.svg","assets/jelly_jump_logo-jF-iEcbg.gif","assets/jelly_jump_logo-qiMeMAa9.png","assets/jelly_play-BM5NAVCG.webp","assets/js/lib/gif.worker.js","assets/main-Dai9oWyV.js","assets/main-vqDXxngW.css","assets/mediabunny-D3TGndiP.svg","assets/mediabunny-dts-CQCeueaj.js","assets/mediabunny-truehd-C7MAd-_b.js","assets/player-DrIRQDJ4.js","assets/player-DyUqVfoJ.css","assets/preload-helper-DaJssoSI.js","assets/preload-helper-_uCmdHpW.css","assets/reload-on-stale-chunks-CZzQdvYA.js","assets/rolldown-runtime-CEoa-xHZ.js","assets/templates/player-templates.html","assets/templates/playlist-templates.html","assets/templates/screenshot-templates.html","favicon.ico","icon-192.png","icon-512.png","index.html","manifest.json","player.html","poster.webp"],"files":["assets/AudioVisualizer-BNAC0Ire.js","assets/BlurMenu-7byyKCUp.js","assets/BoxEditorUtils-B_XI4FH-.js","assets/CancellableJob-DoJhaOnH.js","assets/CombineAVMenu-C2vyk9dB.js","assets/ConfirmDialog-C0tcy35Z.js","assets/ConvertMenu-DNjOehYP.js","assets/CropMenu-BCsXMbZZ.js","assets/CustomDropdown-Cs7Q8MM2.js","assets/CutDetectionMenu-DWhDhEUb.js","assets/DecorationLayer-DmO7ozlR.js","assets/DiagnosticsView-D6gWt7Q2.js","assets/EncryptMenu-dZVzsgNh.js","assets/ErrorReporter-CIs8YSHc.js","assets/ErrorReporter-D47Dymdg.css","assets/ExportMenu-C_JHrv7p.js","assets/FileBlob-7MRLQ6TG-BvRk9kiK.js","assets/GifMenu-DqKBqPdI.js","assets/InfoMenu-C7RjbXC-.js","assets/JobQueue-C8O2OfED.js","assets/Logger-BugK5WR1.js","assets/MediaProcessor-B_aCePfx.js","assets/MenuJob-6w9ISQq6.js","assets/MergeMenu-1NWICoDT.js","assets/MetadataService-BV3O4oo4.js","assets/Metrics-BvVG6ZZO.js","assets/Modal-JbxPyNE2.js","assets/MotionDetectionMenu-pL2LM-Mw.js","assets/MultiCutMenu-DtL5hKu_.js","assets/OptimizeMenu-afpRbJ0g.js","assets/OverlayCompositor-TBancsSK.js","assets/PieceStoreWorker-B5EsCZLn.js","assets/PlatformCrypto-B-MPkSSO.js","assets/Playlist-CmfxFIck.js","assets/PreviewPlayer-C4lUVsTQ.js","assets/RecordMenu-CkNC4ULL.js","assets/RemoveBackgroundMenu-ChugDdPV.js","assets/ResizeMenu-Ck_Hi-SE.js","assets/RotateMenu-Bfdw38nH.js","assets/ScreenRecorderMenu-VEvN3J0H.js","assets/ShareMenu-D8hzOvFe.js","assets/ShareState-Cy0f3zfR.js","assets/SidebarToggle-BKQYYCjT.js","assets/SlideshowMenu-Bu3wSOey.js","assets/SpaceGrotesk-Bold-Bx5ssXV-.ttf","assets/SpaceGrotesk-Medium-DnsmCY5X.ttf","assets/SpaceGrotesk-Regular-DpFQlKNO.ttf","assets/SpaceGrotesk-SemiBold-DjqJml4C.ttf","assets/SpaceMono-Bold-Ca3FXji2.ttf","assets/SpaceMono-Regular-CWgeSjJ4.ttf","assets/SpeedReverseMenu-CQI65Qot.js","assets/StreamDetector-Dmt3TASM.js","assets/SubtitleConverter-DGtgNNM5.js","assets/SubtitleGenerator-DZP5fLT7.js","assets/Templates-DuKuTQ0b.js","assets/ToolsMenu-YzfXpikK.js","assets/TrackManagerMenu-C7djCnsw.js","assets/TrimMenu-CYyHokme.js","assets/ValidationModal-DxwlAL7n.js","assets/WatchParty-49pzFfF4.js","assets/WatchPartyMenu-BQNA7ScL.js","assets/WatermarkMenu-BomYOm31.js","assets/WhisperWorker-D_y01kRL.js","assets/coi-DgKzoTlh.css","assets/coi-KZa9M469.js","assets/createPlayer-DxhTIuYU.js","assets/detection-BqZhJcPl.js","assets/embed-CmMAph-C.js","assets/html-BLzzGjX8.js","assets/jelly_jump_logo-jF-iEcbg.gif","assets/jelly_jump_logo-qiMeMAa9.png","assets/jelly_play-BM5NAVCG.webp","assets/main-Dai9oWyV.js","assets/main-vqDXxngW.css","assets/media-worker-DapHhmsa.js","assets/mediabunny-D3TGndiP.svg","assets/mediabunny-aac-encoder-D48Ov88Y.js","assets/mediabunny-aac-encoder-DDAdGQnv.js","assets/mediabunny-dts-CQCeueaj.js","assets/mediabunny-flac-encoder-BrJpLNr8.js","assets/mediabunny-flac-encoder-DulZqFEh.js","assets/mediabunny-mp3-encoder-BlkC-o2g.js","assets/mediabunny-mp3-encoder-HxFAkz0g.js","assets/mediabunny-truehd-C7MAd-_b.js","assets/ort-wasm-simd-threaded.asyncify-CxOG5pUO.wasm","assets/player-DrIRQDJ4.js","assets/player-DyUqVfoJ.css","assets/preload-helper-DaJssoSI.js","assets/preload-helper-_uCmdHpW.css","assets/reload-on-stale-chunks-CZzQdvYA.js","assets/rolldown-runtime-CEoa-xHZ.js","assets/sha256-node-TNZ2WHTI-BvRk9kiK.js","assets/sha256-wrapper-DYTB3MXW-BiAm_zHy.js","assets/sprite-DJq0wWlQ.svg","assets/sub-paths-F6TP7MGR-BvRk9kiK.js","assets/watch-DiIk_hKY.js"]};

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

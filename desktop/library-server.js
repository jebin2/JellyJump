/**
 * Library server — serves the scanned media library to a browser client.
 *
 * Binds to 127.0.0.1 only. It is never exposed directly: `tailscale serve`
 * fronts it with a real HTTPS certificate on the tailnet (see tailscale.js).
 * That is what lets a page on https://jellyjump.voidall.com talk to it at all —
 * a browser refuses to fetch plain http:// from an https:// page, and there is
 * no flag or prompt to get around it.
 *
 * Two gates guard the library: Tailscale only admits devices on the tailnet,
 * and every request must carry the share token. Requests name an id from the
 * index, never a path, so nothing the scan did not walk can be addressed.
 *
 *   GET /                         page explaining the link, for a human who
 *                                 opens it in a browser
 *   GET /api/info                 { name, count } — cheap reachability check
 *   GET /api/library              listing, plus any .jjlist files as text
 *   GET /api/stream/:id           the file, with Range support
 */
const http = require('http');
const fs = require('fs');
const crypto = require('crypto');
const libraryIndex = require('./library-index');

let server = null;
let shareToken = null;
// The hosted app, plus local dev origins so this can be exercised before it is
// deployed. Localhost only helps a page served from the viewer's own machine,
// which is already as trusted as the browser itself.
let allowedOrigins = [
    'https://jellyjump.voidall.com',
    'http://localhost:8080', 'http://127.0.0.1:8080',
    'http://localhost:5173', 'http://127.0.0.1:5173',
    'http://localhost:5199', 'http://127.0.0.1:5199',
];
let serverName = 'JellyJump';

/** Constant-time compare, so a token cannot be guessed a character at a time. */
function tokenMatches(provided) {
    if (!shareToken || typeof provided !== 'string') return false;
    const a = Buffer.from(provided);
    const b = Buffer.from(shareToken);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

function presentedToken(req, url) {
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) return header.slice(7);
    // Also accepted in the query string: mediabunny's UrlSource issues its own
    // range requests and cannot be given custom headers.
    return url.searchParams.get('token');
}

function applyCors(req, res) {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Range');
    // Without this the client cannot read them, and seeking needs Content-Range.
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length');
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (c) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
}

/**
 * Page shown when the share link is opened directly in a browser.
 *
 * Self-contained: `tailscale serve` points only at this server, so there is
 * nothing else to load assets from. The link is read from the address bar
 * rather than rebuilt server-side, where the proxy's forwarded host would have
 * to be trusted to get it right.
 */
function landingPage({ name, count }) {
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>JellyJump library</title>
<style>
  body { font-family: system-ui, sans-serif; background: #111; color: #ddd;
         margin: 0; padding: 2rem 1.25rem; line-height: 1.5; }
  main { max-width: 34rem; margin: 0 auto; }
  h1 { font-size: 1.25rem; margin: 0 0 .25rem; }
  .sub { color: #999; margin: 0 0 1.5rem; }
  ol { padding-left: 1.2rem; }
  li { margin-bottom: .5rem; }
  .link { display: flex; gap: .5rem; margin: 1rem 0; }
  input { flex: 1; min-width: 0; font-family: monospace; font-size: .8rem;
          padding: .6rem; background: #1b1b1b; color: #ddd;
          border: 1px solid #333; border-radius: 6px; }
  button { padding: .6rem 1rem; border-radius: 6px; border: 1px solid #333;
           background: #2a2a2a; color: #ddd; cursor: pointer; }
  .warn { color: #999; font-size: .85rem; border-left: 3px solid #444;
          padding-left: .75rem; }
</style>
</head>
<body>
<main>
  <h1>JellyJump library — ${escapeHtml(name)}</h1>
  <p class="sub">${count} file${count === 1 ? '' : 's'} available. This page means the link works.</p>
  <ol>
    <li>Open JellyJump on this device.</li>
    <li>Use <strong>Add Link</strong> and paste the address below.</li>
  </ol>
  <div class="link">
    <input id="link" readonly>
    <button id="copy">Copy</button>
  </div>
  <p class="warn">Anyone with this link and access to your tailnet can browse and play the library. Treat it like a password.</p>
</main>
<script>
  var input = document.getElementById('link');
  input.value = location.href;
  input.addEventListener('focus', function () { input.select(); });
  document.getElementById('copy').addEventListener('click', function () {
    var button = this;
    function done() { button.textContent = 'Copied'; setTimeout(function () { button.textContent = 'Copy'; }, 1500); }
    if (navigator.clipboard) { navigator.clipboard.writeText(input.value).then(done, function () { input.select(); }); }
    else { input.select(); }
  });
</script>
</body>
</html>`;
}

function sendJson(res, status, body) {
    const payload = JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(payload);
}

const MIME = {
    '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mkv': 'video/x-matroska',
    '.webm': 'video/webm', '.mov': 'video/quicktime', '.avi': 'video/x-msvideo',
    '.ogv': 'video/ogg', '.ts': 'video/mp2t', '.m2ts': 'video/mp2t',
    '.mts': 'video/mp2t', '.3gp': 'video/3gpp', '.flv': 'video/x-flv',
    '.wmv': 'video/x-ms-wmv',
};

/**
 * Parse a single Range header. Returns null when absent, 'invalid' when
 * malformed or unsatisfiable, so the caller can answer 416 rather than
 * silently sending the whole file.
 */
function parseRange(header, size) {
    if (!header) return null;
    const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
    if (!match) return 'invalid';

    const [, rawStart, rawEnd] = match;
    if (rawStart === '' && rawEnd === '') return 'invalid';

    let start;
    let end;
    if (rawStart === '') {
        // Suffix form: the last N bytes.
        const suffix = Number(rawEnd);
        if (!Number.isFinite(suffix) || suffix <= 0) return 'invalid';
        start = Math.max(0, size - suffix);
        end = size - 1;
    } else {
        start = Number(rawStart);
        end = rawEnd === '' ? size - 1 : Number(rawEnd);
    }

    if (!Number.isFinite(start) || !Number.isFinite(end)) return 'invalid';
    if (start > end || start >= size) return 'invalid';
    return { start, end: Math.min(end, size - 1) };
}

function streamFile(req, res, entry) {
    const range = parseRange(req.headers.range, entry.size);
    if (range === 'invalid') {
        res.writeHead(416, { 'Content-Range': `bytes */${entry.size}` });
        res.end();
        return;
    }

    const ext = (entry.ext || '').toLowerCase();
    const headers = {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, max-age=0',
    };

    const start = range ? range.start : 0;
    const end = range ? range.end : entry.size - 1;
    headers['Content-Length'] = end - start + 1;
    if (range) headers['Content-Range'] = `bytes ${start}-${end}/${entry.size}`;

    res.writeHead(range ? 206 : 200, headers);
    if (req.method === 'HEAD') return res.end();

    const stream = fs.createReadStream(entry.realPath, { start, end });
    // A client seeking mid-stream aborts constantly; destroy the read side or
    // the handles pile up.
    stream.on('error', () => res.destroyed || res.destroy());
    res.on('close', () => stream.destroy());
    stream.pipe(res);
}

/**
 * The listing again, but as NDJSON the client can render while it arrives.
 *
 * /api/library answers in one piece, so a client sees nothing at all until the
 * last byte lands — a library of tens of thousands of files is megabytes, and
 * over a tailnet that is a wait staring at an empty panel. Here the first line
 * carries the library's name and total, then one file per line, so the folder
 * can be on screen and filling before the request finishes.
 *
 * Line-delimited rather than a JSON array because a partial array is not
 * parseable: the client would have to buffer the whole thing to read any of it,
 * which is the problem being fixed.
 *
 * /api/library stays as it is — a client from an older build asks for that one,
 * and this endpoint simply 404s for it, which it already handles.
 */
function streamLibrary(req, res) {
    const items = libraryIndex.list();

    res.writeHead(200, {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-store',
        // Nothing in the chain should sit on this waiting to fill a buffer;
        // arriving early is the entire point.
        'X-Accel-Buffering': 'no',
    });
    if (req.method === 'HEAD') return res.end();

    res.write(`${JSON.stringify({ name: serverName, count: items.length })}\n`);

    // Link lists first, and each on its own line rather than inside the header:
    // a header that carries them grows with them, and the point of this endpoint
    // is that a client can act on the first line immediately.
    for (const list of libraryIndex.listLinkLists()) {
        res.write(`${JSON.stringify({ kind: 'linklist', ...list })}\n`);
    }

    // Written in chunks rather than a line at a time: one write per file makes
    // tens of thousands of syscalls, and one write for everything rebuilds the
    // single blob this exists to avoid.
    const CHUNK = 500;
    let index = 0;
    let aborted = false;

    // A client that navigates away or gives up mid-listing leaves this writing
    // to a dead socket, which happens routinely — the same reason streamFile
    // guards its aborts. Node tolerates the writes and the end() that follows,
    // but there is no reason to build another megabyte of payload for a socket
    // that is gone, and the 'error' listener keeps a failed write from
    // surfacing as an unhandled event on the response.
    res.on('close', () => { aborted = true; });
    res.on('error', () => { aborted = true; });

    const pump = () => {
        while (!aborted && index < items.length) {
            const slice = items.slice(index, index + CHUNK);
            index += slice.length;
            const payload = slice.map((item) => JSON.stringify(item)).join('\n') + '\n';
            // Respect backpressure: a slow client would otherwise have the whole
            // listing queued in this process's memory.
            if (!res.write(payload)) {
                res.once('drain', pump);
                return;
            }
        }
        if (!aborted) res.end();
    };

    pump();
}

function handle(req, res) {
    let url;
    try {
        url = new URL(req.url, 'http://127.0.0.1');
    } catch {
        return sendJson(res, 400, { error: 'Bad request' });
    }

    applyCors(req, res);

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        return sendJson(res, 405, { error: 'Method not allowed' });
    }
    if (!tokenMatches(presentedToken(req, url))) {
        return sendJson(res, 401, { error: 'Unauthorized' });
    }

    // The share link points here, so opening it in a browser has to explain
    // itself rather than 404. It is also the reachability check a person can
    // run by eye before pasting the link into the app.
    if (url.pathname === '/') {
        const page = landingPage({ name: serverName, count: libraryIndex.size() });
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(req.method === 'HEAD' ? undefined : page);
    }

    if (url.pathname === '/api/info') {
        return sendJson(res, 200, { name: serverName, count: libraryIndex.size() });
    }

    if (url.pathname === '/api/library') {
        return sendJson(res, 200, {
            name: serverName,
            items: libraryIndex.list(),
            // Sent as text for the client to parse, so the rules for reading a
            // link list live in one module rather than one per process.
            linkLists: libraryIndex.listLinkLists(),
        });
    }

    if (url.pathname === '/api/library/stream') {
        return streamLibrary(req, res);
    }

    const stream = /^\/api\/stream\/([a-f0-9]{16})$/.exec(url.pathname);
    if (stream) {
        const entry = libraryIndex.resolveServable(stream[1]);
        if (!entry) return sendJson(res, 404, { error: 'Not found' });
        return streamFile(req, res, entry);
    }

    return sendJson(res, 404, { error: 'Not found' });
}

/**
 * Start the server on 127.0.0.1.
 * @returns {Promise<{port: number, token: string}>}
 */
function start({ port = 0, token, origins, name } = {}) {
    if (server) return Promise.resolve({ port: server.address().port, token: shareToken });

    shareToken = token || crypto.randomBytes(32).toString('hex');
    if (Array.isArray(origins) && origins.length > 0) allowedOrigins = origins;
    if (name) serverName = name;

    return new Promise((resolve, reject) => {
        server = http.createServer(handle);
        server.on('error', (error) => {
            server = null;
            reject(error);
        });
        // 127.0.0.1 explicitly: binding 0.0.0.0 would expose the library to the
        // local network with no Tailscale gate in front of it.
        server.listen(port, '127.0.0.1', () => {
            resolve({ port: server.address().port, token: shareToken });
        });
    });
}

function stop() {
    return new Promise((resolve) => {
        if (!server) return resolve();
        const closing = server;
        server = null;
        shareToken = null;
        closing.close(() => resolve());
        closing.closeAllConnections?.();
    });
}

function isRunning() {
    return !!server;
}

function address() {
    return server ? server.address().port : null;
}

module.exports = { start, stop, isRunning, address, parseRange, _setTokenForTest: (t) => { shareToken = t; } };

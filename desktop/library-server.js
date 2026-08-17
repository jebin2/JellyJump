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
 *   GET /api/info                 { name, count } — cheap reachability check
 *   GET /api/library              listing
 *   GET /api/stream/:id           the file, with Range support
 */
const http = require('http');
const fs = require('fs');
const crypto = require('crypto');
const libraryIndex = require('./library-index');

let server = null;
let shareToken = null;
let allowedOrigins = ['https://jellyjump.voidall.com'];
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

    if (url.pathname === '/api/info') {
        return sendJson(res, 200, { name: serverName, count: libraryIndex.size() });
    }

    if (url.pathname === '/api/library') {
        return sendJson(res, 200, { name: serverName, items: libraryIndex.list() });
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

/**
 * Packing a WebRTC description into something a person can paste.
 *
 * With no server to pass messages through, the two halves of a handshake
 * travel by hand: the host's offer goes into a link, the viewer's answer comes
 * back as a code. Both are SDP, which is long, multi-line, and full of
 * characters that do not survive a chat window -- so it is gzipped and encoded
 * base64url, which has no `+`, `/` or `=` to be mangled by a URL or helpfully
 * linkified by a messaging app.
 *
 * Measured on a real offer: 4,492 characters of SDP becomes about 1,840. Most
 * of what remains is codec description that both ends already know, because
 * both ends are this app; shrinking that further is possible and deliberately
 * not done here, because reconstructing SDP from a template breaks quietly
 * when a browser changes a default, and the first version should be the one
 * that cannot.
 */

const PREFIX = 'jj1';

function toBase64Url(bytes) {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text) {
    const padded = text.replace(/-/g, '+').replace(/_/g, '/')
        + '='.repeat((4 - (text.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

async function through(stream, bytes) {
    const writer = stream.writable.getWriter();
    // Swallowed deliberately, not ignored. Bad gzip rejects on the writable
    // side as well as the readable one, and an unawaited rejection there is an
    // unhandled error that takes the page with it -- which is what a mistyped
    // paste would do. The read below throws the same failure, where the caller
    // can turn it into a message.
    writer.write(bytes).catch(() => {});
    writer.close().catch(() => {});
    const chunks = [];
    const reader = stream.readable.getReader();
    for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        chunks.push(value);
    }
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const out = new Uint8Array(total);
    let at = 0;
    for (const c of chunks) { out.set(c, at); at += c.length; }
    return out;
}

/**
 * @param {{type: string, sdp: string}} description - a local description
 * @returns {Promise<string>} a paste-safe string, prefixed so a mistyped or
 *          truncated paste is rejected rather than half-parsed
 */
export async function packSignal(description) {
    const payload = JSON.stringify({ t: description.type, s: description.sdp });
    const bytes = new TextEncoder().encode(payload);
    const squeezed = await through(new CompressionStream('gzip'), bytes);
    return `${PREFIX}.${toBase64Url(squeezed)}`;
}

/**
 * @param {string} text - what the other side pasted, possibly with stray
 *        whitespace from a chat window
 * @returns {Promise<{type: string, sdp: string}>}
 * @throws {Error} when the text is not a signal, so a wrong paste says so
 *         instead of failing later inside the connection
 */
export async function unpackSignal(text) {
    const trimmed = (text ?? '').trim().replace(/\s+/g, '');
    if (!trimmed.startsWith(`${PREFIX}.`)) {
        throw new Error('That does not look like a watch-party code.');
    }
    const body = trimmed.slice(PREFIX.length + 1);
    let payload;
    try {
        const bytes = fromBase64Url(body);
        const loosened = await through(new DecompressionStream('gzip'), bytes);
        payload = JSON.parse(new TextDecoder().decode(loosened));
    } catch (e) {
        throw new Error('That code is incomplete or damaged.');
    }
    if (!payload?.t || !payload?.s) throw new Error('That code is missing its description.');
    return { type: payload.t, sdp: payload.s };
}

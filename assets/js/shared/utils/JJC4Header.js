// @ts-check
/**
 * The JJC4 carrier's header bytes (docs/adr/0011-encryption-format.md).
 *
 * Kept apart from PlatformCrypto, which needs a browser to make or read a
 * carrier, so the layout can be tested with fixed vectors in Node.
 *
 *   offset  size  field
 *        0     4  magic "JJC4" (ASCII)
 *        4     2  version, big-endian (5: the header travels in the video strip)
 *        6     4  payload size in bytes, big-endian
 *       10     2  metadata size in bytes, big-endian
 *       12    16  PBKDF2 salt
 *       28    16  AES-CTR IV (the first 12 bytes are the nonce)
 *       44    32  HMAC-SHA-256 of the ciphertext
 *       76     n  metadata, UTF-8 JSON: {rs: [data, parity], name?, type?, hint?}
 */

export const MAGIC = 'JJC4';
export const VERSION = 5;
export const FIXED_SIZE = 76;
/** The payload size field is 32 bits. */
export const MAX_PAYLOAD = 0xFFFFFFFF;
/** The metadata size field is 16 bits. */
export const MAX_METADATA = 0xFFFF;

/**
 * @typedef {{rs?: number[], name?: string, type?: string, hint?: string}} Metadata
 * @typedef {{version: number, payloadSize: number, salt: Uint8Array, iv: Uint8Array,
 *            hmac: Uint8Array, metadata: Metadata}} Header
 */

/**
 * @param {{payloadSize: number, salt: Uint8Array, iv: Uint8Array, hmac: Uint8Array, metadata: Metadata}} fields
 * @returns {Uint8Array}
 */
export function encodeHeader({ payloadSize, salt, iv, hmac, metadata }) {
    if (!Number.isInteger(payloadSize) || payloadSize < 0 || payloadSize > MAX_PAYLOAD) {
        throw new Error(`File too large to encrypt: the format holds at most ${MAX_PAYLOAD} bytes.`);
    }
    if (salt.length !== 16 || iv.length !== 16 || hmac.length !== 32) {
        throw new Error('JJC4 header: salt and IV must be 16 bytes, the HMAC 32');
    }
    const meta = new TextEncoder().encode(JSON.stringify(metadata));
    if (meta.length > MAX_METADATA) throw new Error('JJC4 header: the file name and hint are too long');

    const bytes = new Uint8Array(FIXED_SIZE + meta.length);
    const view = new DataView(bytes.buffer);
    bytes.set(new TextEncoder().encode(MAGIC), 0);
    view.setUint16(4, VERSION, false);
    view.setUint32(6, payloadSize, false);
    view.setUint16(10, meta.length, false);
    bytes.set(salt, 12);
    bytes.set(iv, 28);
    bytes.set(hmac, 44);
    bytes.set(meta, FIXED_SIZE);
    return bytes;
}

/**
 * Read a header. The bytes may run on past it (zero padding to a whole
 * frame). Metadata that is not readable JSON reads as `{}`; the version is
 * returned for the caller to check.
 * @param {Uint8Array} bytes
 * @returns {Header}
 */
export function parseHeader(bytes) {
    if (bytes.length < FIXED_SIZE) throw new Error('JJC4 header: too short');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const metadataSize = view.getUint16(10, false);
    /** @type {Metadata} */
    let metadata = {};
    if (metadataSize > 0 && bytes.length >= FIXED_SIZE + metadataSize) {
        try {
            const parsed = JSON.parse(new TextDecoder().decode(bytes.subarray(FIXED_SIZE, FIXED_SIZE + metadataSize)));
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) metadata = parsed;
        } catch { /* not readable: no metadata */ }
    }
    return {
        version: view.getUint16(4, false),
        payloadSize: view.getUint32(6, false),
        salt: bytes.slice(12, 28),
        iv: bytes.slice(28, 44),
        hmac: bytes.slice(44, 76),
        metadata,
    };
}

/**
 * The type to give the decrypted file. The metadata is not covered by the
 * HMAC (docs/adr/0011, finding F1), so whoever can edit the carrier can
 * write any type there; only a media type is believed. A blob of type
 * `text/html` opened from the app would run as the app.
 * @param {unknown} type
 * @returns {string}
 */
export function safeMediaType(type) {
    if (typeof type === 'string' && /^(video|audio|image)\/[a-z0-9.+-]+$/i.test(type) && !/svg/i.test(type)) {
        return type;
    }
    return 'application/octet-stream';
}

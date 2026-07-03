/**
 * CryptoHelper — shared AES-256-CTR + HMAC-SHA256 + PBKDF2 primitives.
 *
 * These back the JJC4 re-encoding-resistant format (see PlatformCrypto):
 *   - PBKDF2 (100k iter) derives 512 bits from password + salt: first 256 for
 *     the AES-CTR key, second 256 for the HMAC key.
 *   - AES-256-CTR provides confidentiality (streaming XOR, no quality loss).
 *   - HMAC-SHA256 provides integrity, verified in constant time before any
 *     plaintext is produced.
 */
export class CryptoHelper {
    static SALT_SIZE = 16;
    static IV_SIZE = 16;
    static HMAC_SIZE = 32;
    static PBKDF2_ITERATIONS = 100_000;

    /**
     * Derive AES-256-CTR key and HMAC-SHA256 key from password + salt via PBKDF2.
     * Derives 512 bits: first 256 for AES, second 256 for HMAC.
     * @param {string} password
     * @param {Uint8Array} salt
     * @returns {Promise<{aesKey: CryptoKey, hmacKey: CryptoKey}>}
     */
    static async deriveKeys(password, salt) {
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(password),
            'PBKDF2',
            false,
            ['deriveBits']
        );

        const bits = await crypto.subtle.deriveBits(
            { name: 'PBKDF2', salt, iterations: CryptoHelper.PBKDF2_ITERATIONS, hash: 'SHA-256' },
            keyMaterial,
            512
        );

        const allBytes = new Uint8Array(bits);

        const aesKey = await crypto.subtle.importKey(
            'raw', allBytes.slice(0, 32), { name: 'AES-CTR' }, false, ['encrypt']
        );

        const hmacKey = await crypto.subtle.importKey(
            'raw', allBytes.slice(32, 64), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
        );

        return { aesKey, hmacKey };
    }

    /**
     * XOR a region within a buffer with AES-CTR keystream.
     * @param {Uint8Array} chunkData - The buffer (modified in place)
     * @param {number} localOffset - Start offset within the buffer
     * @param {number} size - Number of bytes to XOR
     * @param {CryptoKey} key - AES-256-CTR key
     * @param {Uint8Array} iv - 16-byte IV
     * @param {number} streamOffset - Byte offset into the overall keystream
     */
    static async _xorRegion(chunkData, localOffset, size, key, iv, streamOffset) {
        const remainder = streamOffset % 16;
        const counter = CryptoHelper._buildCounter(iv, streamOffset - remainder);

        const zeros = new Uint8Array(size + remainder);
        const keystreamBuf = await crypto.subtle.encrypt(
            { name: 'AES-CTR', counter, length: 32 },
            key,
            zeros
        );
        const keystream = new Uint8Array(keystreamBuf);

        for (let i = 0; i < size; i++) {
            chunkData[localOffset + i] ^= keystream[remainder + i];
        }
    }

    /**
     * Build a 16-byte AES-CTR counter value for a given byte offset.
     * Uses NIST standard layout: 96-bit nonce (12 bytes of IV) + 32-bit block counter.
     * @param {Uint8Array} iv - Original 16-byte IV (first 12 bytes used as nonce)
     * @param {number} byteOffset - Byte position in the keystream
     * @returns {Uint8Array} 16-byte counter
     */
    static _buildCounter(iv, byteOffset) {
        const counter = new Uint8Array(16);
        counter.set(iv.subarray(0, 12), 0);

        const blockIndex = Math.floor(byteOffset / 16);
        const view = new DataView(counter.buffer);
        view.setUint32(12, blockIndex >>> 0);

        return counter;
    }

    /**
     * Compute HMAC-SHA256 over data.
     * Web Crypto requires all bytes at once; accept BufferSource or Blob to avoid
     * an extra copy when the caller already holds a typed array.
     * @param {CryptoKey} hmacKey
     * @param {BufferSource|Blob} data
     * @returns {Promise<Uint8Array>} 32-byte HMAC
     */
    static async _computeHmac(hmacKey, data) {
        const buf = data instanceof Blob ? await data.arrayBuffer() : data;
        const sig = await crypto.subtle.sign('HMAC', hmacKey, buf);
        return new Uint8Array(sig);
    }

    /**
     * Constant-time comparison of two Uint8Arrays.
     * @param {Uint8Array} a
     * @param {Uint8Array} b
     * @returns {boolean}
     */
    static _constantTimeEqual(a, b) {
        if (a.length !== b.length) return false;
        let diff = 0;
        for (let i = 0; i < a.length; i++) {
            diff |= a[i] ^ b[i];
        }
        return diff === 0;
    }
}

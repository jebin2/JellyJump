import { Logger } from './Logger.js';

/**
 * CryptoHelper - Encrypts/decrypts files using a playable placeholder + AES-CTR + HMAC format.
 *
 * Encrypted file format (JJC2):
 *   [Placeholder MP4 video — playable, shows encryption message]
 *   [Encrypted original file bytes — AES-CTR XOR of entire blob]
 *   [Metadata JSON — cleartext: original filename, MIME type, password hint]
 *   [Fixed trailer: salt(16) + iv(16) + hmac(32) + placeholderSize(4) + metadataSize(4) + "JJC2"(4)]
 *   = 76 bytes fixed trailer
 *
 * Security:
 *   - AES-256-CTR provides confidentiality (streaming, no quality loss)
 *   - HMAC-SHA256 provides integrity (tamper detection, verified before decryption)
 *   - PBKDF2 derives 512 bits: first 256 for AES, second 256 for HMAC
 *   - Wrong password or tampered ciphertext → rejected before any decryption
 */
export class CryptoHelper {
    static MAGIC = 'JJC2';
    static SALT_SIZE = 16;
    static IV_SIZE = 16;
    static HMAC_SIZE = 32;
    static FIXED_TRAILER_SIZE = 76; // salt(16) + iv(16) + hmac(32) + placeholderSize(4) + metadataSize(4) + magic(4)
    static CHUNK_SIZE = 16 * 1024 * 1024; // 16 MB
    static PBKDF2_ITERATIONS = 100_000;

    /**
     * Encrypt a file blob.
     * Output: [placeholder MP4] + [encrypted data] + [metadata JSON] + [76-byte trailer]
     * @param {Blob} blob - Source file
     * @param {string} password
     * @param {Object} [options]
     * @param {string} [options.filename] - Original filename to preserve
     * @param {string} [options.mimeType] - Original MIME type to preserve
     * @param {string} [options.hint] - Password hint (cleartext)
     * @param {Function} [options.onProgress] - (0..1)
     * @returns {Promise<Blob>}
     */
    static async encrypt(blob, password, options = {}) {
        const { filename, mimeType, hint, onProgress } = options;
        const fileSize = blob.size;
        Logger.log(`[CryptoHelper] ENCRYPT start — fileSize: ${fileSize} bytes`);

        // Step 1: Generate placeholder video
        if (onProgress) onProgress(0);
        const placeholderBlob = await CryptoHelper._generatePlaceholder(hint);
        const placeholderSize = placeholderBlob.size;
        Logger.log(`[CryptoHelper] Placeholder generated: ${placeholderSize} bytes`);

        // Step 2: Derive keys (AES + HMAC)
        const salt = crypto.getRandomValues(new Uint8Array(CryptoHelper.SALT_SIZE));
        const iv = crypto.getRandomValues(new Uint8Array(CryptoHelper.IV_SIZE));
        const { aesKey, hmacKey } = await CryptoHelper.deriveKeys(password, salt);
        Logger.log(`[CryptoHelper] Keys derived (PBKDF2, ${CryptoHelper.PBKDF2_ITERATIONS} iterations)`);

        // Step 3: Encrypt entire original file with AES-CTR (streaming chunks)
        const ciphertextParts = [];
        let fileOffset = 0;
        let chunkIndex = 0;

        while (fileOffset < fileSize) {
            const chunkEnd = Math.min(fileOffset + CryptoHelper.CHUNK_SIZE, fileSize);
            const chunkBlob = blob.slice(fileOffset, chunkEnd);
            const chunkBuf = await chunkBlob.arrayBuffer();
            const chunkData = new Uint8Array(chunkBuf);

            Logger.log(`[CryptoHelper] Chunk ${chunkIndex}: file[${fileOffset}..${chunkEnd}) = ${chunkEnd - fileOffset} bytes`);

            await CryptoHelper._xorRegion(chunkData, 0, chunkData.length, aesKey, iv, fileOffset);

            ciphertextParts.push(new Blob([chunkData]));
            fileOffset = chunkEnd;
            chunkIndex++;

            // Progress: 0-80% for encryption, 80-100% for HMAC
            if (onProgress) onProgress(Math.min(fileOffset / fileSize, 1) * 0.8);

            if (fileOffset < fileSize) {
                await new Promise(r => setTimeout(r, 0));
            }
        }

        // Step 4: Compute HMAC-SHA256 over ciphertext
        Logger.log(`[CryptoHelper] Computing HMAC over ciphertext...`);
        const ciphertextBlob = new Blob(ciphertextParts);
        const hmac = await CryptoHelper._computeHmac(hmacKey, ciphertextBlob);
        Logger.log(`[CryptoHelper] HMAC computed: ${CryptoHelper._hexPrefix(hmac)}`);

        if (onProgress) onProgress(0.9);

        // Step 5: Build metadata JSON
        const metadata = {};
        if (filename) metadata.name = filename;
        if (mimeType) metadata.type = mimeType;
        if (hint) metadata.hint = hint;
        const metadataBytes = new TextEncoder().encode(JSON.stringify(metadata));
        const metadataSize = metadataBytes.length;
        Logger.log(`[CryptoHelper] Metadata: ${metadataSize} bytes — ${JSON.stringify(metadata)}`);

        // Step 6: Build fixed trailer
        const trailer = new Uint8Array(CryptoHelper.FIXED_TRAILER_SIZE);
        let off = 0;
        trailer.set(salt, off); off += CryptoHelper.SALT_SIZE;
        trailer.set(iv, off); off += CryptoHelper.IV_SIZE;
        trailer.set(hmac, off); off += CryptoHelper.HMAC_SIZE;
        const dv = new DataView(trailer.buffer);
        dv.setUint32(off, placeholderSize, false); off += 4;
        dv.setUint32(off, metadataSize, false); off += 4;
        trailer.set(new TextEncoder().encode(CryptoHelper.MAGIC), off);

        if (onProgress) onProgress(1);

        // Assemble: placeholder + ciphertext + metadata + trailer
        const parts = [placeholderBlob, ...ciphertextParts, new Blob([metadataBytes]), new Blob([trailer])];
        const outputBlob = new Blob(parts, { type: 'video/mp4' });
        const expectedSize = placeholderSize + fileSize + metadataSize + CryptoHelper.FIXED_TRAILER_SIZE;
        Logger.log(`[CryptoHelper] ENCRYPT done — output: ${outputBlob.size} bytes, expected: ${expectedSize}, match: ${outputBlob.size === expectedSize}`);

        return outputBlob;
    }

    /**
     * Decrypt a JJC2 encrypted file.
     * Verifies HMAC integrity before decrypting.
     * @param {Blob} blob - Encrypted file
     * @param {string} password
     * @param {Function} [onProgress] - (0..1)
     * @returns {Promise<{blob: Blob, metadata: Object}>} Decrypted blob and metadata
     */
    static async decrypt(blob, password, onProgress) {
        const fileSize = blob.size;
        Logger.log(`[CryptoHelper] DECRYPT start — fileSize: ${fileSize} bytes`);

        if (fileSize < CryptoHelper.FIXED_TRAILER_SIZE) {
            throw new Error('File too small to contain encryption data.');
        }

        // Read fixed trailer
        const trailerBlob = blob.slice(fileSize - CryptoHelper.FIXED_TRAILER_SIZE, fileSize);
        const trailerBuf = await trailerBlob.arrayBuffer();
        const trailerData = new Uint8Array(trailerBuf);

        // Verify magic
        const magicOffset = CryptoHelper.FIXED_TRAILER_SIZE - 4;
        const magic = new TextDecoder().decode(trailerData.slice(magicOffset, magicOffset + 4));
        if (magic !== CryptoHelper.MAGIC) {
            throw new Error('This file does not appear to be encrypted (missing JJC2 marker).');
        }
        Logger.log(`[CryptoHelper] Trailer verified — magic: ${magic}`);

        // Parse fixed trailer fields
        let off = 0;
        const salt = trailerData.slice(off, off + CryptoHelper.SALT_SIZE); off += CryptoHelper.SALT_SIZE;
        const iv = trailerData.slice(off, off + CryptoHelper.IV_SIZE); off += CryptoHelper.IV_SIZE;
        const storedHmac = trailerData.slice(off, off + CryptoHelper.HMAC_SIZE); off += CryptoHelper.HMAC_SIZE;
        const dv = new DataView(trailerBuf);
        const placeholderSize = dv.getUint32(off, false); off += 4;
        const metadataSize = dv.getUint32(off, false);
        Logger.log(`[CryptoHelper] placeholderSize: ${placeholderSize}, metadataSize: ${metadataSize}`);

        // Read metadata JSON
        const metadataStart = fileSize - CryptoHelper.FIXED_TRAILER_SIZE - metadataSize;
        let metadata = {};
        if (metadataSize > 0) {
            const metaBuf = await blob.slice(metadataStart, metadataStart + metadataSize).arrayBuffer();
            try {
                metadata = JSON.parse(new TextDecoder().decode(metaBuf));
            } catch (e) {
                Logger.warn(`[CryptoHelper] Failed to parse metadata JSON: ${e.message}`);
            }
        }
        Logger.log(`[CryptoHelper] Metadata: ${JSON.stringify(metadata)}`);

        // Derive keys
        const { aesKey, hmacKey } = await CryptoHelper.deriveKeys(password, salt);
        Logger.log(`[CryptoHelper] Keys derived (PBKDF2, ${CryptoHelper.PBKDF2_ITERATIONS} iterations)`);

        // Encrypted data region (between placeholder and metadata)
        const encryptedStart = placeholderSize;
        const encryptedEnd = metadataStart;
        const encryptedSize = encryptedEnd - encryptedStart;
        Logger.log(`[CryptoHelper] Encrypted data: file[${encryptedStart}..${encryptedEnd}) = ${encryptedSize} bytes`);

        if (encryptedSize <= 0) {
            throw new Error('No encrypted data found in file.');
        }

        // Step 1: Verify HMAC before decrypting
        Logger.log(`[CryptoHelper] Verifying HMAC...`);
        const ciphertextBlob = blob.slice(encryptedStart, encryptedEnd);
        const computedHmac = await CryptoHelper._computeHmac(hmacKey, ciphertextBlob);

        if (!CryptoHelper._constantTimeEqual(storedHmac, computedHmac)) {
            Logger.error(`[CryptoHelper] HMAC mismatch — stored: ${CryptoHelper._hexPrefix(storedHmac)}, computed: ${CryptoHelper._hexPrefix(computedHmac)}`);
            throw new Error('Integrity check failed. The file has been tampered with or the password is incorrect.');
        }
        Logger.log(`[CryptoHelper] HMAC verified — integrity OK`);

        // Step 2: Stream decrypt in chunks
        const parts = [];
        let offset = 0;
        let chunkIndex = 0;

        while (offset < encryptedSize) {
            const chunkEnd = Math.min(offset + CryptoHelper.CHUNK_SIZE, encryptedSize);
            const chunkBlob = blob.slice(encryptedStart + offset, encryptedStart + chunkEnd);
            const chunkBuf = await chunkBlob.arrayBuffer();
            const chunkData = new Uint8Array(chunkBuf);

            Logger.log(`[CryptoHelper] Chunk ${chunkIndex}: encrypted[${offset}..${chunkEnd}) = ${chunkEnd - offset} bytes`);

            await CryptoHelper._xorRegion(chunkData, 0, chunkData.length, aesKey, iv, offset);

            parts.push(new Blob([chunkData]));
            offset = chunkEnd;
            chunkIndex++;

            if (onProgress) onProgress(Math.min(offset / encryptedSize, 1));

            if (offset < encryptedSize) {
                await new Promise(r => setTimeout(r, 0));
            }
        }

        const outputType = metadata.type || 'video/mp4';
        const outputBlob = new Blob(parts, { type: outputType });
        Logger.log(`[CryptoHelper] DECRYPT done — output: ${outputBlob.size} bytes, expected: ${encryptedSize}, match: ${outputBlob.size === encryptedSize}`);

        return { blob: outputBlob, metadata };
    }

    /**
     * Read metadata from an encrypted file without decrypting.
     * Useful for showing password hint before asking for password.
     * @param {Blob} blob - Encrypted file
     * @returns {Promise<Object|null>} Metadata object or null if not a JJC2 file
     */
    static async readMetadata(blob) {
        const fileSize = blob.size;
        if (fileSize < CryptoHelper.FIXED_TRAILER_SIZE) return null;

        const trailerBuf = await blob.slice(fileSize - CryptoHelper.FIXED_TRAILER_SIZE, fileSize).arrayBuffer();
        const trailerData = new Uint8Array(trailerBuf);

        const magicOffset = CryptoHelper.FIXED_TRAILER_SIZE - 4;
        const magic = new TextDecoder().decode(trailerData.slice(magicOffset, magicOffset + 4));
        if (magic !== CryptoHelper.MAGIC) return null;

        const dv = new DataView(trailerBuf);
        const metadataSize = dv.getUint32(CryptoHelper.SALT_SIZE + CryptoHelper.IV_SIZE + CryptoHelper.HMAC_SIZE + 4, false);
        if (metadataSize === 0) return {};

        const metadataStart = fileSize - CryptoHelper.FIXED_TRAILER_SIZE - metadataSize;
        const metaBuf = await blob.slice(metadataStart, metadataStart + metadataSize).arrayBuffer();
        try {
            return JSON.parse(new TextDecoder().decode(metaBuf));
        } catch {
            return {};
        }
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

    /**
     * Return first 8 hex chars of a Uint8Array for logging.
     * @param {Uint8Array} arr
     * @returns {string}
     */
    static _hexPrefix(arr) {
        return [...arr.slice(0, 4)].map(b => b.toString(16).padStart(2, '0')).join('') + '...';
    }

    /**
     * Generate a short placeholder MP4 video showing an encryption message.
     * Uses MediaBunny CanvasSource encoder.
     * @param {string} [hint]
     * @returns {Promise<Blob>}
     */
    static async _generatePlaceholder(hint) {
        const { MediaBunny } = await import('../../core/MediaBunny.js');

        const W = 640, H = 360, FPS = 2, DURATION_SEC = 2;

        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');
        CryptoHelper._drawEncryptionMessage(ctx, W, H, hint);

        const output = new MediaBunny.Output({
            format: new MediaBunny.Mp4OutputFormat(),
            target: new MediaBunny.BufferTarget()
        });
        const canvasSource = new MediaBunny.CanvasSource(canvas, {
            codec: 'avc',
            bitrate: MediaBunny.QUALITY_HIGH,
        });
        output.addVideoTrack(canvasSource);
        await output.start();

        const frameDuration = 1 / FPS;
        const totalFrames = FPS * DURATION_SEC;
        for (let i = 0; i < totalFrames; i++) {
            await canvasSource.add(i * frameDuration, frameDuration);
        }

        canvasSource.close();
        await output.finalize();

        const blob = new Blob([output.target.buffer], { type: 'video/mp4' });

        if (typeof output.dispose === 'function') output.dispose();

        Logger.log(`[CryptoHelper] Placeholder video: ${blob.size} bytes, ${DURATION_SEC}s @ ${FPS}fps`);
        return blob;
    }

    /**
     * Draw the encryption message on a canvas context.
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} w
     * @param {number} h
     * @param {string} [hint]
     */
    static _drawEncryptionMessage(ctx, w, h, hint) {
        const cx = w / 2;
        const cy = h / 2;
        const hasHint = hint && hint.trim().length > 0;

        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, w, h);

        const cardW = 300;
        const cardPad = 20;
        // Heights: pad(20)+lock(32)+title(26)+brand(20)+url(15)+pad(20)=133
        // + hint: gap(20)+divider+gap(10)+hint(14)=44 → 177
        const cardH = hasHint ? 178 : 134;
        const cardX = Math.round(cx - cardW / 2);
        const cardY = Math.round(cy - cardH / 2);

        // Neobrutalist solid shadow
        ctx.fillStyle = '#00ff88';
        ctx.fillRect(cardX + 6, cardY + 6, cardW, cardH);

        // Card
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(cardX, cardY, cardW, cardH);
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 4;
        ctx.strokeRect(cardX + 2, cardY + 2, cardW - 4, cardH - 4);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        let ty = cardY + cardPad;

        ctx.font = '22px serif';
        ctx.fillStyle = '#00ff88';
        ctx.fillText('\u{1F512}', cx, ty);
        ty += 32;

        ctx.font = 'bold 18px Arial, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('VIDEO IS ENCRYPTED', cx, ty);
        ty += 26;

        ctx.font = '13px Arial, sans-serif';
        ctx.fillStyle = '#00ff88';
        ctx.fillText('By JellyJump', cx, ty);
        ty += 20;

        ctx.font = '12px "Courier New", monospace';
        ctx.fillStyle = '#666666';
        ctx.fillText('voidall.com/JellyJump', cx, ty);

        if (hasHint) {
            ty += 20;
            ctx.strokeStyle = '#333333';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cardX + cardPad, ty);
            ctx.lineTo(cardX + cardW - cardPad, ty);
            ctx.stroke();
            ty += 10;

            ctx.font = '11px "Courier New", monospace';
            ctx.fillStyle = '#b0b0b0';
            ctx.fillText(`Hint: ${hint}`, cx, ty);
        }
    }

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
}

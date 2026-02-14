import { Logger } from './Logger.js';

/**
 * CryptoHelper - Encrypts/decrypts files using a playable placeholder + AES-CTR format.
 *
 * Encrypted file format (JJC2):
 *   [Placeholder MP4 video — playable, shows encryption message]
 *   [Encrypted original file bytes — AES-CTR XOR of entire blob]
 *   [Trailer: salt(16) + iv(16) + placeholderSize(4 bytes, uint32 BE) + "JJC2"(4 bytes)]
 *   = 40 bytes trailer
 *
 * External players see and play the placeholder video.
 * JellyJump reads the trailer, extracts + decrypts the original file.
 * Zero quality loss — the original file bytes are preserved exactly.
 */
export class CryptoHelper {
    static MAGIC = 'JJC2';
    static SALT_SIZE = 16;
    static IV_SIZE = 16;
    static TRAILER_SIZE = 40; // salt(16) + iv(16) + placeholderSize(4) + magic(4)
    static CHUNK_SIZE = 16 * 1024 * 1024; // 16 MB
    static PBKDF2_ITERATIONS = 100_000;

    /**
     * Encrypt a file blob.
     * Output: [placeholder MP4] + [AES-CTR encrypted original] + [40-byte trailer]
     * @param {Blob} blob - Source file
     * @param {string} password
     * @param {Function} [onProgress] - (0..1)
     * @returns {Promise<Blob>}
     */
    static async encrypt(blob, password, onProgress) {
        const fileSize = blob.size;
        Logger.log(`[CryptoHelper] ENCRYPT start — fileSize: ${fileSize} bytes`);

        // Step 1: Generate placeholder video
        if (onProgress) onProgress(0);
        const placeholderBlob = await CryptoHelper._generatePlaceholder();
        const placeholderSize = placeholderBlob.size;
        Logger.log(`[CryptoHelper] Placeholder generated: ${placeholderSize} bytes`);

        // Step 2: Derive key
        const salt = crypto.getRandomValues(new Uint8Array(CryptoHelper.SALT_SIZE));
        const iv = crypto.getRandomValues(new Uint8Array(CryptoHelper.IV_SIZE));
        const key = await CryptoHelper.deriveKey(password, salt);
        Logger.log(`[CryptoHelper] Key derived (PBKDF2, ${CryptoHelper.PBKDF2_ITERATIONS} iterations)`);

        // Step 3: Encrypt entire original file with AES-CTR (streaming chunks)
        const parts = [placeholderBlob];
        let fileOffset = 0;
        let chunkIndex = 0;

        while (fileOffset < fileSize) {
            const chunkEnd = Math.min(fileOffset + CryptoHelper.CHUNK_SIZE, fileSize);
            const chunkBlob = blob.slice(fileOffset, chunkEnd);
            const chunkBuf = await chunkBlob.arrayBuffer();
            const chunkData = new Uint8Array(chunkBuf);

            Logger.log(`[CryptoHelper] Chunk ${chunkIndex}: file[${fileOffset}..${chunkEnd}) = ${chunkEnd - fileOffset} bytes`);

            await CryptoHelper._xorRegion(chunkData, 0, chunkData.length, key, iv, fileOffset);

            parts.push(new Blob([chunkData]));
            fileOffset = chunkEnd;
            chunkIndex++;

            if (onProgress) onProgress(Math.min(fileOffset / fileSize, 1));

            if (fileOffset < fileSize) {
                await new Promise(r => setTimeout(r, 0));
            }
        }

        // Step 4: Append trailer: salt(16) + iv(16) + placeholderSize(4, uint32 BE) + magic(4)
        const trailer = new Uint8Array(CryptoHelper.TRAILER_SIZE);
        trailer.set(salt, 0);
        trailer.set(iv, CryptoHelper.SALT_SIZE);
        const trailerView = new DataView(trailer.buffer);
        trailerView.setUint32(CryptoHelper.SALT_SIZE + CryptoHelper.IV_SIZE, placeholderSize, false);
        trailer.set(new TextEncoder().encode(CryptoHelper.MAGIC), CryptoHelper.SALT_SIZE + CryptoHelper.IV_SIZE + 4);
        parts.push(new Blob([trailer]));

        const outputBlob = new Blob(parts, { type: 'video/mp4' });
        const expectedSize = placeholderSize + fileSize + CryptoHelper.TRAILER_SIZE;
        Logger.log(`[CryptoHelper] ENCRYPT done — output: ${outputBlob.size} bytes, expected: ${expectedSize}, match: ${outputBlob.size === expectedSize}`);

        return outputBlob;
    }

    /**
     * Decrypt a JJC2 encrypted file.
     * Reads trailer, extracts encrypted data after placeholder, XOR decrypts.
     * @param {Blob} blob - Encrypted file
     * @param {string} password
     * @param {Function} [onProgress] - (0..1)
     * @returns {Promise<Blob>}
     */
    static async decrypt(blob, password, onProgress) {
        const fileSize = blob.size;
        Logger.log(`[CryptoHelper] DECRYPT start — fileSize: ${fileSize} bytes`);

        if (fileSize < CryptoHelper.TRAILER_SIZE) {
            throw new Error('File too small to contain encryption data.');
        }

        // Read 40-byte trailer
        const trailerBlob = blob.slice(fileSize - CryptoHelper.TRAILER_SIZE, fileSize);
        const trailerBuf = await trailerBlob.arrayBuffer();
        const trailerData = new Uint8Array(trailerBuf);

        // Verify magic
        const magicOffset = CryptoHelper.SALT_SIZE + CryptoHelper.IV_SIZE + 4;
        const magic = new TextDecoder().decode(trailerData.slice(magicOffset, magicOffset + 4));
        if (magic !== CryptoHelper.MAGIC) {
            throw new Error('This file does not appear to be encrypted (missing JJC2 marker).');
        }
        Logger.log(`[CryptoHelper] Trailer verified — magic: ${magic}`);

        const salt = trailerData.slice(0, CryptoHelper.SALT_SIZE);
        const iv = trailerData.slice(CryptoHelper.SALT_SIZE, CryptoHelper.SALT_SIZE + CryptoHelper.IV_SIZE);
        const trailerView = new DataView(trailerBuf);
        const placeholderSize = trailerView.getUint32(CryptoHelper.SALT_SIZE + CryptoHelper.IV_SIZE, false);
        Logger.log(`[CryptoHelper] placeholderSize: ${placeholderSize}`);

        const key = await CryptoHelper.deriveKey(password, salt);
        Logger.log(`[CryptoHelper] Key derived (PBKDF2, ${CryptoHelper.PBKDF2_ITERATIONS} iterations)`);

        // Encrypted data is between placeholder and trailer
        const encryptedStart = placeholderSize;
        const encryptedEnd = fileSize - CryptoHelper.TRAILER_SIZE;
        const encryptedSize = encryptedEnd - encryptedStart;
        Logger.log(`[CryptoHelper] Encrypted data: file[${encryptedStart}..${encryptedEnd}) = ${encryptedSize} bytes`);

        if (encryptedSize <= 0) {
            throw new Error('No encrypted data found in file.');
        }

        // Stream decrypt in chunks
        const parts = [];
        let offset = 0;
        let chunkIndex = 0;

        while (offset < encryptedSize) {
            const chunkEnd = Math.min(offset + CryptoHelper.CHUNK_SIZE, encryptedSize);
            const chunkBlob = blob.slice(encryptedStart + offset, encryptedStart + chunkEnd);
            const chunkBuf = await chunkBlob.arrayBuffer();
            const chunkData = new Uint8Array(chunkBuf);

            Logger.log(`[CryptoHelper] Chunk ${chunkIndex}: encrypted[${offset}..${chunkEnd}) = ${chunkEnd - offset} bytes`);

            await CryptoHelper._xorRegion(chunkData, 0, chunkData.length, key, iv, offset);

            parts.push(new Blob([chunkData]));
            offset = chunkEnd;
            chunkIndex++;

            if (onProgress) onProgress(Math.min(offset / encryptedSize, 1));

            if (offset < encryptedSize) {
                await new Promise(r => setTimeout(r, 0));
            }
        }

        const outputBlob = new Blob(parts, { type: 'video/mp4' });
        Logger.log(`[CryptoHelper] DECRYPT done — output: ${outputBlob.size} bytes, expected: ${encryptedSize}, match: ${outputBlob.size === encryptedSize}`);

        return outputBlob;
    }

    /**
     * Generate a short placeholder MP4 video showing an encryption message.
     * Uses MediaBunny CanvasSource encoder.
     * @returns {Promise<Blob>}
     */
    static async _generatePlaceholder() {
        const { MediaBunny } = await import('../core/MediaBunny.js');

        const W = 640, H = 360, FPS = 2, DURATION_SEC = 2;

        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');
        CryptoHelper._drawEncryptionMessage(ctx, W, H);

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
     * Dark background with red accent border, lock icon, and text.
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} w - Canvas width
     * @param {number} h - Canvas height
     */
    static _drawEncryptionMessage(ctx, w, h) {
        // Dark background
        ctx.fillStyle = '#0f0f1a';
        ctx.fillRect(0, 0, w, h);

        // Red accent border (inner)
        const borderWidth = 3;
        ctx.strokeStyle = '#e94560';
        ctx.lineWidth = borderWidth;
        ctx.strokeRect(borderWidth / 2, borderWidth / 2, w - borderWidth, h - borderWidth);

        // Lock icon
        ctx.font = '48px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#e94560';
        ctx.fillText('\u{1F512}', w / 2, h / 2 - 50);

        // Main text
        ctx.font = 'bold 24px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('This video is encrypted', w / 2, h / 2 + 10);

        // URL
        ctx.font = '18px sans-serif';
        ctx.fillStyle = '#888888';
        ctx.fillText('voidall.com/JellyJump', w / 2, h / 2 + 50);
    }

    /**
     * Derive an AES-256 key from password + salt via PBKDF2.
     * @param {string} password
     * @param {Uint8Array} salt
     * @returns {Promise<CryptoKey>}
     */
    static async deriveKey(password, salt) {
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
            256
        );

        return crypto.subtle.importKey(
            'raw', bits, { name: 'AES-CTR' }, false, ['encrypt']
        );
    }

    /**
     * XOR a region within a buffer with AES-CTR keystream.
     * Handles unaligned stream offsets by generating from the aligned block
     * boundary and skipping the leading bytes.
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
        // length: 32 = NIST standard 96-bit nonce + 32-bit counter (supports up to 64GB)
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

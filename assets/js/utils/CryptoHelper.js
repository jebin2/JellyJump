import { Logger } from './Logger.js';

/**
 * CryptoHelper - Encrypts/decrypts MP4 video files by XOR'ing mdat box data
 * with an AES-CTR keystream derived from a password.
 *
 * The container metadata stays intact so the file remains a valid MP4,
 * but media data becomes corrupted noise. Decryption with the correct
 * password restores the original bytes exactly (XOR is self-inverse).
 */
export class CryptoHelper {
    static MAGIC = 'JJCR';
    static SALT_SIZE = 16;
    static IV_SIZE = 16;
    static TRAILER_SIZE = 36; // salt(16) + iv(16) + magic(4)
    static CHUNK_SIZE = 16 * 1024 * 1024; // 16 MB
    static PBKDF2_ITERATIONS = 100_000;

    /**
     * Encrypt an MP4 blob by XOR'ing its mdat box data.
     * Appends salt + IV + magic trailer at the end.
     * @param {Blob} blob - Source MP4 file
     * @param {string} password
     * @param {Function} [onProgress] - (0..1)
     * @returns {Promise<Blob>}
     */
    static async encrypt(blob, password, onProgress) {
        const buffer = await blob.arrayBuffer();
        const data = new Uint8Array(buffer);

        const mdatBoxes = CryptoHelper.findMdatBoxes(data);
        if (mdatBoxes.length === 0) {
            throw new Error('No mdat box found. Please convert to MP4 first.');
        }

        // Generate random salt + IV
        const salt = crypto.getRandomValues(new Uint8Array(CryptoHelper.SALT_SIZE));
        const iv = crypto.getRandomValues(new Uint8Array(CryptoHelper.IV_SIZE));

        const key = await CryptoHelper.deriveKey(password, salt);

        // XOR each mdat box's data region
        let globalOffset = 0;
        const totalBytes = mdatBoxes.reduce((sum, b) => sum + b.dataSize, 0);

        for (const box of mdatBoxes) {
            await CryptoHelper.xorWithKeystream(
                data, key, iv, box.dataOffset, box.dataSize, globalOffset,
                (chunkDone) => {
                    if (onProgress) onProgress((globalOffset + chunkDone) / totalBytes);
                }
            );
            globalOffset += box.dataSize;
        }

        // Build output: original data + trailer
        const trailer = new Uint8Array(CryptoHelper.TRAILER_SIZE);
        trailer.set(salt, 0);
        trailer.set(iv, CryptoHelper.SALT_SIZE);
        trailer.set(new TextEncoder().encode(CryptoHelper.MAGIC), CryptoHelper.SALT_SIZE + CryptoHelper.IV_SIZE);

        return new Blob([data, trailer], { type: blob.type || 'video/mp4' });
    }

    /**
     * Decrypt an MP4 blob that was encrypted with encrypt().
     * Reads the trailer to recover salt + IV, XORs mdat, truncates trailer.
     * @param {Blob} blob - Encrypted MP4 file
     * @param {string} password
     * @param {Function} [onProgress] - (0..1)
     * @returns {Promise<Blob>}
     */
    static async decrypt(blob, password, onProgress) {
        const buffer = await blob.arrayBuffer();
        const data = new Uint8Array(buffer);

        if (data.length < CryptoHelper.TRAILER_SIZE) {
            throw new Error('File too small to contain encryption data.');
        }

        // Read trailer
        const trailerStart = data.length - CryptoHelper.TRAILER_SIZE;
        const magic = new TextDecoder().decode(data.slice(trailerStart + CryptoHelper.SALT_SIZE + CryptoHelper.IV_SIZE));
        if (magic !== CryptoHelper.MAGIC) {
            throw new Error('This file does not appear to be encrypted (missing JJCR marker).');
        }

        const salt = data.slice(trailerStart, trailerStart + CryptoHelper.SALT_SIZE);
        const iv = data.slice(trailerStart + CryptoHelper.SALT_SIZE, trailerStart + CryptoHelper.SALT_SIZE + CryptoHelper.IV_SIZE);

        // Work on the data without the trailer
        const fileData = data.subarray(0, trailerStart);

        const key = await CryptoHelper.deriveKey(password, salt);

        const mdatBoxes = CryptoHelper.findMdatBoxes(fileData);
        if (mdatBoxes.length === 0) {
            throw new Error('No mdat box found in encrypted file.');
        }

        let globalOffset = 0;
        const totalBytes = mdatBoxes.reduce((sum, b) => sum + b.dataSize, 0);

        for (const box of mdatBoxes) {
            await CryptoHelper.xorWithKeystream(
                fileData, key, iv, box.dataOffset, box.dataSize, globalOffset,
                (chunkDone) => {
                    if (onProgress) onProgress((globalOffset + chunkDone) / totalBytes);
                }
            );
            globalOffset += box.dataSize;
        }

        return new Blob([fileData], { type: blob.type || 'video/mp4' });
    }

    /**
     * Scan MP4 top-level boxes to find all mdat boxes.
     * Returns data offset (after box header) and data size for each.
     * @param {Uint8Array} data
     * @returns {Array<{dataOffset: number, dataSize: number}>}
     */
    static findMdatBoxes(data) {
        const boxes = [];
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        let offset = 0;

        while (offset + 8 <= data.byteLength) {
            let size = view.getUint32(offset);
            const type = String.fromCharCode(
                data[offset + 4], data[offset + 5],
                data[offset + 6], data[offset + 7]
            );

            let headerSize = 8;

            if (size === 1) {
                // 64-bit extended size
                if (offset + 16 > data.byteLength) break;
                const hi = view.getUint32(offset + 8);
                const lo = view.getUint32(offset + 12);
                size = hi * 0x100000000 + lo;
                headerSize = 16;
            } else if (size === 0) {
                // Box extends to end of file
                size = data.byteLength - offset;
            }

            if (size < headerSize) break; // Invalid box

            if (type === 'mdat') {
                boxes.push({
                    dataOffset: offset + headerSize,
                    dataSize: size - headerSize
                });
            }

            offset += size;
        }

        return boxes;
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
     * XOR a region of `data` in-place with an AES-CTR keystream.
     * Processes in chunks to avoid memory spikes on large files.
     *
     * @param {Uint8Array} data - The full file buffer (modified in place)
     * @param {CryptoKey} key - AES-256-CTR key
     * @param {Uint8Array} iv - 16-byte IV
     * @param {number} dataOffset - Start offset within data
     * @param {number} dataSize - Number of bytes to XOR
     * @param {number} streamOffset - Byte offset into the overall keystream (for multi-mdat)
     * @param {Function} [onProgress] - Called with bytes processed so far in this region
     */
    static async xorWithKeystream(data, key, iv, dataOffset, dataSize, streamOffset, onProgress) {
        let processed = 0;

        while (processed < dataSize) {
            const chunkSize = Math.min(CryptoHelper.CHUNK_SIZE, dataSize - processed);
            const absoluteOffset = streamOffset + processed;

            // Build counter for this chunk's position in the stream
            const counter = CryptoHelper._buildCounter(iv, absoluteOffset);

            // Encrypt zeros to get the keystream
            const zeros = new Uint8Array(chunkSize);
            const keystreamBuf = await crypto.subtle.encrypt(
                { name: 'AES-CTR', counter, length: 128 },
                key,
                zeros
            );
            const keystream = new Uint8Array(keystreamBuf);

            // XOR in place
            const start = dataOffset + processed;
            for (let i = 0; i < chunkSize; i++) {
                data[start + i] ^= keystream[i];
            }

            processed += chunkSize;
            if (onProgress) onProgress(processed);

            // Yield to main thread between chunks
            if (processed < dataSize) {
                await new Promise(r => setTimeout(r, 0));
            }
        }
    }

    /**
     * Build a 16-byte AES-CTR counter value for a given byte offset.
     * The IV occupies the first 8 bytes; the remaining 8 bytes hold
     * the block counter (offset / 16).
     * @param {Uint8Array} iv - Original 16-byte IV
     * @param {number} byteOffset - Byte position in the keystream
     * @returns {Uint8Array} 16-byte counter
     */
    static _buildCounter(iv, byteOffset) {
        const counter = new Uint8Array(16);
        counter.set(iv.subarray(0, 8), 0);

        // Block index = byteOffset / 16
        const blockIndex = Math.floor(byteOffset / 16);
        const view = new DataView(counter.buffer);
        // Store as big-endian 64-bit in bytes 8-15
        view.setUint32(8, Math.floor(blockIndex / 0x100000000));
        view.setUint32(12, blockIndex >>> 0);

        return counter;
    }
}

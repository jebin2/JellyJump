import { Logger } from './Logger.js';

/**
 * CryptoHelper - Encrypts/decrypts MP4 video files by XOR'ing mdat box data
 * with an AES-CTR keystream derived from a password.
 *
 * Uses streaming Blob.slice() to process files in ~16MB chunks, so memory
 * usage stays at ~16MB regardless of file size (no full-file ArrayBuffer).
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
    static HEADER_SCAN_SIZE = 4096; // Enough to scan top-level box headers
    static PBKDF2_ITERATIONS = 100_000;

    /**
     * Encrypt an MP4 blob by XOR'ing its mdat box data.
     * Streams through the file in chunks — never loads full file into RAM.
     * @param {Blob} blob - Source MP4 file
     * @param {string} password
     * @param {Function} [onProgress] - (0..1)
     * @returns {Promise<Blob>}
     */
    static async encrypt(blob, password, onProgress) {
        const fileSize = blob.size;
        Logger.log(`[CryptoHelper] ENCRYPT start — fileSize: ${fileSize} bytes`);

        const mdatBoxes = await CryptoHelper.findMdatBoxes(blob, fileSize);
        if (mdatBoxes.length === 0) {
            throw new Error('No mdat box found. Please convert to MP4 first.');
        }

        const salt = crypto.getRandomValues(new Uint8Array(CryptoHelper.SALT_SIZE));
        const iv = crypto.getRandomValues(new Uint8Array(CryptoHelper.IV_SIZE));
        const key = await CryptoHelper.deriveKey(password, salt);
        Logger.log(`[CryptoHelper] Key derived (PBKDF2, ${CryptoHelper.PBKDF2_ITERATIONS} iterations)`);

        // Build mdat ranges with pre-computed keystream base offsets
        const mdatRanges = [];
        let keystreamBase = 0;
        for (const b of mdatBoxes) {
            mdatRanges.push({ start: b.dataOffset, end: b.dataOffset + b.dataSize, keystreamBase });
            Logger.log(`[CryptoHelper] mdat range: file[${b.dataOffset}..${b.dataOffset + b.dataSize}) = ${b.dataSize} bytes, keystreamBase: ${keystreamBase}`);
            keystreamBase += b.dataSize;
        }
        const totalMdatBytes = keystreamBase;
        Logger.log(`[CryptoHelper] Total mdat bytes to encrypt: ${totalMdatBytes}, mdat boxes: ${mdatBoxes.length}`);

        // Stream through file in chunks, XOR'ing mdat regions
        const parts = [];
        let fileOffset = 0;
        let mdatProcessed = 0;
        let chunkIndex = 0;

        while (fileOffset < fileSize) {
            const chunkEnd = Math.min(fileOffset + CryptoHelper.CHUNK_SIZE, fileSize);
            const chunkSize = chunkEnd - fileOffset;
            const chunkBlob = blob.slice(fileOffset, chunkEnd);
            const chunkBuf = await chunkBlob.arrayBuffer();
            const chunkData = new Uint8Array(chunkBuf);

            Logger.log(`[CryptoHelper] Chunk ${chunkIndex}: file[${fileOffset}..${chunkEnd}) = ${chunkSize} bytes`);

            // XOR any mdat bytes that fall within this chunk
            for (const range of mdatRanges) {
                // Overlap between [fileOffset, chunkEnd) and [range.start, range.end)
                const overlapStart = Math.max(fileOffset, range.start);
                const overlapEnd = Math.min(chunkEnd, range.end);
                if (overlapStart >= overlapEnd) continue;

                const chunkLocalStart = overlapStart - fileOffset;
                const overlapSize = overlapEnd - overlapStart;
                // Keystream position = this range's base + offset within range
                const streamOffset = range.keystreamBase + (overlapStart - range.start);

                Logger.log(`[CryptoHelper]   XOR overlap: chunk[${chunkLocalStart}..${chunkLocalStart + overlapSize}) → keystream[${streamOffset}..${streamOffset + overlapSize}), size: ${overlapSize}, aligned: ${streamOffset % 16 === 0}`);

                await CryptoHelper._xorRegion(
                    chunkData, chunkLocalStart, overlapSize, key, iv, streamOffset
                );

                mdatProcessed += overlapSize;
            }

            Logger.log(`[CryptoHelper]   mdatProcessed: ${mdatProcessed}/${totalMdatBytes} (${(mdatProcessed / totalMdatBytes * 100).toFixed(1)}%)`);

            if (onProgress) onProgress(Math.min(mdatProcessed / totalMdatBytes, 1));

            parts.push(new Blob([chunkData]));
            fileOffset = chunkEnd;
            chunkIndex++;

            // Yield to main thread
            if (fileOffset < fileSize) {
                await new Promise(r => setTimeout(r, 0));
            }
        }

        // Append trailer: salt + iv + magic
        const trailer = new Uint8Array(CryptoHelper.TRAILER_SIZE);
        trailer.set(salt, 0);
        trailer.set(iv, CryptoHelper.SALT_SIZE);
        trailer.set(new TextEncoder().encode(CryptoHelper.MAGIC), CryptoHelper.SALT_SIZE + CryptoHelper.IV_SIZE);
        parts.push(new Blob([trailer]));

        const outputBlob = new Blob(parts, { type: blob.type || 'video/mp4' });
        Logger.log(`[CryptoHelper] ENCRYPT done — output: ${outputBlob.size} bytes (${parts.length} parts), expected: ${fileSize + CryptoHelper.TRAILER_SIZE}`);
        Logger.log(`[CryptoHelper] Size check: input(${fileSize}) + trailer(${CryptoHelper.TRAILER_SIZE}) = ${fileSize + CryptoHelper.TRAILER_SIZE}, output: ${outputBlob.size}, match: ${outputBlob.size === fileSize + CryptoHelper.TRAILER_SIZE}`);

        return outputBlob;
    }

    /**
     * Decrypt an MP4 blob that was encrypted with encrypt().
     * Streams through the file in chunks — never loads full file into RAM.
     * @param {Blob} blob - Encrypted MP4 file
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

        // Read only the trailer (last 36 bytes)
        const trailerBlob = blob.slice(fileSize - CryptoHelper.TRAILER_SIZE, fileSize);
        const trailerBuf = await trailerBlob.arrayBuffer();
        const trailerData = new Uint8Array(trailerBuf);

        const magic = new TextDecoder().decode(
            trailerData.slice(CryptoHelper.SALT_SIZE + CryptoHelper.IV_SIZE)
        );
        if (magic !== CryptoHelper.MAGIC) {
            throw new Error('This file does not appear to be encrypted (missing JJCR marker).');
        }
        Logger.log(`[CryptoHelper] Trailer verified — magic: ${magic}`);

        const salt = trailerData.slice(0, CryptoHelper.SALT_SIZE);
        const iv = trailerData.slice(CryptoHelper.SALT_SIZE, CryptoHelper.SALT_SIZE + CryptoHelper.IV_SIZE);
        const key = await CryptoHelper.deriveKey(password, salt);
        Logger.log(`[CryptoHelper] Key derived (PBKDF2, ${CryptoHelper.PBKDF2_ITERATIONS} iterations)`);

        // The actual MP4 data (without trailer)
        const dataSize = fileSize - CryptoHelper.TRAILER_SIZE;
        const dataBlob = blob.slice(0, dataSize);
        Logger.log(`[CryptoHelper] Data size (without trailer): ${dataSize} bytes`);

        const mdatBoxes = await CryptoHelper.findMdatBoxes(dataBlob, dataSize);
        if (mdatBoxes.length === 0) {
            throw new Error('No mdat box found in encrypted file.');
        }

        const mdatRanges = [];
        let keystreamBase = 0;
        for (const b of mdatBoxes) {
            mdatRanges.push({ start: b.dataOffset, end: b.dataOffset + b.dataSize, keystreamBase });
            Logger.log(`[CryptoHelper] mdat range: file[${b.dataOffset}..${b.dataOffset + b.dataSize}) = ${b.dataSize} bytes, keystreamBase: ${keystreamBase}`);
            keystreamBase += b.dataSize;
        }
        const totalMdatBytes = keystreamBase;
        Logger.log(`[CryptoHelper] Total mdat bytes to decrypt: ${totalMdatBytes}, mdat boxes: ${mdatBoxes.length}`);

        // Stream through file in chunks, XOR'ing mdat regions
        const parts = [];
        let fileOffset = 0;
        let mdatProcessed = 0;
        let chunkIndex = 0;

        while (fileOffset < dataSize) {
            const chunkEnd = Math.min(fileOffset + CryptoHelper.CHUNK_SIZE, dataSize);
            const chunkSize = chunkEnd - fileOffset;
            const chunkBlob = dataBlob.slice(fileOffset, chunkEnd);
            const chunkBuf = await chunkBlob.arrayBuffer();
            const chunkData = new Uint8Array(chunkBuf);

            Logger.log(`[CryptoHelper] Chunk ${chunkIndex}: file[${fileOffset}..${chunkEnd}) = ${chunkSize} bytes`);

            for (const range of mdatRanges) {
                const overlapStart = Math.max(fileOffset, range.start);
                const overlapEnd = Math.min(chunkEnd, range.end);
                if (overlapStart >= overlapEnd) continue;

                const chunkLocalStart = overlapStart - fileOffset;
                const overlapSize = overlapEnd - overlapStart;
                const streamOffset = range.keystreamBase + (overlapStart - range.start);

                Logger.log(`[CryptoHelper]   XOR overlap: chunk[${chunkLocalStart}..${chunkLocalStart + overlapSize}) → keystream[${streamOffset}..${streamOffset + overlapSize}), size: ${overlapSize}, aligned: ${streamOffset % 16 === 0}`);

                await CryptoHelper._xorRegion(
                    chunkData, chunkLocalStart, overlapSize, key, iv, streamOffset
                );

                mdatProcessed += overlapSize;
            }

            Logger.log(`[CryptoHelper]   mdatProcessed: ${mdatProcessed}/${totalMdatBytes} (${(mdatProcessed / totalMdatBytes * 100).toFixed(1)}%)`);

            if (onProgress) onProgress(Math.min(mdatProcessed / totalMdatBytes, 1));

            parts.push(new Blob([chunkData]));
            fileOffset = chunkEnd;
            chunkIndex++;

            if (fileOffset < dataSize) {
                await new Promise(r => setTimeout(r, 0));
            }
        }

        // No trailer in output (truncated)
        const outputBlob = new Blob(parts, { type: blob.type || 'video/mp4' });
        Logger.log(`[CryptoHelper] DECRYPT done — output: ${outputBlob.size} bytes (${parts.length} parts), expected: ${dataSize}`);
        Logger.log(`[CryptoHelper] Size check: input(${fileSize}) - trailer(${CryptoHelper.TRAILER_SIZE}) = ${dataSize}, output: ${outputBlob.size}, match: ${outputBlob.size === dataSize}`);

        return outputBlob;
    }

    /**
     * Scan MP4 top-level boxes to find all mdat boxes.
     * Only reads box headers from the blob — does not load full file.
     * @param {Blob} blob - The file blob (or slice without trailer)
     * @param {number} fileSize - Size to scan
     * @returns {Promise<Array<{dataOffset: number, dataSize: number}>>}
     */
    static async findMdatBoxes(blob, fileSize) {
        const boxes = [];
        let offset = 0;

        Logger.log(`[CryptoHelper] Scanning MP4 boxes (fileSize: ${fileSize})...`);

        while (offset + 8 <= fileSize) {
            // Read just the box header (up to 16 bytes for extended size)
            const headerBlob = blob.slice(offset, Math.min(offset + 16, fileSize));
            const headerBuf = await headerBlob.arrayBuffer();
            const header = new Uint8Array(headerBuf);
            const headerView = new DataView(headerBuf);

            if (header.length < 8) break;

            let size = headerView.getUint32(0);
            const type = String.fromCharCode(header[4], header[5], header[6], header[7]);
            let headerSize = 8;

            if (size === 1) {
                // 64-bit extended size
                if (header.length < 16) break;
                const hi = headerView.getUint32(8);
                const lo = headerView.getUint32(12);
                size = hi * 0x100000000 + lo;
                headerSize = 16;
            } else if (size === 0) {
                // Box extends to end of file
                size = fileSize - offset;
            }

            if (size < headerSize) break;

            Logger.log(`[CryptoHelper]   Box "${type}" at offset ${offset}, size: ${size} (header: ${headerSize})`);

            if (type === 'mdat') {
                boxes.push({
                    dataOffset: offset + headerSize,
                    dataSize: size - headerSize
                });
            }

            offset += size;
        }

        Logger.log(`[CryptoHelper] Box scan complete — found ${boxes.length} mdat box(es)`);
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
     * XOR a region within a chunk buffer with AES-CTR keystream.
     * Handles unaligned stream offsets by generating from the aligned block
     * boundary and skipping the leading bytes.
     * @param {Uint8Array} chunkData - The chunk buffer (modified in place)
     * @param {number} localOffset - Start offset within the chunk
     * @param {number} size - Number of bytes to XOR
     * @param {CryptoKey} key - AES-256-CTR key
     * @param {Uint8Array} iv - 16-byte IV
     * @param {number} streamOffset - Byte offset into the overall keystream
     */
    static async _xorRegion(chunkData, localOffset, size, key, iv, streamOffset) {
        // AES-CTR works in 16-byte blocks — align to block boundary
        const remainder = streamOffset % 16;
        const counter = CryptoHelper._buildCounter(iv, streamOffset - remainder);

        // Generate extra bytes to cover the unaligned prefix, then skip them
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
     * Supports files up to 2^32 blocks * 16 bytes = 64GB.
     * @param {Uint8Array} iv - Original 16-byte IV (first 12 bytes used as nonce)
     * @param {number} byteOffset - Byte position in the keystream
     * @returns {Uint8Array} 16-byte counter
     */
    static _buildCounter(iv, byteOffset) {
        const counter = new Uint8Array(16);
        // 96-bit nonce from first 12 bytes of IV
        counter.set(iv.subarray(0, 12), 0);

        // 32-bit block counter in bytes 12-15
        const blockIndex = Math.floor(byteOffset / 16);
        const view = new DataView(counter.buffer);
        view.setUint32(12, blockIndex >>> 0);

        return counter;
    }
}

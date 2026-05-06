/**
 * VisualStripCodec
 * Encodes bytes as black/white 16×16-pixel blocks across the entire video frame,
 * skipping only the compact center banner zone where the card animation lives.
 *
 * Frame layout (1280 × 720, 80 × 45 blocks):
 *
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ ROW 0: header (sync + chunk_idx + total_chunks + crc32)  │
 *   │ DATA  DATA  DATA  DATA  DATA  DATA  DATA  DATA  DATA     │  rows 1–14
 *   ├──────────────────────┬──────────────┬────────────────────┤
 *   │  DATA  (left)        │  CARD BANNER │  DATA  (right)     │  rows 15–29
 *   ├──────────────────────┴──────────────┴────────────────────┤
 *   │ DATA  DATA  DATA  DATA  DATA  DATA  DATA  DATA  DATA     │  rows 30–44
 *   └──────────────────────────────────────────────────────────┘
 *
 * Header (row 0, 80 blocks = 80 bits = 10 bytes):
 *   bits  0–7   sync byte 0xAA
 *   bits  8–23  chunk_index  (uint16)
 *   bits 24–39  total_chunks (uint16)
 *   bits 40–47  repeat_index (uint8)  — 0, 1, or 2
 *   bits 48–79  CRC-32 of (chunk_index ‖ total_chunks ‖ data)
 *
 * Data blocks: 3240 − 80 = 3160 → 395 bytes/frame
 *
 * Redundancy: FRAME_COPIES=3 (each chunk written into 3 consecutive frames).
 * Decoder takes the first copy whose CRC-32 passes.
 * CRC-32 false-positive rate: 1/4 294 967 296 ≈ 0 for all practical purposes.
 */

import { Logger } from './Logger.js';

export const VIDEO_W   = 1280;
export const VIDEO_H   = 720;
export const BLOCK_PX  = 16;
export const BLOCKS_X  = VIDEO_W / BLOCK_PX;  // 80
export const BLOCKS_Y  = VIDEO_H / BLOCK_PX;  // 45
export const FPS       = 30;
export const FRAME_COPIES = 3;

// Compact card zone — codec skips these blocks (banner card lives here)
// Sized to contain the 340×182px card + 6px shadow, centered at 640×360, with 1-block margin.
export const BANNER_COL_START = 28;  // x: 448px
export const BANNER_COL_END   = 52;  // x: 832px  → 384px wide
export const BANNER_ROW_START = 15;  // y: 240px
export const BANNER_ROW_END   = 30;  // y: 480px  → 240px tall

// Header occupies the entire row 0 (80 blocks = 80 bits)
const HEADER_BITS = 80;
const SYNC_BYTE   = 0b10101010;

// ─── CRC-32 (IEEE 802.3) ─────────────────────────────────────────────────────

function crc32(data) {
    let crc = 0xFFFFFFFF;
    for (const byte of data) {
        crc ^= byte;
        for (let i = 0; i < 8; i++) {
            crc = (crc & 1) ? (crc >>> 1) ^ 0xEDB88320 : crc >>> 1;
        }
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ─── Block list (precomputed once) ───────────────────────────────────────────

function _buildBlockList() {
    const all = [];
    for (let row = 0; row < BLOCKS_Y; row++) {
        for (let col = 0; col < BLOCKS_X; col++) {
            if (row >= BANNER_ROW_START && row < BANNER_ROW_END &&
                col >= BANNER_COL_START && col < BANNER_COL_END) continue;
            all.push({ row, col });
        }
    }
    return all;
}

const _ALL_BLOCKS  = _buildBlockList();                      // 3240 blocks
const _HDR_BLOCKS  = _ALL_BLOCKS.slice(0, HEADER_BITS);     // 80 blocks (row 0)
const _DATA_BLOCKS = _ALL_BLOCKS.slice(HEADER_BITS);        // 3160 blocks

export const DATA_BYTES_PER_FRAME = _DATA_BLOCKS.length >> 3; // 395

// ─── Encoding ────────────────────────────────────────────────────────────────

function _writeBit(ctx, col, row, bit) {
    ctx.fillStyle = bit ? '#ffffff' : '#000000';
    ctx.fillRect(col * BLOCK_PX, row * BLOCK_PX, BLOCK_PX, BLOCK_PX);
}

function _writeHeader(ctx, chunkIndex, totalChunks, repeatIndex, checksum) {
    // Pack all 80 header bits: sync(8) + chunkIdx(16) + totalChunks(16) + repeatIdx(8) + crc32(32)
    const bits = [];
    for (let i = 7; i >= 0; i--) bits.push((SYNC_BYTE    >> i) & 1);
    for (let i = 15; i >= 0; i--) bits.push((chunkIndex  >> i) & 1);
    for (let i = 15; i >= 0; i--) bits.push((totalChunks >> i) & 1);
    for (let i = 7; i >= 0; i--) bits.push((repeatIndex  >> i) & 1);
    for (let i = 31; i >= 0; i--) bits.push((checksum    >> i) & 1);

    for (let i = 0; i < _HDR_BLOCKS.length; i++) {
        const { row, col } = _HDR_BLOCKS[i];
        _writeBit(ctx, col, row, bits[i] ?? 0);
    }
}

/**
 * Draw the data strip for one frame onto a canvas context.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} chunkIndex
 * @param {number} totalChunks
 * @param {number} repeatIndex  0, 1, or 2
 * @param {Uint8Array} data     exactly DATA_BYTES_PER_FRAME bytes
 */
export function encodeFrame(ctx, chunkIndex, totalChunks, repeatIndex, data) {
    // CRC-32 covers chunk_index + total_chunks + data (NOT repeat_index)
    const crcInput = new Uint8Array(4 + data.length);
    crcInput[0] = (chunkIndex  >> 8) & 0xFF;
    crcInput[1] =  chunkIndex        & 0xFF;
    crcInput[2] = (totalChunks >> 8) & 0xFF;
    crcInput[3] =  totalChunks       & 0xFF;
    crcInput.set(data, 4);
    const checksum = crc32(crcInput);

    _writeHeader(ctx, chunkIndex, totalChunks, repeatIndex, checksum);

    for (let i = 0; i < _DATA_BLOCKS.length; i++) {
        const byteIdx = i >> 3;
        const bitIdx  = 7 - (i & 7);
        const bit     = byteIdx < data.length ? (data[byteIdx] >> bitIdx) & 1 : 0;
        const { row, col } = _DATA_BLOCKS[i];
        _writeBit(ctx, col, row, bit);
    }
}

// ─── Fast pixel-direct encoding (for bulk frame generation) ──────────────────

// Uint32 color constants — computed once at load time to be correct on any
// CPU endianness. ImageData.data is RGBA; a Uint32Array view over the same
// buffer reads/writes all 4 channels in one operation.
const _scratch = new Uint8Array(4);
_scratch[3] = 255;
const _BLACK32 = new Uint32Array(_scratch.buffer)[0]; // RGBA(0,0,0,255)
_scratch[0] = _scratch[1] = _scratch[2] = 255;
const _WHITE32 = new Uint32Array(_scratch.buffer)[0]; // RGBA(255,255,255,255)

function _writeBlockPixels(u32view, col, row, bit) {
    const color32 = bit ? _WHITE32 : _BLACK32;
    const x0 = col * BLOCK_PX;
    const y0 = row * BLOCK_PX;
    for (let dy = 0; dy < BLOCK_PX; dy++) {
        let i = (y0 + dy) * VIDEO_W + x0;
        for (let dx = 0; dx < BLOCK_PX; dx++, i++) {
            u32view[i] = color32;
        }
    }
}

/**
 * Encode one frame directly into a pre-allocated ImageData pixel buffer.
 * The buffer must already contain the placeholder image (copied before calling).
 * Replaces ~6 500 canvas API calls per frame with direct typed-array writes.
 *
 * @param {ImageData} imageData  pre-filled with placeholder pixels
 * @param {number} chunkIndex
 * @param {number} totalChunks
 * @param {number} repeatIndex
 * @param {Uint8Array} data      exactly DATA_BYTES_PER_FRAME bytes
 */
export function encodeFrameToImageData(imageData, chunkIndex, totalChunks, repeatIndex, data) {
    const u32view = new Uint32Array(imageData.data.buffer);

    const crcInput = new Uint8Array(4 + data.length);
    crcInput[0] = (chunkIndex  >> 8) & 0xFF;
    crcInput[1] =  chunkIndex        & 0xFF;
    crcInput[2] = (totalChunks >> 8) & 0xFF;
    crcInput[3] =  totalChunks       & 0xFF;
    crcInput.set(data, 4);
    const checksum = crc32(crcInput);

    // Header bits
    const hBits = [];
    for (let i = 7; i >= 0; i--) hBits.push((SYNC_BYTE    >> i) & 1);
    for (let i = 15; i >= 0; i--) hBits.push((chunkIndex  >> i) & 1);
    for (let i = 15; i >= 0; i--) hBits.push((totalChunks >> i) & 1);
    for (let i = 7; i >= 0; i--) hBits.push((repeatIndex  >> i) & 1);
    for (let i = 31; i >= 0; i--) hBits.push((checksum    >> i) & 1);

    for (let i = 0; i < _HDR_BLOCKS.length; i++) {
        const { row, col } = _HDR_BLOCKS[i];
        _writeBlockPixels(u32view, col, row, hBits[i] ?? 0);
    }

    // Data bits
    for (let i = 0; i < _DATA_BLOCKS.length; i++) {
        const byteIdx = i >> 3;
        const bitIdx  = 7 - (i & 7);
        const bit     = byteIdx < data.length ? (data[byteIdx] >> bitIdx) & 1 : 0;
        const { row, col } = _DATA_BLOCKS[i];
        _writeBlockPixels(u32view, col, row, bit);
    }
}

export function framesNeeded(byteCount) {
    return Math.ceil(byteCount / DATA_BYTES_PER_FRAME) * FRAME_COPIES;
}

export function stripDurationSec(byteCount) {
    return framesNeeded(byteCount) / FPS;
}

// ─── Decoding ────────────────────────────────────────────────────────────────

function _readBit(imageData, col, row) {
    const x0 = col * BLOCK_PX;
    const y0 = row * BLOCK_PX;
    const W  = imageData.width;
    let total = 0;
    for (let dy = 0; dy < BLOCK_PX; dy++) {
        for (let dx = 0; dx < BLOCK_PX; dx++) {
            const idx = ((y0 + dy) * W + (x0 + dx)) * 4;
            total += (imageData.data[idx] + imageData.data[idx+1] + imageData.data[idx+2]) / 3;
        }
    }
    return total / (BLOCK_PX * BLOCK_PX) > 128 ? 1 : 0;
}

/**
 * Decode a frame's data from its ImageData.
 * Returns { chunkIndex, totalChunks, repeatIndex, data, valid } or null if sync fails.
 */
export function decodeFrame(imageData) {
    // Verify sync byte from first 8 header blocks
    let syncRead = 0;
    for (let i = 0; i < 8; i++) {
        const { row, col } = _HDR_BLOCKS[i];
        syncRead = (syncRead << 1) | _readBit(imageData, col, row);
    }
    if (syncRead !== SYNC_BYTE) return null;

    let chunkIndex = 0, totalChunks = 0, repeatIndex = 0, storedCrc = 0;
    let hPos = 8;
    for (let i = 0; i < 16; i++, hPos++) {
        const { row, col } = _HDR_BLOCKS[hPos];
        chunkIndex = (chunkIndex << 1) | _readBit(imageData, col, row);
    }
    for (let i = 0; i < 16; i++, hPos++) {
        const { row, col } = _HDR_BLOCKS[hPos];
        totalChunks = (totalChunks << 1) | _readBit(imageData, col, row);
    }
    for (let i = 0; i < 8; i++, hPos++) {
        const { row, col } = _HDR_BLOCKS[hPos];
        repeatIndex = (repeatIndex << 1) | _readBit(imageData, col, row);
    }
    for (let i = 0; i < 32; i++, hPos++) {
        const { row, col } = _HDR_BLOCKS[hPos];
        storedCrc = ((storedCrc << 1) | _readBit(imageData, col, row)) >>> 0;
    }

    // Read payload
    const data = new Uint8Array(DATA_BYTES_PER_FRAME);
    for (let i = 0; i < _DATA_BLOCKS.length; i++) {
        const byteIdx = i >> 3;
        const bitIdx  = 7 - (i & 7);
        const { row, col } = _DATA_BLOCKS[i];
        if (_readBit(imageData, col, row)) data[byteIdx] |= (1 << bitIdx);
    }

    // Verify CRC-32 (covers chunk_index + total_chunks + data)
    const crcInput = new Uint8Array(4 + data.length);
    crcInput[0] = (chunkIndex  >> 8) & 0xFF;
    crcInput[1] =  chunkIndex        & 0xFF;
    crcInput[2] = (totalChunks >> 8) & 0xFF;
    crcInput[3] =  totalChunks       & 0xFF;
    crcInput.set(data, 4);

    return {
        chunkIndex,
        totalChunks,
        repeatIndex,
        data,
        valid: crc32(crcInput) === storedCrc,
    };
}

/**
 * Assemble decoded frames into the original byte array.
 * Takes the first valid (CRC-passing) copy for each chunk.
 */
export function assembleChunks(frames, originalSize) {
    if (!frames.length) return new Uint8Array(0);

    const totalChunks = frames.reduce((m, f) => f ? Math.max(m, f.totalChunks) : m, 0);
    const chunks = new Array(totalChunks).fill(null);

    for (const frame of frames) {
        if (!frame || frame.chunkIndex >= totalChunks) continue;
        const existing = chunks[frame.chunkIndex];
        if (!existing) {
            chunks[frame.chunkIndex] = frame;
        } else if (frame.valid && !existing.valid) {
            chunks[frame.chunkIndex] = frame;   // upgrade invalid → valid
        } else if (frame.valid && existing.valid && frame.repeatIndex < existing.repeatIndex) {
            chunks[frame.chunkIndex] = frame;   // prefer lower repeat index
        }
    }

    let validCount = 0, invalidCount = 0, missingCount = 0;
    for (let i = 0; i < totalChunks; i++) {
        if (!chunks[i])          missingCount++;
        else if (chunks[i].valid) validCount++;
        else                      invalidCount++;
    }
    Logger.log(`[VisualStripCodec] assemble — totalChunks=${totalChunks} valid=${validCount} invalid=${invalidCount} missing=${missingCount}`);
    if (missingCount > 0 || invalidCount > 0) {
        const failed = [];
        for (let i = 0; i < totalChunks; i++) {
            if (!chunks[i] || !chunks[i].valid) failed.push(i);
        }
        Logger.log(`[VisualStripCodec] WARNING: ${missingCount + invalidCount} chunk(s) lost — output will be corrupted. Failed indices: ${failed.slice(0, 20).join(', ')}${failed.length > 20 ? '…' : ''}`);
    }

    const result = new Uint8Array(originalSize);
    let written = 0;
    for (let i = 0; i < totalChunks && written < originalSize; i++) {
        const take = Math.min(DATA_BYTES_PER_FRAME, originalSize - written);
        if (chunks[i]) result.set(chunks[i].data.slice(0, take), written);
        written += take;
    }
    Logger.log(`[VisualStripCodec] assemble done — wrote ${written} / ${originalSize} B`);
    return result;
}

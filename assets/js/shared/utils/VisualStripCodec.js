/**
 * VisualStripCodec
 * Encodes bytes as black/white 16×16-pixel blocks across the entire video frame,
 * skipping only the compact center banner zone where the card animation lives.
 *
 * Frame layout (1280 × 720, 80 × 45 blocks):
 *
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ ROW 0: header (sync + shard_index + crc32)               │
 *   │ DATA  DATA  DATA  DATA  DATA  DATA  DATA  DATA  DATA     │  rows 1–14
 *   ├──────────────────────┬──────────────┬────────────────────┤
 *   │  DATA  (left)        │  CARD BANNER │  DATA  (right)     │  rows 15–29
 *   ├──────────────────────┴──────────────┴────────────────────┤
 *   │ DATA  DATA  DATA  DATA  DATA  DATA  DATA  DATA  DATA     │  rows 30–44
 *   └──────────────────────────────────────────────────────────┘
 *
 * Header (row 0, 80 blocks = 80 bits = 10 bytes):
 *   bits  0–7   sync byte 0xAA
 *   bits  8–39  shard_index  (uint32) — global index of this shard
 *   bits 40–47  reserved     (uint8, 0)
 *   bits 48–79  CRC-32 of (shard_index ‖ data)
 *
 * Data blocks: 3240 − 80 = 3160 → 395 bytes/frame
 *
 * Redundancy: Reed–Solomon erasure coding across frames. The payload is split
 * into 395-byte shards (one per frame) grouped into generations of
 * RS_DATA_SHARDS data + RS_PARITY_SHARDS parity shards; any k of k+m frames
 * recover a generation, so up to m corrupted frames per generation heal at m/k
 * (25%) overhead. shard_index is the GLOBAL SHARD INDEX. Frames are
 * emitted interleaved round-robin across generations so a burst of corrupted
 * frames spreads across generations instead of exhausting one generation's
 * parity. A frame is "present" iff its CRC-32 passes; CRC-32 false-positive
 * rate 1/4 294 967 296 ≈ 0 for all practical purposes.
 */

import { Logger } from './Logger.js';
import { encode as rsEncode, decode as rsDecode, MAX_SHARDS } from './ReedSolomon.js';

export const VIDEO_W   = 1280;
export const VIDEO_H   = 720;
export const BLOCK_PX  = 16;
export const BLOCKS_X  = VIDEO_W / BLOCK_PX;  // 80
export const BLOCKS_Y  = VIDEO_H / BLOCK_PX;  // 45
export const FPS       = 30;

// Reed–Solomon generation shape: 200 data + 50 parity shards (25% overhead,
// heals up to 20% corrupted frames per generation). k+m=250 ≤ 255 (GF(256)).
export const RS_DATA_SHARDS   = 200;
export const RS_PARITY_SHARDS = 50;
const RS_MIN_PARITY = 4;         // parity floor for tiny final generations

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

// ─── Frame header (row 0, 80 bits) ───────────────────────────────────────────
// Layout: sync(8) + shard_index(32) + reserved(8) + crc32(32).
// The 32-bit shard index lets a single carrier address up to 4 294 967 295
// shards, so payload size is bounded by carrier duration/RAM, not the header.

/** CRC-32 over (shard_index big-endian ‖ data). */
function _headerCrc(shardIndex, data) {
    const crcInput = new Uint8Array(4 + data.length);
    crcInput[0] = (shardIndex >>> 24) & 0xFF;
    crcInput[1] = (shardIndex >>> 16) & 0xFF;
    crcInput[2] = (shardIndex >>>  8) & 0xFF;
    crcInput[3] =  shardIndex         & 0xFF;
    crcInput.set(data, 4);
    return crc32(crcInput);
}

/** Pack the 80 header bits (MSB first) into a Uint8Array of 0/1. */
function _headerBits(shardIndex, checksum) {
    const bits = new Uint8Array(HEADER_BITS);
    let p = 0;
    for (let i = 7;  i >= 0; i--) bits[p++] = (SYNC_BYTE  >>  i) & 1;
    for (let i = 31; i >= 0; i--) bits[p++] = (shardIndex >>> i) & 1;
    for (let i = 7;  i >= 0; i--) bits[p++] = 0;                    // reserved
    for (let i = 31; i >= 0; i--) bits[p++] = (checksum   >>> i) & 1;
    return bits;
}

// ─── Reed–Solomon shard planning ─────────────────────────────────────────────

/**
 * Plan the shard layout for a payload: how data shards group into generations
 * and how much parity each generation gets. Deterministic from (payloadBytes,
 * k, m), so encoder and decoder derive the identical plan from the audio
 * header alone.
 *
 * @returns {{ totalDataShards: number, totalShards: number,
 *             generations: {k: number, m: number, start: number}[] }}
 *          `start` is the global shard index of the generation's first shard.
 */
export function planShards(payloadBytes, k = RS_DATA_SHARDS, m = RS_PARITY_SHARDS) {
    const totalDataShards = Math.max(1, Math.ceil(payloadBytes / DATA_BYTES_PER_FRAME));
    const generations = [];
    let start = 0;
    for (let done = 0; done < totalDataShards; done += k) {
        const gk = Math.min(k, totalDataShards - done);
        // Final partial generation: scale parity to keep the same loss
        // tolerance ratio, with a floor so tiny payloads still heal.
        const gm = gk === k ? m : Math.max(RS_MIN_PARITY, Math.ceil((gk * m) / k));
        if (gk + gm > MAX_SHARDS) throw new Error(`VisualStripCodec: generation ${gk}+${gm} exceeds ${MAX_SHARDS}`);
        generations.push({ k: gk, m: gm, start });
        start += gk + gm;
    }
    return { totalDataShards, totalShards: start, generations };
}

/**
 * Build all shards for a payload: data shards are zero-copy subarray views of
 * the payload (except a padded final shard); parity shards are RS-encoded per
 * generation. Returns an array of `plan.totalShards` Uint8Arrays, indexed by
 * global shard index, each DATA_BYTES_PER_FRAME long.
 */
export function buildShards(payload, plan) {
    const shards = new Array(plan.totalShards);
    let dataIdx = 0;
    for (const gen of plan.generations) {
        const dataShards = [];
        for (let i = 0; i < gen.k; i++, dataIdx++) {
            const off = dataIdx * DATA_BYTES_PER_FRAME;
            let s;
            if (off + DATA_BYTES_PER_FRAME <= payload.length) {
                s = payload.subarray(off, off + DATA_BYTES_PER_FRAME);
            } else {
                s = new Uint8Array(DATA_BYTES_PER_FRAME); // zero-padded tail
                s.set(payload.subarray(off));
            }
            dataShards.push(s);
            shards[gen.start + i] = s;
        }
        const parity = rsEncode(dataShards, gen.m);
        for (let i = 0; i < gen.m; i++) shards[gen.start + gen.k + i] = parity[i];
    }
    return shards;
}

/**
 * Frame emission order: round-robin across generations so consecutive frames
 * belong to different generations — a burst of corrupted frames then costs
 * each generation ~burst/G shards instead of landing entirely in one.
 * Decode is order-independent (each frame header carries its global index).
 */
export function interleavedShardOrder(plan) {
    const order = new Array(plan.totalShards);
    let pos = 0;
    const maxLen = plan.generations.reduce((mx, g) => Math.max(mx, g.k + g.m), 0);
    for (let s = 0; s < maxLen; s++) {
        for (const g of plan.generations) {
            if (s < g.k + g.m) order[pos++] = g.start + s;
        }
    }
    return order;
}

/**
 * Reassemble the payload from decoded frames (v4). `shardSlots` is an array of
 * length plan.totalShards holding each CRC-valid frame's data (or null).
 * Throws when any generation has fewer than k shards present.
 */
export function assembleShardsRS(shardSlots, plan, originalSize) {
    const out = new Uint8Array(originalSize);
    let dataIdx = 0;
    for (let g = 0; g < plan.generations.length; g++) {
        const gen = plan.generations[g];
        const slots = shardSlots.slice(gen.start, gen.start + gen.k + gen.m);
        const present = slots.reduce((n, s) => n + (s ? 1 : 0), 0);
        Logger.log(`[VisualStripCodec] RS gen ${g}: ${present}/${gen.k + gen.m} shards present (need ${gen.k})`);
        if (present < gen.k) {
            throw new Error(`Video too damaged to recover: generation ${g} has ${present}/${gen.k} shards`);
        }
        const data = rsDecode(slots, gen.k, gen.m);
        for (let i = 0; i < gen.k; i++, dataIdx++) {
            const off = dataIdx * DATA_BYTES_PER_FRAME;
            if (off >= originalSize) break;
            const take = Math.min(DATA_BYTES_PER_FRAME, originalSize - off);
            out.set(data[i].subarray(0, take), off);
        }
    }
    Logger.log(`[VisualStripCodec] RS assemble done — ${originalSize} B from ${plan.totalShards} shards`);
    return out;
}

export function framesNeeded(byteCount) {
    return planShards(byteCount).totalShards;
}

export function stripDurationSec(byteCount) {
    return framesNeeded(byteCount) / FPS;
}

// ─── I420 encoding (fastest path — avoids RGBA and canvas entirely) ───────────
//
// I420 is the native format for H.264. Feeding it directly skips the
// RGBA→I420 color-space conversion the encoder would otherwise do per frame.
// Buffer layout: [Y plane: W×H] [U plane: W/2×H/2] [V plane: W/2×H/2]

export const I420_Y_SIZE  = VIDEO_W * VIDEO_H;                // 921 600 B
export const I420_UV_SIZE = (VIDEO_W >> 1) * (VIDEO_H >> 1); // 230 400 B
export const I420_SIZE    = I420_Y_SIZE + I420_UV_SIZE * 2;  // 1 382 400 B

function _writeBlockI420Y(i420, col, row, bit) {
    // bit=0 → Y stays at whatever the placeholder has (<128 → decoded as 0). No write.
    // bit=1 → write Y=255 to every pixel in the 16×16 block.
    if (!bit) return;
    const x0 = col * BLOCK_PX;
    const y0 = row * BLOCK_PX;
    for (let dy = 0; dy < BLOCK_PX; dy++) {
        const base = (y0 + dy) * VIDEO_W + x0;
        i420.fill(255, base, base + BLOCK_PX);
    }
}

// Where each block row's blocks start in _ALL_BLOCKS, and how many it has.
// _ALL_BLOCKS is built row-major, so one row is a contiguous span of it.
const _ROW_SPANS = (() => {
    const spans = [];
    let start = 0;
    while (start < _ALL_BLOCKS.length) {
        const row = _ALL_BLOCKS[start].row;
        let end = start;
        while (end < _ALL_BLOCKS.length && _ALL_BLOCKS[end].row === row) end++;
        spans.push({ row, start, count: end - start });
        start = end;
    }
    return spans;
})();

/**
 * Build a frame writer for one carrier's placeholder.
 *
 * Writing a frame block by block means 16 fills of 16 bytes per white block,
 * around 26 000 fill calls per frame, which measured as the largest single
 * cost in encrypting -- ahead of the H.264 encoder itself. Wherever the
 * placeholder is identical on all 16 pixel rows of a block row, that row can
 * instead be built once as one VIDEO_W-byte row and copied down, trading a
 * fill per block per row for 16 row-sized copies.
 *
 * Which rows qualify is measured from the placeholder rather than assumed from
 * the banner geometry. The contract here is only that the placeholder is dark
 * behind the data blocks, so a placeholder that grows a gradient or a second
 * card must not quietly have the detail flattened out of it. Rows that are not
 * uniform keep the per-block path, and because a uniform row is by definition
 * the same on every one of its pixel rows, copying one down cannot disturb
 * anything the codec skips.
 *
 * The buffer passed to the returned writer must already hold the placeholder:
 * black blocks are left as they are, and the U/V planes are never touched.
 *
 * @param {Uint8Array} placeholderI420 the frame every carrier frame starts from
 * @returns {(i420: Uint8Array, shardIndex: number, data: Uint8Array) => void}
 */
export function makeFrameWriter(placeholderI420) {
    const scratch = new Uint8Array(VIDEO_W);
    const templates = new Array(BLOCKS_Y).fill(null);
    for (const { row } of _ROW_SPANS) {
        const top = row * BLOCK_PX * VIDEO_W;
        let uniform = true;
        for (let dy = 1; dy < BLOCK_PX && uniform; dy++) {
            const base = top + dy * VIDEO_W;
            for (let x = 0; x < VIDEO_W; x++) {
                if (placeholderI420[base + x] !== placeholderI420[top + x]) { uniform = false; break; }
            }
        }
        if (uniform) templates[row] = placeholderI420.slice(top, top + VIDEO_W);
    }
    Logger.log(`[VisualStripCodec] Frame writer — ${templates.filter(Boolean).length}/${BLOCKS_Y} block rows can be written a row at a time`);

    return (i420, shardIndex, data) => {
        const checksum = _headerCrc(shardIndex, data);
        const hBits = _headerBits(shardIndex, checksum);

        // Row 0 is the header, 80 blocks of it; not worth a second path.
        for (let i = 0; i < _HDR_BLOCKS.length; i++) {
            const { row, col } = _HDR_BLOCKS[i];
            _writeBlockI420Y(i420, col, row, hBits[i]);
        }

        for (const span of _ROW_SPANS) {
            // Data bits are numbered from the first block after the header
            // row, which is exactly where _DATA_BLOCKS starts.
            const first = span.start - HEADER_BITS;
            if (first < 0) continue;
            const template = templates[span.row];

            if (!template) {
                for (let j = 0; j < span.count; j++) {
                    const i = first + j;
                    const byteIdx = i >> 3;
                    const bit = byteIdx < data.length ? (data[byteIdx] >> (7 - (i & 7))) & 1 : 0;
                    const { row, col } = _DATA_BLOCKS[i];
                    _writeBlockI420Y(i420, col, row, bit);
                }
                continue;
            }

            scratch.set(template);
            for (let j = 0; j < span.count; j++) {
                const i = first + j;
                const byteIdx = i >> 3;
                const bit = byteIdx < data.length ? (data[byteIdx] >> (7 - (i & 7))) & 1 : 0;
                if (!bit) continue;
                const x0 = _DATA_BLOCKS[i].col * BLOCK_PX;
                scratch.fill(255, x0, x0 + BLOCK_PX);
            }
            const top = span.row * BLOCK_PX * VIDEO_W;
            for (let dy = 0; dy < BLOCK_PX; dy++) i420.set(scratch, top + dy * VIDEO_W);
        }
    };
}

// ─── Decoding ────────────────────────────────────────────────────────────────

// A block is "white" when its mean luma clears this. Compared as a sum to
// keep the divide out of the inner loop.
const _BLOCK_PIXELS = BLOCK_PX * BLOCK_PX;
const _WHITE_SUM = 128 * _BLOCK_PIXELS;

function _readBitLuma(luma, stride, col, row) {
    const x0 = col * BLOCK_PX;
    const y0 = row * BLOCK_PX;
    let total = 0;
    for (let dy = 0; dy < BLOCK_PX; dy++) {
        const base = (y0 + dy) * stride + x0;
        for (let dx = 0; dx < BLOCK_PX; dx++) total += luma[base + dx];
    }
    return total > _WHITE_SUM ? 1 : 0;
}

/**
 * Flatten RGBA pixels to the luma plane the decoder actually wants.
 *
 * Only needed when a frame could not be read as luma directly -- a carrier a
 * platform re-encoded at a smaller size has to go through a canvas to be
 * scaled back to VIDEO_W × VIDEO_H first.
 * @param {ImageData} imageData
 * @returns {Uint8Array} one byte per pixel, stride = imageData.width
 */
function _lumaFromImageData(imageData) {
    const { data, width, height } = imageData;
    const luma = new Uint8Array(width * height);
    for (let i = 0, p = 0; i < luma.length; i++, p += 4) {
        // The encoder writes luma only, so the mean of R, G and B recovers it
        // without needing the weighted Rec.601 form.
        luma[i] = (data[p] + data[p + 1] + data[p + 2]) / 3;
    }
    return luma;
}

/**
 * Decode a frame's data from its ImageData.
 * Returns { shardIndex, data, valid } or null if the sync byte doesn't match.
 */
export function decodeFrame(imageData) {
    return decodeFrameFromLuma(_lumaFromImageData(imageData), imageData.width);
}

/**
 * Decode a frame's data straight from its luma plane.
 *
 * This is the plane the encoder wrote and the decoder is handed: a decoded
 * I420 sample carries it at offset 0, so copying it out costs ~0.8ms where
 * drawing the frame to a canvas and averaging R, G and B back into the luma
 * it started as cost ~7.6ms. Same bits either way.
 * @param {Uint8Array} luma one byte per pixel
 * @param {number} stride bytes per row, which is not always the frame width
 * @returns {{shardIndex: number, data: Uint8Array, valid: boolean}|null}
 */
export function decodeFrameFromLuma(luma, stride) {
    // Verify sync byte from first 8 header blocks
    let syncRead = 0;
    for (let i = 0; i < 8; i++) {
        const { row, col } = _HDR_BLOCKS[i];
        syncRead = (syncRead << 1) | _readBitLuma(luma, stride, col, row);
    }
    if (syncRead !== SYNC_BYTE) return null;

    let shardIndex = 0, storedCrc = 0;
    let hPos = 8;
    for (let i = 0; i < 32; i++, hPos++) {
        const { row, col } = _HDR_BLOCKS[hPos];
        shardIndex = ((shardIndex << 1) | _readBitLuma(luma, stride, col, row)) >>> 0;
    }
    hPos += 8; // skip reserved byte
    for (let i = 0; i < 32; i++, hPos++) {
        const { row, col } = _HDR_BLOCKS[hPos];
        storedCrc = ((storedCrc << 1) | _readBitLuma(luma, stride, col, row)) >>> 0;
    }

    // Read payload
    const data = new Uint8Array(DATA_BYTES_PER_FRAME);
    for (let i = 0; i < _DATA_BLOCKS.length; i++) {
        const byteIdx = i >> 3;
        const bitIdx  = 7 - (i & 7);
        const { row, col } = _DATA_BLOCKS[i];
        if (_readBitLuma(luma, stride, col, row)) data[byteIdx] |= (1 << bitIdx);
    }

    return {
        shardIndex,
        data,
        valid: _headerCrc(shardIndex, data) === storedCrc,
    };
}

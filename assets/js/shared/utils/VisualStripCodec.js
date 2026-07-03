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

/**
 * Encode one frame directly into a pre-allocated I420 buffer.
 * The buffer must already contain the placeholder I420 (copied before calling).
 * Only white (bit=1) blocks are written to the Y plane — black blocks are left
 * as-is from the placeholder (background Y < 128, decoded as 0). U/V planes
 * are never touched; they stay at 128 (neutral chroma) from the placeholder.
 *
 * @param {Uint8Array} i420        pre-filled with placeholder I420 pixels
 * @param {number} shardIndex      global shard index (0 … 2^32-1)
 * @param {Uint8Array} data        exactly DATA_BYTES_PER_FRAME bytes
 */
export function encodeFrameToI420(i420, shardIndex, data) {
    const checksum = _headerCrc(shardIndex, data);
    const hBits = _headerBits(shardIndex, checksum);

    for (let i = 0; i < _HDR_BLOCKS.length; i++) {
        const { row, col } = _HDR_BLOCKS[i];
        _writeBlockI420Y(i420, col, row, hBits[i]);
    }

    for (let i = 0; i < _DATA_BLOCKS.length; i++) {
        const byteIdx = i >> 3;
        const bitIdx  = 7 - (i & 7);
        const bit     = byteIdx < data.length ? (data[byteIdx] >> bitIdx) & 1 : 0;
        const { row, col } = _DATA_BLOCKS[i];
        _writeBlockI420Y(i420, col, row, bit);
    }
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
 * Returns { shardIndex, data, valid } or null if the sync byte doesn't match.
 */
export function decodeFrame(imageData) {
    // Verify sync byte from first 8 header blocks
    let syncRead = 0;
    for (let i = 0; i < 8; i++) {
        const { row, col } = _HDR_BLOCKS[i];
        syncRead = (syncRead << 1) | _readBit(imageData, col, row);
    }
    if (syncRead !== SYNC_BYTE) return null;

    let shardIndex = 0, storedCrc = 0;
    let hPos = 8;
    for (let i = 0; i < 32; i++, hPos++) {
        const { row, col } = _HDR_BLOCKS[hPos];
        shardIndex = ((shardIndex << 1) | _readBit(imageData, col, row)) >>> 0;
    }
    hPos += 8; // skip reserved byte
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

    return {
        shardIndex,
        data,
        valid: _headerCrc(shardIndex, data) === storedCrc,
    };
}

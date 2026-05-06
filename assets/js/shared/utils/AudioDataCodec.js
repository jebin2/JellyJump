/**
 * AudioDataCodec
 * Encodes bytes as a multi-tone On-Off Keying (OOK) audio signal and decodes them back.
 *
 * Design:
 *   - 16 simultaneous carrier tones (800–6800 Hz, 400 Hz spacing)
 *   - Each symbol = 200 ms = one bit per tone = 2 bytes per symbol
 *   - Preamble: 4× TONE_EVEN (even tones on) + 4× TONE_ODD (odd tones on)
 *   - Data follows preamble: 2-symbol uint32 length prefix, then payload bytes,
 *     then 2-symbol CRC-32 trailer for integrity verification
 *   - Decoding uses the Goertzel algorithm per symbol window
 *
 * Survives AAC 128 kbps transcoding because:
 *   - All tones are in the 800–7 kHz range that AAC preserves well
 *   - 400 Hz spacing avoids inter-tone interference
 *   - 200 ms symbol period gives strong, unambiguous frequency energy
 *   - Adaptive threshold compensates for amplitude change after re-encoding
 *   - CRC-32 trailer rejects partial/misaligned decodes instead of returning garbage
 */

import { Logger } from './Logger.js';

export const AUDIO_SAMPLE_RATE = 48000;
const SYMBOL_MS = 200;
const SYMBOL_SAMPLES = Math.round(AUDIO_SAMPLE_RATE * SYMBOL_MS / 1000); // 9600
const FADE_SAMPLES = Math.round(AUDIO_SAMPLE_RATE * 0.010);               // 480 — 10 ms fade
const AMPLITUDE = 0.055;   // per tone; 16 tones × 0.055 ≈ 0.88 max — avoids clipping

// 16 tones chosen for AAC-survivability (mid-range, multiples of 400 Hz)
const TONES = [800, 1200, 1600, 2000, 2400, 2800, 3200, 3600,
               4000, 4400, 4800, 5200, 5600, 6000, 6400, 6800];

const PREAMBLE_EVEN = 0xAAAA; // 1010101010101010 — even-indexed tones on
const PREAMBLE_ODD  = 0x5555; // 0101010101010101 — odd-indexed tones on
const PREAMBLE_REPS = 4;      // repeat each pattern 4×

// ─── CRC-32 (IEEE 802.3) ─────────────────────────────────────────────────────

function _crc32(data) {
    let crc = 0xFFFFFFFF;
    for (const b of data) {
        crc ^= b;
        for (let i = 0; i < 8; i++) crc = (crc & 1) ? (crc >>> 1) ^ 0xEDB88320 : crc >>> 1;
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ─── Encoding ────────────────────────────────────────────────────────────────

/**
 * Encode a Uint8Array as a Float32Array audio signal (mono, 48 kHz).
 * Wire format: preamble | lenHi | lenLo | data symbols | crcHi | crcLo
 * @param {Uint8Array} bytes
 * @returns {Float32Array}
 */
export function encodeAudio(bytes) {
    const checksum = _crc32(bytes);
    const symbols = [];

    for (let i = 0; i < PREAMBLE_REPS; i++) symbols.push(PREAMBLE_EVEN);
    for (let i = 0; i < PREAMBLE_REPS; i++) symbols.push(PREAMBLE_ODD);

    // Length prefix: uint32, high half first (avoids 0x0000 sentinel ambiguity)
    symbols.push((bytes.length >>> 16) & 0xFFFF);
    symbols.push(bytes.length & 0xFFFF);

    // Data: 2 bytes per symbol (little-endian within symbol)
    for (let i = 0; i < bytes.length; i += 2) {
        const lo = bytes[i];
        const hi = (i + 1 < bytes.length) ? bytes[i + 1] : 0;
        symbols.push(lo | (hi << 8));
    }

    // CRC-32 trailer: 4 bytes as 2 symbols (high half first)
    symbols.push((checksum >>> 16) & 0xFFFF);
    symbols.push(checksum & 0xFFFF);

    const durationSec = (symbols.length * SYMBOL_MS / 1000).toFixed(2);
    Logger.log(`[AudioDataCodec] encode — ${bytes.length} B → ${symbols.length} symbols (${durationSec} s), CRC=0x${checksum.toString(16).padStart(8, '0')}`);

    const audio = new Float32Array(symbols.length * SYMBOL_SAMPLES);

    for (let si = 0; si < symbols.length; si++) {
        const sym = symbols[si];
        const base = si * SYMBOL_SAMPLES;

        for (let ti = 0; ti < 16; ti++) {
            if (!(sym & (1 << ti))) continue;

            const phaseInc = 2 * Math.PI * TONES[ti] / AUDIO_SAMPLE_RATE;
            for (let s = 0; s < SYMBOL_SAMPLES; s++) {
                let amp = AMPLITUDE;
                // Linear fade in/out to suppress spectral leakage
                if (s < FADE_SAMPLES)                        amp *= s / FADE_SAMPLES;
                else if (s >= SYMBOL_SAMPLES - FADE_SAMPLES) amp *= (SYMBOL_SAMPLES - s) / FADE_SAMPLES;
                audio[base + s] += amp * Math.sin(phaseInc * s);
            }
        }
    }

    return audio;
}

// ─── Decoding ────────────────────────────────────────────────────────────────

/**
 * Goertzel filter: energy of a single frequency within a sample window.
 */
function goertzel(samples, freq) {
    const omega = 2 * Math.PI * freq / AUDIO_SAMPLE_RATE;
    const coeff = 2 * Math.cos(omega);
    let q1 = 0, q2 = 0;
    for (let i = 0; i < samples.length; i++) {
        const q0 = coeff * q1 - q2 + samples[i];
        q2 = q1;
        q1 = q0;
    }
    return q1 * q1 + q2 * q2 - q1 * q2 * coeff;
}

/**
 * Decode one symbol window using max-gap split on sorted energies.
 * Reliable when exactly 8 tones are active (preamble + coarse scan use only).
 * Do NOT use for data symbols — use _decodeCalibrated instead.
 */
function decodeSymbol(samples) {
    const energies = TONES.map(f => goertzel(samples, f));
    const sorted = [...energies].sort((a, b) => a - b);
    let maxGap = -1, splitIdx = 0;
    for (let i = 0; i < 15; i++) {
        const gap = sorted[i + 1] - sorted[i];
        if (gap > maxGap) { maxGap = gap; splitIdx = i; }
    }
    const threshold = (sorted[splitIdx] + sorted[splitIdx + 1]) / 2;
    let sym = 0;
    for (let i = 0; i < 16; i++) {
        if (energies[i] > threshold) sym |= (1 << i);
    }
    return sym;
}

/**
 * Decode using per-tone calibrated thresholds derived from the preamble.
 * Each tone is independently compared to its own threshold (E_on[i] / 2),
 * correctly handling any number of active tones including 0 (silence) and 16.
 */
function _decodeCalibrated(samples, thresholds) {
    let sym = 0;
    for (let i = 0; i < 16; i++) {
        if (goertzel(samples, TONES[i]) > thresholds[i]) sym |= (1 << i);
    }
    return sym;
}

/**
 * Attempt to decode starting at a given sample offset.
 * Returns Uint8Array (verified by CRC-32) or null.
 *
 * Calibration: preamble detection uses max-gap (reliable for exactly 8 tones ON).
 * After preamble, each tone's ON-energy is measured from the last confirmed
 * EVEN/ODD preamble symbol and used as a per-tone threshold for all data symbols.
 * This correctly handles 0x0000 (silence) and 0xFFFF (all tones) data symbols.
 */
function tryDecode(allSamples, startOffset) {
    let pos = startOffset;

    // Require at least (PREAMBLE_REPS - 1) EVEN symbols; save last window's energies
    let evenCount = 0;
    let lastEvenEnergies = null;
    while (pos + SYMBOL_SAMPLES <= allSamples.length) {
        const window = allSamples.subarray(pos, pos + SYMBOL_SAMPLES);
        const energies = TONES.map(f => goertzel(window, f));
        const sorted = [...energies].sort((a, b) => a - b);
        let maxGap = -1, si = 0;
        for (let i = 0; i < 15; i++) { const g = sorted[i+1]-sorted[i]; if (g > maxGap) { maxGap = g; si = i; } }
        const sym = (() => { const t = (sorted[si]+sorted[si+1])/2; let s=0; for (let i=0;i<16;i++) if (energies[i]>t) s|=(1<<i); return s; })();
        if (sym === PREAMBLE_EVEN) { evenCount++; lastEvenEnergies = energies; pos += SYMBOL_SAMPLES; }
        else { if (evenCount >= PREAMBLE_REPS - 1) break; return null; }
    }
    if (evenCount < PREAMBLE_REPS - 1) return null;

    // Require at least (PREAMBLE_REPS - 1) ODD symbols; save last window's energies
    let oddCount = 0;
    let lastOddEnergies = null;
    while (pos + SYMBOL_SAMPLES <= allSamples.length) {
        const window = allSamples.subarray(pos, pos + SYMBOL_SAMPLES);
        const energies = TONES.map(f => goertzel(window, f));
        const sorted = [...energies].sort((a, b) => a - b);
        let maxGap = -1, si = 0;
        for (let i = 0; i < 15; i++) { const g = sorted[i+1]-sorted[i]; if (g > maxGap) { maxGap = g; si = i; } }
        const sym = (() => { const t = (sorted[si]+sorted[si+1])/2; let s=0; for (let i=0;i<16;i++) if (energies[i]>t) s|=(1<<i); return s; })();
        if (sym === PREAMBLE_ODD) { oddCount++; lastOddEnergies = energies; pos += SYMBOL_SAMPLES; }
        else break;
    }
    if (oddCount < PREAMBLE_REPS - 1) return null;

    Logger.log(`[AudioDataCodec] tryDecode — preamble at offset ${startOffset} (even=${evenCount} odd=${oddCount})`);

    // Build per-tone thresholds using the preamble symbol where each tone is ON:
    //   PREAMBLE_EVEN (0xAAAA) → bit i set when i is ODD (1,3,5,...,15) → ODD tones ON
    //   PREAMBLE_ODD  (0x5555) → bit i set when i is EVEN (0,2,4,...,14) → EVEN tones ON
    const thresholds = new Array(16);
    for (let i = 0; i < 16; i++) {
        const E_on = (i % 2 === 0) ? lastOddEnergies[i] : lastEvenEnergies[i];
        thresholds[i] = E_on / 2;
    }

    // All subsequent decodes use calibrated per-tone thresholds
    const nextSym = () => {
        if (pos + SYMBOL_SAMPLES > allSamples.length) return null;
        const sym = _decodeCalibrated(allSamples.subarray(pos, pos + SYMBOL_SAMPLES), thresholds);
        pos += SYMBOL_SAMPLES;
        return sym;
    };

    // Read length prefix (2 symbols = uint32, high half first)
    const lenHi = nextSym();
    const lenLo = nextSym();
    if (lenHi === null || lenLo === null) return null;
    const byteCount = (lenHi & 0xFFFF) * 65536 + (lenLo & 0xFFFF);
    if (byteCount === 0 || byteCount > 65536) {
        Logger.log(`[AudioDataCodec] tryDecode — bad byteCount=${byteCount}, skipping`);
        return null;
    }

    Logger.log(`[AudioDataCodec] tryDecode — length=${byteCount} B, reading…`);

    // Read exactly byteCount bytes
    const data = new Uint8Array(byteCount);
    let bytePos = 0;
    while (bytePos < byteCount) {
        const sym = nextSym();
        if (sym === null) break;
        data[bytePos++] = sym & 0xFF;
        if (bytePos < byteCount) data[bytePos++] = (sym >> 8) & 0xFF;
    }
    if (bytePos < byteCount) {
        Logger.log(`[AudioDataCodec] tryDecode — truncated: read ${bytePos}/${byteCount} B`);
        return null;
    }

    // Verify CRC-32 trailer (2 symbols = 4 bytes)
    const crcHi = nextSym();
    const crcLo = nextSym();
    if (crcHi === null || crcLo === null) {
        Logger.log('[AudioDataCodec] tryDecode — no room for CRC trailer');
        return null;
    }
    const storedCrc   = (crcHi & 0xFFFF) * 65536 + (crcLo & 0xFFFF);
    const computedCrc = _crc32(data);
    if (computedCrc !== storedCrc) {
        Logger.log(`[AudioDataCodec] tryDecode — CRC mismatch at offset ${startOffset} (stored=0x${storedCrc.toString(16).padStart(8,'0')} computed=0x${computedCrc.toString(16).padStart(8,'0')})`);
        return null;
    }

    return data;
}

/**
 * Decode audio Float32Array → Uint8Array of encoded bytes.
 * Uses a coarse scan for PREAMBLE_EVEN candidates, then fine-tunes alignment
 * around each candidate. CRC-32 ensures only a correct decode is returned.
 * @param {Float32Array} allSamples
 * @returns {Uint8Array|null}
 */
export function decodeAudio(allSamples) {
    Logger.log(`[AudioDataCodec] decodeAudio — ${allSamples.length} samples (${(allSamples.length / AUDIO_SAMPLE_RATE).toFixed(2)} s)`);

    // Coarse scan: step = SYMBOL_SAMPLES / 4 to locate EVEN-preamble candidates
    const coarseStep = Math.floor(SYMBOL_SAMPLES / 4); // 2400 samples
    const fineStep   = Math.floor(SYMBOL_SAMPLES / 20); // 480 samples

    for (let offset = 0; offset + SYMBOL_SAMPLES <= allSamples.length; offset += coarseStep) {
        const sym = decodeSymbol(allSamples.subarray(offset, offset + SYMBOL_SAMPLES));
        if (sym !== PREAMBLE_EVEN) continue;

        // EVEN candidate found — fine search in [offset-coarseStep, offset+coarseStep]
        const searchStart = Math.max(0, offset - coarseStep);
        const searchEnd   = Math.min(offset + coarseStep, allSamples.length - SYMBOL_SAMPLES);
        for (let fineOffset = searchStart; fineOffset <= searchEnd; fineOffset += fineStep) {
            const result = tryDecode(allSamples, fineOffset);
            if (result !== null) {
                Logger.log(`[AudioDataCodec] decodeAudio — success at offset=${fineOffset}, ${result.length} B`);
                return result;
            }
        }
    }

    Logger.log('[AudioDataCodec] decodeAudio — all candidates failed, no valid decode found');
    return null;
}

/**
 * Duration in seconds for an audio signal encoding the given number of bytes.
 */
export function audioDurationSec(byteCount) {
    const preambleSymbols = PREAMBLE_REPS * 2;
    const dataSymbols = 2 + Math.ceil(byteCount / 2) + 2; // length prefix + data + CRC trailer
    return (preambleSymbols + dataSymbols) * SYMBOL_MS / 1000;
}

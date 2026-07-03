/**
 * Systematic Reed–Solomon erasure code over GF(256).
 *
 * Used by the JJC4 visual strip: the payload is split into k data shards
 * (one per carrier frame) and m parity shards are added. Any k of the k+m
 * shards reconstruct the original data — so up to m lost/corrupted frames are
 * recovered, at m/k overhead instead of the old 3× frame repetition.
 *
 * Erasure-only: the caller always knows which shards are present (a frame's
 * CRC-32 tells present vs. lost), so this never has to *locate* errors, only
 * fill known gaps. That lets it recover up to the full m missing shards.
 *
 * Construction: systematic Cauchy matrix. The encoding matrix is
 * [ I_k ; C ] where C is an m×k Cauchy matrix; any k of its k+m rows form an
 * invertible k×k matrix, which is exactly what erasure decoding needs.
 *
 * GF(256) with primitive polynomial 0x11D (x^8+x^4+x^3+x^2+1).
 */

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(function initTables() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
        EXP[i] = x;
        LOG[x] = i;
        x <<= 1;
        if (x & 0x100) x ^= 0x11D;
    }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

function gmul(a, b) {
    if (a === 0 || b === 0) return 0;
    return EXP[LOG[a] + LOG[b]];
}

function gdiv(a, b) {
    // b must be non-zero
    if (a === 0) return 0;
    return EXP[LOG[a] - LOG[b] + 255];
}

// Full 256×256 multiply table — the encode/decode inner loops run per byte
// across every shard, so a table lookup beats two log/exp lookups per multiply.
const MUL = (() => {
    const t = new Uint8Array(256 * 256);
    for (let a = 0; a < 256; a++) {
        for (let b = 0; b < 256; b++) {
            t[a * 256 + b] = gmul(a, b);
        }
    }
    return t;
})();

/** Maximum shards per generation (k + m ≤ 255 for GF(256)). */
export const MAX_SHARDS = 255;

/**
 * Row `r` of the systematic encoding matrix [I_k ; C], length k.
 * Rows 0..k-1 are the identity (data shards); rows k..k+m-1 are Cauchy
 * (parity shards). Cauchy element = 1 / (x_i XOR y_j) with the x's and y's
 * drawn from disjoint value ranges, guaranteeing every square submatrix is
 * invertible.
 */
function encodingRow(r, k, m) {
    const row = new Uint8Array(k);
    if (r < k) {
        row[r] = 1;
        return row;
    }
    const i = r - k;                 // parity row index, 0..m-1
    const x = i;                     // x_i ∈ {0..m-1}
    for (let j = 0; j < k; j++) {
        const y = m + j;             // y_j ∈ {m..m+k-1}, disjoint from x's
        row[j] = gdiv(1, x ^ y);
    }
    return row;
}

/**
 * Invert a k×k matrix (array of k Uint8Array rows) in GF(256) via
 * Gauss–Jordan elimination. Returns the inverse as k Uint8Array rows.
 * Throws if singular (should never happen for a Cauchy-derived matrix).
 */
function invertMatrix(rows, k) {
    // Work on an augmented [A | I] then reduce A to I.
    const a = rows.map((r) => Uint8Array.from(r));
    const inv = [];
    for (let i = 0; i < k; i++) {
        const e = new Uint8Array(k);
        e[i] = 1;
        inv.push(e);
    }

    for (let col = 0; col < k; col++) {
        // Find a pivot row with a non-zero entry in this column.
        let pivot = col;
        while (pivot < k && a[pivot][col] === 0) pivot++;
        if (pivot === k) throw new Error('ReedSolomon: singular matrix');

        if (pivot !== col) {
            [a[col], a[pivot]] = [a[pivot], a[col]];
            [inv[col], inv[pivot]] = [inv[pivot], inv[col]];
        }

        // Scale pivot row so a[col][col] === 1.
        const p = a[col][col];
        if (p !== 1) {
            const pinv = gdiv(1, p);
            for (let j = 0; j < k; j++) {
                a[col][j] = MUL[a[col][j] * 256 + pinv];
                inv[col][j] = MUL[inv[col][j] * 256 + pinv];
            }
        }

        // Eliminate this column from all other rows.
        for (let row = 0; row < k; row++) {
            if (row === col) continue;
            const factor = a[row][col];
            if (factor === 0) continue;
            for (let j = 0; j < k; j++) {
                a[row][j] ^= MUL[factor * 256 + a[col][j]];
                inv[row][j] ^= MUL[factor * 256 + inv[col][j]];
            }
        }
    }
    return inv;
}

/**
 * Encode k data shards into m parity shards.
 * @param {Uint8Array[]} dataShards - k shards, all the same length
 * @param {number} m - number of parity shards to produce
 * @returns {Uint8Array[]} m parity shards, each the shard length
 */
export function encode(dataShards, m) {
    const k = dataShards.length;
    if (k === 0) return [];
    if (k + m > MAX_SHARDS) throw new Error(`ReedSolomon: k+m=${k + m} exceeds ${MAX_SHARDS}`);
    const L = dataShards[0].length;

    const parity = [];
    for (let i = 0; i < m; i++) parity.push(new Uint8Array(L));

    for (let i = 0; i < m; i++) {
        const row = encodingRow(k + i, k, m); // Cauchy row, length k
        const out = parity[i];
        for (let j = 0; j < k; j++) {
            const c = row[j];
            if (c === 0) continue;
            const src = dataShards[j];
            const mulRow = c * 256;
            for (let b = 0; b < L; b++) {
                out[b] ^= MUL[mulRow + src[b]];
            }
        }
    }
    return parity;
}

/**
 * Reconstruct the k data shards from any k present shards.
 * @param {(Uint8Array|null)[]} shards - length k+m; present shards or null
 * @param {number} k - number of data shards
 * @param {number} m - number of parity shards
 * @returns {Uint8Array[]} the k reconstructed data shards
 * @throws if fewer than k shards are present
 */
export function decode(shards, k, m) {
    const n = k + m;

    // Fast path: every data shard is present — nothing to reconstruct.
    let allData = true;
    for (let r = 0; r < k; r++) {
        if (!shards[r]) { allData = false; break; }
    }
    if (allData) return shards.slice(0, k).map((s) => s);

    // Pick the first k present shards.
    const present = [];
    for (let r = 0; r < n && present.length < k; r++) {
        if (shards[r]) present.push(r);
    }
    if (present.length < k) {
        throw new Error(`ReedSolomon: only ${present.length}/${k} shards present, cannot recover`);
    }

    const decodeMatrix = present.map((r) => encodingRow(r, k, m));
    const inv = invertMatrix(decodeMatrix, k);

    const L = shards[present[0]].length;
    const out = [];
    for (let i = 0; i < k; i++) {
        // Data shard i is present → copy it, skip the matrix multiply.
        if (shards[i]) { out.push(shards[i]); continue; }

        const dst = new Uint8Array(L);
        const invRow = inv[i];
        for (let j = 0; j < k; j++) {
            const c = invRow[j];
            if (c === 0) continue;
            const src = shards[present[j]];
            const mulRow = c * 256;
            for (let b = 0; b < L; b++) {
                dst[b] ^= MUL[mulRow + src[b]];
            }
        }
        out.push(dst);
    }
    return out;
}

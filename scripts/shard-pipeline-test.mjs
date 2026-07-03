// Node round-trip test of the JJC4 shard pipeline (no video involved):
// planShards → buildShards → interleavedShardOrder → erasures → assembleShardsRS
import {
    planShards, buildShards, interleavedShardOrder, assembleShardsRS,
    DATA_BYTES_PER_FRAME, RS_DATA_SHARDS, RS_PARITY_SHARDS,
} from '../assets/js/shared/utils/VisualStripCodec.js';

let seed = 0xBEEF01;
function rnd() { seed ^= (seed << 13) >>> 0; seed ^= seed >>> 17; seed ^= (seed << 5) >>> 0; return (seed >>> 0) / 0x100000000; }
function rndInt(lo, hi) { return lo + Math.floor(rnd() * (hi - lo + 1)); }
function payloadOf(n) { const p = new Uint8Array(n); for (let i = 0; i < n; i++) p[i] = rndInt(0, 255); return p; }

let cases = 0, failures = 0;
function check(name, cond) { cases++; if (!cond) { failures++; console.error('FAIL:', name); } }

function run(bytes, label, eraseMode) {
    const payload = payloadOf(bytes);
    const plan = planShards(payload.length);

    // plan invariants
    check(`${label}: totalDataShards`, plan.totalDataShards === Math.max(1, Math.ceil(bytes / DATA_BYTES_PER_FRAME)));
    let expectStart = 0;
    for (const g of plan.generations) {
        check(`${label}: gen start contiguous`, g.start === expectStart);
        expectStart += g.k + g.m;
    }
    check(`${label}: totalShards`, plan.totalShards === expectStart);

    const shards = buildShards(payload, plan);
    check(`${label}: all shards built`, shards.every((s) => s && s.length === DATA_BYTES_PER_FRAME));

    // interleave order must be a permutation of 0..totalShards-1
    const order = interleavedShardOrder(plan);
    const seen = new Set(order);
    check(`${label}: order is permutation`, order.length === plan.totalShards && seen.size === plan.totalShards);

    // Erasures
    const slots = shards.map((s) => Uint8Array.from(s));
    if (eraseMode === 'max-per-gen') {
        // erase exactly m shards in every generation (worst recoverable case)
        for (const g of plan.generations) {
            const idx = Array.from({ length: g.k + g.m }, (_, i) => g.start + i);
            for (let i = idx.length - 1; i > 0; i--) { const j = rndInt(0, i); [idx[i], idx[j]] = [idx[j], idx[i]]; }
            for (let e = 0; e < g.m; e++) slots[idx[e]] = null;
        }
    } else if (eraseMode === 'burst') {
        // erase a contiguous burst of frames in EMISSION order (what a
        // corrupted GOP does). Guaranteed burst tolerance of the round-robin
        // interleave = min(m_g) × (gens active in the sparsest region, i.e.
        // the count of longest generations) — the tail region cycles over
        // fewer generations once short ones are exhausted.
        const maxLen = plan.generations.reduce((mx, g) => Math.max(mx, g.k + g.m), 0);
        const minActive = plan.generations.filter((g) => g.k + g.m === maxLen).length;
        const minM = plan.generations.reduce((mn, g) => Math.min(mn, g.m), Infinity);
        const burst = Math.min(minM * minActive, plan.totalShards - 1);
        const startAt = rndInt(0, plan.totalShards - burst);
        for (let i = 0; i < burst; i++) slots[order[startAt + i]] = null;
    }

    const got = assembleShardsRS(slots, plan, payload.length);
    let ok = got.length === payload.length;
    for (let i = 0; i < payload.length && ok; i++) if (got[i] !== payload[i]) ok = false;
    check(`${label} erase=${eraseMode}: byte-perfect`, ok);
}

// Sizes: sub-shard, exact shard, one gen exactly, multi-gen, sim size, ragged tails
const SIZES = [
    1, 100, 395, 396, 395 * 3, 32 * 1024,
    RS_DATA_SHARDS * DATA_BYTES_PER_FRAME,            // exactly 1 full gen
    RS_DATA_SHARDS * DATA_BYTES_PER_FRAME + 1,        // 1 full gen + 1 byte
    2 * RS_DATA_SHARDS * DATA_BYTES_PER_FRAME - 7,    // ~2 gens ragged
    777_777, 2_000_000,
];
for (const bytes of SIZES) {
    for (const mode of ['none', 'max-per-gen', 'burst']) {
        run(bytes, `${bytes}B`, mode);
    }
}

// Over-limit erasure must throw a clear error
{
    const payload = payloadOf(50_000);
    const plan = planShards(payload.length);
    const shards = buildShards(payload, plan);
    const slots = shards.map((s) => s);
    const g = plan.generations[0];
    for (let i = 0; i <= g.m; i++) slots[g.start + i] = null; // m+1 erasures
    let threw = false;
    try { assembleShardsRS(slots, plan, payload.length); } catch (e) { threw = /too damaged/.test(e.message); }
    check('throws "too damaged" past parity budget', threw);
}

console.log(`\n${cases} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);

// Exhaustive self-test for assets/js/shared/utils/ReedSolomon.js
// Run: npm run test:rs
import { encode, decode, MAX_SHARDS } from '../assets/js/shared/utils/ReedSolomon.js';

let seed = 0xC0FFEE ^ 0;
function rnd() { // xorshift32 → [0,1)
    seed ^= (seed << 13) >>> 0; seed ^= seed >>> 17; seed ^= (seed << 5) >>> 0;
    return (seed >>> 0) / 0x100000000;
}
function rndInt(lo, hi) { return lo + Math.floor(rnd() * (hi - lo + 1)); }
function rndBytes(n) {
    const b = new Uint8Array(n);
    for (let i = 0; i < n; i++) b[i] = rndInt(0, 255);
    return b;
}

let cases = 0, failures = 0;

function check(name, cond) {
    cases++;
    if (!cond) { failures++; console.error(`FAIL: ${name}`); }
}

function runCase(k, m, L, erasures, label) {
    const data = [];
    for (let i = 0; i < k; i++) data.push(rndBytes(L));
    const parity = encode(data, m);

    check(`${label}: parity count`, parity.length === m);
    check(`${label}: parity length`, parity.every((p) => p.length === L));

    const shards = [...data.map((d) => Uint8Array.from(d)), ...parity];
    // Erase `erasures` distinct shard indices
    const idx = shards.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) { const j = rndInt(0, i); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    const holed = shards.map((s) => s);
    for (let e = 0; e < erasures; e++) holed[idx[e]] = null;

    const rec = decode(holed, k, m);
    check(`${label}: recovered count`, rec.length === k);
    let ok = true;
    for (let i = 0; i < k && ok; i++) {
        if (rec[i].length !== L) { ok = false; break; }
        for (let b = 0; b < L; b++) if (rec[i][b] !== data[i][b]) { ok = false; break; }
    }
    check(`${label}: byte-perfect (${erasures} erased)`, ok);
}

// --- 1. Small exhaustive: every k,m in [1..8]×[0..8], every erasure count 0..m
for (let k = 1; k <= 8; k++) {
    for (let m = 0; m <= 8; m++) {
        for (let e = 0; e <= m; e++) {
            runCase(k, m, 16, e, `small k=${k} m=${m}`);
        }
    }
}

// --- 2. Exhaustive erasure patterns for k=4, m=3 (all C(7,e) patterns, e ≤ 3)
{
    const k = 4, m = 3, L = 32, n = k + m;
    const data = []; for (let i = 0; i < k; i++) data.push(rndBytes(L));
    const parity = encode(data, m);
    const shards = [...data, ...parity];
    for (let mask = 0; mask < (1 << n); mask++) {
        let erased = 0;
        for (let i = 0; i < n; i++) if (mask & (1 << i)) erased++;
        if (erased > m) continue;
        const holed = shards.map((s, i) => (mask & (1 << i)) ? null : s);
        const rec = decode(holed, k, m);
        let ok = true;
        for (let i = 0; i < k && ok; i++)
            for (let b = 0; b < L; b++) if (rec[i][b] !== data[i][b]) { ok = false; break; }
        check(`patterns k=4 m=3 mask=${mask.toString(2)}`, ok);
    }
}

// --- 3. JJC4 generation sizes
runCase(200, 50, 395, 50, 'gen k=200 m=50 max-erasure');
runCase(200, 50, 395, 25, 'gen k=200 m=50 half-erasure');
runCase(200, 50, 395, 0,  'gen k=200 m=50 no-erasure');
runCase(205, 50, 395, 50, 'gen k=205 m=50 (k+m=255 exactly)');

// --- 4. Erase ONLY data shards / ONLY parity shards at scale
{
    const k = 100, m = 40, L = 395;
    const data = []; for (let i = 0; i < k; i++) data.push(rndBytes(L));
    const parity = encode(data, m);
    // erase first 40 data shards
    let holed = [...data.map((d, i) => i < 40 ? null : d), ...parity];
    let rec = decode(holed, k, m);
    let ok = rec.every((r, i) => r.every((b, j) => b === data[i][j]));
    check('erase-first-40-data', ok);
    // erase all parity
    holed = [...data, ...parity.map(() => null)];
    rec = decode(holed, k, m);
    ok = rec.every((r, i) => r.every((b, j) => b === data[i][j]));
    check('erase-all-parity', ok);
    // erase last 40 data shards (forces high-index reconstruction)
    holed = [...data.map((d, i) => i >= k - 40 ? null : d), ...parity];
    rec = decode(holed, k, m);
    ok = rec.every((r, i) => r.every((b, j) => b === data[i][j]));
    check('erase-last-40-data', ok);
}

// --- 5. Random fuzz: 300 rounds, random k/m/L/erasures
for (let round = 0; round < 300; round++) {
    const k = rndInt(1, 120);
    const m = rndInt(0, Math.min(80, MAX_SHARDS - k));
    const L = rndInt(1, 512);
    const e = rndInt(0, m);
    runCase(k, m, L, e, `fuzz#${round} k=${k} m=${m} L=${L}`);
}

// --- 6. Failure modes must throw
{
    const k = 4, m = 2;
    const data = []; for (let i = 0; i < k; i++) data.push(rndBytes(8));
    const parity = encode(data, m);
    const holed = [null, null, null, data[3], parity[0], null]; // only 2 present < k
    let threw = false;
    try { decode(holed, k, m); } catch { threw = true; }
    check('throws on too-few shards', threw);

    threw = false;
    try { encode(new Array(200).fill(rndBytes(4)), 60); } catch { threw = true; }
    check('throws on k+m>255', threw);
}

// --- 7. Throughput at JJC4 generation size
{
    const k = 200, m = 50, L = 395;
    const data = []; for (let i = 0; i < k; i++) data.push(rndBytes(L));
    let t = performance.now();
    const parity = encode(data, m);
    const encMs = performance.now() - t;
    const shards = [...data, ...parity];
    for (let e = 0; e < 50; e++) shards[rndInt(0, k + m - 1)] = null; // ~≤50 erasures
    // ensure decodable: count present
    let present = shards.filter(Boolean).length;
    t = performance.now();
    if (present >= k) decode(shards, k, m);
    const decMs = performance.now() - t;
    const mb = (k * L) / 1048576;
    console.log(`perf: encode ${encMs.toFixed(1)}ms decode ${decMs.toFixed(1)}ms for ${mb.toFixed(2)}MB generation (${(mb / (encMs / 1000)).toFixed(1)} MB/s encode)`);
}

console.log(`\n${cases} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);

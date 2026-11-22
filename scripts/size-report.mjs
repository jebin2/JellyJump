/**
 * What the site ships, against the budgets in ARCHITECTURE_PLAN.md §3.9
 * (phase Q1). Reads dist/ (run after `npm run build`), prints a table, and
 * fails on a breach or on growth past the recorded baseline.
 *
 * - JS and CSS each page loads before first paint (its entry and the
 *   modules it preloads), gzipped.
 * - Every lazy chunk, gzipped. Chunks holding vendored libraries (lib/:
 *   MediaBunny, its decoders and encoders, gif.js), the media worker and
 *   Whisper are listed but not budgeted: their size is the library's.
 * - Duplicates: a vendored library file that is in more than one chunk
 *   (BUG-13). Read from the source maps.
 * - Media files in dist/ that no page, script or stylesheet names.
 *
 *   node scripts/size-report.mjs            report and check
 *   node scripts/size-report.mjs --update   record today's sizes as the baseline
 */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const BASELINE = path.join(ROOT, 'scripts/size-baseline.json');
const UPDATE = process.argv.includes('--update');
const PAGES = ['index', 'player', 'embed', 'watch'];

const KB = 1024;
const BUDGET = {
    playerFirstPaintJs: 60 * KB,
    playerCss: 25 * KB,
    lazyChunk: 150 * KB,
    duplicates: 0,
};
/** A total may grow this much past the baseline before the report fails. */
const GROWTH_ALLOWED = 0.05;

if (!existsSync(path.join(DIST, 'player.html'))) {
    console.error('No dist/: run `npm run build` first.');
    process.exit(1);
}

const kb = (n) => `${(n / KB).toFixed(1)} KB`;
const gz = async (file) => gzipSync(await readFile(file)).length;
const assets = path.join(DIST, 'assets');
const files = await readdir(assets);
const jsFiles = files.filter((f) => f.endsWith('.js'));

/** The vendored sources a chunk holds, from its source map. */
async function sourcesOf(file) {
    const map = path.join(assets, `${file}.map`);
    if (!existsSync(map)) return [];
    try {
        return JSON.parse(await readFile(map, 'utf8')).sources.map((s) => s.replace(/^.*?assets\/js\//, 'assets/js/'));
    } catch {
        return [];
    }
}

// --- first paint, per page -----------------------------------------------------

const firstPaint = {};
const eager = new Set();
for (const page of PAGES) {
    const html = await readFile(path.join(DIST, `${page}.html`), 'utf8');
    const refs = [...html.matchAll(/(?:src|href)="\.\/assets\/([^"]+\.(js|css))"/g)].map((m) => m[1]);
    let js = 0, css = 0;
    for (const ref of refs) {
        const size = await gz(path.join(assets, ref));
        if (ref.endsWith('.js')) { js += size; eager.add(ref); } else css += size;
    }
    firstPaint[page] = { js, css };
}

// --- lazy chunks and duplicates --------------------------------------------------

const lazy = [];
const holders = new Map(); // vendored source -> chunks holding it
for (const file of jsFiles) {
    const sources = await sourcesOf(file);
    const vendored = sources.filter((s) => s.includes('/lib/'));
    for (const s of vendored) {
        if (!holders.has(s)) holders.set(s, []);
        holders.get(s).push(file);
    }
    if (eager.has(file)) continue;
    const exempt = vendored.length > 0 || /^(media-worker|WhisperWorker)/.test(file);
    lazy.push({ file, gzip: await gz(path.join(assets, file)), exempt });
}
const duplicates = [...holders].filter(([, chunks]) => chunks.length > 1);

// --- media nothing names ---------------------------------------------------------

const MEDIA = /\.(mp4|webm|mov|mkv|mp3|wav)$/i;
const shipped = (await readdir(DIST)).filter((f) => MEDIA.test(f));
let corpus = '';
for (const f of [...PAGES.map((p) => `${p}.html`)]) corpus += await readFile(path.join(DIST, f), 'utf8');
for (const f of files.filter((f) => /\.(js|css)$/.test(f))) corpus += await readFile(path.join(assets, f), 'utf8');
const unusedMedia = shipped.filter((f) => !corpus.includes(f));

// --- totals ----------------------------------------------------------------------

const totals = {
    firstPaintJs: Object.fromEntries(PAGES.map((p) => [p, firstPaint[p].js])),
    css: Object.fromEntries(PAGES.map((p) => [p, firstPaint[p].css])),
    lazyBudgeted: lazy.filter((c) => !c.exempt).reduce((n, c) => n + c.gzip, 0),
    allJs: 0,
    duplicates: duplicates.length,
};
for (const file of jsFiles) totals.allJs += await gz(path.join(assets, file));

// --- report ----------------------------------------------------------------------

console.log('\nFirst paint (gzip)');
for (const page of PAGES) console.log(`  ${page.padEnd(8)} JS ${kb(firstPaint[page].js).padStart(9)}   CSS ${kb(firstPaint[page].css).padStart(9)}`);
console.log('\nLargest lazy chunks (gzip)');
for (const c of [...lazy].sort((a, b) => b.gzip - a.gzip).slice(0, 12)) {
    console.log(`  ${kb(c.gzip).padStart(9)}  ${c.file}${c.exempt ? '  (library, not budgeted)' : ''}`);
}
console.log(`\nAll JavaScript (gzip): ${kb(totals.allJs)}`);
console.log(`Vendored files in more than one chunk: ${duplicates.length}`);
for (const [source, chunks] of duplicates) console.log(`  ${source.replace(/^.*\/lib\//, 'lib/')}: ${chunks.join(', ')}`);
if (unusedMedia.length) console.log(`Media no page names: ${unusedMedia.join(', ')}`);

if (UPDATE) {
    await writeFile(BASELINE, JSON.stringify({ totals }, null, 2) + '\n');
    console.log('\nBaseline written.');
    process.exit(0);
}

const failures = [];
if (firstPaint.player.js > BUDGET.playerFirstPaintJs) failures.push(`player first-paint JS ${kb(firstPaint.player.js)} > ${kb(BUDGET.playerFirstPaintJs)}`);
if (firstPaint.player.css > BUDGET.playerCss) failures.push(`player CSS ${kb(firstPaint.player.css)} > ${kb(BUDGET.playerCss)}`);
for (const c of lazy) if (!c.exempt && c.gzip > BUDGET.lazyChunk) failures.push(`lazy chunk ${c.file} ${kb(c.gzip)} > ${kb(BUDGET.lazyChunk)}`);
if (unusedMedia.length) failures.push(`media no page names: ${unusedMedia.join(', ')}`);

// Duplicates: none allowed once fixed; until then, no more than recorded.
const baseline = existsSync(BASELINE) ? JSON.parse(await readFile(BASELINE, 'utf8')).totals : null;
if (baseline) {
    if (duplicates.length > baseline.duplicates) failures.push(`duplicated vendored files went up: ${baseline.duplicates} -> ${duplicates.length}`);
    const grew = (now, was, label) => {
        if (was && now > was * (1 + GROWTH_ALLOWED)) failures.push(`${label} grew more than ${GROWTH_ALLOWED * 100}%: ${kb(was)} -> ${kb(now)} (run with --update if intended)`);
    };
    for (const page of PAGES) grew(firstPaint[page].js, baseline.firstPaintJs?.[page], `${page} first-paint JS`);
    grew(totals.allJs, baseline.allJs, 'all JavaScript');
    console.log(`\nAgainst the baseline: all JS ${kb(baseline.allJs)} -> ${kb(totals.allJs)}, player first paint ${kb(baseline.firstPaintJs.player)} -> ${kb(firstPaint.player.js)}`);
} else if (duplicates.length > BUDGET.duplicates) {
    failures.push(`${duplicates.length} vendored files are in more than one chunk (BUG-13)`);
}

if (failures.length) {
    console.error('\nSize report failed:');
    for (const f of failures) console.error(`- ${f}`);
    process.exit(1);
}
console.log('\nSize report passed.');

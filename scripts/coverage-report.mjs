/**
 * How much of the app's own code the test suites run (ARCHITECTURE_PLAN.md,
 * K3). Reads the V8 coverage that `npm test` collects (run-tests.mjs: Node's
 * NODE_V8_COVERAGE for the Node suites, Chromium's for the browser suites),
 * merges it, and prints it per folder and in all. Coverage of the built app
 * is carried back to its source files through the source maps.
 *
 * Measured in characters of code (whitespace not counted), over every file
 * in assets/js outside lib/: a file no test loads counts as not covered.
 * Fails when the total drops more than one point below
 * scripts/coverage-baseline.json; `--update` records the current figure.
 *
 *   node scripts/coverage-report.mjs <dir> [--update]
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
const JS = path.join(ROOT, 'assets/js');
const BASELINE = path.join(ROOT, 'scripts/coverage-baseline.json');
const DIR = process.argv[2];
const UPDATE = process.argv.includes('--update');
const ALLOWED_DROP = 1;

if (!DIR || !existsSync(DIR)) {
    console.error('usage: node scripts/coverage-report.mjs <coverage dir> [--update]');
    process.exit(1);
}

async function walk(dir) {
    const out = [];
    for (const e of await readdir(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) { if (e.name !== 'lib') out.push(...await walk(full)); }
        else if (e.name.endsWith('.js')) out.push(full);
    }
    return out;
}

const DIST_ASSETS = path.join(ROOT, 'dist/assets');
const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** A source map's `mappings`, decoded: [genLine][i] = [genCol, source, origLine, origCol]. */
function decodeMappings(mappings) {
    const lines = [];
    let source = 0, origLine = 0, origCol = 0;
    for (const line of mappings.split(';')) {
        const segments = [];
        let genCol = 0;
        for (const seg of line.split(',')) {
            if (!seg) continue;
            const values = [];
            let value = 0, shift = 0;
            for (const ch of seg) {
                const digit = BASE64.indexOf(ch);
                value += (digit & 31) << shift;
                if (digit & 32) { shift += 5; continue; }
                values.push(value & 1 ? -(value >> 1) : value >> 1);
                value = 0; shift = 0;
            }
            genCol += values[0];
            if (values.length >= 4) {
                source += values[1]; origLine += values[2]; origCol += values[3];
                segments.push([genCol, source, origLine, origCol]);
            }
        }
        lines.push(segments);
    }
    return lines;
}

const lineStarts = (text) => {
    const starts = [0];
    for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
    return starts;
};

/** A built chunk's map, its sources as app files; cached. */
const bundles = new Map();
async function bundleFor(url) {
    const name = path.basename(new URL(url).pathname);
    if (bundles.has(name)) return bundles.get(name);
    let bundle = null;
    const file = path.join(DIST_ASSETS, name);
    if (existsSync(`${file}.map`)) {
        const map = JSON.parse(await readFile(`${file}.map`, 'utf8'));
        const code = await readFile(file, 'utf8');
        bundle = {
            starts: lineStarts(code),
            length: code.length,
            sources: map.sources.map((s) => path.resolve(DIST_ASSETS, map.sourceRoot ?? '', s)),
            lines: decodeMappings(map.mappings),
        };
    }
    bundles.set(name, bundle);
    return bundle;
}

/** Original files' line starts, for placing mapped positions. */
const origStarts = new Map();

/**
 * Coverage of a built chunk, carried back to the files it was built from:
 * each mapped stretch of a source line counts as run when the code it became
 * ran. Coarser than a source file's own coverage (a stretch, not a
 * character), close enough to see what the suites reach.
 */
function paintFromBundle(bundle, run) {
    for (let genLine = 0; genLine < bundle.lines.length; genLine++) {
        const segments = bundle.lines[genLine];
        for (const [genCol, src, origLine, origCol] of segments) {
            const at = bundle.starts[genLine] + genCol;
            if (at >= run.length || !run[at]) continue;
            const file = bundle.sources[src];
            if (!covered.has(file)) continue;
            if (!origStarts.has(file)) origStarts.set(file, lineStarts(sources.get(file)));
            const starts = origStarts.get(file);
            const start = starts[origLine] + origCol;
            const lineEnd = (starts[origLine + 1] ?? sources.get(file).length) - 1;
            // To the next mapped position on that original line, or its end.
            let end = lineEnd;
            for (const other of segments) {
                if (other[1] === src && other[2] === origLine && other[3] > origCol) end = Math.min(end, starts[origLine] + other[3]);
            }
            covered.get(file).fill(1, start, Math.max(start + 1, end));
        }
    }
}

/** A coverage URL as an app file, or null. */
function appFile(url) {
    let file = null;
    if (url.startsWith('file://')) file = fileURLToPath(url);
    else if (/^https?:\/\//.test(url)) {
        const { pathname } = new URL(url);
        file = path.join(ROOT, decodeURIComponent(pathname));
    }
    if (!file) return null;
    file = file.split('?')[0];
    return file.startsWith(JS + path.sep) && !file.includes(`${path.sep}lib${path.sep}`) ? file : null;
}

const sources = new Map(); // file -> text
const covered = new Map(); // file -> Uint8Array, 1 where some run executed it
for (const file of await walk(JS)) {
    const text = await readFile(file, 'utf8');
    sources.set(file, text);
    covered.set(file, new Uint8Array(text.length));
}

for (const name of await readdir(DIR)) {
    if (!name.endsWith('.json')) continue;
    let data;
    try { data = JSON.parse(await readFile(path.join(DIR, name), 'utf8')); } catch { continue; }
    for (const script of data.result ?? []) {
        const url = script.url ?? '';
        if (/^https?:\/\/[^/]+\/(?:.*\/)?assets\/[^/]+\.js(\?.*)?$/.test(url) && !url.includes('/assets/js/')) {
            const bundle = await bundleFor(url);
            if (!bundle) continue;
            const run = new Uint8Array(bundle.length);
            const ranges = script.functions.flatMap((f) => f.ranges)
                .sort((a, b) => a.startOffset - b.startOffset || b.endOffset - a.endOffset);
            for (const r of ranges) run.fill(r.count > 0 ? 1 : 0, r.startOffset, Math.min(r.endOffset, bundle.length));
            paintFromBundle(bundle, run);
            continue;
        }
        const file = appFile(url);
        if (!file || !covered.has(file)) continue;
        const length = sources.get(file).length;
        // Ranges nest: a block's count overrides the function around it. Painted
        // outermost first, so the innermost range has the last word.
        const ranges = script.functions.flatMap((f) => f.ranges)
            .sort((a, b) => a.startOffset - b.startOffset || b.endOffset - a.endOffset);
        const run = new Uint8Array(length);
        for (const r of ranges) run.fill(r.count > 0 ? 1 : 0, r.startOffset, Math.min(r.endOffset, length));
        const merged = covered.get(file);
        for (let i = 0; i < length; i++) if (run[i]) merged[i] = 1;
    }
}

const byFolder = new Map();
let totalCode = 0, totalCovered = 0;
for (const [file, text] of sources) {
    const hits = covered.get(file);
    let code = 0, done = 0;
    for (let i = 0; i < text.length; i++) {
        if (/\s/.test(text[i])) continue;
        code++;
        if (hits[i]) done++;
    }
    const rel = path.relative(JS, file).split(path.sep);
    const folder = rel.length > 2 ? `${rel[0]}/${rel[1]}` : rel.length === 2 ? rel[0] : '(pages)';
    const f = byFolder.get(folder) ?? { code: 0, done: 0 };
    f.code += code; f.done += done;
    byFolder.set(folder, f);
    totalCode += code; totalCovered += done;
}

const pct = (d, c) => (c ? (100 * d) / c : 0);
const total = Math.round(pct(totalCovered, totalCode) * 10) / 10;
console.log('\nCoverage of assets/js (characters of code run by the suites)');
for (const [folder, f] of [...byFolder].sort((a, b) => b[1].code - a[1].code)) {
    console.log(`  ${pct(f.done, f.code).toFixed(1).padStart(5)}%  ${folder}`);
}
console.log(`\nTotal: ${total}%`);

if (UPDATE) {
    await writeFile(BASELINE, JSON.stringify({ total }, null, 2) + '\n');
    console.log('Baseline written.');
    process.exit(0);
}
if (existsSync(BASELINE)) {
    const { total: was } = JSON.parse(await readFile(BASELINE, 'utf8'));
    console.log(`Baseline: ${was}%`);
    if (total < was - ALLOWED_DROP) {
        console.error(`Coverage dropped more than ${ALLOWED_DROP} point: ${was}% -> ${total}%`);
        process.exit(1);
    }
}

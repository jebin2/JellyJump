/**
 * Architecture guard rails (ARCHITECTURE_PLAN.md, wave 0, steps B1 and B2).
 *
 * Two kinds of check, both ratchets: today's state is written down in
 * scripts/architecture-baseline.json, and a change may make things better
 * but not worse.
 *
 * 1. Layers. A folder under assets/js/ may only import from the layers below
 *    it (§3.1 of the plan):
 *
 *        pages (assets/js/*.js) → ui → core, processing → shared → lib
 *
 *    core and processing may not import each other. Every import that breaks
 *    this today is listed in the baseline, file by file; a new one fails,
 *    and one that is fixed must come off the list (so the list only shrinks).
 *
 * 2. Counts of things the plan removes: calls into the player's and the
 *    playlist's private members from outside them, files touching
 *    localStorage, files checking for Electron directly, and files writing
 *    out an outside service's address (they belong in shared/config/services.js). A count may go
 *    down (lower it in the baseline when it does) but not up.
 *
 *   node scripts/architecture-check.mjs            check
 *   node scripts/architecture-check.mjs --update   write today's state as the baseline
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const JS = path.join(ROOT, 'assets/js');
const BASELINE = path.join(ROOT, 'scripts/architecture-baseline.json');
const UPDATE = process.argv.includes('--update');

/** Which layers each layer may import from (itself always allowed). */
const ALLOWED = {
    pages: ['ui', 'core', 'processing', 'shared', 'lib'],
    ui: ['core', 'processing', 'shared', 'lib'],
    core: ['shared', 'lib'],
    processing: ['shared', 'lib'],
    shared: ['lib'],
    lib: [],
};

async function walk(dir) {
    const out = [];
    for (const entry of await readdir(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...await walk(full));
        else if (entry.name.endsWith('.js')) out.push(full);
    }
    return out;
}

/** @param {string} file absolute path under assets/js */
function layerOf(file) {
    const rel = path.relative(JS, file).split(path.sep);
    if (rel.length === 1) return 'pages';
    return rel[0] in ALLOWED ? rel[0] : 'pages';
}

const IMPORT = /(?:\bfrom\s*|\bimport\s*\(\s*|^\s*import\s+)['"]([^'"]+)['"]/gm;

const files = (await walk(JS)).filter((f) => !f.includes(`${path.sep}lib${path.sep}`));
const rel = (f) => path.relative(JS, f).split(path.sep).join('/');

// --- 1. layers ---------------------------------------------------------------

/** @type {string[]} "from.js -> to.js" */
const wrongWay = [];
for (const file of files) {
    const source = await readFile(file, 'utf8');
    const from = layerOf(file);
    for (const match of source.matchAll(IMPORT)) {
        const spec = match[1];
        if (!spec.startsWith('.')) continue; // packages
        const target = path.resolve(path.dirname(file), spec);
        if (!target.startsWith(JS)) continue;
        const to = layerOf(target);
        if (to === from || ALLOWED[from].includes(to)) continue;
        wrongWay.push(`${rel(file)} -> ${rel(target)}`);
    }
}
wrongWay.sort();

// --- 2. counts ----------------------------------------------------------------

const PLAYER_FILE = 'core/Player.js';
const isPlaylistPart = (r) => /^ui\/player\/Playlist[A-Za-z]*\.js$/.test(r);

/** `player._x`, `this.player._x`, `….player._x`, and `p._x` where p is the player by convention. */
const PLAYER_PRIVATE = /(?:\bplayer|\bp)\._[A-Za-z]\w*/g;
const PLAYLIST_PRIVATE = /\bplaylist\._[A-Za-z]\w*/g;

const counts = { playerPrivateCalls: 0, playlistPrivateCalls: 0, localStorageFiles: 0, directElectronChecks: 0, externalUrlFiles: 0 };
for (const file of files) {
    const r = rel(file);
    const source = (await readFile(file, 'utf8'))
        .split('\n').filter((line) => !/^\s*(\/\/|\*)/.test(line)).join('\n');
    if (r !== PLAYER_FILE) counts.playerPrivateCalls += (source.match(PLAYER_PRIVATE) ?? []).length;
    if (!isPlaylistPart(r)) counts.playlistPrivateCalls += (source.match(PLAYLIST_PRIVATE) ?? []).length;
    if (/\blocalStorage\b/.test(source)) counts.localStorageFiles++;
    if (r !== 'shared/utils/ElectronHelper.js' && /window\.electronAPI/.test(source)) counts.directElectronChecks++;
    // An outside address written out anywhere but the services list (comments excepted).
    if (r !== 'shared/config/services.js' && /['"`]https?:\/\/(?!localhost|127\.0\.0\.1)[a-z0-9.-]+\.[a-z]{2,}/i.test(source)) counts.externalUrlFiles++;
}

// --- compare -------------------------------------------------------------------

if (UPDATE) {
    await writeFile(BASELINE, JSON.stringify({ counts, wrongWayImports: wrongWay }, null, 2) + '\n');
    console.log(`Architecture baseline written: ${wrongWay.length} wrong-way imports, counts ${JSON.stringify(counts)}`);
    process.exit(0);
}

const baseline = JSON.parse(await readFile(BASELINE, 'utf8'));
const failures = [];
const notes = [];

const known = new Set(baseline.wrongWayImports);
for (const imp of wrongWay) {
    if (!known.has(imp)) failures.push(`new wrong-way import: ${imp} (see ARCHITECTURE_PLAN.md §3.1)`);
}
const now = new Set(wrongWay);
for (const imp of baseline.wrongWayImports) {
    if (!now.has(imp)) failures.push(`fixed, so take it off the baseline: ${imp} (run with --update)`);
}

for (const [name, value] of Object.entries(counts)) {
    const was = baseline.counts[name];
    if (value > was) failures.push(`${name} went up: ${was} -> ${value}`);
    else if (value < was) notes.push(`${name} went down: ${was} -> ${value} (lower the baseline: run with --update)`);
}

const summary = `wrong-way imports ${wrongWay.length}, `
    + Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', ');

if (failures.length) {
    console.error('Architecture check failed:');
    for (const f of failures) console.error(`- ${f}`);
    console.error(`Now: ${summary}`);
    process.exit(1);
}
for (const n of notes) console.log(`note: ${n}`);
console.log(`Architecture check passed (${summary}).`);

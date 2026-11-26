/**
 * Tests the pages' Content-Security-Policy (assets/js/shared/config/csp.js):
 * every page takes it from there, it keeps the rules that matter, and the
 * built pages carry it.
 *
 *   node scripts/csp-test.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { cspFor, CSP_PAGES } from '../assets/js/shared/config/csp.js';

const ROOT = join(import.meta.dirname, '..');
let pass = 0, fail = 0;
const check = (ok, label) => {
    if (ok) { pass++; console.log(`  PASS  ${label}`); }
    else { fail++; console.log(`  FAIL  ${label}`); }
};
const directives = (csp) => Object.fromEntries(csp.split(';').map((d) => d.trim().split(/\s+/)).map(([k, ...v]) => [k, v]));
const metaOf = (html) => /http-equiv="Content-Security-Policy"\s+content="([^"]*)"/.exec(html)?.[1];

console.log('\nevery page takes its policy from csp.js');
for (const page of CSP_PAGES) {
    const source = readFileSync(join(ROOT, `${page}.html`), 'utf8');
    check(metaOf(source) === '%JJ_CSP%', `${page}.html has the placeholder, not a policy of its own`);
}

console.log('\nthe rules');
for (const page of CSP_PAGES) {
    const d = directives(cspFor(page));
    const scripts = d['script-src'] ?? [];
    check(!scripts.includes("'unsafe-eval'") && !scripts.includes("'unsafe-inline'") && !scripts.includes('*') && !scripts.includes('https:'),
        `${page}: scripts only from the site (and named services), never inline or eval`);
    check(d['object-src']?.join() === "'none'" && d['base-uri']?.join() === "'self'", `${page}: no plugins, no <base> elsewhere`);
}
for (const page of ['player', 'embed']) {
    const d = directives(cspFor(page));
    check(d['frame-src']?.every((s) => /youtube/.test(s)), `${page}: frames only for YouTube's player`);
}
check(!directives(cspFor('dashboard'))['frame-src'] && !directives(cspFor('watch'))['frame-src'], 'the landing and watch pages allow no frames from elsewhere (the landing page shows the demo in its own embed page)');
check(!directives(cspFor('watch'))['script-src'].includes("'wasm-unsafe-eval'"), 'the watch page runs no WebAssembly');
let threw = false;
try { cspFor('nope'); } catch { threw = true; }
check(threw, 'a page without a policy is an error, not an empty policy');

console.log('\nthe built pages');
if (existsSync(join(ROOT, 'dist/player.html'))) {
    for (const page of CSP_PAGES) {
        const built = readFileSync(join(ROOT, `dist/${page}.html`), 'utf8');
        check(metaOf(built) === cspFor(page), `dist/${page}.html carries its policy`);
    }
} else {
    console.log('  (no dist/: run npm run build to check the built pages)');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

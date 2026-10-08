/**
 * Every token a stylesheet reaches for has to exist.
 *
 * `border: 1px solid var(--border-light)` with no --border-light declared is
 * not a fallback to something sensible: the declaration is invalid at
 * computed-value time and the border is simply not drawn. It fails in silence,
 * which is why eighteen tokens went missing here without anybody noticing --
 * the modals had no edges, the menu dividers no line, and every
 * rgba(var(--accent-primary-rgb), …) tint was absent rather than faint.
 *
 * So: no var() without a fallback may name a token that is never declared.
 * A var() that does carry a fallback is a deliberate default and is left alone.
 *
 *   node scripts/css-token-test.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const CSS = resolve(import.meta.dirname, '../assets/css');
let pass = 0, fail = 0;
const check = (ok, label) => { if (ok) { pass++; console.log(`  PASS  ${label}`); } else { fail++; console.log(`  FAIL  ${label}`); } };

const files = readdirSync(CSS).filter(f => f.endsWith('.css')).sort();
const sources = files.map(f => [f, readFileSync(join(CSS, f), 'utf8')]);

// Declared anywhere, because these sheets are loaded together.
const declared = new Set();
for (const [, text] of sources) {
    for (const m of text.matchAll(/(--[A-Za-z0-9-]+)\s*:/g)) declared.add(m[1]);
}

const missing = [];
for (const [file, text] of sources) {
    for (const m of text.matchAll(/var\(\s*(--[A-Za-z0-9-]+)\s*(,)?/g)) {
        if (m[2] || declared.has(m[1])) continue;
        missing.push(`${file}:${text.slice(0, m.index).split('\n').length} ${m[1]}`);
    }
}
check(missing.length === 0,
    missing.length === 0
        ? `every token used without a fallback is declared (${files.length} stylesheets, ${declared.size} tokens)`
        : `${missing.length} use(s) of a token nothing declares:\n        ${missing.join('\n        ')}`);

// The two that cost the most when they were missing, named so a rename cannot
// quietly take them away again.
const theme = sources.find(([f]) => f === 'theme.css')[1];
for (const token of ['--border-light', '--border-color', '--bg-hover', '--accent-primary-rgb',
    '--error-color', '--success-color', '--warning-color', '--radius-sm']) {
    check(new RegExp(`${token}\\s*:`).test(theme), `theme.css declares ${token}`);
}

// rgba() needs components, not a colour: rgba(#00ff88, .1) is not a colour.
const rgb = theme.match(/--accent-primary-rgb\s*:\s*([^;]+);/)?.[1].trim();
check(/^\d{1,3},\s*\d{1,3},\s*\d{1,3}$/.test(rgb || ''),
    `--accent-primary-rgb is three components, usable inside rgba() (${rgb})`);
// And the same green, or the tints are a different colour from the thing they tint.
const accent = theme.match(/--accent-primary\s*:\s*(#[0-9a-fA-F]{6})/)?.[1];
const asHex = '#' + (rgb || '').split(',')
    .map(n => Number(n).toString(16).padStart(2, '0')).join('');
check(accent && asHex.toLowerCase() === accent.toLowerCase(),
    `and it is --accent-primary itself (${asHex} vs ${accent})`);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);

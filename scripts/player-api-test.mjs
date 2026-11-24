/**
 * CorePlayer's public members are the ones ARCHITECTURE_PLAN.md §4.1 lists
 * (plan I2). A method or accessor added to the class without a line in §4.1
 * fails here, and so does a §4.1 entry the player does not have (unless it is
 * marked "(planned" in its note), so the document and the code cannot drift apart.
 *
 * Read from the source rather than by importing the player, which loads
 * MediaBunny and needs a browser. Public means a method or accessor on the
 * class whose name does not start with `_`; fields set in the constructor
 * count as having a §4.1 member (`currentTime`, `canvas`, the layers), but
 * not every field is API, so only the class's methods and accessors must be
 * listed.
 *
 *   node scripts/player-api-test.mjs
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const source = await readFile(join(ROOT, 'assets/js/core/Player.js'), 'utf8');
const plan = await readFile(join(ROOT, 'docs/ARCHITECTURE_PLAN.md'), 'utf8');

let pass = 0, fail = 0;
const check = (ok, label) => {
    if (ok) { pass++; console.log(`  PASS  ${label}`); }
    else { fail++; console.log(`  FAIL  ${label}`); }
};

// --- the class: methods and accessors, at the class body's indent ------------
const body = source.slice(source.indexOf('export class CorePlayer'));
const MEMBER = /^ {4}(?:static\s+)?(?:async\s+)?(?:get\s+|set\s+)?([A-Za-z_$][\w$]*)\s*\(/gm;
const KEYWORDS = new Set(['constructor', 'if', 'for', 'while', 'switch', 'catch', 'return']);
const members = new Set();
for (const [, name] of body.matchAll(MEMBER)) {
    if (!KEYWORDS.has(name) && !name.startsWith('_')) members.add(name);
}
const fields = new Set([...source.matchAll(/\bthis\.([A-Za-z$][\w$]*)\s*=(?!=)/g)].map(m => m[1]));

// --- §4.1: the backticked names in the table's member column -----------------
const start = plan.indexOf('### 4.1 `CorePlayer`');
const section = plan.slice(start, plan.indexOf('\n### ', start + 1));
const documented = new Map();   // name -> planned?
for (const row of section.split('\n').filter(l => /^\| [A-Z]/.test(l) && !l.startsWith('| Area'))) {
    const cell = row.split('|')[2] ?? '';
    // Each entry is a `name(...)` or `name`, optionally followed by a
    // parenthesised note, which may itself hold backticked words (those are
    // not members); a note starting "(planned" marks one not built yet.
    const entries = [];
    let depth = 0;
    for (let i = 0; i < cell.length; i++) {
        const c = cell[i];
        if (c === '`') {
            const end = cell.indexOf('`', i + 1);
            const name = cell.slice(i + 1, end).match(/^[A-Za-z$][\w$]*/)?.[0];
            if (depth === 0 && name) entries.push({ name, note: '' });
            i = end;
        } else {
            if (c === '(') depth++;
            if (c === ')') depth--;
            if (entries.length) entries[entries.length - 1].note += c;
        }
    }
    for (const { name, note } of entries) documented.set(name, /\(planned\b/.test(note));
}

console.log(`\nCorePlayer has ${members.size} public methods and accessors; §4.1 lists ${documented.size} names`);
check(members.size > 30 && documented.size > 30, 'both sides were read (the parsers found something)');

console.log('\nevery public method and accessor is in §4.1');
for (const name of [...members].sort()) {
    check(documented.has(name), `${name}${documented.has(name) ? '' : ' -- add it to §4.1, or make it private'}`);
}

console.log('\neverything §4.1 lists exists (or is marked planned)');
for (const [name, planned] of [...documented].sort()) {
    if (planned) {
        check(!members.has(name), `${name} is planned${members.has(name) ? ' -- it exists now; drop "(planned)"' : ''}`);
        continue;
    }
    const exists = members.has(name) || fields.has(name);
    check(exists, `${name}${exists ? '' : ' -- not on CorePlayer; remove it from §4.1 or mark it (planned)'}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

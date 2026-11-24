/**
 * Holds a class's public members to the table that lists them in
 * ARCHITECTURE_PLAN.md §4 (plan I2, T6). Shared by player-api-test and
 * playlist-api-test.
 *
 * - Every public method and accessor (a name not starting with `_`, at the
 *   class body's indent) must be in the table, or be made private.
 * - Everything the table lists must exist, as a member or as a field set
 *   with `this.x =`, unless its note starts "(planned".
 * - Every public member has a JSDoc comment ending on the line above it (a
 *   setter is covered by its getter's), and every file starts with
 *   `// @ts-check`, so the documentation is checked as well as present.
 *
 * Read from the source rather than by importing it: the player loads
 * MediaBunny and needs a browser.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const KEYWORDS = new Set(['constructor', 'if', 'for', 'while', 'switch', 'catch', 'return']);

/** The backticked names in a §4 table's member column; name -> planned? */
function readTable(section) {
    const documented = new Map();
    for (const row of section.split('\n').filter(l => /^\| [A-Z]/.test(l) && !l.startsWith('| Area'))) {
        const cell = row.split('|')[2] ?? '';
        // Each entry is a `name(...)` or `name`, optionally followed by a
        // parenthesised note, which may itself hold backticked words (those
        // are not members); a note starting "(planned" marks one not built.
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
    return documented;
}

/**
 * @param {{ title: string, heading: string, minMembers: number,
 *   files: {path: string, start: string}[] }} spec
 *   `heading`: the §4 heading line; `files`: each source file and the text
 *   its member list starts after (`export class X`, `export const X = {`)
 */
export async function checkApiListing({ title, heading, minMembers, files }) {
    let pass = 0, fail = 0;
    const check = (ok, label) => {
        if (ok) { pass++; console.log(`  PASS  ${label}`); }
        else { fail++; console.log(`  FAIL  ${label}`); }
    };

    const members = new Set();
    const undocumented = new Set();
    const fields = new Set();
    const unchecked = [];
    for (const { path, start } of files) {
        const source = await readFile(join(ROOT, path), 'utf8');
        if (!source.startsWith('// @ts-check')) unchecked.push(path);
        for (const m of source.matchAll(/\bthis\.([A-Za-z$][\w$]*)\s*=(?!=)/g)) fields.add(m[1]);
        const lines = source.slice(source.indexOf(start)).split('\n');
        lines.forEach((line, i) => {
            const m = line.match(/^ {4}(?:static\s+)?(?:async\s+)?(?:(get|set)\s+)?([A-Za-z_$][\w$]*)\s*\(/);
            if (!m || KEYWORDS.has(m[2]) || m[2].startsWith('_')) return;
            members.add(m[2]);
            const above = lines[i - 1] ?? '';
            const coveredByGetter = m[1] === 'set' && new RegExp(`^ {4}get\\s+${m[2]}\\b`).test(above);
            if (!above.trim().endsWith('*/') && !coveredByGetter) undocumented.add(m[2]);
        });
    }

    const plan = await readFile(join(ROOT, 'docs/ARCHITECTURE_PLAN.md'), 'utf8');
    const at = plan.indexOf(heading);
    const documented = at === -1 ? new Map() : readTable(plan.slice(at, plan.indexOf('\n### ', at + 1)));

    console.log(`\n${title} has ${members.size} public methods and accessors; ${heading.replace(/^#+ /, '')} lists ${documented.size} names`);
    check(members.size >= minMembers && documented.size >= minMembers, 'both sides were read (the parsers found something)');

    console.log('\nevery public method and accessor is in the table');
    for (const name of [...members].sort()) {
        check(documented.has(name), `${name}${documented.has(name) ? '' : ' -- add it to the table, or make it private'}`);
    }

    console.log('\nevery public member has a JSDoc comment, and the files are type-checked');
    for (const { path } of files) check(!unchecked.includes(path), `${path} starts with // @ts-check`);
    for (const name of [...members].sort()) {
        check(!undocumented.has(name), `${name}${undocumented.has(name) ? ' -- add a JSDoc comment on the line above it' : ' is documented'}`);
    }

    console.log('\neverything the table lists exists (or is marked planned)');
    for (const [name, planned] of [...documented].sort()) {
        if (planned) {
            check(!members.has(name), `${name} is planned${members.has(name) ? ' -- it exists now; drop "(planned)"' : ''}`);
            continue;
        }
        const exists = members.has(name) || fields.has(name);
        check(exists, `${name}${exists ? '' : ` -- not on ${title}; remove it from the table or mark it (planned)`}`);
    }

    console.log(`\n${pass} passed, ${fail} failed`);
    return fail;
}

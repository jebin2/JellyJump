/**
 * Every <template> the code asks for exists, and a tool's own templates are
 * loaded with it (ARCHITECTURE_PLAN.md, F4).
 *
 * Templates live in public/assets/templates/ (fetched when the player starts)
 * or in ui/menus/templates/ (imported by the tool that uses them, and
 * installed when its code loads). A template id asked for that is in
 * neither, or in a tool file the asking module does not import, is a tool
 * that opens empty — found here instead of by a user.
 *
 *   node scripts/template-test.mjs
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const JS = path.join(ROOT, 'assets/js');
let pass = 0, fail = 0;
const check = (ok, label) => {
    if (ok) { pass++; console.log(`  PASS  ${label}`); }
    else { fail++; console.log(`  FAIL  ${label}`); }
};

async function walk(dir, ext) {
    const out = [];
    for (const e of await readdir(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) { if (e.name !== 'lib') out.push(...await walk(full, ext)); }
        else if (e.name.endsWith(ext)) out.push(full);
    }
    return out;
}
const idsIn = (html) => [...html.matchAll(/<template id="([^"]+)"/g)].map((m) => m[1]);

/** id -> the file that defines it */
const startup = new Map();
for (const f of await walk(path.join(ROOT, 'public/assets/templates'), '.html')) {
    for (const id of idsIn(await readFile(f, 'utf8'))) startup.set(id, path.relative(ROOT, f));
}
const tool = new Map();
for (const f of await walk(path.join(JS, 'ui/menus/templates'), '.html')) {
    for (const id of idsIn(await readFile(f, 'utf8'))) tool.set(id, f);
}

console.log('\nno template is defined twice');
const both = [...tool.keys()].filter((id) => startup.has(id));
check(both.length === 0, `none in both the startup and a tool file${both.length ? `: ${both}` : ''}`);

console.log('\nevery template asked for exists, and is loaded with its tool');
let asked = 0;
for (const file of await walk(JS, '.js')) {
    const source = await readFile(file, 'utf8');
    const ids = new Set([...source.matchAll(/['"`#]([a-z0-9-]+-template)['"`]/g)].map((m) => m[1]));
    for (const id of ids) {
        asked++;
        const rel = path.relative(JS, file);
        if (startup.has(id)) continue;
        if (!tool.has(id)) { check(false, `${rel} asks for "${id}", which no file defines`); continue; }
        const def = tool.get(id);
        const spec = path.relative(path.dirname(file), def).split(path.sep).join('/');
        const imported = source.includes(`${spec}?raw'`) || source.includes(`./${spec}?raw'`);
        check(imported, `${rel} loads ${path.basename(def)} for "${id}"`);
    }
}
check(asked > 40, `the check found the templates asked for (${asked})`);

console.log('\nevery tool template is used');
const allSource = (await Promise.all((await walk(JS, '.js')).map((f) => readFile(f, 'utf8')))).join('\n');
const unused = [...tool.keys(), ...startup.keys()].filter((id) => !allSource.includes(id));
check(unused.length === 0, `no template is left unused${unused.length ? `: ${unused}` : ''}`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

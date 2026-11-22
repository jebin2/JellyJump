/**
 * Tests the desktop app's copies folder (desktop/copies.js): a copy written
 * in chunks reads back whole, is found by item id, can only ever be inside
 * the folder, and a copy cut short never takes the real name.
 *
 *   node scripts/desktop-copies-test.mjs
 */
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { createCopies } = require('../desktop/copies.js');

let pass = 0, fail = 0;
const check = (ok, label) => {
    if (ok) { pass++; console.log(`  PASS  ${label}`); }
    else { fail++; console.log(`  FAIL  ${label}`); }
};
const throws = async (fn) => { try { await fn(); return false; } catch { return true; } };

const root = mkdtempSync(join(tmpdir(), 'jj-copies-'));
const dir = join(root, 'copies');
const copies = createCopies({ dir });
const ID = '0f8e7d6c-1234-4abc-9def-001122334455';

try {
    console.log('\nwriting a copy in chunks');
    await copies.begin(ID, 'holiday-edited.mp4');
    await copies.write(ID, new Uint8Array([1, 2, 3]).buffer);
    await copies.write(ID, new Uint8Array([4, 5]).buffer);
    const path = await copies.finish(ID);
    check(path === join(dir, `${ID}__holiday-edited.mp4`), `named after its item and its name (${path.split('/').pop()})`);
    check(readFileSync(path).equals(Buffer.from([1, 2, 3, 4, 5])), 'its bytes read back whole, in order');
    check(await copies.find(ID) === path, 'found by its item id');
    check((await copies.ids()).join() === ID, 'listed by item id (ids have dashes; the name does not confuse it)');
    check(copies.contains(path) && !copies.contains(join(root, 'elsewhere.mp4')), 'the folder knows its own files, and only those');

    console.log('\nwriting it again');
    await copies.begin(ID, 'holiday-edited-2.mp4');
    await copies.write(ID, new Uint8Array([9]).buffer);
    const again = await copies.finish(ID);
    check(!existsSync(path) && readFileSync(again).equals(Buffer.from([9])), 'replaces the old one (one copy per item)');

    console.log('\na copy cut short');
    const other = '11111111-2222-4333-8444-555555555555';
    await copies.begin(other, 'big.mp4');
    await copies.write(other, new Uint8Array([7]).buffer);
    check(await copies.find(other) === null, 'is not found while it is being written');
    await copies.abort(other);
    check(!readdirSync(dir).some((n) => n.startsWith(other)), 'and leaves nothing when abandoned');
    writeFileSync(join(dir, `${other}__crash.mp4.part`), 'x');
    await copies.sweepPartial();
    check(!readdirSync(dir).some((n) => n.endsWith('.part')), 'a part left by a crash is swept on start');

    console.log('\nonly this folder, only by id');
    check(await throws(() => copies.begin('../../etc/passwd', 'x')), 'an id with a path in it is refused');
    check(await throws(() => copies.remove('*')), 'so is a pattern');
    await copies.begin('a1', '../../outside.mp4');
    const named = await copies.finish('a1');
    check(named === join(dir, 'a1__outside.mp4'), `a name cannot leave the folder (${named.split('/').pop()})`);
    check(await throws(() => copies.write('never-begun', new ArrayBuffer(1))), 'writing a copy that was not begun fails');

    console.log('\ndeleting');
    check(await copies.remove(ID) === true && await copies.find(ID) === null, 'deletes the item\'s copy');
    check(await copies.remove(ID) === false, 'deleting one that is not there is fine');
} finally {
    rmSync(root, { recursive: true, force: true });
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

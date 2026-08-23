/**
 * Tests what the scanner does with link-list files, and — more importantly —
 * what it does with every other text file on a media drive.
 *
 * The drive this was written for holds github-recovery-codes.txt and
 * discord_backup_codes.txt beside the videos. Any rule that opens text files to
 * see whether they are interesting opens those, and anything the scanner puts
 * in its index can be fetched over a share link by id. So this asserts the
 * absence of things, which is the half that matters.
 *
 *   node scripts/linklist-scan-test.mjs
 */
import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);

let pass = 0, fail = 0;
const check = (ok, label, detail = '') => {
    if (ok) { pass++; console.log(`  PASS  ${label}`); }
    else { fail++; console.log(`  FAIL  ${label}  ${detail}`); }
};

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-scan-'));
const SECRET = 'secret-recovery-code-do-not-read';
fs.writeFileSync(path.join(root, 'github-recovery-codes.txt'), SECRET);
fs.writeFileSync(path.join(root, 'discord_backup_codes.txt'), SECRET);
fs.writeFileSync(path.join(root, 'notes.txt'), SECRET);
fs.writeFileSync(path.join(root, 'youtube_links.jjlist'),
    'Song One : https://youtu.be/8scL5oJX6CM\nhttps://www.youtube.com/watch?v=1PukR-byRZg\n');

const events = [];
const port = new EventEmitter();
port.postMessage = (m) => events.push(m);
process.parentPort = port;
require('../desktop/scanner.js');
port.emit('message', { data: { type: 'scan', roots: [root] } });

await new Promise((resolve) => {
    const started = Date.now();
    const wait = () => {
        if (events.some(e => e.type === 'done') || Date.now() - started > 15000) return resolve();
        setTimeout(wait, 100);
    };
    wait();
});

const lists = events.filter(e => e.type === 'linklist');
const indexed = events.filter(e => e.type === 'batch').flatMap(e => e.files);

console.log('\nthe link list is found and its text carried');
check(lists.length === 1, 'exactly one link list emitted', String(lists.length));
check(lists[0]?.file?.name === 'youtube_links.jjlist', 'named correctly');
check((lists[0]?.file?.text || '').includes('8scL5oJX6CM'), 'with its contents');

console.log('\nand nothing else on the drive is opened or indexed');
const serialised = JSON.stringify(events);
check(!serialised.includes(SECRET), 'no text file contents appear in any event');
check(!indexed.some(f => f.name.endsWith('.txt')), 'no .txt file is indexed as media');
check(!indexed.some(f => f.name.endsWith('.jjlist')),
    'the link list itself is not indexed — the index is the sharing allowlist');

fs.rmSync(root, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

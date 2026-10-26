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

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-subs-'));
const nested = path.join(root, 'Series');
fs.mkdirSync(nested);

for (const name of ['ep1.mp4', 'ep2.mp4', 'ep3.mp4', 'ep10.mp4']) {
    fs.writeFileSync(path.join(root, name), Buffer.from('video'));
}
fs.writeFileSync(path.join(root, 'ep1.srt'), '1\n00:00:00,000 --> 00:00:01,000\none\n');
fs.writeFileSync(path.join(root, 'ep2.en.srt'), '1\n00:00:00,000 --> 00:00:01,000\ntwo\n');
fs.writeFileSync(path.join(root, 'ep2.SRT'), '1\n00:00:00,000 --> 00:00:01,000\ntwo again\n');
fs.writeFileSync(path.join(root, 'ep3.vtt'), 'WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nthree\n');
fs.writeFileSync(path.join(root, 'ep10.srt'), '1\n00:00:00,000 --> 00:00:01,000\nten\n');
fs.writeFileSync(path.join(root, 'unrelated.srt'), '1\n00:00:00,000 --> 00:00:01,000\nnone\n');
fs.writeFileSync(path.join(nested, 'nested.mkv'), Buffer.from('video'));
fs.writeFileSync(path.join(nested, 'nested.fr.srt'), '1\n00:00:00,000 --> 00:00:01,000\nfr\n');

const events = [];
const port = new EventEmitter();
port.postMessage = (message) => events.push(message);
process.parentPort = port;
require('../desktop/scanner.js');
port.emit('message', { data: { type: 'scan', roots: [root] } });

await new Promise((resolve) => {
    const started = Date.now();
    const wait = () => {
        if (events.some((event) => event.type === 'done') || Date.now() - started > 15000) return resolve();
        setTimeout(wait, 100);
    };
    wait();
});

const indexed = events.filter((event) => event.type === 'batch').flatMap((event) => event.files);
const byName = new Map(indexed.map((file) => [file.name, file]));
const subtitlesFor = (name) => (byName.get(name)?.subtitles || []).map((subtitle) => subtitle.name).sort();

console.log('\nsidecar subtitles are attached to their video');
check(subtitlesFor('ep1.mp4').join(',') === 'ep1.srt', 'an exact-name sidecar matches');
check(subtitlesFor('ep2.mp4').join(',') === 'ep2.SRT,ep2.en.srt', 'language suffixes and case variants match');
check(subtitlesFor('ep3.mp4').join(',') === 'ep3.vtt', 'WebVTT sidecars match');
check(subtitlesFor('ep10.mp4').join(',') === 'ep10.srt', 'a longer basename does not match a shorter one');
check(subtitlesFor('ep1.mp4').join(',') !== 'ep1.srt,ep10.srt', 'and is not inherited by the shorter one');
check(subtitlesFor('nested.mkv').join(',') === 'nested.fr.srt', 'siblings in a subfolder match');
check(subtitlesFor('unrelated.srt').length === 0, 'the unrelated subtitle is not attached');

console.log('\nand are not exposed as videos of their own');
check(indexed.length === 5, `only videos are indexed (${indexed.length})`);
check(!indexed.some((file) => file.ext === '.srt' || file.ext === '.vtt'),
    'no subtitle is emitted as a top-level file');
const allSidecars = indexed.flatMap((file) => file.subtitles || []);
check(allSidecars.every((subtitle) => subtitle.path && subtitle.size > 0),
    'every attached sidecar carries a path and a size');
check(!JSON.stringify(indexed).includes('-->'), 'subtitle contents are not read during the scan');

fs.rmSync(root, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

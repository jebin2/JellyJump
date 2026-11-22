/**
 * Tests what the desktop window may read from disk (desktop/read-grants.js):
 * files the user picked, files the scan found or covers, their subtitles,
 * and nothing else — not every media file on the disk.
 *
 *   node scripts/read-grants-test.mjs
 */
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { createReadGrants } = require('../desktop/read-grants.js');

let pass = 0, fail = 0;
const check = (ok, label) => {
    if (ok) { pass++; console.log(`  PASS  ${label}`); }
    else { fail++; console.log(`  FAIL  ${label}`); }
};

const dir = mkdtempSync(join(tmpdir(), 'jj-grants-'));
const touch = (...parts) => { const p = join(dir, ...parts); mkdirSync(join(p, '..'), { recursive: true }); writeFileSync(p, ''); return p; };
const index = (paths = [], roots = []) => ({ hasPath: (p) => paths.includes(p), getRoots: () => roots });

try {
    const picked = touch('picked', 'movie.mp4');
    const pickedSrt = touch('picked', 'movie.srt');
    const pickedLangSrt = touch('picked', 'movie.en.srt');
    const otherSrt = touch('picked', 'other.srt');
    const photo = touch('photos', 'private.jpg');
    const key = touch('home', '.ssh', 'id_ed25519');
    const scanned = touch('library', 'show.mkv');
    const addedSince = touch('library', 'new.mp4');
    const notMedia = touch('library', 'notes.txt');
    const inOld = touch('old', 'kept.mp4');
    const file = join(dir, 'state', 'read-grants.json');
    const configPath = touch('state', 'jellyjump.json');
    writeFileSync(configPath, JSON.stringify({ playlist: [{ localPath: inOld }, { localPath: key }] }));

    console.log('\nthe first run keeps the playlist that was there');
    let grants = createReadGrants({ file, configPath, index: index() });
    check(grants.allows(inOld), 'a video already in the playlist stays readable');
    check(!grants.allows(key), 'but not a file that is not media, whatever the playlist says');

    console.log('\nwhat the user picked');
    check(!grants.allows(picked), 'a video not picked is not readable, media or not');
    check(!grants.allows(photo), 'a photo elsewhere on the disk is not readable');
    grants.grant([picked]);
    check(grants.allows(picked), 'once picked, it is');
    grants = createReadGrants({ file, configPath, index: index() });
    check(grants.allows(picked), 'and still is after a restart');
    check(grants.allows(inOld), 'as is what the first run kept');
    check(JSON.parse(readFileSync(file, 'utf8')).paths.length === 2, 'kept in a file of its own');

    console.log('\nsubtitles beside a readable video');
    check(grants.allows(pickedSrt) && grants.allows(pickedLangSrt), 'movie.srt and movie.en.srt beside movie.mp4');
    check(!grants.allows(otherSrt), 'not a subtitle named after something else');

    console.log('\nthe media scan');
    grants = createReadGrants({ file, configPath, index: index([scanned], [join(dir, 'library')]) });
    check(grants.allows(scanned), 'a file the scan found');
    check(grants.allows(addedSince), 'a media file added to a scanned folder since');
    check(!grants.allows(notMedia), 'not a file that is not media, even in a scanned folder');
    check(!grants.allows(photo), 'and still nothing outside it');
} finally {
    rmSync(dir, { recursive: true, force: true });
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

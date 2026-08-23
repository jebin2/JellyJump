/**
 * Tests the YouTube link-list file rules.
 *
 * Two things matter here beyond parsing. Which files get opened at all — media
 * drives hold recovery codes and password exports, and a rule that reads every
 * .txt to see what is inside reads those too. And the separator: a URL contains
 * a colon, so splitting on the wrong one turns a link into "https".
 *
 *   node scripts/youtube-linkfile-test.mjs
 */
import {
    linkListFolderName,
    parseLinkListFile,
    LINK_LIST_EXTENSION,
} from '../assets/js/shared/utils/LinkListFile.js';
import fs from 'node:fs';

let pass = 0, fail = 0;
const check = (ok, label) => {
    if (ok) { pass++; console.log(`  PASS  ${label}`); }
    else { fail++; console.log(`  FAIL  ${label}`); }
};

// Which files get opened is the scanner's decision and is asserted against a
// tree containing recovery-code files in linklist-scan-test.mjs — testing a
// predicate nothing calls would only look like coverage.

console.log('\nboth line formats, because the file is edited by hand');
const parsed = parseLinkListFile(`
# a comment
Cigarettes After Sex (Full Album) : https://www.youtube.com/watch?v=8scL5oJX6CM

https://youtu.be/1PukR-byRZg
李玖哲 Nicky Lee-夏天 Summer : https://www.youtube.com/watch?v=tLGgJLDk5kM
`);
check(parsed.length === 3, 'three entries, ignoring the comment and the blank lines');
check(parsed[0].name === 'Cigarettes After Sex (Full Album)', 'the name is taken from the line');
check(parsed[0].id === '8scL5oJX6CM', 'and so is the id');
check(parsed[1].name === '', 'a bare URL has no name');
check(parsed[1].id === '1PukR-byRZg', 'and still parses');
check(parsed[2].name === '李玖哲 Nicky Lee-夏天 Summer', 'a non-ASCII name survives');

console.log('\nthe separator does not cut up the URL');
const colon = parseLinkListFile('Episode 1: The Beginning : https://youtu.be/dQw4w9WgXcQ');
check(colon.length === 1, 'a name containing a colon still parses');
check(colon[0].name === 'Episode 1: The Beginning', 'and keeps its colon');
check(colon[0].id === 'dQw4w9WgXcQ', 'with the link intact');

console.log('\nstart offsets survive the file');
const offset = parseLinkListFile('Song : https://youtu.be/dQw4w9WgXcQ?t=90');
check(offset[0].start === 90, 't=90 is carried through');

console.log('\nlines that are not links are skipped, not treated as errors');
const messy = parseLinkListFile([
    'just some text',
    'https://example.com/video.mp4',
    'https://www.youtube.com/@channel',
    'Good : https://youtu.be/dQw4w9WgXcQ',
].join('\n'));
check(messy.length === 1, 'only the real link is taken');

console.log('\nthe same video twice is one entry');
const dupes = parseLinkListFile([
    'A : https://youtu.be/dQw4w9WgXcQ',
    'B : https://www.youtube.com/watch?v=dQw4w9WgXcQ',
].join('\n'));
check(dupes.length === 1, 'listed twice, added once');

console.log('\nempty and malformed input');
check(parseLinkListFile('').length === 0, 'an empty file');
check(parseLinkListFile(null).length === 0, 'null');
check(parseLinkListFile('\n\n\n').length === 0, 'only blank lines');

console.log('\nthe folder name drops our extension');
check(linkListFolderName('youtube_links.jjlist') === 'youtube_links', 'lowercase');
check(linkListFolderName('My Songs.JJLIST') === 'My Songs', 'and any case');
check(linkListFolderName('holiday.2024.jjlist') === 'holiday.2024', 'only the last extension goes');

// The scanner is a separate CommonJS process and cannot import this module, so
// it spells the extension itself. Two copies of a constant drift; this fails
// when they do.
console.log('\nthe scanner agrees with us about the extension');
const scannerSource = fs.readFileSync(new URL('../desktop/scanner.js', import.meta.url), 'utf8');
const scannerExt = /LINK_LIST_EXTENSION = '([^']+)'/.exec(scannerSource)?.[1];
check(scannerExt === LINK_LIST_EXTENSION,
    `the scanner's extension matches this module's (${scannerExt} vs ${LINK_LIST_EXTENSION})`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

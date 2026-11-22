/**
 * The WebVTT written into exported videos.
 *
 * An export carries the player's subtitle tracks as tracks of its own, so
 * their cues are written out again, and a trimmed export has to move them:
 * the range starts at zero in the file. These check the timing and the text.
 *
 *   node scripts/subtitle-vtt-test.mjs
 */
import { cuesToVTT } from '../assets/js/shared/media/SubtitleConverter.js';

let pass = 0, fail = 0;
const check = (ok, label) => {
    if (ok) { pass++; console.log(`  PASS  ${label}`); }
    else { fail++; console.log(`  FAIL  ${label}`); }
};
const timings = (vtt) => (vtt || '').split('\n').filter(l => l.includes('-->'));

const cues = [
    { start: 5, end: 6, text: 'five' },
    { start: 1, end: 2, text: 'one' },
    { start: 8.5, end: 9.5, text: 'late' },
];

console.log('\na whole export');
{
    const vtt = cuesToVTT(cues);
    check(vtt.startsWith('WEBVTT\n\n'), 'starts with the WebVTT header');
    check(timings(vtt)[0] === '00:00:01.000 --> 00:00:02.000 align:center', 'cues are in time order, each aligned for QuickTime');
    check(timings(vtt).length === 3, 'every cue is written');
}

console.log('\na trimmed export');
{
    const t = timings(cuesToVTT(cues, { start: 4, end: 9 }));
    check(t.length === 2, `cues outside the range are left out (${t.length})`);
    check(t[0] === '00:00:01.000 --> 00:00:02.000 align:center', `a cue moves with the range (${t[0]})`);
    check(t[1] === '00:00:04.500 --> 00:00:05.000 align:center', `a cue across the end is clipped to it (${t[1]})`);
    check(cuesToVTT(cues, { start: 20, end: 30 }) === null, 'a range with no cues gives nothing to write');
}

console.log('\nthe text');
{
    const vtt = cuesToVTT([{ start: 0, end: 1, text: 'first\n\nsecond' }, { start: 1, end: 2, text: '   ' }]);
    check(vtt.includes('first\nsecond'), 'a blank line inside a cue, which would end it, is removed');
    check(timings(vtt).length === 1, 'an empty cue is left out');
}

console.log('\ntimestamps');
{
    const [t] = timings(cuesToVTT([{ start: 59.9996, end: 3725.5, text: 'x' }]));
    check(t.startsWith('00:01:00.000'), `rounding carries into the minute rather than writing 60 seconds (${t})`);
    check(t.includes('--> 01:02:05.500'), `hours are written (${t})`);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);

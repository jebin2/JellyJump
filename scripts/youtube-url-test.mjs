/**
 * Tests the YouTube link rules.
 *
 * These decide whether a pasted URL is handed to YouTube's player or to the
 * demuxer, and both mistakes are bad: a missed YouTube link reaches the
 * demuxer and fails with "unsupported or unrecognizable format", while a
 * false positive sends a real media URL to an embed that cannot play it.
 *
 *   node scripts/youtube-url-test.mjs
 */
import { parseYouTubeUrl, looksLikeYouTubeUrl, thumbnailUrl } from '../assets/js/shared/utils/YouTubeUrl.js';

let pass = 0, fail = 0;
const check = (ok, label) => {
    if (ok) { pass++; console.log(`  PASS  ${label}`); }
    else { fail++; console.log(`  FAIL  ${label}`); }
};
const ID = 'dQw4w9WgXcQ';

console.log('\nthe shapes a YouTube link comes in');
for (const url of [
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?v=${ID}`,
    `https://m.youtube.com/watch?v=${ID}`,
    `https://music.youtube.com/watch?v=${ID}`,
    `https://youtu.be/${ID}`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/live/${ID}`,
    `https://www.youtube-nocookie.com/embed/${ID}`,
    `http://www.youtube.com/watch?v=${ID}`,
]) {
    check(parseYouTubeUrl(url)?.id === ID, url);
}

console.log('\nextra query parameters do not confuse it');
check(parseYouTubeUrl(`https://www.youtube.com/watch?v=${ID}&list=PL123&index=2`)?.id === ID, 'a video inside a playlist');
check(parseYouTubeUrl(`https://youtu.be/${ID}?si=abcdef`)?.id === ID, 'a share link with a tracking parameter');
check(parseYouTubeUrl(`  https://youtu.be/${ID}  `)?.id === ID, 'surrounding whitespace from a paste');

console.log('\nstart offsets');
check(parseYouTubeUrl(`https://youtu.be/${ID}?t=90`)?.start === 90, 't=90 is ninety seconds');
check(parseYouTubeUrl(`https://www.youtube.com/watch?v=${ID}&t=1m30s`)?.start === 90, 't=1m30s');
check(parseYouTubeUrl(`https://www.youtube.com/watch?v=${ID}&t=1h2m3s`)?.start === 3723, 't=1h2m3s');
check(parseYouTubeUrl(`https://www.youtube.com/watch?v=${ID}&start=45`)?.start === 45, 'start=45');
check(parseYouTubeUrl(`https://www.youtube.com/watch?v=${ID}`)?.start === 0, 'no offset is zero, not undefined');
check(parseYouTubeUrl(`https://www.youtube.com/watch?v=${ID}&t=garbage`)?.start === 0,
    'an unparseable offset plays from the start rather than refusing the link');

console.log('\nYouTube URLs that are not a single video have nothing to embed');
for (const url of [
    'https://www.youtube.com/',
    'https://www.youtube.com/@somechannel',
    'https://www.youtube.com/results?search_query=cats',
    'https://www.youtube.com/playlist?list=PL123',
    'https://www.youtube.com/watch?v=tooshort',
    'https://www.youtube.com/watch',
]) {
    check(parseYouTubeUrl(url) === null, url);
}

console.log('\nnot YouTube at all');
for (const url of [
    'https://example.com/video.mp4',
    'https://notyoutube.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ',
    'https://homeserver.ts.net:8443/?token=abc',
    'file:///home/me/video.mkv',
    'not a url at all',
    '',
]) {
    check(parseYouTubeUrl(url) === null, url || '(empty string)');
}
check(parseYouTubeUrl(null) === null, 'null');
check(parseYouTubeUrl(undefined) === null, 'undefined');
check(parseYouTubeUrl(12345) === null, 'a number');

console.log('\nthe convenience wrapper agrees with the parser');
check(looksLikeYouTubeUrl(`https://youtu.be/${ID}`) === true, 'a YouTube link');
check(looksLikeYouTubeUrl('https://example.com/a.mp4') === false, 'a media URL');

console.log('\nthumbnail fallback');
check(thumbnailUrl(ID).includes(ID), 'the id appears in the thumbnail URL');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

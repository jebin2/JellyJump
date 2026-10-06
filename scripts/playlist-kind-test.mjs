/**
 * Which loader a playlist item goes to.
 *
 * selectItem decides this with a run of `if`s that each return, so the order
 * of the checks IS the decision, and the ordering carries real reasoning: a
 * YouTube watch page can be a live broadcast, and everything past that branch
 * assumes a fetchable media file. Nothing tested any of it.
 *
 *   node scripts/playlist-kind-test.mjs
 */
import { classifyPlaylistItem as kind } from '../assets/js/ui/player/PlaylistItemKind.js';

let pass = 0, fail = 0;
const check = (ok, label) => {
    if (ok) { pass++; console.log(`  PASS  ${label}`); }
    else { fail++; console.log(`  FAIL  ${label}`); }
};
const withStream = { hasWebcamStream: true };

console.log('\nthe ordinary cases');
check(kind({ blob_url: 'blob:abc' }) === 'local', 'a file already in hand is local');
check(kind({ url: 'https://x/y.mp4' }) === 'fetch', 'a file not yet in hand must be fetched');
check(kind({ isYouTube: true, url: 'https://youtu.be/x' }) === 'youtube', 'a YouTube item goes to YouTube');
check(kind({ isLive: true, url: 'https://x/s.m3u8' }) === 'stream', 'a live item is a stream');
check(kind({ url: 'https://x/s.m3u8' }) === 'stream', 'so is any .m3u8 url, unmarked');
check(kind({ isStream: true }) === 'stream', 'so is anything already marked a stream, url or not');

console.log('\na webcam item needs the stream to still be held');
check(kind({ isWebcam: true }, withStream) === 'webcam', 'with the stream, it is restored');
check(kind({ isWebcam: true, blob_url: 'blob:abc' }) === 'local',
    'without it, it falls through rather than failing');
check(kind({ isWebcam: true, isYouTube: true }) === 'youtube',
    'and falls all the way through to whatever else it is');

console.log('\nthe order of the checks is the decision');
check(kind({ needsReload: true, isYouTube: true, blob_url: 'blob:abc' }) === 'needsReload',
    'a file needing re-upload is refused before anything else is considered');
check(kind({ isWebcam: true, isYouTube: true }, withStream) === 'webcam',
    'a held webcam stream beats a YouTube flag');
check(kind({ isYouTube: true, isLive: true, url: 'https://youtube.com/watch?v=x' }) === 'youtube',
    'a YouTube LIVE broadcast goes to YouTube, not the HLS path');
check(kind({ isYouTube: true, url: 'https://x/y.m3u8' }) === 'youtube',
    'and a YouTube url that mentions .m3u8 still goes to YouTube');
check(kind({ isLive: true }) === 'stream',
    'a live item is a stream even with no blob and no url');
check(kind({ isStream: true, blob_url: 'blob:abc' }) === 'stream',
    'a stream stays a stream even when a blob is present');

console.log('\nthings that must not throw');
check(kind(undefined) === 'local', 'no item at all does not throw');
check(kind({}) === 'fetch', 'an empty item needs fetching');
check(kind({ url: null }) === 'fetch', 'a null url does not throw on the .m3u8 test');

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);

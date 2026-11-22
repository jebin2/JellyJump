/**
 * Tests the playback clock: where the player says it is in a video.
 *
 * Everything that draws a frame, schedules audio, moves the progress bar or
 * loops a range asks this clock, and most of the player's timing bugs (audio
 * after a seek, the end of a video, the edit panel's loops) showed up as the
 * clock giving a wrong answer. These tests pin its rules with a fake audio
 * clock, so later refactors of the player (ARCHITECTURE_PLAN.md, phase J)
 * have something to keep green.
 *
 *   node scripts/playback-clock-test.mjs
 */
import { getPlayerPlaybackTime } from '../assets/js/core/playback/PlaybackState.js';
import { PlaybackAnchor } from '../assets/js/core/playback/PlaybackAnchor.js';

let pass = 0, fail = 0;
const check = (ok, label) => {
    if (ok) { pass++; console.log(`  PASS  ${label}`); }
    else { fail++; console.log(`  FAIL  ${label}`); }
};
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

/** A player with just the fields the clock reads, and an audio clock we move by hand. */
function fakePlayer({ state = 'running', now = 100, rate = 1, playing = true, atStart = 0 } = {}) {
    return {
        isStreamMode: false,
        isLive: false,
        isPlaying: playing,
        playbackRate: rate,
        playbackTimeAtStart: atStart,
        vodAnchor: new PlaybackAnchor(),
        audioContext: { state, currentTime: now },
    };
}

console.log('\nthe anchor');
{
    const a = new PlaybackAnchor();
    check(!a.isAnchored, 'starts unset');
    a.set(0, 0);
    check(a.isAnchored, '0 is a real value for both halves');
    a.set(10, 5);
    check(near(a.positionAt(12), 7), 'two seconds of audio clock later, two seconds further in');
    check(near(a.positionAt(12, 2), 9), 'at 2x, twice as far');
    check(near(a.positionAt(12, 0.5), 6), 'at 0.5x, half as far');
    check(near(a.positionAt(9.95), 4.95), 'a clock just behind the anchor reads just behind it');
    check(near(a.positionAt(9), 5), 'but never more than 0.1 s behind: it holds at the anchor');
    a.snapTo(20, 8);
    check(a.hasSnapped && near(a.positionAt(21), 9), 'snapping moves it and remembers it snapped');
    a.clear();
    check(!a.isAnchored && a.hasSnapped, 'clear forgets the anchor, not the snap');
    a.reset();
    check(!a.hasSnapped, 'reset forgets both, for a new video');
}

console.log('\nplaying a file, with the audio clock running');
{
    const p = fakePlayer({ now: 100 });
    p.vodAnchor.set(100, 30); // playback started at 30 s when the audio clock read 100
    check(near(getPlayerPlaybackTime(p), 30), 'at the anchor: the position it was anchored at');
    p.audioContext.currentTime = 101.5;
    check(near(getPlayerPlaybackTime(p), 31.5), '1.5 s of audio later: 31.5 s');
    p.playbackRate = 2;
    check(near(getPlayerPlaybackTime(p), 33), 'the rate scales the time since the anchor');
}

console.log('\nwhen the audio clock is not running');
{
    const p = fakePlayer({ state: 'suspended', atStart: 12, playing: false });
    p.vodAnchor.set(100, 30);
    check(near(getPlayerPlaybackTime(p), 12), 'paused with the context suspended: where playback stopped');

    const q = fakePlayer({ state: 'suspended', atStart: 12, playing: true, rate: 2 });
    const realNow = performance.now;
    let fakeNow = 5000;
    performance.now = () => fakeNow;
    q.fallbackStartTime = 5000;
    fakeNow = 6500;
    check(near(getPlayerPlaybackTime(q), 15), 'playing without audio: wall time since start, times the rate, from where it started');
    performance.now = realNow;

    const r = fakePlayer({ state: 'running', atStart: 7 });
    check(near(getPlayerPlaybackTime(r), 7), 'no anchor yet: where playback started');
}

console.log('\nstreams and live');
{
    const p = fakePlayer();
    p.isStreamMode = true;
    p.streamVideo = { currentTime: 42.5 };
    check(near(getPlayerPlaybackTime(p), 42.5), 'a stream played by a <video> element: that element\'s time');

    const live = fakePlayer({ now: 50 });
    live.isLive = true;
    live.stream = { anchor: new PlaybackAnchor() };
    live.stream.anchor.set(50, 1000);
    live.vodAnchor.set(50, 3); // must be ignored for live
    live.audioContext.currentTime = 52;
    check(near(getPlayerPlaybackTime(live), 1002), 'live uses the stream\'s anchor, not the file anchor');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

/**
 * Tests the recording clock.
 *
 * A recording's timestamps must follow played time, not wall-clock time: pause
 * the camera for ten seconds and the file must not gain ten seconds of
 * nothing. That is the single most timing-sensitive thing in the app and it
 * had no test of any kind, because in its old home it could only be exercised
 * by driving MediaBunny, an AudioContext and a canvas at once.
 *
 * Here it is a fake clock, so the pause can be ten seconds long and the test
 * still finishes instantly.
 *
 *   node scripts/recording-clock-test.mjs
 */
import { RecordingClock } from '../assets/js/core/streaming/RecordingClock.js';

let pass = 0, fail = 0;
const check = (ok, label) => {
    if (ok) { pass++; console.log(`  PASS  ${label}`); }
    else { fail++; console.log(`  FAIL  ${label}`); }
};
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

console.log('\nthe first frame anchors the clock rather than measuring against nothing');
{
    const c = new RecordingClock();
    c.start(1000);
    check(c.nextVideoTimestamp(1000) === null, 'the frame that anchors is skipped, not written at 0');
    check(c.videoSeconds === 0, 'and nothing has been recorded yet');
    check(near(c.nextVideoTimestamp(1040), 0.04), 'the next frame is 40ms in');
}

console.log('\ncontinuous running accumulates real elapsed time');
{
    const c = new RecordingClock();
    c.start(0);
    c.nextVideoTimestamp(0);
    let t = 0;
    for (let i = 0; i < 25; i++) { t += 40; c.nextVideoTimestamp(t); }
    check(near(c.videoSeconds, 1.0), `25 frames at 40ms is one second (${c.videoSeconds.toFixed(3)}s)`);
}

console.log('\na pause does not reach the file');
{
    const c = new RecordingClock();
    c.start(0);
    c.nextVideoTimestamp(0);
    // One second of playing.
    for (let t = 40; t <= 1000; t += 40) c.nextVideoTimestamp(t);
    const beforePause = c.videoSeconds;

    // Paused for ten seconds. Both edges raise the flag, as pausing and
    // resuming do in the player.
    c.markDiscontinuity();
    c.markDiscontinuity();
    check(c.nextVideoTimestamp(11000) === null, 'the first frame back is skipped to re-anchor');
    check(near(c.videoSeconds, beforePause), `and the clock did not move during the pause (${c.videoSeconds.toFixed(3)}s)`);

    // Another second of playing.
    for (let t = 11040; t <= 12000; t += 40) c.nextVideoTimestamp(t);
    check(near(c.videoSeconds, 2.0, 1e-6),
        `two seconds played across an 11-second wall span reads 2s, not 12s (${c.videoSeconds.toFixed(3)}s)`);
}

console.log('\nrepeated pauses stay correct');
{
    const c = new RecordingClock();
    c.start(0);
    c.nextVideoTimestamp(0);
    let wall = 0;
    for (let cycle = 0; cycle < 5; cycle++) {
        for (let i = 0; i < 10; i++) { wall += 50; c.nextVideoTimestamp(wall); }  // 0.5s played
        c.markDiscontinuity();
        wall += 3000;                                                            // 3s paused
        c.nextVideoTimestamp(wall);                                              // re-anchors
    }
    check(near(c.videoSeconds, 2.5, 1e-6),
        `five half-second runs separated by three-second pauses reads 2.5s (${c.videoSeconds.toFixed(3)}s)`);
    // Five cycles of 500ms played plus 3000ms paused.
    check(wall === 17500, `while ${(wall / 1000).toFixed(2)}s of wall time passed`);
}

console.log('\nthe clock never runs backwards');
{
    const c = new RecordingClock();
    c.start(0);
    c.nextVideoTimestamp(0);
    let last = 0, monotonic = true;
    let wall = 0;
    for (let i = 0; i < 200; i++) {
        wall += 17;
        if (i % 37 === 0) c.markDiscontinuity();
        const ts = c.nextVideoTimestamp(wall);
        if (ts !== null) { if (ts < last) monotonic = false; last = ts; }
    }
    check(monotonic, 'timestamps only ever increase, discontinuities included');
}

console.log('\naudio advances by what it is handed, and only while anchored');
{
    const c = new RecordingClock();
    c.start(0);
    check(c.nextAudioTimestamp(0.085) === null, 'a buffer arriving before the clock is anchored is dropped');

    c.nextVideoTimestamp(0);                       // anchors
    check(c.nextAudioTimestamp(0.085) === 0, 'the first buffer sits at 0');
    check(near(c.nextAudioTimestamp(0.085), 0.085), 'the second follows the first by its own length');

    c.markDiscontinuity();
    check(c.nextAudioTimestamp(0.085) === null, 'buffers during a discontinuity are dropped, not mistimed');
    c.nextVideoTimestamp(5000);
    check(near(c.nextAudioTimestamp(0.085), 0.17),
        'and audio resumes where it left off, not where the wall clock went');
}

console.log('\na poisoned audio clock restarts instead of writing a bad timestamp');
{
    const c = new RecordingClock();
    c.start(0);
    c.nextVideoTimestamp(0);
    c._audioSeconds = NaN;
    check(c.nextAudioTimestamp(0.085) === null, 'a non-finite timestamp is refused');
    check(c.audioSeconds === 0, 'and the audio clock is put back to zero');
    check(c.nextAudioTimestamp(0.085) === 0, 'so the next buffer is usable again');
}

console.log('\nstarting again clears everything');
{
    const c = new RecordingClock();
    c.start(0);
    c.nextVideoTimestamp(0);
    for (let t = 40; t <= 2000; t += 40) c.nextVideoTimestamp(t);
    c.nextAudioTimestamp(0.5);
    check(c.videoSeconds > 1.9 && c.audioSeconds > 0, 'a run has accumulated something');

    c.start(99999);
    check(c.videoSeconds === 0 && c.audioSeconds === 0, 'a second run starts from zero');
    check(c.discontinuous === true, 'and waits to be anchored again');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

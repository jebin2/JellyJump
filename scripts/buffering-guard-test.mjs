/**
 * BufferingGuard's decisions, without a browser: when it holds the clock,
 * and when it lets go.
 *
 *   node scripts/buffering-guard-test.mjs
 */
import {
    checkPlayerBuffering, isPlayerStalled, clearPlayerStall, noteAudioStarted, noteAudioScheduled,
    noteFramePresented, audioLeadLimit, RESUME_AT,
} from '../assets/js/core/playback/BufferingGuard.js';

let passed = 0;
let failed = 0;
function check(name, ok, detail = '') {
    if (ok) { passed++; console.log(`  PASS  ${name}`); }
    else { failed++; console.log(`  FAIL  ${name}${detail ? ` -- ${detail}` : ''}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** An AudioContext whose time the test moves, and whose resume it settles. */
function fakeContext() {
    const ctx = {
        currentTime: 0,
        state: 'running',
        resumes: 0,
        pendingResume: null,
        suspend() { ctx.state = 'suspended'; return Promise.resolve(); },
        resume() {
            ctx.resumes++;
            return new Promise((resolve) => { ctx.pendingResume = () => { ctx.state = 'running'; resolve(); }; });
        },
    };
    return ctx;
}

function fakePlayer() {
    const player = {
        audioContext: fakeContext(),
        audioSink: {},
        videoTrack: {},
        frames: { isOpen: true, pending: { timestamp: 1 }, isFetching: false },
        vodAnchor: { isAnchored: true },
        isPlaying: true,
        isLive: false,
        isStreamMode: false,
        isLoading: false,
        playbackRate: 1,
        currentTime: 0,
        setLoading(on) { player.isLoading = on; },
    };
    return player;
}

console.log('\nholding the clock\n');
{
    const p = fakePlayer();
    noteAudioStarted(p);
    noteFramePresented(p);
    noteAudioScheduled(p, 2);
    p.audioContext.currentTime = 0.6;
    checkPlayerBuffering(p);
    check('plenty of audio ahead: plays on', !isPlayerStalled(p) && p.audioContext.state === 'running');

    p.audioContext.currentTime = 1.95;
    checkPlayerBuffering(p);
    check('the audio about to run out: waits, spinner on, context suspended',
        isPlayerStalled(p) && p.isLoading && p.audioContext.state === 'suspended');

    noteAudioScheduled(p, 1.95 + RESUME_AT - 0.2);
    checkPlayerBuffering(p);
    check('not enough yet: still waiting', isPlayerStalled(p) && p.audioContext.resumes === 0);

    noteAudioScheduled(p, 1.95 + RESUME_AT + 0.1);
    checkPlayerBuffering(p);
    check('enough: resume asked for', p.audioContext.resumes === 1);
    check('but still held until the context is running (the clock must not fall back to wall time)',
        isPlayerStalled(p) && p.isLoading);
    checkPlayerBuffering(p);
    check('and resume is not asked for twice meanwhile', p.audioContext.resumes === 1);

    p.audioContext.pendingResume();
    await sleep(0);
    check('running again: no longer held, spinner off', !isPlayerStalled(p) && !p.isLoading);
}

console.log('\nwaiting again soon after\n');
{
    const p = fakePlayer();
    noteAudioStarted(p);
    noteFramePresented(p);
    /** Run the audio low at `at` and return how much it wants ahead before playing on. */
    const stall = async (at) => {
        p.audioContext.currentTime = at - 1;
        noteAudioStarted(p);              // a fresh iterator, past its first moments
        p.audioContext.currentTime = at;
        noteAudioScheduled(p, at + 0.05);
        checkPlayerBuffering(p);
        if (!isPlayerStalled(p)) return NaN;
        // Find the smallest cushion it resumes with.
        let ahead = 0.5;
        while (p.audioContext.resumes === resumesBefore && ahead < 10) {
            ahead += 0.25;
            noteAudioScheduled(p, at + ahead);
            checkPlayerBuffering(p);
        }
        resumesBefore = p.audioContext.resumes;
        p.audioContext.pendingResume();
        await sleep(0);
        return ahead;
    };
    let resumesBefore = 0;
    const first = await stall(10);
    const second = await stall(12);
    const third = await stall(14);
    const fourth = await stall(16);
    check('each wait soon after the last wants a bigger cushion: 1 s, 2 s, 4 s, then no more',
        first === 1 && second === 2 && third === 4 && fourth === 4, `${first}, ${second}, ${third}, ${fourth}`);
    check('and the audio pump may read that far ahead', audioLeadLimit(p) >= 4.5, `${audioLeadLimit(p)}`);
}

console.log('\nstarved video\n');
{
    const p = fakePlayer();
    noteAudioStarted(p);
    noteAudioScheduled(p, 10);
    p.audioContext.currentTime = 1;
    noteFramePresented(p);
    p.frames = { isOpen: true, pending: null, isFetching: true };
    p.audioContext.currentTime = 1.3;
    checkPlayerBuffering(p);
    check('a short gap between frames is not a wait', !isPlayerStalled(p));
    p.audioContext.currentTime = 1.7;
    checkPlayerBuffering(p);
    check('no frame for over half a second while the decoder works: waits', isPlayerStalled(p));
    clearPlayerStall(p);
    check('pause, seek or load clears it', !isPlayerStalled(p) && !p.isLoading);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

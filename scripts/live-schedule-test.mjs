/**
 * The live frame schedule: when a live frame is drawn, and when it is given up
 * on. These thresholds were bare numbers inside a two-hundred-line loop, and
 * inducing real drift in a browser is impractical, so this is the only place
 * the policy can be held still.
 *
 *   node scripts/live-schedule-test.mjs
 */
import { PlaybackAnchor } from '../assets/js/core/playback/PlaybackAnchor.js';
import {
    scheduleLiveFrame,
    DRIFT_CATCHUP, DRIFT_LOADING, DRIFT_LOUD, DRIFT_JUMP, PRESENT_SLACK,
} from '../assets/js/core/streaming/LiveFrameSchedule.js';

let pass = 0, fail = 0;
const check = (ok, label) => {
    if (ok) { pass++; console.log(`  PASS  ${label}`); }
    else { fail++; console.log(`  FAIL  ${label}`); }
};

const anchored = (wall, content) => {
    const a = new PlaybackAnchor();
    a.set(wall, content);
    return a;
};
// A frame `lateBy` seconds later than the clock says it should be.
const at = (lateBy, { outputLatency = 0, wall = 10, content = 100 } = {}) =>
    scheduleLiveFrame({
        anchor: anchored(wall, content),
        frameTimestamp: content,
        now: wall + lateBy + outputLatency,
        outputLatency,
    });

console.log('\nwithout an anchor there is nothing to pace against');
check(scheduleLiveFrame({ anchor: new PlaybackAnchor(), frameTimestamp: 1, now: 1 }).kind === 'unanchored',
    'a fresh anchor reports unanchored');
check(scheduleLiveFrame({ anchor: undefined, frameTimestamp: 1, now: 1 }).kind === 'unanchored',
    'so does no anchor at all');
check(anchored(0, 0).isAnchored, 'but wall 0 / content 0 IS anchored, which truthiness used to deny');
check(at(0, { wall: 0, content: 0 }).kind === 'present',
    'and a frame against a zero anchor is scheduled normally');

console.log('\nthe target accounts for output latency');
const noLatency = at(0, { outputLatency: 0 });
const withLatency = at(0, { outputLatency: 0.25 });
check(Math.abs((withLatency.targetWall - noLatency.targetWall) - 0.25) < 1e-9,
    'latency pushes the target later by exactly that much');
check(Math.abs(withLatency.drift) < 1e-9, 'a frame on time stays on time once latency is accounted for');

console.log('\non time, late, and hopeless');
check(at(0).kind === 'present', 'a frame on time is presented');
check(at(DRIFT_CATCHUP - 0.01).kind === 'present', `just inside ${DRIFT_CATCHUP}s is still presented`);
check(at(DRIFT_CATCHUP + 0.01).kind === 'catchUp', `just past ${DRIFT_CATCHUP}s switches to catching up`);
check(at(DRIFT_JUMP - 0.1).kind === 'catchUp', `${DRIFT_JUMP - 0.1}s late is still catching up`);
check(at(DRIFT_JUMP + 0.1).kind === 'jumpToEdge', `past ${DRIFT_JUMP}s it gives up and rejoins the edge`);
check(at(0).waitUntil === at(0).targetWall - PRESENT_SLACK,
    'a presented frame may go out a slack early');

console.log('\ncatching up reports what the loop needs to show');
check(at(DRIFT_LOADING - 0.1).showLoading === false, `below ${DRIFT_LOADING}s no spinner`);
check(at(DRIFT_LOADING + 0.1).showLoading === true, `above ${DRIFT_LOADING}s the spinner is warranted`);
check(at(DRIFT_LOUD - 0.1).loud === false, `below ${DRIFT_LOUD}s stays quiet`);
check(at(DRIFT_LOUD + 0.1).loud === true, `above ${DRIFT_LOUD}s is worth saying out loud`);

console.log('\nthe thresholds are ordered, which is what makes the branches reachable');
check(DRIFT_CATCHUP < DRIFT_LOADING && DRIFT_LOADING < DRIFT_LOUD && DRIFT_LOUD < DRIFT_JUMP,
    `catchUp < loading < loud < jump (${DRIFT_CATCHUP} < ${DRIFT_LOADING} < ${DRIFT_LOUD} < ${DRIFT_JUMP})`);
check(PRESENT_SLACK > 0 && PRESENT_SLACK < DRIFT_CATCHUP,
    'the present slack is smaller than the catch-up threshold');

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);

/**
 * Which frames playing backwards holds (shared/media/BackwardPlan.js).
 *
 * Every stretch is decoded from its key frame. With ffmpeg's default spacing
 * (a key frame every 250 frames) a stretch of 24 frames far from one took
 * longer to decode than to show, and the picture stood still for up to 5.6 s
 * while the sound went on (measured on a 720p clip). The plan holds every
 * k-th frame when decoding cannot keep up otherwise, and never leaves a few
 * frames just after a key frame for a stretch of their own.
 *
 *   node scripts/backward-plan-test.mjs
 */
import { planStretch, pickBack } from '../assets/js/shared/media/BackwardPlan.js';

let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
    if (ok) { pass++; console.log(`  PASS  ${label}`); }
    else { fail++; console.log(`  FAIL  ${label}${detail ? ` -- ${detail}` : ''}`); }
};

const fps30 = 1 / 30;
const base = { decodeFps: 150, frameDuration: fps30, capacity: 24, rate: 1 };
/** Seconds a stretch plays for, and seconds its decoding takes. */
const plays = (plan) => (plan.step * plan.count * fps30) / base.rate;
const decodes = (frames, decodeFps = base.decodeFps) => frames / decodeFps;

console.log('\nthe step');
{
    const near = planStretch({ ...base, frames: 30 });
    check('close to a key frame, every frame', near.step === 1, JSON.stringify(near));
    const far = planStretch({ ...base, frames: 250 });
    check('250 frames from one (ffmpeg\'s default spacing), every few', far.step > 1, JSON.stringify(far));
    check('and its decoding fits in the time it plays for', decodes(250) <= 0.75 * plays(far) + 1e-9,
        `${decodes(250).toFixed(2)} s to decode, ${plays(far).toFixed(2)} s to play`);
    const slow = planStretch({ ...base, frames: 250, decodeFps: 60 });
    check('a slower device steps further', slow.step > far.step, `${far.step} -> ${slow.step}`);
    const fast = planStretch({ ...base, frames: 250, rate: 2 });
    check('so does playing at 2×', fast.step > far.step, `${far.step} -> ${fast.step}`);
    const hopeless = planStretch({ ...base, frames: 2000, decodeFps: 10 });
    check('never fewer than one frame in eight', hopeless.step === 8, JSON.stringify(hopeless));
    check('nothing to go on: every frame', planStretch({ ...base, frames: 100, decodeFps: 0 }).step === 1);
}

console.log('\nno stretch of a few frames before a costly one');
{
    // 32 frames from the key frame: 24 held would leave 8 for a stretch of
    // their own, a quarter of a second to watch while the 250-frame chunk
    // before decodes (seen: 1.5 s still).
    const plan = planStretch({ ...base, frames: 32, chunkFrames: 250 });
    check('the stretch takes them too, back to the key frame', plan.step * (plan.count - 1) >= 31, JSON.stringify(plan));
    check('holding no more than twice as many', plan.count <= 48, JSON.stringify(plan));
    const long = planStretch({ ...base, frames: 120, chunkFrames: 250 });
    check('far from the key frame, the next stretch is long enough to be its own',
        long.step * long.count < 120 && 120 - long.step * long.count >= decodes(250) / 0.75 * 30, JSON.stringify(long));
    const many = planStretch({ ...base, frames: 60, chunkFrames: 250 });
    check('more than twice as many to take: it steps further instead', many.count <= 48 && many.step > 1 && many.step * (many.count - 1) >= 59, JSON.stringify(many));
}

console.log('\nwhich frames');
{
    const stamps = Array.from({ length: 10 }, (_, i) => i);
    check('every one, the last few', JSON.stringify(pickBack(stamps, 4, 1)) === '[6,7,8,9]', JSON.stringify(pickBack(stamps, 4, 1)));
    check('every third, back from the last', JSON.stringify(pickBack(stamps, 3, 3)) === '[3,6,9]', JSON.stringify(pickBack(stamps, 3, 3)));
    check('the key frame is not left alone when the step passes it',
        JSON.stringify(pickBack(stamps, 10, 2)) === '[0,1,3,5,7,9]', JSON.stringify(pickBack(stamps, 10, 2)));
    check('nor added when the count is reached', JSON.stringify(pickBack(stamps, 5, 2)) === '[1,3,5,7,9]', JSON.stringify(pickBack(stamps, 5, 2)));
    check('none to pick from', pickBack([], 4, 2).length === 0);
    check('an export, which plans nothing, holds the last ones as before', JSON.stringify(pickBack(stamps, 48, 1)) === JSON.stringify(stamps));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

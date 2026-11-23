/**
 * The player's events (assets/js/core/PlayerStateEvents.js, plan H1):
 * fired when the state they describe changes, once, and never stopped by a
 * listener that throws. The real player firing them is in smoke-test.
 *
 *   node scripts/player-events-test.mjs
 */
import { onPlayerEvent, offPlayerEvent, triggerPlayerEvent } from '../assets/js/core/PlayerEvents.js';
import { PlayerStateEvents } from '../assets/js/core/PlayerStateEvents.js';

let pass = 0, fail = 0;
const check = (ok, label) => {
    if (ok) { pass++; console.log(`  PASS  ${label}`); }
    else { fail++; console.log(`  FAIL  ${label}`); }
};

function fakePlayer() {
    const p = {
        _events: {}, isPlaying: false, isLoading: false, currentTime: 0, duration: NaN,
        config: { volume: 1, muted: false }, get volume() { return p.config.volume; }, get isMuted() { return p.config.muted; },
        playbackRate: 1, loopMode: 'off', loopStart: null, loopEnd: null, controlBarMode: 'overlay',
        isStreamMode: false, isWebcamMode: false, isLive: false,
        filterState: null,
        videoFilters: { isActive: () => !!p.filterState, getState: () => p.filterState },
        on: (e, f) => onPlayerEvent(p, e, f), off: (e, f) => offPlayerEvent(p, e, f), trigger: (e, d) => triggerPlayerEvent(p, e, d),
        seen: [],
    };
    for (const e of ['play', 'pause', 'timeupdate', 'durationchange', 'loadingchange', 'volumechange', 'ratechange',
        'loopmodechange', 'ended', 'trackschange', 'streamstatechange', 'controlbarmodechange', 'filterschange']) {
        p.on(e, (data) => p.seen.push([e, data]));
    }
    p.announce = new PlayerStateEvents(p);
    return p;
}
const names = (p) => p.seen.map(([e]) => e).join(',');

console.log('\nplay and pause');
{
    const p = fakePlayer();
    p.announce.playState();
    check(names(p) === 'pause', 'the first refresh announces the state there is');
    p.announce.playState(); p.announce.playState();
    check(names(p) === 'pause', 'a refresh with nothing changed announces nothing (the UI refreshes 23 places)');
    p.isPlaying = true; p.announce.playState();
    p.isPlaying = false; p.announce.playState();
    check(names(p) === 'pause,play,pause', 'each change once');
}

console.log('\ndirection');
{
    const p = fakePlayer();
    p.direction = 'forward'; p.reverse = { active: false, unavailableReason: null };
    p.on('directionchange', (d) => p.seen.push(['directionchange', d]));
    p.announce.playState(); p.seen = [];
    p.direction = 'backward'; p.announce.playState();
    p.reverse.active = true; p.announce.playState(); p.announce.playState();
    p.reverse.unavailableReason = 'live'; p.announce.playState();
    check(names(p) === 'directionchange,directionchange,directionchange', 'directionchange for the direction, reversing starting, and it becoming unavailable');
    check(p.seen[1][1].reversing === true && p.seen[2][1].reverseUnavailable === 'live', 'with what changed');
}

console.log('\ntime and duration');
{
    const p = fakePlayer();
    p.duration = 10; p.currentTime = 1; p.announce.progress();
    check(names(p) === 'durationchange,timeupdate', `duration, then time (${names(p)})`);
    check(p.seen[0][1].duration === 10 && p.seen[1][1].currentTime === 1, 'with their values');
    p.seen = [];
    p.trigger('timeupdate', { currentTime: 2 }); // the render loop's own
    p.currentTime = 2; p.announce.progress();
    check(names(p) === 'timeupdate', 'a refresh after the render loop announced the same time adds nothing');
    p.seen = [];
    p.duration = NaN; p.announce.progress(); p.announce.progress();
    check(names(p) === 'durationchange', 'an unknown duration (NaN) is a change once, not every time');
}

console.log('\nthe rest');
{
    const p = fakePlayer();
    p.isLoading = true; p.announce.loading(); p.announce.loading();
    p.config.volume = 0.5; p.announce.volume(); p.config.muted = true; p.announce.volume(); p.announce.volume();
    p.playbackRate = 2; p.announce.rate(); p.announce.rate();
    check(names(p) === 'loadingchange,volumechange,volumechange,ratechange', `loading, volume and mute, rate (${names(p)})`);
    check(p.seen[2][1].volume === 0.5 && p.seen[2][1].muted === true && p.seen[3][1].playbackRate === 2, 'with their values');
    p.seen = [];
    p.announce.loop(); p.loopStart = 1; p.loopEnd = 3; p.loopMode = 'one'; p.announce.loop(); p.announce.loop();
    check(names(p) === 'loopmodechange,loopmodechange' && p.seen[1][1].loopStart === 1, 'loop mode and range');
    p.seen = [];
    p.announce.filters(); p.filterState = { brightness: 120 }; p.announce.filters(); p.filterState = { brightness: 130 }; p.announce.filters(); p.announce.filters();
    check(names(p) === 'filterschange,filterschange,filterschange' && p.seen[1][1].active === true, 'filters on, and each change of their values');
    p.seen = [];
    p.announce.controlBarMode(); p.controlBarMode = 'fixed'; p.announce.controlBarMode(); p.announce.controlBarMode();
    p.announce.streamState(); p.isWebcamMode = true; p.announce.streamState();
    check(names(p) === 'controlbarmodechange,controlbarmodechange,streamstatechange,streamstatechange' && p.seen[3][1].isWebcamMode === true, 'control bar mode, stream state');
    p.seen = [];
    p.announce.tracks(); p.announce.ended();
    check(names(p) === 'trackschange,ended', 'track lists and the end, every time');
}

console.log('\nlisteners');
{
    const p = fakePlayer();
    const reported = [];
    globalThis.reportError = (e) => reported.push(e.message);
    p.on('ratechange', () => { throw new Error('a UI bug'); });
    p.playbackRate = 1.5;
    let threw = false;
    try { p.announce.rate(); } catch { threw = true; }
    check(!threw && names(p) === 'ratechange' && reported[0] === 'a UI bug', 'one that throws is reported; the others still hear, and the player carries on');
    const f = () => p.seen.push(['extra']);
    p.on('ended', f); p.off('ended', f); p.announce.ended();
    check(!p.seen.some(([e]) => e === 'extra'), 'off() stops one');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

/**
 * Tests the player's overrides (assets/js/core/PlayerOverrides.js): values a
 * tool sets for a while and gives back exactly, stacked, released in any
 * order, never saved.
 *
 *   node scripts/override-test.mjs
 */
import { PlayerOverrides } from '../assets/js/core/PlayerOverrides.js';

let pass = 0, fail = 0;
const check = (ok, label) => {
    if (ok) { pass++; console.log(`  PASS  ${label}`); }
    else { fail++; console.log(`  FAIL  ${label}`); }
};

/** A player with the parts the overrides touch, recording what was saved. */
function fakePlayer() {
    const p = {
        saved: [],
        playbackRate: 1.5,
        controlBarMode: 'overlay',
        loopMode: 'off', loopStart: null, loopEnd: null,
        loopDraws: 0,
        filterState: { brightness: 120 },
        async setPlaybackRate(rate, { persist = true } = {}) {
            p.playbackRate = rate;
            if (persist) p.saved.push(['speed', rate]);
        },
        videoFilters: {
            isActive: () => !!p.filterState,
            getState: () => ({ ...p.filterState }),
            setState: (s) => { p.filterState = { ...s }; },
            reset: () => { p.filterState = null; },
        },
        controlBar: { modes: [], applyMode() { this.modes.push(p.controlBarMode); }, saveMode() { p.saved.push(['controlBarMode']); } },
        setLoop(mode, start, end) { p.loopMode = mode; p.loopStart = start; p.loopEnd = end; p.loopDraws++; },
    };
    return p;
}

console.log('\none override');
{
    const p = fakePlayer();
    const o = new PlayerOverrides(p);
    const release = o.push({ playbackRate: 1, filters: null, controlBarMode: 'fixed' });
    check(p.playbackRate === 1 && p.filterState === null && p.controlBarMode === 'fixed', 'the values are taken on');
    check(o.holds('playbackRate') && !o.holds('loop'), 'holds what it set, and only that');
    release();
    check(p.playbackRate === 1.5, 'speed comes back');
    check(p.filterState?.brightness === 120, 'filters come back');
    check(p.controlBarMode === 'overlay', 'control bar mode comes back');
    check(p.saved.length === 0, 'nothing was saved as the user\'s choice');
    check(!o.holds('playbackRate'), 'nothing held after');
    release();
    check(p.playbackRate === 1.5, 'releasing twice does nothing');
}

console.log('\nstacked, released last first');
{
    const p = fakePlayer();
    const o = new PlayerOverrides(p);
    const a = o.push({ playbackRate: 1 });
    const b = o.push({ playbackRate: 0.5 });
    check(p.playbackRate === 0.5, 'the newer one shows');
    b();
    check(p.playbackRate === 1, 'releasing it shows the one under it');
    a();
    check(p.playbackRate === 1.5, 'releasing that gives back the original');
}

console.log('\nstacked, released first first');
{
    const p = fakePlayer();
    const o = new PlayerOverrides(p);
    const a = o.push({ playbackRate: 1, controlBarMode: 'fixed' });
    const b = o.push({ playbackRate: 0.5 });
    a();
    check(p.playbackRate === 0.5, 'the newer one still shows');
    check(p.controlBarMode === 'overlay', 'what only the older one set comes back');
    b();
    check(p.playbackRate === 1.5, 'and the original after both');
}

console.log('\nseparate values, separate overrides (the edit panel and Export FX)');
{
    const p = fakePlayer();
    const o = new PlayerOverrides(p);
    const view = o.push({ controlBarMode: 'fixed', playbackRate: 1 });
    let filters = o.push({ filters: null });
    filters();                                // Export FX opens: the user's filters back
    check(p.filterState?.brightness === 120 && p.controlBarMode === 'fixed', 'filters back, the rest still held');
    p.videoFilters.setState({ brightness: 80 }); // the user changes them in Export FX
    filters = o.push({ filters: null });         // Export FX closes
    check(p.filterState === null, 'put away again');
    filters(); view();                           // the panel closes
    check(p.filterState?.brightness === 80, 'the filters as the user left them come back');
    check(p.playbackRate === 1.5 && p.controlBarMode === 'overlay', 'and the rest');
}

console.log('\nthe loop (Cut and GIF on the main player)');
{
    const p = fakePlayer();
    p.loopMode = 'all';
    const o = new PlayerOverrides(p);
    const release = o.push({ loop: { mode: p.loopMode, start: p.loopStart, end: p.loopEnd } });
    p.loopMode = 'one'; p.loopStart = 3; p.loopEnd = 7; // setPreviewRange, while held
    release();
    check(p.loopMode === 'all' && p.loopStart === null && p.loopEnd === null, 'the player\'s own loop comes back');
    check(p.loopDraws >= 2, 'and the loop is drawn again');
}

console.log('\nmistakes');
{
    const p = fakePlayer();
    const o = new PlayerOverrides(p);
    let threw = false;
    try { o.push({ volume: 0 }); } catch { threw = true; }
    check(threw, 'a value that cannot be overridden throws');
    check(p.playbackRate === 1.5 && o.layers.length === 0, 'and changes nothing');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

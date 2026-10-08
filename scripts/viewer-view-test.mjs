/**
 * What the viewer's page shows for every state a connection can be in.
 *
 * These are the cases a loopback connection can never produce -- it does not
 * drop, does not recover and does not fail -- and every one of them has been
 * got wrong at least once, in page code where it could not be checked. Here
 * they are just a table.
 *
 *   node scripts/viewer-view-test.mjs
 */
import { viewerView, joiningNote, JOINING_STEPS, FAILED_DETAIL, ENDED_DETAIL }
    from '../assets/js/core/streaming/ViewerView.js';

let pass = 0, fail = 0;
const check = (ok, label) => { if (ok) { pass++; console.log(`  PASS  ${label}`); } else { fail++; console.log(`  FAIL  ${label}`); } };

// ── before a picture has ever arrived, the host just has not pasted the code ──
for (const state of ['new', 'connecting', 'disconnected', 'failed', 'closed']) {
    const v = viewerView({ state, hasWatched: false });
    check(v.panel !== 'problem',
        `${state} before watching never announces a failure (panel=${v.panel})`);
}
check(viewerView({ state: 'failed', hasWatched: false }).waiting,
    'and a failure there says the host has not pasted the code yet');
check(!viewerView({ state: 'connecting', hasWatched: false }).waiting,
    'while merely connecting says nothing at all');

// ── a drop after watching is not the end: it comes back on its own ──
// This is the bug that made a viewer hear the film and not see it -- the page
// declared the party over, and the picture is collapsed behind that panel.
{
    const v = viewerView({ state: 'disconnected', hasWatched: true });
    check(v.panel === null, 'a drop while watching leaves the page where it is');
    check(v.interrupted, 'and says it is reconnecting over the last frame');
    check(!v.over, 'without writing the party off');
}
{
    const back = viewerView({ state: 'connected', hasWatched: true });
    check(back.panel === 'watching', 'coming back returns to the picture');
    check(!back.interrupted, 'and takes the notice away');
}

// ── a connection beyond recovery is the end, and says which end it was ──
{
    const v = viewerView({ state: 'failed', hasWatched: true });
    check(v.panel === 'problem' && v.detail === FAILED_DETAIL,
        'a failed connection after watching is reported as a connection problem');
    check(v.over, 'and the party is over');
}
{
    const v = viewerView({ state: 'closed', hasWatched: true });
    check(v.panel === 'problem' && v.detail === ENDED_DETAIL,
        'a closed one is reported as the host stopping');
    check(v.over, 'and is equally final');
}

// ── and once it is over, nothing brings it back ──
for (const state of ['connected', 'disconnected', 'connecting']) {
    const v = viewerView({ state, hasWatched: true, over: true });
    check(v.panel === null && v.over,
        `${state} after the party is over changes nothing (panel=${v.panel})`);
}
check(!viewerView({ state: 'connected', hasWatched: true, over: true }).interrupted,
    'and shows no reconnecting notice for a party that has ended');

// ── a viewer who never saw a picture cannot "return" to one ──
check(viewerView({ state: 'connected', hasWatched: false }).panel === null,
    'connected before any picture waits for the picture rather than switching views');

// ── and the loading screen says what it is waiting for ──
// A logo on its own for five seconds reads as a page that has hung, which is
// the whole reason there is a line under it.
for (const step of Object.keys(JOINING_STEPS)) {
    check(joiningNote(step).length > 0, `the loading screen has a line for "${step}" (${joiningNote(step)})`);
}
check(joiningNote('reading') !== joiningNote('finding'),
    'and the two steps do not say the same thing, or the screen would look stuck');
check(joiningNote('nonsense') === '' && joiningNote(undefined) === '',
    'an unknown step says nothing rather than blanking the line with undefined');

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);

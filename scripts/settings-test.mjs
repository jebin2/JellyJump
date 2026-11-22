/**
 * Tests the saved preferences (assets/js/shared/settings/Settings.js): the
 * move from the old keys, round trips, blocked storage, and listeners.
 *
 *   node scripts/settings-test.mjs
 */
let pass = 0, fail = 0;
const check = (ok, label) => {
    if (ok) { pass++; console.log(`  PASS  ${label}`); }
    else { fail++; console.log(`  FAIL  ${label}`); }
};

/** A localStorage stand-in. `blocked` makes every call throw, as in some private windows. */
function fakeStorage(initial = {}, { blocked = false } = {}) {
    const data = new Map(Object.entries(initial));
    const guard = () => { if (blocked) throw new Error('SecurityError'); };
    return {
        data,
        getItem: (k) => { guard(); return data.has(k) ? data.get(k) : null; },
        setItem: (k, v) => { guard(); data.set(k, String(v)); },
        removeItem: (k) => { guard(); data.delete(k); },
        clear: () => { guard(); data.clear(); },
        key: (i) => { guard(); return [...data.keys()][i] ?? null; },
        get length() { guard(); return data.size; },
    };
}

let fresh = 0;
/** The module anew, so its one-time move runs against the storage given. */
async function load(storage) {
    globalThis.localStorage = storage;
    return (await import(`../assets/js/shared/settings/Settings.js?fresh=${fresh++}`)).Settings;
}

console.log('\nmoving the old keys');
{
    const s = fakeStorage({
        'jellyjump-speed': '1.5',
        'controlBarMode': 'fixed',
        'jellyjump-debug': '1',
        'jellyjump-edit-history': JSON.stringify({ x: { originalId: 'a', steps: [] } }),
        'jellyjump-remote-libraries': JSON.stringify(['https://lib.example/s/1']),
        'jellyjump-load-guard': JSON.stringify({ id: 'q', at: 5 }),
        'JellyJumpDB-playlist': 'true',                     // the storage layer's marker: left alone
    });
    const Settings = await load(s);
    check(Settings.get('speed') === 1.5, 'speed comes back as a number');
    check(Settings.get('controlBarMode') === 'fixed', 'control bar mode, a bare string before, comes back');
    check(Settings.get('debug') === true, 'the debug flag comes back as true');
    check(Settings.get('editHistory')?.x?.originalId === 'a', 'the edit history comes back as an object');
    check(Settings.get('remoteLibraries')?.[0] === 'https://lib.example/s/1', 'saved library links come back');
    check(Settings.get('loadGuard')?.id === 'q', 'the load guard comes back');
    const oldLeft = ['jellyjump-speed', 'controlBarMode', 'jellyjump-debug', 'jellyjump-edit-history',
        'jellyjump-remote-libraries', 'jellyjump-load-guard'].filter((k) => s.data.has(k));
    check(oldLeft.length === 0, `the old keys are gone (${oldLeft})`);
    check(s.data.get('jj:speed') === '1.5', 'stored under the jj: prefix, as JSON');
    check(s.data.has('JellyJumpDB-playlist'), 'the storage layer\'s marker is left alone');
}

console.log('\na value under the new name wins over an old one');
{
    const s = fakeStorage({ 'jj:speed': '0.5', 'jellyjump-speed': '2' });
    const Settings = await load(s);
    check(Settings.get('speed') === 0.5, 'the new value is kept');
    check(!s.data.has('jellyjump-speed'), 'and the old one dropped');
}

console.log('\nan old value that is not usable');
{
    const s = fakeStorage({ 'jellyjump-speed': 'fast', 'jellyjump-debug': '0' });
    const Settings = await load(s);
    check(Settings.get('speed', 1) === 1, 'a speed that is not a number is not moved; the default applies');
    check(Settings.get('debug', false) === false, 'debug off is not moved');
}

console.log('\nget, set, remove');
{
    const s = fakeStorage();
    const Settings = await load(s);
    check(Settings.get('speed', 1) === 1, 'nothing saved: the default');
    Settings.set('speed', 1.25);
    check(Settings.get('speed', 1) === 1.25, 'a value set reads back');
    Settings.set('editHistory', { a: { steps: [1] } });
    check(Settings.get('editHistory').a.steps[0] === 1, 'an object round-trips');
    Settings.set('speed', null);
    check(Settings.get('speed', 1) === 1 && !s.data.has('jj:speed'), 'setting null removes it');
    Settings.set('loadGuard', { id: 'z' });
    Settings.remove('loadGuard');
    check(Settings.get('loadGuard', null) === null, 'remove removes it');
    let threw = false;
    try { Settings.get('speeed'); } catch { threw = true; }
    check(threw, 'a name that is not a setting throws (a typo is found at once)');
    s.data.set('jj:controlBarMode', '{not json');
    check(Settings.get('controlBarMode', 'overlay') === 'overlay', 'a stored value that is not JSON reads as the default');
}

console.log('\nlisteners');
{
    const Settings = await load(fakeStorage());
    const seen = [];
    const stop = Settings.subscribe('speed', (v) => seen.push(v));
    Settings.set('speed', 2);
    Settings.remove('speed');
    stop();
    Settings.set('speed', 0.5);
    check(seen.length === 2 && seen[0] === 2 && seen[1] === undefined, `told of a set and a remove, not after stopping (${seen})`);
    Settings.subscribe('speed', () => { throw new Error('listener bug'); });
    let ok = true;
    try { Settings.set('speed', 1); } catch { ok = false; }
    check(ok && Settings.get('speed') === 1, 'a listener that throws does not stop the save');
}

console.log('\nblocked storage');
{
    const Settings = await load(fakeStorage({ 'jellyjump-speed': '2' }, { blocked: true }));
    check(Settings.get('speed', 1) === 1, 'reads give the default, without throwing');
    Settings.set('speed', 1.5);
    check(Settings.get('speed', 1) === 1.5, 'a value set is kept in memory for the page');
    Settings.clearAll();
    check(Settings.get('speed', 1) === 1, 'clearAll forgets the in-memory values too');
}

console.log('\nno storage at all (a worker)');
{
    const Settings = await load(undefined);
    check(Settings.get('debug', false) === false, 'reads give the default');
    Settings.set('debug', true);
    check(Settings.get('debug', false) === true, 'and values set are kept in memory');
}

console.log('\nclearAll');
{
    const s = fakeStorage({ 'jj:speed': '2', 'JellyJumpDB-playlist': 'true', other: 'x' });
    const Settings = await load(s);
    Settings.clearAll();
    check(s.data.size === 0, 'empties the site\'s localStorage (reset the app)');
}

console.log('\nwhere each video was left (BUG-5)');
{
    const s = fakeStorage({
        'jellyjump-state-a': JSON.stringify({ videoIdentifier: 'a', timestamp: 42.5, savedAt: '2026-01-02T00:00:00Z' }),
        'jellyjump-state-b': JSON.stringify({ videoIdentifier: 'b', timestamp: 7, savedAt: '2026-01-01T00:00:00Z' }),
        'jellyjump-state-junk': 'not json',
    });
    const Settings = await load(s);
    const { saveProgress, loadProgress, MAX_VIDEOS } = await import(`../assets/js/shared/settings/Progress.js?fresh=${fresh++}`);
    // Progress.js imports its own copy of Settings; read through this one to trigger the move.
    Settings.get('progress');
    check([...s.data.keys()].every((k) => !k.startsWith('jellyjump-state-')), 'the per-video keys are gone');
    const map = JSON.parse(s.data.get('jj:progress'));
    check(map.a?.time === 42.5 && map.b?.time === 7 && !map.junk, 'their times are in one map; one that was not readable is dropped');
    check(loadProgress('a') === 42.5 && loadProgress('none') === null, 'read back by id; nothing saved reads as null');
    saveProgress('c', 3);
    check(loadProgress('c') === 3, 'a new one is saved');
    for (let i = 0; i < MAX_VIDEOS + 20; i++) saveProgress(`v${i}`, i);
    const after = JSON.parse(s.data.get('jj:progress'));
    check(Object.keys(after).length === MAX_VIDEOS, `capped at ${MAX_VIDEOS} videos (${Object.keys(after).length})`);
    check(after[`v${MAX_VIDEOS + 19}`] && !after.a, 'the oldest go first');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

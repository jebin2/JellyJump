/**
 * Tests how a shared library's listing is pulled into the playlist.
 *
 * The failure this guards against was reported from the app: pasting a hosted
 * link filled the list and then made it unusable while the rest downloaded --
 * it kept re-rendering, the scroll position snapped to the top, and expanding a
 * folder or selecting an item was undone a moment later.
 *
 * The cause was one render per batch against a renderer that rebuilds the whole
 * tree. So the assertion that matters here is a count: however many batches
 * arrive, the listing is rendered exactly twice -- once to put the folder on
 * screen, once when it is complete.
 *
 *   node scripts/remote-library-load-test.mjs
 */
import { streamLibraryInto } from '../assets/js/shared/services/RemoteLibraryLoad.js';

let pass = 0, fail = 0;
const check = (ok, label) => {
    if (ok) { pass++; console.log(`  PASS  ${label}`); }
    else { fail++; console.log(`  FAIL  ${label}`); }
};

const URL_A = 'http://192.168.1.5:8790/?token=abc';

/** A harness standing in for the playlist: counts what the loader does to it. */
function harness() {
    const h = {
        items: [],
        loading: new Set(),
        renders: 0,
        progress: [],
        announced: 0,
        itemsAtAnnounce: null,
        loadingAtFirstRender: null,
        loadingAtLastRender: null,
    };
    h.deps = {
        addItems: (batch) => h.items.push(...batch),
        render: () => {
            h.renders++;
            if (h.renders === 1) h.loadingAtFirstRender = h.loading.has(URL_A);
            h.loadingAtLastRender = h.loading.has(URL_A);
        },
        setLoading: (source, on) => { on ? h.loading.add(source) : h.loading.delete(source); },
        onProgress: (source, count) => h.progress.push(count),
        onAnnounce: () => { h.announced++; h.itemsAtAnnounce ??= h.items.length; },
    };
    return h;
}

/** Yields `batches` batches of `size` items, the way the real fetch streams. */
function fakeFetch(batches, size, { complete = true, throwAfter = null } = {}) {
    return async (url, onBatch) => {
        let total = 0;
        for (let b = 0; b < batches; b++) {
            if (throwAfter !== null && b === throwAfter) {
                throw new Error('connection dropped');
            }
            const batch = [];
            for (let i = 0; i < size; i++) {
                batch.push({ title: `file-${b}-${i}.mp4`, path: `Lib/file-${b}-${i}.mp4` });
            }
            onBatch(batch);
            total += size;
        }
        return { total, complete, expected: total };
    };
}

console.log('\nstreaming a library into the playlist');

// --- the bug itself -------------------------------------------------------
{
    const h = harness();
    const result = await streamLibraryInto(URL_A, {
        ...h.deps, fetchStreaming: fakeFetch(10, 5),
    });

    check(h.renders === 2, `ten batches render twice, not eleven (got ${h.renders})`);
    check(h.items.length === 50, `every item still arrives (got ${h.items.length})`);
    check(result.streamed === 50, `streamed count reported (got ${result.streamed})`);
    check(result.total === 50, 'the fetch result is passed through');
}

// --- the folder appears early, and only once ------------------------------
{
    const h = harness();
    await streamLibraryInto(URL_A, { ...h.deps, fetchStreaming: fakeFetch(6, 4) });

    check(h.announced === 1, `announced exactly once (got ${h.announced})`);
    check(h.itemsAtAnnounce === 4,
        `announced after the first batch is in the model (had ${h.itemsAtAnnounce})`);
    check(h.loadingAtFirstRender === true,
        'the first render happens while the row is still marked loading');
    check(h.loadingAtLastRender === false,
        'the closing render happens after the flag clears, so the arrow is back');
}

// --- progress replaces the per-batch render -------------------------------
{
    const h = harness();
    await streamLibraryInto(URL_A, { ...h.deps, fetchStreaming: fakeFetch(4, 3) });

    check(h.progress.length === 3,
        `progress fires for every batch after the first (got ${h.progress.length})`);
    check(h.progress.join(',') === '6,9,12',
        `progress counts are cumulative (got ${h.progress.join(',')})`);
}

// --- ids ------------------------------------------------------------------
{
    const h = harness();
    await streamLibraryInto(URL_A, { ...h.deps, fetchStreaming: fakeFetch(3, 2) });

    check(h.items.every(i => typeof i.id === 'string' && i.id.length > 0),
        'every item is given an id');
    check(new Set(h.items.map(i => i.id)).size === h.items.length,
        'the ids are distinct');
}

// --- a listing that fails half way ----------------------------------------
{
    const h = harness();
    let threw = false;
    try {
        await streamLibraryInto(URL_A, {
            ...h.deps, fetchStreaming: fakeFetch(10, 5, { throwAfter: 3 }),
        });
    } catch { threw = true; }

    check(threw, 'the failure still reaches the caller');
    check(h.loading.has(URL_A) === false,
        'the loading flag is cleared, so the row cannot spin forever');
    check(h.renders === 2, `the partial library is rendered (got ${h.renders} renders)`);
    check(h.items.length === 15, `what did arrive is kept (got ${h.items.length})`);
}

// --- an empty library -----------------------------------------------------
{
    const h = harness();
    const result = await streamLibraryInto(URL_A, {
        ...h.deps, fetchStreaming: fakeFetch(0, 0),
    });

    check(result.streamed === 0, 'nothing streamed');
    check(h.announced === 0, 'nothing is announced when there is nothing to show');
    check(h.loading.has(URL_A) === false, 'the flag is cleared for an empty library too');
    check(h.renders === 1, `one closing render (got ${h.renders})`);
}

// --- empty batches are not mistaken for the first one ---------------------
{
    const h = harness();
    await streamLibraryInto(URL_A, {
        ...h.deps,
        fetchStreaming: async (url, onBatch) => {
            onBatch([]);
            onBatch(null);
            onBatch([{ title: 'a.mp4', path: 'Lib/a.mp4' }]);
            return { total: 1, complete: true, expected: 1 };
        },
    });

    check(h.announced === 1, 'an empty batch does not announce the folder');
    check(h.itemsAtAnnounce === 1,
        `the folder is announced only once there is a row in it (had ${h.itemsAtAnnounce})`);
    check(h.renders === 2, `an empty batch does not cause a render (got ${h.renders})`);
}

// --- the optional callbacks really are optional ---------------------------
{
    const h = harness();
    let ok = true;
    try {
        await streamLibraryInto(URL_A, {
            fetchStreaming: fakeFetch(3, 2),
            addItems: h.deps.addItems,
            render: h.deps.render,
            setLoading: h.deps.setLoading,
        });
    } catch { ok = false; }
    check(ok, 'works without onProgress or onAnnounce');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);

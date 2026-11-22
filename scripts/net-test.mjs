/**
 * Tests fetchWithPolicy (assets/js/shared/net/fetchWithPolicy.js): time
 * limits, retries for GET, error codes, and cancelling, with `fetch`
 * replaced by a script of answers.
 *
 *   node scripts/net-test.mjs
 */
import { fetchWithPolicy } from '../assets/js/shared/net/fetchWithPolicy.js';

let pass = 0, fail = 0;
const check = (ok, label) => {
    if (ok) { pass++; console.log(`  PASS  ${label}`); }
    else { fail++; console.log(`  FAIL  ${label}`); }
};

/**
 * `fetch` answering from a list, one entry per call: a status, 'drop' (the
 * connection fails), or 'hang' (no answer until aborted).
 */
function script(...answers) {
    const calls = [];
    globalThis.fetch = (url, init) => {
        calls.push(init);
        const answer = answers[Math.min(calls.length - 1, answers.length - 1)];
        if (answer === 'drop') return Promise.reject(new TypeError('Failed to fetch'));
        if (answer === 'hang') {
            return new Promise((_, reject) => init.signal.addEventListener('abort',
                () => reject(new DOMException('The operation was aborted.', 'AbortError'))));
        }
        return Promise.resolve(new Response(String(answer), { status: answer }));
    };
    return calls;
}
const setOnline = (online) => Object.defineProperty(globalThis, 'navigator', { value: { onLine: online }, configurable: true });
const codeOf = async (promise) => { try { await promise; return 'none'; } catch (e) { return e.name === 'AbortError' ? e.name : e.code; } };
const fast = { backoffMs: 1 };

setOnline(true);

console.log('\nanswers');
{
    let calls = script(200);
    const r = await fetchWithPolicy('https://a.example/x', fast);
    check(r.status === 200 && calls.length === 1, 'a 200 comes back after one request');

    calls = script(404);
    const notFound = await fetchWithPolicy('https://a.example/x', fast);
    check(notFound.status === 404 && calls.length === 1, 'a 404 comes back as it is, not retried: the caller decides what it means');

    calls = script(503, 502, 200);
    const later = await fetchWithPolicy('https://a.example/x', fast);
    check(later.status === 200 && calls.length === 3, 'a 5xx is retried, and the later 200 comes back');

    calls = script(503);
    const still = await fetchWithPolicy('https://a.example/x', fast);
    check(still.status === 503 && calls.length === 3, 'after the retries, the last answer comes back (1 + 2 retries)');

    calls = script(429, 200);
    check((await fetchWithPolicy('https://a.example/x', fast)).status === 200, '429 (too many requests) is retried too');
}

console.log('\nfailures');
{
    let calls = script('drop', 200);
    check((await fetchWithPolicy('https://a.example/x', fast)).status === 200 && calls.length === 2, 'a dropped connection is retried');

    calls = script('drop');
    check(await codeOf(fetchWithPolicy('https://a.example/x', fast)) === 'NETWORK' && calls.length === 3, 'one that keeps failing is NETWORK, after the retries');

    calls = script('hang');
    const started = Date.now();
    check(await codeOf(fetchWithPolicy('https://a.example/x', { ...fast, timeoutMs: 50, retries: 0 })) === 'TIMEOUT', 'no answer in time is TIMEOUT');
    check(Date.now() - started < 1000, 'and it does not wait longer than the limit');

    setOnline(false);
    calls = script('drop');
    check(await codeOf(fetchWithPolicy('https://a.example/x', fast)) === 'OFFLINE' && calls.length === 1, 'offline is OFFLINE, and not retried');
    setOnline(true);

    calls = script('drop');
    check(await codeOf(fetchWithPolicy('https://a.example/x', { ...fast, method: 'POST', body: 'x' })) === 'NETWORK' && calls.length === 1,
        'a POST is never sent twice');
}

console.log('\ncancelling');
{
    const controller = new AbortController();
    script('hang');
    const pending = fetchWithPolicy('https://a.example/x', { signal: controller.signal });
    setTimeout(() => controller.abort(), 20);
    check(await codeOf(pending) === 'AbortError', 'cancelling stops it, as a cancellation, not a failure');

    const retrying = new AbortController();
    const calls = script(503);
    const p = fetchWithPolicy('https://a.example/x', { backoffMs: 200, signal: retrying.signal });
    setTimeout(() => retrying.abort(), 50);
    check(await codeOf(p) === 'AbortError' && calls.length === 1, 'cancelling while waiting to retry stops the retries');

    const done = new AbortController();
    done.abort();
    script(200);
    check(await codeOf(fetchWithPolicy('https://a.example/x', { signal: done.signal })) === 'AbortError', 'already cancelled: nothing is sent');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

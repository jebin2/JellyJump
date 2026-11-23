/**
 * The "new version is live" check (assets/js/shared/utils/UpdateCheck.js,
 * plan P6): a tab running one build, the server answering with another.
 *
 *   node scripts/update-check-test.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createUpdateChecker, MIN_INTERVAL_MS } from '../assets/js/shared/utils/UpdateCheck.js';

let pass = 0, fail = 0;
const check = (ok, label) => {
    if (ok) { pass++; console.log(`  PASS  ${label}`); }
    else { fail++; console.log(`  FAIL  ${label}`); }
};

/** A tab on build `a`, a server whose version.json is whatever `live` says. */
function setup({ checkedAt } = {}) {
    const t = { now: 0, live: { version: '1.0.0', build: 'a' }, reads: 0, offers: [] };
    t.checker = createUpdateChecker({
        currentBuild: 'a',
        fetchInfo: async () => {
            t.reads++;
            if (t.live instanceof Error) throw t.live;
            return t.live;
        },
        onNewBuild: (info) => t.offers.push(info.build),
        now: () => t.now,
        checkedAt,
    });
    return t;
}

console.log('\ntwo builds');
{
    const t = setup();
    await t.checker.check();
    check(t.reads === 1 && t.offers.length === 0, 'the same build live: nothing offered');
    t.live = { version: '1.1.0', build: 'b' };
    t.now += MIN_INTERVAL_MS;
    const found = await t.checker.check();
    check(found?.build === 'b' && t.offers.join() === 'b', 'a new build live: offered once');
    t.now += MIN_INTERVAL_MS;
    await t.checker.check();
    check(t.reads === 3 && t.offers.length === 1, 'the same new build is not offered again');
    t.live = { version: '1.2.0', build: 'c' };
    t.now += MIN_INTERVAL_MS;
    await t.checker.check();
    check(t.offers.join() === 'b,c', 'a newer one after it is');
}

console.log('\nhow often');
{
    const t = setup({ checkedAt: 0 });
    await t.checker.check();
    check(t.reads === 0, 'not right after loading: the build just loaded is the newest');
    t.now = MIN_INTERVAL_MS - 1;
    await t.checker.check();
    check(t.reads === 0, 'not before the interval is up');
    t.now = MIN_INTERVAL_MS;
    await t.checker.check();
    check(t.reads === 1, 'once it is');
    await t.checker.check();
    check(t.reads === 1, 'focus and visibility firing together read once');
}

console.log('\nwhen it cannot tell');
{
    for (const [label, live] of [
        ['offline (fetch throws)', new Error('Failed to fetch')],
        ['no file (404 reads as null)', null],
        ['a file without a build', { version: '9' }],
    ]) {
        const t = setup();
        t.live = live;
        const found = await t.checker.check();
        check(found === null && t.offers.length === 0, `${label}: nothing offered, no error`);
    }
}

console.log('\nthe build writes it');
{
    const file = join(import.meta.dirname, '../dist/version.json');
    if (existsSync(file)) {
        const info = JSON.parse(readFileSync(file, 'utf8'));
        check(typeof info.build === 'string' && info.build.length > 0, `dist/version.json has a build id (${info.build})`);
        check(/^\d+\.\d+\.\d+/.test(info.version), `and a version (${info.version})`);
    } else {
        console.log('  (no dist/: run after npm run build to check version.json)');
    }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

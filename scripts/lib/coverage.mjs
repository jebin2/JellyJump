/**
 * Browser coverage for a test suite, when the runner asks for it
 * (JJ_COVERAGE_DIR set: scripts/run-tests.mjs). Chromium's own block
 * coverage, the same format Node writes for NODE_V8_COVERAGE, so
 * scripts/coverage-report.mjs reads both.
 *
 * A suite on the vite dev server reports the source files themselves; one
 * on the built app reports its chunks, which the report carries back to the
 * sources through their source maps.
 *
 * A page that navigates or reloads drops the coverage of the scripts it
 * had, so `goto` and `reload` take what there is first.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = process.env.JJ_COVERAGE_DIR;
const OPTIONS = { resetOnNavigation: false, reportAnonymousScripts: false };
/** @type {WeakMap<object, Array<{url: string, functions: object[]}>>} */
const taken = new WeakMap();

async function checkpoint(page) {
    const entries = await page.coverage.stopJSCoverage();
    taken.get(page)?.push(...entries.map(({ url, functions }) => ({ url, functions })));
    await page.coverage.startJSCoverage(OPTIONS);
}

/** @param {import('playwright-core').Page} page */
export async function startCoverage(page) {
    if (!DIR) return;
    taken.set(page, []);
    await page.coverage.startJSCoverage(OPTIONS);
    for (const method of ['goto', 'reload']) {
        const original = page[method].bind(page);
        page[method] = async (...args) => {
            try { await checkpoint(page); } catch { /* coverage is a bonus, never a failure */ }
            return original(...args);
        };
    }
}

/** @param {import('playwright-core').Page} page @param {string} name */
export async function saveCoverage(page, name) {
    if (!DIR || !taken.has(page)) return;
    try {
        await checkpoint(page);
        await page.coverage.stopJSCoverage().catch(() => {});
        mkdirSync(DIR, { recursive: true });
        writeFileSync(join(DIR, `browser-${name}-${process.pid}.json`), JSON.stringify({ result: taken.get(page) }));
    } catch (error) {
        console.log(`  (coverage not saved: ${error.message})`);
    }
}

// @ts-check
/**
 * Timings and counts the app keeps about itself, on the device only
 * (ARCHITECTURE_PLAN.md §3.7, P3). Shown in Diagnostics and copied into a bug
 * report; never sent anywhere.
 *
 *   Metrics.record('firstFrame', 182)          // a value, in its unit
 *   const stop = Metrics.start('job:Cut'); … stop();
 *   Metrics.count('droppedFrames')
 *
 * Each name keeps its last KEEP values. Timings are also written as
 * `performance.measure` entries (prefixed `jj:`), so they line up with
 * everything else in the browser's performance panel.
 */

/** Values kept per name. */
export const KEEP = 50;

/** @type {Map<string, {unit: string, values: number[]}>} */
const series = new Map();
/** @type {Map<string, number>} */
const counters = new Map();

/** @returns {number} */
const now = () => globalThis.performance?.now() ?? Date.now();

/**
 * @param {number[]} sorted
 * @param {number} q 0..1
 */
function quantile(sorted, q) {
    if (!sorted.length) return NaN;
    return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

export const Metrics = {
    /**
     * @param {string} name
     * @param {number} value
     * @param {string} [unit]
     */
    record(name, value, unit = 'ms') {
        if (!Number.isFinite(value)) return;
        let entry = series.get(name);
        if (!entry) series.set(name, entry = { unit, values: [] });
        entry.values.push(value);
        if (entry.values.length > KEEP) entry.values.shift();
    },

    /**
     * Time something. The returned function records the time since this
     * call and returns it.
     * @param {string} name
     * @returns {() => number}
     */
    start(name) {
        const startedAt = now();
        return () => {
            const end = now();
            Metrics.record(name, end - startedAt);
            try { globalThis.performance?.measure?.(`jj:${name}`, { start: startedAt, end }); } catch { /* old browser */ }
            return end - startedAt;
        };
    },

    /**
     * @param {string} name
     * @param {number} [n]
     */
    count(name, n = 1) {
        counters.set(name, (counters.get(name) ?? 0) + n);
    },

    /**
     * Each series as count, last, median, 95th percentile and worst, and the
     * counters.
     */
    summary() {
        /** @type {Record<string, {unit: string, count: number, last: number, median: number, p95: number, max: number}>} */
        const values = {};
        for (const [name, { unit, values: list }] of series) {
            const sorted = [...list].sort((a, b) => a - b);
            values[name] = {
                unit,
                count: list.length,
                last: list[list.length - 1],
                median: quantile(sorted, 0.5),
                p95: quantile(sorted, 0.95),
                max: sorted[sorted.length - 1],
            };
        }
        return { values, counters: Object.fromEntries(counters) };
    },

    /** For tests. */
    clear() {
        series.clear();
        counters.clear();
    },
};

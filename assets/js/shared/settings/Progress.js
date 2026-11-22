// @ts-check
/**
 * Where each video was left, to start it there next time.
 *
 * It was one `localStorage` key per video ever played
 * (`jellyjump-state-<id>`), never removed (BUG-5). It is now one map in the
 * settings, `progress`, holding the last MAX_VIDEOS videos; older ones are
 * dropped as new ones are played. The old keys are moved into it once.
 */
import { Settings, PROGRESS_CAP, capProgress } from './Settings.js';

export const MAX_VIDEOS = PROGRESS_CAP;

/** @typedef {Record<string, {time: number, at: number}>} ProgressMap */

/** @returns {ProgressMap} */
function read() {
    const map = Settings.get('progress', {});
    return map && typeof map === 'object' ? map : {};
}

/**
 * @param {string} id - the playlist item's id
 * @param {number} time - seconds
 */
export function saveProgress(id, time) {
    if (!id || !Number.isFinite(time)) return;
    const map = read();
    map[id] = { time, at: Date.now() };
    Settings.set('progress', capProgress(map));
}

/**
 * @param {string} id
 * @returns {number|null} seconds, or null when nothing is saved
 */
export function loadProgress(id) {
    const entry = id ? read()[id] : null;
    return entry && Number.isFinite(entry.time) ? entry.time : null;
}

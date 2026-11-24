// @ts-check
/**
 * The user's saved preferences, in one place (ARCHITECTURE_PLAN.md §3.4).
 *
 * Before this, each file wrote its own `localStorage` key under its own name
 * (`jellyjump-speed`, `controlBarMode`, `jellyjump-edit-history`, …), and
 * anything that changed a value for a while — the edit panel setting the
 * speed to 1× — saved it as if the user had chosen it. Now every preference
 * has a name here, is stored under one prefix (`jj:`), and is written only by
 * code acting for the user. A value needed for a while goes through the
 * player's overrides (`player.override()`), which never come here.
 *
 *   Settings.get('speed', 1)
 *   Settings.set('speed', 1.5)
 *   const stop = Settings.subscribe('speed', (value) => …)
 *
 * Values are stored as JSON. Storage that is blocked (some private windows)
 * or absent (workers) does not break anything: values are then kept in memory
 * for the life of the page.
 *
 * The old keys are read once, on first use, and moved to the new names.
 *
 * A pull request's preview, served from the live site's domain, keeps its
 * values under its own prefix (`jj-pr-81:`), never moves the old keys, and
 * resets only its own (config.storageNamespace).
 */
import { config } from '../config/index.js';

/** @typedef {import('../types.js').SettingsValues} SettingsValues */
/** @typedef {import('../types.js').SettingName} SettingName */

/**
 * Every preference, with the key it was kept under before (moved once).
 * A name that is not here is a mistake, and `get`/`set` throw for it.
 * @type {Record<string, {old?: string, legacy?: (raw: string) => unknown}>}
 */
const KEYS = {
    /** Playback speed, 0.25–2. */
    speed: { old: 'jellyjump-speed', legacy: (raw) => Number.parseFloat(raw) || undefined },
    /** Control bar laid over the picture (`overlay`) or below it (`fixed`). */
    controlBarMode: { old: 'controlBarMode', legacy: (raw) => raw },
    /** Logging on outside localhost (`?debug=1`). */
    debug: { old: 'jellyjump-debug', legacy: (raw) => raw === '1' || undefined },
    /** The edit panel's Undo history, per working copy (EditPanel). */
    editHistory: { old: 'jellyjump-edit-history' },
    /** Shared-library links to open again on the next load (RemoteLibrary). */
    remoteLibraries: { old: 'jellyjump-remote-libraries' },
    /** The item being loaded, so a load that crashed the page is not retried on the next start (Playlist). */
    loadGuard: { old: 'jellyjump-load-guard' },
    /** Where each video was left, by item id: {time, at} (Progress.js). */
    progress: {},
};

/** One key per video before `progress` (BUG-5), moved into it once. */
const OLD_PROGRESS_PREFIX = 'jellyjump-state-';

const NAMESPACE = config.storageNamespace;
const PREFIX = NAMESPACE ? `jj-${NAMESPACE}:` : 'jj:';
/** How many videos' progress is kept (Progress.js). */
export const PROGRESS_CAP = 200;

/** @type {Map<string, unknown>} values for when storage cannot be used */
const memory = new Map();
/** @type {Map<string, Set<(value: unknown) => void>>} */
const listeners = new Map();
let migrated = false;

/** @returns {Storage|null} */
function store() {
    try {
        return globalThis.localStorage ?? null;
    } catch {
        return null; // the getter itself throws when storage is blocked
    }
}

/** @param {string} name */
function check(name) {
    if (!Object.hasOwn(KEYS, name)) throw new Error(`Unknown setting: ${name}`);
}

/** @param {string} raw */
function parseOld(raw) {
    try { return JSON.parse(raw); } catch { return raw; }
}

/** Move the values kept under the old names. Runs once, on first use. */
function migrate() {
    if (migrated) return;
    migrated = true;
    const s = store();
    // The old keys are the live site's; a preview leaves them for it.
    if (!s || NAMESPACE) return;
    for (const [name, { old, legacy }] of Object.entries(KEYS)) {
        if (!old) continue;
        try {
            const raw = s.getItem(old);
            if (raw === null) continue;
            if (s.getItem(PREFIX + name) === null) {
                const value = legacy ? legacy(raw) : parseOld(raw);
                if (value !== undefined && value !== null) s.setItem(PREFIX + name, JSON.stringify(value));
            }
            s.removeItem(old);
        } catch { /* blocked or full: the old key stays and is tried again next load */ }
    }
    migrateProgress(s);
}

/**
 * The per-video keys, into one map. Only what fits the map's cap is kept;
 * the keys all go.
 * @param {Storage} s
 */
function migrateProgress(s) {
    try {
        const old = [];
        for (let i = 0; i < s.length; i++) {
            const key = s.key(i);
            if (key?.startsWith(OLD_PROGRESS_PREFIX)) old.push(key);
        }
        if (!old.length) return;
        const raw = s.getItem(PREFIX + 'progress');
        /** @type {Record<string, {time: number, at: number}>} */
        const map = (raw && JSON.parse(raw)) || {};
        for (const key of old) {
            try {
                const value = JSON.parse(s.getItem(key) ?? 'null');
                const id = key.slice(OLD_PROGRESS_PREFIX.length);
                if (Number.isFinite(value?.timestamp) && !map[id]) {
                    map[id] = { time: value.timestamp, at: Date.parse(value.savedAt) || 0 };
                }
            } catch { /* not ours */ }
        }
        s.setItem(PREFIX + 'progress', JSON.stringify(capProgress(map)));
        for (const key of old) s.removeItem(key);
    } catch { /* blocked or full: tried again next load */ }
}

/**
 * The most recently played PROGRESS_CAP videos of a progress map, the rest
 * dropped (Progress.js, and the move from the old keys).
 * @param {Record<string, {time: number, at: number}>} map
 */
export function capProgress(map) {
    const ids = Object.keys(map).sort((a, b) => map[b].at - map[a].at);
    for (const id of ids.slice(PROGRESS_CAP)) delete map[id];
    return map;
}

/** @param {string} name @param {unknown} value */
function notify(name, value) {
    for (const fn of listeners.get(name) ?? []) {
        // A listener's mistake is reported like any uncaught error (ErrorReporter)
        // and does not stop the others. Not through Logger: Logger reads its
        // own flag from here.
        try { fn(value); } catch (error) { globalThis.reportError?.(error); }
    }
}

export const Settings = {
    /**
     * @template {SettingName} K
     * @param {K} name
     * @param {SettingsValues[K]|null} [fallback] - returned when nothing is saved
     * @returns {SettingsValues[K]|null|undefined} the saved value, else `fallback`
     */
    get(name, fallback) {
        check(name);
        migrate();
        if (memory.has(name)) return /** @type {SettingsValues[K]} */ (memory.get(name));
        const s = store();
        if (!s) return fallback;
        try {
            const raw = s.getItem(PREFIX + name);
            return raw === null ? fallback : JSON.parse(raw);
        } catch {
            return fallback; // blocked, or a value that is not ours
        }
    },

    /**
     * Save a preference. Only for a change the user made; `null` or
     * `undefined` removes it.
     * @template {SettingName} K
     * @param {K} name
     * @param {SettingsValues[K]|null|undefined} value
     */
    set(name, value) {
        check(name);
        migrate();
        if (value === undefined || value === null) return Settings.remove(name);
        const s = store();
        try {
            if (!s) throw new Error('no storage');
            s.setItem(PREFIX + name, JSON.stringify(value));
            memory.delete(name);
        } catch {
            memory.set(name, value); // kept for this page only
        }
        notify(name, value);
    },

    /** @param {string} name */
    remove(name) {
        check(name);
        migrate();
        memory.delete(name);
        try { store()?.removeItem(PREFIX + name); } catch { /* blocked */ }
        notify(name, undefined);
    },

    /**
     * Be told when a preference changes, in this tab or another one.
     * @param {string} name
     * @param {(value: unknown) => void} fn
     * @returns {() => void} stop listening
     */
    subscribe(name, fn) {
        check(name);
        if (!listeners.has(name)) listeners.set(name, new Set());
        listeners.get(name)?.add(fn);
        return () => { listeners.get(name)?.delete(fn); };
    },

    /**
     * Forget everything this site keeps in `localStorage`: preferences and
     * the storage layer's own markers. For "reset the app" only. A preview
     * forgets only its own keys, not the live site's.
     */
    clearAll() {
        memory.clear();
        try {
            const s = store();
            if (!s) return;
            if (!NAMESPACE) { s.clear(); return; }
            const ours = [];
            for (let i = 0; i < s.length; i++) {
                const key = s.key(i);
                if (key?.startsWith(PREFIX) || key?.startsWith(`JellyJumpDB-${NAMESPACE}`)) ours.push(key);
            }
            for (const key of ours) s.removeItem(key);
        } catch { /* blocked */ }
    },

    /** The names there are, for tests and diagnostics. */
    names() {
        return Object.keys(KEYS);
    },
};

// Another tab changed a preference.
globalThis.addEventListener?.('storage', (event) => {
    const key = /** @type {StorageEvent} */ (event).key;
    if (!key?.startsWith(PREFIX)) return;
    const name = key.slice(PREFIX.length);
    if (!Object.hasOwn(KEYS, name)) return;
    notify(name, Settings.get(/** @type {SettingName} */ (name)));
});

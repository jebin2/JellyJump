// @ts-check
/**
 * The player's event list (`player.on`, `off`, `trigger`). The events and
 * when they fire: PlayerStateEvents.js.
 */

/** @param {any} player @param {string} event @param {(data: any) => void} callback */
export function onPlayerEvent(player, event, callback) {
    if (!player._events[event]) player._events[event] = [];
    player._events[event].push(callback);
}

/** @param {any} player @param {string} event @param {(data: any) => void} callback */
export function offPlayerEvent(player, event, callback) {
    if (!player._events[event]) return;
    player._events[event] = player._events[event].filter((/** @type {Function} */ cb) => cb !== callback);
}

/**
 * Call every listener. One that throws is reported like any uncaught error
 * (ErrorReporter) and does not stop the others, or the playback code that
 * fired the event.
 * @param {any} player @param {string} event @param {Object} [data]
 */
export function triggerPlayerEvent(player, event, data = {}) {
    const listeners = player._events?.[event];
    if (!listeners) return;
    for (const callback of [...listeners]) {
        try { callback(data); } catch (error) { globalThis.reportError?.(error); }
    }
}

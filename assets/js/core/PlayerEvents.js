// @ts-check
/**
 * The player's event list (`player.on`, `off`, `trigger`). The events and
 * when they fire: PlayerStateEvents.js.
 */

/** Listeners by event name, per player. @type {WeakMap<object, Record<string, Function[]>>} */
const listenersByPlayer = new WeakMap();

/** @param {object} player */
function listenersOf(player) {
    let listeners = listenersByPlayer.get(player);
    if (!listeners) listenersByPlayer.set(player, listeners = {});
    return listeners;
}

/** @param {any} player @param {string} event @param {(data: any) => void} callback */
export function onPlayerEvent(player, event, callback) {
    (listenersOf(player)[event] ??= []).push(callback);
}

/** @param {any} player @param {string} event @param {(data: any) => void} callback */
export function offPlayerEvent(player, event, callback) {
    const listeners = listenersOf(player);
    if (!listeners[event]) return;
    listeners[event] = listeners[event].filter((cb) => cb !== callback);
}

/** Drop every listener (the player is being destroyed). @param {any} player */
export function clearPlayerEvents(player) {
    listenersByPlayer.delete(player);
}

/**
 * Call every listener. One that throws is reported like any uncaught error
 * (ErrorReporter) and does not stop the others, or the playback code that
 * fired the event.
 * @param {any} player @param {string} event @param {Object} [data]
 */
export function triggerPlayerEvent(player, event, data = {}) {
    const listeners = listenersByPlayer.get(player)?.[event];
    if (!listeners) return;
    for (const callback of [...listeners]) {
        try { callback(data); } catch (error) { globalThis.reportError?.(error); }
    }
}

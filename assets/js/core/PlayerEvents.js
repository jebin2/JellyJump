export function onPlayerEvent(player, event, callback) {
    if (!player._events[event]) player._events[event] = [];
    player._events[event].push(callback);
}

export function offPlayerEvent(player, event, callback) {
    if (!player._events[event]) return;
    player._events[event] = player._events[event].filter(cb => cb !== callback);
}

export function triggerPlayerEvent(player, event, data = {}) {
    if (!player._events[event]) return;
    player._events[event].forEach(callback => callback(data));
}

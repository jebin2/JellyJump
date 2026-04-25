import { PlayerStream } from './PlayerStream.js';

export function createStreamController(player) {
    return new PlayerStream(player);
}

export function getStreamState(player, key) {
    return player.stream[key];
}

export function setStreamState(player, key, value) {
    player.stream[key] = value;
}

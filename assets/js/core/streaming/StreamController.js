import { PlayerStream } from './PlayerStream.js';

const STREAM_STATE_KEYS = [
    'isStreamMode',
    'isLive',
    'streamVideo',
    'isWebcamMode',
    '_liveStartTimestamp',
    '_wasMutedForAutoplay',
    '_isMediaReady'
];

export function createStreamController(player) {
    return new PlayerStream(player);
}

export function getStreamState(player, key) {
    return player.stream[key];
}

export function setStreamState(player, key, value) {
    player.stream[key] = value;
}

export function installStreamStateProxies(player) {
    const descriptors = {};

    for (const key of STREAM_STATE_KEYS) {
        descriptors[key] = {
            configurable: true,
            enumerable: false,
            get() {
                return getStreamState(this, key);
            },
            set(value) {
                setStreamState(this, key, value);
            }
        };
    }

    Object.defineProperties(player, descriptors);
}

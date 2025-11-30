/**
 * Player Configuration
 * Default settings for the JellyJump Player.
 */

export const PLAYER_CONFIG = {
    // Playback
    autoplay: false,
    loop: false,
    muted: false,
    volume: 1.0,
    playbackRate: 1.0,

    // UI
    theme: 'dark',
    showControls: true,
    mode: 'player', // 'player' or 'editor'

    // Advanced
    bufferSize: 30, // seconds
    maxRetries: 3,
};

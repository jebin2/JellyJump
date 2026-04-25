import { AudioEqualizer } from '../../player/AudioEqualizer.js';

export function initPlayerAudio(player) {
    if (player.isAudioInitialized) return;

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    player.audioContext = new AudioContext();

    player.gainNode = player.audioContext.createGain();

    if (player.config.controls.equalizer) {
        player.audioEqualizer = new AudioEqualizer(player.audioContext);
        player.audioEqualizer.init();
        const eqOutput = player.audioEqualizer.getOutputNode();

        // Source connection still happens later during audio scheduling.
        eqOutput.connect(player.gainNode);
    }

    player.gainNode.connect(player.audioContext.destination);
    player.gainNode.gain.value = player.config.muted ? 0 : player.config.volume;

    if (!player.audioVisualizer && player.canvas) {
        import('../../player/AudioVisualizer.js').then(({ AudioVisualizer }) => {
            if (!player.audioVisualizer && player.canvas && player.audioContext && player.gainNode) {
                player.audioVisualizer = new AudioVisualizer(player.canvas);
                player.audioVisualizer.connect(player.audioContext, player.gainNode);
            }
        });
    }

    player.isInitialized = true;
    player.isAudioInitialized = true;
}

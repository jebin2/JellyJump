import { AudioEqualizer } from './AudioEqualizer.js';
import { Logger } from '../../utils/Logger.js';


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

export async function startPlayerAudioVisualizer(player) {
    if (!player.isAudioMode) return;

    if (!player.audioVisualizer && player.canvas) {
        const { AudioVisualizer } = await import('../../player/AudioVisualizer.js');
        player.audioVisualizer = new AudioVisualizer(player.canvas);
        player.audioVisualizer.connect(player.audioContext, player.gainNode);
    }
    if (player.audioVisualizer) {
        player.audioVisualizer.start();
    }
}

export async function runPlayerAudioIterator(player, iterator, anchorWall, anchorContent, prefetchedSample) {
    if (!player.audioSink || !iterator) return;

    if (anchorWall !== undefined) player._vodAnchorWall = anchorWall;
    if (anchorContent !== undefined) player._vodAnchorContent = anchorContent;

    const myIterator = iterator;
    const isLiveMode = anchorWall !== undefined && anchorContent !== undefined;

    let nextAudioTime;
    if (isLiveMode && prefetchedSample) {
        nextAudioTime = anchorWall + (prefetchedSample.timestamp - anchorContent);
    } else if (isLiveMode) {
        nextAudioTime = anchorWall + (player.audioContext.currentTime - anchorWall);
    } else {
        nextAudioTime = (player.audioContext?.currentTime || 0) + 0.1;
    }

    let sampleCount = 0;
    let firstSampleScheduled = false;
    const _audioLogTag = player.isLive ? 'Live' : 'VOD';

    Logger.log(`[${_audioLogTag}:Audio] Iterator started — anchorWall=${anchorWall?.toFixed(3)}, anchorContent=${anchorContent?.toFixed(3)}, nextAudioTime=${nextAudioTime.toFixed(3)}, audioCtx=${player.audioContext?.currentTime?.toFixed(3)}, audioCtxState=${player.audioContext?.state}`);

    const scheduleOne = (audioSample) => {
        if (!player.isPlaying) { audioSample.close(); return; }

        const buffer = audioSample.toAudioBuffer();
        const timestamp = audioSample.timestamp;
        audioSample.close();

        const audioSource = player.audioContext.createBufferSource();
        audioSource.buffer = buffer;
        audioSource.playbackRate.value = player.playbackRate;

        if (player.audioEqualizer && player.audioEqualizer.isInitialized) {
            audioSource.connect(player.audioEqualizer.getInputNode());
        } else {
            audioSource.connect(player.gainNode);
        }

        const targetTime = anchorWall + (timestamp - anchorContent) / player.playbackRate;
        if (!firstSampleScheduled) {
            firstSampleScheduled = true;
            Logger.log(`[${_audioLogTag}:Audio] First sample — ts=${timestamp.toFixed(3)}, targetTime=${targetTime.toFixed(3)}, audioCtx=${player.audioContext.currentTime.toFixed(3)}, bufDur=${buffer.duration.toFixed(3)}s`);
        }

        if (targetTime >= player.audioContext.currentTime) {
            audioSource.start(targetTime);
        } else {
            const bufferOffset = (player.audioContext.currentTime - targetTime) * player.playbackRate;
            if (bufferOffset < buffer.duration) {
                audioSource.start(player.audioContext.currentTime, bufferOffset);
            } else {
                return;
            }
        }

        nextAudioTime = targetTime + buffer.duration / player.playbackRate;
        player._liveNextAudioTime = nextAudioTime;

        player.queuedAudioNodes.add(audioSource);
        audioSource.onended = () => player.queuedAudioNodes.delete(audioSource);
    };

    if (prefetchedSample) scheduleOne(prefetchedSample);

    try {
        for await (const audioSample of myIterator) {
            if (!player.isPlaying) { audioSample.close(); break; }

            sampleCount++;
            const timestamp = audioSample.timestamp;
            scheduleOne(audioSample);

            if (sampleCount === 1) {
                Logger.log(`[${_audioLogTag}:Audio] First iterator sample — ts=${timestamp.toFixed(3)}, audioCtx=${player.audioContext?.currentTime?.toFixed(3)}, nextAudioTime=${nextAudioTime.toFixed(3)}`);
            }
            if (sampleCount % 100 === 0) {
                Logger.log(`[${_audioLogTag}:Audio] ${sampleCount} samples — ts=${timestamp.toFixed(3)}, audioCtx=${player.audioContext?.currentTime?.toFixed(3)}, nextAudioTime=${nextAudioTime.toFixed(3)}, bufferAhead=${((nextAudioTime - player.audioContext.currentTime) * 1000).toFixed(0)}ms`);
            }

            if (isLiveMode && player.audioContext) {
                const sampleTargetTime = anchorWall + (timestamp - anchorContent) / player.playbackRate;
                const aheadMs = (sampleTargetTime - player.audioContext.currentTime) * 1000;
                if (aheadMs > 300) {
                    const waitMs = aheadMs - 300;
                    if (sampleCount % 200 === 0) {
                        Logger.log(`[${_audioLogTag}:Audio] Audio ${aheadMs.toFixed(0)}ms ahead — throttling ${waitMs.toFixed(0)}ms`);
                    }
                    await new Promise(r => setTimeout(r, waitMs));
                } else if (aheadMs < -1000 && player.isPlaying && player.isLive) {
                    Logger.warn(`[${_audioLogTag}:Audio] Audio ${(-aheadMs).toFixed(0)}ms behind — triggering live resync`);
                    player._setLoading(true);
                    if (player.videoTrack) {
                        const currentLiveEdge = await player.videoTrack.getDurationFromMetadata({ skipLiveWait: true });
                        player._liveStartTimestamp = currentLiveEdge ?? player._liveStartTimestamp;
                        Logger.log(`[${_audioLogTag}:Audio] Jumping to live edge: ${player._liveStartTimestamp?.toFixed(3)}`);
                    }
                    player._startLiveVideoLoop();
                    break;
                }
            }

            if (!isLiveMode && timestamp - player._getPlaybackTime() >= 3) {
                await new Promise((resolve) => {
                    const id = setInterval(() => {
                        if (!player.isPlaying || player.isLive || timestamp - player._getPlaybackTime() < 2) {
                            clearInterval(id);
                            resolve();
                        }
                    }, 100);
                });
            }
        }
        Logger.log(`[${_audioLogTag}:Audio] Iterator completed after ${sampleCount} samples`);
    } catch (error) {
        if (error.name !== 'InputDisposedError' && !error.message?.includes('Input has been disposed')) {
            Logger.error(`[${_audioLogTag}:Audio] Iterator error after ${sampleCount} samples:`, error);
        } else {
            Logger.log(`[${_audioLogTag}:Audio] Iterator stopped (input disposed) after ${sampleCount} samples`);
        }
    } finally {
        Logger.log(`[${_audioLogTag}:Audio] Cleanup — sampleCount=${sampleCount}, isOurIterator=${player.audioBufferIterator === myIterator}`);
        if (player.audioBufferIterator === myIterator) {
            try { await myIterator.return(); } catch (e) { }
        }
    }
}

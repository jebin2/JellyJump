import { AudioEqualizer } from './AudioEqualizer.js';
import { Logger } from '../../shared/utils/Logger.js';


export async function initPlayerAudio(player) {
    if (player.isAudioInitialized) return;

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const sampleRate = player.audioTrack ? await player.audioTrack.getSampleRate() : undefined;
    player.audioContext = sampleRate ? new AudioContext({ sampleRate }) : new AudioContext();

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
        import('../../ui/player/AudioVisualizer.js').then(({ AudioVisualizer }) => {
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
        const { AudioVisualizer } = await import('../../ui/player/AudioVisualizer.js');
        player.audioVisualizer = new AudioVisualizer(player.canvas);
        player.audioVisualizer.connect(player.audioContext, player.gainNode);
    }
    if (player.audioVisualizer) {
        player.audioVisualizer.start();
    }
}

export function syncPlayerAudioGain(player) {
    if (!player.gainNode) return;
    player.gainNode.gain.value = player.config.muted ? 0 : player.config.volume;
}

export async function closePlayerAudioContext(player) {
    if (!player.audioContext) return;

    await player.audioContext.close();
    player.audioContext = null;
    player.gainNode = null;
}

export function restorePlayerAutoplayAudio(player, sourceLabel) {
    if (!player._wasMutedForAutoplay || !player.gainNode) return false;

    Logger.log(`[Autoplay] ${sourceLabel}, restoring audio...`);
    player.config.muted = false;
    syncPlayerAudioGain(player);
    player._wasMutedForAutoplay = false;
    player._updateVolumeUI();
    return true;
}

export async function runPlayerAudioIterator(player, iterator, anchorWall, anchorContent, prefetchedBuffer) {
    if (!player.audioSink || !iterator) return;

    if (anchorWall !== undefined) player._vodAnchorWall = anchorWall;
    if (anchorContent !== undefined) player._vodAnchorContent = anchorContent;

    const myIterator = iterator;
    const isAnchored = anchorWall !== undefined && anchorContent !== undefined;

    let nextAudioTime;
    if (isAnchored && prefetchedBuffer) {
        nextAudioTime = anchorWall + (prefetchedBuffer.timestamp - anchorContent);
    } else if (isAnchored) {
        nextAudioTime = anchorWall + (player.audioContext.currentTime - anchorWall);
    } else {
        nextAudioTime = (player.audioContext?.currentTime || 0) + 0.1;
    }

    let sampleCount = 0;
    let firstSampleScheduled = false;
    const _audioLogTag = player.isLive ? 'Live' : 'VOD';

    Logger.log(`[${_audioLogTag}:Audio] Iterator started — anchorWall=${anchorWall?.toFixed(3)}, anchorContent=${anchorContent?.toFixed(3)}, nextAudioTime=${nextAudioTime.toFixed(3)}, audioCtx=${player.audioContext?.currentTime?.toFixed(3)}, audioCtxState=${player.audioContext?.state}`);

    const scheduleOne = ({ buffer, timestamp }) => {
        if (!player.isPlaying || !buffer) return;

        const audioSource = player.audioContext.createBufferSource();
        audioSource.buffer = buffer;
        audioSource.playbackRate.value = player.playbackRate;

        if (player.audioEqualizer && player.audioEqualizer.isInitialized) {
            audioSource.connect(player.audioEqualizer.getInputNode());
        } else {
            audioSource.connect(player.gainNode);
        }

        // Use dynamic anchors for Live streams to keep in sync with video loop snaps
        const currentAnchorWall = player.isLive ? (player.stream?._liveAnchorWall ?? anchorWall) : anchorWall;
        const currentAnchorContent = player.isLive ? (player.stream?._liveAnchorContent ?? anchorContent) : anchorContent;

        // Account for hardware output latency (usually 10-40ms)
        const outputLatency = player.audioContext.outputLatency || 0;
        
        const targetTime = currentAnchorWall + (timestamp - currentAnchorContent) / player.playbackRate - outputLatency;
        
        if (!firstSampleScheduled) {
            firstSampleScheduled = true;
            Logger.log(`[${_audioLogTag}:Audio] First buffer — ts=${timestamp.toFixed(3)}, targetTime=${targetTime.toFixed(3)}, audioCtx=${player.audioContext.currentTime.toFixed(3)}, latency=${(outputLatency * 1000).toFixed(1)}ms`);
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

    if (prefetchedBuffer) scheduleOne(prefetchedBuffer);

    try {
        for await (const bufferObj of myIterator) {
            if (!player.isPlaying) break;

            sampleCount++;
            const { buffer, timestamp } = bufferObj;
            scheduleOne(bufferObj);

            if (sampleCount === 1) {
                Logger.log(`[${_audioLogTag}:Audio] First iterator buffer — ts=${timestamp.toFixed(3)}, audioCtx=${player.audioContext?.currentTime?.toFixed(3)}, nextAudioTime=${nextAudioTime.toFixed(3)}`);
            }
            if (sampleCount % 100 === 0) {
                Logger.log(`[${_audioLogTag}:Audio] ${sampleCount} buffers — ts=${timestamp.toFixed(3)}, audioCtx=${player.audioContext?.currentTime?.toFixed(3)}, nextAudioTime=${nextAudioTime.toFixed(3)}, bufferAhead=${((nextAudioTime - player.audioContext.currentTime) * 1000).toFixed(0)}ms`);
            }

            if (player.isLive && player.audioContext) {
                const liveAnchorWall = player.stream?._liveAnchorWall;
                const liveAnchorContent = player.stream?._liveAnchorContent;

                if (liveAnchorWall === undefined || liveAnchorContent === undefined || liveAnchorWall === null || (!player._hasSnappedAnchor && timestamp > 1000000)) {
                    // Wait for anchor to be snapped by the video loop
                    if (sampleCount % 100 === 0) Logger.log(`[${_audioLogTag}:Audio] Waiting for snapped anchor...`);
                    await new Promise(r => setTimeout(r, 50));
                    continue;
                }

                const outputLatency = player.audioContext.outputLatency || 0;
                const sampleTargetTime = liveAnchorWall + (timestamp - liveAnchorContent) / player.playbackRate - outputLatency;
                const aheadMs = (sampleTargetTime - player.audioContext.currentTime) * 1000;
                
                if (aheadMs > 150) {
                    const waitMs = Math.min(aheadMs - 150, 1000); // Limit wait to 1s to avoid long freezes
                    if (sampleCount % 200 === 0) {
                        Logger.log(`[${_audioLogTag}:Audio] Audio ${aheadMs.toFixed(0)}ms ahead — throttling ${waitMs.toFixed(0)}ms`);
                    }
                    await new Promise(r => setTimeout(r, waitMs));
                } else if (aheadMs < -5000 && player.isPlaying && player.isLive) {
                    // Only trigger a hard resync if we are MASSIVELY behind (> 2s).
                    // Minor lag should be handled by the catch-up logic in PlayerStream.
                    Logger.warn(`[${_audioLogTag}:Audio] Audio ${(-aheadMs).toFixed(0)}ms behind — triggering live resync`);
                    if (player.videoTrack) {
                        const currentLiveEdge = await player.videoTrack.getDurationFromMetadata({ skipLiveWait: true });
                        player._liveStartTimestamp = currentLiveEdge ?? player._liveStartTimestamp;
                        Logger.log(`[${_audioLogTag}:Audio] Jumping to live edge: ${player._liveStartTimestamp?.toFixed(3)}`);
                    }
                    player._startLiveVideoLoop(true);
                    break;
                }
            }

            if (!player.isLive && isAnchored && timestamp - player._getPlaybackTime() >= 3) {
                const aheadMs = (timestamp - player._getPlaybackTime()) * 1000;
                const waitMs = Math.min(aheadMs - 2000, 1000); // Wait until we are only 2s ahead, max 1s wait
                if (waitMs > 10) {
                    await new Promise(r => setTimeout(r, waitMs));
                }
            }
        }
        Logger.log(`[${_audioLogTag}:Audio] Iterator completed after ${sampleCount} buffers`);
    } catch (error) {
        if (error.name !== 'InputDisposedError' && !error.message?.includes('Input has been disposed')) {
            Logger.error(`[${_audioLogTag}:Audio] Iterator error after ${sampleCount} buffers:`, error);
        } else {
            Logger.log(`[${_audioLogTag}:Audio] Iterator stopped (input disposed) after ${sampleCount} buffers`);
        }
    } finally {
        Logger.log(`[${_audioLogTag}:Audio] Cleanup — sampleCount=${sampleCount}, isOurIterator=${player.audioBufferIterator === myIterator}`);
        if (player.audioBufferIterator === myIterator) {
            try { await myIterator.return(); } catch (e) { }
        }
    }
}

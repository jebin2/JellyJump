import { MediaBunny } from '../../core/MediaBunny.js';

export async function stretchAudioBuffer(buffer, speed) {
    const targetFrames = Math.ceil((buffer.duration / speed) * buffer.sampleRate);
    const offlineCtx = new OfflineAudioContext(buffer.numberOfChannels, targetFrames, buffer.sampleRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = speed;
    source.connect(offlineCtx.destination);
    source.start(0);
    return offlineCtx.startRendering();
}

export async function addAudioSamples(audioSource, buffer, outputTimestamp) {
    const samples = MediaBunny.AudioSample.fromAudioBuffer(buffer, outputTimestamp);
    const arr = Array.isArray(samples) ? samples : [samples];
    for (const s of arr) {
        await audioSource.add(s);
        outputTimestamp += s.duration;
        s.close();
    }
    return outputTimestamp;
}

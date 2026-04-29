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

export async function reverseAudioInChunks(source, audioSource, duration, onProgress) {
    const CHUNK_DURATION = 5; // Process 5 seconds at a time
    const totalChunks = Math.ceil(duration / CHUNK_DURATION);
    const audioContext = new AudioContext();

    try {
        const arrayBuffer = await source.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const sampleRate = audioBuffer.sampleRate;
        const numberOfChannels = audioBuffer.numberOfChannels;

        let outputTimestamp = 0;

        for (let chunkIndex = totalChunks - 1; chunkIndex >= 0; chunkIndex--) {
            const chunkStart = chunkIndex * CHUNK_DURATION;
            const chunkEnd = Math.min(chunkStart + CHUNK_DURATION, duration);
            const chunkDuration = chunkEnd - chunkStart;

            const startSample = Math.floor(chunkStart * sampleRate);
            const endSample = Math.min(Math.floor(chunkEnd * sampleRate), audioBuffer.length);
            const chunkSamples = endSample - startSample;

            if (chunkSamples <= 0) continue;

            const chunkBuffer = audioContext.createBuffer(numberOfChannels, chunkSamples, sampleRate);
            for (let channel = 0; channel < numberOfChannels; channel++) {
                const sourceData = audioBuffer.getChannelData(channel);
                const chunkData = chunkBuffer.getChannelData(channel);
                for (let i = 0; i < chunkSamples; i++) {
                    chunkData[i] = sourceData[endSample - 1 - i];
                }
            }

            outputTimestamp = await addAudioSamples(audioSource, chunkBuffer, outputTimestamp);

            if (onProgress) {
                const audioProgress = (totalChunks - chunkIndex) / totalChunks;
                onProgress(0.8 + audioProgress * 0.2);
            }
        }
    } finally {
        await audioContext.close();
    }
}

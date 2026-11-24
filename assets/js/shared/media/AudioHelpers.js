// @ts-check
import { MediaBunny, ensureDecodersFor } from './MediaBunny.js';

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

/**
 * Open a file's primary audio track through Mediabunny, which reads every
 * format the player does -- including ones Web Audio's decodeAudioData does
 * not, such as AC-3, DTS and TrueHD, or the audio inside a video file.
 * @returns {Promise<{ input: Object, track: Object, firstTimestamp: number }>}
 * @throws {Error} with a message meant for the user
 */
async function openAudio(blob) {
    const input = new MediaBunny.Input({
        source: new MediaBunny.BlobSource(blob),
        formats: MediaBunny.ALL_FORMATS,
    });
    try {
        const track = await input.getPrimaryAudioTrack();
        if (!track) throw new Error('That file has no audio in it.');
        await ensureDecodersFor([track]);
        if (!(await track.canDecode())) throw new Error('That audio cannot be decoded in this browser.');
        return { input, track, firstTimestamp: await track.getFirstTimestamp() };
    } catch (error) {
        input.dispose();
        throw error;
    }
}

/**
 * Length of a file's audio in seconds, read from the file rather than by
 * decoding all of it.
 * @param {Blob} blob
 * @returns {Promise<number>}
 */
export async function getAudioDuration(blob) {
    const { input, track, firstTimestamp } = await openAudio(blob);
    try {
        return (await track.computeDuration()) - firstTimestamp;
    } finally {
        input.dispose();
    }
}

/**
 * Decode `start`..`end` seconds of a file's audio into one AudioBuffer, at the
 * file's own sample rate. Only that range is decoded and held, not the file.
 * @param {Blob} blob
 * @param {number} start - seconds from the start of the audio
 * @param {number} [end] - seconds; the end of the audio when omitted
 * @returns {Promise<AudioBuffer|null>} null when the range holds no audio
 */
export async function decodeAudioRange(blob, start = 0, end = Infinity) {
    const { input, track, firstTimestamp } = await openAudio(blob);
    try {
        const from = firstTimestamp + Math.max(0, start);
        const to = firstTimestamp + Math.min(end, (await track.computeDuration()) - firstTimestamp);
        return await decodeTrackRange(track, from, to);
    } finally {
        input.dispose();
    }
}

/**
 * Decode `from`..`to` of an audio track already open, on the track's own
 * timeline, into one AudioBuffer at the rate the decoder puts out. Only that
 * range is decoded and held.
 * @param {Object} track - a Mediabunny InputAudioTrack
 * @param {number} from - seconds
 * @param {number} to - seconds
 * @returns {Promise<AudioBuffer|null>} null when the range holds no audio
 */
export async function decodeTrackRange(track, from, to) {
    if (!(to > from)) return null;

    // Sized from the first decoded buffer rather than the container's
    // figures: for HE-AAC the container can state the core rate, half of
    // what the decoder puts out, and a buffer sized from that would be cut
    // short and play at the wrong pitch.
    let result = null;
    let sampleRate = 0;

    // Each decoded buffer is copied to where it belongs in the range, and
    // whatever lies outside the range -- the ends of the first and last
    // buffers -- is cut off.
    for await (const { buffer, timestamp } of new MediaBunny.AudioBufferSink(track).buffers(from, to)) {
        if (!result) {
            sampleRate = buffer.sampleRate;
            result = new AudioBuffer({
                length: Math.max(1, Math.round((to - from) * sampleRate)),
                sampleRate,
                numberOfChannels: buffer.numberOfChannels,
            });
        }
        const offset = Math.round((timestamp - from) * sampleRate);
        const skip = Math.max(0, -offset);
        const count = Math.min(buffer.length - skip, result.length - Math.max(0, offset));
        if (count <= 0) continue;
        for (let ch = 0; ch < result.numberOfChannels; ch++) {
            const source = buffer.getChannelData(Math.min(ch, buffer.numberOfChannels - 1));
            result.getChannelData(ch).set(source.subarray(skip, skip + count), Math.max(0, offset));
        }
    }
    return result;
}

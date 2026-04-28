import { Logger } from '../../utils/Logger.js';
import { MediaBunny } from '../../core/MediaBunny.js';
import { createMediaBunnyInput, shortVideoCodec, shortAudioCodec } from '../shared/InputFactory.js';

export async function losslessTrim({ source, trim, onProgress }) {
    Logger.log('[MediaProcessor] Starting lossless trim...', trim);

    let input = null;
    try {
        input = createMediaBunnyInput(source);

        const videoTrack = await input.getPrimaryVideoTrack();
        if (!videoTrack) throw new Error('No video track found');

        const audioTracks = await input.getAudioTracks();
        const audioTrack = audioTracks[0] ?? null;

        const { start: trimStart, end: trimEnd } = trim;
        const duration = trimEnd - trimStart;

        const videoSink = new MediaBunny.EncodedPacketSink(videoTrack);
        let startKeyPacket = await videoSink.getKeyPacket(trimStart);
        if (!startKeyPacket) startKeyPacket = await videoSink.getFirstKeyPacket();
        if (!startKeyPacket) throw new Error('No keyframe found in video');

        const startOffset = startKeyPacket.timestamp;

        const videoDecoderConfig = await videoTrack.getDecoderConfig();
        if (!videoDecoderConfig) throw new Error('Could not get video decoder config');

        const target = new MediaBunny.BufferTarget();
        const output = new MediaBunny.Output({ format: new MediaBunny.Mp4OutputFormat(), target });

        const videoPacketSource = new MediaBunny.EncodedVideoPacketSource(shortVideoCodec(videoDecoderConfig.codec));
        output.addVideoTrack(videoPacketSource);

        let audioPacketSource = null;
        let audioDecoderConfig = null;
        if (audioTrack) {
            audioDecoderConfig = await audioTrack.getDecoderConfig();
            if (audioDecoderConfig) {
                audioPacketSource = new MediaBunny.EncodedAudioPacketSource(shortAudioCodec(audioDecoderConfig.codec));
                output.addAudioTrack(audioPacketSource);
            }
        }

        await output.start();

        let firstVideo = true;
        for await (const packet of videoSink.packets(startKeyPacket)) {
            if (packet.timestamp >= trimEnd) break;
            const shiftedTs = packet.timestamp - startOffset;
            const shifted = packet.clone({ timestamp: shiftedTs });
            await videoPacketSource.add(shifted, firstVideo ? { decoderConfig: videoDecoderConfig } : undefined);
            firstVideo = false;
            onProgress?.(Math.min((shiftedTs / duration) * 0.85, 0.85));
        }
        videoPacketSource.close();

        if (audioTrack && audioPacketSource && audioDecoderConfig) {
            const audioSink = new MediaBunny.EncodedPacketSink(audioTrack);
            const audioStartPacket = await audioSink.getPacket(startOffset) ?? await audioSink.getFirstPacket();
            if (audioStartPacket) {
                let firstAudio = true;
                for await (const packet of audioSink.packets(audioStartPacket)) {
                    if (packet.timestamp >= trimEnd) break;
                    const shiftedTs = packet.timestamp - startOffset;
                    if (shiftedTs < 0) continue;
                    const shifted = packet.clone({ timestamp: shiftedTs });
                    await audioPacketSource.add(shifted, firstAudio ? { decoderConfig: audioDecoderConfig } : undefined);
                    firstAudio = false;
                }
            }
            audioPacketSource.close();
        }

        await output.finalize();
        onProgress?.(1);

        return new Blob([target.buffer], { type: 'video/mp4' });
    } finally {
        if (input && typeof input.dispose === 'function') {
            try { input.dispose(); } catch (e) { Logger.warn('losslessTrim: dispose error', e); }
        }
    }
}

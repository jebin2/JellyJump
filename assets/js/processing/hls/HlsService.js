import { Logger } from '../../utils/Logger.js';
import { MediaBunny } from '../../core/MediaBunny.js';
import { createMediaBunnyInput, getBitrate } from '../shared/InputFactory.js';

export async function processHls({ source, quality = 100, onProgress }) {
    Logger.log('[MediaProcessor] Starting HLS conversion...');

    let input = null;
    let output = null;
    let conversion = null;
    const writtenFiles = new Map();

    try {
        input = createMediaBunnyInput(source);

        const videoTrack = await input.getPrimaryVideoTrack();
        if (!videoTrack) throw new Error('No video track found');

        output = new MediaBunny.Output({
            format: new MediaBunny.HlsOutputFormat({
                segmentFormat: new MediaBunny.MpegTsOutputFormat(),
                targetDuration: 6,
            }),
            target: new MediaBunny.PathedTarget(
                'master.m3u8',
                ({ path }) => {
                    const target = new MediaBunny.BufferTarget();
                    target.on('finalized', () => {
                        writtenFiles.set(path, target.buffer);
                    });
                    return target;
                },
            ),
        });

        const videoConfig = {};
        if (quality < 100) {
            const originalWidth = videoTrack.displayWidth || videoTrack.codedWidth;
            const originalHeight = videoTrack.displayHeight || videoTrack.codedHeight;
            let originalBitrate = 0;
            try {
                const stats = await videoTrack.computePacketStats(50);
                originalBitrate = stats.averageBitrate;
            } catch (e) {
                Logger.warn('[MediaProcessor] Could not compute original bitrate for HLS.');
            }
            videoConfig.codec = 'avc';
            videoConfig.bitrate = getBitrate(quality, originalWidth * originalHeight, originalBitrate);
        }

        conversion = await MediaBunny.Conversion.init({ input, output, video: videoConfig });
        if (onProgress) conversion.onProgress = onProgress;
        await conversion.execute();

        Logger.log(`[MediaProcessor] HLS done — ${writtenFiles.size} files`);
        return writtenFiles;
    } finally {
        if (conversion && typeof conversion.dispose === 'function') {
            try { conversion.dispose(); } catch (e) { Logger.warn('Error disposing HLS conversion:', e); }
        }
        if (output && typeof output.dispose === 'function') {
            try { output.dispose(); } catch (e) { Logger.warn('Error disposing HLS output:', e); }
        }
        if (input && typeof input.dispose === 'function') {
            try { input.dispose(); } catch (e) { Logger.warn('Error disposing HLS input:', e); }
        }
    }
}

import { Logger } from '../../shared/utils/Logger.js';
import { MediaBunny } from '../../core/MediaBunny.js';
import { createMediaBunnyInput, getBitrate } from '../shared/InputFactory.js';

let currentConversion = null;

export async function processHls({ source, quality = 100, onProgress }) {
    Logger.log('[MediaProcessor] Starting HLS conversion...');

    await currentConversion?.cancel();

    let input = null;
    let output = null;
    currentConversion = null;
    const writtenFiles = new Map();
    const filePromises = [];
    let bytesWritten = 0;
    let filesCreated = 0;
    let latestFile = '-';

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
                    let fileBytes = 0;

                    filesCreated++;
                    latestFile = path;

                    const target = new MediaBunny.BufferTarget({
                        onFinalize: (buffer) => {
                            writtenFiles.set(path, buffer);
                        },
                    });

                    target.on('write', ({ end }) => {
                        const newFileBytes = Math.max(fileBytes, end);
                        bytesWritten += newFileBytes - fileBytes;
                        fileBytes = newFileBytes;
                    });

                    const filePromise = new Promise((resolve) => {
                        target.on('finalized', () => {
                            resolve(undefined);
                        });
                    });
                    filePromises.push(filePromise);

                    return target;
                },
            ),
            onFinalize: () => Promise.all(filePromises),
        });

        const originalWidth = videoTrack.displayWidth || videoTrack.codedWidth;
        const originalHeight = videoTrack.displayHeight || videoTrack.codedHeight;

        const renditionHeights = [1080, 720, 480, 360, 240]
            .filter(h => h <= originalHeight);

        const videoConfig = renditionHeights.map(height => {
            const width = Math.round((height / originalHeight) * originalWidth);
            const bitrate = quality < 100
                ? getBitrate(quality, width * height)
                : getBitrate(100, width * height);
            return { codec: 'avc', height, bitrate };
        });

        if (videoConfig.length === 0) {
            videoConfig.push({ codec: 'avc' });
        }

        const audioConfig = [{ codec: 'aac', bitrate: MediaBunny.QUALITY_HIGH }];

        currentConversion = await MediaBunny.Conversion.init({ input, output, tracks: 'primary', video: videoConfig, audio: audioConfig });

        if (!currentConversion.isValid) {
            Logger.warn('[MediaProcessor] Discarded tracks:', currentConversion.discardedTracks);
            throw new Error('HLS conversion is invalid; see logs for details.');
        }

        if (onProgress) currentConversion.onProgress = onProgress;
        await currentConversion.execute();

        Logger.log(`[MediaProcessor] HLS done — ${writtenFiles.size} files`);
        return writtenFiles;
    } finally {
        if (currentConversion && typeof currentConversion.dispose === 'function') {
            try { currentConversion.dispose(); } catch (e) { Logger.warn('Error disposing HLS conversion:', e); }
        }
        if (output && typeof output.dispose === 'function') {
            try { output.dispose(); } catch (e) { Logger.warn('Error disposing HLS output:', e); }
        }
        if (input && typeof input.dispose === 'function') {
            try { input.dispose(); } catch (e) { Logger.warn('Error disposing HLS input:', e); }
        }
        currentConversion = null;
    }
}

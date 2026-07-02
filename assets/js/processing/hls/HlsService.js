import { Logger } from '../../shared/utils/Logger.js';
import { MediaBunny, ensureEncoders } from '../../core/MediaBunny.js';
import { createMediaBunnyInput } from '../shared/InputFactory.js';

let currentConversion = null;

export async function processHls({ source, quality = 100, onProgress }) {
    Logger.log('[MediaProcessor] Starting HLS conversion...');
    const startTime = performance.now();

    await ensureEncoders();

    await currentConversion?.cancel();

    let input = null;
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

        const output = new MediaBunny.Output({
            format: new MediaBunny.HlsOutputFormat({
                segmentFormat: new MediaBunny.MpegTsOutputFormat(),
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
                            filePromises.push(Promise.resolve());
                        },
                    });

                    target.on('write', ({ end }) => {
                        const newFileBytes = Math.max(fileBytes, end);
                        bytesWritten += newFileBytes - fileBytes;
                        fileBytes = newFileBytes;
                    });

                    return target;
                },
            ),
            onFinalize: () => Promise.all(filePromises),
        });

        const originalHeight = videoTrack.displayHeight || videoTrack.codedHeight;

        const renditionTiers = [
            { height: 1080, quality: MediaBunny.QUALITY_VERY_HIGH },
            { height: 720, quality: MediaBunny.QUALITY_HIGH },
            { height: 480, quality: MediaBunny.QUALITY_MEDIUM },
            { height: 360, quality: MediaBunny.QUALITY_LOW },
            { height: 240, quality: MediaBunny.QUALITY_VERY_LOW },
        ];

        const tierOffset = quality < 100 ? Math.floor((100 - quality) / 20) : 0;
        const availableTiers = renditionTiers.slice(tierOffset);

        const videoConfig = availableTiers
            .filter(t => t.height <= originalHeight)
            .map(t => ({ codec: 'avc', height: t.height, bitrate: t.quality }));

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
        if (input && typeof input.dispose === 'function') {
            try { input.dispose(); } catch (e) { Logger.warn('Error disposing HLS input:', e); }
        }
        currentConversion = null;
    }
}

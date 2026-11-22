import { MediaProcessor } from '../../../core/MediaProcessor.js';
import { MediaMetadata } from '../../../shared/utils/MediaMetadata.js';
import { formatTime, parseTime } from '../../../shared/utils/mediaUtils.js';
import { openProcessMenu, FOOTER_CONFIGS } from '../core/MenuFactory.js';
import { runMenuJob } from '../core/MenuJob.js';
import { borrowMainPlayer, timelineMarks } from '../core/PreviewPlayer.js';

/**
 * MultiCut Menu Handler
 * Remove multiple regions from video - specify sections to skip in final output
 */
export class MultiCutMenu {
    static async init(item, playlist) {
        const { modal, content: modalContent } = openProcessMenu('Multi-Cut', 'multicut-content-template', FOOTER_CONFIGS.multicut);
        if (!modal) return;

        const multicutLoading = modalContent.querySelector('.multicut-loading');
        const multicutContent = modalContent.querySelector('.multicut-content');
        const clipsList = modalContent.querySelector('#multicut-clips-list');
        const addClipBtn = modalContent.querySelector('#multicut-add-clip-btn');
        const totalDuration = modalContent.querySelector('.multicut-total-duration');
        const multicutBtn = modalContent.querySelector('.multicut-btn');
        const downloadBtn = modalContent.querySelector('.download-btn');
        const progressSection = modalContent.querySelector('.progress-section');
        const progressPercentage = modalContent.querySelector('.progress-percentage');
        const errorMessage = modalContent.querySelector('.error-message');
        const successMessage = modalContent.querySelector('.success-message');

        multicutBtn.disabled = true;

        await playlist._ensureMetadata(item);

        let duration = 0;
        if (item.duration && typeof item.duration === 'string' && item.duration !== '--:--') {
            duration = parseTime(item.duration);
        }

        const clips = [];
        let player = null;
        let currentClipIndex = -1;
        let drawMarks = () => {};

        const updateTotalDuration = () => {
            drawMarks(clips, duration);
            const removed = clips.reduce((sum, clip) => sum + (clip.end - clip.start), 0);
            const remaining = duration - removed;
            totalDuration.textContent = formatTime(remaining);
            multicutBtn.disabled = clips.length === 0;
        };

        const renderClips = () => {
            clipsList.innerHTML = clips.map((clip, index) => `
                <div class="tool-card ${index === currentClipIndex ? 'active' : ''}" data-index="${index}">
                    <div class="tool-card-header">
                        <span class="tool-card-title">Segment ${index + 1}</span>
                        <button class="tool-card-remove" data-index="${index}">&times;</button>
                    </div>
                    <div class="tool-card-times">
                        <div class="tool-card-input">
                            <label>Start</label>
                            <input type="text" class="clip-start-input font-mono" data-index="${index}" value="${formatTime(clip.start)}">
                            <button class="clip-set-start-btn jellyjump-btn-small" data-index="${index}" title="Set the start to the current time">Start here</button>
                        </div>
                        <div class="tool-card-input">
                            <label>End</label>
                            <input type="text" class="clip-end-input font-mono" data-index="${index}" value="${formatTime(clip.end)}">
                            <button class="clip-set-end-btn jellyjump-btn-small" data-index="${index}" title="Set the end to the current time">End here</button>
                        </div>
                    </div>
                    <div class="tool-card-info">Duration: ${formatTime(clip.end - clip.start)}</div>
                </div>
            `).join('');

            clipsList.querySelectorAll('.tool-card-remove').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idx = parseInt(e.target.dataset.index);
                    clips.splice(idx, 1);
                    if (currentClipIndex >= clips.length) currentClipIndex = clips.length - 1;
                    renderClips();
                    updateTotalDuration();
                });
            });

            clipsList.querySelectorAll('.clip-start-input').forEach(input => {
                input.addEventListener('change', (e) => {
                    const idx = parseInt(e.target.dataset.index);
                    const val = parseTime(e.target.value);
                    if (val !== null) {
                        clips[idx].start = Math.max(0, Math.min(val, clips[idx].end - 1));
                        renderClips();
                        updateTotalDuration();
                        if (player && idx === currentClipIndex) player.seek(clips[idx].start);
                    }
                });
            });

            clipsList.querySelectorAll('.clip-end-input').forEach(input => {
                input.addEventListener('change', (e) => {
                    const idx = parseInt(e.target.dataset.index);
                    const val = parseTime(e.target.value);
                    if (val !== null) {
                        clips[idx].end = Math.max(clips[idx].start + 1, Math.min(val, duration));
                        renderClips();
                        updateTotalDuration();
                        if (player && idx === currentClipIndex) player.seek(clips[idx].end);
                    }
                });
            });

            clipsList.querySelectorAll('.clip-set-start-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idx = parseInt(e.target.dataset.index);
                    if (player) {
                        clips[idx].start = Math.max(0, Math.min(player.currentTime, clips[idx].end - 1));
                        renderClips();
                        updateTotalDuration();
                    }
                });
            });

            clipsList.querySelectorAll('.clip-set-end-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idx = parseInt(e.target.dataset.index);
                    if (player) {
                        clips[idx].end = Math.max(clips[idx].start + 1, Math.min(player.currentTime, duration));
                        renderClips();
                        updateTotalDuration();
                    }
                });
            });

            clipsList.querySelectorAll('.tool-card').forEach(item => {
                item.addEventListener('click', (e) => {
                    if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
                    const idx = parseInt(item.dataset.index);
                    currentClipIndex = idx;
                    renderClips();
                    // To just before it, so the skip over it can be seen.
                    if (player) player.seek(Math.max(0, clips[idx].start - 2));
                });
            });
        };

        player = borrowMainPlayer(modal, playlist);
        drawMarks = timelineMarks(player, modal);

        if (player) {
            const onTimeUpdate = (data) => {
                if (clips.length === 0) return;

                // Use data.currentTime or player.currentTime (synced by CorePlayer)
                const currentTime = player.currentTime;

                // Check if current time is in a removed region
                const sortedClips = [...clips].sort((a, b) => a.start - b.start);
                let inRemovedRegion = false;
                let nextValidTime = duration;

                for (const clip of sortedClips) {
                    if (currentTime >= clip.start && currentTime < clip.end) {
                        inRemovedRegion = true;
                        nextValidTime = clip.end;
                        break;
                    }
                    if (clip.start > currentTime) {
                        nextValidTime = clip.start;
                        break;
                    }
                }

                if (inRemovedRegion) {
                    // Right after seeking, the audio-anchored clock can read a few
                    // milliseconds BEFORE the seek target, which would put us "back"
                    // inside the removed region and re-trigger the seek in an endless
                    // play/seek/pause loop. Only skip when we are meaningfully away
                    // from the target; otherwise let the clock cross it naturally.
                    const SKIP_EPSILON = 0.05;
                    if (nextValidTime - currentTime > SKIP_EPSILON) {
                        player.seek(nextValidTime);
                    }
                }
            };

            // Use new event system
            if (player.on) {
                player.on('timeupdate', onTimeUpdate);
            }

            modal.onCleanup(() => {
                if (player.off) player.off('timeupdate', onTimeUpdate);
            });
        }

        multicutLoading.classList.add('hidden');
        multicutContent.classList.remove('hidden');
        updateTotalDuration();

        addClipBtn.addEventListener('click', () => {
            const lastEnd = clips.length > 0 ? clips[clips.length - 1].end : 0;
            const newClip = {
                start: lastEnd,
                end: Math.min(lastEnd + 10, duration)
            };
            clips.push(newClip);
            currentClipIndex = clips.length - 1;
            renderClips();
            updateTotalDuration();
            if (player) player.seek(newClip.start);
        });

        multicutBtn.addEventListener('click', async () => {
            if (clips.length === 0) return;

            modalContent.classList.add('processing');

            await runMenuJob({
                name: 'Multi-Cut',
                subject: item.title,
                background: true,
                modal,
                work: async ({ signal, onProgress }) => {
                    const source = await MediaMetadata.getSourceBlob(item, () => playlist._saveState());

                    // The cuts are what goes; what is kept is the gaps between them.
                    const sortedClips = [...clips].sort((a, b) => a.start - b.start);
                    const segments = [];
                    let lastEnd = 0;
                    for (const clip of sortedClips) {
                        if (clip.start > lastEnd) segments.push({ start: lastEnd, end: clip.start });
                        lastEnd = clip.end;
                    }
                    if (lastEnd < duration) segments.push({ start: lastEnd, end: duration });
                    if (segments.length === 0) {
                        throw new Error('No video remaining after removing all clips');
                    }

                    const trimSegment = (seg, report) => MediaProcessor.process({
                        source,
                        format: 'mp4',
                        quality: 100,
                        trim: { start: seg.start, end: seg.end },
                        onProgress: report,
                        signal,
                    });

                    let blob;
                    if (segments.length === 1) {
                        blob = await trimSegment(segments[0], onProgress);
                    } else {
                        // Each piece trimmed (80% of the bar), then joined (20%).
                        const trimWeight = 0.8 / segments.length;
                        const segmentBlobs = [];
                        for (let i = 0; i < segments.length; i++) {
                            segmentBlobs.push(await trimSegment(segments[i],
                                (p) => onProgress(i * trimWeight + p * trimWeight)));
                        }
                        blob = await MediaProcessor.merge({
                            inputs: segmentBlobs,
                            format: 'mp4',
                            onProgress: (p) => onProgress(0.8 + p * 0.2),
                            signal,
                        });
                    }
                    const remaining = segments.reduce((sum, seg) => sum + (seg.end - seg.start), 0);
                    return { blob, remaining };
                },
                done: ({ blob, remaining }) => {
                    const ext = 'mp4';
                    const filename = item.title.replace(/\.[^/.]+$/, "") + `-${clips.length}-removed.${ext}`;
                    const { url } = playlist.insertProcessedItem(item, blob, filename, {
                        type: `video/${ext}`,
                        duration: formatTime(remaining),
                    });
                    downloadBtn.href = url;
                    downloadBtn.download = filename;
                    downloadBtn.classList.remove('hidden');
                },
            });
        });
    }
}

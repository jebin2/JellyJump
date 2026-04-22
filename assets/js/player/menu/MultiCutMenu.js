import { Logger } from "../../utils/Logger.js";
import { MediaProcessor } from '../../core/MediaProcessor.js';
import { MediaMetadata } from '../../utils/MediaMetadata.js';
import { formatTime, parseTime, generateId } from '../../utils/mediaUtils.js';
import { loadVideo, setupEditor } from './BoxEditorUtils.js';
import { openProcessMenu, FOOTER_CONFIGS } from './MenuFactory.js';

/**
 * MultiCut Menu Handler
 * Remove multiple regions from video - specify sections to skip in final output
 */
export class MultiCutMenu {
    static async init(item, playlist) {
        const { modal, content: modalContent } = openProcessMenu('Remove Clips', 'multicut-content-template', FOOTER_CONFIGS.multicut, { splitLayout: true });
        if (!modal) return;

        const videoPanel = modalContent.querySelector('.modal-video-panel');
        const editorUI = setupEditor(videoPanel, { type: 'multicut', enableOverlay: false });

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

        const updateTotalDuration = () => {
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
                            <button class="clip-set-start-btn jellyjump-btn-small" data-index="${index}">Set</button>
                        </div>
                        <div class="tool-card-input">
                            <label>End</label>
                            <input type="text" class="clip-end-input font-mono" data-index="${index}" value="${formatTime(clip.end)}">
                            <button class="clip-set-end-btn jellyjump-btn-small" data-index="${index}">Set</button>
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
                    if (player) {
                        player.loopMode = 'ab';
                        player.loopStart = clips[idx].start;
                        player.loopEnd = clips[idx].end;
                    }
                });
            });
        };

        const state = { video: { width: 0, height: 0 } };
        player = await loadVideo(editorUI.containerId, item, playlist, state);

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
                    // Skip to next valid time
                    player.seek(nextValidTime);
                }
            };

            // Use new event system
            if (player.on) {
                player.on('timeupdate', onTimeUpdate);
            }

            modal.onCleanup(() => {
                if (player.off) player.off('timeupdate', onTimeUpdate);
                player.destroy();
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
            if (player) {
                player.loopMode = 'ab';
                player.loopStart = newClip.start;
                player.loopEnd = newClip.end;
                player.seek(newClip.start);
            }
        });

        multicutBtn.addEventListener('click', async () => {
            if (clips.length === 0) return;

            modalContent.classList.add('processing');
            multicutBtn.disabled = true;
            modal.closeBtn.disabled = true;
            errorMessage.classList.add('hidden');
            successMessage.classList.add('hidden');
            progressSection.classList.remove('hidden');

            try {
                const source = await MediaMetadata.getSourceBlob(item, () => playlist._saveState());

                // Sort clips by start time
                const sortedClips = [...clips].sort((a, b) => a.start - b.start);

                // Invert: create segments from the gaps (regions to KEEP)
                const segments = [];
                let lastEnd = 0;

                for (const clip of sortedClips) {
                    if (clip.start > lastEnd) {
                        segments.push({ start: lastEnd, end: clip.start });
                    }
                    lastEnd = clip.end;
                }

                // Add final segment if there's remaining video
                if (lastEnd < duration) {
                    segments.push({ start: lastEnd, end: duration });
                }

                if (segments.length === 0) {
                    throw new Error('No video remaining after removing all clips');
                }

                let blob;
                if (segments.length === 1) {
                    // Single segment — simple trim
                    blob = await MediaProcessor.process({
                        source,
                        format: 'mp4',
                        quality: 100,
                        trim: { start: segments[0].start, end: segments[0].end },
                        onProgress: (progress) => {
                            progressPercentage.textContent = `${Math.round(progress * 100)}%`;
                        }
                    });
                } else {
                    // Multiple segments — trim each then merge
                    const trimWeight = 0.8 / segments.length;
                    const segmentBlobs = [];
                    for (let i = 0; i < segments.length; i++) {
                        const seg = segments[i];
                        const segBlob = await MediaProcessor.process({
                            source,
                            format: 'mp4',
                            quality: 100,
                            trim: { start: seg.start, end: seg.end },
                            onProgress: (progress) => {
                                const overall = (i * trimWeight + progress * trimWeight) * 100;
                                progressPercentage.textContent = `${Math.round(overall)}%`;
                            }
                        });
                        segmentBlobs.push(segBlob);
                    }
                    blob = await MediaProcessor.merge({
                        inputs: segmentBlobs,
                        format: 'mp4',
                        onProgress: (progress) => {
                            const overall = (0.8 + progress * 0.2) * 100;
                            progressPercentage.textContent = `${Math.round(overall)}%`;
                        }
                    });
                }

                progressSection.classList.add('hidden');
                successMessage.classList.remove('hidden');

                const ext = 'mp4';
                const removedCount = clips.length;
                const filename = item.title.replace(/\.[^/.]+$/, "") + `- ${removedCount} removed.${ext}`;

                const remainingDuration = segments.reduce((sum, seg) => sum + (seg.end - seg.start), 0);
                const { url } = playlist.insertProcessedItem(item, blob, filename, {
                    type: `video/${ext}`,
                    duration: formatTime(remainingDuration),
                });

                downloadBtn.href = url;
                downloadBtn.download = filename;
                downloadBtn.classList.remove('hidden');

                modal.closeBtn.disabled = false;

            } catch (e) {
                Logger.error('Multi-cut failed:', e);
                errorMessage.textContent = `Failed: ${e.message}`;
                errorMessage.classList.remove('hidden');
                multicutBtn.disabled = false;
                modal.closeBtn.disabled = false;
                progressSection.classList.add('hidden');
            }
        });
    }
}

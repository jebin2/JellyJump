import { Modal as ModalDialog } from "../Modal.js";
import { Logger } from "../../utils/Logger.js";
import { HardCutDetector } from "../HardCutDetector.js";
import { formatDuration, generateId } from "../../utils/mediaUtils.js";
import { MediaProcessor } from '../../core/MediaProcessor.js';
import { MediaMetadata } from '../../utils/MediaMetadata.js';

export class CutDetectionMenu {
    constructor(playlist) {
        this.playlist = playlist;
    }

    /**
     * Called when the menu item is clicked
     * @param {Object} item - The playlist item object
     */
    async execute(item) {
        const videoUrl = item?.blob_url || item?.url;
        if (!item || !videoUrl) {
            Logger.warn('CutDetectionMenu: No valid item or URL provided');
            return;
        }

        const contentTemplate = document.getElementById('detection-content-template');
        const footerTemplate = document.getElementById('detection-footer-template');
        if (!contentTemplate || !footerTemplate) return;

        const modal = new ModalDialog({
            maxWidth: '600px',
            onClose: () => {
                isCancelled = true;
                if (detector) detector.cancel();
            }
        });

        modal.setTitle('Hard Cut Detection');
        modal.setBody(contentTemplate.content.cloneNode(true));
        modal.setFooter(footerTemplate.content.cloneNode(true));

        const modalContent = modal.modal;

        // UI Elements from Content
        const targetFilename = modalContent.querySelector('.target-filename');
        const statusText = modalContent.querySelector('.status-text');
        const statusPercent = modalContent.querySelector('.status-percent');
        const progressBar = modalContent.querySelector('.progress-bar-fill');
        const cutsList = modalContent.querySelector('.detected-items-list');

        // UI Elements from Footer
        const progressSection = modalContent.querySelector('.progress-section');
        const progressPercentage = modalContent.querySelector('.progress-percentage');
        const successMessage = modalContent.querySelector('.success-message');
        const errorMessage = modalContent.querySelector('.error-message');

        targetFilename.textContent = item.title;
        modal.open();

        let detector = new HardCutDetector();
        let isCancelled = false;

        // Auto-start detection
        const runDetection = async () => {
            statusText.textContent = 'Analyzing video...';

            detector.progressCallback = (progress) => {
                if (isCancelled) return;
                const pct = Math.round(progress * 100);
                statusPercent.textContent = `${pct}%`;
                progressBar.style.width = `${pct}%`;
            };

            try {
                // Get duration
                let duration = 0;
                if (this.playlist.player && this.playlist.player.duration) {
                    duration = this.playlist.player.duration;
                }

                if (!duration && item.duration) {
                    if (typeof item.duration === 'number') duration = item.duration;
                    else if (typeof item.duration === 'string' && item.duration.includes(':')) {
                        const parts = item.duration.split(':').map(Number);
                        if (parts.length === 3) duration = parts[0] * 3600 + parts[1] * 60 + parts[2];
                        else if (parts.length === 2) duration = parts[0] * 60 + parts[1];
                    }
                }

                const cuts = await detector.detect(videoUrl);
                if (isCancelled) return;

                statusText.textContent = 'Detection complete!';
                statusText.classList.add('text-success');

                // Calculate segments
                const points = [0, ...cuts];
                const lastCut = cuts.length > 0 ? cuts[cuts.length - 1] : 0;
                const finalEnd = (duration > lastCut) ? duration : (lastCut > 0 ? lastCut + 10 : 60);

                if (finalEnd > points[points.length - 1]) {
                    points.push(finalEnd);
                }

                const segments = [];
                for (let i = 0; i < points.length - 1; i++) {
                    segments.push({
                        start: points[i],
                        end: points[i + 1],
                        index: i + 1
                    });
                }

                // Render Results
                cutsList.innerHTML = '';

                if (segments.length === 0) {
                    cutsList.innerHTML = '<div class="p-4 text-center text-muted italic">No distinct scenes detected.</div>';
                } else {
                    const listHtml = segments.map((seg) => {
                        const startStr = new Date(seg.start * 1000).toISOString().substr(14, 5);
                        const endStr = new Date(seg.end * 1000).toISOString().substr(14, 5);
                        const durationStr = (seg.end - seg.start).toFixed(1) + 's';

                        return `
                        <div class="segment-item p-sm rounded bg-tertiary flex-between hover:bg-white/5 transition-colors group border border-transparent hover:border-white/10">
                            <div class="flex flex-col gap-xs flex-1">
                                <span class="font-bold text-accent text-sm">Segment ${seg.index}</span>
                                <span class="text-xs text-muted font-mono">${startStr} - ${endStr} (${durationStr})</span>
                            </div>
                            <div class="flex gap-sm items-center">
                                <button class="add-segment-btn btn jellyjump-btn-primary text-xs px-sm py-xs" 
                                    data-start="${seg.start}" 
                                    data-end="${seg.end}" 
                                    data-index="${seg.index}">
                                    Add Clip
                                </button>
                            </div>
                        </div>`;
                    }).join('');

                    cutsList.innerHTML = listHtml;

                    const addBtns = cutsList.querySelectorAll('.add-segment-btn');
                    addBtns.forEach(btn => {
                        btn.onclick = async (e) => {
                            e.stopPropagation();

                            if (!progressSection.classList.contains('hidden')) return;

                            // Hide previous messages and show progress
                            successMessage.classList.add('hidden');
                            errorMessage.classList.add('hidden');
                            progressSection.classList.remove('hidden');
                            addBtns.forEach(b => b.disabled = true);

                            const start = parseFloat(btn.dataset.start);
                            const end = parseFloat(btn.dataset.end);
                            const index = parseInt(btn.dataset.index);

                            try {
                                await this.addSegmentToPlaylist(item, start, end, index, btn, (pct) => {
                                    progressPercentage.textContent = `${Math.round(pct * 100)}%`;
                                });
                                successMessage.classList.remove('hidden');
                            } catch (err) {
                                Logger.error('Failed to add segment', err);
                                errorMessage.textContent = err.message;
                                errorMessage.classList.remove('hidden');
                                btn.disabled = false;
                            } finally {
                                progressSection.classList.add('hidden');
                                addBtns.forEach(b => {
                                    if (!b.classList.contains('bg-success')) b.disabled = false;
                                });
                            }
                        };
                    });
                }

            } catch (err) {
                if (isCancelled) return;
                Logger.error('CutDetectionMenu: Error', err);
                statusText.textContent = 'Error: ' + err.message;
                statusText.classList.add('text-danger');
                cutsList.innerHTML = `<div class="p-4 text-center text-danger">Error: ${err.message}</div>`;
            }
        };

        runDetection();
    }

    async addSegmentToPlaylist(originalItem, start, end, index, btn, onProgress) {
        Logger.log(`Trimming segment ${index}: ${start} -> ${end}`);

        // 1. Get Source
        const source = await MediaMetadata.getSourceBlob(originalItem, () => this.playlist._saveState());

        // 2. Process (Trim)
        const blob = await MediaProcessor.process({
            source: source,
            format: 'mp4',
            quality: 100,
            trim: {
                start: start,
                end: end
            },
            onProgress: onProgress
        });

        // 3. Create Item
        const cleanTitle = originalItem.title.replace(/\.[^/.]+$/, "");
        const segmentTitle = `${cleanTitle} - Scene ${index}.mp4`;
        const folderName = `Cuts from ${originalItem.title}`;
        const newPath = `${folderName}/${segmentTitle}`;
        const url = URL.createObjectURL(blob);

        const newItem = {
            id: generateId(),
            title: segmentTitle,
            url: url,
            file: new File([blob], segmentTitle, { type: 'video/mp4' }),
            duration: formatDuration(end - start),
            type: 'video',
            isLocal: true,
            isNew: true,
            path: newPath
        };

        // 4. Add to Playlist
        this.playlist.addItem(newItem);

        // Feedback
        btn.textContent = '✓ Added';
        btn.classList.add('bg-success', 'border-success');
    }
}

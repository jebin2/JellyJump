import { Modal as ModalDialog } from "../Modal.js";
import { Logger } from "../../utils/Logger.js";
import { MotionDetector } from "../MotionDetector.js";
import { formatDuration, generateId } from "../../utils/mediaUtils.js";
import { MediaProcessor } from '../../core/MediaProcessor.js';
import { MediaMetadata } from '../../utils/MediaMetadata.js';

export class MotionDetectionMenu {
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
            Logger.warn('MotionDetectionMenu: No valid item or URL provided');
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

        modal.setTitle('Motion Detection');
        modal.setBody(contentTemplate.content.cloneNode(true));
        modal.setFooter(footerTemplate.content.cloneNode(true));

        const modalContent = modal.modal;

        // UI Elements from Content
        const targetFilename = modalContent.querySelector('.target-filename');
        const statusText = modalContent.querySelector('.status-text');
        const statusPercent = modalContent.querySelector('.status-percent');
        const progressBar = modalContent.querySelector('.progress-bar-fill');
        const segmentsList = modalContent.querySelector('.detected-items-list');

        // UI Elements from Footer
        const progressSection = modalContent.querySelector('.progress-section');
        const progressPercentage = modalContent.querySelector('.progress-percentage');
        const successMessage = modalContent.querySelector('.success-message');
        const errorMessage = modalContent.querySelector('.error-message');

        targetFilename.textContent = item.title;
        modal.open();

        let detector = new MotionDetector();
        let isCancelled = false;

        // Auto-start detection
        const runDetection = async () => {
            statusText.textContent = 'Scanning video...';

            detector.progressCallback = (progress) => {
                if (isCancelled) return;
                const pct = Math.round(progress * 100);
                statusPercent.textContent = `${pct}%`;
                progressBar.style.width = `${pct}%`;
            };

            try {
                const results = await detector.detect(videoUrl);
                if (isCancelled) return;

                statusText.textContent = 'Scan complete!';
                statusText.classList.add('text-success');

                // Render Results
                segmentsList.innerHTML = '';

                if (results.length === 0) {
                    segmentsList.innerHTML = '<div class="p-4 text-center text-muted italic">No significant motion detected.</div>';
                } else {
                    const listHtml = results.map((seg, idx) => {
                        const startStr = new Date(seg.start * 1000).toISOString().substr(14, 5);
                        const endStr = new Date(seg.end * 1000).toISOString().substr(14, 5);
                        const durationStr = (seg.end - seg.start).toFixed(1) + 's';

                        return `
                        <div class="segment-item p-sm rounded bg-tertiary flex-between hover:bg-white/5 transition-colors group border border-transparent hover:border-white/10">
                            <div class="flex flex-col gap-xs flex-1">
                                <span class="font-bold text-accent text-sm">Event ${idx + 1}</span>
                                <span class="text-xs text-muted font-mono">${startStr} - ${endStr} (${durationStr})</span>
                                <div class="w-20 h-1 bg-black/30 rounded mt-1 overflow-hidden">
                                    <div class="h-full bg-success/50" style="width: ${Math.min(100, seg.score * 500)}%"></div>
                                </div>
                            </div>
                            <div class="flex gap-sm items-center">
                                <button class="add-segment-btn btn jellyjump-btn-primary text-xs px-sm py-xs" 
                                    data-start="${seg.start}" 
                                    data-end="${seg.end}" 
                                    data-index="${idx + 1}">
                                    Add Clip
                                </button>
                            </div>
                        </div>`;
                    }).join('');

                    segmentsList.innerHTML = listHtml;

                    const addBtns = segmentsList.querySelectorAll('.add-segment-btn');
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
                Logger.error('MotionDetectionMenu: Error', err);
                statusText.textContent = 'Error: ' + err.message;
                statusText.classList.add('text-danger');
                segmentsList.innerHTML = `<div class="p-4 text-center text-danger">Error: ${err.message}</div>`;
            }
        };

        runDetection();
    }

    async addSegmentToPlaylist(originalItem, start, end, index, btn, onProgress) {
        Logger.log(`Adding motion segment ${index}: ${start} -> ${end}`);

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
        const segmentTitle = `${cleanTitle} - Motion ${index}.mp4`;
        const folderName = `Motion from ${originalItem.title}`;
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

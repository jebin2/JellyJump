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
        if (!item || !item.url) {
            Logger.warn('MotionDetectionMenu: No valid item or URL provided');
            return;
        }

        Logger.log('MotionDetectionMenu: Executing for', item.title);

        const modal = new ModalDialog();
        modal.setTitle('Motion Detection');

        modal.setBody(`
            <div class="motion-detection-content flex flex-col h-[50vh] max-h-[500px]">
                <div class="flex-none pb-sm border-b border-white/10">
                    <p class="mb-sm truncate">Scanning for motion in: <strong>${item.title}</strong></p>
                    
                    <div class="detection-status">
                        <div class="flex-between mb-xs">
                            <span class="status-text text-sm font-mono">Initializing...</span>
                            <span class="status-percent text-sm font-bold">0%</span>
                        </div>
                        <div class="progress-bar-container h-2 bg-tertiary rounded overflow-hidden">
                            <div class="progress-bar-fill bg-primary h-full w-0 transition-all duration-300"></div>
                        </div>
                    </div>
                </div>

                <div class="detected-segments-list flex-auto overflow-y-auto p-sm space-y-xs min-h-0 bg-secondary/30 mt-sm rounded">
                    <div class="flex-center h-full text-muted italic status-placeholder">Starting scan...</div>
                </div>
            </div>
        `);

        // Footer: Buttons + Progress (Styled like TrimMenu)
        modal.setFooter(`
            <div class="trim-footer-container flex-between items-center w-full gap-md">
                <!-- Status Area (Left) -->
                <div class="trim-footer-status flex-1">
                    <div class="progress-section hidden flex items-center gap-sm">
                        <div class="spinner-sm border-2 border-current border-t-transparent rounded-full w-4 h-4 animate-spin"></div>
                        <span class="progress-status text-sm font-mono">Extracting...</span>
                        <span class="progress-percentage text-sm font-bold text-accent">0%</span>
                    </div>
                    <div class="error-message hidden text-danger text-sm"></div>
                    <div class="success-message hidden text-success text-sm font-bold">✓ Added to playlist</div>
                </div>
                <!-- Action Buttons (Right) -->
                <div class="action-buttons flex gap-sm flex-shrink-0 ml-auto">
                    <button class="btn jellyjump-btn-secondary" id="btn-cancel-motion">Close</button>
                </div>
            </div>
        `);

        modal.open();

        const cancelBtn = modal.footer.querySelector('#btn-cancel-motion');
        const progressSection = modal.footer.querySelector('.progress-section');
        const progressPercentage = modal.footer.querySelector('.progress-percentage');
        const successMessage = modal.footer.querySelector('.success-message');
        const errorMessage = modal.footer.querySelector('.error-message');

        const statusText = modal.querySelector('.status-text');
        const statusPercent = modal.querySelector('.status-percent');
        const progressBar = modal.querySelector('.progress-bar-fill');
        const segmentsList = modal.querySelector('.detected-segments-list');

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
                const results = await detector.detect(item.url);
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
                        <div class="segment-item p-sm rounded bg-tertiary flex-between hover:bg-white/5 transition-colors group">
                            <div class="flex flex-col gap-xs flex-1">
                                <span class="font-bold text-accent">Event ${idx + 1}</span>
                                <span class="text-xs text-muted font-mono">${startStr} - ${endStr} (${durationStr})</span>
                                <div class="w-20 h-1 bg-white/10 rounded mt-1">
                                    <div class="h-full bg-success/50 rounded" style="width: ${Math.min(100, seg.score * 500)}%"></div>
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

                            // Prevent concurrent operations
                            if (!progressSection.classList.contains('hidden')) {
                                return;
                            }

                            // Show global footer progress
                            progressSection.classList.remove('hidden');
                            successMessage.classList.add('hidden');
                            errorMessage.classList.add('hidden');
                            cancelBtn.disabled = true;
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
                                errorMessage.textContent = `Error: ${err.message}`;
                                errorMessage.classList.remove('hidden');
                                btn.disabled = false;
                            } finally {
                                progressSection.classList.add('hidden');
                                cancelBtn.disabled = false;
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
            } finally {
                cancelBtn.textContent = 'Close';
            }
        };

        // Run immediately
        runDetection();

        // Cancel/Close handler
        cancelBtn.onclick = () => {
            isCancelled = true;
            if (detector) {
                detector.cancel();
            }
            modal.close();
        };
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

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
        if (!item || !item.url) {
            Logger.warn('CutDetectionMenu: No valid item or URL provided');
            return;
        }

        Logger.log('CutDetectionMenu: Executing for', item.title);

        const modal = new ModalDialog();
        modal.setTitle('Hard Cut Detection');

        modal.setBody(`
            <div class="cut-detection-content flex flex-col h-[50vh] max-h-[500px]">
                <div class="flex-none pb-sm border-b border-white/10">
                    <p class="mb-sm truncate">Detecting scene changes in: <strong>${item.title}</strong></p>
                    
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

                <div class="detected-cuts-list flex-auto overflow-y-auto p-sm space-y-xs min-h-0 bg-secondary/30 mt-sm rounded">
                    <div class="flex-center h-full text-muted italic status-placeholder">Starting detection...</div>
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
                        <span class="progress-status text-sm font-mono">Trimming...</span>
                        <span class="progress-percentage text-sm font-bold text-accent">0%</span>
                    </div>
                    <div class="error-message hidden text-danger text-sm"></div>
                    <div class="success-message hidden text-success text-sm font-bold">✓ Added to playlist</div>
                </div>
                <!-- Action Buttons (Right) -->
                <div class="action-buttons flex gap-sm flex-shrink-0 ml-auto">
                    <button class="btn jellyjump-btn-secondary" id="btn-cancel-cut">Close</button>
                </div>
            </div>
        `);

        modal.open();

        const cancelBtn = modal.footer.querySelector('#btn-cancel-cut');
        const progressSection = modal.footer.querySelector('.progress-section');
        const progressPercentage = modal.footer.querySelector('.progress-percentage');
        const successMessage = modal.footer.querySelector('.success-message');
        const errorMessage = modal.footer.querySelector('.error-message');

        const statusText = modal.querySelector('.status-text');
        const statusPercent = modal.querySelector('.status-percent');
        const progressBar = modal.querySelector('.progress-bar-fill');
        const cutsList = modal.querySelector('.detected-cuts-list');

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

                const cuts = await detector.detect(item.url);
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
                        <div class="segment-item p-sm rounded bg-tertiary flex-between hover:bg-white/5 transition-colors group">
                            <div class="flex flex-col gap-xs flex-1">
                                <span class="font-bold text-accent">Segment ${seg.index}</span>
                                <span class="text-xs text-muted font-mono">${startStr} - ${endStr} (${durationStr})</span>
                            </div>
                            <div class="flex gap-sm items-center">
                                <button class="add-segment-btn btn jellyjump-btn-primary text-xs px-sm py-xs" 
                                    data-start="${seg.start}" 
                                    data-end="${seg.end}" 
                                    data-index="${seg.index}">
                                    Add to Playlist
                                </button>
                            </div>
                        </div>`;
                    }).join('');

                    cutsList.innerHTML = listHtml;

                    const addBtns = cutsList.querySelectorAll('.add-segment-btn');
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
                            // Disable all add buttons
                            addBtns.forEach(b => b.disabled = true);

                            const start = parseFloat(btn.dataset.start);
                            const end = parseFloat(btn.dataset.end);
                            const index = parseInt(btn.dataset.index);

                            try {
                                await this.addSegmentToPlaylist(item, start, end, index, btn, (pct) => {
                                    progressPercentage.textContent = `${Math.round(pct * 100)}%`;
                                });
                                // Show success in footer
                                successMessage.classList.remove('hidden');
                            } catch (err) {
                                Logger.error('Failed to add segment', err);
                                errorMessage.textContent = `Error: ${err.message}`;
                                errorMessage.classList.remove('hidden');
                                btn.disabled = false; // Re-enable on error
                            } finally {
                                progressSection.classList.add('hidden');
                                cancelBtn.disabled = false;
                                // Re-enable other buttons, keep clicked one disabled if success
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

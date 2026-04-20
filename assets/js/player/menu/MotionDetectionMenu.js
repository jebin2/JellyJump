import { Modal as ModalDialog } from "../Modal.js";
import { Logger } from "../../utils/Logger.js";
import { MotionDetector } from "../MotionDetector.js";
import { formatTime, generateId } from "../../utils/mediaUtils.js";
import { MediaProcessor } from '../../core/MediaProcessor.js';
import { MediaMetadata } from '../../utils/MediaMetadata.js';

export class MotionDetectionMenu {
    static async init(item, playlist) {
        const videoUrl = item?.blob_url || item?.url;
        if (!item || !videoUrl) {
            Logger.warn('MotionDetectionMenu: No valid item or URL provided');
            return;
        }

        const contentTemplate = document.getElementById('detection-content-template');
        const footerTemplate = document.getElementById('detection-footer-template');
        if (!contentTemplate || !footerTemplate) return;

        let detector = new MotionDetector();
        let isCancelled = false;
        let isDetecting = false;

        const modal = new ModalDialog({
            maxWidth: '600px',
            onClose: () => {
                isCancelled = true;
                if (detector) {
                    detector.cancel();
                    detector = null;
                }
            }
        });

        modal.setTitle('Motion Detection');
        modal.setBody(contentTemplate.content.cloneNode(true));
        modal.setFooter(footerTemplate.content.cloneNode(true));

        const modalContent = modal.modal;

        // UI Elements (body)
        const targetFilename = modalContent.querySelector('.target-filename');
        const sensitivitySection = modalContent.querySelector('.sensitivity-section');
        const sensitivitySlider = modalContent.querySelector('.sensitivity-slider');
        const sensitivityValue = modalContent.querySelector('.sensitivity-value');
        const statusArea = modalContent.querySelector('.detection-status-area');
        const statusText = modalContent.querySelector('.status-text');
        const statusPercent = modalContent.querySelector('.status-percent');
        const progressBar = modalContent.querySelector('.progress-bar-fill');
        const segmentsList = modalContent.querySelector('.detected-items-list');

        // Footer Elements
        const detectBtn = modalContent.querySelector('.detect-btn');
        const progressSection = modalContent.querySelector('.progress-section');
        const progressPercentage = modalContent.querySelector('.progress-percentage');
        const successMessage = modalContent.querySelector('.success-message');
        const errorMessage = modalContent.querySelector('.error-message');

        targetFilename.textContent = item.title;

        // Show sensitivity section, hide status area initially
        if (sensitivitySection) sensitivitySection.classList.remove('hidden');
        if (statusArea) statusArea.classList.add('hidden');
        if (detectBtn) {
            const useEl = detectBtn.querySelector('use');
            if (useEl) useEl.setAttribute('href', 'assets/icons/sprite.svg#icon-motion');
            detectBtn.title = "Detect Motion";
            detectBtn.setAttribute('aria-label', "Detect Motion");
        }

        // Sensitivity slider labels (for motion: High=more sensitive, Low=less)
        const sensitivityLabels = { 1: 'High', 2: 'Medium', 3: 'Low' };
        // Map sensitivity to threshold (High=0.03, Medium=0.05, Low=0.08)
        const sensitivityToThreshold = { 1: 0.03, 2: 0.05, 3: 0.08 };

        sensitivitySlider.addEventListener('input', () => {
            sensitivityValue.textContent = sensitivityLabels[sensitivitySlider.value];
        });

        detectBtn.addEventListener('click', async () => {
            if (isDetecting) return;
            isDetecting = true;
            detectBtn.disabled = true;
            // detectBtn.textContent = '...';

            const sensitivity = parseInt(sensitivitySlider.value);
            const threshold = sensitivityToThreshold[sensitivity];
            Logger.log('MotionDetectionMenu: Starting detection with threshold', threshold);

            // Show footer progress section
            progressSection.classList.remove('hidden');
            const progressStatus = modalContent.querySelector('.progress-status');
            if (progressStatus) progressStatus.textContent = 'Scanning...';

            segmentsList.innerHTML = '<div class="flex-center flex-col gap-sm h-full text-muted italic py-xl"><div class="spinner-sm border-2 border-current border-t-transparent rounded-full w-6 h-6 animate-spin opacity-50"></div><span class="text-sm">Scanning video...</span></div>';

            await MotionDetectionMenu.runDetection(item, videoUrl, detector, playlist, { threshold }, isCancelled, {
                segmentsList, progressSection, progressPercentage, successMessage, errorMessage, modalContent
            });

            isDetecting = false;
            detectBtn.disabled = false;
            // detectBtn.textContent = 'Re-detect';
            progressSection.classList.add('hidden');
        });

        modal.open();
    }

    static async runDetection(item, videoUrl, detector, playlist, options, isCancelled, ui) {
        const { segmentsList, progressSection, progressPercentage, successMessage, errorMessage, modalContent } = ui;

        const progressStatus = modalContent.querySelector('.progress-status');
        if (progressStatus) progressStatus.textContent = 'Scanning video...';

        detector.progressCallback = (progress) => {
            if (isCancelled) return;
            const pct = Math.round(progress * 100);
            if (progressPercentage) progressPercentage.textContent = `${pct}%`;
            if (progressStatus) {
                if (progress < 0.5) {
                    progressStatus.textContent = 'Scanning frames...';
                } else {
                    progressStatus.textContent = 'Detecting motion...';
                }
            }
        };

        try {
            const results = await detector.detect(videoUrl, options);
            if (isCancelled) return;

            if (progressStatus) progressStatus.textContent = `Found ${results.length} events`;

            // Render Results
            segmentsList.innerHTML = '';

            if (results.length === 0) {
                segmentsList.innerHTML = '<div class="p-4 text-center text-muted italic">No significant motion detected. Try higher sensitivity.</div>';
            } else {
                const listHtml = results.map((seg, idx) => {
                    const startStr = formatTime(seg.start);
                    const endStr = formatTime(seg.end);
                    const durationStr = formatTime(seg.end - seg.start);

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
                        <div class="flex gap-sm items-center">
                            <button class="add-segment-btn btn jellyjump-btn-small flex items-center justify-center p-sm" 
                                data-start="${seg.start}" 
                                data-end="${seg.end}" 
                                data-index="${idx + 1}"
                                title="Add Clip">
                                <svg width="16" height="16" fill="currentColor"><use href="assets/icons/sprite.svg#icon-plus"></use></svg>
                            </button>
                        </div>
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

                        // Update footer status text
                        const footerStatus = modalContent.querySelector('.progress-status');
                        const footerPct = modalContent.querySelector('.progress-percentage');
                        if (footerStatus) footerStatus.textContent = 'Processing...';
                        if (footerPct) footerPct.textContent = '0%';

                        const start = parseFloat(btn.dataset.start);
                        const end = parseFloat(btn.dataset.end);
                        const index = parseInt(btn.dataset.index);

                        try {
                            await MotionDetectionMenu.addSegmentToPlaylist(item, start, end, index, btn, playlist, (pct) => {
                                if (footerPct) footerPct.textContent = `${Math.round(pct * 100)}%`;
                                if (footerStatus) footerStatus.textContent = 'Processing...';
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
            if (progressStatus) progressStatus.textContent = 'Error';
            segmentsList.innerHTML = `<div class="p-4 text-center text-danger">Error: ${err.message}</div>`;
        }
    }

    static async addSegmentToPlaylist(originalItem, start, end, index, btn, playlist, onProgress) {
        Logger.log(`Adding motion segment ${index}: ${start} -> ${end}`);

        // 1. Get Source
        const source = await MediaMetadata.getSourceBlob(originalItem, () => playlist._saveState());

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
            duration: formatTime(end - start),
            type: 'video',
            isLocal: true,
            isNew: true,
            path: newPath
        };

        // 4. Add to Playlist
        playlist.addItem(newItem);

        // Feedback
        const useEl = btn.querySelector('use');
        if (useEl) useEl.setAttribute('href', 'assets/icons/sprite.svg#icon-check');
        btn.classList.add('text-success');
        btn.classList.remove('jellyjump-btn-small');
        btn.title = "Added";
    }
}

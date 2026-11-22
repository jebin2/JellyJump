import { openToolSurface } from '../core/MenuFactory.js';
import { playRowsOnClick } from '../core/PreviewPlayer.js';
import { Logger } from "../../../shared/utils/Logger.js";
import { MotionDetector } from "../../../shared/services/MotionDetector.js";
import { formatTime } from "../../../shared/utils/mediaUtils.js";
import { addSegmentClip } from '../core/SegmentClip.js';
import { html } from '../../../shared/utils/html.js';

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

        const modal = openToolSurface({
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

            await MotionDetectionMenu.runDetection(item, videoUrl, detector, playlist, { threshold }, () => isCancelled, {
                segmentsList, progressSection, progressPercentage, successMessage, errorMessage, modalContent, modal
            });

            isDetecting = false;
            detectBtn.disabled = false;
            // detectBtn.textContent = 'Re-detect';
            progressSection.classList.add('hidden');
        });

        // In the edit panel the video is in the main player: a found stretch
        // plays there, on a loop, when its row is clicked.
        if (modal.isPanel) playRowsOnClick(modal, playlist, segmentsList);

        modal.open();
    }

    static async runDetection(item, videoUrl, detector, playlist, options, isCancelled, ui) {
        // A function, not the flag itself: passed as a boolean it was copied
        // at the call, and leaving the tool mid-detection was never seen here.
        const { segmentsList, progressPercentage, modalContent, modal } = ui;

        const progressStatus = modalContent.querySelector('.progress-status');
        if (progressStatus) progressStatus.textContent = 'Scanning video...';

        detector.progressCallback = (progress) => {
            if (isCancelled()) return;
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
            if (isCancelled()) return;

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
                    btn.onclick = (e) => {
                        e.stopPropagation();
                        addSegmentClip({
                            item, playlist, surface: modal,
                            start: parseFloat(btn.dataset.start),
                            end: parseFloat(btn.dataset.end),
                            index: parseInt(btn.dataset.index),
                            kind: 'Motion',
                            folder: `Motion from ${item.title}`,
                            button: btn,
                        });
                    };
                });
            }

        } catch (err) {
            if (isCancelled()) return;
            Logger.error('MotionDetectionMenu: Error', err);
            if (progressStatus) progressStatus.textContent = 'Error';
            segmentsList.innerHTML = html`<div class="p-4 text-center text-danger">Error: ${err.message}</div>`;
        }
    }
}

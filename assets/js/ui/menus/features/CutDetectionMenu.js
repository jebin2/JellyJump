import { openToolSurface } from '../core/MenuFactory.js';
import { playRowsOnClick } from '../core/PreviewPlayer.js';
import { Logger } from "../../../shared/utils/Logger.js";
import { HardCutDetector } from "../../../shared/services/HardCutDetector.js";
import { formatTime } from "../../../shared/utils/mediaUtils.js";
import { addSegmentClip } from '../core/SegmentClip.js';
import { html } from '../../../shared/utils/html.js';
import { installTemplates } from '../core/Templates.js';
import detectionTemplates from '../templates/detection.html?raw';

installTemplates(detectionTemplates);

export class CutDetectionMenu {
    static async init(item, playlist) {
        const videoUrl = item?.blob_url || item?.url;
        if (!item || !videoUrl) {
            Logger.warn('CutDetectionMenu: No valid item or URL provided');
            return;
        }

        const contentTemplate = document.getElementById('detection-content-template');
        const footerTemplate = document.getElementById('detection-footer-template');
        if (!contentTemplate || !footerTemplate) {
            Logger.error('CutDetectionMenu: Missing templates');
            return;
        }

        let detector = new HardCutDetector();
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

        modal.setTitle('Scene Detection');
        modal.setBody(contentTemplate.content.cloneNode(true));
        modal.setFooter(footerTemplate.content.cloneNode(true));

        const modalContent = modal.modal;

        // UI Elements (body)
        const targetFilename = modalContent.querySelector('.target-filename');
        const sensitivitySection = modalContent.querySelector('.sensitivity-section');
        const sensitivitySlider = modalContent.querySelector('.sensitivity-slider');
        const sensitivityValue = modalContent.querySelector('.sensitivity-value');
        const statusArea = modalContent.querySelector('.detection-status-area');
        const cutsList = modalContent.querySelector('.detected-items-list');

        // Footer Elements
        const detectBtn = modalContent.querySelector('.detect-btn');
        const progressSection = modalContent.querySelector('.progress-section');
        const progressPercentage = modalContent.querySelector('.progress-percentage');
        const successMessage = modalContent.querySelector('.success-message');
        const errorMessage = modalContent.querySelector('.error-message');

        // Update Detect Button Icon (Scenes)
        if (detectBtn) {
            const useEl = detectBtn.querySelector('use');
            if (useEl) useEl.setAttribute('href', 'assets/icons/sprite.svg#icon-scenes');
            detectBtn.title = "Detect Scenes";
            detectBtn.setAttribute('aria-label', "Detect Scenes");
        }

        targetFilename.textContent = item.title;

        // Show sensitivity section (hidden by default), hide status area
        if (sensitivitySection) sensitivitySection.classList.remove('hidden');
        if (statusArea) statusArea.classList.add('hidden');

        // Sensitivity slider labels
        const sensitivityLabels = { 1: 'High', 2: 'Medium', 3: 'Low' };
        sensitivitySlider.addEventListener('input', () => {
            sensitivityValue.textContent = sensitivityLabels[sensitivitySlider.value];
        });

        // Detect button click (button is in footer)
        detectBtn.addEventListener('click', async () => {
            if (isDetecting) return;
            isDetecting = true;
            detectBtn.disabled = true;
            // detectBtn.textContent = 'Detecting...'; // Don't change icon button text

            const sensitivity = parseInt(sensitivitySlider.value);
            Logger.log('CutDetectionMenu: Starting detection with sensitivity', sensitivity);

            // Show footer progress section
            progressSection.classList.remove('hidden');
            const progressStatus = modalContent.querySelector('.progress-status');
            if (progressStatus) progressStatus.textContent = 'Analyzing...';

            cutsList.innerHTML = '<div class="flex-center flex-col gap-sm h-full text-muted italic py-xl"><div class="spinner-sm border-2 border-current border-t-transparent rounded-full w-6 h-6 animate-spin opacity-50"></div><span class="text-sm">Analyzing video...</span></div>';

            await CutDetectionMenu.runDetection(item, videoUrl, detector, playlist, {
                sensitivity,
                adaptiveMode: true
            }, () => isCancelled, {
                statusText: progressStatus, statusPercent: progressPercentage, cutsList,
                progressSection, successMessage, errorMessage, modalContent, modal
            });

            isDetecting = false;
            detectBtn.disabled = false;
            // detectBtn.textContent = 'Detect Scenes'; 
            progressSection.classList.add('hidden');
        });

        // In the edit panel the video is in the main player: a found stretch
        // plays there, on a loop, when its row is clicked.
        if (modal.isPanel) playRowsOnClick(modal, playlist, cutsList);

        modal.open();
    }

    static async runDetection(item, videoUrl, detector, playlist, options, isCancelled, ui) {
        // A function, not the flag itself: passed as a boolean it was copied
        // at the call, and leaving the tool mid-detection was never seen here.
        const { statusText, statusPercent, cutsList, modal } = ui;

        if (statusText) statusText.textContent = 'Analyzing video...';

        detector.progressCallback = (progress) => {
            if (isCancelled()) return;
            const pct = Math.round(progress * 100);
            if (statusPercent) statusPercent.textContent = `${pct}%`;

            // Update status text for phases
            if (statusText) {
                if (progress < 0.4) {
                    statusText.textContent = 'Analyzing frames...';
                } else {
                    statusText.textContent = 'Detecting cuts...';
                }
            }
        };

        try {
            // Get duration
            let duration = 0;
            if (playlist.player && playlist.player.duration) {
                duration = playlist.player.duration;
            }

            if (!duration && item.duration) {
                if (typeof item.duration === 'number') duration = item.duration;
                else if (typeof item.duration === 'string' && item.duration.includes(':')) {
                    const parts = item.duration.split(':').map(Number);
                    if (parts.length === 3) duration = parts[0] * 3600 + parts[1] * 60 + parts[2];
                    else if (parts.length === 2) duration = parts[0] * 60 + parts[1];
                }
            }

            // Run detection with user options
            const cuts = await detector.detect(videoUrl, {
                adaptiveMode: options.adaptiveMode,
                sensitivity: options.sensitivity
            });

            if (isCancelled()) return;

            // Show statistics if adaptive mode was used
            const stats = detector.getLastStats();
            if (stats && options.adaptiveMode) {
                Logger.log('CutDetectionMenu: Detection stats', stats);
            }

            statusText.textContent = `Found ${cuts.length} scene changes`;
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
                cutsList.innerHTML = '<div class="p-4 text-center text-muted italic">No distinct scenes detected. Try higher sensitivity.</div>';
            } else {
                const listHtml = segments.map((seg) => {
                    const startStr = formatTime(seg.start);
                    const endStr = formatTime(seg.end);
                    const durationStr = formatTime(seg.end - seg.start);

                    return `
                    <div class="segment-item p-sm rounded bg-tertiary flex-between hover:bg-white/5 transition-colors group border border-transparent hover:border-white/10">
                        <div class="flex flex-col gap-xs flex-1">
                            <span class="font-bold text-accent text-sm">Segment ${seg.index}</span>
                            <span class="text-xs text-muted font-mono">${startStr} - ${endStr} (${durationStr})</span>
                        </div>
                        <div class="flex gap-sm items-center">
                            <button class="add-segment-btn btn jellyjump-btn-small flex items-center justify-center p-sm" 
                                data-start="${seg.start}" 
                                data-end="${seg.end}" 
                                data-index="${seg.index}"
                                title="Add Clip">
                                <svg width="16" height="16" fill="currentColor"><use href="assets/icons/sprite.svg#icon-plus"></use></svg>
                            </button>
                        </div>
                    </div>`;
                }).join('');

                cutsList.innerHTML = listHtml;

                const addBtns = cutsList.querySelectorAll('.add-segment-btn');
                addBtns.forEach(btn => {
                    btn.onclick = (e) => {
                        e.stopPropagation();
                        addSegmentClip({
                            item, playlist, surface: modal,
                            start: parseFloat(btn.dataset.start),
                            end: parseFloat(btn.dataset.end),
                            index: parseInt(btn.dataset.index),
                            kind: 'Scene',
                            folder: `Cuts from ${item.title}`,
                            button: btn,
                        });
                    };
                });
            }

        } catch (err) {
            if (isCancelled()) return;
            Logger.error('CutDetectionMenu: Error', err);
            statusText.textContent = 'Error: ' + err.message;
            statusText.classList.add('text-danger');
            cutsList.innerHTML = html`<div class="p-4 text-center text-danger">Error: ${err.message}</div>`;
        }
    }
}

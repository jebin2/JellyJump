import { Modal as ModalDialog } from "../Modal.js";
import { Logger } from "../../utils/Logger.js";
import { HardCutDetector } from "../HardCutDetector.js";
import { formatTime, generateId } from "../../utils/mediaUtils.js";
import { MediaProcessor } from '../../core/MediaProcessor.js';
import { MediaMetadata } from '../../utils/MediaMetadata.js';

export class CutDetectionMenu {
    constructor(playlist) {
        this.playlist = playlist;
    }

    /**
     * Called when the menu item is clicked - Single seamless view
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
        if (!contentTemplate || !footerTemplate) {
            Logger.error('CutDetectionMenu: Missing templates');
            return;
        }

        let detector = new HardCutDetector();
        let isCancelled = false;
        let isDetecting = false;

        const modal = new ModalDialog({
            maxWidth: '600px',
            onClose: () => {
                isCancelled = true;
                if (detector) detector.cancel();
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

            await this.runDetection(item, videoUrl, detector, {
                sensitivity,
                adaptiveMode: true
            }, isCancelled, {
                statusText: progressStatus, statusPercent: progressPercentage, cutsList,
                progressSection, successMessage, errorMessage, modalContent
            });

            isDetecting = false;
            detectBtn.disabled = false;
            // detectBtn.textContent = 'Detect Scenes'; 
            progressSection.classList.add('hidden');
        });

        modal.open();
    }

    /**
     * Run the actual detection
     */
    async runDetection(item, videoUrl, detector, options, isCancelled, ui) {
        const { statusText, statusPercent, cutsList,
            progressSection, successMessage, errorMessage, modalContent } = ui;

        if (statusText) statusText.textContent = 'Analyzing video...';

        detector.progressCallback = (progress) => {
            if (isCancelled) return;
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

            // Run detection with user options
            const cuts = await detector.detect(videoUrl, {
                adaptiveMode: options.adaptiveMode,
                sensitivity: options.sensitivity
            });

            if (isCancelled) return;

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
                            await this.addSegmentToPlaylist(item, start, end, index, btn, (pct) => {
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
            Logger.error('CutDetectionMenu: Error', err);
            statusText.textContent = 'Error: ' + err.message;
            statusText.classList.add('text-danger');
            cutsList.innerHTML = `<div class="p-4 text-center text-danger">Error: ${err.message}</div>`;
        }
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
            duration: formatTime(end - start),
            type: 'video',
            isLocal: true,
            isNew: true,
            path: newPath
        };

        // 4. Add to Playlist
        this.playlist.addItem(newItem);

        // Feedback
        const useEl = btn.querySelector('use');
        if (useEl) useEl.setAttribute('href', 'assets/icons/sprite.svg#icon-check');
        btn.classList.add('text-success');
        btn.classList.remove('jellyjump-btn-small'); // Optional: remove style if needed, or keep for checkmark
        btn.title = "Added";
    }
}

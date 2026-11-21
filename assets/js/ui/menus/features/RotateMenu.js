import { Logger } from "../../../shared/utils/Logger.js";
import { openProcessMenu, FOOTER_CONFIGS } from '../core/MenuFactory.js';
import { MediaProcessor } from "../../../core/MediaProcessor.js";
import {
    loadVideo,
    setupEditor,
    setupCleanup
} from './BoxEditorUtils.js';

import { MediaMetadata } from "../../../shared/utils/MediaMetadata.js";
import { runMenuJob } from '../core/MenuJob.js';

export class RotateMenu {
    /**
     * Initialize Rotate & Flip Menu
     * @param {Object} item - Playlist item
     * @param {Playlist} playlist - Playlist instance
     */
    static async init(item, playlist) {
        const { modal, content: modalContent } = openProcessMenu('Rotate & Flip', 'rotate-content-template', FOOTER_CONFIGS.rotate, { splitLayout: true });
        if (!modal) return;

        // In the edit panel the main player is the preview: it turns there,
        // and turns back when the tool closes.
        if (modal.isPanel) {
            const canvas = playlist.player?.container?.querySelector('canvas.jellyjump-video');
            modal.onCleanup(() => {
                if (!canvas) return;
                canvas.style.transform = '';
                canvas.style.transition = '';
            });
            this._setup(modal, item, playlist, null, { previewEl: canvas });
            return;
        }

        // === Setup Editor DOM (Left Panel) ===
        const videoPanel = modalContent.querySelector('.modal-video-panel');
        // We use setupEditor to create the container structure, 
        // but we disable the overlay since we are not drawing boxes.
        const editorUI = setupEditor(videoPanel, {
            type: 'rotate',
            enableOverlay: false
        });

        // === Load Video ===
        // State object required by loadVideo
        const state = {
            video: { width: 0, height: 0 },
            preview: { scale: 1 }
        };

        const player = await loadVideo(editorUI.containerId, item, playlist, state);
        if (!player) {
            Logger.error('[RotateMenu] Failed to load video');
            return;
        }

        this._setup(modal, item, playlist, player, editorUI);
    }

    /**
     * Setup UI and Event Listeners
     * @private
     */
    static _setup(modal, item, playlist, player, editorUI) {
        const modalBody = modal.modal.querySelector('.mb-modal-body');

        // State
        let rotation = 0;
        let flipH = false;
        let flipV = false;

        // Target element for CSS transforms
        // Try to find canvas or video inside the player container
        const getMediaElement = () => {
            if (editorUI.previewEl !== undefined) return editorUI.previewEl;
            return editorUI.playerContainer.querySelector('canvas') ||
                editorUI.playerContainer.querySelector('video');
        };

        // Update Transform Helper
        const updateUI = () => {
            const scaleX = flipH ? -1 : 1;
            const scaleY = flipV ? -1 : 1;
            const mediaEl = getMediaElement();

            if (mediaEl) {
                // A quarter turn swaps the frame's width and height. The
                // element shows the frame contained in its box; shrunk by how
                // much smaller the turned frame must be to be contained in
                // the same box, it stays inside it.
                const W = mediaEl.offsetWidth, H = mediaEl.offsetHeight;
                // The frame's own size: the main player's canvas is sized to
                // its box, not to the video, so that comes from the item.
                const vw = item.videoInfo?.width || mediaEl.videoWidth || mediaEl.width || W;
                const vh = item.videoInfo?.height || mediaEl.videoHeight || mediaEl.height || H;
                const fit = rotation % 180 !== 0 && W && H && vw && vh
                    ? Math.min(W / vh, H / vw) / Math.min(W / vw, H / vh)
                    : 1;
                mediaEl.style.transition = 'transform 0.3s ease';
                mediaEl.style.transform = `rotate(${rotation}deg) scale(${scaleX * fit}, ${scaleY * fit})`;
            }

            modalBody.querySelector('.rotation-value').textContent = `${rotation}°`;
            modalBody.querySelector('.flip-value').textContent =
                (flipH && flipV) ? 'Horizontal & Vertical' :
                    (flipH ? 'Horizontal' :
                        (flipV ? 'Vertical' : 'None'));
        };

        // Control Listeners
        modalBody.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // find button closest in case of SVG click
                const target = e.target.closest('button');
                const action = target.dataset.action;

                if (action === 'rotate-left') rotation -= 90;
                if (action === 'rotate-right') rotation += 90;

                // Normalize to 0, 90, 180, 270
                rotation = (rotation % 360 + 360) % 360;
                if (action === 'flip-h') flipH = !flipH;
                if (action === 'flip-v') flipV = !flipV;
                if (action === 'reset') { rotation = 0; flipH = false; flipV = false; }

                updateUI();
            });
        });

        // Process Button
        const processBtn = modal.modal.querySelector('.rotate-process-btn');
        const footer = modal.modal.querySelector('.mb-modal-footer');
        const successMsg = footer.querySelector('.success-message');
        const actionButtons = footer.querySelector('.action-buttons');

        processBtn.addEventListener('click', () => {
            // Normalize Rotation
            let normRotation = rotation % 360;

            // Named after the original, beside it in the playlist.
            const originalName = item.file ? item.file.name : (item.title || 'video.mp4');
            const nameParts = originalName.split('.');
            const ext = nameParts.pop();
            const newName = `${nameParts.join('.')}_rotated.${ext}`;

            runMenuJob({
                name: 'Rotate',
                subject: item.title,
                background: true,
                modal,
                work: async ({ signal, onProgress }) => {
                    const source = await MediaMetadata.getSourceBlob(item, () => playlist._saveState());
                    return MediaProcessor.process({
                        source, format: 'mp4', quality: 'high',
                        rotate: normRotation,
                        flip: (flipH || flipV) ? { horizontal: flipH, vertical: flipV } : null,
                        onProgress, signal,
                    });
                },
                done: (resultBlob) => playlist.insertProcessedItem(item, resultBlob, newName),
            });
        });

        // Add listener to reset UI on interaction
        const resetSuccessState = () => {
            if (!successMsg.classList.contains('hidden')) {
                successMsg.classList.add('hidden');
                actionButtons.classList.remove('hidden');
            }
        };

        modalBody.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', resetSuccessState);
        });

        // Cleanup
        if (player) setupCleanup(modal, player, null);
    }
}

import { HardCutDetector } from "./player/HardCutDetector.js";
import { Logger } from "./shared/utils/Logger.js";

document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btn-hard-cut-demo');
    if (!btn) return;

    btn.addEventListener('click', async () => {
        // Create a hidden file input
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'video/*';

        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            Logger.log('Selected file for cut detection:', file.name);

            // Visual feedback
            const originalText = btn.innerHTML;
            btn.innerHTML = '<span class="toolbar-btn__icon">⏳</span><span class="toolbar-btn__label">Detecting...</span>';
            btn.disabled = true;

            try {
                const detector = new HardCutDetector();
                detector.progressCallback = (progress) => {
                    const percent = Math.round(progress * 100);
                    btn.querySelector('.toolbar-btn__label').textContent = `Detecting ${percent}%`;
                };

                const start = performance.now();
                const cuts = await detector.detect(file);
                const end = performance.now();

                const msg = `Detection complete in ${((end - start) / 1000).toFixed(2)}s.\nFound ${cuts.length} cuts:\n${cuts.map(t => t.toFixed(2) + 's').join(', ')}`;
                Logger.log(msg);
                alert(msg);

            } catch (err) {
                Logger.error('Detection failed', err);
                alert('Detection failed: ' + err.message);
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        };

        input.click();
    });
});

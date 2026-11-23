// @ts-check
/**
 * Info → Diagnostics (ARCHITECTURE_PLAN.md P4): what this device and build
 * are, how the app has been performing, and what went wrong, with "Copy" to
 * paste into a bug report. Nothing in it names a file or an address.
 */
import { Modal } from '../../Modal.js';
import { collectDiagnostics, formatDiagnostics } from '../../../shared/diagnostics/Diagnostics.js';
import { Logger } from '../../../shared/utils/Logger.js';

export const DiagnosticsView = {
    /** @returns {Promise<Modal>} */
    async open() {
        const modal = new Modal({ maxWidth: '720px' });
        modal.setTitle('Diagnostics');

        const report = document.createElement('pre');
        report.className = 'diagnostics-report';
        report.style.cssText = 'white-space:pre-wrap;word-break:break-word;font-size:12px;line-height:1.5;margin:0;max-height:60vh;overflow:auto;user-select:text;';
        report.textContent = 'Collecting…';
        modal.setBody(report);

        const footer = document.createElement('div');
        footer.className = 'flex-between items-center w-full gap-md';
        const status = document.createElement('span');
        status.className = 'diagnostics-status text-sm';
        status.setAttribute('aria-live', 'polite');
        const copy = document.createElement('button');
        copy.type = 'button';
        copy.className = 'btn jellyjump-btn-small diagnostics-copy';
        copy.textContent = 'Copy';
        copy.disabled = true;
        footer.append(status, copy);
        modal.setFooter(footer);
        modal.open();

        const text = formatDiagnostics(await collectDiagnostics());
        report.textContent = text;
        copy.disabled = false;
        copy.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(text);
                status.textContent = 'Copied. Paste it into the bug report.';
            } catch (error) {
                Logger.warn('[Diagnostics] Could not copy:', error);
                status.textContent = 'Could not copy; select the text and copy it instead.';
            }
        });
        return modal;
    },
};

// @ts-check
/**
 * Info → Diagnostics (ARCHITECTURE_PLAN.md P4): what this device and build
 * are, how the app has been performing, and what went wrong, with "Copy" to
 * paste into a bug report. Nothing in it names a file or an address.
 *
 * "Copy log" and "Save log" give the report with the player's log after it
 * (the last entries of this page): from a phone, where there is no console,
 * "Save log" opens the share sheet, or saves a .txt where it cannot.
 */
import { Modal } from '../../Modal.js';
import { collectDiagnostics, formatDiagnostics, formatDiagnosticsWithLog } from '../../../shared/diagnostics/Diagnostics.js';
import { Logger } from '../../../shared/utils/Logger.js';

/** @param {string} label @param {string} className */
function button(label, className) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `btn jellyjump-btn-small ${className}`;
    b.textContent = label;
    b.disabled = true;
    return b;
}

/**
 * Share the text as a file where the device can (a phone's share sheet),
 * else save it.
 * @param {string} text
 * @returns {Promise<'shared'|'saved'|'cancelled'>}
 */
async function shareOrSave(text) {
    const d = new Date();
    const pad = (/** @type {number} */ n) => String(n).padStart(2, '0');
    const name = `jellyjump-log-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.txt`;
    const blob = new Blob([text], { type: 'text/plain' });
    const file = new File([blob], name, { type: 'text/plain' });
    if (navigator.canShare?.({ files: [file] })) {
        try {
            await navigator.share({ files: [file], title: 'JellyJump log' });
            return 'shared';
        } catch (error) {
            if (/** @type {Error} */ (error).name === 'AbortError') return 'cancelled';
            Logger.warn('[Diagnostics] Could not share the log; saving it instead:', error);
        }
    }
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 60_000);
    return 'saved';
}

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
        footer.style.flexWrap = 'wrap';
        const status = document.createElement('span');
        status.className = 'diagnostics-status text-sm';
        status.setAttribute('aria-live', 'polite');
        const buttons = document.createElement('div');
        buttons.className = 'flex items-center gap-sm';
        buttons.style.flexWrap = 'wrap';
        const copy = button('Copy', 'diagnostics-copy');
        const copyLog = button('Copy log', 'diagnostics-copy-log');
        const saveLog = button('Save log', 'diagnostics-save-log');
        buttons.append(copy, copyLog, saveLog);
        footer.append(status, buttons);
        modal.setFooter(footer);
        modal.open();

        const data = await collectDiagnostics();
        const text = formatDiagnostics(data);
        report.textContent = text;
        // The log is read when asked for, so it has what happened since the view opened.
        const withLog = () => formatDiagnosticsWithLog(data);

        /** @param {string} value @param {string} done */
        const copyText = async (value, done) => {
            try {
                await navigator.clipboard.writeText(value);
                status.textContent = done;
            } catch (error) {
                Logger.warn('[Diagnostics] Could not copy:', error);
                status.textContent = 'Could not copy; try Save log, or select the text and copy it.';
            }
        };
        copy.addEventListener('click', () => copyText(text, 'Copied. Paste it into the bug report.'));
        copyLog.addEventListener('click', () => copyText(withLog(), `Copied, with the log (${Logger.entries().length} lines).`));
        saveLog.addEventListener('click', async () => {
            try {
                const outcome = await shareOrSave(withLog());
                status.textContent = outcome === 'shared' ? 'Shared.' : outcome === 'saved' ? 'Saved as a .txt file.' : '';
            } catch (error) {
                Logger.warn('[Diagnostics] Could not save the log:', error);
                status.textContent = 'Could not save; try Copy log.';
            }
        });
        for (const b of [copy, copyLog, saveLog]) b.disabled = false;
        return modal;
    },
};

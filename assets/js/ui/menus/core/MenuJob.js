// @ts-check
import { Logger } from '../../../shared/utils/Logger.js';
import { startCancellableJob, CANCELLED_MESSAGE } from './CancellableJob.js';
import { JobQueue } from '../../../shared/services/JobQueue.js';

/**
 * runMenuJob - the part every processing menu does the same way.
 *
 * Seventeen menus each wrote out the same sequence around their one real
 * call: hide the old messages, show the progress area, lock the controls and
 * the close button, offer Cancel, report percentages, then on success show the
 * success message and on failure show why (or that it was cancelled), and
 * unlock. Written seventeen times it drifted, and every change to it -- the
 * Cancel button was the last -- had to be made seventeen times. This is that
 * sequence once; a menu passes its elements and its work.
 *
 * @param {Object} options
 * @param {{section?: Element, text?: Element, bar?: HTMLElement, status?: Element}} [options.progress]
 *   the progress area; `text` gets the percentage, `bar` its width, `status`
 *   a label when the work reports one
 * @param {Element} [options.error] - shown with the failure, or the cancel
 * @param {Element} [options.success] - shown when the work succeeds
 * @param {Array<HTMLButtonElement|HTMLInputElement|HTMLSelectElement|{setDisabled: (locked: boolean) => void}|null>} [options.lock] -
 *   controls to disable while working; dropdowns with setDisabled() work too
 * @param {Object} [options.modal] - its close button is locked as well
 * @param {'always'|'onFailure'} [options.unlock] - after a success, whether
 *   the controls come back ('always', the default) or stay locked so the same
 *   job is not run twice ('onFailure'); the close button always comes back
 * @param {string} [options.name] - for the log, and the failure message
 *   ("<name> failed: ...") when `failureText` is not given
 * @param {(error: Error) => string} [options.failureText] - the failure message
 * @param {(api: {signal: AbortSignal, onProgress: (fraction: number, label?: string) => void}) => Promise<*>} options.work
 * @param {(result: *) => (void|Promise<void>)} [options.done] - after success,
 *   with what `work` returned
 * @param {boolean} [options.background] - hand the job to the JobQueue and
 *   close the dialog, rather than run it inside the dialog. The job tray then
 *   shows its progress and its result; progress, error, success and lock are
 *   not used. A tool in the edit panel stays open instead, and the panel
 *   takes the result.
 * @param {string} [options.subject] - in the background, what the job works
 *   on, shown beside its name in the tray (usually the item's title)
 * @param {boolean} [options.keepOpen] - in the background, leave the dialog
 *   open, for a menu that starts several jobs from one dialog
 * @returns {Promise<{ok: boolean, cancelled?: boolean, result?: *, error?: Error}>}
 */
export async function runMenuJob({
    progress = {}, error, success, lock = [], modal, unlock = 'always',
    name = 'Processing', failureText, work, done,
    background = false, subject = '', keepOpen = false,
}) {
    if (background) {
        // The dialog was only for the settings. Closing it now gives the user
        // the player back while the job runs, instead of a progress bar to
        // watch; the tray shows how it is going and offers the result.
        const { job, finished } = JobQueue.add({ name, subject, work, done, failureText });
        // In the edit panel the tool stays open: the panel waits for the
        // result, to edit further on top of it.
        if (modal?.isPanel) modal.jobQueued?.(name, job, finished);
        else if (!keepOpen) modal?.close();
        return finished;
    }

    const setLocked = (locked) => {
        for (const control of lock) {
            if (!control) continue;
            if ('setDisabled' in control) control.setDisabled(locked);
            else control.disabled = locked;
        }
    };
    const setCloseLocked = (locked) => {
        if (modal?.closeBtn) modal.closeBtn.disabled = locked;
    };

    error?.classList.add('hidden');
    success?.classList.add('hidden');
    progress.section?.classList.remove('hidden');
    setLocked(true);
    setCloseLocked(true);

    const onProgress = (fraction, label) => {
        const pct = Math.round(Math.max(0, Math.min(1, fraction)) * 100);
        if (progress.text) progress.text.textContent = `${pct}%`;
        if (progress.bar) progress.bar.style.width = `${pct}%`;
        if (label && progress.status) progress.status.textContent = label;
    };

    const job = startCancellableJob(progress.section);
    try {
        const result = await work({ signal: job.signal, onProgress });
        progress.section?.classList.add('hidden');
        success?.classList.remove('hidden');
        await done?.(result);
        if (unlock === 'always') setLocked(false);
        return { ok: true, result };
    } catch (failure) {
        const cancelled = job.isCancelled(failure);
        if (!cancelled) Logger.error(`${name} failed:`, failure);
        progress.section?.classList.add('hidden');
        if (error) {
            error.textContent = cancelled
                ? CANCELLED_MESSAGE
                : (failureText ? failureText(failure) : `${name} failed: ${failure.message}`);
            error.classList.remove('hidden');
        }
        setLocked(false);
        return { ok: false, cancelled, error: failure };
    } finally {
        setCloseLocked(false);
        job.end();
    }
}

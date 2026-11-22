// @ts-check
import { isCancellation } from '../../../shared/utils/Cancellation.js';

/** What a menu shows when the user stopped the job themselves. */
export const CANCELLED_MESSAGE = 'Operation cancelled.';

/**
 * A Cancel button for a running export, placed in the menu's progress area.
 *
 * The signal goes to the MediaProcessor call; the processing services stop
 * their Mediabunny conversion (or their own frame loop) when it fires and
 * reject with an AbortError. `isCancelled(error)` tells a menu's catch block
 * whether to show the failure or just that it was cancelled.
 *
 * @param {Element|null} container - where the button goes, usually the
 *   menu's `.progress-section`
 * @returns {{ signal: AbortSignal, isCancelled: (error: unknown) => boolean, end: () => void }}
 *   call end() when the job settles, either way, to remove the button
 */
export function startCancellableJob(container) {
    const controller = new AbortController();
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Cancel';
    button.className = 'jellyjump-btn-secondary text-sm job-cancel-btn';
    button.addEventListener('click', () => {
        button.disabled = true;
        button.textContent = 'Cancelling…';
        controller.abort();
    });
    container?.appendChild(button);

    return {
        signal: controller.signal,
        isCancelled: (error) => controller.signal.aborted && isCancellation(error),
        end: () => button.remove(),
    };
}

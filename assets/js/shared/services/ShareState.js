import { Logger } from '../utils/Logger.js';

/**
 * ShareState
 * Tracks whether the library is being shared, and reflects it on the Tools
 * button so it is visible without opening a menu.
 *
 * Sharing outlives the menu that starts it — the modal closes but the server
 * keeps running — so something has to carry that state in the main UI. This
 * mirrors how recording already marks the same button.
 */

const TOOLS_BUTTON_ID = 'mb-tools';
const ACTIVE_CLASS = 'sharing-active';

let enabled = false;
const listeners = new Set();

function isSupported() {
    return typeof window !== 'undefined' && !!window.electronAPI?.getShareStatus;
}

function applyToButton() {
    const button = document.getElementById(TOOLS_BUTTON_ID);
    if (!button) return;
    button.classList.toggle(ACTIVE_CLASS, enabled);
    // Recording owns the same button and means something more urgent, so it
    // keeps its own title when both are somehow true.
    if (!button.classList.contains('recording-active')) {
        button.title = enabled ? 'Tools — sharing library' : 'Tools';
    }
}

function set(next) {
    const changed = enabled !== next;
    enabled = next;
    applyToButton();
    if (changed) {
        for (const listener of listeners) {
            try {
                listener(enabled);
            } catch (error) {
                Logger.error('[ShareState] Listener threw:', error);
            }
        }
    }
}

export const ShareState = {
    get isSharing() {
        return enabled;
    },

    isSupported,

    /** Ask the main process and reflect the answer. Safe to call on any runtime. */
    async refresh() {
        if (!isSupported()) return false;
        try {
            const result = await window.electronAPI.getShareStatus();
            set(!!(result?.success && result.state?.enabled));
        } catch (error) {
            Logger.warn('[ShareState] Could not read share status:', error);
            set(false);
        }
        return enabled;
    },

    /** Called by the share menu, which already knows the new state. */
    update(state) {
        set(!!state?.enabled);
    },

    subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
    },
};

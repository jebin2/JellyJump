/**
 * TimelineToolbar
 * Handles interactions for the timeline edit toolbar.
 */
class TimelineToolbar {
    constructor() {
        this.toolbar = document.querySelector('.timeline-toolbar');
        this.buttons = {};

        // Map action names to button elements
        const buttonElements = this.toolbar.querySelectorAll('.toolbar-btn');
        buttonElements.forEach(btn => {
            const action = btn.dataset.action;
            if (action) {
                this.buttons[action] = btn;
            }
        });

        this.init();
    }

    init() {
        this.attachEventListeners();
        console.log('TimelineToolbar initialized');
    }

    attachEventListeners() {
        if (!this.toolbar) return;

        this.toolbar.addEventListener('click', (e) => {
            const btn = e.target.closest('.toolbar-btn');
            if (!btn || btn.disabled) return;

            const action = btn.dataset.action;
            if (action) {
                this.handleAction(action);
            }
        });
    }

    handleAction(action) {
        console.log(`Toolbar action: ${action}`);
        // Future: Dispatch event or call editor method
        // const event = new CustomEvent('timeline-action', { detail: { action } });
        // window.dispatchEvent(event);
    }

    enableButton(action) {
        if (this.buttons[action]) {
            this.buttons[action].removeAttribute('disabled');
            this.buttons[action].setAttribute('aria-disabled', 'false');
        }
    }

    disableButton(action) {
        if (this.buttons[action]) {
            this.buttons[action].setAttribute('disabled', 'true');
            this.buttons[action].setAttribute('aria-disabled', 'true');
        }
    }

    updateButtonStates(selection) {
        // Placeholder for future logic based on selection
        const hasSelection = selection && selection.length > 0;

        if (hasSelection) {
            this.enableButton('cut');
            this.enableButton('copy');
            this.enableButton('delete');
        } else {
            this.disableButton('cut');
            this.disableButton('copy');
            this.disableButton('delete');
        }

        // Paste, Undo, Redo would depend on clipboard/history state
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.timelineToolbar = new TimelineToolbar();
});

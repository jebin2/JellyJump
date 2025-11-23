import { modalDialog } from './modal-dialog.js';

/**
 * MediaBunny Editor - Tab Manager
 * Handles creation, state management, and rendering of project tabs.
 * Phase: 36
 */

export class TabManager {
    constructor() {
        this.tabs = [];
        this.maxTabs = 10;
        this.tabContainer = document.querySelector('.tab-bar__tabs');
        this.createBtn = document.querySelector('[data-action="create-tab"]');
        this.notificationContainer = document.getElementById('notification-container');

        this.init();
    }

    init() {
        if (this.createBtn) {
            this.createBtn.addEventListener('click', () => this.createTab());
        }

        // Event delegation for tab clicks
        if (this.tabContainer) {
            this.tabContainer.addEventListener('click', (e) => this.handleTabClick(e));
            this.tabContainer.addEventListener('keydown', (e) => this.handleKeyDown(e));
        }

        // Create initial tab if none exist
        if (this.tabs.length === 0) {
            this.createTab();
        }
    }

    /**
     * Handles click events on the tab container
     * @param {Event} e 
     */
    handleTabClick(e) {
        const tabElement = e.target.closest('.editor-tab');
        if (!tabElement) return;

        // Check for close button click
        if (e.target.closest('.editor-tab__close')) {
            e.stopPropagation(); // Stop propagation to prevent tab switch
            const tabId = tabElement.dataset.tabId;
            if (tabId) {
                this.closeTab(tabId);
            }
            return;
        }

        const tabId = tabElement.dataset.tabId;
        if (tabId) {
            this.switchTab(tabId);
        }
    }

    /**
     * Closes the specified tab
     * @param {string} tabId 
     */
    closeTab(tabId) {
        // Prevent closing if it's the last tab
        if (this.tabs.length <= 1) {
            this.showNotification('⚠️ Cannot close last tab', 'error');
            return;
        }

        const tab = this.tabs.find(t => t.id === tabId);
        if (!tab) return;

        // Check for unsaved changes
        if (tab.hasUnsavedChanges) {
            this.showUnsavedDialog(tab);
            return;
        }

        this.performCloseTab(tabId);
    }

    /**
     * Shows unsaved changes confirmation dialog
     * @param {Object} tab 
     */
    showUnsavedDialog(tab) {
        modalDialog.show(
            'Unsaved Changes',
            `Do you want to save changes to "${tab.name}" before closing?`,
            [
                {
                    text: 'Save',
                    type: 'primary',
                    callback: () => {
                        console.log(`Saving project: ${tab.id}`);
                        // Simulate save
                        this.performCloseTab(tab.id);
                    }
                },
                {
                    text: "Don't Save",
                    type: 'danger',
                    callback: () => {
                        console.log(`Tab closed without saving: ${tab.id}`);
                        this.performCloseTab(tab.id);
                    }
                },
                {
                    text: 'Cancel',
                    type: 'secondary',
                    callback: () => {
                        console.log(`Close canceled for tab: ${tab.id}`);
                    }
                }
            ]
        );
    }

    /**
     * Performs the actual tab closing logic
     * @param {string} tabId 
     */
    performCloseTab(tabId) {
        const tabIndex = this.tabs.findIndex(t => t.id === tabId);
        if (tabIndex === -1) return;

        const tabToClose = this.tabs[tabIndex];

        // If closing active tab, switch to adjacent
        if (tabToClose.isActive) {
            // Try next tab, otherwise previous tab
            let nextTab = this.tabs[tabIndex + 1] || this.tabs[tabIndex - 1];
            if (nextTab) {
                // Manually update active state without full re-render loop
                this.tabs.forEach(t => t.isActive = (t.id === nextTab.id));
            }
        }

        // Remove from array
        this.tabs.splice(tabIndex, 1);

        // Render updates
        this.renderTabs();

        console.log(`Closed tab: ${tabId}`);
    }

    /**
     * Marks a tab as having unsaved changes
     * @param {string} tabId 
     */
    markTabUnsaved(tabId) {
        const tab = this.tabs.find(t => t.id === tabId);
        if (tab && !tab.hasUnsavedChanges) {
            tab.hasUnsavedChanges = true;
            this.renderTabs();
        }
    }

    /**
     * Marks a tab as saved
     * @param {string} tabId 
     */
    markTabSaved(tabId) {
        const tab = this.tabs.find(t => t.id === tabId);
        if (tab && tab.hasUnsavedChanges) {
            tab.hasUnsavedChanges = false;
            this.renderTabs();
        }
    }

    /**
     * Handles keyboard navigation
     * @param {KeyboardEvent} e 
     */
    handleKeyDown(e) {
        const tabs = Array.from(this.tabContainer.querySelectorAll('.editor-tab'));
        const activeElement = document.activeElement;
        const index = tabs.indexOf(activeElement);

        if (index === -1) return;

        let nextIndex;

        switch (e.key) {
            case 'ArrowLeft':
                e.preventDefault(); // Prevent default scroll behavior
                nextIndex = index - 1;
                if (nextIndex < 0) nextIndex = tabs.length - 1;
                tabs[nextIndex].focus();
                break;
            case 'ArrowRight':
                e.preventDefault(); // Prevent default scroll behavior
                nextIndex = index + 1;
                if (nextIndex >= tabs.length) nextIndex = 0;
                tabs[nextIndex].focus();
                break;
            case 'Enter':
            case ' ':
                e.preventDefault();
                this.switchTab(tabs[index].dataset.tabId);
                break;
        }
    }

    /**
     * Switches to the specified tab
     * @param {string} tabId 
     */
    switchTab(tabId) {
        const tab = this.tabs.find(t => t.id === tabId);

        if (!tab) return;
        if (tab.isActive) return; // Already active

        // Update state
        this.tabs.forEach(t => t.isActive = (t.id === tabId));

        // Update UI
        this.renderTabs();

        console.log(`Switched to tab: ${tabId}`);
        console.log(`Loading project data for tab: ${tabId}`);

        // Placeholder for loading data
        // this.loadProjectData(tab);
    }

    /**
     * Creates a new tab if limit is not reached
     */
    createTab() {
        if (this.tabs.length >= this.maxTabs) {
            this.showNotification('⚠️ Maximum 10 tabs allowed', 'error');
            return;
        }

        const newTab = {
            id: crypto.randomUUID(),
            name: 'Untitled Project',
            isActive: true,
            createdAt: Date.now()
        };

        // Deactivate current active tab
        this.tabs.forEach(tab => tab.isActive = false);

        // Add new tab
        this.tabs.push(newTab);

        // Render all tabs (simplest way to ensure UI sync)
        this.renderTabs();

        console.log(`Created tab: ${newTab.id}`);
    }

    /**
     * Renders all tabs to the DOM
     */
    renderTabs() {
        this.tabContainer.innerHTML = '';

        this.tabs.forEach(tab => {
            const tabElement = document.createElement('div');
            tabElement.className = `editor-tab ${tab.isActive ? 'active' : ''} ${tab.hasUnsavedChanges ? 'unsaved' : ''}`;
            tabElement.dataset.tabId = tab.id;
            tabElement.setAttribute('role', 'tab');
            tabElement.setAttribute('aria-selected', tab.isActive);
            tabElement.setAttribute('aria-label', `Tab: ${tab.name}`);
            tabElement.tabIndex = 0; // Make focusable

            tabElement.innerHTML = `
                <span class="editor-tab__name">${tab.name}</span>
                <button class="editor-tab__close" aria-label="Close tab" data-tab-close tabindex="-1">
                    ×
                </button>
            `;

            this.tabContainer.appendChild(tabElement);
        });

        // Scroll to the active tab if needed
        const activeTab = this.tabContainer.querySelector('.active');
        if (activeTab) {
            activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    /**
     * Shows a notification message
     * @param {string} message 
     * @param {string} type 'success' or 'error'
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification--${type}`;

        const icon = type === 'error' ? '⚠️' : 'ℹ️';

        notification.innerHTML = `
            <span class="notification__icon">${icon}</span>
            <span class="notification__message">${message}</span>
        `;

        this.notificationContainer.appendChild(notification);

        // Auto remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-in forwards';
            notification.addEventListener('animationend', () => {
                notification.remove();
            });
        }, 3000);
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    window.tabManager = new TabManager();
});

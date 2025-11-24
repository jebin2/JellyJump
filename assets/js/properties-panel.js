/**
 * Properties Panel Manager
 * Handles the right sidebar properties panel interactions.
 * Phase 56: Tabbed Interface
 */

export class PropertiesPanel {
    constructor() {
        this.container = document.getElementById('properties-panel');
        this.emptyState = document.getElementById('properties-empty-state');
        this.contentContainer = document.getElementById('properties-content');

        // Tabs
        this.tabBar = document.getElementById('properties-tab-bar');
        this.btnInfo = document.getElementById('tab-btn-info');
        this.btnSettings = document.getElementById('tab-btn-settings');

        // Content Areas
        this.contentInfo = document.getElementById('tab-content-info');
        this.contentSettings = document.getElementById('tab-content-settings');

        this.init();
    }

    /**
     * Initialize event listeners
     */
    init() {
        if (this.btnInfo) {
            this.btnInfo.addEventListener('click', () => this.switchTab('info'));
        }

        if (this.btnSettings) {
            this.btnSettings.addEventListener('click', () => this.switchTab('settings'));
        }

        // For testing/dev: Show content if needed (normally hidden by default until selection)
        // this.showContent(); 
    }

    /**
     * Switch between Info and Settings tabs
     * @param {string} tabId - 'info' or 'settings'
     */
    switchTab(tabId) {
        if (tabId === 'info') {
            // Activate Info Tab
            this.btnInfo.classList.add('active');
            this.btnSettings.classList.remove('active');

            // Show Info Content
            this.contentInfo.classList.add('active');
            this.contentSettings.classList.remove('active');
        } else if (tabId === 'settings') {
            // Activate Settings Tab
            this.btnSettings.classList.add('active');
            this.btnInfo.classList.remove('active');

            // Show Settings Content
            this.contentSettings.classList.add('active');
            this.contentInfo.classList.remove('active');
        }
    }

    /**
     * Update the properties panel based on selection
     * @param {string} selectionType - 'none', 'library', 'timeline'
     * @param {object} data - Data object for the selected item
     */
    update(selectionType, data = {}) {
        console.log(`PropertiesPanel update: ${selectionType}`, data);

        if (selectionType === 'none') {
            this.showEmptyState();
            return;
        }

        // Show content for 'library' or 'timeline'
        this.showContent();

        // Update Metadata
        this._updateMetadata(data);

        // Handle Tabs based on type
        if (selectionType === 'library') {
            // Library items only show Info
            this.switchTab('info');
            this._toggleSettings(false);
        } else if (selectionType === 'timeline') {
            // Timeline clips show Info and Settings
            // We keep the current tab if it's valid, or default to Info
            if (!this.btnSettings.classList.contains('active') && !this.btnInfo.classList.contains('active')) {
                this.switchTab('info');
            }
            this._toggleSettings(true);
        }
    }

    /**
     * Update metadata fields in Info tab
     * @param {object} data 
     */
    _updateMetadata(data) {
        const setField = (id, value) => {
            const el = document.getElementById(id);
            if (el) {
                el.textContent = value || '-';
                if (id === 'info-path') el.title = value || '';
            }
        };

        setField('info-name', data.name);
        setField('info-type', data.type);
        setField('info-duration', data.duration);
        setField('info-resolution', data.resolution);
        setField('info-path', data.path);
    }

    /**
     * Enable or disable the Settings tab
     * @param {boolean} enabled 
     */
    _toggleSettings(enabled) {
        if (enabled) {
            this.btnSettings.style.display = 'flex';
        } else {
            this.btnSettings.style.display = 'none';
            // If settings was active but now disabled, switch to info
            if (this.btnSettings.classList.contains('active')) {
                this.switchTab('info');
            }
        }
    }

    /**
     * Update the properties panel based on selection
     * @param {string} selectionType - 'none', 'library', 'timeline'
     * @param {object} data - Data object for the selected item
     */
    update(selectionType, data = {}) {
        console.log(`PropertiesPanel update: ${selectionType}`, data);

        if (selectionType === 'none') {
            this.showEmptyState();
            return;
        }

        // Show content for 'library' or 'timeline'
        this.showContent();

        // Update Metadata
        this._updateMetadata(data);

        // Handle Tabs based on type
        if (selectionType === 'library') {
            // Library items only show Info
            this.switchTab('info');
            this._toggleSettings(false);
        } else if (selectionType === 'timeline') {
            // Timeline clips show Info and Settings
            // We keep the current tab if it's valid, or default to Info
            if (!this.btnSettings.classList.contains('active') && !this.btnInfo.classList.contains('active')) {
                this.switchTab('info');
            }
            this._toggleSettings(true);
        }
    }

    /**
     * Update metadata fields in Info tab
     * @param {object} data 
     */
    _updateMetadata(data) {
        const setField = (id, value) => {
            const el = document.getElementById(id);
            if (el) {
                el.textContent = value || '-';
                if (id === 'info-path') el.title = value || '';
            }
        };

        setField('info-name', data.name);
        setField('info-type', data.type);
        setField('info-duration', data.duration);
        setField('info-resolution', data.resolution);
        setField('info-path', data.path);
    }

    /**
     * Enable or disable the Settings tab
     * @param {boolean} enabled 
     */
    _toggleSettings(enabled) {
        if (enabled) {
            this.btnSettings.style.display = 'flex';
        } else {
            this.btnSettings.style.display = 'none';
            // If settings was active but now disabled, switch to info
            if (this.btnSettings.classList.contains('active')) {
                this.switchTab('info');
            }
        }
    }

    /**
     * Update the properties panel based on selection
     * @param {string} selectionType - 'none', 'library', 'timeline'
     * @param {object} data - Data object for the selected item
     */
    update(selectionType, data = {}) {
        console.log(`PropertiesPanel update: ${selectionType}`, data);

        if (selectionType === 'none') {
            this.showEmptyState();
            return;
        }

        // Show content for 'library' or 'timeline'
        this.showContent();

        // Update Metadata
        this._updateMetadata(data);

        // Handle Tabs based on type
        if (selectionType === 'library') {
            // Library items only show Info
            this.switchTab('info');
            this._toggleSettings(false);
        } else if (selectionType === 'timeline') {
            // Timeline clips show Info and Settings
            // We keep the current tab if it's valid, or default to Info
            if (!this.btnSettings.classList.contains('active') && !this.btnInfo.classList.contains('active')) {
                this.switchTab('info');
            }
            this._toggleSettings(true);
        }
    }

    /**
     * Update metadata fields in Info tab
     * @param {object} data 
     */
    _updateMetadata(data) {
        const setField = (id, value) => {
            const el = document.getElementById(id);
            if (el) {
                el.textContent = value || '-';
                if (id === 'info-path') el.title = value || '';
            }
        };

        setField('info-name', data.name);
        setField('info-type', data.type);
        setField('info-duration', data.duration);
        setField('info-resolution', data.resolution);
        setField('info-path', data.path);
    }

    /**
     * Enable or disable the Settings tab
     * @param {boolean} enabled 
     */
    _toggleSettings(enabled) {
        if (enabled) {
            this.btnSettings.style.display = 'flex';
        } else {
            this.btnSettings.style.display = 'none';
            // If settings was active but now disabled, switch to info
            if (this.btnSettings.classList.contains('active')) {
                this.switchTab('info');
            }
        }
    }

    /**
     * Show the properties content (hides empty state)
     */
    showContent() {
        if (this.emptyState) this.emptyState.style.display = 'none';
        if (this.contentContainer) this.contentContainer.style.display = 'flex';
    }

    /**
     * Show the empty state (hides properties content)
     */
    showEmptyState() {
        if (this.emptyState) this.emptyState.style.display = 'flex';
        if (this.contentContainer) this.contentContainer.style.display = 'none';
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.propertiesPanel = new PropertiesPanel();
});

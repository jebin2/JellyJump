/**
 * PropertiesPanel
 * Manages the properties panel on the right side of the editor.
 * Updates content based on selected timeline clip.
 */
class PropertiesPanel {
    constructor() {
        this.panel = document.getElementById('properties-panel');
        this.content = document.querySelector('.properties-panel__content');
        this.emptyState = document.querySelector('.properties-panel__empty-state');

        // Sections
        this.clipInfoSection = document.getElementById('prop-clip-info');

        // Fields
        this.nameField = document.getElementById('prop-clip-name');
        this.startTimeField = document.getElementById('prop-clip-start');
        this.durationField = document.getElementById('prop-clip-duration');
        this.typeField = document.getElementById('prop-clip-type');

        this.init();
    }

    init() {
        // Listen for selection events
        window.addEventListener('timeline-selection-changed', (e) => this.onSelectionChanged(e.detail));

        console.log('PropertiesPanel initialized');
    }

    onSelectionChanged({ selectedClipIds }) {
        if (!selectedClipIds || selectedClipIds.length === 0) {
            this.showEmptyState();
        } else if (selectedClipIds.length === 1) {
            // Single clip
            const clipId = selectedClipIds[0];
            let clipData = null;
            if (window.clipManager) {
                clipData = window.clipManager.getClip(clipId);
            }
            this.showClipDetails(clipData);
        } else {
            // Multiple clips
            this.showMultiSelectState(selectedClipIds.length);
        }
    }

    showClipDetails(clipData) {
        if (!clipData) return;

        // Show content, hide empty state
        if (this.content) this.content.classList.remove('hidden');
        if (this.emptyState) this.emptyState.classList.add('hidden');

        // Update fields
        if (this.nameField) {
            this.nameField.value = clipData.name || 'Untitled';
            this.nameField.disabled = false;
        }
        if (this.startTimeField) {
            this.startTimeField.value = this.formatTime(clipData.startTime);
            this.startTimeField.disabled = false;
        }
        if (this.durationField) {
            this.durationField.value = this.formatTime(clipData.duration);
            this.durationField.disabled = false;
        }
        if (this.typeField) this.typeField.textContent = clipData.type.toUpperCase();
    }

    showMultiSelectState(count) {
        // Show content, hide empty state
        if (this.content) this.content.classList.remove('hidden');
        if (this.emptyState) this.emptyState.classList.add('hidden');

        // Update fields to show mixed state
        if (this.nameField) {
            this.nameField.value = `${count} items selected`;
            this.nameField.disabled = true;
        }
        if (this.startTimeField) {
            this.startTimeField.value = '-';
            this.startTimeField.disabled = true;
        }
        if (this.durationField) {
            this.durationField.value = '-';
            this.durationField.disabled = true;
        }
        if (this.typeField) this.typeField.textContent = 'MIXED';
    }

    showEmptyState() {
        // Hide content, show empty state
        if (this.content) this.content.classList.add('hidden');
        if (this.emptyState) this.emptyState.classList.remove('hidden');
    }

    formatTime(seconds) {
        return seconds.toFixed(2) + 's';
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.propertiesPanel = new PropertiesPanel();
});
export default window.propertiesPanel;

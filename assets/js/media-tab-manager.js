/**
 * JellyJump Editor - Media Tab Manager
 * Handles switching between media categories (Videos, Audio, Images, Text, Effects, Projects).
 * Phase: 40
 */

import { StorageHelper } from './storage-helper.js';

export class MediaTabManager {
    constructor() {
        this.tabsContainer = document.querySelector('.media-panel__tabs');
        this.contentContainer = document.querySelector('.media-panel__content');
        this.activeCategory = 'videos'; // Default

        this.init();
    }

    init() {
        if (!this.tabsContainer || !this.contentContainer) {
            console.warn('Media tab elements not found');
            return;
        }

        this.attachEventListeners();
        this.loadActiveCategory();
    }

    /**
     * Attaches event listeners for tab clicks and keyboard navigation
     */
    attachEventListeners() {
        // Click event delegation
        this.tabsContainer.addEventListener('click', (e) => {
            const tabButton = e.target.closest('.media-tab');
            if (!tabButton) return;

            const category = tabButton.dataset.mediaTab;
            if (category) {
                this.switchTab(category);
            }
        });

        // Keyboard navigation
        this.tabsContainer.addEventListener('keydown', (e) => {
            this.handleKeyboardNavigation(e);
        });
    }

    /**
     * Switches to the specified media category
     * @param {string} category - The category to switch to
     */
    switchTab(category) {
        // Don't switch if already active
        if (category === this.activeCategory) return;

        console.log(`Switched to category: ${category}`);

        this.setActiveTab(category);
        this.showContent(category);
        this.activeCategory = category;
        this.saveActiveCategory();
    }

    /**
     * Updates the visual active state of tab buttons
     * @param {string} category - The category to activate
     */
    setActiveTab(category) {
        const tabs = this.tabsContainer.querySelectorAll('.media-tab');

        tabs.forEach(tab => {
            const tabCategory = tab.dataset.mediaTab;
            const isActive = tabCategory === category;

            if (isActive) {
                tab.classList.add('active');
                tab.setAttribute('aria-selected', 'true');
            } else {
                tab.classList.remove('active');
                tab.setAttribute('aria-selected', 'false');
            }
        });
    }

    /**
     * Shows the content for the specified category
     * @param {string} category - The category to show
     */
    showContent(category) {
        const contents = this.contentContainer.querySelectorAll('.media-content');

        contents.forEach(content => {
            const contentCategory = content.dataset.category;

            if (contentCategory === category) {
                content.removeAttribute('hidden');
            } else {
                content.setAttribute('hidden', '');
            }
        });
    }

    /**
     * Saves the active category to localStorage
     */
    saveActiveCategory() {
        StorageHelper.save('active_media_category', this.activeCategory);
    }

    /**
     * Loads and restores the active category from localStorage
     */
    loadActiveCategory() {
        const savedCategory = StorageHelper.load('active_media_category');

        // Validate category
        const validCategories = ['videos', 'audio', 'images', 'text', 'effects', 'projects'];
        const category = (savedCategory && validCategories.includes(savedCategory))
            ? savedCategory
            : 'videos';

        this.switchTab(category);
    }

    /**
     * Handles keyboard navigation (Arrow keys, Enter, Space)
     * @param {KeyboardEvent} e
     */
    handleKeyboardNavigation(e) {
        const tabs = Array.from(this.tabsContainer.querySelectorAll('.media-tab'));
        const focusedTab = document.activeElement;
        const currentIndex = tabs.indexOf(focusedTab);

        if (currentIndex === -1) return;

        let nextIndex = currentIndex;

        switch (e.key) {
            case 'ArrowUp':
            case 'ArrowLeft':
                e.preventDefault();
                nextIndex = currentIndex - 1;
                if (nextIndex < 0) nextIndex = tabs.length - 1;
                tabs[nextIndex].focus();
                break;

            case 'ArrowDown':
            case 'ArrowRight':
                e.preventDefault();
                nextIndex = currentIndex + 1;
                if (nextIndex >= tabs.length) nextIndex = 0;
                tabs[nextIndex].focus();
                break;

            case 'Enter':
            case ' ':
                e.preventDefault();
                const category = focusedTab.dataset.mediaTab;
                if (category) {
                    this.switchTab(category);
                }
                break;
        }
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    window.mediaTabManager = new MediaTabManager();
});

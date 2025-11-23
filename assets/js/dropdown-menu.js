/**
 * Dropdown Menu Module
 * Phase 28: File Menu Dropdown
 * 
 * Handles toggle behavior, outside click detection, and keyboard interactions
 * for navigation dropdown menus.
 */

class DropdownMenu {
    constructor() {
        this.activeMenu = null;
        this.init();
    }

    /**
     * Initialize dropdown menu functionality
     */
    init() {
        this.attachMenuButtonHandlers();
        this.attachMenuItemHandlers();
        this.attachOutsideClickHandler();
        this.attachKeyboardHandlers();
    }

    /**
     * Attach click handlers to menu buttons (File, Edit, View, Effects)
     */
    attachMenuButtonHandlers() {
        const menuButtons = document.querySelectorAll('[data-menu]');
        menuButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const menuType = button.dataset.menu;
                this.toggleMenu(menuType, button);
            });
        });
    }

    /**
     * Toggle a specific menu open/closed
     * @param {string} menuType - The menu identifier (e.g., 'file')
     * @param {HTMLElement} button - The button that triggered the menu
     */
    toggleMenu(menuType, button) {
        const dropdown = document.querySelector(`[data-dropdown="${menuType}"]`);

        if (!dropdown) return;

        const isCurrentlyOpen = this.activeMenu === menuType;

        // Close all menus first
        this.closeAllMenus();

        // If it wasn't open, open it now (toggle behavior)
        if (!isCurrentlyOpen) {
            dropdown.removeAttribute('hidden');
            button.setAttribute('aria-expanded', 'true');
            this.activeMenu = menuType;
        }
    }

    /**
     * Close all dropdown menus
     */
    closeAllMenus() {
        const allDropdowns = document.querySelectorAll('[data-dropdown]');
        const allMenuButtons = document.querySelectorAll('[data-menu]');

        allDropdowns.forEach(dropdown => {
            dropdown.setAttribute('hidden', '');
        });

        allMenuButtons.forEach(button => {
            button.setAttribute('aria-expanded', 'false');
        });

        this.activeMenu = null;
    }

    /**
     * Attach click handlers to dropdown menu items
     */
    attachMenuItemHandlers() {
        const menuItems = document.querySelectorAll('.dropdown-menu__item');
        menuItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const action = item.dataset.action;
                console.log(`Menu action: ${action}`);

                // Close the dropdown after menu item click
                this.closeAllMenus();
            });
        });
    }

    /**
     * Close dropdown when clicking outside
     */
    attachOutsideClickHandler() {
        document.addEventListener('click', () => {
            if (this.activeMenu) {
                this.closeAllMenus();
            }
        });
    }

    /**
     * Handle keyboard interactions
     * - Escape: Close menu and return focus to button
     */
    attachKeyboardHandlers() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.activeMenu) {
                // Store the active menu type before closing
                const activeMenuType = this.activeMenu;

                // Close all menus
                this.closeAllMenus();

                // Return focus to the menu button that opened it
                const activeButton = document.querySelector(`[data-menu="${activeMenuType}"]`);
                if (activeButton) {
                    activeButton.focus();
                }
            }
        });
    }
}

// Initialize dropdown menu on page load
document.addEventListener('DOMContentLoaded', () => {
    new DropdownMenu();
});

/**
 * SidebarToggle - Manages playlist sidebar collapse/expand functionality
 * Phase 16: Collapsible Sidebar
 */
export class SidebarToggle {
    /**
     * @param {HTMLElement} sidebarElement - The playlist sidebar element
     * @param {HTMLButtonElement} buttonElement - The toggle button element
     */
    constructor(sidebarElement, buttonElement) {
        if (!sidebarElement || !buttonElement) {
            console.error('SidebarToggle: Missing required elements');
            return;
        }

        this.sidebar = sidebarElement;
        this.button = buttonElement;
        this.isCollapsed = false;

        this._init();
    }

    /**
     * Initialize the sidebar toggle
     * @private
     */
    _init() {
        // Get mobile expand button
        this.mobileExpandBtn = document.getElementById('mobile-expand-btn');

        // Attach event listeners
        this._attachEventListeners();

        console.log('SidebarToggle initialized successfully');
    }

    /**
     * Attach event listeners
     * @private
     */
    _attachEventListeners() {
        // Button click
        this.button.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Toggle button clicked, current state:', this.isCollapsed ? 'collapsed' : 'expanded');
            this.toggle();
        });

        // Mobile expand button click
        if (this.mobileExpandBtn) {
            this.mobileExpandBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Mobile expand button clicked');
                this.expand();
            });
        }

        // Keyboard shortcut: Ctrl+B (or Cmd+B on Mac)
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
                e.preventDefault();
                this.toggle();
            }
        });
    }

    /**
     * Toggle sidebar state
     */
    toggle() {
        if (this.isCollapsed) {
            this.expand();
        } else {
            this.collapse();
        }
    }

    /**
     * Collapse the sidebar
     */
    collapse() {
        console.log('Collapsing sidebar');
        this.isCollapsed = true;
        this.sidebar.classList.add('collapsed');

        // Use up/down arrows on mobile, left/right on desktop
        const isMobile = window.innerWidth <= 768;
        this.button.textContent = isMobile ? '▲' : '◀';

        // Show mobile expand button only on mobile when collapsed
        if (this.mobileExpandBtn) {
            this.mobileExpandBtn.style.display = isMobile ? 'block' : 'none';
        }

        this.button.setAttribute('aria-label', 'Expand sidebar');
        this.button.setAttribute('aria-expanded', 'false');
        this.button.setAttribute('title', 'Expand sidebar (Ctrl+B)');
    }

    /**
     * Expand the sidebar
     */
    expand() {
        console.log('Expanding sidebar');
        this.isCollapsed = false;
        this.sidebar.classList.remove('collapsed');

        // Use up/down arrows on mobile, left/right on desktop
        const isMobile = window.innerWidth <= 768;
        this.button.textContent = isMobile ? '▼' : '▶';

        // Hide mobile expand button when expanded
        if (this.mobileExpandBtn) {
            this.mobileExpandBtn.style.display = 'none';
        }

        this.button.setAttribute('aria-label', 'Collapse sidebar');
        this.button.setAttribute('aria-expanded', 'true');
        this.button.setAttribute('title', 'Collapse sidebar (Ctrl+B)');
    }
}

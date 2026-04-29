import { Logger } from "../../shared/utils/Logger.js";
import { ElectronHelper } from '../../shared/utils/ElectronHelper.js';
import { UrlUploadMenu } from "../menus/features/UrlUploadMenu.js";

/**
 * Playlist UI Helper
 * Handles DOM creation and event listeners for playlist controls.
 */
export class PlaylistUI {
    /**
     * @param {Playlist} playlist - The playlist instance
     */
    constructor(playlist) {
        this.playlist = playlist;
    }

    /**
     * Initialize UI components
     */
    init() {
        this._createHeader();
        this._createListContainer();
        this._initMobileDrawer();
        this._initUrlUpload();
    }

    /**
     * Create playlist header with controls
     * @private
     */
    _createHeader() {
        const template = document.getElementById('playlist-header-controls-template');
        if (!template) {
            Logger.error('Playlist header template not found!');
            return;
        }

        const clone = template.content.cloneNode(true);
        const header = document.createElement('div');
        header.className = 'playlist-header';
        header.appendChild(clone);

        // Insert before container
        this.playlist.container.parentNode.insertBefore(header, this.playlist.container);

        // Initialize Sidebar Toggle
        this._initSidebarToggle();

        // Setup Events
        this._setupAddActions(header);
        this._setupSearch(header);
        this._setupToolsButton(header);
        this._setupScrollToPlaying(header);
    }

    /**
     * Initialize sidebar toggle logic
     * @private
     */
    _initSidebarToggle() {
        const sidebarElement = document.querySelector('.playlist-section');
        const toggleButton = document.getElementById('sidebar-toggle-btn');

        if (sidebarElement && toggleButton) {
            import('./SidebarToggle.js').then(({ SidebarToggle }) => {
                new SidebarToggle(sidebarElement, toggleButton);
            }).catch(err => {
                Logger.error('Failed to load SidebarToggle:', err);
            });
        }
    }

    /**
     * Create list container
     * @private
     */
    _createListContainer() {
        this.playlist.container.classList.add('playlist-items');
    }

    /**
     * Setup search functionality
     * @private
     * @param {HTMLElement} header 
     */
    _setupSearch(header) {
        const searchInput = header.querySelector('#mb-playlist-search-input');
        const searchClearBtn = header.querySelector('#mb-playlist-search-clear');

        if (!searchInput) return;

        // Debounce function
        const debounce = (func, wait) => {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        };

        const handleSearch = debounce((e) => {
            this.playlist.searchQuery = e.target.value.trim().toLowerCase();

            // Toggle clear button
            if (this.playlist.searchQuery) {
                searchClearBtn?.classList.remove('hidden');
            } else {
                searchClearBtn?.classList.add('hidden');
            }

            this.playlist.render();
        }, 300);

        searchInput.addEventListener('input', handleSearch);

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                searchInput.value = '';
                this.playlist.searchQuery = '';
                searchClearBtn?.classList.add('hidden');
                this.playlist.render();
                searchInput.blur();
            }
        });

        if (searchClearBtn) {
            searchClearBtn.addEventListener('click', () => {
                searchInput.value = '';
                this.playlist.searchQuery = '';
                searchClearBtn.classList.add('hidden');
                this.playlist.render();
                searchInput.focus();
            });
        }
    }

    /**
     * Setup file/folder add buttons
     * @private
     * @param {HTMLElement} header 
     */
    _setupAddActions(header) {
        const addFilesBtn = header.querySelector('#mb-add-files');
        const addFolderBtn = header.querySelector('#mb-add-folder');

        if (addFilesBtn) {
            addFilesBtn.addEventListener('click', async () => {
                if (ElectronHelper.isElectron()) {
                    const result = await ElectronHelper.openFileDialog();
                    if (result.success && result.files) {
                        this.playlist.handleElectronFiles(result.files);
                    }
                } else {
                    document.getElementById('mb-file-input').click();
                }
            });
        }

        if (addFolderBtn) {
            addFolderBtn.addEventListener('click', () => {
                document.getElementById('mb-folder-input').click();
            });
        }

        // File input events (defined in player.html but managed here)
        const fileInput = document.getElementById('mb-file-input');
        const folderInput = document.getElementById('mb-folder-input');

        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                this.playlist.handleFiles(e.target.files);
                e.target.value = ''; // Reset
            });
        }

        if (folderInput) {
            folderInput.addEventListener('change', (e) => {
                this.playlist.handleFiles(e.target.files);
                e.target.value = ''; // Reset
            });
        }
    }

    /**
     * Setup Tools button
     * @private
     * @param {HTMLElement} header 
     */
    _setupToolsButton(header) {
        const toolsBtn = header.querySelector('#mb-tools');
        if (toolsBtn) {
            this.playlist._setupToolsButton(toolsBtn);
        }
    }

    /**
     * Setup scroll to playing button
     * @private
     * @param {HTMLElement} header 
     */
    _setupScrollToPlaying(header) {
        const scrollToPlayingBtn = header.querySelector('#mb-scroll-to-playing');
        if (scrollToPlayingBtn) {
            scrollToPlayingBtn.addEventListener('click', () => {
                this.playlist.scrollToPlaying();
            });
        }
    }

    /**
     * Initialize URL upload feature
     * @private
     */
    _initUrlUpload() {
        const urlBtn = document.getElementById('mb-add-url');
        if (urlBtn) {
            urlBtn.addEventListener('click', () => {
                UrlUploadMenu.show(this.playlist);
            });
        }
    }

    /**
     * Initialize mobile drawer toggle
     * @private
     */
    _initMobileDrawer() {
        const toggleBtn = document.getElementById('playlist-toggle');
        const overlay = document.getElementById('playlist-overlay');
        const section = this.playlist.container.closest('.playlist-section');

        if (toggleBtn && overlay && section) {
            const checkMobile = () => {
                if (window.innerWidth <= 768) {
                    toggleBtn.style.display = 'flex';
                } else {
                    toggleBtn.style.display = 'none';
                    section.classList.remove('open');
                    overlay.classList.remove('visible');
                }
            };

            window.addEventListener('resize', checkMobile);
            checkMobile();

            const toggleDrawer = () => {
                const isOpen = section.classList.contains('open');
                if (isOpen) {
                    section.classList.remove('open');
                    overlay.classList.remove('visible');
                    toggleBtn.setAttribute('aria-expanded', 'false');
                } else {
                    section.classList.add('open');
                    overlay.classList.add('visible');
                    toggleBtn.setAttribute('aria-expanded', 'true');
                }
            };

            toggleBtn.addEventListener('click', toggleDrawer);
            overlay.addEventListener('click', toggleDrawer);
        }
    }

    /**
     * Setup global keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        this._keydownHandler = async (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            // Shift + N: Next Video
            if (e.shiftKey && (e.key === 'N' || e.key === 'n')) {
                e.preventDefault();
                this.playlist.playNext();
            }

            // Shift + P: Previous Video
            if (e.shiftKey && (e.key === 'P' || e.key === 'p')) {
                e.preventDefault();
                this.playlist.playPrevious();
            }

            // Delete: Remove selected/active video
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (this.playlist.activeIndex >= 0) {
                    const { ConfirmDialog } = await import('../../shared/utils/ConfirmDialog.js');
                    const confirmed = await ConfirmDialog.confirm({
                        title: 'Remove Video',
                        message: 'Remove current video from playlist?'
                    });
                    if (confirmed) {
                        this.playlist.removeItem(this.playlist.activeIndex);
                    }
                }
            }

            // Ctrl + U: Upload Files
            if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U')) {
                e.preventDefault();
                const fileInput = document.getElementById('mb-file-input');
                if (fileInput) fileInput.click();
            }
        };
        document.addEventListener('keydown', this._keydownHandler);
    }

    /**
     * Cleanup listeners
     */
    destroy() {
        if (this._keydownHandler) {
            document.removeEventListener('keydown', this._keydownHandler);
        }
    }
}

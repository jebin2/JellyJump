import { Logger } from '../../../shared/utils/Logger.js';
import { Modal } from '../../Modal.js';
import { MenuRouter } from '../core/MenuRouter.js';
import { RecordMenu } from './RecordMenu.js';

/**
 * Item Tools Menu
 * Handles the display of the tools grid modal for a specific playlist item.
 */
export const ItemToolsMenu = {
    /**
     * Show the tools menu for a specific item
     * @param {number} index - Index of the item
     * @param {Playlist} playlist - Playlist instance
     */
    async show(index, playlist) {
        const item = playlist.items[index];
        if (!item) {
            Logger.error('[ItemToolsMenu] Item not found for index:', index);
            return;
        }

        // Treat streams, IPTV, and live content as restricted (limited menu options)
        const isRestricted = item.isStream || item.isLive || 
            (item.url && (item.url.includes('.m3u8') || item.url.includes('/live/') || item.url.includes('/hls/')));

        const modal = new Modal({ maxWidth: '480px' });

        // Truncate title if too long
        const displayTitle = item.title.length > 30 ? item.title.substring(0, 30) + '...' : item.title;
        modal.setTitle(`Tools: ${displayTitle}`);

        // Define menu items with SVG icons
        const videoTools = [
            { action: 'convert', icon: 'icon-convert', label: 'Convert' },
            { action: 'download-manage', icon: 'icon-download', label: 'Tracks' },
            { action: 'trim', icon: 'icon-scissors', label: 'Cut' },
            { action: 'multicut', icon: 'icon-scissors', label: 'Multi-Cut' },
            { action: 'resize', icon: 'icon-maximize', label: 'Resize' },
            { action: 'crop', icon: 'icon-crop', label: 'Crop' },
            { action: 'create-gif', icon: 'icon-gif', label: 'GIF' },
            { action: 'reverse', icon: 'icon-speed', label: 'Speed' },
            { action: 'remove-bg', icon: 'icon-eyedropper', label: 'Remove BG' },
            { action: 'watermark', icon: 'icon-watermark', label: 'Watermark' },
            { action: 'rotate', icon: 'icon-rotate-cw', label: 'Rotate' },
            { action: 'blur', icon: 'icon-blur', label: 'Blur' },
            { action: 'detect-cuts', icon: 'icon-scenes', label: 'Scenes' },
            { action: 'detect-motion', icon: 'icon-motion', label: 'Motion' },
            { action: 'encrypt', icon: 'icon-lock', label: 'Encrypt/Decrypt' },
            { action: 'info', icon: 'icon-info', label: 'Info' }
        ];

        const streamTools = [
            { action: 'record', icon: 'icon-record', label: RecordMenu.isRecording ? 'Stop Rec' : 'Record' },
            { action: 'info', icon: 'icon-info', label: 'Info' }
        ];

        const tools = isRestricted ? streamTools : videoTools;

        // Create tools grid content
        const content = document.createElement('div');
        content.className = 'tools-grid tools-grid-3';
        content.innerHTML = tools.map(tool => `
            <button class="tools-tile tools-tile-sm" data-action="${tool.action}" title="${tool.label}">
                <div class="tools-tile-icon">
                    <svg width="20" height="20" fill="currentColor">
                        <use href="assets/icons/sprite.svg#${tool.icon}"></use>
                    </svg>
                </div>
                <span class="tools-tile-label">${tool.label}</span>
            </button>
        `).join('');

        modal.setBody(content);

        // Handle tile clicks
        content.querySelectorAll('.tools-tile').forEach(tile => {
            tile.addEventListener('click', () => {
                const action = tile.dataset.action;
                modal.close();
                
                // Route to the specific feature menu
                MenuRouter.init(action, index, playlist);
                
                // Pause player when opening tools
                if (playlist.player) playlist.player.pause();
                
                // Restore audio if it was muted for autoplay (first user interaction)
                const player = playlist.player;
                if (player && player._wasMutedForAutoplay && player.gainNode) {
                    Logger.log('[Autoplay] Tools menu opened, restoring audio...');
                    player.config.muted = false;
                    player.gainNode.gain.value = player.config.volume;
                    player._wasMutedForAutoplay = false;
                    if (player.ui?.muteBtn) player._updateVolumeUI();
                }
            });
        });

        modal.open();
    }
};

import { Logger } from '../../../shared/utils/Logger.js';
import { Modal } from '../../Modal.js';
import { MenuRouter } from '../core/MenuRouter.js';
import { renderToolGrid } from '../core/ToolGrid.js';
import { RecordMenu } from './RecordMenu.js';

/**
 * The tools for one playlist item, grouped, and whether it is a limited item
 * (a stream or a YouTube link) that only has a few. Shared by the edit panel
 * and this menu, so the two lists cannot drift apart.
 * @param {Object} item - Playlist item
 * @returns {{sections: Array, limited: boolean}}
 */
export function itemToolSections(item) {
    // Treat streams, IPTV, and live content as restricted (limited menu options)
    const isRestricted = item.isStream || item.isLive || 
        (item.url && (item.url.includes('.m3u8') || item.url.includes('/live/') || item.url.includes('/hls/')));

    const limited = item.isYouTube || isRestricted;

    // Grouped by what the user is trying to do. Every tile has an icon of
    // its own: Cut and Multi-Cut used to share the scissors, and Tracks
    // borrowed the download arrow.
    const videoTools = [
        { heading: 'Edit', tools: [
            { action: 'trim', icon: 'icon-scissors', label: 'Cut', title: 'Cut out one clip' },
            { action: 'multicut', icon: 'icon-segments', label: 'Multi-Cut', title: 'Remove several clips at once' },
            { action: 'crop', icon: 'icon-crop', label: 'Crop' },
            { action: 'rotate', icon: 'icon-rotate-cw', label: 'Rotate' },
            { action: 'resize', icon: 'icon-maximize', label: 'Resize' },
            { action: 'reverse', icon: 'icon-speed', label: 'Speed', title: 'Speed up, slow down or reverse' },
        ] },
        { heading: 'Effects', tools: [
            { action: 'blur', icon: 'icon-blur', label: 'Blur' },
            { action: 'watermark', icon: 'icon-watermark', label: 'Watermark' },
            { action: 'remove-bg', icon: 'icon-eyedropper', label: 'Remove BG', title: 'Remove background' },
            { action: 'export-fx', icon: 'icon-filter', label: 'Export FX', title: 'Export with the player\'s effects' },
        ] },
        { heading: 'Save as', tools: [
            { action: 'convert', icon: 'icon-convert', label: 'Convert', title: 'Convert or compress' },
            { action: 'create-gif', icon: 'icon-gif', label: 'GIF' },
            { action: 'download-manage', icon: 'icon-layers', label: 'Tracks', title: 'Audio, video and subtitle tracks' },
            { action: 'encrypt', icon: 'icon-lock', label: 'Encrypt', title: 'Encrypt or decrypt' },
        ] },
        { heading: 'Analyze', tools: [
            { action: 'detect-cuts', icon: 'icon-scenes', label: 'Scenes', title: 'Find scene changes' },
            { action: 'detect-motion', icon: 'icon-motion', label: 'Motion', title: 'Find motion' },
            { action: 'info', icon: 'icon-info', label: 'Info' },
        ] },
    ];

    const streamTools = [{ tools: [
        { action: 'record', icon: 'icon-record', label: RecordMenu.isRecording ? 'Stop Rec' : 'Record' },
        { action: 'info', icon: 'icon-info', label: 'Info' },
    ] }];

    // A YouTube item is a link, not a file. Every tool above works on media
    // data this item does not have, and recording is no use either: the
    // video plays inside a cross-origin iframe the canvas never sees. Info
    // is the one thing that still means something.
    const youtubeTools = [{ tools: [
        { action: 'info', icon: 'icon-info', label: 'Info' },
    ] }];

    return {
        sections: item.isYouTube ? youtubeTools : (isRestricted ? streamTools : videoTools),
        limited,
    };
}

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

        const { sections, limited } = itemToolSections(item);
        const modal = new Modal({ maxWidth: limited ? '400px' : '600px' });

        // Truncate title if too long
        const displayTitle = item.title.length > 30 ? item.title.substring(0, 30) + '...' : item.title;
        modal.setTitle(`Edit: ${displayTitle}`);

        const content = renderToolGrid(sections, { columns: limited ? 3 : 6 });

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
                player?._restoreAutoplayAudio('Tools menu opened');
            });
        });

        modal.open();
    }
};

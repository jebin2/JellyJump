import { ConvertMenu } from './ConvertMenu.js';
import { TrimMenu } from './TrimMenu.js';
import { ResizeMenu } from './ResizeMenu.js';
import { GifMenu } from './GifMenu.js';
import { InfoMenu } from './InfoMenu.js';
import { MergeMenu } from './MergeMenu.js';
import { TrackManagerMenu } from './TrackManagerMenu.js';

/**
 * Menu Router
 * Central router that delegates menu actions to specific menu handlers
 */
export class MenuRouter {
    /**
     * Initialize and route to appropriate menu handler
     * @param {string} action - Menu action identifier
     * @param {number} index - Playlist item index
     * @param {Playlist} playlist - Playlist instance
     */
    static async init(action, index, playlist) {
        const item = playlist.items[index];

        if (!item) {
            console.error(`MenuRouter: Invalid index ${index}`);
            return;
        }

        console.log(`MenuRouter: Routing action "${action}" for item "${item.title}"`);

        switch (action) {
            case 'convert':
                await ConvertMenu.init(item, playlist);
                break;
            case 'trim':
                await TrimMenu.init(item, playlist);
                break;
            case 'resize':
                await ResizeMenu.init(item, playlist);
                break;
            case 'create-gif':
                await GifMenu.init(item, playlist);
                break;
            case 'info':
                await InfoMenu.init(item, playlist);
                break;
            case 'merge':
                await MergeMenu.init(item, playlist);
                break;
            case 'download-manage':
                await TrackManagerMenu.init(item, playlist);
                break;
            default:
                console.warn(`MenuRouter: Unknown action "${action}"`);
        }
    }
}

import { Logger } from "../../utils/Logger.js";
import { ConvertMenu } from './ConvertMenu.js';
import { TrimMenu } from './TrimMenu.js';
import { ResizeMenu } from './ResizeMenu.js';
import { CropMenu } from './CropMenu.js';
import { GifMenu } from './GifMenu.js';
import { InfoMenu } from './InfoMenu.js';
import { MergeMenu } from './MergeMenu.js';
import { TrackManagerMenu } from './TrackManagerMenu.js';
import { RemoveBackgroundMenu } from './RemoveBackgroundMenu.js';
import { RecordMenu } from './RecordMenu.js';
import { SpeedReverseMenu } from './SpeedReverseMenu.js';
import { WatermarkMenu } from './WatermarkMenu.js';

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
            Logger.error(`MenuRouter: Invalid index ${index}`);
            return;
        }

        Logger.log(`MenuRouter: Routing action "${action}" for item "${item.title}"`);

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
            case 'crop':
                await CropMenu.init(item, playlist);
                break;
            case 'create-gif':
                await GifMenu.init(item, playlist);
                break;
            case 'reverse':
            case 'speed':
                // Both routed to unified menu
                await SpeedReverseMenu.init(item, playlist);
                break;
            case 'remove-bg':
                await RemoveBackgroundMenu.init(item, playlist);
                break;
            case 'watermark':
                await WatermarkMenu.init(item, playlist);
                break;
            case 'record':
                await RecordMenu.init(item, playlist);
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
            case 'detect-cuts':
                const { CutDetectionMenu } = await import('./CutDetectionMenu.js');
                new CutDetectionMenu(playlist).execute(item);
                break;
            case 'detect-motion':
                const { MotionDetectionMenu } = await import('./MotionDetectionMenu.js');
                new MotionDetectionMenu(playlist).execute(item);
                break;
            default:
                Logger.warn(`MenuRouter: Unknown action "${action}"`);
        }
    }
}

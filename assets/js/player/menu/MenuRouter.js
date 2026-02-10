import { Logger } from "../../utils/Logger.js";

/**
 * Menu Router
 * Central router that delegates menu actions to specific menu handlers.
 * All menus are lazy-loaded on first use to reduce initial page memory.
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

        try {
        switch (action) {
            case 'convert': {
                const { ConvertMenu } = await import('./ConvertMenu.js');
                await ConvertMenu.init(item, playlist);
                break;
            }
            case 'trim': {
                const { TrimMenu } = await import('./TrimMenu.js');
                await TrimMenu.init(item, playlist);
                break;
            }
            case 'resize': {
                const { ResizeMenu } = await import('./ResizeMenu.js');
                await ResizeMenu.init(item, playlist);
                break;
            }
            case 'crop': {
                const { CropMenu } = await import('./CropMenu.js');
                await CropMenu.init(item, playlist);
                break;
            }
            case 'create-gif': {
                const { GifMenu } = await import('./GifMenu.js');
                await GifMenu.init(item, playlist);
                break;
            }
            case 'reverse':
            case 'speed': {
                // Both routed to unified menu
                const { SpeedReverseMenu } = await import('./SpeedReverseMenu.js');
                await SpeedReverseMenu.init(item, playlist);
                break;
            }
            case 'remove-bg': {
                const { RemoveBackgroundMenu } = await import('./RemoveBackgroundMenu.js');
                await RemoveBackgroundMenu.init(item, playlist);
                break;
            }
            case 'watermark': {
                const { WatermarkMenu } = await import('./WatermarkMenu.js');
                await WatermarkMenu.init(item, playlist);
                break;
            }
            case 'blur': {
                const { BlurMenu } = await import('./BlurMenu.js');
                await BlurMenu.init(item, playlist);
                break;
            }
            case 'rotate': {
                const { RotateMenu } = await import('./RotateMenu.js');
                await RotateMenu.init(item, playlist);
                break;
            }
            case 'record': {
                const { RecordMenu } = await import('./RecordMenu.js');
                await RecordMenu.init(item, playlist);
                break;
            }
            case 'info': {
                const { InfoMenu } = await import('./InfoMenu.js');
                await InfoMenu.init(item, playlist);
                break;
            }
            case 'merge': {
                const { MergeMenu } = await import('./MergeMenu.js');
                await MergeMenu.init(item, playlist);
                break;
            }
            case 'download-manage': {
                const { TrackManagerMenu } = await import('./TrackManagerMenu.js');
                await TrackManagerMenu.init(item, playlist);
                break;
            }
            case 'detect-cuts': {
                const { CutDetectionMenu } = await import('./CutDetectionMenu.js');
                new CutDetectionMenu(playlist).execute(item);
                break;
            }
            case 'detect-motion': {
                const { MotionDetectionMenu } = await import('./MotionDetectionMenu.js');
                new MotionDetectionMenu(playlist).execute(item);
                break;
            }
            default:
                Logger.warn(`MenuRouter: Unknown action "${action}"`);
        }
        } catch (err) {
            Logger.error(`MenuRouter: Error in "${action}" for "${item.title}":`, err);
            if (playlist._showToast) {
                playlist._showToast(`Failed to open ${action}: ${err.message}`, 'error');
            }
        }
    }
}

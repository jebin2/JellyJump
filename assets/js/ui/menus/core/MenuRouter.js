import { Logger } from "../../../shared/utils/Logger.js";
import { Toast } from "../../../shared/utils/Toast.js";

/**
 * Actions that read the item's own media data — decoding it, re-encoding it,
 * or writing a new file from it.
 *
 * A YouTube item has no media data: it is a link, and the video is played by
 * YouTube inside an iframe that cannot be read from. Left ungated, these open a
 * dialog that can only fail once it tries to demux a watch page.
 *
 * 'info' is deliberately absent — it reads the item, not the media, and is
 * useful for a YouTube entry too.
 */
const NEEDS_MEDIA_FILE = new Set([
    'convert', 'trim', 'multicut', 'resize', 'crop', 'create-gif', 'reverse',
    'speed', 'remove-bg', 'watermark', 'blur', 'rotate', 'record', 'merge',
    'detect-cuts', 'detect-motion', 'encrypt', 'download-manage',
]);

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

        // Refused here rather than in each menu: one list beats eighteen
        // guards, and a tool that opens only to fail is worse than one that
        // says why up front.
        if (item.isYouTube && NEEDS_MEDIA_FILE.has(action)) {
            Logger.log(`MenuRouter: "${action}" is not available for a YouTube item`);
            Toast.show('That tool needs the video file. A YouTube video plays through YouTube, so there is no file to work on.', 5000);
            return;
        }

        Logger.log(`MenuRouter: Routing action "${action}" for item "${item.title}"`);

        try {
        switch (action) {
            case 'convert': {
                const { ConvertMenu } = await import('../features/ConvertMenu.js');
                await ConvertMenu.init(item, playlist);
                break;
            }
            case 'trim': {
                const { TrimMenu } = await import('../features/TrimMenu.js');
                await TrimMenu.init(item, playlist);
                break;
            }
            case 'multicut': {
                const { MultiCutMenu } = await import('../features/MultiCutMenu.js');
                await MultiCutMenu.init(item, playlist);
                break;
            }
            case 'resize': {
                const { ResizeMenu } = await import('../features/ResizeMenu.js');
                await ResizeMenu.init(item, playlist);
                break;
            }
            case 'crop': {
                const { CropMenu } = await import('../features/CropMenu.js');
                await CropMenu.init(item, playlist);
                break;
            }
            case 'create-gif': {
                const { GifMenu } = await import('../features/GifMenu.js');
                await GifMenu.init(item, playlist);
                break;
            }
            case 'reverse':
            case 'speed': {
                // Both routed to unified menu
                const { SpeedReverseMenu } = await import('../features/SpeedReverseMenu.js');
                await SpeedReverseMenu.init(item, playlist);
                break;
            }
            case 'remove-bg': {
                const { RemoveBackgroundMenu } = await import('../features/RemoveBackgroundMenu.js');
                await RemoveBackgroundMenu.init(item, playlist);
                break;
            }
            case 'watermark': {
                const { WatermarkMenu } = await import('../features/WatermarkMenu.js');
                await WatermarkMenu.init(item, playlist);
                break;
            }
            case 'blur': {
                const { BlurMenu } = await import('../features/BlurMenu.js');
                await BlurMenu.init(item, playlist);
                break;
            }
            case 'rotate': {
                const { RotateMenu } = await import('../features/RotateMenu.js');
                await RotateMenu.init(item, playlist);
                break;
            }
            case 'record': {
                const { RecordMenu } = await import('../features/RecordMenu.js');
                await RecordMenu.init(item, playlist);
                break;
            }
            case 'info': {
                const { InfoMenu } = await import('../features/InfoMenu.js');
                await InfoMenu.init(item, playlist);
                break;
            }
            case 'merge': {
                const { MergeMenu } = await import('../features/MergeMenu.js');
                await MergeMenu.init(item, playlist);
                break;
            }
            case 'download-manage': {
                const { TrackManagerMenu } = await import('../features/TrackManagerMenu.js');
                await TrackManagerMenu.init(item, playlist);
                break;
            }
            case 'detect-cuts': {
                const { CutDetectionMenu } = await import('../features/CutDetectionMenu.js');
                await CutDetectionMenu.init(item, playlist);
                break;
            }
            case 'detect-motion': {
                const { MotionDetectionMenu } = await import('../features/MotionDetectionMenu.js');
                await MotionDetectionMenu.init(item, playlist);
                break;
            }
            case 'encrypt': {
                const { EncryptMenu } = await import('../features/EncryptMenu.js');
                await EncryptMenu.init(item, playlist);
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

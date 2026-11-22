import { RecordMenu } from './RecordMenu.js';

/**
 * The tools for one playlist item, grouped, and whether it is a limited item
 * (a stream or a YouTube link) that only has a few. The edit panel shows them.
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

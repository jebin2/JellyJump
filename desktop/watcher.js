/**
 * Library watcher - watches scanned directories and updates the index
 * when new media files are added/removed.
 */
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const libraryIndex = require('./library-index');

const VIDEO_EXTENSIONS = new Set([
    '.mp4', '.mkv', '.avi', '.webm', '.mov', '.m4v', '.wmv', '.flv',
    '.ts', '.m2ts', '.mts', '.3gp', '.ogv'
]);

const SUBTITLE_EXTENSIONS = new Set(['.srt', '.vtt', '.ass', '.ssa']);
const LINK_LIST_EXTENSION = '.jjlist';

let watcher = null;
let pendingAdds = new Map();
let addTimer = null;

function isVideoFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return VIDEO_EXTENSIONS.has(ext);
}

function isSubtitleFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return SUBTITLE_EXTENSIONS.has(ext);
}

function isLinkListFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return ext === LINK_LIST_EXTENSION;
}

async function getFileInfo(filePath) {
    try {
        const stat = await fs.promises.stat(filePath);
        const name = path.basename(filePath);
        const ext = path.extname(name).toLowerCase();
        return {
            path: filePath,
            name,
            size: stat.size,
            mtime: stat.mtimeMs,
            ext
        };
    } catch {
        return null;
    }
}

function flushAdds() {
    if (addTimer) {
        clearTimeout(addTimer);
        addTimer = null;
    }
    const toProcess = Array.from(pendingAdds.values());
    pendingAdds.clear();
    if (toProcess.length === 0) return;
    
    const videoFiles = toProcess.filter(f => isVideoFile(f.path));
    if (videoFiles.length > 0) {
        const infos = videoFiles.map(f => ({ path: f.path, name: f.name, size: f.size, mtime: f.mtime, ext: f.ext }));
        libraryIndex.addBatch(infos);
    }
    
    for (const f of toProcess) {
        if (isLinkListFile(f.path)) {
            fs.promises.readFile(f.path, 'utf8').then(text => {
                libraryIndex.addLinkList({ path: f.path, name: f.name, size: f.size, mtime: f.mtime, ext: f.ext, text });
            }).catch(() => {});
        }
    }
}

function queueAdd(filePath) {
    getFileInfo(filePath).then(info => {
        if (!info) return;
        pendingAdds.set(filePath, info);
        if (addTimer) clearTimeout(addTimer);
        addTimer = setTimeout(flushAdds, 300);
    }).catch(() => {});
}

function start() {
    if (watcher) return;
    
    const roots = libraryIndex.getRoots();
    if (!roots || roots.length === 0) {
        return;
    }
    
    try {
        watcher = chokidar.watch(roots, {
            ignored: /(^|[\/\\])\../,
            persistent: true,
            ignoreInitial: true,
            depth: 15,
            awaitWriteFinish: {
                stabilityThreshold: 500,
                pollInterval: 100
            }
        });
        
        watcher
            .on('add', (filePath) => {
                const ext = path.extname(filePath).toLowerCase();
                if (VIDEO_EXTENSIONS.has(ext) || ext === LINK_LIST_EXTENSION) {
                    queueAdd(filePath);
                } else if (SUBTITLE_EXTENSIONS.has(ext)) {
                    // Subtitles could be matched to videos, but for now just note
                    // The scanner does more complex matching
                }
            })
            .on('unlink', (filePath) => {
                // File deleted - resolveServable will return null, so it won't be served
                // We don't remove from index to avoid complexity with subtitle relationships
            })
            .on('error', (error) => {
                console.error('[Watcher] Error:', error.message);
                if (error.code === 'ENOSPC') {
                    console.error('[Watcher] inotify watch limit reached. Increase fs.inotify.max_user_watches');
                }
            });
    } catch (error) {
        console.error('[Watcher] Failed to start:', error.message);
    }
}

function stop() {
    if (addTimer) {
        clearTimeout(addTimer);
        addTimer = null;
    }
    pendingAdds.clear();
    if (watcher) {
        watcher.close();
        watcher = null;
    }
}

module.exports = { start, stop };

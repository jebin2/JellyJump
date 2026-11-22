// @ts-check
/**
 * When a stored file is let go of (ARCHITECTURE_PLAN.md, phase G; BUG-4).
 *
 * In the browser, a local video added to the playlist is copied into
 * IndexedDB so it plays again after a reload. Nothing ever deleted those
 * copies: an item removed from the playlist left its file behind, and the
 * site's storage only grew, until the browser refused more or evicted all of
 * it. Now a file goes when its item leaves the playlist for good, and a sweep
 * after each load removes files that nothing refers to any more.
 *
 * A file is kept while a playlist item or the edit panel's Undo history
 * (the earlier copies of a stacked edit) refers to it.
 *
 * The desktop app keeps its files on disk, where they are the user's own;
 * its storage has no `fileIds` and deletes nothing.
 */
import { Settings } from '../../shared/settings/Settings.js';
import { Logger } from '../../shared/utils/Logger.js';

/**
 * @typedef {{deleteFile?: (id: string) => Promise<void>, fileIds?: () => Promise<string[]>}} FileStore
 * @typedef {{id: string, isLocal?: boolean}} StoredItem
 */

/**
 * The files the edit panel keeps for Undo, by id (its saved history).
 * @returns {Set<string>}
 */
export function editHistoryFileIds() {
    const ids = new Set();
    const history = Settings.get('editHistory', {});
    if (!history || typeof history !== 'object') return ids;
    for (const entry of Object.values(history)) {
        if (!Array.isArray(entry?.steps)) continue;
        for (const step of entry.steps) if (typeof step?.id === 'string') ids.add(step.id);
    }
    return ids;
}

/** @param {Iterable<StoredItem>} items */
function keptIds(items) {
    const keep = editHistoryFileIds();
    for (const item of items) keep.add(item.id);
    return keep;
}

/**
 * Items have left the playlist for good: their stored files go too, unless
 * something still refers to them.
 * @param {FileStore} storage
 * @param {StoredItem[]} removed
 * @param {StoredItem[]} remaining - the playlist after the removal
 */
export function discardStoredFiles(storage, removed, remaining) {
    if (!storage?.deleteFile) return;
    const keep = keptIds(remaining);
    for (const item of removed) {
        if (!item?.isLocal || keep.has(item.id)) continue;
        storage.deleteFile(item.id).catch((error) => {
            Logger.warn('[PlaylistFiles] Could not delete a removed item\'s file:', error);
        });
    }
}

/**
 * Delete the stored files nothing refers to: left behind before files were
 * deleted with their items, or by a page closed mid-way. Only after the
 * playlist loaded from storage; a playlist that failed to load reads as
 * empty and would take every file with it.
 * @param {FileStore} storage
 * @param {() => StoredItem[]} currentItems - read after the stored ids, so
 *   an item added meanwhile is counted
 * @returns {Promise<number>} how many were deleted
 */
export async function sweepStoredFiles(storage, currentItems) {
    if (!storage?.fileIds || !storage.deleteFile) return 0;
    const stored = await storage.fileIds();
    const keep = keptIds(currentItems());
    const orphans = stored.filter((id) => !keep.has(id));
    for (const id of orphans) await storage.deleteFile(id);
    if (orphans.length) Logger.log(`[PlaylistFiles] Deleted ${orphans.length} stored file(s) nothing refers to`);
    return orphans.length;
}

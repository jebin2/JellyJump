/**
 * StorageService
 * Auto-detecting storage wrapper.
 *   Desktop (Electron): DesktopStorageService — JSON config file + disk reads
 *   Browser:            IndexedDBService      — IndexedDB blobs
 *
 * All consumers do `new StorageService()` and get the right backend.
 */

import { IndexedDBService } from './IndexedDBService.js';
import { DesktopStorageService } from './DesktopStorageService.js';

const isDesktop = typeof window !== 'undefined' && window.electronAPI?.isElectron;

export const StorageService = isDesktop ? DesktopStorageService : IndexedDBService;

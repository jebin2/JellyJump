// @ts-check
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
import { isDesktop } from '../platform/Platform.js';

const runsOnDesktop = isDesktop();

export const StorageService = runsOnDesktop ? DesktopStorageService : IndexedDBService;

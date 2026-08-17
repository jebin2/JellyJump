/**
 * MediaScanner
 * Auto-detecting media scanner, mirroring the StorageService junction.
 *   Desktop (Electron): DesktopMediaScanner — utilityProcess walking real folders
 *   Browser:            BrowserMediaScanner — walks a directory the user picks
 *
 * Both stream the same record shape in batches and share the same scan/cancel
 * surface, so callers differ between runtimes only in that the browser needs a
 * user gesture to start.
 */

import { DesktopMediaScanner } from './DesktopMediaScanner.js';
import { BrowserMediaScanner } from './BrowserMediaScanner.js';

const isDesktop = typeof window !== 'undefined' && window.electronAPI?.isElectron;

export const MediaScanner = isDesktop ? DesktopMediaScanner : BrowserMediaScanner;

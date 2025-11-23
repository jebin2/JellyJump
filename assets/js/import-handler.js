/**
 * Import Handler Module
 * Phase 30: Import Media Button
 * 
 * Handles media file import, metadata extraction, and storage
 */

import { dbHelper } from './indexeddb-helper.js';
import { showNotification, updateMediaLibraryCounts } from './media-library.js';

// Generate UUID v4
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Extract file type from MIME type
function getFileType(mimeType) {
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('image/')) return 'image';
    return null;
}

// Extract video metadata
async function extractVideoMetadata(file) {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        video.preload = 'metadata';

        video.addEventListener('loadedmetadata', () => {
            resolve({
                duration: video.duration,
                width: video.videoWidth,
                height: video.videoHeight,
                fps: null // FPS detection requires more complex analysis
            });
            URL.revokeObjectURL(video.src);
        });

        video.addEventListener('error', () => {
            resolve({ duration: 0, width: 0, height: 0, fps: null });
            URL.revokeObjectURL(video.src);
        });

        video.src = URL.createObjectURL(file);
    });
}

// Extract audio metadata
async function extractAudioMetadata(file) {
    return new Promise((resolve) => {
        const audio = document.createElement('audio');
        audio.preload = 'metadata';

        audio.addEventListener('loadedmetadata', () => {
            resolve({ duration: audio.duration });
            URL.revokeObjectURL(audio.src);
        });

        audio.addEventListener('error', () => {
            resolve({ duration: 0 });
            URL.revokeObjectURL(audio.src);
        });

        audio.src = URL.createObjectURL(file);
    });
}

// Extract image metadata
async function extractImageMetadata(file) {
    return new Promise((resolve) => {
        const img = new Image();

        img.addEventListener('load', () => {
            resolve({ width: img.width, height: img.height });
            URL.revokeObjectURL(img.src);
        });

        img.addEventListener('error', () => {
            resolve({ width: 0, height: 0 });
            URL.revokeObjectURL(img.src);
        });

        img.src = URL.createObjectURL(file);
    });
}

// Process single file
async function processFile(file) {
    const fileType = getFileType(file.type);

    if (!fileType) {
        throw new Error(`Unsupported file type: ${file.type}`);
    }

    // Generate unique ID
    const id = generateUUID();

    // Extract metadata based on type
    let metadata = {};
    try {
        if (fileType === 'video') {
            metadata = await extractVideoMetadata(file);
        } else if (fileType === 'audio') {
            metadata = await extractAudioMetadata(file);
        } else if (fileType === 'image') {
            metadata = await extractImageMetadata(file);
        }
    } catch (error) {
        console.warn(`Failed to extract metadata for ${file.name}:`, error);
        // Use defaults if extraction fails
    }

    // Warn for large files
    const MAX_SIZE = 500 * 1024 * 1024; // 500MB
    if (file.size > MAX_SIZE) {
        console.warn(`Large file detected: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
    }

    // Create media object
    const mediaItem = {
        id,
        name: file.name,
        type: fileType,
        blob: file,
        size: file.size,
        dateAdded: Date.now(),
        ...metadata
    };

    // Store in IndexedDB
    await dbHelper.addMedia(mediaItem);

    return mediaItem;
}

// Handle file import
export async function handleImport(files) {
    if (!files || files.length === 0) return;

    showNotification('⏳ Importing files...', 'info');

    let successCount = 0;
    let errorCount = 0;

    for (const file of files) {
        try {
            await processFile(file);
            successCount++;
        } catch (error) {
            console.error(`Failed to import ${file.name}:`, error);
            showNotification(`❌ Failed to import ${file.name}: ${error.message}`, 'error');
            errorCount++;
        }
    }

    // Show final result
    if (successCount > 0) {
        showNotification(`✅ ${successCount} file${successCount > 1 ? 's' : ''} imported successfully`, 'success');
        // Update media library counts
        await updateMediaLibraryCounts();
    }
}

// Initialize import handler
document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('media-import-input');
    const importButton = document.querySelector('[data-action="import"]');

    // Trigger file picker when Import button clicked
    if (importButton) {
        importButton.addEventListener('click', (e) => {
            e.stopPropagation();
            fileInput?.click();
        });
    }

    // Handle file selection
    if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            await handleImport(files);
            // Reset input so same file can be selected again
            fileInput.value = '';
        });
    }
});

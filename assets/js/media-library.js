/**
 * Media Library Module
 * Phase 30: Import Media Button
 * 
 * Manages media library UI updates and notification system
 */

import { dbHelper } from './indexeddb-helper.js';
import { thumbnailGenerator } from './thumbnail-generator.js';
import { previewPlayerManager } from './preview-player.js';
import { modalDialog } from './modal-dialog.js';

// Notification system
const NOTIFICATION_DURATION = 4000; // 4 seconds

export function showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container');
    if (!container) return;

    const notification = document.createElement('div');
    notification.className = `notification notification--${type}`;
    notification.setAttribute('role', 'status');

    const icon = document.createElement('span');
    icon.className = 'notification__icon';
    icon.textContent = type === 'success' ? '✅' : type === 'error' ? '❌' : '⏳';

    const messageEl = document.createElement('span');
    messageEl.className = 'notification__message';
    messageEl.textContent = message;

    notification.appendChild(icon);
    notification.appendChild(messageEl);
    container.appendChild(notification);

    // Auto-dismiss
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, NOTIFICATION_DURATION);
}

// Update media library counts (placeholder for Phase 45)
export async function updateMediaLibraryCounts() {
    try {
        const videos = await dbHelper.getAllMediaByType('video');
        const audio = await dbHelper.getAllMediaByType('audio');
        const images = await dbHelper.getAllMediaByType('image');

        // Update tab counts
        updateTabCount('videos', videos.length);
        updateTabCount('audio', audio.length);
        updateTabCount('images', images.length);

        // Render tiles for all categories
        await renderMediaTiles('videos');
        await renderMediaTiles('audio');
        await renderMediaTiles('images');
    } catch (error) {
        console.error('Failed to update media library counts:', error);
    }
}

function updateTabCount(tabName, count) {
    const tab = document.querySelector(`[data-media-tab="${tabName}"] .media-tab__count`);
    if (tab) {
        tab.textContent = `(${count})`;
    }
}

/**
 * Extract video metadata using HTML5 video element
 * @param {File} file - The video file
 * @returns {Promise<Object>} - Video metadata
 */
async function extractVideoMetadata(file) {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';

        video.onloadedmetadata = () => {
            const metadata = {
                duration: video.duration || 0,
                width: video.videoWidth || 0,
                height: video.videoHeight || 0,
            };

            // Clean up
            URL.revokeObjectURL(video.src);
            resolve(metadata);
        };

        video.onerror = () => {
            URL.revokeObjectURL(video.src);
            reject(new Error('Failed to load video metadata'));
        };

        video.src = URL.createObjectURL(file);
    });
}

/**
 * Process and upload video files
 * @param {FileList} files - The selected video files
 */
async function processVideoFiles(files) {
    if (!files || files.length === 0) return;

    let successCount = 0;
    let errorCount = 0;

    showNotification('⏳ Importing videos...', 'info');

    for (const file of files) {
        // Validate file type
        if (!file.type.startsWith('video/')) {
            showNotification(`❌ ${file.name} is not a video file`, 'error');
            errorCount++;
            continue;
        }

        try {
            // Extract metadata
            const metadata = await extractVideoMetadata(file);

            // Create video object
            const videoData = {
                id: crypto.randomUUID(),
                name: file.name,
                type: 'video',
                blob: file,
                size: file.size,
                duration: metadata.duration,
                width: metadata.width,
                height: metadata.height,
                fps: 0, // Not available via HTML5
                dateAdded: Date.now(),
                category: 'videos',
                thumbnailGenerated: false,
                thumbnail: null
            };

            // Save to IndexedDB
            await dbHelper.addMedia(videoData);
            successCount++;

        } catch (error) {
            console.error(`Failed to import ${file.name}:`, error);
            showNotification(`❌ Failed to import ${file.name}`, 'error');
            errorCount++;
        }
    }

    // Update UI
    if (successCount > 0) {
        showNotification(`✅ ${successCount} video${successCount > 1 ? 's' : ''} added to library`, 'success');
        await updateMediaLibraryCounts();
    }
}

/**
 * Trigger video file picker
 */
function uploadVideos() {
    const fileInput = document.getElementById('video-upload-input');
    if (!fileInput) {
        console.error('Video upload input not found');
        return;
    }

    fileInput.click();
}

/**
 * Extract audio metadata using HTML5 audio element
 * @param {File} file - The audio file
 * @returns {Promise<Object>} - Audio metadata
 */
async function extractAudioMetadata(file) {
    return new Promise((resolve, reject) => {
        const audio = document.createElement('audio');
        audio.preload = 'metadata';

        audio.onloadedmetadata = () => {
            const metadata = {
                duration: audio.duration || 0,
            };

            // Clean up
            URL.revokeObjectURL(audio.src);
            resolve(metadata);
        };

        audio.onerror = () => {
            URL.revokeObjectURL(audio.src);
            reject(new Error('Failed to load audio metadata'));
        };

        audio.src = URL.createObjectURL(file);
    });
}

/**
 * Process and upload audio files
 * @param {FileList} files - The selected audio files
 */
async function processAudioFiles(files) {
    if (!files || files.length === 0) return;

    let successCount = 0;
    let errorCount = 0;

    showNotification('⏳ Importing audio...', 'info');

    for (const file of files) {
        // Validate file type
        if (!file.type.startsWith('audio/')) {
            showNotification(`❌ ${file.name} is not an audio file`, 'error');
            errorCount++;
            continue;
        }

        try {
            // Extract metadata
            const metadata = await extractAudioMetadata(file);

            // Create audio object
            const audioData = {
                id: crypto.randomUUID(),
                name: file.name,
                type: 'audio',
                blob: file,
                size: file.size,
                duration: metadata.duration,
                sampleRate: 0, // Not available via simple HTML5
                channels: 0, // Not available via simple HTML5
                dateAdded: Date.now(),
                category: 'audio'
            };

            // Save to IndexedDB
            await dbHelper.addMedia(audioData);
            successCount++;

        } catch (error) {
            console.error(`Failed to import ${file.name}:`, error);
            showNotification(`❌ Failed to import ${file.name}`, 'error');
            errorCount++;
        }
    }

    // Update UI
    if (successCount > 0) {
        showNotification(`✅ ${successCount} audio file${successCount > 1 ? 's' : ''} added to library`, 'success');
        await updateMediaLibraryCounts();
    }
}

/**
 * Trigger audio file picker
 */
function uploadAudio() {
    const fileInput = document.getElementById('audio-upload-input');
    if (!fileInput) {
        console.error('Audio upload input not found');
        return;
    }

    fileInput.click();
}

/**
 * Extract image metadata using HTML5 Image element
 * @param {File} file - The image file
 * @returns {Promise<Object>} - Image metadata
 */
async function extractImageMetadata(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();

        img.onload = () => {
            const metadata = {
                width: img.naturalWidth || 0,
                height: img.naturalHeight || 0,
                aspectRatio: img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 0,
            };

            // Clean up
            URL.revokeObjectURL(img.src);
            resolve(metadata);
        };

        img.onerror = () => {
            URL.revokeObjectURL(img.src);
            reject(new Error('Failed to load image metadata'));
        };

        img.src = URL.createObjectURL(file);
    });
}

/**
 * Process and upload image files
 * @param {FileList} files - The selected image files
 */
async function processImageFiles(files) {
    if (!files || files.length === 0) return;

    let successCount = 0;
    let errorCount = 0;

    showNotification('⏳ Importing images...', 'info');

    for (const file of files) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
            showNotification(`❌ ${file.name} is not an image file`, 'error');
            errorCount++;
            continue;
        }

        try {
            // Extract metadata
            const metadata = await extractImageMetadata(file);

            // Get file format
            const format = file.name.split('.').pop().toLowerCase();

            // Create image object
            const imageData = {
                id: crypto.randomUUID(),
                name: file.name,
                type: 'image',
                blob: file,
                size: file.size,
                width: metadata.width,
                height: metadata.height,
                aspectRatio: metadata.aspectRatio,
                format: format,
                dateAdded: Date.now(),
                category: 'images'
            };

            // Save to IndexedDB
            await dbHelper.addMedia(imageData);
            successCount++;

        } catch (error) {
            console.error(`Failed to import ${file.name}:`, error);
            showNotification(`❌ Failed to import ${file.name}`, 'error');
            errorCount++;
        }
    }

    // Update UI
    if (successCount > 0) {
        showNotification(`✅ ${successCount} image${successCount > 1 ? 's' : ''} added to library`, 'success');
        await updateMediaLibraryCounts();
    }
}

/**
 * Trigger image file picker
 */
function uploadImages() {
    const fileInput = document.getElementById('image-upload-input');
    if (!fileInput) {
        console.error('Image upload input not found');
        return;
    }

    fileInput.click();
}

/**
 * Handle URL Import
 * @param {string} url 
 */
async function handleUrlImport(url) {
    showNotification('⏳ Importing from URL...', 'info');

    try {
        // Basic validation
        const urlLower = url.toLowerCase();
        const isHLS = urlLower.includes('.m3u8') || urlLower.includes('/hls/') || urlLower.includes('/live/');
        const isM3U = urlLower.endsWith('.m3u') || (urlLower.includes('.m3u') && !urlLower.includes('.m3u8'));

        // Extract filename
        const urlPath = new URL(url).pathname;
        let filename = urlPath.split('/').pop() || 'remote-video';
        if (isHLS) filename = filename.replace('.m3u8', '') || 'Live Stream';
        if (isM3U) filename = filename.replace('.m3u', '') || 'Playlist';

        // Create media object
        const mediaItem = {
            id: crypto.randomUUID(),
            name: filename,
            type: 'video', // Treat as video for now
            url: url,
            blob: null, // No blob for remote
            size: 0,
            duration: isHLS ? 0 : 0, // Unknown duration
            width: 0,
            height: 0,
            dateAdded: Date.now(),
            category: 'videos',
            thumbnailGenerated: false,
            thumbnail: null,
            isRemote: true,
            isStream: isHLS,
            isPlaylist: isM3U
        };

        // Save to IndexedDB
        await dbHelper.addMedia(mediaItem);

        showNotification(`✅ Added ${filename} to library`, 'success');
        await updateMediaLibraryCounts();

    } catch (error) {
        console.error('Failed to import URL:', error);
        showNotification(`❌ Failed to import URL: ${error.message}`, 'error');
    }
}

/**
 * Show URL Upload Modal
 */
function uploadUrl() {
    const content = `
        <div class="mb-input-group">
            <label for="url-input-modal" style="display:block; margin-bottom:5px; font-weight:bold;">Video URL</label>
            <input type="url" id="url-input-modal" placeholder="https://example.com/video.mp4" class="mb-input" style="width:100%; padding:8px; box-sizing:border-box; border:1px solid var(--border-color); border-radius:4px; background:var(--bg-secondary); color:var(--text-primary);">
            <div class="text-xs text-secondary mt-xs" style="margin-top:5px; font-size:0.8em; color:var(--text-secondary);">
                Supported: HLS (.m3u8), MP4, WebM, MOV, M3U Playlists
            </div>
        </div>
    `;

    modalDialog.show('Import from URL', content, [
        {
            text: 'Cancel',
            type: 'secondary',
            callback: () => { }
        },
        {
            text: 'Import',
            type: 'primary',
            callback: () => {
                const input = document.getElementById('url-input-modal');
                if (input && input.value.trim()) {
                    handleUrlImport(input.value.trim());
                }
            }
        }
    ]);

    // Focus input
    setTimeout(() => {
        const input = document.getElementById('url-input-modal');
        if (input) input.focus();
    }, 100);
}

// Search state
let searchQuery = '';
let searchTimeout = null;

/**
 * Highlight matching text in a string
 * @param {string} text - The text to highlight in
 * @param {string} query - The search query
 * @returns {string} - HTML string with highlighted matches
 */
function highlightMatch(text, query) {
    if (!query) return text;

    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
}

/**
 * Search media items in the current category
 * @param {string} query - The search query
 */
async function searchMedia(query) {
    searchQuery = query.toLowerCase().trim();

    console.log(`Searching for: "${searchQuery}"`);

    // Re-render tiles for all categories to apply search filter
    await renderMediaTiles('videos');
    await renderMediaTiles('audio');
    await renderMediaTiles('images');
}

/**
 * Clear search and show all items
 */
async function clearSearch() {
    const searchInput = document.querySelector('[data-search="media"]');
    const clearButton = document.querySelector('[data-action="clear-search"]');

    if (searchInput) {
        searchInput.value = '';
    }

    if (clearButton) {
        clearButton.setAttribute('hidden', '');
    }

    searchQuery = '';
    console.log('Search cleared');

    // Re-render tiles to show all items
    await renderMediaTiles('videos');
    await renderMediaTiles('audio');
    await renderMediaTiles('images');
}

/**
 * Handle search input with debouncing
 * @param {Event} e - Input event
 */
function handleSearchInput(e) {
    const query = e.target.value;
    const clearButton = document.querySelector('[data-action="clear-search"]');

    // Show/hide clear button
    if (clearButton) {
        if (query) {
            clearButton.removeAttribute('hidden');
        } else {
            clearButton.setAttribute('hidden', '');
        }
    }

    // Debounce search
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }

    searchTimeout = setTimeout(() => {
        searchMedia(query);
    }, 300);
}

/**
 * Format duration from seconds to M:SS or H:MM:SS
 * @param {number} seconds - Duration in seconds
 * @returns {string} - Formatted duration
 */
function formatDuration(seconds) {
    if (!seconds || seconds === 0) return '0:00';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Get thumbnail URL for media item
 * @param {Object} item - Media item
 * @returns {string|null} - Blob URL for images/thumbnails, null for placeholder
 */
function getThumbnailUrl(item) {
    // For images, return direct blob URL
    if (item.type === 'image' && item.blob) {
        return URL.createObjectURL(item.blob);
    }

    // For videos with cached thumbnails, return thumbnail URL
    if (item.type === 'video' && item.thumbnail) {
        return URL.createObjectURL(item.thumbnail);
    }

    // For remote URLs without thumbnail, return null (will show placeholder)
    if (item.url && !item.thumbnail) {
        return null;
    }

    return null;
}

/**
 * Create a single media tile element
 * @param {Object} item - Media item from IndexedDB
 * @returns {HTMLElement} - Tile element
 */
function createTile(item) {
    const tile = document.createElement('div');
    tile.className = 'media-tile';
    tile.setAttribute('data-media-id', item.id);
    tile.setAttribute('data-media-type', item.type);
    tile.setAttribute('data-selected', 'false');
    tile.setAttribute('role', 'button');
    tile.setAttribute('tabindex', '0');
    tile.setAttribute('aria-label', `${item.type}: ${item.name}${item.duration ? `, duration ${formatDuration(item.duration)}` : ''}`);

    // Make tile draggable (videos, audio, images only)
    if (item.type === 'video' || item.type === 'audio' || item.type === 'image') {
        tile.setAttribute('draggable', 'true');

        // Drag start handler
        tile.addEventListener('dragstart', (e) => {
            onDragStart(e, item);
        });

        // Drag end handler
        tile.addEventListener('dragend', (e) => {
            onDragEnd(e, tile);
        });
    }

    // Thumbnail area
    const thumbnail = document.createElement('div');
    thumbnail.className = 'media-tile__thumbnail';

    // Set thumbnail content based on type
    const thumbnailUrl = getThumbnailUrl(item);
    if (thumbnailUrl) {
        const img = document.createElement('img');
        img.src = thumbnailUrl;
        img.alt = item.name;
        thumbnail.appendChild(img);
    } else {
        // Placeholder icons
        const icon = item.type === 'video' ? '🎬' : item.type === 'audio' ? '🎵' : '📁';
        thumbnail.textContent = icon;

        // For videos without thumbnails, generate asynchronously
        // Only if we have a blob (local file)
        if (item.type === 'video' && !item.thumbnailGenerated && item.blob) {
            tile.setAttribute('data-thumbnail-status', 'loading');
            loadThumbnailForTile(tile, item).catch(err => {
                console.error(`Failed to generate thumbnail for ${item.name}:`, err);
                tile.setAttribute('data-thumbnail-status', 'error');
            });
        }
    }

    // Duration badge (for video/audio)
    if (item.duration && (item.type === 'video' || item.type === 'audio')) {
        const durationBadge = document.createElement('span');
        durationBadge.className = 'media-tile__duration';
        durationBadge.textContent = formatDuration(item.duration);
        thumbnail.appendChild(durationBadge);
    }

    tile.appendChild(thumbnail);

    // Filename
    const filename = document.createElement('div');
    filename.className = 'media-tile__filename';
    filename.textContent = item.name;
    filename.title = item.name; // Tooltip for full name
    tile.appendChild(filename);

    // Click handler
    tile.addEventListener('click', () => selectTile(item.id));

    // Keyboard handler
    tile.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            selectTile(item.id);
        }
    });

    // Double-click handler - load video in preview (videos only)
    if (item.type === 'video') {
        tile.addEventListener('dblclick', async () => {
            try {
                // Pass URL if available, otherwise blob
                const source = item.url || item.blob;
                await previewPlayerManager.loadVideo(source, item.id, item.name);
            } catch (error) {
                console.error('Failed to load video in preview:', error);
            }
        });
    }

    return tile;
}

/**
 * Load or generate thumbnail for a video tile
 * @param {HTMLElement} tile - The tile element
 * @param {Object} item - Media item data
 */
async function loadThumbnailForTile(tile, item) {
    try {
        // Generate thumbnail from video blob
        const thumbnailBlob = await thumbnailGenerator.generateThumbnail(item.blob);

        // Save to IndexedDB
        await dbHelper.updateMediaThumbnail(item.id, thumbnailBlob);

        // Update the tile's thumbnail display
        const thumbnailElement = tile.querySelector('.media-tile__thumbnail');
        if (thumbnailElement) {
            // Clear placeholder icon
            thumbnailElement.textContent = '';

            // Add thumbnail image
            const img = document.createElement('img');
            img.src = URL.createObjectURL(thumbnailBlob);
            img.alt = item.name;
            thumbnailElement.appendChild(img);

            // Re-add duration badge if it exists
            if (item.duration) {
                const durationBadge = document.createElement('span');
                durationBadge.className = 'media-tile__duration';
                durationBadge.textContent = formatDuration(item.duration);
                thumbnailElement.appendChild(durationBadge);
            }
        }

        tile.setAttribute('data-thumbnail-status', 'loaded');
    } catch (error) {
        console.error('Thumbnail generation failed:', error);
        tile.setAttribute('data-thumbnail-status', 'error');
        throw error;
    }
}

/**
 * Handle drag start event
 * @param {DragEvent} event - Drag event
 * @param {Object} item - Media item being dragged
 */
function onDragStart(event, item) {
    // Store media ID in drag data
    event.dataTransfer.setData('text/plain', item.id);

    // Set drag effect
    event.dataTransfer.effectAllowed = 'copy';

    // Add dragging class to tile for visual feedback
    event.currentTarget.classList.add('media-tile--dragging');

    // Log for debugging
    console.log(`Dragging: ${item.name}`);
}

/**
 * Handle drag end event
 * @param {DragEvent} event - Drag event
 * @param {HTMLElement} tile - Tile element
 */
function onDragEnd(event, tile) {
    // Remove dragging class
    tile.classList.remove('media-tile--dragging');
}

/**
 * Select a tile and deselect others
 * @param {string} tileId - UUID of the tile to select
 */
function selectTile(tileId) {
    const tiles = document.querySelectorAll('.media-tile');

    tiles.forEach(tile => {
        const isSelected = tile.getAttribute('data-media-id') === tileId;
        tile.setAttribute('data-selected', isSelected ? 'true' : 'false');
        tile.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    });

    console.log(`Selected tile: ${tileId}`);
}

/**
 * Render media tiles for the active category
 * @param {string} category - Category name (videos, audio, images)
 */
async function renderMediaTiles(category) {
    const contentArea = document.querySelector(`[data-category="${category}"]`);
    if (!contentArea) return;

    try {
        // Get media items for this category
        const typeMap = { videos: 'video', audio: 'audio', images: 'image' };
        const type = typeMap[category];

        if (!type) return;

        const items = await dbHelper.getAllMediaByType(type);

        // Filter by search query if active
        let filteredItems = items;
        if (searchQuery) {
            filteredItems = items.filter(item =>
                item.name.toLowerCase().includes(searchQuery)
            );
        }

        // Find or create tiles container
        let tilesContainer = contentArea.querySelector('.media-tiles');
        let emptyState = contentArea.querySelector('.media-content__empty');
        let uploadBtn = contentArea.querySelector('.media-upload-btn');

        if (filteredItems.length === 0) {
            // Show empty state
            if (tilesContainer) {
                tilesContainer.remove();
            }
            if (emptyState) {
                emptyState.style.display = 'block';
            }
        } else {
            // Hide empty state
            if (emptyState) {
                emptyState.style.display = 'none';
            }

            // Create or clear tiles container
            if (!tilesContainer) {
                tilesContainer = document.createElement('div');
                tilesContainer.className = 'media-tiles';
                // Insert after upload button
                if (uploadBtn) {
                    uploadBtn.after(tilesContainer);
                } else {
                    contentArea.appendChild(tilesContainer);
                }
            } else {
                tilesContainer.innerHTML = '';
            }

            // Render tiles
            filteredItems.forEach(item => {
                const tile = createTile(item);
                tilesContainer.appendChild(tile);
            });
        }
    } catch (error) {
        console.error(`Failed to render tiles for ${category}:`, error);
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await dbHelper.init();
        await updateMediaLibraryCounts();

        // Attach video upload button handler
        const uploadBtn = document.querySelector('[data-upload="videos"]');
        if (uploadBtn) {
            uploadBtn.addEventListener('click', uploadVideos);
        }

        // Attach URL upload button handler
        const urlUploadBtn = document.querySelector('[data-upload="url"]');
        if (urlUploadBtn) {
            urlUploadBtn.addEventListener('click', uploadUrl);
        }

        // Attach file input handler
        const fileInput = document.getElementById('video-upload-input');
        if (fileInput) {
            fileInput.addEventListener('change', async (e) => {
                await processVideoFiles(e.target.files);
                // Reset input to allow re-selecting same file
                e.target.value = '';
            });
        }

        // Attach audio upload button handler
        const audioUploadBtn = document.querySelector('[data-upload="audio"]');
        if (audioUploadBtn) {
            audioUploadBtn.addEventListener('click', uploadAudio);
        }

        // Attach audio file input handler
        const audioFileInput = document.getElementById('audio-upload-input');
        if (audioFileInput) {
            audioFileInput.addEventListener('change', async (e) => {
                await processAudioFiles(e.target.files);
                // Reset input to allow re-selecting same file
                e.target.value = '';
            });
        }

        // Attach image upload button handler
        const imageUploadBtn = document.querySelector('[data-upload="images"]');
        if (imageUploadBtn) {
            imageUploadBtn.addEventListener('click', uploadImages);
        }

        // Attach image file input handler
        const imageFileInput = document.getElementById('image-upload-input');
        if (imageFileInput) {
            imageFileInput.addEventListener('change', async (e) => {
                await processImageFiles(e.target.files);
                // Reset input to allow re-selecting same file
                e.target.value = '';
            });
        }

        // Attach search input handler
        const searchInput = document.querySelector('[data-search="media"]');
        if (searchInput) {
            searchInput.addEventListener('input', handleSearchInput);

            // Clear search on Esc key
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    clearSearch();
                }
            });
        }

        // Attach clear search button handler
        const clearButton = document.querySelector('[data-action="clear-search"]');
        if (clearButton) {
            clearButton.addEventListener('click', clearSearch);
        }

    } catch (error) {
        console.error('Failed to initialize media library:', error);
        showNotification('❌ Failed to initialize media library', 'error');
    }
});

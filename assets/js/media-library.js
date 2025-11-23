/**
 * Media Library Module
 * Phase 30: Import Media Button
 * 
 * Manages media library UI updates and notification system
 */

import { dbHelper } from './indexeddb-helper.js';

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
    } catch (error) {
        console.error('Failed to update media library counts:', error);
    }
}

function updateTabCount(tabName, count) {
    const tab = document.querySelector(`[data-tab="${tabName}"] .tab-count`);
    if (tab) {
        tab.textContent = count;
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await dbHelper.init();
        await updateMediaLibraryCounts();
    } catch (error) {
        console.error('Failed to initialize media library:', error);
        showNotification('❌ Failed to initialize media library', 'error');
    }
});

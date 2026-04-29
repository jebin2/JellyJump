import { Logger } from './Logger.js';

/**
 * Toast Notification Utility
 * Provides a simple way to show temporary notifications to the user.
 */
export const Toast = {
    /**
     * Show a toast notification
     * @param {string} message - Message to display
     * @param {number} duration - Duration in ms (default: 2000)
     * @param {boolean} isError - Whether to show as an error state
     */
    show(message, duration = 2000, isError = false) {
        const toast = document.createElement('div');
        toast.className = `mb-toast ${isError ? 'mb-toast--error' : ''}`;
        toast.textContent = message;
        
        // Use CSS variables for styling (defined in common.css/theme.css)
        toast.style.cssText = `
            position: fixed;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%);
            background: ${isError ? 'var(--color-error, #ff4444)' : 'var(--accent-primary, #00d9a5)'};
            color: ${isError ? '#fff' : '#000'};
            padding: 12px 24px;
            border-radius: 8px;
            font-weight: 600;
            z-index: 9999;
            opacity: 0;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            pointer-events: none;
            text-align: center;
            min-width: 200px;
        `;
        
        document.body.appendChild(toast);
        
        // Trigger entrance animation
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(-50%) translateY(-8px)';
        });
        
        // Cleanup after duration
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(0)';
            setTimeout(() => {
                if (toast.parentNode) document.body.removeChild(toast);
            }, 300);
        }, duration);

        Logger.log(`[Toast] ${message}`);
    }
};

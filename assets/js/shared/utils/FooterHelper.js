/**
 * FooterHelper - Creates configurable footer for processing modals
 * Reduces duplicate footer templates by providing a single common template
 * that can be configured per-modal.
 */
import { Logger } from './Logger.js';

/**
 * Configuration for process footer
 * @typedef {Object} FooterConfig
 * @property {string} actionClass - CSS class for the primary action button (e.g., 'convert-btn')
 * @property {string} icon - Icon name from sprite.svg (e.g., 'icon-convert')
 * @property {string} title - The button's visible label (e.g., 'Convert')
 */

/**
 * Creates a configured process footer from the common template
 * @param {FooterConfig} config - Configuration object
 * @returns {DocumentFragment} Cloned and configured footer fragment
 */
export function createProcessFooter(config) {
    const template = document.getElementById('common-process-footer-template');

    if (!template) {
        Logger.error('FooterHelper: common-process-footer-template not found');
        return null;
    }

    const footer = template.content.cloneNode(true);

    // Configure the primary action button
    const actionBtn = footer.querySelector('.primary-action-btn');
    const iconUse = footer.querySelector('.action-icon-use');

    if (actionBtn) {
        // Add the specific action class (e.g., 'convert-btn', 'trim-btn')
        actionBtn.classList.add(config.actionClass);
        actionBtn.title = config.title;
        const label = actionBtn.querySelector('.action-label');
        if (label) label.textContent = config.title;
    }

    if (iconUse) {
        iconUse.setAttribute('href', `assets/icons/sprite.svg#${config.icon}`);
    }

    return footer;
}

/**
 * Change what a footer's primary button says, for a menu whose action
 * changes with its settings (Encrypt / Decrypt, Reverse / Change Speed).
 * Leaves the icon in place, which rewriting innerHTML would not.
 * @param {HTMLElement|null} button
 * @param {string} text
 */
export function setActionLabel(button, text) {
    if (!button) return;
    button.title = text;
    const label = button.querySelector('.action-label');
    if (label) label.textContent = text;
    else button.textContent = text;
}

/**
 * Predefined configurations for common modals
 * Usage: createProcessFooter(FOOTER_CONFIGS.convert)
 */
export const FOOTER_CONFIGS = {
    convert: {
        actionClass: 'convert-btn',
        icon: 'icon-convert',
        title: 'Convert'
    },
    trim: {
        actionClass: 'trim-btn',
        icon: 'icon-scissors',
        title: 'Cut'
    },
    exportFx: {
        actionClass: 'export-fx-btn',
        icon: 'icon-download',
        title: 'Export'
    },
    resize: {
        actionClass: 'resize-btn',
        icon: 'icon-maximize',
        title: 'Resize'
    },
    crop: {
        actionClass: 'crop-btn',
        icon: 'icon-crop',
        title: 'Crop'
    },
    gif: {
        actionClass: 'create-gif-btn',
        icon: 'icon-gif',
        title: 'Create GIF'
    },
    reverse: {
        actionClass: 'reverse-btn',
        icon: 'icon-speed',
        title: 'Apply'
    },
    removeBg: {
        actionClass: 'removebg-btn',
        icon: 'icon-eyedropper',
        title: 'Remove Background'
    },
    blur: {
        actionClass: 'process-btn',
        icon: 'icon-blur',
        title: 'Apply Blur'
    },
    watermark: {
        actionClass: 'wm-process-btn',
        icon: 'icon-watermark',
        title: 'Apply Watermark'
    },
    rotate: {
        actionClass: 'rotate-process-btn',
        icon: 'icon-rotate-cw',
        title: 'Apply Rotation'
    },
    encrypt: {
        actionClass: 'encrypt-btn',
        icon: 'icon-lock',
        title: 'Start'
    },
    unlock: {
        actionClass: 'unlock-btn',
        icon: 'icon-lock',
        title: 'Unlock'
    },
    multicut: {
        actionClass: 'multicut-btn',
        icon: 'icon-scissors',
        title: 'Remove Clips'
    },
    slideshow: {
        actionClass: 'slideshow-btn',
        icon: 'icon-image',
        title: 'Create Video'
    }
};

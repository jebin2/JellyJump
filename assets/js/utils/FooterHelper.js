/**
 * FooterHelper - Creates configurable footer for processing modals
 * Reduces duplicate footer templates by providing a single common template
 * that can be configured per-modal.
 */

/**
 * Configuration for process footer
 * @typedef {Object} FooterConfig
 * @property {string} actionClass - CSS class for the primary action button (e.g., 'convert-btn')
 * @property {string} icon - Icon name from sprite.svg (e.g., 'icon-convert')
 * @property {string} title - Button title and aria-label (e.g., 'Convert')
 */

/**
 * Creates a configured process footer from the common template
 * @param {FooterConfig} config - Configuration object
 * @returns {DocumentFragment} Cloned and configured footer fragment
 */
export function createProcessFooter(config) {
    const template = document.getElementById('common-process-footer-template');

    if (!template) {
        console.error('FooterHelper: common-process-footer-template not found');
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
        actionBtn.setAttribute('aria-label', config.title);
    }

    if (iconUse) {
        iconUse.setAttribute('href', `assets/icons/sprite.svg#${config.icon}`);
    }

    return footer;
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
        title: 'Trim'
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
        icon: 'icon-rewind',
        title: 'Reverse'
    },
    removeBg: {
        actionClass: 'removebg-btn',
        icon: 'icon-bg',
        title: 'Remove Background'
    },
    blur: {
        actionClass: 'process-btn',
        icon: 'icon-blur',
        title: 'Process Blur'
    },
    watermark: {
        actionClass: 'wm-process-btn',
        icon: 'icon-droplet',
        title: 'Watermark'
    },
    rotate: {
        actionClass: 'rotate-process-btn',
        icon: 'icon-rotate-cw',
        title: 'Apply Rotation'
    },
    encrypt: {
        actionClass: 'encrypt-btn',
        icon: 'icon-lock',
        title: 'Encrypt/Decrypt'
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

import { Modal } from '../../Modal.js';
import { createProcessFooter, FOOTER_CONFIGS } from '../../../shared/utils/FooterHelper.js';
import { Logger } from '../../../shared/utils/Logger.js';
import { takePanelSurface } from './MenuSurface.js';

export { FOOTER_CONFIGS };

/**
 * Create and open a standard process menu modal -- or, when the edit panel
 * opened this tool, a panel surface that behaves like one.
 * Returns nulls if the content template is missing.
 * @param {string} title
 * @param {string} templateId - DOM id of the <template> element
 * @param {Object} footerConfig - One of FOOTER_CONFIGS values
 * @param {Object} [options] - Optional Modal constructor overrides
 * @returns {{ modal: Modal, content: Element } | null}
 */
export function openProcessMenu(title, templateId, footerConfig, options = {}) {
    const template = document.getElementById(templateId);
    if (!template) {
        Logger.error(`[MenuFactory] Template not found: ${templateId}`);
        takePanelSurface();
        return { modal: null, content: null };
    }

    const modal = takePanelSurface() ?? new Modal({ ...options });
    modal.setTitle(title);
    modal.setBody(template.content.cloneNode(true));
    if (footerConfig) modal.setFooter(createProcessFooter(footerConfig));
    modal.open();

    return { modal, content: modal.modal };
}

/**
 * A tool's surface, for a tool that fills it itself rather than through
 * openProcessMenu: the edit panel's when the panel opened the tool, a dialog
 * otherwise.
 * @param {Object} [options] - Modal options; `onClose` is honoured by both
 * @returns {Modal|Object}
 */
export function openToolSurface(options = {}) {
    const surface = takePanelSurface();
    if (!surface) return new Modal(options);
    if (options.onClose) surface.options.onClose = options.onClose;
    return surface;
}

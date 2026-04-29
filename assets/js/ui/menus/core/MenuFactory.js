import { Modal } from '../../../player/Modal.js';
import { createProcessFooter, FOOTER_CONFIGS } from '../../../utils/FooterHelper.js';

export { FOOTER_CONFIGS };

/**
 * Create and open a standard process menu modal.
 * Returns null if the content template is missing.
 * @param {string} title
 * @param {string} templateId - DOM id of the <template> element
 * @param {Object} footerConfig - One of FOOTER_CONFIGS values
 * @param {Object} [options] - Optional Modal constructor overrides
 * @returns {{ modal: Modal, content: Element } | null}
 */
export function openProcessMenu(title, templateId, footerConfig, options = {}) {
    const template = document.getElementById(templateId);
    if (!template) {
        console.error(`[MenuFactory] Template not found: ${templateId}`);
        return { modal: null, content: null };
    }

    const modal = new Modal({ ...options });
    modal.setTitle(title);
    modal.setBody(template.content.cloneNode(true));
    if (footerConfig) modal.setFooter(createProcessFooter(footerConfig));
    modal.open();

    return { modal, content: modal.modal };
}

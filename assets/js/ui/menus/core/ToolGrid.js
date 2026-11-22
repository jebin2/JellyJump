// @ts-check

/**
 * The tile grid both Tools menus are built from.
 *
 * Tools are given in titled sections rather than one flat list: seventeen
 * tiles in no order made the user read them all to find one, and the last row
 * fell below the fold on an ordinary laptop screen.
 */

/**
 * @typedef {Object} Tool
 * @property {string} action - Read back from the tile's data-action on click
 * @property {string} icon - Symbol id in sprite.svg
 * @property {string} label
 * @property {string} [title] - Tooltip, when the label alone is too terse
 *
 * @typedef {Object} ToolSection
 * @property {string} [heading] - Omitted when a menu has only one section
 * @property {Tool[]} tools
 */

/** @param {string} text */
const escapeHtml = (text) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * @param {ToolSection[]} sections - Empty sections are left out
 * @param {{ columns?: number }} [options] - Tiles per row on a wide screen;
 *   a phone gets at most four
 * @returns {HTMLDivElement}
 */
export function renderToolGrid(sections, { columns = 6 } = {}) {
    const root = document.createElement('div');
    root.className = 'tools-sections';
    root.style.setProperty('--tools-columns', String(columns));
    root.innerHTML = sections.filter(s => s.tools.length).map(section => `
        <section class="tools-section">
            ${section.heading ? `<h3 class="tools-section-heading">${escapeHtml(section.heading)}</h3>` : ''}
            <div class="tools-grid tools-grid-compact">
                ${section.tools.map(tool => `
                    <button class="tools-tile tools-tile-sm" data-action="${escapeHtml(tool.action)}"
                            title="${escapeHtml(tool.title ?? tool.label)}">
                        <div class="tools-tile-icon">
                            <svg width="20" height="20" fill="currentColor" aria-hidden="true">
                                <use href="assets/icons/sprite.svg#${escapeHtml(tool.icon)}"></use>
                            </svg>
                        </div>
                        <span class="tools-tile-label">${escapeHtml(tool.label)}</span>
                    </button>
                `).join('')}
            </div>
        </section>
    `).join('');
    return root;
}

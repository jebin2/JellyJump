// @ts-check
/**
 * A tool's <template> markup, added to the page when the tool's code loads
 * (ARCHITECTURE_PLAN.md, F4).
 *
 * Every tool's templates used to be in playlist-templates.html, 125 KB that
 * the player fetched and parsed before it started, for tools most visits
 * never open. Each tool now imports its own file from ui/menus/templates/
 * (as text, bundled into the tool's lazily loaded chunk) and installs it
 * here, before anything looks a template up by id.
 *
 *   import markup from '../templates/trim.html?raw';
 *   installTemplates(markup);
 *
 * The markup is the app's own file, never data, so it goes in as is.
 */

/** @type {Set<string>} */
const installed = new Set();

/** @param {string} markup - one or more <template> elements */
export function installTemplates(markup) {
    if (installed.has(markup) || typeof document === 'undefined') return;
    installed.add(markup);
    let host = document.getElementById('jj-tool-templates');
    if (!host) {
        host = document.createElement('div');
        host.id = 'jj-tool-templates';
        host.hidden = true;
        document.body.appendChild(host);
    }
    const parsed = document.createElement('div');
    parsed.innerHTML = markup;
    for (const template of parsed.querySelectorAll('template')) {
        if (!document.getElementById(template.id)) host.appendChild(template);
    }
}

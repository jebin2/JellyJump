// @ts-check
/**
 * Building HTML from strings, safely.
 *
 * Titles, track names, device labels and error messages come from files,
 * playlists, other machines' libraries and the browser. Put into
 * `innerHTML` as they are, a name like `<img src=x>` becomes markup. The
 * page's Content-Security-Policy stops it running script, but not changing
 * what the page shows. Everything that goes into HTML from a value goes
 * through here.
 *
 *   el.innerHTML = html`<span class="name">${track.name}</span>`;
 *
 * Every `${value}` is escaped. A value that is itself `html\`…\`` is kept as
 * markup, so templates nest; an array is joined, each item escaped the same
 * way.
 */

/** Markup that has already been escaped, safe to put into the page. */
export class SafeHtml {
    /** @param {string} markup */
    constructor(markup) { this.markup = markup; }
    toString() { return this.markup; }
}

const ENTITIES = /[&<>"'`]/g;

/**
 * A value as text that cannot be read as markup, in element content or in
 * a quoted attribute.
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHtml(value) {
    return String(value ?? '').replace(ENTITIES, (c) => `&#${c.charCodeAt(0)};`);
}

/** @param {unknown} value @returns {string} */
function render(value) {
    if (value instanceof SafeHtml) return value.markup;
    if (Array.isArray(value)) return value.map(render).join('');
    return escapeHtml(value);
}

/**
 * @param {TemplateStringsArray} strings
 * @param {...unknown} values
 * @returns {SafeHtml}
 */
export function html(strings, ...values) {
    let out = strings[0];
    for (let i = 0; i < values.length; i++) out += render(values[i]) + strings[i + 1];
    return new SafeHtml(out);
}

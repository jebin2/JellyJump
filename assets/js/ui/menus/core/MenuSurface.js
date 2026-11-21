// @ts-check
/**
 * Where the next tool opens: in a dialog, or in the edit panel.
 *
 * The tools open themselves through openProcessMenu and know nothing of the
 * edit panel. When the panel opens a tool, it offers itself here first, and
 * openProcessMenu takes the offer: the tool gets a surface with a dialog's
 * methods that draws in the sidebar. A tool opened any other way finds no
 * offer and gets its dialog, as before.
 */

/** @type {Object|null} */
let offered = null;

/** @param {Object} surface - an EditPanel tool surface */
export function offerPanelSurface(surface) {
    offered = surface;
}

/**
 * The surface on offer, once; null when there is none.
 * @returns {Object|null}
 */
export function takePanelSurface() {
    const surface = offered;
    offered = null;
    return surface;
}

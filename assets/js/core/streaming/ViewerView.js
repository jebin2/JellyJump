/**
 * What a viewer's page should show, given what their connection just did.
 *
 * This is a decision, not a display, and keeping it apart from the page is
 * deliberate: every mistake this feature has made for a viewer has been one of
 * these cases getting the wrong answer, and none of them could be reproduced
 * on a loopback connection, which never fails, never drops and never recovers.
 * Here they can simply be stated and checked.
 *
 * The cases that matter:
 *
 *  - `disconnected` is not the end. It means recent connectivity checks went
 *    unanswered, and it very often returns to `connected` on its own. Treating
 *    it as the end left the page on an error while the stream came back
 *    underneath it -- the picture is collapsed behind that panel, so a viewer
 *    heard the film and could not see it.
 *  - Before a picture has ever arrived, nothing the connection does means what
 *    it would mean afterwards: the host simply has not pasted the code yet.
 *  - Once the party is genuinely over -- the host said so, or the connection
 *    is beyond recovery -- nothing later puts it back.
 */

/** @typedef {{panel: string|null, interrupted: boolean, waiting: boolean,
 *             over: boolean, detail: string}} ViewerView */

const FAILED_DETAIL = 'The connection could not be established. Some home '
    + 'networks will not allow a direct one. Trying another network on either '
    + 'side -- a phone on mobile data, say -- usually works.';
const ENDED_DETAIL = 'The host has stopped sharing.';
const WAITING_NOTE = 'Still waiting for the host to paste your code. This is '
    + 'normal until they do. If they already have and nothing happened, ask '
    + 'them for a fresh link.';

export { FAILED_DETAIL, ENDED_DETAIL, WAITING_NOTE };

/**
 * @param {{state: string, hasWatched: boolean, over: boolean}} situation
 * @returns {ViewerView} `panel` is null to mean "leave the page as it is".
 */
export function viewerView({ state, hasWatched = false, over = false }) {
    const nothing = { panel: null, interrupted: false, waiting: false, over, detail: '' };
    // The party being over is sticky: a connection that flickers back to life
    // after the host has gone is not an invitation to carry on watching.
    if (over) return { ...nothing, panel: null };

    if (state === 'connected') {
        // Also the way back from a panel that should not have been shown.
        return { ...nothing, panel: hasWatched ? 'watching' : null };
    }

    if (state === 'disconnected') {
        if (!hasWatched) return { ...nothing, waiting: true };
        // Keep the picture, frozen, and say it is coming back.
        return { ...nothing, interrupted: true };
    }

    if (state === 'failed' || state === 'closed') {
        if (!hasWatched) return { ...nothing, waiting: true };
        return {
            ...nothing,
            panel: 'problem',
            over: true,
            detail: state === 'failed' ? FAILED_DETAIL : ENDED_DETAIL,
        };
    }

    // 'new' and 'connecting': still on its way, nothing to say.
    return nothing;
}

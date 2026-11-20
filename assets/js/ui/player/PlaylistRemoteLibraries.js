// @ts-check
import { Logger } from "../../shared/utils/Logger.js";
import { Toast } from "../../shared/utils/Toast.js";
import { Modal as DialogModal } from '../Modal.js';
import { generateId } from '../../shared/utils/mediaUtils.js';
import { streamLibraryInto } from '../../shared/services/RemoteLibraryLoad.js';
import {
    fetchItems as fetchRemoteItems,
    fetchItemsStreaming as fetchRemoteItemsStreaming,
    savedLinks as savedRemoteLinks, rememberLink as rememberRemoteLink,
    hostOf, reachHint,
} from '../../shared/services/RemoteLibrary.js';

/**
 * Shared libraries in the playlist: the files another machine shares by
 * link, added, restored at startup, reloaded and shown.
 */
export class PlaylistRemoteLibraries {
    /**
     * @param {import('./Playlist.js').Playlist} playlist - The playlist instance
     */
    constructor(playlist) {
        this.playlist = playlist;
    }

    /**
     * Pull a shared library's listing into the playlist.
     *
     * Both callers -- adding a link and restoring saved ones at startup -- want
     * the same thing, and used to carry their own copy of the batch loop and
     * its render throttle. The policy lives in one place now, because the
     * throttle was the bug: see RemoteLibraryLoad.js.
     */
    stream(url, onAnnounce) {
        return streamLibraryInto(url, {
            fetchStreaming: fetchRemoteItemsStreaming,
            addItems: (batch) => this.playlist.state.addItems(batch),
            render: () => this.playlist.render(),
            setLoading: (source, loading) => {
                if (loading) this.playlist.state.loadingRemoteSources.add(source);
                else this.playlist.state.loadingRemoteSources.delete(source);
            },
            onProgress: (source, count) => this.playlist.renderer.updateRemoteLibraryProgress(source, count),
            onAnnounce,
        });
    }

    /**
     * Add every file from a shared library.
     *
     * Not persisted: the files live on the other machine, so a saved copy would
     * reappear as broken entries whenever that machine is off or the link has
     * been revoked. Re-paste the link to get them back.
     */
    async add(url, info, onFirstItems) {
        // The listing streams in, but it is deliberately not rendered as it
        // arrives -- see RemoteLibraryLoad.js. The folder shows up once with a
        // spinner, its count ticks up in place, and the tree is rebuilt only
        // when the listing is complete.
        const result = await this.stream(url, onFirstItems);
        const total = result.streamed;

        if (result.total === 0) {
            Toast.show(`${info.name} has no videos to share`, 4000);
            return;
        }

        rememberRemoteLink(url);
        this.playlist._updatePlayerNavigationState();

        if (result.complete) {
            Toast.show(`Added ${total} file${total === 1 ? '' : 's'} from ${info.name}`);
        } else {
            // Said plainly rather than passed off as a finished library: the
            // files that did arrive work, and reload fetches the rest.
            Toast.show(
                `Added ${total} of ${result.expected ?? '?'} files from ${info.name} — the connection dropped. `
                + 'Use the reload button on the folder to get the rest.',
                6000, true,
            );
        }
        Logger.log(`[Playlist] Added remote library ${info.name} (${total} items, complete=${result.complete})`);
    }

    /**
     * Re-add shared libraries that were added in an earlier session.
     *
     * The link is what persists, not the items: they live on another machine,
     * so a saved copy would come back stale — files renamed or deleted there
     * would linger as entries that fail when clicked. Re-fetching costs one
     * request and gives whatever is actually there now.
     *
     * A library whose machine is unreachable is left out rather than failing
     * the load, and the link is kept: the laptop is usually just off.
     */
    async restore() {
        const links = savedRemoteLinks();
        if (links.length === 0) return;

        const unreachable = [];

        for (const link of links) {
            try {
                // Streamed for the same reason adding one is: this runs at
                // startup, and waiting for a whole large library first would
                // hold the playlist empty exactly when the user is looking at
                // it. An incomplete result is not treated as an error — what
                // arrived is real, and the folder's reload button gets the rest.
                const result = await this.stream(link);
                Logger.log(`[Playlist] Restored shared library (${result.total} items, complete=${result.complete})`);
                if (result.total === 0) {
                    unreachable.push({ link, reason: 'the host answered with nothing' });
                }
            } catch (error) {
                // "Failed to fetch" on its own tells nobody anything, and the
                // likeliest cause for a library on a tailnet is the browser
                // refusing the request rather than the host being down.
                let reason = error.message || 'unreachable';
                try { reason += reachHint(new URL(link)); } catch { /* unparseable link */ }
                Logger.warn('[Playlist] Shared library unavailable, keeping the link:', reason);
                unreachable.push({ link, reason });
            }
        }

        // Said out loud rather than left in the console. A library that fails to
        // come back leaves no folder and no reload button, so the only thing on
        // screen is a playlist that is quietly missing everything the user
        // added last session — indistinguishable from the app having lost it.
        if (unreachable.length > 0) {
            const names = unreachable.map(u => hostOf(u.link)).join(', ');
            const why = unreachable[0].reason;
            Toast.show(
                `Couldn't reach ${unreachable.length === 1 ? 'the shared library on' : 'shared libraries on'} `
                + `${names} (${why}). The link${unreachable.length === 1 ? ' is' : 's are'} kept — `
                + 'add it again or reload once the machine is back.',
                8000, true,
            );
        }

        this.playlist.render();
        this.playlist._updatePlayerNavigationState();
    }

    /**
     * Re-fetch a shared library.
     *
     * The listing is a snapshot, and the other machine keeps scanning after it
     * was taken, so this is how new files appear without re-pasting the link.
     *
     * Items are matched by remoteId, which is stable across scans: an item that
     * is still there keeps its object, so whatever is playing is not torn out
     * from under the player.
     * @param {string} source - the share link the library came from
     */
    async refresh(source) {
        try {
            const fresh = await fetchRemoteItems(source);
            const existing = this.playlist.state.items.filter(i => i.remoteSource === source);
            const byRemoteId = new Map(existing.map(i => [i.remoteId, i]));

            let added = 0;
            const merged = fresh.map((item) => {
                const previous = byRemoteId.get(item.remoteId);
                if (previous) {
                    if (item.subtitleUrls) previous.subtitleUrls = item.subtitleUrls;
                    else delete previous.subtitleUrls;
                    return previous;
                }
                added++;
                item.id = generateId();
                return item;
            });
            const removed = existing.length - (fresh.length - added);

            const others = this.playlist.state.items.filter(i => i.remoteSource !== source);
            this.playlist.state.setItems([...others, ...merged]);
            this.playlist.render();
            this.playlist._updatePlayerNavigationState();

            if (added === 0 && removed === 0) {
                Toast.show('Library is up to date');
            } else {
                const parts = [];
                if (added) parts.push(`${added} added`);
                if (removed > 0) parts.push(`${removed} gone`);
                Toast.show(`Library reloaded — ${parts.join(', ')}`);
            }
            Logger.log(`[Playlist] Reloaded remote library: ${added} added, ${removed} removed`);
        } catch (error) {
            Logger.error('[Playlist] Could not reload remote library:', error);
            // The other machine is usually just off or asleep; the items already
            // listed stay, since they will work again when it is back.
            Toast.show('Could not reach that library — is the other machine on?', 5000, true);
        }
    }

    /**
     * Show a shared library's details, including the link it came from.
     *
     * The link is not otherwise recoverable from the app: adding a library
     * shows the files and nothing else, and the URL lives in localStorage where
     * the user cannot reach it. Getting it back meant going to the machine that
     * shared it, which is the one machine they may not be sitting at.
     *
     * The link carries the token, so this is showing a credential. It is shown
     * rather than copied silently: the user should see what is going on the
     * clipboard, and the clipboard API can be refused, in which case selecting
     * the text is the fallback.
     * @param {string} source - the share link the library came from
     */
    showInfo(source) {
        const items = this.playlist.items.filter(i => i.remoteSource === source);
        const serverName = items[0]?.remoteServer || 'Shared library';

        let origin = source;
        try { origin = new URL(source).origin; } catch { /* show it as given */ }

        const modal = new DialogModal({ maxWidth: '520px' });
        modal.setTitle(serverName);

        // Same column layout the share dialog uses: the .share-* pieces below
        // are spaced by its gap and overlap without it.
        const body = document.createElement('div');
        body.className = 'share-menu';

        const note = document.createElement('p');
        note.className = 'share-note';
        note.textContent = `${items.length} file${items.length === 1 ? '' : 's'} from ${origin}. `
            + 'Paste this link into Add Link on another device to open the same library there.';
        body.appendChild(note);

        const row = document.createElement('div');
        row.className = 'share-link-row';

        const link = document.createElement('input');
        link.type = 'text';
        link.readOnly = true;
        link.className = 'share-link';
        link.value = source;
        link.addEventListener('focus', () => link.select());
        row.appendChild(link);

        const copy = document.createElement('button');
        copy.className = 'share-btn share-btn--primary';
        copy.textContent = 'Copy';
        copy.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(source);
                Toast.show('Link copied');
            } catch {
                // Refused clipboard: selecting it still lets them copy by hand
                // rather than leaving them with no way to get the link.
                link.select();
                Toast.show('Press Ctrl+C to copy the selected link', 4000);
            }
            copy.textContent = 'Copied';
            setTimeout(() => { copy.textContent = 'Copy'; }, 1500);
        });
        row.appendChild(copy);
        body.appendChild(row);

        const warn = document.createElement('p');
        warn.className = 'share-note share-note--warn';
        warn.textContent = 'Anyone with this link can browse and play that library. Treat it like a password.';
        body.appendChild(warn);

        modal.setBody(body);
        modal.open();
        link.focus();
    }
}

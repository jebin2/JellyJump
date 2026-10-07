import { WatchViewer } from './core/streaming/WatchParty.js';
import { Logger } from './shared/utils/Logger.js';

/**
 * The viewer side of a watch party.
 *
 * Deliberately not the player. A viewer receives a live stream, so there is no
 * seeking, no pausing and no playlist -- there is nothing to control, which is
 * the point rather than a restriction. That also means none of the player's
 * machinery is needed here: a video element is the whole of it.
 *
 * The invitation arrives in the URL fragment, which never reaches a server.
 */

const el = id => document.getElementById(id);

function show(state, detail) {
    for (const name of ['joining', 'reply', 'problem']) {
        el(name).hidden = name !== state;
    }
    // The video is never hidden, only collapsed: see watch.html.
    el('stage').classList.toggle('live', state === 'watching');
    if (detail) el('detail').textContent = detail;
}

async function main() {
    const offer = window.location.hash.slice(1);
    if (!offer) {
        show('problem', 'This link is missing its invitation. Ask for a new one.');
        return;
    }

    const viewer = new WatchViewer();
    let answer;
    try {
        show('joining');
        answer = await viewer.join(offer);
    } catch (error) {
        Logger.warn('[Watch] Could not read the invitation:', error);
        show('problem', error.message || 'That invitation could not be read.');
        return;
    }

    // The reply has to get back to the host by hand, so make that the easy part.
    el('code').value = answer.code;
    el('copy').addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(answer.code);
            el('copy').textContent = 'Copied';
        } catch {
            // Clipboard access can be refused; the field is selectable anyway.
            el('code').select();
            el('copy').textContent = 'Press Ctrl+C';
        }
    });
    show('reply');

    const video = el('video');
    const stream = await answer.stream;
    video.srcObject = stream;
    // Not awaited: play() on a live stream has no point of completion and its
    // promise can stay pending for good. Arrival is what matters, and that is
    // what loadedmetadata reports.
    video.play().catch(() => {});
    // Either event is enough to know there is a picture; whichever lands first
    // reveals it. loadedmetadata alone has been observed not to fire for a
    // stream attached while the element was not being rendered.
    const reveal = () => show('watching');
    video.addEventListener('loadedmetadata', reveal, { once: true });
    video.addEventListener('resize', reveal, { once: true });

    viewer.connection.addEventListener('connectionstatechange', () => {
        const state = viewer.connection.connectionState;
        Logger.log(`[Watch] Connection ${state}`);
        if (state === 'failed') {
            show('problem', 'The connection could not be established. '
                + 'Some networks block direct connections; try another network.');
        } else if (state === 'disconnected' || state === 'closed') {
            show('problem', 'The host has stopped sharing.');
        }
    });
}

main().catch(error => {
    Logger.error('[Watch] Fatal:', error);
    show('problem', 'Something went wrong joining this watch party.');
});

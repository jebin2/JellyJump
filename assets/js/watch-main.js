import { WatchViewer } from './core/streaming/WatchParty.js';
import { describeConnection } from './core/streaming/ConnectionReport.js';
import { viewerView, WAITING_NOTE } from './core/streaming/ViewerView.js';
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
    // Whether a picture has ever arrived. Before it has, the host has probably
    // just not pasted the code yet, and nothing that happens to the connection
    // means what it would mean afterwards.
    let hasWatched = false;
    // Set once the party is genuinely over, so a connection that flickers back
    // to life after the host has gone does not resume a film nobody is sending.
    let over = false;
    const reveal = () => {
        hasWatched = true;
        show('watching');
        if (canFullscreen) fullButton.hidden = false;
    };
    const clearWaiting = () => { el('waiting').hidden = true; };
    video.addEventListener('loadedmetadata', clearWaiting);
    video.addEventListener('loadedmetadata', reveal, { once: true });
    video.addEventListener('resize', reveal, { once: true });

    // ── Fullscreen ──────────────────────────────────────────────────────────
    // The stage is what goes fullscreen rather than the video, so the button
    // stays reachable inside it. iOS Safari does not support requestFullscreen
    // on an arbitrary element and only offers it on the video itself, so that
    // is the fallback; if neither exists the button is never shown rather than
    // offered and broken.
    const stage = el('stage');
    const fullButton = el('full');
    const canFullscreen = !!(stage.requestFullscreen || stage.webkitRequestFullscreen
        || video.webkitEnterFullscreen);

    const toggleFullscreen = async () => {
        const current = document.fullscreenElement || document.webkitFullscreenElement;
        try {
            if (current) {
                await (document.exitFullscreen?.() ?? document.webkitExitFullscreen?.());
            } else if (stage.requestFullscreen) {
                await stage.requestFullscreen();
            } else if (stage.webkitRequestFullscreen) {
                await stage.webkitRequestFullscreen();
            } else if (video.webkitEnterFullscreen) {
                video.webkitEnterFullscreen();
            }
        } catch (error) {
            // A refusal is not worth interrupting the film for.
            Logger.warn('[Watch] Fullscreen refused:', error);
        }
    };

    if (canFullscreen) {
        // Wired now, shown later. Unhiding it here put a control on the page
        // while the viewer was still being asked to send their code back --
        // nothing to make fullscreen yet, and a button taking up space below
        // the collapsed picture. It appears in reveal(), with the picture.
        fullButton.addEventListener('click', toggleFullscreen);
        video.addEventListener('dblclick', toggleFullscreen);
        const syncLabel = () => {
            const on = !!(document.fullscreenElement || document.webkitFullscreenElement);
            fullButton.setAttribute('aria-label', on ? 'Exit fullscreen' : 'Fullscreen');
            fullButton.title = on ? 'Exit fullscreen (or double-click)' : 'Fullscreen (or double-click)';
        };
        document.addEventListener('fullscreenchange', syncLabel);
        document.addEventListener('webkitfullscreenchange', syncLabel);
    }

    // ── Why it is or is not working ─────────────────────────────────────────
    // A party that will not connect looks identical to a bug from here, and
    // the viewer is the only person who can see this page. So it says which
    // kinds of address each end had and which pair they settled on, in a line
    // that can be read back to the host.
    const routeLine = el('route');
    const reportRoute = async () => {
        const report = await describeConnection(viewer.connection);
        routeLine.textContent = report.text;
        routeLine.hidden = false;
        return report;
    };
    // While connecting it changes, so it is refreshed; once there is a route
    // or there is provably none, it stops.
    const routeTimer = setInterval(async () => {
        const report = await reportRoute();
        // Kept running while the code is still waiting to be pasted: the
        // connection can still come good once the host has it, and this line
        // is the only thing saying so.
        if (report.route && hasWatched) clearInterval(routeTimer);
    }, 2000);
    reportRoute();

    // The host telling us directly, which arrives at once. The state-based
    // detection below still stands for a host that vanishes without saying so
    // -- a closed laptop, a lost network -- but that takes seconds.
    viewer.onHostStopped = () => {
        Logger.log('[Watch] The host said goodbye');
        over = true;
        clearInterval(routeTimer);
        el('interrupted').hidden = true;
        show('problem', 'The host has stopped sharing.');
    };

    // What each state means for this page is decided in ViewerView, where the
    // cases can be read and tested; this only carries the decision out.
    const applyView = (view) => {
        over = view.over;
        el('interrupted').hidden = !view.interrupted;
        if (view.waiting) {
            el('waiting').textContent = WAITING_NOTE;
            el('waiting').hidden = false;
        }
        if (view.panel === 'watching') {
            el('waiting').hidden = true;
            show('watching');
        } else if (view.panel) {
            clearInterval(routeTimer);
            show(view.panel, view.detail);
        }
    };

    viewer.connection.addEventListener('connectionstatechange', async () => {
        const state = viewer.connection.connectionState;
        Logger.log(`[Watch] Connection ${state}`);
        const report = await reportRoute();
        Logger.log(`[Watch] ${report.text}`);
        applyView(viewerView({ state, hasWatched, over }));
    });
}

main().catch(error => {
    Logger.error('[Watch] Fatal:', error);
    show('problem', 'Something went wrong joining this watch party.');
});

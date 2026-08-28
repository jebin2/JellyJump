/**
 * The native <video> engine's decisions, against a stub DOM.
 *
 * What is being tested is not "does a video play" — that needs a real browser
 * and a real decoder. It is everything the browser is not responsible for: which
 * files are offered to it at all, that a file it turns out not to want falls
 * back to the decoder instead of stalling, that one element is reused across a
 * playlist rather than replaced, and that a mute taken to get playback started
 * is given back rather than becoming permanent.
 *
 * Reuse is the one that matters most and is the least visible. The point of this
 * engine is playback that survives the screen being off, and the video after the
 * one you started is the case where nobody is there to grant permission again.
 *
 * The real modules run against the stubs, so the assertions are about this
 * code's decisions rather than a reimplementation of them.
 */

import assert from 'node:assert/strict';

// ─── Stub DOM ────────────────────────────────────────────────────────────────

/** What canPlayType answers. A real browser says "probably" only with codecs. */
let canPlayTypeAnswer = (type) => (type.includes('codecs=') || type === 'audio/mpeg' ? 'probably' : 'maybe');

/** Per-test element behaviour, read at construction the way a real one would be. */
let videoConfig = { created: [], failLoad: false, stallLoad: false, refuseUnmutedPlay: false };

function makeElement(tag) {
    const element = {
        tagName: tag.toUpperCase(),
        children: [],
        parentElement: null,
        attributes: {},
        style: { cssText: '', display: '', visibility: '', width: '', height: '' },
        className: '',
        listeners: {},
        setAttribute(name, value) { this.attributes[name] = value; },
        removeAttribute(name) { delete this.attributes[name]; },
        getAttribute(name) { return this.attributes[name] ?? null; },
        addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); },
        removeEventListener(name, fn) {
            this.listeners[name] = (this.listeners[name] || []).filter(f => f !== fn);
        },
        dispatch(name) { for (const fn of [...(this.listeners[name] || [])]) fn({ type: name }); },
        appendChild(child) { this.children.push(child); child.parentElement = this; return child; },
        remove() {
            this.parentElement?.children.splice(this.parentElement.children.indexOf(this), 1);
            this.parentElement = null;
        },
        canPlayType(type) { return canPlayTypeAnswer(type); },
    };
    if (tag === 'video') makeVideo(element);
    return element;
}

/** A <video> that behaves the way the engine expects one to. */
function makeVideo(el) {
    const config = videoConfig;
    el.config = config;
    el.duration = NaN;
    el.currentTime = 0;
    el.videoWidth = 0;
    el.videoHeight = 0;
    el.muted = false;
    el.volume = 1;
    el.playbackRate = 1;
    el.paused = true;
    el.ended = false;
    el.error = null;
    el.src = '';
    el.loadCalls = 0;
    el.playCalls = 0;
    // A real element's src attribute and property are the same thing. Left
    // apart, an assertion that the source was released passes without the
    // release ever happening.
    const removeAttribute = el.removeAttribute.bind(el);
    el.removeAttribute = (name) => {
        if (name === 'src') el.src = '';
        removeAttribute(name);
    };

    el.load = () => {
        el.loadCalls += 1;
        if (!el.src) return; // release, not a load
        if (config.stallLoad) return; // never answers, which is what a timeout is for
        setTimeout(() => {
            if (config.failLoad) {
                el.error = { code: 4 };
                el.dispatch('error');
                return;
            }
            el.duration = 120;
            el.videoWidth = 640;
            el.videoHeight = 360;
            el.dispatch('loadedmetadata');
        }, 0);
    };

    el.play = () => {
        el.playCalls += 1;
        // A browser refusing autoplay rejects, which is the honest signal a
        // media element gives and an embed does not.
        if (config.refuseUnmutedPlay && !el.muted) {
            const error = new Error('play() failed because the user did not interact first');
            error.name = 'NotAllowedError';
            return Promise.reject(error);
        }
        el.paused = false;
        setTimeout(() => el.dispatch('playing'), 0);
        return Promise.resolve();
    };

    // Assigning currentTime does not finish a seek; the element decodes first
    // and then says so. The stub separates the two so code that paints too
    // early is caught here.
    Object.defineProperty(el, 'currentTime', {
        get() { return el._currentTime ?? 0; },
        set(value) {
            el._currentTime = value;
            setTimeout(() => el.dispatch('seeked'), 0);
        },
        configurable: true,
    });

    el.pause = () => {
        el.paused = true;
        el.dispatch('pause');
    };

    /** Reaching the end of the file, which is not the user pausing. */
    el.finish = () => {
        el.ended = true;
        el.paused = true;
        el.dispatch('ended');
    };

    config.created.push(el);
}

function installDom({ userAgent = 'Mozilla/5.0 (Macintosh)' } = {}) {
    global.document = { createElement: makeElement, querySelector: () => null };
    // Node defines navigator as a getter-only global, so it is redefined
    // rather than assigned. mediaSession is present so the lock-screen wiring
    // is exercised rather than skipped.
    Object.defineProperty(global, 'navigator', {
        value: { userAgent, mediaSession: makeMediaSession() },
        configurable: true, writable: true,
    });
    global.window = { document: global.document, MediaMetadata: class { constructor(m) { Object.assign(this, m); } } };
    global.requestAnimationFrame = () => 0;
    global.cancelAnimationFrame = () => { };
}

function makeMediaSession() {
    return {
        metadata: null,
        playbackState: 'none',
        handlers: {},
        setActionHandler(action, fn) { this.handlers[action] = fn; },
    };
}

function installVideo({ failLoad = false, stallLoad = false, refuseUnmutedPlay = false } = {}) {
    videoConfig = { created: [], failLoad, stallLoad, refuseUnmutedPlay };
    return videoConfig.created;
}

// ─── Stub player ─────────────────────────────────────────────────────────────

function makePlayer(modules) {
    const mount = makeElement('div');
    const canvas = makeElement('canvas');
    canvas.width = 0;
    canvas.height = 0;
    mount.appendChild(canvas);

    const player = {
        canvas,
        ctx: { drawImage() { } },
        engine: 'mediabunny',
        native: null,
        playbackRate: 1,
        loopMode: 'off',
        loopStart: null,
        loopEnd: null,
        isPlaying: false,
        duration: 0,
        currentTime: 0,
        frameRate: 24,
        completed: 0,
        config: { muted: false, volume: 1, controls: { playOverlay: true } },
        ui: { controls: makeElement('div'), playOverlay: makeElement('div') },
        _wasMutedForAutoplay: false,
        _setLoading() { },
        _updateVolumeUI() { },
        _updateProgress() { },
        _updatePlayPauseUI() { },
        _completeMedia() { player.completed += 1; },
        trigger() { },
        // The real player funnels every volume change to whichever engine is
        // playing; a no-op here would mean an unmute never reached the element
        // and the test would be grading itself.
        _syncAudioGain() { modules.syncNativeAudio(player); },
        _restoreAutoplayAudio(label) { return modules.restorePlayerAutoplayAudio(player, label); },
    };
    return player;
}

async function loadModules() {
    return {
        ...(await import('../assets/js/core/native/NativePlayback.js')),
        ...(await import('../assets/js/core/native/NativeEngine.js')),
        ...(await import('../assets/js/core/audio/AudioEngine.js')),
    };
}

const wait = (ms = 5) => new Promise(resolve => setTimeout(resolve, ms));

// ─── Tests ───────────────────────────────────────────────────────────────────

const results = [];
function check(name, fn) { results.push({ name, fn }); }

check('only files the browser is confident about are offered to it', async () => {
    installDom();
    installVideo();
    const { canPlayNatively } = await loadModules();

    assert.equal(canPlayNatively('/movies/holiday.mp4'), true, 'an ordinary mp4 goes native');
    assert.equal(canPlayNatively('/movies/holiday.webm'), true, 'so does webm');
    assert.equal(canPlayNatively('/movies/holiday.mkv'), false, 'mkv belongs to the decoder');
    assert.equal(canPlayNatively('/live/stream.m3u8'), false, 'HLS belongs to the decoder');
    assert.equal(canPlayNatively(''), false);
    assert.equal(canPlayNatively(null), false);
});

check('a blob URL is judged on its recorded type, not its missing extension', async () => {
    installDom();
    installVideo();
    const { canPlayNatively } = await loadModules();

    // How most of the library arrives. Without the declared type every local
    // file would look unidentifiable and lose background playback.
    assert.equal(canPlayNatively('blob:https://app/abc', 'video/mp4'), true);
    assert.equal(canPlayNatively('blob:https://app/abc', 'video/x-matroska'), false);
    assert.equal(canPlayNatively('blob:https://app/abc'), false, 'nothing to go on means no');
});

check('a signed URL is judged on its path, not its query string', async () => {
    installDom();
    installVideo();
    const { canPlayNatively } = await loadModules();
    assert.equal(canPlayNatively('https://home.server/f/holiday.mp4?token=abc123&e=99'), true);
});

check('a bare container type is not treated as an answer', async () => {
    installDom();
    installVideo();
    const { nativeProbeFor } = await loadModules();
    // The probe must name codecs, or every browser answers "maybe" and the
    // strict check would reject every file there is.
    assert.match(nativeProbeFor('/a.mp4'), /codecs=/);
    assert.equal(nativeProbeFor('/a.mkv'), null);
});

check('a browser that only says "maybe" is not taken at its word', async () => {
    installDom();
    installVideo();
    const { canPlayNatively } = await loadModules();

    // "maybe" is what a browser says when it has not been given enough to
    // answer — treating it as yes means a visible stall before the fallback
    // runs, on a file the decoder was always going to play.
    canPlayTypeAnswer = () => 'maybe';
    assert.equal(canPlayNatively('/movies/holiday.mp4'), false);

    canPlayTypeAnswer = () => '';
    assert.equal(canPlayNatively('/movies/holiday.mp4'), false, 'and a flat no is a no');

    canPlayTypeAnswer = (type) => (type.includes('codecs=') || type === 'audio/mpeg' ? 'probably' : 'maybe');
    assert.equal(canPlayNatively('/movies/holiday.mp4'), true, 'a real yes still passes');
});

check('a second file reuses the same element rather than building a new one', async () => {
    installDom();
    const created = installVideo();
    const modules = await loadModules();
    const player = makePlayer(modules);

    assert.equal(await modules.loadPlayerNative(player, '/one.mp4', true), true);
    await wait();
    const mount = player.canvas.parentElement;
    const childrenAfterFirst = mount.children.length;

    modules.suspendPlayerNative(player);
    assert.equal(await modules.loadPlayerNative(player, '/two.mp4', true), true);
    await wait();

    assert.equal(created.length, 1, 'only one <video> should ever have been created');
    assert.equal(mount.children.length, childrenAfterFirst, 'no extra element was mounted');
    assert.equal(created[0].src, '/two.mp4', 'the same element was handed the next file');
    assert.equal(player.engine, 'native');
});

check('a file the browser will not take falls back, leaving nothing mounted', async () => {
    installDom();
    const created = installVideo({ failLoad: true });
    const modules = await loadModules();
    const player = makePlayer(modules);
    const mount = player.canvas.parentElement;
    const before = mount.children.length;

    let reportedToUser = null;
    player.currentVideoId = 'broken';
    player.onStreamError = (id, message) => { reportedToUser = message; };

    const loaded = await modules.loadPlayerNative(player, '/broken.mp4', true);
    await wait();

    assert.equal(loaded, false, 'the caller is told to use the decoder');
    assert.equal(reportedToUser, null,
        'and the user is told nothing — the decoder is about to play it fine');
    assert.equal(player.native, null, 'no element is left behind');
    assert.equal(player.engine, 'mediabunny', 'the player is back on the decode path');
    assert.equal(mount.children.length, before, 'nothing was left in the DOM');
    assert.equal(created[0].parentElement, null);
});

check('a file that never answers is given up on rather than stalling forever', async () => {
    installDom();
    installVideo({ stallLoad: true });
    const { NativeEngine } = await loadModules();
    const mount = makeElement('div');

    const engine = new NativeEngine({ mount, metadataTimeoutMs: 20 });
    await assert.rejects(engine.load({ url: '/silent.mp4' }), /did not start reading/);
    engine.destroy();
});

check('autoplay refused with sound is retried muted rather than not played', async () => {
    installDom();
    const created = installVideo({ refuseUnmutedPlay: true });
    const modules = await loadModules();
    const player = makePlayer(modules);

    assert.equal(await modules.loadPlayerNative(player, '/one.mp4', true), true);
    await wait();

    assert.equal(created[0].playCalls, 2, 'asked again after the refusal');
    assert.equal(player.isPlaying, true, 'it is playing');
    assert.equal(player._wasMutedForAutoplay, false,
        'and the mute was handed back once playing, not left on');
    assert.equal(created[0].muted, false, 'the element itself has sound again');
});

check('a mute the user chose is never handed back', async () => {
    installDom();
    const created = installVideo();
    const modules = await loadModules();
    const player = makePlayer(modules);
    player.config.muted = true;

    await modules.loadPlayerNative(player, '/one.mp4', true);
    await wait();

    assert.equal(created[0].muted, true, 'their choice stands');
    assert.equal(player.config.muted, true);
});

check('reaching the end completes the item, so the playlist advances', async () => {
    installDom();
    const created = installVideo();
    const modules = await loadModules();
    const player = makePlayer(modules);

    await modules.loadPlayerNative(player, '/one.mp4', true);
    await wait();
    created[0].finish();

    assert.equal(player.completed, 1, 'the item ended exactly once');
    assert.equal(player.isPlaying, false);
});

check('the pause fired as a file ends is not reported as the user pausing', async () => {
    installDom();
    const created = installVideo();
    const modules = await loadModules();
    const player = makePlayer(modules);
    let paused = 0;
    await modules.loadPlayerNative(player, '/one.mp4', true);
    await wait();
    // Real elements fire pause on their way to ended. Counting that as a user
    // pause leaves the button showing "play" before the playlist moves on.
    created[0].ended = true;
    created[0].pause();
    assert.equal(player.completed, 0, 'nothing completed on a pause alone');
});

check('suspending keeps the element; tearing down releases it', async () => {
    installDom();
    const created = installVideo();
    const modules = await loadModules();
    const player = makePlayer(modules);

    await modules.loadPlayerNative(player, '/one.mp4', true);
    await wait();

    modules.suspendPlayerNative(player);
    assert.equal(created[0].parentElement !== null, true, 'still mounted for the next file');
    assert.equal(player.native !== null, true);
    assert.equal(player.engine, 'mediabunny', 'but out of the way');

    modules.teardownPlayerNative(player);
    assert.equal(player.native, null);
    assert.equal(created[0].parentElement, null, 'and gone from the DOM');
    assert.equal(created[0].src, '', 'with its source released, so the decoder is freed');
    assert.equal(created[0].loadCalls > 1, true, 'and the element told to let go of it');
});

check('volume and mute reach the element, not a gain node it does not have', async () => {
    installDom();
    const created = installVideo();
    const modules = await loadModules();
    const player = makePlayer(modules);

    await modules.loadPlayerNative(player, '/one.mp4', false);
    await wait();

    player.config.volume = 0.25;
    modules.syncNativeAudio(player);
    assert.equal(created[0].volume, 0.25);

    player.config.muted = true;
    modules.syncNativeAudio(player);
    assert.equal(created[0].muted, true);
    assert.equal(created[0].getAttribute('muted'), '',
        'the attribute too — iOS reads it when deciding whether play() may start');
});

check('a start position survives being set before the file is understood', async () => {
    installDom();
    const created = installVideo();
    const modules = await loadModules();
    const player = makePlayer(modules);

    player.currentTime = 42;
    await modules.loadPlayerNative(player, '/one.mp4', false);
    await wait();

    assert.equal(created[0].currentTime, 42, 'resumed where it was left');
});

check('the lock screen is given something to show and something to do', async () => {
    installDom();
    installVideo();
    const modules = await loadModules();
    const player = makePlayer(modules);
    player.onNext = () => { };

    await modules.loadPlayerNative(player, '/movies/holiday.mp4', false, {});
    await wait();

    const session = navigator.mediaSession;
    assert.equal(session.metadata.title, 'holiday', 'named from the file when nothing better was passed');
    assert.equal(typeof session.handlers.play, 'function');
    assert.equal(typeof session.handlers.pause, 'function');
    assert.equal(typeof session.handlers.nexttrack, 'function', 'there is a next item');

    modules.teardownPlayerNative(player);
    assert.equal(session.metadata, null, 'and it is cleared when playback is over');
});

check('a next-track button is not offered when there is nowhere to go', async () => {
    installDom();
    installVideo();
    const modules = await loadModules();
    const player = makePlayer(modules);

    await modules.loadPlayerNative(player, '/one.mp4', false);
    await wait();

    assert.equal(navigator.mediaSession.handlers.nexttrack, null,
        'an enabled button that does nothing is worse than no button');
});

check('a paused scrub paints the frame it landed on, not the one before it', async () => {
    installDom();
    const created = installVideo();
    const modules = await loadModules();
    const player = makePlayer(modules);

    const painted = [];
    player.ctx = { drawImage() { painted.push(created[0].currentTime); } };

    await modules.loadPlayerNative(player, '/one.mp4', false);
    await wait();
    painted.length = 0;

    created[0].currentTime = 45;
    await wait();

    assert.deepEqual(painted, [45],
        'painted once, after the seek landed — painting on assignment would draw the old frame');
    assert.equal(player.currentTime, 45, 'and the UI followed the element');
});

check('driving the transport with no element loaded does not throw', async () => {
    installDom();
    installVideo();
    const modules = await loadModules();
    const player = makePlayer(modules);
    // Every one of these is reachable from the keyboard before anything is
    // loaded, and from the lock screen after a teardown.
    player.engine = 'native';
    player.native = null;
    modules.syncNativeAudio(player);
    modules.suspendPlayerNative(player);
    modules.teardownPlayerNative(player);
    modules.paintNativeFrame(player);
});

check('the canvas is sized to the file, so the painted frame is not stretched', async () => {
    installDom();
    installVideo();
    const modules = await loadModules();
    const player = makePlayer(modules);

    await modules.loadPlayerNative(player, '/one.mp4', false);
    await wait();

    assert.equal(player.canvas.width, 640);
    assert.equal(player.canvas.height, 360);
});

// ─── Runner ──────────────────────────────────────────────────────────────────

let failures = 0;
for (const { name, fn } of results) {
    try {
        await fn();
        console.log(`  ok  ${name}`);
    } catch (error) {
        failures += 1;
        console.log(`FAIL  ${name}`);
        console.log(`      ${error.message}`);
    }
}
console.log(`\n${results.length - failures}/${results.length} passed`);
process.exit(failures ? 1 : 0);

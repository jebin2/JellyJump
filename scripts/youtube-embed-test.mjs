/**
 * The YouTube embed's lifecycle across consecutive videos.
 *
 * The behaviour under test is not "does it play" — that needs YouTube's real
 * player, which will not run headless. It is the part that decides whether the
 * second video has sound: a browser grants user activation per frame, so an
 * embed that is replaced for every video starts from the most restricted state
 * every time. These tests pin the embed being reused, and pin the mute applied
 * for autoplay never turning into a permanent preference.
 *
 * The real modules run against a stub DOM and a stub YT API, so the assertions
 * are about this code's decisions rather than about a reimplementation of them.
 */

import assert from 'node:assert/strict';

// ─── Stub DOM ────────────────────────────────────────────────────────────────

function makeElement(tag) {
    const element = {
        tagName: tag.toUpperCase(),
        children: [],
        parentElement: null,
        attributes: {},
        style: { cssText: '', display: '', visibility: '' },
        className: '',
        setAttribute(name, value) { this.attributes[name] = value; },
        getAttribute(name) { return this.attributes[name] ?? null; },
        appendChild(child) {
            this.children.push(child);
            child.parentElement = this;
            return child;
        },
        remove() {
            this.parentElement?.children.splice(this.parentElement.children.indexOf(this), 1);
            this.parentElement = null;
        },
        get isConnected() { return !!this.parentElement; },
    };
    Object.defineProperty(element, 'src', { value: '', writable: true });
    return element;
}

function installDom({ userAgent = 'Mozilla/5.0 (Macintosh)' } = {}) {
    const head = makeElement('head');
    global.document = {
        head,
        createElement: makeElement,
        querySelector: () => null,
    };
    // Node defines navigator as a getter-only global, so it is redefined
    // rather than assigned.
    Object.defineProperty(global, 'navigator', {
        value: { userAgent }, configurable: true, writable: true,
    });
    global.location = { origin: 'https://jellyjump.test' };
    global.window = { document: global.document };
    global.requestAnimationFrame = () => 0;
    global.cancelAnimationFrame = () => { };
}

/**
 * A stub of YouTube's IFrame player.
 *
 * One class, reconfigured per test rather than redefined: the IFrame API is
 * loaded once per page and cached in a module-level promise — correct in a
 * browser — so every test shares whichever YT object the first one resolved.
 * Reading the config at construction time is what lets each test still choose
 * its own behaviour.
 *
 * `refuseUnmute` models a phone that ignores unMute() outright — the case that
 * cannot be told from success by looking at whether playback continued.
 */
let ytConfig = { created: [], refuseUnmute: false, pauseOnUnmute: false };

class StubPlayer {
    constructor(target, options) {
        this.config = ytConfig;
        this.target = target;
        this.events = options.events;
        this.muted = /[?&]mute=1/.test(target.src);
        this.state = 'idle';
        this.loads = [];
        this.unmuteAttempts = 0;
        this.destroyed = false;
        ytConfig.created.push(this);
        setTimeout(() => this.events.onReady?.(), 0);
    }
    loadVideoById(request) { this.loads.push({ ...request, autoplay: true }); this.play(); }
    cueVideoById(request) { this.loads.push({ ...request, autoplay: false }); }
    playVideo() { this.play(); }
    play() {
        this.state = 'playing';
        this.events.onStateChange?.({ data: 1 });
    }
    pauseVideo() {
        this.state = 'paused';
        this.events.onStateChange?.({ data: 2 });
    }
    seekTo() { }
    getCurrentTime() { return 0; }
    getDuration() { return 120; }
    setVolume() { }
    setPlaybackRate() { }
    mute() { this.muted = true; }
    unMute() {
        this.unmuteAttempts = (this.unmuteAttempts || 0) + 1;
        if (this.config.refuseUnmute) return;
        this.muted = false;
        if (this.config.pauseOnUnmute) this.pauseVideo();
    }
    isMuted() { return this.muted; }
    destroy() { this.destroyed = true; }
}

function installYT({ refuseUnmute = false, pauseOnUnmute = false } = {}) {
    ytConfig = { created: [], refuseUnmute, pauseOnUnmute };
    global.window.YT = { Player: StubPlayer };
    return ytConfig.created;
}

// ─── Stub player ─────────────────────────────────────────────────────────────

async function makePlayer({ restorePlayerAutoplayAudio, syncYouTubeAudio }) {
    const mount = makeElement('div');
    const canvas = makeElement('canvas');
    mount.appendChild(canvas);

    const player = {
        canvas,
        engine: 'mediabunny',
        youtube: null,
        playbackRate: 1,
        loopMode: 'off',
        isPlaying: false,
        duration: 0,
        currentTime: 0,
        config: { muted: false, volume: 1 },
        ui: { controls: makeElement('div'), playOverlay: makeElement('div') },
        _wasMutedForAutoplay: false,
        _setLoading() { },
        _updateVolumeUI() { },
        _updateProgress() { },
        _updatePlayPauseUI() { },
        _completeMedia() { },
        trigger() { },
        // The real player funnels volume changes to whichever engine is
        // playing; a no-op here would mean the unmute never reached the embed
        // and the test would be grading itself.
        _syncAudioGain() { syncYouTubeAudio(player); },
        _restoreAutoplayAudio(label) { return restorePlayerAutoplayAudio(player, label); },
    };
    return player;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

const results = [];
function check(name, fn) { results.push({ name, fn }); }

async function loadModules() {
    return {
        ...(await import('../assets/js/core/youtube/YouTubePlayback.js')),
        ...(await import('../assets/js/core/audio/AudioEngine.js')),
    };
}

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

check('a second video reuses the same embed rather than building a new one', async () => {
    installDom();
    const created = installYT();
    const modules = await loadModules();
    const { loadPlayerYouTube, suspendPlayerYouTube } = modules;
    const player = await makePlayer(modules);

    await loadPlayerYouTube(player, { id: 'first', start: 0 }, true);
    await wait(10);
    const mount = player.canvas.parentElement;
    const iframeAfterFirst = mount.children.length;

    suspendPlayerYouTube(player);
    await loadPlayerYouTube(player, { id: 'second', start: 30 }, true);
    await wait(10);

    assert.equal(created.length, 1, 'only one YT.Player should ever have been constructed');
    assert.equal(mount.children.length, iframeAfterFirst, 'no extra host was mounted');
    assert.deepEqual(created[0].loads, [{ videoId: 'second', startSeconds: 30, autoplay: true }]);
    assert.equal(created[0].destroyed, false, 'the embed survived the switch');
});

check('a non-autoplay switch cues the video instead of starting it', async () => {
    installDom();
    const created = installYT();
    const modules = await loadModules();
    const { loadPlayerYouTube, suspendPlayerYouTube } = modules;
    const player = await makePlayer(modules);

    await loadPlayerYouTube(player, { id: 'first', start: 0 }, true);
    await wait(10);
    suspendPlayerYouTube(player);
    await loadPlayerYouTube(player, { id: 'second', start: 0 }, false);
    await wait(10);

    assert.deepEqual(created[0].loads, [{ videoId: 'second', startSeconds: 0, autoplay: false }]);
});

check('tearing down destroys the embed, so a local file has no iframe over it', async () => {
    installDom();
    const created = installYT();
    const modules = await loadModules();
    const { loadPlayerYouTube, teardownPlayerYouTube } = modules;
    const player = await makePlayer(modules);

    await loadPlayerYouTube(player, { id: 'first', start: 0 }, true);
    await wait(10);
    const mount = player.canvas.parentElement;

    teardownPlayerYouTube(player);

    assert.equal(created[0].destroyed, true);
    assert.equal(player.youtube, null);
    assert.equal(player.engine, 'mediabunny');
    assert.equal(mount.children.filter(c => c.className === 'jellyjump-youtube').length, 0);
    assert.equal(player.canvas.style.visibility, '', 'the canvas is visible again');
    assert.equal(player.ui.controls.style.display, '', 'the control bar is back');
});

check('on a phone the first video mutes to get autoplay, then unmutes itself', async () => {
    installDom({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' });
    const created = installYT();
    const modules = await loadModules();
    const { loadPlayerYouTube } = modules;
    const player = await makePlayer(modules);

    await loadPlayerYouTube(player, { id: 'first', start: 0 }, true);
    assert.equal(player.config.muted, true, 'muted before the embed is built');
    await wait(600);

    assert.equal(created[0].muted, false, 'the embed ended up unmuted');
    assert.equal(player.config.muted, false);
    assert.equal(player._wasMutedForAutoplay, false, 'nothing is still owed');
});

check('on a phone the second video keeps the sound the first one earned', async () => {
    installDom({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' });
    const created = installYT();
    const modules = await loadModules();
    const { loadPlayerYouTube, suspendPlayerYouTube } = modules;
    const player = await makePlayer(modules);

    await loadPlayerYouTube(player, { id: 'first', start: 0 }, true);
    await wait(600);
    assert.equal(created[0].muted, false, 'the first video has sound');

    suspendPlayerYouTube(player);
    await loadPlayerYouTube(player, { id: 'second', start: 0 }, true);
    await wait(600);

    // The regression this exists for: the second video came up muted because
    // it went into a new iframe, which starts with no user activation and so
    // has to be muted to autoplay at all.
    assert.equal(created.length, 1, 'no second iframe to start over in');
    assert.equal(created[0].muted, false, 'and no re-mute');
    assert.equal(player.config.muted, false);
});

check('an embed that ignores unMute is detected, not reported as success', async () => {
    installDom({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' });
    const created = installYT({ refuseUnmute: true });
    const modules = await loadModules();
    const { loadPlayerYouTube } = modules;
    const player = await makePlayer(modules);

    await loadPlayerYouTube(player, { id: 'first', start: 0 }, true);
    await wait(600);

    assert.equal(created[0].state, 'playing', 'it kept playing');
    assert.equal(player.config.muted, true, 'the UI agrees it is muted');
    assert.equal(player._wasMutedForAutoplay, true, 'sound is still owed');
});

check('an embed that pauses rather than unmutes is put back to playing', async () => {
    installDom({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' });
    const created = installYT({ pauseOnUnmute: true });
    const modules = await loadModules();
    const { loadPlayerYouTube } = modules;
    const player = await makePlayer(modules);

    await loadPlayerYouTube(player, { id: 'first', start: 0 }, true);
    await wait(600);

    assert.equal(created[0].state, 'playing', 'playback was resumed');
    assert.equal(created[0].muted, true, 'muted and playing beats unmuted and stopped');
    assert.equal(player.config.muted, true);
    assert.equal(player._wasMutedForAutoplay, true, 'sound is still owed');
});

check('a refused unmute does not silence every later video', async () => {
    installDom({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' });
    const created = installYT({ refuseUnmute: true });
    const modules = await loadModules();
    const { loadPlayerYouTube, suspendPlayerYouTube } = modules;
    const player = await makePlayer(modules);

    await loadPlayerYouTube(player, { id: 'first', start: 0 }, true);
    await wait(600);
    assert.equal(player.config.muted, true, 'the first video is stuck muted');

    const attemptsAfterFirst = created[0].unmuteAttempts;
    assert.ok(attemptsAfterFirst > 0, 'the first video did try');

    suspendPlayerYouTube(player);
    await loadPlayerYouTube(player, { id: 'second', start: 0 }, true);
    await wait(600);

    // The mute came from this code, not from the user, so the next video tries
    // for sound again — otherwise one refusal is permanent.
    assert.ok(created[0].unmuteAttempts > attemptsAfterFirst, 'the next video tried again');
    assert.equal(player._wasMutedForAutoplay, true, 'and it is still owed');
});

check('a deliberate mute is left alone', async () => {
    installDom({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' });
    const created = installYT();
    const modules = await loadModules();
    const { loadPlayerYouTube } = modules;
    const player = await makePlayer(modules);
    player.config.muted = true; // the user muted it

    await loadPlayerYouTube(player, { id: 'first', start: 0 }, true);
    await wait(600);

    assert.equal(player._youtubeWantsSound, false, 'their choice is not overridden');
    assert.equal(created[0].muted, true);
    assert.equal(player.config.muted, true);
});

check('the embed is not reused after being moved to a different container', async () => {
    installDom();
    const created = installYT();
    const modules = await loadModules();
    const { loadPlayerYouTube, suspendPlayerYouTube } = modules;
    const player = await makePlayer(modules);

    await loadPlayerYouTube(player, { id: 'first', start: 0 }, true);
    await wait(10);

    // The player was re-parented (fullscreen, a re-render): the old host is no
    // longer in the container the next video would mount into.
    const newMount = makeElement('div');
    newMount.appendChild(player.canvas);

    suspendPlayerYouTube(player);
    await loadPlayerYouTube(player, { id: 'second', start: 0 }, true);
    await wait(10);

    assert.equal(created.length, 2, 'a fresh embed was built for the new container');
    assert.equal(created[0].loads.length, 0, 'the stale embed was not driven');
});

// ─── Run ─────────────────────────────────────────────────────────────────────

let failed = 0;
for (const { name, fn } of results) {
    try {
        await fn();
        console.log(`  ok  ${name}`);
    } catch (error) {
        failed++;
        console.log(`FAIL  ${name}`);
        console.log(`      ${error.message}`);
    }
}

console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);

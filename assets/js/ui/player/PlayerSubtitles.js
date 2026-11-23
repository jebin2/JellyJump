import { fetchWithPolicy } from '../../shared/net/fetchWithPolicy.js';
import { Logger } from '../../shared/utils/Logger.js';
import { MediaBunny, codecOf, ensureDecodersFor } from '../../shared/media/MediaBunny.js';
import { Toast } from '../../shared/utils/Toast.js';
import { SubtitleManager } from '../../core/subtitles/SubtitleManager.js';
import { labelAudioTracks } from './AudioTrackLabels.js';
import { html } from '../../shared/utils/html.js';

export class PlayerSubtitles {
    constructor(player) {
        this.player = player;

        // Owned here rather than on Player, which held all five of these for
        // this file to reach back and mutate. The parser is created only when
        // captions are enabled, exactly as before.
        this.manager = player.config.controls.captions ? new SubtitleManager() : null;
        this.enabled = false;
        this.tracks = [];
        this.activeTrackId = null;
        this.trackCounter = 0;
    }

    /**
     * Forget everything about the previous file. One call in place of the five
     * assignments the load path used to make into Player's fields.
     */
    reset() {
        this.tracks = [];
        this.trackCounter = 0;
        this.activeTrackId = null;
        this.enabled = false;
        if (this.manager) this.manager.cues = [];
    }

    /** Turn captions off without forgetting the tracks that were loaded. */
    disable() {
        this.enabled = false;
        this.player.announce?.tracks();
    }

    /** What the C key does. */
    toggle() {
        this.enabled = !this.enabled;
        this.player.announce?.tracks();
    }

    async loadSubtitle(url, name) {
        const p = this.player;
        if (!this.manager) {
            Logger.warn('Subtitle manager not initialized (captions disabled)');
            return;
        }
        try {
            Logger.log(`Loading subtitles: ${url}`);
            const response = await fetchWithPolicy(url);
            const content = await response.text();

            let vttContent = content;
            if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
                try {
                    const { parseTranscriptJSON, jsonToVTT } = await import('../../shared/media/SubtitleConverter.js');
                    const words = parseTranscriptJSON(content);
                    vttContent = jsonToVTT(words);
                    Logger.log('Converted JSON transcript to VTT format');
                } catch (jsonError) {
                    Logger.warn('Failed to parse as JSON transcript, treating as VTT:', jsonError);
                }
            }

            this.manager.parse(vttContent);

            this.trackCounter++;
            const trackId = `custom-${this.trackCounter}`;
            const trackName = name || `Custom ${this.trackCounter}`;

            this.tracks.push({
                id: trackId,
                name: trackName,
                cues: [...this.manager.cues]
            });

            this.activeTrackId = trackId;
            this.enabled = true;
            p.announce?.tracks();
            Logger.log(`Subtitles loaded successfully as "${trackName}"`);

            if (p.onSubtitleChange) p.onSubtitleChange(this.tracks);
        } catch (error) {
            Logger.error('Error loading subtitles:', error);
        }
    }

    async generateSubtitles(opts = {}) {
        const p = this.player;
        if (this._generating) return;
        if (!p.input) {
            Toast.show('Load a video first to generate subtitles.', 3000, true);
            return;
        }
        this._generating = true;
        this._setGenUI(true, 'Preparing…', 0);

        try {
            const { generateSubtitles } = await import('../../processing/subtitles/SubtitleGenerator.js');
            const vtt = await generateSubtitles(p, {
                language: opts.language,
                task: opts.task || 'transcribe',
                onProgress: ({ phase, progress, label, device }) => {
                    // Weight the phases so the bar advances monotonically:
                    // extract 0–15%, model download 15–35%, transcription 35–100%.
                    let overall;
                    if (phase === 'extract') overall = progress * 0.15;
                    else if (phase === 'model') overall = 0.15 + progress * 0.20;
                    else overall = 0.35 + progress * 0.65;
                    const suffix = device ? ` (${device})` : '';
                    this._setGenUI(true, label + suffix, overall);
                },
            });

            // loadSubtitle bumps the counter and assigns this same number.
            const name = `AI Generated ${this.trackCounter + 1}`;
            const blob = new Blob([vtt], { type: 'text/vtt' });
            const url = URL.createObjectURL(blob);
            try {
                await this.loadSubtitle(url, name);
            } finally {
                URL.revokeObjectURL(url);
            }
            Toast.show('Subtitles generated');
        } catch (error) {
            Logger.error('Subtitle generation failed:', error);
            Toast.show(`Subtitle generation failed: ${error.message}`, 4000, true);
        } finally {
            this._generating = false;
            this._setGenUI(false);
        }
    }

    _setGenUI(active, label = '', progress = 0) {
        const p = this.player;
        if (p.ui.genSubtitleBtn) p.ui.genSubtitleBtn.disabled = active;
        if (p.ui.genSubtitleProgress) {
            p.ui.genSubtitleProgress.style.display = active ? 'block' : 'none';
        }
        if (p.ui.genSubtitleBar) {
            p.ui.genSubtitleBar.style.width = `${Math.round(progress * 100)}%`;
        }
        if (p.ui.genSubtitleLabel) {
            p.ui.genSubtitleLabel.textContent = active
                ? `${label} ${Math.round(progress * 100)}%`
                : '';
        }
    }

    /**
     * Draw the captions menu. The UI calls this on trackschange
     * (PlayerUIListeners) and when the panel opens.
     */
    renderSubtitleMenu() {
        const p = this.player;
        if (!p.ui.subtitleOptions || !p.ui.ccBtn) return;

        const oldCustomOptions = p.ui.subtitleOptions.querySelectorAll('[data-track-id]');
        oldCustomOptions.forEach(item => item.remove());

        this.tracks.forEach(track => {
            const label = document.createElement('label');
            label.className = 'subtitle-radio-option';
            label.setAttribute('data-track-id', track.id);
            // Track names come from subtitle files and shared libraries.
            label.innerHTML = html`
                <input type="radio" name="subtitle-track" value="${track.id}">
                <span class="radio-label">${track.name}</span>
            `;
            p.ui.subtitleOptions.appendChild(label);
        });

        const offRadio = p.ui.subtitleOptions.querySelector('input[value="off"]');
        if (!this.enabled) {
            if (offRadio) offRadio.checked = true;
            p.ui.ccBtn.classList.remove('active');
        } else {
            const activeRadio = p.ui.subtitleOptions.querySelector(`input[value="${this.activeTrackId}"]`);
            if (activeRadio) activeRadio.checked = true;
            p.ui.ccBtn.classList.add('active');
        }
    }

    switchSubtitleTrack(trackId) {
        const track = this.tracks.find(t => t.id === trackId);
        if (!track) return;

        this.manager.cues = [...track.cues];
        this.activeTrackId = trackId;
        this.enabled = true;
        this.player.announce?.tracks();
        Logger.log(`Switched to subtitle track: ${track.name}`);
    }

    async switchAudioTrack(trackId) {
        const p = this.player;
        if (!p.input) return;

        const audioTracks = await p.input.getAudioTracks();
        const track = audioTracks.find(t => t.id === trackId);

        if (track) {
            p.media.audioTrack = track;
            p.media.audioSink = new MediaBunny.AudioBufferSink(p.media.audioTrack);

            if (p.isPlaying) {
                p.pause();
                const startTime = p.currentTime;
                Logger.log(`[Audio] Switching track while playing - restarting iterator at ${startTime.toFixed(2)}s`);
                p.play();
            }

            p.announce?.tracks();
            Logger.log(`Switched to audio track: ${track.id}`);
        }
    }

    /**
     * Draw the audio track menu, on trackschange (PlayerUIListeners). It
     * waits on the file, so a newer call can start before this one ends:
     * only the newest draws.
     */
    async renderAudioTrackMenu() {
        const p = this.player;
        if (!p.ui.audioMenu || !p.ui.audioContainer) return;
        const draw = this._audioMenuDraw = (this._audioMenuDraw ?? 0) + 1;
        const current = () => draw === this._audioMenuDraw;

        const allTracks = p.input ? await p.input.getAudioTracks() : [];
        if (!current()) return;
        // Only audio that can play with the picture on screen. In a file every
        // track pairs with every other, so this changes nothing; in an HLS
        // stream whose variants each carry their own audio, the other
        // variants' tracks belong to pictures that are not showing.
        const paired = p.videoTrack ? allTracks.filter(t => t.canBePairedWith(p.videoTrack)) : allTracks;
        const tracks = paired.length ? paired : allTracks;

        if (tracks.length <= 1) {
            p.ui.audioMenu.textContent = '';
            p.ui.audioContainer.style.display = 'none';
            return;
        }

        p.ui.audioContainer.style.display = 'block';
        const template = document.getElementById('player-menu-item-template');

        // Codecs the browser can't decode are still listed — hiding them makes
        // tracks silently vanish — but marked, so picking one isn't unexplained
        // silence. The on-demand decoders load first so DTS and TrueHD aren't
        // labelled unsupported here while the player happily plays them; today
        // playback has already registered them by the time this menu is built,
        // but that is an ordering accident and the promise is cached anyway.
        await ensureDecodersFor(tracks);
        const decodable = await Promise.all(tracks.map(t => t.canDecode().catch(() => false)));
        // getCodec(), not `.codec`, for the same reason canDecode() is awaited
        // above: these are the library's supported accessors, and the plain
        // getter throws when the codec is not resolved yet. That window could
        // not be reproduced here -- an HLS track reports its codec fine by the
        // time this menu is built, VOD or live -- so this is the right way to
        // ask rather than a fix for an observed failure.
        const codecs = await Promise.all(tracks.map(codecOf));
        // Name, language, purpose and channel layout, so two English tracks
        // no longer both read "eng".
        const labels = await labelAudioTracks(tracks);
        if (!current()) return;
        p.ui.audioMenu.textContent = '';

        tracks.forEach((track, index) => {
            const item = template.content.cloneNode(true).querySelector('.jellyjump-menu-item');
            const label = labels[index];
            item.textContent = decodable[index]
                ? label
                : `${label} — ${codecs[index] || 'unsupported'} (not supported)`;
            item.dataset.value = track.id;
            if (!decodable[index]) item.classList.add('disabled');
            if (p.audioTrack && p.audioTrack.id === track.id) item.classList.add('active');
            p.ui.audioMenu.appendChild(item);
        });
    }

    renderSubtitles(timestamp) {
        const p = this.player;
        if (!this.manager) return;

        const activeCues = this.manager.getActiveCues(timestamp);
        if (activeCues.length === 0) return;

        const fontSize = Math.max(22, p.canvas.height * 0.055);
        const lineHeight = fontSize * 1.35;
        const bottomMargin = p.canvas.height * 0.08;
        const x = p.canvas.width / 2;
        // Keep text inside the frame with a margin on each side so nothing is
        // clipped at the left/right edges.
        const maxWidth = p.canvas.width * 0.9;

        p.ctx.font = `bold ${fontSize}px "Segoe UI", Roboto, Arial, sans-serif`;
        p.ctx.textAlign = 'center';
        p.ctx.textBaseline = 'bottom';
        p.ctx.lineJoin = 'round';
        p.ctx.miterLimit = 2;

        // Split each cue on explicit newlines, then word-wrap to the frame width.
        const allLines = [];
        activeCues.forEach(cue => {
            cue.text.split('\n').forEach(line => {
                const trimmed = line.trim();
                if (trimmed) this._wrapLine(trimmed, maxWidth).forEach(l => allLines.push(l));
            });
        });

        if (allLines.length === 0) return;

        let y = p.canvas.height - bottomMargin;

        for (let i = allLines.length - 1; i >= 0; i--) {
            const line = allLines[i];
            p.ctx.strokeStyle = '#000000';
            p.ctx.lineWidth = fontSize * 0.15;
            p.ctx.strokeText(line, x, y);
            p.ctx.fillStyle = '#ffffff';
            p.ctx.fillText(line, x, y);
            y -= lineHeight;
        }
    }

    /**
     * Word-wrap a single line to fit within maxWidth using the ctx's current
     * font. Returns an array of lines. A single word wider than maxWidth is
     * broken across characters so it can never overflow the frame.
     */
    _wrapLine(text, maxWidth) {
        const ctx = this.player.ctx;
        const words = text.split(/\s+/);
        const lines = [];
        let current = '';

        const pushBrokenWord = (word) => {
            let piece = '';
            for (const ch of word) {
                if (piece && ctx.measureText(piece + ch).width > maxWidth) {
                    lines.push(piece);
                    piece = ch;
                } else {
                    piece += ch;
                }
            }
            return piece; // remaining fragment becomes the new current line
        };

        for (const word of words) {
            const candidate = current ? `${current} ${word}` : word;
            if (ctx.measureText(candidate).width <= maxWidth) {
                current = candidate;
                continue;
            }
            if (current) lines.push(current);
            // The word itself may still be too wide to stand alone.
            current = ctx.measureText(word).width > maxWidth ? pushBrokenWord(word) : word;
        }
        if (current) lines.push(current);
        return lines;
    }

    restoreSavedSubtitles(savedSubtitles) {
        this.tracks = savedSubtitles.map(track => ({
            id: track.id,
            name: track.name,
            cues: [...track.cues]
        }));
        this.trackCounter = savedSubtitles.reduce((max, track) => {
            const match = track.id.match(/custom-(\d+)/);
            return match ? Math.max(max, parseInt(match[1])) : max;
        }, 0);
        Logger.log(`Restored ${savedSubtitles.length} subtitle track(s) for video`);
    }
}

import { Logger } from '../../shared/utils/Logger.js';
import { MediaBunny } from '../../core/MediaBunny.js';
import { Toast } from '../../shared/utils/Toast.js';

export class PlayerSubtitles {
    constructor(player) {
        this.player = player;
    }

    async loadSubtitle(url, name) {
        const p = this.player;
        if (!p.subtitleManager) {
            Logger.warn('Subtitle manager not initialized (captions disabled)');
            return;
        }
        try {
            Logger.log(`Loading subtitles: ${url}`);
            const response = await fetch(url);
            const content = await response.text();

            let vttContent = content;
            if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
                try {
                    const { parseTranscriptJSON, jsonToVTT } = await import('../../core/subtitles/SubtitleConverter.js');
                    const words = parseTranscriptJSON(content);
                    vttContent = jsonToVTT(words);
                    Logger.log('Converted JSON transcript to VTT format');
                } catch (jsonError) {
                    Logger.warn('Failed to parse as JSON transcript, treating as VTT:', jsonError);
                }
            }

            p.subtitleManager.parse(vttContent);

            p.subtitleTrackCounter++;
            const trackId = `custom-${p.subtitleTrackCounter}`;
            const trackName = name || `Custom ${p.subtitleTrackCounter}`;

            p.subtitleTracks.push({
                id: trackId,
                name: trackName,
                cues: [...p.subtitleManager.cues]
            });

            p.activeSubtitleTrackId = trackId;
            p.isSubtitlesEnabled = true;
            this.updateSubtitleMenu();
            Logger.log(`Subtitles loaded successfully as "${trackName}"`);

            if (p.onSubtitleChange) p.onSubtitleChange(p.subtitleTracks);
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
            const name = `AI Generated ${p.subtitleTrackCounter + 1}`;
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

    updateSubtitleMenu() {
        const p = this.player;
        if (!p.ui.subtitleOptions || !p.ui.ccBtn) return;

        const oldCustomOptions = p.ui.subtitleOptions.querySelectorAll('[data-track-id]');
        oldCustomOptions.forEach(item => item.remove());

        p.subtitleTracks.forEach(track => {
            const label = document.createElement('label');
            label.className = 'subtitle-radio-option';
            label.setAttribute('data-track-id', track.id);
            label.innerHTML = `
                <input type="radio" name="subtitle-track" value="${track.id}">
                <span class="radio-label">${track.name}</span>
            `;
            p.ui.subtitleOptions.appendChild(label);
        });

        const offRadio = p.ui.subtitleOptions.querySelector('input[value="off"]');
        if (!p.isSubtitlesEnabled) {
            if (offRadio) offRadio.checked = true;
            p.ui.ccBtn.classList.remove('active');
        } else {
            const activeRadio = p.ui.subtitleOptions.querySelector(`input[value="${p.activeSubtitleTrackId}"]`);
            if (activeRadio) activeRadio.checked = true;
            p.ui.ccBtn.classList.add('active');
        }
    }

    switchSubtitleTrack(trackId) {
        const p = this.player;
        const track = p.subtitleTracks.find(t => t.id === trackId);
        if (!track) return;

        p.subtitleManager.cues = [...track.cues];
        p.activeSubtitleTrackId = trackId;
        p.isSubtitlesEnabled = true;
        this.updateSubtitleMenu();
        Logger.log(`Switched to subtitle track: ${track.name}`);
    }

    async switchAudioTrack(trackId) {
        const p = this.player;
        if (!p.input) return;

        const audioTracks = await p.input.getAudioTracks();
        const track = audioTracks.find(t => t.id === trackId);

        if (track) {
            p.audioTrack = track;
            p.audioSink = new MediaBunny.AudioBufferSink(p.audioTrack);

            if (p.isPlaying) {
                p.pause();
                const startTime = p._getPlaybackTime();
                Logger.log(`[Audio] Switching track while playing - restarting iterator at ${startTime.toFixed(2)}s`);
                p.play();
            }

            this.updateAudioTracks();
            Logger.log(`Switched to audio track: ${track.id}`);
        }
    }

    async updateAudioTracks() {
        const p = this.player;
        if (!p.ui.audioMenu || !p.ui.audioContainer) return;

        p.ui.audioMenu.textContent = '';
        const tracks = p.input ? await p.input.getAudioTracks() : [];

        if (tracks.length <= 1) {
            p.ui.audioContainer.style.display = 'none';
            return;
        }

        p.ui.audioContainer.style.display = 'block';
        const template = document.getElementById('player-menu-item-template');

        // Codecs the browser can't decode (DTS, TrueHD, …) are still listed —
        // hiding them makes tracks silently vanish — but marked, so picking one
        // isn't unexplained silence.
        const decodable = await Promise.all(tracks.map(t => t.canDecode().catch(() => false)));

        tracks.forEach((track, index) => {
            const item = template.content.cloneNode(true).querySelector('.jellyjump-menu-item');
            const label = track.languageCode || `Track ${index + 1}`;
            item.textContent = decodable[index]
                ? label
                : `${label} — ${track.codec || 'unsupported'} (not supported)`;
            item.dataset.value = track.id;
            if (!decodable[index]) item.classList.add('disabled');
            if (p.audioTrack && p.audioTrack.id === track.id) item.classList.add('active');
            p.ui.audioMenu.appendChild(item);
        });
    }

    renderSubtitles(timestamp) {
        const p = this.player;
        if (!p.subtitleManager) return;

        const activeCues = p.subtitleManager.getActiveCues(timestamp);
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
        const p = this.player;
        p.subtitleTracks = savedSubtitles.map(track => ({
            id: track.id,
            name: track.name,
            cues: [...track.cues]
        }));
        p.subtitleTrackCounter = savedSubtitles.reduce((max, track) => {
            const match = track.id.match(/custom-(\d+)/);
            return match ? Math.max(max, parseInt(match[1])) : max;
        }, 0);
        Logger.log(`Restored ${savedSubtitles.length} subtitle track(s) for video`);
    }
}

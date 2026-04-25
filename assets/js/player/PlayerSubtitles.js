import { Logger } from '../utils/Logger.js';
import { MediaBunny } from '../core/MediaBunny.js';

export class PlayerSubtitles {
    constructor(player) {
        this.player = player;
    }

    async loadSubtitle(url) {
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
                    const { parseTranscriptJSON, jsonToVTT } = await import('../core/subtitles/SubtitleConverter.js');
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
            const trackName = `Custom ${p.subtitleTrackCounter}`;

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
            p.audioSink = new MediaBunny.AudioSampleSink(p.audioTrack);

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

        tracks.forEach((track, index) => {
            const item = template.content.cloneNode(true).querySelector('.jellyjump-menu-item');
            item.textContent = track.languageCode || `Track ${index + 1}`;
            item.dataset.value = track.id;
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

        const allLines = [];
        activeCues.forEach(cue => {
            cue.text.split('\n').forEach(line => {
                if (line.trim()) allLines.push(line.trim());
            });
        });

        if (allLines.length === 0) return;

        let y = p.canvas.height - bottomMargin;

        p.ctx.font = `bold ${fontSize}px "Segoe UI", Roboto, Arial, sans-serif`;
        p.ctx.textAlign = 'center';
        p.ctx.textBaseline = 'bottom';
        p.ctx.lineJoin = 'round';
        p.ctx.miterLimit = 2;

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

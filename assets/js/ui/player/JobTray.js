import { JobQueue } from '../../shared/services/JobQueue.js';
import { Toast } from '../../shared/utils/Toast.js';
import { Logger } from '../../shared/utils/Logger.js';
import { MediaMetadata } from '../../shared/utils/MediaMetadata.js';
import { escapeHtml, html, trusted } from '../../shared/utils/html.js';

/**
 * JobTray - the job list at the foot of the sidebar.
 *
 * Shows each job the tools have handed to the JobQueue: a progress bar and
 * Cancel while it runs, and once it is done, Play, Edit and Download for
 * what it made. Hidden while there are no jobs.
 *
 * A toast says when one finishes as well, because the sidebar can be
 * collapsed, or scrolled out of sight on a phone, exactly when it does.
 */

const ICON = (name, size = 14) =>
    `<svg width="${size}" height="${size}" fill="currentColor" aria-hidden="true"><use href="assets/icons/sprite.svg#${name}"></use></svg>`;

export class JobTray {
    /**
     * @param {Object} playlist - Playlist instance; Play selects the result in it
     * @param {HTMLElement} host - Element the tray is appended to
     */
    constructor(playlist, host) {
        this.playlist = playlist;
        this.el = document.createElement('section');
        this.el.className = 'job-tray hidden';
        this.el.setAttribute('aria-label', 'Jobs');
        this.el.setAttribute('aria-live', 'polite');
        host.appendChild(this.el);

        /** @type {((item: Object) => void)|null} opens the edit panel on a result */
        this.onEdit = null;

        /** @type {Map<number, string>} status last seen per job, to notice a finish */
        this._seen = new Map();

        this.el.addEventListener('click', (e) => this._onClick(e));
        this._unsubscribe = JobQueue.subscribe((jobs) => this._render(jobs));
        this._render(JobQueue.list());
    }

    _onClick(e) {
        const button = e.target.closest('[data-job-action]');
        if (!button) return;
        const id = Number(button.closest('[data-job-id]')?.dataset.jobId);
        const job = JobQueue.list().find(j => j.id === id);
        const action = button.dataset.jobAction;

        if (action === 'clear') { JobQueue.clearFinished(); return; }
        if (!job) return;
        if (action === 'cancel') {
            button.disabled = true;
            job.cancel();
        } else if (action === 'dismiss') {
            JobQueue.dismiss(id);
        } else if (action === 'play') {
            this._play(job.results[Number(button.dataset.result) || 0]);
        } else if (action === 'download') {
            const result = job.results[Number(button.dataset.result) || 0];
            if (!result) return;
            e.preventDefault();
            // Out of the playlist (an edit undone, say), its file is gone.
            if (!this.playlist.items.includes(result.item)) {
                Toast.show('That file was removed from the playlist, so it can no longer be downloaded.', 3500, true);
                return;
            }
            this._download(result);
        } else if (action === 'edit') {
            const result = job.results[Number(button.dataset.result) || 0];
            if (result && this._inPlaylist(result)) this.onEdit?.(result.item);
        }
    }

    /**
     * Download a result from its file as it is now. The link made when the
     * job finished does not last: the playlist revokes an item's blob URL
     * when the player moves off it, and an item Undo put back has a new one.
     */
    async _download(result) {
        try {
            const file = await MediaMetadata.getSourceBlob(result.item, () => this.playlist._saveState());
            const url = URL.createObjectURL(file);
            const a = document.createElement('a');
            a.href = url;
            a.download = result.item.title || result.filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch (err) {
            Logger.warn('Job tray download failed:', err);
            Toast.show('That file could not be read, so it was not downloaded.', 3500, true);
        }
    }

    _inPlaylist(result) {
        if (this.playlist.items.includes(result.item)) return true;
        Toast.show('That file is no longer in the playlist.', 3000, true);
        return false;
    }

    _play(result) {
        if (!result || !this._inPlaylist(result)) return;
        this.playlist.selectItem(this.playlist.items.indexOf(result.item));
    }

    _render(jobs) {
        this._announce(jobs);
        this.el.classList.toggle('hidden', jobs.length === 0);
        if (!jobs.length) { this.el.innerHTML = ''; this._shape = ''; return; }

        // Progress ticks only move a bar and a number. Rebuilding the rows
        // for each one replaced the Cancel button under the pointer, so a
        // click that started on one button ended on another and was lost.
        const shape = jobs.map(j => `${j.id}:${j.status}:${j.results.length}`).join('|');
        if (shape === this._shape) {
            for (const job of jobs) this._updateProgress(job);
            return;
        }
        this._shape = shape;

        const active = jobs.filter(j => j.status === 'queued' || j.status === 'running').length;
        const finished = jobs.length - active;

        // Each row escapes its own values (_row), so the rows go in as markup.
        this.el.innerHTML = String(html`
            <header class="job-tray-header">
                <span class="job-tray-title">Jobs${active ? html` <span class="job-tray-count">${active} running</span>` : ''}</span>
                ${finished ? html`<button class="job-tray-clear" data-job-action="clear">Clear finished</button>` : ''}
            </header>
            <ul class="job-tray-list">
                ${jobs.slice().reverse().map(job => trusted(this._row(job)))}
            </ul>
        `);
    }

    _statusText(job) {
        if (job.status === 'queued') return 'Waiting…';
        return `${job.label || 'Working…'} ${Math.round(job.progress * 100)}%`;
    }

    _updateProgress(job) {
        if (job.status !== 'running') return;
        const row = this.el.querySelector(`[data-job-id="${job.id}"]`);
        if (!row) return;
        const pct = Math.round(job.progress * 100);
        const bar = row.querySelector('.job-progress-bar');
        if (bar) bar.style.width = `${pct}%`;
        row.querySelector('.job-progress')?.setAttribute('aria-valuenow', String(pct));
        const status = row.querySelector('.job-status');
        if (status) status.textContent = this._statusText(job);
    }

    _row(job) {
        const title = `<span class="job-name">${escapeHtml(job.name)}</span>
            <span class="job-subject" title="${escapeHtml(job.subject)}">${escapeHtml(job.subject)}</span>`;
        const dismiss = `<button class="job-icon-btn" data-job-action="dismiss" title="Remove from list" aria-label="Remove from list">${ICON('icon-close', 12)}</button>`;

        let body = '';
        if (job.status === 'running' || job.status === 'queued') {
            const pct = Math.round(job.progress * 100);
            const status = escapeHtml(this._statusText(job));
            body = `
                <div class="job-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}">
                    <div class="job-progress-bar" style="width:${pct}%"></div>
                </div>
                <div class="job-row-foot">
                    <span class="job-status">${status}</span>
                    <button class="job-text-btn" data-job-action="cancel">Cancel</button>
                </div>`;
        } else if (job.status === 'done') {
            body = job.results.length
                ? job.results.map((r, i) => `
                    <div class="job-row-foot">
                        <span class="job-status job-status-done" title="${escapeHtml(r.filename)}">${ICON('icon-check', 12)} ${escapeHtml(r.filename)}</span>
                        <span class="job-actions">
                            <button class="job-text-btn job-play" data-job-action="play" data-result="${i}">${ICON('icon-play', 12)} Play</button>
                            ${this.onEdit ? `<button class="job-text-btn" data-job-action="edit" data-result="${i}" title="Edit this result">${ICON('icon-edit', 12)} Edit</button>` : ''}
                            <a class="job-text-btn" data-job-action="download" data-result="${i}" href="${escapeHtml(r.url)}" download="${escapeHtml(r.filename)}">${ICON('icon-download', 12)} Download</a>
                        </span>
                    </div>`).join('')
                : `<div class="job-row-foot"><span class="job-status job-status-done">${ICON('icon-check', 12)} Done</span></div>`;
        } else if (job.status === 'failed') {
            body = `<div class="job-row-foot"><span class="job-status job-status-error">${escapeHtml(job.error)}</span></div>`;
        } else {
            body = `<div class="job-row-foot"><span class="job-status">Cancelled</span></div>`;
        }

        const finished = job.status !== 'running' && job.status !== 'queued';
        return `
            <li class="job-row job-row--${job.status}" data-job-id="${job.id}">
                <div class="job-row-head">${title}${finished ? dismiss : ''}</div>
                ${body}
            </li>`;
    }

    /** A toast for each job that has just finished, failed or not. */
    _announce(jobs) {
        for (const job of jobs) {
            const before = this._seen.get(job.id);
            this._seen.set(job.id, job.status);
            if (before === job.status || !before) continue;
            if (job.status === 'done') {
                const what = job.results[0]?.filename;
                Toast.show(what ? `${job.name} finished: ${what}` : `${job.name} finished`, 4000);
            } else if (job.status === 'failed') {
                Toast.show(job.error || `${job.name} failed.`, 5000, true);
            }
        }
        for (const id of this._seen.keys()) {
            if (!jobs.some(j => j.id === id)) this._seen.delete(id);
        }
    }

    destroy() {
        this._unsubscribe?.();
        this.el.remove();
    }
}

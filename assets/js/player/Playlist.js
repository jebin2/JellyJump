/**
 * Playlist Manager
 * Handles rendering and interaction for the video playlist.
 */
export class Playlist {
    /**
     * @param {HTMLElement} container - The container element for the playlist
     * @param {CorePlayer} player - The player instance
     */
    constructor(container, player) {
        this.container = container;
        this.player = player;
        this.items = [];
        this.activeIndex = -1;

        // Clear placeholder
        this.container.innerHTML = '';

        // Drag and Drop Events
        this._attachDragEvents();

        // Auto-play Next
        this.player.mediaElement.addEventListener('ended', () => {
            this.playNext();
        });
    }

    /**
     * Attach drag and drop listeners
     * @private
     */
    _attachDragEvents() {
        const section = this.container.closest('.playlist-section');

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            section.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            section.addEventListener(eventName, () => {
                section.classList.add('drag-over');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            section.addEventListener(eventName, () => {
                section.classList.remove('drag-over');
            }, false);
        });

        section.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            this.handleFiles(files);
        }, false);
    }

    /**
     * Handle FileList from input or drop
     * @param {FileList} files 
     */
    handleFiles(files) {
        const videoFiles = Array.from(files).filter(file => file.type.startsWith('video/'));

        if (videoFiles.length === 0) {
            alert('Please select valid video files.');
            return;
        }

        const newItems = videoFiles.map(file => ({
            title: file.name,
            url: URL.createObjectURL(file),
            duration: 'Local File', // We'd need to load metadata to get real duration
            thumbnail: '', // No thumbnail for local files yet
            isLocal: true
        }));

        this.addItems(newItems);

        // If playlist was empty, play the first new file
        if (this.items.length === newItems.length) {
            this.selectItem(0);
        }
    }

    /**
     * Add a video to the playlist
     * @param {Object} video - Video object { title, url, duration, thumbnail }
     */
    addItem(video) {
        this.items.push(video);
        this.render();
    }

    /**
     * Add multiple videos
     * @param {Array} videos 
     */
    addItems(videos) {
        this.items = [...this.items, ...videos];
        this.render();
    }

    /**
     * Remove a video from the playlist
     * @param {number} index 
     */
    removeItem(index) {
        if (index < 0 || index >= this.items.length) return;

        // If removing the currently playing item
        if (index === this.activeIndex) {
            // Try to play next, or stop if it was the last one
            if (this.items.length > 1) {
                if (index < this.items.length - 1) {
                    this.selectItem(index + 1);
                    this.activeIndex--; // Adjust because we're about to splice
                } else {
                    this.selectItem(index - 1);
                }
            } else {
                // List will be empty
                this.player.pause();
                this.player.mediaElement.src = '';
                this.activeIndex = -1;
            }
        } else if (index < this.activeIndex) {
            // If removing an item before current, adjust active index
            this.activeIndex--;
        }

        this.items.splice(index, 1);
        this.render();
    }

    /**
     * Clear the playlist
     */
    clear() {
        if (confirm('Are you sure you want to clear the playlist?')) {
            this.items = [];
            this.activeIndex = -1;
            this.player.pause();
            this.player.mediaElement.src = '';
            this.render();
        }
    }

    /**
     * Play the next video in the playlist
     */
    playNext() {
        if (this.activeIndex < this.items.length - 1) {
            this.selectItem(this.activeIndex + 1);
        } else {
            // Loop to start? Or stop? Let's stop for now.
            console.log('Playlist ended');
        }
    }

    /**
     * Select and play a video by index
     * @param {number} index 
     */
    selectItem(index) {
        if (index < 0 || index >= this.items.length) return;

        this.activeIndex = index;
        const video = this.items[index];

        // Load video into player
        this.player.load(video.url);

        // Update UI
        this._updateUI();

        // Auto play if not the first load (optional logic)
        this.player.play();
    }

    /**
     * Render the playlist
     */
    render() {
        this.container.innerHTML = '';

        if (this.items.length === 0) {
            this.container.innerHTML = `
                <div class="playlist-placeholder">
                    <p>No videos in playlist.</p>
                </div>`;
            return;
        }

        this.items.forEach((item, index) => {
            const itemHTML = this._createItemHTML(item, index);
            this.container.insertAdjacentHTML('beforeend', itemHTML);
        });

        // Attach event listeners
        const elements = this.container.querySelectorAll('.playlist-item');
        elements.forEach(el => {
            // Click to play
            el.addEventListener('click', (e) => {
                // Ignore if clicking remove button
                if (e.target.closest('.playlist-remove-btn')) return;

                const index = parseInt(el.dataset.index);
                this.selectItem(index);
            });

            // Remove button
            const removeBtn = el.querySelector('.playlist-remove-btn');
            if (removeBtn) {
                removeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const index = parseInt(el.dataset.index);
                    this.removeItem(index);
                });
            }
        });

        this._updateUI();
    }

    /**
     * Update active state in UI
     * @private
     */
    _updateUI() {
        const elements = this.container.querySelectorAll('.playlist-item');
        elements.forEach((el, index) => {
            if (index === this.activeIndex) {
                el.classList.add('active');
                el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                el.classList.remove('active');
            }
        });
    }

    /**
     * Create HTML for a playlist item
     * @private
     */
    _createItemHTML(item, index) {
        const thumbnail = item.thumbnail
            ? `<img src="${item.thumbnail}" alt="${item.title}">`
            : `<svg width="24" height="24" viewBox="0 0 24 24" fill="#666"><path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12zm-10-6l-4 4h8l-4-4z"/></svg>`;

        return `
            <div class="playlist-item" data-index="${index}">
                <div class="playlist-thumbnail">
                    ${thumbnail}
                </div>
                <div class="playlist-info">
                    <div class="playlist-title" title="${item.title}">${item.title}</div>
                    <div class="playlist-duration">${item.duration || '--:--'}</div>
                </div>
                <button class="playlist-remove-btn" title="Remove">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                </button>
            </div>
        `;
    }
}

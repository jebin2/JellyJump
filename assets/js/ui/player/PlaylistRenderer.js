import { Logger } from '../../shared/utils/Logger.js';

export class PlaylistRenderer {
    constructor(playlist) {
        this.playlist = playlist;
    }

    render() {
        const p = this.playlist;
        const sidebar = p.container.closest('.playlist-section');

        if (p.isLoading) {
            if (sidebar) sidebar.classList.add('hidden');
            return;
        } else {
            if (sidebar) sidebar.classList.remove('hidden');
        }

        if (p.items.length === 0) {
            p.container.innerHTML = '';
            const template = document.getElementById('playlist-empty-template');
            const clone = template.content.cloneNode(true);
            p.container.appendChild(clone);
            return;
        }

        const tree = this.buildTree(p.items);

        p.container.innerHTML = '';
        p.container.scrollTop = 0;
        p.container.style.overflowY = 'auto';
        // Not 'hidden': that silently clipped rows indented past the right edge.
        // Set inline rather than in CSS because the inline value wins, so the
        // stylesheet alone could not fix it.
        // Note this only helps content that reaches this element — each
        // .playlist-children level is its own scroll container and clips first,
        // so very deep trees still need the depth cap to stay reachable.
        p.container.style.overflowX = 'auto';

        if (p.searchQuery) {
            this.renderSearchResults(p.searchQuery);
        } else {
            this.setupInfiniteScroll(p.container, tree);
        }

        this.updateUI();
    }

    /**
     * Update a still-downloading library's count without rebuilding anything.
     *
     * This is what a render per batch used to do, and the reason it was worth
     * removing: render() drops the DOM and the scroll position with it, so the
     * list could not be used while a library loaded.
     * @param {string} source - the share link the library came from
     * @param {number} count - items received so far
     */
    updateRemoteLibraryProgress(source, count) {
        const p = this.playlist;
        const wrapper = p.container?.querySelector(
            `.playlist-folder[data-remote-source="${CSS.escape(source)}"]`
        );
        const countSpan = wrapper?.querySelector('.folder-count');
        if (countSpan) countSpan.textContent = `(${count})`;
    }

    renderSearchResults(query) {
        const p = this.playlist;
        const filtered = p.items
            .map((item, index) => ({ ...item, originalIndex: index }))
            .filter(item => item.title.toLowerCase().includes(query));

        if (filtered.length === 0) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'playlist-placeholder';
            emptyDiv.textContent = 'No matches found';
            p.container.appendChild(emptyDiv);
            return;
        }

        const resultsNode = { allContent: filtered.map(item => ({ type: 'item', data: item })) };
        this.setupInfiniteScroll(p.container, resultsNode);
    }

    /**
     * Render a node's contents in batches, loading more as the end comes into
     * view.
     *
     * Driven by a sentinel at the end rather than by a scroll event on the
     * container. Only the outer list actually scrolls: a folder drawer has
     * overflow-y set but no height cap, so it grows to fit its contents and
     * never fires a scroll event of its own. Keying off that event stranded
     * every folder at its first batch — a folder labelled (293) listed 50 rows
     * and no amount of scrolling produced the rest.
     *
     * An IntersectionObserver asks the question that actually matters — has the
     * end of the list become visible — and answers it correctly whichever
     * ancestor happens to be the scrolling one, since clipping by a scroll
     * container counts as not intersecting.
     */
    setupInfiniteScroll(container, node) {
        container.dataset.renderedCount = '0';

        const sentinel = document.createElement('div');
        // Zero-height would sit exactly on the boundary and read as visible in
        // some layouts before the user has scrolled anywhere near it.
        sentinel.style.height = '1px';
        sentinel.setAttribute('aria-hidden', 'true');
        container.appendChild(sentinel);

        // rootMargin pre-loads the next batch just before the end is reached,
        // so scrolling does not stop at a blank edge while a batch builds.
        const observer = new IntersectionObserver((entries) => {
            if (entries.some(e => e.isIntersecting)) this.renderBatch(container, node);
        }, { rootMargin: '200px' });

        // Held on the element so it is collected with it: render() replaces the
        // container's contents wholesale, and a module-level registry would keep
        // observers for detached nodes alive.
        container._batchSentinel = sentinel;
        container._batchObserver = observer;

        this.renderBatch(container, node);
        observer.observe(sentinel);
    }

    /** Stop watching for more: everything this container holds is on screen. */
    finishBatching(container) {
        container._batchObserver?.disconnect();
        container._batchSentinel?.remove();
        container._batchObserver = null;
        container._batchSentinel = null;
    }

    renderBatch(container, node) {
        if (!node.allContent) return;

        const BATCH_SIZE = 50;
        const currentCount = parseInt(container.dataset.renderedCount || '0');
        const total = node.allContent.length;

        // Nothing left, including an empty folder that never had anything: tidy
        // up rather than returning and leaving an observer watching a sentinel
        // that will never have a batch to pull in.
        if (currentCount >= total) return this.finishBatching(container);

        const nextBatch = node.allContent.slice(currentCount, currentCount + BATCH_SIZE);

        const fragment = document.createDocumentFragment();
        nextBatch.forEach(entry => {
            if (entry.type === 'folder') {
                fragment.appendChild(this.createFolderElement(entry.data));
            } else {
                fragment.appendChild(this.createPlaylistItemElement(entry.data));
            }
        });

        const sentinel = container._batchSentinel;
        if (sentinel?.parentNode === container) {
            container.insertBefore(fragment, sentinel);
        } else {
            container.appendChild(fragment);
        }

        const rendered = currentCount + nextBatch.length;
        container.dataset.renderedCount = rendered.toString();

        const observer = container._batchObserver;
        if (!observer || !sentinel) return;

        if (rendered >= total) {
            this.finishBatching(container);
        } else {
            // The sentinel may still be on screen — a batch that does not fill
            // the viewport leaves it visible, and an observer only reports
            // changes, so staying visible would report nothing. Re-observing
            // forces a fresh check and pulls the next batch in.
            observer.unobserve(sentinel);
            observer.observe(sentinel);
        }
    }

    buildTree(items) {
        const root = { name: 'root', children: {}, items: [] };

        items.forEach((item, index) => {
            const path = item.path || item.title || 'Unknown';
            const parts = path.split('/');

            if (parts.length === 1) {
                root.items.push({ ...item, originalIndex: index });
                return;
            }

            let current = root;
            for (let i = 0; i < parts.length - 1; i++) {
                const folderName = parts[i];
                if (!current.children[folderName]) {
                    current.children[folderName] = {
                        name: folderName,
                        path: parts.slice(0, i + 1).join('/'),
                        children: {},
                        items: []
                    };
                }
                current = current.children[folderName];
            }
            current.items.push({ ...item, originalIndex: index });
        });

        this.tagCommonSource(root, 'm3uSource');
        this.tagCommonSource(root, 'remoteSource');

        const finalizeNode = (node) => {
            const childrenFolders = Object.values(node.children)
                .sort((a, b) => a.name.localeCompare(b.name));

            childrenFolders.forEach(finalizeNode);

            const folderEntries = childrenFolders.map(f => ({ type: 'folder', data: f }));
            const itemEntries = node.items.map(i => ({ type: 'item', data: i }));

            node.allContent = [...folderEntries, ...itemEntries];
        };

        finalizeNode(root);
        return root;
    }

    /**
     * Tag a folder with a source when every item beneath it shares one, so the
     * folder can offer an action for that source. Used for M3U playlists and
     * for shared libraries, which need the same question answered.
     * @param {Object} node
     * @param {string} field - item property holding the source
     */
    tagCommonSource(node, field) {
        let commonSource = undefined;

        for (const item of node.items) {
            if (!item[field]) {
                commonSource = null;
                break;
            }
            if (commonSource === undefined) {
                commonSource = item[field];
            } else if (commonSource !== item[field]) {
                commonSource = null;
                break;
            }
        }

        if (commonSource !== null) {
            for (const child of Object.values(node.children)) {
                const childSource = this.tagCommonSource(child, field);
                if (childSource === null) {
                    commonSource = null;
                } else {
                    if (commonSource === undefined) {
                        commonSource = childSource;
                    } else if (commonSource !== childSource) {
                        commonSource = null;
                    }
                }
            }
        } else {
            for (const child of Object.values(node.children)) {
                this.tagCommonSource(child, field);
            }
        }

        if (commonSource && commonSource !== undefined) {
            node[field] = commonSource;
        }

        return commonSource === undefined ? null : commonSource;
    }

    /**
     * Show scan progress on the Discovered folder header: a status label while
     * a scan is running, plus a cancel button, and a note if it ended early or
     * failed. Nothing here changes what is listed — only what the user is told.
     */
    decorateScanStatus(folderData, header, folderName, removeBtn) {
        const p = this.playlist;
        const state = p.scanState;

        const status = document.createElement('span');
        status.className = 'folder-scan-status';
        if (state.scanning) {
            // Naming the pass explains why results keep arriving after the
            // obvious folders are done, and why the second one takes longer.
            status.textContent = state.phase === 3 ? 'scanning home folder…'
                : state.phase === 2 ? 'scanning drives…'
                : 'scanning media folders…';
            status.classList.add('scanning');
        } else if (state.failed) {
            status.textContent = 'scan failed';
            status.classList.add('failed');
        } else if (state.cancelled) {
            status.textContent = 'stopped';
        } else {
            return; // finished cleanly: the plain count says everything
        }
        folderName.appendChild(status);

        if (!state.scanning) return;

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'playlist-action-btn folder-scan-cancel-btn';
        cancelBtn.title = 'Stop scanning';
        cancelBtn.setAttribute('aria-label', 'Stop scanning for media');
        cancelBtn.innerHTML = '<svg width="14" height="14" fill="currentColor"><use href="assets/icons/sprite.svg#icon-close"></use></svg>';
        cancelBtn.onclick = (e) => {
            e.stopPropagation();
            p.cancelMediaScan();
        };
        header.insertBefore(cancelBtn, removeBtn);
    }

    createFolderElement(folderData) {
        const p = this.playlist;
        const template = document.getElementById('playlist-folder-header-template');
        const clone = template.content.cloneNode(true);
        const header = clone.querySelector('.playlist-folder-header');

        const toggle = header.querySelector('.playlist-toggle');
        const folderName = header.querySelector('.folder-name');
        const removeBtn = header.querySelector('.folder-remove-btn');

        if (folderData.m3uSource) {
            const syncBtn = document.createElement('button');
            syncBtn.className = 'playlist-action-btn folder-sync-btn';
            syncBtn.title = 'Sync M3U Playlist';
            syncBtn.innerHTML = '<svg width="14" height="14" fill="currentColor"><use href="assets/icons/sprite.svg#icon-loop"></use></svg>';
            syncBtn.onclick = (e) => {
                e.stopPropagation();
                p._syncM3UPlaylist(folderData.path, folderData.m3uSource);
            };
            header.insertBefore(syncBtn, removeBtn);

            const validateBtn = document.createElement('button');
            validateBtn.className = 'playlist-action-btn folder-validate-btn';
            validateBtn.title = 'Validate Streams';
            validateBtn.innerHTML = '<svg width="14" height="14" fill="currentColor"><use href="assets/icons/sprite.svg#icon-search"></use></svg>';
            validateBtn.onclick = (e) => {
                e.stopPropagation();
                p._validateStreams(folderData.path, folderData.m3uSource);
            };
            header.insertBefore(validateBtn, removeBtn);
            removeBtn.style.marginLeft = '5px';
        }

        // Only on the library's own folder. Nested folders share the source, so
        // they would all get one, and reloading the whole library from inside a
        // subfolder reads as reloading just that subfolder.
        const isLibraryRoot = folderData.remoteSource && !folderData.path.includes('/');
        // Its listing is still downloading. The row is a progress indicator for
        // now, not something to open: the drawer would fill under the user's
        // hands, and the render that ends the download would reset it anyway.
        const isLoadingLibrary = !!isLibraryRoot
            && !!p.state.loadingRemoteSources?.has(folderData.remoteSource);
        if (isLibraryRoot) {
            // The link is otherwise unrecoverable from here: it went into
            // localStorage when the library was added and nothing shows it
            // again, so getting it back meant walking over to the machine that
            // shared it.
            const infoBtn = document.createElement('button');
            infoBtn.className = 'playlist-action-btn folder-info-btn';
            infoBtn.title = 'Library details and share link';
            infoBtn.setAttribute('aria-label', `Details for ${folderData.name}`);
            infoBtn.innerHTML = '<svg width="14" height="14" fill="currentColor"><use href="assets/icons/sprite.svg#icon-info"></use></svg>';
            infoBtn.onclick = (e) => {
                e.stopPropagation();
                p.showRemoteLibraryInfo(folderData.remoteSource);
            };
            // Two icons side by side otherwise touch: the action buttons carry
            // no styling of their own, which is why the M3U branch below spaces
            // its pair the same way.
            infoBtn.style.marginRight = '5px';
            header.insertBefore(infoBtn, removeBtn);

            const refreshBtn = document.createElement('button');
            refreshBtn.className = 'playlist-action-btn folder-refresh-btn';
            refreshBtn.title = 'Reload this library';
            refreshBtn.setAttribute('aria-label', `Reload ${folderData.name}`);
            refreshBtn.innerHTML = '<svg width="14" height="14" fill="currentColor"><use href="assets/icons/sprite.svg#icon-loop"></use></svg>';
            refreshBtn.onclick = (e) => {
                e.stopPropagation();
                refreshBtn.classList.add('spinning');
                p.refreshRemoteLibrary(folderData.remoteSource)
                    .finally(() => refreshBtn.classList.remove('spinning'));
            };
            header.insertBefore(refreshBtn, removeBtn);
        }

        const isExpanded = p.expandedFolders.has(folderData.path);
        if (isLoadingLibrary) {
            // Replaced rather than disabled: an arrow that does nothing when
            // clicked is worse than no arrow.
            toggle.classList.add('loading');
        } else if (isExpanded) {
            toggle.classList.add('expanded');
        }

        const count = folderData.totalCount !== undefined ? folderData.totalCount : (folderData.allContent ? folderData.allContent.length : 0);

        folderName.innerHTML = '';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = folderData.name;
        nameSpan.style.overflow = 'hidden';
        nameSpan.style.textOverflow = 'ellipsis';
        nameSpan.style.whiteSpace = 'nowrap';
        folderName.style.display = 'flex';
        folderName.style.flex = '1';
        folderName.style.minWidth = '0';
        folderName.style.alignItems = 'center';
        folderName.appendChild(nameSpan);

        if (count > 0 || isLoadingLibrary) {
            const countSpan = document.createElement('span');
            countSpan.className = 'folder-count';
            countSpan.textContent = `(${count})`;
            countSpan.style.opacity = '0.7';
            countSpan.style.fontSize = '0.9em';
            countSpan.style.marginLeft = '6px';
            countSpan.style.whiteSpace = 'nowrap';
            countSpan.style.flexShrink = '0';
            folderName.appendChild(countSpan);
        }

        if (isLoadingLibrary) {
            // Deliberately not the pulsing .scanning treatment used for a disk
            // scan: the spinner on the toggle is already the moving part, and
            // two things animating beside a climbing count reads as noise.
            const status = document.createElement('span');
            status.className = 'folder-scan-status';
            status.textContent = 'loading…';
            folderName.appendChild(status);
        }

        // The scan runs in another process and streams results in, so without
        // this the Discovered folder just silently grows and there is no way to
        // tell a scan from a finished one.
        if (folderData.path === p.discoveredFolderName && p.scanState) {
            this.decorateScanStatus(folderData, header, folderName, removeBtn);
        }

        const info = header.querySelector('.playlist-folder-info');
        info.style.flex = '1';
        info.style.display = 'flex';
        info.style.alignItems = 'center';
        info.style.minWidth = '0';
        info.style.gap = '8px';

        removeBtn.setAttribute('aria-label', `Remove folder ${folderData.name}`);

        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'playlist-children custom-scroll';
        if (!isExpanded) {
            childrenContainer.classList.add('hidden');
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'playlist-folder';
        wrapper.dataset.path = folderData.path;
        if (isLibraryRoot) wrapper.dataset.remoteSource = folderData.remoteSource;
        wrapper.appendChild(header);
        wrapper.appendChild(childrenContainer);

        const toggleDrawer = () => {
            const hidden = childrenContainer.classList.contains('hidden');
            if (hidden) {
                childrenContainer.classList.remove('hidden');
                toggle.classList.add('expanded');
                p.expandedFolders.add(folderData.path);

                if (!childrenContainer.dataset.renderedCount) {
                    this.setupInfiniteScroll(childrenContainer, folderData);
                }
            } else {
                childrenContainer.classList.add('hidden');
                toggle.classList.remove('expanded');
                p.expandedFolders.delete(folderData.path);
            }
        };

        // Guarded rather than left unwired, so a later change here cannot
        // quietly reopen the drawer mid-download.
        header.onclick = (e) => {
            e.stopPropagation();
            if (!isLoadingLibrary) toggleDrawer();
        };

        info.onclick = (e) => {
            e.stopPropagation();
            if (!isLoadingLibrary) toggleDrawer();
        };

        removeBtn.onclick = (e) => {
            e.stopPropagation();
            p.removeFolder(folderData.path);
        };

        // Filled now, not on a later tick. This used to defer to setTimeout(0)
        // and skip the work if the element had been detached by then — which
        // races with anything that re-renders: land a render between creating
        // this element and the timeout firing, and the folder stays open and
        // empty until something else re-renders it. Rare when a render happened
        // once per playlist change, routine now that a library streams in and
        // re-renders while the user is reading it.
        //
        // Nothing needed the delay: the observer inside can watch a sentinel
        // that is not in the document yet, and this whole subtree is attached
        // in the same tick.
        if (isExpanded) this.setupInfiniteScroll(childrenContainer, folderData);

        return wrapper;
    }

    createPlaylistItemElement(item) {
        const fragment = this.createItemHTML(item, item.originalIndex);
        const itemEl = fragment.querySelector('.playlist-item');

        const titleEl = itemEl.querySelector('.playlist-title');
        if (titleEl) {
            titleEl.style.whiteSpace = 'nowrap';
            titleEl.style.overflow = 'hidden';
            titleEl.style.textOverflow = 'ellipsis';
            titleEl.style.display = 'block';
            titleEl.style.maxWidth = '100%';
        }

        const infoEl = itemEl.querySelector('.playlist-info');
        if (infoEl) {
            infoEl.style.minWidth = '0';
        }

        this.attachItemEvents(itemEl);
        return itemEl;
    }

    attachItemEvents(itemEl) {
        const p = this.playlist;
        const getCurrentIndex = () => {
            const id = itemEl.dataset.id;
            if (id) {
                const index = p.items.findIndex(i => i.id === id);
                if (index !== -1) return index;
            }
            return parseInt(itemEl.dataset.index);
        };

        itemEl.addEventListener('click', (e) => {
            if (e.target.closest('.playlist-remove-btn') || e.target.closest('.playlist-download-btn')) return;
            if (e.target.closest('.playlist-keep-btn')) return;
            p.selectItem(getCurrentIndex());
        });

        const keepBtn = itemEl.querySelector('.playlist-keep-btn');
        if (keepBtn) {
            keepBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                p.keepDiscoveredItem(itemEl.dataset.id);
            });
        }

        const downloadBtn = itemEl.querySelector('.playlist-download-btn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                p._downloadItem(getCurrentIndex());
            });
        }

        const removeBtn = itemEl.querySelector('.playlist-remove-btn');
        if (removeBtn) {
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                p.removeItem(getCurrentIndex());
            });
        }

        const settingsBtn = itemEl.querySelector('.playlist-settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                p._toggleSettingsMenu(getCurrentIndex(), settingsBtn);
            });
        }
    }

    updateUI() {
        const p = this.playlist;
        const prevActive = p.container.querySelector('.playlist-item.active');
        if (prevActive) prevActive.classList.remove('active');

        if (p.activeIndex === -1) return;

        let activeEl = p.container.querySelector(`.playlist-item[data-index="${p.activeIndex}"]`);

        if (activeEl) {
            activeEl.classList.add('active');
        } else {
            p.scrollToPlaying().then(() => {
                activeEl = p.container.querySelector(`.playlist-item[data-index="${p.activeIndex}"]`);
                if (activeEl) {
                    activeEl.classList.add('active');
                }
            });
        }
    }

    /**
     * Update a specific item's UI (thumbnail, duration)
     * @param {Object} item 
     */
    updateItemUI(item) {
        const p = this.playlist;
        const index = p.items.indexOf(item);
        if (index === -1) return;

        const el = p.container.querySelector(`.playlist-item[data-index="${index}"]`);
        if (el) {
            let overlay = el.querySelector('.playlist-thumbnail-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.className = 'playlist-thumbnail-overlay';
                const thumbEl = el.querySelector('.playlist-thumbnail');
                if (thumbEl) thumbEl.appendChild(overlay);
            }
            if (overlay) overlay.textContent = item.duration;

            const thumbEl = el.querySelector('.playlist-thumbnail');
            if (thumbEl && item.thumbnail) {
                thumbEl.style.backgroundImage = `url(${item.thumbnail})`;
                thumbEl.style.backgroundSize = 'cover';
                thumbEl.style.backgroundPosition = 'center';

                Array.from(thumbEl.children).forEach(child => {
                    if (!child.classList.contains('playlist-thumbnail-overlay')) {
                        child.style.display = 'none';
                    }
                });
            }
        }
    }

    /**
     * Remove an item from the DOM surgically
     * @param {number} index - Index of the item to remove
     */
    removeItemFromDOM(index) {
        const p = this.playlist;
        const itemEl = p.container.querySelector(`.playlist-item[data-index="${index}"]`);
        
        if (itemEl) {
            // Update Parent Folder Count if it exists
            const folder = itemEl.closest('.playlist-folder');
            if (folder) {
                const header = folder.querySelector('.playlist-folder-header');
                const countSpan = header?.querySelector('.folder-name span:last-child');
                if (countSpan && countSpan.textContent.startsWith('(')) {
                    const currentCount = parseInt(countSpan.textContent.replace(/\D/g, ''));
                    const newCount = Math.max(0, currentCount - 1);
                    countSpan.textContent = `(${newCount})`;
                    // If folder is now empty, remove it entirely
                    if (newCount === 0) folder.remove();
                }
            }
            itemEl.remove();
        }

        // Patch remaining visible indices to stay in sync without a full re-render
        const allItems = p.container.querySelectorAll('.playlist-item');
        for (const el of allItems) {
            const curr = parseInt(el.dataset.index);
            if (curr > index) {
                el.dataset.index = (curr - 1).toString();
            }
        }
    }

    /**
     * Remove a folder from the DOM surgically
     * @param {string} folderPath - Path of the folder to remove
     */
    removeFolderFromDOM(folderPath) {
        const folderEl = this.playlist.container.querySelector(`.playlist-folder[data-path="${folderPath}"]`);
        if (folderEl) {
            folderEl.remove();
        }
    }

    /**
     * Update UI to reflect recording state
     * @param {boolean} isRecording 
     */
    setRecordingState(isRecording) {
        const activeEl = this.playlist.container.querySelector('.playlist-item.active');
        if (activeEl) {
            activeEl.classList.toggle('recording-item', isRecording);
        }
    }

    /**
     * Mark an item as broken in the DOM
     * @param {string} itemId 
     */
    markItemBrokenInDOM(itemId) {
        const itemEl = this.playlist.container.querySelector(`.playlist-item[data-id="${itemId}"]`);
        if (itemEl) {
            itemEl.classList.add('playlist-item--broken');
        }
    }

    /**
     * Short label for a codec this browser cannot decode, or null.
     * Video is the blocking case; undecodable audio only costs sound, and the
     * player already tries other audio tracks before giving up.
     */
    unsupportedReason(item) {
        if (item.videoInfo && item.videoInfo.decodable === false) {
            return `${(item.videoInfo.codec || 'video').toUpperCase()} not supported`;
        }
        if (item.audioInfo && item.audioInfo.decodable === false) {
            return `${(item.audioInfo.codec || 'audio').toUpperCase()} audio not supported`;
        }
        return null;
    }

    createItemHTML(item, index) {
        const template = document.getElementById('playlist-item-template');
        const clone = template.content.cloneNode(true);

        const itemEl = clone.querySelector('.playlist-item');
        const thumbnail = itemEl.querySelector('.playlist-thumbnail');
        const title = itemEl.querySelector('.playlist-title');
        const duration = itemEl.querySelector('.playlist-duration');

        itemEl.dataset.index = index;
        itemEl.dataset.id = item.id;
        itemEl.setAttribute('aria-label', `Play ${item.title || 'Unknown Video'}`);

        if (item.needsReload) itemEl.classList.add('needs-reload');
        if (item.error) itemEl.classList.add('error');
        if (item.isBroken) itemEl.classList.add('playlist-item--broken');
        if (item.isWebcam) itemEl.classList.add('recording-item');

        // Codecs this browser cannot decode are marked rather than hidden: the
        // file is really there, and on desktop the same library plays it, so a
        // missing row would look like the scan lost it. Only known once metadata
        // has been read — an unprobed item is not claimed to be either way.
        const unsupported = this.unsupportedReason(item);
        if (unsupported) {
            itemEl.classList.add('playlist-item--unsupported');
            const badge = document.createElement('span');
            badge.className = 'playlist-unsupported-badge';
            badge.textContent = unsupported;
            badge.title = `${unsupported} — this browser has no decoder for it`;
            itemEl.querySelector('.playlist-info')?.appendChild(badge);
        }

        // Scan results are not saved, so they need a way to be kept. Added here
        // rather than to the template because every other item would have to
        // hide it, and only discovered items can be promoted.
        if (item.isDiscovered) {
            itemEl.classList.add('discovered-item');
            // The folder path is capped for width, so the full location is only
            // available here.
            if (item.localPath) itemEl.title = item.localPath;
            const actions = itemEl.querySelector('.playlist-actions');
            if (actions) {
                const keepBtn = document.createElement('button');
                keepBtn.className = 'playlist-keep-btn';
                keepBtn.title = 'Keep in playlist';
                keepBtn.setAttribute('aria-label', `Keep ${item.title || 'this video'} in playlist`);
                keepBtn.innerHTML = '<svg width="16" height="16" fill="currentColor"><use href="assets/icons/sprite.svg#icon-plus"></use></svg>';
                actions.insertBefore(keepBtn, actions.firstChild);
            }
        }

        if (item.thumbnail) {
            thumbnail.style.backgroundImage = `url(${item.thumbnail})`;
            thumbnail.style.backgroundSize = 'cover';
            thumbnail.style.backgroundPosition = 'center';
        } else {
            const placeholderTemplate = document.getElementById('video-placeholder-template');
            const placeholderClone = placeholderTemplate.content.cloneNode(true);
            thumbnail.appendChild(placeholderClone);
        }

        const durationOverlay = document.createElement('div');
        durationOverlay.className = 'playlist-thumbnail-overlay';
        durationOverlay.textContent = item.duration || '--:--';
        thumbnail.appendChild(durationOverlay);

        let titleText = item.title || 'Unknown Video';
        titleText = titleText.replace(/\.[^/.]+$/, "");
        titleText = titleText.replace(/[_-]/g, " ");
        titleText = titleText.replace(/\b\w/g, l => l.toUpperCase());

        title.textContent = titleText;
        title.setAttribute('title', titleText);

        if (item.needsReload) {
            const statusTemplate = document.getElementById('missing-file-status-template');
            const statusSpan = statusTemplate.content.cloneNode(true);
            title.appendChild(statusSpan);
        }

        if (duration) duration.style.display = 'none';

        return clone;
    }

    countFolderChildren(folder) {
        let count = folder.items?.length || 0;
        if (folder.children) {
            for (const child of Object.values(folder.children)) {
                count += this.countFolderChildren(child);
            }
        }
        return count;
    }
}

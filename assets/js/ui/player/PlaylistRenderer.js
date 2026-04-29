import { Logger } from '../../utils/Logger.js';

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
        p.container.style.overflowX = 'hidden';

        if (p.searchQuery) {
            this.renderSearchResults(p.searchQuery);
        } else {
            this.setupInfiniteScroll(p.container, tree);
        }

        this.updateUI();
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

    setupInfiniteScroll(container, node) {
        container.dataset.renderedCount = '0';

        container.addEventListener('scroll', () => {
            const scrollTop = container.scrollTop;
            const scrollHeight = container.scrollHeight;
            const clientHeight = container.clientHeight;

            if (scrollTop + clientHeight >= scrollHeight - 100) {
                this.renderBatch(container, node);
            }
        }, { passive: true });

        this.renderBatch(container, node);
    }

    renderBatch(container, node) {
        if (!node.allContent) return;

        const BATCH_SIZE = 50;
        const currentCount = parseInt(container.dataset.renderedCount || '0');
        const total = node.allContent.length;

        if (currentCount >= total) return;

        const nextBatch = node.allContent.slice(currentCount, currentCount + BATCH_SIZE);

        const fragment = document.createDocumentFragment();
        nextBatch.forEach(entry => {
            if (entry.type === 'folder') {
                fragment.appendChild(this.createFolderElement(entry.data));
            } else {
                fragment.appendChild(this.createPlaylistItemElement(entry.data));
            }
        });

        container.appendChild(fragment);
        container.dataset.renderedCount = (currentCount + nextBatch.length).toString();
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

        this.tagM3UFolders(root);

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

    tagM3UFolders(node) {
        let commonSource = undefined;

        for (const item of node.items) {
            if (!item.m3uSource) {
                commonSource = null;
                break;
            }
            if (commonSource === undefined) {
                commonSource = item.m3uSource;
            } else if (commonSource !== item.m3uSource) {
                commonSource = null;
                break;
            }
        }

        if (commonSource !== null) {
            for (const child of Object.values(node.children)) {
                const childSource = this.tagM3UFolders(child);
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
                this.tagM3UFolders(child);
            }
        }

        if (commonSource && commonSource !== undefined) {
            node.m3uSource = commonSource;
        }

        return commonSource === undefined ? null : commonSource;
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

        const isExpanded = p.expandedFolders.has(folderData.path);
        if (isExpanded) {
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

        if (count > 0) {
            const countSpan = document.createElement('span');
            countSpan.textContent = `(${count})`;
            countSpan.style.opacity = '0.7';
            countSpan.style.fontSize = '0.9em';
            countSpan.style.marginLeft = '6px';
            countSpan.style.whiteSpace = 'nowrap';
            countSpan.style.flexShrink = '0';
            folderName.appendChild(countSpan);
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

        header.onclick = (e) => {
            e.stopPropagation();
            toggleDrawer();
        };

        info.onclick = (e) => {
            e.stopPropagation();
            toggleDrawer();
        };

        removeBtn.onclick = (e) => {
            e.stopPropagation();
            p.removeFolder(folderData.path);
        };

        if (isExpanded) {
            setTimeout(() => {
                if (!childrenContainer.dataset.renderedCount && childrenContainer.isConnected) {
                    this.setupInfiniteScroll(childrenContainer, folderData);
                }
            }, 0);
        }

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
            p.selectItem(getCurrentIndex());
        });

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

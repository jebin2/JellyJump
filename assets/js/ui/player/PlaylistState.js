/**
 * Playlist State Container
 * Reactive-ready state for playlist items, selection, and view settings.
 */
export class PlaylistState {
    constructor() {
        this.items = [];
        this.activeIndex = -1;
        this.expandedFolders = new Set();
        // Share links whose listing is still downloading. The folder row shows
        // a spinner instead of an expand arrow while its source is in here.
        this.loadingRemoteSources = new Set();
        this.searchQuery = '';
        this.isLoading = true;
    }

    setItems(items) {
        const activeItem = this.getActiveItem();
        
        this.items = items || [];
        this.isLoading = false;
        
        // Restore active index if the item still exists
        if (activeItem) {
            this.activeIndex = this.items.findIndex(item => item.id === activeItem.id);
        } else {
            this.activeIndex = -1;
        }
    }

    addItem(item) {
        this.items.push(item);
    }

    addItems(newItems) {
        if (!newItems?.length) return;
        // Appended one at a time rather than push(...newItems): spreading makes
        // every item an argument, and a shared library can hold tens of
        // thousands of files — past the engine's argument limit, where the
        // whole add fails with "Maximum call stack size exceeded".
        for (const item of newItems) this.items.push(item);
    }

    insertItem(index, item) {
        this.items.splice(index, 0, item);
    }

    removeItem(index) {
        if (index < 0 || index >= this.items.length) return null;
        
        const removed = this.items.splice(index, 1)[0];
        
        // Adjust active index
        if (this.activeIndex === index) {
            this.activeIndex = -1;
        } else if (this.activeIndex > index) {
            this.activeIndex--;
        }
        
        return removed;
    }

    updateItem(index, data) {
        if (index < 0 || index >= this.items.length) return;
        this.items[index] = { ...this.items[index], ...data };
    }

    setActiveIndex(index) {
        this.activeIndex = index;
    }

    getActiveItem() {
        if (this.activeIndex < 0 || this.activeIndex >= this.items.length) return null;
        return this.items[this.activeIndex];
    }

    setSearchQuery(query) {
        this.searchQuery = (query || '').toLowerCase().trim();
    }

    toggleFolder(path) {
        if (this.expandedFolders.has(path)) {
            this.expandedFolders.delete(path);
            return false;
        } else {
            this.expandedFolders.add(path);
            return true;
        }
    }

    setIsLoading(loading) {
        this.isLoading = !!loading;
    }

    clear() {
        this.items = [];
        this.activeIndex = -1;
        this.expandedFolders.clear();
        this.loadingRemoteSources.clear();
        this.searchQuery = '';
        this.isLoading = false;
    }

    getFilteredItems() {
        if (!this.searchQuery) return this.items;
        return this.items.filter(item => 
            (item.title || '').toLowerCase().includes(this.searchQuery)
        );
    }
}

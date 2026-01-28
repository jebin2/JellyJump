/**
 * PullToRefresh.js
 * Implements "Pull to Hard Reset" functionality.
 */

export class PullToRefresh {
    constructor() {
        this.touchStartY = 0;
        this.isPulling = false;
        this.state = 'idle'; // 'idle', 'pulling', 'ready', 'refreshing'
        this.element = this.createIndicator();
        this.appendIndicator();
        this.bindEvents();
    }

    createIndicator() {
        const el = document.createElement('div');
        el.className = 'refresh-indicator';
        return el;
    }

    appendIndicator() {
        document.body.appendChild(this.element);
    }

    bindEvents() {
        document.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
        document.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: true });
        document.addEventListener('touchend', this.handleTouchEnd.bind(this));
    }

    handleTouchStart(e) {
        if (window.scrollY === 0) {
            this.touchStartY = e.touches[0].clientY;
            this.isPulling = true;
            this.setState('idle');
        }
    }

    handleTouchMove(e) {
        if (!this.isPulling) return;

        const y = e.touches[0].clientY;
        const diff = y - this.touchStartY;

        // Only allow pulling if at the top and pulling down
        if (diff > 0 && window.scrollY <= 0) {
            if (diff > 250) {
                this.setState('ready');
            } else if (diff > 50) {
                this.setState('pulling');
            } else {
                this.setState('idle');
            }
        } else {
            this.setState('idle');
            this.isPulling = false; // Stop tracking if we scrolled down
        }
    }

    async handleTouchEnd(e) {
        if (!this.isPulling) return;
        this.isPulling = false;

        const y = e.changedTouches[0].clientY;
        const diff = y - this.touchStartY;

        if (diff > 250 && window.scrollY <= 0) {
            await this.hardRefresh();
        } else {
            this.setState('idle');
        }
    }

    setState(newState) {
        if (this.state === newState) return;

        this.state = newState;
        this.element.className = 'refresh-indicator'; // Reset classes

        if (newState !== 'idle') {
            this.element.classList.add('visible');
            this.element.classList.add(newState);
        }

        switch (newState) {
            case 'pulling':
                this.element.textContent = 'Pull to hard refresh...';
                break;
            case 'ready':
                this.element.textContent = 'Release for HARD Refresh!';
                break;
            case 'refreshing':
                this.element.textContent = 'Updating...';
                break;
            default:
                this.element.textContent = '';
                break;
        }
    }

    async hardRefresh() {
        this.setState('refreshing');

        try {
            console.log('Starting hard refresh...');

            // 1. Unregister service workers
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const registration of registrations) {
                    await registration.unregister();
                    console.log('Service Worker unregistered');
                }
            }

            // 2. Clear caches (Storage API)
            if ('caches' in window) {
                const keys = await caches.keys();
                await Promise.all(keys.map(key => caches.delete(key)));
                console.log('Caches cleared');
            }

            // 3. Clear LocalStorage
            localStorage.clear();
            console.log('LocalStorage cleared');

            // 4. Clear SessionStorage
            sessionStorage.clear();
            console.log('SessionStorage cleared');

            // 5. Clear Cookies
            document.cookie.split(";").forEach((c) => {
                document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
            });
            console.log('Cookies cleared');

            // 6. Clear IndexedDB
            if ('indexedDB' in window && 'databases' in indexedDB) {
                try {
                    const dbs = await indexedDB.databases();
                    await Promise.all(dbs.map(db => {
                        return new Promise((resolve, reject) => {
                            const req = indexedDB.deleteDatabase(db.name);
                            req.onsuccess = () => {
                                console.log(`Deleted IndexedDB: ${db.name}`);
                                resolve();
                            };
                            req.onerror = () => {
                                console.error(`Failed to delete IndexedDB: ${db.name}`);
                                resolve(); // Resolve anyway to continue
                            };
                            req.onblocked = () => {
                                console.warn(`Delete blocked for IndexedDB: ${db.name}`);
                                resolve();
                            };
                        });
                    }));
                } catch (e) {
                    console.error('Error clearing IndexedDB:', e);
                }
            }

            // Hard reload
            window.location.reload(true);
        } catch (error) {
            console.error('Hard refresh failed:', error);
            window.location.reload();
        }
    }
}

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new PullToRefresh();
    });
} else {
    new PullToRefresh();
}

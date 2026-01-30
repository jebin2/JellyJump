// Landing page entry point
import './pull-to-refresh.js';

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('[PWA] Service Worker registered'))
            .catch(err => console.log('[PWA] Service Worker failed', err));
    });
}

const loader = document.getElementById('page-loader');

// Function to hide loader
function hideLoader() {
    if (loader) {
        loader.classList.add('hidden');
    }
}

// Hide page loader after page is fully loaded
window.addEventListener('load', hideLoader);

// Handle browser back/forward cache (bfcache)
window.addEventListener('pageshow', function (event) {
    // If page is loaded from cache, hide the loader
    if (event.persisted) {
        hideLoader();
    }
});

// Show loader when clicking navigation links
document.addEventListener('DOMContentLoaded', function () {
    const navLinks = document.querySelectorAll('a[href="player.html"]');

    navLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            // Show loader immediately
            if (loader) {
                loader.classList.remove('hidden');
            }
            // Let the browser navigate naturally (don't preventDefault)
        });
    });

    // Mobile Menu Logic
    const mobileBtn = document.querySelector('.mobile-menu-btn');
    const navLinksContainer = document.querySelector('.nav-links');
    const overlay = document.querySelector('.mobile-menu-overlay');

    if (mobileBtn && navLinksContainer) {
        function toggleMenu() {
            const isExpanded = mobileBtn.getAttribute('aria-expanded') === 'true';
            mobileBtn.setAttribute('aria-expanded', !isExpanded);
            navLinksContainer.classList.toggle('active');
            mobileBtn.classList.toggle('active');
            if (overlay) overlay.classList.toggle('active');
            document.body.classList.toggle('no-scroll');
        }

        mobileBtn.addEventListener('click', toggleMenu);
        if (overlay) overlay.addEventListener('click', toggleMenu);

        // Close menu when clicking a link
        navLinksContainer.querySelectorAll('a, button').forEach(link => {
            link.addEventListener('click', () => {
                if (navLinksContainer.classList.contains('active')) {
                    toggleMenu();
                }
            });
        });
    }
});

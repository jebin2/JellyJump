// Landing page entry point
import './shared/utils/reload-on-stale-chunks.js';
import './pull-to-refresh.js';
import { registerServiceWorkerWithCOI } from './shared/utils/coi.js';
import { installErrorReporter } from './shared/errors/ErrorReporter.js';

// Errors nothing else caught are recorded and shown once (shared/errors).
installErrorReporter();

// Register Service Worker for PWA + cross-origin isolation (multi-threaded WASM)
window.addEventListener('load', registerServiceWorkerWithCOI);

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
    // The demo: plays muted as a preview; "Watch with sound" starts it over
    // with sound and the video's own controls. Not moving for people who ask
    // for less motion until they press play.
    const demo = document.querySelector('.hero-demo');
    const demoVideo = demo?.querySelector('video');
    if (demo && demoVideo) {
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
            demoVideo.removeAttribute('autoplay');
            demoVideo.pause();
            demoVideo.controls = true;
        }
        demo.querySelector('.demo-sound')?.addEventListener('click', () => {
            demoVideo.muted = false;
            demoVideo.loop = false;
            demoVideo.controls = true;
            demoVideo.currentTime = 0;
            demoVideo.play().catch(() => {});
            demo.classList.add('with-sound');
        });
    }
});

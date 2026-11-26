/**
 * What the demo's recording and its explorations share: dist/ and the
 * clips served the way the tests serve them (cross-origin isolated), and a
 * 1920×1080 Chromium page with nothing allowed off this machine.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

export const ROOT = resolve(import.meta.dirname, '../..');
const DIST = join(ROOT, 'dist');
export const OUT = join(import.meta.dirname, 'out');
const CLIPS = join(OUT, 'clips');
const TYPES = {
    '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
    '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.gif': 'image/gif',
    '.webp': 'image/webp', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.wasm': 'application/wasm',
    '.mp4': 'video/mp4', '.webm': 'video/webm', '.ico': 'image/x-icon', '.txt': 'text/plain',
};

export async function serve() {
    if (!existsSync(join(DIST, 'player.html'))) throw new Error('No dist/: run npm run build first');
    const server = createServer(async (req, res) => {
        try {
            const path = decodeURIComponent(req.url.split('?')[0]);
            const file = path.startsWith('/__clips__/') ? join(CLIPS, path.slice(11)) : join(DIST, path === '/' ? 'index.html' : path);
            if (!file.startsWith(DIST) && !file.startsWith(CLIPS)) { res.writeHead(403).end(); return; }
            const info = await stat(file);
            if (!info.isFile()) { res.writeHead(404).end(); return; }
            res.writeHead(200, {
                'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
                'Content-Length': info.size,
                'Cross-Origin-Opener-Policy': 'same-origin',
                'Cross-Origin-Embedder-Policy': 'require-corp',
            });
            res.end(await readFile(file));
        } catch { res.writeHead(404).end(); }
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    return { server, origin: `http://127.0.0.1:${server.address().port}` };
}

export async function openBrowser() {
    const { chromium } = await import('playwright-core');
    const executablePath = [process.env.CHROMIUM_PATH, '/usr/bin/chromium', '/usr/bin/google-chrome'].filter(Boolean).find((p) => existsSync(p));
    const browser = await chromium.launch({
        executablePath,
        // The GPU (when there is one) draws the page: in software, a blurred
        // modal background or a busy video recorded at 6–16 frames a second.
        args: ['--autoplay-policy=no-user-gesture-required', '--hide-scrollbars', '--force-color-profile=srgb',
            '--use-angle=gl', '--ignore-gpu-blocklist', '--disable-accelerated-video-decode'],
    });
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    return { browser, context };
}

/**
 * The player, with the demo's clips in its playlist and the first one open.
 * @param {import('playwright-core').Page} page
 */
export async function openPlayerWithClips(page, origin, names) {
    await page.route('**/*', (route) => {
        const url = route.request().url();
        if (url.startsWith(origin) || url.startsWith('blob:') || url.startsWith('data:')) return route.continue();
        return route.abort();
    });
    await page.goto(`${origin}/player.html`);
    await page.waitForFunction(() => !!window.player && !!window.playlist, null, { timeout: 60000 });
    await page.evaluate(async ({ names }) => {
        const pl = window.playlist;
        // The sample video a first visit gets is not part of the demo.
        while (pl.items.length) pl.removeItem(0);
        const files = [];
        for (const name of names) {
            const blob = await (await fetch(`/__clips__/${encodeURIComponent(name)}`)).blob();
            files.push(new File([blob], name, { type: 'video/mp4' }));
        }
        await pl.handleFiles(files);
        const first = pl.items.findIndex((i) => i.title.startsWith(names[0].replace(/\.mp4$/, '')));
        await pl.selectItem(Math.max(0, first), false);
        const p = pl.player;
        for (let i = 0; i < 100 && !(p.duration > 0); i++) await new Promise((r) => setTimeout(r, 100));
    }, { names });
}

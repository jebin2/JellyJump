/**
 * The tags a shared link is drawn from (X, Facebook, LinkedIn, Discord,
 * WhatsApp, Slack): every page people share has a title, a description, an
 * image of the size it says, and its own address; X's tags use name=, as
 * its documentation says, not property=.
 *
 *   node scripts/social-meta-test.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const SITE = 'https://jellyjump.voidall.com';
/** The pages shared as links, and the address each says it is. */
const PAGES = { player: `${SITE}/`, dashboard: `${SITE}/dashboard.html` };

let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
    if (ok) { pass++; console.log(`  PASS  ${label}`); }
    else { fail++; console.log(`  FAIL  ${label}${detail ? ` -- ${detail}` : ''}`); }
};

/** @param {string} html @param {'property'|'name'} attr @param {string} key */
const meta = (html, attr, key) =>
    new RegExp(`<meta\\s+${attr}="${key.replace(/[.:]/g, '\\$&')}"\\s+content="([^"]*)"`).exec(html)?.[1];

/** Width and height from a PNG's header. @param {Buffer} png */
const pngSize = (png) => png.toString('latin1', 1, 4) === 'PNG' ? [png.readUInt32BE(16), png.readUInt32BE(20)] : null;

for (const [page, url] of Object.entries(PAGES)) {
    console.log(`\n${page}.html`);
    const html = readFileSync(join(ROOT, `${page}.html`), 'utf8');
    const title = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? '';
    const description = meta(html, 'name', 'description') ?? '';
    check('a title of at most 70 characters', title.length > 0 && title.length <= 70, `${title.length}: ${title}`);
    check('a description of at most 200 characters', description.length >= 50 && description.length <= 200, `${description.length}`);
    check('its own address: canonical and og:url agree',
        /<link rel="canonical" href="([^"]*)">/.exec(html)?.[1] === url && meta(html, 'property', 'og:url') === url);

    for (const key of ['og:type', 'og:site_name', 'og:title', 'og:description', 'og:image', 'og:image:width', 'og:image:height', 'og:image:alt']) {
        check(`${key} is set`, !!meta(html, 'property', key));
    }
    check('og:title and og:description are the page\'s', meta(html, 'property', 'og:title') === title
        && meta(html, 'property', 'og:description') === description);

    check('X: a large image card', meta(html, 'name', 'twitter:card') === 'summary_large_image');
    for (const key of ['twitter:title', 'twitter:description', 'twitter:image', 'twitter:image:alt']) {
        check(`X: ${key} is set, with name=`, !!meta(html, 'name', key));
    }
    check('X: no tag written with property= (not what X documents)', !/property="twitter:/.test(html));
    check('X and the others show the same title, text and image',
        meta(html, 'name', 'twitter:title') === title && meta(html, 'name', 'twitter:description') === description
        && meta(html, 'name', 'twitter:image') === meta(html, 'property', 'og:image'));

    const image = meta(html, 'property', 'og:image') ?? '';
    check('the image is an absolute https address on the site', image.startsWith(`${SITE}/`), image);
    const file = join(ROOT, 'public', image.slice(SITE.length + 1));
    const size = existsSync(file) ? pngSize(readFileSync(file)) : null;
    check('it is a PNG the build publishes', !!size, file);
    check('of the size the page says (1200×630, the large card\'s 1.91:1)',
        size?.[0] === Number(meta(html, 'property', 'og:image:width')) && size?.[1] === Number(meta(html, 'property', 'og:image:height'))
        && size?.[0] === 1200 && size?.[1] === 630, JSON.stringify(size));
    check('and small enough for every service (under 1 MB)', existsSync(file) && readFileSync(file).length < 1_000_000);
}

console.log('\nthe site\'s root');
const built = join(ROOT, 'dist/index.html');
if (existsSync(built)) {
    const html = readFileSync(built, 'utf8');
    check('dist/index.html says it is the root', meta(html, 'property', 'og:url') === `${SITE}/`);
    check('and the image is in the build', existsSync(join(ROOT, 'dist/og-image.png')));
} else {
    console.log('  (no dist/: run npm run build to check the built root)');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

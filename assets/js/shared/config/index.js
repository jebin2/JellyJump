// @ts-check
/**
 * The app's configuration: the one place it is read.
 *
 * Values that differ between builds come from Vite (`import.meta.env`, set
 * in `.env.production` or the environment at build time; `.env.example`
 * lists them all). Everything else is a fixed default here. Player defaults
 * stay in `core/config/`, and the user's own preferences are not
 * configuration at all.
 *
 * Outside a Vite build (the Node test suites) `import.meta.env` does not
 * exist, so every value has a default.
 */

/** @type {Record<string, string | undefined>} */
// @ts-ignore -- Vite adds import.meta.env; written out exactly so Vite can replace it
const env = import.meta.env ?? {};

/** @param {string | undefined} value @param {boolean} fallback */
const flag = (value, fallback) => (value === undefined || value === '' ? fallback : value === 'true');

const domain = env.VITE_DOMAIN || 'jellyjump.voidall.com';

export const config = Object.freeze({
    /** The site's domain, shown on encrypted files' placeholder and used in share links. */
    domain,
    /** Where the site lives: Watch Party links point here. */
    baseUrl: env.VITE_BASE_URL || `https://${domain}`,
    /** Version of this build (from the release tag in CI), and a build id for cache-busting. */
    version: env.VITE_APP_VERSION || '0.0.0-dev',
    buildId: env.VITE_BUILD_ID || 'dev',
    /**
     * The video put in an empty playlist on a first visit, relative to the
     * page; empty for none.
     */
    sampleVideoPath: env.VITE_SAMPLE_VIDEO_PATH ?? 'homepage.mp4',
    /**
     * The hosts that carry that video: the site and its mirrors, and a local
     * dev server. Anywhere else (a test server on 127.0.0.1, someone else's
     * copy) the playlist starts empty.
     */
    sampleVideoHosts: Object.freeze((env.VITE_SAMPLE_VIDEO_HOSTS
        || `localhost,jebin2.github.io,www.voidall.com,${domain}`).split(',').map((h) => h.trim()).filter(Boolean)),
    /** Feature switches; see isEnabled(). */
    flags: Object.freeze({
        sampleVideo: flag(env.VITE_FLAG_SAMPLE_VIDEO, true),
    }),
});

/**
 * Whether a feature is switched on in this build.
 * @param {keyof typeof config.flags} name
 * @returns {boolean}
 */
export function isEnabled(name) {
    return config.flags[name] === true;
}


// @ts-check
/**
 * Every outside service the app talks to, and why. Code takes the address
 * from here rather than writing it out, so this list is the whole story of
 * what leaves the page (and what the Content-Security-Policy must allow).
 */
export const SERVICES = Object.freeze({
    /** YouTube's iframe player API, to play a YouTube link. */
    youtubeIframeApi: 'https://www.youtube.com/iframe_api',
    /** The YouTube player itself, without cookies. */
    youtubeEmbed: 'https://www.youtube-nocookie.com/embed/',
    /** A YouTube video's page, as the canonical link for a video id. */
    youtubeWatch: 'https://www.youtube.com/watch',
    /** YouTube's oEmbed, for a pasted link's title. */
    youtubeOembed: 'https://www.youtube.com/oembed',
    /** A YouTube video's thumbnail. */
    youtubeThumbnail: 'https://i.ytimg.com/vi/',
    /** Hugging Face: the subtitle model download and the HLS uploader's file URLs. */
    huggingFace: 'https://huggingface.co',
    /** The public IPTV playlists offered in "Add from URL". */
    iptvPlaylists: 'https://iptv-org.github.io/iptv/',
    /** A page to test a microphone, linked from the screen recorder. */
    microphoneTest: 'https://webcammictest.com/mic/',
});

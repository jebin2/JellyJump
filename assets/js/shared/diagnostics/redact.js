// @ts-check
/**
 * Take what could name the user's files, folders or servers out of text
 * that goes into a bug report (Diagnostics, "Copy details"). A report is
 * something the user pastes into a public issue.
 */

const URL_PATTERN = /\b(?:blob:)?(?:https?|file|wss?):\/\/[^\s'")<>]+/g;
// A path under a home or mount folder, or a Windows drive path.
const PATH_PATTERN = /(?:[A-Za-z]:\\|\/(?:home|Users|mnt|media|Volumes|run\/media|storage|sdcard)\/)[^\s'")<>]*/g;
const FILE_PATTERN = /[^\s/\\'"()<>]+\.(?:mp4|m4v|mkv|webm|mov|avi|wmv|flv|ts|mts|m2ts|3gp|mp3|m4a|wav|flac|ogg|oga|opus|aac|ac3|gif|png|jpe?g|webp|heic|srt|vtt|ass|ssa|m3u8?|jjlist|jjc)\b/gi;

/**
 * @param {unknown} text
 * @returns {string}
 */
export function redact(text) {
    return String(text)
        .replace(URL_PATTERN, '<url>')
        .replace(PATH_PATTERN, '<path>')
        .replace(FILE_PATTERN, '<file>');
}

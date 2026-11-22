// @ts-check
/**
 * Every kind of error the app tells apart, and what the user is told about
 * it: what happened, and what to do, in their words.
 *
 * A code says what went wrong, not where. Code that handles an error looks
 * at its code, never at its message text.
 */
export const ERROR_CODES = Object.freeze({
    FILE_MISSING: 'The file is no longer available. Add it to the playlist again.',
    UNSUPPORTED_CODEC: 'This browser cannot play or edit this video\'s format. Try converting it, or another browser.',
    DECODE_FAILED: 'The video could not be read. The file may be damaged or incomplete.',
    NETWORK: 'Could not reach the server. Check the connection and try again.',
    TIMEOUT: 'The server took too long to answer. Try again in a moment.',
    CORS: 'That site does not allow its videos to be played from another site.',
    STORAGE_FULL: 'The browser\'s storage is full. Remove some videos from the playlist and try again.',
    PERMISSION_DENIED: 'Permission was refused. Allow it in the browser\'s site settings and try again.',
    WORKER_CRASHED: 'The video was too much for this device to process. Try a smaller or shorter one.',
    CANCELLED: 'Cancelled.',
    INVALID_INPUT: 'That input could not be used. Check it and try again.',
    INTERNAL: 'Something went wrong. Copy the details and send them with a bug report.',
});

/** @typedef {keyof typeof ERROR_CODES} ErrorCode */

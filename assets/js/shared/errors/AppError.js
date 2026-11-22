// @ts-check
import { ERROR_CODES } from './codes.js';
import { isCancellation } from '../utils/Cancellation.js';

/** @typedef {import('./codes.js').ErrorCode} ErrorCode */

/**
 * The app's one error type: a code from codes.js, a message for the user,
 * and the original error underneath.
 *
 * Created where the failure happens, carried up unchanged, and shown once,
 * where the user is looking. Anything else that is thrown — a browser
 * DOMException, a TypeError from fetch — is turned into one by
 * AppError.from(), so the code that shows errors handles one shape.
 */
export class AppError extends Error {
    /**
     * @param {ErrorCode} code
     * @param {{message?: string, userMessage?: string, cause?: unknown,
     *   recoverable?: boolean, context?: Record<string, unknown>}} [options]
     */
    constructor(code, { message, userMessage, cause, recoverable = true, context = {} } = {}) {
        super(message || ERROR_CODES[code] || code, cause === undefined ? undefined : { cause });
        this.name = 'AppError';
        /** @type {ErrorCode} */
        this.code = ERROR_CODES[code] ? code : 'INTERNAL';
        this.userMessage = userMessage || ERROR_CODES[this.code];
        this.recoverable = recoverable;
        this.context = context;
    }

    /**
     * Any thrown value as an AppError, keeping an AppError as it is.
     * @param {unknown} error
     * @returns {AppError}
     */
    static from(error) {
        if (error instanceof AppError) return error;
        const err = /** @type {{name?: string, message?: string}} */ (error ?? {});
        const name = err.name ?? '';
        const message = typeof error === 'string' ? error : (err.message ?? String(error));
        /** @type {ErrorCode} */
        let code = 'INTERNAL';
        if (isCancellation(error)) code = 'CANCELLED';
        else if (name === 'QuotaExceededError') code = 'STORAGE_FULL';
        else if (name === 'NotAllowedError' || name === 'SecurityError') code = 'PERMISSION_DENIED';
        else if (name === 'TimeoutError') code = 'TIMEOUT';
        else if (name === 'NotSupportedError') code = 'UNSUPPORTED_CODEC';
        else if (name === 'TypeError' && /failed to fetch|networkerror|load failed/i.test(message)) code = 'NETWORK';
        return new AppError(code, { message, cause: error });
    }
}

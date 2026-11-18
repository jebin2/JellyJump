/**
 * Cancellation - stopping a running export when the user asks.
 *
 * Every processing service takes an optional AbortSignal. Mediabunny
 * conversions are stopped with conversion.cancel(), which releases their
 * decoders and encoders at once; hand-built pipelines check the signal between
 * frames and samples. Either way the caller sees one kind of error, an
 * AbortError, so a menu can tell "you cancelled this" apart from "this failed".
 *
 * The name survives the trip back from the media worker, which forwards
 * error.name with the message.
 */

/** @returns {DOMException} what a cancelled job rejects with */
export function cancelledError() {
    return new DOMException('The operation was cancelled.', 'AbortError');
}

/** @returns {boolean} whether this error means the user cancelled */
export function isCancellation(error) {
    return error?.name === 'AbortError' || error?.name === 'ConversionCanceledError';
}

/**
 * Throw if the job has been cancelled. Called between units of work by the
 * pipelines that drive their own loops.
 * @param {AbortSignal} [signal]
 */
export function throwIfCancelled(signal) {
    if (signal?.aborted) throw cancelledError();
}

/**
 * Run `execute` on a Mediabunny Conversion, cancelling it if the signal fires.
 *
 * @param {Object} conversion - a Mediabunny Conversion
 * @param {AbortSignal} [signal]
 * @param {Object} [executeOptions] - passed through to execute()
 */
export async function executeConversion(conversion, signal, executeOptions) {
    if (!signal) return conversion.execute(executeOptions);
    throwIfCancelled(signal);

    const onAbort = () => { conversion.cancel().catch(() => { /* already finished */ }); };
    signal.addEventListener('abort', onAbort, { once: true });
    try {
        await conversion.execute(executeOptions);
    } catch (error) {
        if (signal.aborted) throw cancelledError();
        throw error;
    } finally {
        signal.removeEventListener('abort', onAbort);
    }
    // A cancel landing as execute() finished still means the user said stop.
    throwIfCancelled(signal);
}

/**
 * A progress callback that also stops the job once it is cancelled.
 *
 * The hand-built pipelines already report progress once per frame or chunk,
 * which is exactly where a cancel should take effect, so the check rides on
 * the call they make anyway rather than being threaded through every loop.
 * Always returns a function, so `if (onProgress)` guards keep working.
 *
 * @param {(value: number, info?: Object) => void} [onProgress]
 * @param {AbortSignal} [signal]
 */
export function cancellableProgress(onProgress, signal) {
    if (!signal) return onProgress;
    return (value, info) => {
        throwIfCancelled(signal);
        onProgress?.(value, info);
    };
}

/**
 * Release an Output a job did not finish, so its encoders and writer are
 * closed now rather than whenever it is collected.
 * @param {Object|null} output - a Mediabunny Output
 */
export async function cancelUnfinished(output) {
    if (output && (output.state === 'pending' || output.state === 'started')) {
        await output.cancel().catch(() => { /* already gone */ });
    }
}

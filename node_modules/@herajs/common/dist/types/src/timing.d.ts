/**
 * Returns the next interval to use for exponential backoff.
 * This curve yields every value 4 times before doubling in the next step.
 * The function is :code:`multiplier * 2**Math.floor(n/4)`.
 * By default (multiplier = 1s), the intervals reach ca. 1 minute (total time elapsed ca. 4 minutes) after step 24,
 * so it is advised to declare a timeout after a certain number of steps.
 * @param n step on the interval curve
 * @param multiplier multiplier, default 1000 (1s)
 */
export declare function backoffIntervalStep(n: number, multiplier?: number): number;
/**
 * A promisified version of setTimeout
 * @param ms
 */
export declare function waitFor(ms: number): Promise<void>;
/**
 * Retry calling an async function until it does not throw a matching error.
 * If it throws a non-matching error, re-raise that, otherwise return the result.
 * @param fn async function that returns a result.
 * @param matchError error match function. Will retry as long as this function returns true.
 * @param timeout timeout in ms, will re-raise last error when next try would exceed this time. 0 (default) means no timeout is applied.
 * @param baseBackoffInterval basis used for exponential backoff intervall calculation
 */
export declare function retryIfErrorMatch<T>(fn: () => Promise<T>, matchError: (e: any) => boolean, timeout?: number, baseBackoffInterval?: number): Promise<T>;

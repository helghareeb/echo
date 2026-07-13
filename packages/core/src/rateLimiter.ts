import type { RateLimiter } from "./ports";

/**
 * A simple serializing rate limiter: successive `wait()` calls resolve at least
 * `minIntervalMs` apart. Replaces the original `promise-ratelimit(1200)` and is
 * portable across Node and the browser.
 */
export function createRateLimiter(minIntervalMs: number): RateLimiter {
  let last = 0;
  let chain: Promise<void> = Promise.resolve();

  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  return {
    wait(): Promise<void> {
      chain = chain.then(async () => {
        const now = Date.now();
        const delay = Math.max(0, last + minIntervalMs - now);
        if (delay > 0) await sleep(delay);
        last = Date.now();
      });
      return chain;
    },
  };
}

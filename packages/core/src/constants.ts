/**
 * Pipeline constants — ported verbatim from the original almufragh main.js so
 * behavior is preserved bit-for-bit.
 *
 * The original used a 18000 ms clip with a 100 ms overlap between consecutive
 * clips, i.e. each clip advances the timeline by 17900 ms. `OFFSET_MS` is that
 * per-clip advance and is reused both to shift a clip's token timings onto the
 * global timeline and to detect duplicated tokens at clip boundaries.
 */

/** Length of each extracted audio clip, in milliseconds. */
export const CUT_LENGTH_MS = 18000;

/** Overlap between consecutive clips, in milliseconds. */
export const OVERLAP_MS = 100;

/** How far the timeline advances per clip (= CUT_LENGTH_MS - OVERLAP_MS). */
export const OFFSET_MS = CUT_LENGTH_MS - OVERLAP_MS; // 17900

/** Alias kept for readability where "step" reads better than "offset". */
export const STEP_MS = OFFSET_MS;

/**
 * Maximum silence gap (ms) between two consecutive tokens before the current
 * subtitle line is flushed and a new one is started.
 */
export const MAX_DELAY_MS = 100;

/** Wit.ai speech endpoint (the only external service the pipeline talks to). */
export const WIT_SPEECH_URL = "https://api.wit.ai/speech";

/** Wit.ai API version pinned by the original app. */
export const WIT_ACCEPT_HEADER = "application/vnd.wit.20200513+json";

/** Per-request timeout for a Wit.ai call, in milliseconds. */
export const WIT_TIMEOUT_MS = 30000;

/** Minimum spacing between Wit.ai requests (free-tier friendly), in ms. */
export const RATE_LIMIT_MS = 1200;

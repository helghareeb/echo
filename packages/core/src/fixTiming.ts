import { OFFSET_MS } from "./constants";
import type { WitResponse, WitToken } from "./types";

/**
 * Stitch a group of consecutive clip responses onto one continuous timeline.
 *
 * This is a faithful port of the original `fixTiming(responses, idx)`. Responses
 * are processed in consecutive pairs; `idx` is the 1-based clip counter at the
 * moment the pair is flushed, so the first response in the group maps to global
 * clip index `idx - 2`.
 *
 * For response `resId` in the group, every token time is shifted by
 * `OFFSET_MS * (resId + (idx - 2))` — i.e. by its absolute clip index times the
 * per-clip advance. Where a clip's last token overlaps the next clip's first
 * token (a boundary duplicate from the 100 ms overlap), the shorter of the two
 * is dropped.
 *
 * @param responses group of Wit responses (typically 2, or 1 as the tail).
 * @param idx 1-based clip counter at flush time (global base index = idx - 2).
 */
export function fixTiming(responses: WitResponse[], idx: number): WitToken[] {
  let tokens: WitToken[] = [];
  const base = idx - 2;

  for (let resId = 0; resId < responses.length; resId++) {
    const speech = responses[resId]?.speech;
    if (!speech || !speech.tokens || speech.tokens.length === 0) continue;
    const currTokens = speech.tokens;

    const isLast = resId === responses.length - 1;
    if (!isLast) {
      const nextTokens = responses[resId + 1]?.speech?.tokens;
      if (nextTokens && nextTokens.length > 0) {
        const currLastToken = currTokens[currTokens.length - 1];
        const nextFirstToken = nextTokens[0];
        // Boundary duplicate: the tail of this clip reaches into the next clip's
        // start region (offset by one clip advance). Keep the longer token.
        if (currLastToken.end > nextFirstToken.start + OFFSET_MS) {
          const currLastTokenDuration = currLastToken.end - currLastToken.start;
          const nextFirstTokenDuration = nextTokens[0].end - nextTokens[0].start;
          if (nextFirstTokenDuration >= currLastTokenDuration) {
            currTokens.splice(currTokens.length - 1, 1);
          } else {
            nextTokens.splice(0, 1);
          }
        }
      }
    }

    const shift = OFFSET_MS * (resId + base);
    const shifted = currTokens.map((tk) => ({
      ...tk,
      start: tk.start + shift,
      end: tk.end + shift,
    }));
    tokens = tokens.concat(shifted);
  }

  return tokens;
}

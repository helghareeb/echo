import { describe, it, expect } from "vitest";
import { fixTiming } from "../src/fixTiming";
import { OFFSET_MS } from "../src/constants";
import type { WitResponse } from "../src/types";

const res = (tokens: Array<[string, number, number]>): WitResponse => ({
  text: tokens.map((t) => t[0]).join(" "),
  speech: { tokens: tokens.map(([token, start, end]) => ({ token, start, end })) },
});

describe("fixTiming", () => {
  it("shifts each response onto the global timeline by clipIndex * OFFSET_MS", () => {
    const a = res([["a", 0, 500], ["b", 600, 1000]]);
    const b = res([["c", 0, 400], ["d", 500, 900]]);
    // idx=2 => base clip index 0 for the first response, 1 for the second.
    const tokens = fixTiming([a, b], 2);
    expect(tokens).toEqual([
      { token: "a", start: 0, end: 500 },
      { token: "b", start: 600, end: 1000 },
      { token: "c", start: 0 + OFFSET_MS, end: 400 + OFFSET_MS },
      { token: "d", start: 500 + OFFSET_MS, end: 900 + OFFSET_MS },
    ]);
  });

  it("uses idx-2 as the base clip index for later pairs", () => {
    const c = res([["c", 0, 400]]);
    const d = res([["d", 0, 400]]);
    // Third pair flushes at idx=4 => base 2 and 3.
    const tokens = fixTiming([c, d], 4);
    expect(tokens[0].start).toBe(OFFSET_MS * 2);
    expect(tokens[1].start).toBe(OFFSET_MS * 3);
  });

  it("drops the shorter boundary token when clips overlap (keep next)", () => {
    // currLast is long and overlaps next; next-first is shorter -> next-first removed.
    const a = res([["x", 0, 19000]]);
    const b = res([["y", 500, 900]]);
    const tokens = fixTiming([a, b], 2);
    expect(tokens).toEqual([{ token: "x", start: 0, end: 19000 }]);
  });

  it("drops the shorter boundary token when clips overlap (keep current)", () => {
    // currLast is short; next-first is longer -> currLast removed.
    const a = res([["a", 0, 100], ["b", 18900, 19000]]);
    const b = res([["c", 500, 5000]]);
    const tokens = fixTiming([a, b], 2);
    expect(tokens.map((t) => t.token)).toEqual(["a", "c"]);
    expect(tokens[1].start).toBe(500 + OFFSET_MS);
  });

  it("handles a lone tail response", () => {
    const tail = res([["z", 0, 300]]);
    const tokens = fixTiming([tail], 4); // base 2
    expect(tokens).toEqual([{ token: "z", start: OFFSET_MS * 2, end: 300 + OFFSET_MS * 2 }]);
  });
});

import { describe, it, expect } from "vitest";
import { planClips } from "../src/planClips";

describe("planClips", () => {
  it("returns ceil(duration / 18) clips", () => {
    expect(planClips(40)).toHaveLength(3); // ceil(40/18)=3
    expect(planClips(36)).toHaveLength(2);
    expect(planClips(18)).toHaveLength(1);
    expect(planClips(1)).toHaveLength(1);
  });

  it("advances the start by 17.9 s per clip with 18 s length (100 ms overlap)", () => {
    const plan = planClips(40);
    expect(plan.map((c) => c.index)).toEqual([0, 1, 2]);
    expect(plan.map((c) => c.startSec)).toEqual([0, 17.9, 35.8]);
    expect(plan.every((c) => c.lengthSec === 18)).toBe(true);
  });

  it("handles empty / invalid durations", () => {
    expect(planClips(0)).toEqual([]);
    expect(planClips(-5)).toEqual([]);
    expect(planClips(NaN)).toEqual([]);
  });
});

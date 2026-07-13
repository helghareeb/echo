import { describe, it, expect } from "vitest";
import { formatSrtTime, filterText, groupTokens, formatSrtBlock } from "../src/subtitles";

describe("formatSrtTime", () => {
  it("formats HH:MM:SS,mmm with zero padding", () => {
    expect(formatSrtTime(0)).toBe("00:00:00,000");
    expect(formatSrtTime(59999)).toBe("00:00:59,999");
    expect(formatSrtTime(3_661_500)).toBe("01:01:01,500");
  });

  it("fixes the original rounding bug (1600ms is 00:00:01,600 not 02,600)", () => {
    expect(formatSrtTime(1600)).toBe("00:00:01,600");
  });
});

describe("filterText", () => {
  it("drops the first newline and turns periods into line breaks", () => {
    expect(filterText("a.b.c")).toBe("a\nb\nc");
    expect(filterText("x\ny.z")).toBe("xy\nz");
  });
});

describe("groupTokens", () => {
  it("splits a new line when the gap exceeds 100 ms", () => {
    const tokens = [
      { token: "a", start: 0, end: 100 },
      { token: "b", start: 150, end: 200 }, // gap 50 -> same line
      { token: "c", start: 400, end: 500 }, // gap 200 -> new line
    ];
    const entries = groupTokens(tokens, 1);
    expect(entries).toEqual([
      { number: 1, startMs: 0, endMs: 200, text: "a b" },
      { number: 2, startMs: 400, endMs: 500, text: "c" },
    ]);
  });

  it("numbers lines starting from the given start number", () => {
    const tokens = [{ token: "a", start: 0, end: 100 }];
    expect(groupTokens(tokens, 5)[0].number).toBe(5);
  });
});

describe("formatSrtBlock", () => {
  it("produces a standards-compliant block with a trailing blank line", () => {
    const block = formatSrtBlock({ number: 1, startMs: 0, endMs: 500, text: "hello" });
    expect(block).toBe("1\n00:00:00,000 --> 00:00:00,500\nhello\n\n");
  });
});

import { MAX_DELAY_MS } from "./constants";
import type { SubtitleEntry, WitToken } from "./types";

/**
 * Format a millisecond offset as an SRT timestamp `HH:MM:SS,mmm`.
 *
 * NOTE: this fixes a bug in the original app, which rounded the seconds
 * independently of the milliseconds (`secondsToHHMMSS(round(ms/1000))` combined
 * with `ms % 1000`), so e.g. 1600 ms rendered as `00:00:02,600` instead of
 * `00:00:01,600`, and the milliseconds were never zero-padded.
 */
export function formatSrtTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms));
  const h = Math.floor(total / 3_600_000);
  const m = Math.floor((total % 3_600_000) / 60_000);
  const s = Math.floor((total % 60_000) / 1000);
  const millis = total % 1000;
  const p2 = (n: number) => String(n).padStart(2, "0");
  const p3 = (n: number) => String(n).padStart(3, "0");
  return `${p2(h)}:${p2(m)}:${p2(s)},${p3(millis)}`;
}

/**
 * Clean recognized text before writing it out. Ported from the original
 * `filterText`: drop the first newline, then turn every period into a line
 * break (the original used '.' as a sentence separator for Arabic output).
 */
export function filterText(text: string): string {
  return text.replace("\n", "").replace(/\./g, "\n");
}

/** Build a standards-compliant SRT block (with its trailing blank line). */
export function formatSrtBlock(entry: SubtitleEntry): string {
  return (
    `${entry.number}\n` +
    `${formatSrtTime(entry.startMs)} --> ${formatSrtTime(entry.endMs)}\n` +
    `${entry.text}\n\n`
  );
}

/**
 * Group a continuous token stream into subtitle lines. Ported from the original
 * `generateSubtitles` inner loop: start a new line whenever the gap between the
 * previous token's end and the current token's start exceeds MAX_DELAY_MS.
 *
 * @param tokens tokens already placed on the global timeline (see fixTiming).
 * @param startNumber the 1-based number to assign to the first produced line.
 * @returns produced subtitle entries (text not yet run through filterText).
 */
export function groupTokens(tokens: WitToken[], startNumber: number): SubtitleEntry[] {
  const entries: SubtitleEntry[] = [];
  let current: WitToken[] = [];
  let prevId = 0;
  let number = startNumber;

  const flush = () => {
    if (current.length === 0) return;
    const text = current.map((t) => t.token).join(" ");
    entries.push({
      number: number++,
      startMs: current[0].start,
      endMs: current[current.length - 1].end,
      text,
    });
    current = [];
  };

  for (let i = 0; i < tokens.length; i++) {
    if (current.length === 0) {
      current.push(tokens[i]);
      prevId = i;
    } else {
      const delay = tokens[i].start - tokens[prevId].end;
      if (delay > MAX_DELAY_MS) {
        flush();
        current.push(tokens[i]);
        prevId = i;
      } else {
        current.push(tokens[i]);
        prevId = i;
      }
    }
  }
  flush();

  return entries;
}

import { CUT_LENGTH_MS, STEP_MS } from "./constants";
import type { ClipPlan } from "./types";

/**
 * Plan how a source of `durationSec` seconds is split into clips.
 *
 * Ported from the original `splitAudioFile`:
 *   splitCount = ceil(duration / (CUT_LENGTH_MS / 1000))
 *   clip i starts at i * (STEP_MS / 1000) and lasts CUT_LENGTH_MS / 1000.
 *
 * Each clip is 18 s long and advances the timeline by 17.9 s, giving a 100 ms
 * overlap that the timeline stitcher later de-duplicates.
 */
export function planClips(durationSec: number): ClipPlan[] {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return [];

  const clipLengthSec = CUT_LENGTH_MS / 1000;
  const stepSec = STEP_MS / 1000;
  const splitCount = Math.ceil(durationSec / clipLengthSec);

  const plan: ClipPlan[] = [];
  for (let i = 0; i < splitCount; i++) {
    plan.push({
      index: i,
      startSec: i * stepSec,
      lengthSec: clipLengthSec,
    });
  }
  return plan;
}

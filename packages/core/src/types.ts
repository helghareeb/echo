/** A single recognized token as returned by Wit.ai, times in milliseconds. */
export interface WitToken {
  token: string;
  start: number;
  end: number;
}

/** The subset of the Wit.ai /speech response the pipeline relies on. */
export interface WitResponse {
  text: string;
  speech?: {
    confidence?: number;
    tokens: WitToken[];
  };
  /** Present on auth failures, e.g. { code: "no-auth" }. */
  code?: string;
  error?: string;
}

/** Result of transcribing one clip; `{ text: "" }` means "nothing usable". */
export type TranscribeResult = WitResponse | { text: "" };

/** A planned clip: where it starts in the source and how long it is. */
export interface ClipPlan {
  index: number;
  startSec: number;
  lengthSec: number;
}

/** An input audio file to transcribe. `source` is platform-specific and opaque
 * to the core (a filesystem path on desktop, a File/Blob on web). */
export interface AudioInput {
  name: string;
  source: unknown;
}

/** An opaque reference to a produced audio clip (path on desktop, bytes on web). */
export type ClipRef = unknown;

/** A finished subtitle entry, ready to be formatted/persisted. */
export interface SubtitleEntry {
  /** 1-based subtitle number. */
  number: number;
  startMs: number;
  endMs: number;
  text: string;
}

/** Progress event names (kept identical to the original IPC channel names so
 * the renderer wiring stays familiar). */
export type ProgressEvent =
  | "currentFile"
  | "numberOfClips"
  | "currentClip"
  | "currentSubtitle"
  | "timePerClip"
  | "APIHit"
  | "clipCreated"
  | "step"
  | "fileComplete"
  | "processComplete"
  | "error";

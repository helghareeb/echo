import type { AudioInput, ClipPlan, ClipRef, ProgressEvent, TranscribeResult } from "./types";

/**
 * Ports (hexagonal architecture): every side effect the pipeline needs is
 * expressed as an interface here and implemented per platform. The desktop app
 * backs these with ffmpeg + fs + a direct fetch; the web app backs them with
 * ffmpeg.wasm + the Web Audio API + Blob downloads + a proxied fetch.
 */

/** Measures the duration of a source audio file. */
export interface DurationProvider {
  getDurationSeconds(source: unknown): Promise<number>;
}

/** Splits a source file into ordered clips according to a plan. */
export interface AudioChunker {
  /**
   * @param onClip called once per clip actually produced (drives the
   * "clipCreated" progress ticks).
   * @returns clip references in timeline order.
   */
  chunk(source: unknown, plan: ClipPlan[], onClip?: (index: number) => void): Promise<ClipRef[]>;
}

/** Sends one clip to a speech recognizer (Wit.ai) and returns its response. */
export interface Transcriber {
  transcribe(clip: ClipRef): Promise<TranscribeResult>;
}

/** Persists subtitle output for a file. Implementations append incrementally. */
export interface OutputWriter {
  /** Clear any previous output for this file name (start fresh). */
  reset(fileName: string): Promise<void> | void;
  /** Append one formatted SRT block (already includes its trailing blank line). */
  appendSrt(fileName: string, block: string): Promise<void> | void;
  /** Append plain-text content for the .txt sidecar. */
  appendTxt(fileName: string, text: string): Promise<void> | void;
  /** Optional hook after a file is fully written (e.g. flush a download). */
  finalize?(fileName: string): Promise<void> | void;
}

/** Streams progress to the UI. */
export interface ProgressReporter {
  emit(event: ProgressEvent, payload?: unknown): void;
}

/** Rate limiter: `wait()` resolves when it is OK to make the next request. */
export interface RateLimiter {
  wait(): Promise<void>;
}

/** The full set of ports a pipeline run needs. */
export interface Ports {
  duration: DurationProvider;
  chunker: AudioChunker;
  transcriber: Transcriber;
  writer: OutputWriter;
  reporter: ProgressReporter;
  rateLimiter?: RateLimiter;
}

export type { AudioInput };

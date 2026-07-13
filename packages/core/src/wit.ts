import { WIT_ACCEPT_HEADER, WIT_SPEECH_URL, WIT_TIMEOUT_MS } from "./constants";
import type { ClipRef, TranscribeResult, WitResponse } from "./types";
import type { Transcriber } from "./ports";

/** Thrown when Wit.ai rejects the token, so a run can abort cleanly. */
export class WitAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WitAuthError";
  }
}

export interface WitTranscriberOptions {
  /** Wit.ai server access token (the user's own free token). */
  token: string;
  /** Reads a clip ref into a request body (Buffer/Uint8Array on desktop, Blob on web). */
  readClip: (clip: ClipRef) => Promise<BodyInit> | BodyInit;
  /** Endpoint. Desktop hits Wit.ai directly; web points this at its CORS proxy. */
  url?: string;
  /** Custom fetch (defaults to global fetch). */
  fetchImpl?: typeof fetch;
  /** Body content type (Wit.ai infers the codec; audio/mpeg matches mp3 clips). */
  contentType?: string;
  /** Per-request timeout. */
  timeoutMs?: number;
}

/** Perform one Wit.ai /speech request and return the parsed JSON. */
async function postSpeech(
  fetchImpl: typeof fetch,
  url: string,
  body: BodyInit,
  token: string,
  contentType: string,
  timeoutMs: number,
): Promise<WitResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      method: "POST",
      body,
      headers: {
        "Content-Type": contentType,
        Accept: WIT_ACCEPT_HEADER,
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });
    return (await res.json()) as WitResponse;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * A Transcriber backed by Wit.ai. The HTTP contract is shared across platforms;
 * only `readClip`, `url` and `fetchImpl` vary. Returns `{ text: "" }` when a
 * clip yields nothing usable or the request fails; throws WitAuthError on a bad
 * token so the pipeline stops instead of silently producing empty output.
 */
export function createWitTranscriber(opts: WitTranscriberOptions): Transcriber {
  const url = opts.url ?? WIT_SPEECH_URL;
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const contentType = opts.contentType ?? "audio/mpeg";
  const timeoutMs = opts.timeoutMs ?? WIT_TIMEOUT_MS;

  if (typeof fetchImpl !== "function") {
    throw new Error("createWitTranscriber: no fetch implementation available");
  }

  return {
    async transcribe(clip: ClipRef): Promise<TranscribeResult> {
      let json: WitResponse;
      try {
        const body = await opts.readClip(clip);
        json = await postSpeech(fetchImpl, url, body, opts.token, contentType, timeoutMs);
      } catch {
        // Network error / timeout / parse failure: skip this clip (matches the
        // original app, which logged and moved on).
        return { text: "" };
      }
      if (json && typeof json.text === "string" && json.text !== "") {
        return json;
      }
      if (json && json.code === "no-auth") {
        throw new WitAuthError(json.error || "Bad auth, check your Wit.ai token");
      }
      return { text: "" };
    },
  };
}

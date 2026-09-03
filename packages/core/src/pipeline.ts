import { RATE_LIMIT_MS } from "./constants";
import { planClips } from "./planClips";
import { fixTiming } from "./fixTiming";
import { filterText, formatSrtBlock, groupTokens } from "./subtitles";
import { createRateLimiter } from "./rateLimiter";
import { UnreadableMediaError } from "./errors";
import type { Ports } from "./ports";
import type { AudioInput, WitResponse } from "./types";

export interface Pipeline {
  /** Transcribe each input in order, writing subtitles via the OutputWriter. */
  run(inputs: AudioInput[]): Promise<void>;
  /** Request an early stop; the current run aborts at the next safe point. */
  stop(): void;
}

/**
 * The environment-agnostic orchestrator. It reproduces the original app's
 * `start` → `proccessFile` flow (plan → chunk → rate-limited transcribe →
 * pairwise fixTiming → group → write) but drives every side effect through the
 * injected {@link Ports}, so the same logic runs on desktop and in the browser.
 */
export function createPipeline(ports: Ports): Pipeline {
  const { duration, chunker, transcriber, writer, reporter } = ports;
  const rateLimiter = ports.rateLimiter ?? createRateLimiter(RATE_LIMIT_MS);

  let stopped = false;
  let subtitleCount = 0;

  const emit = (event: Parameters<typeof reporter.emit>[0], payload?: unknown) =>
    reporter.emit(event, payload);

  const generateSubtitles = async (responses: WitResponse[], idx: number, fileName: string) => {
    const tokens = fixTiming(responses, idx);
    const entries = groupTokens(tokens, subtitleCount + 1);
    for (const entry of entries) {
      const text = filterText(entry.text);
      await writer.appendSrt(fileName, formatSrtBlock({ ...entry, text }));
      await writer.appendTxt(fileName, text);
    }
    subtitleCount += entries.length;
  };

  const processFile = async (input: AudioInput, index: number) => {
    const fileName = input.name;
    await writer.reset(fileName);
    emit("currentFile", { name: fileName });

    // Step 0: split the source into clips.
    emit("step", 0);
    let durationSec: number;
    try {
      durationSec = await duration.getDurationSeconds(input.source);
    } catch (err) {
      // Ports only know the opaque source (a filesystem path on desktop), so
      // re-raise against the name the user actually sees in the file list.
      if (!(err instanceof UnreadableMediaError)) throw err;
      throw new UnreadableMediaError(fileName, {
        hasNoAudioTrack: err.hasNoAudioTrack,
        cause: err.cause,
      });
    }
    const plan = planClips(durationSec);
    // A zero-length plan means FFmpeg gave us no usable audio timeline — an
    // unreadable file, or a video-only stream. Previously this fell through and
    // wrote an empty subtitle file, which looks like a transcription failure
    // rather than a bad input.
    if (plan.length === 0) throw new UnreadableMediaError(fileName);
    const clips = await chunker.chunk(input.source, plan, () => emit("clipCreated"));
    if (stopped) return;

    // Step 1: transcribe each clip.
    emit("step", 1);
    emit("numberOfClips", clips.length);

    subtitleCount = 0;
    let idx = 1;
    let responses: WitResponse[] = [];
    for (const clip of clips) {
      if (stopped) return;
      emit("currentClip", idx);
      const t0 = Date.now();
      await rateLimiter.wait();
      const res = await transcriber.transcribe(clip);
      emit("APIHit");
      if (res && res.text !== "") {
        emit("currentSubtitle", filterText(res.text));
        responses.push(res as WitResponse);
        if (responses.length === 2) {
          await generateSubtitles(responses, idx, fileName);
          responses = [];
        }
      }
      emit("timePerClip", Date.now() - t0);
      idx += 1;
    }
    if (responses.length) {
      await generateSubtitles(responses, idx, fileName);
      responses = [];
    }

    if (writer.finalize) await writer.finalize(fileName);
    emit("fileComplete", index);
  };

  return {
    async run(inputs: AudioInput[]) {
      stopped = false;
      // Files FFmpeg could not read. Collected rather than thrown so that one
      // bad download does not cancel the rest of a long queue; reported
      // together at the end so the user gets one message, not one per file.
      const skipped: string[] = [];
      try {
        let index = 0;
        for (const input of inputs) {
          if (stopped) break;
          try {
            await processFile(input, index);
          } catch (err) {
            if (!(err instanceof UnreadableMediaError)) throw err;
            skipped.push(err.message);
            emit("fileComplete", index);
          }
          index += 1;
        }
        if (!stopped) {
          const done = inputs.length - skipped.length;
          emit(
            "error",
            skipped.length
              ? [
                  `Finished ${done} of ${inputs.length} file(s). Subtitles saved to the output folder.`,
                  "",
                  `Skipped ${skipped.length}:`,
                  ...skipped.map((m) => `\u2022 ${m}`),
                ].join("\n")
              : "All files finished. Subtitles saved to the output folder.",
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        emit("error", msg || "Error");
      } finally {
        emit("processComplete");
      }
    },
    stop() {
      stopped = true;
      emit("step", -1);
    },
  };
}

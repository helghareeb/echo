import { describe, it, expect } from "vitest";
import { createPipeline } from "../src/pipeline";
import { OFFSET_MS } from "../src/constants";
import type { Ports } from "../src/ports";
import type { WitResponse } from "../src/types";

/** Build fake ports that record everything for assertions. */
function makePorts(responses: WitResponse[]) {
  const events: Array<{ event: string; payload: unknown }> = [];
  const srt: Record<string, string> = {};
  const txt: Record<string, string> = {};

  const ports: Ports = {
    duration: { async getDurationSeconds() { return responses.length * 18; } },
    chunker: {
      async chunk(_source, plan, onClip) {
        // Produce one clip per planned clip; return their indices as refs.
        plan.forEach((p) => onClip?.(p.index));
        return plan.map((p) => p.index);
      },
    },
    transcriber: {
      async transcribe(clip) {
        return responses[clip as number] ?? { text: "" };
      },
    },
    writer: {
      reset(name) { srt[name] = ""; txt[name] = ""; },
      appendSrt(name, block) { srt[name] += block; },
      appendTxt(name, text) { txt[name] += text; },
    },
    reporter: { emit(event, payload) { events.push({ event, payload }); } },
    // No rate limiting in tests.
    rateLimiter: { async wait() {} },
  };
  return { ports, events, srt, txt };
}

describe("createPipeline", () => {
  it("runs the full flow and emits the expected event sequence", async () => {
    const responses: WitResponse[] = [
      { text: "a.", speech: { tokens: [{ token: "a", start: 0, end: 500 }] } },
      { text: "b.", speech: { tokens: [{ token: "b", start: 0, end: 500 }] } },
    ];
    const { ports, events, srt, txt } = makePorts(responses);
    const pipeline = createPipeline(ports);
    await pipeline.run([{ name: "clip.mp3", source: "/tmp/clip.mp3" }]);

    const names = events.map((e) => e.event);
    expect(names).toContain("currentFile");
    expect(names.filter((n) => n === "step")).toHaveLength(2); // step 0 then step 1
    expect(events.find((e) => e.event === "numberOfClips")?.payload).toBe(2);
    expect(names.filter((n) => n === "currentClip")).toHaveLength(2);
    expect(names.filter((n) => n === "APIHit")).toHaveLength(2);
    expect(events.find((e) => e.event === "fileComplete")?.payload).toBe(0);
    expect(names[names.length - 1]).toBe("processComplete");
  });

  it("produces correct SRT with the timeline offset and fixed timestamps", async () => {
    const responses: WitResponse[] = [
      { text: "a", speech: { tokens: [{ token: "a", start: 0, end: 500 }] } },
      { text: "b", speech: { tokens: [{ token: "b", start: 0, end: 500 }] } },
    ];
    const { ports, srt } = makePorts(responses);
    await createPipeline(ports).run([{ name: "clip.mp3", source: "x" }]);

    // Clip 0 token stays at 0-500ms; clip 1 token shifts by OFFSET_MS (17900).
    const expected =
      "1\n00:00:00,000 --> 00:00:00,500\na\n\n" +
      `2\n00:00:17,900 --> 00:00:18,400\nb\n\n`;
    expect(srt["clip.mp3"]).toBe(expected);
    // Sanity: OFFSET_MS drives the second timestamp.
    expect(OFFSET_MS).toBe(17900);
  });

  it("halts mid-run when stop() is called", async () => {
    const responses: WitResponse[] = [
      { text: "a", speech: { tokens: [{ token: "a", start: 0, end: 500 }] } },
      { text: "b", speech: { tokens: [{ token: "b", start: 0, end: 500 }] } },
      { text: "c", speech: { tokens: [{ token: "c", start: 0, end: 500 }] } },
    ];
    const { ports, events } = makePorts(responses);
    const pipeline = createPipeline(ports);
    // Stop after the first clip is transcribed.
    const original = ports.transcriber.transcribe.bind(ports.transcriber);
    ports.transcriber.transcribe = async (clip) => {
      const r = await original(clip);
      if (clip === 0) pipeline.stop();
      return r;
    };

    await pipeline.run([{ name: "x.mp3", source: "x" }]);
    const names = events.map((e) => e.event);
    // Only the first clip's currentClip was emitted; the run never completed the file.
    expect(names.filter((n) => n === "currentClip")).toHaveLength(1);
    expect(names).not.toContain("fileComplete");
    expect(names[names.length - 1]).toBe("processComplete");
  });
});

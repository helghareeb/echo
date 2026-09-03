import { describe, expect, it } from "vitest";
import { createPipeline } from "../src/pipeline";
import { UnreadableMediaError } from "../src/errors";
import type { Ports } from "../src/ports";
import type { WitResponse } from "../src/types";

/**
 * Ports whose duration probe is scripted per file name, so a run can mix good
 * and bad inputs the way a real queue does.
 */
function makePorts(durations: Record<string, number | Error>) {
  const events: Array<{ event: string; payload: unknown }> = [];
  const srt: Record<string, string> = {};

  const response: WitResponse = {
    text: "a.",
    speech: { tokens: [{ token: "a", start: 0, end: 500 }] },
  };

  const ports: Ports = {
    duration: {
      async getDurationSeconds(source) {
        const value = durations[source as string];
        if (value instanceof Error) throw value;
        return value ?? 0;
      },
    },
    chunker: {
      async chunk(_source, plan, onClip) {
        plan.forEach((p) => onClip?.(p.index));
        return plan.map((p) => p.index);
      },
    },
    transcriber: { async transcribe() { return response; } },
    writer: {
      reset(name) { srt[name] = ""; },
      appendSrt(name, block) { srt[name] += block; },
      appendTxt() {},
    },
    reporter: { emit(event, payload) { events.push({ event, payload }); } },
    rateLimiter: { async wait() {} },
  };
  return { ports, events, srt };
}

const finalMessage = (events: Array<{ event: string; payload: unknown }>) =>
  String(events.filter((e) => e.event === "error").pop()?.payload ?? "");

describe("unreadable inputs", () => {
  it("skips a zero-duration file instead of writing empty subtitles", async () => {
    const { ports, events, srt } = makePorts({ "bad": 0 });
    await createPipeline(ports).run([{ name: "bad.mp4", source: "bad" }]);

    expect(srt["bad.mp4"]).toBe("");
    expect(finalMessage(events)).toContain("bad.mp4");
    expect(finalMessage(events)).toContain("Skipped 1");
  });

  it("keeps going through the queue after a bad file", async () => {
    // The regression that matters: one video-only download in the middle of a
    // batch used to abort every file after it.
    const { ports, events, srt } = makePorts({ ok1: 18, bad: 0, ok2: 18 });
    await createPipeline(ports).run([
      { name: "ok1.m4a", source: "ok1" },
      { name: "bad.webm", source: "bad" },
      { name: "ok2.mkv", source: "ok2" },
    ]);

    expect(srt["ok1.m4a"]).not.toBe("");
    expect(srt["ok2.mkv"]).not.toBe("");
    expect(srt["bad.webm"]).toBe("");

    const msg = finalMessage(events);
    expect(msg).toContain("Finished 2 of 3");
    expect(msg).toContain("bad.webm");
  });

  it("emits fileComplete for a skipped file so progress does not stall", async () => {
    const { ports, events } = makePorts({ bad: 0, ok: 18 });
    await createPipeline(ports).run([
      { name: "bad.mp4", source: "bad" },
      { name: "ok.mp3", source: "ok" },
    ]);
    const completed = events.filter((e) => e.event === "fileComplete");
    expect(completed).toHaveLength(2);
  });

  it("surfaces the no-audio-track reason a port raised", async () => {
    const err = new UnreadableMediaError("videoonly.webm", { hasNoAudioTrack: true });
    const { ports, events } = makePorts({ v: err });
    await createPipeline(ports).run([{ name: "videoonly.webm", source: "v" }]);

    const msg = finalMessage(events);
    expect(msg).toContain("has no audio track");
    expect(msg).toContain("videoonly.webm");
  });

  it("reports the display name, not the opaque source the port saw", async () => {
    // Desktop ports raise against a filesystem path; the user picked a file
    // called "درس.mkv" and that is what the report has to say.
    const err = new UnreadableMediaError("/tmp/sada/xyz-9182.tmp", {
      hasNoAudioTrack: true,
    });
    const { ports, events } = makePorts({ "/tmp/sada/xyz-9182.tmp": err });
    await createPipeline(ports).run([
      { name: "\u062f\u0631\u0633.mkv", source: "/tmp/sada/xyz-9182.tmp" },
    ]);

    const msg = finalMessage(events);
    expect(msg).toContain("\u062f\u0631\u0633.mkv");
    expect(msg).not.toContain("xyz-9182");
    expect(msg).toContain("has no audio track");
  });

  it("still aborts the whole run on a non-media error", async () => {
    // Auth failures and the like are fatal for every remaining file; only
    // UnreadableMediaError is per-file.
    const { ports, events } = makePorts({ a: new Error("Bad auth"), b: 18 });
    await createPipeline(ports).run([
      { name: "a.mp3", source: "a" },
      { name: "b.mp3", source: "b" },
    ]);
    expect(finalMessage(events)).toBe("Bad auth");
    expect(events.filter((e) => e.event === "fileComplete")).toHaveLength(0);
  });
});

describe("UnreadableMediaError", () => {
  it("tells the two failure cases apart in its message", () => {
    expect(new UnreadableMediaError("x.mp4", { hasNoAudioTrack: true }).message)
      .toContain("no audio track");
    expect(new UnreadableMediaError("x.pdf").message)
      .toContain("could not be read");
  });

  it("names the file so a batch report is actionable", () => {
    expect(new UnreadableMediaError("درس.m4a").message).toContain("درس.m4a");
  });
});

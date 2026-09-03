import { describe, expect, it } from "vitest";
import {
  AUDIO_EXTENSIONS,
  ELECTRON_FILE_FILTERS,
  MEDIA_EXTENSIONS,
  VIDEO_EXTENSIONS,
  WEB_INPUT_ACCEPT,
  fileExtension,
  isProbablyMedia,
  isProbablyVideo,
} from "../src/formats";

describe("fileExtension", () => {
  it("lowercases and drops the dot", () => {
    expect(fileExtension("Lecture.MP4")).toBe("mp4");
    expect(fileExtension("a.b.c.OpUs")).toBe("opus");
  });

  it("returns empty string when there is no extension", () => {
    expect(fileExtension("recording")).toBe("");
    expect(fileExtension("")).toBe("");
  });
});

describe("format lists", () => {
  it("covers the formats a video downloader actually offers", () => {
    // The rows a YouTube-style downloader shows: Opus and M4A audio, plus
    // WebM/MP4 video. All four used to be rejected by the old allowlist.
    for (const ext of ["opus", "m4a", "webm", "mp4"]) {
      expect(MEDIA_EXTENSIONS).toContain(ext);
    }
  });

  it("keeps the originally supported five", () => {
    for (const ext of ["mp3", "wav", "ogg", "m4a", "flac"]) {
      expect(AUDIO_EXTENSIONS as readonly string[]).toContain(ext);
    }
  });

  it("has no duplicates between the audio and video lists", () => {
    const overlap = AUDIO_EXTENSIONS.filter((e) =>
      (VIDEO_EXTENSIONS as readonly string[]).includes(e),
    );
    expect(overlap).toEqual([]);
  });

  it("lists every extension exactly once", () => {
    expect(new Set(MEDIA_EXTENSIONS).size).toBe(MEDIA_EXTENSIONS.length);
  });

  it("stores bare extensions, without dots or wildcards", () => {
    for (const ext of MEDIA_EXTENSIONS) {
      expect(ext).toMatch(/^[a-z0-9]+$/);
    }
  });
});

describe("classification helpers", () => {
  it("recognises audio and video by name", () => {
    expect(isProbablyMedia("khutbah.opus")).toBe(true);
    expect(isProbablyVideo("lecture.mkv")).toBe(true);
    expect(isProbablyVideo("lecture.m4a")).toBe(false);
  });

  it("says nothing useful about unknown extensions", () => {
    // Not a rejection: FFmpeg probes content, so an unknown name only means the
    // name is uninformative. Nothing in the app may gate on this returning false.
    expect(isProbablyMedia("mystery.xyz")).toBe(false);
  });
});

describe("picker configuration", () => {
  it("offers an All Files escape hatch, last", () => {
    const last = ELECTRON_FILE_FILTERS[ELECTRON_FILE_FILTERS.length - 1];
    expect(last).toEqual({ name: "All Files", extensions: ["*"] });
  });

  it("advertises both wildcards and explicit extensions to the browser", () => {
    expect(WEB_INPUT_ACCEPT).toContain("audio/*");
    expect(WEB_INPUT_ACCEPT).toContain("video/*");
    // Explicit entries matter where the OS reports no MIME type for a format.
    expect(WEB_INPUT_ACCEPT).toContain(".opus");
    expect(WEB_INPUT_ACCEPT).toContain(".mkv");
  });
});

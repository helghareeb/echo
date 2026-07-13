import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { createWitTranscriber } from "@sada/core";
import { audioDuration, downloadText, fileExt } from "./media";

// The ffmpeg.wasm core is served from public/ffmpeg (copied at prebuild time by
// scripts/copy-ffmpeg-core.mjs) so it loads same-origin with no CDN dependency.
const base = import.meta.env?.BASE_URL || "/";
const coreURL = `${base}ffmpeg/ffmpeg-core.js`;
const wasmURL = `${base}ffmpeg/ffmpeg-core.wasm`;

/**
 * Browser implementations of the @sada/core ports:
 *   - <audio> metadata for duration
 *   - ffmpeg.wasm to cut clips (single-thread core; no COOP/COEP needed)
 *   - fetch to Wit.ai via the configured CORS proxy
 *   - in-memory accumulation + Blob download for output
 */

let ffmpegPromise = null;
function loadFfmpeg() {
  if (!ffmpegPromise) {
    const ff = new FFmpeg();
    ffmpegPromise = ff.load({ coreURL, wasmURL }).then(() => ff);
  }
  return ffmpegPromise;
}

export function createWebPorts({ token, proxyUrl, emit }) {
  const duration = {
    getDurationSeconds: (file) => audioDuration(file),
  };

  const chunker = {
    async chunk(file, plan, onClip) {
      const ff = await loadFfmpeg();
      const inName = `input.${fileExt(file.name)}`;
      await ff.writeFile(inName, await fetchFile(file));
      const clips = [];
      for (const p of plan) {
        const outName = `track-${p.index}.mp3`;
        // Fast seek before -i, then take `lengthSec` seconds, audio only.
        await ff.exec(["-ss", String(p.startSec), "-i", inName, "-t", String(p.lengthSec), "-vn", outName]);
        const data = await ff.readFile(outName); // Uint8Array
        clips.push(data);
        try {
          await ff.deleteFile(outName);
        } catch {
          /* ignore */
        }
        onClip?.(p.index);
      }
      try {
        await ff.deleteFile(inName);
      } catch {
        /* ignore */
      }
      return clips;
    },
  };

  const transcriber = createWitTranscriber({
    token,
    url: proxyUrl,
    readClip: (bytes) => new Blob([bytes], { type: "audio/mpeg" }),
  });

  const srt = {};
  const txt = {};
  const writer = {
    reset(name) {
      srt[name] = "";
      txt[name] = "";
    },
    appendSrt(name, block) {
      srt[name] += block;
    },
    appendTxt(name, text) {
      txt[name] += text + "\n";
    },
    finalize(name) {
      if (srt[name]) downloadText(`${name}.srt`, srt[name]);
      if (txt[name]) downloadText(`${name}.txt`, txt[name]);
    },
  };

  const reporter = { emit: (event, payload) => emit(event, payload) };

  return { duration, chunker, transcriber, writer, reporter };
}

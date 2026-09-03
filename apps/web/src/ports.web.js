import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { createWitTranscriber, UnreadableMediaError } from "@sada/core";
import {
  announcesAudioStream,
  audioDuration,
  downloadText,
  fileExt,
  parseFfmpegDuration,
} from "./media";

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

/**
 * Ask ffmpeg.wasm what a file actually is.
 *
 * Used when `<audio>` metadata came back empty, which happens for every
 * container the browser itself cannot demux — Matroska anywhere, Opus/FLAC on
 * Safari, and most video containers — even though FFmpeg reads all of them.
 * Without this, such a file yielded duration 0, `planClips` returned an empty
 * plan, and the run produced an empty subtitle file with no explanation.
 *
 * There is no ffprobe in the wasm build, so we run `-i` with no output (which
 * exits non-zero by design, "At least one output file must be specified") and
 * read the report FFmpeg prints while parsing the input.
 *
 * @returns {Promise<{ durationSec: number, hasAudio: boolean }>}
 */
async function probeWithFfmpeg(ff, name, file) {
  let durationSec = 0;
  let hasAudio = false;
  const onLog = ({ message }) => {
    durationSec = durationSec || parseFfmpegDuration(message);
    hasAudio = hasAudio || announcesAudioStream(message);
  };

  ff.on("log", onLog);
  try {
    await ff.writeFile(name, await fetchFile(file));
    try {
      await ff.exec(["-i", name]);
    } catch {
      // Expected: `-i` with no output file always exits non-zero. The log we
      // needed has already been emitted by then.
    }
  } finally {
    ff.off("log", onLog);
  }
  return { durationSec, hasAudio };
}

export function createWebPorts({ token, proxyUrl, emit }) {
  const duration = {
    async getDurationSeconds(file) {
      // Cheap path first: the browser's own demuxer, when it knows the format.
      const fromBrowser = await audioDuration(file);
      if (fromBrowser > 0) return fromBrowser;

      // Otherwise fall back to FFmpeg, which reads far more than any browser.
      const ff = await loadFfmpeg();
      const inName = `probe.${fileExt(file.name)}`;
      let probe;
      try {
        probe = await probeWithFfmpeg(ff, inName, file);
      } finally {
        try {
          await ff.deleteFile(inName);
        } catch {
          /* ignore */
        }
      }

      if (!probe.hasAudio) {
        throw new UnreadableMediaError(file.name, {
          hasNoAudioTrack: probe.durationSec > 0,
        });
      }
      if (!(probe.durationSec > 0)) throw new UnreadableMediaError(file.name);
      return probe.durationSec;
    },
  };

  const chunker = {
    async chunk(file, plan, onClip) {
      const ff = await loadFfmpeg();
      // The extension only hints at the demuxer; FFmpeg probes content anyway.
      const inName = `input.${fileExt(file.name)}`;
      await ff.writeFile(inName, await fetchFile(file));
      const clips = [];
      for (const p of plan) {
        const outName = `track-${p.index}.mp3`;
        // Fast seek before -i, then take `lengthSec` seconds. `-vn` drops the
        // video track, which is what lets a video file be transcribed directly.
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

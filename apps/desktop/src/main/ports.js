import fs from "fs";
import path from "path";
import { createWitTranscriber, UnreadableMediaError } from "@sada/core";
import { ffmpeg } from "./ffmpeg";

/**
 * Desktop implementations of the @sada/core ports:
 *   - ffprobe for duration
 *   - ffmpeg to cut clips into a temp dir
 *   - Node fetch (reading clip bytes from disk) for Wit.ai
 *   - fs append for .srt/.txt output
 *   - an IPC-backed progress reporter
 */

/**
 * Duration of the *audio* in a file, via ffprobe.
 *
 * ffprobe reads any container FFmpeg can demux, so this works unchanged for
 * video files — we just want the timeline the audio track sits on. Two failure
 * modes are turned into an UnreadableMediaError naming the file, because both
 * otherwise end as a silently empty subtitle file:
 *
 *  - ffprobe cannot parse it at all (not media);
 *  - it parses but has no audio stream (a video-only download).
 *
 * `format.duration` is missing on some containers even when the streams are
 * fine, so fall back to the audio stream's own duration before giving up.
 */
export function getDurationSeconds(filePath, fileName = filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(new UnreadableMediaError(fileName, { cause: err }));

      const streams = metadata?.streams || [];
      const audio = streams.find((s) => s.codec_type === "audio");
      if (!audio) {
        return reject(new UnreadableMediaError(fileName, { hasNoAudioTrack: true }));
      }

      const duration = Number(metadata?.format?.duration) || Number(audio.duration) || 0;
      if (!Number.isFinite(duration) || duration <= 0) {
        return reject(new UnreadableMediaError(fileName));
      }
      resolve(duration);
    });
  });
}

/**
 * Cut one clip out of the source as mp3.
 *
 * `.noVideo()` is what makes video input work: the picture (and any subtitle or
 * data streams) is dropped and only the audio is re-encoded, so an .mkv lecture
 * costs the same here as the .m4a of its soundtrack would.
 */
function extractClip({ input, start, length, output }) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(input)
      .setStartTime(start)
      .setDuration(length)
      .noVideo()
      .on("end", () => resolve())
      .on("error", reject)
      .saveToFile(output);
  });
}

export function createDesktopPorts({ token, outputDir, tmpDir, sendProgress }) {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(tmpDir, { recursive: true });

  const duration = {
    getDurationSeconds: (source) => getDurationSeconds(source),
  };


  const chunker = {
    async chunk(source, plan, onClip) {
      const clips = [];
      for (const clipPlan of plan) {
        const output = path.join(tmpDir, `track-${clipPlan.index}.mp3`);
        try {
          await extractClip({
            input: source,
            start: clipPlan.startSec,
            length: clipPlan.lengthSec,
            output,
          });
          clips.push(output);
          onClip?.(clipPlan.index);
        } catch (err) {
          // Skip a clip that failed to extract rather than aborting the file.
          console.error("clip extract failed", output, err);
        }
      }
      return clips;
    },
  };

  const transcriber = createWitTranscriber({
    token,
    readClip: (clipPath) => fs.readFileSync(clipPath),
  });

  const writer = {
    reset(name) {
      for (const ext of [".srt", ".txt"]) {
        const p = path.join(outputDir, `${name}${ext}`);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
    },
    appendSrt(name, block) {
      fs.appendFileSync(path.join(outputDir, `${name}.srt`), block);
    },
    appendTxt(name, text) {
      fs.appendFileSync(path.join(outputDir, `${name}.txt`), text + "\n");
    },
  };

  const reporter = {
    emit(event, payload) {
      sendProgress(event, payload);
    },
  };

  return { duration, chunker, transcriber, writer, reporter };
}

export function cleanTmp(tmpDir) {
  try {
    for (const f of fs.readdirSync(tmpDir)) {
      if (f.endsWith(".mp3")) fs.unlinkSync(path.join(tmpDir, f));
    }
  } catch {
    /* ignore */
  }
}

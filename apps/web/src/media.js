/** Browser media helpers used by the web ports and bridge. */

export function fileExt(name) {
  const m = /\.([a-z0-9]+)$/i.exec(name || "");
  return m ? m[1].toLowerCase() : "mp3";
}

/**
 * Parse `Duration: HH:MM:SS.ss` out of an FFmpeg log line.
 *
 * FFmpeg reports duration on stderr rather than through any API, so this is the
 * only way to get it from ffmpeg.wasm — there is no ffprobe in the wasm build.
 * Returns 0 when the line is not a duration line or reads `N/A`.
 */
export function parseFfmpegDuration(line) {
  const m = /Duration:\s*(\d+):(\d{2}):(\d{2})\.(\d+)/.exec(line || "");
  if (!m) return 0;
  const [, h, min, sec, frac] = m;
  return (
    Number(h) * 3600 + Number(min) * 60 + Number(sec) + Number(`0.${frac}`)
  );
}

/** True when an FFmpeg log line announces an audio stream. */
export function announcesAudioStream(line) {
  return /Stream #\d+:\d+.*:\s*Audio:/.test(line || "");
}

/**
 * Read a file's duration (seconds) from `<audio>` metadata only — no decode.
 *
 * Fast and free when it works, but it only works for what *this browser* can
 * demux: Chrome will not touch Matroska, Safari will not touch Opus or FLAC,
 * and none of them handle the long tail FFmpeg does. A 0 here therefore means
 * "ask ffmpeg.wasm", not "bad file" — see probeWithFfmpeg in ports.web.js.
 */
export function audioDuration(file) {
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    const url = URL.createObjectURL(file);
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(audio.duration) ? audio.duration : 0);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
    audio.src = url;
  });
}

/** Trigger a browser download of text content. */
export function downloadText(filename, content) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Input formats Sada accepts.
 *
 * Sada never decodes media itself: both platforms delegate to FFmpeg — a full
 * static build on desktop (`@ffmpeg-installer/ffmpeg`), ffmpeg.wasm in the
 * browser — and FFmpeg identifies a file by *probing its content*, not by its
 * extension. A file named `lecture.xyz` that is really Ogg/Opus decodes fine; a
 * `lecture.mp3` that is really a JPEG does not.
 *
 * So the lists below are **hints, not gates**. They populate the "Media files"
 * entry in the native file dialog and the browser's file picker so the common
 * case is one click, while every picker keeps an "All files" escape hatch and
 * the pipeline reports a clear per-file error when FFmpeg finds no audio it can
 * read.
 *
 * This distinction matters because extension allowlists used to be the real
 * gate: a five-entry list (`mp3, wav, ogg, m4a, flac`) rejected `.opus`,
 * `.webm`, `.mp4` and every video container, none of which the bundled FFmpeg
 * ever had trouble with. Widening a list is not the fix — not gating on the
 * list is.
 *
 * Every extension here was verified against the demuxers actually compiled into
 * the bundled FFmpeg builds; see docs/FORMATS.md.
 */

/** Audio containers/codecs, as bare lowercase extensions (no leading dot). */
export const AUDIO_EXTENSIONS = [
  // mainstream
  "mp3", "m4a", "m4b", "m4r", "aac", "wav", "wave", "ogg", "oga", "opus",
  "flac", "wma", "aiff", "aif", "aifc", "caf", "amr", "awb",
  // lossless / archival
  "alac", "ape", "wv", "tta", "tak", "shn", "w64",
  // broadcast / surround
  "ac3", "eac3", "dts", "dtshd", "thd", "mlp", "mp2", "mpa", "m2a",
  // misc but real
  "mka", "weba", "spx", "mpc", "au", "snd", "voc", "gsm", "ra", "oma", "aa3",
  "3ga", "sln", "dss", "sph", "8svx",
] as const;

/**
 * Video containers. Sada extracts the audio track and discards the picture, so
 * these are as usable as any audio file — a downloaded lecture video needs no
 * conversion step first.
 */
export const VIDEO_EXTENSIONS = [
  // mainstream
  "mp4", "m4v", "mov", "qt", "mkv", "webm", "avi", "wmv", "asf", "flv", "f4v",
  // broadcast / DVD / camera
  "mpg", "mpeg", "mpe", "m1v", "m2v", "ts", "m2ts", "mts", "m2t", "vob",
  "3gp", "3g2", "dv", "dif", "mxf", "wtv",
  // open / misc
  "ogv", "ogx", "nut", "ivf", "y4m", "rm", "rmvb", "divx", "amv", "mjpg", "mjpeg",
] as const;

/** Everything Sada will happily open. */
export const MEDIA_EXTENSIONS: readonly string[] = [
  ...AUDIO_EXTENSIONS,
  ...VIDEO_EXTENSIONS,
];

/**
 * `accept` for a browser `<input type="file">`.
 *
 * The `audio/*` and `video/*` wildcards do most of the work; the explicit
 * extensions cover files the OS has no MIME mapping for (`.opus` and `.mkv` are
 * common offenders on Windows), which would otherwise be greyed out in the
 * picker despite decoding perfectly.
 */
export const WEB_INPUT_ACCEPT = [
  "audio/*",
  "video/*",
  ...MEDIA_EXTENSIONS.map((e) => `.${e}`),
].join(",");

/**
 * Filters for Electron's `dialog.showOpenDialog`.
 *
 * "All Files" is deliberately included and deliberately last: extensions are a
 * convenience, and a user with a correctly-encoded file under an unusual name
 * must still be able to select it.
 */
export const ELECTRON_FILE_FILTERS = [
  { name: "Media files", extensions: [...MEDIA_EXTENSIONS] },
  { name: "Audio", extensions: [...AUDIO_EXTENSIONS] },
  { name: "Video", extensions: [...VIDEO_EXTENSIONS] },
  { name: "All Files", extensions: ["*"] },
];

/** Lowercase extension of a file name, without the dot ("" when there is none). */
export function fileExtension(name: string): string {
  const m = /\.([A-Za-z0-9]+)$/.exec(name || "");
  return m ? m[1].toLowerCase() : "";
}

/**
 * Whether a name *looks* like media Sada can read.
 *
 * Only ever used to sort or hint — never to reject. An unknown extension means
 * "we cannot tell from the name", which is not the same as "we cannot read it",
 * and the only component entitled to say a file is unreadable is FFmpeg.
 */
export function isProbablyMedia(name: string): boolean {
  return MEDIA_EXTENSIONS.includes(fileExtension(name));
}

/** Whether a name looks like a video container (audio gets extracted from it). */
export function isProbablyVideo(name: string): boolean {
  return (VIDEO_EXTENSIONS as readonly string[]).includes(fileExtension(name));
}

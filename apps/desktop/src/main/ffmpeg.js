import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";

/**
 * In a packaged app the installer binaries live under `app.asar.unpacked`
 * (see `asarUnpack` in electron-builder.yml). The installer packages report a
 * path inside `app.asar`, so rewrite it. In dev the path already points at a
 * real file and the replace is a no-op.
 */
function unpacked(p) {
  return p.replace("app.asar", "app.asar.unpacked");
}

export const ffmpegPath = unpacked(ffmpegInstaller.path);
export const ffprobePath = unpacked(ffprobeInstaller.path);

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

export { ffmpeg };

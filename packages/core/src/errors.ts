/**
 * Errors that describe *one bad input* rather than a broken run.
 *
 * The distinction matters to `createPipeline`: a Wit.ai auth failure is fatal
 * for every remaining file and must stop the run, whereas a single unreadable
 * file should be reported and stepped over so the other twenty in the queue
 * still get transcribed.
 */

/**
 * FFmpeg could not find audio it can decode in this input.
 *
 * The two cases worth telling apart in the message, because the user's next
 * action differs:
 *
 *  - **Not media at all** (a PDF renamed to .mp3): pick a different file.
 *  - **Media with no audio track**: re-download. This is the common trap with
 *    YouTube-style downloaders, whose high-resolution MP4/WebM rows are
 *    *video-only* streams — 4K of picture and not one sample of sound. They
 *    look like the best option in the list and transcribe to nothing.
 */
export class UnreadableMediaError extends Error {
  /** Name of the input that failed, for a message that says which file. */
  readonly fileName: string;
  /** True when the container parsed but carries no audio stream. */
  readonly hasNoAudioTrack: boolean;
  /**
   * The underlying failure, when there was one.
   *
   * Declared explicitly rather than passed to `super(msg, { cause })`: the
   * package targets ES2020, whose `Error` predates the `cause` option. Bumping
   * the target to ES2022 for one field would change the emitted output of every
   * consumer, which is not a trade worth making here.
   */
  readonly cause?: unknown;

  constructor(fileName: string, opts: { hasNoAudioTrack?: boolean; cause?: unknown } = {}) {
    const noAudio = opts.hasNoAudioTrack ?? false;
    super(
      noAudio
        ? `"${fileName}" has no audio track. If it came from a video downloader, ` +
          `pick an audio row (M4A/Opus) or a video row that is not marked "video only".`
        : `"${fileName}" could not be read as audio or video.`,
    );
    this.name = "UnreadableMediaError";
    this.fileName = fileName;
    this.hasNoAudioTrack = noAudio;
    if (opts.cause !== undefined) this.cause = opts.cause;
  }
}

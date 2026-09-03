# Supported input formats

**Short answer: give Sada any audio or video file.** If FFmpeg can read it,
Sada can transcribe it, and Sada carries its own FFmpeg on both platforms.

## Why there is no format list to satisfy

Sada does not decode media itself. It hands every file to FFmpeg — a full static
build on the desktop (`@ffmpeg-installer/ffmpeg`), `ffmpeg.wasm` in the browser —
and **FFmpeg identifies a file by probing its contents, not by its extension.**

That is not a detail; it is the whole design. A file named `lecture.xyz` that is
really Ogg/Opus transcribes fine. A file named `lecture.mp3` that is really a
JPEG does not. So an extension allowlist can only ever be wrong in both
directions, and Sada does not gate on one:

- The dropzone accepts **anything** you drop on it.
- The file dialogs list Media / Audio / Video for convenience, and always end
  with **All Files**.
- The only component that may reject an input is FFmpeg, which does so with a
  message naming the file and the reason.

## What that covers in practice

Audio containers and codecs, verified against the demuxers compiled into the
bundled builds:

> MP3 · M4A / M4B · AAC · WAV · Opus · Ogg Vorbis · FLAC · ALAC · WMA · AIFF ·
> CAF · AMR · APE · WavPack · TTA · TAK · Shorten · AC-3 / E-AC-3 · DTS ·
> TrueHD / MLP · Speex · Musepack · AU · VOC · GSM · RealAudio · ATRAC

Video containers — the audio track is extracted and the picture discarded, so a
downloaded lecture needs no conversion step first:

> MP4 / M4V · MOV · MKV · WebM · AVI · WMV / ASF · FLV · MPEG-PS / MPEG-TS ·
> M2TS / MTS · VOB · 3GP / 3G2 · DV · MXF · OGV · RealMedia · Y4M · NUT · WTV

The lists in `packages/core/src/formats.ts` exist to populate file pickers, not
to decide what is readable. Adding an extension there widens the *convenience
filter*; it does not widen what Sada accepts, because nothing was being turned
away for want of an entry.

## The one trap worth knowing: video-only downloads

Downloaders that list a video's available streams usually offer two kinds of
row, and the distinction is easy to miss:

| Row | Contains | Use for transcription? |
|-----|----------|------------------------|
| `Audio M4A 134`, `Audio OPUS 161` | audio only | **Yes — best choice** |
| `MP4 360` (no mute icon) | video **+** audio | Yes, but a bigger download |
| `MP4 2160 🔇`, `WEBM 1080 🔇` | **video only, no sound** | No — transcribes to nothing |

The high-resolution rows are almost always *video-only* streams: the downloader
marks them with a crossed-out speaker. They look like the best option in the
list and contain not one sample of audio.

Sada now detects this at the source. A file with no audio track is flagged in
the file list before you start, and named in the run report:

> `"lecture.webm" has no audio track. If it came from a video downloader, pick
> an audio row (M4A/Opus) or a video row that is not marked "video only".`

**Which row to pick:** an audio-only row, and the bitrate barely matters. Wit.ai
resamples everything to 16 kHz mono, and Sada re-encodes each 18-second clip to
MP3 before uploading, so a 134 kbps M4A and a 320 kbps one transcribe
identically — the smaller file just downloads faster. Prefer M4A when you want
the most universally playable file, Opus when you want the smallest.

## Notes per platform

**Desktop** streams from disk and re-seeks per clip, so file size is not a
constraint — a three-hour MKV is fine.

**Browser** loads the whole file into ffmpeg.wasm's virtual filesystem, which is
memory-bound. Large video files (roughly 1 GB and up) can exhaust the tab. When
transcribing long video in the browser, download an audio-only version, or use
the desktop app.

**Duration probing** differs, and it is why some formats used to fail silently
in the browser: the web app first asks the browser for the file's duration via
an `<audio>` element, which only works for formats *that browser* can demux
(Chrome will not touch Matroska; Safari will not touch Opus or FLAC). When that
returns nothing, Sada falls back to probing with ffmpeg.wasm instead of treating
the file as empty.

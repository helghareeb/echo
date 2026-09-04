# Sada on mobile — design note

**Status: exploration, not committed work.** Nothing here has been built. This
records what was established on 2026-09-04 so the next person to pick it up
starts from findings rather than from guesses.

The short version: a mobile Sada is feasible and the core needs no changes, but
the hardest problems are not the ones you would expect, and one of them is not a
programming problem at all.

---

## 1. Mobile does not need FFmpeg

This is the finding that reframes the project.

The desktop app carries a 66 MB static FFmpeg to do three things: decode
arbitrary containers, cut 18-second clips, and re-encode each clip to MP3. The
obvious mobile equivalent was [FFmpegKit](https://github.com/arthenica/ffmpeg-kit)
— which **is dead**. It was retired on 6 January 2025 and its prebuilt binaries
were removed from Maven Central, CocoaPods and npm on 1 April 2025; builds that
reference them now fail with a 404. One stated reason was codec patent exposure
after MPEG LA's acquisition by Via-LA
([announcement](https://tanersener.medium.com/saying-goodbye-to-ffmpegkit-33ae939767e1)).

That blocker disappears entirely, because **Wit.ai accepts raw PCM**:

```
Content-Type: audio/raw;encoding=signed-integer;bits=16;rate=16000;endian=little
```

and both mobile platforms decode audio to PCM natively — `AVAudioFile` /
`AVAssetReader` + `AVAudioConverter` on iOS, `MediaExtractor` + `MediaCodec` on
Android. So the mobile pipeline becomes:

```
native decode → 16 kHz mono PCM → slice into 18 s chunks → POST the bytes
```

Slicing PCM is arithmetic on a byte array. There is no encode step, no WASM, no
32 MB core to download, and no third-party media library to depend on. The
mobile audio path is **simpler than the desktop one**.

> ⚠️ **Gotcha that will cost you an afternoon.** Wit.ai rejects that header if
> the HTTP client inserts spaces after the semicolons — which many clients do by
> default — with `Unsupported content-type`. See
> [wit-ai/wit#1617](https://github.com/wit-ai/wit/issues/1617). Send the value
> byte-for-byte as above.

## 2. …but raw PCM costs 8× the upload

This is the tradeoff, and for Sada's audience it is a serious one. 16 kHz
16-bit mono PCM is 32 kB per second, against roughly 4 kB/s for the 32 kbps mono
MP3 the desktop app sends today.

| Recording | Clips | PCM upload | MP3 upload | Minimum wall-clock¹ |
|---|---:|---:|---:|---:|
| 10 min voice note | 34 | 19.6 MB | 2.4 MB | 0.7 min |
| 1 hour lecture | 200 | **115.2 MB** | 14.4 MB | 4.0 min |
| 3 hour lecture | 600 | **345.6 MB** | 43.2 MB | 12.0 min |

¹ `RATE_LIMIT_MS` (1200 ms) × clip count — the floor imposed by our own
free-tier pacing, before network latency. Real runs are longer.

115 MB to transcribe one lecture is not acceptable on a metered mobile plan,
which is exactly what much of the intended audience is using. **This is the
question to answer before writing any mobile code** (see §6): if Wit.ai accepts
a compressed format that both platforms can encode with their built-in hardware
encoders — AAC is the obvious candidate, since neither OS ships an MP3 encoder
for general use — then mobile gets small uploads *and* no FFmpeg, and the design
is settled. If it does not, PCM still works, but the app needs a Wi-Fi-only
default and honest warnings about data use.

## 3. What is reusable, and what is not

| Package | Reusable on mobile? | Why |
|---|---|---|
| `packages/core` | ✅ **entirely, unchanged** | Pure TypeScript, no DOM, no Node. Clip planning, timeline stitching, subtitle grouping and the Wit.ai client are all platform-agnostic by construction. |
| `packages/ui` | ❌ **no** | React DOM components. React Native uses different primitives; this is a rewrite, not a port. |
| `apps/desktop` | ❌ | Electron and native binaries. |
| `services/wit-proxy` | ❌ not needed | It exists only to solve browser CORS. Native HTTP has no CORS. |

Two details make the core genuinely drop-in rather than merely "portable in
principle":

- `ClipRef` is deliberately `unknown` (`packages/core/src/types.ts`). A clip is a
  file path on desktop and a `Blob` on web; on mobile it can be a byte range with
  no core change.
- `createWitTranscriber` already takes `contentType` and `readClip` as options
  (`packages/core/src/wit.ts`). Switching from `audio/mpeg` to `audio/raw;…` is a
  **call-site argument**, not an edit to the core.

## 4. The ports a mobile adapter must implement

From `packages/core/src/ports.ts`. A mobile app implements these six and gets
the whole pipeline:

| Port | Mobile implementation |
|---|---|
| `DurationProvider` | `AVAsset.duration` (iOS) / `MediaMetadataRetriever` (Android). |
| `AudioChunker` | Decode once to 16 kHz mono PCM, then hand out byte ranges per `ClipPlan`. Clips are 18 s with a 100 ms overlap; the planner already emits the offsets. |
| `Transcriber` | `createWitTranscriber` from the core, with the platform's HTTP client and the PCM content type. **Reused, not rewritten.** |
| `OutputWriter` | Write `.srt`/`.txt` to app storage, then offer the system share sheet. Mobile has no "output folder" concept — this is a UX change, not just an adapter. |
| `ProgressReporter` | Push to whatever state layer the UI uses. |
| `RateLimiter` | The core's existing limiter works as-is. |

The chunker is the only one with real work in it, and it is the one that no
longer needs FFmpeg.

## 5. Platform notes

**Android — the better first target.** $25 once, no annual fee, real background
execution (a foreground service can keep a long transcription alive), and it is
where most of the intended audience is. `MediaCodec` has had an Opus encoder
since API 29, which may matter for §6.

**iOS — more expensive and more constrained.** $99/year, forever, while the
desktop app currently ships unsigned precisely because certificates cost too
much. Background execution is far more restricted; a multi-minute run will fight
the OS unless it is modelled as a proper background task.

**PWA — do not rely on it for iOS.** The obvious cheap experiment is to make
`apps/web` installable, since it already runs the full pipeline. It does use the
single-threaded `@ffmpeg/core` with no COOP/COEP headers, which is the right
build for iOS compatibility. But developers report `RangeError: Out of Memory`
on the `ffmpeg.load()` call itself on iPhones — before any file is opened
([ffmpeg.wasm#299](https://github.com/ffmpegwasm/ffmpeg.wasm/issues/299)) — and
iOS home-screen web apps get **no background processing**, so the table in §2
means the user must keep the phone awake and the app foregrounded for four
minutes to transcribe an hour. As an Android probe a PWA is reasonable. As an
iOS strategy it is likely to fail on exactly the phones you most want to
impress, and teach you the wrong lesson.

## 6. Open questions — answer these before writing code

1. **Which compressed content types does Wit.ai accept?** The single most
   important question, because §2 depends on it. `audio/mpeg` and `audio/raw`
   are confirmed in use. If AAC (or Ogg/Opus) is accepted, encode on-device with
   the platform's hardware encoder and the data problem disappears. Verify by
   experiment against the real endpoint, not by reading blogs.
2. **Does the 100 ms clip overlap survive re-chunking from PCM?** The stitcher
   de-duplicates tokens at boundaries assuming clips advance by exactly
   `OFFSET_MS` (17 900 ms). Byte-range slicing should reproduce this precisely —
   more precisely than FFmpeg seeking, in fact — but it must be tested against
   the existing fixtures in `packages/core/test`.
3. **How does a phone handle a 3-hour file?** Decoding to PCM in memory is
   345 MB of samples. It needs streaming decode-and-upload, not decode-then-send.
4. **Is Wit.ai a safe long-term bet?** No deprecation notice exists as of
   2026-09-04 and it still powers Meta's Voice SDK — but that is absence of bad
   news, not a guarantee, and it is the product's single point of failure. The
   `conversionEngine` setting already exists with only `"wit"` in it; a second
   engine is the real insurance, on every platform.

## 7. The blocker that is not technical

**The Wit.ai token.** It is already the worst friction point on desktop — the
whole reason the first-run guide exists — and on a phone it is far worse: sign
in to Meta for Developers, create an app, find *Server Access Token* in a
settings page never designed for a small screen, copy it between apps.

For a mobile-first, non-technical, Arabic-speaking audience, this is the most
likely reason a mobile Sada would fail, and no amount of native code fixes it.
It deserves to be solved before the platform question is even asked — and
solving it would improve the desktop app for the same effort.

## 8. Recommendation

1. Ship v1.1.0 and **watch real users meet the token step**. If it defeats them
   on desktop, it will defeat them on mobile.
2. Answer open question 1 with a five-line experiment against the Wit.ai
   endpoint. It determines the whole mobile audio design.
3. If mobile still looks worth it: **Android first**, native, PCM or AAC per (2),
   reusing `packages/core` untouched.
4. Treat iOS as a separate decision with a recurring cost attached.

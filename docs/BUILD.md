# Building & packaging Sada

## Prerequisites

- Node.js **>= 18**
- [pnpm](https://pnpm.io) (`npm i -g pnpm`)

## Development

```bash
pnpm install
pnpm build              # compile @sada/core to dist/
pnpm dev:desktop        # electron-vite dev server + Electron window
```

> The desktop dev app needs a real graphical session. In headless/CI
> environments the renderer/GPU processes will crash to open a window — that is
> expected and not a code error.

## Producing installers

```bash
pnpm --filter @sada/desktop dist        # current OS
pnpm --filter @sada/desktop dist:win    # Windows (nsis + portable)
pnpm --filter @sada/desktop dist:mac    # macOS (dmg)  — must run on macOS
pnpm --filter @sada/desktop dist:linux  # Linux (AppImage + deb)
```

Output lands in `apps/desktop/release/`.

### ffmpeg binaries

The ffmpeg/ffprobe binaries come from `@ffmpeg-installer/ffmpeg` and
`@ffprobe-installer/ffprobe`. They are kept **unpacked** from the asar archive
(`asarUnpack` in `electron-builder.yml`) and their runtime path is rewritten
from `app.asar` to `app.asar.unpacked` in `src/main/ffmpeg.js`.

### Code signing

Builds are **unsigned** by default:

- **Windows** — SmartScreen may warn ("Windows protected your PC" → *More info* →
  *Run anyway*). To sign, provide a code-signing certificate via electron-builder
  env vars (`CSC_LINK`, `CSC_KEY_PASSWORD`).
- **macOS** — Gatekeeper will block first launch (right-click → *Open*, or
  `xattr -dr com.apple.quarantine /Applications/Sada.app`). To sign & notarize,
  set an Apple Developer ID (`CSC_LINK`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`,
  `APPLE_TEAM_ID`).

Cross-OS note: macOS installers must be built on macOS (native binaries +
notarization). CI uses a `macos-latest` runner for that.

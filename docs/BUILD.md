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
pnpm --filter @sada/desktop dist            # current OS
pnpm --filter @sada/desktop dist:win        # Windows (nsis + portable)
pnpm --filter @sada/desktop dist:mac        # macOS (dmg)  — must run on macOS
pnpm --filter @sada/desktop dist:linux      # Linux (AppImage + deb)
pnpm --filter @sada/desktop dist:linux:rpm  # Linux (rpm)  — best effort, see below
```

Output lands in `apps/desktop/release/`.

Every one of those scripts goes through `build/dist.cjs` rather than calling
`electron-builder` directly. That wrapper exists for one reason: electron-builder
reads the Electron version from `<projectDir>/node_modules/electron/package.json`
and does **not** walk up the tree. Because `.npmrc` sets `node-linker=hoisted`,
every dependency lives in the workspace root instead, so the lookup misses and
packaging dies with *"Cannot compute electron version from installed node
modules"*. The wrapper resolves the version the way Node does — walking up — and
passes it in. Hard-coding it in `electron-builder.yml` would work right up until
someone bumps the devDependency.

### ffmpeg binaries — the cross-architecture trap

The ffmpeg/ffprobe binaries come from `@ffmpeg-installer/ffmpeg` and
`@ffprobe-installer/ffprobe`. They are kept **unpacked** from the asar archive
(`asarUnpack` in `electron-builder.yml`) and their runtime path is rewritten
from `app.asar` to `app.asar.unpacked` in `src/main/ffmpeg.js`.

The part that bites: those packages resolve their binary as
`@ffmpeg-installer/${os.platform()}-${os.arch()}` **at runtime, on the user's
machine**. A package manager installs only the optional package matching the
*build* host. GitHub's `macos-latest` runner is arm64, so a mac build there put
arm64 binaries inside **both** disk images — including the x64 one that Intel Mac
users download. Those users got a main process that threw
`Unsupported platform/architecture` before a window ever opened. It is a total,
silent failure: the build is green, the installer works, the app never starts.

Three pieces keep that from recurring:

| Piece | Job |
|---|---|
| `pnpm.supportedArchitectures` (root `package.json`) | Installs **every** target's ffmpeg/ffprobe on **every** build machine, so the needed binary is always present to be packaged. |
| `apps/desktop/build/afterPack.cjs` | Runs per (platform, arch) and deletes the binaries that artifact cannot use — they are ~140 MB a pair — then **fails the build** if the one it does need is absent. |
| `scripts/verify-artifacts.mjs` | Post-build gate in CI: asserts each staged bundle contains exactly one platform build, that it matches the artifact, and that the binary is present, plausibly sized and executable. |

If you add a target architecture, add it to `supportedArchitectures` and to the
`expectedFor()` map in `verify-artifacts.mjs`.

### Linux specifics

**Icons must be a directory.** `linux.icon` points at `build/icons/`, which holds
`16x16.png` … `512x512.png` generated from `build/icon.svg`. Handed a single PNG,
electron-builder cannot determine the size and installs it to
`hicolor/0x0/apps/`, which is not a real icon directory — the desktop entry then
finds no icon and the app shows a blank placeholder in the applications menu.

To regenerate them after editing `icon.svg`:

```bash
cd apps/desktop/build
for s in 16 32 48 64 128 256 512; do
  inkscape icon.svg -w $s -h $s -o icons/${s}x${s}.png
done
```

**The `.desktop` map is flat.** In electron-builder 24, `linux.desktop` keys are
written straight into the file; a nested `entry:` block is serialised as the
literal `entry=[object Object]`. `Comment` and `Categories` are owned by
`linux.description` and `linux.category` and cannot be overridden from that map —
which is why `description` is kept to **one line**. A multi-line `Comment=` makes
the whole entry unparseable and the launcher silently drops the app. Verify with
`desktop-file-validate` after changing any of it.

**rpm is best effort.** The `fpm` build electron-builder bundles dates from 2016
and fails against `rpm >= 6` (it defines `buildroot` where modern rpm expects
`%buildroot`, so every file lands somewhere rpmbuild does not look). It builds
fine on the older rpm in `ubuntu-latest`, so CI attempts it in a separate step
marked `continue-on-error` — a missing `.rpm` must never cost everyone else their
`.deb` and `.AppImage`. Locally it needs `sudo apt install rpm` and, on rpm 6, a
`sudo rpmdb --initdb` first.

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

### Signing in CI (recommended once you have a certificate)

The release workflow reads these **repository secrets** and signs automatically
when they are present (otherwise it builds unsigned):

| Secret | Purpose |
|--------|---------|
| `CSC_LINK` | base64 of your `.pfx`/`.p12` code-signing certificate (Windows + macOS) |
| `CSC_KEY_PASSWORD` | certificate password |
| `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` | macOS notarization |

Add them under **Settings → Secrets and variables → Actions**, then push a
version tag — the resulting installers will be signed (and macOS notarized).

> Note: a code-signing certificate must be purchased from a CA (e.g. DigiCert,
> Sectigo) or, for macOS, requires a paid Apple Developer account. Self-signed
> certificates do **not** remove SmartScreen/Gatekeeper warnings.

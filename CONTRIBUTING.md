# Contributing to Sada · المساهمة في صدى

Thanks for helping restore and improve Sada! 🎉

## Getting started

```bash
pnpm install
pnpm build         # build @sada/core
pnpm test          # run the core unit tests
pnpm dev:desktop   # launch the desktop app in dev mode
```

## Project layout

- `packages/core` — the environment-agnostic transcription pipeline (TypeScript).
  **All transcription logic lives here** and is covered by unit tests
  (`pnpm --filter @sada/core test`). If you change timing/subtitle behavior, add
  or update a test with a fixture.
- `apps/desktop` — Electron app. The renderer talks to the OS only through the
  `window.sada` bridge exposed by `src/preload/index.js`.
- `apps/web` / `services/wit-proxy` — browser target (in progress).

## Guidelines

- Keep platform-specific code in the app layer; keep pure logic in `core` behind
  the `Ports` interfaces.
- Run `pnpm test` before opening a PR. Add tests for behavior changes.
- Match the existing code style (Prettier defaults). Keep commits focused.
- The renderer must never gain direct Node/Electron access — extend the bridge
  instead, keeping `contextIsolation` on.

## Reporting issues

Open an issue with your OS, the audio format, and steps to reproduce. Never paste
your Wit.ai token into an issue.

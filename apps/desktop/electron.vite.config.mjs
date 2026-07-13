import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

// Bundle our own (ESM) core into the CommonJS main output by aliasing the bare
// specifier to its built entry file, so the packaged app needs nothing from
// node_modules to run the pipeline. The native ffmpeg deps stay external
// (externalizeDepsPlugin keeps package.json `dependencies` external) so their
// per-OS binaries resolve at runtime.
const coreEntry = resolve(__dirname, "../../packages/core/dist/index.js");

export default defineConfig({
  main: {
    resolve: { alias: { "@sada/core": coreEntry } },
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    resolve: { alias: { "@sada/core": coreEntry } },
    plugins: [react()],
  },
});

import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { readFileSync } from "fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf8"));

const coreEntry = resolve(__dirname, "../../packages/core/dist/index.js");
const uiEntry = resolve(__dirname, "../../packages/ui/src/index.js");

export default defineConfig({
  resolve: {
    alias: { "@sada/core": coreEntry, "@sada/ui": uiEntry },
    dedupe: ["react", "react-dom"],
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  // ffmpeg.wasm ships its own workers/wasm; let it load them at runtime rather
  // than have Vite pre-bundle it.
  optimizeDeps: { exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"] },
  build: { target: "es2020" },
  server: {
    port: 5173,
    // In dev, proxy /api/speech straight to Wit.ai so there's no CORS and no
    // need to run the proxy service. In production, set VITE_WIT_PROXY_URL to a
    // deployed proxy (see services/wit-proxy).
    proxy: {
      "/api/speech": {
        target: "https://api.wit.ai",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/speech/, "/speech"),
      },
    },
  },
});

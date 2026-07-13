// Copy the @ffmpeg/core single-thread assets into public/ffmpeg so the web app
// can load them same-origin (the package's "exports" map blocks deep imports,
// and self-hosting avoids a CDN dependency / CSP issues).
import { cpSync, existsSync, mkdirSync, readdirSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, "..");
const repoRoot = resolve(appRoot, "../..");

function findCoreDist() {
  const direct = [
    resolve(appRoot, "node_modules/@ffmpeg/core/dist/esm"),
    resolve(repoRoot, "node_modules/@ffmpeg/core/dist/esm"),
  ];
  for (const c of direct) if (existsSync(join(c, "ffmpeg-core.wasm"))) return c;

  const pnpm = resolve(repoRoot, "node_modules/.pnpm");
  if (existsSync(pnpm)) {
    for (const d of readdirSync(pnpm)) {
      if (d.startsWith("@ffmpeg+core@")) {
        const c = join(pnpm, d, "node_modules/@ffmpeg/core/dist/esm");
        if (existsSync(join(c, "ffmpeg-core.wasm"))) return c;
      }
    }
  }
  return null;
}

const dist = findCoreDist();
if (!dist) {
  console.error("[copy-ffmpeg-core] Could not locate @ffmpeg/core dist/esm. Did you run pnpm install?");
  process.exit(1);
}

const out = resolve(appRoot, "public/ffmpeg");
mkdirSync(out, { recursive: true });
for (const f of ["ffmpeg-core.js", "ffmpeg-core.wasm"]) {
  cpSync(join(dist, f), join(out, f));
}
console.log("[copy-ffmpeg-core] copied ffmpeg-core.js + ffmpeg-core.wasm -> public/ffmpeg");

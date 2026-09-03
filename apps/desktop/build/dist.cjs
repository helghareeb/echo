#!/usr/bin/env node
/**
 * Thin wrapper around the electron-builder CLI.
 *
 * WHY THIS EXISTS
 * ---------------
 * electron-builder discovers the Electron version by reading exactly one path,
 * `<projectDir>/node_modules/electron/package.json`, and it does not walk up the
 * tree. This repo sets `node-linker=hoisted` in .npmrc (so electron-builder can
 * reliably trace the main process's transitive dependencies into app.asar — see
 * commit bedc355), and hoisting puts every dependency in the WORKSPACE ROOT's
 * node_modules. `apps/desktop/node_modules` ends up holding only the workspace
 * links, so the lookup misses and every packaging run dies with:
 *
 *     Cannot compute electron version from installed node modules
 *
 * Node's own resolution does walk up, so we resolve the version here and hand it
 * to the CLI. Hard-coding it in electron-builder.yml would work until the day the
 * devDependency is bumped and the two silently disagree; this cannot drift.
 *
 * Every argument is forwarded untouched: `node build/dist.cjs --win --publish never`.
 */

const { spawn } = require("child_process");
const path = require("path");

let electronVersion;
try {
  electronVersion = require("electron/package.json").version;
} catch (err) {
  console.error(
    "Cannot resolve the `electron` package from apps/desktop.\n" +
      "Run `pnpm install` at the repository root first.",
  );
  process.exit(1);
}

const cli = require.resolve("electron-builder/cli.js");
const args = [cli, `-c.electronVersion=${electronVersion}`, ...process.argv.slice(2)];

console.log(`> electron-builder (electron ${electronVersion}) ${process.argv.slice(2).join(" ")}`);

const child = spawn(process.execPath, args, {
  stdio: "inherit",
  cwd: path.resolve(__dirname, ".."),
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});

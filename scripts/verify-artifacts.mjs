#!/usr/bin/env node
/**
 * Post-build gate: prove every packaged app carries exactly the ffmpeg/ffprobe
 * it will look for at runtime — and nothing else.
 *
 * The failure this exists to catch is silent and total. `@ffmpeg-installer`
 * resolves `@ffmpeg-installer/${os.platform()}-${os.arch()}` on the USER's
 * machine. Ship the wrong one and the package still builds, still uploads, still
 * installs, and then throws before the first window opens. v1.0.0's mac builds
 * had that shape: an arm64 runner put arm64 binaries inside the Intel .dmg.
 *
 * Runs in CI after the installers are built. Cheap, and it fails the release
 * rather than the friend who downloaded it.
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const RELEASE_DIR = path.resolve(process.cwd(), "apps/desktop/release");
const SCOPES = { "@ffmpeg-installer": "ffmpeg", "@ffprobe-installer": "ffprobe" };

/**
 * electron-builder names its staging directories after the target it packed.
 * Map that name to the one platform-arch package the artifact must contain.
 */
function expectedFor(dirName) {
  if (dirName === "linux-unpacked") return "linux-x64";
  if (dirName === "linux-arm64-unpacked") return "linux-arm64";
  if (dirName === "linux-armv7l-unpacked") return "linux-arm";
  if (dirName === "win-unpacked") return "win32-x64";
  if (dirName === "win-ia32-unpacked") return "win32-ia32";
  if (dirName === "win-arm64-unpacked") return "win32-arm64";
  if (dirName === "mac") return "darwin-x64";
  if (dirName === "mac-arm64") return "darwin-arm64";
  if (dirName === "mac-universal") return null; // both are legitimate
  return undefined; // not a staging dir we know about
}

/** Locate the app's unpacked node_modules inside a staging directory. */
function moduleRootFor(stagingDir) {
  const candidates = [
    path.join(stagingDir, "resources", "app.asar.unpacked", "node_modules"),
    path.join(stagingDir, "resources", "app", "node_modules"),
  ];
  // macOS buries resources inside the .app bundle.
  for (const entry of readdirSync(stagingDir, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name.endsWith(".app")) {
      candidates.push(
        path.join(stagingDir, entry.name, "Contents", "Resources", "app.asar.unpacked", "node_modules"),
        path.join(stagingDir, entry.name, "Contents", "Resources", "app", "node_modules"),
      );
    }
  }
  return candidates.find(existsSync) ?? null;
}

if (!existsSync(RELEASE_DIR)) {
  console.error(`No build output at ${RELEASE_DIR}. Run the packaging step first.`);
  process.exit(1);
}

const problems = [];
let checked = 0;

for (const entry of readdirSync(RELEASE_DIR, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;

  const expected = expectedFor(entry.name);
  if (expected === undefined) continue; // e.g. .icon-set, builder caches

  const stagingDir = path.join(RELEASE_DIR, entry.name);
  const moduleRoot = moduleRootFor(stagingDir);
  if (moduleRoot == null) {
    problems.push(`${entry.name}: no packaged node_modules found — ffmpeg cannot be in this build`);
    continue;
  }

  for (const [scope, binaryName] of Object.entries(SCOPES)) {
    const scopeDir = path.join(moduleRoot, scope);
    if (!existsSync(scopeDir)) {
      problems.push(`${entry.name}: ${scope} is missing entirely`);
      continue;
    }

    // The resolver packages themselves are `ffmpeg`/`ffprobe`; everything else in
    // the scope is a platform build. Dot-entries (`.bin`, editor leftovers) are
    // not platform builds and must not be mistaken for one.
    const archDirs = readdirSync(scopeDir).filter(
      (n) => n !== "ffmpeg" && n !== "ffprobe" && !n.startsWith("."),
    );

    if (archDirs.length === 0) {
      problems.push(`${entry.name}: ${scope} has no platform build — the app will throw on launch`);
      continue;
    }
    if (expected != null && archDirs.length > 1) {
      problems.push(
        `${entry.name}: ${scope} carries ${archDirs.length} platform builds (${archDirs.join(", ")}); ` +
          `expected only ${expected}. The download is needlessly ~140 MB larger per extra build.`,
      );
    }
    if (expected != null && !archDirs.includes(expected)) {
      problems.push(
        `${entry.name}: ${scope} contains ${archDirs.join(", ")} but this artifact runs on ${expected}. ` +
          `Users on that platform get "Unsupported platform/architecture" before the window opens.`,
      );
      continue;
    }

    // The directory being present is not the same as the binary being usable.
    for (const archDir of archDirs) {
      const isWindows = archDir.startsWith("win32");
      const binary = path.join(scopeDir, archDir, isWindows ? `${binaryName}.exe` : binaryName);
      if (!existsSync(binary)) {
        problems.push(`${entry.name}: ${scope}/${archDir} has no ${path.basename(binary)}`);
        continue;
      }
      const { size, mode } = statSync(binary);
      if (size < 1_000_000) {
        problems.push(`${entry.name}: ${scope}/${archDir} binary is only ${size} bytes — truncated?`);
      }
      // A non-executable ffmpeg fails at spawn time, deep into a long run.
      if (!isWindows && (mode & 0o111) === 0) {
        problems.push(`${entry.name}: ${scope}/${archDir}/${binaryName} is not executable`);
      }
    }

    checked += 1;
    console.log(`  ✓ ${entry.name.padEnd(22)} ${scope}/${archDirs.join(", ")}`);
  }
}

if (checked === 0 && problems.length === 0) {
  console.log("No packaged app directories found to verify (nothing was built on this runner).");
  process.exit(0);
}

if (problems.length) {
  console.error("\nArtifact verification FAILED:\n");
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.error("");
  process.exit(1);
}

console.log(`\nAll ${checked} packaged bundle(s) carry exactly the ffmpeg/ffprobe they need.`);

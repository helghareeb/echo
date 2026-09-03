/**
 * electron-builder `afterPack` hook — keep exactly one ffmpeg/ffprobe per artifact.
 *
 * WHY THIS EXISTS
 * ---------------
 * `@ffmpeg-installer/ffmpeg` resolves its binary at RUNTIME, on the user's
 * machine, as `@ffmpeg-installer/${os.platform()}-${os.arch()}`. If that exact
 * package is not inside the bundle, requiring it throws and the Electron main
 * process dies before a window ever appears.
 *
 * A package manager only installs the optional platform package matching the
 * BUILD host. GitHub's `macos-latest` runner is arm64, so a mac build there used
 * to ship `darwin-arm64` inside BOTH the arm64 and the x64 disk images — and the
 * x64 image is precisely the one Intel Mac users download. It crashed on launch
 * for every one of them.
 *
 * The repo now sets `pnpm.supportedArchitectures` so every platform's binaries
 * are installed on every runner. That fixes the missing-binary half and creates
 * a new problem: ffmpeg + ffprobe are ~140 MB per architecture, and shipping all
 * of them would add roughly half a gigabyte to each download.
 *
 * So: install them all, then delete the ones this artifact cannot use. Runs once
 * per (platform, arch) pair, on that artifact's own staged output.
 *
 * The hook FAILS THE BUILD when the binary the target needs is absent. A loud
 * red build is cheap; a released installer that dies on launch is not.
 */

const fs = require("fs");
const path = require("path");

// app-builder-lib's Arch enum, which reaches us as a bare number.
const ARCH_NAMES = { 0: "ia32", 1: "x64", 2: "armv7l", 3: "arm64", 4: "universal" };

// os.arch() spells 32-bit Intel "ia32" and 32-bit ARM "arm"; the package names
// follow os.arch(), not electron-builder's enum, so armv7l maps to "arm".
const PACKAGE_ARCH = { ia32: "ia32", x64: "x64", armv7l: "arm", arm64: "arm64" };

const SCOPES = ["@ffmpeg-installer", "@ffprobe-installer"];

/** Every place a packaged app may keep node_modules, whether asar is on or off. */
function moduleRoots(resourcesDir) {
  return [
    path.join(resourcesDir, "app.asar.unpacked", "node_modules"),
    path.join(resourcesDir, "app", "node_modules"),
  ].filter((dir) => fs.existsSync(dir));
}

/** Binaries that will still resolve on the machines this artifact targets. */
function wantedPackages(platform, archName) {
  // A universal macOS build runs natively on both architectures, so it has to
  // carry both sets of binaries.
  const arches =
    archName === "universal" ? ["x64", "arm64"] : [PACKAGE_ARCH[archName] || archName];
  return new Set(arches.map((arch) => `${platform}-${arch}`));
}

exports.default = async function afterPack(context) {
  const { appOutDir, electronPlatformName } = context;
  const archName = ARCH_NAMES[context.arch] ?? String(context.arch);
  const resourcesDir = context.packager.getResourcesDir(appOutDir);
  const keep = wantedPackages(electronPlatformName, archName);

  const roots = moduleRoots(resourcesDir);
  if (roots.length === 0) {
    throw new Error(
      `[afterPack] no node_modules found under ${resourcesDir}. The ffmpeg ` +
        `binaries cannot have been packaged, so the app would crash on launch.`,
    );
  }

  let removed = 0;
  let freed = 0;
  const found = new Set();

  for (const root of roots) {
    for (const scope of SCOPES) {
      const scopeDir = path.join(root, scope);
      if (!fs.existsSync(scopeDir)) continue;

      for (const entry of fs.readdirSync(scopeDir)) {
        // `ffmpeg` / `ffprobe` are the resolver packages themselves — always keep.
        if (entry === "ffmpeg" || entry === "ffprobe") continue;

        const target = path.join(scopeDir, entry);
        if (!fs.statSync(target).isDirectory()) continue;

        if (keep.has(entry)) {
          found.add(`${scope}/${entry}`);
          ensureExecutable(target, electronPlatformName);
          continue;
        }
        freed += directorySize(target);
        fs.rmSync(target, { recursive: true, force: true });
        removed += 1;
      }
    }
  }

  // Prove the artifact can actually run before it is handed to anyone.
  const missing = [];
  for (const scope of SCOPES) {
    for (const name of keep) {
      if (!found.has(`${scope}/${name}`)) missing.push(`${scope}/${name}`);
    }
  }
  if (missing.length) {
    throw new Error(
      `[afterPack] ${electronPlatformName}-${archName} build is missing ${missing.join(", ")}. ` +
        `The app would throw "Unsupported platform/architecture" on launch. ` +
        `Check that pnpm.supportedArchitectures in the root package.json covers this target ` +
        `and that the install step ran with it.`,
    );
  }

  console.log(
    `  • ffmpeg prune  ${electronPlatformName}-${archName}: kept ${[...keep].join(", ")}, ` +
      `removed ${removed} foreign build(s), ${(freed / 1024 / 1024).toFixed(0)} MB`,
  );
};

/**
 * Guarantee the binaries we keep are executable.
 *
 * `@ffprobe-installer` ships its binary mode 644 and relies on a postinstall
 * `chmod u+x` to fix it. That is not something a build can depend on: package
 * managers skip, sandbox or cache around lifecycle scripts, and a restored
 * store can hand back the file with its original mode. On a GitHub runner the
 * bit was simply absent, so the packaged app carried an ffprobe it could not
 * execute — every file the user added would fail to probe its duration and be
 * flagged unreadable, with the app otherwise looking perfectly healthy.
 *
 * It happened to be set on the maintainer's machine, which is precisely why
 * this needs to be enforced at package time rather than trusted.
 */
function ensureExecutable(dir, platform) {
  if (platform === "win32") return; // .exe needs no permission bit
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (entry.name !== "ffmpeg" && entry.name !== "ffprobe") continue;
    const file = path.join(dir, entry.name);
    const { mode } = fs.statSync(file);
    if ((mode & 0o111) !== 0o111) {
      fs.chmodSync(file, 0o755);
      console.log(`  • made executable: ${path.relative(dir, file) || entry.name} in ${dir}`);
    }
  }
}

function directorySize(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) total += directorySize(full);
    else if (entry.isFile()) total += fs.statSync(full).size;
  }
  return total;
}

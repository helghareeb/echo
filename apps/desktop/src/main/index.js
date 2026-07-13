import path from "path";
import fs from "fs";
import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import { createPipeline } from "@sada/core";
import { createDesktopPorts, cleanTmp } from "./ports";

const isDev = !app.isPackaged;

/** App directories. Output defaults to a user-visible "Sada" folder in Documents;
 * logs and temp clips live under the per-user app data dir. */
const defaultOutputDir = path.join(app.getPath("documents"), "Sada");
const tmpDir = path.join(app.getPath("userData"), "tmp");
const logsDir = path.join(app.getPath("userData"), "logs");
for (const dir of [defaultOutputDir, tmpDir, logsDir]) {
  fs.mkdirSync(dir, { recursive: true });
}

/** Repointed from the original Telegram link to the open-source project. */
const PROJECT_URL = "https://github.com/helghareeb/echo";

let win;
let pipeline = null;

function logError(err) {
  try {
    fs.appendFileSync(path.join(logsDir, "logs.txt"), String(err && err.stack ? err.stack : err) + "\n");
  } catch {
    /* ignore */
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 480,
    height: 800,
    frame: false,
    resizable: false,
    transparent: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false, // preload needs webUtils.getPathForFile
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setMenuBarVisibility(false);
  win.once("ready-to-show", () => win.show());

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ---- IPC: window controls -------------------------------------------------
ipcMain.on("window:minimize", () => win?.minimize());
ipcMain.on("window:quit", () => app.quit());
ipcMain.on("shell:openLink", (_e, link) => {
  if (typeof link === "string" && /^https?:\/\//.test(link)) shell.openExternal(link);
});
ipcMain.on("shell:openOutputDir", (_e, dir) => {
  shell.openPath(dir && dir !== "null" && dir !== "" ? dir : defaultOutputDir);
});

// ---- IPC: file selection --------------------------------------------------
ipcMain.handle("dialog:pickFiles", async () => {
  const result = await dialog.showOpenDialog(win, {
    title: "Select audio files",
    buttonLabel: "Select",
    properties: ["openFile", "multiSelections"],
    filters: [{ name: "Audio", extensions: ["mp3", "wav", "ogg", "m4a", "flac"] }],
  });
  if (result.canceled) return [];
  return result.filePaths.map((p) => ({ name: path.basename(p), path: p }));
});

ipcMain.handle("dialog:chooseOutputDir", async () => {
  const result = await dialog.showOpenDialog(win, {
    title: "Choose output directory",
    properties: ["openDirectory", "createDirectory"],
  });
  if (result.canceled) return null;
  return result.filePaths[0] || null;
});

// Compute durations for a list of { name, path }.
ipcMain.handle("audio:getDurations", async (_e, files) => {
  const ports = createDesktopPorts({ token: "", outputDir: defaultOutputDir, tmpDir, sendProgress: () => {} });
  const out = [];
  for (const f of files) {
    let duration = 0;
    try {
      duration = await ports.duration.getDurationSeconds(f.path);
    } catch (err) {
      logError(err);
    }
    out.push({ ...f, duration });
  }
  return out;
});

// ---- IPC: transcription lifecycle ----------------------------------------
ipcMain.on("transcribe:start", async (_e, payload) => {
  const { files, token, outputDir } = payload || {};
  const effectiveOutputDir = outputDir && outputDir !== "" ? outputDir : defaultOutputDir;

  cleanTmp(tmpDir);
  const sendProgress = (event, data) => win?.webContents.send("progress", { event, payload: data });

  const ports = createDesktopPorts({ token, outputDir: effectiveOutputDir, tmpDir, sendProgress });
  pipeline = createPipeline(ports);

  const inputs = (files || []).map((f) => ({ name: f.name, source: f.path }));
  try {
    await pipeline.run(inputs);
  } catch (err) {
    logError(err);
    sendProgress("error", "Error: " + (err?.message || err));
    sendProgress("processComplete");
  } finally {
    cleanTmp(tmpDir);
    pipeline = null;
  }
});

ipcMain.on("transcribe:stop", () => {
  pipeline?.stop();
});

ipcMain.handle("app:info", () => ({
  version: app.getVersion(),
  projectUrl: PROJECT_URL,
  defaultOutputDir,
  platform: process.platform,
}));

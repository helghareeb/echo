import { createPipeline } from "@sada/core";
import { createWebPorts } from "./ports.web";
import { audioDuration } from "./media";

/**
 * The web implementation of the `window.sada` bridge contract (the same shape
 * the Electron preload exposes). Because the shared UI only knows this contract,
 * the identical React app runs unchanged in the browser.
 *
 * Files can't be referenced by path in the browser, so we keep a registry that
 * maps an opaque id (used where desktop uses a path) to the actual File object.
 */

const PROXY_URL = import.meta.env?.VITE_WIT_PROXY_URL || "/api/speech";
const PROJECT_URL = "https://github.com/helghareeb/echo";

const registry = new Map();
let counter = 0;
let pipeline = null;
let progressCb = () => {};

function register(file) {
  const id = `web-${counter++}`;
  registry.set(id, file);
  return id;
}

export const webBridge = {
  isDesktop: false,

  pickFiles() {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.multiple = true;
      input.accept = "audio/*,.mp3,.wav,.ogg,.m4a,.flac";
      input.onchange = () =>
        resolve(Array.from(input.files || []).map((f) => ({ name: f.name, path: register(f) })));
      input.click();
    });
  },

  getPathForFile(file) {
    return register(file);
  },

  async getDurations(files) {
    const out = [];
    for (const f of files) {
      const file = registry.get(f.path);
      out.push({ ...f, duration: file ? await audioDuration(file) : 0 });
    }
    return out;
  },

  async chooseOutputDir() {
    return null; // Browser downloads go to the user's Downloads folder.
  },
  openOutputDir() {
    /* no-op on web */
  },
  openLink(url) {
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  },
  minimize() {
    /* no-op on web */
  },
  quit() {
    /* no-op on web */
  },

  start({ files, token }) {
    const inputs = (files || [])
      .map((f) => ({ name: f.name, source: registry.get(f.path) }))
      .filter((i) => i.source);
    const ports = createWebPorts({ token, proxyUrl: PROXY_URL, emit: (e, p) => progressCb(e, p) });
    pipeline = createPipeline(ports);
    pipeline.run(inputs);
  },
  stop() {
    pipeline?.stop();
  },

  async appInfo() {
    return {
      version: typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "",
      projectUrl: PROJECT_URL,
      defaultOutputDir: "Downloads",
      platform: "web",
    };
  },

  onProgress(cb) {
    progressCb = cb;
    return () => {
      progressCb = () => {};
    };
  },
};

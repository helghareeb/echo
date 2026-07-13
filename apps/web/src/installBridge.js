import { webBridge } from "./webBridge";

// Install the bridge before the shared UI module graph is evaluated (the UI
// reads globalThis.sada at import time). This module is imported first in
// main.jsx, so the assignment runs before "@sada/ui" is loaded.
globalThis.sada = webBridge;

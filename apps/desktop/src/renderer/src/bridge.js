/**
 * Access point for the platform bridge. On desktop this is `window.sada`
 * exposed by the Electron preload; the web app exposes an identically-shaped
 * object built around the in-browser pipeline. Keeping all platform access
 * behind this import is what lets the same UI run on both targets.
 */
export const bridge = globalThis.sada;

export const isDesktop = Boolean(bridge?.isDesktop);

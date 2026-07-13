# Sada Wit.ai proxy

The browser can't call `https://api.wit.ai/speech` directly — Wit.ai sends no
CORS headers, so the browser blocks the response. This tiny proxy forwards the
audio and the user's `Authorization` header to Wit.ai and returns the JSON with
permissive CORS. **It never logs or stores request bodies or tokens.**

> The desktop app does **not** need this — it calls Wit.ai directly from the
> main process.

## Privacy

Whoever operates the proxy can technically see the token + audio passing through.
The public code is a pass-through with no logging, but for full control you
should **self-host** it (below) so nothing leaves infrastructure you own.

## Option A — Cloudflare Worker (recommended)

```bash
cd services/wit-proxy
npx wrangler deploy
```

Then build the web app pointed at your worker:

```bash
VITE_WIT_PROXY_URL="https://sada-wit-proxy.<subdomain>.workers.dev" \
  pnpm --filter @sada/web build
```

## Option B — Node (self-host anywhere)

```bash
cd services/wit-proxy
node server.js         # listens on :8787
```

Set `VITE_WIT_PROXY_URL="http://localhost:8787"` (or your host) for the web build.

## Local development

You don't need to run this at all in dev: the web app's Vite dev server proxies
`/api/speech` straight to Wit.ai for you (`pnpm dev:web`).

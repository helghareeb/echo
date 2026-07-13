/**
 * Self-hosted Node fallback for the Sada Wit.ai proxy (no Cloudflare needed).
 * Requires Node >= 18 (uses the built-in fetch). Run: `node server.js`
 * Listens on PORT (default 8787) and forwards POST / to Wit.ai with CORS.
 * It does not log or store request bodies or tokens.
 */
import http from "node:http";

const WIT_URL = "https://api.wit.ai/speech";
const PORT = process.env.PORT || 8787;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept",
};

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    return res.end();
  }
  if (req.method !== "POST") {
    res.writeHead(405, CORS);
    return res.end("Sada Wit.ai proxy. POST audio bytes with an Authorization header.");
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);

  try {
    const upstream = await fetch(WIT_URL, {
      method: "POST",
      headers: {
        "Content-Type": req.headers["content-type"] || "audio/mpeg",
        Accept: req.headers["accept"] || "application/vnd.wit.20200513+json",
        Authorization: req.headers["authorization"] || "",
      },
      body,
    });
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.writeHead(upstream.status, {
      ...CORS,
      "Content-Type": upstream.headers.get("content-type") || "application/json",
    });
    res.end(buf);
  } catch (err) {
    res.writeHead(502, CORS);
    res.end(JSON.stringify({ error: String(err) }));
  }
});

server.listen(PORT, () => console.log(`Sada Wit.ai proxy listening on http://localhost:${PORT}`));

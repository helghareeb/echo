/**
 * Sada Wit.ai CORS proxy — Cloudflare Worker.
 *
 * Browsers can't call https://api.wit.ai/speech directly (no CORS headers).
 * This Worker is a thin pass-through: it forwards the POSTed audio body and the
 * caller's Authorization header to Wit.ai and echoes the JSON back with
 * permissive CORS. It stores and logs NOTHING — the user's token and audio are
 * never persisted. Prefer self-hosting this so the token stays on infra you
 * control (see README.md).
 */

const WIT_URL = "https://api.wit.ai/speech";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept",
  "Access-Control-Max-Age": "86400",
};

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }
    if (request.method !== "POST") {
      return new Response("Sada Wit.ai proxy. POST audio bytes with an Authorization header.", {
        status: 405,
        headers: CORS,
      });
    }

    const upstream = await fetch(WIT_URL, {
      method: "POST",
      headers: {
        "Content-Type": request.headers.get("Content-Type") || "audio/mpeg",
        Accept: request.headers.get("Accept") || "application/vnd.wit.20200513+json",
        Authorization: request.headers.get("Authorization") || "",
      },
      body: request.body,
    });

    const body = await upstream.arrayBuffer();
    return new Response(body, {
      status: upstream.status,
      headers: {
        ...CORS,
        "Content-Type": upstream.headers.get("Content-Type") || "application/json",
      },
    });
  },
};

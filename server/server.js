import "dotenv/config";
import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import Razorpay from "razorpay";
import { handleCreateOrder, handleVerifyPayment } from "./razorpay-handlers.js";

function getConfigFromEnv(env = process.env) {
  const keyId = env.RAZORPAY_KEY_ID || "";
  const keySecret = env.RAZORPAY_KEY_SECRET || "";
  const allowedOrigins = new Set(
    (env.ALLOWED_ORIGIN || "https://ayushbpl10.github.io")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
  const client = keyId && keySecret ? new Razorpay({ key_id: keyId, key_secret: keySecret }) : null;
  return {
    port: Number(env.PORT || 8787),
    host: env.HOST || "127.0.0.1",
    keyId,
    keySecret,
    allowedOrigins,
    razorpayClient: client,
  };
}

function isOriginAllowed(origin, allowedOrigins) {
  if (!origin) return false;
  if (allowedOrigins.has(origin)) return true;
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function setCorsHeaders(req, res, allowedOrigins) {
  const origin = req.headers.origin;
  if (isOriginAllowed(origin, allowedOrigins)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

function readJsonBody(req, limitBytes = 32768) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(new Error("BODY_TOO_LARGE"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("INVALID_JSON"));
      }
    });
    req.on("error", reject);
  });
}

export function createAppServer(overrides = {}) {
  const cfg = { ...getConfigFromEnv(), ...overrides };

  return http.createServer(async (req, res) => {
    setCorsHeaders(req, res, cfg.allowedOrigins);

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }

    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, {
        ok: true,
        configured: Boolean(cfg.razorpayClient),
      });
      return;
    }

    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    let body;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      const code = err.message === "BODY_TOO_LARGE" ? 413 : 400;
      sendJson(res, code, { error: err.message });
      return;
    }

    if (url.pathname === "/api/create-order") {
      const result = await handleCreateOrder({
        body,
        razorpayClient: cfg.razorpayClient,
        keyId: cfg.keyId,
      });
      sendJson(res, result.status, result.payload);
      return;
    }

    if (url.pathname === "/api/verify-payment") {
      const result = handleVerifyPayment({ body, keySecret: cfg.keySecret });
      sendJson(res, result.status, result.payload);
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  });
}

const entryHref = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === entryHref) {
  const cfg = getConfigFromEnv();
  const server = createAppServer(cfg);
  server.listen(cfg.port, cfg.host, () => {
    console.log(`bio-razorpay-backend listening on http://${cfg.host}:${cfg.port}`);
  });
}

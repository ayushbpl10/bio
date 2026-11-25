import "dotenv/config";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import Razorpay from "razorpay";
import { createDiscountStore, DEFAULT_DISCOUNT_CODE } from "./discounts.js";
import {
  isValidEmail,
  isValidTuesdayDate,
  processBookingActions,
  sanitizeBookingInput,
} from "./notifications.js";
import { handleCreateOrder, handleVerifyPayment } from "./razorpay-handlers.js";

function setSecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}

function createRateLimiter({ windowMs = 60_000, maxRequests = 30, maxBuckets = 2000 } = {}) {
  const hits = new Map();
  return (key, now = Date.now()) => {
    if (hits.size > maxBuckets) hits.clear();
    const recent = (hits.get(key) || []).filter((ts) => now - ts < windowMs);
    if (recent.length >= maxRequests) {
      hits.set(key, recent);
      const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - recent[0])) / 1000));
      return { allowed: false, retryAfterSec };
    }
    recent.push(now);
    hits.set(key, recent);
    return { allowed: true, retryAfterSec: 0 };
  };
}

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
    env,
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

export function readJsonBody(req, limitBytes = 32768) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let settled = false;
    const chunks = [];
    req.on("data", (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > limitBytes) {
        settled = true;
        req.pause();
        reject(new Error("BODY_TOO_LARGE"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (settled) return;
      settled = true;
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
    req.on("error", (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    });
  });
}

export function createAppServer(overrides = {}) {
  const cfg = { ...getConfigFromEnv(), ...overrides };
  const serverDir = path.dirname(fileURLToPath(import.meta.url));
  const discountStore =
    cfg.discountStore ||
    createDiscountStore({
      code: cfg.env?.DISCOUNT_CODE || DEFAULT_DISCOUNT_CODE,
      filePath:
        cfg.discountStorePath !== undefined
          ? cfg.discountStorePath
          : path.join(serverDir, "discount-redemptions.json"),
    });
  const checkRate = createRateLimiter({
    windowMs: cfg.rateLimitWindowMs ?? 60_000,
    maxRequests: cfg.rateLimitMax ?? 30,
    maxBuckets: cfg.rateLimitMaxBuckets ?? 2000,
  });

  return http.createServer(async (req, res) => {
    setSecurityHeaders(res);
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
        email_configured: Boolean(cfg.env?.GMAIL_APP_PASSWORD),
        meet_configured: Boolean(
          cfg.env?.GOOGLE_CLIENT_ID && cfg.env?.GOOGLE_CLIENT_SECRET && cfg.env?.GOOGLE_REFRESH_TOKEN
        ),
      });
      return;
    }

    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const rate = checkRate(getClientIp(req));
    if (!rate.allowed) {
      res.setHeader("Retry-After", String(rate.retryAfterSec));
      sendJson(res, 429, { error: "Too many requests. Please retry shortly." });
      return;
    }

    let body;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      const code = err.message === "BODY_TOO_LARGE" ? 413 : 400;
      if (code === 413) res.setHeader("Connection", "close");
      sendJson(res, code, { error: err.message });
      return;
    }

    if (url.pathname === "/api/validate-discount") {
      const check = discountStore.validate({
        code: body?.code,
        email: body?.email,
        profile: body?.profile,
        name: body?.name,
      });
      if (!check.ok) {
        sendJson(res, check.status, { valid: false, error: check.error });
        return;
      }
      sendJson(res, 200, {
        valid: true,
        applied: check.applied,
        code: check.code,
        discountPct: check.discountPct,
        finalAmountInr: check.amountInr,
        finalAmountPaise: check.amountPaise,
      });
      return;
    }

    if (url.pathname === "/api/create-order") {
      let orderBody = body;
      if (body?.discountCode) {
        const discountCheck = discountStore.validate({
          code: body.discountCode,
          email: body.email,
          profile: body.profile,
          name: body.name,
        });
        if (!discountCheck.ok) {
          sendJson(res, discountCheck.status, { error: discountCheck.error });
          return;
        }
        orderBody = { ...body, amount: discountCheck.amountPaise };
      }
      const result = await handleCreateOrder({
        body: orderBody,
        razorpayClient: cfg.razorpayClient,
        keyId: cfg.keyId,
      });
      sendJson(res, result.status, result.payload);
      return;
    }

    if (url.pathname === "/api/verify-payment") {
      const result = handleVerifyPayment({ body, keySecret: cfg.keySecret });
      if (result.status === 200 && body?.booking && isValidTuesdayDate(body.booking.dateStr)) {
        const cleanBooking = sanitizeBookingInput({
          ...body.booking,
          utr: body.razorpay_payment_id || body.booking.utr || "",
        });
        if (cleanBooking.discountCode) {
          const redeemed = discountStore.redeem({
            code: cleanBooking.discountCode,
            email: cleanBooking.email,
            profile: cleanBooking.profile,
            name: cleanBooking.name,
          });
          if (redeemed.ok && redeemed.applied) {
            cleanBooking.feeInr = redeemed.amountInr;
          }
        }
        const bookingActions = await processBookingActions({
          booking: cleanBooking,
          env: cfg.env,
          fetchImpl: cfg.fetchImpl,
          createTransportImpl: cfg.createTransportImpl,
        });
        sendJson(res, 200, { ...result.payload, ...bookingActions });
        return;
      }
      sendJson(res, result.status, result.payload);
      return;
    }

    if (url.pathname === "/api/book-session") {
      const booking = sanitizeBookingInput(body?.booking || body);
      if (!booking.name || !isValidEmail(booking.email) || !isValidTuesdayDate(booking.dateStr)) {
        sendJson(res, 400, {
          error: "Valid guest name, email, and Tuesday session date (YYYY-MM-DD) are required.",
        });
        return;
      }
      if (booking.discountCode) {
        const redeemed = discountStore.redeem({
          code: booking.discountCode,
          email: booking.email,
          profile: booking.profile,
          name: booking.name,
        });
        if (!redeemed.ok) {
          sendJson(res, redeemed.status, { error: redeemed.error });
          return;
        }
        booking.feeInr = redeemed.amountInr;
      }
      const bookingActions = await processBookingActions({
        booking,
        env: cfg.env,
        fetchImpl: cfg.fetchImpl,
        createTransportImpl: cfg.createTransportImpl,
      });
      sendJson(res, 200, { ok: true, ...bookingActions });
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  });
}

export function startServer(env = process.env) {
  const cfg = getConfigFromEnv(env);
  const server = createAppServer(cfg);
  return server.listen(cfg.port, cfg.host, () => {
    console.log(`bio-razorpay-backend listening on http://${cfg.host}:${cfg.port}`);
  });
}

export function runCli(argv = process.argv, env = process.env, entryUrl = import.meta.url) {
  const entryHref = argv[1] ? pathToFileURL(path.resolve(argv[1])).href : "";
  if (entryUrl === entryHref) {
    return startServer(env);
  }
  return null;
}

runCli();

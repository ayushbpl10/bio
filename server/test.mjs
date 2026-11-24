import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import test from "node:test";
import {
  createGoogleMeetEvent,
  isValidEmail,
  isValidTuesdayDate,
  processBookingActions,
  sanitizeBookingInput,
  sanitizeHttpUrl,
  sendBookingNotificationEmail,
} from "./notifications.js";
import { handleCreateOrder, handleVerifyPayment } from "./razorpay-handlers.js";
import { createAppServer, readJsonBody, runCli, startServer } from "./server.js";
import {
  buildGoogleAuthUrl,
  exchangeAuthCode,
  extractAuthCode,
  runTokenCli,
  startTokenHelper,
} from "./get-google-token.mjs";

test("create-order validates credentials, paise minimums, types, and errors", async () => {
  const missingCreds = await handleCreateOrder({ body: {}, razorpayClient: null, keyId: "" });
  assert.equal(missingCreds.status, 500);

  const client = {
    orders: {
      create: async ({ amount, currency }) => ({ id: "order_Default500", amount, currency }),
    },
  };

  const tooLow = await handleCreateOrder({
    body: { amount: 99, currency: "INR" },
    razorpayClient: client,
    keyId: "rzp_test_dummy",
  });
  assert.equal(tooLow.status, 400);

  const floatAmt = await handleCreateOrder({
    body: { amount: 500.5, currency: "INR" },
    razorpayClient: client,
    keyId: "rzp_test_dummy",
  });
  assert.equal(floatAmt.status, 400);

  const defaulted = await handleCreateOrder({
    body: {},
    razorpayClient: client,
    keyId: "rzp_test_dummy",
  });
  assert.equal(defaulted.status, 200);
  assert.deepEqual(defaulted.payload, {
    order_id: "order_Default500",
    amount: 50000,
    currency: "INR",
    key_id: "rzp_test_dummy",
  });

  const customFields = await handleCreateOrder({
    body: {
      amount: 50000,
      currency: " inr ",
      receipt: "rcpt_meta_1",
      topic: "microservices",
      slot: "2026-12-01 6 PM",
    },
    razorpayClient: client,
    keyId: "rzp_test_dummy",
  });
  assert.equal(customFields.status, 200);

  const authNestedFail = await handleCreateOrder({
    body: { amount: 50000 },
    razorpayClient: {
      orders: {
        create: async () => {
          const e = new Error("Nested Auth failed");
          e.error = { statusCode: 401 };
          throw e;
        },
      },
    },
    keyId: "rzp_test_dummy",
  });
  assert.equal(authNestedFail.status, 401);

  const authFail = await handleCreateOrder({
    body: { amount: 50000 },
    razorpayClient: {
      orders: {
        create: async () => {
          const e = new Error("Auth failed");
          e.statusCode = 401;
          throw e;
        },
      },
    },
    keyId: "rzp_test_dummy",
  });
  assert.equal(authFail.status, 401);

  const apiFail = await handleCreateOrder({
    body: { amount: 50000 },
    razorpayClient: {
      orders: {
        create: async () => {
          throw new Error("Upstream 503");
        },
      },
    },
    keyId: "rzp_test_dummy",
  });
  assert.equal(apiFail.status, 500);
});

test("verify-payment covers missing secret, missing fields, length mismatch, wrong hash, and valid HMAC", () => {
  const noSecret = handleVerifyPayment({ body: {}, keySecret: "" });
  assert.equal(noSecret.status, 500);

  const missing = handleVerifyPayment({
    body: { razorpay_order_id: "order_Test123" },
    keySecret: "sec",
  });
  assert.equal(missing.status, 400);
  assert.equal(missing.payload.verified, false);

  const shortSig = handleVerifyPayment({
    body: {
      razorpay_order_id: "order_Test123",
      razorpay_payment_id: "pay_Test456",
      razorpay_signature: "abc",
    },
    keySecret: "sec",
  });
  assert.equal(shortSig.status, 400);

  const wrongHash = handleVerifyPayment({
    body: {
      razorpay_order_id: "order_Test123",
      razorpay_payment_id: "pay_Test456",
      razorpay_signature: "0".repeat(64),
    },
    keySecret: "sec",
  });
  assert.equal(wrongHash.status, 400);
  assert.equal(wrongHash.payload.verified, false);

  const validSig = crypto
    .createHmac("sha256", "sec")
    .update("order_Test123|pay_Test456")
    .digest("hex");
  const valid = handleVerifyPayment({
    body: {
      razorpay_order_id: "order_Test123",
      razorpay_payment_id: "pay_Test456",
      razorpay_signature: validSig,
    },
    keySecret: "sec",
  });
  assert.equal(valid.status, 200);
  assert.deepEqual(valid.payload, {
    verified: true,
    order_id: "order_Test123",
    payment_id: "pay_Test456",
  });
});

test("isValidTuesdayDate validates strict Tuesday YYYY-MM-DD in IST", () => {
  assert.equal(isValidTuesdayDate("2026-12-01"), true);
  assert.equal(isValidTuesdayDate("2026-12-08"), true);
  assert.equal(isValidTuesdayDate("2026-11-25"), false);
  assert.equal(isValidTuesdayDate("2026-12-07"), false);
  assert.equal(isValidTuesdayDate(""), false);
  assert.equal(isValidTuesdayDate("2026-99-99"), false);
});

test("Google Meet and Gmail notifications handle success, fallbacks, and errors safely", async () => {
  const skippedMeet = await createGoogleMeetEvent({
    booking: { dateStr: "2026-12-01" },
    env: { STATIC_MEET_URL: "https://meet.google.com/static-room" },
  });
  assert.equal(skippedMeet.created, false);
  assert.equal(skippedMeet.meetUrl, "https://meet.google.com/static-room");

  const calls = [];
  const createdMeet = await createGoogleMeetEvent({
    booking: {
      id: "AG-2612-MEET",
      name: "Riya",
      email: "riya@example.com",
      dateStr: "2026-12-01",
      topicTitle: "Observability",
      agenda: "OpenTelemetry traces",
    },
    env: {
      GOOGLE_CLIENT_ID: "cid",
      GOOGLE_CLIENT_SECRET: "csec",
      GOOGLE_REFRESH_TOKEN: "rtok",
      BOOKING_NOTIFY_EMAIL: "ayushbpl10@gmail.com",
    },
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      if (url.includes("oauth2.googleapis.com")) {
        return { ok: true, status: 200, json: async () => ({ access_token: "tok_123" }) };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: "evt_1",
          hangoutLink: "https://meet.google.com/abc-defg-hij",
          htmlLink: "https://calendar.google.com/event?eid=1",
        }),
      };
    },
  });
  assert.equal(createdMeet.created, true);
  assert.equal(createdMeet.meetUrl, "https://meet.google.com/abc-defg-hij");
  assert.match(calls[1].url, /conferenceDataVersion=1&sendUpdates=all/);

  const skippedEmail = await sendBookingNotificationEmail({
    booking: { dateStr: "2026-12-01", email: "a@b.com", name: "A" },
    meetUrl: "",
    env: {},
  });
  assert.equal(skippedEmail.sent, false);

  const sent = [];
  const sentEmail = await sendBookingNotificationEmail({
    booking: {
      id: "AG-2612-MAIL",
      name: "Karan",
      email: "karan@example.com",
      dateStr: "2026-12-01",
      dateLabel: "Tue, Dec 1, 2026",
      topicTitle: "Microservices",
      agenda: "Service mesh review",
      utr: "pay_123",
    },
    meetUrl: "https://meet.google.com/abc-defg-hij",
    env: {
      BOOKING_NOTIFY_EMAIL: "ayushbpl10@gmail.com",
      GMAIL_USER: "ayushbpl10@gmail.com",
      GMAIL_APP_PASSWORD: "dummy-app-password",
    },
    createTransportImpl: () => ({
      sendMail: async (msg) => sent.push(msg),
    }),
  });
  assert.equal(sentEmail.sent, true);
  assert.equal(sent[0].to, "ayushbpl10@gmail.com");
  assert.equal(sent[0].cc, "karan@example.com");

  // Test Google Calendar API failure after token success
  await assert.rejects(
    () =>
      createGoogleMeetEvent({
        booking: { id: "AG-FAIL", name: "Riya", email: "riya@example.com", dateStr: "2026-12-01" },
        env: { GOOGLE_CLIENT_ID: "cid", GOOGLE_CLIENT_SECRET: "csec", GOOGLE_REFRESH_TOKEN: "rtok" },
        fetchImpl: async (url) => {
          if (url.includes("oauth2.googleapis.com")) {
            return { ok: true, status: 200, json: async () => ({ access_token: "tok_123" }) };
          }
          return { ok: false, status: 403, json: async () => ({ error: { message: "Calendar disabled" } }) };
        },
      }),
    /Calendar disabled/
  );

  // Isolate partial failures without throwing
  const partial = await processBookingActions({
    booking: { id: "AG-ERR", name: "Guest", email: "g@example.com", dateStr: "2026-12-01" },
    env: {
      GOOGLE_CLIENT_ID: "cid",
      GOOGLE_CLIENT_SECRET: "csec",
      GOOGLE_REFRESH_TOKEN: "rtok",
      GMAIL_APP_PASSWORD: "pass",
      STATIC_MEET_URL: "https://meet.google.com/fallback",
    },
    fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({ error: "bad_token" }) }),
    createTransportImpl: () => ({
      sendMail: async () => {
        throw new Error("SMTP blocked");
      },
    }),
  });
  assert.equal(partial.meet_url, "https://meet.google.com/fallback");
  assert.equal(partial.email_sent, false);
  assert.equal(partial.errors.length, 2);

  // Calendar video entryPoint fallback + bad JSON resilience + same email & minimal booking fields
  const entryPointMeet = await createGoogleMeetEvent({
    booking: {
      id: "AG-EP",
      name: "",
      email: "ayushbpl10@gmail.com",
      dateStr: "2026-12-01",
      profile: "https://linkedin.com/in/ayush",
    },
    env: {
      GOOGLE_CLIENT_ID: "cid",
      GOOGLE_CLIENT_SECRET: "csec",
      GOOGLE_REFRESH_TOKEN: "rtok",
      BOOKING_NOTIFY_EMAIL: "ayushbpl10@gmail.com",
    },
    fetchImpl: async (url) => {
      if (url.includes("oauth2.googleapis.com")) {
        return { ok: true, status: 200, json: async () => ({ access_token: "tok" }) };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          conferenceData: {
            entryPoints: [{ entryPointType: "phone", uri: "tel:+1" }, { entryPointType: "video", uri: "https://meet.google.com/entry-point-meet" }],
          },
        }),
      };
    },
  });
  assert.equal(entryPointMeet.meetUrl, "https://meet.google.com/entry-point-meet");

  const staticFallbackCreated = await createGoogleMeetEvent({
    booking: { id: "AG-ST", name: "Guest", email: "g@example.com", dateStr: "2026-12-01" },
    env: {
      GOOGLE_CLIENT_ID: "cid",
      GOOGLE_CLIENT_SECRET: "csec",
      GOOGLE_REFRESH_TOKEN: "rtok",
      STATIC_MEET_URL: "https://meet.google.com/static-fallback",
    },
    fetchImpl: async (url) => {
      if (url.includes("oauth2.googleapis.com")) {
        return { ok: true, status: 200, json: async () => ({ access_token: "tok" }) };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    },
  });
  assert.equal(staticFallbackCreated.meetUrl, "https://meet.google.com/static-fallback");

  await assert.rejects(
    () =>
      createGoogleMeetEvent({
        booking: { id: "AG-BADJSON-1", dateStr: "2026-12-01" },
        env: { GOOGLE_CLIENT_ID: "cid", GOOGLE_CLIENT_SECRET: "csec", GOOGLE_REFRESH_TOKEN: "rtok" },
        fetchImpl: async () => ({
          ok: false,
          status: 500,
          json: async () => {
            throw new Error("invalid json");
          },
        }),
      }),
    /Failed to refresh Google OAuth token/
  );

  await assert.rejects(
    () =>
      createGoogleMeetEvent({
        booking: { id: "AG-BADJSON-2", dateStr: "2026-12-01" },
        env: { GOOGLE_CLIENT_ID: "cid", GOOGLE_CLIENT_SECRET: "csec", GOOGLE_REFRESH_TOKEN: "rtok" },
        fetchImpl: async (url) => {
          if (url.includes("oauth2.googleapis.com")) {
            return { ok: true, status: 200, json: async () => ({ access_token: "tok" }) };
          }
          return {
            ok: false,
            status: 502,
            json: async () => {
              throw new Error("bad cal json");
            },
          };
        },
      }),
    /Google Calendar API error/
  );

  const minimalMail = [];
  const sameEmailMail = await sendBookingNotificationEmail({
    booking: {
      id: "AG-SELF",
      name: "Ayush",
      email: "ayushbpl10@gmail.com",
      dateStr: "2026-12-01",
      profile: "https://github.com/ayushbpl10",
    },
    meetUrl: "",
    env: { GMAIL_APP_PASSWORD: "pass" },
    createTransportImpl: () => ({ sendMail: async (m) => minimalMail.push(m) }),
  });
  assert.equal(sameEmailMail.sent, true);
  assert.equal(minimalMail[0].cc, undefined);
});

test("HTTP server covers CORS, OPTIONS, 405, 404, bad JSON, 413, create-order, verify-payment+Meet/Mail, and book-session", async () => {
  const secret = "smoke_secret_123";
  const emailsSent = [];
  const server = createAppServer({
    keyId: "rzp_test_smoke",
    keySecret: secret,
    allowedOrigins: new Set(["https://ayushbpl10.github.io"]),
    env: {
      BOOKING_NOTIFY_EMAIL: "ayushbpl10@gmail.com",
      GMAIL_USER: "ayushbpl10@gmail.com",
      GMAIL_APP_PASSWORD: "app-pw",
      GOOGLE_CLIENT_ID: "cid",
      GOOGLE_CLIENT_SECRET: "csec",
      GOOGLE_REFRESH_TOKEN: "rtok",
    },
    razorpayClient: {
      orders: {
        create: async ({ amount, currency }) => ({ id: "order_Loopback1", amount, currency }),
      },
    },
    fetchImpl: async (url) => {
      if (url.includes("oauth2.googleapis.com")) {
        return { ok: true, status: 200, json: async () => ({ access_token: "tok" }) };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: "evt_http", hangoutLink: "https://meet.google.com/http-meet-url" }),
      };
    },
    createTransportImpl: () => ({
      sendMail: async (m) => emailsSent.push(m),
    }),
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const opt = await fetch(`${baseUrl}/api/create-order`, {
      method: "OPTIONS",
      headers: { Origin: "https://ayushbpl10.github.io" },
    });
    assert.equal(opt.status, 204);
    assert.equal(opt.headers.get("access-control-allow-origin"), "https://ayushbpl10.github.io");

    const evilCors = await fetch(`${baseUrl}/health`, { headers: { Origin: "https://evil.example" } });
    assert.equal(evilCors.status, 200);
    assert.equal(evilCors.headers.get("access-control-allow-origin"), null);

    const methodNotAllowed = await fetch(`${baseUrl}/api/create-order`, { method: "GET" });
    assert.equal(methodNotAllowed.status, 405);

    const badJson = await fetch(`${baseUrl}/api/create-order`, {
      method: "POST",
      body: "{bad",
    });
    assert.equal(badJson.status, 400);

    const emptyPost = await fetch(`${baseUrl}/api/verify-payment`, {
      method: "POST",
    });
    assert.equal(emptyPost.status, 400);

    const reqEmitter = new EventEmitter();
    reqEmitter.pause = () => { };
    const bodyErrPromise = readJsonBody(reqEmitter);
    reqEmitter.emit("error", new Error("Stream reset"));
    await assert.rejects(() => bodyErrPromise, /Stream reset/);

    const started = startServer({
      PORT: "0",
      HOST: "127.0.0.1",
      RAZORPAY_KEY_ID: "rzp_test_start",
      RAZORPAY_KEY_SECRET: "sec_start",
    });
    await new Promise((resolve) => started.once("listening", resolve));
    await new Promise((resolve) => started.close(resolve));

    const cliNoop = runCli(["node", "other.js"], { PORT: "0" }, new URL("./server.js", import.meta.url).href);
    assert.equal(cliNoop, null);

    const cliStarted = runCli(
      ["node", "./server.js"],
      { PORT: "0", HOST: "127.0.0.1", RAZORPAY_KEY_ID: "rzp_test_cli", RAZORPAY_KEY_SECRET: "sec_cli" },
      new URL("./server.js", import.meta.url).href
    );
    await new Promise((resolve) => cliStarted.once("listening", resolve));
    await new Promise((resolve) => cliStarted.close(resolve));

    const cliProc = spawn(process.execPath, ["server.js"], {
      env: { ...process.env, PORT: "0", HOST: "127.0.0.1" },
    });
    await new Promise((resolve) => cliProc.stdout.once("data", resolve));
    cliProc.kill();
    await new Promise((resolve) => cliProc.once("exit", resolve));

    const tooLarge = await fetch(`${baseUrl}/api/create-order`, {
      method: "POST",
      body: JSON.stringify({ pad: "x".repeat(40000) }),
    });
    assert.equal(tooLarge.status, 413);

    const unknownRoute = await fetch(`${baseUrl}/api/unknown`, { method: "POST", body: "{}" });
    assert.equal(unknownRoute.status, 404);

    const createOrderRes = await fetch(`${baseUrl}/api/create-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://ayushbpl10.github.io" },
      body: JSON.stringify({ amount: 50000, currency: "INR", receipt: "rcpt_http" }),
    });
    assert.equal(createOrderRes.status, 200);
    const createdOrder = await createOrderRes.json();
    assert.equal(createdOrder.order_id, "order_Loopback1");

    const sig = crypto.createHmac("sha256", secret).update("order_Loopback1|pay_Loop1").digest("hex");
    const verifiedNoBooking = await fetch(`${baseUrl}/api/verify-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        razorpay_order_id: "order_Loopback1",
        razorpay_payment_id: "pay_Loop1",
        razorpay_signature: sig,
      }),
    });
    assert.equal(verifiedNoBooking.status, 200);
    assert.deepEqual(await verifiedNoBooking.json(), {
      verified: true,
      order_id: "order_Loopback1",
      payment_id: "pay_Loop1",
    });
    const verified = await fetch(`${baseUrl}/api/verify-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://127.0.0.1:8080" },
      body: JSON.stringify({
        razorpay_order_id: "order_Loopback1",
        razorpay_payment_id: "pay_Loop1",
        razorpay_signature: sig,
        booking: {
          id: "AG-2612-LOOP",
          name: "Dummy Guest",
          email: "dummy@example.com",
          dateStr: "2026-12-01",
          topicTitle: "Microservices & System Design",
          agenda: "Scaling microservices",
        },
      }),
    });
    assert.equal(verified.status, 200);
    assert.equal(verified.headers.get("access-control-allow-origin"), "http://127.0.0.1:8080");
    const verifiedJson = await verified.json();
    assert.equal(verifiedJson.verified, true);
    assert.equal(verifiedJson.meet_url, "https://meet.google.com/http-meet-url");
    assert.equal(verifiedJson.email_sent, true);
    assert.equal(emailsSent.length, 1);

    const wedReject = await fetch(`${baseUrl}/api/book-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test", email: "test@example.com", dateStr: "2026-12-02" }),
    });
    assert.equal(wedReject.status, 400);

    const tueBook = await fetch(`${baseUrl}/api/book-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "AG-2612-TUE1",
        name: "Test Guest",
        email: "guest@example.com",
        dateStr: "2026-12-08",
        topicTitle: "Observability",
        agenda: "OTel collectors",
      }),
    });
    assert.equal(tueBook.status, 200);
    const tueJson = await tueBook.json();
    assert.equal(tueJson.ok, true);
    assert.equal(tueJson.email_sent, true);
    assert.equal(tueJson.meet_url, "https://meet.google.com/http-meet-url");
    assert.equal(emailsSent.length, 2);

    const healthRes = await fetch(`${baseUrl}/health`);
    assert.equal(healthRes.headers.get("x-content-type-options"), "nosniff");
    assert.equal(healthRes.headers.get("x-frame-options"), "DENY");
    assert.equal(healthRes.headers.get("referrer-policy"), "no-referrer");
    assert.equal(healthRes.headers.get("cache-control"), "no-store");
    const healthJson = await healthRes.json();
    assert.equal(healthJson.ok, true);
    assert.equal(healthJson.configured, true);
    assert.equal(healthJson.email_configured, true);
    assert.equal(healthJson.meet_configured, true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("Security hardening sanitizes inputs, rejects bad emails/XSS URLs, and rate-limits API abuse", async () => {
  assert.equal(isValidEmail("guest@example.com"), true);
  assert.equal(isValidEmail("bad\r\nheader@example.com"), false);
  assert.equal(isValidEmail("not-an-email"), false);
  assert.equal(sanitizeHttpUrl(""), "");
  assert.equal(sanitizeHttpUrl("javascript:alert(1)"), "");
  assert.equal(sanitizeHttpUrl("ftp://example.com"), "");
  assert.equal(sanitizeHttpUrl("not a url"), "");
  assert.equal(sanitizeHttpUrl("https://linkedin.com/in/test"), "https://linkedin.com/in/test");

  const sanitized = sanitizeBookingInput({
    id: "AG-1\r\nX-Injected: bad",
    name: "Alice\nBob",
    email: "alice@example.com",
    dateStr: "2026-12-01",
    profile: "javascript:alert(1)",
    agenda: "Line 1\nLine 2",
  });
  assert.equal(sanitized.id, "AG-1 X-Injected: bad");
  assert.equal(sanitized.name, "Alice Bob");
  assert.equal(sanitized.profile, "");
  assert.equal(sanitized.agenda, "Line 1\nLine 2");

  const limitedServer = createAppServer({
    keyId: "",
    keySecret: "",
    rateLimitWindowMs: 60_000,
    rateLimitMax: 2,
    rateLimitMaxBuckets: 1,
    allowedOrigins: new Set([]),
  });
  await new Promise((r) => limitedServer.listen(0, "127.0.0.1", r));
  const { port } = limitedServer.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    const badEmail = await fetch(`${baseUrl}/api/book-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": "203.0.113.9, 10.0.0.1" },
      body: JSON.stringify({ name: "Bob", email: "invalid-email", dateStr: "2026-12-01" }),
    });
    assert.equal(badEmail.status, 400);

    const secondHit = await fetch(`${baseUrl}/api/book-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": "203.0.113.9" },
      body: JSON.stringify({ name: "Bob", email: "invalid-email", dateStr: "2026-12-01" }),
    });
    assert.equal(secondHit.status, 400);

    const thirdHit = await fetch(`${baseUrl}/api/book-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": "203.0.113.9" },
      body: JSON.stringify({ name: "Bob", email: "bob@example.com", dateStr: "2026-12-01" }),
    });
    assert.equal(thirdHit.status, 429);
    assert.ok(Number(thirdHit.headers.get("retry-after")) >= 1);

    // Distinct IPs trigger bounded rate-limiter map pruning (maxBuckets=1 -> second IP hits, third clears map)
    await fetch(`${baseUrl}/api/book-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": "203.0.113.10" },
      body: JSON.stringify({ name: "Bob", email: "invalid-email", dateStr: "2026-12-01" }),
    });
    await fetch(`${baseUrl}/api/book-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": "203.0.113.11" },
      body: JSON.stringify({ name: "Bob", email: "invalid-email", dateStr: "2026-12-01" }),
    });
  } finally {
    await new Promise((r) => limitedServer.close(r));
  }
});

test("get-google-token helpers build OAuth URLs, extract codes, and handle callback & stdin", async () => {
  const authUrl = buildGoogleAuthUrl({
    clientId: "cid_test",
    redirectUri: "http://127.0.0.1:8919/oauth2callback",
  });
  assert.match(authUrl, /accounts\.google\.com\/o\/oauth2\/v2\/auth/);
  assert.match(authUrl, /scope=https%3A%2F%2Fwww\.googleapis\.com%2Fauth%2Fcalendar\.events/);

  assert.equal(extractAuthCode(""), "");
  assert.equal(extractAuthCode("4/raw-code"), "4/raw-code");
  assert.equal(extractAuthCode("http://127.0.0.1:8919/oauth2callback?code=4/url-code"), "4/url-code");
  assert.equal(extractAuthCode("not a url code=broken"), "");

  const exchanged = await exchangeAuthCode({
    code: "4/test",
    clientId: "cid",
    clientSecret: "csec",
    redirectUri: "http://127.0.0.1:8919/oauth2callback",
    fetchImpl: async () => ({ json: async () => ({ refresh_token: "1//ref_tok" }) }),
  });
  assert.equal(exchanged.refresh_token, "1//ref_tok");

  assert.equal(startTokenHelper({ env: {} }), null);
  assert.equal(runTokenCli(["node", "other.js"], {}, new URL("./get-google-token.mjs", import.meta.url).href), null);
  const errs = [];
  const prevExit = process.exitCode;
  runTokenCli(["node", "./get-google-token.mjs"], {}, new URL("./get-google-token.mjs", import.meta.url).href, (m) => errs.push(m));
  assert.equal(errs.length, 1);
  process.exitCode = prevExit;

  const logs = [];
  const { server } = startTokenHelper({
    env: { GOOGLE_CLIENT_ID: "cid", GOOGLE_CLIENT_SECRET: "csec" },
    redirectPort: 0,
    fetchImpl: async () => ({ json: async () => ({ refresh_token: "1//http_cb_tok" }) }),
    inStream: new PassThrough(),
    outStream: new PassThrough(),
    log: (m) => logs.push(m),
  });
  await new Promise((r) => server.once("listening", r));
  const { port } = server.address();
  const miss = await fetch(`http://127.0.0.1:${port}/oauth2callback`);
  assert.match(await miss.text(), /Missing code/);
  const hit = await fetch(`http://127.0.0.1:${port}/oauth2callback?code=4/cb_ok`);
  assert.match(await hit.text(), /Authorization received/);
  assert.ok(logs.some((l) => String(l).includes("1//http_cb_tok")));

  const fakeIn = new PassThrough();
  const fakeOut = new PassThrough();
  const stdinLogs = [];
  const helper2 = startTokenHelper({
    env: { GOOGLE_CLIENT_ID: "cid", GOOGLE_CLIENT_SECRET: "csec" },
    redirectPort: 0,
    fetchImpl: async () => ({ json: async () => ({ error: "bad_code" }) }),
    inStream: fakeIn,
    outStream: fakeOut,
    log: (m) => stdinLogs.push(m),
  });
  await new Promise((r) => helper2.server.once("listening", r));
  fakeIn.write("\n");
  fakeIn.write("4/pasted-code\n");
  await new Promise((r) => setTimeout(r, 80));
  assert.ok(stdinLogs.some((l) => String(l).includes("bad_code")));
});

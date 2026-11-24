import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { handleCreateOrder, handleVerifyPayment } from "./razorpay-handlers.js";
import { createAppServer } from "./server.js";

test("create-order rejects amounts below 100 paise", async () => {
  const res = await handleCreateOrder({
    body: { amount: 99, currency: "INR" },
    razorpayClient: { orders: { create: async () => ({ id: "order_1" }) } },
    keyId: "rzp_test_dummy",
  });
  assert.equal(res.status, 400);
  assert.match(res.payload.error, /100 paise/);
});

test("create-order returns 401 when Razorpay auth fails", async () => {
  const res = await handleCreateOrder({
    body: { amount: 50000, currency: "INR" },
    razorpayClient: {
      orders: {
        create: async () => {
          const e = new Error("Authentication failed");
          e.statusCode = 401;
          throw e;
        },
      },
    },
    keyId: "rzp_test_dummy",
  });
  assert.equal(res.status, 401);
});

test("create-order returns 500 on unexpected Razorpay API error", async () => {
  const res = await handleCreateOrder({
    body: { amount: 50000, currency: "INR" },
    razorpayClient: {
      orders: {
        create: async () => {
          throw new Error("Gateway timeout");
        },
      },
    },
    keyId: "rzp_test_dummy",
  });
  assert.equal(res.status, 500);
});

test("create-order creates order and returns key_id + order_id", async () => {
  const res = await handleCreateOrder({
    body: { amount: 50000, currency: "INR", receipt: "rcpt_42" },
    razorpayClient: {
      orders: {
        create: async ({ amount, currency }) => ({
          id: "order_Test123",
          amount,
          currency,
        }),
      },
    },
    keyId: "rzp_test_dummy",
  });
  assert.equal(res.status, 200);
  assert.deepEqual(res.payload, {
    order_id: "order_Test123",
    amount: 50000,
    currency: "INR",
    key_id: "rzp_test_dummy",
  });
});

test("verify-payment rejects missing fields with 400", () => {
  const res = handleVerifyPayment({
    body: { razorpay_order_id: "order_Test123" },
    keySecret: "test_secret_value",
  });
  assert.equal(res.status, 400);
  assert.equal(res.payload.verified, false);
});

test("verify-payment rejects forged signature with 400", () => {
  const res = handleVerifyPayment({
    body: {
      razorpay_order_id: "order_Test123",
      razorpay_payment_id: "pay_Test456",
      razorpay_signature: "0".repeat(64),
    },
    keySecret: "test_secret_value",
  });
  assert.equal(res.status, 400);
  assert.equal(res.payload.verified, false);
});

test("verify-payment accepts valid HMAC-SHA256 signature", () => {
  const secret = "test_secret_value";
  const orderId = "order_Test123";
  const paymentId = "pay_Test456";
  const validSig = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  const res = handleVerifyPayment({
    body: {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: validSig,
    },
    keySecret: secret,
  });
  assert.equal(res.status, 200);
  assert.deepEqual(res.payload, {
    verified: true,
    order_id: orderId,
    payment_id: paymentId,
  });
});

test("HTTP server /health, CORS, /api/create-order, and /api/verify-payment end-to-end", async () => {
  const secret = "smoke_secret_123";
  const server = createAppServer({
    keyId: "rzp_test_smoke",
    keySecret: secret,
    allowedOrigins: new Set(["https://ayushbpl10.github.io"]),
    razorpayClient: {
      orders: {
        create: async ({ amount, currency }) => ({ id: "order_Loopback1", amount, currency }),
      },
    },
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const h = await fetch(`${baseUrl}/health`);
    assert.equal(h.status, 200);
    assert.deepEqual(await h.json(), { ok: true, configured: true });

    const o = await fetch(`${baseUrl}/api/create-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://ayushbpl10.github.io" },
      body: JSON.stringify({ amount: 50000, currency: "INR", receipt: "rcpt_smoke" }),
    });
    assert.equal(o.status, 200);
    assert.equal(o.headers.get("access-control-allow-origin"), "https://ayushbpl10.github.io");
    assert.deepEqual(await o.json(), {
      order_id: "order_Loopback1",
      amount: 50000,
      currency: "INR",
      key_id: "rzp_test_smoke",
    });

    const sig = crypto.createHmac("sha256", secret).update("order_Loopback1|pay_Loop1").digest("hex");
    const v = await fetch(`${baseUrl}/api/verify-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://ayushbpl10.github.io" },
      body: JSON.stringify({
        razorpay_order_id: "order_Loopback1",
        razorpay_payment_id: "pay_Loop1",
        razorpay_signature: sig,
      }),
    });
    assert.equal(v.status, 200);
    assert.deepEqual(await v.json(), {
      verified: true,
      order_id: "order_Loopback1",
      payment_id: "pay_Loop1",
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

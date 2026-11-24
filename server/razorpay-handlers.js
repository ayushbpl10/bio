import crypto from "node:crypto";

export const DEFAULT_SESSION_PAISE = 50000; // ₹500 INR

/**
 * Create a Razorpay order after validating minimum paise amount (>= 100).
 * Accepts an injected Razorpay client so tests run offline cleanly.
 */
export async function handleCreateOrder({ body, razorpayClient, keyId }) {
  if (!keyId || !razorpayClient) {
    return {
      status: 500,
      payload: { error: "Razorpay server credentials are not configured." },
    };
  }

  const rawAmount = body?.amount ?? DEFAULT_SESSION_PAISE;
  const amount = Number(rawAmount);
  if (!Number.isInteger(amount) || amount < 100) {
    return {
      status: 400,
      payload: { error: "Amount must be an integer >= 100 paise (₹1 INR)." },
    };
  }

  const currency = typeof body?.currency === "string" && body.currency.trim()
    ? body.currency.trim().toUpperCase().slice(0, 8)
    : "INR";

  const receipt = typeof body?.receipt === "string" && body.receipt.trim()
    ? body.receipt.trim().slice(0, 40)
    : `ag_${Date.now()}`;

  try {
    const order = await razorpayClient.orders.create({
      amount,
      currency,
      receipt,
      notes: {
        topic: typeof body?.topic === "string" ? body.topic.slice(0, 80) : "",
        slot: typeof body?.slot === "string" ? body.slot.slice(0, 60) : "",
      },
    });

    return {
      status: 200,
      payload: {
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        key_id: keyId,
      },
    };
  } catch (err) {
    const statusCode = err?.statusCode || err?.error?.statusCode;
    if (statusCode === 401) {
      return {
        status: 401,
        payload: { error: "Razorpay authentication failed. Verify RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET." },
      };
    }
    return {
      status: 500,
      payload: { error: "Failed to create Razorpay order." },
    };
  }
}

/**
 * Verify Razorpay checkout payment signature using HMAC-SHA256 + timingSafeEqual.
 */
export function handleVerifyPayment({ body, keySecret }) {
  if (!keySecret) {
    return {
      status: 500,
      payload: { verified: false, error: "Server secret is not configured." },
    };
  }

  const orderId = typeof body?.razorpay_order_id === "string" ? body.razorpay_order_id.trim() : "";
  const paymentId = typeof body?.razorpay_payment_id === "string" ? body.razorpay_payment_id.trim() : "";
  const signature = typeof body?.razorpay_signature === "string" ? body.razorpay_signature.trim() : "";

  if (!orderId || !paymentId || !signature) {
    return {
      status: 400,
      payload: {
        verified: false,
        error: "Missing required fields: razorpay_order_id, razorpay_payment_id, and razorpay_signature.",
      },
    };
  }

  const expectedHex = crypto
    .createHmac("sha256", keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  const expectedBuf = Buffer.from(expectedHex, "utf8");
  const actualBuf = Buffer.from(signature, "utf8");

  if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
    return {
      status: 400,
      payload: {
        verified: false,
        error: "Invalid Razorpay payment signature.",
      },
    };
  }

  return {
    status: 200,
    payload: {
      verified: true,
      order_id: orderId,
      payment_id: paymentId,
    },
  };
}

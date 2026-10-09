import crypto from "node:crypto";

const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET } = process.env;

export const razorpayEnabled = Boolean(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET);
export const razorpayKeyId = razorpayEnabled ? RAZORPAY_KEY_ID : "";
export const webhookEnabled = razorpayEnabled && Boolean(RAZORPAY_WEBHOOK_SECRET);

const auth = "Basic " + Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");

async function call(path, body) {
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: auth, ...(body && { "Content-Type": "application/json" }) },
    body: body && JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Razorpay ${path}: ${data?.error?.description || res.status}`);
  return data;
}

// Amounts are in paise.
export const createOrder = (amount, receipt, notes) => call("/orders", { amount, currency: "INR", receipt, notes });
export const getPayment = (id) => call(`/payments/${encodeURIComponent(id)}`);
export const capturePayment = (id, amount) => call(`/payments/${encodeURIComponent(id)}/capture`, { amount, currency: "INR" });

function sameHex(expected, given) {
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(String(given || ""), "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const hmac = (secret, data) => crypto.createHmac("sha256", secret).update(data).digest("hex");

export const checkoutSignatureValid = (orderId, paymentId, signature) =>
  sameHex(hmac(RAZORPAY_KEY_SECRET, `${orderId}|${paymentId}`), signature);

export const webhookSignatureValid = (rawBody, signature) =>
  webhookEnabled && Boolean(rawBody) && sameHex(hmac(RAZORPAY_WEBHOOK_SECRET, rawBody), signature);

import { Router } from "express";
import rateLimit from "express-rate-limit";
import { FEE, designationText } from "../../../shared/constants.js";
import { cleanDetails, cleanUtr, normalizeMobile, validateDetails, validateUtr } from "../../../shared/validate.js";
import { PaymentOrder, Registration, Settings, nextRegNo } from "../models.js";
import { deleteFile, saveFile, sendFile, uploader } from "../lib/files.js";
import { notify } from "../lib/mail.js";
import { newPassToken, passQrPng, sendBhojanPass, whatsappEnabled } from "../lib/whatsapp.js";
import {
  capturePayment, checkoutSignatureValid, createOrder, getPayment,
  razorpayEnabled, razorpayKeyId, webhookSignatureValid,
} from "../lib/razorpay.js";

const router = Router();

const registerLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, message: { error: "Too many attempts. Please wait a few minutes and try again." } });
const findActive = (d) =>
  Registration.findOne({ $or: [{ email: d.email }, { mobile: d.mobile }], status: { $ne: "rejected" } });

const alreadyRegistered = (r) => ({
  error: `You are already registered (${r.regNo}). Use “Check status” to see whether it has been confirmed.`,
});

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

const statusLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, message: { error: "Too many attempts. Please wait a few minutes and try again." } });

router.get("/config", async (req, res) => {
  const s = await Settings.load();
  res.json({
    fee: FEE,
    registrationOpen: s.registrationOpen,
    upiId: s.upiId,
    payeeName: s.payeeName,
    accountName: s.accountName,
    bankName: s.bankName,
    accountNo: s.accountNo,
    ifsc: s.ifsc,
    contacts: s.contacts,
    qrUrl: s.qr?.fileId ? `/api/qr?v=${s.qr.fileId}` : null,
    razorpayKeyId,
    whatsappPass: whatsappEnabled,
  });
});

router.get("/qr", async (req, res) => {
  const s = await Settings.load();
  if (!s.qr?.fileId) return res.status(404).end();
  await sendFile(s.qr.fileId, res, "qr");
});

router.post("/register", registerLimit, uploader().single("receipt"), async (req, res) => {
  const settings = await Settings.load();
  if (!settings.registrationOpen) return res.status(403).json({ error: "Registration is closed." });

  const details = cleanDetails(req.body);
  const utr = cleanUtr(req.body?.utr);
  const fields = validateDetails(details);
  const utrError = validateUtr(utr);
  if (utrError) fields.utr = utrError;
  if (!req.file) fields.receipt = "Upload the payment screenshot or receipt.";
  if (Object.keys(fields).length) return res.status(400).json({ error: "Please correct the highlighted fields.", fields });

  if (await Registration.exists({ utr })) {
    return res.status(409).json({
      error: "This transaction ID has already been used for a registration.",
      fields: { utr: "Already used for another registration." },
    });
  }
  const existing = await findActive(details);
  if (existing) return res.status(409).json(alreadyRegistered(existing));

  const fileId = await saveFile(req.file, { kind: "receipt" });
  let reg;
  try {
    reg = await Registration.create({
      ...details,
      utr,
      regNo: await nextRegNo(),
      receipt: { fileId, filename: req.file.originalname, contentType: req.file.mimetype, size: req.file.size },
    });
  } catch (err) {
    await deleteFile(fileId);
    if (err.code === 11000) {
      return res.status(409).json({ error: "This transaction ID has already been used.", fields: { utr: "Already used." } });
    }
    throw err;
  }

  notify("received", reg);
  res.status(201).json({ regNo: reg.regNo, fullName: reg.fullName, email: reg.email });
});

// ---- Razorpay: order → Checkout in the browser → verify (and/or webhook) → registration ----

router.post("/pay/order", registerLimit, async (req, res) => {
  if (!razorpayEnabled) return res.status(404).json({ error: "Online payment is not available." });
  const settings = await Settings.load();
  if (!settings.registrationOpen) return res.status(403).json({ error: "Registration is closed." });

  const details = cleanDetails(req.body);
  const fields = validateDetails(details);
  if (Object.keys(fields).length) return res.status(400).json({ error: "Please correct the highlighted fields.", fields });
  const existing = await findActive(details);
  if (existing) return res.status(409).json(alreadyRegistered(existing));

  const order = await createOrder(FEE * 100, `abrsm26-${Date.now()}`, {
    name: details.fullName.slice(0, 250),
    email: details.email,
    mobile: details.mobile,
  });
  await PaymentOrder.create({ orderId: order.id, details });
  res.json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId: razorpayKeyId });
});

// Called from both the browser (after Checkout) and the webhook, so it must be safe to run twice.
async function completeRazorpay(orderId, paymentId) {
  const done = await Registration.findOne({ razorpayOrderId: orderId });
  if (done) return done;

  const intent = await PaymentOrder.findOne({ orderId });
  if (!intent) throw httpError(404, "We could not find this payment session. Please contact the organising team.");

  let payment = await getPayment(paymentId);
  if (payment.order_id !== orderId || payment.amount !== FEE * 100 || payment.currency !== "INR") {
    throw httpError(400, "This payment does not match the registration fee.");
  }
  if (payment.status === "authorized") {
    // Only needed when auto-capture is off in the Razorpay dashboard.
    payment = await capturePayment(paymentId, payment.amount).catch(() => getPayment(paymentId));
  }
  if (payment.status !== "captured") throw httpError(400, "The payment has not completed yet.");

  // Paying twice (e.g. two tabs) still creates a record so the money is accounted for; admins decide on a refund.
  const duplicate = await findActive(intent.details);
  let reg;
  try {
    reg = await Registration.create({
      ...intent.details,
      regNo: await nextRegNo(),
      paymentMethod: "razorpay",
      utr: paymentId,
      razorpayOrderId: orderId,
      status: duplicate ? "pending" : "verified",
      reviewedAt: duplicate ? undefined : new Date(),
      pass: { token: newPassToken() },
      adminNote: duplicate ? `Paid again while already registered as ${duplicate.regNo} — check whether a refund is due.` : undefined,
    });
  } catch (err) {
    if (err.code === 11000) {
      const r = await Registration.findOne({ razorpayOrderId: orderId });
      if (r) return r;
    }
    throw err;
  }

  if (reg.status === "verified") {
    const [emailed] = await Promise.all([notify("verified", reg), sendBhojanPass(reg)]);
    if (emailed) {
      reg.confirmationEmailedAt = new Date();
      await reg.save();
    }
  } else {
    notify("received", reg);
  }
  return reg;
}

router.post("/pay/verify", registerLimit, async (req, res) => {
  if (!razorpayEnabled) return res.status(404).json({ error: "Online payment is not available." });
  const { orderId, paymentId, signature } = req.body || {};
  if (typeof orderId !== "string" || typeof paymentId !== "string" || !checkoutSignatureValid(orderId, paymentId, signature)) {
    return res.status(400).json({ error: "Payment could not be verified. If money was deducted, do not pay again — contact the organising team." });
  }
  const reg = await completeRazorpay(orderId, paymentId);
  res.status(201).json({
    regNo: reg.regNo,
    fullName: reg.fullName,
    email: reg.email,
    status: reg.status,
    emailed: Boolean(reg.confirmationEmailedAt),
    passToken: reg.status === "verified" ? reg.pass?.token : undefined,
    whatsappSent: Boolean(reg.pass?.sentAt),
  });
});

// Razorpay → server, so a registration is saved even if the participant closes the page right after paying.
router.post("/pay/webhook", async (req, res) => {
  if (!webhookSignatureValid(req.rawBody, req.get("X-Razorpay-Signature"))) return res.status(400).end();
  const payment = req.body?.payload?.payment?.entity;
  if (["payment.captured", "order.paid"].includes(req.body?.event) && payment?.order_id) {
    if (await PaymentOrder.exists({ orderId: payment.order_id })) await completeRazorpay(payment.order_id, payment.id);
  }
  res.json({ ok: true });
});

router.post("/status", statusLimit, async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const mobile = normalizeMobile(req.body?.mobile);
  if (!email || !mobile) return res.status(400).json({ error: "Enter both your email and mobile number." });

  const r = await Registration.findOne({ email, mobile }).sort({ createdAt: -1 });
  if (!r) return res.status(404).json({ error: "No registration found with this email and mobile number." });

  res.json({
    regNo: r.regNo,
    fullName: r.fullName,
    status: r.status,
    note: r.status === "rejected" ? r.adminNote || "" : "",
    passToken: r.status === "verified" ? r.pass?.token : undefined,
    submittedAt: r.createdAt,
  });
});

// ---- Bhojan Pass ----

const passLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, message: { error: "Too many attempts. Please wait a few minutes and try again." } });
const resendLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, message: { error: "Too many attempts. Please try again later." } });
const findByPass = (token) => (typeof token === "string" && token.length < 40 ? Registration.findOne({ "pass.token": token }) : null);

router.get("/pass/:token", passLimit, async (req, res) => {
  const r = await findByPass(req.params.token);
  if (!r) return res.status(404).json({ error: "This Bhojan Pass link is not valid." });
  res.json({
    regNo: r.regNo,
    fullName: r.fullName,
    designation: designationText(r),
    district: r.district,
    cadre: r.cadre,
    valid: r.status === "verified",
    sentAt: r.pass.sentAt,
    canResend: whatsappEnabled && r.status === "verified",
    mobileEnd: r.mobile.slice(-2),
  });
});

router.get("/pass/:token/qr.png", passLimit, async (req, res) => {
  const r = await findByPass(req.params.token);
  if (!r) return res.status(404).end();
  res.set({ "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" });
  res.send(await passQrPng(r.pass.token, `${req.protocol}://${req.get("host")}`));
});

router.post("/pass/:token/resend", resendLimit, async (req, res) => {
  const r = await findByPass(req.params.token);
  if (!r) return res.status(404).json({ error: "This Bhojan Pass link is not valid." });
  if (r.pass.sentAt && Date.now() - r.pass.sentAt < 2 * 60 * 1000) {
    return res.status(429).json({ error: "The pass was just sent. Please wait two minutes before sending it again." });
  }
  if (r.pass.sendCount >= 5) return res.status(429).json({ error: "The pass has already been sent several times. Please contact the organising team." });
  const result = await sendBhojanPass(r);
  if (!result.sent) return res.status(502).json({ error: result.error });
  res.json({ sent: true, sentAt: r.pass.sentAt });
});

export default router;

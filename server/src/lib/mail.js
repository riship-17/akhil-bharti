import { EVENT, FEE, rupees } from "../../../shared/constants.js";
import { Registration } from "../models.js";
import { certificateFilename, certificatePdf } from "./certificate.js";
import { passQrPng, passUrl, siteUrl } from "./pass.js";

// Email through Resend (https://resend.com). MAIL_FROM must use a domain verified in Resend;
// onboarding@resend.dev only delivers to the Resend account owner's own address (fine for testing).
const { RESEND_API_KEY, MAIL_FROM = "ABRSM Gujarat <onboarding@resend.dev>", MAIL_REPLY_TO } = process.env;

export const mailEnabled = Boolean(RESEND_API_KEY);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function send(message, attempt = 1) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: MAIL_FROM, reply_to: MAIL_REPLY_TO || undefined, ...message }),
    signal: AbortSignal.timeout(30000),
  });
  if (res.status === 429 && attempt < 5) {
    await sleep((Number(res.headers.get("retry-after")) || attempt) * 1000);
    return send(message, attempt + 1);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Resend ${res.status}: ${body.message || "request failed"}`);
  return body.id;
}

const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function layout(body) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1f1a17;line-height:1.6">
  <div style="border-top:4px solid #a4380f;padding:20px 0 6px">
    <div style="font-weight:bold;font-size:16px">${esc(EVENT.org)}</div>
    <div style="color:#6b625b;font-size:13px">${esc(EVENT.titleEn)} · Higher Education</div>
  </div>
  ${body}
  <div style="border-top:1px solid #e6ddd2;margin-top:24px;padding-top:12px;color:#6b625b;font-size:12px">
    ${esc(EVENT.dateEn)} · ${esc(EVENT.venueEn)}
  </div></div>`;
}

const row = (k, v) =>
  `<tr><td style="padding:6px 16px 6px 0;color:#6b625b">${esc(k)}</td><td style="padding:6px 0;font-weight:bold">${esc(v)}</td></tr>`;

const button = (href, label) =>
  `<a href="${esc(href)}" style="display:inline-block;background:#a4380f;color:#fff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:8px">${label}</a>`;

const PASS_QR_ID = "bhojan-pass-qr";

export const certificateUrl = (token, site) => `${site}/api/certificate/${token}`;

const templates = {
  received: (r) => ({
    subject: `Registration received – ${r.regNo} | ABRSM State Conference 2026`,
    html: layout(`
      <p>Dear ${esc(r.fullName)},</p>
      <p>We have received your registration. Once the organising team verifies your payment, your Bhojan Pass will be emailed to you and will also appear in your account on the website.</p>
      <table style="border-collapse:collapse;margin:12px 0">${row("Registration No", r.regNo)}${row("Bhojan Pass fee", rupees(FEE))}${r.donation ? row("Sahay Shulk (helping fund)", rupees(r.donation)) : ""}${row("Total paid", rupees(r.amount))}</table>`),
  }),

  // Bhojan Pass, sent by admins after verifying the payment. The QR code is embedded in the email (cid:)
  // so it shows without loading remote images.
  pass: async (r, site) => ({
    subject: `Registration confirmed + Bhojan Pass – ${r.regNo} | ABRSM State Conference 2026`,
    html: layout(`
      <p>Dear ${esc(r.fullName)},</p>
      <p>Thank you for registering for the ABRSM Gujarat State Conference 2026. Your payment is confirmed.</p>
      <table style="border-collapse:collapse;margin:12px 0">${row("Registration No", r.regNo)}${row("Date", EVENT.dateEn)}${row("Venue", EVENT.venueEn)}</table>
      <div style="border:2px solid #a4380f;border-radius:12px;padding:20px;text-align:center;margin:20px 0">
        <div style="font-weight:bold;font-size:18px;color:#a4380f">Bhojan Pass</div>
        <img src="cid:${PASS_QR_ID}" width="220" height="220" alt="Bhojan Pass QR code" style="display:block;margin:12px auto">
        <div style="font-weight:bold">${esc(r.fullName)} · ${esc(r.regNo)}</div>
        <p style="margin:8px 0 16px">Show this QR code at the food counter.</p>
        ${button(passUrl(r.pass.token, site), "Open Bhojan Pass")}
      </div>
      <p style="color:#6b625b;font-size:13px">Please keep this email. You can also open the pass any time by logging in to the website. Your certificate of participation will be emailed to you after the conference.</p>`),
    attachments: [{
      filename: `${r.regNo}-bhojan-pass.png`,
      content: (await passQrPng(r.pass.token, site)).toString("base64"),
      content_type: "image/png",
      content_id: PASS_QR_ID,
    }],
  }),

  rejected: (r) => ({
    subject: `Action needed on your registration – ${r.regNo}`,
    html: layout(`
      <p>Dear ${esc(r.fullName)},</p>
      <p>We could not verify the payment for your registration <b>${esc(r.regNo)}</b>.</p>
      ${r.adminNote ? `<p style="background:#f6e7dc;padding:10px 12px;border-left:3px solid #a4380f">${esc(r.adminNote)}</p>` : ""}
      <p>Please contact the organising team or register again with the correct payment details.</p>`),
  }),

  reset: (u, site, { token }) => ({
    subject: "Reset your password | ABRSM State Conference 2026",
    html: layout(`
      <p>Dear ${esc(u.name)},</p>
      <p>We received a request to reset the password for your account (${esc(u.email)}). The link below works for 30 minutes.</p>
      <p style="margin:20px 0">${button(`${site}/reset/${token}`, "Choose a new password")}</p>
      <p style="color:#6b625b;font-size:13px">If you did not ask for this, you can ignore this email; your password will not change.</p>`),
  }),

  certificate: async (r, site, { signatories }) => ({
    subject: `Certificate of participation – ${EVENT.titleEn} | ${r.regNo}`,
    html: layout(`
      <p>Dear ${esc(r.fullName)},</p>
      <p>Thank you for taking part in the ABRSM Gujarat State Conference 2026. Your certificate of participation is attached to this email as a PDF.</p>
      <p style="margin:20px 0">${button(certificateUrl(r.pass.token, site), "Download certificate")}</p>`),
    attachments: [{
      filename: certificateFilename(r),
      content: (await certificatePdf(r, signatories)).toString("base64"),
      content_type: "application/pdf",
    }],
  }),
};

// Sends one email to a participant (a registration or a user account). Never throws — returns true when Resend accepted it.
// `origin` is the site address from the current request, used for links when PUBLIC_URL is not set.
export async function notify(kind, to, { origin, ...extra } = {}) {
  if (!mailEnabled) {
    console.log(`[mail off] ${kind} → ${to.email}`);
    return false;
  }
  try {
    const { subject, html, attachments } = await templates[kind](to, siteUrl(origin), extra);
    await send({ to: [to.email], subject, html, attachments });
    return true;
  } catch (err) {
    console.error(`[mail] ${kind} to ${to.email} failed:`, err.message);
    return false;
  }
}

// Issues the Bhojan Pass (it then shows in the participant's account) and emails it.
// Records the result on the registration so a broadcast can carry on where it stopped.
export async function sendPass(reg, origin) {
  const issuedAt = reg.pass?.issuedAt || new Date();
  if (!reg.pass?.issuedAt) {
    reg.set("pass.issuedAt", issuedAt);
    await Registration.updateOne({ _id: reg._id }, { $set: { "pass.issuedAt": issuedAt } });
  }
  if (!mailEnabled) return { sent: false, error: "Email is not set up on the server (RESEND_API_KEY)." };
  try {
    const { subject, html, attachments } = await templates.pass(reg, siteUrl(origin));
    await send({ to: [reg.email], subject, html, attachments });
    const emailedAt = new Date();
    reg.set("pass.emailedAt", emailedAt);
    reg.set("pass.lastError", undefined);
    await Registration.updateOne({ _id: reg._id }, { $set: { "pass.emailedAt": emailedAt }, $unset: { "pass.lastError": "" } });
    return { sent: true };
  } catch (err) {
    console.error(`[mail] Bhojan Pass to ${reg.email} failed:`, err.message);
    reg.set("pass.lastError", err.message.slice(0, 300));
    await Registration.updateOne({ _id: reg._id }, { $set: { "pass.lastError": reg.pass.lastError } });
    return { sent: false, error: err.message };
  }
}

// Certificate email; records the result on the registration so a bulk send can be resumed.
export async function sendCertificate(reg, { origin, signatories }) {
  if (!mailEnabled) return { sent: false, error: "Email is not set up on the server (RESEND_API_KEY)." };
  try {
    const { subject, html, attachments } = await templates.certificate(reg, siteUrl(origin), { signatories });
    await send({ to: [reg.email], subject, html, attachments });
    await Registration.updateOne({ _id: reg._id }, { $set: { "certificate.emailedAt": new Date() }, $unset: { "certificate.lastError": "" } });
    return { sent: true };
  } catch (err) {
    console.error(`[mail] certificate to ${reg.email} failed:`, err.message);
    await Registration.updateOne({ _id: reg._id }, { $set: { "certificate.lastError": err.message.slice(0, 300) } });
    return { sent: false, error: err.message };
  }
}

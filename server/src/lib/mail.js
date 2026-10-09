import { EVENT, FEE } from "../../../shared/constants.js";
import { Registration } from "../models.js";
import { certificateFilename, certificatePdf } from "./certificate.js";
import { passQrPng, passUrl, siteUrl } from "./whatsapp.js";

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
    <div style="font-weight:bold;font-size:16px">${esc(EVENT.orgGu)}</div>
    <div style="color:#6b625b;font-size:13px">${esc(EVENT.titleGu)} · ${esc(EVENT.titleEn)}</div>
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
      <p>નમસ્તે ${esc(r.fullName)},</p>
      <p>આપની નોંધણી અમને મળી ગઈ છે. ચુકવણીની ચકાસણી બાદ આપને કન્ફર્મેશન મોકલવામાં આવશે.</p>
      <p style="color:#6b625b">We have received your registration. You will get a confirmation once the organising team verifies your payment.</p>
      <table style="border-collapse:collapse;margin:12px 0">${row("Registration No", r.regNo)}${row("Amount", `₹${FEE}`)}${row("Transaction ID", r.utr)}</table>`),
  }),

  // Confirmation + Bhojan Pass: the QR code is embedded in the email (cid:) so it shows without loading remote images.
  verified: async (r, site) => ({
    subject: `Registration confirmed + Bhojan Pass – ${r.regNo} | ABRSM State Conference 2026`,
    html: layout(`
      <p>નમસ્તે ${esc(r.fullName)},</p>
      <p>અખિલ ભારતીય રાષ્ટ્રીય શૈક્ષિક મહાસંઘ, ગુજરાત રાજ્ય સંમેલન ૨૦૨૬ માટે આપનું રજિસ્ટ્રેશન સફળતાપૂર્વક થઈ ગયું છે. આપનો ખૂબ ખૂબ આભાર!</p>
      <p style="color:#6b625b">Thank you for registering for the ABRSM Gujarat State Conference 2026. Your payment is confirmed.</p>
      <table style="border-collapse:collapse;margin:12px 0">${row("Registration No", r.regNo)}${row("Date", EVENT.dateEn)}${row("Venue", EVENT.venueEn)}</table>
      <div style="border:2px solid #a4380f;border-radius:12px;padding:20px;text-align:center;margin:20px 0">
        <div style="font-weight:bold;font-size:18px;color:#a4380f">ભોજન પાસ · Bhojan Pass</div>
        <img src="cid:${PASS_QR_ID}" width="220" height="220" alt="Bhojan Pass QR code" style="display:block;margin:12px auto">
        <div style="font-weight:bold">${esc(r.fullName)} · ${esc(r.regNo)}</div>
        <p style="margin:8px 0 16px">ભોજન સમયે આ QR કોડ કાઉન્ટર પર બતાવો.<br><span style="color:#6b625b">Show this QR code at the food counter.</span></p>
        ${button(passUrl(r.pass.token, site), "Open Bhojan Pass")}
      </div>
      <p style="color:#6b625b;font-size:13px">Please keep this email. Your certificate of participation will be emailed to you after the conference.</p>`),
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
      <p>નમસ્તે ${esc(r.fullName)},</p>
      <p>We could not verify the payment for your registration <b>${esc(r.regNo)}</b>.</p>
      ${r.adminNote ? `<p style="background:#f6e7dc;padding:10px 12px;border-left:3px solid #a4380f">${esc(r.adminNote)}</p>` : ""}
      <p>Please contact the organising team or register again with the correct payment details.</p>`),
  }),

  certificate: async (r, site, signatories) => ({
    subject: `Certificate of participation – ${EVENT.titleEn} | ${r.regNo}`,
    html: layout(`
      <p>નમસ્તે ${esc(r.fullName)},</p>
      <p>${esc(EVENT.titleGu)}માં સહભાગી થવા બદલ આપનો હાર્દિક આભાર. આપનું સહભાગિતા પ્રમાણપત્ર આ ઇમેઇલ સાથે જોડેલ છે.</p>
      <p style="color:#6b625b">Thank you for taking part in the ABRSM Gujarat State Conference 2026. Your certificate of participation is attached to this email as a PDF.</p>
      <p style="margin:20px 0">${button(certificateUrl(r.pass.token, site), "Download certificate")}</p>`),
    attachments: [{
      filename: certificateFilename(r),
      content: (await certificatePdf(r, signatories)).toString("base64"),
      content_type: "application/pdf",
    }],
  }),
};

// Sends one email to a participant. Never throws — returns true when Resend accepted it.
// `origin` is the site address from the current request, used for links when PUBLIC_URL is not set.
export async function notify(kind, registration, { origin, signatories } = {}) {
  if (!mailEnabled) {
    console.log(`[mail off] ${kind} → ${registration.email}`);
    return false;
  }
  try {
    const { subject, html, attachments } = await templates[kind](registration, siteUrl(origin), signatories);
    await send({ to: [registration.email], subject, html, attachments });
    return true;
  } catch (err) {
    console.error(`[mail] ${kind} to ${registration.email} failed:`, err.message);
    return false;
  }
}

// Confirmation email with the Bhojan Pass; records when it went out.
export async function sendConfirmation(reg, origin) {
  const sent = await notify("verified", reg, { origin });
  if (sent) {
    reg.confirmationEmailedAt = new Date();
    await Registration.updateOne({ _id: reg._id }, { $set: { confirmationEmailedAt: reg.confirmationEmailedAt } });
  }
  return sent;
}

// Certificate email; records the result on the registration so a bulk send can be resumed.
export async function sendCertificate(reg, { origin, signatories }) {
  if (!mailEnabled) return { sent: false, error: "Email is not set up on the server (RESEND_API_KEY)." };
  try {
    const { subject, html, attachments } = await templates.certificate(reg, siteUrl(origin), signatories);
    await send({ to: [reg.email], subject, html, attachments });
    await Registration.updateOne({ _id: reg._id }, { $set: { "certificate.emailedAt": new Date() }, $unset: { "certificate.lastError": "" } });
    return { sent: true };
  } catch (err) {
    console.error(`[mail] certificate to ${reg.email} failed:`, err.message);
    await Registration.updateOne({ _id: reg._id }, { $set: { "certificate.lastError": err.message.slice(0, 300) } });
    return { sent: false, error: err.message };
  }
}

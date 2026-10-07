import nodemailer from "nodemailer";
import { EVENT, FEE } from "../../../shared/constants.js";

const { SMTP_HOST, SMTP_PORT = "465", SMTP_USER, SMTP_PASS, MAIL_FROM } = process.env;

const transport = SMTP_HOST
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: Number(SMTP_PORT) === 465,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    })
  : null;

export const mailEnabled = Boolean(transport);

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

const templates = {
  received: (r) => ({
    subject: `Registration received – ${r.regNo} | ABRSM State Conference 2026`,
    html: layout(`
      <p>નમસ્તે ${esc(r.fullName)},</p>
      <p>આપની નોંધણી અમને મળી ગઈ છે. ચુકવણીની ચકાસણી બાદ આપને કન્ફર્મેશન મોકલવામાં આવશે.</p>
      <p style="color:#6b625b">We have received your registration. You will get a confirmation once the organising team verifies your payment.</p>
      <table style="border-collapse:collapse;margin:12px 0">${row("Registration No", r.regNo)}${row("Amount", `₹${FEE}`)}${row("UTR", r.utr)}</table>`),
  }),
  verified: (r) => ({
    subject: `Registration confirmed – ${r.regNo} | ABRSM State Conference 2026`,
    html: layout(`
      <p>નમસ્તે ${esc(r.fullName)},</p>
      <p>અખિલ ભારતીય રાષ્ટ્રીય શૈક્ષિક મહાસંઘ, ગુજરાત રાજ્ય સંમેલન ૨૦૨૬ માટે આપનું રજિસ્ટ્રેશન સફળતાપૂર્વક થઈ ગયું છે. આપનો ખૂબ ખૂબ આભાર!</p>
      <p style="color:#6b625b">Thank you for registering for the ABRSM Gujarat State Conference 2026. Your payment has been verified and your registration is confirmed.</p>
      <table style="border-collapse:collapse;margin:12px 0">${row("Registration No", r.regNo)}${row("Date", EVENT.dateEn)}${row("Venue", EVENT.venueEn)}</table>
      <p>Please keep this registration number with you on the day of the conference.</p>`),
  }),
  rejected: (r) => ({
    subject: `Action needed on your registration – ${r.regNo}`,
    html: layout(`
      <p>નમસ્તે ${esc(r.fullName)},</p>
      <p>We could not verify the payment for your registration <b>${esc(r.regNo)}</b>.</p>
      ${r.adminNote ? `<p style="background:#f6e7dc;padding:10px 12px;border-left:3px solid #a4380f">${esc(r.adminNote)}</p>` : ""}
      <p>Please contact the organising team or register again with the correct payment details.</p>`),
  }),
};

export async function notify(kind, registration) {
  if (!transport) {
    console.log(`[mail off] ${kind} → ${registration.email}`);
    return false;
  }
  try {
    const { subject, html } = templates[kind](registration);
    await transport.sendMail({ from: MAIL_FROM || SMTP_USER, to: registration.email, subject, html });
    return true;
  } catch (err) {
    console.error(`[mail] ${kind} to ${registration.email} failed:`, err.message);
    return false;
  }
}

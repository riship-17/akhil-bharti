import crypto from "node:crypto";
import QRCode from "qrcode";
import { Registration } from "../models.js";

// WhatsApp Bhojan Pass through AiSensy's Campaign API.
// The API campaign in AiSensy must use a template with an Image header and three body params:
//   {{1}} participant name, {{2}} registration number, {{3}} link to the pass page.
const { AISENSY_API_KEY, AISENSY_CAMPAIGN_NAME, PUBLIC_URL } = process.env;
const SITE = (PUBLIC_URL || "").replace(/\/+$/, "");

export const whatsappEnabled = Boolean(AISENSY_API_KEY && AISENSY_CAMPAIGN_NAME && SITE);

export const passUrl = (token, origin = SITE) => `${origin}/pass/${token}`;
const qrImageUrl = (token) => `${SITE}/api/pass/${token}/qr.png`;

export const newPassToken = () => crypto.randomBytes(12).toString("base64url");

export function passQrPng(token, origin) {
  return QRCode.toBuffer(passUrl(token, SITE || origin), { width: 640, margin: 2, errorCorrectionLevel: "M" });
}

async function sendTemplate({ destination, userName, templateParams, media }) {
  const res = await fetch("https://backend.aisensy.com/campaign/t1/api/v2", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiKey: AISENSY_API_KEY,
      campaignName: AISENSY_CAMPAIGN_NAME,
      destination,
      userName,
      source: "State Conference 2026 website",
      templateParams,
      media,
    }),
    signal: AbortSignal.timeout(15000),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`AiSensy ${res.status}: ${body.slice(0, 300)}`);
  return body;
}

// Sends (or re-sends) the pass for a confirmed registration. Never throws — the result says what happened.
export async function sendBhojanPass(reg) {
  if (!whatsappEnabled) return { sent: false, error: "WhatsApp sending is not set up on the server." };
  if (reg.status !== "verified") return { sent: false, error: "The Bhojan Pass is sent only for confirmed registrations." };
  if (!reg.pass?.token) {
    reg.set("pass.token", newPassToken());
    await reg.save();
  }
  try {
    await sendTemplate({
      destination: `+91${reg.mobile}`,
      userName: reg.fullName,
      templateParams: [reg.fullName, reg.regNo, passUrl(reg.pass.token)],
      media: { url: qrImageUrl(reg.pass.token), filename: `${reg.regNo}-bhojan-pass.png` },
    });
    await Registration.updateOne({ _id: reg._id }, { $set: { "pass.sentAt": new Date() }, $inc: { "pass.sendCount": 1 }, $unset: { "pass.lastError": "" } });
    reg.set("pass.sentAt", new Date());
    return { sent: true };
  } catch (err) {
    console.error(`[whatsapp] pass for ${reg.regNo} failed:`, err.message);
    await Registration.updateOne({ _id: reg._id }, { $set: { "pass.lastError": err.message.slice(0, 300) } });
    return { sent: false, error: "Could not send the pass on WhatsApp right now." };
  }
}

import crypto from "node:crypto";
import QRCode from "qrcode";

// Bhojan Pass: the token is the secret part of the pass link, and the QR code encodes that link.
const SITE = (process.env.PUBLIC_URL || "").replace(/\/+$/, "");

// PUBLIC_URL wins; otherwise the address the request came in on (fine for local testing).
export const siteUrl = (origin) => SITE || origin || "";
export const passUrl = (token, origin) => `${siteUrl(origin)}/pass/${token}`;

export const newPassToken = () => crypto.randomBytes(12).toString("base64url");

export function passQrPng(token, origin) {
  return QRCode.toBuffer(passUrl(token, origin), { width: 640, margin: 2, errorCorrectionLevel: "M" });
}

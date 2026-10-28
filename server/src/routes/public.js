import { Router } from "express";
import rateLimit from "express-rate-limit";
import { FEE, UPI, designationText } from "../../../shared/constants.js";
import { Registration, Settings } from "../models.js";
import { sendFile } from "../lib/files.js";
import { mailEnabled } from "../lib/mail.js";
import { certificateFilename, certificatePdf } from "../lib/certificate.js";
import { passQrPng } from "../lib/pass.js";
import { payeeOf, receiptFilename, receiptPdf } from "../lib/receipt.js";

const router = Router();

router.get("/config", async (req, res) => {
  const s = await Settings.load();
  res.json({
    fee: FEE,
    registrationOpen: s.registrationOpen,
    upiId: s.upiId || UPI.id,
    payeeName: s.payeeName || UPI.payee,
    accountName: s.accountName,
    bankName: s.bankName,
    accountNo: s.accountNo,
    ifsc: s.ifsc,
    contacts: s.contacts,
    qrUrl: s.qr?.fileId ? `/api/qr?v=${s.qr.fileId}` : null,
    mailEnabled,
    // Commit the backend is running (set by Render), to check that a deploy went out.
    version: process.env.RENDER_GIT_COMMIT?.slice(0, 7),
  });
});

router.get("/qr", async (req, res) => {
  const s = await Settings.load();
  if (!s.qr?.fileId) return res.status(404).end();
  await sendFile(s.qr.fileId, res, "qr");
});

// ---- Bhojan Pass: opened from the email or the participant's account, and scanned at the food counter ----

const passLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, message: { error: "Too many attempts. Please wait a few minutes and try again." } });
const findByPass = (token) => (typeof token === "string" && token.length < 40 ? Registration.findOne({ "pass.token": token }) : null);

router.get("/pass/:token", passLimit, async (req, res) => {
  const r = await findByPass(req.params.token);
  if (!r?.pass?.issuedAt) return res.status(404).json({ error: "This Bhojan Pass link is not valid." });
  res.json({
    regNo: r.regNo,
    fullName: r.fullName,
    designation: designationText(r),
    district: r.district,
    cadre: r.cadre,
    valid: r.status === "verified",
  });
});

router.get("/pass/:token/qr.png", passLimit, async (req, res) => {
  const r = await findByPass(req.params.token);
  if (!r?.pass?.issuedAt) return res.status(404).end();
  res.set({ "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" });
  res.send(await passQrPng(r.pass.token, `${req.protocol}://${req.get("host")}`));
});

// Fee receipt, linked from the participant's account once the pass is issued.
router.get("/pass/:token/receipt.pdf", passLimit, async (req, res) => {
  const r = await findByPass(req.params.token);
  if (!r?.pass?.issuedAt || r.status !== "verified") return res.status(404).json({ error: "Receipt not found." });
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `inline; filename="${receiptFilename(r)}"`,
    "Cache-Control": "private, no-store",
  });
  res.send(await receiptPdf(r, payeeOf(await Settings.load())));
});

// ---- Certificate (after the conference, once admins have released certificates) ----

router.get("/certificate/:token", passLimit, async (req, res) => {
  const [r, settings] = await Promise.all([findByPass(req.params.token), Settings.load()]);
  if (!r || r.status !== "verified") return res.status(404).json({ error: "Certificate not found." });
  if (!settings.certificate?.releasedAt) return res.status(404).json({ error: "Certificates will be available after the conference." });
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `inline; filename="${certificateFilename(r)}"`,
    "Cache-Control": "private, no-store",
  });
  res.send(await certificatePdf(r, settings.certificate.signatories));
});

export default router;

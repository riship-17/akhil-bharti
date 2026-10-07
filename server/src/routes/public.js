import { Router } from "express";
import rateLimit from "express-rate-limit";
import { FEE } from "../../../shared/constants.js";
import { cleanDetails, cleanUtr, normalizeMobile, validateDetails, validateUtr } from "../../../shared/validate.js";
import { Registration, Settings, nextRegNo } from "../models.js";
import { deleteFile, saveFile, sendFile, uploader } from "../lib/files.js";
import { notify } from "../lib/mail.js";

const router = Router();

const registerLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, message: { error: "Too many attempts. Please wait a few minutes and try again." } });
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
  const existing = await Registration.findOne({
    $or: [{ email: details.email }, { mobile: details.mobile }],
    status: { $ne: "rejected" },
  });
  if (existing) {
    return res.status(409).json({
      error: `You are already registered (${existing.regNo}). Use “Check status” to see whether it has been confirmed.`,
    });
  }

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
    submittedAt: r.createdAt,
  });
});

export default router;

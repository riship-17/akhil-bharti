import crypto from "node:crypto";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { CADRES, FEE, STATUSES, designationText, labelOf } from "../../../shared/constants.js";
import { Registration, Settings } from "../models.js";
import { deleteFile, saveFile, sendFile, uploader } from "../lib/files.js";
import { mailEnabled, notify, sendCertificate, sendConfirmation } from "../lib/mail.js";
import { certificateFilename, certificatePdf } from "../lib/certificate.js";
import { newPassToken, sendBhojanPass, whatsappEnabled } from "../lib/whatsapp.js";

const router = Router();
const { ADMIN_PASSWORD, JWT_SECRET } = process.env;

const originOf = (req) => `${req.protocol}://${req.get("host")}`;
const sha = (s) => crypto.createHash("sha256").update(String(s)).digest();

router.post(
  "/login",
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, message: { error: "Too many attempts. Try again in 15 minutes." } }),
  (req, res) => {
    if (!crypto.timingSafeEqual(sha(req.body?.password ?? ""), sha(ADMIN_PASSWORD))) {
      return res.status(401).json({ error: "Incorrect password." });
    }
    res.json({ token: jwt.sign({ role: "admin" }, JWT_SECRET, { expiresIn: "12h" }) });
  }
);

// Everything below needs a token. File/CSV links opened in a new tab pass it as ?t=
router.use((req, res, next) => {
  const token = req.get("authorization")?.replace(/^Bearer /, "") || req.query.t;
  try {
    jwt.verify(String(token), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Your session has expired. Please log in again." });
  }
});

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function buildFilter({ status, district, q }) {
  const filter = {};
  if (STATUSES.includes(status)) filter.status = status;
  if (district) filter.district = String(district);
  const term = String(q || "").trim();
  if (term) {
    const rx = new RegExp(escapeRegex(term), "i");
    filter.$or = ["regNo", "fullName", "email", "mobile", "utr", "institution"].map((f) => ({ [f]: rx }));
  }
  return filter;
}

async function findReg(req, res) {
  const r = mongoose.isValidObjectId(req.params.id) ? await Registration.findById(req.params.id) : null;
  if (!r) res.status(404).json({ error: "Not found." });
  return r;
}

router.get("/stats", async (req, res) => {
  const [byStatus, byDistrict] = await Promise.all([
    Registration.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
    Registration.aggregate([
      { $match: { status: { $ne: "rejected" } } },
      { $group: { _id: "$district", n: { $sum: 1 } } },
      { $sort: { n: -1 } },
    ]),
  ]);
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const x of byStatus) counts[x._id] = x.n;
  res.json({
    ...counts,
    total: counts.pending + counts.verified + counts.rejected,
    collected: counts.verified * FEE,
    byDistrict: byDistrict.map((d) => ({ district: d._id, count: d.n })),
    mailEnabled,
    whatsappEnabled,
  });
});

router.get("/registrations", async (req, res) => {
  const limit = 50;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const filter = buildFilter(req.query);
  const [items, total] = await Promise.all([
    Registration.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Registration.countDocuments(filter),
  ]);
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
});

router.get("/registrations/:id", async (req, res) => {
  const r = await findReg(req, res);
  if (r) res.json(r);
});

router.get("/registrations/:id/receipt", async (req, res) => {
  const r = await findReg(req, res);
  if (r) await sendFile(r.receipt?.fileId, res, `${r.regNo}-receipt`);
});

router.patch("/registrations/:id", async (req, res) => {
  const r = await findReg(req, res);
  if (!r) return;
  const { status, adminNote } = req.body || {};
  if (status !== undefined && !STATUSES.includes(status)) return res.status(400).json({ error: "Invalid status." });

  const changed = status && status !== r.status;
  if (status) r.status = status;
  if (adminNote !== undefined) r.adminNote = String(adminNote).slice(0, 500);
  if (changed) r.reviewedAt = status === "pending" ? undefined : new Date();
  if (r.status === "verified" && !r.pass?.token) r.set("pass.token", newPassToken());
  await r.save();

  let emailed = false;
  let whatsapp = null;
  if (changed && status === "verified") {
    [emailed, whatsapp] = await Promise.all([sendConfirmation(r, originOf(req)), sendBhojanPass(r)]);
  } else if (changed && status === "rejected") {
    emailed = await notify("rejected", r);
  }
  res.json({ registration: await Registration.findById(r._id), emailed, whatsapp });
});

router.post("/registrations/:id/pass", async (req, res) => {
  const r = await findReg(req, res);
  if (!r) return;
  const whatsapp = await sendBhojanPass(r);
  res.status(whatsapp.sent ? 200 : 400).json({ registration: await Registration.findById(r._id), whatsapp, error: whatsapp.error });
});

router.post("/registrations/:id/email", async (req, res) => {
  const r = await findReg(req, res);
  if (!r) return;
  if (r.status !== "verified") return res.status(400).json({ error: "The confirmation email is sent only for confirmed registrations." });
  if (!mailEnabled) return res.status(400).json({ error: "Email is not set up on the server (RESEND_API_KEY)." });
  if (!(await sendConfirmation(r, originOf(req)))) return res.status(502).json({ error: "Could not send the email. Check the server log for the reason." });
  res.json({ registration: await Registration.findById(r._id) });
});

router.get("/registrations/:id/certificate", async (req, res) => {
  const r = await findReg(req, res);
  if (!r) return;
  const s = await Settings.load();
  res.set({ "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${certificateFilename(r)}"` });
  res.send(await certificatePdf(r, s.certificate?.signatories));
});

router.post("/registrations/:id/certificate", async (req, res) => {
  const r = await findReg(req, res);
  if (!r) return;
  if (r.status !== "verified") return res.status(400).json({ error: "Certificates are sent only for confirmed registrations." });
  await ensurePassToken(r);
  const s = await Settings.load();
  const result = await sendCertificate(r, { origin: originOf(req), signatories: s.certificate?.signatories });
  res.status(result.sent ? 200 : 502).json({ registration: await Registration.findById(r._id), error: result.error });
});

router.delete("/registrations/:id", async (req, res) => {
  const r = await findReg(req, res);
  if (!r) return;
  await deleteFile(r.receipt?.fileId);
  await r.deleteOne();
  res.json({ ok: true });
});

// ---- Certificates: emailed to every confirmed participant after the conference ----

async function ensurePassToken(r) {
  // The certificate download link uses the pass token as its secret.
  if (!r.pass?.token) {
    r.set("pass.token", newPassToken());
    await r.save();
  }
}

// One bulk send at a time, kept in memory. If the server restarts mid-way, pressing Send again
// carries on with the people who have not received theirs yet.
let certificateRun = null;

async function runCertificates(registrations, { origin, signatories }) {
  for (const r of registrations) {
    await ensurePassToken(r);
    const { sent } = await sendCertificate(r, { origin, signatories });
    certificateRun[sent ? "sent" : "failed"]++;
    await new Promise((done) => setTimeout(done, 600)); // stay under Resend's rate limit
  }
}

async function certificateSummary() {
  const s = await Settings.load();
  const [verified, sent, failed] = await Promise.all([
    Registration.countDocuments({ status: "verified" }),
    Registration.countDocuments({ status: "verified", "certificate.emailedAt": { $exists: true } }),
    Registration.countDocuments({ status: "verified", "certificate.emailedAt": { $exists: false }, "certificate.lastError": { $exists: true } }),
  ]);
  return { releasedAt: s.certificate?.releasedAt || null, verified, sent, failed, run: certificateRun, mailEnabled };
}

router.get("/certificates", async (req, res) => res.json(await certificateSummary()));

router.get("/certificates/preview", async (req, res) => {
  const s = await Settings.load();
  const sample = (await Registration.findOne({ status: "verified" }).sort({ createdAt: 1 })) || {
    regNo: "ABRSM26-0000", fullName: "Participant Name", designation: "assistant_professor", institution: "Name of the College, City",
  };
  res.set({ "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="certificate-preview.pdf"' });
  res.send(await certificatePdf(sample, s.certificate?.signatories));
});

router.post("/certificates/send", async (req, res) => {
  if (!mailEnabled) return res.status(400).json({ error: "Email is not set up on the server (RESEND_API_KEY)." });
  if (certificateRun?.running) return res.json(await certificateSummary());

  const s = await Settings.load();
  if (!s.certificate?.releasedAt) {
    s.set("certificate.releasedAt", new Date());
    await s.save();
  }
  const todo = await Registration.find({ status: "verified", "certificate.emailedAt": { $exists: false } }).sort({ createdAt: 1 });
  certificateRun = { running: true, total: todo.length, sent: 0, failed: 0, startedAt: new Date() };
  runCertificates(todo, { origin: originOf(req), signatories: s.certificate.signatories })
    .catch((err) => {
      console.error("[certificates] bulk send stopped:", err);
      certificateRun.error = err.message;
    })
    .finally(() => {
      certificateRun.running = false;
      certificateRun.finishedAt = new Date();
    });
  res.json(await certificateSummary());
});

router.get("/export.csv", async (req, res) => {
  const rows = await Registration.find(buildFilter(req.query)).sort({ createdAt: 1 }).lean();
  const cols = [
    ["Reg No", (r) => r.regNo],
    ["Status", (r) => r.status],
    ["Submitted", (r) => new Date(r.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })],
    ["Full Name", (r) => r.fullName],
    ["Email", (r) => r.email],
    ["Mobile", (r) => r.mobile],
    ["Alternative Contact", (r) => r.altContact],
    ["Cadre", (r) => labelOf(CADRES, r.cadre)],
    ["District", (r) => r.district],
    ["Designation", (r) => designationText(r)],
    ["Field of Study", (r) => r.fieldOfStudy],
    ["Organizational Responsibility", (r) => r.orgResponsibility],
    ["Institution & Address", (r) => r.institution],
    ["Residential Address", (r) => r.residentialAddress],
    ["Amount", (r) => r.amount],
    ["Payment", (r) => (r.paymentMethod === "razorpay" ? "Razorpay" : "UPI")],
    ["UTR / Payment ID", (r) => r.utr],
    ["Bhojan Pass sent on WhatsApp", (r) => (r.pass?.sentAt ? new Date(r.pass.sentAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "")],
    ["Confirmation emailed", (r) => (r.confirmationEmailedAt ? new Date(r.confirmationEmailedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "")],
    ["Certificate emailed", (r) => (r.certificate?.emailedAt ? new Date(r.certificate.emailedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "")],
    ["Admin Note", (r) => r.adminNote],
  ];
  const cell = (v) => {
    let s = v == null ? "" : String(v);
    if (/^[=+\-@]/.test(s)) s = "'" + s; // stop spreadsheet formula injection
    return `"${s.replace(/"/g, '""')}"`;
  };
  const csv = [cols.map((c) => cell(c[0])), ...rows.map((r) => cols.map((c) => cell(c[1](r))))]
    .map((line) => line.join(","))
    .join("\r\n");
  const stamp = new Date().toISOString().slice(0, 10);
  res.set({
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="abrsm-registrations-${stamp}.csv"`,
  });
  res.send("﻿" + csv); // BOM so Excel shows Gujarati correctly
});

const SETTINGS_FIELDS = ["upiId", "payeeName", "accountName", "bankName", "accountNo", "ifsc"];

router.get("/settings", async (req, res) => res.json(await Settings.load()));

router.put("/settings", async (req, res) => {
  const s = await Settings.load();
  const body = req.body || {};
  for (const k of SETTINGS_FIELDS) if (typeof body[k] === "string") s[k] = body[k].trim().slice(0, 200);
  if (typeof body.registrationOpen === "boolean") s.registrationOpen = body.registrationOpen;
  if (Array.isArray(body.certificate?.signatories)) {
    s.set("certificate.signatories", body.certificate.signatories
      .slice(0, 3)
      .map((x) => ({ name: String(x.name || "").trim().slice(0, 80), role: String(x.role || "").trim().slice(0, 80) }))
      .filter((x) => x.name));
  }
  if (Array.isArray(body.contacts)) {
    s.contacts = body.contacts
      .slice(0, 10)
      .map((c) => ({ name: String(c.name || "").trim(), role: String(c.role || "").trim(), phone: String(c.phone || "").trim() }))
      .filter((c) => c.name && c.phone);
  }
  await s.save();
  res.json(s);
});

router.post("/settings/qr", uploader(["image/jpeg", "image/png", "image/webp"]).single("qr"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Choose a QR image to upload." });
  const s = await Settings.load();
  const old = s.qr?.fileId;
  s.qr = { fileId: await saveFile(req.file, { kind: "qr" }), contentType: req.file.mimetype };
  await s.save();
  await deleteFile(old);
  res.json(s);
});

router.delete("/settings/qr", async (req, res) => {
  const s = await Settings.load();
  await deleteFile(s.qr?.fileId);
  s.qr = undefined;
  await s.save();
  res.json(s);
});

export default router;

import crypto from "node:crypto";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { CADRES, FEE, STATUSES, designationText, labelOf } from "../../../shared/constants.js";
import { Registration, Settings } from "../models.js";
import { deleteFile, saveFile, sendFile, uploader } from "../lib/files.js";
import { mailEnabled, notify } from "../lib/mail.js";

const router = Router();
const { ADMIN_PASSWORD, JWT_SECRET } = process.env;

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
  if (r) await sendFile(r.receipt.fileId, res, `${r.regNo}-receipt`);
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
  await r.save();

  let emailed = false;
  if (changed && (status === "verified" || status === "rejected")) {
    emailed = await notify(status, r);
    if (emailed && status === "verified") {
      r.confirmationEmailedAt = new Date();
      await r.save();
    }
  }
  res.json({ registration: r, emailed });
});

router.delete("/registrations/:id", async (req, res) => {
  const r = await findReg(req, res);
  if (!r) return;
  await deleteFile(r.receipt?.fileId);
  await r.deleteOne();
  res.json({ ok: true });
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
    ["UTR", (r) => r.utr],
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

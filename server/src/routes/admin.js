import crypto from "node:crypto";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import {
  CADRES, FEE, MAX_DONATION, PAY_MODES, STATUSES, UPI, bankOf, designationText, labelOf, rupees, universityText,
} from "../../../shared/constants.js";
import { Payment, Registration, Settings, User } from "../models.js";
import { cleanUtr, validEmail, validateUtr } from "../../../shared/validate.js";
import { deleteFile, saveFile, sendFile, uploader } from "../lib/files.js";
import { mailEnabled, notify, sendCertificate, sendPass } from "../lib/mail.js";
import { bulkStatus, ensurePassToken, queueBulk, stopBulk } from "../lib/bulk.js";
import { certificateFilename, certificatePdf } from "../lib/certificate.js";
import { newPassToken } from "../lib/pass.js";
import { payeeOf, receiptFilename, receiptPdf } from "../lib/receipt.js";
import { requireAdmin, signToken } from "../lib/auth.js";
import { xlsx } from "../lib/xlsx.js";
import {
  COLUMNS, matchAll, matchRegistration, readStatement, releasePayment, savePayments, suggestionsFor, waitingFilter,
} from "../lib/statement.js";

const router = Router();
const { ADMIN_PASSWORD } = process.env;

const originOf = (req) => `${req.protocol}://${req.get("host")}`;
const sha = (s) => crypto.createHash("sha256").update(String(s)).digest();

router.post(
  "/login",
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, message: { error: "Too many attempts. Try again in 15 minutes." } }),
  (req, res) => {
    if (!crypto.timingSafeEqual(sha(req.body?.password ?? ""), sha(ADMIN_PASSWORD))) {
      return res.status(401).json({ error: "Incorrect password." });
    }
    res.json({ token: signToken({ role: "admin" }, "12h") });
  }
);

// Everything below needs an admin token (participant tokens are refused).
router.use(requireAdmin);

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function buildFilter({ status, district, q }) {
  const filter = {};
  if (STATUSES.includes(status)) filter.status = status;
  if (district) filter.district = String(district);
  const term = String(q || "").trim();
  if (term) {
    const rx = new RegExp(escapeRegex(term), "i");
    filter.$or = ["regNo", "fullName", "email", "mobile", "utr", "university", "universityOther", "department", "institution"].map((f) => ({ [f]: rx }));
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
    Registration.aggregate([
      {
        $group: {
          _id: "$status",
          n: { $sum: 1 },
          amount: { $sum: { $ifNull: ["$amount", FEE] } },
          donation: { $sum: { $ifNull: ["$donation", 0] } },
        },
      },
    ]),
    Registration.aggregate([
      { $match: { status: { $ne: "rejected" } } },
      { $group: { _id: "$district", n: { $sum: 1 } } },
      { $sort: { n: -1 } },
    ]),
  ]);
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  const verified = { amount: 0, donation: 0 };
  for (const x of byStatus) {
    counts[x._id] = x.n;
    if (x._id === "verified") Object.assign(verified, x);
  }
  res.json({
    ...counts,
    total: counts.pending + counts.verified + counts.rejected,
    collected: verified.amount,
    donations: verified.donation,
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
  if (r) await sendFile(r.receipt?.fileId, res, `${r.regNo}-receipt`);
});

router.patch("/registrations/:id", async (req, res) => {
  const r = await findReg(req, res);
  if (!r) return;
  const { status, adminNote, amount } = req.body || {};
  if (status !== undefined && !STATUSES.includes(status)) return res.status(400).json({ error: "Invalid status." });
  // Verifying with the amount the statement shows, when it differs from what the participant entered.
  if (amount !== undefined) {
    if (status !== "verified" || !Number.isInteger(amount) || amount < FEE || amount > FEE + MAX_DONATION) {
      return res.status(400).json({ error: `Enter the amount received, at least ${rupees(FEE)}.` });
    }
    r.amount = amount;
    r.donation = amount - FEE;
  }

  const changed = status && status !== r.status;
  if (status) r.status = status;
  if (adminNote !== undefined) r.adminNote = String(adminNote).slice(0, 500);
  if (changed) r.reviewedAt = status === "pending" ? undefined : new Date();
  if (r.status === "verified" && !r.pass?.token) r.set("pass.token", newPassToken());
  if (changed && status === "rejected") await releasePayment(r);
  await r.save();

  // Verifying sends the Bhojan Pass straight away; rejecting tells the participant why.
  let emailed = false, error;
  if (changed && status === "verified") ({ sent: emailed, error } = await sendPass(r, originOf(req)));
  if (changed && status === "rejected") emailed = await notify("rejected", r);
  res.json({ registration: await Registration.findById(r._id), emailed, error });
});

// Set or correct the UTR (e.g. read from the screenshot, or a typo), then look for it in the uploaded statements.
router.put("/registrations/:id/utr", async (req, res) => {
  const r = await findReg(req, res);
  if (!r) return;
  if (r.status !== "pending") return res.status(400).json({ error: "Only a pending registration's UTR can be changed." });
  const utr = cleanUtr(req.body?.utr);
  const invalid = validateUtr(utr, r.payMode);
  if (invalid) return res.status(400).json({ error: invalid });
  const other = await Registration.findOne({ utr, _id: { $ne: r._id }, status: { $ne: "rejected" } });
  if (other) return res.status(409).json({ error: `This UTR is already used by registration ${other.regNo} (${other.fullName}).` });

  if (utr !== r.utr) await releasePayment(r);
  r.utr = utr;
  await r.save();
  const found = await matchRegistration(r);
  const { sent: emailed, error } = found === "verified" ? await sendPass(r, originOf(req)) : {};
  res.json({ registration: await Registration.findById(r._id), found, emailed, error });
});

// Statement credits nobody has claimed that look like this participant's payment.
router.get("/registrations/:id/suggestions", async (req, res) => {
  const r = await findReg(req, res);
  if (r) res.json({ items: r.received?.foundAt ? [] : await suggestionsFor(r) });
});

// Correct a mistyped email. The participant's account changes too, so they log in with the new email
// and every later email (pass, certificate, password reset) goes there.
router.put("/registrations/:id/email", async (req, res) => {
  const r = await findReg(req, res);
  if (!r) return;
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!validEmail(email)) return res.status(400).json({ error: "Enter a valid email address." });
  if (email === r.email) return res.json({ registration: r });

  const [otherUser, otherReg] = await Promise.all([
    User.findOne(r.user ? { email, _id: { $ne: r.user } } : { email }),
    Registration.findOne({ email, _id: { $ne: r._id }, status: { $ne: "rejected" } }),
  ]);
  if (otherUser || otherReg) {
    return res.status(409).json({ error: `${email} is already used by ${otherReg ? `registration ${otherReg.regNo}` : "another account"}.` });
  }

  if (r.user) {
    try {
      await User.updateOne({ _id: r.user }, { $set: { email } });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ error: `${email} is already used by another account.` });
      throw err;
    }
  }
  r.email = email;
  await r.save();
  res.json({ registration: await Registration.findById(r._id) });
});

// Send (or resend) one participant's Bhojan Pass by email. Without email set up, the pass is still
// issued and shows in the participant's account.
router.post("/registrations/:id/pass", async (req, res) => {
  const r = await findReg(req, res);
  if (!r) return;
  if (r.status !== "verified") return res.status(400).json({ error: "Verify the payment before sending the Bhojan Pass." });
  await ensurePassToken(r);
  const result = await sendPass(r, originOf(req));
  res.json({ registration: await Registration.findById(r._id), emailed: result.sent, error: result.error });
});

// The fee receipt PDF that goes out with the Bhojan Pass.
router.get("/registrations/:id/fee-receipt", async (req, res) => {
  const r = await findReg(req, res);
  if (!r) return;
  if (r.status !== "verified") return res.status(400).json({ error: "The fee receipt is issued once the payment is verified." });
  res.set({ "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${receiptFilename(r)}"` });
  res.send(await receiptPdf(r, payeeOf(await Settings.load())));
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
  await releasePayment(r);
  await r.deleteOne();
  res.json({ ok: true });
});

// ---- PhonePe statements: upload, match UTRs to registrations, list and download (see lib/statement.js) ----

const STATEMENT_TYPES = [
  "text/csv", "application/csv", "text/comma-separated-values", "text/plain", "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream", "",
];

// Pending registrations that can't be matched yet: their UTR isn't in any statement, or they have no UTR.
const notFoundFilter = { $or: [waitingFilter(), { status: "pending", $or: [{ utr: { $exists: false } }, { utr: "" }] }] };

router.post(
  "/statement",
  uploader(STATEMENT_TYPES, "Upload the statement downloaded from PhonePe (.csv or .xlsx).").single("statement"),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Choose the PhonePe statement file to upload." });
    const { credits, debits, unreadable } = readStatement(req.file.buffer);
    const added = await savePayments(credits);
    const { verified, differs } = await matchAll();
    // Bhojan Passes go out by themselves, within the daily email limit.
    if (verified.length && mailEnabled) await queueBulk("passes", originOf(req));
    const [unregistered, notFound] = await Promise.all([
      Payment.countDocuments({ registration: { $exists: false } }),
      Registration.countDocuments(notFoundFilter),
    ]);
    res.json({
      credits: credits.length, added, debits, unreadable,
      verified: verified.length,
      differs: differs.map((r) => ({ _id: r._id, regNo: r.regNo, fullName: r.fullName, amount: r.amount, received: r.received.amount })),
      unregistered, notFound, mailEnabled,
    });
  }
);

const VIEWS = {
  matched: { "reg._id": { $exists: true }, $expr: { $eq: ["$amount", "$reg.amount"] } },
  differs: { "reg._id": { $exists: true }, $expr: { $ne: ["$amount", "$reg.amount"] } },
  unregistered: { "reg._id": { $exists: false } },
};

// Statement credits with the registration each one paid for.
const paymentsWithReg = (match = {}) => [
  { $lookup: { from: "registrations", localField: "registration", foreignField: "_id", as: "reg" } },
  { $set: { reg: { $first: "$reg" } } },
  { $match: match },
  { $project: { "reg.receipt": 0, "reg.pass": 0, "reg.certificate": 0 } },
  { $sort: { paidAt: -1, _id: -1 } },
];

router.get("/payments", async (req, res) => {
  const limit = 50;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const view = String(req.query.view || "");
  const term = String(req.query.q || "").trim();
  const rx = term && new RegExp(escapeRegex(term), "i");

  const counts = Object.fromEntries(await Promise.all([
    Payment.countDocuments().then((n) => ["all", n]),
    ...Object.entries(VIEWS).map(([k, m]) => Payment.aggregate([...paymentsWithReg(m), { $count: "n" }]).then((x) => [k, x[0]?.n || 0])),
    Registration.countDocuments(notFoundFilter).then((n) => ["notFound", n]),
  ]));

  if (view === "notFound") {
    const filter = rx ? { $and: [notFoundFilter, { $or: ["regNo", "fullName", "mobile", "utr"].map((f) => ({ [f]: rx })) }] } : notFoundFilter;
    const [items, total] = await Promise.all([
      Registration.find(filter, "regNo fullName mobile utr amount payMode createdAt").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Registration.countDocuments(filter),
    ]);
    return res.json({ kind: "registrations", items, total, page, pages: Math.max(1, Math.ceil(total / limit)), counts });
  }

  const match = { ...(VIEWS[view] || {}) };
  if (rx) match.$or = ["utr", "details", "txnId", "reg.regNo", "reg.fullName"].map((f) => ({ [f]: rx }));
  const [{ items, total }] = await Payment.aggregate([
    ...paymentsWithReg(match),
    { $facet: { items: [{ $skip: (page - 1) * limit }, { $limit: limit }], total: [{ $count: "n" }] } },
    { $project: { items: 1, total: { $ifNull: [{ $first: "$total.n" }, 0] } } },
  ]);
  res.json({ kind: "payments", items, total, page, pages: Math.max(1, Math.ceil(total / limit)), counts });
});

const resultOf = (p) =>
  !p.reg ? "Not registered"
  : p.reg.amount !== p.amount ? `Amount differs: registered ${rupees(p.reg.amount)}`
  : p.reg.status === "verified" ? "Verified"
  : p.reg.status;

// The uploaded statements as one Excel file, in PhonePe's columns, with the matching registration added on the right.
router.get("/payments/export.xlsx", async (req, res) => {
  const payments = await Payment.aggregate(paymentsWithReg(VIEWS[req.query.view] || {}));
  const header = [...COLUMNS.map(([, name]) => name), "Reg No", "Participant", "Mobile", "Registered amount", "Result"];
  const rows = payments.map((p) => [
    p.date, p.time, p.details, p.txnId, p.utr, "CREDIT", p.instrument, p.amount,
    p.reg?.regNo, p.reg?.fullName, p.reg?.mobile, p.reg?.amount, resultOf(p),
  ]);
  const stamp = new Date().toISOString().slice(0, 10);
  res.set({
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="abrsm-payments-${stamp}.xlsx"`,
  });
  res.send(xlsx("Payments", [header, ...rows], [14, 10, 42, 26, 15, 16, 28, 10, 15, 32, 12, 18, 30]));
});

// ---- Bulk emails (Bhojan Pass broadcast, certificates), sent in daily phases: see lib/bulk.js ----

const NO_MAIL = "Email is not set up on the server (RESEND_API_KEY).";

async function passSummary() {
  const [verified, sent, failed, status] = await Promise.all([
    Registration.countDocuments({ status: "verified" }),
    Registration.countDocuments({ status: "verified", "pass.emailedAt": { $exists: true } }),
    Registration.countDocuments({ status: "verified", "pass.emailedAt": { $exists: false }, "pass.lastError": { $exists: true } }),
    bulkStatus("passes"),
  ]);
  return { verified, sent, failed, ...status, mailEnabled };
}

router.get("/passes", async (req, res) => res.json(await passSummary()));

// Emails the Bhojan Pass to every verified participant who hasn't been emailed yet, within the daily limit.
router.post("/passes/send", async (req, res) => {
  if (!mailEnabled) return res.status(400).json({ error: NO_MAIL });
  await queueBulk("passes", originOf(req));
  res.json(await passSummary());
});

router.post("/passes/stop", async (req, res) => {
  await stopBulk("passes");
  res.json(await passSummary());
});

// ---- Certificates: emailed to every confirmed participant after the conference ----

async function certificateSummary() {
  const [s, verified, sent, failed, status] = await Promise.all([
    Settings.load(),
    Registration.countDocuments({ status: "verified" }),
    Registration.countDocuments({ status: "verified", "certificate.emailedAt": { $exists: true } }),
    Registration.countDocuments({ status: "verified", "certificate.emailedAt": { $exists: false }, "certificate.lastError": { $exists: true } }),
    bulkStatus("certificates"),
  ]);
  return { releasedAt: s.certificate?.releasedAt || null, verified, sent, failed, ...status, mailEnabled };
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
  if (!mailEnabled) return res.status(400).json({ error: NO_MAIL });
  const s = await Settings.load();
  if (!s.certificate?.releasedAt) {
    s.set("certificate.releasedAt", new Date());
    await s.save();
  }
  await queueBulk("certificates", originOf(req));
  res.json(await certificateSummary());
});

router.post("/certificates/stop", async (req, res) => {
  await stopBulk("certificates");
  res.json(await certificateSummary());
});

const istTime = (d) => (d ? new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "");

function sendCsv(res, name, cols, rows) {
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
    "Content-Disposition": `attachment; filename="${name}-${stamp}.csv"`,
  });
  res.send("\uFEFF" + csv); // BOM so Excel shows Gujarati correctly
}

router.get("/export.csv", async (req, res) => {
  const rows = await Registration.find(buildFilter(req.query)).sort({ createdAt: 1 }).lean();
  const cols = [
    ["Reg No", (r) => r.regNo],
    ["Status", (r) => r.status],
    ["Submitted", (r) => istTime(r.createdAt)],
    ["Full Name", (r) => r.fullName],
    ["Email", (r) => r.email],
    ["Mobile", (r) => r.mobile],
    ["Alternative Contact", (r) => r.altContact],
    ["Cadre", (r) => labelOf(CADRES, r.cadre)],
    ["District", (r) => r.district],
    ["Designation", (r) => designationText(r)],
    ["Field of Study", (r) => r.fieldOfStudy],
    ["Organizational Responsibility", (r) => r.orgResponsibility],
    ["University", (r) => r.university && universityText(r)],
    ["College / Department", (r) => r.department],
    ["Institution Address", (r) => r.institution],
    ["Residential Address", (r) => r.residentialAddress],
    ["Bhojan Pass Fee", () => FEE],
    ["Sahay Shulk", (r) => r.donation || 0],
    ["Payment mode", (r) => PAY_MODES[r.payMode] || PAY_MODES.upi],
    ["Total Paid", (r) => r.amount],
    ["UTR", (r) => r.utr],
    ["Received (statement)", (r) => r.received?.amount],
    ["Bhojan Pass emailed", (r) => istTime(r.pass?.emailedAt)],
    ["Certificate emailed", (r) => istTime(r.certificate?.emailedAt)],
    ["Admin Note", (r) => r.adminNote],
  ];
  sendCsv(res, "abrsm-registrations", cols, rows);
});

const SETTINGS_FIELDS = ["upiId", "payeeName", "accountName", "bankName", "bankBranch", "accountNo", "ifsc"];

// Empty UPI / bank fields fall back to the organiser's PhonePe UPI and bank account, as on the public site.
const withUpiDefaults = (s) => ({ ...s.toObject(), upiId: s.upiId || UPI.id, payeeName: s.payeeName || UPI.payee, ...bankOf(s) });

router.get("/settings", async (req, res) => res.json(withUpiDefaults(await Settings.load())));

router.put("/settings", async (req, res) => {
  const s = await Settings.load();
  const body = req.body || {};
  for (const k of SETTINGS_FIELDS) if (typeof body[k] === "string") s[k] = body[k].trim().slice(0, 200);
  if (typeof body.registrationOpen === "boolean") s.registrationOpen = body.registrationOpen;
  const dailyLimit = Number(body.mail?.dailyLimit);
  if (Number.isInteger(dailyLimit) && dailyLimit >= 10 && dailyLimit <= 100000) s.set("mail.dailyLimit", dailyLimit);
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
  res.json(withUpiDefaults(s));
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

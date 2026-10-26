import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  cleanAccount, cleanDetails, cleanUtr, validateAccount, validateDetails, validatePassword, validateUtr,
} from "../../../shared/validate.js";
import { Registration, Settings, User, nextRegNo } from "../models.js";
import { deleteFile, saveFile, shrinkReceipt, uploader } from "../lib/files.js";
import { mailEnabled, notify } from "../lib/mail.js";
import {
  checkPassword, hashPassword, newResetToken, publicUser, requireUser, sha256, userToken,
} from "../lib/auth.js";

// Participant accounts: sign up, log in, reset a forgotten password, see "My registration" and register.
const router = Router();

const limit = (minutes, max) =>
  rateLimit({ windowMs: minutes * 60 * 1000, limit: max, message: { error: "Too many attempts. Please wait a few minutes and try again." } });
const loginLimit = limit(15, 20);
const originOf = (req) => `${req.protocol}://${req.get("host")}`;

router.post("/auth/signup", limit(60, 10), async (req, res) => {
  const account = cleanAccount(req.body);
  const password = req.body?.password;
  const fields = validateAccount(account, password);
  if (Object.keys(fields).length) return res.status(400).json({ error: "Please correct the highlighted fields.", fields });
  if (await User.exists({ email: account.email })) {
    return res.status(409).json({ error: "An account with this email already exists. Log in instead.", fields: { email: "Already registered — log in instead." } });
  }
  let user;
  try {
    user = await User.create({ ...account, passwordHash: await hashPassword(password) });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "An account with this email already exists. Log in instead." });
    throw err;
  }
  res.status(201).json({ token: userToken(user), user: publicUser(user) });
});

router.post("/auth/login", loginLimit, async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const user = email && (await User.findOne({ email }));
  if (!user || !(await checkPassword(req.body?.password, user.passwordHash))) {
    return res.status(401).json({ error: "Incorrect email or password." });
  }
  res.json({ token: userToken(user), user: publicUser(user) });
});

// Always answers the same way, so it can't be used to find out who has an account.
router.post("/auth/forgot", limit(60, 5), async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const user = email && (await User.findOne({ email }));
  if (user && mailEnabled) {
    const token = newResetToken();
    user.reset = { tokenHash: sha256(token), expiresAt: new Date(Date.now() + 30 * 60 * 1000) };
    await user.save();
    await notify("reset", user, { origin: originOf(req), token });
  }
  res.json({ ok: true, mailEnabled });
});

router.post("/auth/reset", loginLimit, async (req, res) => {
  const token = String(req.body?.token || "");
  const password = req.body?.password;
  const pwError = validatePassword(password);
  if (pwError) return res.status(400).json({ error: pwError, fields: { password: pwError } });
  const user = token && (await User.findOne({ "reset.tokenHash": sha256(token), "reset.expiresAt": { $gt: new Date() } }));
  if (!user) return res.status(400).json({ error: "This reset link has expired or was already used. Ask for a new one." });
  user.passwordHash = await hashPassword(password);
  user.passwordChangedAt = new Date();
  user.reset = undefined;
  await user.save();
  res.json({ token: userToken(user), user: publicUser(user) });
});

// ---- Everything below needs a logged-in participant ----

// The participant's latest registration. Registrations made before accounts existed are linked
// the first time someone logs in with the same email and mobile number.
async function registrationOf(user) {
  const own = await Registration.findOne({ user: user._id }).sort({ createdAt: -1 });
  if (own) return own;
  return Registration.findOneAndUpdate(
    { user: { $exists: false }, email: user.email, mobile: user.mobile },
    { $set: { user: user._id } },
    { sort: { createdAt: -1 }, returnDocument: "after" }
  );
}

router.get("/me", requireUser, async (req, res) => {
  const [r, settings] = await Promise.all([registrationOf(req.user), Settings.load()]);
  const confirmed = r?.status === "verified";
  res.json({
    user: publicUser(req.user),
    registration: r && {
      regNo: r.regNo,
      fullName: r.fullName,
      status: r.status,
      utr: r.utr,
      submittedAt: r.createdAt,
      note: r.status === "rejected" ? r.adminNote || "" : "",
      passToken: confirmed && r.pass?.issuedAt ? r.pass.token : undefined,
      passEmailedAt: confirmed ? r.pass?.emailedAt : undefined,
      certificateUrl: confirmed && settings.certificate?.releasedAt && r.pass?.token ? `/api/certificate/${r.pass.token}` : undefined,
    },
  });
});

router.post("/register", requireUser, limit(15, 20), uploader().single("receipt"), async (req, res) => {
  const user = req.user;
  const settings = await Settings.load();
  if (!settings.registrationOpen) return res.status(403).json({ error: "Registration is closed." });

  // The registration always uses the account's email, so emails and the account stay linked.
  const details = { ...cleanDetails(req.body), email: user.email };
  const utr = cleanUtr(req.body?.utr);
  const fields = validateDetails(details);
  const utrError = validateUtr(utr);
  if (utrError) fields.utr = utrError;
  if (!req.file) fields.receipt = "Upload the payment screenshot.";
  if (Object.keys(fields).length) return res.status(400).json({ error: "Please correct the highlighted fields.", fields });

  const existing = await Registration.findOne({
    status: { $ne: "rejected" },
    $or: [{ user: user._id }, { email: details.email }, { mobile: details.mobile }],
  });
  if (existing) {
    const mine = existing.user?.equals(user._id);
    return res.status(409).json({
      error: mine
        ? `You are already registered (${existing.regNo}). Open “My registration” to see its status.`
        : "This email or mobile number is already used by another registration. Contact the organising team if this is a mistake.",
    });
  }
  if (await Registration.exists({ utr })) {
    return res.status(409).json({
      error: "This transaction ID has already been used for a registration.",
      fields: { utr: "Already used for another registration." },
    });
  }

  const receipt = await shrinkReceipt(req.file);
  const fileId = await saveFile(receipt, { kind: "receipt" });
  let reg;
  try {
    reg = await Registration.create({
      ...details,
      user: user._id,
      utr,
      regNo: await nextRegNo(),
      receipt: { fileId, filename: receipt.originalname, contentType: receipt.mimetype, size: receipt.size },
    });
  } catch (err) {
    await deleteFile(fileId);
    if (err.code === 11000) {
      return res.status(409).json({ error: "This transaction ID has already been used.", fields: { utr: "Already used." } });
    }
    throw err;
  }

  notify("received", reg);
  res.status(201).json({ regNo: reg.regNo, fullName: reg.fullName, email: reg.email, status: reg.status });
});

export default router;

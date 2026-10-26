import crypto from "node:crypto";
import { promisify } from "node:util";
import jwt from "jsonwebtoken";
import { User } from "../models.js";

const { JWT_SECRET } = process.env;
const scrypt = promisify(crypto.scrypt);

// Passwords are stored as "scrypt$<salt>$<key>" (Node's built-in scrypt, no extra dependency).
export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function checkPassword(password, stored) {
  const [scheme, salt, key] = String(stored || "").split("$");
  if (scheme !== "scrypt" || !salt || !key) return false;
  const expected = Buffer.from(key, "base64");
  const given = await scrypt(String(password ?? ""), Buffer.from(salt, "base64"), expected.length);
  return crypto.timingSafeEqual(given, expected);
}

export const signToken = (payload, expiresIn) => jwt.sign(payload, JWT_SECRET, { expiresIn });
export const userToken = (user) => signToken({ role: "user", sub: String(user._id) }, "30d");

// File/CSV links opened in a new tab can't send headers, so they pass the token as ?t=
const tokenOf = (req) => req.get("authorization")?.replace(/^Bearer /, "") || req.query.t;

function verify(req, role) {
  try {
    const payload = jwt.verify(String(tokenOf(req)), JWT_SECRET);
    return payload.role === role ? payload : null;
  } catch {
    return null;
  }
}

export function requireAdmin(req, res, next) {
  if (verify(req, "admin")) return next();
  res.status(401).json({ error: "Your session has expired. Please log in again." });
}

// Loads the logged-in participant into req.user.
export async function requireUser(req, res, next) {
  const payload = verify(req, "user");
  const user = payload && (await User.findById(payload.sub).catch(() => null));
  // A password reset signs out every older session.
  if (!user || (user.passwordChangedAt && payload.iat * 1000 < user.passwordChangedAt.getTime() - 1000)) {
    return res.status(401).json({ error: "Please log in again." });
  }
  req.user = user;
  next();
}

export const publicUser = (u) => ({ name: u.name, email: u.email, mobile: u.mobile });

// Password reset links carry a random token; only its hash is stored.
export const sha256 = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");
export const newResetToken = () => crypto.randomBytes(24).toString("base64url");

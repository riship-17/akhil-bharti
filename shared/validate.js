import { CADRES, DESIGNATIONS, DISTRICTS } from "./constants.js";

export const DETAIL_FIELDS = [
  "email", "fullName", "cadre", "district", "institution", "designation", "designationOther",
  "fieldOfStudy", "orgResponsibility", "residentialAddress", "mobile", "altContact",
];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const has = (list, v) => list.some((x) => x.value === v);
const str = (v) => (typeof v === "string" ? v.trim() : "");

// Accepts "98765 43210", "+91 9876543210", "09876543210" → "9876543210"
export function normalizeMobile(v) {
  let d = str(v).replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d;
}

export function cleanDetails(src = {}) {
  const out = {};
  for (const k of DETAIL_FIELDS) out[k] = str(src[k]);
  out.email = out.email.toLowerCase();
  out.mobile = normalizeMobile(out.mobile);
  if (out.designation !== "other") out.designationOther = "";
  return out;
}

export function validateDetails(d) {
  const e = {};
  if (!EMAIL.test(d.email)) e.email = "Enter a valid email address.";
  if (d.fullName.length < 3) e.fullName = "Enter your full name.";
  if (!has(CADRES, d.cadre)) e.cadre = "Select your cadre.";
  if (!has(DISTRICTS, d.district)) e.district = "Select your district.";
  if (d.institution.length < 5) e.institution = "Enter the institution name and full address.";
  if (!has(DESIGNATIONS, d.designation)) e.designation = "Select your designation.";
  else if (d.designation === "other" && d.designationOther.length < 2) e.designationOther = "Write your designation.";
  if (d.fieldOfStudy.length < 2) e.fieldOfStudy = "Enter your subject / specialization.";
  if (d.residentialAddress.length < 10) e.residentialAddress = "Enter your full residential address with PIN code.";
  if (!/^[6-9]\d{9}$/.test(d.mobile)) e.mobile = "Enter a valid 10-digit mobile number.";
  if (d.altContact.length > 20) e.altContact = "Too long.";
  for (const k of DETAIL_FIELDS) if (d[k].length > 600) e[k] = "Too long.";
  return e;
}

export function cleanUtr(v) {
  return str(v).replace(/\s/g, "").toUpperCase();
}

export function validateUtr(utr) {
  return /^[A-Z0-9]{6,30}$/.test(utr) ? null : "Enter the UTR / transaction ID exactly as shown in your payment app.";
}

export const RECEIPT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"];
// Largest file accepted from the browser. Images are shrunk before they are stored (see server/src/lib/files.js);
// PDFs are stored as they are, so they get a much lower limit.
export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
export const MAX_PDF_BYTES = 2 * 1024 * 1024;

// ---- Participant accounts ----

export const MIN_PASSWORD = 8;

export function cleanAccount(src = {}) {
  return { name: str(src.name), email: str(src.email).toLowerCase(), mobile: normalizeMobile(src.mobile) };
}

export function validatePassword(password) {
  if (typeof password !== "string" || password.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (password.length > 200) return "Too long.";
  return null;
}

export function validateAccount(a, password) {
  const e = {};
  if (a.name.length < 3) e.name = "Enter your full name.";
  if (a.name.length > 120) e.name = "Too long.";
  if (!EMAIL.test(a.email) || a.email.length > 200) e.email = "Enter a valid email address.";
  if (!/^[6-9]\d{9}$/.test(a.mobile)) e.mobile = "Enter a valid 10-digit mobile number.";
  const pw = validatePassword(password);
  if (pw) e.password = pw;
  return e;
}

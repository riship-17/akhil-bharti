import { CADRES, DESIGNATIONS, DISTRICTS, MAX_DONATION, UNIVERSITIES, rupees } from "./constants.js";

export const DETAIL_FIELDS = [
  "email", "fullName", "cadre", "district", "university", "universityOther", "department", "institution",
  "designation", "designationOther",
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
  if (out.university !== "other") out.universityOther = "";
  return out;
}

export function validateDetails(d) {
  const e = {};
  if (!EMAIL.test(d.email)) e.email = "Enter a valid email address.";
  if (d.fullName.length < 3) e.fullName = "Enter your full name.";
  if (!has(CADRES, d.cadre)) e.cadre = "Select your cadre.";
  if (!has(DISTRICTS, d.district)) e.district = "Select your district.";
  if (!has(UNIVERSITIES, d.university)) e.university = "Select your university.";
  else if (d.university === "other" && d.universityOther.length < 3) e.universityOther = "Write the name of your university.";
  if (d.department.length < 3) e.department = "Enter the name of your college or department.";
  if (d.institution.length < 5) e.institution = "Enter the full address of your college or department.";
  if (!has(DESIGNATIONS, d.designation)) e.designation = "Select your designation.";
  else if (d.designation === "other" && d.designationOther.length < 2) e.designationOther = "Write your designation.";
  if (d.fieldOfStudy.length < 2) e.fieldOfStudy = "Enter your subject / specialization.";
  if (d.residentialAddress.length < 10) e.residentialAddress = "Enter your full residential address with PIN code.";
  if (!/^[6-9]\d{9}$/.test(d.mobile)) e.mobile = "Enter a valid 10-digit mobile number.";
  if (d.altContact.length > 20) e.altContact = "Too long.";
  for (const k of DETAIL_FIELDS) if (d[k].length > 600) e[k] = "Too long.";
  return e;
}

// Sahay Shulk in whole rupees; blank means none. "3,500" and "₹ 3500" are accepted.
export function cleanDonation(v) {
  const s = str(String(v ?? "")).replace(/[\s,₹]/g, "");
  return s === "" ? 0 : Number(s);
}

export function validateDonation(n) {
  if (!Number.isInteger(n) || n < 0) return "Enter the Sahay Shulk in whole rupees, or leave it blank.";
  if (n > MAX_DONATION) return `The Sahay Shulk can be at most ${rupees(MAX_DONATION)} in one UPI payment. Contact the organising team to give more.`;
  return null;
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

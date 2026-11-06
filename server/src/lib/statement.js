import zlib from "node:zlib";
import { cleanUtr } from "../../../shared/validate.js";
import { Payment, Registration } from "../models.js";
import { newPassToken } from "./pass.js";

// PhonePe statements: read the file an admin uploads, keep its credits (see Payment in models.js) and match them
// to registrations by UTR. A registration whose UTR is found with the right amount is verified automatically.

// ---- Reading the file ----
// PhonePe's "Transaction Statement" download is an Excel workbook even though it is named .csv. A real CSV (e.g. the
// workbook saved as CSV from Excel) works too. The title rows above the table and the disclaimer below it are skipped.

function badStatement(message) {
  const err = new Error(message);
  err.status = 400;
  err.field = "statement";
  return err;
}

const NOT_A_STATEMENT = "This doesn't look like a PhonePe statement: no UTR and Amount columns were found.";

// An .xlsx file is a zip of XML files. Returns name → () => contents, read from the zip's central directory.
function unzip(buf) {
  let end = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw badStatement("Could not open this Excel file. Download the statement from PhonePe again.");
  const files = {};
  let p = buf.readUInt32LE(end + 16);
  for (let n = buf.readUInt16LE(end + 10); n > 0; n--) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + size);
    files[name] = () => (method === 8 ? zlib.inflateRawSync(data, { maxOutputLength: 50e6 }) : data).toString("utf8");
    p += 46 + nameLen + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
  return files;
}

const unescapeXml = (s) =>
  s.replace(/&(lt|gt|amp|quot|apos|#\d+|#x[0-9a-f]+);/gi, (m, e) =>
    ({ lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" })[e.toLowerCase()] ??
    String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)));

// The text of every <t> inside a shared string or inline string (rich text is split into several runs).
const textOf = (xml) => unescapeXml([...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(""));

const columnIndex = (ref) => [...ref.replace(/\d+$/, "")].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

// Rows of the first worksheet as arrays: text cells as strings, number cells as numbers.
function readXlsx(buf) {
  const files = unzip(buf);
  const sheet = Object.keys(files)
    .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .sort((a, b) => parseInt(a.match(/\d+/)) - parseInt(b.match(/\d+/)))[0];
  if (!sheet) throw badStatement(NOT_A_STATEMENT);
  const shared = files["xl/sharedStrings.xml"]
    ? [...files["xl/sharedStrings.xml"]().matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]))
    : [];
  return [...files[sheet]().matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map(([, cells]) => {
    const row = [];
    for (const [, attrs, inner = ""] of cells.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1];
      const type = attrs.match(/\bt="(\w+)"/)?.[1];
      const v = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      const value =
        type === "s" ? shared[Number(v)] ?? ""
        : type === "inlineStr" ? textOf(inner)
        : type === "str" || type === "b" || type === "e" ? unescapeXml(v ?? "")
        : v === undefined ? "" : Number(v);
      row[ref ? columnIndex(ref) : row.length] = value;
    }
    return Array.from(row, (x) => x ?? "");
  });
}

function readCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch !== '"') cell += ch;
      else if (text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = false;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// The statement's columns, as PhonePe names them. Only UTR and Amount are required.
export const COLUMNS = [
  ["date", "Date"],
  ["time", "Time"],
  ["details", "Transaction Details"],
  ["txnId", "Transaction ID"],
  ["utr", "UTR"],
  ["type", "Transaction Type"],
  ["instrument", "Credit/debit instrument"],
  ["amount", "Amount"],
];
const ALIASES = { utr: ["utr no", "utr no.", "utr number"], amount: ["amount (inr)", "amount (rs.)", "amount (₹)"] };
const headerName = (v) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const pad = (n) => String(n).padStart(2, "0");

// "Nov 04, 2026", "04/11/2026" or an Excel date number → [year, month, day]
function dateParts(v) {
  if (typeof v === "number") {
    const d = new Date(Math.round((v - 25569) * 86400000));
    return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
  }
  const s = String(v).trim();
  let m = s.match(/^([A-Za-z]{3})[a-z]*\.? (\d{1,2}),? (\d{4})$/);
  if (m && MONTHS.includes(m[1].toLowerCase())) return [Number(m[3]), MONTHS.indexOf(m[1].toLowerCase()) + 1, Number(m[2])];
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return [Number(m[3]), Number(m[2]), Number(m[1])];
  return null;
}

// "14:04", "02:04 PM" or an Excel time (fraction of a day) → [hours, minutes]
function timeParts(v) {
  if (typeof v === "number") {
    const minutes = Math.round((v % 1) * 24 * 60);
    return [Math.floor(minutes / 60) % 24, minutes % 60];
  }
  const m = String(v).trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap]m)?$/i);
  if (!m) return null;
  let h = Number(m[1]) % (m[3] ? 12 : 24);
  if (m[3]?.toLowerCase() === "pm") h += 12;
  return [h, Number(m[2])];
}

const formatDate = ([y, mo, d]) => `${MONTHS[mo - 1][0].toUpperCase()}${MONTHS[mo - 1].slice(1)} ${pad(d)}, ${y}`;
const formatTime = ([h, mi]) => `${pad(h % 12 || 12)}:${pad(mi)} ${h < 12 ? "AM" : "PM"}`;

// Excel stores a numeric UTR as a number, so a UTR starting with 0 loses its zeros (020513358952 → 20513358952).
function utrOf(v) {
  let s = typeof v === "number" ? v.toFixed(0) : cleanUtr(v).replace(/\.0+$/, "");
  if (/^\d{1,11}$/.test(s)) s = s.padStart(12, "0");
  return /^(\d{12}|[A-Z0-9]{16}|[A-Z0-9]{22})$/.test(s) ? s : "";
}

const amountOf = (v) => (typeof v === "number" ? v : Number(String(v).replace(/[^\d.]/g, "") || NaN));

// The credits in a statement file, plus how many rows were debits or couldn't be read.
export function readStatement(buffer) {
  const isZip = buffer.length > 4 && buffer.readUInt32LE(0) === 0x04034b50;
  if (buffer.length > 4 && buffer.readUInt32LE(0) === 0xe011cfd0) {
    throw badStatement("Old Excel (.xls) files can't be read. Open it in Excel and save it as .xlsx or .csv.");
  }
  const rows = isZip ? readXlsx(buffer) : readCsv(buffer.toString("utf8").replace(/^﻿/, ""));

  const headerAt = rows.findIndex((r) => r.some((c) => headerName(c) === "utr" || ALIASES.utr.includes(headerName(c))));
  if (headerAt < 0) throw badStatement(NOT_A_STATEMENT);
  const header = rows[headerAt].map(headerName);
  const col = Object.fromEntries(
    COLUMNS.map(([key, name]) => [key, header.findIndex((h) => h === name.toLowerCase() || ALIASES[key]?.includes(h))])
  );
  if (col.amount < 0) throw badStatement(NOT_A_STATEMENT);

  const credits = [];
  let debits = 0, unreadable = 0;
  for (const r of rows.slice(headerAt + 1)) {
    const cell = (key) => (col[key] >= 0 ? r[col[key]] ?? "" : "");
    if (cell("utr") === "" && cell("amount") === "") continue; // blank line or the disclaimer under the table
    if (col.type >= 0 && !/^cr/i.test(String(cell("type")).trim())) {
      debits++;
      continue;
    }
    const utr = utrOf(cell("utr"));
    const amount = amountOf(cell("amount"));
    if (!utr || !(amount > 0)) {
      unreadable++;
      continue;
    }
    const day = dateParts(cell("date"));
    const time = timeParts(cell("time"));
    credits.push({
      utr,
      amount,
      txnId: String(cell("txnId")).trim(),
      details: String(cell("details")).trim(),
      instrument: String(cell("instrument")).trim(),
      date: day ? formatDate(day) : String(cell("date")).trim(),
      time: time ? formatTime(time) : String(cell("time")).trim(),
      paidAt: day ? new Date(`${day[0]}-${pad(day[1])}-${pad(day[2])}T${pad(time?.[0] ?? 0)}:${pad(time?.[1] ?? 0)}:00+05:30`) : undefined,
    });
  }
  return { credits, debits, unreadable };
}

// Keeps the credits. Ones already uploaded in an earlier statement are left as they are.
export async function savePayments(credits) {
  if (!credits.length) return 0;
  const res = await Payment.bulkWrite(
    credits.map((c) => ({ updateOne: { filter: { utr: c.utr }, update: { $setOnInsert: c }, upsert: true } })),
    { ordered: false }
  );
  return res.upsertedCount;
}

// ---- Matching ----

export const payerOf = (details = "") => details.replace(/^received from\s*/i, "").trim();

// Links an unclaimed statement credit to a pending registration. With the right amount the registration is verified
// and its Bhojan Pass issued (the email goes out separately); with another amount it waits for an admin.
async function link(reg, payment) {
  const claimed = await Payment.findOneAndUpdate({ _id: payment._id, registration: { $exists: false } }, { $set: { registration: reg._id } });
  if (!claimed) return null;
  reg.received = { amount: payment.amount, payer: payerOf(payment.details), paidAt: payment.paidAt, foundAt: new Date() };
  if (payment.amount !== reg.amount) {
    await reg.save();
    return "differs";
  }
  reg.status = "verified";
  reg.reviewedAt = new Date();
  if (!reg.pass?.token) reg.set("pass.token", newPassToken());
  if (!reg.pass?.issuedAt) reg.set("pass.issuedAt", new Date());
  await reg.save();
  return "verified";
}

// Pending registrations with a UTR that hasn't turned up in a statement yet.
export const waitingFilter = (extra = {}) => ({ status: "pending", utr: { $exists: true, $ne: "" }, "received.foundAt": { $exists: false }, ...extra });

// One registration, right after its UTR was entered or changed. Returns "verified", "differs" or null (not found yet).
export async function matchRegistration(reg) {
  if (reg.status !== "pending" || !reg.utr || reg.received?.foundAt) return null;
  const payment = await Payment.findOne({ utr: reg.utr, registration: { $exists: false } });
  return payment ? link(reg, payment) : null;
}

// Every pending registration whose UTR is in an uploaded statement (after a statement is uploaded).
export async function matchAll() {
  const open = await Payment.find({ registration: { $exists: false } }).lean();
  const byUtr = new Map(open.map((p) => [p.utr, p]));
  const regs = byUtr.size ? await Registration.find(waitingFilter({ utr: { $in: [...byUtr.keys()] } })) : [];
  const result = { verified: [], differs: [] };
  for (const reg of regs) {
    const outcome = await link(reg, byUtr.get(reg.utr));
    if (outcome) result[outcome].push(reg);
  }
  return result;
}

// Frees the statement credit of a registration that is rejected, deleted or gets another UTR, so it can match again.
export async function releasePayment(reg) {
  await Payment.updateMany({ registration: reg._id }, { $unset: { registration: "" } });
  if (reg.received?.foundAt) reg.received = undefined;
}

// ---- Suggestions for a registration whose UTR isn't in any statement (usually a typo) ----

const TITLES = new Set(["dr", "prof", "mr", "mrs", "ms", "shri", "smt", "master", "kumari"]);
const nameWords = (s = "") =>
  new Set(s.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter((w) => w.length >= 3 && !TITLES.has(w)));

function distance(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 99;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

// Unclaimed credits that are probably this participant's: a UTR one or two characters off, or the same amount
// from someone with the same name, paid in the week before they registered.
export async function suggestionsFor(reg) {
  const open = await Payment.find({ registration: { $exists: false } }).lean();
  const words = nameWords(reg.fullName);
  const registered = reg.createdAt?.getTime() ?? Date.now();
  return open
    .map((p) => {
      const typo = reg.utr ? distance(reg.utr, p.utr) : 99;
      // Two words in common (a first name and surname, not just a father's name), or the whole name when PhonePe shows one word.
      const payer = [...nameWords(payerOf(p.details))];
      const sameName = payer.length > 0 && payer.filter((w) => words.has(w)).length >= Math.min(2, payer.length);
      const sameAmount = p.amount === reg.amount;
      const inWeek = !p.paidAt || (p.paidAt.getTime() <= registered + 864e5 && p.paidAt.getTime() >= registered - 7 * 864e5);
      const reasons = [];
      if (typo <= 2) reasons.push(`UTR differs by ${typo} character${typo === 1 ? "" : "s"}`);
      if (sameName) reasons.push("same name");
      if (sameAmount) reasons.push("same amount");
      const likely = typo <= 2 || (sameName && sameAmount && inWeek);
      return likely && { ...p, reasons, score: (typo <= 2 ? 10 - typo : 0) + (sameName ? 2 : 0) + (sameAmount ? 1 : 0) };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

import zlib from "node:zlib";
import { cleanUtr } from "../../../shared/validate.js";
import { Payment, Registration } from "../models.js";
import { newPassToken } from "./pass.js";

// Payment statements: read the file an admin uploads, keep its credits (see Payment in models.js) and match them
// to registrations by UTR. A pending registration whose UTR is found with the right amount is verified automatically.

// ---- Reading the file ----
// PhonePe's "Transaction Statement" download is an Excel workbook even though it is named .csv; the bank's UPI
// statement is a real CSV. Either works, as does another .xlsx / .csv with the payments in it (see readStatement).
// The title rows above the table and the totals and disclaimer below it are skipped.

function badStatement(message) {
  const err = new Error(message);
  err.status = 400;
  err.field = "statement";
  return err;
}

const NOT_A_STATEMENT = "No payments were found in this file: it has no UTR / RRN and Amount columns, and no rows with a 12-digit UTR and an amount.";

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

// The columns of the Excel download (Payments page), as PhonePe names them.
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

// What each column is called in the statements seen so far: PhonePe's "Transaction Statement", the bank's UPI
// statement (RRN, Payer Name, Payer VPA, Type "PAY") and bank account statements (Narration, Deposit).
const HEADERS = {
  date: ["date", "txn date", "transaction date", "value date", "date & time", "date and time", "transaction date & time"],
  time: ["time", "txn time", "transaction time"],
  details: ["transaction details", "narration", "description", "particulars", "remarks"],
  payer: ["payer name", "payer", "sender name", "remitter name", "customer name"],
  txnId: ["transaction id", "txn id"],
  utr: [
    "utr", "utr no", "utr no.", "utr number", "rrn", "rrn no", "rrn no.", "rrn number", "bank rrn", "upi ref no", "upi ref no.",
    "ref no", "ref no.", "reference no", "reference no.", "reference number", "bank reference no", "chq/ref no", "chq./ref.no.",
  ],
  type: ["transaction type", "type", "txn type", "dr/cr", "cr/dr"],
  instrument: ["credit/debit instrument", "payer vpa", "vpa", "upi id"],
  amount: ["amount", "amount (inr)", "amount (rs.)", "amount (₹)", "txn amount", "transaction amount", "credit", "credit amount", "deposit", "deposits", "deposit amt.", "deposit amount"],
};
const headerName = (v) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const columnsOf = (row) => {
  const names = row.map(headerName);
  return Object.fromEntries(Object.entries(HEADERS).map(([key, aliases]) => [key, names.findIndex((h) => aliases.includes(h))]));
};

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const pad = (n) => String(n).padStart(2, "0");

// "Nov 04, 2026", "04 Nov 2026", "04/11/2026", "08-11-2026 08:00:21", "2026-11-08" or an Excel date number → [year, month, day]
function dateParts(v) {
  if (typeof v === "number") {
    const d = new Date(Math.round((v - 25569) * 86400000));
    return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
  }
  const s = String(v).trim();
  const month = (name) => MONTHS.indexOf(name.slice(0, 3).toLowerCase()) + 1;
  let m = s.match(/^([A-Za-z]{3,9})\.? (\d{1,2}),? (\d{4})\b/);
  if (m && month(m[1])) return [Number(m[3]), month(m[1]), Number(m[2])];
  m = s.match(/^(\d{1,2})[ -]([A-Za-z]{3,9})[ -,]+(\d{4})\b/);
  if (m && month(m[2])) return [Number(m[3]), month(m[2]), Number(m[1])];
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})\b/);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4}|\d{2})\b/);
  if (m) return [Number(m[3].length === 2 ? `20${m[3]}` : m[3]), Number(m[2]), Number(m[1])];
  return null;
}

// "14:04", "02:04 PM", the time at the end of "08-11-2026 08:00:21" or an Excel time (fraction of a day) → [hours, minutes]
function timeParts(v) {
  if (typeof v === "number") {
    if (v >= 1 && v % 1 === 0) return null; // a date without a time
    const minutes = Math.round((v % 1) * 24 * 60);
    return [Math.floor(minutes / 60) % 24, minutes % 60];
  }
  const m = String(v).trim().match(/(?:^|\s|T)(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap]\.?m\.?)?$/i);
  if (!m) return null;
  const pm = m[3] && /^p/i.test(m[3]);
  let h = Number(m[1]) % (m[3] ? 12 : 24);
  if (pm) h += 12;
  return [h, Number(m[2])];
}

const formatDate = ([y, mo, d]) => `${MONTHS[mo - 1][0].toUpperCase()}${MONTHS[mo - 1].slice(1)} ${pad(d)}, ${y}`;
const formatTime = ([h, mi]) => `${pad(h % 12 || 12)}:${pad(mi)} ${h < 12 ? "AM" : "PM"}`;

// Excel stores a numeric UTR as a number, so a UTR starting with 0 loses its zeros (020513358952 → 20513358952).
// Bank statements pad it with zeros instead (0000122124623116 → 122124623116).
function utrOf(v) {
  let s = typeof v === "number" ? v.toFixed(0) : cleanUtr(v).replace(/\.0+$/, "");
  if (/^0+\d{12}$/.test(s)) s = s.slice(-12);
  if (/^\d{1,11}$/.test(s)) s = s.padStart(12, "0");
  return /^(\d{12}|[A-Z0-9]{16}|[A-Z0-9]{22})$/.test(s) ? s : "";
}

// A UTR / RRN written anywhere in the row, e.g. in a narration like "UPI/631165020104/RAVAL": the one 12-digit
// number in it. (Mobile numbers have 10 digits and account numbers usually more, so they aren't taken for it, nor
// are the digits of a NEFT reference like SBIN123456789012.)
function utrInRow(row) {
  const found = new Set();
  for (const v of row) {
    if (typeof v === "number") {
      if (Number.isInteger(v) && v >= 1e11 && v < 1e12) found.add(String(v));
    } else {
      for (const [n] of String(v).matchAll(/(?<![\dA-Z])\d{12}(?!\d)/g)) found.add(n);
    }
  }
  return found.size === 1 ? [...found][0] : "";
}

const amountOf = (v) => (typeof v === "number" ? v : Number(String(v).replace(/[^\d.]/g, "") || NaN));
const MONEY = /^(?:₹|rs\.?|inr)?\s*\d{1,3}(?:,?\d{2,3})*\.\d{1,2}$/i;
const DEBIT = /^(dr\.?|debit|withdrawal|refund|reversal)\b/i;

// The credits in a statement file, plus how many rows were debits or couldn't be read. Columns are found by their
// names (see HEADERS); a file whose columns aren't recognised is read row by row, taking the 12-digit number in each
// row as its UTR and the one amount with paise (500.00) as its amount.
export function readStatement(buffer) {
  const isZip = buffer.length > 4 && buffer.readUInt32LE(0) === 0x04034b50;
  if (buffer.length > 4 && buffer.readUInt32LE(0) === 0xe011cfd0) {
    throw badStatement("Old Excel (.xls) files can't be read. Open it in Excel and save it as .xlsx or .csv.");
  }
  const rows = isZip ? readXlsx(buffer) : readCsv(buffer.toString("utf8").replace(/^﻿/, ""));

  // The header row: the first with an amount column and a UTR or date column. Rows above it are the statement's title.
  let headerAt = rows.findIndex((r) => {
    const c = columnsOf(r);
    return c.amount >= 0 && (c.utr >= 0 || c.date >= 0);
  });
  const col = headerAt >= 0 ? columnsOf(rows[headerAt]) : {};

  const credits = [];
  let debits = 0, unreadable = 0;
  for (const r of rows.slice(headerAt + 1)) {
    const cell = (key) => (col[key] >= 0 ? r[col[key]] ?? "" : "");
    let amount = cell("amount");
    if (headerAt < 0) {
      const money = r.filter((v) => (typeof v === "number" ? !Number.isInteger(v) : MONEY.test(String(v).trim())));
      amount = money.length === 1 ? money[0] : "";
    }
    // A blank line, the totals under the table, or a debit in a statement with separate debit and credit columns.
    if (amount === "" || amountOf(amount) === 0) continue;
    if (col.type >= 0 && DEBIT.test(String(cell("type")).trim())) {
      debits++;
      continue;
    }
    const utr = utrOf(cell("utr")) || utrInRow(r);
    amount = amountOf(amount);
    if (!utr || !(amount > 0)) {
      if (headerAt >= 0) unreadable++;
      continue;
    }
    const dateCell = col.date >= 0 ? cell("date") : r.find((v) => typeof v === "string" && dateParts(v)) ?? "";
    const day = dateParts(dateCell);
    const time = timeParts(col.time >= 0 ? cell("time") : dateCell);
    const payer = String(cell("payer")).trim();
    credits.push({
      utr,
      amount,
      txnId: String(cell("txnId")).trim(),
      details: String(cell("details")).trim() || (payer && `Received from ${payer}`),
      instrument: String(cell("instrument")).trim(),
      date: day ? formatDate(day) : String(dateCell).trim(),
      time: time ? formatTime(time) : String(cell("time")).trim(),
      paidAt: day ? new Date(`${day[0]}-${pad(day[1])}-${pad(day[2])}T${pad(time?.[0] ?? 0)}:${pad(time?.[1] ?? 0)}:00+05:30`) : undefined,
    });
  }
  if (!credits.length && !debits && !unreadable) throw badStatement(NOT_A_STATEMENT);
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

// Links an unclaimed statement credit to a registration. A pending one with the right amount is verified and its
// Bhojan Pass issued (the email goes out separately); with another amount it waits for an admin. One verified by hand
// earlier is only linked, so the payment no longer shows as unregistered. Returns "verified", "differs" or "linked".
async function link(reg, payment, byName = false) {
  const claimed = await Payment.findOneAndUpdate({ _id: payment._id, registration: { $exists: false } }, { $set: { registration: reg._id } });
  if (!claimed) return null;
  reg.received = { amount: payment.amount, payer: payerOf(payment.details), paidAt: payment.paidAt, foundAt: new Date(), ...(byName && { byName }) };
  if (reg.status !== "pending") {
    await reg.save();
    return "linked";
  }
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

// After a statement is uploaded: every pending or verified registration whose UTR is in an uploaded statement, then
// the registrations verified by hand before the form asked for a UTR, by payer name and amount. A name match is only
// taken when that payment and that registration have no other candidate, so a participant who paid twice, or a
// payment made for someone else, stays under "Paid, not registered" for an admin to look at.
export async function matchAll() {
  const open = await Payment.find({ registration: { $exists: false } }).lean();
  const byUtr = new Map(open.map((p) => [p.utr, p]));
  const result = { verified: [], differs: [], linked: [], byName: 0 };
  const regs = byUtr.size
    ? await Registration.find({ status: { $ne: "rejected" }, utr: { $in: [...byUtr.keys()] }, "received.foundAt": { $exists: false } })
    : [];
  for (const reg of regs) {
    const outcome = await link(reg, byUtr.get(reg.utr));
    if (!outcome) continue;
    result[outcome].push(reg);
    byUtr.delete(reg.utr);
  }

  const left = [...byUtr.values()];
  if (!left.length) return result;
  const noUtr = await Registration.find(
    { status: "verified", $or: [{ utr: { $exists: false } }, { utr: "" }], "received.foundAt": { $exists: false } },
    "-receipt"
  );
  const candidates = noUtr.map((reg) => [reg, left.filter((p) => p.amount === reg.amount && sameName(p, reg) && paidAround(p, reg))]);
  const wanted = new Map();
  for (const [, ps] of candidates) for (const p of ps) wanted.set(p, (wanted.get(p) || 0) + 1);
  for (const [reg, ps] of candidates) {
    if (ps.length !== 1 || wanted.get(ps[0]) !== 1) continue;
    if (await link(reg, ps[0], true)) {
      result.linked.push(reg);
      result.byName++;
    }
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

// Two words in common (a first name and surname, not just a father's name), or the whole name when the statement shows one word.
function sameName(payment, reg) {
  const words = nameWords(reg.fullName);
  const payer = [...nameWords(payerOf(payment.details))];
  return payer.length > 0 && payer.filter((w) => words.has(w)).length >= Math.min(2, payer.length);
}

// Paid in the week before registering (the screenshot is uploaded with the form), or by the next day.
function paidAround(payment, reg) {
  const registered = reg.createdAt?.getTime() ?? Date.now();
  const paid = payment.paidAt?.getTime();
  return !paid || (paid <= registered + 864e5 && paid >= registered - 7 * 864e5);
}

// Unclaimed credits that are probably this participant's: a UTR one or two characters off, or the same amount
// from someone with the same name, paid in the week before they registered.
export async function suggestionsFor(reg) {
  const open = await Payment.find({ registration: { $exists: false } }).lean();
  return open
    .map((p) => {
      const typo = reg.utr ? distance(reg.utr, p.utr) : 99;
      const name = sameName(p, reg);
      const sameAmount = p.amount === reg.amount;
      const reasons = [];
      if (typo <= 2) reasons.push(`UTR differs by ${typo} character${typo === 1 ? "" : "s"}`);
      if (name) reasons.push("same name");
      if (sameAmount) reasons.push("same amount");
      const likely = typo <= 2 || (name && sameAmount && paidAround(p, reg));
      return likely && { ...p, reasons, score: (typo <= 2 ? 10 - typo : 0) + (name ? 2 : 0) + (sameAmount ? 1 : 0) };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

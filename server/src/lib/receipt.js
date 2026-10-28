import { EVENT, FEE, UPI, designationText, rupees, universityText } from "../../../shared/constants.js";
import { pngPdf } from "./certificate.js";

// Fee receipt, sent with the Bhojan Pass once admins have verified the payment. Drawn as SVG and rendered by sharp
// like the certificate (certificate.js sets up the fonts before sharp loads, so it is imported first).
const { default: sharp } = await import("sharp");

const W = 1240; // A4 portrait at 150 dpi; rendered at 2× for print quality
const H = 1754;
const BRAND = "#a4380f";
const INK = "#1f1a17";
const MUTED = "#6b625b";
const LINE = "#e6ddd2";
const FAMILY = "Noto Serif, Noto Serif Gujarati";
const L = 110; // left margin
const R = W - 110; // right margin

const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const clip = (s = "", max) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);

const text = (x, y, size, content, { weight = 400, fill = INK, anchor = "start", italic = false, spacing = 0 } = {}) =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${FAMILY}" font-size="${size}" font-weight="${weight}"` +
  `${italic ? ' font-style="italic"' : ""}${spacing ? ` letter-spacing="${spacing}"` : ""} fill="${fill}">${esc(content)}</text>`;

// Splits a value into at most `lines` lines of about `width` characters, on spaces.
function wrap(s, width, lines = 2) {
  const out = [""];
  for (const word of String(s).split(/\s+/)) {
    const last = out.length - 1;
    if (out[last] && (out[last] + " " + word).length > width) out.push(word);
    else out[last] = out[last] ? `${out[last]} ${word}` : word;
  }
  return out.length > lines ? [...out.slice(0, lines - 1), clip(out.slice(lines - 1).join(" "), width)] : out;
}

const hr = (y, color = LINE, width = 2) => `<line x1="${L}" y1="${y}" x2="${R}" y2="${y}" stroke="${color}" stroke-width="${width}"/>`;

const istDate = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });

// 1500 → "One Thousand Five Hundred" (Indian numbering: thousand, lakh). Amounts are capped at ₹1,00,000.
const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
  "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const below100 = (n) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`);
const below1000 = (n) =>
  [n >= 100 && `${ONES[Math.floor(n / 100)]} Hundred`, n % 100 && below100(n % 100)].filter(Boolean).join(" ");

export function amountInWords(amount) {
  let n = Math.floor(Number(amount) || 0);
  if (!n) return "Rupees Zero Only";
  const parts = [];
  for (const [size, name] of [[1e7, "Crore"], [1e5, "Lakh"], [1e3, "Thousand"]]) {
    if (n >= size) {
      parts.push(`${below1000(Math.floor(n / size))} ${name}`);
      n %= size;
    }
  }
  if (n) parts.push(below1000(n));
  return `Rupees ${parts.join(" ")} Only`;
}

export function receiptSvg(r, { payeeName, upiId } = {}) {
  const donation = r.donation || 0;
  const total = r.amount || FEE + donation;
  const issued = r.pass?.issuedAt || r.reviewedAt || new Date();
  const college = r.department || (r.institution || "").split(/[\n,]/)[0].trim();
  const university = r.university ? universityText(r) : "";

  const details = [
    ["Name", r.fullName],
    ["Designation", designationText(r)],
    ["College / Department", college],
    ["University", university],
    ["District", r.district],
    ["Mobile", r.mobile],
    ["Email", r.email],
  ].filter(([, v]) => v);

  const items = [[`Bhojan Pass fee – ${EVENT.titleEn}`, FEE]];
  if (donation) items.push(["Sahay Shulk (helping fund)", donation]);

  const payment = [
    ["Payment mode", "UPI"],
    ["Paid to", payeeName || UPI.payee],
    ["UPI ID", upiId],
    ["Payment submitted", istDate(r.createdAt || issued)],
    ["UPI reference (UTR)", r.utr],
    ["Status", "Payment verified"],
  ].filter(([, v]) => v);

  // Label on the left, value (wrapped to two lines if long) on the right; moves `y` down past the row.
  let y = 510;
  const field = ([k, v], fill = INK) => {
    const lines = wrap(v, 46);
    const row = text(L, y, 26, k, { fill: MUTED }) + lines.map((line, i) => text(L + 300, y + i * 34, 26, line, { weight: 700, fill })).join("");
    y += 44 + (lines.length - 1) * 34;
    return row;
  };
  const detailRows = details.map((d) => field(d)).join("");

  y += 20;
  const tableTop = y;
  const itemRows = items.map(([label, amount], i) => {
    const rowY = tableTop + 96 + i * 60;
    return text(L + 24, rowY, 26, label) + text(R - 24, rowY, 26, rupees(amount), { anchor: "end" }) + hr(rowY + 24);
  }).join("");
  const totalY = tableTop + 96 + items.length * 60;
  const tableBottom = totalY + 34;
  y = tableBottom + 116;
  const paymentRows = payment.map((p) => field(p, p[0] === "Status" ? "#0b5c2f" : INK)).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  <rect x="0" y="0" width="${W}" height="16" fill="${BRAND}"/>

  ${text(W / 2, 120, 36, EVENT.org, { weight: 700, fill: BRAND, anchor: "middle" })}
  ${text(W / 2, 164, 24, `Higher Education · ${EVENT.titleEn}`, { fill: MUTED, anchor: "middle" })}
  ${hr(206, BRAND, 3)}

  ${text(W / 2, 286, 50, "FEE RECEIPT", { weight: 700, anchor: "middle", spacing: 4 })}

  ${text(L, 360, 26, "Receipt No", { fill: MUTED })}
  ${text(L, 400, 30, r.regNo, { weight: 700 })}
  ${text(R, 360, 26, "Date", { fill: MUTED, anchor: "end" })}
  ${text(R, 400, 30, istDate(issued), { weight: 700, anchor: "end" })}
  ${hr(430)}

  ${text(L, 474, 24, "RECEIVED FROM", { fill: BRAND, weight: 700, spacing: 2 })}
  ${detailRows}

  <rect x="${L}" y="${tableTop}" width="${R - L}" height="${tableBottom - tableTop}" fill="none" stroke="${LINE}" stroke-width="2" rx="8"/>
  <rect x="${L}" y="${tableTop}" width="${R - L}" height="48" fill="#f6e7dc" rx="8"/>
  ${text(L + 24, tableTop + 33, 24, "Description", { weight: 700 })}
  ${text(R - 24, tableTop + 33, 24, "Amount", { weight: 700, anchor: "end" })}
  ${itemRows}
  ${text(L + 24, totalY + 4, 30, "Total received", { weight: 700 })}
  ${text(R - 24, totalY + 4, 30, rupees(total), { weight: 700, anchor: "end", fill: BRAND })}
  ${text(L, tableBottom + 46, 24, amountInWords(total), { italic: true, fill: MUTED })}

  ${paymentRows}

  ${hr(H - 200)}
  ${text(W / 2, H - 156, 22, "This is a computer-generated receipt and does not need a signature.", { italic: true, fill: MUTED, anchor: "middle" })}
  ${text(W / 2, H - 118, 22, EVENT.dateEn, { fill: MUTED, anchor: "middle" })}
  ${text(W / 2, H - 84, 20, clip(EVENT.venueEn, 100), { fill: MUTED, anchor: "middle" })}
  <rect x="0" y="${H - 16}" width="${W}" height="16" fill="${BRAND}"/>
</svg>`;
}

export async function receiptPdf(r, payee) {
  // density 144 = 2× the SVG's 72 dpi size → 2480 × 3508 px, i.e. 300 dpi on A4
  const png = await sharp(Buffer.from(receiptSvg(r, payee)), { density: 144 }).png().toBuffer();
  return pngPdf(png, [595.28, 841.89], `Fee receipt – ${r.regNo}`); // A4 portrait
}

export const receiptFilename = (r) => `${r.regNo}-fee-receipt.pdf`;

// Payee details for the receipt, from Payment & settings.
export const payeeOf = (settings) => ({ payeeName: settings?.payeeName || UPI.payee, upiId: settings?.upiId || UPI.id });

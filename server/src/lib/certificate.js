import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument } from "pdf-lib";
import { EVENT, designationText } from "../../../shared/constants.js";

// Certificate of participation: drawn as SVG, rendered by sharp (librsvg + Pango, which shapes Gujarati
// correctly) and wrapped in an A4 landscape PDF. Fontconfig must point at the bundled fonts before sharp loads.
process.env.FONTCONFIG_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../assets/fonts/fonts.conf");
const { default: sharp } = await import("sharp");

const W = 1754; // A4 landscape at 150 dpi; rendered at 2× for print quality
const H = 1240;
const BRAND = "#a4380f";
const GOLD = "#b8892d";
const INK = "#1f1a17";
const MUTED = "#6b625b";
const FAMILY = "Noto Serif, Noto Serif Gujarati";

const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const text = (y, size, content, { weight = 400, fill = INK, italic = false, spacing = 0 } = {}) =>
  `<text x="${W / 2}" y="${y}" text-anchor="middle" font-family="${FAMILY}" font-size="${size}" font-weight="${weight}"` +
  `${italic ? ' font-style="italic"' : ""}${spacing ? ` letter-spacing="${spacing}"` : ""} fill="${fill}">${esc(content)}</text>`;

const clip = (s, max) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);

// "Govt. Arts College, Near Bus Stand, Rajkot 360001" → "Govt. Arts College"
const institutionName = (s = "") => clip(s.split(/[\n,]/)[0].trim(), 80);

function signatureBlock(x, { name, role }) {
  return `<line x1="${x - 170}" y1="1040" x2="${x + 170}" y2="1040" stroke="${INK}" stroke-width="1.5"/>
    <text x="${x}" y="1078" text-anchor="middle" font-family="${FAMILY}" font-size="26" font-weight="700" fill="${INK}">${esc(name)}</text>
    <text x="${x}" y="1112" text-anchor="middle" font-family="${FAMILY}" font-size="22" fill="${MUTED}">${esc(role)}</text>`;
}

export function certificateSvg(r, signatories = []) {
  const name = clip(r.fullName, 60);
  const nameSize = name.length > 40 ? 58 : name.length > 28 ? 68 : 80;
  const subtitle = [designationText(r), institutionName(r.institution)].filter(Boolean).join(", ");
  const signs = (signatories.length ? signatories : [{ name: "Organising Committee", role: EVENT.titleEn }]).slice(0, 3);
  const step = W / (signs.length + 1);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#fffaf3"/>
  <rect x="36" y="36" width="${W - 72}" height="${H - 72}" fill="none" stroke="${BRAND}" stroke-width="10"/>
  <rect x="62" y="62" width="${W - 124}" height="${H - 124}" fill="none" stroke="${GOLD}" stroke-width="2.5"/>
  ${[[62, 62], [W - 62, 62], [62, H - 62], [W - 62, H - 62]].map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="9" fill="${GOLD}"/>`).join("")}

  ${text(150, 24, EVENT.motto, { fill: MUTED })}
  ${text(212, 40, EVENT.orgGu, { weight: 700, fill: BRAND })}
  ${text(258, 26, EVENT.orgEn, { fill: MUTED })}

  ${text(372, 64, "પ્રમાણપત્ર", { weight: 700 })}
  ${text(430, 34, "CERTIFICATE OF PARTICIPATION", { fill: GOLD, spacing: 6 })}
  <line x1="${W / 2 - 160}" y1="462" x2="${W / 2 + 160}" y2="462" stroke="${GOLD}" stroke-width="2"/>

  ${text(536, 28, "This is to certify that", { italic: true, fill: MUTED })}
  ${text(626, nameSize, name, { weight: 700, fill: BRAND })}
  ${subtitle ? text(680, 28, clip(subtitle, 110), { fill: INK }) : ""}

  ${text(760, 30, `participated in the ${EVENT.titleEn} of ABRSM Gujarat (Higher Education)`)}
  ${text(806, 30, `held on ${EVENT.dateEn} at Gujarat University Convention Centre, Ahmedabad.`)}
  ${text(870, 28, `${EVENT.orgGu.split(",")[0]}, ગુજરાતના ${EVENT.titleGu}માં સહભાગી થવા બદલ આ પ્રમાણપત્ર એનાયત કરવામાં આવે છે.`, { fill: MUTED })}

  ${signs.map((s, i) => signatureBlock(step * (i + 1), s)).join("")}

  <text x="110" y="${H - 96}" font-family="${FAMILY}" font-size="20" fill="${MUTED}">Certificate No: ${esc(r.regNo)}</text>
  <text x="${W - 110}" y="${H - 96}" text-anchor="end" font-family="${FAMILY}" font-size="20" fill="${MUTED}">${esc(EVENT.dateEn)}</text>
</svg>`;
}

export function certificatePng(r, signatories) {
  // density 144 = 2× the SVG's 72 dpi size → 3508 × 2480 px, i.e. 300 dpi on A4
  return sharp(Buffer.from(certificateSvg(r, signatories)), { density: 144 }).png().toBuffer();
}

export async function certificatePdf(r, signatories) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Certificate – ${r.fullName}`);
  pdf.setAuthor(EVENT.orgEn);
  const png = await pdf.embedPng(await certificatePng(r, signatories));
  const page = pdf.addPage([841.89, 595.28]); // A4 landscape in points
  page.drawImage(png, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
  return Buffer.from(await pdf.save());
}

export const certificateFilename = (r) => `${r.regNo}-certificate.pdf`;

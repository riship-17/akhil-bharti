export const FEE = 500;

// Optional Sahay Shulk (helping fund) a participant can add on top of the Bhojan Pass fee, in the same UPI payment.
// UPI caps a single payment at ₹1,00,000, so fee + Sahay Shulk must stay within that.
export const MAX_DONATION = 100000 - FEE;

export const rupees = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");

// The organiser's PhonePe UPI (decoded from their QR code). Admins can change it in Payment & settings.
export const UPI = { id: "9879930825-4@ybl", payee: "AKHIL BHARTIY RASHTRIY SHAIKSHIK MAHASANGH GUJARAT" };

export const EVENT = {
  motto: "Education in the interest of the nation, the teacher in the interest of education, society in the interest of the teacher",
  org: "Akhil Bharatiya Rashtriya Shaikshik Mahasangh, Gujarat",
  orgEn: "Akhil Bharatiya Rashtriya Shaikshik Mahasangh, Gujarat · Higher Education",
  titleEn: "State Conference 2026",
  dateEn: "Sunday, 20 December 2026",
  venueEn: "Gujarat University Convention Centre, near GMDC Ground, Helmet Circle, Ahmedabad",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=Gujarat+University+Convention+Centre+Ahmedabad",
};

export const CADRES = [
  { value: "college", en: "College Cadre" },
  { value: "university", en: "University Cadre" },
];

export const DESIGNATIONS = [
  { value: "principal", en: "Principal" },
  { value: "professor", en: "Professor" },
  { value: "associate_professor", en: "Associate Professor" },
  { value: "assistant_professor", en: "Assistant Professor" },
  { value: "teaching_assistant", en: "Teaching Assistant" },
  { value: "other", en: "Other" },
];

export const DISTRICTS = [
  ["Ahmedabad"], ["Amreli"], ["Anand"], ["Aravalli"],
  ["Banaskantha"], ["Bharuch"], ["Bhavnagar"], ["Botad"],
  ["Chhota Udepur"], ["Dahod"], ["Dang"], ["Devbhumi Dwarka"],
  ["Gandhinagar"], ["Gir Somnath"], ["Jamnagar"], ["Junagadh"],
  ["Kutch"], ["Kheda"], ["Mahisagar"], ["Mehsana"],
  ["Morbi"], ["Narmada"], ["Navsari"], ["Panchmahal"],
  ["Patan"], ["Porbandar"], ["Rajkot"], ["Sabarkantha"],
  ["Surat"], ["Surendranagar"], ["Tapi"], ["Vadodara"],
  ["Valsad"],
].map(([en]) => ({ value: en, en }));

export const STATUSES = ["pending", "verified", "rejected"];

export const labelOf = (list, value) => list.find((x) => x.value === value)?.en ?? value ?? "";

export const designationText = (r) =>
  r.designation === "other" ? r.designationOther || "Other" : labelOf(DESIGNATIONS, r.designation);

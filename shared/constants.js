export const FEE = 500;

export const EVENT = {
  motto: "રાષ્ટ્રના હિતમાં શિક્ષણ, શિક્ષણના હિતમાં શિક્ષક, શિક્ષકના હિતમાં સમાજ",
  orgGu: "અખિલ ભારતીય રાષ્ટ્રીય શૈક્ષિક મહાસંઘ, ગુજરાત (ઉચ્ચ શિક્ષણ)",
  orgEn: "Akhil Bharatiya Rashtriya Shaikshik Mahasangh, Gujarat · Higher Education",
  titleGu: "રાજ્ય સંમેલન ૨૦૨૬",
  titleEn: "State Conference 2026",
  dateGu: "૨૦ ડિસેમ્બર ૨૦૨૬, રવિવાર",
  dateEn: "Sunday, 20 December 2026",
  venueGu: "ગુજરાત યુનિવર્સિટી કન્વેન્શન સેન્ટર, જી.એમ.ડી.સી. ગ્રાઉન્ડ પાસે, હેલ્મેટ સર્કલ, અમદાવાદ",
  venueEn: "Gujarat University Convention Centre, near GMDC Ground, Helmet Circle, Ahmedabad",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=Gujarat+University+Convention+Centre+Ahmedabad",
};

export const CADRES = [
  { value: "college", gu: "કૉલેજ સંવર્ગ", en: "College Cadre" },
  { value: "university", gu: "યુનિવર્સિટી સંવર્ગ", en: "University Cadre" },
];

export const DESIGNATIONS = [
  { value: "principal", gu: "આચાર્ય", en: "Principal" },
  { value: "professor", gu: "પ્રોફેસર", en: "Professor" },
  { value: "associate_professor", gu: "એસોસિએટ પ્રોફેસર", en: "Associate Professor" },
  { value: "assistant_professor", gu: "આસિસ્ટન્ટ પ્રોફેસર", en: "Assistant Professor" },
  { value: "teaching_assistant", gu: "અધ્યાપક સહાયક", en: "Teaching Assistant" },
  { value: "other", gu: "અન્ય", en: "Other" },
];

export const DISTRICTS = [
  ["Ahmedabad", "અમદાવાદ"], ["Amreli", "અમરેલી"], ["Anand", "આણંદ"], ["Aravalli", "અરવલ્લી"],
  ["Banaskantha", "બનાસકાંઠા"], ["Bharuch", "ભરૂચ"], ["Bhavnagar", "ભાવનગર"], ["Botad", "બોટાદ"],
  ["Chhota Udepur", "છોટા ઉદેપુર"], ["Dahod", "દાહોદ"], ["Dang", "ડાંગ"], ["Devbhumi Dwarka", "દેવભૂમિ દ્વારકા"],
  ["Gandhinagar", "ગાંધીનગર"], ["Gir Somnath", "ગીર સોમનાથ"], ["Jamnagar", "જામનગર"], ["Junagadh", "જૂનાગઢ"],
  ["Kutch", "કચ્છ"], ["Kheda", "ખેડા"], ["Mahisagar", "મહીસાગર"], ["Mehsana", "મહેસાણા"],
  ["Morbi", "મોરબી"], ["Narmada", "નર્મદા"], ["Navsari", "નવસારી"], ["Panchmahal", "પંચમહાલ"],
  ["Patan", "પાટણ"], ["Porbandar", "પોરબંદર"], ["Rajkot", "રાજકોટ"], ["Sabarkantha", "સાબરકાંઠા"],
  ["Surat", "સુરત"], ["Surendranagar", "સુરેન્દ્રનગર"], ["Tapi", "તાપી"], ["Vadodara", "વડોદરા"],
  ["Valsad", "વલસાડ"],
].map(([en, gu]) => ({ value: en, en, gu }));

export const STATUSES = ["pending", "verified", "rejected"];

export const PAYMENT_METHODS = ["upi", "razorpay"];

export const labelOf = (list, value) => list.find((x) => x.value === value)?.en ?? value ?? "";

export const designationText = (r) =>
  r.designation === "other" ? r.designationOther || "Other" : labelOf(DESIGNATIONS, r.designation);

export function confirmationText(r) {
  return [
    `નમસ્તે ${r.fullName},`,
    ``,
    `અખિલ ભારતીય રાષ્ટ્રીય શૈક્ષિક મહાસંઘ, ગુજરાત – રાજ્ય સંમેલન ૨૦૨૬ માટે આપનું રજિસ્ટ્રેશન કન્ફર્મ થયું છે.`,
    ``,
    `Registration No: ${r.regNo}`,
    `તારીખ: ${EVENT.dateGu}`,
    `સ્થળ: ${EVENT.venueGu}`,
    ``,
    `Your registration for the ABRSM Gujarat State Conference 2026 is confirmed. Please keep this registration number with you on the day.`,
  ].join("\n");
}

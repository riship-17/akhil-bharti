// Public-site content. Registration itself happens on Google Forms.
const FORM_ID = "1FAIpQLSfkhqlEcpximOx1Z7h7sMDNVBUgerX0DbHe0_yMro_LakBuoQ";

export const FORM_URL = `https://docs.google.com/forms/d/e/${FORM_ID}/viewform`;
export const FORM_EMBED_URL = `${FORM_URL}?embedded=true`;

export const SITE = {
  org: "Akhil Bharatiya Rashtriya Shaikshik Mahasangh",
  orgShort: "ABRSM Gujarat",
  wing: "Higher Education",
  orgGu: "અખિલ ભારતીય રાષ્ટ્રીય શૈક્ષિક મહાસંઘ, ગુજરાત",
  motto: "રાષ્ટ્રના હિતમાં શિક્ષણ, શિક્ષણના હિતમાં શિક્ષક, શિક્ષકના હિતમાં સમાજ",
  mottoEn: "Education in the interest of the nation, the teacher in the interest of education, and society in the interest of the teacher.",
  title: "State Conference 2026",
  date: "Sunday, 20 December 2026",
  dateShort: "20 Dec 2026",
  eventStartUtc: Date.UTC(2026, 11, 20) - 5.5 * 3600e3, // midnight IST
  venue: "Gujarat University Convention Centre",
  venueLine: "Near GMDC Ground, Helmet Circle, Ahmedabad",
  fee: 500,
  mapEmbed: "https://maps.google.com/maps?q=Gujarat%20University%20Convention%20Centre%2C%20Ahmedabad&z=15&output=embed",
  directions: "https://www.google.com/maps/dir/?api=1&destination=Gujarat+University+Convention+Centre+Ahmedabad",
};

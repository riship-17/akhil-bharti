# Google Form Prompt – ABRSM Gujarat State Conference 2026

Paste the prompt below into **Gemini in Google Forms** ("Help me create a form"). It also works in ChatGPT or Claude if you ask for a Google Apps Script that builds the form.

Before using it, replace the four `[ADD …]` placeholders in Section 2 with your real UPI ID, bank name, account number and IFSC.

---

## Prompt

```text
Create a Google Form for a conference registration. Follow these instructions exactly — keep all Gujarati text as written, do not translate or shorten it, and do not add extra questions.

FORM TITLE:
ABRSM Gujarat State Conference 2026 – Registration | રાજ્ય સંમેલન ૨૦૨૬ – નોંધણી

FORM DESCRIPTION:
"રાષ્ટ્રના હિતમાં શિક્ષણ, શિક્ષણના હિતમાં શિક્ષક, શિક્ષકના હિતમાં સમાજ"
અખિલ ભારતીય રાષ્ટ્રીય શૈક્ષિક મહાસંઘ, ગુજરાત (ઉચ્ચ શિક્ષણ)
Akhil Bharatiya Rashtriya Shaikshik Mahasangh, Gujarat (Higher Education)

તારીખ / Date: ૨૦ ડિસેમ્બર ૨૦૨૬, રવિવાર (Sunday, 20 December 2026)
સ્થળ / Venue: ગુજરાત યુનિવર્સિટી કન્વેન્શન સેન્ટર, જી.એમ.ડી.સી. ગ્રાઉન્ડ પાસે, હેલ્મેટ સર્કલ, અમદાવાદ
નોંધણી શુલ્ક / Registration Fee: ₹500

ગુજરાત રાજ્યની તમામ કૉલેજો અને યુનિવર્સિટીઓના અધ્યાપકો તેમજ આચાર્યશ્રીઓ માટેનું રાજ્યસ્તરીય સંમેલન.
Please keep your UPI payment screenshot and transaction ID (UTR) ready before you start.

────────────────────────
SECTION 1 TITLE: વિભાગ ૧: અધ્યાપકશ્રીની વિગતો / Section 1: Participant Details

Q1. ઈમેલ એડ્રેસ / Email Address
Type: Short answer. Required. Validation: must be a valid email.
Help text: e.g. professor.name@university.ac.in

Q2. પૂરું નામ / Full Name (Title – First Name – Middle Name – Surname)
Type: Short answer. Required.
Help text: ઉદાહરણ: ડૉ. વિનોદભાઈ કાંતિલાલ પટેલ / Prof. Vinodkumar K. Patel

Q3. સંવર્ગ / Cadre / Category
Type: Multiple choice. Required.
Options:
- કૉલેજ સંવર્ગ / College Cadre
- યુનિવર્સિટી સંવર્ગ / University Cadre

Q4. જિલ્લો / District
Type: Dropdown. Required.
Options (in this order):
અમદાવાદ (Ahmedabad), અમરેલી (Amreli), આણંદ (Anand), અરવલ્લી (Aravalli), બનાસકાંઠા (Banaskantha), ભરૂચ (Bharuch), ભાવનગર (Bhavnagar), બોટાદ (Botad), છોટા ઉદેપુર (Chhota Udepur), દાહોદ (Dahod), ડાંગ (Dang), દેવભૂમિ દ્વારકા (Devbhumi Dwarka), ગાંધીનગર (Gandhinagar), ગીર સોમનાથ (Gir Somnath), જામનગર (Jamnagar), જૂનાગઢ (Junagadh), કચ્છ (Kutch), ખેડા (Kheda), મહીસાગર (Mahisagar), મહેસાણા (Mehsana), મોરબી (Morbi), નર્મદા (Narmada), નવસારી (Navsari), પંચમહાલ (Panchmahal), પાટણ (Patan), પોરબંદર (Porbandar), રાજકોટ (Rajkot), સાબરકાંઠા (Sabarkantha), સુરત (Surat), સુરેન્દ્રનગર (Surendranagar), તાપી (Tapi), વડોદરા (Vadodara), વલસાડ (Valsad)

Q5. સંસ્થા / કૉલેજ / યુનિવર્સિટીનું પૂરું નામ અને સરનામું / Name & Full Address of Institution / College / University
Type: Paragraph. Required.
Help text: સંસ્થાનું નામ, વિભાગ, શહેર અને પીનકોડ સહિત વિગતવાર લખાણ

Q6. સંસ્થામાં હોદ્દો / Designation in Institution
Type: Multiple choice with "Other" option enabled. Required.
Options:
- આચાર્ય / Principal
- પ્રોફેસર / Professor
- એસોસિએટ પ્રોફેસર / Associate Professor
- આસિસ્ટન્ટ પ્રોફેસર / Assistant Professor
- અધ્યાપક સહાયક / Teaching Assistant

Q7. અધ્યયન / વિષય / ક્ષેત્ર / Field of Study / Specialization
Type: Short answer. Required.
Help text: e.g. રસાયણશાસ્ત્ર, અંગ્રેજી, વાણિજ્ય

Q8. સંગઠનાત્મક જવાબદારી / Organizational Responsibility
Type: Short answer. Optional.
Help text: ABRSM માં હોદ્દો (જો લાગુ પડતું હોય તો)

Q9. કાયમી / હાલનું નિવાસસ્થાનનું સરનામું / Residential Address
Type: Paragraph. Required.
Help text: ઘર નંબર, સોસાયટી / વિસ્તાર, તાલુકો, જિલ્લો અને પીનકોડ

Q10. વોટ્સએપ / મોબાઈલ નંબર / WhatsApp & Mobile No.
Type: Short answer. Required.
Validation: Regular expression – matches – ^[6-9][0-9]{9}$
Error text: કૃપા કરીને ૧૦ અંકનો સાચો મોબાઈલ નંબર લખો / Enter a valid 10-digit mobile number
Help text: ૧૦ અંકનો મોબાઈલ નંબર (e.g. 98XXXXXXXX), without +91

Q11. વૈકલ્પિક સંપર્ક નંબર / Alternative Contact No.
Type: Short answer. Optional.
Help text: વૈકલ્પિક મોબાઈલ / લેન્ડલાઈન નંબર

────────────────────────
SECTION 2 TITLE: વિભાગ ૨: નોંધણી શુલ્ક અને ચુકવણી વિગત / Section 2: Registration Fee & Payment

SECTION 2 DESCRIPTION:
નોંધણી શુલ્ક / Registration Fee: ₹500/- (અંકે રૂપિયા પાંચસો પૂરા)
નીચે આપેલ QR કોડ કોઈપણ UPI એપ (GPay, PhonePe, Paytm, BHIM) થી સ્કેન કરી ₹500 ચૂકવો.
Scan the QR code below with any UPI app and pay ₹500.

UPI ID: [ADD UPI ID]
બેંક / Bank: [ADD BANK NAME]
ખાતા નંબર / A/c No: [ADD ACCOUNT NUMBER]
IFSC: [ADD IFSC]

ચુકવણી પછી સ્ક્રીનશોટ લો અને UTR નંબર નોંધી રાખો.
After paying, take a screenshot and note the 12-digit UTR / UPI Ref No.

Q12. ટ્રાન્ઝેક્શન / UTR નંબર / Payment Transaction ID / UTR
Type: Short answer. Required.
Validation: Regular expression – matches – ^[A-Za-z0-9]{6,30}$
Error text: UTR / ટ્રાન્ઝેક્શન નંબર ફક્ત અંકો અને અક્ષરોમાં લખો (spaces વગર)
Help text: UPI / IMPS ટ્રાન્ઝેક્શન રેફરન્સ નંબર (UPI એપમાં "UPI Ref No." અથવા "UTR" તરીકે દેખાય છે)

Q13. પેમેન્ટની પહોંચ / સ્ક્રીનશોટ / Upload Payment Receipt
Type: File upload. Required. Allow only Image and PDF. Maximum 1 file. Maximum size 10 MB.
Help text: Image / PDF અપલોડ કરો

────────────────────────
CONFIRMATION MESSAGE (shown after submit):
અખિલ ભારતીય રાષ્ટ્રીય શૈક્ષિક મહાસંઘ, ગુજરાત રાજ્ય સંમેલન ૨૦૨૬ માટે આપનું રજિસ્ટ્રેશન સફળતાપૂર્વક થઈ ગયું છે. આપનો ખૂબ ખૂબ આભાર!
Thank you for registering for the ABRSM Gujarat State Conference 2026. Your response has been recorded successfully! Your payment will be verified and a confirmation will be sent to you on WhatsApp.
```

---

## Check by hand after the form is created

Gemini often skips or simplifies these settings, so check each one:

1. **File upload (Q13)** – Gemini usually can't add this question type. Add it yourself: **+ → File upload**, allow only *Image* and *PDF*, 1 file, 10 MB. Respondents will have to sign in to Google to upload.
2. **QR code** – In Section 2, click **Add image** (the picture icon in the side toolbar) and upload your UPI QR code.
3. **Validation on Q10 and Q12** – Open the ⋮ menu on each question → **Response validation** → *Regular expression* → *Matches*, then paste the pattern:
   - Q10 mobile: `^[6-9][0-9]{9}$`
   - Q12 UTR: `^[A-Za-z0-9]{6,30}$`
4. **Email** – To avoid asking for email twice, go to **Settings → Responses → Collect email addresses → Responder input**, then delete Q1.
5. **Theme** – Click the palette icon and set the colour to `#A4380F` (the maroon used on the website).
6. **Responses** – Under **Responses**, choose **Link to Sheets** so you can match UTR numbers against your bank statement before sending confirmations.

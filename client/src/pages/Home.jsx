import { Link } from "react-router-dom";
import { EVENT } from "../../../shared/constants.js";
import { useConfig } from "../config.js";
import { SITE } from "../site.js";
import { Icon, guNum, primaryButton, secondaryButton, telHref } from "../components/ui.jsx";

const DETAILS_STEP = ["Fill in your details", "Name, email, WhatsApp number, cadre, district, institution, designation and residential address."];

const STEPS_ONLINE = [
  DETAILS_STEP,
  ["Pay ₹500 online", "Pay securely through Razorpay with UPI (GPay, PhonePe, Paytm, BHIM), a debit or credit card, net banking or a wallet."],
  ["Get your registration number", "Your registration is confirmed as soon as the payment goes through, and your registration number is shown on screen."],
];

const STEPS_UPI = [
  DETAILS_STEP,
  ["Pay the ₹500 fee by UPI", "The organiser's QR code is shown inside the form. Pay with GPay, PhonePe, Paytm, BHIM or any other UPI app."],
  ["Add payment proof and submit", "Enter the UTR / transaction number and upload a screenshot of the successful payment."],
  ["Receive your confirmation", "The organising committee checks each payment against the bank statement and confirms your registration on WhatsApp."],
];

const READY = [
  "Email address and 10-digit WhatsApp number",
  "Name and full address of your institution",
  "Residential address with PIN code",
];
const READY_ONLINE = [...READY, "A UPI app, debit / credit card or net banking to pay ₹500"];
const READY_UPI = [...READY, "A UPI app to pay ₹500", "Payment screenshot (image or PDF, up to 10 MB)"];

const ATTENDEES = [
  ["school", "આચાર્યશ્રીઓ", "Principals", "Colleges and institutes"],
  ["workspace_premium", "પ્રોફેસર", "Professors", "College and university cadre"],
  ["menu_book", "એસોસિએટ અને આસિસ્ટન્ટ પ્રોફેસર", "Associate & Assistant Professors", "College and university cadre"],
  ["groups", "અધ્યાપક સહાયક", "Teaching Assistants", "Adhyapak Sahayak"],
];

const FAQ_WHO = ["Who can register?", "Teachers and principals of colleges and universities in Gujarat — Principals, Professors, Associate and Assistant Professors and Teaching Assistants, from both the college and university cadres."];
const PASS_STEP = ["Receive your Bhojan Pass", "Once your registration is confirmed, a Bhojan Pass with a QR code is sent to your WhatsApp number. Show it at the food counter on the day."];
const FAQ_PASS = ["What is the Bhojan Pass?", "Once your registration is confirmed, a Bhojan Pass with a QR code is sent to your WhatsApp number. Show the QR code at the food counter. You can also open it any time from “Check status”."];

const FAQ_COLLEAGUES = ["Can I register on behalf of colleagues?", "Please submit a separate form for each participant, with that person's own details and payment, so every registration can be verified individually."];

const FAQ_ONLINE = [
  FAQ_WHO,
  ["How do I pay the ₹500 fee?", "Online, at the end of the registration form, through Razorpay's secure payment window. You can use any UPI app, a debit or credit card, net banking or a wallet."],
  ["Money was deducted but I didn't get a registration number. What should I do?", "Do not pay again. Use “Check status” with the email and mobile number you entered. If nothing shows up, contact the organising committee with the Razorpay payment ID from your payment SMS or email."],
  FAQ_COLLEAGUES,
];

const FAQ_UPI = [
  FAQ_WHO,
  ["How do I pay the ₹500 fee?", "By UPI. The QR code and payment details are shown inside the registration form. Pay with any UPI app, then upload the screenshot in the same form."],
  ["Where do I find the UTR number?", "Open the payment in your UPI app's history. It is listed as UPI Ref No., UTR or Transaction ID and is usually 12 digits long."],
  ["I paid, but the form didn't submit. What should I do?", "Do not pay again. Open the form once more, fill it in, and use the UTR number and screenshot from your first payment."],
  FAQ_COLLEAGUES,
];

function InfoRow({ icon, label, tint = "bg-surface-container", children }) {
  return (
    <div className="flex items-start gap-4">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-primary shadow-sm ${tint}`}>
        <Icon name={icon} className="text-[24px]" />
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{label}</span>
        {children}
      </div>
    </div>
  );
}

export default function Home() {
  const config = useConfig();
  const open = config?.registrationOpen !== false;
  const contacts = config?.contacts || [];
  const online = Boolean(config?.razorpayKeyId);
  const whatsappPass = Boolean(config?.whatsappPass);
  let steps = online ? STEPS_ONLINE : STEPS_UPI;
  if (whatsappPass && online) steps = [...steps, PASS_STEP];
  const ready = online ? READY_ONLINE : READY_UPI;
  let faq = online ? FAQ_ONLINE : FAQ_UPI;
  if (whatsappPass) faq = [...faq.slice(0, -1), FAQ_PASS, faq.at(-1)];
  const days = Math.ceil((SITE.eventStartUtc - Date.now()) / 864e5);

  return (
    <div className="flex w-full flex-col">
      {/* Status band */}
      <div className="w-full bg-surface-container-high px-4 py-2 shadow-sm lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 text-xs md:text-sm">
          <div className="flex items-center gap-2 text-on-surface-variant">
            <span className={`inline-block h-2 w-2 rounded-full ${open ? "animate-pulse bg-tertiary" : "bg-outline"}`} />
            <span className="font-semibold text-primary">{open ? "ઓનલાઇન નોંધણી ચાલુ છે" : "ઓનલાઇન નોંધણી બંધ છે"}</span>
            <span className="opacity-40">•</span>
            <span>{open ? "Registration is open" : "Registration is closed"}{days > 1 && ` · ${days} days to go`}</span>
          </div>
          <div className="flex items-center gap-3 text-on-surface-variant">
            <span className="flex items-center gap-1"><Icon name="pin_drop" className="text-[16px] text-primary" />અમદાવાદ / Ahmedabad</span>
            <span className="opacity-40">|</span>
            <span className="flex items-center gap-1"><Icon name="calendar_month" className="text-[16px] text-tertiary" />{SITE.dateShort}</span>
          </div>
        </div>
      </div>

      {/* Hero */}
      <section className="mx-auto w-full max-w-7xl px-4 py-10 lg:px-10">
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <div className="flex flex-col space-y-6 lg:col-span-7">
            <div className="flex flex-wrap items-center gap-2 self-start">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary-fixed px-4 py-1.5 text-on-primary-fixed shadow-sm">
                <span className="h-2 w-2 rounded-full bg-primary" />
                <span className="text-[15px] font-bold uppercase tracking-wide">{EVENT.titleGu} / STATE CONFERENCE 2026</span>
              </div>
              <span className="inline-flex items-center rounded-full bg-surface-container px-3 py-1 text-xs text-on-surface-variant">
                ઉચ્ચ શિક્ષણ / Higher Education
              </span>
            </div>

            <div className="space-y-1.5">
              <h1 className="text-[28px] font-bold leading-tight tracking-tight text-primary md:text-4xl md:leading-tight">
                અખિલ ભારતીય રાષ્ટ્રીય શૈક્ષિક મહાસંઘ, ગુજરાત
              </h1>
              <p className="text-lg font-medium text-on-surface-variant md:text-xl">
                Akhil Bharatiya Rashtriya Shaikshik Mahasangh, Gujarat (Higher Education)
              </p>
              <div className="pt-2">
                <p className="inline-block rounded-lg bg-secondary-fixed/50 px-3 py-1 font-semibold text-secondary">« {EVENT.motto} »</p>
              </div>
            </div>

            <div className="relative space-y-5 overflow-hidden rounded-xl bg-surface-container-lowest p-6 shadow-md sm:p-7">
              <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/5" />
              <InfoRow icon="calendar_month" label="તારીખ / Date">
                <p className="text-[22px] font-semibold leading-8">{EVENT.dateGu}</p>
                <p className="text-[15px] text-on-surface-variant">{EVENT.dateEn}</p>
              </InfoRow>
              <div className="h-px w-full bg-surface-variant" />
              <InfoRow icon="location_on" label="સ્થળ / Venue">
                <p className="text-[22px] font-semibold leading-8">ગુજરાત યુનિવર્સિટી કન્વેન્શન સેન્ટર</p>
                <p className="text-[15px] text-on-surface-variant">જી.એમ.ડી.સી. ગ્રાઉન્ડ પાસે, હેલ્મેટ સર્કલ, અમદાવાદ / {SITE.venueLine}</p>
              </InfoRow>
              <div className="h-px w-full bg-surface-variant" />
              <InfoRow icon="payments" label="નોંધણી શુલ્ક / Registration Fee" tint="bg-secondary-fixed">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-4xl font-bold leading-none text-primary">₹ {guNum(SITE.fee)} /-</span>
                  <span className="text-[15px] font-medium">(પ્રતિ અધ્યાપક પ્રતિનિધિ)</span>
                </div>
                <p className="mt-1 text-[15px] text-on-surface-variant">
                  ₹{SITE.fee} per participant · {online ? "paid online during registration" : "paid by UPI during registration"}
                </p>
              </InfoRow>
            </div>

            {open ? (
              <div className="flex flex-col items-stretch gap-4 pt-1 sm:flex-row sm:items-center">
                <Link to="/register" className={`${primaryButton} group px-8`}>
                  <span className="tracking-wide">નોંધણી કરો / Register Now</span>
                  <Icon name="arrow_forward" className="text-[20px] transition-transform group-hover:translate-x-1" />
                </Link>
                <Link to="/status" className={secondaryButton}>
                  <Icon name="lunch_dining" className="text-[22px] text-primary" />
                  <span>મારો ભોજન પાસ જુઓ / View My Bhojan Pass</span>
                </Link>
              </div>
            ) : (
              <div className="rounded-xl bg-surface-container-low p-4 text-[15px] text-on-surface-variant">
                <p className="font-semibold text-on-surface">ઓનલાઇન નોંધણી બંધ થઈ ગઈ છે.</p>
                <p>Online registration has closed. Please contact the organising committee. Already registered? <Link className="font-semibold text-primary underline" to="/status">Check your status</Link>.</p>
              </div>
            )}

            <details className="group rounded-xl bg-surface-container-low shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl p-4 transition-colors hover:bg-surface-container [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-3">
                  <Icon name="checklist" className="text-[24px] text-primary" />
                  <span>
                    <span className="block text-sm font-semibold">નોંધણી પહેલાં આટલું તૈયાર રાખો</span>
                    <span className="block text-xs text-on-surface-variant">Keep these ready before you start</span>
                  </span>
                </span>
                <Icon name="expand_more" className="text-on-surface-variant transition-transform duration-200 group-open:rotate-180" />
              </summary>
              <ul className="space-y-2 px-4 pb-4 text-sm text-on-surface-variant">
                {ready.map((item) => (
                  <li key={item} className="flex items-start gap-2"><Icon name="check" className="mt-0.5 text-[18px] text-tertiary" />{item}</li>
                ))}
              </ul>
            </details>
          </div>

          <div className="flex flex-col space-y-6 lg:col-span-5">
            <div id="venue" className="flex scroll-mt-44 flex-col overflow-hidden rounded-xl bg-surface-container-lowest shadow-md">
              <div className="relative aspect-[4/3] w-full bg-surface-container">
                <iframe
                  title="Map of Gujarat University Convention Centre"
                  src={SITE.mapEmbed}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="h-full w-full"
                />
              </div>
              <div className="flex items-start justify-between gap-3 p-4">
                <div>
                  <p className="text-sm font-semibold text-primary">ગુજરાત યુનિવર્સિટી કન્વેન્શન સેન્ટર</p>
                  <p className="mt-0.5 text-xs text-on-surface-variant">{SITE.venue}, {SITE.venueLine}</p>
                </div>
                <a href={SITE.directions} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-primary hover:text-secondary">
                  <Icon name="directions" className="text-[18px]" /> Directions
                </a>
              </div>
            </div>

            <div className="space-y-4 rounded-xl bg-surface-container-lowest p-6 shadow-md">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-fixed text-primary">
                  <Icon name="diversity_3" className="text-[20px]" />
                </div>
                <div>
                  <h2 className="text-base font-semibold">કોણ ભાગ લઈ શકે?</h2>
                  <p className="text-xs text-on-surface-variant">Who can attend</p>
                </div>
              </div>
              <div className="space-y-3 pt-1">
                {ATTENDEES.map(([icon, gu, en, note]) => (
                  <div key={en} className="flex items-start gap-3 rounded-lg bg-surface-container-low p-3">
                    <Icon name={icon} className="mt-0.5 shrink-0 text-[20px] text-primary" />
                    <div>
                      <p className="text-sm font-semibold">{gu} / {en}</p>
                      <p className="text-xs text-on-surface-variant">{note}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-on-surface-variant">ગુજરાતની તમામ કૉલેજો અને યુનિવર્સિટીઓના અધ્યાપકો · Each participant registers individually.</p>
            </div>

            {contacts.length > 0 && (
              <div id="contact" className="scroll-mt-44 rounded-xl bg-surface-container-low p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon name="contact_support" className="text-[22px]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">સહાયતા / Helpdesk</p>
                    <p className="text-xs text-on-surface-variant">For help with registration or payment</p>
                  </div>
                </div>
                <ul className="divide-y divide-surface-variant">
                  {contacts.map((p) => (
                    <li key={p.name + p.phone} className="flex items-center justify-between gap-3 py-2">
                      <span className="text-sm">{p.name}{p.role && <span className="text-xs text-on-surface-variant"> · {p.role}</span>}</span>
                      <a className="flex shrink-0 items-center gap-1 text-sm font-bold text-primary hover:text-secondary" href={telHref(p.phone)}>
                        <Icon name="call" className="text-[16px]" />{p.phone}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="mx-auto w-full max-w-7xl scroll-mt-44 px-4 pb-12 lg:px-10">
        <div className="grid gap-6 rounded-2xl bg-surface-container-lowest p-6 shadow-sm md:p-8 lg:grid-cols-12">
          <h2 className="text-2xl font-semibold lg:col-span-4">સંમેલન વિશે <span className="block text-base font-normal text-on-surface-variant">About the conference</span></h2>
          <div className="space-y-3 text-on-surface-variant lg:col-span-8">
            <p>
              The State Conference brings together teaching staff from colleges and universities in every district of
              Gujarat, from both the college and the university cadres. It is an opportunity for the academic community to
              meet in one place, hear from the organisation and discuss the role of the teacher in higher education today.
              The programme for the day will be shared by the organising committee closer to the date.
            </p>
            <p>
              Akhil Bharatiya Rashtriya Shaikshik Mahasangh (ABRSM) is a nationwide organisation of teachers working in
              school and higher education. The conference is hosted by its Gujarat unit's Higher Education wing.
            </p>
          </div>
        </div>
      </section>

      {/* How to register */}
      <section id="registration" className="scroll-mt-44 bg-surface-container-low">
        <div className="mx-auto max-w-7xl px-4 py-12 lg:px-10">
          <h2 className="text-2xl font-semibold md:text-3xl">નોંધણી કેવી રીતે કરવી <span className="text-on-surface-variant">/ How to register</span></h2>
          <p className="mt-1 text-on-surface-variant">Registration is done through an online form and takes about five minutes.</p>
          <ol className={`mt-6 grid gap-4 sm:grid-cols-2 ${steps.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
            {steps.map(([title, text], i) => (
              <li key={title} className="rounded-xl bg-surface-container-lowest p-5 shadow-sm">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-on-primary">{guNum(i + 1)}</span>
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="mt-1 text-[15px] text-on-surface-variant">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto w-full max-w-7xl scroll-mt-44 px-4 py-12 lg:px-10">
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <h2 className="text-2xl font-semibold md:text-3xl">વારંવાર પૂછાતા પ્રશ્નો</h2>
            <p className="mt-1 text-on-surface-variant">Frequently asked questions</p>
          </div>
          <div className="space-y-3 lg:col-span-8">
            {faq.map(([q, a], i) => (
              <details key={q} open={i === 0} className="group rounded-xl bg-surface-container-lowest shadow-sm">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 font-semibold [&::-webkit-details-marker]:hidden">
                  {q}
                  <Icon name="expand_more" className="shrink-0 text-on-surface-variant transition-transform group-open:rotate-180" />
                </summary>
                <p className="px-4 pb-4 text-[15px] text-on-surface-variant">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {open && (
        <section className="mx-auto w-full max-w-7xl px-4 lg:px-10">
          <div className="flex flex-col items-start justify-between gap-4 rounded-2xl bg-gradient-to-r from-primary to-secondary p-6 text-on-primary shadow-md sm:flex-row sm:items-center md:p-8">
            <div>
              <h2 className="text-xl font-semibold md:text-2xl">{EVENT.titleGu} માટે નોંધણી કરો</h2>
              <p className="text-on-primary/90">{SITE.date} · {SITE.venue}, Ahmedabad</p>
            </div>
            <Link to="/register" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-surface-container-lowest px-6 font-semibold text-primary shadow-sm hover:bg-primary-fixed">
              Register now <Icon name="arrow_forward" className="text-[20px]" />
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

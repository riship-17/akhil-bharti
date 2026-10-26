import { Link } from "react-router-dom";
import { EVENT } from "../../../shared/constants.js";
import { useConfig } from "../config.js";
import { SITE } from "../site.js";
import { Icon, primaryButton, secondaryButton, telHref } from "../components/ui.jsx";

const STEPS = [
  ["Create your account", "Sign up with your name, email, mobile number and a password. You will use it to see your status and Bhojan Pass."],
  ["Fill in your details", "Cadre, district, institution, designation and residential address."],
  ["Pay ₹500 by UPI", "Scan the organiser's QR code inside the form with PhonePe, GPay, Paytm, BHIM or any UPI app, then enter the UTR and upload the payment screenshot."],
  ["Receive your Bhojan Pass", "The organising committee checks each payment against the bank statement and sends your Bhojan Pass by email. It also appears under “My registration”."],
];

const READY = [
  "Email address and 10-digit mobile number",
  "Name and full address of your institution",
  "Residential address with PIN code",
  "A UPI app to pay ₹500, and a screenshot of the successful payment",
];

const ATTENDEES = [
  ["school", "Principals", "Colleges and institutes"],
  ["workspace_premium", "Professors", "College and university cadre"],
  ["menu_book", "Associate & Assistant Professors", "College and university cadre"],
  ["groups", "Teaching Assistants", "Adhyapak Sahayak"],
];

const FAQ = [
  ["Who can register?", "Teachers and principals of colleges and universities in Gujarat — Principals, Professors, Associate and Assistant Professors and Teaching Assistants, from both the college and university cadres."],
  ["Why do I need an account?", "Your account keeps your registration in one place: you can see whether your payment has been verified, open your Bhojan Pass and, after the conference, download your certificate. Log in with the email and password you chose."],
  ["How do I pay the ₹500 fee?", "By UPI. The QR code is shown on the last step of the registration form (on a phone you can also tap “Pay in UPI app”). Pay with any UPI app, then enter the UTR and upload the screenshot in the same form."],
  ["Where do I find the UTR number?", "Open the payment in your UPI app's history. It is listed as UPI Ref No., UTR or Transaction ID and is usually 12 digits long."],
  ["I paid, but the form didn't submit. What should I do?", "Do not pay again. Log in, open the form once more and use the UTR number and screenshot from your first payment."],
  ["What is the Bhojan Pass?", "Once the organisers verify your payment, they send you a Bhojan Pass with a QR code by email. Show the QR code at the food counter. You can also open it any time under “My registration”."],
  ["Can I register on behalf of colleagues?", "Each participant needs their own account and their own payment, so every registration can be verified individually."],
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
  const days = Math.ceil((SITE.eventStartUtc - Date.now()) / 864e5);

  return (
    <div className="flex w-full flex-col">
      {/* Status band */}
      <div className="w-full bg-surface-container-high px-4 py-2 shadow-sm lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 text-xs md:text-sm">
          <div className="flex items-center gap-2 text-on-surface-variant">
            <span className={`inline-block h-2 w-2 rounded-full ${open ? "animate-pulse bg-tertiary" : "bg-outline"}`} />
            <span className="font-semibold text-primary">{open ? "Registration is open" : "Registration is closed"}</span>
            {days > 1 && <><span className="opacity-40">•</span><span>{days} days to go</span></>}
          </div>
          <div className="flex items-center gap-3 text-on-surface-variant">
            <span className="flex items-center gap-1"><Icon name="pin_drop" className="text-[16px] text-primary" />Ahmedabad</span>
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
                <span className="text-[15px] font-bold uppercase tracking-wide">STATE CONFERENCE 2026</span>
              </div>
              <span className="inline-flex items-center rounded-full bg-surface-container px-3 py-1 text-xs text-on-surface-variant">
                Higher Education
              </span>
            </div>

            <div className="space-y-1.5">
              <h1 className="text-[28px] font-bold leading-tight tracking-tight text-primary md:text-4xl md:leading-tight">
                {EVENT.org}
              </h1>
              <p className="text-lg font-medium text-on-surface-variant md:text-xl">Higher Education · {EVENT.titleEn}</p>
              <div className="pt-2">
                <p className="inline-block rounded-lg bg-secondary-fixed/50 px-3 py-1 font-semibold text-secondary">« {EVENT.motto} »</p>
              </div>
            </div>

            <div className="relative space-y-5 overflow-hidden rounded-xl bg-surface-container-lowest p-6 shadow-md sm:p-7">
              <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/5" />
              <InfoRow icon="calendar_month" label="Date">
                <p className="text-[22px] font-semibold leading-8">{EVENT.dateEn}</p>
              </InfoRow>
              <div className="h-px w-full bg-surface-variant" />
              <InfoRow icon="location_on" label="Venue">
                <p className="text-[22px] font-semibold leading-8">{SITE.venue}</p>
                <p className="text-[15px] text-on-surface-variant">{SITE.venueLine}</p>
              </InfoRow>
              <div className="h-px w-full bg-surface-variant" />
              <InfoRow icon="payments" label="Registration Fee" tint="bg-secondary-fixed">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-4xl font-bold leading-none text-primary">₹ {SITE.fee} /-</span>
                  <span className="text-[15px] font-medium">(per participant)</span>
                </div>
                <p className="mt-1 text-[15px] text-on-surface-variant">Paid by UPI during registration</p>
              </InfoRow>
            </div>

            {open ? (
              <div className="flex flex-col items-stretch gap-4 pt-1 sm:flex-row sm:items-center">
                <Link to="/register" className={`${primaryButton} group px-8`}>
                  <span className="tracking-wide">Register Now</span>
                  <Icon name="arrow_forward" className="text-[20px] transition-transform group-hover:translate-x-1" />
                </Link>
                <Link to="/account" className={secondaryButton}>
                  <Icon name="lunch_dining" className="text-[22px] text-primary" />
                  <span>View My Bhojan Pass</span>
                </Link>
              </div>
            ) : (
              <div className="rounded-xl bg-surface-container-low p-4 text-[15px] text-on-surface-variant">
                <p><span className="font-semibold text-on-surface">Online registration has closed.</span> Please contact the organising committee. Already registered? <Link className="font-semibold text-primary underline" to="/account">Open My registration</Link>.</p>
              </div>
            )}

            <details className="group rounded-xl bg-surface-container-low shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl p-4 transition-colors hover:bg-surface-container [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-3">
                  <Icon name="checklist" className="text-[24px] text-primary" />
                  <span>
                    <span className="block text-sm font-semibold">Keep these ready before you start</span>
                  </span>
                </span>
                <Icon name="expand_more" className="text-on-surface-variant transition-transform duration-200 group-open:rotate-180" />
              </summary>
              <ul className="space-y-2 px-4 pb-4 text-sm text-on-surface-variant">
                {READY.map((item) => (
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
                  <p className="text-sm font-semibold text-primary">{SITE.venue}</p>
                  <p className="mt-0.5 text-xs text-on-surface-variant">{SITE.venueLine}</p>
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
                <h2 className="text-base font-semibold">Who can attend</h2>
              </div>
              <div className="space-y-3 pt-1">
                {ATTENDEES.map(([icon, en, note]) => (
                  <div key={en} className="flex items-start gap-3 rounded-lg bg-surface-container-low p-3">
                    <Icon name={icon} className="mt-0.5 shrink-0 text-[20px] text-primary" />
                    <div>
                      <p className="text-sm font-semibold">{en}</p>
                      <p className="text-xs text-on-surface-variant">{note}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-on-surface-variant">Teachers of all colleges and universities in Gujarat · Each participant registers individually.</p>
            </div>

            {contacts.length > 0 && (
              <div id="contact" className="scroll-mt-44 rounded-xl bg-surface-container-low p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon name="contact_support" className="text-[22px]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Helpdesk</p>
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
          <h2 className="text-2xl font-semibold lg:col-span-4">About the conference</h2>
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
          <h2 className="text-2xl font-semibold md:text-3xl">How to register</h2>
          <p className="mt-1 text-on-surface-variant">Registration is done through an online form and takes about five minutes.</p>
          <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([title, text], i) => (
              <li key={title} className="rounded-xl bg-surface-container-lowest p-5 shadow-sm">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-on-primary">{i + 1}</span>
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
            <h2 className="text-2xl font-semibold md:text-3xl">Frequently asked questions</h2>
          </div>
          <div className="space-y-3 lg:col-span-8">
            {FAQ.map(([q, a], i) => (
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
              <h2 className="text-xl font-semibold md:text-2xl">Register for the {EVENT.titleEn}</h2>
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

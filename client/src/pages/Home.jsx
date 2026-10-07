import { Link } from "react-router-dom";
import { useConfig } from "../config.js";
import { SITE } from "../site.js";

const STEPS = [
  ["Fill in your details", "Name, email, WhatsApp number, cadre, district, institution, designation and residential address."],
  ["Pay the ₹500 fee by UPI", "The organiser's QR code is shown inside the form. Pay with GPay, PhonePe, Paytm, BHIM or any other UPI app."],
  ["Add payment proof and submit", "Enter the UTR / transaction number and upload a screenshot of the successful payment."],
  ["Receive your confirmation", "The organising committee checks each payment against the bank statement and confirms your registration on WhatsApp."],
];

const READY = [
  "Email address and 10-digit WhatsApp number",
  "Name and full address of your institution",
  "Residential address with PIN code",
  "A UPI app to pay ₹500",
  "Payment screenshot (image or PDF, up to 10 MB)",
];

const ATTENDEES = [
  ["Principals", "Colleges and institutes"],
  ["Professors", "College and university cadre"],
  ["Associate Professors", "College and university cadre"],
  ["Assistant Professors", "College and university cadre"],
  ["Teaching Assistants", "Adhyapak Sahayak"],
];

const FAQ = [
  ["Who can register?", "Teachers and principals of colleges and universities in Gujarat — Principals, Professors, Associate and Assistant Professors and Teaching Assistants, from both the college and university cadres."],
  ["How do I pay the ₹500 fee?", "By UPI. The QR code and payment details are shown inside the registration form. Pay with any UPI app, then upload the screenshot in the same form."],
  ["Why does the form ask me to sign in to Google?", "Google Forms requires sign-in for any form that accepts a file upload — in this case, your payment screenshot. Any Gmail or Google account will work."],
  ["Where do I find the UTR number?", "Open the payment in your UPI app's history. It is listed as UPI Ref No., UTR or Transaction ID and is usually 12 digits long."],
  ["I paid, but the form didn't submit. What should I do?", "Do not pay again. Open the form once more, fill it in, and use the UTR number and screenshot from your first payment."],
  ["Can I register on behalf of colleagues?", "Please submit a separate form for each participant, with that person's own details and payment, so every registration can be verified individually."],
];

export default function Home() {
  const config = useConfig();
  const open = config?.registrationOpen !== false;
  const contacts = config?.contacts || [];
  const days = Math.ceil((SITE.eventStartUtc - Date.now()) / 864e5);

  return (
    <>
      <section className="intro">
        <div className="container intro-grid">
          <div>
            <p className="status-line">
              <span className={`dot${open ? "" : " off"}`} />
              {open ? "Registration is open" : "Registration is closed"}
              {days > 1 && <span className="muted"> · {days} days to go</span>}
            </p>
            <h1>State Conference 2026</h1>
            <p className="intro-lead">
              A one-day state-level conference for teachers and principals of colleges and
              universities across Gujarat, organised by the Higher Education wing of ABRSM Gujarat.
            </p>
            <div className="actions">
              {open && <Link className="button" to="/register">Register now</Link>}
              <a className="button outline" href="#registration">How to register</a>
            </div>
          </div>

          <aside className="details-card" aria-label="Conference details">
            <div className="date-block">
              <span className="date-day">20</span>
              <span><b>December 2026</b>Sunday</span>
            </div>
            <table className="details">
              <tbody>
                <tr><th scope="row">Venue</th><td>{SITE.venue}<span>{SITE.venueLine}</span></td></tr>
                <tr><th scope="row">Fee</th><td>₹{SITE.fee} per participant<span>Paid by UPI in the form</span></td></tr>
                <tr><th scope="row">For</th><td>Teachers &amp; principals<span>Colleges and universities of Gujarat</span></td></tr>
              </tbody>
            </table>
            {open ? (
              <Link className="button block" to="/register">Open registration form</Link>
            ) : (
              <p className="closed">Online registration has closed. Please contact the organising committee.</p>
            )}
          </aside>
        </div>
      </section>

      <section className="section" id="about">
        <div className="container two-col">
          <div className="prose">
            <h2 className="heading">About the conference</h2>
            <p>
              The State Conference brings together teaching staff from colleges and universities
              in every district of Gujarat, from both the college and the university cadres.
            </p>
            <p>
              It is an opportunity for the academic community to meet in one place, hear from the
              organisation and discuss the role of the teacher in higher education today. The
              programme for the day will be shared by the organising committee closer to the date.
            </p>
            <p>
              Akhil Bharatiya Rashtriya Shaikshik Mahasangh (ABRSM) is a nationwide organisation of
              teachers working in school and higher education. The conference is hosted by its
              Gujarat unit's Higher Education wing.
            </p>
          </div>
          <div>
            <h3 className="subheading">Who can attend</h3>
            <ul className="list-table">
              {ATTENDEES.map(([role, note]) => (
                <li key={role}><span>{role}</span><small>{note}</small></li>
              ))}
            </ul>
            <p className="muted small-text">Each participant registers individually with their own details and payment.</p>
          </div>
        </div>
      </section>

      <section className="motto-band" aria-label="Motto">
        <div className="container">
          <blockquote>
            <p className="motto-gu" lang="gu">“{SITE.motto}”</p>
            <p className="motto-en">{SITE.mottoEn}</p>
          </blockquote>
        </div>
      </section>

      <section className="section tinted" id="registration">
        <div className="container">
          <h2 className="heading">How to register</h2>
          <p className="section-intro">Registration is done through an online form and takes about five minutes.</p>
          <div className="reg-grid">
            <ol className="steps-list">
              {STEPS.map(([title, text]) => (
                <li key={title}><h3>{title}</h3><p>{text}</p></li>
              ))}
            </ol>
            <aside className="panel">
              <h3>Keep these ready</h3>
              <ul className="ticks">
                {READY.map((item) => <li key={item}>{item}</li>)}
              </ul>
              {open && <Link className="button block" to="/register">Go to registration form</Link>}
              <p className="muted small-text">Google asks you to sign in because the form includes a file upload. Your email is not shown publicly.</p>
            </aside>
          </div>
        </div>
      </section>

      <section className="section" id="venue">
        <div className="container">
          <h2 className="heading">Venue</h2>
          <div className="venue">
            <iframe
              title="Map of Gujarat University Convention Centre"
              src={SITE.mapEmbed}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            <div className="venue-info">
              <h3>{SITE.venue}</h3>
              <address>Gujarat University campus,<br />near GMDC Ground, Helmet Circle,<br />Ahmedabad</address>
              <table className="details compact">
                <tbody>
                  <tr><th scope="row">Date</th><td>{SITE.date}</td></tr>
                  <tr><th scope="row">Landmark</th><td>GMDC Ground, Helmet Circle</td></tr>
                </tbody>
              </table>
              <a className="button outline" href={SITE.directions} target="_blank" rel="noopener noreferrer">Get directions</a>
            </div>
          </div>
        </div>
      </section>

      <section className="section tinted" id="faq">
        <div className="container two-col narrow-left">
          <div>
            <h2 className="heading">Frequently asked questions</h2>
            <p className="muted">Can't find your answer? {contacts.length ? <a href="#contact">Contact the organising committee.</a> : "Contact your district coordinator."}</p>
          </div>
          <div className="faq">
            {FAQ.map(([q, a], i) => (
              <details key={q} open={i === 0}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {contacts.length > 0 && (
        <section className="section" id="contact">
          <div className="container">
            <h2 className="heading">Contact</h2>
            <p className="section-intro">For help with registration or payment.</p>
            <div className="people">
              {contacts.map((p) => (
                <div className="person" key={p.name + p.phone}>
                  <b>{p.name}</b>
                  {p.role && <span>{p.role}</span>}
                  <a href={`tel:${p.phone.replace(/[^\d+]/g, "")}`}>{p.phone}</a>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {open && (
        <section className="cta-band">
          <div className="container cta-row">
            <div>
              <h2>Register for the State Conference 2026</h2>
              <p>{SITE.date} · {SITE.venue}, Ahmedabad</p>
            </div>
            <Link className="button light" to="/register">Register now</Link>
          </div>
        </section>
      )}
    </>
  );
}

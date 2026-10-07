import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import Field from "../components/Field.jsx";

const LABELS = {
  pending: ["Under verification", "ચકાસણી ચાલુ છે", "We have received your registration. The team will confirm it after verifying your payment."],
  verified: ["Confirmed", "કન્ફર્મ", "Your payment is verified and your seat is confirmed. Please keep your registration number with you on the day."],
  rejected: ["Payment not verified", "ચુકવણી ચકાસાઈ નથી", "We could not verify your payment. Please contact the organising team or register again with the correct details."],
};

export default function Status() {
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function check(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(await api("/status", { method: "POST", body: { email, mobile } }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const label = result && LABELS[result.status];

  return (
    <section className="page wrap narrow">
      <p className="kicker">State Conference 2026</p>
      <h1 className="page-title">નોંધણીની સ્થિતિ <small>Check registration status</small></h1>
      <p className="muted">Enter the email and mobile number you used while registering.</p>

      <form onSubmit={check} className="status-form" noValidate>
        <div className="pair">
          <Field gu="ઈમેલ" en="Email address" required id="s-email">
            <input id="s-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field gu="મોબાઈલ નંબર" en="Mobile number" required id="s-mobile">
            <input id="s-mobile" type="tel" inputMode="numeric" autoComplete="tel-national" value={mobile} onChange={(e) => setMobile(e.target.value)} />
          </Field>
        </div>
        <button className="btn" disabled={busy || !email || !mobile}>{busy ? "Checking…" : "Check status"}</button>
      </form>

      {error && <div className="banner" role="alert">{error}{" "}<Link to="/register">Register now</Link></div>}

      {result && (
        <div className={`status-card ${result.status}`}>
          <div className="status-top">
            <div>
              <span className="muted small">Registration No.</span>
              <b className="mono">{result.regNo}</b>
            </div>
            <span className={`chip ${result.status}`}>{label[0]} · {label[1]}</span>
          </div>
          <p><b>{result.fullName}</b></p>
          <p className="muted">{label[2]}</p>
          {result.note && <p className="note"><b>Note from organisers:</b> {result.note}</p>}
        </div>
      )}
    </section>
  );
}

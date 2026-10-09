import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { Banner, Field, Icon, inputClass, primaryButton, secondaryButton } from "../components/ui.jsx";

const LABELS = {
  pending: ["Under verification", "ચકાસણી ચાલુ છે", "We have received your registration. The team will confirm it after verifying your payment.", "schedule", "border-amber-200 bg-amber-50 text-amber-800"],
  verified: ["Confirmed", "કન્ફર્મ", "Your payment is verified and your seat is confirmed. Please keep your registration number with you on the day.", "check_circle", "border-tertiary/20 bg-[#e5f5ec] text-tertiary"],
  rejected: ["Payment not verified", "ચુકવણી ચકાસાઈ નથી", "We could not verify your payment. Please contact the organising team or register again with the correct details.", "cancel", "border-error/20 bg-error-container/50 text-error"],
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
    <section className="mx-auto w-full max-w-2xl px-4 py-10">
      <div className="overflow-hidden rounded-2xl bg-surface-container-lowest shadow-xl">
        <div className="h-1.5 bg-gradient-to-r from-primary via-secondary to-primary-container" />
        <div className="space-y-6 p-5 sm:p-7">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">State Conference 2026</p>
            <h1 className="mt-1 text-2xl font-semibold">નોંધણીની સ્થિતિ <span className="block text-base font-normal text-on-surface-variant">Check registration status</span></h1>
            <p className="mt-2 text-[15px] text-on-surface-variant">Enter the email and mobile number you used while registering to see your status and open your Bhojan Pass.</p>
          </div>

          <form onSubmit={check} className="space-y-5" noValidate>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="s-email" gu="ઈમેલ" en="Email address" required>
                <input id="s-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass()} />
              </Field>
              <Field id="s-mobile" gu="મોબાઈલ નંબર" en="Mobile number" required>
                <input id="s-mobile" type="tel" inputMode="numeric" autoComplete="tel-national" value={mobile} onChange={(e) => setMobile(e.target.value)} className={inputClass()} />
              </Field>
            </div>
            <button className={`${primaryButton} w-full sm:w-auto`} disabled={busy || !email || !mobile}>
              <Icon name="search" className="text-[20px]" />
              {busy ? "Checking…" : "સ્થિતિ જુઓ / Check status"}
            </button>
          </form>

          {error && <Banner>{error}{" "}<Link to="/register" className="font-semibold underline">Register now</Link></Banner>}

          {result && (
            <div className="space-y-3 rounded-xl p-4 ring-1 ring-inset ring-outline-variant">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-xs text-on-surface-variant">નોંધણી નંબર / Registration No.</span>
                  <b className="block font-mono text-lg text-on-primary-fixed-variant">{result.regNo}</b>
                </div>
                <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-semibold ${label[4]}`}>
                  <Icon name={label[3]} className="text-[16px]" />{label[1]} · {label[0]}
                </span>
              </div>
              <p className="font-semibold">{result.fullName}</p>
              <p className="text-[15px] text-on-surface-variant">{label[2]}</p>
              {result.passToken && (
                <Link to={`/pass/${result.passToken}`} className={`${primaryButton} w-full`}>
                  <Icon name="lunch_dining" className="text-[22px]" />
                  ભોજન પાસ જુઓ / View Bhojan Pass
                </Link>
              )}
              {result.certificate && result.passToken && (
                <a href={`/api/certificate/${result.passToken}`} target="_blank" rel="noopener" className={`${secondaryButton} w-full`}>
                  <Icon name="workspace_premium" className="text-[22px]" />
                  પ્રમાણપત્ર ડાઉનલોડ કરો / Download Certificate
                </a>
              )}
              {result.note && (
                <p className="rounded-r-lg border-l-[3px] border-primary bg-primary-fixed/40 px-3.5 py-3 text-[15px]">
                  <b>Note from organisers:</b> {result.note}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

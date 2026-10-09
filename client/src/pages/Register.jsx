import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CADRES, DESIGNATIONS, DISTRICTS, EVENT, labelOf } from "../../../shared/constants.js";
import {
  DETAIL_FIELDS, MAX_RECEIPT_BYTES, RECEIPT_TYPES,
  cleanDetails, cleanUtr, validateDetails, validateUtr,
} from "../../../shared/validate.js";
import { api, store, upload } from "../api.js";
import { useConfig } from "../config.js";
import PaymentPanel from "../components/PaymentPanel.jsx";
import { ResendButton } from "./Pass.jsx";
import {
  Banner, Field, Icon, guNum, inputClass, primaryButton, secondaryButton, telHref, textareaBoxClass,
} from "../components/ui.jsx";

const DRAFT_KEY = "abrsm26-draft";
const EMPTY = Object.fromEntries(DETAIL_FIELDS.map((k) => [k, ""]));

const STEPS = [
  { gu: "વ્યક્તિગત વિગતો", en: "Personal Details", fields: ["email", "fullName", "cadre", "district", "mobile", "altContact"] },
  { gu: "વ્યાવસાયિક વિગતો", en: "Professional Details", fields: ["designation", "designationOther", "fieldOfStudy", "institution", "orgResponsibility", "residentialAddress"] },
  { gu: "ચકાસો અને ચુકવણી કરો", en: "Review & Pay", fields: [] },
];
const stepOf = (field) => STEPS.findIndex((s) => s.fields.includes(field));

const CADRE_ICONS = { college: "school", university: "account_balance" };
const designationLabel = (d) => (d.designation === "other" ? d.designationOther : labelOf(DESIGNATIONS, d.designation));
const guLabel = (list, v) => list.find((x) => x.value === v)?.gu || "";

let checkoutScript;
function loadCheckout() {
  checkoutScript ??= new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = "https://checkout.razorpay.com/v1/checkout.js";
    el.onload = resolve;
    el.onerror = () => {
      checkoutScript = null;
      reject(new Error("Could not load the payment window. Please check your connection and try again."));
    };
    document.body.appendChild(el);
  });
  return checkoutScript;
}

// Resolves with Razorpay's success response; rejects with { cancelled: true } if the window is closed.
function openCheckout(order, details) {
  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: "ABRSM Gujarat",
      description: `${EVENT.titleEn} registration`,
      prefill: { name: details.fullName, email: details.email, contact: details.mobile },
      theme: { color: "#a43700" },
      handler: resolve,
      modal: { ondismiss: () => reject(Object.assign(new Error(), { cancelled: true })), confirm_close: true },
    });
    rzp.open();
  });
}

export default function Register() {
  const config = useConfig();
  const online = Boolean(config?.razorpayKeyId);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(() => ({ ...EMPTY, ...(store.get(DRAFT_KEY) || {}) }));
  const [utr, setUtr] = useState("");
  const [file, setFile] = useState(null);
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState("");
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const [paying, setPaying] = useState(false);
  const [confirming, setConfirming] = useState(null); // order id while the server checks a completed payment
  // Set when Razorpay took the money but we couldn't confirm it with the server — retry without paying again.
  const [unconfirmed, setUnconfirmed] = useState(null);
  const scrollToError = useRef(false);

  useEffect(() => { store.set(DRAFT_KEY, form); }, [form]);

  useEffect(() => { window.scrollTo({ top: 0 }); }, [step]);

  useEffect(() => {
    if (!scrollToError.current) return;
    scrollToError.current = false;
    const el = document.querySelector("[data-error], [role=alert]");
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.querySelector("input, select, textarea, button")?.focus({ preventScroll: true });
  }, [step, errors, banner]);

  const set = (k) => (e) => {
    const v = typeof e === "string" ? e : e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors(({ [k]: _, ...rest }) => rest);
  };

  function showErrors(errs, message = "") {
    scrollToError.current = true;
    setErrors(errs);
    setBanner(message);
  }

  function next(e) {
    e.preventDefault();
    const all = validateDetails(cleanDetails(form));
    const errs = Object.fromEntries(Object.entries(all).filter(([k]) => STEPS[step].fields.includes(k)));
    if (Object.keys(errs).length) return showErrors(errs);
    setErrors({});
    setBanner("");
    setStep(step + 1);
  }

  function back() {
    setErrors({});
    setBanner("");
    setStep(step - 1);
  }

  function pickFile(f) {
    if (!f) return;
    if (!RECEIPT_TYPES.includes(f.type)) return setErrors((x) => ({ ...x, receipt: "Upload an image (JPG / PNG) or a PDF file." }));
    if (f.size > MAX_RECEIPT_BYTES) return setErrors((x) => ({ ...x, receipt: "File is too large. Maximum size is 10 MB." }));
    setFile(f);
    setErrors(({ receipt, ...rest }) => rest);
  }

  function handleError(err) {
    const steps = Object.keys(err.fields).map(stepOf).filter((i) => i >= 0);
    if (steps.length) setStep(Math.min(...steps));
    showErrors(err.fields, err.message);
  }

  function finish(res, paymentRef) {
    store.remove(DRAFT_KEY);
    setResult({ ...res, paymentRef, details: cleanDetails(form) });
    setStep("done");
  }

  async function confirmPayment(paid) {
    setConfirming(paid.orderId);
    try {
      finish(await api("/pay/verify", { method: "POST", body: paid }), paid.paymentId);
    } catch (err) {
      setUnconfirmed(paid);
      showErrors({}, `${err.message} Your payment ID is ${paid.paymentId}.`);
    } finally {
      setConfirming(null);
    }
  }

  async function payOnline(e) {
    e.preventDefault();
    if (!agreed && !unconfirmed) return showErrors({ agree: "Please confirm that your details are correct." });
    setBanner("");
    setPaying(true);
    try {
      if (unconfirmed) return await confirmPayment(unconfirmed);
      const details = cleanDetails(form);
      const [order] = await Promise.all([api("/pay/order", { method: "POST", body: details }), loadCheckout()]);
      const r = await openCheckout(order, details);
      await confirmPayment({ orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature });
    } catch (err) {
      if (err.cancelled) showErrors({}, "Payment was not completed. You can try again whenever you are ready.");
      else handleError(err);
    } finally {
      setPaying(false);
    }
  }

  async function submitUpi(e) {
    e.preventDefault();
    const errs = {};
    const utrErr = validateUtr(cleanUtr(utr));
    if (utrErr) errs.utr = utrErr;
    if (!file) errs.receipt = "Upload the payment screenshot or receipt.";
    if (!agreed) errs.agree = "Please confirm that your details are correct.";
    if (Object.keys(errs).length) return showErrors(errs);

    const data = new FormData();
    Object.entries(cleanDetails(form)).forEach(([k, v]) => data.append(k, v));
    data.append("utr", cleanUtr(utr));
    data.append("receipt", file);

    setBanner("");
    setProgress(0);
    try {
      finish(await upload("/register", data, { onProgress: setProgress }), cleanUtr(utr));
    } catch (err) {
      handleError(err);
    } finally {
      setProgress(null);
    }
  }

  if (config && config.registrationOpen === false && step !== "done") {
    return (
      <section className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-3xl font-semibold">નોંધણી બંધ છે <span className="text-on-surface-variant">/ Registration closed</span></h1>
        <p className="mt-3 text-on-surface-variant">Online registration for the State Conference 2026 is now closed. Please contact the organising team for any queries.</p>
        <Link to="/" className={`${secondaryButton} mt-6`}>Back to home</Link>
      </section>
    );
  }

  if (step === "done") return <Success result={result} contacts={config?.contacts || []} whatsappPass={Boolean(config?.whatsappPass)} />;

  const submitting = progress !== null || paying;
  const d = cleanDetails(form);

  return (
    <div className="relative w-full overflow-hidden px-4 py-6 sm:px-6 lg:py-10">
      <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-primary-fixed/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 top-1/2 h-96 w-96 rounded-full bg-[#ffb59e]/20 blur-3xl" />

      <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-start gap-8 lg:grid-cols-12">
        <BadgePreview form={form} contacts={config?.contacts || []} />

        <section className="mx-auto w-full max-w-2xl lg:col-span-7">
          <div className="flex flex-col overflow-clip rounded-2xl bg-surface-container-lowest shadow-xl">
            <header className="flex items-center gap-3 px-5 pb-4 pt-6 sm:px-7">
              {step === 0 ? (
                <Link to="/" aria-label="પાછા જાઓ / Go back" className="flex h-12 w-12 items-center justify-center rounded-xl transition-colors hover:bg-surface-container-high">
                  <Icon name="arrow_back" className="text-[26px]" />
                </Link>
              ) : (
                <button type="button" onClick={back} disabled={submitting || !!unconfirmed} aria-label="પાછા જાઓ / Go back" className="flex h-12 w-12 items-center justify-center rounded-xl transition-colors hover:bg-surface-container-high disabled:opacity-40">
                  <Icon name="arrow_back" className="text-[26px]" />
                </button>
              )}
              <div>
                <h1 className="text-2xl font-semibold leading-snug tracking-tight">નોંધણી</h1>
                <span className="block text-[15px] text-on-surface-variant">Delegate Registration · {EVENT.titleEn}</span>
              </div>
            </header>

            <Progress step={step} />

            <form onSubmit={step < 2 ? next : online ? payOnline : submitUpi} noValidate className="flex flex-col">
              <div className="space-y-6 p-5 sm:p-7">
                {banner && <Banner>{banner}</Banner>}
                {step === 0 && <PersonalStep form={form} set={set} errors={errors} />}
                {step === 1 && <ProfessionalStep form={form} set={set} errors={errors} />}
                {step === 2 && (
                  <ReviewStep
                    d={d}
                    goTo={setStep}
                    locked={submitting || !!unconfirmed}
                    online={online}
                    fee={config?.fee ?? 500}
                    agreed={agreed}
                    setAgreed={(v) => { setAgreed(v); if (errors.agree) setErrors(({ agree, ...r }) => r); }}
                    errors={errors}
                    upi={!online && (
                      <UpiProof utr={utr} setUtr={(v) => { setUtr(v); if (errors.utr) setErrors(({ utr, ...r }) => r); }} file={file} pickFile={pickFile} clearFile={() => setFile(null)} errors={errors} disabled={submitting} />
                    )}
                  />
                )}
              </div>

              <footer className="sticky bottom-0 mt-2 bg-surface-container-lowest p-5 shadow-[0_-4px_16px_rgba(0,0,0,0.04)] sm:p-7">
                {step === 0 && (
                  <>
                    <button type="submit" className={`${primaryButton} w-full`}>
                      <span>આગળ / Continue</span>
                      <Icon name="arrow_forward" className="text-[20px]" />
                    </button>
                    <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-sm text-on-surface-variant">
                      <Icon name="save" className="text-[16px] text-tertiary" />
                      તમારી વિગતો આ ડિવાઇસ પર સાચવેલી રહેશે / Your answers are saved on this device until you submit
                    </p>
                  </>
                )}
                {step === 1 && (
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={back} className="flex h-14 w-[35%] flex-col items-center justify-center rounded-xl bg-surface-container-lowest font-bold ring-2 ring-inset ring-outline-variant transition-colors hover:bg-surface-container-low">
                      <span className="text-[15px] leading-tight">પાછળ</span>
                      <span className="text-[11px] font-medium leading-none text-on-surface-variant">Back</span>
                    </button>
                    <button type="submit" className="flex h-14 w-[65%] flex-col items-center justify-center rounded-xl bg-primary font-bold text-on-primary shadow-md transition-colors hover:bg-on-primary-fixed-variant active:scale-[0.99]">
                      <span className="flex items-center gap-2 text-base leading-tight">આગળ <Icon name="arrow_forward" className="text-[18px]" /></span>
                      <span className="text-[11px] font-normal leading-none text-on-primary/90">Continue to Step 3</span>
                    </button>
                  </div>
                )}
                {step === 2 && online && (
                  <>
                    <button type="submit" disabled={submitting} className={`${primaryButton} w-full`}>
                      <Icon name={unconfirmed ? "sync" : "lock"} className="text-[20px] text-primary-fixed" />
                      <span className="text-center leading-tight">
                        {paying && !unconfirmed ? (
                          "કૃપા કરીને રાહ જુઓ… / Please wait…"
                        ) : unconfirmed ? (
                          <>ચુકવણી કન્ફર્મ કરો<span className="block text-[11px] font-normal opacity-90">Confirm my payment</span></>
                        ) : (
                          <>₹ {guNum(config.fee)} ચૂકવો અને નોંધણી પૂર્ણ કરો<span className="block text-[11px] font-normal opacity-90">Pay ₹{config.fee} &amp; Complete Registration</span></>
                        )}
                      </span>
                    </button>
                    <PaymentBadges />
                  </>
                )}
                {step === 2 && !online && (
                  <button type="submit" disabled={submitting} className={`${primaryButton} w-full`}>
                    {submitting
                      ? progress < 1 ? `Uploading… ${Math.round(progress * 100)}%` : "Saving…"
                      : "નોંધણી સબમિટ કરો · Submit registration"}
                  </button>
                )}
              </footer>
            </form>
          </div>
        </section>
      </div>

      {confirming && <ProcessingOverlay orderId={confirming} fee={config?.fee ?? 500} />}
    </div>
  );
}

function Progress({ step }) {
  const s = STEPS[step];
  return (
    <div className="px-5 pb-5 pt-2 sm:px-7">
      <div className="mb-2.5 grid grid-cols-3 gap-2.5" aria-hidden="true">
        {STEPS.map((_, i) => <div key={i} className={`h-2 rounded-full transition-all duration-300 ${i <= step ? "bg-primary" : "bg-surface-container-highest"}`} />)}
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold tracking-wide text-primary">
          પગલું {guNum(step + 1)}/૩ · {s.gu} <span className="font-normal text-on-surface-variant">/ Step {step + 1} of 3 · {s.en}</span>
        </span>
        <span className="shrink-0 text-sm font-medium text-on-surface-variant">{guNum(Math.round(((step + 1) / 3) * 100))}% પૂર્ણ</span>
      </div>
    </div>
  );
}

// ---------- Step 1 ----------

function PersonalStep({ form, set, errors }) {
  return (
    <>
      <Field id="email" gu="ઈમેલ એડ્રેસ" en="Email address" required error={errors.email}>
        <div className="relative flex items-center">
          <input
            id="email" type="email" inputMode="email" autoComplete="email" value={form.email} onChange={set("email")}
            placeholder="professor.name@university.ac.in" aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-error" : undefined}
            className={`${inputClass(errors.email)} pr-12`}
          />
          {errors.email && <Icon name="error" fill className="pointer-events-none absolute right-4 text-[24px] text-error" />}
        </div>
      </Field>

      <Field id="fullName" gu="પૂરું નામ" en="Full name (Title – First name – Middle name – Surname)" required error={errors.fullName}
        hint="દા.ત. ડૉ. વિનોદભાઈ કાંતિલાલ પટેલ (e.g. Dr. Vinodbhai Kantilal Patel)">
        <input id="fullName" autoComplete="name" value={form.fullName} onChange={set("fullName")} placeholder="ડૉ. / પ્રા. પૂરું નામ દાખલ કરો" aria-invalid={!!errors.fullName} className={inputClass(errors.fullName)} />
      </Field>

      <Field labelId="cadre-label" gu="સંવર્ગ" en="Cadre / Category" required error={errors.cadre}>
        <div role="radiogroup" aria-labelledby="cadre-label" className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {CADRES.map((c) => {
            const on = form.cadre === c.value;
            return (
              <label key={c.value} className={`relative flex cursor-pointer flex-col justify-between rounded-xl p-4 transition-all has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${on ? "bg-primary-fixed/20 ring-2 ring-primary" : "bg-surface-container-low ring-[1.5px] ring-inset ring-outline-variant hover:bg-surface-container"}`}>
                <input type="radio" name="cadre" value={c.value} checked={on} onChange={() => set("cadre")(c.value)} className="sr-only" />
                <div className="mb-3 flex items-start justify-between">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${on ? "bg-primary-container text-on-primary-container" : "bg-surface-container-highest"}`}>
                    <Icon name={CADRE_ICONS[c.value]} className="text-[24px]" />
                  </div>
                  <div className={`flex h-6 w-6 items-center justify-center rounded-full ${on ? "bg-primary text-on-primary shadow-sm" : "bg-surface-container-highest"}`}>
                    {on && <Icon name="check" className="text-[16px]" />}
                  </div>
                </div>
                <span className="block text-xl font-semibold leading-snug">{c.gu}</span>
                <span className="block text-[15px] font-medium text-on-surface-variant">{c.en}</span>
              </label>
            );
          })}
        </div>
      </Field>

      <DistrictPicker value={form.district} onChange={set("district")} error={errors.district} />

      <Field id="mobile" gu="વોટ્સએપ / મોબાઈલ નંબર" en="WhatsApp & primary mobile number" required error={errors.mobile}
        hint="આયોજકો આ નંબર પર WhatsApp દ્વારા સંપર્ક કરશે / The organisers will contact you on WhatsApp at this number" hintIcon="chat">
        <div className={`flex items-stretch overflow-hidden rounded-xl shadow-sm ${errors.mobile ? "ring-2 ring-error" : "ring-[1.5px] ring-inset ring-outline-variant focus-within:ring-2 focus-within:ring-primary"}`}>
          <div className="flex select-none items-center bg-surface-container px-4 font-semibold">+91</div>
          <input id="mobile" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={14} value={form.mobile} onChange={set("mobile")} placeholder="98250 XXXXX" aria-invalid={!!errors.mobile} className="h-14 min-w-0 flex-1 bg-surface-container-lowest px-4" />
        </div>
      </Field>

      <Field id="altContact" gu="વૈકલ્પિક સંપર્ક નંબર" en="Alternative contact number" optional error={errors.altContact}>
        <input id="altContact" type="tel" inputMode="tel" value={form.altContact} onChange={set("altContact")} placeholder="લેન્ડલાઇન અથવા અન્ય મોબાઈલ (Landline or alternate mobile)" className={inputClass(errors.altContact)} />
      </Field>
    </>
  );
}

function DistrictPicker({ value, onChange, error }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const selected = DISTRICTS.find((x) => x.value === value);
  const query = q.trim().toLowerCase();
  const list = query ? DISTRICTS.filter((x) => x.en.toLowerCase().includes(query) || x.gu.includes(q.trim())) : DISTRICTS;

  function pick(v) {
    onChange(v);
    setOpen(false);
    setQ("");
    document.getElementById("district")?.focus();
  }

  return (
    <Field id="district" gu="જિલ્લો" en="District" required error={error}>
      <button
        id="district" type="button" aria-expanded={open} aria-controls="district-sheet" onClick={() => setOpen((v) => !v)}
        className={`flex h-14 w-full items-center justify-between rounded-xl px-4 text-left shadow-sm ${error ? "bg-error-container/20 ring-2 ring-error" : "bg-surface-container-lowest ring-[1.5px] ring-inset ring-outline-variant focus-visible:ring-2 focus-visible:ring-primary"}`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Icon name="location_on" className="text-[22px] text-primary" />
          {selected ? (
            <span className="truncate text-xl font-semibold text-primary">{selected.gu} <span className="text-base font-normal text-on-surface-variant">/ {selected.en}</span></span>
          ) : (
            <span className="text-on-surface-variant">જિલ્લો પસંદ કરો / Select district</span>
          )}
        </span>
        <Icon name={open ? "expand_less" : "expand_more"} className="text-[24px] text-on-surface-variant" />
      </button>

      {open && (
        <div
          id="district-sheet"
          onKeyDown={(e) => { if (e.key === "Escape") { setOpen(false); document.getElementById("district")?.focus(); } }}
          className="mt-2 w-full overflow-hidden rounded-2xl border-[1.5px] border-outline-variant bg-surface-container-lowest p-4 shadow-[0_12px_32px_rgba(90,65,56,0.15)]"
        >
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xl font-semibold">જિલ્લો પસંદ કરો</p>
              <span className="text-[15px] text-on-surface-variant">Select district in Gujarat</span>
            </div>
            <button type="button" aria-label="બંધ કરો / Close" onClick={() => setOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-container hover:bg-surface-container-high">
              <Icon name="close" className="text-[20px]" />
            </button>
          </div>
          <div className="relative mb-3 flex items-center">
            <Icon name="search" className="absolute left-3.5 text-[20px] text-on-surface-variant" />
            <input
              autoFocus type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="શોધો / Search district name…" aria-label="Search district"
              className="h-12 w-full rounded-xl bg-surface-container pl-11 pr-4"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (list.length) pick(list[0].value); } }}
            />
          </div>
          <ul className="max-h-56 space-y-1 overflow-y-auto pr-1">
            {list.map((x) => {
              const on = x.value === value;
              return (
                <li key={x.value}>
                  <button type="button" onClick={() => pick(x.value)} aria-pressed={on} className={`flex w-full items-center justify-between rounded-lg px-3.5 py-2.5 text-left transition-colors ${on ? "bg-primary-fixed/30" : "hover:bg-surface-container"}`}>
                    <span>
                      <span className={`block font-semibold ${on ? "text-primary" : ""}`}>{x.gu}</span>
                      <span className="block text-[15px] text-on-surface-variant">{x.en}</span>
                    </span>
                    {on && <Icon name="check_circle" className="text-[20px] text-primary" />}
                  </button>
                </li>
              );
            })}
            {list.length === 0 && <li className="px-3.5 py-2.5 text-on-surface-variant">No district matches “{q}”.</li>}
          </ul>
        </div>
      )}
    </Field>
  );
}

// ---------- Step 2 ----------

function Counter({ value, max = 500, note }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-surface-container px-3.5 pb-2.5 pt-1">
      <span className="text-[11px] text-on-surface-variant">{note}</span>
      <span className="rounded-md bg-surface-container px-2 py-0.5 text-xs font-semibold tabular-nums tracking-wide text-on-surface-variant">{value.length} / {max}</span>
    </div>
  );
}

function ProfessionalStep({ form, set, errors }) {
  return (
    <>
      <div className="flex items-center gap-3 rounded-xl bg-primary-fixed/25 p-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon name="menu_book" className="text-[20px]" />
        </div>
        <div>
          <p className="text-[13px] font-semibold leading-snug">શૈક્ષિક પદ અને સંસ્થાકીય માહિતી</p>
          <p className="text-xs leading-snug text-on-surface-variant">Your designation and institution</p>
        </div>
      </div>

      <Field labelId="designation-label" gu="સંસ્થામાં હોદ્દો" en="Designation in institution" required error={errors.designation || errors.designationOther}>
        <div role="radiogroup" aria-labelledby="designation-label" className="space-y-1.5 rounded-xl bg-surface-container-lowest p-2 shadow-sm ring-1 ring-inset ring-outline-variant">
          {DESIGNATIONS.map((o) => {
            const on = form.designation === o.value;
            return (
              <div key={o.value} className={`rounded-lg transition-all ${on ? "bg-primary-fixed/30 p-3 ring-2 ring-primary" : "p-3 hover:bg-surface-container-low"}`}>
                <label className="flex min-h-11 cursor-pointer items-center has-[:focus-visible]:underline">
                  <input type="radio" name="designation" value={o.value} checked={on} onChange={() => set("designation")(o.value)} className="sr-only" />
                  <span className={`mr-3 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 bg-white ${on ? "border-primary" : "border-outline"}`}>
                    {on && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
                  </span>
                  <span className="flex flex-1 flex-col">
                    <span className={`text-[15px] font-semibold leading-tight ${on ? "text-primary" : ""}`}>{o.gu}</span>
                    <span className="text-xs text-on-surface-variant">{o.en}</span>
                  </span>
                </label>
                {on && o.value === "other" && (
                  <div className="mt-3 pl-8 pr-1">
                    <label htmlFor="designationOther" className="mb-1.5 block text-xs font-semibold">
                      કૃપા કરીને તમારો હોદ્દો લખો <span className="text-error">*</span>
                      <span className="block text-[11px] font-normal text-on-surface-variant">Please specify your designation</span>
                    </label>
                    <input id="designationOther" autoFocus value={form.designationOther} onChange={set("designationOther")} placeholder="દા.ત. સંશોધન અધિકારી, લેક્ચરર…" className={inputClass(errors.designationOther)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Field>

      <Field id="fieldOfStudy" gu="અધ્યયન વિષય / ક્ષેત્ર" en="Field of study / specialization" required error={errors.fieldOfStudy}
        hint="મુખ્ય વિષય અથવા વિદ્યાશાખા (દા.ત. સંસ્કૃત, ભૌતિકશાસ્ત્ર, અર્થશાસ્ત્ર)">
        <div className="relative">
          <input id="fieldOfStudy" value={form.fieldOfStudy} onChange={set("fieldOfStudy")} placeholder="રસાયણશાસ્ત્ર, અંગ્રેજી, વાણિજ્ય…" className={`${inputClass(errors.fieldOfStudy)} pr-11`} />
          <Icon name="menu_book" className="pointer-events-none absolute right-3.5 top-4 text-[20px] text-outline" />
        </div>
      </Field>

      <Field id="institution" gu="સંસ્થા / કૉલેજ / યુનિવર્સિટીનું પૂરું નામ અને સરનામું" en="Name & full address of institution" required error={errors.institution}>
        <div className={textareaBoxClass(errors.institution)}>
          <textarea id="institution" rows={4} maxLength={500} value={form.institution} onChange={set("institution")} placeholder="કૉલેજ અથવા યુનિવર્સિટી ડિપાર્ટમેન્ટનું નામ, કેમ્પસ, પિનકોડ સાથે સરનામું…" className="w-full resize-none bg-transparent p-3.5 leading-relaxed" />
          <Counter value={form.institution} note="સંસ્થાનું નામ, વિભાગ, શહેર અને પીનકોડ" />
        </div>
      </Field>

      <Field id="orgResponsibility" gu="સંગઠનાત્મક જવાબદારી" en="Organizational responsibility" optional error={errors.orgResponsibility}
        hint="ABRSM શાખા અથવા પ્રાંત સ્તરની જવાબદારી (દા.ત. કારોબારી સભ્ય, સંયોજક)">
        <input id="orgResponsibility" value={form.orgResponsibility} onChange={set("orgResponsibility")} placeholder="ABRSM માં હોદ્દો (જો લાગુ પડતું હોય તો)" className={inputClass(errors.orgResponsibility)} />
      </Field>

      <Field id="residentialAddress" gu="કાયમી / હાલનું નિવાસસ્થાનનું સરનામું" en="Residential address" required error={errors.residentialAddress}
        hint="ઘર નંબર, સોસાયટી, તાલુકો, જિલ્લો અને પિનકોડ ચોકસાઈથી લખો.">
        <div className={textareaBoxClass(errors.residentialAddress)}>
          <textarea id="residentialAddress" rows={4} maxLength={500} autoComplete="street-address" value={form.residentialAddress} onChange={set("residentialAddress")} placeholder="ઘર નંબર, સોસાયટી, તાલુકો, જિલ્લો અને પિનકોડ" className="w-full resize-none bg-transparent p-3.5 leading-relaxed" />
          <Counter value={form.residentialAddress} />
        </div>
      </Field>
    </>
  );
}

// ---------- Step 3 ----------

function ReviewSection({ dot, gu, en, onEdit, locked, children }) {
  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between border-b border-primary-fixed pb-3">
        <div>
          <div className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${dot}`} />
            <h2 className="text-sm font-bold">{gu}</h2>
          </div>
          <p className="pl-3.5 text-[11px] text-on-surface-variant">{en}</p>
        </div>
        <button type="button" onClick={onEdit} disabled={locked} className="inline-flex items-center gap-1 rounded-lg bg-primary-fixed/40 px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary-fixed disabled:opacity-40">
          <Icon name="edit" className="text-[14px]" />
          બદલો / Edit
        </button>
      </div>
      <dl className="space-y-2.5 text-xs">{children}</dl>
    </div>
  );
}

function Item({ gu, en, children, className = "" }) {
  return (
    <div className={className}>
      <dt className="text-[11px] text-on-surface-variant">{gu} <span className="text-[10px]">/ {en}</span></dt>
      <dd className="mt-0.5 break-words text-sm font-bold leading-snug">{children}</dd>
    </div>
  );
}

function ReviewStep({ d, goTo, locked, online, fee, agreed, setAgreed, errors, upi }) {
  const district = DISTRICTS.find((x) => x.value === d.district);
  const designation = DESIGNATIONS.find((x) => x.value === d.designation);
  const rule = "border-t border-dashed border-surface-variant pt-1";
  return (
    <>
      <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-950">
        <Icon name="info" className="mt-0.5 text-[20px] text-amber-700" />
        <div>
          <p className="font-semibold">કૃપા કરીને બધી વિગતો ધ્યાનપૂર્વક ચકાસી લો.</p>
          <p className="text-[11px] text-amber-800">Please check your details before {online ? "proceeding to online payment" : "submitting"}.</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm ring-1 ring-inset ring-outline-variant">
        <ReviewSection dot="bg-primary" gu="વ્યક્તિગત વિગતો" en="Personal Details" onEdit={() => goTo(0)} locked={locked}>
          <Item gu="પૂરું નામ" en="Full Name">{d.fullName}</Item>
          <div className={`grid grid-cols-2 gap-2 ${rule}`}>
            <Item gu="સંવર્ગ" en="Cadre">{guLabel(CADRES, d.cadre)} ({labelOf(CADRES, d.cadre)})</Item>
            <Item gu="જિલ્લો" en="District">{district ? `${district.gu} (${district.en})` : d.district}</Item>
          </div>
          <Item className={rule} gu="ઈમેલ એડ્રેસ" en="Email Address">{d.email}</Item>
          <Item className={rule} gu="વોટ્સએપ મોબાઈલ નંબર" en="WhatsApp Number">+91 {d.mobile.replace(/(\d{5})(\d{5})/, "$1 $2")}</Item>
          {d.altContact && <Item className={rule} gu="વૈકલ્પિક સંપર્ક" en="Alternative Contact">{d.altContact}</Item>}
        </ReviewSection>
        <div className="border-t border-outline-variant" />
        <ReviewSection dot="bg-secondary" gu="વ્યાવસાયિક વિગતો" en="Professional Details" onEdit={() => goTo(1)} locked={locked}>
          <div className="grid grid-cols-2 gap-2">
            <Item gu="હોદ્દો" en="Designation">{d.designation === "other" ? d.designationOther : designation?.gu}</Item>
            <Item gu="વિષય" en="Subject">{d.fieldOfStudy}</Item>
          </div>
          <Item className={rule} gu="સંસ્થા / કૉલેજ" en="Institution">{d.institution}</Item>
          {d.orgResponsibility && <Item className={rule} gu="સંગઠનાત્મક જવાબદારી" en="Org Role">{d.orgResponsibility}</Item>}
          <Item className={rule} gu="નિવાસસ્થાનનું સરનામું" en="Residential Address">{d.residentialAddress}</Item>
        </ReviewSection>
      </div>

      {online ? (
        <div className="rounded-xl border-2 border-dashed border-primary/40 bg-[#fff5eb] p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon name="currency_rupee" className="text-[16px]" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-on-primary-fixed-variant">ચુકવણી વિગત</h3>
              <p className="text-[10px] text-on-surface-variant">Fee Breakdown</p>
            </div>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium">નોંધણી શુલ્ક</span>
                <span className="block text-[10px] text-on-surface-variant">Registration Fee</span>
              </div>
              <span className="font-semibold">₹ {fee}.00</span>
            </div>
            <div className="flex items-center justify-between pt-1 text-[11px] text-on-surface-variant">
              <span>સુવિધા શુલ્ક / Convenience Fee</span>
              <span className="font-semibold text-tertiary">મફત (₹ 0.00)</span>
            </div>
            <div className="my-2 border-t border-dashed border-primary/30" />
            <div className="flex items-baseline justify-between pt-1">
              <div>
                <span className="text-sm font-bold text-on-primary-fixed-variant">કુલ ચુકવણી</span>
                <span className="block text-[11px] font-medium text-on-surface-variant">Total Payable Amount</span>
              </div>
              <span className="text-xl font-extrabold text-on-primary-fixed-variant">₹ {fee}.00</span>
            </div>
          </div>
        </div>
      ) : (
        upi
      )}

      <div data-error={errors.agree ? "" : undefined}>
        <label className={`flex cursor-pointer select-none items-start gap-3 rounded-xl bg-surface-container-lowest p-3.5 shadow-sm transition-colors ${errors.agree ? "ring-2 ring-error" : "ring-1 ring-inset ring-outline-variant hover:ring-primary"}`}>
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} disabled={locked} className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-primary" />
          <span className="text-xs leading-relaxed">
            <span className="block text-[13px] font-semibold">હું ઉપરની તમામ વિગતો સાચી હોવાનું પ્રમાણિત કરું છું.</span>
            <span className="mt-0.5 block text-[11px] text-on-surface-variant">I confirm all details provided above are true, accurate and correct.</span>
          </span>
        </label>
        {errors.agree && <p className="mt-2 flex items-center gap-1.5 text-[15px] font-semibold text-error" role="alert"><Icon name="cancel" className="text-[18px]" />{errors.agree}</p>}
      </div>
    </>
  );
}

function PaymentBadges() {
  return (
    <div className="space-y-1.5 pt-2.5 text-center">
      <p className="text-[11px] text-on-surface-variant">
        <span className="font-semibold text-on-surface">Razorpay</span> દ્વારા સુરક્ષિત ચુકવણી · UPI, કાર્ડ, નેટબેન્કિંગ
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2 opacity-80">
        <span className="rounded border border-gray-200 bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-700">UPI</span>
        <span className="rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-extrabold text-blue-700">VISA</span>
        <span className="rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-700">Mastercard</span>
        <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">RuPay</span>
        <span className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">NetBanking</span>
      </div>
    </div>
  );
}

// Manual UPI fallback (only when Razorpay keys are not configured).
function UpiProof({ utr, setUtr, file, pickFile, clearFile, errors, disabled }) {
  return (
    <>
      <PaymentPanel />
      <Field id="utr" gu="ટ્રાન્ઝેક્શન / UTR નંબર" en="Payment transaction ID / UTR" required error={errors.utr} hint="Found under “UPI Ref No.” or “UTR” in your payment app.">
        <input id="utr" autoComplete="off" value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="UPI / IMPS ટ્રાન્ઝેક્શન રેફરન્સ નંબર" className={inputClass(errors.utr)} />
      </Field>
      <Field gu="પેમેન્ટની પહોંચ / સ્ક્રીનશોટ" en="Upload payment receipt (image or PDF, max 10 MB)" required error={errors.receipt}>
        <FilePicker file={file} onPick={pickFile} onClear={clearFile} disabled={disabled} />
      </Field>
    </>
  );
}

function FilePicker({ file, onPick, onClear, disabled }) {
  const [preview, setPreview] = useState("");
  const [drag, setDrag] = useState(false);

  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) return setPreview("");
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-surface-container-low p-3 ring-1 ring-inset ring-outline-variant">
        {preview ? <img src={preview} alt="" className="h-14 w-14 rounded-lg object-cover" /> : <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary-fixed text-xs font-bold text-primary">PDF</div>}
        <div className="min-w-0 flex-1">
          <b className="block truncate">{file.name}</b>
          <span className="text-sm text-on-surface-variant">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
        </div>
        <button type="button" className="font-semibold text-primary underline" onClick={onClear} disabled={disabled}>Change</button>
      </div>
    );
  }

  return (
    <label
      className={`relative block cursor-pointer rounded-xl border-[1.5px] border-dashed p-6 text-center transition-colors ${drag ? "border-primary bg-primary-fixed/20" : "border-outline-variant bg-surface-container-lowest hover:border-primary"}`}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); onPick(e.dataTransfer.files[0]); }}
    >
      <input type="file" accept="image/*,application/pdf" onChange={(e) => onPick(e.target.files[0])} className="absolute inset-0 cursor-pointer opacity-0" />
      <Icon name="upload_file" className="text-[28px] text-primary" />
      <b className="mt-1 block text-primary">Image / PDF અપલોડ કરો</b>
      <span className="text-sm text-on-surface-variant">Tap to choose the screenshot, or drag it here</span>
    </label>
  );
}

// ---------- Side panel ----------

function BadgePreview({ form, contacts }) {
  const d = cleanDetails(form);
  const initials = d.fullName.replace(/^(ડૉ\.|પ્રા\.|dr\.?|prof\.?)\s*/i, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("") || "?";
  const cadre = CADRES.find((c) => c.value === d.cadre);
  return (
    <aside className="sticky top-44 hidden flex-col gap-6 lg:col-span-5 lg:flex">
      <div className="relative overflow-hidden rounded-xl bg-surface-container-lowest p-6 shadow-md">
        <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-primary via-secondary to-primary-container" />
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon name="account_balance" fill className="text-[28px]" />
            </div>
            <div>
              <span className="block text-xl font-semibold">પ્રતિનિધિ કાર્ડ</span>
              <span className="block text-[15px] text-on-surface-variant">Delegate preview</span>
            </div>
          </div>
          <span className="rounded-full bg-surface-container px-2.5 py-1 text-[15px] font-semibold text-primary">૨૦૨૬</span>
        </div>

        <div className="mb-5 flex items-center gap-4 rounded-lg bg-surface-container-low p-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-primary-fixed text-xl font-bold text-primary shadow-sm">{initials}</div>
          <div className="min-w-0 flex-1">
            <span className="block truncate text-xl font-semibold">{d.fullName || "આપનું નામ / Your name"}</span>
            <span className="block truncate text-[15px] text-on-surface-variant">{designationLabel(d) || "હોદ્દો / Designation"}{d.district && ` · ${d.district}`}</span>
            {cadre && (
              <span className="mt-1 inline-flex items-center gap-1 text-[15px] text-tertiary">
                <Icon name="verified" className="text-[16px]" />{cadre.gu} ({cadre.en})
              </span>
            )}
          </div>
        </div>

        <div className="space-y-3 text-[15px] text-on-surface-variant">
          <p className="flex items-start gap-2.5"><Icon name="payments" className="mt-0.5 shrink-0 text-[20px] text-primary" />નોંધણી શુલ્ક ₹૫૦૦ — ફોર્મના અંતે ચુકવણી / ₹500 fee, paid at the end of the form.</p>
          <p className="flex items-start gap-2.5"><Icon name="confirmation_number" className="mt-0.5 shrink-0 text-[20px] text-tertiary" />ચુકવણી બાદ નોંધણી નંબર તરત મળશે / You get your registration number right after paying.</p>
          <p className="flex items-start gap-2.5"><Icon name="badge" className="mt-0.5 shrink-0 text-[20px] text-secondary" />સંમેલનના દિવસે નોંધણી નંબર સાથે રાખો / Keep the number with you on the day.</p>
        </div>

        {contacts[0] && (
          <div className="mt-6 flex items-center justify-between pt-4">
            <span className="text-[15px] text-on-surface-variant">સહાયતા હેલ્પલાઇન:</span>
            <a href={telHref(contacts[0].phone)} className="font-semibold text-primary">{contacts[0].phone}</a>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 rounded-xl bg-surface-container-low p-5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-container text-secondary">
          <Icon name="pin_drop" className="text-[26px]" />
        </div>
        <div>
          <span className="block font-semibold">ગુજરાત યુનિવર્સિટી કન્વેન્શન સેન્ટર, અમદાવાદ</span>
          <span className="block text-[15px] text-on-surface-variant">{EVENT.dateGu} · {EVENT.dateEn}</span>
        </div>
      </div>
    </aside>
  );
}

// ---------- Processing & success ----------

function ProcessingOverlay({ orderId, fee }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-5 backdrop-blur-sm" role="alertdialog" aria-modal="true" aria-labelledby="processing-title">
      <div className="relative w-full max-w-[340px] overflow-hidden rounded-2xl bg-white p-6 text-center shadow-2xl">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary-container to-on-primary-fixed-variant" />
        <div className="my-4 flex items-center justify-center">
          <div className="relative flex items-center justify-center">
            <div className="h-[58px] w-[58px] animate-spin rounded-full border-4 border-primary-fixed border-r-on-primary-fixed-variant border-t-primary-container" />
            <span className="absolute text-xs font-bold text-primary-container">₹</span>
          </div>
        </div>
        <h2 id="processing-title" className="px-1 text-base font-bold leading-snug">ચુકવણી પ્રક્રિયામાં છે… બંધ ન કરો</h2>
        <p className="mt-1 text-xs font-medium text-on-surface-variant">Processing payment… do not close this page</p>
        <div className="my-4 border-t border-dashed border-gray-200" />
        <div className="space-y-1.5 rounded-xl border border-orange-100 bg-orange-50/70 p-3 text-left text-xs">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span>રકમ / Amount:</span>
            <span className="text-sm font-bold text-on-primary-fixed-variant">₹ {fee}.00</span>
          </div>
          <div className="flex items-center justify-between gap-2 text-on-surface-variant">
            <span>ઓર્ડર સંદર્ભ:</span>
            <span className="truncate font-mono text-[11px] text-gray-700">{orderId}</span>
          </div>
          <div className="flex items-center justify-between text-on-surface-variant">
            <span>સુરક્ષિત ગેટવે:</span>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700"><Icon name="check" className="text-[14px]" />Razorpay Secured</span>
          </div>
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200/80 bg-amber-50 p-2.5 text-left">
          <Icon name="warning" className="mt-0.5 text-[16px] text-amber-700" />
          <div className="text-[11px] leading-tight text-amber-900">
            <p className="font-semibold">પાછળનું બટન (Back) કે રિફ્રેશ ન દબાવો.</p>
            <p className="mt-0.5 text-[10px] text-amber-800">Please do not press back or refresh.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Success({ result, contacts, whatsappPass }) {
  const [copied, setCopied] = useState(false);
  const d = result?.details || {};
  const confirmed = result?.status === "verified";
  const district = DISTRICTS.find((x) => x.value === d.district);
  const isRazorpay = String(result?.paymentRef || "").startsWith("pay_");

  function copy() {
    navigator.clipboard?.writeText(result.regNo).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="mx-auto w-full max-w-[560px] pb-6 print:max-w-none">
      <section className="border-b border-outline-variant/40 bg-gradient-to-b from-[#fcecd8] via-[#fdf2e4] to-surface px-4 pb-12 pt-8 text-center sm:rounded-b-3xl">
        <div className={`mx-auto flex h-24 w-24 items-center justify-center rounded-full border-4 border-white shadow-md ${confirmed ? "bg-[#e5f5ec]" : "bg-primary-fixed/60"}`}>
          <div className={`flex h-16 w-16 items-center justify-center rounded-full text-white shadow-sm ${confirmed ? "bg-tertiary" : "bg-primary"}`}>
            <Icon name={confirmed ? "check" : "hourglass_top"} className="text-[40px]" />
          </div>
        </div>
        <div className="mt-4 space-y-1">
          <h1 className="text-[23px] font-bold leading-tight tracking-tight text-on-primary-fixed-variant">
            {confirmed ? "નોંધણી સફળ!" : "નોંધણી મળી ગઈ છે"}
            <span className="mt-0.5 block text-[15px] font-semibold text-on-surface-variant">{confirmed ? "Registration Successful!" : "Registration Received"}</span>
          </h1>
          {confirmed ? (
            <>
              <p className="px-1 pt-1 text-[15px] font-medium leading-snug">આપનું રજિસ્ટ્રેશન સફળતાપૂર્વક થઈ ગયું છે. આપનો ખૂબ ખૂબ આભાર!</p>
              <p className="text-[13px] text-on-surface-variant">Your payment has been received and your seat is confirmed.</p>
            </>
          ) : (
            <>
              <p className="px-1 pt-1 text-[15px] font-medium leading-snug">ચુકવણીની ચકાસણી બાદ આપને કન્ફર્મેશન મોકલવામાં આવશે.</p>
              <p className="text-[13px] text-on-surface-variant">The organising team will verify your payment and confirm your registration on WhatsApp.</p>
            </>
          )}
        </div>
      </section>

      <div className="-mt-8 space-y-4 px-4">
        <div className="relative z-10 rounded-xl border border-outline-variant bg-white p-4 shadow-md">
          <div className="flex items-center justify-between gap-2 border-b border-outline-variant/80 pb-3">
            <div className="flex flex-col">
              <span className="text-[15px] font-semibold leading-tight">ઈ-રસીદ અને વિગતો</span>
              <span className="text-[12px] text-on-surface-variant">Receipt &amp; Participant Details</span>
            </div>
            {confirmed ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-tertiary/20 bg-[#e5f5ec] px-2.5 py-1 text-[11px] font-medium text-tertiary">
                <Icon name="check_circle" fill className="text-[14px]" />ચુકવાયેલ / PAID
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800">
                <Icon name="schedule" className="text-[14px]" />ચકાસણી બાકી / PENDING
              </span>
            )}
          </div>

          <div className="divide-y divide-outline-variant/60 pt-1">
            <Row gu="નોંધણી નંબર" en="Registration No.">
              <div className="flex items-center gap-1.5 rounded-lg border border-outline-variant bg-surface px-2.5 py-1">
                <span className="font-mono text-[15px] font-bold tracking-wide text-on-primary-fixed-variant">{result?.regNo}</span>
                <button type="button" onClick={copy} className="p-1 text-on-surface-variant hover:text-primary print:hidden" aria-label="Copy registration number">
                  <Icon name={copied ? "check" : "content_copy"} className="text-[16px]" />
                </button>
              </div>
            </Row>
            <Row gu="પ્રતિનિધિનું નામ" en="Name">
              <div className="text-right">
                <span className="block text-[15px] font-bold">{result?.fullName}</span>
                <span className="text-[12px] text-on-surface-variant">{[designationLabel(d), d.fieldOfStudy].filter(Boolean).join(", ")}</span>
              </div>
            </Row>
            {district && <Row gu="જિલ્લો" en="District"><span className="text-[15px] font-bold">{district.gu} / {district.en}</span></Row>}
            {result?.paymentRef && (
              <Row gu={isRazorpay ? "ચુકવણી ID" : "UTR નંબર"} en={isRazorpay ? "Payment ID" : "Transaction ID / UTR"}>
                <span className="break-all font-mono text-[13px] font-medium text-on-surface-variant">{result.paymentRef}</span>
              </Row>
            )}
            <div className="-mx-4 mt-1 flex items-center justify-between rounded-b-xl border-t border-outline-variant/70 bg-surface/50 px-4 pb-1 pt-3">
              <div className="flex flex-col">
                <span className="text-[15px] font-semibold leading-tight text-on-primary-fixed-variant">{confirmed ? "કુલ ચૂકવેલ રકમ" : "રકમ"}</span>
                <span className="text-[12px] text-on-surface-variant">{confirmed ? "Total Amount Paid" : "Amount"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[18px] font-bold text-on-primary-fixed-variant">₹ ૫૦૦ /-</span>
                <span className="text-[13px] font-semibold text-on-surface-variant">(₹500.00)</span>
              </div>
            </div>
          </div>
        </div>

        {result?.passToken && (
          <div className="flex items-start gap-3 rounded-xl border border-[#bde7cc] bg-[#eff9f2] p-3.5 shadow-sm print:hidden">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#25d366] text-white shadow-sm">
              <WhatsAppLogo />
            </div>
            <div className="flex-1">
              {result.whatsappSent ? (
                <>
                  <p className="text-[14px] font-semibold leading-snug text-[#0b5c2f]">આપનો ભોજન પાસ +91 {maskMobile(d.mobile)} પર મોકલવામાં આવ્યો છે</p>
                  <p className="mt-0.5 text-[12px] text-on-surface-variant">Your Bhojan Pass has been sent to your WhatsApp.</p>
                </>
              ) : (
                <>
                  <p className="text-[14px] font-semibold leading-snug text-[#0b5c2f]">આપનો ભોજન પાસ તૈયાર છે</p>
                  <p className="mt-0.5 text-[12px] text-on-surface-variant">
                    Your Bhojan Pass is ready. {whatsappPass ? "We could not send it on WhatsApp just now — try Resend, or open it below." : "Open it below and keep it on your phone."}
                  </p>
                </>
              )}
              <div className="mt-1">
                <ResendButton compact token={result.passToken} pass={{ canResend: whatsappPass, mobileEnd: d.mobile?.slice(-2) }} />
              </div>
            </div>
          </div>
        )}

        {result?.emailed && (
          <div className="flex items-start gap-3 rounded-xl border border-[#bde7cc] bg-[#eff9f2] p-3.5 shadow-sm">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tertiary text-white shadow-sm">
              <Icon name="mail" className="text-[20px]" />
            </div>
            <div>
              <p className="text-[14px] font-semibold leading-snug text-[#0b5c2f]">કન્ફર્મેશન અને ભોજન પાસ {result.email} પર ઈમેલ કરવામાં આવ્યા છે</p>
              <p className="mt-0.5 text-[12px] text-on-surface-variant">Your confirmation and Bhojan Pass have been emailed to you. Your certificate will be emailed after the conference.</p>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-outline-variant bg-white p-3.5 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-[14px] font-semibold text-on-primary-fixed-variant">
            <Icon name="info" className="text-[18px] text-primary" />
            <span>સંમેલન સૂચના / Event Information</span>
          </div>
          <ul className="list-inside list-disc space-y-1.5 text-[13px] text-on-surface-variant">
            <li><span className="font-medium text-on-surface">તારીખ:</span> {EVENT.dateGu}</li>
            <li><span className="font-medium text-on-surface">સ્થળ:</span> {EVENT.venueGu}</li>
            <li>સંમેલનના દિવસે આ નોંધણી નંબર સાથે રાખવો. / Please keep this registration number with you on the day.</li>
          </ul>
        </div>

        <div className="space-y-3 pt-2 print:hidden">
          {result?.passToken && (
            <Link to={`/pass/${result.passToken}`} className={`${primaryButton} w-full flex-col gap-0`}>
              <span className="leading-tight">ભોજન પાસ જુઓ</span>
              <span className="text-[12px] font-normal leading-none opacity-90">View Bhojan Pass</span>
            </Link>
          )}
          <button type="button" onClick={() => window.print()} className={result?.passToken
            ? "flex h-14 w-full flex-col items-center justify-center rounded-xl border-2 border-on-primary-fixed-variant bg-white font-bold text-on-primary-fixed-variant shadow-sm transition-colors hover:bg-surface"
            : `${primaryButton} w-full flex-col gap-0`}>
            <span className="leading-tight">રસીદ પ્રિન્ટ / સેવ કરો</span>
            <span className={`text-[12px] font-normal leading-none ${result?.passToken ? "text-on-surface-variant" : "opacity-90"}`}>Print or Save Receipt (PDF)</span>
          </button>
          <div className="pt-1 text-center">
            <Link to="/status" className="mr-4 inline-block py-1 text-[14px] font-medium text-on-surface-variant underline hover:text-on-primary-fixed-variant">નોંધણી સ્થિતિ / Check Status</Link>
            <Link to="/" className="inline-block py-1 text-[14px] font-medium text-on-surface-variant underline hover:text-on-primary-fixed-variant">મુખ્ય પૃષ્ઠ પર પાછા જાઓ / Back to Home</Link>
          </div>
        </div>

        {contacts[0] && (
          <p className="text-center text-[12px] text-on-surface-variant">
            સહાયતા નંબર: <a className="font-semibold" href={telHref(contacts[0].phone)}>{contacts[0].phone}</a> ({contacts[0].name})
          </p>
        )}
      </div>
    </div>
  );
}

const maskMobile = (m = "") => `${m.slice(0, 2)}XXXXXX${m.slice(-2)}`;

function WhatsAppLogo() {
  return (
    <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
    </svg>
  );
}

function Row({ gu, en, children }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="flex shrink-0 flex-col">
        <span className="text-[15px] font-semibold leading-tight">{gu}</span>
        <span className="text-[12px] text-on-surface-variant">{en}</span>
      </div>
      {children}
    </div>
  );
}


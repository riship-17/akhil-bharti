import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CADRES, DESIGNATIONS, DISTRICTS, EVENT, FEE, UNIVERSITIES, labelOf, rupees, universityText } from "../../../shared/constants.js";
import {
  DETAIL_FIELDS, MAX_PDF_BYTES, MAX_RECEIPT_BYTES, RECEIPT_TYPES,
  cleanDetails, cleanDonation, validateDetails, validateDonation,
} from "../../../shared/validate.js";
import { store, upload } from "../api.js";
import { useAuth } from "../auth.js";
import { useConfig } from "../config.js";
import { shrinkImage } from "../image.js";
import PaymentPanel from "../components/PaymentPanel.jsx";
import {
  Banner, Field, Icon, inputClass, primaryButton, secondaryButton, telHref, textareaBoxClass,
} from "../components/ui.jsx";

// Unfinished form, saved per account so people sharing a phone don't see each other's details.
const draftKey = (email) => `abrsm26-draft:${email || ""}`;
const EMPTY = Object.fromEntries(DETAIL_FIELDS.map((k) => [k, ""]));

const STEPS = [
  { en: "Personal Details", fields: ["email", "fullName", "cadre", "district", "mobile", "altContact"] },
  { en: "Professional Details", fields: ["designation", "designationOther", "university", "universityOther", "department", "fieldOfStudy", "institution", "orgResponsibility", "residentialAddress"] },
  { en: "Review & Pay", fields: [] },
];
const stepOf = (field) => STEPS.findIndex((s) => s.fields.includes(field));

const CADRE_ICONS = { college: "school", university: "account_balance" };
const SAHAY_PRESETS = [500, 1100, 2100, 5100];
const designationLabel = (d) => (d.designation === "other" ? d.designationOther : labelOf(DESIGNATIONS, d.designation));

export default function Register() {
  const config = useConfig();
  const { user, me, token, refresh } = useAuth();
  const DRAFT_KEY = draftKey(user?.email);
  const [step, setStep] = useState(0);
  // Name, email and mobile start from the account; the email always stays the account's email.
  const [form, setForm] = useState(() => ({
    ...EMPTY,
    fullName: user?.name || "",
    mobile: user?.mobile || "",
    ...(store.get(DRAFT_KEY) || {}),
    email: user?.email || "",
  }));
  const [donation, setDonation] = useState("");
  const [file, setFile] = useState(null);
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState("");
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const scrollToError = useRef(false);

  useEffect(() => { store.set(DRAFT_KEY, form); }, [form]);
  useEffect(() => { if (user?.email) setForm((f) => (f.email === user.email ? f : { ...f, email: user.email })); }, [user?.email]);

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

  async function pickFile(f) {
    if (!f) return;
    const isPdf = f.type === "application/pdf";
    if (!RECEIPT_TYPES.includes(f.type)) return setErrors((x) => ({ ...x, receipt: "Upload the screenshot as an image (JPG / PNG)." }));
    if (f.size > (isPdf ? MAX_PDF_BYTES : MAX_RECEIPT_BYTES)) {
      return setErrors((x) => ({ ...x, receipt: isPdf ? "PDF is too large (max 2 MB). Upload a screenshot instead." : "File is too large. Maximum size is 10 MB." }));
    }
    setErrors(({ receipt, ...rest }) => rest);
    setFile(await shrinkImage(f));
  }

  function handleError(err) {
    const steps = Object.keys(err.fields).map(stepOf).filter((i) => i >= 0);
    if (steps.length) setStep(Math.min(...steps));
    showErrors(err.fields, err.message);
  }

  function finish(res) {
    store.remove(DRAFT_KEY);
    setResult({ ...res, details: cleanDetails(form) });
    setStep("done");
    refresh().catch(() => {});
  }

  async function submitUpi(e) {
    e.preventDefault();
    const errs = {};
    const donationErr = validateDonation(cleanDonation(donation));
    if (donationErr) errs.donation = donationErr;
    if (!file) errs.receipt = "Upload the payment screenshot or receipt.";
    if (!agreed) errs.agree = "Please confirm that your details are correct.";
    if (Object.keys(errs).length) return showErrors(errs);

    const data = new FormData();
    Object.entries(cleanDetails(form)).forEach(([k, v]) => data.append(k, v));
    data.append("donation", String(cleanDonation(donation)));
    data.append("receipt", file);

    setBanner("");
    setProgress(0);
    try {
      finish(await upload("/register", data, { token, onProgress: setProgress }));
    } catch (err) {
      handleError(err);
    } finally {
      setProgress(null);
    }
  }

  if (config && config.registrationOpen === false && step !== "done") {
    return (
      <section className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-3xl font-semibold">Registration closed</h1>
        <p className="mt-3 text-on-surface-variant">Online registration for the State Conference 2026 is now closed. Please contact the organising team for any queries.</p>
        <Link to="/" className={`${secondaryButton} mt-6`}>Back to home</Link>
      </section>
    );
  }

  if (step === "done") return <Success result={result} contacts={config?.contacts || []} />;

  // One registration per account: an active one is shown in "My registration" instead.
  const active = me?.registration && me.registration.status !== "rejected" ? me.registration : null;
  if (active) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-3xl font-semibold">You are already registered <span className="block text-lg font-normal text-on-surface-variant">Registration No. {active.regNo}</span></h1>
        <p className="mt-3 text-on-surface-variant">Open “My registration” to see whether your payment has been verified and to view your Bhojan Pass.</p>
        <Link to="/account" className={`${primaryButton} mt-6`}>My registration</Link>
      </section>
    );
  }

  const submitting = progress !== null;
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
                <Link to="/" aria-label="Go back" className="flex h-12 w-12 items-center justify-center rounded-xl transition-colors hover:bg-surface-container-high">
                  <Icon name="arrow_back" className="text-[26px]" />
                </Link>
              ) : (
                <button type="button" onClick={back} disabled={submitting} aria-label="Go back" className="flex h-12 w-12 items-center justify-center rounded-xl transition-colors hover:bg-surface-container-high disabled:opacity-40">
                  <Icon name="arrow_back" className="text-[26px]" />
                </button>
              )}
              <div>
                <h1 className="text-2xl font-semibold leading-snug tracking-tight">Delegate Registration</h1>
                <span className="block text-[15px] text-on-surface-variant">{EVENT.titleEn}</span>
              </div>
            </header>

            <Progress step={step} />

            <form onSubmit={step < 2 ? next : submitUpi} noValidate className="flex flex-col">
              <div className="space-y-6 p-5 sm:p-7">
                {banner && <Banner>{banner}</Banner>}
                {step === 0 && <PersonalStep form={form} set={set} errors={errors} />}
                {step === 1 && <ProfessionalStep form={form} set={set} errors={errors} />}
                {step === 2 && (
                  <ReviewStep
                    d={d}
                    goTo={setStep}
                    locked={submitting}
                    agreed={agreed}
                    setAgreed={(v) => { setAgreed(v); if (errors.agree) setErrors(({ agree, ...r }) => r); }}
                    errors={errors}
                    upi={<UpiProof donation={donation} setDonation={(v) => { setDonation(v); if (errors.donation) setErrors(({ donation, ...r }) => r); }} file={file} pickFile={pickFile} clearFile={() => setFile(null)} errors={errors} disabled={submitting} />}
                  />
                )}
              </div>

              <footer className="sticky bottom-0 mt-2 bg-surface-container-lowest p-5 shadow-[0_-4px_16px_rgba(0,0,0,0.04)] sm:p-7">
                {step === 0 && (
                  <>
                    <button type="submit" className={`${primaryButton} w-full`}>
                      <span>Continue</span>
                      <Icon name="arrow_forward" className="text-[20px]" />
                    </button>
                    <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-sm text-on-surface-variant">
                      <Icon name="save" className="text-[16px] text-tertiary" />
                      Your answers are saved on this device until you submit
                    </p>
                  </>
                )}
                {step === 1 && (
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={back} className="flex h-14 w-[35%] items-center justify-center rounded-xl bg-surface-container-lowest font-bold ring-2 ring-inset ring-outline-variant transition-colors hover:bg-surface-container-low">
                      Back
                    </button>
                    <button type="submit" className="flex h-14 w-[65%] items-center justify-center gap-2 rounded-xl bg-primary font-bold text-on-primary shadow-md transition-colors hover:bg-on-primary-fixed-variant active:scale-[0.99]">
                      Continue <Icon name="arrow_forward" className="text-[18px]" />
                    </button>
                  </div>
                )}
                {step === 2 && (
                  <button type="submit" disabled={submitting} className={`${primaryButton} w-full`}>
                    {submitting
                      ? progress < 1 ? `Uploading… ${Math.round(progress * 100)}%` : "Saving…"
                      : "Submit registration"}
                  </button>
                )}
              </footer>
            </form>
          </div>
        </section>
      </div>
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
          Step {step + 1} of 3 · {s.en}
        </span>
        <span className="shrink-0 text-sm font-medium text-on-surface-variant">{Math.round(((step + 1) / 3) * 100)}% complete</span>
      </div>
    </div>
  );
}

// ---------- Step 1 ----------

function PersonalStep({ form, set, errors }) {
  return (
    <>
      <Field id="email" label="Email address" required error={errors.email}
        hint="Your account email. The Bhojan Pass is sent here." hintIcon="lock">
        <input id="email" type="email" value={form.email} readOnly aria-readonly="true" className={`${inputClass(errors.email)} cursor-not-allowed bg-surface-container text-on-surface-variant`} />
      </Field>

      <Field id="fullName" label="Full name (Title – First name – Middle name – Surname)" required error={errors.fullName}
        hint="e.g. Dr. Vinodbhai Kantilal Patel">
        <input id="fullName" autoComplete="name" value={form.fullName} onChange={set("fullName")} placeholder="Enter your full name" aria-invalid={!!errors.fullName} className={inputClass(errors.fullName)} />
      </Field>

      <Field labelId="cadre-label" label="Cadre / Category" required error={errors.cadre}>
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
                <span className="block text-xl font-semibold leading-snug">{c.en}</span>
              </label>
            );
          })}
        </div>
      </Field>

      <DistrictPicker value={form.district} onChange={set("district")} error={errors.district} />

      <Field id="mobile" label="Mobile number" required error={errors.mobile}
        hint="The organisers will call you on this number if needed" hintIcon="call">
        <div className={`flex items-stretch overflow-hidden rounded-xl shadow-sm ${errors.mobile ? "ring-2 ring-error" : "ring-[1.5px] ring-inset ring-outline-variant focus-within:ring-2 focus-within:ring-primary"}`}>
          <div className="flex select-none items-center bg-surface-container px-4 font-semibold">+91</div>
          <input id="mobile" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={14} value={form.mobile} onChange={set("mobile")} placeholder="98250 XXXXX" aria-invalid={!!errors.mobile} className="h-14 min-w-0 flex-1 bg-surface-container-lowest px-4" />
        </div>
      </Field>

      <Field id="altContact" label="Alternative contact number" optional error={errors.altContact}>
        <input id="altContact" type="tel" inputMode="tel" value={form.altContact} onChange={set("altContact")} placeholder="Landline or alternate mobile" className={inputClass(errors.altContact)} />
      </Field>
    </>
  );
}

function DistrictPicker({ value, onChange, error }) {
  return (
    <Picker id="district" label="District" icon="location_on" options={DISTRICTS} value={value} onChange={onChange} error={error}
      placeholder="Select district" title="Select district in Gujarat" searchLabel="Search district" searchPlaceholder="Search district name…" />
  );
}

// A button that opens a searchable list, for long option lists.
function Picker({ id, label, icon, options, value, onChange, error, placeholder, title, searchLabel, searchPlaceholder }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const selected = options.find((x) => x.value === value);
  const query = q.trim().toLowerCase();
  const list = query ? options.filter((x) => x.en.toLowerCase().includes(query)) : options;

  function pick(v) {
    onChange(v);
    setOpen(false);
    setQ("");
    document.getElementById(id)?.focus();
  }

  return (
    <Field id={id} label={label} required error={error}>
      <button
        id={id} type="button" aria-expanded={open} aria-controls={`${id}-sheet`} onClick={() => setOpen((v) => !v)}
        className={`flex h-14 w-full items-center justify-between rounded-xl px-4 text-left shadow-sm ${error ? "bg-error-container/20 ring-2 ring-error" : "bg-surface-container-lowest ring-[1.5px] ring-inset ring-outline-variant focus-visible:ring-2 focus-visible:ring-primary"}`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Icon name={icon} className="shrink-0 text-[22px] text-primary" />
          {selected ? (
            <span className="truncate text-xl font-semibold text-primary">{selected.en}</span>
          ) : (
            <span className="text-on-surface-variant">{placeholder}</span>
          )}
        </span>
        <Icon name={open ? "expand_less" : "expand_more"} className="text-[24px] text-on-surface-variant" />
      </button>

      {open && (
        <div
          id={`${id}-sheet`}
          onKeyDown={(e) => { if (e.key === "Escape") { setOpen(false); document.getElementById(id)?.focus(); } }}
          className="mt-2 w-full overflow-hidden rounded-2xl border-[1.5px] border-outline-variant bg-surface-container-lowest p-4 shadow-[0_12px_32px_rgba(90,65,56,0.15)]"
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xl font-semibold">{title}</p>
            <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-container hover:bg-surface-container-high">
              <Icon name="close" className="text-[20px]" />
            </button>
          </div>
          <div className="relative mb-3 flex items-center">
            <Icon name="search" className="absolute left-3.5 text-[20px] text-on-surface-variant" />
            <input
              autoFocus type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchPlaceholder} aria-label={searchLabel}
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
                    <span className={`font-semibold ${on ? "text-primary" : ""}`}>{x.en}</span>
                    {on && <Icon name="check_circle" className="text-[20px] text-primary" />}
                  </button>
                </li>
              );
            })}
            {list.length === 0 && <li className="px-3.5 py-2.5 text-on-surface-variant">Nothing matches “{q}”.</li>}
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
        <p className="text-[13px] font-semibold leading-snug">Your designation and institution</p>
      </div>

      <Field labelId="designation-label" label="Designation in institution" required error={errors.designation || errors.designationOther}>
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
                  <span className={`flex-1 text-[15px] font-semibold leading-tight ${on ? "text-primary" : ""}`}>{o.en}</span>
                </label>
                {on && o.value === "other" && (
                  <div className="mt-3 pl-8 pr-1">
                    <label htmlFor="designationOther" className="mb-1.5 block text-xs font-semibold">
                      Please specify your designation <span className="text-error">*</span>
                    </label>
                    <input id="designationOther" autoFocus value={form.designationOther} onChange={set("designationOther")} placeholder="e.g. Research Officer, Lecturer…" className={inputClass(errors.designationOther)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Field>

      <Picker id="university" label="University" icon="account_balance" options={UNIVERSITIES} value={form.university} onChange={set("university")}
        error={errors.university} placeholder="Select your university" title="Select your university" searchLabel="Search university"
        searchPlaceholder="Search university name…" />
      {form.university === "other" && (
        <Field id="universityOther" label="Name of your university" required error={errors.universityOther}>
          <input id="universityOther" autoFocus value={form.universityOther} onChange={set("universityOther")} placeholder="University name and city" className={inputClass(errors.universityOther)} />
        </Field>
      )}

      <Field id="department" label="College / Department" required error={errors.department}
        hint="Your college name, or your department if you are in the university cadre">
        <input id="department" value={form.department} onChange={set("department")} placeholder="e.g. Govt. Arts College, Gandhinagar / Department of Physics" className={inputClass(errors.department)} />
      </Field>

      <Field id="fieldOfStudy" label="Field of study / specialization" required error={errors.fieldOfStudy}
        hint="Main subject or discipline (e.g. Sanskrit, Physics, Economics)">
        <div className="relative">
          <input id="fieldOfStudy" value={form.fieldOfStudy} onChange={set("fieldOfStudy")} placeholder="Chemistry, English, Commerce…" className={`${inputClass(errors.fieldOfStudy)} pr-11`} />
          <Icon name="menu_book" className="pointer-events-none absolute right-3.5 top-4 text-[20px] text-outline" />
        </div>
      </Field>

      <Field id="institution" label="Full address of college / department" required error={errors.institution}>
        <div className={textareaBoxClass(errors.institution)}>
          <textarea id="institution" rows={4} maxLength={500} value={form.institution} onChange={set("institution")} placeholder="Campus, area, city and PIN code…" className="w-full resize-none bg-transparent p-3.5 leading-relaxed" />
          <Counter value={form.institution} note="Area, city and PIN code" />
        </div>
      </Field>

      <Field id="orgResponsibility" label="Organizational responsibility" optional error={errors.orgResponsibility}
        hint="ABRSM unit or state-level responsibility (e.g. executive member, convener)">
        <input id="orgResponsibility" value={form.orgResponsibility} onChange={set("orgResponsibility")} placeholder="Your role in ABRSM, if any" className={inputClass(errors.orgResponsibility)} />
      </Field>

      <Field id="residentialAddress" label="Residential address" required error={errors.residentialAddress}
        hint="Write the house number, society, taluka, district and PIN code accurately.">
        <div className={textareaBoxClass(errors.residentialAddress)}>
          <textarea id="residentialAddress" rows={4} maxLength={500} autoComplete="street-address" value={form.residentialAddress} onChange={set("residentialAddress")} placeholder="House no., society, taluka, district and PIN code" className="w-full resize-none bg-transparent p-3.5 leading-relaxed" />
          <Counter value={form.residentialAddress} />
        </div>
      </Field>
    </>
  );
}

// ---------- Step 3 ----------

function ReviewSection({ dot, label, onEdit, locked, children }) {
  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between border-b border-primary-fixed pb-3">
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${dot}`} />
          <h2 className="text-sm font-bold">{label}</h2>
        </div>
        <button type="button" onClick={onEdit} disabled={locked} className="inline-flex items-center gap-1 rounded-lg bg-primary-fixed/40 px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary-fixed disabled:opacity-40">
          <Icon name="edit" className="text-[14px]" />
          Edit
        </button>
      </div>
      <dl className="space-y-2.5 text-xs">{children}</dl>
    </div>
  );
}

function Item({ label, children, className = "" }) {
  return (
    <div className={className}>
      <dt className="text-[11px] text-on-surface-variant">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-bold leading-snug">{children}</dd>
    </div>
  );
}

function ReviewStep({ d, goTo, locked, agreed, setAgreed, errors, upi }) {
  const district = DISTRICTS.find((x) => x.value === d.district);
  const designation = DESIGNATIONS.find((x) => x.value === d.designation);
  const rule = "border-t border-dashed border-surface-variant pt-1";
  return (
    <>
      <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-950">
        <Icon name="info" className="mt-0.5 text-[20px] text-amber-700" />
        <p className="font-semibold">Please check your details carefully before paying and submitting.</p>
      </div>

      <div className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm ring-1 ring-inset ring-outline-variant">
        <ReviewSection dot="bg-primary" label="Personal Details" onEdit={() => goTo(0)} locked={locked}>
          <Item label="Full Name">{d.fullName}</Item>
          <div className={`grid grid-cols-2 gap-2 ${rule}`}>
            <Item label="Cadre">{labelOf(CADRES, d.cadre)}</Item>
            <Item label="District">{district?.en || d.district}</Item>
          </div>
          <Item className={rule} label="Email Address">{d.email}</Item>
          <Item className={rule} label="Mobile Number">+91 {d.mobile.replace(/(\d{5})(\d{5})/, "$1 $2")}</Item>
          {d.altContact && <Item className={rule} label="Alternative Contact">{d.altContact}</Item>}
        </ReviewSection>
        <div className="border-t border-outline-variant" />
        <ReviewSection dot="bg-secondary" label="Professional Details" onEdit={() => goTo(1)} locked={locked}>
          <div className="grid grid-cols-2 gap-2">
            <Item label="Designation">{d.designation === "other" ? d.designationOther : designation?.en}</Item>
            <Item label="Subject">{d.fieldOfStudy}</Item>
          </div>
          <Item className={rule} label="University">{universityText(d)}</Item>
          <Item className={rule} label="College / Department">{d.department}</Item>
          <Item className={rule} label="Institution Address">{d.institution}</Item>
          {d.orgResponsibility && <Item className={rule} label="Org Role">{d.orgResponsibility}</Item>}
          <Item className={rule} label="Residential Address">{d.residentialAddress}</Item>
        </ReviewSection>
      </div>

      {upi}

      <div data-error={errors.agree ? "" : undefined}>
        <label className={`flex cursor-pointer select-none items-start gap-3 rounded-xl bg-surface-container-lowest p-3.5 shadow-sm transition-colors ${errors.agree ? "ring-2 ring-error" : "ring-1 ring-inset ring-outline-variant hover:ring-primary"}`}>
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} disabled={locked} className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-primary" />
          <span className="text-xs leading-relaxed">
            <span className="block text-[13px] font-semibold">I confirm all details provided above are true, accurate and correct.</span>
          </span>
        </label>
        {errors.agree && <p className="mt-2 flex items-center gap-1.5 text-[15px] font-semibold text-error" role="alert"><Icon name="cancel" className="text-[18px]" />{errors.agree}</p>}
      </div>
    </>
  );
}

// Optional Sahay Shulk, then pay fee + Sahay Shulk by UPI QR and upload the screenshot.
function UpiProof({ donation, setDonation, file, pickFile, clearFile, errors, disabled }) {
  const amount = cleanDonation(donation);
  const error = errors.donation || validateDonation(amount);
  return (
    <>
      <SahayShulk value={donation} onChange={setDonation} error={error} disabled={disabled} />
      <PaymentPanel donation={error ? 0 : amount} />
      <Field label="Upload the payment screenshot" required error={errors.receipt}
        hint="Screenshot of the successful payment, showing the amount. It is compressed automatically before upload.">
        <FilePicker file={file} onPick={pickFile} onClear={clearFile} disabled={disabled} />
      </Field>
    </>
  );
}

function SahayShulk({ value, onChange, error, disabled }) {
  const amount = cleanDonation(value);
  return (
    <Field id="donation" label="Sahay Shulk (helping fund)" optional error={error}
      sub={`Add a contribution on top of the ${rupees(FEE)} Bhojan Pass fee. It is paid in the same UPI payment.`}
      hint={amount ? `You will pay ${rupees(FEE + amount)}: ${rupees(FEE)} Bhojan Pass fee + ${rupees(amount)} Sahay Shulk.` : "Leave blank to pay only the Bhojan Pass fee."}>
      <div className="mb-3 flex flex-wrap gap-2">
        {SAHAY_PRESETS.map((p) => {
          const on = amount === p;
          return (
            <button key={p} type="button" aria-pressed={on} disabled={disabled} onClick={() => onChange(on ? "" : String(p))}
              className={`rounded-lg px-3.5 py-2 text-[15px] font-semibold transition-colors disabled:opacity-40 ${on ? "bg-primary text-on-primary" : "bg-surface-container-low ring-[1.5px] ring-inset ring-outline-variant hover:bg-surface-container"}`}>
              {rupees(p)}
            </button>
          );
        })}
      </div>
      <div className={`flex items-stretch overflow-hidden rounded-xl shadow-sm ${error ? "ring-2 ring-error" : "ring-[1.5px] ring-inset ring-outline-variant focus-within:ring-2 focus-within:ring-primary"}`}>
        <div className="flex select-none items-center bg-surface-container px-4 font-semibold">₹</div>
        <input id="donation" inputMode="numeric" autoComplete="off" maxLength={6} disabled={disabled} value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))} placeholder="Other amount" aria-invalid={!!error}
          className="h-14 min-w-0 flex-1 bg-surface-container-lowest px-4" />
      </div>
    </Field>
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
          <span className="text-sm text-on-surface-variant">{file.size < 1024 * 1024 ? `${Math.round(file.size / 1024)} KB` : `${(file.size / 1024 / 1024).toFixed(1)} MB`}</span>
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
      <b className="mt-1 block text-primary">Upload screenshot</b>
      <span className="text-sm text-on-surface-variant">Tap to choose the screenshot, or drag it here</span>
    </label>
  );
}

// ---------- Side panel ----------

function BadgePreview({ form, contacts }) {
  const d = cleanDetails(form);
  const initials = d.fullName.replace(/^(dr\.?|prof\.?)\s*/i, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("") || "?";
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
            <span className="block text-xl font-semibold">Delegate preview</span>
          </div>
          <span className="rounded-full bg-surface-container px-2.5 py-1 text-[15px] font-semibold text-primary">2026</span>
        </div>

        <div className="mb-5 flex items-center gap-4 rounded-lg bg-surface-container-low p-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-primary-fixed text-xl font-bold text-primary shadow-sm">{initials}</div>
          <div className="min-w-0 flex-1">
            <span className="block truncate text-xl font-semibold">{d.fullName || "Your name"}</span>
            <span className="block truncate text-[15px] text-on-surface-variant">{designationLabel(d) || "Designation"}{d.district && ` · ${d.district}`}</span>
            {cadre && (
              <span className="mt-1 inline-flex items-center gap-1 text-[15px] text-tertiary">
                <Icon name="verified" className="text-[16px]" />{cadre.en}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-3 text-[15px] text-on-surface-variant">
          <p className="flex items-start gap-2.5"><Icon name="payments" className="mt-0.5 shrink-0 text-[20px] text-primary" />₹500 Bhojan Pass fee, plus an optional Sahay Shulk, paid at the end of the form.</p>
          <p className="flex items-start gap-2.5"><Icon name="confirmation_number" className="mt-0.5 shrink-0 text-[20px] text-tertiary" />You get your registration number as soon as you submit.</p>
          <p className="flex items-start gap-2.5"><Icon name="badge" className="mt-0.5 shrink-0 text-[20px] text-secondary" />Keep the number with you on the day.</p>
        </div>

        {contacts[0] && (
          <div className="mt-6 flex items-center justify-between pt-4">
            <span className="text-[15px] text-on-surface-variant">Helpline:</span>
            <a href={telHref(contacts[0].phone)} className="font-semibold text-primary">{contacts[0].phone}</a>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 rounded-xl bg-surface-container-low p-5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-container text-secondary">
          <Icon name="pin_drop" className="text-[26px]" />
        </div>
        <div>
          <span className="block font-semibold">Gujarat University Convention Centre, Ahmedabad</span>
          <span className="block text-[15px] text-on-surface-variant">{EVENT.dateEn}</span>
        </div>
      </div>
    </aside>
  );
}

// ---------- Processing & success ----------

function Success({ result, contacts }) {
  const [copied, setCopied] = useState(false);
  const d = result?.details || {};
  const district = DISTRICTS.find((x) => x.value === d.district);

  function copy() {
    navigator.clipboard?.writeText(result.regNo).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="mx-auto w-full max-w-[560px] pb-6 print:max-w-none">
      <section className="border-b border-outline-variant/40 bg-gradient-to-b from-[#fcecd8] via-[#fdf2e4] to-surface px-4 pb-12 pt-8 text-center sm:rounded-b-3xl">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-primary-fixed/60 shadow-md">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-white shadow-sm">
            <Icon name="hourglass_top" className="text-[40px]" />
          </div>
        </div>
        <div className="mt-4 space-y-1">
          <h1 className="text-[23px] font-bold leading-tight tracking-tight text-on-primary-fixed-variant">
            Registration Received
          </h1>
          <p className="px-1 pt-1 text-[15px] text-on-surface-variant">The organising team will verify your payment, then send your Bhojan Pass by email. It will also appear under “My registration”.</p>
        </div>
      </section>

      <div className="-mt-8 space-y-4 px-4">
        <div className="relative z-10 rounded-xl border border-outline-variant bg-white p-4 shadow-md">
          <div className="flex items-center justify-between gap-2 border-b border-outline-variant/80 pb-3">
            <span className="text-[15px] font-semibold leading-tight">Receipt &amp; Participant Details</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800">
              <Icon name="schedule" className="text-[14px]" />PENDING
            </span>
          </div>

          <div className="divide-y divide-outline-variant/60 pt-1">
            <Row label="Registration No.">
              <div className="flex items-center gap-1.5 rounded-lg border border-outline-variant bg-surface px-2.5 py-1">
                <span className="font-mono text-[15px] font-bold tracking-wide text-on-primary-fixed-variant">{result?.regNo}</span>
                <button type="button" onClick={copy} className="p-1 text-on-surface-variant hover:text-primary print:hidden" aria-label="Copy registration number">
                  <Icon name={copied ? "check" : "content_copy"} className="text-[16px]" />
                </button>
              </div>
            </Row>
            <Row label="Name">
              <div className="text-right">
                <span className="block text-[15px] font-bold">{result?.fullName}</span>
                <span className="text-[12px] text-on-surface-variant">{[designationLabel(d), d.fieldOfStudy].filter(Boolean).join(", ")}</span>
              </div>
            </Row>
            {district && <Row label="District"><span className="text-[15px] font-bold">{district.en}</span></Row>}
            <Row label="Bhojan Pass fee"><span className="text-[15px] font-bold">{rupees(FEE)}</span></Row>
            {result?.donation > 0 && (
              <Row label="Sahay Shulk (helping fund)"><span className="text-[15px] font-bold">{rupees(result.donation)}</span></Row>
            )}
            <div className="-mx-4 mt-1 flex items-center justify-between rounded-b-xl border-t border-outline-variant/70 bg-surface/50 px-4 pb-1 pt-3">
              <span className="text-[15px] font-semibold leading-tight text-on-primary-fixed-variant">Total paid</span>
              <span className="text-[18px] font-bold text-on-primary-fixed-variant">{rupees(result?.amount ?? FEE)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-outline-variant bg-white p-3.5 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-[14px] font-semibold text-on-primary-fixed-variant">
            <Icon name="info" className="text-[18px] text-primary" />
            <span>Event Information</span>
          </div>
          <ul className="list-inside list-disc space-y-1.5 text-[13px] text-on-surface-variant">
            <li><span className="font-medium text-on-surface">Date:</span> {EVENT.dateEn}</li>
            <li><span className="font-medium text-on-surface">Venue:</span> {EVENT.venueEn}</li>
            <li>Please keep this registration number with you on the day.</li>
          </ul>
        </div>

        <div className="space-y-3 pt-2 print:hidden">
          <Link to="/account" className={`${primaryButton} w-full`}>Go to My registration</Link>
          <button type="button" onClick={() => window.print()} className="flex h-14 w-full items-center justify-center rounded-xl border-2 border-on-primary-fixed-variant bg-white font-bold text-on-primary-fixed-variant shadow-sm transition-colors hover:bg-surface">
            Print or Save Receipt (PDF)
          </button>
          <div className="pt-1 text-center">
            <Link to="/" className="inline-block py-1 text-[14px] font-medium text-on-surface-variant underline hover:text-on-primary-fixed-variant">Back to Home</Link>
          </div>
        </div>

        {contacts[0] && (
          <p className="text-center text-[12px] text-on-surface-variant">
            Helpline: <a className="font-semibold" href={telHref(contacts[0].phone)}>{contacts[0].phone}</a> ({contacts[0].name})
          </p>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="shrink-0 text-[15px] font-semibold leading-tight">{label}</span>
      {children}
    </div>
  );
}


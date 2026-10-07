import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CADRES, DESIGNATIONS, DISTRICTS, EVENT } from "../../../shared/constants.js";
import {
  DETAIL_FIELDS, MAX_RECEIPT_BYTES, RECEIPT_TYPES,
  cleanDetails, cleanUtr, validateDetails, validateUtr,
} from "../../../shared/validate.js";
import { store, upload } from "../api.js";
import { useConfig } from "../config.js";
import Field, { Choice } from "../components/Field.jsx";
import PaymentPanel from "../components/PaymentPanel.jsx";
import { Arrow } from "./Home.jsx";

const DRAFT_KEY = "abrsm26-draft";
const EMPTY = Object.fromEntries(DETAIL_FIELDS.map((k) => [k, ""]));

export default function Register() {
  const config = useConfig();
  const [step, setStep] = useState("details");
  const [form, setForm] = useState(() => ({ ...EMPTY, ...(store.get(DRAFT_KEY) || {}) }));
  const [utr, setUtr] = useState("");
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState("");
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const scrollToError = useRef(false);

  useEffect(() => { store.set(DRAFT_KEY, form); }, [form]);

  useEffect(() => { window.scrollTo({ top: 0 }); }, [step]);

  useEffect(() => {
    if (!scrollToError.current) return;
    scrollToError.current = false;
    const el = document.querySelector(".has-error, .banner");
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.querySelector("input, select, textarea")?.focus({ preventScroll: true });
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

  function continueToPayment(e) {
    e.preventDefault();
    const errs = validateDetails(cleanDetails(form));
    if (Object.keys(errs).length) return showErrors(errs);
    setErrors({});
    setBanner("");
    setStep("payment");
  }

  function pickFile(f) {
    if (!f) return;
    if (!RECEIPT_TYPES.includes(f.type)) return setErrors((x) => ({ ...x, receipt: "Upload an image (JPG / PNG) or a PDF file." }));
    if (f.size > MAX_RECEIPT_BYTES) return setErrors((x) => ({ ...x, receipt: "File is too large. Maximum size is 10 MB." }));
    setFile(f);
    setErrors(({ receipt, ...rest }) => rest);
  }

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    const utrErr = validateUtr(cleanUtr(utr));
    if (utrErr) errs.utr = utrErr;
    if (!file) errs.receipt = "Upload the payment screenshot or receipt.";
    if (Object.keys(errs).length) return showErrors(errs);

    const data = new FormData();
    Object.entries(cleanDetails(form)).forEach(([k, v]) => data.append(k, v));
    data.append("utr", cleanUtr(utr));
    data.append("receipt", file);

    setBanner("");
    setProgress(0);
    try {
      const res = await upload("/register", data, { onProgress: setProgress });
      store.remove(DRAFT_KEY);
      setResult(res);
      setStep("done");
    } catch (err) {
      const backToDetails = Object.keys(err.fields).some((k) => DETAIL_FIELDS.includes(k));
      if (backToDetails) setStep("details");
      showErrors(err.fields, err.message);
    } finally {
      setProgress(null);
    }
  }

  if (config && config.registrationOpen === false && step !== "done") {
    return (
      <section className="page wrap narrow">
        <h1 className="page-title">Registration closed</h1>
        <p className="muted">Online registration for the State Conference 2026 is now closed. Please contact the organising team for any queries.</p>
        <Link to="/" className="btn ghost">Back to home</Link>
      </section>
    );
  }

  if (step === "done") return <Success result={result} />;

  const submitting = progress !== null;

  return (
    <section className="page wrap narrow">
      <Stepper step={step} />

      {banner && <div className="banner" role="alert">{banner}</div>}

      {step === "details" ? (
        <form onSubmit={continueToPayment} noValidate>
          <h2 className="section-tag">વિભાગ ૧: અધ્યાપકશ્રીની વિગતો <span>Section 1 · Participant details</span></h2>

          <Field n="૧" gu="ઈમેલ એડ્રેસ" en="Email address" required error={errors.email} id="email">
            <input id="email" type="email" inputMode="email" autoComplete="email" value={form.email} onChange={set("email")} placeholder="professor.name@university.ac.in" />
          </Field>

          <Field n="૨" gu="પૂરું નામ" en="Full name (Title – First name – Middle name – Surname)" required error={errors.fullName} id="fullName">
            <input id="fullName" autoComplete="name" value={form.fullName} onChange={set("fullName")} placeholder="ડૉ. વિનોદભાઈ કાંતિલાલ પટેલ / Prof. Vinodkumar K. Patel" />
          </Field>

          <Field n="૩" gu="સંવર્ગ" en="Cadre / Category" required error={errors.cadre}>
            <Choice name="cadre" options={CADRES} value={form.cadre} onChange={set("cadre")} />
          </Field>

          <Field n="૪" gu="જિલ્લો" en="District" required error={errors.district} id="district">
            <select id="district" value={form.district} onChange={set("district")}>
              <option value="">જિલ્લો પસંદ કરો / Select district</option>
              {DISTRICTS.map((d) => (
                <option key={d.value} value={d.value}>{d.gu} ({d.en})</option>
              ))}
            </select>
          </Field>

          <Field n="૫" gu="સંસ્થા / કૉલેજ / યુનિવર્સિટીનું પૂરું નામ અને સરનામું" en="Name & full address of institution / college / university" required error={errors.institution} id="institution">
            <textarea id="institution" rows={3} value={form.institution} onChange={set("institution")} placeholder="સંસ્થાનું નામ, વિભાગ, શહેર અને પીનકોડ" />
          </Field>

          <Field n="૬" gu="સંસ્થામાં હોદ્દો" en="Designation in institution" required error={errors.designation || errors.designationOther}>
            <Choice name="designation" options={DESIGNATIONS} value={form.designation} onChange={set("designation")} columns={3} />
            {form.designation === "other" && (
              <input className="mt" aria-label="Other designation" value={form.designationOther} onChange={set("designationOther")} placeholder="તમારો હોદ્દો લખો / Write your designation" autoFocus />
            )}
          </Field>

          <div className="pair">
            <Field n="૭" gu="અધ્યયન / વિષય / ક્ષેત્ર" en="Field of study / specialization" required error={errors.fieldOfStudy} id="fieldOfStudy">
              <input id="fieldOfStudy" value={form.fieldOfStudy} onChange={set("fieldOfStudy")} placeholder="e.g. રસાયણશાસ્ત્ર, અંગ્રેજી, વાણિજ્ય" />
            </Field>
            <Field n="૮" gu="સંગઠનાત્મક જવાબદારી" en="Organizational responsibility" error={errors.orgResponsibility} id="orgResponsibility">
              <input id="orgResponsibility" value={form.orgResponsibility} onChange={set("orgResponsibility")} placeholder="ABRSM માં હોદ્દો (જો લાગુ પડતું હોય તો)" />
            </Field>
          </div>

          <Field n="૯" gu="કાયમી / હાલનું નિવાસસ્થાનનું સરનામું" en="Residential address" required error={errors.residentialAddress} id="residentialAddress">
            <textarea id="residentialAddress" rows={3} autoComplete="street-address" value={form.residentialAddress} onChange={set("residentialAddress")} placeholder="ઘર નંબર, સોસાયટી / વિસ્તાર, તાલુકો, જિલ્લો અને પીનકોડ" />
          </Field>

          <div className="pair">
            <Field n="૧૦" gu="વોટ્સએપ / મોબાઈલ નંબર" en="WhatsApp & mobile no." required error={errors.mobile} id="mobile">
              <div className="prefixed">
                <span>+91</span>
                <input id="mobile" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={14} value={form.mobile} onChange={set("mobile")} placeholder="98XXXXXXXX" />
              </div>
            </Field>
            <Field n="૧૧" gu="વૈકલ્પિક સંપર્ક નંબર" en="Alternative contact no." error={errors.altContact} id="altContact">
              <input id="altContact" type="tel" inputMode="tel" value={form.altContact} onChange={set("altContact")} placeholder="મોબાઈલ / લેન્ડલાઈન" />
            </Field>
          </div>

          <div className="form-actions">
            <button className="btn" type="submit">ચુકવણી તરફ આગળ વધો · Continue to payment <Arrow /></button>
          </div>
          <p className="fine left">Your answers are saved on this device until you submit.</p>
        </form>
      ) : (
        <form onSubmit={submit} noValidate>
          <div className="summary">
            <div>
              <b>{form.fullName}</b>
              <span>{form.email} · +91 {cleanDetails(form).mobile}</span>
            </div>
            <button type="button" className="link" onClick={() => setStep("details")} disabled={submitting}>Edit details</button>
          </div>

          <h2 className="section-tag">વિભાગ ૨: નોંધણી શુલ્ક અને ચુકવણી <span>Section 2 · Registration fee</span></h2>
          <PaymentPanel />

          <Field n="૧૨" gu="ટ્રાન્ઝેક્શન / UTR નંબર" en="Payment transaction ID / UTR" required error={errors.utr} id="utr" hint="Found under “UPI Ref No.” or “UTR” in your payment app.">
            <input id="utr" autoComplete="off" value={utr} onChange={(e) => { setUtr(e.target.value); if (errors.utr) setErrors(({ utr, ...r }) => r); }} placeholder="UPI / IMPS ટ્રાન્ઝેક્શન રેફરન્સ નંબર" />
          </Field>

          <Field n="૧૩" gu="પેમેન્ટની પહોંચ / સ્ક્રીનશોટ" en="Upload payment receipt (image or PDF, max 10 MB)" required error={errors.receipt}>
            <FilePicker file={file} onPick={pickFile} onClear={() => setFile(null)} disabled={submitting} />
          </Field>

          <div className="form-actions">
            <button type="button" className="btn ghost" onClick={() => setStep("details")} disabled={submitting}>Back</button>
            <button className="btn" type="submit" disabled={submitting}>
              {submitting ? (progress < 1 ? `Uploading… ${Math.round(progress * 100)}%` : "Saving…") : "નોંધણી સબમિટ કરો · Submit registration"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function Stepper({ step }) {
  return (
    <div className="stepper">
      <p className="kicker">{EVENT.titleEn} · Registration</p>
      <ol>
        <li className={step === "details" ? "on" : "done"}><span>1</span> Your details</li>
        <li className={step === "payment" ? "on" : ""}><span>2</span> Payment &amp; receipt</li>
      </ol>
    </div>
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
      <div className="file-chosen">
        {preview ? <img src={preview} alt="" /> : <div className="file-icon">PDF</div>}
        <div>
          <b>{file.name}</b>
          <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
        </div>
        <button type="button" className="link" onClick={onClear} disabled={disabled}>Change</button>
      </div>
    );
  }

  return (
    <label
      className={`drop${drag ? " drag" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); onPick(e.dataTransfer.files[0]); }}
    >
      <input type="file" accept="image/*,application/pdf" onChange={(e) => onPick(e.target.files[0])} />
      <b>Image / PDF અપલોડ કરો</b>
      <span>Tap to choose the screenshot, or drag it here</span>
    </label>
  );
}

function Success({ result }) {
  return (
    <section className="page wrap narrow">
      <div className="success">
        <div className="tick" aria-hidden="true" />
        <p className="kicker">Registration received</p>
        <p className="success-gu">
          અખિલ ભારતીય રાષ્ટ્રીય શૈક્ષિક મહાસંઘ, ગુજરાત રાજ્ય સંમેલન ૨૦૨૬ માટે આપની નોંધણી સફળતાપૂર્વક મળી ગઈ છે. આપનો ખૂબ ખૂબ આભાર!
        </p>
        <p className="muted">Thank you for registering for the ABRSM Gujarat State Conference 2026. Your response has been recorded successfully.</p>

        <div className="regno">
          <span>Registration No.</span>
          <b>{result?.regNo}</b>
        </div>

        <p>
          Our team will verify your payment and send the confirmation on WhatsApp{result?.email ? <> and to <b>{result.email}</b></> : null}.
          Please note your registration number.
        </p>
        <div className="form-actions center">
          <Link className="btn ghost" to="/status">Check status later</Link>
          <Link className="btn" to="/">Back to home</Link>
        </div>
      </div>
    </section>
  );
}

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CADRES, DISTRICTS, EVENT } from "../../../shared/constants.js";
import { api } from "../api.js";
import { Icon, primaryButton } from "../components/ui.jsx";

// Bhojan Pass — opened from the WhatsApp message, and what the food counter sees when it scans the QR code.
export default function Pass() {
  const { token } = useParams();
  const [pass, setPass] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api(`/pass/${encodeURIComponent(token)}`).then(setPass).catch((err) => setError(err.message));
  }, [token]);

  if (error) {
    return (
      <section className="mx-auto max-w-md px-4 py-16 text-center">
        <Icon name="error" className="text-[48px] text-error" />
        <h1 className="mt-3 text-2xl font-semibold">પાસ મળ્યો નથી <span className="block text-base font-normal text-on-surface-variant">Pass not found</span></h1>
        <p className="mt-3 text-on-surface-variant">{error}</p>
        <Link to="/status" className={`${primaryButton} mt-6`}>Check registration status</Link>
      </section>
    );
  }

  if (!pass) return <div className="mx-auto my-10 h-[560px] max-w-md animate-pulse rounded-2xl bg-surface-container" />;

  return (
    <section className="mx-auto w-full max-w-md px-4 py-8 print:py-0">
      <BhojanPassCard pass={pass} token={token} />
      <div className="mt-5 space-y-3 print:hidden">
        {pass.valid && <ResendButton token={token} pass={pass} />}
        <button type="button" onClick={() => window.print()} className="flex h-14 w-full flex-col items-center justify-center rounded-xl border-2 border-on-primary-fixed-variant bg-white font-bold text-on-primary-fixed-variant shadow-sm hover:bg-surface">
          <span className="leading-tight">પાસ પ્રિન્ટ / સેવ કરો</span>
          <span className="text-[12px] font-normal leading-none text-on-surface-variant">Print or Save Pass (PDF)</span>
        </button>
      </div>
    </section>
  );
}

export function BhojanPassCard({ pass, token }) {
  const district = DISTRICTS.find((d) => d.value === pass.district);
  const cadre = CADRES.find((c) => c.value === pass.cadre);
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-outline-variant print:shadow-none">
      <div className="h-2 bg-gradient-to-r from-primary via-secondary to-primary-container" />
      <div className="flex items-center justify-between gap-3 border-b border-dashed border-outline-variant px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-fixed text-primary">
            <Icon name="lunch_dining" className="text-[26px]" />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight text-on-primary-fixed-variant">ભોજન પાસ</h1>
            <p className="text-[13px] text-on-surface-variant">Bhojan Pass · {EVENT.titleEn}</p>
          </div>
        </div>
        {pass.valid ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-tertiary/20 bg-[#e5f5ec] px-3 py-1 text-sm font-bold text-tertiary">
            <Icon name="check_circle" fill className="text-[18px]" />માન્ય / VALID
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-error/20 bg-error-container/60 px-3 py-1 text-sm font-bold text-error">
            <Icon name="cancel" fill className="text-[18px]" />અમાન્ય / NOT VALID
          </span>
        )}
      </div>

      <div className="px-5 pt-5 text-center">
        <img src={`/api/pass/${encodeURIComponent(token)}/qr.png`} alt={`QR code for ${pass.regNo}`} className={`mx-auto aspect-square w-56 rounded-xl ring-1 ring-outline-variant ${pass.valid ? "" : "opacity-30"}`} />
        <p className="mt-2 text-[13px] text-on-surface-variant">
          {pass.valid ? "ભોજન સમયે આ QR કોડ કાઉન્ટર પર બતાવો · Show this QR code at the food counter" : "This registration is not confirmed, so the pass cannot be used."}
        </p>
      </div>

      <dl className="mx-5 my-5 divide-y divide-outline-variant/60 rounded-xl bg-surface px-4 text-sm">
        <div className="flex items-center justify-between gap-3 py-2.5">
          <dt className="text-on-surface-variant">નોંધણી નંબર / Reg. No.</dt>
          <dd className="font-mono text-base font-bold text-on-primary-fixed-variant">{pass.regNo}</dd>
        </div>
        <div className="flex items-start justify-between gap-3 py-2.5">
          <dt className="shrink-0 text-on-surface-variant">નામ / Name</dt>
          <dd className="text-right">
            <span className="block font-bold">{pass.fullName}</span>
            <span className="text-xs text-on-surface-variant">{pass.designation}{cadre && ` · ${cadre.en}`}</span>
          </dd>
        </div>
        {district && (
          <div className="flex items-center justify-between gap-3 py-2.5">
            <dt className="text-on-surface-variant">જિલ્લો / District</dt>
            <dd className="font-semibold">{district.gu} / {district.en}</dd>
          </div>
        )}
      </dl>

      <div className="space-y-1 bg-surface-container-low px-5 py-4 text-[13px] text-on-surface-variant">
        <p className="flex items-start gap-2"><Icon name="calendar_month" className="mt-0.5 text-[16px] text-primary" />{EVENT.dateGu} · {EVENT.dateEn}</p>
        <p className="flex items-start gap-2"><Icon name="location_on" className="mt-0.5 text-[16px] text-primary" />{EVENT.venueGu}</p>
      </div>
    </div>
  );
}

export function ResendButton({ token, pass, compact = false }) {
  const [state, setState] = useState({ busy: false, msg: "", ok: false });
  if (!pass.canResend) return null;

  async function resend() {
    setState({ busy: true, msg: "", ok: false });
    try {
      await api(`/pass/${encodeURIComponent(token)}/resend`, { method: "POST" });
      setState({ busy: false, ok: true, msg: `ભોજન પાસ ફરીથી મોકલવામાં આવ્યો છે / Sent again to WhatsApp (+91 ••••••••${pass.mobileEnd || ""})` });
    } catch (err) {
      setState({ busy: false, ok: false, msg: err.message });
    }
  }

  return (
    <div className={compact ? "" : "rounded-xl border border-[#bde7cc] bg-[#eff9f2] p-3.5"}>
      <button type="button" onClick={resend} disabled={state.busy} className="inline-flex min-h-8 items-center gap-1.5 text-[14px] font-bold text-primary underline hover:text-on-primary-fixed-variant disabled:opacity-60">
        <Icon name="send" className="text-[18px]" />
        {state.busy ? "Sending…" : "WhatsApp પર ફરીથી મોકલો / Resend on WhatsApp"}
      </button>
      {state.msg && <p className={`mt-1 text-[13px] ${state.ok ? "text-[#0b5c2f]" : "text-error"}`} role="status">{state.msg}</p>}
    </div>
  );
}

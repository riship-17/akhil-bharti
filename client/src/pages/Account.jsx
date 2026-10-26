import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth.js";
import { useConfig } from "../config.js";
import { Icon, primaryButton, secondaryButton, telHref } from "../components/ui.jsx";

const LABELS = {
  pending: ["Under verification", "We have received your registration. The organising team will verify your payment, then send your Bhojan Pass.", "schedule", "border-amber-200 bg-amber-50 text-amber-800"],
  verified: ["Confirmed", "Your payment is verified and your seat is confirmed.", "check_circle", "border-tertiary/20 bg-[#e5f5ec] text-tertiary"],
  rejected: ["Payment not verified", "We could not verify your payment. Please contact the organising team, or register again with the correct payment details.", "cancel", "border-error/20 bg-error-container/50 text-error"],
};

const when = (d) => new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

// "My registration": the logged-in participant's status, Bhojan Pass and certificate.
export default function Account() {
  const { me, user, refresh, logout } = useAuth();
  const config = useConfig();
  const contact = config?.contacts?.[0];
  const r = me?.registration;
  const label = r && LABELS[r.status];
  const open = config?.registrationOpen !== false;

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-10">
      <div className="overflow-hidden rounded-2xl bg-surface-container-lowest shadow-xl">
        <div className="h-1.5 bg-gradient-to-r from-primary via-secondary to-primary-container" />
        <div className="space-y-6 p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-primary">State Conference 2026</p>
              <h1 className="mt-1 text-2xl font-semibold">My registration</h1>
            </div>
            <div className="text-right text-sm text-on-surface-variant">
              <b className="block text-on-surface">{user?.name}</b>
              <span className="block">{user?.email}</span>
              <button type="button" onClick={logout} className="mt-1 font-semibold text-primary underline">Log out</button>
            </div>
          </div>

          {!me && <div className="h-40 animate-pulse rounded-xl bg-surface-container" />}

          {me && !r && (
            <div className="space-y-4 rounded-xl p-5 text-center ring-1 ring-inset ring-outline-variant">
              <Icon name="how_to_reg" className="text-[44px] text-primary" />
              <p className="font-semibold">You haven't registered for the conference yet.</p>
              <p className="text-[15px] text-on-surface-variant">Fill in the form, pay ₹{config?.fee ?? 500} by UPI and upload the payment screenshot.</p>
              {open ? (
                <Link to="/register" className={`${primaryButton} w-full sm:w-auto`}>
                  Register now <Icon name="arrow_forward" className="text-[20px]" />
                </Link>
              ) : (
                <p className="text-[15px] font-semibold">Online registration is closed.</p>
              )}
            </div>
          )}

          {r && (
            <div className="space-y-3 rounded-xl p-4 ring-1 ring-inset ring-outline-variant">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-xs text-on-surface-variant">Registration No.</span>
                  <b className="block font-mono text-lg text-on-primary-fixed-variant">{r.regNo}</b>
                </div>
                <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-semibold ${label[3]}`}>
                  <Icon name={label[2]} className="text-[16px]" />{label[0]}
                </span>
              </div>
              <p className="font-semibold">{r.fullName}</p>
              <p className="text-[15px] text-on-surface-variant">{label[1]}</p>
              <p className="text-sm text-on-surface-variant">Submitted {when(r.submittedAt)} · UTR <span className="font-mono">{r.utr}</span></p>

              {r.note && (
                <p className="rounded-r-lg border-l-[3px] border-primary bg-primary-fixed/40 px-3.5 py-3 text-[15px]">
                  <b>Note from organisers:</b> {r.note}
                </p>
              )}

              {r.status === "verified" && !r.passToken && (
                <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[15px] text-amber-900">
                  <Icon name="hourglass_top" className="mt-0.5 text-[20px]" />
                  <span>Your Bhojan Pass will be sent by the organisers soon. It will appear here and be emailed to you.</span>
                </p>
              )}

              {r.passToken && (
                <>
                  {r.passEmailedAt && <p className="text-sm text-[#0b5c2f]"><Icon name="mail" className="mr-1 align-[-3px] text-[16px]" />Bhojan Pass emailed to {user?.email} on {when(r.passEmailedAt)}.</p>}
                  <Link to={`/pass/${r.passToken}`} className={`${primaryButton} w-full`}>
                    <Icon name="lunch_dining" className="text-[22px]" />
                    View Bhojan Pass
                  </Link>
                </>
              )}
              {r.certificateUrl && (
                <a href={r.certificateUrl} target="_blank" rel="noopener" className={`${secondaryButton} w-full`}>
                  <Icon name="workspace_premium" className="text-[22px]" />
                  Download Certificate
                </a>
              )}
              {r.status === "rejected" && open && (
                <Link to="/register" className={`${secondaryButton} w-full`}>Register again</Link>
              )}
            </div>
          )}

          {contact && (
            <p className="text-center text-sm text-on-surface-variant">
              Need help? Call <a className="font-semibold text-primary" href={telHref(contact.phone)}>{contact.phone}</a> ({contact.name})
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

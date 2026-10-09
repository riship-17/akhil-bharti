import { useEffect } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useConfig } from "../config.js";
import { EVENT } from "../../../shared/constants.js";
import { Icon, Seal, telHref } from "./ui.jsx";

const NAV = [
  ["/", "પરિષદ પરિચય / Overview"],
  ["/register", "પ્રતિનિધિ નોંધણી / Registration"],
  ["/#venue", "સ્થળ / Venue"],
  ["/#faq", "પ્રશ્નો / FAQ"],
  ["/status", "નોંધણી સ્થિતિ / Check Status"],
];

const navClass = (active) =>
  `whitespace-nowrap border-b-2 py-1 text-[15px] transition-colors ${
    active ? "border-primary font-bold text-primary" : "border-transparent text-on-surface-variant hover:text-on-surface"
  }`;

export default function Layout() {
  const { pathname, hash } = useLocation();
  const contacts = useConfig()?.contacts || [];
  const helpline = contacts[0];

  useEffect(() => {
    if (!hash) { window.scrollTo(0, 0); return; }
    // wait a frame so the target section has rendered
    requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView());
  }, [pathname, hash]);

  return (
    <div className="tw flex min-h-screen flex-col">
      <header className="z-40 bg-surface/95 shadow-[0_2px_8px_rgba(0,0,0,0.06)] backdrop-blur-xl md:sticky md:top-0 print:hidden">
        <div className="h-1.5 w-full bg-gradient-to-r from-primary via-secondary to-primary-container" />
        <div className="flex h-1 w-full items-center justify-around overflow-hidden bg-surface-variant opacity-40" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className={`h-2 w-2 rotate-45 ${i % 2 ? "bg-secondary" : "bg-primary"}`} />)}
        </div>

        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 md:h-24 lg:px-10">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <Seal className="h-11 w-11 shrink-0 md:h-12 md:w-12" />
            <span className="flex min-w-0 flex-col justify-center">
              <span className="text-[15px] font-semibold leading-tight text-primary md:text-base">અખિલ ભારતીય રાષ્ટ્રીય શૈક્ષિક મહાસંઘ, ગુજરાત</span>
              <span className="text-xs leading-tight tracking-tight text-on-surface-variant md:text-sm">Akhil Bharatiya Rashtriya Shaikshik Mahasangh, Gujarat</span>
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-4">
            {helpline && (
              <div className="hidden flex-col items-end text-right text-xs text-on-surface-variant xl:flex">
                <span className="font-medium text-primary">હેલ્પલાઇન / Helpline: <a href={telHref(helpline.phone)}>{helpline.phone}</a></span>
                <span>{helpline.name}{helpline.role ? ` · ${helpline.role}` : ""}</span>
              </div>
            )}
            <Link to="/register" className="hidden h-10 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-on-primary shadow-sm transition-colors hover:bg-secondary sm:inline-flex">
              નોંધણી / Register
              <Icon name="arrow_forward" className="text-[18px]" />
            </Link>
          </div>
        </div>

        <div className="bg-surface-container-lowest shadow-inner">
          <nav className="mx-auto flex max-w-7xl items-center gap-6 overflow-x-auto px-4 py-2 [scrollbar-width:none] lg:px-10" aria-label="Main">
            {NAV.map(([to, label]) =>
              to.includes("#") ? (
                <Link key={to} to={to} className={navClass(false)}>{label}</Link>
              ) : (
                <NavLink key={to} to={to} end className={({ isActive }) => navClass(isActive && !hash)}>{label}</NavLink>
              )
            )}
          </nav>
        </div>
      </header>

      <main className="w-full flex-1">
        <Outlet />
      </main>

      <footer className="mt-10 w-full bg-surface-container-low print:hidden">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-10 md:grid-cols-3 lg:px-10">
          <div className="space-y-1.5">
            <p className="font-semibold text-primary">અખિલ ભારતીય રાષ્ટ્રીય શૈક્ષિક મહાસંઘ, ગુજરાત</p>
            <p className="text-[15px] text-on-surface-variant">{EVENT.titleGu} / {EVENT.titleEn} · ઉચ્ચ શિક્ષણ</p>
            <p className="text-sm text-on-surface-variant">{EVENT.motto}</p>
          </div>

          <div className="space-y-1.5">
            <p className="font-semibold text-on-surface">સંપર્ક અને સહાય / Contact &amp; Helpdesk</p>
            {contacts.length > 0 ? (
              contacts.map((p) => (
                <p key={p.name + p.phone} className="text-sm text-on-surface-variant">
                  {p.name}{p.role && ` · ${p.role}`}:{" "}
                  <a className="font-medium text-primary hover:text-secondary" href={telHref(p.phone)}>{p.phone}</a>
                </p>
              ))
            ) : (
              <>
                <p className="text-sm text-on-surface-variant">{EVENT.dateGu} / {EVENT.dateEn}</p>
                <p className="text-sm text-on-surface-variant">{EVENT.venueEn}</p>
              </>
            )}
          </div>

          <div className="space-y-1.5">
            <p className="font-semibold text-on-surface">મહત્વની કડીઓ / Quick Links</p>
            <div className="flex flex-col space-y-1 text-sm text-on-surface-variant">
              <Link className="hover:text-primary" to="/register">ઓનલાઈન નોંધણી / Online Registration</Link>
              <Link className="hover:text-primary" to="/status">નોંધણી સ્થિતિ / Check Registration Status</Link>
              <Link className="hover:text-primary" to="/#venue">સ્થળ / Venue &amp; Directions</Link>
              <Link className="hover:text-primary" to="/#faq">પ્રશ્નો / FAQ</Link>
              <Link className="hover:text-primary" to="/admin">આયોજક લૉગિન / Organiser Login</Link>
            </div>
          </div>
        </div>
        <div className="w-full bg-surface-container-high px-4 py-4 text-center text-xs text-on-surface-variant md:text-sm">
          © 2026 અખિલ ભારતીય રાષ્ટ્રીય શૈક્ષિક મહાસંઘ, ગુજરાત (ABRSM Gujarat). સર્વાધિકાર સુરક્ષિત / All Rights Reserved.
        </div>
      </footer>
    </div>
  );
}

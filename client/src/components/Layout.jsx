import { useEffect } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth.js";
import { useConfig } from "../config.js";
import { EVENT } from "../../../shared/constants.js";
import { Icon, Seal, telHref } from "./ui.jsx";

const NAV = [
  ["/", "Overview"],
  ["/register", "Registration"],
  ["/#venue", "Venue"],
  ["/#faq", "FAQ"],
  ["/account", "My Registration"],
];

const navClass = (active) =>
  `whitespace-nowrap border-b-2 py-1 text-[15px] transition-colors ${
    active ? "border-primary font-bold text-primary" : "border-transparent text-on-surface-variant hover:text-on-surface"
  }`;

export default function Layout() {
  const { pathname, hash } = useLocation();
  const contacts = useConfig()?.contacts || [];
  const { user, logout } = useAuth();
  const helpline = contacts[0];

  useEffect(() => {
    if (!hash) { window.scrollTo(0, 0); return; }
    // wait a frame so the target section has rendered
    requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView());
  }, [pathname, hash]);

  return (
    <div className="tw flex min-h-dvh flex-col">
      <header className="z-40 bg-surface/95 shadow-[0_2px_8px_rgba(0,0,0,0.06)] backdrop-blur-xl md:sticky md:top-0 print:hidden">
        <div className="h-1.5 w-full bg-gradient-to-r from-primary via-secondary to-primary-container" />
        <div className="flex h-1 w-full items-center justify-around overflow-hidden bg-surface-variant opacity-40" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className={`h-2 w-2 rotate-45 ${i % 2 ? "bg-secondary" : "bg-primary"}`} />)}
        </div>

        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 md:h-24 lg:px-10">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <Seal className="h-11 w-11 shrink-0 md:h-12 md:w-12" />
            <span className="flex min-w-0 flex-col justify-center">
              <span className="text-[15px] font-semibold leading-tight text-primary md:text-base">{EVENT.org}</span>
              <span className="text-xs leading-tight tracking-tight text-on-surface-variant md:text-sm">Higher Education · {EVENT.titleEn}</span>
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-4">
            {helpline && (
              <div className="hidden flex-col items-end text-right text-xs text-on-surface-variant xl:flex">
                <span className="font-medium text-primary">Helpline: <a href={telHref(helpline.phone)}>{helpline.phone}</a></span>
                <span>{helpline.name}{helpline.role ? ` · ${helpline.role}` : ""}</span>
              </div>
            )}
            {user ? (
              <div className="flex items-center gap-3">
                <Link to="/account" className="flex h-10 items-center gap-1.5 rounded-full bg-primary-fixed/50 px-3 text-sm font-semibold text-primary hover:bg-primary-fixed">
                  <Icon name="account_circle" className="text-[20px]" />
                  <span className="hidden max-w-[10rem] truncate sm:inline">{user.name}</span>
                </Link>
                <button type="button" onClick={logout} className="hidden text-sm font-semibold text-on-surface-variant underline hover:text-primary md:inline">Log out</button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link to="/login" className="text-sm font-semibold text-primary hover:underline">Log in</Link>
                <Link to="/register" className="hidden h-10 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-on-primary shadow-sm transition-colors hover:bg-secondary sm:inline-flex">
                  Register
                  <Icon name="arrow_forward" className="text-[18px]" />
                </Link>
              </div>
            )}
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
            <p className="font-semibold text-primary">{EVENT.org}</p>
            <p className="text-[15px] text-on-surface-variant">{EVENT.titleEn} · Higher Education</p>
            <p className="text-sm text-on-surface-variant">{EVENT.motto}</p>
          </div>

          <div className="space-y-1.5">
            <p className="font-semibold text-on-surface">Contact &amp; Helpdesk</p>
            {contacts.length > 0 ? (
              contacts.map((p) => (
                <p key={p.name + p.phone} className="text-sm text-on-surface-variant">
                  {p.name}{p.role && ` · ${p.role}`}:{" "}
                  <a className="font-medium text-primary hover:text-secondary" href={telHref(p.phone)}>{p.phone}</a>
                </p>
              ))
            ) : (
              <>
                <p className="text-sm text-on-surface-variant">{EVENT.dateEn}</p>
                <p className="text-sm text-on-surface-variant">{EVENT.venueEn}</p>
              </>
            )}
          </div>

          <div className="space-y-1.5">
            <p className="font-semibold text-on-surface">Quick Links</p>
            <div className="flex flex-col space-y-1 text-sm text-on-surface-variant">
              <Link className="hover:text-primary" to="/register">Online Registration</Link>
              <Link className="hover:text-primary" to="/account">My Registration &amp; Bhojan Pass</Link>
              <Link className="hover:text-primary" to="/#venue">Venue &amp; Directions</Link>
              <Link className="hover:text-primary" to="/#faq">FAQ</Link>
              <Link className="hover:text-primary" to="/admin">Organiser Login</Link>
            </div>
          </div>
        </div>
        <div className="w-full bg-surface-container-high px-4 py-4 text-center text-xs text-on-surface-variant md:text-sm">
          © 2026 {EVENT.org} (ABRSM Gujarat). All Rights Reserved.
        </div>
      </footer>
    </div>
  );
}

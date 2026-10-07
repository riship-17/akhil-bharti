import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useConfig } from "../config.js";
import { SITE } from "../site.js";

const NAV = [
  ["/#about", "About"],
  ["/#registration", "How to register"],
  ["/#venue", "Venue"],
  ["/#faq", "FAQ"],
];

export default function Layout() {
  const { pathname, hash } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const hasContacts = useConfig()?.contacts?.length > 0;

  useEffect(() => {
    setMenuOpen(false);
    if (!hash) { window.scrollTo(0, 0); return; }
    // wait a frame so the target section has rendered
    requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView());
  }, [pathname, hash]);

  return (
    <div className="site">
      <div className="topstrip">
        <div className="container">
          <span>{SITE.org}, Gujarat <span className="hide-sm">· {SITE.wing}</span></span>
          <span className="hide-sm">{SITE.title} · {SITE.date}</span>
        </div>
      </div>

      <header className="header">
        <div className="container header-row">
          <Link to="/" className="logo">
            <Seal />
            <span>
              <b>{SITE.orgShort}</b>
              <small>{SITE.wing} · State Conference 2026</small>
            </span>
          </Link>

          <button
            className="menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="site-menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? "Close" : "Menu"}
          </button>

          <nav id="site-menu" className={`menu${menuOpen ? " open" : ""}`} aria-label="Main">
            {NAV.map(([to, label]) => <Link key={to} to={to}>{label}</Link>)}
            {hasContacts && <Link to="/#contact">Contact</Link>}
            <NavLink to="/register" className="button small">Register</NavLink>
          </nav>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="footer">
        <div className="container">
          <div className="footer-grid">
            <div>
              <div className="footer-org">
                <Seal />
                <p>{SITE.org}, Gujarat<br />{SITE.wing}</p>
              </div>
              <p className="footer-gu" lang="gu">{SITE.orgGu} (ઉચ્ચ શિક્ષણ)</p>
            </div>
            <div>
              <h4>Conference</h4>
              <ul>
                <li>{SITE.date}</li>
                <li>{SITE.venue}</li>
                <li>Ahmedabad, Gujarat</li>
              </ul>
            </div>
            <div>
              <h4>Links</h4>
              <ul>
                <li><Link to="/register">Registration form</Link></li>
                <li><Link to="/#registration">How to register</Link></li>
                <li><Link to="/#venue">Venue &amp; directions</Link></li>
                <li><Link to="/#faq">Frequently asked questions</Link></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© 2026 {SITE.orgShort} ({SITE.wing})</span>
            <Link to="/admin">Organiser login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function Seal() {
  return (
    <svg className="seal-mark" viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="23" fill="var(--brand)" />
      <circle cx="24" cy="24" r="18.5" fill="none" stroke="var(--saffron)" strokeWidth="1.2" />
      {/* open book */}
      <path d="M13 18.5c3.6-1.2 7.3-.9 11 1.2v13c-3.7-2.1-7.4-2.4-11-1.2z" fill="#fff" />
      <path d="M35 18.5c-3.6-1.2-7.3-.9-11 1.2v13c3.7-2.1 7.4-2.4 11-1.2z" fill="#fbe3cc" />
      {/* flame */}
      <path d="M24 9.5c2.2 2.4 2.6 4.6.9 6.6-.5-.9-1.2-1.4-1.9-1.6.3 1.1 0 2-1 2.6-.9-1.9-.4-4.9 2-7.6z" fill="var(--saffron)" />
    </svg>
  );
}

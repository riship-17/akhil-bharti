import { useState } from "react";
import { Link } from "react-router-dom";
import { useConfig } from "../config.js";
import { FORM_EMBED_URL, FORM_URL, SITE } from "../site.js";

export default function Registration() {
  const config = useConfig();
  const [loaded, setLoaded] = useState(false);
  const contacts = config?.contacts || [];

  return (
    <>
      <section className="page-head">
        <div className="container">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link to="/">Home</Link><span aria-hidden="true">/</span>Registration
          </nav>
          <h1>Registration</h1>
          <p>{SITE.title} · {SITE.date} · {SITE.venue}, Ahmedabad</p>
        </div>
      </section>

      <section className="section form-section">
        <div className="container form-grid">
          <aside className="form-aside">
            <div className="fee-box">
              <span>Registration fee</span>
              <b>₹{SITE.fee}</b>
              <small>per participant, paid by UPI inside the form</small>
            </div>

            <div className="panel">
              <h3>Before you start</h3>
              <ul className="ticks">
                <li>Keep your WhatsApp number and institution address handy.</li>
                <li>Pay ₹{SITE.fee} using the UPI QR code shown in the form.</li>
                <li>Note the UTR / UPI Ref No. and take a screenshot of the payment.</li>
                <li>Upload the screenshot and submit. Don't pay twice if submission fails — just fill the form again.</li>
              </ul>
            </div>

            <div className="panel quiet">
              <h3>Form not loading?</h3>
              <p>
                Some browsers block sign-in inside an embedded form. Open it on Google Forms
                directly — it's the same form.
              </p>
              <a className="button outline block" href={FORM_URL} target="_blank" rel="noopener noreferrer">
                Open in Google Forms <ExternalIcon />
              </a>
            </div>

            {contacts.length > 0 && (
              <div className="panel quiet">
                <h3>Need help?</h3>
                <ul className="mini-contacts">
                  {contacts.map((p) => (
                    <li key={p.name + p.phone}>
                      {p.name}{p.role && <small> · {p.role}</small>}
                      <a href={`tel:${p.phone.replace(/[^\d+]/g, "")}`}>{p.phone}</a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>

          <div className="form-frame">
            <div className="form-frame-bar">
              <span>Registration form</span>
              <a href={FORM_URL} target="_blank" rel="noopener noreferrer">Open in new tab <ExternalIcon /></a>
            </div>
            <div className="form-frame-body">
              {!loaded && <p className="form-loading">Loading the registration form…</p>}
              <iframe
                title="State Conference 2026 registration form"
                src={FORM_EMBED_URL}
                onLoad={() => setLoaded(true)}
              />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function ExternalIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M9 3h4v4M13 3 7 9M11 9.5V13H3V5h3.5" />
    </svg>
  );
}

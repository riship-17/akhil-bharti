import { useEffect, useState } from "react";
import { CADRES, FEE, designationText, labelOf, rupees, universityText } from "../../../shared/constants.js";
import { when } from "./Registrations.jsx";

export default function Detail({ reg: r, call, token, onClose, onChanged }) {
  const [note, setNote] = useState(r.adminNote || "");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [email, setEmail] = useState(null); // null when not editing
  const [utr, setUtr] = useState(null); // null when not editing
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    setNote(r.adminNote || "");
    setMsg("");
    setConfirmDelete(false);
    setEmail(null);
    setUtr(null);
  }, [r._id]);

  // Statement payments that look like this participant's, when their UTR hasn't been found.
  const lookForPayment = r.status === "pending" && !r.received?.foundAt;
  useEffect(() => {
    setSuggestions([]);
    if (lookForPayment) call(`/admin/registrations/${r._id}/suggestions`).then((d) => setSuggestions(d.items)).catch(() => {});
  }, [r._id, r.utr, lookForPayment, call]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function setStatus(status, amount) {
    if (status === "rejected" && !note.trim()) {
      setMsg("Add a short note explaining why (e.g. “Payment not found in bank statement”) before rejecting.");
      return;
    }
    setBusy(status);
    setMsg("");
    try {
      const { registration, emailed, error } = await call(`/admin/registrations/${r._id}`, { method: "PATCH", body: { status, adminNote: note, amount } });
      onChanged(registration);
      if (status === "verified") {
        setMsg(emailed
          ? `Payment verified and the Bhojan Pass emailed to ${registration.email}.`
          : `Payment verified. The pass is in the participant's account, but the email was not sent: ${error || "unknown error"}`);
      }
      else if (status === "rejected") setMsg(emailed ? "Rejected and the participant was emailed." : "Rejected. The email could not be sent, so let the participant know by phone.");
      else setMsg("Moved back to pending.");
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy("");
    }
  }

  async function saveNote() {
    setBusy("note");
    try {
      const { registration } = await call(`/admin/registrations/${r._id}`, { method: "PATCH", body: { adminNote: note } });
      onChanged(registration);
      setMsg("Note saved.");
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy("");
    }
  }

  async function saveEmail(e) {
    e.preventDefault();
    setBusy("email");
    setMsg("");
    try {
      const { registration } = await call(`/admin/registrations/${r._id}/email`, { method: "PUT", body: { email } });
      onChanged(registration);
      setEmail(null);
      setMsg(
        `Email changed to ${registration.email}. The participant now logs in with it.` +
          (registration.pass?.emailedAt ? " Click “Email pass again” to send the Bhojan Pass there." : "")
      );
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy("");
    }
  }

  async function saveUtr(value) {
    setBusy("utr");
    setMsg("");
    try {
      const { registration, found, emailed, error } = await call(`/admin/registrations/${r._id}/utr`, { method: "PUT", body: { utr: value } });
      onChanged(registration);
      setUtr(null);
      setMsg(
        found === "verified"
          ? `UTR found in the statement: payment verified${emailed ? " and the Bhojan Pass emailed." : `. The pass email was not sent: ${error || "unknown error"}`}`
          : found === "differs"
            ? `UTR found, but ${rupees(registration.received.amount)} was received instead of ${rupees(registration.amount)}. Check it below.`
            : "UTR saved. It isn't in the uploaded statements yet: it will be matched when the next statement is uploaded."
      );
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy("");
    }
  }

  async function remove() {
    setBusy("delete");
    try {
      await call(`/admin/registrations/${r._id}`, { method: "DELETE" });
      onChanged(r, true);
    } catch (err) {
      setMsg(err.message);
      setBusy("");
    }
  }

  async function postAction(path, kind, done) {
    setBusy(kind);
    setMsg("");
    try {
      const res = await call(`/admin/registrations/${r._id}/${path}`, { method: "POST" });
      onChanged(res.registration);
      setMsg(typeof done === "function" ? done(res) : done);
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy("");
    }
  }

  const sendPass = () =>
    postAction("pass", "pass", ({ emailed, error }) =>
      emailed
        ? `Bhojan Pass emailed to ${r.email}.`
        : `The pass is now in the participant's account, but the email was not sent: ${error || "unknown error"}`
    );
  const passLabel = busy === "pass" ? "Sending…" : r.pass?.emailedAt ? "Email pass again" : "Send Bhojan Pass";

  const certificateUrl = `/api/admin/registrations/${r._id}/certificate?t=${encodeURIComponent(token)}`;
  const receiptUrl = `/api/admin/registrations/${r._id}/receipt?t=${encodeURIComponent(token)}`;
  const feeReceiptUrl = `/api/admin/registrations/${r._id}/fee-receipt?t=${encodeURIComponent(token)}`;
  const isPdf = r.receipt?.contentType === "application/pdf";
  const received = r.received?.foundAt ? r.received : null;
  const differs = received && received.amount !== r.amount;

  const rows = [
    [
      "Email",
      email === null ? (
        <>{r.email} <button className="link" onClick={() => setEmail(r.email)} disabled={!!busy}>Edit</button></>
      ) : (
        <form onSubmit={saveEmail}>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus aria-label="New email" />
          <button className="link" disabled={!!busy || !email.trim()}>{busy === "email" ? "Saving…" : "Save"}</button>
          {" · "}
          <button type="button" className="link" onClick={() => setEmail(null)} disabled={!!busy}>Cancel</button>
        </form>
      ),
    ],
    ["Mobile", r.mobile],
    ["Alternative contact", r.altContact],
    ["Cadre", labelOf(CADRES, r.cadre)],
    ["District", r.district],
    ["Designation", designationText(r)],
    ["Field of study", r.fieldOfStudy],
    ["ABRSM responsibility", r.orgResponsibility],
    ["University", r.university && universityText(r)],
    ["College / Department", r.department],
    ["Institution address", r.institution],
    ["Residential address", r.residentialAddress],
  ];

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label={`Registration ${r.regNo}`}>
        <div className="drawer-head">
          <div>
            <span className="mono muted small">{r.regNo}</span>
            <h2>{r.fullName}</h2>
            <span className={`chip ${r.status}`}>{r.status}</span>
            <span className="muted small"> · submitted {when(r.createdAt)}</span>
          </div>
          <button className="close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="drawer-body">
          <section className="pay-check">
            <div className="pay-facts">
              <div><span>Total paid</span><b>{rupees(r.amount)}</b></div>
              <div><span>Bhojan Pass fee</span><b>{rupees(FEE)}</b></div>
              <div><span>Sahay Shulk</span><b>{rupees(r.donation)}</b></div>
              <div><span>Paid by</span><b>{r.payMode === "bank" ? "Bank transfer" : "UPI"}</b></div>
              <div>
                <span>UTR / Transaction ID</span>
                {utr === null ? (
                  <b className="mono">
                    {r.utr || <span className="muted">none</span>}{" "}
                    {r.status === "pending" && <button className="link small" onClick={() => setUtr(r.utr || "")} disabled={!!busy}>{r.utr ? "Edit" : "Add"}</button>}
                  </b>
                ) : (
                  <form onSubmit={(e) => { e.preventDefault(); saveUtr(utr); }}>
                    <input className="mono" value={utr} onChange={(e) => setUtr(e.target.value)} required autoFocus aria-label="UTR" placeholder="12-digit UTR" />
                    <button className="link" disabled={!!busy || !utr.trim()}>{busy === "utr" ? "Saving…" : "Save"}</button>
                    {" · "}
                    <button type="button" className="link" onClick={() => setUtr(null)} disabled={!!busy}>Cancel</button>
                  </form>
                )}
              </div>
            </div>
            <div className={`statement-check${received ? (differs ? " differs" : " found") : ""}`}>
              {received ? (
                <>
                  <b>{differs ? `In the statement, but ${rupees(received.amount)} was received` : `Found in the statement: ${rupees(received.amount)} received`}</b>
                  <span>from {received.payer || "unknown"}{received.paidAt && ` on ${when(received.paidAt)}`}{received.byName && " (matched by payer name and amount)"}</span>
                  {differs && r.status === "pending" && (
                    received.amount >= FEE
                      ? <span>If the amount is fine (e.g. a different Sahay Shulk), verify with {rupees(received.amount)}. Otherwise reject it with a note.</span>
                      : <span>That is less than the {rupees(FEE)} fee: reject it with a note, e.g. “Amount received was {rupees(received.amount)} instead of {rupees(r.amount)}”.</span>
                  )}
                </>
              ) : r.status === "pending" ? (
                <>
                  <b>{r.utr ? "Not found in the uploaded statements yet" : "No UTR: add it from the screenshot to match it with the statement"}</b>
                  {r.payMode === "bank" && <span>Bank transfers (NEFT / IMPS / RTGS) don't appear in the PhonePe statement: check the bank statement and verify by hand.</span>}
                </>
              ) : (
                <b>Not matched with a statement (verified by hand)</b>
              )}
            </div>
            {suggestions.length > 0 && (
              <div className="suggestions">
                <b>Possible payments in the statement</b>
                {suggestions.map((p) => (
                  <div key={p._id}>
                    <span>
                      <b>{rupees(p.amount)}</b> · {p.details} · {p.date} {p.time}
                      <span className="sub-line mono">UTR {p.utr} — {p.reasons.join(", ")}</span>
                    </span>
                    <button className="btn ghost small" onClick={() => saveUtr(p.utr)} disabled={!!busy}>Use this UTR</button>
                  </div>
                ))}
              </div>
            )}
            <a href={receiptUrl} target="_blank" rel="noopener" className="receipt">
              {isPdf ? <div className="file-icon big">PDF<small>Open receipt</small></div> : <img src={receiptUrl} alt="Payment screenshot" />}
            </a>
            <p className="muted small">Registrations are verified automatically when their UTR and amount match an uploaded statement (Payments page). Click the screenshot to open it full size.</p>
          </section>

          {r.status === "verified" && (
            <section className="pay-check">
              <div className="pay-facts">
                <div>
                  <span>Bhojan Pass</span>
                  <b>{r.pass?.emailedAt ? `Emailed ${when(r.pass.emailedAt)}` : r.pass?.issuedAt ? "In account, not emailed" : "Not sent yet"}</b>
                </div>
                <div>
                  <span>Certificate (email)</span>
                  <b>{r.certificate?.emailedAt ? `Sent ${when(r.certificate.emailedAt)}` : "Not sent"}</b>
                </div>
              </div>
              {r.pass?.lastError && !r.pass?.emailedAt && <p className="muted small">Last pass email failed: {r.pass.lastError}</p>}
              {r.certificate?.lastError && !r.certificate?.emailedAt && <p className="muted small">Last certificate attempt failed: {r.certificate.lastError}</p>}
              <p className="muted small">
                {r.pass?.emailedAt && <><button className="link" onClick={sendPass} disabled={!!busy}>{passLabel}</button>{" · "}</>}
                {r.pass?.issuedAt && <><a href={`/pass/${r.pass.token}`} target="_blank" rel="noopener">Open pass</a>{" · "}</>}
                <a href={feeReceiptUrl} target="_blank" rel="noopener">Fee receipt</a>
                {" · "}
                <a href={certificateUrl} target="_blank" rel="noopener">Preview certificate</a>
                {" · "}
                <button className="link" onClick={() => postAction("certificate", "certificate", "Certificate emailed.")} disabled={!!busy}>
                  {busy === "certificate" ? "Sending…" : r.certificate?.emailedAt ? "Email certificate again" : "Email certificate"}
                </button>
              </p>
            </section>
          )}

          <dl className="kv">
            {rows.filter(([, v]) => v).map(([k, v]) => (
              <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>

          <label className="field-label" htmlFor="note"><span className="field-en">Note (shown to participant if rejected)</span></label>
          <textarea id="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Amount received was ₹50 instead of ₹500" />
          {note !== (r.adminNote || "") && (
            <button className="link" onClick={saveNote} disabled={!!busy}>Save note</button>
          )}

          {msg && <p className="admin-msg">{msg}</p>}
        </div>

        <div className="drawer-actions">
          {r.status !== "verified" && differs && received.amount >= FEE && (
            <button className="btn green" onClick={() => setStatus("verified", received.amount)} disabled={!!busy}>
              {busy === "verified" ? "Verifying…" : `Verify with ${rupees(received.amount)}`}
            </button>
          )}
          {r.status !== "verified" && !differs && (
            <button className="btn green" onClick={() => setStatus("verified")} disabled={!!busy}>{busy === "verified" ? "Verifying…" : "Verify payment"}</button>
          )}
          {r.status === "verified" && !r.pass?.emailedAt && (
            <button className="btn green" onClick={sendPass} disabled={!!busy}>{passLabel}</button>
          )}
          {r.status !== "rejected" && (
            <button className="btn ghost danger" onClick={() => setStatus("rejected")} disabled={!!busy}>{busy === "rejected" ? "Rejecting…" : "Reject"}</button>
          )}
          {r.status !== "pending" && (
            <button className="btn ghost" onClick={() => setStatus("pending")} disabled={!!busy}>Mark pending</button>
          )}
          <a className="btn ghost" href={`tel:+91${r.mobile}`}>Call</a>
          <div className="spacer" />
          {confirmDelete ? (
            <button className="btn danger-solid small" onClick={remove} disabled={!!busy}>Confirm delete</button>
          ) : (
            <button className="link danger" onClick={() => setConfirmDelete(true)}>Delete</button>
          )}
        </div>
      </aside>
    </>
  );
}

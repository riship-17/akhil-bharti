import { useEffect, useState } from "react";
import { CADRES, confirmationText, designationText, labelOf } from "../../../shared/constants.js";
import { when } from "./Registrations.jsx";

function whatsappText(r) {
  if (r.status === "verified") return confirmationText(r);
  if (r.status === "rejected")
    return `નમસ્તે ${r.fullName},\n\nABRSM ગુજરાત રાજ્ય સંમેલન ૨૦૨૬ – આપની નોંધણી (${r.regNo}) માટેની ચુકવણી ચકાસી શકાઈ નથી.${r.adminNote ? `\n\n${r.adminNote}` : ""}\n\nWe could not verify the payment for your registration ${r.regNo}. Please reply to this message so we can help.`;
  return `નમસ્તે ${r.fullName},\n\nABRSM ગુજરાત રાજ્ય સંમેલન ૨૦૨૬ – આપની નોંધણી (${r.regNo}) અમને મળી ગઈ છે. ચુકવણીની ચકાસણી ચાલુ છે.`;
}

export default function Detail({ reg: r, call, token, onClose, onChanged }) {
  const [note, setNote] = useState(r.adminNote || "");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setNote(r.adminNote || "");
    setMsg("");
    setConfirmDelete(false);
  }, [r._id]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function setStatus(status) {
    if (status === "rejected" && !note.trim()) {
      setMsg("Add a short note explaining why (e.g. “UTR not found in bank statement”) before rejecting.");
      return;
    }
    setBusy(status);
    setMsg("");
    try {
      const { registration, emailed, whatsapp } = await call(`/admin/registrations/${r._id}`, { method: "PATCH", body: { status, adminNote: note } });
      onChanged(registration);
      if (status === "verified") {
        const pass = whatsapp?.sent ? " Bhojan Pass sent on WhatsApp." : whatsapp?.error ? ` Bhojan Pass not sent: ${whatsapp.error}` : "";
        setMsg((emailed ? "Verified. Confirmation email sent." : "Verified.") + pass);
      }
      else if (status === "rejected") setMsg(emailed ? "Rejected and the participant was emailed." : "Rejected. Let the participant know on WhatsApp.");
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

  async function sendPass() {
    setBusy("pass");
    setMsg("");
    try {
      const { registration } = await call(`/admin/registrations/${r._id}/pass`, { method: "POST" });
      onChanged(registration);
      setMsg("Bhojan Pass sent on WhatsApp.");
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy("");
    }
  }

  async function postAction(path, kind, done) {
    setBusy(kind);
    setMsg("");
    try {
      const { registration } = await call(`/admin/registrations/${r._id}/${path}`, { method: "POST" });
      onChanged(registration);
      setMsg(done);
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy("");
    }
  }

  const certificateUrl = `/api/admin/registrations/${r._id}/certificate?t=${encodeURIComponent(token)}`;
  const receiptUrl = `/api/admin/registrations/${r._id}/receipt?t=${encodeURIComponent(token)}`;
  const isPdf = r.receipt?.contentType === "application/pdf";
  const wa = `https://wa.me/91${r.mobile}?text=${encodeURIComponent(whatsappText({ ...r, adminNote: note }))}`;

  const rows = [
    ["Email", r.email],
    ["Mobile / WhatsApp", r.mobile],
    ["Alternative contact", r.altContact],
    ["Cadre", labelOf(CADRES, r.cadre)],
    ["District", r.district],
    ["Designation", designationText(r)],
    ["Field of study", r.fieldOfStudy],
    ["ABRSM responsibility", r.orgResponsibility],
    ["Institution", r.institution],
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
          {r.paymentMethod === "razorpay" ? (
            <section className="pay-check">
              <div className="pay-facts">
                <div><span>Amount</span><b>₹{r.amount}</b></div>
                <div><span>Razorpay payment ID</span><b className="mono">{r.utr}</b></div>
              </div>
              <p className="muted small">
                Paid online through Razorpay and checked automatically.{" "}
                <a href={`https://dashboard.razorpay.com/app/payments/${r.utr}`} target="_blank" rel="noopener">Open in Razorpay dashboard</a>
              </p>
            </section>
          ) : (
            <section className="pay-check">
              <div className="pay-facts">
                <div><span>Amount</span><b>₹{r.amount}</b></div>
                <div><span>UTR / Transaction ID</span><b className="mono">{r.utr}</b></div>
              </div>
              <a href={receiptUrl} target="_blank" rel="noopener" className="receipt">
                {isPdf ? <div className="file-icon big">PDF<small>Open receipt</small></div> : <img src={receiptUrl} alt="Payment screenshot" />}
              </a>
              <p className="muted small">Match the UTR and amount with your bank / UPI statement before verifying. Click the receipt to open it full size.</p>
            </section>
          )}

          {r.status === "verified" && (
            <section className="pay-check">
              <div className="pay-facts">
                <div>
                  <span>Bhojan Pass (WhatsApp)</span>
                  <b>{r.pass?.sentAt ? `Sent ${when(r.pass.sentAt)}` : "Not sent yet"}</b>
                </div>
              </div>
              {r.pass?.lastError && <p className="muted small">Last attempt failed: {r.pass.lastError}</p>}
              <p className="muted small">
                <button className="link" onClick={sendPass} disabled={!!busy}>
                  {busy === "pass" ? "Sending…" : r.pass?.sentAt ? "Send Bhojan Pass again" : "Send Bhojan Pass on WhatsApp"}
                </button>
                {r.pass?.token && <> · <a href={`/pass/${r.pass.token}`} target="_blank" rel="noopener">Open pass</a></>}
              </p>
            </section>
          )}

          {r.status === "verified" && (
            <section className="pay-check">
              <div className="pay-facts">
                <div>
                  <span>Confirmation + Bhojan Pass (email)</span>
                  <b>{r.confirmationEmailedAt ? `Sent ${when(r.confirmationEmailedAt)}` : "Not sent"}</b>
                </div>
                <div>
                  <span>Certificate (email)</span>
                  <b>{r.certificate?.emailedAt ? `Sent ${when(r.certificate.emailedAt)}` : "Not sent"}</b>
                </div>
              </div>
              {r.certificate?.lastError && !r.certificate?.emailedAt && <p className="muted small">Last certificate attempt failed: {r.certificate.lastError}</p>}
              <p className="muted small">
                <button className="link" onClick={() => postAction("email", "email", "Confirmation email with the Bhojan Pass sent.")} disabled={!!busy}>
                  {busy === "email" ? "Sending…" : r.confirmationEmailedAt ? "Email pass again" : "Email confirmation + pass"}
                </button>
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
          {r.status !== "verified" && (
            <button className="btn green" onClick={() => setStatus("verified")} disabled={!!busy}>{busy === "verified" ? "Verifying…" : "Verify payment"}</button>
          )}
          {r.status !== "rejected" && (
            <button className="btn ghost danger" onClick={() => setStatus("rejected")} disabled={!!busy}>{busy === "rejected" ? "Rejecting…" : "Reject"}</button>
          )}
          {r.status !== "pending" && (
            <button className="btn ghost" onClick={() => setStatus("pending")} disabled={!!busy}>Mark pending</button>
          )}
          <a className="btn wa" href={wa} target="_blank" rel="noopener">
            {r.status === "verified" ? "Send confirmation on WhatsApp" : "Message on WhatsApp"}
          </a>
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

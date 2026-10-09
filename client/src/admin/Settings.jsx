import { useEffect, useState } from "react";
import { upload } from "../api.js";
import { upiLink } from "../components/PaymentPanel.jsx";

const FIELDS = [
  ["upiId", "UPI ID", "e.g. abrsmgujarat@sbi — also used to generate a QR code if you don't upload one"],
  ["payeeName", "Payee name (shown in UPI app)", ""],
  ["accountName", "Account holder name", ""],
  ["bankName", "Bank name", ""],
  ["accountNo", "Account number", ""],
  ["ifsc", "IFSC code", ""],
];

export default function Settings({ call, token }) {
  const [s, setS] = useState(null);
  const [saved, setSaved] = useState(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    call("/admin/settings").then((d) => { setS(d); setSaved(d); }).catch((e) => setMsg(e.message));
  }, [call]);

  if (!s) return <div className="admin-main narrow"><p className="empty">{msg || "Loading…"}</p></div>;

  const set = (k) => (e) => setS({ ...s, [k]: e.target.value });
  const setContact = (i, k) => (e) => setS({ ...s, contacts: s.contacts.map((c, j) => (j === i ? { ...c, [k]: e.target.value } : c)) });
  const dirty = JSON.stringify(s) !== JSON.stringify(saved);

  async function save(e) {
    e?.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const d = await call("/admin/settings", { method: "PUT", body: s });
      setS(d); setSaved(d);
      setMsg("Saved. The public site now shows these details.");
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleOpen() {
    const d = await call("/admin/settings", { method: "PUT", body: { registrationOpen: !s.registrationOpen } });
    setS({ ...s, registrationOpen: d.registrationOpen });
    setSaved({ ...saved, registrationOpen: d.registrationOpen });
  }

  async function uploadQr(file) {
    if (!file) return;
    const form = new FormData();
    form.append("qr", file);
    setMsg("");
    try {
      const d = await upload("/admin/settings/qr", form, { token });
      setS({ ...s, qr: d.qr }); setSaved({ ...saved, qr: d.qr });
      setMsg("QR code updated.");
    } catch (err) {
      setMsg(err.message);
    }
  }

  async function removeQr() {
    const d = await call("/admin/settings/qr", { method: "DELETE" });
    setS({ ...s, qr: d.qr }); setSaved({ ...saved, qr: d.qr });
  }

  return (
    <form className="admin-main narrow settings" onSubmit={save}>
      <section className="panel">
        <div className="panel-row">
          <div>
            <h2>Registration is {s.registrationOpen ? "open" : "closed"}</h2>
            <p className="muted small">{s.registrationOpen ? "Anyone with the link can register." : "The form is hidden and new registrations are blocked."}</p>
          </div>
          <button type="button" className={`btn ${s.registrationOpen ? "ghost danger" : "green"}`} onClick={toggleOpen}>
            {s.registrationOpen ? "Close registration" : "Open registration"}
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>Payment QR code</h2>
        <div className="qr-settings">
          <div className="qr-thumb">
            {s.qr?.fileId ? <img src={`/api/qr?v=${s.qr.fileId}`} alt="Current QR" /> : <span>{s.upiId ? "Auto-generated from UPI ID" : "No QR yet"}</span>}
          </div>
          <div>
            <p className="muted small">Upload the QR image from your bank or UPI app (PNG or JPG). If you don't upload one, the site creates a QR from the UPI ID with ₹500 pre-filled.</p>
            <label className="btn ghost small file-btn">
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => uploadQr(e.target.files[0])} />
              {s.qr?.fileId ? "Replace QR image" : "Upload QR image"}
            </label>
            {s.qr?.fileId && <button type="button" className="link danger" onClick={removeQr}>Remove</button>}
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>Bank &amp; UPI details</h2>
        <p className="muted small">Shown on the payment step. Leave a field empty to hide it.</p>
        <div className="settings-grid">
          {FIELDS.map(([k, label, hint]) => (
            <div key={k} className={k === "upiId" ? "wide" : ""}>
              <label className="field-label" htmlFor={k}><span className="field-en">{label}</span></label>
              <input id={k} value={s[k] || ""} onChange={set(k)} />
              {hint && <p className="field-hint">{hint}</p>}
            </div>
          ))}
        </div>
        {s.upiId && <p className="muted small">Test link: <code>{upiLink({ ...s, fee: 500 })}</code></p>}
      </section>

      <section className="panel">
        <h2>Contact people</h2>
        <p className="muted small">Shown on the home page so participants can call for help.</p>
        {s.contacts.map((c, i) => (
          <div className="contact-row" key={i}>
            <input placeholder="Name" value={c.name} onChange={setContact(i, "name")} />
            <input placeholder="Role (e.g. Convener)" value={c.role} onChange={setContact(i, "role")} />
            <input placeholder="Phone" value={c.phone} onChange={setContact(i, "phone")} />
            <button type="button" className="link danger" onClick={() => setS({ ...s, contacts: s.contacts.filter((_, j) => j !== i) })}>Remove</button>
          </div>
        ))}
        {s.contacts.length < 10 && (
          <button type="button" className="link" onClick={() => setS({ ...s, contacts: [...s.contacts, { name: "", role: "", phone: "" }] })}>+ Add contact</button>
        )}
      </section>

      <div className="save-bar">
        {msg && <span className="admin-msg admin-msg-inline">{msg}</span>}
        <button className="btn" disabled={busy || !dirty}>{busy ? "Saving…" : "Save changes"}</button>
      </div>
    </form>
  );
}

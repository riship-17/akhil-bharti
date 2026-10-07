import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useConfig } from "../config.js";

export function upiLink(c) {
  if (!c?.upiId) return "";
  const p = new URLSearchParams({ pa: c.upiId, pn: c.payeeName || "ABRSM Gujarat", am: String(c.fee), cu: "INR", tn: "State Conference 2026" });
  return `upi://pay?${p.toString().replace(/\+/g, "%20")}`;
}

export default function PaymentPanel() {
  const c = useConfig();
  const [generated, setGenerated] = useState("");
  const [copied, setCopied] = useState("");
  const link = upiLink(c);

  useEffect(() => {
    if (c && !c.qrUrl && link) QRCode.toDataURL(link, { width: 480, margin: 1 }).then(setGenerated).catch(() => {});
  }, [c, link]);

  if (!c) return <div className="pay-panel skeleton" />;

  const qrSrc = c.qrUrl || generated;
  const rows = [
    ["UPI ID", c.upiId, true],
    ["ખાતાધારક / A/c name", c.accountName],
    ["બેંક / Bank", c.bankName],
    ["ખાતા નંબર / A/c no.", c.accountNo, true],
    ["IFSC", c.ifsc, true],
  ].filter((r) => r[1]);

  const copy = (label, text) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(""), 1500);
    });
  };

  return (
    <div className="pay-panel">
      <div className="qr-box">
        {qrSrc ? <img src={qrSrc} alt="UPI QR code for the registration fee" /> : <div className="qr-empty">QR code will be added soon</div>}
        <p className="qr-cap">Scan &amp; pay via UPI<span>કોઈપણ UPI એપથી સ્કેન કરો</span></p>
        {link && <a className="btn ghost upi-app" href={link}>Pay ₹{c.fee} in UPI app</a>}
      </div>
      <div className="pay-info">
        <p className="amount">₹ {c.fee}<small>અંકે રૂપિયા પાંચસો પૂરા</small></p>
        {rows.length > 0 && (
          <table className="bank">
            <tbody>
              {rows.map(([label, value, canCopy]) => (
                <tr key={label}>
                  <th>{label}</th>
                  <td>
                    {value}
                    {canCopy && (
                      <button type="button" className="copy" onClick={() => copy(label, value)}>
                        {copied === label ? "Copied" : "Copy"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="note">
          <p>ચુકવણી સફળ થયા પછી સ્ક્રીનશોટ લઈ લો અને UTR નંબર નોંધી રાખો.</p>
          <p>After paying, take a screenshot and note the 12-digit UTR / transaction ID shown in your UPI app.</p>
        </div>
      </div>
    </div>
  );
}

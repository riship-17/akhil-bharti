import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useConfig } from "../config.js";

export function upiLink(c) {
  if (!c?.upiId) return "";
  const p = new URLSearchParams({ pa: c.upiId, pn: c.payeeName || "ABRSM Gujarat", am: String(c.fee), cu: "INR", tn: "State Conference 2026" });
  return `upi://pay?${p.toString().replace(/\+/g, "%20")}`;
}

// Manual UPI payment details — shown only when Razorpay is not configured.
export default function PaymentPanel() {
  const c = useConfig();
  const [generated, setGenerated] = useState("");
  const [copied, setCopied] = useState("");
  const link = upiLink(c);

  useEffect(() => {
    if (c && !c.qrUrl && link) QRCode.toDataURL(link, { width: 480, margin: 1 }).then(setGenerated).catch(() => {});
  }, [c, link]);

  if (!c) return <div className="min-h-72 animate-pulse rounded-xl bg-surface-container" />;

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
    <div className="grid gap-5 rounded-xl border-2 border-dashed border-primary/40 bg-[#fff5eb] p-4 sm:grid-cols-[200px_1fr]">
      <div className="rounded-xl bg-surface-container-lowest p-3 text-center shadow-sm">
        {qrSrc ? (
          <img src={qrSrc} alt="UPI QR code for the registration fee" className="aspect-square w-full object-contain" />
        ) : (
          <div className="flex aspect-square items-center justify-center rounded-lg border-[1.5px] border-dashed border-outline-variant p-4 text-sm text-on-surface-variant">QR code will be added soon</div>
        )}
        <p className="mt-2 text-sm font-semibold">Scan &amp; pay via UPI<span className="block text-xs font-normal text-on-surface-variant">કોઈપણ UPI એપથી સ્કેન કરો</span></p>
        {link && <a className="mt-2 inline-flex rounded-lg px-3 py-1.5 text-sm font-semibold text-primary ring-1 ring-inset ring-primary sm:hidden" href={link}>Pay ₹{c.fee} in UPI app</a>}
      </div>
      <div>
        <p className="text-4xl font-bold leading-none text-on-primary-fixed-variant">₹ {c.fee}<small className="ml-2 text-[15px] font-normal text-on-surface-variant">અંકે રૂપિયા પાંચસો પૂરા</small></p>
        {rows.length > 0 && (
          <table className="mt-4 w-full text-[15px]">
            <tbody>
              {rows.map(([label, value, canCopy]) => (
                <tr key={label} className="border-b border-outline-variant/60">
                  <th className="w-[44%] py-2 pr-3 text-left align-top font-medium text-on-surface-variant">{label}</th>
                  <td className="break-words py-2 font-semibold">
                    {value}
                    {canCopy && (
                      <button type="button" className="ml-2 rounded px-2 text-xs font-medium text-primary ring-1 ring-inset ring-outline-variant hover:ring-primary" onClick={() => copy(label, value)}>
                        {copied === label ? "Copied" : "Copy"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="mt-4 rounded-r-lg border-l-[3px] border-primary bg-primary-fixed/40 px-3.5 py-3 text-[15px]">
          <p>ચુકવણી સફળ થયા પછી સ્ક્રીનશોટ લઈ લો અને UTR નંબર નોંધી રાખો.</p>
          <p className="mt-1 text-sm text-on-surface-variant">After paying, take a screenshot and note the 12-digit UTR / transaction ID shown in your UPI app.</p>
        </div>
      </div>
    </div>
  );
}

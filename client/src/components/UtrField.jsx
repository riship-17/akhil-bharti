import { cleanUtr, validateUtr } from "../../../shared/validate.js";
import { Field, inputClass } from "./ui.jsx";

// Where each app shows the UTR. It is matched with the organiser's PhonePe statement, so the payment is confirmed
// without anyone checking the screenshot.
const UTR_HELP = {
  upi: "The 12-digit number on the payment success screen. PhonePe: “UTR” · Google Pay: “UPI transaction ID” · Paytm: “UPI Ref. No.” · BHIM / bank apps: “RRN” or “UTR”.",
  bank: "The reference number of your transfer in your bank app: 12 digits for IMPS, 16 characters for NEFT (starts with letters), 22 for RTGS.",
};

export default function UtrField({ id = "utr", value, onChange, payMode, error, disabled }) {
  const utr = cleanUtr(value);
  const ok = utr && !validateUtr(utr, payMode);
  return (
    <Field id={id} label="UTR / Transaction ID" required error={error}
      sub="Your payment is confirmed by matching this number with our bank statement."
      hint={ok ? "Looks right. Check it once more against the payment screen." : UTR_HELP[payMode === "bank" ? "bank" : "upi"]}
      hintIcon={ok ? "check_circle" : "info"}>
      <input id={id} value={value} disabled={disabled} autoComplete="off" spellCheck={false} aria-invalid={!!error}
        inputMode={payMode === "bank" ? "text" : "numeric"} maxLength={payMode === "bank" ? 30 : 16}
        onChange={(e) => onChange(payMode === "bank" ? e.target.value.toUpperCase().replace(/[^A-Z0-9 ]/g, "") : e.target.value.replace(/[^\d ]/g, ""))}
        placeholder={payMode === "bank" ? "e.g. HDFCN52026110412345" : "e.g. 412345678901"}
        className={`${inputClass(error)} font-mono text-lg tracking-wider`} />
    </Field>
  );
}

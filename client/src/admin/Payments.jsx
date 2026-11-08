import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { rupees } from "../../../shared/constants.js";
import { upload } from "../api.js";
import { when } from "./Registrations.jsx";

const TABS = [
  ["", "all", "All payments"],
  ["matched", "matched", "Matched"],
  ["differs", "differs", "Amount differs"],
  ["unregistered", "unregistered", "Paid, not registered"],
  ["notFound", "notFound", "Registered, UTR not found"],
];

const regLink = (regNo) => `/admin?q=${encodeURIComponent(regNo)}`;

// A day in India as YYYY-MM-DD, `offset` days from today.
const istDay = (offset = 0) => new Date(Date.now() + offset * 864e5).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const RANGES = [
  ["", "All dates", () => ["", ""]],
  ["today", "Today", () => [istDay(), istDay()]],
  ["yesterday", "Yesterday", () => [istDay(-1), istDay(-1)]],
  ["week", "Last 7 days", () => [istDay(-6), istDay()]],
  ["month", "This month", () => [`${istDay().slice(0, 8)}01`, istDay()]],
];
const dayLabel = (day) => new Date(`${day}T00:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

// The days the uploaded statements have payments on, as runs of consecutive days ([first, last, payments]).
function runsOf(days = []) {
  const runs = [];
  for (const { day, n } of days) {
    const last = runs.at(-1);
    if (last && new Date(`${day}T00:00:00Z`) - new Date(`${last[1]}T00:00:00Z`) === 864e5) {
      last[1] = day;
      last[2] += n;
    } else runs.push([day, day, n]);
  }
  return runs;
}

// Upload the PhonePe or bank UPI statement; every pending registration whose UTR and amount match is verified and gets
// its Bhojan Pass by email, and registrations verified by hand are linked to their payment. The tabs show what is left
// for a person to check.
export default function Payments({ call, token }) {
  const [view, setView] = useState("");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  // Date range of the payments shown (and of submission, for registrations whose UTR isn't found).
  const [range, setRange] = useState({ preset: "", from: "", to: "" });
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { setQuery(q.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const pickRange = (preset, from, to) => { setRange({ preset, from, to }); setPage(1); };
  const params = new URLSearchParams({ view, q: query, page: String(page), from: range.from, to: range.to }).toString();
  const load = useCallback(async () => {
    try {
      setData(await call(`/admin/payments?${params}`));
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, [call, params]);

  useEffect(() => { load(); }, [load]);

  async function uploadStatement(file) {
    if (!file) return;
    const form = new FormData();
    form.append("statement", file);
    setUploading(true);
    setResult(null);
    setError("");
    try {
      setResult(await upload("/admin/statement", form, { token }));
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  const counts = data?.counts;
  const items = data?.items || [];
  const exportHref = `/api/admin/payments/export.xlsx?${new URLSearchParams({ t: token, view: data?.kind === "payments" ? view : "", from: range.from, to: range.to })}`;
  const runs = runsOf(data?.days);

  return (
    <div className="admin-main">
      <section className="panel broadcast">
        <div className="panel-row">
          <div>
            <h2>Upload payment statement</h2>
            <p className="muted small">
              Upload the PhonePe statement (<i>History → Download statement</i>) or the bank's UPI statement as it is (.csv or .xlsx); the
              UTR is read from the UTR or RRN column, or from the 12-digit number in each row.
              Registrations whose UTR and amount match are verified and emailed their Bhojan Pass automatically; ones verified by hand are
              linked to their payment by UTR, or by payer name and amount. Uploading the same days again is fine: payments already uploaded are skipped.
            </p>
          </div>
          <label className={`btn file-btn${uploading ? " disabled" : ""}`}>
            <input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={uploading}
              onChange={(e) => { uploadStatement(e.target.files[0]); e.target.value = ""; }} />
            {uploading ? "Uploading…" : "Upload statement"}
          </label>
        </div>
        {runs.length > 0 && (
          <p className="small">
            Uploaded statements cover{" "}
            {runs.map(([first, last, n], i) => (
              <span key={first}>
                {i > 0 && ", "}
                <button className="link" onClick={() => pickRange("custom", first, last)}>
                  {first === last ? dayLabel(first) : `${dayLabel(first)} – ${dayLabel(last)}`}
                </button>{" "}
                <span className="muted">({n})</span>
              </span>
            ))}
            {runs.length > 1 && <span className="muted"> · days in between are missing or had no payments</span>}
          </p>
        )}
        {result && <UploadResult r={result} />}
      </section>

      <div className="ranges" role="group" aria-label="Date range">
        {RANGES.map(([key, label, dates]) => (
          <button key={key} className={range.preset === key ? "on" : ""} onClick={() => pickRange(key, ...dates())}>{label}</button>
        ))}
        <input type="date" aria-label="From" value={range.from} max={range.to || undefined}
          onChange={(e) => pickRange("custom", e.target.value, range.to)} />
        <span className="muted">to</span>
        <input type="date" aria-label="To" value={range.to} min={range.from || undefined}
          onChange={(e) => pickRange("custom", range.from, e.target.value)} />
      </div>

      <div className="toolbar">
        <div className="tabs" role="tablist">
          {TABS.map(([value, key, label]) => (
            <button key={value} role="tab" aria-selected={view === value} className={view === value ? "on" : ""} onClick={() => { setView(value); setPage(1); }}>
              {label}
              {counts && <span>{counts[key]}</span>}
            </button>
          ))}
        </div>
        <div className="filters">
          <input type="search" placeholder="Search UTR, name, reg no…" value={q} onChange={(e) => setQ(e.target.value)} />
          <a className="btn ghost small" href={exportHref}>Download Excel</a>
        </div>
      </div>

      {error && <div className="banner">{error}</div>}

      <div className="table-wrap">
        {data?.kind === "registrations" ? <NotFoundTable items={items} /> : <PaymentsTable items={items} />}
        {data && items.length === 0 && (
          <p className="empty">
            {query ? "Nothing matches this search."
              : range.from || range.to ? (view === "notFound" ? "No registrations submitted in these dates are waiting for their UTR." : "No payments in these dates.")
              : counts?.all === 0 && view !== "notFound" ? "No statement uploaded yet."
              : view === "notFound" ? "Every pending registration's UTR has been found."
              : "Nothing here."}
          </p>
        )}
        {!data && !error && <p className="empty">Loading…</p>}
      </div>

      {data && data.pages > 1 && (
        <div className="pager">
          <button className="btn ghost small" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span>Page {data.page} of {data.pages} · {data.total} results</span>
          <button className="btn ghost small" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}

      <p className="muted small">
        <i>Paid, not registered</i>: money received that no registration's UTR, or payer name and amount, accounts for: a UTR typed wrong,
        someone who paid twice, or a payment made for someone else under another name. Open the registration from <i>Registered, UTR not
        found</i> to see likely matches. Bank transfers (NEFT / IMPS / RTGS) aren't in the UPI statement, so verify those by hand from the
        bank statement.
      </p>
    </div>
  );
}

function UploadResult({ r }) {
  return (
    <div className="admin-msg">
      <p>
        Read <b>{r.credits}</b> payment{r.credits === 1 ? "" : "s"} received ({r.added} new
        {r.credits - r.added > 0 && `, ${r.credits - r.added} already uploaded`}
        {r.debits > 0 && `; ${r.debits} outgoing payment${r.debits === 1 ? "" : "s"} skipped`}
        {r.unreadable > 0 && `; ${r.unreadable} row${r.unreadable === 1 ? "" : "s"} without a readable UTR or amount`}).
      </p>
      <p>
        <b>{r.verified}</b> registration{r.verified === 1 ? "" : "s"} verified automatically
        {r.verified > 0 && (r.mailEnabled ? ": their Bhojan Passes are being emailed within the daily limit." : ". Email is not set up, so the passes are only in their accounts.")}
        {r.verified === 0 && "."}
      </p>
      {r.linked > 0 && (
        <p>
          <b>{r.linked}</b> registration{r.linked === 1 ? "" : "s"} already verified by hand linked to {r.linked === 1 ? "its" : "their"} payment
          {r.byName > 0 && ` (${r.byName} by payer name and amount)`}.
        </p>
      )}
      {r.differs.length > 0 && (
        <p>
          <b>{r.differs.length}</b> found with a different amount, to check:{" "}
          {r.differs.map((d, i) => (
            <span key={d._id}>{i > 0 && ", "}<Link to={regLink(d.regNo)}>{d.regNo}</Link> ({rupees(d.received)} received, {rupees(d.amount)} registered)</span>
          ))}
        </p>
      )}
      <p className="small">
        {r.unregistered} payment{r.unregistered === 1 ? "" : "s"} without a registration · {r.notFound} pending registration{r.notFound === 1 ? "" : "s"} whose UTR isn't in any statement yet
      </p>
    </div>
  );
}

function PaymentsTable({ items }) {
  return (
    <table className="reg-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Transaction details</th>
          <th>UTR</th>
          <th>Amount</th>
          <th>Registration</th>
          <th>Result</th>
        </tr>
      </thead>
      <tbody>
        {items.map((p) => (
          <tr key={p._id} className="static">
            <td className="nowrap">{p.date}<span className="sub-line">{p.time}</span></td>
            <td>{p.details}<span className="sub-line">{p.instrument}</span></td>
            <td className="mono">{p.utr}</td>
            <td className="nowrap"><b>{rupees(p.amount)}</b></td>
            <td>
              {p.reg ? <><Link to={regLink(p.reg.regNo)} className="mono">{p.reg.regNo}</Link><span className="sub-line">{p.reg.fullName}</span></> : <span className="muted">—</span>}
            </td>
            <td className="nowrap">
              {!p.reg ? <span className="chip">Not registered</span>
                : p.reg.amount !== p.amount ? <span className="chip rejected">Registered {rupees(p.reg.amount)}</span>
                : <span className={`chip ${p.reg.status}`}>{p.reg.status}</span>}
              {p.reg?.received?.byName && <span className="sub-line">matched by name</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function NotFoundTable({ items }) {
  return (
    <table className="reg-table">
      <thead>
        <tr>
          <th>Reg no.</th>
          <th>Name</th>
          <th>Mobile</th>
          <th>UTR</th>
          <th>Amount</th>
          <th>Submitted</th>
        </tr>
      </thead>
      <tbody>
        {items.map((r) => (
          <tr key={r._id} className="static">
            <td className="mono"><Link to={regLink(r.regNo)}>{r.regNo}</Link></td>
            <td><b>{r.fullName}</b>{r.payMode === "bank" && <span className="sub-line">Bank transfer</span>}</td>
            <td className="mono">{r.mobile}</td>
            <td className="mono">{r.utr || <span className="muted">none</span>}</td>
            <td className="nowrap"><b>{rupees(r.amount)}</b></td>
            <td className="nowrap">{when(r.createdAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

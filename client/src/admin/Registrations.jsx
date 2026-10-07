import { useCallback, useEffect, useState } from "react";
import { DISTRICTS } from "../../../shared/constants.js";
import Detail from "./Detail.jsx";

const TABS = [
  ["", "All"],
  ["pending", "Pending"],
  ["verified", "Verified"],
  ["rejected", "Rejected"],
];

const rupees = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
export const when = (d) =>
  new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

export default function Registrations({ call, token }) {
  const [stats, setStats] = useState(null);
  const [status, setStatus] = useState("pending");
  const [district, setDistrict] = useState("");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(null);

  // debounce search typing
  useEffect(() => {
    const t = setTimeout(() => { setQuery(q.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const params = new URLSearchParams({ status, district, q: query, page: String(page) }).toString();

  const load = useCallback(async () => {
    try {
      const [s, list] = await Promise.all([call("/admin/stats"), call(`/admin/registrations?${params}`)]);
      setStats(s);
      setData(list);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, [call, params]);

  useEffect(() => { load(); }, [load]);

  function onChanged(updated, removed) {
    setData((d) => ({
      ...d,
      items: removed ? d.items.filter((x) => x._id !== updated._id) : d.items.map((x) => (x._id === updated._id ? updated : x)),
    }));
    if (removed) setOpenId(null);
    call("/admin/stats").then(setStats).catch(() => {});
  }

  const items = data?.items || [];
  const open = items.find((x) => x._id === openId);
  const exportHref = `/api/admin/export.csv?${new URLSearchParams({ t: token, status, district, q: query })}`;

  return (
    <div className="admin-main">
      <div className="stats">
        <Stat label="Total registrations" value={stats?.total} />
        <Stat label="Waiting for verification" value={stats?.pending} accent />
        <Stat label="Verified" value={stats?.verified} />
        <Stat label="Rejected" value={stats?.rejected} />
        <Stat label="Verified amount" value={stats && rupees(stats.collected)} />
      </div>

      {stats && !stats.mailEnabled && (
        <p className="admin-hint">Email is not set up, so confirmations are not emailed automatically. Use the WhatsApp button on each registration, or add SMTP details to <code>server/.env</code>.</p>
      )}

      <div className="toolbar">
        <div className="tabs" role="tablist">
          {TABS.map(([value, label]) => (
            <button key={value} role="tab" aria-selected={status === value} className={status === value ? "on" : ""} onClick={() => { setStatus(value); setPage(1); }}>
              {label}
              {stats && <span>{value ? stats[value] : stats.total}</span>}
            </button>
          ))}
        </div>
        <div className="filters">
          <input type="search" placeholder="Search name, mobile, UTR, reg no…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={district} onChange={(e) => { setDistrict(e.target.value); setPage(1); }}>
            <option value="">All districts</option>
            {DISTRICTS.map((d) => <option key={d.value} value={d.value}>{d.en}</option>)}
          </select>
          <a className="btn ghost small" href={exportHref}>Export CSV</a>
        </div>
      </div>

      {error && <div className="banner">{error}</div>}

      <div className="table-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th>Reg no.</th>
              <th>Name &amp; institution</th>
              <th>District</th>
              <th>Mobile</th>
              <th>UTR</th>
              <th>Submitted</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r._id} onClick={() => setOpenId(r._id)} className={r._id === openId ? "sel" : ""} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setOpenId(r._id)}>
                <td className="mono">{r.regNo}</td>
                <td>
                  <b>{r.fullName}</b>
                  <span className="sub-line">{r.institution.split("\n")[0]}</span>
                </td>
                <td>{r.district}</td>
                <td className="mono">{r.mobile}</td>
                <td className="mono">{r.utr}</td>
                <td className="nowrap">{when(r.createdAt)}</td>
                <td><span className={`chip ${r.status}`}>{r.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && items.length === 0 && (
          <p className="empty">{query || district ? "No registrations match these filters." : status === "pending" ? "Nothing waiting for verification." : "No registrations yet."}</p>
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

      {stats?.byDistrict?.length > 0 && (
        <details className="districts">
          <summary>Registrations by district</summary>
          <ul>
            {stats.byDistrict.map((d) => <li key={d.district}><span>{d.district}</span><b>{d.count}</b></li>)}
          </ul>
        </details>
      )}

      {open && <Detail reg={open} call={call} token={token} onClose={() => setOpenId(null)} onChanged={onChanged} />}
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div className={`stat${accent ? " accent" : ""}`}>
      <b>{value ?? "–"}</b>
      <span>{label}</span>
    </div>
  );
}

import { useEffect, useState } from "react";

const at = (d) => new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

// Loads a bulk-email summary (/admin/passes or /admin/certificates) and keeps it fresh while a send is going on.
export function useBulk(call, path, refreshKey) {
  const [info, setInfo] = useState(null);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    let timer;
    const load = () =>
      call(path)
        .then((d) => {
          setInfo(d);
          if (d.run?.running) timer = setTimeout(load, 3000);
          else if (d.queued) timer = setTimeout(load, 60000);
        })
        .catch((e) => setMsg(e.message));
    load();
    return () => clearTimeout(timer);
  }, [call, path, refreshKey, info?.run?.startedAt, info?.queued]);

  async function act(action) {
    setMsg("");
    try {
      setInfo(await call(`${path}/${action}`, { method: "POST" }));
    } catch (err) {
      setMsg(err.message);
    }
  }
  return { info, msg, act };
}

// Progress of a bulk send that goes out in daily phases, with today's email count against the daily limit.
export function BulkProgress({ info, onStop, noun }) {
  const { run, quota, queued } = info;
  const waiting = queued && !run?.running && run?.waitingUntil;
  return (
    <>
      {run?.running && (
        <p className="muted small">Sending… {run.sent + run.failed} of {run.total} done in this phase. You can leave this page; it keeps going.</p>
      )}
      {waiting && (
        <p className="muted small">
          Paused at the daily limit. The remaining {noun} go out automatically from about <b>{at(run.waitingUntil)}</b>.
          {run.error && ` (${run.error})`}
        </p>
      )}
      {queued && !run?.running && !waiting && <p className="muted small">Queued: starts within a few minutes.</p>}
      {!queued && run && !run.running && run.total > 0 && (
        <p className="muted small">Last run: {run.sent} sent, {run.failed} failed.{run.error && ` Stopped: ${run.error}`}</p>
      )}
      {quota && (
        <p className="muted small">
          Emails in the last 24 hours: <b>{quota.used}</b> of the daily limit of <b>{quota.limit}</b> (change it under Payment &amp; settings).
          {queued && <> · <button type="button" className="link danger" onClick={onStop}>Stop sending</button></>}
        </p>
      )}
    </>
  );
}

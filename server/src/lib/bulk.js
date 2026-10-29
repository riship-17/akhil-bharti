import { Registration, Settings } from "../models.js";
import { isLimitError, mailQuota, sendCertificate, sendPass } from "./mail.js";
import { newPassToken } from "./pass.js";

// Bulk emails (Bhojan Pass broadcast, certificates), sent in daily phases so the email provider's limit is never hit.
// Pressing the button queues the job in Settings (so it survives a restart). A job sends while the daily limit
// allows, pauses when it is used up, and carries on by itself once room frees up in the rolling 24 hours.

const JOBS = {
  passes: {
    todo: () => Registration.find({ status: "verified", "pass.emailedAt": { $exists: false } }).sort({ createdAt: 1 }),
    send: (r, origin) => sendPass(r, origin),
  },
  certificates: {
    todo: () => Registration.find({ status: "verified", "certificate.emailedAt": { $exists: false } }).sort({ createdAt: 1 }),
    send: async (r, origin) => {
      const s = await Settings.load();
      return sendCertificate(r, { origin, signatories: s.certificate?.signatories });
    },
  },
};

// Progress of each job's current (or last) phase, in memory. `skip` holds people whose email failed during this job,
// so a bad address is tried once per press of the button rather than every phase.
export const runs = {};

export async function ensurePassToken(r) {
  // The pass link and the certificate download link both use the pass token as their secret.
  if (!r.pass?.token) {
    r.set("pass.token", newPassToken());
    await r.save();
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const queueOf = async (kind) => (await Settings.load()).mail?.queue?.[kind];
const clearQueue = (kind) => Settings.updateOne({ key: "main" }, { $unset: { [`mail.queue.${kind}`]: "" } });

// Status for the admin page: whether the job is queued, sending, or waiting for the daily limit.
export async function bulkStatus(kind) {
  const [queued, quota] = await Promise.all([queueOf(kind), mailQuota()]);
  const run = runs[kind];
  return {
    queued: Boolean(queued?.since),
    run: run && { running: run.running, total: run.total, sent: run.sent, failed: run.failed, startedAt: run.startedAt, waitingUntil: run.waitingUntil, error: run.error },
    quota,
  };
}

// Starts (or restarts) a job. Failed people from an earlier press are tried again.
export async function queueBulk(kind, origin) {
  if (!runs[kind]?.running) runs[kind] = undefined;
  await Settings.updateOne({ key: "main" }, { $set: { [`mail.queue.${kind}`]: { since: new Date(), origin } } });
  runJob(kind).catch((err) => console.error(`[${kind}] bulk send failed:`, err));
}

export async function stopBulk(kind) {
  await clearQueue(kind);
  if (runs[kind]?.running) runs[kind].stop = true;
  else if (runs[kind]) runs[kind].waitingUntil = undefined;
}

async function runJob(kind) {
  const prev = runs[kind];
  if (prev?.running || (prev?.waitingUntil && prev.waitingUntil > new Date())) return;
  const queued = await queueOf(kind);
  if (!queued?.since) return;

  const sameJob = prev?.since?.getTime() === queued.since.getTime();
  const run = (runs[kind] = {
    running: true, sent: 0, failed: 0, startedAt: new Date(), since: queued.since, skip: sameJob ? prev.skip : new Set(),
  });
  try {
    const todo = (await JOBS[kind].todo()).filter((r) => !run.skip.has(String(r._id)));
    run.total = todo.length;
    let done = true;
    for (const r of todo) {
      if (run.stop) { done = false; break; }
      const quota = await mailQuota();
      if (!quota.left) {
        run.waitingUntil = quota.freeAt;
        done = false;
        break;
      }
      await ensurePassToken(r);
      const { sent, error } = await JOBS[kind].send(r, queued.origin);
      if (sent) {
        run.sent++;
      } else if (isLimitError(error)) {
        // Resend's own limit is used up (e.g. the plan's daily quota): wait an hour and carry on.
        run.waitingUntil = new Date(Date.now() + 60 * 60 * 1000);
        run.error = error;
        done = false;
        break;
      } else {
        run.failed++;
        run.skip.add(String(r._id));
      }
      await sleep(600); // stay under Resend's rate limit
    }
    if (done) await clearQueue(kind);
  } catch (err) {
    console.error(`[${kind}] bulk send stopped:`, err);
    run.error = err.message;
  } finally {
    run.running = false;
    run.finishedAt = new Date();
  }
}

// Every few minutes, carry on any queued job that is paused for the daily limit or was cut off by a restart.
export function startBulkScheduler() {
  const tick = () => Promise.all(Object.keys(JOBS).map((kind) => runJob(kind).catch((err) => console.error(`[${kind}]`, err))));
  setInterval(tick, 5 * 60 * 1000).unref();
  tick();
}

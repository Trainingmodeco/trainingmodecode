#!/usr/bin/env node
// run-log.mjs: the book of one queue request (credits). It lives in <workDir>/queue-runs.json and remembers, for every request the owner
// sent (control.queue.requestedAt): what the balance was at the start, what was spent, which job was submitted for which stretch and
// whether the request was finished. So that (1) one press of the queue button is never run twice, (2) a run that died can be resumed
// without a fresh cap, (3) the budget rule is calculated here from the balance, not by hand, (4) a job that was submitted is never
// submitted again.
//
// Usage (every call prints ONE line of JSON; exit 3 = the rule says STOP, exit 2 = bad arguments):
//   node run-log.mjs <workDir> start  --requested-at <t> --cap <credits> --balance <balance now> [--count <n>]
//        Opens the record of this request, or resumes the one that is open. Exit 3 when the request was already finished: stop, tell the
//        owner what it made, and ask them to press the queue button again if they want more. Prints { requestedAt, cap, startBalance,
//        spent, resumed, estEach, jobs }.
//   node run-log.mjs <workDir> budget --requested-at <t> --balance <balance now> [--quote <credits get_cost said for this submission>]
//        THE BUDGET RULE. spent = what the balance fell since the start (never less than the costs noted with `item`). estEach (E) = the
//        largest real cost of an item seen in any request so far, 6 before the first. Without --quote the check is spent + E <= cap (at the
//        top of an item); with --quote it is spent + quote <= cap (just before a submission, retries too). Prints { ok, spent, cap, left,
//        estEach, need, reason }. Exit 3 when not ok: submit nothing more; every item not yet made is "not made: the cap was reached".
//   node run-log.mjs <workDir> job    --requested-at <t> --seg <segId> --job <job id> [--seconds <length asked>] [--hold]
//        Notes the job right after the paid submission, before anything else. A third submission for one stretch is refused (exit 3): one
//        retry per item.
//   node run-log.mjs <workDir> item   --requested-at <t> --seg <segId> [--cost <credits this call adds>] [--outcome made|failed|unknown] [--note <text>]
//        Adds the credits an item cost (balance before minus after, for each render) and/or notes its outcome. "unknown" is for a job
//        that was not terminal after 120 polls: it is never submitted again and counts as spent (give --cost the largest price seen, E).
//   node run-log.mjs <workDir> finish --requested-at <t> --balance <balance now>
//        Closes the request: later calls of start for it exit 3.
//   node run-log.mjs <workDir> show [--requested-at <t>]
//        Prints the record(s).
import fs from 'node:fs';
import { args, fail, readRuns, writeRuns } from './_lib.mjs';
const USAGE = 'usage: node run-log.mjs <workDir> start|budget|job|item|finish|show --requested-at <t> [--cap n] [--balance n] [--quote n] [--seg id] [--job id] [--seconds s] [--hold] [--cost n] [--outcome made|failed|unknown] [--note text]';
const a = args(process.argv.slice(2), ['hold']); const [workDir, cmd] = a._; if (!workDir || !cmd) fail('run-log.mjs: a work folder and a command are needed', USAGE);
if (!fs.existsSync(workDir)) fail(`run-log.mjs: no such folder: ${workDir}`);
const out = (o, code = 0) => { process.stdout.write(`${JSON.stringify(o)}\n`); process.exit(code); };
const num = (v, what, { min = -Infinity } = {}) => { if (v === undefined || v === true || String(v).trim() === '' || !Number.isFinite(Number(v)) || Number(v) < min) fail(`run-log.mjs: ${what} must be a number${min > -Infinity ? ` of at least ${min}` : ''}`, USAGE); return Number(v); };
const runs = readRuns(workDir); const save = () => writeRuns(workDir, runs); const now = () => new Date().toISOString(); const r2 = (v) => Math.round(v * 100) / 100;
if (cmd === 'show') { const t = a['requested-at']; out(t ? runs.find((r) => r.requestedAt === t) || null : runs); }
const at = typeof a['requested-at'] === 'string' ? a['requested-at'].trim() : ''; if (!at) fail('run-log.mjs: --requested-at is needed (control.queue.requestedAt)', USAGE);
const largest = () => Math.max(0, ...runs.map((r) => Number(r.largest) || 0)); const EST = () => (largest() > 0 ? largest() : 6);
const sumCosts = (r) => Object.values(r.items || {}).reduce((t, it) => t + (Number(it.cost) || 0), 0);
const spentNow = (r, balance) => r2(Math.max(Number.isFinite(balance) ? Number(r.startBalance) - balance : 0, sumCosts(r), 0));
let rec = runs.find((r) => r.requestedAt === at) || null;

if (cmd === 'start') {
  const balance = num(a.balance, '--balance', { min: 0 });
  if (rec && rec.finished) out({ ok: false, stop: `this request (requestedAt ${at}) was already run to the end on ${rec.finished} and spent ${rec.spent} credits: tell the owner what it made, and ask them to press the queue button again if they want more`, requestedAt: at, spent: rec.spent, jobs: rec.jobs }, 3);
  const resumed = !!rec;
  if (!rec) { const cap = num(a.cap, '--cap', { min: 0 }); rec = { requestedAt: at, cap, count: a.count !== undefined ? Number(a.count) || null : null, startedAt: now(), startBalance: balance, lastBalance: balance, finished: null, spent: 0, largest: 0, jobs: {}, items: {} }; runs.push(rec); }
  rec.lastBalance = balance; rec.spent = spentNow(rec, balance); save();
  out({ ok: true, requestedAt: at, cap: rec.cap, startBalance: rec.startBalance, spent: rec.spent, resumed, estEach: EST(), jobs: rec.jobs });
}
if (!rec) fail(`run-log.mjs: no record of the request ${at}: call start first`, USAGE);
if (cmd === 'budget') {
  const balance = num(a.balance, '--balance', { min: 0 }); const quote = a.quote !== undefined ? num(a.quote, '--quote', { min: 0 }) : null; const spent = spentNow(rec, balance); rec.lastBalance = balance; rec.spent = spent; save();
  const need = quote !== null ? quote : EST(); const ok = !rec.finished && spent + need <= rec.cap + 1e-9;
  out({ ok, spent, cap: rec.cap, left: r2(rec.cap - spent), estEach: EST(), need, ...(ok ? {} : { reason: rec.finished ? 'this request is finished' : `spent ${spent} + ${quote !== null ? `the price of this render ${need}` : `the largest cost so far ${need}`} is over the cap ${rec.cap}: submit nothing more; the items not yet made are "not made: the cap was reached"` }) }, ok ? 0 : 3);
}
if (cmd === 'job') {
  const seg = String(a.seg || ''); const job = String(a.job === undefined || a.job === true ? '' : a.job).trim(); if (!seg || !job) fail('run-log.mjs: --seg and --job are needed', USAGE);
  const it = rec.items[seg] || (rec.items[seg] = { cost: 0, outcome: null, job: null, jobs: [], seconds: null, hold: false, note: null }); it.jobs = Array.isArray(it.jobs) ? it.jobs : [];
  if (it.jobs.includes(job)) out({ ok: true, segId: seg, job, attempts: it.jobs.length, note: 'that job was already noted' });
  if (it.jobs.length >= 2) out({ ok: false, stop: `${seg} already has two submissions (${it.jobs.join(', ')}): one retry per item, never a second`, jobs: it.jobs }, 3);
  it.jobs.push(job); it.job = job; if (a.seconds !== undefined) it.seconds = Number(a.seconds) || null; it.hold = !!a.hold; rec.jobs[seg] = job; save(); out({ ok: true, segId: seg, job, attempts: it.jobs.length });
}
if (cmd === 'item') {
  const seg = String(a.seg || ''); if (!seg) fail('run-log.mjs: --seg is needed', USAGE); const it = rec.items[seg] || (rec.items[seg] = { cost: 0, outcome: null, job: null, jobs: [], seconds: null, hold: false, note: null });
  if (a.cost !== undefined) it.cost = r2((Number(it.cost) || 0) + num(a.cost, '--cost', { min: 0 }));
  if (a.outcome !== undefined) { if (!['made', 'failed', 'unknown'].includes(String(a.outcome))) fail('run-log.mjs: --outcome is made, failed or unknown', USAGE); it.outcome = String(a.outcome); }
  if (typeof a.note === 'string') it.note = a.note; rec.largest = Math.max(Number(rec.largest) || 0, Number(it.cost) || 0); rec.spent = r2(Math.max(Number(rec.spent) || 0, sumCosts(rec))); save();
  out({ ok: true, segId: seg, cost: it.cost, outcome: it.outcome, requestSpent: rec.spent, estEach: EST() });
}
if (cmd === 'finish') {
  const balance = num(a.balance, '--balance', { min: 0 }); rec.lastBalance = balance; rec.spent = spentNow(rec, balance); rec.finished = now(); save();
  const made = Object.entries(rec.items).filter(([, it]) => it.outcome === 'made').length, failed = Object.entries(rec.items).filter(([, it]) => it.outcome === 'failed').length, unknown = Object.entries(rec.items).filter(([, it]) => it.outcome === 'unknown').map(([id]) => id);
  out({ ok: true, requestedAt: at, finished: rec.finished, spent: rec.spent, cap: rec.cap, startBalance: rec.startBalance, balance, made, failed, unknown });
}
fail(`run-log.mjs: unknown command ${cmd}`, USAGE);

// Phase 2 · 2.6 — PAR-Q+ pre-participation screening. Shown the first time the
// athlete opens a Training Camp. A "yes" to any question never hard-blocks:
// it recommends medical guidance and softly defaults the camp toward Easy. The
// result is remembered so the gate does not nag. The owner (2026-11-23): "just
// do once in the beginning or after a long hiatus", so the camp asks again
// after a long break (parqDue). Kept tiny + localStorage-backed, same shape as
// campProgress.
import { powerAt, daysBetween, RUSTY_DAYS } from './power';
import { localIso } from './weekStreak';

const KEY = 'tm_camp_parq';

// A long break: the RUSTY threshold (data/power, 30 days without a training
// day), the app's one notion of "away a long time".
export const PARQ_BREAK_DAYS = RUSTY_DAYS;

// { done: true, anyYes: boolean, ts: number }  — or { done: false } if never taken.
export function loadParq() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { done: false, anyYes: false };
    const p = JSON.parse(raw);
    return { done: !!p.done, anyYes: !!p.anyYes, ts: p.ts };
  } catch { return { done: false, anyYes: false }; }
}

export function saveParq(anyYes) {
  const rec = { done: true, anyYes: !!anyYes, ts: Date.now() };
  try { localStorage.setItem(KEY, JSON.stringify(rec)); } catch { /* quota */ }
  return rec;
}

export function resetParq() {
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
}

// Whether the camp asks the health check when it opens. Pure.
//   parq: loadParq() · rows: the session rows (tm_user_stats.sessions) · now: ms
// → 'first'   never taken: ask (as before);
//   'break'   taken, nothing flagged, and both the last training day and the
//             check itself are PARQ_BREAK_DAYS or more ago: ask again;
//   null      do not ask. An athlete whose answers flagged a "yes" keeps what
//             they had: the EASY RECOMMENDED advice and the Easy default, never
//             re-asked (the owner's safety rule: their flow does not change).
// The days are local calendar days, the training days the week streak and
// POWER count (weekStreak.isTrainingRow), so a bonus row never counts.
export function parqDue(parq, rows, now = Date.now()) {
  if (!parq?.done) return 'first';
  if (parq.anyYes) return null;
  const today = localIso(now);
  if (!today) return null;
  const takenDay = Number.isFinite(parq.ts) ? localIso(parq.ts) : null;
  const lastDay = powerAt(rows, now).lastDay;
  const last = [takenDay, lastDay].filter(Boolean).sort().at(-1);
  if (!last) return null; // no date to measure a break from: do not nag
  return daysBetween(last, today) >= PARQ_BREAK_DAYS ? 'break' : null;
}

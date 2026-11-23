// POWER (retention, switch `power`): how charged the athlete's fighter is.
// It stays full for 3 days after a training day, then drains in a straight
// line to 0% at day 28 (about 4 weeks). From 30 days without a training day
// the fighter is RUSTY, until one finished session REVIVES it to 100%.
// A brand-new athlete (no training day yet) is 'new': no drain, no RUSTY.
//
// Pure: no storage, no clock of its own, nothing written. Recomputed from the
// session rows each time with the week streak's training-day rule
// (weekStreak.isTrainingRow, local calendar days), so a sync, a row synced in
// late or a change of clock cannot leave it stale. It never touches XP,
// levels, the streak or badges: nothing earned is ever taken away. The app
// side (data/powerStore.js) keeps only "already shown" markers.
import { trainingDays, localIso, isTrainingRow } from './weekStreak';

export const FULL_DAYS = 3;   // full for 3 days after the last training day
export const EMPTY_DAY = 28;  // 0% at day 28
export const RUSTY_DAYS = 30; // RUSTY from 30 days without a training day
export const LOW_PCT = 40;    // 'low' at 40% or less

const DAY_MS = 86400000;

// Whole calendar days from one local date ('YYYY-MM-DD') to another, by the
// date parts (UTC maths on a date, not a clock), so a daylight-saving change
// never moves a day.
export function daysBetween(fromIso, toIso) {
  const [y1, m1, d1] = fromIso.split('-').map(Number);
  const [y2, m2, d2] = toIso.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / DAY_MS);
}

// The power `days` after the last training day (0 = trained today).
export function pctAfter(days) {
  if (days <= FULL_DAYS) return 100;
  if (days >= EMPTY_DAY) return 0;
  return Math.round((100 * (EMPTY_DAY - days)) / (EMPTY_DAY - FULL_DAYS));
}

export function stateAfter(days) {
  if (days == null) return 'new';
  if (days >= RUSTY_DAYS) return 'rusty';
  const pct = pctAfter(days);
  if (pct >= 100) return 'full';
  return pct <= LOW_PCT ? 'low' : 'draining';
}

const latest = (days) => { let m = null; for (const d of days) if (!m || d > m) m = d; return m; };

// { pct, state: 'new'|'full'|'draining'|'low'|'rusty', daysSince, lastDay }
// A row dated after today (a clock running ahead) counts once its day comes.
export function powerAt(rows, now = Date.now()) {
  const today = localIso(now) || localIso(Date.now());
  const lastDay = latest(trainingDays(rows, today));
  if (!lastDay) return { pct: 100, state: 'new', daysSince: null, lastDay: null };
  const daysSince = daysBetween(lastDay, today);
  return { pct: pctAfter(daysSince), state: stateAfter(daysSince), daysSince, lastDay };
}

// ── the moments, each shown once ───────────────────────────────────────────
// `shown` holds the ids already shown: { seen: [ids] }. A drain and a rusty
// spell are keyed by the last training day before them; a revive by the
// training day it came after (the spell it ended).
export const lowKey = (lastDay) => `low:${lastDay}`;
export const rustyKey = (lastDay) => `rusty:${lastDay}`;
export const reviveKey = (prevDay) => `revive:${prevDay}`;
const seenSet = (shown) => new Set(Array.isArray(shown?.seen) ? shown.seen : []);

// Home's quiet notice at 'low', once per drain.
export function lowNotice(power, shown = {}) {
  if (power?.state !== 'low' || !power.lastDay) return null;
  const id = lowKey(power.lastDay);
  return seenSet(shown).has(id) ? null : { id, kind: 'low', pct: power.pct };
}

// The RUSTY pop-up, once per rusty spell.
export function rustyPopup(power, shown = {}) {
  if (power?.state !== 'rusty' || !power.lastDay) return null;
  const id = rustyKey(power.lastDay);
  return seenSet(shown).has(id) ? null : { id, daysSince: power.daysSince, lastDay: power.lastDay };
}

// Did the training day `day` revive the fighter? It did when the training day
// before it had left the fighter 'low' or 'rusty' by that morning.
// Returns null or { id, day, prevDay, from: 'low'|'rusty', daysSince }.
export function reviveOn(days, day) {
  let prev = null;
  for (const d of days) if (d < day && (!prev || d > prev)) prev = d;
  if (!prev) return null;
  const gap = daysBetween(prev, day);
  const from = stateAfter(gap);
  if (from !== 'low' && from !== 'rusty') return null;
  return { id: reviveKey(prev), day, prevDay: prev, from, daysSince: gap };
}

// The end screen's revive line: the session that just banked (the newest
// training row, today's first, banked within `freshMs`) revived the fighter,
// and that revive has not been shown. `finisher`: the session ran a cardio
// finisher, whose own Cardio row is then the session's (as sessionMoment).
export function reviveMoment({ rows, now = Date.now(), shown = {}, freshMs = 15 * 60 * 1000, finisher = false }) {
  const t = typeof now === 'number' ? now : new Date(now).getTime();
  const today = localIso(t);
  if (!today) return null;
  let newest = null, todayRows = 0;
  for (const s of Array.isArray(rows) ? rows : []) {
    if (!isTrainingRow(s)) continue;
    const at = new Date(s.completedAt).getTime();
    if (at > t + 60000) continue;
    if (localIso(at) === today) todayRows += 1;
    if (!newest || at >= newest.at) newest = { at, s };
  }
  const own = finisher && newest?.s.type === 'Cardio' ? 2 : 1;
  if (!newest || localIso(newest.at) !== today || todayRows > own || t - newest.at > freshMs) return null;
  const r = reviveOn(trainingDays(rows, today), today);
  return r && !seenSet(shown).has(r.id) ? r : null;
}

// A revive on Home, for a session that ended on a screen with no YOUR
// PROGRESS card (Cardio, Practice, Coach's Tapes, the classic stage clear):
// the newest training day, today or yesterday, revived and not yet shown.
export function homeRevive(rows, now = Date.now(), shown = {}) {
  const today = localIso(now);
  const days = trainingDays(rows, today);
  const last = latest(days);
  if (!last || daysBetween(last, today) > 1) return null;
  const r = reviveOn(days, last);
  return r && !seenSet(shown).has(r.id) ? r : null;
}

// Home's one power notice: a revive not yet shown, else the low notice.
// Returns null or { id, kind: 'revive'|'low', ... }.
export function powerNotice(rows, now = Date.now(), shown = {}) {
  const r = homeRevive(rows, now, shown);
  if (r) return { ...r, kind: 'revive' };
  return lowNotice(powerAt(rows, now), shown);
}

// ── copy (plain and true; no guilt) ────────────────────────────────────────
export const REVIVE_LINE = 'REVIVED · POWER 100%';

export function powerNoticeCopy(n) {
  if (!n) return null;
  if (n.kind === 'revive') return 'Revived: your fighter is back to 100% power.';
  // A no-break space keeps "power (36%)" together on a narrow line.
  return `Your fighter is losing power\u00A0(${n.pct}%). One session revives it.`;
}

export function rustyCopy(p) {
  const d = Number(p?.daysSince) || RUSTY_DAYS;
  return {
    title: 'RUSTY',
    since: `${d} days since your last session.`,
    kept: 'Your level, XP and badges are all still here.',
  };
}

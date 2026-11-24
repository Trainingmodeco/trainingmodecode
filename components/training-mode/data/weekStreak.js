// The weekly streak (retention feature 1, switch `weeks`): weeks that reach
// the athlete's weekly target of training days, so a rest day never breaks it.
//
// Pure: no storage, no clock of its own. Everything is recomputed from the
// session rows each time (replayed from the first training week), so a sync,
// a session finished offline and synced in late, or a change of clock cannot
// leave a stale count behind. The app side (data/weekStreakStore.js) reads the
// rows and the target and keeps only "moment already shown" markers.
//
// The rules (docs/retention/BUILD-SPEC.md, section 1):
//   - A training day is the LOCAL date of a real finished session: not an
//     award row (Mission of the Day, Hybrid bonus, Start Here lesson), not a
//     session with no work done (a 0-round END, a quit that paid nothing), not
//     one the integrity check refused (validation_failed, stored as
//     `unverified`). A Coach's Tape counts when marked cleared, paid or not.
//   - Weeks run Monday to Sunday in local time.
//   - Streak = consecutive past weeks on target, plus the current week once it
//     reaches its target. The current week never counts as missed until it ends.
//   - A past week under target spends a freeze if one is held (the streak is
//     kept, the week adds nothing); else the streak goes to 0. With no streak
//     to protect, a short week costs nothing (a first, partial week included).
//   - Freezes: everyone starts with 1; +1 for every 4 consecutive weeks on
//     target (a week covered by a freeze keeps that run going but adds
//     nothing); hold at most 2. Earned by training only.
//   - The target is one setting (Profile's Game Plan "Days per week", 2 to 6,
//     4 for someone who never chose). A change applies from the next Monday.
import { sessionMode } from './tiers';

export const WEEK_TARGET_DEFAULT = 4;
export const WEEK_TARGET_MIN = 2;
export const WEEK_TARGET_MAX = 6;
export const WEEK_TARGETS = [2, 3, 4, 5, 6];
export const START_FREEZES = 1;
export const MAX_FREEZES = 2;
export const WEEKS_PER_FREEZE = 4;

const DAY_MS = 86400000;
const pad = (n) => String(n).padStart(2, '0');

// ── dates (local calendar days as 'YYYY-MM-DD') ─────────────────────────────
export function localIso(when) {
  const d = when instanceof Date ? when : new Date(when);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Calendar arithmetic on the date parts (UTC maths on a date, not a clock),
// so a daylight-saving change never moves a day.
export function addDaysIso(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) + n * DAY_MS);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

// 0 = Monday … 6 = Sunday.
export function weekdayIndex(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export const weekStartIso = (iso) => addDaysIso(iso, -weekdayIndex(iso));

export const clampTarget = (n) => {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return WEEK_TARGET_DEFAULT;
  return Math.min(WEEK_TARGET_MAX, Math.max(WEEK_TARGET_MIN, v));
};

// ── what counts ────────────────────────────────────────────────────────────
const TAPE_TYPE = "Coach's Tapes";

// A real, finished, valid session row.
export function isTrainingRow(s) {
  if (!s || typeof s !== 'object' || !s.completedAt) return false;
  if (sessionMode(s) === 'bonus') return false;
  if (s.unverified) return false;
  if (typeof s.completedCount === 'number' && !(s.completedCount > 0)) return false;
  // A Coach's Tape marked cleared is a finished session even when the tapes'
  // daily caps paid it nothing (the same tape again, or a third tape today).
  if (s.type !== TAPE_TYPE && typeof s.xpEarned === 'number' && !(s.xpEarned > 0)) return false;
  // A logged run with neither a time nor a distance is not a session.
  if (s.type === 'Cardio' && !(Number(s.completedTimeSeconds) > 0) && !s.completedDistance) return false;
  return localIso(s.completedAt) !== null;
}

// Local dates with at least one training row, up to and including `today`
// (a row from a clock running ahead counts once its day comes).
export function trainingDays(rows, today) {
  const out = new Set();
  for (const s of Array.isArray(rows) ? rows : []) {
    if (!isTrainingRow(s)) continue;
    const d = localIso(s.completedAt);
    if (d && (!today || d <= today)) out.add(d);
  }
  return out;
}

// The target that holds for the week starting `weekIso`. `settings.targets`
// is the change log [{ from: <Monday iso, or '' for "always">, days }]; with
// no entry yet, `settings.target` (the plain setting) holds for every week.
export function targetForWeek(settings, weekIso) {
  const log = Array.isArray(settings?.targets) ? settings.targets : [];
  let pick = null;
  for (const e of log) {
    if (!e || typeof e.from !== 'string') continue;
    if (e.from <= weekIso && (!pick || e.from >= pick.from)) pick = e;
  }
  return clampTarget(pick ? pick.days : (settings?.target ?? WEEK_TARGET_DEFAULT));
}

// ── the replay ─────────────────────────────────────────────────────────────
// { streak, freezes, longest, nextFreezeIn, thisWeek, events }
//   thisWeek: { start, days: 7 × 'done'|'rest'|'today'|'future', done, target, todayIndex }
//   events:   [{ id, type: 'week_complete'|'freeze_earned'|'freeze_used'|'reset', week, ... }]
//   nextFreezeIn: weeks on target until the next freeze (null while 2 are held)
export function computeWeekStreak(rows, settings = {}, now = Date.now()) {
  const today = localIso(now) || localIso(Date.now());
  const thisMonday = weekStartIso(today);
  const days = trainingDays(rows, today);
  const doneIn = (monday) => {
    let n = 0;
    for (let i = 0; i < 7; i++) if (days.has(addDaysIso(monday, i))) n++;
    return n;
  };

  let streak = 0, longest = 0, run = 0, freezes = START_FREEZES;
  const events = [];
  const onTarget = (week, target, done) => {
    streak += 1; run += 1;
    longest = Math.max(longest, streak);
    events.push({ id: `complete:${week}`, type: 'week_complete', week, streak, target, done });
    if (run % WEEKS_PER_FREEZE === 0 && freezes < MAX_FREEZES) {
      freezes += 1;
      events.push({ id: `earned:${week}`, type: 'freeze_earned', week, freezes, run });
    }
  };

  const sorted = [...days].sort();
  if (sorted.length) {
    for (let w = weekStartIso(sorted[0]); w < thisMonday; w = addDaysIso(w, 7)) {
      const target = targetForWeek(settings, w);
      const done = doneIn(w);
      if (done >= target) { onTarget(w, target, done); continue; }
      if (streak === 0) continue; // nothing to protect: a short week costs nothing
      if (freezes > 0) {
        freezes -= 1;
        events.push({ id: `used:${w}`, type: 'freeze_used', week: w, streak, freezes, done, target });
      } else {
        events.push({ id: `reset:${w}`, type: 'reset', week: w, streak, done, target });
        streak = 0; run = 0;
      }
    }
  }

  // The current week: counts once it reaches its target, never missed until it ends.
  const target = targetForWeek(settings, thisMonday);
  const done = doneIn(thisMonday);
  if (done >= target) onTarget(thisMonday, target, done);

  const todayIndex = weekdayIndex(today);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = addDaysIso(thisMonday, i);
    if (days.has(d)) return 'done';
    if (i === todayIndex) return 'today';
    return i < todayIndex ? 'rest' : 'future';
  });

  return {
    streak,
    longest,
    freezes,
    nextFreezeIn: freezes >= MAX_FREEZES ? null : WEEKS_PER_FREEZE - (run % WEEKS_PER_FREEZE),
    thisWeek: { start: thisMonday, days: weekDays, done, target, todayIndex },
    events,
  };
}

// The target that will hold from next Monday (what the picker shows as chosen).
export function pendingTarget(settings, now = Date.now()) {
  const today = localIso(now);
  return targetForWeek(settings, addDaysIso(weekStartIso(today), 7));
}

// The change log after picking `days` now: the current week keeps the value it
// had, the new one starts next Monday. Picking the value that already holds
// drops the pending change.
export function withTargetChange(settings, days, now = Date.now()) {
  const today = localIso(now);
  const thisMonday = weekStartIso(today);
  const nextMonday = addDaysIso(thisMonday, 7);
  const current = targetForWeek(settings, thisMonday);
  const log = (Array.isArray(settings?.targets) ? settings.targets : [])
    .filter((e) => e && typeof e.from === 'string' && e.from <= thisMonday)
    .map((e) => ({ from: e.from, days: clampTarget(e.days) }));
  // Before the first change the plain setting held for every week: write it down.
  if (!log.length) log.push({ from: '', days: current });
  const next = clampTarget(days);
  if (next !== current) log.push({ from: nextMonday, days: next });
  return log;
}

// ── the moments ────────────────────────────────────────────────────────────
// The end-screen strip, from the rows as they are right after the session was
// banked. `shown` holds the markers of moments already shown:
//   { day: <iso of the last day whose strip was shown>, seen: [event ids] }
// Returns null, or
//   { kind: 'kept'|'complete'|'extra', done, target, streak, freezes, days,
//     popIndex, freezeEarned: null | { id, freezes } }
// Only when the newest training row is today's first, banked within the last
// `freshMs` (the session that just ended), and today's strip has not been shown.
// `finisher`: the session ran a cardio finisher, which banks a Cardio row of
// its own after the session's (CardioFinisherPlayer); a Cardio row that is the
// newest is then the session's own, not a second session.
export function sessionMoment({ rows, settings = {}, now = Date.now(), shown = {}, freshMs = 15 * 60 * 1000, finisher = false }) {
  const today = localIso(now);
  const t = typeof now === 'number' ? now : new Date(now).getTime();
  if (!today || shown?.day === today) return null;
  let newest = null, todayRows = 0;
  for (const s of Array.isArray(rows) ? rows : []) {
    if (!isTrainingRow(s)) continue;
    const at = new Date(s.completedAt).getTime();
    if (at > t + 60000) continue;
    if (localIso(at) === today) todayRows += 1;
    // On a tie the row banked later (later in the list) is the newest.
    if (!newest || at >= newest.at) newest = { at, s };
  }
  const own = finisher && newest?.s.type === 'Cardio' ? 2 : 1;
  if (!newest || localIso(newest.at) !== today || todayRows > own) return null;
  if (t - newest.at > freshMs) return null;

  const week = computeWeekStreak(rows, settings, t);
  const { done, target, days, todayIndex } = week.thisWeek;
  const seen = new Set(Array.isArray(shown?.seen) ? shown.seen : []);
  const earned = week.events.find((e) => e.type === 'freeze_earned' && e.week === week.thisWeek.start && !seen.has(e.id));
  return {
    kind: done === target ? 'complete' : done > target ? 'extra' : 'kept',
    done, target, streak: week.streak, freezes: week.freezes, days, popIndex: todayIndex,
    freezeEarned: earned ? { id: earned.id, freezes: earned.freezes } : null,
  };
}

// The quiet notice on Home, through the one-at-a-time nudge slot: a freeze
// that covered last week, or one earned and not yet seen (a session that ends
// on a screen with no strip). Only for last week or this one: an old event is
// news to nobody. Returns null or { id, kind: 'freeze_used'|'freeze_earned', ... }.
export function homeNotice(week, shown = {}) {
  if (!week || !Array.isArray(week.events)) return null;
  const seen = new Set(Array.isArray(shown?.seen) ? shown.seen : []);
  const thisMonday = week.thisWeek.start;
  const lastMonday = addDaysIso(thisMonday, -7);
  const fresh = (e) => !seen.has(e.id) && (e.week === thisMonday || e.week === lastMonday);
  const used = week.events.find((e) => e.type === 'freeze_used' && e.week === lastMonday && fresh(e));
  if (used) return { id: used.id, kind: 'freeze_used', streak: week.streak, freezes: week.freezes, target: week.thisWeek.target };
  const earned = [...week.events].reverse().find((e) => e.type === 'freeze_earned' && fresh(e));
  if (earned) return { id: earned.id, kind: 'freeze_earned', freezes: earned.freezes, run: earned.run };
  return null;
}

// ── copy (plain and true; no guilt) ────────────────────────────────────────
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function momentCopy(m) {
  if (!m) return null;
  const left = Math.max(0, m.target - m.done);
  let title, sub;
  if (m.kind === 'complete') {
    title = `WEEK COMPLETE · ${m.done} OF ${m.target} · ${m.streak}-WEEK STREAK`;
    sub = 'Target hit. Rest the remaining days or keep going: both count.';
  } else if (m.kind === 'extra') {
    title = `TRAINING DAY ${m.done} · TARGET MET`;
    sub = 'Target met: your streak is safe this week.';
  } else {
    title = `TRAINING DAY ${m.done} OF ${m.target}${m.streak > 0 ? ' · STREAK KEPT' : ''}`;
    // The chip beside it shows the streak's weeks, so the line does not repeat them.
    const one = left === 1;
    sub = m.streak > 0
      ? `${plural(left, 'more day')} this week ${one ? 'keeps' : 'keep'} your streak going.`
      : `${plural(left, 'more day')} this week ${one ? 'starts' : 'start'} a week streak.`;
  }
  // The freeze is called a 1UP on screen (the owner's name for it, 2026-11-23).
  const freeze = m.freezeEarned ? `1UP EARNED · YOU HOLD ${m.freezeEarned.freezes} OF ${MAX_FREEZES}` : null;
  return { title, sub, freeze };
}

// The come-back reminder's streak case (Home's toast, switch on): the athlete
// holds a week streak, this week still needs training days, and the days left
// (today included: the reminder only shows before training today) can still
// get them. Null otherwise (a 1UP or a reset is not news for a reminder).
export function streakAtStake(week) {
  const t = week?.thisWeek;
  if (!t || !(week.streak > 0)) return null;
  const need = t.target - t.done;
  const left = 7 - t.todayIndex;
  return need > 0 && need <= left ? { streak: week.streak, need } : null;
}
// Two lines beside KEEP STREAK in Home's toast at 360 px.
export function streakReminderCopy(s) {
  if (!s) return null;
  return `${s.streak}-week streak: ${plural(s.need, 'more day')} this week.`;
}

// Short enough for two lines in the nudge slot at 360 px (a third line would
// reach past the header onto the card below); the chip shows the 1UPs left.
export function noticeCopy(n) {
  if (!n) return null;
  if (n.kind === 'freeze_used') return `A 1UP covered last week: your ${n.streak}-week streak is safe.`;
  // No-break spaces keep "2 of 2" together on a narrow line.
  return `1UP earned: ${WEEKS_PER_FREEZE} weeks on target. You hold ${n.freezes}\u00A0of\u00A0${MAX_FREEZES}.`;
}

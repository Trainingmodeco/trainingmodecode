// TODAY'S BOUT (retention feature 1, switch `weeks`): Home's one card at the
// top, with the daily mission's hooks. The old Mission of the Day code in
// App.jsx (dailyMission* keys) stays as it is for the switch off.
//
//   - What the card says and what START runs is Home's own pick (the order the
//     card always had): the last session started (folded with the path's NEXT
//     UP for a saga or the camp), else the Game Plan's bout, else the setup's
//     first pick. SURPRISE ME re-rolls it into a Surprise Mission.
//   - The pick is held for the LOCAL day in tm_daily_mission_v2, so a reload,
//     another session or another device (the key is synced) shows the same
//     bout until midnight, when Home picks again.
//   - The daily bonus: the existing Mission of the Day amount (userStats
//     XP_DAILY_MISSION_BONUS, 25 XP), paid ONCE a local day for the first
//     valid session started from the card that runs to its end, whatever route
//     the card opens (a setup screen, a hub, the camp map, a saga, Practice).
//   - "Started from the card": START (or ADJUST) on the card arms the bonus on
//     THIS device (tm_bout_arm_v1, kept out of the cloud sync on purpose: an
//     arm synced to another phone would let a session there pay). The first
//     session row banked after that is the card's session, whatever screen it
//     ran on: settleTodaysBout (App, on every stats write) reads it, disarms,
//     and pays when the row is a training day (data/weekStreak isTrainingRow:
//     not an award, not refused, not zero-work) that ran to its end, banked
//     today. Back on Home with nothing started from the card (nothing paused
//     since), the arm is dropped (releaseBoutArm).
//   - While the card's session waits paused (holdBoutArm, App on a pause),
//     a session banked is another session's and pays nothing; RESUME of that
//     same paused session (resumeBoutArm) lets it settle again. A cloud
//     restore (rows from another device) drops the arm.
//   - Never twice: the day's done flag is written first (nothing is paid if it
//     cannot be), and the bonus row carries the day (`bout`), so a done flag
//     or a bonus row synced from another device both read as paid.
//   - After it is paid the card shows its done state until tomorrow; START
//     still runs the bout again, with no second bonus.
//
// The pick (pickTodaysBout, surpriseBout, boutMeta, ranToEnd, boutRowCounts)
// is pure; the rest reads and writes storage.
import { addDailyMissionBonus, XP_DAILY_MISSION_BONUS, loadStats } from './userStats';
import { safeSetItem, safeStorage } from './storageHealth';
import { trackEvent } from './analytics';
import { isTrainingRow, localIso } from './weekStreak';
import { sessionMode } from './tiers';

export const DAILY_MISSION_KEY = 'tm_daily_mission_v2';
// Device-local on purpose (not in cloudSync SYNC_KEYS): see above.
export const BOUT_ARM_KEY = 'tm_bout_arm_v1';
export const BOUT_BONUS_XP = XP_DAILY_MISSION_BONUS;
const BONUS_ROW = 'Mission of the Day';

// ── the pick (pure) ─────────────────────────────────────────────────────────
// "9 min" → 9.
const minutesOf = (time) => {
  const m = /(\d+)\s*min/i.exec(String(time || ''));
  return m ? Number(m[1]) : null;
};
// describeSession says "1 rounds" (the switch off keeps its words as they are).
const oneRound = (t) => String(t).replace(/\b1 rounds\b/, '1 round');
// The last session, as the card holds it (what START replays all day, even
// after another session has become the last one).
const snapshot = (last) => ({ kind: last.kind, cfg: last.cfg, disc: last.disc ?? null, at: last.at ?? null });

// Today's bout for `date`, from what Home's pick engine knows. Everything is
// passed in, so this stays pure:
//   last, lastInfo  the last session started (data/lastSession) and describeSession(last)
//   next, nextLine  the path's current node of that saga or camp (switch `path`) and nextUpLine(next)
//   plan            the Game Plan's bout (data/gamePlan getTodayBout), null when never set up
//   suggestion      the setup's first pick (data/recommendations firstPick)
// The order is the card's own: the last session (folded with NEXT UP for a
// saga or the camp), else the Game Plan, else the first pick.
// A bout: { date, kind: 'last'|'next'|'bout'|'surprise', side: 'fit'|'fight',
//   title, parts (the line under it), cta, label?, minutes (null when the pick
//   does not know its length), why (a true personal line, or null), bonusXp,
//   run (what START does: replay | next | route | qmSetup | surprise) }.
export function pickTodaysBout({ date, last = null, lastInfo = null, next = null, nextLine = null, plan = null, suggestion = null }) {
  const base = { date, bonusXp: XP_DAILY_MISSION_BONUS };
  if (last && lastInfo) {
    const side = lastInfo.mode === 'fit' ? 'fit' : 'fight';
    if (next && nextLine && (last.kind === 'arcade' || last.kind === 'camp')) {
      return {
        ...base, kind: 'next', side, title: lastInfo.title, parts: nextLine.parts, label: nextLine.label,
        cta: lastInfo.cta || 'CONTINUE', minutes: null, why: null, run: { type: 'next', next, last: snapshot(last) },
      };
    }
    // Camp and Arcade open their map on the next session, and a program its
    // next day: not a repeat, so they do not say "same as last time".
    const repeats = !['camp', 'arcade'].includes(last.kind) && !(last.kind === 'fit' && last.cfg?.programId);
    return {
      ...base, kind: 'last', side, title: lastInfo.title, parts: [lastInfo.sub, lastInfo.diff].filter(Boolean).map(oneRound),
      cta: lastInfo.cta || 'START', minutes: minutesOf(lastInfo.time), why: repeats ? 'Same as last time' : null,
      run: { type: 'replay', last: snapshot(last) },
    };
  }
  if (plan?.kind === 'train') {
    return {
      ...base, kind: 'bout', side: 'fight', title: plan.session?.label || 'Fight Focus', parts: [`Fits your ~${plan.gapMin} min window`],
      cta: 'START', minutes: null, why: null, run: { type: 'route', actionType: plan.actionType || 'train', payload: null },
    };
  }
  if (plan?.kind === 'recovery') {
    return { ...base, kind: 'bout', side: 'fight', title: 'Recovery Round', parts: [plan.reason].filter(Boolean), cta: 'QUICK MISSION', minutes: null, why: null, run: { type: 'qmSetup' } };
  }
  const s = suggestion || { title: 'Fight Focus', subtitle: 'Timed rounds with coaching', actionType: null, actionPayload: null, mode: 'fight' };
  const route = { type: 'route', actionType: s.actionType || null, payload: s.actionPayload ?? null };
  if (plan?.kind === 'rest_day') {
    return { ...base, kind: 'bout', side: 'fight', title: 'Planned Rest Day', parts: ['Rest days never break your week streak.'], cta: 'TRAIN ANYWAY', minutes: null, why: null, run: route };
  }
  // A Quick Mission pick names its minutes; one that names no level starts on
  // the athlete's own (quickMissionConfig), so it fits their level.
  const qm = s.actionType === 'quickMission' && s.actionPayload && typeof s.actionPayload === 'object' ? s.actionPayload : null;
  return {
    ...base, kind: 'bout', side: plan ? 'fight' : s.mode === 'fit' ? 'fit' : 'fight', title: s.title, parts: [s.subtitle].filter(Boolean),
    cta: 'START', minutes: qm?.duration ?? null, why: qm && qm.difficulty == null ? 'Fits your level' : null, run: route,
  };
}

// SURPRISE ME: the card re-rolled into a random Quick Mission (its config,
// from quickMissionConfig surpriseQuickMission; `level` is its level as the
// card words it).
export function surpriseBout({ date, cfg, level }) {
  return {
    date, bonusXp: XP_DAILY_MISSION_BONUS, kind: 'surprise', side: 'fit', title: 'Surprise Mission',
    parts: [cfg?.focus, level].filter(Boolean), cta: 'START', minutes: cfg?.duration ?? null, why: null, run: { type: 'surprise', cfg },
  };
}

// The card's small line: "12 MIN · FITS YOUR LEVEL · AT YOUR PACE". The
// minutes are left out when the title already says them.
export function boutMeta(bout, { atPace = false } = {}) {
  if (!bout) return [];
  const m = Number(bout.minutes);
  const said = m > 0 && new RegExp(`\\b${m}\\s*min\\b`, 'i').test(String(bout.title || ''));
  return [m > 0 && !said ? `${m} MIN` : null, bout.why ? String(bout.why).toUpperCase() : null, atPace ? 'AT YOUR PACE' : null].filter(Boolean);
}

// A session row that ran to its end: its own flag where it has one (a Quick
// Mission at your pace), else all its rounds, sets or drills done.
export function ranToEnd(row) {
  if (!row) return false;
  if (typeof row.completed === 'boolean') return row.completed;
  const n = row.completedCount, t = row.totalCount;
  if (typeof n === 'number' && typeof t === 'number' && t > 0) return n >= t;
  return true;
}

// The row that pays the bonus: a training day (not an award, not refused,
// not zero-work), run to its end, banked on `date`.
export function boutRowCounts(row, date) {
  return isTrainingRow(row) && ranToEnd(row) && localIso(row.completedAt) === date;
}

// ── storage ─────────────────────────────────────────────────────────────────
// { v: 3, date, bout, done, doneAt, xp }. The old daily mission's box
// ({ date, mission, done, doneAt, xp }) reads with no bout: its done flag for
// today still counts (that day's bonus was paid).
function readBox() {
  try {
    const raw = safeStorage()?.getItem(DAILY_MISSION_KEY);
    const p = raw ? JSON.parse(raw) : null;
    if (!p || typeof p !== 'object' || typeof p.date !== 'string') return null;
    const bout = p.v === 3 && p.bout && typeof p.bout === 'object' && p.bout.date === p.date ? p.bout : null;
    return { date: p.date, bout, done: !!p.done, doneAt: p.doneAt ?? null, xp: Number(p.xp) || 0 };
  } catch { return null; }
}
const writeBox = (box) => safeSetItem(DAILY_MISSION_KEY, JSON.stringify({ v: 3, ...box }));

// A bonus row for `date` in the (synced) session rows.
export function boutPaidInRows(stats, date) {
  return (Array.isArray(stats?.sessions) ? stats.sessions : []).some((s) => s && s.type === BONUS_ROW && s.bout === date);
}

// Today's held bout and whether its bonus is paid. Reads only: Home holds a
// fresh pick with holdBout (from an effect, never a render).
//   { date, bout (null while none is held), done, saved }
export function todaysBout({ now = Date.now(), stats } = {}) {
  const today = localIso(now);
  const box = readBox();
  const same = !!(box && box.date === today);
  const paidRow = stats ? boutPaidInRows(stats, today) : false;
  return { date: today, bout: same ? box.bout : null, done: (same && box.done) || paidRow, saved: !!(same && box.bout) };
}

// Hold `bout` as its day's bout. A bout already held for that day stays (only
// SURPRISE ME replaces it: `replace`); a done flag written earlier that day is
// kept, with its time and XP, so the end screen's strip still finds it.
export function holdBout(bout, { replace = false } = {}) {
  if (!bout?.date) return false;
  const box = readBox();
  const same = !!(box && box.date === bout.date);
  if (same && box.bout && !replace) return false;
  return writeBox({ date: bout.date, bout, done: same && box.done, doneAt: same ? box.doneAt : null, xp: same ? box.xp : 0 });
}
export const rerollBout = (bout) => holdBout(bout, { replace: true });

// ── started from the card ───────────────────────────────────────────────────
function readArm() {
  try {
    const raw = safeStorage()?.getItem(BOUT_ARM_KEY);
    const p = raw ? JSON.parse(raw) : null;
    return p && typeof p.date === 'string' && Number.isFinite(p.at) ? p : null;
  } catch { return null; }
}
function dropArm() {
  try { safeStorage()?.removeItem(BOUT_ARM_KEY); } catch { /* best-effort */ }
}

// START (or ADJUST) on the card: the next session banked is the card's.
export function armTodaysBout({ now = Date.now(), kind = null } = {}) {
  trackEvent('daily_mission_start', { v: 3, kind });
  return safeSetItem(BOUT_ARM_KEY, JSON.stringify({ date: localIso(now), at: now }));
}

// The arm for today, or null.
export function boutArm(now = Date.now()) {
  const arm = readArm();
  return arm && arm.date === localIso(now) ? arm : null;
}

// Back on Home: a START that started nothing no longer counts. A session
// paused since the START (`pausedAt`: the paused sessions' times) is the
// card's, still to be finished, so the arm stays; once the card's session is
// held (below), only that paused session keeps it.
export function releaseBoutArm({ pausedAt = [] } = {}) {
  const arm = readArm();
  if (!arm) return false;
  const times = pausedAt.map(Number);
  if (arm.held != null ? times.includes(arm.held) : times.some((t) => t >= arm.at)) return false;
  dropArm();
  return true;
}

// The card's session paused (App, when a session is paused): `pausedTs` is
// that paused session's time. Until that same session is resumed, a session
// banked is not the card's (another one started from a hub, a Practice
// drill). Only the first pause after START is the card's; a later one is
// another session's.
export function holdBoutArm(pausedTs) {
  const arm = readArm();
  const ts = Number(pausedTs);
  if (!arm || arm.held != null || !Number.isFinite(ts)) return false;
  return safeSetItem(BOUT_ARM_KEY, JSON.stringify({ ...arm, held: ts }));
}

// RESUME (App): the card's own paused session goes on, so its row can
// settle again. Rows banked while it waited are left behind: the arm counts
// from now. Resuming any other paused session changes nothing.
export function resumeBoutArm(pausedTs, now = Date.now()) {
  const arm = readArm();
  if (!arm || arm.held == null || Number(pausedTs) !== arm.held) return false;
  return safeSetItem(BOUT_ARM_KEY, JSON.stringify({ date: arm.date, at: now }));
}

// After any stats write (App): the first session row banked since the card's
// START settles it. Pays the bonus once a day when that row counts
// (boutRowCounts) and today's bonus is not paid yet. Returns the XP paid
// (0 when nothing was). Never throws.
//   restored  the write was a cloud restore (data/cloudSync): its rows come
//             from another device, not from the card's session, so the
//             START no longer counts.
export function settleTodaysBout({ now = Date.now(), stats, restored = false } = {}) {
  try {
    const arm = readArm();
    if (!arm) return 0;
    if (restored) { dropArm(); return 0; }
    const today = localIso(now);
    // Started from yesterday's card: the day it belonged to is over.
    if (arm.date !== today) { dropArm(); return 0; }
    // The card's session waits paused: whatever was banked is another session's.
    if (arm.held != null) return 0;
    const st = stats || loadStats();
    const rows = (Array.isArray(st?.sessions) ? st.sessions : [])
      .filter((s) => s && sessionMode(s) !== 'bonus' && Date.parse(s.completedAt) >= arm.at);
    // An XP-only write or an award row: the card's session has not ended yet.
    if (!rows.length) return 0;
    // One session per START, paid or not.
    dropArm();
    if (!boutRowCounts(rows[0], today)) return 0;
    const box = readBox();
    const same = !!(box && box.date === today);
    if ((same && box.done) || boutPaidInRows(st, today)) return 0;
    // The flag decides: if it cannot be saved the bonus could pay again, so nothing is paid.
    if (!writeBox({ date: today, bout: same ? box.bout : null, done: true, doneAt: new Date(now).toISOString(), xp: XP_DAILY_MISSION_BONUS })) return 0;
    const xp = addDailyMissionBonus({ bout: today });
    trackEvent('daily_mission_complete', { v: 3, kind: same ? box.bout?.kind || null : null, type: rows[0].type || null });
    return xp;
  } catch {
    return 0;
  }
}

// The bonus paid by the session that just ended (for the end screen's strip):
// done today, within the last `freshMs`.
export function justDoneDailyMission(now = Date.now(), freshMs = 15 * 60 * 1000) {
  const box = readBox();
  if (!box || box.date !== localIso(now) || !box.done || !box.doneAt) return null;
  const at = new Date(box.doneAt).getTime();
  return Number.isFinite(at) && now - at <= freshMs && at <= now + 60000 ? { xp: box.xp || XP_DAILY_MISSION_BONUS } : null;
}

// The run log — every finished run kept WITH the ground it covered.
//
// Cardio sessions were already being written to tm_cardio_sessions, but that
// record is a summary: method, minutes, a distance string. Nothing kept the
// route, so the map the phone had just drawn was thrown away the moment the
// player closed. This is the store that keeps it, and the numbers a running app
// is expected to show on top of it — career totals and a weekly goal.
//
// It is deliberately a SEPARATE key from tm_cardio_sessions. That log feeds XP,
// streaks and the cloud mirror and must stay small and boring; a route is a few
// kilobytes. The two are joined by runId, so nothing double-counts.
import { metersPerUnit } from './runCoach';
import { encodeRoute, decodeRoute, thinRoute } from './geoRoute';
import { loadProfile } from './userProfile';

const KEY = 'tm_run_log_v1';
const GOAL_KEY = 'tm_run_week_goal_v1';
export const RUN_LOG_VERSION = 1;
export const RUN_LOG_UPDATED = 'training-mode-run-log-updated';

// How much history to keep. A route is the expensive part of an entry, so the
// cap is on runs, and a quota failure sheds the OLDEST ROUTES before it sheds a
// run — losing the map of a run from two months ago beats losing the run.
const MAX_RUNS = 60;
const MAX_ROUTE_POINTS = 200;

function readAll() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.v !== RUN_LOG_VERSION || !Array.isArray(parsed.runs)) return [];
    return parsed.runs;
  } catch {
    return [];
  }
}

function writeAll(runs) {
  if (typeof localStorage === 'undefined') return false;
  const trimmed = runs.slice(-MAX_RUNS);
  const attempt = (list) => {
    localStorage.setItem(KEY, JSON.stringify({ v: RUN_LOG_VERSION, runs: list }));
    return true;
  };
  try {
    attempt(trimmed);
  } catch {
    // Out of room: drop routes from the oldest entries, newest first to survive.
    const stripped = trimmed.map((r, i) => (i < Math.ceil(trimmed.length / 2) ? { ...r, route: [] } : r));
    try { attempt(stripped); } catch { return false; }
  }
  if (typeof window !== 'undefined') {
    try { window.dispatchEvent(new Event(RUN_LOG_UPDATED)); } catch { /* ignore */ }
  }
  return true;
}

// ── Calories ──────────────────────────────────────────────────────────────
// ACSM's horizontal-running equation, which is what fitness trackers use:
// VO2 (ml/kg/min) = 0.2 * speed(m/min) + 3.5, one MET being 3.5. Then
// kcal = MET * 3.5 * kg / 200 per minute. No heart rate, so it is an estimate —
// every screen that shows it says EST rather than implying a measurement.
export function profileWeightKg(profile = null) {
  const p = profile || loadProfile() || {};
  const raw = parseFloat(p.weightVal);
  if (!Number.isFinite(raw) || raw <= 0) return 75;
  const kg = String(p.weightUnit || 'LBS').toUpperCase() === 'KG' ? raw : raw * 0.45359237;
  return Math.max(30, Math.min(250, kg));
}

export function estimateCalories({ meters, seconds, weightKg = null, profile = null }) {
  const m = Number(meters) || 0;
  const s = Number(seconds) || 0;
  if (m <= 0 || s <= 0) return null;
  const kg = weightKg || profileWeightKg(profile);
  const metersPerMin = m / (s / 60);
  const met = Math.max(1, (0.2 * metersPerMin + 3.5) / 3.5);
  const kcal = met * 3.5 * kg / 200 * (s / 60);
  return Math.max(1, Math.round(kcal));
}

// ── Writing ───────────────────────────────────────────────────────────────
// Takes a RunPlayer result and stores the durable half of it.
export function logRun(result, extra = {}) {
  if (!result) return null;
  const unit = result.distanceUnit || 'mi';
  const distance = Number(result.completedDistance) || 0;
  const seconds = Math.round(Number(result.completedTimeSeconds) || 0);
  const meters = distance * metersPerUnit(unit);
  const route = encodeRoute(thinRoute(result.route || [], MAX_ROUTE_POINTS));
  const entry = {
    id: result.id || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    at: Date.now(),
    source: extra.source || 'cardio_mode',
    methodLabel: extra.methodLabel || 'Running',
    unit,
    goal: Number(result.goal) || distance,
    distance: +distance.toFixed(3),
    seconds,
    avgPaceSec: result.avgPaceSec ? Math.round(result.avgPaceSec) : (distance > 0.05 ? Math.round(seconds / distance) : null),
    gps: !!result.gps,
    completed: !!result.completed,
    targetSec: result.targetSec ?? null,
    eliteSec: result.eliteSec ?? null,
    beatTarget: !!result.beatTarget,
    beatElite: !!result.beatElite,
    newBest: !!result.newBest,
    ghost: result.ghost ? { outcome: result.ghost.outcome, delta: result.ghost.delta, ownerName: result.ghost.ownerName } : null,
    splits: Array.isArray(result.splits) ? result.splits.map(s => ({ marker: s.marker, elapsedSec: Math.round(s.elapsedSec) })) : [],
    calories: Number.isFinite(extra.calories) ? extra.calories : estimateCalories({ meters, seconds }),
    caloriesEstimated: !Number.isFinite(extra.calories),
    notes: extra.notes || '',
    route,
    routePoints: route.length,
  };
  const runs = readAll();
  runs.push(entry);
  writeAll(runs);
  return entry;
}

// The manual log screen can attach the numbers the athlete typed afterwards.
export function updateRun(id, patch) {
  const runs = readAll();
  const i = runs.findIndex(r => r.id === id);
  if (i < 0) return null;
  runs[i] = { ...runs[i], ...patch };
  writeAll(runs);
  return runs[i];
}

export function deleteRun(id) {
  const runs = readAll().filter(r => r.id !== id);
  writeAll(runs);
}

// ── Reading ───────────────────────────────────────────────────────────────
// Newest first — every screen that lists runs wants them that way.
export function loadRuns() {
  return readAll().slice().sort((a, b) => (b.at || 0) - (a.at || 0));
}

export function getRun(id) {
  return readAll().find(r => r.id === id) || null;
}

export function runRoute(run) {
  return decodeRoute(run?.route || []);
}

export function hasAnyRun() {
  return readAll().length > 0;
}

export function runMeters(run) {
  return (Number(run?.distance) || 0) * metersPerUnit(run?.unit || 'mi');
}

// Career totals: the four numbers a running app puts above the fold.
export function runTotals(runs = null) {
  const list = runs || readAll();
  let meters = 0, seconds = 0, calories = 0;
  for (const r of list) {
    meters += runMeters(r);
    seconds += Number(r.seconds) || 0;
    calories += Number(r.calories) || 0;
  }
  return { count: list.length, meters, seconds, calories };
}

// ── The week ──────────────────────────────────────────────────────────────
// Monday-start, local time, so "this week" matches the calendar the athlete
// looks at rather than the UTC one the timestamps are in.
export function startOfWeek(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - dow);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function runsInWeek(runs = null, date = new Date()) {
  const from = startOfWeek(date).getTime();
  const to = from + 7 * 24 * 60 * 60 * 1000;
  return (runs || readAll()).filter(r => r.at >= from && r.at < to);
}

// Distance covered per weekday, Monday first — the seven bars under the ring.
export function weekByDay(runs = null, date = new Date()) {
  const from = startOfWeek(date).getTime();
  const days = Array.from({ length: 7 }, () => 0);
  for (const r of runsInWeek(runs, date)) {
    const i = Math.floor((r.at - from) / (24 * 60 * 60 * 1000));
    if (i >= 0 && i < 7) days[i] += runMeters(r);
  }
  return days;
}

// Miles by default, to match the rest of the app.
const DEFAULT_GOAL = { value: 6, unit: 'mi' };

export function loadWeekGoal() {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_GOAL };
  try {
    const raw = localStorage.getItem(GOAL_KEY);
    if (!raw) return { ...DEFAULT_GOAL };
    const g = JSON.parse(raw);
    if (!g || !(Number(g.value) > 0)) return { ...DEFAULT_GOAL };
    return { value: Number(g.value), unit: g.unit === 'mi' ? 'mi' : 'km' };
  } catch {
    return { ...DEFAULT_GOAL };
  }
}

export function saveWeekGoal(goal) {
  if (typeof localStorage === 'undefined') return;
  const clean = { value: Math.max(0.5, Math.min(500, Number(goal?.value) || DEFAULT_GOAL.value)), unit: goal?.unit === 'km' ? 'km' : 'mi' };
  try { localStorage.setItem(GOAL_KEY, JSON.stringify(clean)); } catch { /* quota */ }
  if (typeof window !== 'undefined') {
    try { window.dispatchEvent(new Event(RUN_LOG_UPDATED)); } catch { /* ignore */ }
  }
}

// Progress toward this week's goal, in the goal's own unit.
export function weekProgress(runs = null, date = new Date()) {
  const goal = loadWeekGoal();
  const meters = runsInWeek(runs, date).reduce((a, r) => a + runMeters(r), 0);
  const done = meters / metersPerUnit(goal.unit);
  return {
    goal,
    doneUnits: done,
    meters,
    pct: goal.value > 0 ? Math.min(1, done / goal.value) : 0,
    remaining: Math.max(0, goal.value - done),
    hit: done >= goal.value,
  };
}

// ── Personal bests ────────────────────────────────────────────────────────
// Fastest completed GPS run at each goal distance. The ghost store already
// keeps the trace to RACE; this is the number to SHOW.
export function personalBests(runs = null) {
  const out = new Map();
  for (const r of runs || readAll()) {
    if (!r.completed || !r.gps || !(r.seconds > 0)) continue;
    const k = `${r.unit}|${r.goal}`;
    const cur = out.get(k);
    if (!cur || r.seconds < cur.seconds) out.set(k, r);
  }
  return [...out.values()].sort((a, b) => b.goal - a.goal);
}

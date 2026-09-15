// Run ghosts — race the replay of a past run over the same distance.
//
// A run ghost is a distance-over-time trace recorded from a run whose distance
// was measured: at second t the ghost had covered d units. Racing it is a pure lookup — how
// far had the ghost gone by now, and how far ahead or behind am I. Two ghosts
// are kept per distance: MY LAST and MY BEST (fastest finish).
//
// A ghost is recorded from any run whose distance was MEASURED — outdoors from
// GPS, indoors from the machine's own speed. What never becomes a ghost is an
// ESTIMATED distance: with no speed and no fix, distance is the target pace
// played back, so racing it would be racing a number that was always going to
// finish exactly on time.
//
// Ghosts are bucketed by SURFACE as well as distance, and the two never mix. A
// treadmill mile and an outdoor mile are not the same mile — the belt comes
// back to meet you, there is no wind, no camber and no turns, and the honest
// comparison is a treadmill run against a treadmill run. Without this, the
// first indoor session would quietly overwrite an outdoor personal best, and
// the athlete would be told they had beaten a record they had not.
//
// Friend ghosts by USERNAME need the cloud (a ghost is a few hundred points)
// and are specced in PROMPT GHOST-R1; the local model here is already the
// shape they will arrive in, so nothing has to change on the player side.
import { loadProfile } from './userProfile';
import { trackEvent } from './analytics';

const KEY = 'tm_run_ghosts_v1';
export const RUN_GHOST_VERSION = 1;

// 'gps' outdoors, 'machine' on a treadmill/bike/rower/stair climber.
export const SURFACES = ['gps', 'machine'];
export const surfaceOf = (result) => (result?.surface || (result?.gps ? 'gps' : 'machine'));
export const surfaceLabel = (s) => (s === 'machine' ? 'INDOOR' : 'OUTDOOR');

// Keys written before surfaces existed are all `${unit}|${goal}`, and every one
// of them is from a GPS run because that was the only kind that recorded. They
// are rewritten in place on read, so nobody loses a ghost to this change.
// Idempotent: once no un-suffixed key remains it does nothing.
function migrateSurfaces(box) {
  let changed = false;
  for (const slot of ['best', 'last']) {
    const bag = box[slot];
    if (!bag) continue;
    for (const k of Object.keys(bag)) {
      if (k.split('|').length >= 3) continue;
      const ghost = bag[k];
      const next = `${k}|gps`;
      if (!bag[next]) bag[next] = { ...ghost, surface: 'gps' };
      delete bag[k];
      changed = true;
    }
  }
  return changed;
}

function load() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    const p = raw ? JSON.parse(raw) : null;
    if (p && p.v === RUN_GHOST_VERSION && p.best && p.last) {
      if (migrateSurfaces(p)) save(p);
      return p;
    }
  } catch { /* fresh */ }
  return { v: RUN_GHOST_VERSION, best: {}, last: {} };
}
function save(s) {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* quota */ }
}

export const ghostKey = (unit, goal, surface = 'gps') => `${unit}|${Number(goal)}|${surface === 'machine' ? 'machine' : 'gps'}`;

// Thin a raw (t, d) trace so a ghost stays small: keep a point at least every
// `minGapSec`, always the first and the last.
export function thinTrace(trace, minGapSec = 5, maxPoints = 720) {
  if (!Array.isArray(trace) || trace.length === 0) return [];
  const out = [trace[0]];
  for (let i = 1; i < trace.length - 1; i++) {
    if (trace[i].t - out[out.length - 1].t >= minGapSec) out.push(trace[i]);
  }
  if (trace.length > 1) out.push(trace[trace.length - 1]);
  if (out.length <= maxPoints) return out;
  const step = out.length / maxPoints;
  const sampled = [];
  for (let i = 0; i < maxPoints; i++) sampled.push(out[Math.floor(i * step)]);
  sampled[sampled.length - 1] = out[out.length - 1];
  return sampled;
}

export function makeRunGhost({ unit, goal, totalSec, trace, splits, surface = 'gps', ownerId = 'me', ownerName, gender }) {
  const profile = loadProfile() || {};
  const thin = thinTrace(trace);
  if (!(totalSec > 0) || thin.length < 2) return null;
  return {
    v: RUN_GHOST_VERSION,
    ghostId: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    ownerId,
    ownerName: String(ownerName || profile.name || 'YOU').toUpperCase(),
    gender: gender || (profile.sex === 'female' ? 'female' : 'male'),
    unit,
    goal: Number(goal),
    surface: surface === 'machine' ? 'machine' : 'gps',
    totalSec: Math.round(totalSec),
    trace: thin,
    splits: Array.isArray(splits) ? splits : [],
    verified: true,
    createdAt: Date.now(),
  };
}

// Record a ghost from a just-finished run. Returns { ghost, newBest }.
export function recordRunGhost(result) {
  // `measured` is the gate, not `gps`: a machine run tracked from the speed
  // dial is as real a trace as a satellite one. Only an estimate is excluded.
  const measured = result?.measured ?? result?.gps;
  if (!result || !result.completed || !measured || !Array.isArray(result.trace)) return { ghost: null, newBest: false };
  const surface = surfaceOf(result);
  const ghost = makeRunGhost({
    unit: result.distanceUnit, goal: result.goal, totalSec: result.completedTimeSeconds,
    trace: result.trace, splits: result.splits, surface,
  });
  if (!ghost) return { ghost: null, newBest: false };
  const box = load();
  const k = ghostKey(ghost.unit, ghost.goal, surface);
  const prev = box.best[k];
  const newBest = !prev || ghost.totalSec < prev.totalSec;
  box.last[k] = ghost;
  if (newBest) box.best[k] = ghost;
  save(box);
  trackEvent('run_ghost_recorded', { goal: ghost.goal, unit: ghost.unit, surface, totalSec: ghost.totalSec, newBest });
  return { ghost, newBest };
}

// 'best' | 'last' for a distance ON A GIVEN SURFACE, or null when none exists.
export function getRunGhost(unit, goal, which = 'best', surface = 'gps') {
  const box = load();
  const k = ghostKey(unit, goal, surface);
  return (which === 'last' ? box.last[k] : box.best[k]) || null;
}

export function hasAnyRunGhost(surface = null) {
  const box = load();
  const keys = Object.keys(box.last);
  if (!surface) return keys.length > 0;
  return keys.some(k => k.endsWith(`|${surface}`));
}

// Distance the ghost had covered at second t (linear between trace points;
// holds the finish after its last point).
export function ghostDistanceAt(ghost, tSec) {
  const tr = ghost?.trace;
  if (!tr || tr.length === 0) return 0;
  if (tSec <= tr[0].t) return tr[0].d * (tr[0].t > 0 ? Math.max(0, tSec) / tr[0].t : 1);
  for (let i = 1; i < tr.length; i++) {
    if (tSec <= tr[i].t) {
      const a = tr[i - 1], b = tr[i];
      const span = b.t - a.t;
      return span > 0 ? a.d + ((tSec - a.t) / span) * (b.d - a.d) : b.d;
    }
  }
  return ghost.goal || tr[tr.length - 1].d;
}

// Seconds the ghost needed to reach distance d (inverse lookup).
export function ghostTimeAt(ghost, d) {
  const tr = ghost?.trace;
  if (!tr || tr.length === 0) return null;
  if (d <= 0) return 0;
  for (let i = 1; i < tr.length; i++) {
    if (d <= tr[i].d) {
      const a = tr[i - 1], b = tr[i];
      const span = b.d - a.d;
      return span > 0 ? a.t + ((d - a.d) / span) * (b.t - a.t) : b.t;
    }
  }
  return ghost.totalSec;
}

// The image shown beside a ghost: the athlete's own mirror art when it is
// theirs, a friend's tier art once friend ghosts arrive.
export function ghostArt(ghost, variant = 1) {
  const g = ghost?.gender === 'female' ? 'female' : 'male';
  return `/static/ghost/vs-${g}-${variant}.webp`;
}

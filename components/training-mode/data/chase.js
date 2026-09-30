// The chase — random interval sprints for an outdoor run, Zombies-Run style.
//
// Every few minutes the coach calls a sprint. The window is 40–60 seconds.
// To ESCAPE, the athlete's pace over the window has to be at least 15% faster
// than their pace over the minute before the call. Escape banks bonus XP.
// Getting caught forfeits that bonus — nothing is taken away, it just was not
// earned. That is the owner's rule: a challenge, not a punishment.
//
// All pure. The player owns the clock and the samples; this file decides when
// a chase can start, how long it runs, and whether it was won.

import { XP_STAKES_BY_TIER, stakesFor } from './xpStakes';

export const CHASE_FIRST_MIN_SEC = 240;   // never before four minutes in
export const CHASE_FIRST_MAX_SEC = 360;
export const CHASE_GAP_MIN_SEC = 180;     // then every three to six minutes
export const CHASE_GAP_MAX_SEC = 360;
export const CHASE_WINDOW_MIN_SEC = 40;
export const CHASE_WINDOW_MAX_SEC = 60;
export const CHASE_THRESHOLD = 0.15;      // 15% faster than the baseline
export const CHASE_BASELINE_WINDOW_SEC = 60;
export const CHASE_TAIL_GUARD_SEC = 120;  // none in the last two minutes of a targeted run
export const CHASE_MIN_WINDOW_METERS = 20; // below this the window pace is noise
// XP per chase, by effort tier — the shared stakes table (data/xpStakes).
export const CHASE_XP_BY_TIER = XP_STAKES_BY_TIER;
export const CHASE_XP = CHASE_XP_BY_TIER.normal.win;
export function chaseXp(tier) {
  return stakesFor(tier);
}
export const CHASE_LEAD_IN_SEC = 5;       // "Sprint in five" before the window opens

const rand = (rng, lo, hi) => lo + Math.round((rng ? rng() : Math.random()) * (hi - lo));

export function newChaseState() {
  return {
    nextAtSec: null,       // when the next call is due
    leadInAtSec: null,     // when "sprint in five" was spoken
    activeUntilSec: null,  // window end, or null when not in a chase
    windowSec: 0,
    startSec: 0,
    startMeters: 0,
    baselinePaceSec: null,
    results: [],           // { atSec, windowSec, baselinePaceSec, chasePaceSec, pass }
    passes: 0,
    fails: 0,
  };
}

export function firstChaseAt(rng) {
  return rand(rng, CHASE_FIRST_MIN_SEC, CHASE_FIRST_MAX_SEC);
}
export function nextChaseAt(nowSec, rng) {
  return nowSec + rand(rng, CHASE_GAP_MIN_SEC, CHASE_GAP_MAX_SEC);
}
export function chaseWindow(rng) {
  return rand(rng, CHASE_WINDOW_MIN_SEC, CHASE_WINDOW_MAX_SEC);
}

/**
 * Can a chase start now? Needs the clock to have reached the scheduled second,
 * a baseline pace to compare against, and — on a run with a target — enough
 * run left that the window plus the tail guard fit before the finish.
 * `remainingSec` is null on a free run (no finish to protect).
 */
export function canStartChase({ nowSec, nextAtSec, baselinePaceSec, remainingSec = null, windowSec = CHASE_WINDOW_MAX_SEC }) {
  if (nextAtSec == null || nowSec < nextAtSec) return false;
  if (!(baselinePaceSec > 0)) return false;
  if (remainingSec != null && remainingSec < windowSec + CHASE_TAIL_GUARD_SEC) return false;
  return true;
}

/** Pace over the chase window, in seconds per unit; null if too little ground was covered. */
export function chasePaceFromWindow({ startMeters, endMeters, seconds, metersPerUnitValue }) {
  const m = (endMeters || 0) - (startMeters || 0);
  if (!(m >= CHASE_MIN_WINDOW_METERS) || !(seconds > 0)) return null;
  return (seconds / m) * metersPerUnitValue;
}

/**
 * Pass if the chase pace is at least `threshold` faster than the baseline.
 * Pace is seconds per unit, so faster means SMALLER.
 */
export function evaluateChase({ baselinePaceSec, chasePaceSec, threshold = CHASE_THRESHOLD }) {
  const requiredPaceSec = baselinePaceSec > 0 ? baselinePaceSec * (1 - threshold) : null;
  if (!(chasePaceSec > 0) || requiredPaceSec == null) return { pass: false, requiredPaceSec, ratio: null };
  const ratio = chasePaceSec / baselinePaceSec;
  return { pass: chasePaceSec <= requiredPaceSec, requiredPaceSec, ratio };
}

/** Which beep, if any, the clock should make with `remainingSec` left in the window. */
export function chaseBeepAt(remainingSec) {
  if (remainingSec <= 0) return null;
  if (remainingSec <= 5) return 'fast';
  if (remainingSec % 10 === 0) return 'slow';
  return null;
}

export function chaseSummary(state, tier = 'normal') {
  const passes = state?.passes || 0;
  const fails = state?.fails || 0;
  const { win, loss } = chaseXp(tier);
  const won = passes * win;
  const lost = fails * loss;
  return { passes, fails, attempts: passes + fails, won, lost, xp: won - lost, tier: chaseXp(tier) };
}

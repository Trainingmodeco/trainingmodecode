// The weekly streak's app side: reads the session rows and the weekly target
// (Profile's Game Plan, tm_game_plan_v1) and keeps the "moment already shown"
// markers (tm_week_moments_v1). The streak itself is never stored: it is
// recomputed from the rows each time (data/weekStreak.js).
import { loadStats } from './userStats';
import { loadGamePlan, saveGamePlan } from './gamePlan';
import { safeSetItem, safeStorage } from './storageHealth';
import {
  computeWeekStreak, clampTarget, withTargetChange, pendingTarget, sessionMoment, homeNotice, localIso,
  WEEK_TARGET_DEFAULT,
} from './weekStreak';
import { justDoneDailyMission } from './dailyMission';

export const WEEK_MOMENTS_KEY = 'tm_week_moments_v1';
const SEEN_CAP = 24;

// The target: the Game Plan's days per week for anyone who saved the plan
// (2 to 6; a 7 from before reads 6), 4 for someone who never did. The change
// log (weekTargets) makes a change start next Monday.
export function weekSettings(gp = loadGamePlan()) {
  return {
    target: gp?.setup ? clampTarget(gp.daysPerWeek) : WEEK_TARGET_DEFAULT,
    targets: Array.isArray(gp?.weekTargets) ? gp.weekTargets : [],
  };
}

export function loadWeekStreak(now = Date.now(), rows = loadStats().sessions) {
  return computeWeekStreak(rows, weekSettings(), now);
}

// The value the picker shows as chosen (it holds from next Monday).
export const chosenWeekTarget = (now = Date.now()) => pendingTarget(weekSettings(), now);

// A pick: the plan's days per week now (Today's Bout reads it, as before), the
// streak's target from next Monday.
export function setWeekTarget(days, now = Date.now()) {
  const log = withTargetChange(weekSettings(), days, now);
  return saveGamePlan({ daysPerWeek: clampTarget(days), weekTargets: log });
}

// Any other Game Plan answer saved with the switch on (minutes, time of day):
// the target is written down first, so saving the plan for the first time
// cannot turn a never-chosen 4 into the plan's default 3.
export function saveGamePlanKeepingTarget(patch) {
  const s = weekSettings();
  const pin = s.targets.length ? {} : { daysPerWeek: s.target, weekTargets: [{ from: '', days: s.target }] };
  return saveGamePlan({ ...pin, ...patch });
}

export function loadWeekMoments() {
  try {
    const p = JSON.parse(safeStorage()?.getItem(WEEK_MOMENTS_KEY) || 'null');
    if (p && typeof p === 'object') return { day: typeof p.day === 'string' ? p.day : null, seen: Array.isArray(p.seen) ? p.seen.filter((x) => typeof x === 'string') : [] };
  } catch { /* unreadable: nothing shown yet */ }
  return { day: null, seen: [] };
}

export function markWeekMoments({ day, seen = [] } = {}) {
  const cur = loadWeekMoments();
  const all = [...cur.seen.filter((x) => !seen.includes(x)), ...seen].slice(-SEEN_CAP);
  safeSetItem(WEEK_MOMENTS_KEY, JSON.stringify({ day: day || cur.day, seen: all }));
}

// The end screen's strip for the session that just banked (null if none).
// `finisher`: the session ran a cardio finisher (its Cardio row is the session's own).
export function takeSessionMoment(now = Date.now(), { finisher = false } = {}) {
  return sessionMoment({ rows: loadStats().sessions, settings: weekSettings(), now, shown: loadWeekMoments(), finisher });
}

// Home's quiet freeze notice (null if none).
export function takeHomeNotice(week) {
  return homeNotice(week, loadWeekMoments());
}

// The end screen's strip: the week moment of the session that just banked,
// and the daily mission bonus it paid, each shown once.
// Returns null or { moment, missionXp, today }.
export function takeEndScreenStrip(now = Date.now(), { finisher = false } = {}) {
  const today = localIso(now);
  const moment = takeSessionMoment(now, { finisher });
  const done = justDoneDailyMission(now);
  const missionXp = done && !loadWeekMoments().seen.includes(`mission:${today}`) ? done.xp : 0;
  return moment || missionXp ? { moment, missionXp, today } : null;
}

export function markEndScreenStrip(strip) {
  if (!strip) return;
  const seen = [];
  if (strip.moment?.freezeEarned) seen.push(strip.moment.freezeEarned.id);
  if (strip.missionXp) seen.push(`mission:${strip.today}`);
  markWeekMoments({ day: strip.moment ? strip.today : undefined, seen });
}

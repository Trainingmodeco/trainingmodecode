// PROMPT OP-1 — per-campaign benchmark log + baseline-driven progression.
//
// Stage 1 of One Punch is a MAX-OUT TESTER: the athlete tests each exercise to
// their max, the numbers land here, and stages 2–9 interpolate from that
// baseline toward the campaign's 100-rep goal. Keyed per campaign so extending
// to another saga later is data, not surgery — but the SCALING is only wired
// up for One Punch until its version is playtested (Gravity Chamber is
// tempo-based, volume isn't the point there).
//
// Storage follows the userStats pattern: one localStorage key, a parse cache
// invalidated on save + cross-tab storage events, and a window event so React
// screens can refresh.

const STORAGE_KEY = 'tm_benchmarks';
export const BENCHMARKS_UPDATED_EVENT = 'tm-benchmarks-updated';

// The campaign goal every baseline climbs toward.
const GOAL = 100;

// Task `category` → baseline key. Stages 7–9 swap in variation exercises
// (Diamond Push-Ups, Bicycle Crunches…), so scaling keys off category, which
// every fit task carries, never off titles.
export const CATEGORY_TO_BASELINE_KEY = { push: 'pushUps', legs: 'squats', core: 'sitUps' };

let _cache = null;

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => { if (!e.key || e.key === STORAGE_KEY) _cache = null; });
}

function loadAll() {
  if (_cache) return _cache;
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(STORAGE_KEY);
    _cache = raw ? (JSON.parse(raw) || {}) : {};
    return _cache;
  } catch {
    return {};
  }
}

function saveAll(all) {
  _cache = null;
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(BENCHMARKS_UPDATED_EVENT));
}

/**
 * Record one tested exercise.
 * @param {object} o
 * @param {string} o.campaignId  e.g. 'one-punch-protocol'
 * @param {string} o.exercise    'pushUps' | 'squats' | 'sitUps'
 * @param {number} o.reps        reps achieved (≥ 1)
 * @param {string} o.mode        'count' (cadence counted) | 'own' (self-entered)
 * @param {string} [o.date]      ISO date; defaults to now
 */
export function logBenchmark({ campaignId, exercise, reps, mode, date }) {
  if (!campaignId || !exercise || !Number.isFinite(reps)) return;
  const all = loadAll();
  const list = Array.isArray(all[campaignId]) ? all[campaignId] : [];
  list.push({ exercise, reps: Math.max(1, Math.round(reps)), mode: mode || 'count', date: date || new Date().toISOString() });
  saveAll({ ...all, [campaignId]: list });
}

/**
 * The most recent tested number for each exercise, or null when the athlete
 * has never run the tester for this campaign.
 * @returns {{pushUps:number, squats:number, sitUps:number}|null}
 */
export function latestBaseline(campaignId) {
  const list = loadAll()[campaignId];
  if (!Array.isArray(list) || !list.length) return null;
  const out = {};
  for (let i = list.length - 1; i >= 0; i--) {
    const e = list[i];
    if (e && e.exercise && out[e.exercise] == null && Number.isFinite(e.reps)) out[e.exercise] = e.reps;
  }
  return (out.pushUps || out.squats || out.sitUps) ? out : null;
}

/**
 * Stage-k target for one exercise: linear interpolation baseline → 100 across
 * stages 1–10 (stage 1 IS the baseline, stage 10 is always the full 100).
 * Clamped to [6, 100]; the caller additionally caps at the stage's authored
 * total so a scaled target never exceeds what the stage prescribes.
 */
export function targetForStage(baseline, stageNumber) {
  if (!Number.isFinite(baseline)) return GOAL;
  const b = Math.max(1, Math.round(baseline));
  const k = Math.min(10, Math.max(1, Math.round(stageNumber)));
  const raw = b + (GOAL - b) * ((k - 1) / 9);
  return Math.max(6, Math.min(GOAL, Math.round(raw)));
}

/**
 * Scale a FLATTENED fit-task list (one entry per performed set) so each
 * exercise's stage total matches its baseline-interpolated target.
 * Pure — takes the baseline explicitly so it is testable headlessly.
 *
 * Rules (per PROMPT OP-1): keep the round structure, whole reps only,
 * minimum 4 reps per set, never above the authored (prescribed) reps.
 */
export function scaleFitTasks(tasks, baseline, stageNumber) {
  if (!baseline || !Array.isArray(tasks) || !tasks.length) return tasks;

  // Group the scalable sets by baseline key, preserving order.
  const groups = {}; // key → [taskIndex]
  tasks.forEach((t, i) => {
    const key = t?.type === 'cadenceReps' ? CATEGORY_TO_BASELINE_KEY[t.category] : null;
    if (key && Number.isFinite(baseline[key]) && Number.isFinite(t.reps)) {
      (groups[key] = groups[key] || []).push(i);
    }
  });

  const next = [...tasks];
  for (const key of Object.keys(groups)) {
    const idxs = groups[key];
    const authoredTotal = idxs.reduce((s, i) => s + tasks[i].reps, 0);
    const target = Math.min(authoredTotal, targetForStage(baseline[key], stageNumber));
    if (target >= authoredTotal) continue; // already at/above prescription — leave authored

    // Proportional split, then nudge whole reps until the total matches —
    // within the [4, authored] clamp each set allows.
    const f = target / authoredTotal;
    const scaled = idxs.map(i => Math.min(tasks[i].reps, Math.max(4, Math.round(tasks[i].reps * f))));
    let diff = target - scaled.reduce((s, r) => s + r, 0);
    for (let pass = 0; diff !== 0 && pass < 200; pass++) {
      let moved = false;
      for (let j = 0; j < scaled.length && diff !== 0; j++) {
        if (diff > 0 && scaled[j] < tasks[idxs[j]].reps) { scaled[j]++; diff--; moved = true; }
        else if (diff < 0 && scaled[j] > 4) { scaled[j]--; diff++; moved = true; }
      }
      if (!moved) break; // clamps won — total is as close as the rules allow
    }
    idxs.forEach((i, j) => { next[i] = { ...tasks[i], reps: scaled[j] }; });
  }
  return next;
}

/**
 * The stage-detail summary for One Punch stages 2–9: per-exercise scaled
 * totals vs authored, or null when there is no baseline / nothing to scale.
 * @returns {{pushUps?:{target:number,authored:number}, squats?:…, sitUps?:…}|null}
 */
export function targetsForStage(campaignId, stage) {
  if (!stage || stage.stageType !== 'cadenceCircuit') return null;
  const k = stage.stageNumber;
  if (!(k >= 2 && k <= 9)) return null;
  const baseline = latestBaseline(campaignId);
  if (!baseline) return null;

  const b = stage.fitBlock;
  if (!b) return null;
  const flat = b.tasks
    ? b.tasks
    : (b.tasksPerRound && b.rounds)
      ? (b.variationByRound
        ? b.tasksPerRound
        : Array.from({ length: b.rounds }, () => b.tasksPerRound).flat())
      : [];

  const out = {};
  for (const t of flat) {
    const key = t?.type === 'cadenceReps' ? CATEGORY_TO_BASELINE_KEY[t.category] : null;
    if (!key || !Number.isFinite(baseline[key]) || !Number.isFinite(t.reps)) continue;
    out[key] = out[key] || { target: 0, authored: 0, sets: 0 };
    out[key].authored += t.reps;
    out[key].sets += 1;
  }
  let any = false;
  for (const key of Object.keys(out)) {
    // Same floor the session applies (minimum 4 reps per set), so the number
    // shown on the stage card is the number the workout actually delivers.
    const floor = 4 * out[key].sets;
    out[key].target = Math.min(out[key].authored, Math.max(floor, targetForStage(baseline[key], k)));
    if (out[key].target < out[key].authored) any = true;
  }
  return Object.keys(out).length ? { ...out, scaled: any } : null;
}

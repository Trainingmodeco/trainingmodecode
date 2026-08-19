// Spec 11 (WB-E) — TRAIN AGAIN + last-time progression for the Workout
// Builder. One record remembers the last builder workout the athlete actually
// TOUCHED (≥1 exercise completed); the progression rules read it back:
//   · hit every set last time            → nudge (+1 rep bodyweight,
//                                          +half-step load: 2.5 lb / 1.25 kg)
//   · missed reps / stale (>10 days)     → hold the same target
//   · brand-new exercise                 → no suggestion, the coach sets pace
//   · suggested load beats all-time best → PR attempt
import { classifyType, exerciseKey, getLastWeight, getWeightHistory, normUnit, stepFor, unitLabel } from './weightLog';

const KEY = 'tm_last_builder_workout';
const STALE_DAYS = 10;

// Called from the builder's state effect. A workout with ZERO completions
// never overwrites the record — generating and walking away must not clobber
// the progression history of the last real session.
export function recordBuilderWorkout({ title, cfg, exercises, completed }) {
  try {
    if (typeof localStorage === 'undefined') return;
    if (!Array.isArray(exercises) || !exercises.length) return;
    if (!Object.values(completed || {}).some(Boolean)) return;
    const slim = exercises.map(ex => ({
      id: ex.id, name: ex.name, muscle: ex.muscle, equipment: ex.equipment,
      sets: ex.sets, reps: ex.reps, rest: ex.rest, restSeconds: ex.restSeconds,
      weight: ex.weight, unit: ex.unit,
    }));
    const { savedExercises, ...cfgRest } = cfg || {};
    localStorage.setItem(KEY, JSON.stringify({ title, cfg: cfgRest, exercises: slim, completed, at: Date.now() }));
  } catch { /* quota */ }
}

export function loadLastBuilderWorkout() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const rec = JSON.parse(localStorage.getItem(KEY) || 'null');
    return rec && Array.isArray(rec.exercises) && rec.exercises.length ? rec : null;
  } catch { return null; }
}

export function daysSince(at) {
  return Math.max(0, Math.floor((Date.now() - (at || 0)) / 86400000));
}

function parseTopReps(reps) {
  const nums = String(reps || '').match(/\d+/g);
  return nums ? parseInt(nums[nums.length - 1], 10) : null;
}

// "4-8" → "5-9" · "12" → "13" · anything else unchanged.
export function bumpReps(reps) {
  const s = String(reps || '');
  const range = s.match(/^(\d+)\s*-\s*(\d+)$/);
  if (range) return `${+range[1] + 1}-${+range[2] + 1}`;
  return /^\d+$/.test(s) ? String(+s + 1) : s;
}

function bestWeight(key) {
  return getWeightHistory(key).reduce((m, e) => Math.max(m, e.weight || 0), 0);
}

// The most recent logged DAY for an exercise → "8·8·6" + the load used.
// Capped at the last 6 sets: two sessions in one day (or an over-eager
// logger) must not balloon the row into a wall of numbers.
function lastSessionLine(key) {
  const h = getWeightHistory(key);
  if (!h.length) return null;
  const lastDay = new Date(h[h.length - 1].timestamp || 0).toDateString();
  const day = h.filter(e => new Date(e.timestamp || 0).toDateString() === lastDay).slice(-6);
  const tail = day[day.length - 1];
  return {
    reps: day.map(e => e.reps || '—').join('·'),
    weight: tail.weight,
    unit: normUnit(tail.unit),
  };
}

function findInRecord(rec, ex) {
  if (!rec) return { inLast: false, wasCompleted: false, prevEx: null };
  const key = exerciseKey(ex);
  const idx = rec.exercises.findIndex(e => (e.id || e.name) === key || e.name === ex.name);
  if (idx < 0) return { inLast: false, wasCompleted: false, prevEx: null };
  return { inLast: true, wasCompleted: !!rec.completed?.[idx], prevEx: rec.exercises[idx] };
}

// Progression verdict for one list row. Pass `prev` (a record captured before
// this session started writing its own) to keep comparisons stable mid-workout.
// Returns null for timed holds; otherwise:
//   { state: 'new' } or
//   { state: 'nudge'|'hold', kind, line, ...weighted: unit/lastWeight/suggested/isPR/best,
//     ...bodyweight: suggestedReps }
export function rowProgression(ex, prev) {
  const kind = classifyType(ex);
  if (kind === 'timed') return null;
  const key = exerciseKey(ex);
  const rec = prev === undefined ? loadLastBuilderWorkout() : prev;
  const { inLast, wasCompleted, prevEx } = findInRecord(rec, ex);
  const stale = rec ? daysSince(rec.at) > STALE_DAYS : false;

  // TRAIN AGAIN rows arrive with the nudge ALREADY applied (bumped reps /
  // suggested load baked in) — report them as nudges without stacking another.
  const applied = ex._prog === 'applied';

  if (kind === 'weighted') {
    const last = getLastWeight(key);
    if (!last) return inLast ? { state: 'hold', kind, line: null } : { state: 'new', kind };
    const unit = normUnit(last.unit);
    const inc = stepFor(unit) / 2; // +2.5 lb / +1.25 kg
    const nudge = applied || (inLast && wasCompleted && !stale);
    const suggested = applied ? (ex.weight || last.weight + inc) : nudge ? last.weight + inc : last.weight;
    const best = bestWeight(key);
    const sess = lastSessionLine(key);
    return {
      state: nudge ? 'nudge' : 'hold', kind, unit,
      lastWeight: last.weight, suggested, inc,
      isPR: nudge && suggested > best,
      best,
      line: sess ? `LAST ${sess.reps} @ ${sess.weight} ${unitLabel(sess.unit)}` : `LAST ${last.weight} ${unitLabel(unit)}`,
    };
  }

  // Bodyweight — reps are the load. The guided player counts every rep of a
  // completed set, so "completed" honestly means the prescription was met.
  if (!inLast && !applied) return { state: 'new', kind };
  const top = parseTopReps(ex.reps);
  const prevTop = parseTopReps(prevEx?.reps) || top;
  const nudge = applied || (wasCompleted && !stale);
  const sets = prevEx?.sets || ex.sets || 3;
  return {
    state: nudge ? 'nudge' : 'hold', kind,
    line: wasCompleted && prevTop ? `LAST ${Array.from({ length: sets }, () => prevTop).join('·')}` : null,
    suggestedReps: !top ? null : applied ? top : nudge ? top + 1 : top,
  };
}

// One-tap plan for the TRAIN AGAIN card: the last workout with every nudge
// baked into the rows (bumped reps · suggested loads pre-set so the get-ready
// screen and rest logger pre-fill them).
export function trainAgainPlan() {
  const rec = loadLastBuilderWorkout();
  if (!rec) return null;
  const days = daysSince(rec.at);
  const stale = days > STALE_DAYS;
  let repNudges = 0, loadNudges = 0, holds = 0, loadName = null, loadInc = 2.5, loadUnit = 'lb';
  const rows = rec.exercises.map(ex => {
    const p = rowProgression(ex, rec);
    if (!p || p.state !== 'nudge' || stale) { holds++; return { ...ex }; }
    if (p.kind === 'bodyweight') { repNudges++; return { ...ex, reps: bumpReps(ex.reps), _prog: 'applied' }; }
    loadNudges++; loadName = ex.name; loadInc = p.inc; loadUnit = p.unit;
    return { ...ex, weight: p.suggested, unit: p.unit, _prog: 'applied' };
  });
  const chips = [];
  if (repNudges) chips.push({ tone: 'nudge', label: `▲ +1 REP × ${repNudges} MOVE${repNudges > 1 ? 'S' : ''}` });
  if (loadNudges) chips.push({ tone: 'nudge', label: loadNudges === 1 ? `▲ +${loadInc} ${unitLabel(loadUnit)} ${String(loadName).toUpperCase()}` : `▲ +${loadInc} ${unitLabel(loadUnit)} × ${loadNudges} LIFTS` });
  if (!repNudges && !loadNudges) chips.push({ tone: 'hold', label: 'STEADY — SAME TARGETS' });
  else if (holds) chips.push({ tone: 'hold', label: `= HOLD × ${holds}` });
  const ago = days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
  return {
    title: rec.title || 'LAST WORKOUT',
    agoPhrase: stale ? `${days} days ago — ease back in` : ago,
    stale,
    meta: `${rows.length} exercises · ${(rec.cfg?.muscleGroups || []).slice(0, 2).join(', ')} · ${rec.cfg?.difficulty || ''}`,
    chips: chips.slice(0, 3),
    cfg: rec.cfg,
    exercises: rows,
  };
}

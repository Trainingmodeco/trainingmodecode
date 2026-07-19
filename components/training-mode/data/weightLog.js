// Weight logging for weighted lifts (design 38a). Each saved set records
// { exerciseId, setIndex, weight, unit, reps, timestamp } keyed by exercise,
// so the rest-time logger can auto-fill from the athlete's last load and the
// voice coach can announce it ("Load one thirty-five. Get ready. Lift.").
const STORAGE_KEY = 'tm_weight_log';
const MAX_PER_EXERCISE = 60;

function loadAll() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}

function saveAll(all) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); } catch { /* quota */ }
}

export function logSetWeight({ exerciseId, setIndex, weight, unit, reps }) {
  if (!exerciseId || !Number.isFinite(weight) || weight <= 0) return;
  const all = loadAll();
  const list = all[exerciseId] || [];
  list.push({ exerciseId, setIndex, weight, unit, reps, timestamp: Date.now() });
  if (list.length > MAX_PER_EXERCISE) list.splice(0, list.length - MAX_PER_EXERCISE);
  all[exerciseId] = list;
  saveAll(all);
}

// Latest logged entry for an exercise (this session or any previous one).
export function getLastWeight(exerciseId) {
  const list = loadAll()[exerciseId];
  return list && list.length ? list[list.length - 1] : null;
}

// Placeholder when an exercise has never been logged: an empty bar (LB)
// or a starter pair of dumbbells (KG).
export function defaultWeight(unit) {
  return String(unit).toLowerCase() === 'kg' ? 20 : 45;
}

// ── Weight display helpers (design 39) ──────────────────────────────────────
// Stable key for an exercise's weight history (matches the rest-time logger).
export function exerciseKey(ex) {
  return ex?.id || ex?.name || 'exercise';
}

// Classify a workout row so the UI knows whether a weight applies.
//   timed      — a hold/duration ("40s")
//   bodyweight — equipment is bodyweight
//   weighted   — everything else (a load applies)
export function classifyType(ex) {
  if (/^\d+\s*s$/i.test(String(ex?.reps || '').trim())) return 'timed';
  if (String(ex?.equipment || '').toLowerCase() === 'bodyweight') return 'bodyweight';
  return 'weighted';
}

// Normalize any unit spelling to 'lb' | 'kg'.
export function normUnit(unit) {
  return String(unit || 'lb').toLowerCase() === 'kg' ? 'kg' : 'lb';
}

// Uppercase label for display ('LB' | 'KG').
export function unitLabel(unit) {
  return normUnit(unit).toUpperCase();
}

// The stepper increment for a unit (5 lb / 2.5 kg).
export function stepFor(unit) {
  return normUnit(unit) === 'kg' ? 2.5 : 5;
}

// Convert a value between lb/kg, rounded to that unit's step so the number
// stays clean (e.g. 135 lb → 60 kg, 245 lb → 110 kg, 80 kg → 175 lb).
export function convertWeight(value, fromUnit, toUnit) {
  const from = normUnit(fromUnit);
  const to = normUnit(toUnit);
  if (from === to || !Number.isFinite(value)) return value;
  const raw = to === 'kg' ? value / 2.2046226 : value * 2.2046226;
  const step = stepFor(to);
  return Math.max(step, Math.round(raw / step) * step);
}

// The weight to show for a row, or null. Priority: a weight set on the exercise
// this session (edit sheet) → the last logged set from history → null.
export function exerciseWeight(ex) {
  if (Number.isFinite(ex?.weight) && ex.weight > 0) return { weight: ex.weight, unit: normUnit(ex.unit) };
  const last = getLastWeight(exerciseKey(ex));
  return last ? { weight: last.weight, unit: normUnit(last.unit) } : null;
}

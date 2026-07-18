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
  return unit === 'KG' ? 20 : 45;
}

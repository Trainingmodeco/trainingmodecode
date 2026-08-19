const STORAGE_KEY = 'tm_saved_routines';
// Hard ceiling for everyone (Pro included) — the library lives in the
// WORKOUT PROGRAMS page and stays a curated shelf, not an archive.
export const MAX_ROUTINES = 10;

// Named workout-builder routines: the generated (and possibly hand-tuned)
// exercise list plus the config that produced it, so a saved routine loads
// back exactly as it was.
export function loadRoutines() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

function saveAll(list) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_ROUTINES)));
    }
  } catch {}
}

export function saveRoutine(name, cfg, exercises) {
  const list = loadRoutines();
  const routine = {
    id: `routine-${Date.now()}`,
    name: String(name || 'My Routine').trim().slice(0, 40),
    cfg,
    exercises,
    savedAt: Date.now(),
  };
  // Replace a routine with the same name instead of stacking duplicates.
  const existing = list.findIndex(r => r.name.toLowerCase() === routine.name.toLowerCase());
  if (existing >= 0) list.splice(existing, 1, routine);
  // A full shelf refuses a NEW save (returns null) rather than silently
  // dropping the athlete's oldest routine off the end.
  else if (list.length >= MAX_ROUTINES) return null;
  else list.unshift(routine);
  saveAll(list);
  return routine;
}

export function deleteRoutine(id) {
  saveAll(loadRoutines().filter(r => r.id !== id));
}

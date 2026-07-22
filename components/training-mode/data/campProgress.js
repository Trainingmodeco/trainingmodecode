// Phase 2 · 2.4 — Training Camp progress. Which level the athlete is on
// (1..12). Completing the current level advances the cursor and unlocks the
// next. Kept tiny and localStorage-backed; per-session state lives elsewhere.
const KEY = 'tm_camp_progress';

export function loadCampProgress() {
  try {
    const n = parseInt(localStorage.getItem(KEY) || '1', 10);
    return Math.max(1, Math.min(12, Number.isFinite(n) ? n : 1));
  } catch { return 1; }
}

// Mark a level cleared. Advancing only happens when you clear the level you're
// currently on (replaying an earlier level never moves the cursor). Returns the
// new current level.
export function completeCampLevel(level) {
  const cur = loadCampProgress();
  if (level >= cur && level < 12) {
    const next = level + 1;
    try { localStorage.setItem(KEY, String(next)); } catch { /* quota */ }
    return next;
  }
  return cur;
}

export function resetCampProgress() {
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
}

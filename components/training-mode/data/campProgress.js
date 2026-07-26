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

// Item 13b — clearing L12 is the end of the camp, and the cursor alone cannot
// say so: it stops at 12 whether the title fight was won or is still ahead.
// This is the separate flag that makes the whole 12-level camp read as finished.
const DONE_KEY = 'tm_camp_complete';

export function isCampComplete() {
  try { return localStorage.getItem(DONE_KEY) === '1'; } catch { return false; }
}

export function campCompletedAt() {
  try { return localStorage.getItem(DONE_KEY + '_at') || null; } catch { return null; }
}

/** Win the title fight. Idempotent — returns true only on the first win. */
export function markCampComplete() {
  if (isCampComplete()) return false;
  try {
    localStorage.setItem(DONE_KEY, '1');
    localStorage.setItem(DONE_KEY + '_at', new Date().toISOString());
  } catch { /* quota */ }
  return true;
}

export function resetCampProgress() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(DONE_KEY);
    localStorage.removeItem(DONE_KEY + '_at');
  } catch { /* noop */ }
}

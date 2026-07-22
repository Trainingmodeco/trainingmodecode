// Phase 2 · 2.4b — per-level session state for split camp levels (L4–11).
// A split level has two missions — S1 · AM (SKILL / combat, done fresh) and
// S2 · PM (CONDITIONING / physical) — with independent completion. The level
// clears only when both are ✓✓. Single-session levels never touch this.
const KEY = 'tm_camp_sessions';

export function loadCampSessions() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}

export function campSessionState(level) {
  return loadCampSessions()[level] || {};
}

// Mark one mission done; returns the level's updated {s1, s2} state.
export function markCampSessionDone(level, slot) {
  const all = loadCampSessions();
  const cur = { ...(all[level] || {}), [slot]: true };
  all[level] = cur;
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* quota */ }
  return cur;
}

export function resetCampSessions() {
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
}

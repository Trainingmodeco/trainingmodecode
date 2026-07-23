// Phase 2 · 2.6 — PAR-Q+ pre-participation screening. Shown ONCE, the first time
// the athlete opens a Training Camp. A "yes" to any question never hard-blocks:
// it recommends medical guidance and softly defaults the camp toward Easy. The
// result is remembered so the gate never nags again (re-take from Settings later
// if we add it). Kept tiny + localStorage-backed, same shape as campProgress.
const KEY = 'tm_camp_parq';

// { done: true, anyYes: boolean, ts: number }  — or { done: false } if never taken.
export function loadParq() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { done: false, anyYes: false };
    const p = JSON.parse(raw);
    return { done: !!p.done, anyYes: !!p.anyYes, ts: p.ts };
  } catch { return { done: false, anyYes: false }; }
}

export function saveParq(anyYes) {
  const rec = { done: true, anyYes: !!anyYes, ts: Date.now() };
  try { localStorage.setItem(KEY, JSON.stringify(rec)); } catch { /* quota */ }
  return rec;
}

export function resetParq() {
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
}

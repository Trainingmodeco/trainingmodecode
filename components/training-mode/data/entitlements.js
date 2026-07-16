// ─── Entitlements skeleton (DORMANT) ────────────────────────────────────────
// The Pro / free split from the monetization blueprint, defined in ONE place
// so flipping the paywall on later is a matter of calling these gates from
// the UI — no logic hunting. Nothing enforces these yet: isPro() returns
// true for everyone until real accounts + Stripe entitlements ship.
//
// Planned free tier (see blueprint):
//   · Arcade: Saga 1, stages 1–3 free; 4+ / boss / mythic are Pro
//   · Workout Builder: 1 saved routine slot free
//   · Everything else (daily bout, XP, streaks, Fight Focus, Quick Mission)
//     stays free forever.

const KEY = 'tm_entitlements';

export const GATES = {
  freeArcadeStages: 3,   // stages 1..N free per saga
  freeRoutineSlots: 1,   // saved-routine slots on the free tier
};

// LAUNCH SWITCH: flip to true when accounts + Stripe are live and the free
// tier limits should start applying to non-Pro users.
export const PAYWALL_ENABLED = false;

function storedPlan() {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(KEY);
  } catch { return null; }
}

// Until the paywall is enabled, everyone is effectively Pro.
export function isPro() {
  if (!PAYWALL_ENABLED) return true;
  return storedPlan() === 'pro' || storedPlan() === 'founder';
}

export function canAccessStage(stageNumber) {
  return isPro() || (stageNumber || 1) <= GATES.freeArcadeStages;
}

export function routineSlotLimit() {
  return isPro() ? Infinity : GATES.freeRoutineSlots;
}

// Dev/test helper (and the hook Stripe's webhook target will eventually set).
export function setPlanForTesting(plan) {
  try {
    if (typeof localStorage === 'undefined') return;
    if (plan) localStorage.setItem(KEY, plan);
    else localStorage.removeItem(KEY);
  } catch {}
}

// ─── Entitlements ───────────────────────────────────────────────────────────
// The Pro / free split from the monetization blueprint, in ONE place so gates
// read the same source everywhere. Pro status comes from the signed-in user's
// Supabase `entitlements` row (set by the Stripe webhook on payment); it's
// cached in localStorage so gates stay synchronous and work offline.
//
// Nothing is enforced until PAYWALL_ENABLED is flipped on — until then isPro()
// returns true for everyone (the app ships fully unlocked during beta).
//
// Planned free tier (see blueprint):
//   · Arcade: Saga 1, stages 1–3 free; 4+ / boss / mythic are Pro
//   · Workout Builder: 1 saved routine slot free
//   · Everything else (daily bout, XP, streaks, Fight Focus, Quick Mission) free
import { fetchEntitlement } from './authClient';

const KEY = 'tm_entitlements';        // legacy/dev manual plan ('pro'|'founder')
const CACHE_KEY = 'tm_entitlement_cache';  // { plan, is_pro } synced from Supabase

export const GATES = {
  freeArcadeStages: 3,   // stages 1..N free per saga
  freeRoutineSlots: 1,   // saved-routine slots on the free tier
};

// LAUNCH SWITCH: flip to true when accounts + Stripe are live and the free
// tier limits should start applying to non-Pro users.
export const PAYWALL_ENABLED = false;

// DEVICE-ONLY PREVIEW: test the free-tier gates on YOUR browser without flipping
// the launch switch for everyone. Visit any app URL with ?paywall=preview to
// turn it on (?paywall=off to clear). Only affects this browser — live users are
// untouched until PAYWALL_ENABLED itself is flipped. Use it to confirm gates +
// the Stripe checkout → Pro unlock flow before going live for real.
const PREVIEW_KEY = 'tm_paywall_preview';

function syncPreviewFromUrl() {
  try {
    if (typeof window === 'undefined' || !window.location) return;
    const p = new URLSearchParams(window.location.search).get('paywall');
    if (p == null) return;
    if (p === 'preview' || p === 'on') localStorage.setItem(PREVIEW_KEY, '1');
    else if (p === 'off' || p === 'reset') localStorage.removeItem(PREVIEW_KEY);
  } catch { /* no-op */ }
}
syncPreviewFromUrl();

export function isPaywallPreview() {
  try { return typeof localStorage !== 'undefined' && localStorage.getItem(PREVIEW_KEY) === '1'; } catch { return false; }
}
export function setPaywallPreview(on) {
  try {
    if (typeof localStorage === 'undefined') return;
    if (on) localStorage.setItem(PREVIEW_KEY, '1'); else localStorage.removeItem(PREVIEW_KEY);
  } catch { /* quota */ }
}

// Gates are enforced when the launch switch is on OR this browser opted into
// preview. Everything below reads this instead of PAYWALL_ENABLED directly.
export function paywallActive() {
  return PAYWALL_ENABLED || isPaywallPreview();
}

function readJSON(key) {
  try {
    if (typeof localStorage === 'undefined') return null;
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : null;
  } catch { return null; }
}

function storedPlan() {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(KEY);
  } catch { return null; }
}

// Synchronous Pro check used by every gate. Reads the cached entitlement (and a
// manual dev plan). Until the paywall is enabled, everyone is effectively Pro.
export function isPro() {
  if (!paywallActive()) return true;
  const cache = readJSON(CACHE_KEY);
  if (cache?.is_pro) return true;
  const manual = storedPlan();
  return manual === 'pro' || manual === 'founder';
}

// Fetch the latest entitlement from Supabase and cache it. Call after sign-in
// and after returning from Stripe checkout. Returns the cached entitlement.
export async function refreshEntitlement() {
  const ent = await fetchEntitlement();
  try {
    if (typeof localStorage !== 'undefined') {
      if (ent) localStorage.setItem(CACHE_KEY, JSON.stringify({ plan: ent.plan || 'free', is_pro: !!ent.is_pro }));
      else localStorage.removeItem(CACHE_KEY);
    }
  } catch { /* quota */ }
  return ent;
}

// Clear the cached entitlement (on sign-out).
export function clearEntitlementCache() {
  try { if (typeof localStorage !== 'undefined') localStorage.removeItem(CACHE_KEY); } catch { /* noop */ }
}

// Whether the account actually holds a paid Pro entitlement — independent of
// the beta "everyone is Pro" switch. Used to show upsell vs. member state.
export function hasProEntitlement() {
  const cache = readJSON(CACHE_KEY);
  if (cache?.is_pro) return true;
  const manual = storedPlan();
  return manual === 'pro' || manual === 'founder';
}

export function canAccessStage(stageNumber) {
  return isPro() || (stageNumber || 1) <= GATES.freeArcadeStages;
}

export function routineSlotLimit() {
  return isPro() ? Infinity : GATES.freeRoutineSlots;
}

// Dev/test helper — force a plan locally without paying.
export function setPlanForTesting(plan) {
  try {
    if (typeof localStorage === 'undefined') return;
    if (plan) localStorage.setItem(KEY, plan);
    else localStorage.removeItem(KEY);
  } catch {}
}

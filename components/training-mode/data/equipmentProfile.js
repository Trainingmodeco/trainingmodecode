// Phase 2 · 2.9 — the athlete's equipment profile. Training Mode is bodyweight-
// first: OPEN SPACE + a PHONE is all any session needs. Declaring gear here just
// routes richer variants; when a block calls for gear you DON'T have, the app
// shows a substitution ("no heavy bag → power shadowboxing") and NEVER docks XP
// — only effort is rewarded. IDs match the substitution keys in
// workout-modules.json so the mapping is data-driven.
const KEY = 'tm_equipment';

// The toggleable (non-baseline) gear. Open space / phone / water are always
// assumed and not listed. Order = rough "most common first".
export const GEAR = [
  { id: 'ROPE',          icon: '🪢', label: 'Jump Rope' },
  { id: 'HEAVY_BAG',     icon: '🥊', label: 'Heavy Bag' },
  { id: 'LIGHT_WEIGHTS', icon: '🏋', label: 'Light Weights' },
  { id: 'THAI_PADS',     icon: '🎯', label: 'Pads / Mitts' },
  { id: 'MAT',           icon: '🧘', label: 'Mat' },
  { id: 'MEDBALL',       icon: '⚽', label: 'Medicine Ball' },
  { id: 'ROAD',          icon: '🛣', label: 'Running Route' },
];
export const GEAR_IDS = GEAR.map((g) => g.id);
const GEAR_SET = new Set(GEAR_IDS);

// Default: assume the athlete has the common gear, so a typical setup sees no
// substitution noise. A minimal (phone-only) user turns items off — or taps the
// "just a phone" preset — to get bodyweight substitutions surfaced.
export function loadEquipment() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw == null) return new Set(GEAR_IDS);
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.filter((id) => GEAR_SET.has(id)) : GEAR_IDS);
  } catch { return new Set(GEAR_IDS); }
}

export function saveEquipment(ownedSet) {
  try { localStorage.setItem(KEY, JSON.stringify([...ownedSet])); } catch { /* quota */ }
}

export function hasGear(id) {
  return loadEquipment().has(id);
}

// Given a module's substitutions map ({ EQUIP_ID: substitute_goal }) and the
// owned set, return the substitutions that APPLY (gear the athlete lacks).
// Returns [{ id, sub }] — never throws, never affects XP.
export function neededSubstitutions(substitutions, owned) {
  const own = owned || loadEquipment();
  const out = [];
  for (const [id, sub] of Object.entries(substitutions || {})) {
    if (!own.has(id)) out.push({ id, sub });
  }
  return out;
}

export function resetEquipment() {
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
}

// Fight Mode "arsenal" (design revamp 1.1) — the set of strikes a fighter has
// LEARNED in Practice Mode, persisted per discipline. Completing a strike
// lesson/technique banks its strike here; Combo Coach (1.2) will call only
// learned strikes.
//
// Strikes are stored as canonical tokens that match the words used in combos
// (Jab, Cross, Hook, Low Kick, Roundhouse, …) so 1.2 can filter cleanly.
const STORAGE_KEY = 'tm_arsenal';

// Map the app's display discipline to the combo-data slug.
export function disciplineSlug(d) {
  const s = String(d || '').toLowerCase();
  if (s.includes('muay')) return 'muay-thai';
  if (s.includes('kick')) return 'kickboxing';
  if (s.includes('mma')) return 'mma';
  return 'boxing';
}

// Canonical strike tokens, longest first so compound strikes ("Low Kick",
// "Body Hook", "Spinning Back Kick") win over their sub-words ("Kick", "Hook").
const STRIKE_TOKENS = [
  'Spinning Back Kick', 'Spinning Back Elbow', 'Spinning Backfist', 'Spinning Heel Kick',
  'Question Mark Kick', 'Superman Punch', 'Bolo Punch', 'Flying Knee', 'Jumping Elbow',
  'Switch Kick', 'Body Kick', 'High Kick', 'Low Kick', 'Lead Kick', 'Rear Kick',
  'Hook Kick', 'Axe Kick', 'Wheel Kick', 'Oblique Kick', 'Tornado Kick', 'Check Hook',
  'Shovel Hook', 'Body Jab', 'Body Cross', 'Body Hook', 'Roundhouse', 'Uppercut',
  'Overhand', 'Teep', 'Knee', 'Elbow', 'Hook', 'Cross', 'Jab',
];

// Extract the canonical strike tokens taught by a lesson/technique name.
// Non-strikes (stance, guard, footwork, defense, sprawl…) yield [].
export function strikesFrom(name) {
  let work = ` ${String(name || '').toLowerCase()} `;
  const found = [];
  for (const tok of STRIKE_TOKENS) {
    const t = tok.toLowerCase();
    if (work.includes(t)) {
      found.push(tok);
      work = work.split(t).join(' ');   // consume so sub-words don't re-match
    }
  }
  return found;
}

// Count how many strikes a combo string contains (1.5 stats). Unlike
// strikesFrom, which reports which DISTINCT strikes appear (for arsenal
// gating), this counts every occurrence — "Jab Jab Cross" is 3, not 2 —
// and matches compound strikes first so "Low Kick" isn't double-counted as
// a "Kick". Non-strike movements (slip/roll/pivot) count as 0.
export function countStrikes(name) {
  let work = ` ${String(name || '').toLowerCase()} `;
  let n = 0;
  for (const tok of STRIKE_TOKENS) {
    const t = tok.toLowerCase();
    let idx;
    while ((idx = work.indexOf(t)) !== -1) {
      n++;
      work = work.slice(0, idx) + ' ' + work.slice(idx + t.length);
    }
  }
  return n;
}

function loadAll() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}
function saveAll(all) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); } catch { /* quota */ }
}

// Bank the strikes a completed lesson/technique teaches. Returns the list of
// NEWLY-learned tokens (empty if nothing new / not a strike) so the UI can
// toast "JAB added to your arsenal".
export function addLearned(discipline, name) {
  if (typeof localStorage === 'undefined') return [];
  const tokens = strikesFrom(name);
  if (!tokens.length) return [];
  const slug = disciplineSlug(discipline);
  const all = loadAll();
  const have = new Set(all[slug] || []);
  const fresh = tokens.filter(t => !have.has(t));
  if (!fresh.length) return [];
  fresh.forEach(t => have.add(t));
  all[slug] = [...have];
  saveAll(all);
  return fresh;
}

// Learned strikes for a discipline (array of tokens).
export function getArsenal(discipline) {
  return loadAll()[disciplineSlug(discipline)] || [];
}

// Starter basics every beginner begins with — Basic Mode is a floor, not a
// cage. Tokens cover lead+rear variants ('Hook' spans Lead/Rear Hook).
// Boxing: Jab/Cross/Hooks/Uppercuts · Kickboxing: +Rear Roundhouse ·
// Muay Thai: +Rear Knee · MMA: all of it (sprawl/footwork/defense are
// movements and never gated).
const BOXING_BASICS = ['Jab', 'Cross', 'Hook', 'Uppercut'];
export const STARTER_ARSENAL = {
  boxing: BOXING_BASICS,
  kickboxing: [...BOXING_BASICS, 'Roundhouse'],
  'muay-thai': [...BOXING_BASICS, 'Roundhouse', 'Knee'],
  mma: [...BOXING_BASICS, 'Roundhouse', 'Knee'],
};

// The arsenal Basic Mode actually calls from: starter basics ∪ learned.
export function getEffectiveArsenal(discipline) {
  const slug = disciplineSlug(discipline);
  return [...new Set([...(STARTER_ARSENAL[slug] || []), ...(loadAll()[slug] || [])])];
}

export function arsenalCount(discipline) {
  return getArsenal(discipline).length;
}

export function hasStrike(discipline, token) {
  return getArsenal(discipline).includes(token);
}

// True when every STRIKE in a combo is in the arsenal. Non-strike movements
// (slip, roll, sprawl, feint, pivot, clinch, check, level change…) are not
// gated — only strikes must be learned.
export function comboUsesOnlyLearned(comboText, arsenalArr) {
  const have = new Set(arsenalArr || []);
  const strikes = strikesFrom(comboText);
  return strikes.length > 0 && strikes.every(s => have.has(s));
}

// Filter a list of combo strings to those using only learned strikes (1.2).
// Never returns empty — if the arsenal can't form any combo, the original
// list is returned so a session always has content (the UI nudges practice).
export function filterCombosToArsenal(combos, arsenalArr) {
  if (!arsenalArr || !arsenalArr.length) return combos;
  const usable = combos.filter(c => comboUsesOnlyLearned(c, arsenalArr));
  return usable.length ? usable : combos;
}

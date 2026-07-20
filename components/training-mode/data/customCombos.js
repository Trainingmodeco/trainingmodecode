// Custom combo builder (design 1.3b). Fighters assemble their own combos from
// strikes and save them per discipline; Combo Coach can then drill the selected
// ones instead of the generated pool.
import { disciplineSlug, getEffectiveArsenal } from './arsenal';

const STORAGE_KEY = 'tm_custom_combos';

// The palette an EXPERIENCED fighter builds from — a curated per-discipline
// strike vocabulary. Every token is one the combo system already recognizes
// (so countStrikes / arsenal filtering stay consistent). Beginners instead
// build from their effective arsenal, mirroring Combo Coach's Basic Mode gate.
const BOX = ['Jab', 'Cross', 'Hook', 'Uppercut', 'Overhand', 'Body Jab', 'Body Cross', 'Body Hook'];
const KICK = [...BOX, 'Roundhouse', 'Low Kick', 'Body Kick', 'High Kick', 'Teep', 'Switch Kick', 'Hook Kick'];
export const DISCIPLINE_STRIKES = {
  boxing: BOX,
  kickboxing: KICK,
  'muay-thai': [...KICK, 'Knee', 'Elbow', 'Flying Knee'],
  mma: [...KICK, 'Knee', 'Elbow', 'Superman Punch', 'Spinning Backfist', 'Question Mark Kick'],
};

// Strikes the builder offers for a discipline. Beginners are held to what
// they've actually unlocked; everyone else gets the full discipline vocabulary.
export function getBuilderPalette(discipline, beginner) {
  const slug = disciplineSlug(discipline);
  if (beginner) return getEffectiveArsenal(discipline);
  return DISCIPLINE_STRIKES[slug] || DISCIPLINE_STRIKES.boxing;
}

export function comboText(combo) {
  return (combo?.strikes || []).join(' ');
}

function loadAll() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}
function saveAll(all) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); } catch { /* quota */ }
}

// Saved combos for a discipline (array of { id, name, strikes }).
export function loadCombos(discipline) {
  return loadAll()[disciplineSlug(discipline)] || [];
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// Save a new combo. Names default to "Combo N". Returns the created combo, or
// null if it has no strikes. Capped so the list can't grow unbounded.
const MAX_COMBOS = 24;
export function saveCombo(discipline, { name, strikes }) {
  const clean = (strikes || []).filter(Boolean);
  if (clean.length === 0) return null;
  const slug = disciplineSlug(discipline);
  const all = loadAll();
  const list = all[slug] || [];
  const combo = {
    id: makeId(),
    name: (name || '').trim() || `Combo ${list.length + 1}`,
    strikes: clean,
  };
  all[slug] = [combo, ...list].slice(0, MAX_COMBOS);
  saveAll(all);
  return combo;
}

export function deleteCombo(discipline, id) {
  const slug = disciplineSlug(discipline);
  const all = loadAll();
  all[slug] = (all[slug] || []).filter(c => c.id !== id);
  saveAll(all);
  return all[slug];
}

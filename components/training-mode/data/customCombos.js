// MOVE LAB (design 43a, was "Custom Combos"). A fighting-game-style command list
// of the athlete's own moves, saved per discipline. Two kinds:
//   • BUILD IT  — an ordered strike sequence from the discipline vocabulary
//                 (game-ready: every token is a real strike the game can map).
//   • TYPE IT   — a free-text SIGNATURE special ("Hadouken"); the coach voice
//                 speaks the name verbatim. Signature moves live in the ★ tier
//                 and are not game-ready (no real strike mapping).
// Moves flagged `rotation` join the Combo Coach call rotation alongside stock
// combos. `gameReady` is the flag the future game-link syncs to the in-game
// avatar's move list.
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

// Every strike the game knows (union of all vocabularies), lowercased — a move
// is GAME-READY when every token is one of these.
const KNOWN_STRIKES = new Set(
  Object.values(DISCIPLINE_STRIKES).flat().map((s) => s.toLowerCase()),
);
export function isGameReady(strikes) {
  const clean = (strikes || []).filter(Boolean);
  return clean.length > 0 && clean.every((s) => KNOWN_STRIKES.has(String(s).toLowerCase()));
}

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

// Normalize a stored move to the full Move Lab shape (migrates old records that
// predate rotation/gameReady/signature).
function normalize(m) {
  const signature = m.signature === true;
  return {
    id: m.id,
    name: m.name || 'Move',
    strikes: Array.isArray(m.strikes) ? m.strikes : [],
    signature,
    rotation: m.rotation !== false,                 // default ON
    gameReady: signature ? false : (m.gameReady ?? isGameReady(m.strikes)),
  };
}

// Saved moves for a discipline (already normalized).
export function loadCombos(discipline) {
  return (loadAll()[disciplineSlug(discipline)] || []).map(normalize);
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

const MAX_COMBOS = 24;

// Save a BUILD IT move (ordered strike sequence). Returns the created move, or
// null if it has no strikes.
export function saveCombo(discipline, { name, strikes }) {
  const clean = (strikes || []).filter(Boolean);
  if (clean.length === 0) return null;
  const slug = disciplineSlug(discipline);
  const all = loadAll();
  const list = all[slug] || [];
  const move = {
    id: makeId(),
    name: (name || '').trim() || `Move ${list.length + 1}`,
    strikes: clean,
    signature: false,
    rotation: true,
    gameReady: isGameReady(clean),
  };
  all[slug] = [move, ...list].slice(0, MAX_COMBOS);
  saveAll(all);
  return move;
}

// Save a TYPE IT signature special (free-text; coach speaks the name verbatim).
export function saveSignatureMove(discipline, name) {
  const nm = String(name || '').trim();
  if (!nm) return null;
  const slug = disciplineSlug(discipline);
  const all = loadAll();
  const list = all[slug] || [];
  const move = { id: makeId(), name: nm, strikes: [], signature: true, rotation: true, gameReady: false };
  all[slug] = [move, ...list].slice(0, MAX_COMBOS);
  saveAll(all);
  return move;
}

// Patch a move (e.g. toggle its `rotation` flag). Returns the updated list.
export function updateCombo(discipline, id, patch) {
  const slug = disciplineSlug(discipline);
  const all = loadAll();
  all[slug] = (all[slug] || []).map((c) => (c.id === id ? normalize({ ...c, ...patch }) : c));
  saveAll(all);
  return all[slug].map(normalize);
}

export function deleteCombo(discipline, id) {
  const slug = disciplineSlug(discipline);
  const all = loadAll();
  all[slug] = (all[slug] || []).filter((c) => c.id !== id);
  saveAll(all);
  return all[slug].map(normalize);
}

// Total moves saved across all disciplines (for the hub's move-count chip).
export function totalMoveCount() {
  const all = loadAll();
  return Object.values(all).reduce((n, list) => n + (Array.isArray(list) ? list.length : 0), 0);
}

// Combo Coach call strings for the rotation-flagged moves of a discipline:
// BUILD IT → the strike sequence; TYPE IT → the spoken name. These join the
// Combo Coach pool alongside stock combos.
export function moveLabCallStrings(discipline) {
  return loadCombos(discipline)
    .filter((m) => m.rotation)
    .map((m) => (m.signature ? m.name : comboText(m)))
    .filter(Boolean);
}

// Item 14 — remembers the archetype chosen per discipline.
//
// Keyed by discipline rather than by camp level: an athlete picks a fighting
// style and trains it through the camp, so re-picking on every level would be
// noise. Changing it mid-camp is allowed and just changes the next session.
// Same tiny localStorage shape as campProgress.js.
import { archetypesFor } from '../protocol/content';

const KEY = 'tm_camp_archetype';

function loadAll() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; }
  catch { return {}; }
}

/** The chosen archetype id for a discipline, or the first one as the default. */
export function getArchetypeId(discipline) {
  const list = archetypesFor(discipline) || [];
  if (!list.length) return null;
  const saved = loadAll()[discipline];
  // A saved id from another discipline (or a renamed archetype) must not stick.
  return list.some((a) => a.id === saved) ? saved : list[0].id;
}

/** The full archetype object for a discipline. */
export function getArchetype(discipline) {
  const id = getArchetypeId(discipline);
  return (archetypesFor(discipline) || []).find((a) => a.id === id) || null;
}

export function setArchetypeId(discipline, id) {
  if (!discipline || !id) return;
  try {
    const all = loadAll();
    all[discipline] = id;
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch { /* quota */ }
}

import { loadStats } from './userStats';
import { getActiveChallenge as getArcadeActive } from './arcadeProgress';
import { loadCampProgress } from './campProgress';
import { campLevels } from '../protocol/content';

// Comeback cutscenes (Simplify revamp, Comeback.dc.html) — a full-screen
// pitch for a part of the app someone has drifted away from:
//
// - Training Arcade: 7–14 days since the last stage (only for someone who
//   has played it — "the arcade kept your spot" needs a spot).
// - Combat Conditioning: 21 days without it while active in Fight Mode.
// - Training Camp: 30 days out of camp while active in Fight Mode.
//
// "Active in Fight Mode" is two or more Fight Focus / Combo Coach / Practice
// sessions in the last 14 days. Each cutscene shows at most once per 30 days;
// REMIND ME NEXT WEEK brings it back in 7.

const KEY = 'tm_comeback_v1';
const DAY = 24 * 60 * 60 * 1000;
const FIGHT_TYPES = new Set(['Fight Focus', 'Combo Coach', 'Practice']);

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; }
}
function save(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* quota */ }
}

const at = (s) => Date.parse(s?.completedAt || 0) || 0;
const daysSince = (t, now) => Math.floor((now - t) / DAY);

// Last Training Arcade play: stage attempts are timestamped per series, and
// the in-progress challenge carries its own lastPlayedAt.
export function lastArcadeAt() {
  let last = 0;
  try {
    const all = JSON.parse(localStorage.getItem('tm_arcade_progress') || '{}') || {};
    for (const p of Object.values(all)) for (const a of p?.attempts || []) last = Math.max(last, a?.at || 0);
  } catch { /* none */ }
  return Math.max(last, getArcadeActive()?.lastPlayedAt || 0);
}

// What each cutscene needs to say, from the real record. null = not due.
export function dueComeback(now = Date.now()) {
  const s = load();
  const allowed = (k) => now >= (s[k]?.nextAt || 0);
  const sessions = loadStats().sessions || [];
  const fightActive = sessions.filter(x => FIGHT_TYPES.has(x.type) && now - at(x) <= 14 * DAY).length >= 2;
  const first = sessions.reduce((m, x) => Math.min(m, at(x) || m), now);
  const lastOf = (type) => sessions.filter(x => x.type === type).reduce((m, x) => Math.max(m, at(x)), 0);

  const arcade = lastArcadeAt();
  if (arcade && allowed('arcade')) {
    const d = daysSince(arcade, now);
    if (d >= 7 && d <= 14) return { view: 'arcade', days: d, stage: getArcadeActive() };
  }
  if (fightActive && allowed('cc')) {
    // Never having done it counts once the account is old enough to have.
    const since = lastOf('Combat Conditioning') || first;
    const d = daysSince(since, now);
    if (d >= 21) return { view: 'cc', days: d };
  }
  if (fightActive && allowed('camp')) {
    const last = lastOf('Training Camp');
    const d = daysSince(last || first, now);
    if (d >= 30) {
      const level = loadCampProgress();
      const info = campLevels.find(l => l.level === level) || campLevels[0];
      return { view: 'camp', days: d, never: !last, level, phase: info?.phase_label || 'FOUNDATION', title: info?.title || '' };
    }
  }
  return null;
}

// Shown: not again for 30 days. REMIND ME NEXT WEEK: back in 7.
export function markComebackShown(view, now = Date.now()) {
  const s = load();
  s[view] = { ...(s[view] || {}), shownAt: now, nextAt: now + 30 * DAY };
  save(s);
}
export function remindComebackNextWeek(view, now = Date.now()) {
  const s = load();
  s[view] = { ...(s[view] || {}), nextAt: now + 7 * DAY };
  save(s);
}

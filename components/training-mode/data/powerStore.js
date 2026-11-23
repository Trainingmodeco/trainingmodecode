// POWER's app side (retention, switch `power`): reads the session rows and
// keeps the "already shown" markers in one key (tm_power_moments_v1, synced):
// the low notice of a drain, the RUSTY pop-up of a spell, the revive line.
// POWER itself is never stored: it is recomputed from the rows each time
// (data/power.js), and nothing here touches XP, levels or the streak.
import { loadStats } from './userStats';
import { safeSetItem, safeStorage } from './storageHealth';
import { powerAt, rustyPopup, powerNotice, reviveMoment } from './power';

export const POWER_MOMENTS_KEY = 'tm_power_moments_v1';
const SEEN_CAP = 24;

export function loadPowerMoments() {
  try {
    const p = JSON.parse(safeStorage()?.getItem(POWER_MOMENTS_KEY) || 'null');
    if (p && typeof p === 'object' && Array.isArray(p.seen)) return { seen: p.seen.filter((x) => typeof x === 'string') };
  } catch { /* unreadable: nothing shown yet */ }
  return { seen: [] };
}

export function markPowerMoments(ids = []) {
  const add = (Array.isArray(ids) ? ids : [ids]).filter((x) => typeof x === 'string' && x);
  if (!add.length) return;
  const cur = loadPowerMoments().seen.filter((x) => !add.includes(x));
  safeSetItem(POWER_MOMENTS_KEY, JSON.stringify({ seen: [...cur, ...add].slice(-SEEN_CAP) }));
}

export const loadPower = (now = Date.now(), rows = loadStats().sessions) => powerAt(rows, now);

// The RUSTY pop-up when it is due (null if not): App's turn in the open queue.
export const dueRustyPopup = (now = Date.now()) => rustyPopup(loadPower(now), loadPowerMoments());

// Home's one power notice (a revive not yet shown, else the low notice).
export const takePowerNotice = (now = Date.now(), rows = loadStats().sessions) => powerNotice(rows, now, loadPowerMoments());

// The end screen's revive line for the session that just banked (null if none).
export const takeReviveMoment = (now = Date.now(), { finisher = false } = {}) =>
  reviveMoment({ rows: loadStats().sessions, now, shown: loadPowerMoments(), finisher });

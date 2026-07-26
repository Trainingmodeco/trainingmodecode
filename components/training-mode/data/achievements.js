// Item 10 — the achievements store.
//
// The content has existed since Phase 2 and nothing read it: 9 universal
// families in protocol/data/achievements.json plus 71 campaign-specific ones
// spread across the 8 campaign.json files. This module loads both, remembers
// what has been earned, and exposes the award() call the rest of the app fires.
//
// Persistence follows data/userStats.js exactly: one localStorage key, a
// parsed cache invalidated on write and on cross-tab storage events, and a
// window event so screens can refresh without prop-drilling.
import { achievements as FAMILIES } from '../protocol/content';
import { arcadeCampaigns, getCampaign } from '../protocol/campaigns';

const STORAGE_KEY = 'tm_achievements';
export const ACHIEVEMENTS_UPDATED = 'training-mode-achievements-updated';

let _cache = null;

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => { if (!e.key || e.key === STORAGE_KEY) _cache = null; });
}

// ── Catalogue ──────────────────────────────────────────────────────────────

let _catalogue = null;

/**
 * Every achievement the app knows about, universal first then per campaign.
 * Shape: { id, name, family, trigger, campaignId?, campaignName? }
 */
export function allAchievements() {
  if (_catalogue) return _catalogue;
  const out = [];
  for (const a of FAMILIES || []) {
    out.push({ id: a.id, name: a.family, family: a.family, trigger: a.trigger, campaignId: null, campaignName: null });
  }
  for (const meta of arcadeCampaigns || []) {
    const campaign = getCampaign(meta.id);
    for (const a of campaign?.achievements || []) {
      out.push({
        id: a.id, name: a.name, family: meta.name || meta.id,
        trigger: a.trigger, campaignId: meta.id, campaignName: meta.name || meta.id,
      });
    }
  }
  _catalogue = out;
  return out;
}

/** Look one up by id (null if the id isn't in any campaign or family file). */
export function achievementById(id) {
  return allAchievements().find((a) => a.id === id) || null;
}

// ── Earned state ───────────────────────────────────────────────────────────

function load() {
  if (_cache) return _cache;
  try {
    if (typeof localStorage === 'undefined') return (_cache = {});
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    _cache = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    _cache = {};
  }
  return _cache;
}

function save(map) {
  _cache = null;
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(map)); } catch { /* quota */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(ACHIEVEMENTS_UPDATED));
}

/** Map of earned id → ISO timestamp. */
export function earned() {
  return { ...load() };
}

export function hasEarned(id) {
  return !!load()[id];
}

/**
 * Award an achievement.
 *
 * Idempotent by design: re-clearing a stage must not re-fire the unlock toast,
 * so the FIRST call returns the achievement and every later call returns null.
 * Callers use that return value directly — `const unlocked = award(id)` — and
 * only show a toast when it's truthy.
 *
 * Unknown ids are ignored rather than stored, so a typo in a trigger can't
 * create a phantom badge the Progress grid has no name for.
 */
export function award(id) {
  if (!id) return null;
  const meta = achievementById(id);
  if (!meta) return null;
  const map = load();
  if (map[id]) return null;
  save({ ...map, [id]: new Date().toISOString() });
  return meta;
}

/** Award several at once; returns only the ones that were newly unlocked. */
export function awardMany(ids) {
  return (ids || []).map(award).filter(Boolean);
}

// ── Progress ───────────────────────────────────────────────────────────────

/**
 * Progress for one family (or one campaign, by campaign id).
 * Returns { total, earned, pct, items: [{ ...achievement, earnedAt }] }.
 */
export function progressFor(family) {
  const items = allAchievements()
    .filter((a) => a.family === family || a.campaignId === family)
    .map((a) => ({ ...a, earnedAt: load()[a.id] || null }));
  const done = items.filter((a) => a.earnedAt).length;
  return { total: items.length, earned: done, pct: items.length ? Math.round((done / items.length) * 100) : 0, items };
}

/** Overall counts for the Progress-tab section header. */
export function overallProgress() {
  const all = allAchievements();
  const map = load();
  const done = all.filter((a) => map[a.id]).length;
  return { total: all.length, earned: done, pct: all.length ? Math.round((done / all.length) * 100) : 0 };
}

/**
 * The whole catalogue grouped for display: universal families first, then one
 * group per campaign, each with its earned/total counts.
 */
export function groupedAchievements() {
  const map = load();
  const decorate = (a) => ({ ...a, earnedAt: map[a.id] || null });
  const universal = allAchievements().filter((a) => !a.campaignId).map(decorate);
  const groups = [{
    key: 'universal', title: 'TRAINING MODE', items: universal,
    earned: universal.filter((a) => a.earnedAt).length, total: universal.length,
  }];
  for (const meta of arcadeCampaigns || []) {
    const items = allAchievements().filter((a) => a.campaignId === meta.id).map(decorate);
    if (!items.length) continue;
    groups.push({
      key: meta.id, title: (meta.name || meta.id).toUpperCase(), items,
      earned: items.filter((a) => a.earnedAt).length, total: items.length,
    });
  }
  return groups;
}

/** Test/settings helper — wipe earned state. */
export function resetAchievements() {
  save({});
}

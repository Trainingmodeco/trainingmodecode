// Arcade id migration — franchise names out of the identifiers, without
// costing a single athlete their progress.
//
// WHY. The display names were swept to archetypes in AN-04, but the IDENTIFIERS
// still carried the source franchises: campaign ids like ARC_BAKI, stage ids
// like ARC_BAKI_STG01, and series ids like `berserk-struggler`. Those are not
// private. They shipped in the JavaScript bundle, they were readable in
// devtools, and some of them were public image URLs. For a product that
// deliberately renamed these for legal distance, shipping the originals
// undercut the exercise.
//
// WHY IT IS DELICATE. Those same ids are PROGRESS KEYS:
//   tm_arcade_progress        { [seriesId]: { completedStages: { [stageId]: … } } }
//   tm_arcade_v2              { [campaignId]: highestClearedStageNumber }
//   tm_arcade_intro_seen      { [campaignId]: true }
//   tm_active_arcade_challenge { seriesId, stageId, … }
// Renaming without migrating would silently reset every athlete's Arcade
// ladder to stage 1 — and because those four keys are in cloudSync's SYNC_KEYS,
// the reset would then be uploaded and propagated to their other devices.
//
// DESIGN NOTES, both deliberate:
//
//  1. NO VERSION FLAG. This runs on every boot and again after every cloud
//     restore, because a restore can pull a pre-migration snapshot back down
//     from a device that has not updated yet. A one-shot "already migrated"
//     flag would skip exactly that case and lose the progress. The function is
//     naturally idempotent instead: once no legacy key is present it does
//     nothing, so running it a thousand times is free.
//
//  2. MERGE, NEVER CLOBBER. If both the legacy and the new key exist — which
//     happens when a stale device syncs up after this device migrated — the
//     two are merged by taking the FURTHEST progress on every field. An
//     athlete can gain a cleared stage from a merge; they can never lose one.
//
// The legacy maps are also permanent, not temporary: challenge codes
// (`TMC1.<base64(seriesId|stageId|…)>`) are already out in the world in QR
// codes and messages, and decodeChallenge resolves them through here so an old
// code keeps working forever.

// Old campaign id → new. ARC_GRAVITY was already clean and is absent by design.
export const LEGACY_CAMPAIGN_IDS = {
  ARC_DARKKNIGHT: 'ARC_VIGILANTE',
  ARC_ULTRAINSTINCT: 'ARC_FLOWSTATE',
  ARC_ULTRAEGO: 'ARC_DESTROYER',
  ARC_BAKI: 'ARC_GRAPPLER',
  ARC_BERSERK: 'ARC_STRUGGLER',
  ARC_SONIC: 'ARC_BLUEBLUR',
  ARC_GAROU: 'ARC_MARTIALMONSTER',
};

// Old series id (the carousel/progress key) → new.
export const LEGACY_SERIES_IDS = {
  'dark-knight-protocol': 'vigilante-protocol',
  'ultra-instinct-protocol': 'flow-state-protocol',
  'ultra-ego-style': 'destroyer-protocol',
  'baki-grappler': 'grappler-protocol',
  'berserk-struggler': 'struggler-protocol',
  'hyperbolic-time-chamber': 'gravity-chamber-protocol',
  'blue-blur-speed-protocol': 'blue-blur-protocol',
  'hero-hunter-protocol': 'martial-monster-protocol',
};

/** A series id that may be legacy → the current one. Safe on unknown ids. */
export function resolveSeriesId(id) {
  return LEGACY_SERIES_IDS[id] || id;
}

/** A campaign id that may be legacy → the current one. */
export function resolveCampaignId(id) {
  return LEGACY_CAMPAIGN_IDS[id] || id;
}

/** Stage ids embed the campaign id: ARC_BAKI_STG01 → ARC_GRAPPLER_STG01. */
export function resolveStageId(id) {
  if (typeof id !== 'string') return id;
  for (const [oldId, newId] of Object.entries(LEGACY_CAMPAIGN_IDS)) {
    if (id.startsWith(`${oldId}_`)) return `${newId}${id.slice(oldId.length)}`;
  }
  return id;
}

// ── storage helpers ────────────────────────────────────────────────────────
function readJSON(key) {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function writeJSON(key, value) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(value));
  } catch { /* quota */ }
}

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const union = (a, b) => Array.from(new Set([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]));

// Furthest-progress merge of two per-series progress objects.
function mergeSeriesProgress(a, b) {
  if (!isObj(a)) return b;
  if (!isObj(b)) return a;
  const completedStages = { ...(a.completedStages || {}) };
  for (const [stage, data] of Object.entries(b.completedStages || {})) {
    completedStages[stage] = isObj(completedStages[stage]) && isObj(data)
      ? { ...completedStages[stage], ...data }
      : (completedStages[stage] || data);
  }
  return {
    ...a,
    ...b,
    completedStages,
    unlockedStages: union(a.unlockedStages, b.unlockedStages).sort((x, y) => x - y),
    badges: union(a.badges, b.badges),
    attempts: [...(Array.isArray(a.attempts) ? a.attempts : []), ...(Array.isArray(b.attempts) ? b.attempts : [])],
    currentStage: Math.max(Number(a.currentStage) || 1, Number(b.currentStage) || 1),
    xpEarned: Math.max(Number(a.xpEarned) || 0, Number(b.xpEarned) || 0),
    statXp: { ...(a.statXp || {}), ...(b.statXp || {}) },
  };
}

function remapStageKeys(progress) {
  if (!isObj(progress) || !isObj(progress.completedStages)) return progress;
  const completedStages = {};
  for (const [stageId, data] of Object.entries(progress.completedStages)) {
    completedStages[resolveStageId(stageId)] = data;
  }
  const out = { ...progress, completedStages };
  if (typeof out.lastCompletedStage === 'string') out.lastCompletedStage = resolveStageId(out.lastCompletedStage);
  return out;
}

/**
 * Rewrite every stored arcade id from its legacy form to the current one.
 * Idempotent and safe to call on every boot and after every cloud restore.
 * Returns the number of records it moved, for the smoke test and for logging.
 */
export function migrateArcadeIds() {
  if (typeof localStorage === 'undefined') return 0;
  let moved = 0;

  // 1. tm_arcade_progress — keyed by series id, with stage ids nested inside.
  //    Stage keys are remapped for EVERY entry, not only renamed series: a
  //    series whose slug happened not to change still holds ARC_BAKI_STG01
  //    style stage ids.
  const progress = readJSON('tm_arcade_progress');
  if (isObj(progress)) {
    const next = {};
    let touched = false;
    for (const [seriesId, value] of Object.entries(progress)) {
      const newId = resolveSeriesId(seriesId);
      const remapped = remapStageKeys(value);
      if (newId !== seriesId || remapped !== value) touched = true;
      if (newId !== seriesId) moved++;
      next[newId] = next[newId] ? mergeSeriesProgress(next[newId], remapped) : remapped;
    }
    if (touched) writeJSON('tm_arcade_progress', next);
  }

  // 2. tm_arcade_v2 — keyed by campaign id, value is the highest cleared stage.
  const v2 = readJSON('tm_arcade_v2');
  if (isObj(v2)) {
    const next = {};
    let touched = false;
    for (const [campaignId, value] of Object.entries(v2)) {
      const newId = resolveCampaignId(campaignId);
      if (newId !== campaignId) { touched = true; moved++; }
      const n = Number(value) || 0;
      next[newId] = Math.max(Number(next[newId]) || 0, n);
    }
    if (touched) writeJSON('tm_arcade_v2', next);
  }

  // 3. tm_arcade_intro_seen — keyed by campaign id.
  const intro = readJSON('tm_arcade_intro_seen');
  if (isObj(intro)) {
    const next = {};
    let touched = false;
    for (const [campaignId, value] of Object.entries(intro)) {
      const newId = resolveCampaignId(campaignId);
      if (newId !== campaignId) touched = true;
      next[newId] = next[newId] || value;
    }
    if (touched) writeJSON('tm_arcade_intro_seen', next);
  }

  // 4. tm_active_arcade_challenge — a single pointer at a series + stage.
  const active = readJSON('tm_active_arcade_challenge');
  if (isObj(active) && (active.seriesId || active.stageId)) {
    const seriesId = resolveSeriesId(active.seriesId);
    const stageId = resolveStageId(active.stageId);
    if (seriesId !== active.seriesId || stageId !== active.stageId) {
      writeJSON('tm_active_arcade_challenge', { ...active, seriesId, stageId });
      moved++;
    }
  }

  return moved;
}

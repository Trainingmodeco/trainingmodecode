// Phase 2 · 2.10 — per-campaign arcade progress. Which stage number the athlete
// has cleared in each v2 campaign (0 = none yet, so stage 1 is current). Tiny +
// localStorage-backed, same shape as campProgress. Slice 3 calls clearArcadeStage
// on a valid stage completion.
const KEY = 'tm_arcade_v2';

export function loadArcadeProgress() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; }
  catch { return {}; }
}

export function highestCleared(campaignId) {
  const n = Number(loadArcadeProgress()[campaignId] || 0);
  return Number.isFinite(n) ? Math.max(0, Math.min(12, n)) : 0;
}

// Mark a stage cleared; only advances the campaign's cursor forward.
export function clearArcadeStage(campaignId, stageNumber) {
  const p = loadArcadeProgress();
  if (stageNumber > (p[campaignId] || 0)) {
    p[campaignId] = Math.min(12, stageNumber);
    try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* quota */ }
  }
  return p[campaignId];
}

// Phase 2 · 2.10 — per-campaign arcade progress. Which stage number the athlete
// has cleared in each v2 campaign (0 = none yet, so stage 1 is current). Tiny +
// localStorage-backed, same shape as campProgress. Slice 3 calls clearArcadeStage
// on a valid stage completion.
import { campaignStages } from '../protocol/campaigns';

const KEY = 'tm_arcade_v2';
// Every campaign was restructured from 12 stages to 10, so a hardcoded 12 is
// now above the real maximum — and a saved cursor of 11 or 12 from before the
// change would sit past the end of the ladder forever. Clamp to the campaign's
// actual stage count instead. A stale 12 lands on the new final stage, which is
// the honest reading: that athlete did beat the boss.
const FALLBACK_MAX = 10;

function maxStage(campaignId) {
  try {
    const stages = campaignStages(campaignId);
    return stages.length || FALLBACK_MAX;
  } catch { return FALLBACK_MAX; }
}

export function loadArcadeProgress() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; }
  catch { return {}; }
}

export function highestCleared(campaignId) {
  const n = Number(loadArcadeProgress()[campaignId] || 0);
  return Number.isFinite(n) ? Math.max(0, Math.min(maxStage(campaignId), n)) : 0;
}

// Mark a stage cleared; only advances the campaign's cursor forward.
export function clearArcadeStage(campaignId, stageNumber) {
  const p = loadArcadeProgress();
  if (stageNumber > (p[campaignId] || 0)) {
    p[campaignId] = Math.min(maxStage(campaignId), stageNumber);
    try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* quota */ }
  }
  return p[campaignId];
}

// First-time campaign intro: the big description/rewards modal auto-shows once
// per campaign (then hands off to the stage-1 modal). Tracked separately.
const INTRO_KEY = 'tm_arcade_intro_seen';

export function hasSeenIntro(campaignId) {
  try { return (JSON.parse(localStorage.getItem(INTRO_KEY) || '{}') || {})[campaignId] === true; }
  catch { return false; }
}

export function markIntroSeen(campaignId) {
  try {
    const o = JSON.parse(localStorage.getItem(INTRO_KEY) || '{}') || {};
    o[campaignId] = true;
    localStorage.setItem(INTRO_KEY, JSON.stringify(o));
  } catch { /* quota */ }
}

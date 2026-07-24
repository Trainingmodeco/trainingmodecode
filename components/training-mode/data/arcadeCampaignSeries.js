// Phase 2 · 2.10 — adapt the 5 v2 campaigns into the ORIGINAL arcade "series"
// shape so they render in the existing sliding carousel + zig-zag ladder with NO
// UI change. Each series is tagged `v2Campaign` so pressing START routes to the
// camp round-timer engine (see App.goArcadeSession) instead of the old player.
// FIT / FIGHT / FULL ARC map to the mode selector; easy/normal/hard to difficulty.
import { getCampaign, campaignStages } from '../protocol/campaigns';

// campaignId → { series id (reuses the existing placeholder id where one exists,
// so posters + carousel slot carry over), subtitle, difficultyStars, type }.
const MAP = {
  ARC_DARKKNIGHT:    { id: 'dark-knight-protocol',    subtitle: 'Peak Human Protocol',  stars: 4, type: 'Hybrid' },
  ARC_ULTRAINSTINCT: { id: 'ultra-instinct-protocol', subtitle: 'Flow State Protocol',   stars: 4, type: 'Hybrid / Fight' },
  ARC_ULTRAEGO:      { id: 'ultra-ego-style',         subtitle: 'Destroyer Protocol',    stars: 5, type: 'Fit / Hybrid' },
  ARC_BAKI:          { id: 'baki-grappler',           subtitle: 'Strongest Teen Protocol', stars: 5, type: 'Hybrid' },
  ARC_BERSERK:       { id: 'berserk-struggler',       subtitle: 'Black Swordsman Protocol', stars: 5, type: 'Hybrid' },
  ARC_GRAVITY:       { id: 'hyperbolic-time-chamber', subtitle: 'Tempo Protocol',          stars: 4, type: 'Fit' },
};
// Display order in the carousel.
const ORDER = ['ARC_BAKI', 'ARC_DARKKNIGHT', 'ARC_BERSERK', 'ARC_ULTRAINSTINCT', 'ARC_ULTRAEGO', 'ARC_GRAVITY'];

const shortName = (name) => String(name || '').split('—')[0].trim();

function modeOptionsFromPaths(paths = []) {
  const m = [];
  if (paths.includes('fit')) m.push('fit');
  if (paths.includes('fight')) m.push('fight');
  if (paths.includes('full_arc')) m.push('both');
  return m;
}

function campaignToSeries(campaignId) {
  const c = getCampaign(campaignId);
  if (!c) return null;
  const meta = MAP[campaignId];
  const paths = c.paths_available || ['fit', 'fight', 'full_arc'];
  const modes = modeOptionsFromPaths(paths);
  const stages = campaignStages(campaignId).map((s) => ({
    id: s.stage_id,
    stageNumber: s.stage_number,
    title: s.title,
    phase: s.phase,
    isBoss: s.phase === 'final_boss',
    persona: s.persona,
    mission: s.mission_target || s.purpose || '',
    v2: true,
  }));
  return {
    id: meta.id,
    v2Campaign: campaignId,
    title: shortName(c.name),
    subtitle: meta.subtitle,
    description: c.fantasy || c.tagline || '',
    status: 'active',
    isActive: true,
    isImported: true,
    type: meta.type,
    difficultyStars: meta.stars,
    equipment: 'Bodyweight-first · gear optional',
    durationType: 'Stage-based campaign',
    availableModes: modes,
    modeOptions: modes,                        // drives the mode row in the selector
    difficultyOptions: ['easy', 'normal', 'hard'],
    bannerImage: `/banners/arcade/${meta.id}.webp`,
    rewards: { badge: `${shortName(c.name)} Badge`, title: c.core_rule || 'Campaign Champion', xp: 500 },
    stages,
  };
}

export const CAMPAIGN_SERIES = ORDER.map(campaignToSeries).filter(Boolean);
export const CAMPAIGN_SERIES_BY_ID = Object.fromEntries(CAMPAIGN_SERIES.map((s) => [s.id, s]));
// New series ids that aren't already placeholders in the base list.
export const NEW_CAMPAIGN_SERIES_IDS = ['baki-grappler', 'berserk-struggler'];

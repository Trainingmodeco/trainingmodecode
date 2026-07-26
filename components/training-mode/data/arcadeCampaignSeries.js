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
  ARC_SONIC:         { id: 'blue-blur-speed-protocol', subtitle: 'Speed Protocol',          stars: 4, type: 'Fit / Cardio', title: 'Blue Blur' },
};
// Display order in the carousel.
const ORDER = ['ARC_BAKI', 'ARC_DARKKNIGHT', 'ARC_BERSERK', 'ARC_ULTRAINSTINCT', 'ARC_ULTRAEGO', 'ARC_GRAVITY', 'ARC_SONIC'];

const shortName = (name) => String(name || '').split('—')[0].trim();

// Every Arcade saga caps at 10 stages so the boss always lands at position 10
// (Training Camp keeps its own separate 12-level ladder, unaffected — this
// only reshapes the v2-campaign presentation, never the authored JSON).
// Campaigns authored with 12 stages keep 1-9 as written and jump straight to
// the final-boss stage (originally S12) at position 10; the old positions
// 10-11 don't play in Arcade. Campaigns already authored at <=10 stages
// (e.g. Garou) pass through unchanged.
const ARCADE_MAX_STAGES = 10;

function capToArcadeLength(rawStages) {
  if (rawStages.length <= ARCADE_MAX_STAGES) return rawStages;
  const bossStage = rawStages.find((s) => s.phase === 'final_boss') || rawStages[rawStages.length - 1];
  const nonBoss = rawStages.filter((s) => s !== bossStage);
  return [...nonBoss.slice(0, ARCADE_MAX_STAGES - 1), bossStage];
}

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
  const stages = capToArcadeLength(campaignStages(campaignId)).map((s, i) => ({
    id: s.stage_id,
    stageNumber: i + 1,
    title: s.title,
    phase: s.phase,
    // isFinalRound is the field the whole arcade UI (ladder node, stage-clear
    // overlay, constellation map, stage-intro overlay) already checks for
    // boss presentation — v2 campaigns need it set or their boss stage just
    // renders as a plain numbered node like every other stage.
    isFinalRound: s.phase === 'final_boss',
    isBoss: s.phase === 'final_boss',
    persona: s.persona,
    mission: s.mission_target || s.purpose || '',
    v2: true,
  }));
  return {
    id: meta.id,
    v2Campaign: campaignId,
    title: meta.title || shortName(c.name),
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

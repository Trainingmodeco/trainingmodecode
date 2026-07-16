import { getLevel } from './userStats';
import { getSeriesProgress } from './arcadeProgress';
import { TRAINING_ARCADE_SERIES } from './trainingArcadeData';

// ─── The tier ladder ─────────────────────────────────────────────────────────
// Five visible tiers, then three SECRET tiers past Champion:
//   · Peak Physique  — XP leans toward Fit Mode training
//   · Fight Ascendant — XP leans toward Fight Mode training
//   · Final Form     — maxed Fit + Fight + Combat Conditioning + full saga clears
// One engine so every screen (profile, progress, level-up, results) agrees.

export const VISIBLE_TIERS = [
  { id: 'rookie',   name: 'Rookie',   label: 'Combat Rookie',   color: '#b87333', xp: 0 },
  { id: 'novice',   name: 'Novice',   label: 'Combat Novice',   color: '#c0c0c0', xp: 500 },
  { id: 'warrior',  name: 'Warrior',  label: 'Combat Warrior',  color: '#fde047', xp: 1500 },
  { id: 'elite',    name: 'Elite',    label: 'Combat Elite',    color: '#60a5fa', xp: 3500 },
  { id: 'champion', name: 'Champion', label: 'Combat Champion', color: '#c084fc', xp: 7000 },
];

export const SECRET_TIERS = {
  peakPhysique:   { id: 'peak-physique',   name: 'Peak Physique',   label: 'Peak Physique',   color: '#4ade80', secret: true },
  fightAscendant: { id: 'fight-ascendant', name: 'Fight Ascendant', label: 'Fight Ascendant', color: '#f43f5e', secret: true },
  finalForm:      { id: 'final-form',      name: 'Final Form',      label: 'Final Form',      color: '#fde047', secret: true },
};

// Tunable unlock thresholds — raise finalSagas as more sagas ship.
export const SECRET_UNLOCK = {
  xpPastChampion: 12000,          // total XP where the secret band begins
  finalForm: {
    totalXp: 20000,
    fitXp: 6000,
    fightXp: 6000,
    ccXp: 2000,
    fullyClearedSagas: 1,
  },
};

const FIGHT_TYPES = new Set(['Fight Focus', 'Combo Coach', 'Practice']);
const FIT_TYPES = new Set(['Fit Mode', 'Quick Mission', 'Cardio']);

// Split lifetime XP into fit / fight / combat-conditioning buckets.
export function getModeXp(stats) {
  const out = { fitXp: 0, fightXp: 0, ccXp: 0 };
  for (const s of stats?.sessions || []) {
    const xp = s.xpEarned || 0;
    if (FIGHT_TYPES.has(s.type)) out.fightXp += xp;
    else if (FIT_TYPES.has(s.type)) out.fitXp += xp;
    else if (s.type === 'Combat Conditioning') out.ccXp += xp;
  }
  return out;
}

function fullyClearedSagaCount() {
  let n = 0;
  for (const series of TRAINING_ARCADE_SERIES) {
    const total = series?.stages?.length || 0;
    if (!total) continue;
    const progress = getSeriesProgress(series.id);
    const cleared = Object.values(progress.completedStages || {}).filter(s => s?.completed).length;
    if (cleared >= total) n++;
  }
  return n;
}

// Visible-tier index for a level — same banding the app has always used.
export function tierIndexForLevel(level) {
  return Math.min(Math.floor(((level || 1) - 1) / 3), VISIBLE_TIERS.length - 1);
}

// The user's current tier, secret tiers included. Pass loadStats() output.
export function getCurrentTier(stats) {
  const xp = stats?.xp || 0;

  if (xp >= SECRET_UNLOCK.xpPastChampion) {
    const { fitXp, fightXp, ccXp } = getModeXp(stats);
    const ff = SECRET_UNLOCK.finalForm;
    if (
      xp >= ff.totalXp &&
      fitXp >= ff.fitXp && fightXp >= ff.fightXp && ccXp >= ff.ccXp &&
      fullyClearedSagaCount() >= ff.fullyClearedSagas
    ) {
      return SECRET_TIERS.finalForm;
    }
    return fitXp >= fightXp ? SECRET_TIERS.peakPhysique : SECRET_TIERS.fightAscendant;
  }

  return VISIBLE_TIERS[tierIndexForLevel(getLevel(xp))];
}

// Avatar art path for a tier id + profile sex (SafeImage serves the WebP).
export function tierImage(tierId, sex) {
  const s = String(sex || 'male').toLowerCase() === 'female' ? 'female' : 'male';
  return `/static/tiers/${tierId}-${s}.png`;
}

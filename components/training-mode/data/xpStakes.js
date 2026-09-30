// XP stakes for a live verdict — a sprint chase escaped or caught, a rush
// held or dropped, a camp stage cleared or failed. One table for every mode,
// keyed by effort tier, so a win always pays more than a loss costs and HARD
// raises both. Difficulty names from the fight side (Easy / Normal / Hard /
// Advanced) map onto the same three rows.
export const XP_STAKES_BY_TIER = {
  easy:   { win: 8,  loss: 3 },
  normal: { win: 10, loss: 5 },
  hard:   { win: 15, loss: 8 },
};

const ALIAS = { beginner: 'easy', intermediate: 'normal', advanced: 'hard', savage: 'hard', elite: 'hard', pro: 'hard' };

export function tierKey(tier) {
  const k = String(tier || 'normal').trim().toLowerCase();
  return XP_STAKES_BY_TIER[k] ? k : (ALIAS[k] || 'normal');
}

export function stakesFor(tier) {
  return XP_STAKES_BY_TIER[tierKey(tier)];
}

// A clean round — the bell to the bell with no pause — pays a flat bonus.
export const CLEAN_ROUND_XP = 5;
export function cleanRoundXp(cleanRounds) {
  return Math.max(0, Math.round(Number(cleanRounds) || 0)) * CLEAN_ROUND_XP;
}

// A negative split — the second half of a run faster than the first — pays a
// flat bonus and never costs anything: a slower second half is often smart.
export const NEGATIVE_SPLIT_XP = 10;

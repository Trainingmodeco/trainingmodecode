/**
 * TRAINING MODE — App-to-Game Fighter Profile Engine (reference implementation)
 *
 * THE core hook of Training Mode: The Game. Reads a user's real app usage
 * (XP, discipline, and which features they train most) and computes the
 * fighter they earn in the game — strengths AND weaknesses.
 *
 * Design rules (from the founder — these are product law, not suggestions):
 *  - WORKOUT BUILDER  → STRENGTH: big strike damage.
 *  - CARDIO           → STAMINA: the gas tank. Decline cardio → you gas out.
 *  - QUICK MISSION    → ENDURANCE: recovery/regen between exchanges & rounds.
 *  - FIGHT FOCUS      → HIT XP: bonus XP/meter every time you land a strike,
 *                       plus better effective strike range.
 *  - COMBO COACH      → COMBO MASTERY: longer combo strings, and strikes in
 *                       combos do more damage.
 *  - PRACTICE MODE    → MOVE LIST: each completed lesson unlocks that strike
 *                       in-game. Never trained fight mode → limited strikes.
 *  - TRAINING ARCADE  → SPECIAL MOVES: stage/boss clears lock/unlock supers.
 *  - COMBAT CONDITIONING → hybrid: splits its training between strength
 *                       and stamina.
 *  - XP level & tier (Rookie→Champion) carry over 1:1.
 *  - Only validated training counts (app anti-cheat: validation_failed = 0 XP).
 *
 * Engine-agnostic and dependency-free: the app (Expo/JS), a Supabase edge
 * function, and the game engine (Godot/Unity via JSON) can all use the same
 * contract. Pure functions only — same snapshot in, same fighter out.
 */

/**
 * @typedef {Object} FeatureUsage
 * @property {number} sessions       completed, validated sessions
 * @property {number} activeMinutes  validated active minutes (recency-weighted upstream if desired)
 * @property {number} xpEarned       XP earned in this feature (per app xp-rules.json)
 *
 * @typedef {Object} AppUsageSnapshot
 * @property {string} userId
 * @property {number} totalXp
 * @property {number} level
 * @property {'rookie'|'adept'|'veteran'|'elite'|'champion'} tier
 * @property {'boxing'|'kickboxing'|'muay_thai'|'mma'} discipline  most-trained discipline
 * @property {number} streakDays
 * @property {{
 *   workoutBuilder: FeatureUsage,
 *   quickMission: FeatureUsage,
 *   cardio: FeatureUsage,
 *   combatConditioning: FeatureUsage,
 *   fightFocus: FeatureUsage,
 *   comboCoach: FeatureUsage,
 *   practiceMode: FeatureUsage & { lessonsCompleted: string[] },
 *   arcade: FeatureUsage & { stagesCleared: number, bossStagesCleared: number, seriesCleared: string[] }
 * }} features
 */

// ---------------------------------------------------------------------------
// TUNING — every balance knob in one place. Change values, not formulas.
// ---------------------------------------------------------------------------
export const TUNING = {
  STAT_FLOOR: 15,          // nobody starts unplayable
  STAT_CAP: 100,
  SHARE_GAIN: 170,         // how hard "what you do most" dominates a stat
  VOLUME_GAIN: 14,         // log-curve reward for total validated minutes
  VOLUME_PIVOT_MIN: 300,   // minutes at which volume bonus ≈ VOLUME_GAIN
  NEGLECT_SHARE: 0.06,     // below this share of training…
  NEGLECT_MINUTES: 45,     // …and below this lifetime minutes → weakness flag
  STREAK_PERK_DAYS: 7,     // streak needed for the IN_THE_ZONE regen perk

  // Derived-value ranges (game-facing numbers, stat 0→100 maps across these)
  DAMAGE_MULT: [0.7, 1.8],        // strength → strike damage multiplier
  STAMINA_SECONDS: [12, 60],      // stamina → seconds of all-out output before gassing
  REGEN_PER_SEC: [0.5, 3.0],      // endurance → stamina regen per second
  HIT_XP_MULT: [1.0, 2.5],        // hitXp → XP/meter gain per landed strike
  RANGE_BONUS: [0, 0.15],         // hitXp → effective strike-range bonus
  COMBO_LENGTH: [3, 12],          // comboMastery → max combo string length
  COMBO_DAMAGE_MULT: [1.0, 1.6],  // comboMastery → damage scaling inside combos

  // Arcade special-move unlock ladder: stages cleared → special slots
  SPECIAL_UNLOCK_STAGES: [3, 6, 10, 15, 21],
  BOSS_ULT_STAGES: 2,      // boss-stage clears needed for the ultimate slot
};

// Practice Mode lessons → in-game strikes. Everyone gets the DEFAULT_MOVES;
// the rest are earned by actually learning them in the app.
export const DEFAULT_MOVES = ['jab', 'cross', 'shove'];
export const LESSON_TO_MOVE = {
  jab: 'jab', cross: 'cross', lead_hook: 'lead_hook', rear_hook: 'rear_hook',
  lead_uppercut: 'lead_uppercut', rear_uppercut: 'rear_uppercut',
  slip: 'slip_counter', roll: 'roll_counter', check: 'check_block',
  teep: 'teep', roundhouse: 'roundhouse_kick', low_kick: 'low_kick',
  knee: 'knee_strike', elbow: 'elbow_strike', clinch: 'clinch_grab',
  takedown: 'takedown', sprawl: 'sprawl_counter', ground_pound: 'ground_pound',
};

// What each stat trains from. combatConditioning is the deliberate hybrid.
const STAT_SOURCES = {
  strength: [['workoutBuilder', 1.0], ['combatConditioning', 0.5]],
  stamina: [['cardio', 1.0], ['combatConditioning', 0.5]],
  endurance: [['quickMission', 1.0], ['cardio', 0.25]],
  hitXp: [['fightFocus', 1.0]],
  comboMastery: [['comboCoach', 1.0], ['practiceMode', 0.25]],
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = ([lo, hi], t) => lo + (hi - lo) * clamp(t, 0, 1);

/** Share of total validated training minutes each feature represents. */
export function trainingShares(features) {
  const total = Object.values(features).reduce((s, f) => s + (f.activeMinutes || 0), 0);
  const shares = {};
  for (const [name, f] of Object.entries(features)) {
    shares[name] = total > 0 ? (f.activeMinutes || 0) / total : 0;
  }
  return { shares, totalMinutes: total };
}

/** One stat (0–100) from usage share + a log-curve volume bonus. */
function computeStat(sources, features, shares) {
  let share = 0;
  let minutes = 0;
  for (const [feature, weight] of sources) {
    share += (shares[feature] || 0) * weight;
    minutes += (features[feature]?.activeMinutes || 0) * weight;
  }
  const volumeBonus =
    TUNING.VOLUME_GAIN * Math.log1p(minutes / TUNING.VOLUME_PIVOT_MIN) / Math.log(2);
  return clamp(
    Math.round(TUNING.STAT_FLOOR + TUNING.SHARE_GAIN * share + volumeBonus),
    TUNING.STAT_FLOOR,
    TUNING.STAT_CAP,
  );
}

function isNeglected(feature, share) {
  return share < TUNING.NEGLECT_SHARE && (feature?.activeMinutes || 0) < TUNING.NEGLECT_MINUTES;
}

/**
 * The one function the game calls.
 * @param {AppUsageSnapshot} snapshot
 * @returns {object} FighterProfile — see docs/game-concept/03-APP-TO-GAME-SYNC-SPEC.md
 */
export function computeFighterProfile(snapshot) {
  const f = snapshot.features;
  const { shares, totalMinutes } = trainingShares(f);

  const stats = {};
  for (const [stat, sources] of Object.entries(STAT_SOURCES)) {
    stats[stat] = computeStat(sources, f, shares);
  }

  // Move list: Practice Mode lessons unlock strikes; untrained = limited arsenal.
  const learned = (f.practiceMode.lessonsCompleted || [])
    .map((l) => LESSON_TO_MOVE[l])
    .filter(Boolean);
  const moveList = [...new Set([...DEFAULT_MOVES, ...learned])];

  // Special moves: Training Arcade clears unlock super slots; bosses gate the ult.
  const specialSlots = TUNING.SPECIAL_UNLOCK_STAGES.filter(
    (need) => f.arcade.stagesCleared >= need,
  ).length;
  const ultimateUnlocked = f.arcade.bossStagesCleared >= TUNING.BOSS_ULT_STAGES;

  // Perks & weaknesses — the build's personality, readable at a glance.
  const perks = [];
  const weaknesses = [];
  if (stats.strength >= 70 && stats.stamina <= 35) perks.push('GLASS_CANNON');
  if (stats.stamina >= 70 && stats.strength <= 35) perks.push('MARATHON_ENGINE');
  if (stats.strength >= 60 && stats.stamina >= 60) perks.push('COMPLETE_ATHLETE');
  if (snapshot.streakDays >= TUNING.STREAK_PERK_DAYS) perks.push('IN_THE_ZONE');
  if (isNeglected(f.cardio, shares.cardio)) weaknesses.push('GASSES_OUT');
  if (isNeglected(f.workoutBuilder, shares.workoutBuilder)) weaknesses.push('PILLOW_FISTS');
  if (moveList.length <= DEFAULT_MOVES.length + 1) weaknesses.push('LIMITED_ARSENAL');
  if (isNeglected(f.quickMission, shares.quickMission)) weaknesses.push('SLOW_RECOVERY');

  return {
    schemaVersion: 1,
    userId: snapshot.userId,
    level: snapshot.level,
    tier: snapshot.tier,
    discipline: snapshot.discipline,
    stats,
    derived: {
      strikeDamageMultiplier: +lerp(TUNING.DAMAGE_MULT, stats.strength / 100).toFixed(2),
      staminaPoolSeconds: Math.round(lerp(TUNING.STAMINA_SECONDS, stats.stamina / 100)),
      staminaRegenPerSecond: +lerp(TUNING.REGEN_PER_SEC, stats.endurance / 100).toFixed(2),
      hitXpMultiplier: +lerp(TUNING.HIT_XP_MULT, stats.hitXp / 100).toFixed(2),
      strikeRangeBonus: +lerp(TUNING.RANGE_BONUS, stats.hitXp / 100).toFixed(3),
      maxComboLength: Math.round(lerp(TUNING.COMBO_LENGTH, stats.comboMastery / 100)),
      comboDamageMultiplier: +lerp(TUNING.COMBO_DAMAGE_MULT, stats.comboMastery / 100).toFixed(2),
    },
    moveList,
    specials: { slotsUnlocked: specialSlots, ultimateUnlocked },
    perks,
    weaknesses,
    meta: { totalTrainedMinutes: totalMinutes, trainingShares: shares },
  };
}

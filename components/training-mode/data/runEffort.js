// Effort tiers for a run: what "jog", "run" and "sprint" mean in numbers.
//
// The owner set the bands from the belt: JOG 3–5 mph, RUN 6–8, SPRINT 9 and
// up. Not everyone is a great runner and bodies differ, so every session also
// picks EASY / NORMAL / HARD, which chooses where in the band the target sits.
// A normal jog is 4.0 mph (15:00/mi); a hard run is 8.0 (7:30/mi).
//
// These anchors drive three things: the target pace the coach judges you
// against, the speed a guided treadmill programme tells you to set, and the
// speed the dial opens on indoors. Everything is derived from EFFORT_MPH so
// the setup screen, the player and the announcer agree to the tenth.

export const EFFORT_TIERS = ['easy', 'normal', 'hard'];
export const EFFORT_MODES = ['jog', 'run', 'sprint'];

export const EFFORT_MPH = {
  jog:    { easy: 3.0, normal: 4.0, hard: 5.0 },
  run:    { easy: 6.0, normal: 7.0, hard: 8.0 },
  sprint: { easy: 9.0, normal: 10.0, hard: 11.5 },
};

export const TIER_LABEL = { easy: 'EASY', normal: 'NORMAL', hard: 'HARD' };
export const MODE_LABEL = { jog: 'JOG', run: 'RUN', sprint: 'SPRINT' };

const KPH_PER_MPH = 1.609344;

export function normalizeTier(tier) {
  return EFFORT_TIERS.includes(tier) ? tier : 'normal';
}
export function normalizeMode(mode) {
  return EFFORT_MODES.includes(mode) ? mode : 'run';
}

/** Speed in mph for a mode at a tier. */
export function effortMph(mode, tier) {
  return EFFORT_MPH[normalizeMode(mode)][normalizeTier(tier)];
}

/** Speed in the unit's own terms — mph for miles, kph for kilometres. */
export function effortSpeed(mode, tier, unit = 'mi') {
  const mph = effortMph(mode, tier);
  const s = unit === 'km' ? mph * KPH_PER_MPH : mph;
  return Math.round(s * 10) / 10;
}

/** Seconds per unit (mile or kilometre) at a mode and tier. */
export function effortPaceSec(mode, tier, unit = 'mi') {
  const speed = effortSpeed(mode, tier, unit);
  return speed > 0 ? Math.round(3600 / speed) : 0;
}

/** Seconds per unit for an arbitrary speed in that unit. */
export function paceSecFromSpeed(speed) {
  const s = Number(speed) || 0;
  return s > 0 ? Math.round(3600 / s) : 0;
}

// ── Guided programme segment kinds ──────────────────────────────────────────
// A programme says "warm", "hard", "sprint"; the athlete's effort tier says
// how fast that is. Warm-up and cool-down are always the easy end of the jog
// band regardless of tier — nobody warms up hard. Recovery is a jog AT the
// tier, so a HARD athlete recovers at 5.0, not 3.0.
export const SEGMENT_KINDS = ['warm', 'easy', 'hard', 'sprint', 'recover', 'cool'];

export function kindSpeed(kind, tier, unit = 'mi') {
  switch (kind) {
    case 'warm':
    case 'cool':
      return effortSpeed('jog', 'easy', unit);
    case 'easy':
    case 'recover':
      return effortSpeed('jog', tier, unit);
    case 'hard':
      return effortSpeed('run', tier, unit);
    case 'sprint':
      return effortSpeed('sprint', tier, unit);
    default:
      return effortSpeed('run', tier, unit);
  }
}

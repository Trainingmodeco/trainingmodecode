// Combat Conditioning Mission Generator
// Matches prebuilt workouts or generates from exercise library

import {
  CC_PREBUILT_WORKOUTS,
  CC_EXERCISE_LIBRARY,
  CC_CIRCUIT_TEMPLATES,
  CC_RANDOMIZER_RULES,
} from './combatConditioningData.js';

// ─── Constants ─────────────────────────────────────────────────────────────────

const DIFFICULTY_ORDER = ['Easy', 'Normal', 'Hard', 'Advanced'];
const PREBUILT_MATCH_THRESHOLD = 3;

// Equipment tier definitions for filtering
const EQUIPMENT_TIERS = {
  Bodyweight: ['Bodyweight'],
  'Basic Gym': [
    'Bodyweight',
    'Light Dumbbells',
    'Kettlebell',
    'Resistance Band',
    'Dumbbells/Kettlebells',
    'Jump Rope',
    'Dip Station',
    'Pull-Up Bar',
  ],
  'Full Gym': null, // null means allow everything
  'Bags & Combat Gear': [
    'Bodyweight',
    'Heavy Bag',
    'Speed Bag',
    'Light Dumbbells',
    'Timer',
    'Rope/String',
    'Dummy/Sandbag',
    'Sandbag',
    'Towel/Gi',
    'Agility Ladder',
    'Cones',
  ],
  Any: null, // null means allow everything
};

// Work/rest settings by difficulty
const DIFFICULTY_SETTINGS = {
  Easy: { workSeconds: 30, restSeconds: 45, reps: 10 },
  Normal: { workSeconds: 40, restSeconds: 40, reps: 12 },
  Hard: { workSeconds: 45, restSeconds: 30, reps: 15 },
  Advanced: { workSeconds: 50, restSeconds: 25, reps: 8 },
};

// Circuit-style focus (design 15b): biases which exercise categories get picked
// and the rep style. Gas Tank = high-rep endurance/conditioning; Power = explosive
// plyo/power (lower reps); Strike & Strength = striking + strength (moderate reps).
const FOCUS_PROFILES = {
  'gas-tank': {
    categories: ['Cardio', 'Conditioning', 'Intervals', 'Combat Skill Conditioning', 'Bag Work', 'Locomotion', 'Agility', 'Footwork', 'Lower Body Endurance', 'Plyometrics'],
    repScale: 1.4,
  },
  power: {
    categories: ['Plyometrics', 'Power', 'Lateral Power', 'Hip Hinge / Power', 'Rotation / Power', 'Olympic Lift', 'Reaction'],
    repScale: 0.7,
  },
  'strike-strength': {
    categories: ['Striking', 'Bag Work', 'Shadowboxing', 'Strength', 'Loaded Carry', 'Upper Body', 'Upper Body Push', 'Upper Body Pull', 'Fight-Specific', 'Grip Strength'],
    repScale: 1.0,
  },
  // Fight Athlete: hybrid full-body, high-output — pulls from every other
  // profile so the picker gets breadth rather than a single flavour. Rep scale
  // sits between Gas Tank and Strike & Strength.
  'fight-athlete': {
    categories: [
      'Cardio', 'Conditioning', 'Intervals', 'Combat Skill Conditioning',
      'Plyometrics', 'Power', 'Lateral Power', 'Rotation / Power',
      'Striking', 'Bag Work', 'Shadowboxing',
      'Strength', 'Upper Body Push', 'Upper Body Pull', 'Loaded Carry',
      'Footwork', 'Agility', 'Locomotion',
    ],
    repScale: 1.1,
  },
};
function focusProfile(focus) {
  return FOCUS_PROFILES[focus] || FOCUS_PROFILES['gas-tank'];
}
function inFocus(category, profile) {
  return profile.categories.some((c) => c.toLowerCase() === String(category || '').toLowerCase());
}
function scaleReps(reps, profile) {
  if (reps == null) return reps;
  return Math.max(1, Math.round(reps * profile.repScale));
}
// Fraction of a prebuilt's exercises whose category matches the focus profile.
function focusMatchRatio(workout, focus) {
  const profile = focusProfile(focus);
  const cats = (workout.exercises || []).map((name) => {
    const lib = CC_EXERCISE_LIBRARY.find((ex) => ex.name.toLowerCase() === name.toLowerCase());
    return lib ? lib.category : null;
  });
  if (!cats.length) return 0;
  const hits = cats.filter((c) => c && inFocus(c, profile)).length;
  return hits / cats.length;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns the index of a difficulty level, or -1 if not found.
 */
function difficultyIndex(d) {
  return DIFFICULTY_ORDER.indexOf(d);
}

/**
 * Shuffles an array in place (Fisher-Yates) and returns it.
 */
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

/**
 * Parses a rest range string like '20-45 sec' and returns the midpoint in seconds.
 */
function parseRestMid(restRange) {
  if (!restRange) return 30;
  const nums = restRange.match(/\d+/g);
  if (!nums || nums.length === 0) return 30;
  if (nums.length === 1) return parseInt(nums[0], 10);
  return Math.round((parseInt(nums[0], 10) + parseInt(nums[1], 10)) / 2);
}

/**
 * Parses a reps string like '8-20 reps' and returns the midpoint.
 */
function parseRepsMid(repsStr) {
  if (!repsStr) return 10;
  const nums = repsStr.match(/\d+/g);
  if (!nums || nums.length === 0) return 10;
  if (nums.length === 1) return parseInt(nums[0], 10);
  return Math.round((parseInt(nums[0], 10) + parseInt(nums[1], 10)) / 2);
}

/**
 * Checks whether all items in a workout's equipment list are allowed
 * for the user's equipment selection.
 */
function equipmentAllowed(workoutEquipment, userEquipment) {
  const tier = EQUIPMENT_TIERS[userEquipment];
  if (tier === null) return true; // 'Full Gym' or 'Any' allows everything

  return workoutEquipment.every((item) => {
    const lower = item.toLowerCase();
    return tier.some((t) => lower.includes(t.toLowerCase()) || t.toLowerCase().includes(lower));
  });
}

/**
 * Checks whether a single exercise's equipment string is compatible
 * with the user's equipment selection.
 */
function exerciseEquipmentAllowed(exerciseEquipment, userEquipment) {
  const tier = EQUIPMENT_TIERS[userEquipment];
  if (tier === null) return true;

  const lower = exerciseEquipment.toLowerCase();
  return tier.some(
    (t) => lower.includes(t.toLowerCase()) || t.toLowerCase().includes(lower)
  );
}

/**
 * Checks if a workout discipline matches the user's style.
 */
function disciplineMatches(workoutDiscipline, userStyle) {
  if (userStyle === 'All-Around') {
    return true;
  }
  const wd = workoutDiscipline.toLowerCase();
  const us = userStyle.toLowerCase();

  // Direct containment check
  if (wd.includes(us) || us.includes(wd)) return true;

  // Handle slash-separated disciplines
  const parts = wd.split('/').map((s) => s.trim());
  const userParts = us.split('/').map((s) => s.trim());

  for (const wp of parts) {
    for (const up of userParts) {
      if (wp.includes(up) || up.includes(wp)) return true;
    }
  }

  // Universal workouts match all styles
  if (wd === 'universal') return true;

  return false;
}

/**
 * Checks whether an exercise's discipline tags match the randomizer allowed tags.
 */
function exerciseDisciplineMatch(exerciseTags, allowedTags) {
  return exerciseTags.some((tag) =>
    allowedTags.some(
      (allowed) =>
        tag.toLowerCase().includes(allowed.toLowerCase()) ||
        allowed.toLowerCase().includes(tag.toLowerCase())
    )
  );
}

// ─── Mission Name Generator ────────────────────────────────────────────────────

const NAME_PREFIXES = [
  'Iron', 'Steel', 'Combat', 'Battle', 'Warrior', 'Thunder',
  'Fury', 'Savage', 'Apex', 'Titan', 'Strike', 'Blitz',
];
const NAME_SUFFIXES = [
  'Circuit', 'Grind', 'Blaster', 'Engine', 'Burner', 'Protocol',
  'Rush', 'Gauntlet', 'Forged', 'Assault', 'Challenge', 'Session',
];

function generateMissionName(style) {
  const prefix = NAME_PREFIXES[Math.floor(Math.random() * NAME_PREFIXES.length)];
  const suffix = NAME_SUFFIXES[Math.floor(Math.random() * NAME_SUFFIXES.length)];
  const styleWord =
    style === 'All-Around'
      ? 'Fighter'
      : style.split('/')[0].trim();
  return `${prefix} ${styleWord} ${suffix}`;
}

// ─── Prebuilt Scoring ──────────────────────────────────────────────────────────

/**
 * Scores a prebuilt workout against user config. Higher is better.
 * Max possible ~8.
 */
function scorePrebuilt(workout, config) {
  let score = 0;

  // Discipline match (0 or 2)
  if (disciplineMatches(workout.discipline, config.style)) {
    score += 2;
  }

  // Duration match (0, 1, or 2)
  const dur = config.duration;
  if (dur >= workout.durationMin && dur <= workout.durationMax) {
    score += 2; // falls within range
  } else {
    const distMin = Math.abs(dur - workout.durationMin);
    const distMax = Math.abs(dur - workout.durationMax);
    const closest = Math.min(distMin, distMax);
    if (closest <= 5) {
      score += 1; // close enough
    }
    // else 0
  }

  // Difficulty match (0, 1, or 2)
  const userDiffIdx = difficultyIndex(config.difficulty);
  const workoutDiffIdx = difficultyIndex(workout.difficulty);
  if (userDiffIdx === workoutDiffIdx) {
    score += 2; // exact match
  } else if (Math.abs(userDiffIdx - workoutDiffIdx) === 1) {
    score += 1; // one level off
  }

  // Equipment match (0 or 2)
  if (equipmentAllowed(workout.equipment, config.equipment)) {
    score += 2;
  }

  // Circuit-style focus match (0, 2, or 4): strongly reward prebuilts whose
  // exercises land in the selected focus's categories, so the style matters.
  if (config.focus) {
    const ratio = focusMatchRatio(workout, config.focus);
    score += ratio >= 0.6 ? 4 : ratio >= 0.34 ? 2 : 0;
  }

  return score;
}

/**
 * Converts a prebuilt workout to the mission output format.
 */
function prebuiltToMission(workout, config) {
  const settings = DIFFICULTY_SETTINGS[config.difficulty] || DIFFICULTY_SETTINGS.Normal;
  const profile = focusProfile(config.focus);
  // Honor the setup's explicit rounds / work / rest steppers when provided.
  const workBase = config.workSec || settings.workSeconds;
  const restBase = config.restSec != null ? config.restSec : (parseRestMid(workout.restRange) || settings.restSeconds);
  const totalRounds = config.rounds || workout.rounds;

  // Determine format string
  const format = config.format !== 'Auto' ? config.format : workout.format;

  // Per-drill equipment gate. Prebuilts can carry a mixed equipment list
  // (their top-level `equipment` array names every gear item any drill
  // uses); one drill demanding a Trap Bar does not disqualify the whole
  // circuit, but that one drill has to be swapped when the athlete has
  // no weights. We only keep drills whose OWN equipment is in tier.
  const kept = workout.exercises.filter((exName) => {
    const libMatch = CC_EXERCISE_LIBRARY.find(
      (ex) => ex.name.toLowerCase() === exName.toLowerCase()
    );
    if (!libMatch) return true; // unknown drill — trust the prebuilt
    return exerciseEquipmentAllowed(libMatch.equipment, config.equipment);
  });

  const drills = kept.map((exName) => {
    const libMatch = CC_EXERCISE_LIBRARY.find(
      (ex) => ex.name.toLowerCase() === exName.toLowerCase()
    );

    if (libMatch) {
      const isTimedWork =
        libMatch.workType === 'Timed' ||
        libMatch.workType === 'Time/Distance' ||
        libMatch.workType === 'Timed or Reps';

      return {
        name: libMatch.name,
        workType: isTimedWork ? 'timed' : 'reps',
        workSeconds: isTimedWork ? workBase : null,
        reps: !isTimedWork ? scaleReps(parseRepsMid(libMatch.suggestedReps), profile) : null,
        restSeconds: restBase,
        coachingCue: libMatch.coachingCue,
        safetyNote: libMatch.safetyNote,
        isCadenceSafe: libMatch.isCadenceSafe,
        isManualDone: libMatch.isManualDone,
        mediaUrl: null,
      };
    }

    // Fallback if exercise not in library
    return {
      name: exName,
      workType: 'timed',
      workSeconds: workBase,
      reps: null,
      restSeconds: restBase,
      coachingCue: 'Stay focused and maintain form throughout.',
      safetyNote: 'Scale intensity to your level.',
      isCadenceSafe: false,
      isManualDone: false,
      mediaUrl: null,
    };
  });

  // Estimate total minutes
  const totalWorkPerRound = drills.reduce((sum, d) => {
    const workTime = d.workType === 'timed' ? (d.workSeconds || 40) : 30;
    return sum + workTime + d.restSeconds;
  }, 0);
  const estimatedSeconds = totalWorkPerRound * totalRounds;
  const estimatedMinutes = Math.round(estimatedSeconds / 60);

  return {
    missionName: workout.name,
    style: config.style,
    difficulty: config.difficulty,
    focus: config.focus,
    format,
    totalRounds,
    drills,
    totalDrills: drills.length,
    estimatedMinutes,
    voiceOn: config.voiceOn !== undefined ? config.voiceOn : true,
    formPreviewOn: config.formPreviewOn !== undefined ? config.formPreviewOn : false,
    cadenceMs: config.cadenceMs || 2000,
    cadenceCount: config.cadenceCount !== undefined ? config.cadenceCount : true,
    sourceType: 'prebuilt',
    sourceId: workout.id,
  };
}

// ─── Fallback Generation ───────────────────────────────────────────────────────

/**
 * Selects a circuit template that best matches the user's config.
 */
function pickTemplate(config) {
  const scored = CC_CIRCUIT_TEMPLATES.map((t) => {
    let s = 0;
    if (disciplineMatches(t.discipline, config.style)) s += 2;

    // Check difficulty overlap
    const parts = t.difficulty.split('-').map((d) => d.trim());
    const dIdx = difficultyIndex(config.difficulty);
    for (const p of parts) {
      const pIdx = difficultyIndex(p);
      if (pIdx >= 0 && Math.abs(pIdx - dIdx) <= 1) {
        s += 1;
        break;
      }
    }

    // Duration fit
    const [minStr, maxStr] = t.durationRange.split('-');
    const tMin = parseInt(minStr, 10);
    const tMax = parseInt(maxStr, 10);
    if (config.duration >= tMin && config.duration <= tMax) {
      s += 2;
    } else if (Math.abs(config.duration - tMin) <= 5 || Math.abs(config.duration - tMax) <= 5) {
      s += 1;
    }

    return { template: t, score: s };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].template;
}

/**
 * Normalizes a style string to a rules-map key. The setup screen writes
 * "Kickboxing / Muay Thai" (with spaces around the slash) — the randomizer
 * map is keyed "Kickboxing/Muay Thai". Without this normaliser the
 * generator silently falls through to All-Around, so a fighter who picked
 * Muay Thai discipline gets a workout that was never tuned for it. We
 * check equal keys after collapsing whitespace around punctuation and
 * casing.
 */
function normalizeStyleKey(style) {
  if (!style) return 'All-Around';
  const cleaned = String(style).replace(/\s*\/\s*/g, '/').trim();
  const target = cleaned.toLowerCase();
  const keys = Object.keys(CC_RANDOMIZER_RULES);
  return keys.find(k => k.toLowerCase() === target) || 'All-Around';
}

/**
 * Builds a mission from the exercise library using randomizer rules.
 */
function generateFromLibrary(config) {
  const ruleKey = normalizeStyleKey(config.style);
  const rules = CC_RANDOMIZER_RULES[ruleKey] || CC_RANDOMIZER_RULES['All-Around'];
  const settings = DIFFICULTY_SETTINGS[config.difficulty] || DIFFICULTY_SETTINGS.Normal;
  const template = pickTemplate(config);
  const userDiffIdx = difficultyIndex(config.difficulty);

  // Filter exercises by discipline, difficulty, and equipment
  const eligible = CC_EXERCISE_LIBRARY.filter((ex) => {
    // Discipline filter
    if (!exerciseDisciplineMatch(ex.disciplineTags, rules.allowedTags)) return false;

    // Difficulty filter: allow same or one level easier
    const exDiffIdx = difficultyIndex(ex.difficulty);
    if (exDiffIdx > userDiffIdx) return false; // too hard
    if (userDiffIdx - exDiffIdx > 1) return false; // too easy

    // Equipment filter
    if (!exerciseEquipmentAllowed(ex.equipment, config.equipment)) return false;

    return true;
  });

  if (eligible.length === 0) {
    // Emergency fallback: just use bodyweight Universal exercises
    const fallback = CC_EXERCISE_LIBRARY.filter(
      (ex) =>
        ex.equipment === 'Bodyweight' &&
        ex.disciplineTags.includes('Universal')
    );
    return buildMissionFromExercises(shuffle(fallback).slice(0, template.exercisesPerRound), template, config, settings);
  }

  const profile = focusProfile(config.focus);
  const target = template.exercisesPerRound;
  let selected;

  if (config.focus === 'fight-athlete') {
    // Fight Athlete is a hybrid session — its promise is "full body, high
    // output, no limits". Picking with the same "70% focus, 30% others"
    // algorithm the other three presets use makes it collapse onto Gas
    // Tank's session when they share categories, because the shuffle
    // picks the same top-of-list drills. Instead, deliberately draw one
    // drill from EACH of the other three focus buckets, then top up from
    // whatever else is eligible. That is what the tile promises the
    // athlete: strength AND power AND endurance in one circuit, and no
    // two picks from the same lane.
    selected = pickFightAthlete(eligible, target);
  } else {
    // Bias exercise selection toward the circuit-style focus categories,
    // while keeping some variety across categories.
    const preferred = shuffle(eligible.filter((ex) => inFocus(ex.category, profile)));
    const others = shuffle(eligible.filter((ex) => !inFocus(ex.category, profile)));
    selected = [];
    const usedCats = new Set();
    const focusTarget = Math.max(1, Math.round(target * 0.7));
    for (const ex of preferred) {
      if (selected.length >= focusTarget) break;
      if (usedCats.has(ex.category)) continue;
      selected.push(ex);
      usedCats.add(ex.category);
    }
    for (const ex of others) {
      if (selected.length >= target) break;
      if (usedCats.has(ex.category)) continue;
      selected.push(ex);
      usedCats.add(ex.category);
    }
    if (selected.length < target) {
      const chosen = new Set(selected.map((e) => e.id));
      const rest = [...preferred, ...others].filter((e) => !chosen.has(e.id));
      for (const ex of rest) {
        if (selected.length >= target) break;
        selected.push(ex);
      }
    }
  }

  return buildMissionFromExercises(selected, template, config, settings);
}

/**
 * Fight Athlete's picker: one drill per lane (gas / power / strike-and-
 * strength) so the circuit reads as a hybrid, not another endurance day.
 * If a lane is empty in this equipment / difficulty tier we skip it and
 * top up from the general eligible pool.
 */
function pickFightAthlete(eligible, target) {
  const lanes = [
    focusProfile('gas-tank').categories,
    focusProfile('power').categories,
    focusProfile('strike-strength').categories,
  ];
  const chosen = [];
  const usedIds = new Set();
  const usedCats = new Set();
  for (const laneCategories of lanes) {
    const laneProfile = { categories: laneCategories };
    const pool = shuffle(
      eligible.filter(ex => inFocus(ex.category, laneProfile) && !usedIds.has(ex.id) && !usedCats.has(ex.category))
    );
    if (pool.length) {
      chosen.push(pool[0]);
      usedIds.add(pool[0].id);
      usedCats.add(pool[0].category);
    }
  }
  // Top up with any remaining eligible drills (no category repeats first,
  // then anything left).
  const rest = shuffle(eligible.filter(ex => !usedIds.has(ex.id)));
  for (const ex of rest) {
    if (chosen.length >= target) break;
    if (usedCats.has(ex.category)) continue;
    chosen.push(ex);
    usedIds.add(ex.id);
    usedCats.add(ex.category);
  }
  for (const ex of rest) {
    if (chosen.length >= target) break;
    if (usedIds.has(ex.id)) continue;
    chosen.push(ex);
    usedIds.add(ex.id);
  }
  return chosen;
}

/**
 * Takes a list of exercises and assembles the mission object.
 */
function buildMissionFromExercises(exercises, template, config, settings) {
  const profile = focusProfile(config.focus);
  // Honor the setup's explicit work / rest steppers when provided.
  const workBase = config.workSec || settings.workSeconds;
  const restBase = config.restSec != null ? config.restSec : settings.restSeconds;

  // Honor the rounds stepper; otherwise fit rounds to the target duration.
  let rounds = config.rounds;
  if (!rounds) {
    rounds = template.rounds;
    const avgWorkPerExercise = workBase + restBase;
    const estimatedRoundTime = (exercises.length * avgWorkPerExercise) / 60; // minutes per round
    if (estimatedRoundTime > 0) {
      const idealRounds = Math.max(1, Math.round(config.duration / estimatedRoundTime));
      rounds = Math.max(1, Math.min(idealRounds, template.rounds + 2));
    }
  }

  // Determine format
  let format = config.format;
  if (format === 'Auto') {
    format = template.type;
  }

  const drills = exercises.map((ex) => {
    const isTimedWork =
      ex.workType === 'Timed' ||
      ex.workType === 'Time/Distance' ||
      ex.workType === 'Timed or Reps';

    let workSeconds = workBase;
    let reps = null;

    if (isTimedWork || config.format === 'Timed Circuit' || config.format === 'Rounds') {
      workSeconds = workBase;
    } else if (ex.workType === 'Reps' && config.format !== 'Timed Circuit') {
      reps = scaleReps(parseRepsMid(ex.suggestedReps) || settings.reps, profile);
      workSeconds = null;
    }

    return {
      name: ex.name,
      workType: (reps && !workSeconds) ? 'reps' : 'timed',
      workSeconds: (reps && !workSeconds) ? null : (workSeconds || workBase),
      reps: reps,
      restSeconds: restBase,
      coachingCue: ex.coachingCue,
      safetyNote: ex.safetyNote,
      isCadenceSafe: ex.isCadenceSafe,
      isManualDone: ex.isManualDone,
      mediaUrl: null,
    };
  });

  // Estimate total minutes
  const totalWorkPerRound = drills.reduce((sum, d) => {
    const workTime = d.workType === 'timed' ? (d.workSeconds || 40) : 30;
    return sum + workTime + d.restSeconds;
  }, 0);
  const estimatedSeconds = totalWorkPerRound * rounds;
  const estimatedMinutes = Math.round(estimatedSeconds / 60);

  return {
    missionName: generateMissionName(config.style),
    style: config.style,
    difficulty: config.difficulty,
    focus: config.focus,
    format: format,
    totalRounds: rounds,
    drills: drills,
    totalDrills: drills.length,
    estimatedMinutes: estimatedMinutes,
    voiceOn: config.voiceOn !== undefined ? config.voiceOn : true,
    formPreviewOn: config.formPreviewOn !== undefined ? config.formPreviewOn : false,
    cadenceMs: config.cadenceMs || 2000,
    cadenceCount: config.cadenceCount !== undefined ? config.cadenceCount : true,
    sourceType: 'generated',
    sourceId: null,
  };
}

// ─── Main Export ───────────────────────────────────────────────────────────────

/**
 * Generates a Combat Conditioning mission based on user configuration.
 *
 * @param {Object} config
 * @param {string} config.style - 'Boxing' | 'Kickboxing/Muay Thai' | 'MMA' | 'All-Around'
 * @param {number} config.duration - 10 | 15 | 20 | 30 | 45 | 60 (minutes)
 * @param {string} config.difficulty - 'Easy' | 'Normal' | 'Hard' | 'Advanced'
 * @param {string} config.equipment - 'Bodyweight' | 'Basic Gym' | 'Full Gym' | 'Bags & Combat Gear' | 'Any'
 * @param {string} config.format - 'Auto' | 'Timed Circuit' | 'Rounds' | 'Rep-Based'
 * @param {boolean} [config.voiceOn=true]
 * @param {boolean} [config.formPreviewOn=false]
 * @returns {Object} Mission object
 */
export function generateCombatConditioningMission(config) {
  const {
    style = 'All-Around',
    duration = 20,
    difficulty = 'Normal',
    equipment = 'Any',
    format = 'Auto',
    focus = 'gas-tank',
    rounds = null,
    workSec = null,
    restSec = null,
  } = config;

  const normalizedConfig = {
    style,
    duration,
    difficulty,
    equipment,
    format,
    focus,
    rounds,
    workSec,
    restSec,
    voiceOn: config.voiceOn,
    formPreviewOn: config.formPreviewOn,
    cadenceMs: config.cadenceMs,
    cadenceCount: config.cadenceCount,
  };

  // Fight Athlete never resolves to a prebuilt. Its promise ("full body,
  // high output, no limits") is a hybrid drawn deliberately from every
  // lane — a hand-crafted prebuilt would always be more single-focus than
  // that. Sending fight-athlete through the library keeps it from
  // collapsing onto Gas Tank's session for the same (style, equipment,
  // difficulty), which was the root cause of every gas-tank ↔ fight-
  // athlete overlap in the earlier audit.
  if (normalizedConfig.focus === 'fight-athlete') {
    return generateFromLibrary(normalizedConfig);
  }

  // Step 1: Score prebuilt workouts — but only ones the athlete can
  // actually do with the equipment they have. Silently letting a beginner
  // with NONE equipment run "Trap Bar Deadlift · Hang Clean · Kettlebell
  // Swings" because it happened to score highest is worse than sitting a
  // prebuilt out entirely. This gate keeps prebuilts honest about the
  // equipment choice; the library fallback beneath still fills in.
  const eligiblePrebuilts = CC_PREBUILT_WORKOUTS.filter((w) =>
    equipmentAllowed(w.equipment, normalizedConfig.equipment)
  );
  const scored = eligiblePrebuilts.map((w) => ({
    workout: w,
    score: scorePrebuilt(w, normalizedConfig),
  }));

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];

  // Step 2: Use a prebuilt only when it scores well AND reasonably covers
  // the selected focus. The floor is 0.5 (was 0.34) — under half of the
  // drills matching the focus is not "the right circuit style", it is a
  // prebuilt that happened to win on discipline and duration.
  const focusOk = !normalizedConfig.focus || (best && focusMatchRatio(best.workout, normalizedConfig.focus) >= 0.5);
  if (best && best.score >= PREBUILT_MATCH_THRESHOLD && focusOk) {
    return prebuiltToMission(best.workout, normalizedConfig);
  }

  // Step 3: Fallback to a focus-biased mission from the exercise library.
  return generateFromLibrary(normalizedConfig);
}

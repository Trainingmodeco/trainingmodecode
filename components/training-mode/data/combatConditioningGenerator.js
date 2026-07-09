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
 * Parses a time string like '30-60 sec' and returns [min, max] in seconds.
 */
function parseTimeRange(timeStr) {
  if (!timeStr) return [30, 60];
  const nums = timeStr.match(/\d+/g);
  if (!nums || nums.length === 0) return [30, 60];
  // Handle 'min' in the string (e.g., '2-5 min/round')
  const isMinutes = /min/i.test(timeStr);
  const multiplier = isMinutes ? 60 : 1;
  if (nums.length === 1) {
    const val = parseInt(nums[0], 10) * multiplier;
    return [val, val];
  }
  return [parseInt(nums[0], 10) * multiplier, parseInt(nums[1], 10) * multiplier];
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

  return score;
}

/**
 * Converts a prebuilt workout to the mission output format.
 */
function prebuiltToMission(workout, config) {
  const settings = DIFFICULTY_SETTINGS[config.difficulty] || DIFFICULTY_SETTINGS.Normal;
  const restMid = parseRestMid(workout.restRange);

  // Determine format string
  let format = config.format !== 'Auto' ? config.format : workout.format;

  const drills = workout.exercises.map((exName) => {
    // Try to find matching exercise in library for richer data
    const libMatch = CC_EXERCISE_LIBRARY.find(
      (ex) => ex.name.toLowerCase() === exName.toLowerCase()
    );

    if (libMatch) {
      const isTimedWork =
        libMatch.workType === 'Timed' ||
        libMatch.workType === 'Time/Distance' ||
        libMatch.workType === 'Timed or Reps';

      const [timeMin, timeMax] = parseTimeRange(libMatch.suggestedTime);
      const workSec = isTimedWork
        ? Math.min(Math.max(settings.workSeconds, timeMin), timeMax)
        : settings.workSeconds;

      return {
        name: libMatch.name,
        workType: isTimedWork ? 'timed' : 'reps',
        workSeconds: isTimedWork ? workSec : null,
        reps: !isTimedWork ? parseRepsMid(libMatch.suggestedReps) : null,
        restSeconds: restMid,
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
      workSeconds: settings.workSeconds,
      reps: null,
      restSeconds: restMid,
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
  const estimatedSeconds = totalWorkPerRound * workout.rounds;
  const estimatedMinutes = Math.round(estimatedSeconds / 60);

  return {
    missionName: workout.name,
    style: config.style,
    difficulty: config.difficulty,
    format: format,
    totalRounds: workout.rounds,
    drills: drills,
    totalDrills: drills.length,
    estimatedMinutes: estimatedMinutes,
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
 * Builds a mission from the exercise library using randomizer rules.
 */
function generateFromLibrary(config) {
  const ruleKey =
    config.style === 'All-Around' ? 'All-Around' : config.style;
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

  // Try to pick exercises that cover multiple categories for variety
  const byCategory = {};
  for (const ex of eligible) {
    if (!byCategory[ex.category]) byCategory[ex.category] = [];
    byCategory[ex.category].push(ex);
  }

  const selected = [];
  const target = template.exercisesPerRound;
  const categories = Object.keys(byCategory);

  // First pass: pick one from each category (up to target)
  const shuffledCats = shuffle(categories);
  for (const cat of shuffledCats) {
    if (selected.length >= target) break;
    const pool = shuffle(byCategory[cat]);
    if (pool.length > 0) {
      selected.push(pool[0]);
    }
  }

  // Second pass: fill remaining from all eligible
  if (selected.length < target) {
    const selectedIds = new Set(selected.map((e) => e.id));
    const remaining = shuffle(eligible.filter((e) => !selectedIds.has(e.id)));
    for (const ex of remaining) {
      if (selected.length >= target) break;
      selected.push(ex);
    }
  }

  return buildMissionFromExercises(selected, template, config, settings);
}

/**
 * Takes a list of exercises and assembles the mission object.
 */
function buildMissionFromExercises(exercises, template, config, settings) {
  // Determine rounds based on config duration and template
  let rounds = template.rounds;

  // Adjust rounds to fit duration
  const avgWorkPerExercise = settings.workSeconds + settings.restSeconds;
  const estimatedRoundTime = (exercises.length * avgWorkPerExercise) / 60; // minutes per round
  if (estimatedRoundTime > 0) {
    const idealRounds = Math.max(1, Math.round(config.duration / estimatedRoundTime));
    rounds = Math.min(idealRounds, template.rounds + 2); // don't exceed template rounds by too much
    rounds = Math.max(rounds, 1);
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

    let workSeconds = settings.workSeconds;
    let reps = null;

    if (isTimedWork || config.format === 'Timed Circuit' || config.format === 'Rounds') {
      // Use timed work
      const [timeMin, timeMax] = parseTimeRange(ex.suggestedTime);
      workSeconds = Math.min(Math.max(settings.workSeconds, timeMin), timeMax);
    } else if (ex.workType === 'Reps' && config.format !== 'Timed Circuit') {
      reps = parseRepsMid(ex.suggestedReps) || settings.reps;
      workSeconds = null;
    }

    const restMid = parseRestMid(ex.restRange) || settings.restSeconds;

    return {
      name: ex.name,
      workType: (reps && !workSeconds) ? 'reps' : 'timed',
      workSeconds: (reps && !workSeconds) ? null : (workSeconds || settings.workSeconds),
      reps: reps,
      restSeconds: Math.min(restMid, settings.restSeconds + 15),
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
  } = config;

  const normalizedConfig = {
    style,
    duration,
    difficulty,
    equipment,
    format,
    voiceOn: config.voiceOn,
    formPreviewOn: config.formPreviewOn,
    cadenceMs: config.cadenceMs,
    cadenceCount: config.cadenceCount,
  };

  // Step 1: Score all prebuilt workouts
  const scored = CC_PREBUILT_WORKOUTS.map((w) => ({
    workout: w,
    score: scorePrebuilt(w, normalizedConfig),
  }));

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  const best = scored[0];

  // Step 2: If best match exceeds threshold, use prebuilt
  if (best && best.score >= PREBUILT_MATCH_THRESHOLD) {
    return prebuiltToMission(best.workout, normalizedConfig);
  }

  // Step 3: Fallback to generated mission from library
  return generateFromLibrary(normalizedConfig);
}

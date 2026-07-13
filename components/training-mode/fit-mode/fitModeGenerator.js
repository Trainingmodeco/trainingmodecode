import { FIT_MODE_EXERCISES } from './fitModeExerciseData';

const DIFF_ORDER = { Easy: 0, Normal: 1, Hard: 2, Advanced: 2 };

// Muscles that safely share load with the target, used for the related-movement
// fallback (tier D) when a group has a thin pool.
const RELATED_MUSCLES = {
  Chest: ['Triceps', 'Shoulders'],
  Back: ['Biceps', 'Shoulders'],
  Shoulders: ['Chest', 'Triceps', 'Back'],
  Biceps: ['Back', 'Shoulders'],
  Triceps: ['Chest', 'Shoulders'],
  Core: ['Full Body'],
  Quads: ['Glutes', 'Hamstrings'],
  Hamstrings: ['Glutes', 'Quads'],
  Glutes: ['Hamstrings', 'Quads'],
  Calves: ['Quads', 'Hamstrings'],
};

const HISTORY_KEY = 'tm_fit_builder_history';
const HISTORY_DEPTH = 5;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function matchesEquipment(exercise, equipment) {
  if (equipment === 'Hybrid') return true;
  if (equipment === 'Bodyweight') return exercise.equipment === 'Bodyweight';
  // Weighted covers any loaded implement: Weighted, Band, Cable, Machine.
  return exercise.equipment !== 'Bodyweight';
}

function diffDistance(exercise, difficulty) {
  const target = DIFF_ORDER[difficulty] ?? 1;
  const exDiff = DIFF_ORDER[exercise.difficulty] ?? 1;
  return Math.abs(exDiff - target);
}

const FOCUS_PARAMS = {
  Strength:   { reps: '4-8',   sets: 4, setsHigh: 5, rest: 120, restRange: [90, 150], biasCompound: true },
  Hypertrophy:{ reps: '8-12',  sets: 3, setsHigh: 4, rest: 75,  restRange: [60, 90],  biasCompound: false },
  Endurance:  { reps: '15-20', sets: 2, setsHigh: 3, rest: 35,  restRange: [30, 45],  biasCompound: false },
  Hybrid:     { reps: '10-12', sets: 3, setsHigh: 4, rest: 60,  restRange: [45, 90],  biasCompound: false },
};

function tuneForFocus(exercise, difficulty, focus, exerciseIndex) {
  const isTimed = !!exercise.durationSeconds;
  const fp = FOCUS_PARAMS[focus];

  if (!fp) return tuneForDifficulty(exercise, difficulty);

  if (focus === 'Hybrid') {
    const isStrengthSlot = exerciseIndex % 2 === 0;
    const params = isStrengthSlot ? FOCUS_PARAMS.Strength : FOCUS_PARAMS.Endurance;
    const sets = difficulty === 'Easy' ? params.sets - 1 : (difficulty === 'Hard' || difficulty === 'Advanced') ? params.setsHigh : params.sets;
    const rest = params.rest;
    const durationSeconds = isTimed ? (exercise.durationSeconds || 40) : null;
    return {
      sets: Math.max(2, sets),
      restSeconds: isTimed ? Math.round(rest * 0.5) : rest,
      reps: isTimed ? `${durationSeconds}s` : params.reps,
      durationSeconds,
    };
  }

  let sets = fp.sets;
  if (difficulty === 'Easy') sets = Math.max(2, fp.sets - 1);
  else if (difficulty === 'Hard' || difficulty === 'Advanced') sets = fp.setsHigh;

  const rest = fp.rest;
  const durationSeconds = isTimed ? (exercise.durationSeconds || 40) : null;

  return {
    sets,
    restSeconds: isTimed ? Math.round(rest * 0.5) : rest,
    reps: isTimed ? `${durationSeconds}s` : fp.reps,
    durationSeconds,
  };
}

// Adjust sets / reps / rest so Easy, Normal and Hard feel meaningfully
// different regardless of the exercise's stored defaults.
function tuneForDifficulty(exercise, difficulty) {
  const isTimed = !!exercise.durationSeconds;

  if (difficulty === 'Easy') {
    const durationSeconds = isTimed ? Math.min(exercise.durationSeconds || 30, 30) : null;
    return {
      sets: 2,
      restSeconds: isTimed ? 45 : 75,
      reps: isTimed ? `${durationSeconds}s` : '8-12',
      durationSeconds,
    };
  }
  if (difficulty === 'Hard' || difficulty === 'Advanced') {
    const durationSeconds = isTimed ? Math.max(exercise.durationSeconds || 40, 45) : null;
    return {
      sets: 4,
      restSeconds: isTimed ? 25 : 45,
      reps: isTimed ? `${durationSeconds}s` : '12-15',
      durationSeconds,
    };
  }
  // Normal
  const durationSeconds = isTimed ? (exercise.durationSeconds || 40) : null;
  return {
    sets: 3,
    restSeconds: isTimed ? 35 : 60,
    reps: isTimed ? `${durationSeconds}s` : (exercise.reps || '10-12'),
    durationSeconds,
  };
}

// Full-fidelity mapping from a raw data entry to a generated workout item.
// Keeps all useful metadata plus the preview-media foundation fields.
function toWorkoutExercise(exercise, muscleLabel, difficulty, { tier, fallbackUsed, focus, exerciseIndex } = {}) {
  const tuned = focus && FOCUS_PARAMS[focus]
    ? tuneForFocus(exercise, difficulty, focus, exerciseIndex || 0)
    : tuneForDifficulty(exercise, difficulty);
  const item = {
    id: exercise.id,
    name: exercise.name,
    primaryMuscle: exercise.primaryMuscle,
    secondaryMuscles: exercise.secondaryMuscles || [],
    sets: tuned.sets,
    reps: tuned.reps,
    durationSeconds: tuned.durationSeconds,
    restSeconds: tuned.restSeconds,
    rest: `${tuned.restSeconds}s`,
    muscle: (muscleLabel || exercise.primaryMuscle || '').toUpperCase(),
    equipment: exercise.equipment,
    difficulty: exercise.difficulty,
    movementType: exercise.movementType,
    trainingStyle: exercise.trainingStyle,
    coachNote: exercise.coachNote || '',
    voiceIntro: exercise.voiceIntro || '',
    voiceCountingType: exercise.voiceCountingType || 'manual_only',
    tempo: exercise.tempo || null,
    combatCarryover: exercise.combatCarryover || '',
    videoUrl: exercise.videoUrl || '',
    bodyMapRegion: exercise.bodyMapRegion || exercise.primaryMuscle || null,
    // Workout Preview foundation (PART 7). Media is optional; UI falls back to
    // the tip + target-muscle card when previewMediaUrl is empty.
    previewMediaUrl: exercise.previewMediaUrl || exercise.videoUrl || '',
    previewType: exercise.previewType || (exercise.videoUrl ? 'video' : 'none'),
    previewTip: exercise.previewTip || exercise.coachNote || '',
    _tier: tier,
  };
  if (fallbackUsed) item.fallbackUsed = true;
  return item;
}

// Build a tier-ranked candidate list for a single muscle group. Lower tier
// number = better match. Each candidate appears once (best tier wins).
function rankedCandidates(mg, equipment, difficulty) {
  const active = FIT_MODE_EXERCISES.filter(ex => ex.active && !ex.cardioFinisher);
  const ranked = new Map(); // id -> { ex, tier, fallbackUsed }

  const consider = (ex, tier, fallbackUsed) => {
    if (!ex || !ex.id) return;
    const existing = ranked.get(ex.id);
    if (!existing || tier < existing.tier) {
      ranked.set(ex.id, { ex, tier, fallbackUsed: !!fallbackUsed });
    }
  };

  // Tier A: exact primary + equipment + difficulty
  active.forEach(ex => {
    if (ex.primaryMuscle === mg && matchesEquipment(ex, equipment) && ex.difficulty === difficulty) {
      consider(ex, 0, false);
    }
  });
  // Tier B: primary + equipment, difficulty within one step
  active.forEach(ex => {
    if (ex.primaryMuscle === mg && matchesEquipment(ex, equipment) && diffDistance(ex, difficulty) <= 1) {
      consider(ex, 1, false);
    }
  });
  // Tier B2: primary + equipment, any difficulty
  active.forEach(ex => {
    if (ex.primaryMuscle === mg && matchesEquipment(ex, equipment)) {
      consider(ex, 2, false);
    }
  });
  // Tier C: secondary muscle match, equipment respected
  active.forEach(ex => {
    if ((ex.secondaryMuscles || []).includes(mg) && matchesEquipment(ex, equipment)) {
      consider(ex, 3, false);
    }
  });
  // Tier D: related compound movement, equipment respected
  const related = RELATED_MUSCLES[mg] || [];
  active.forEach(ex => {
    if (ex.movementType === 'Compound' && matchesEquipment(ex, equipment) &&
        (related.includes(ex.primaryMuscle) || (ex.secondaryMuscles || []).some(m => related.includes(m)))) {
      consider(ex, 4, true);
    }
  });
  // Tier E: any safe all-around movement matching equipment (last resort)
  active.forEach(ex => {
    if (matchesEquipment(ex, equipment) && (ex.primaryMuscle === 'Full Body' || ex.movementType === 'Compound')) {
      consider(ex, 5, true);
    }
  });
  // Tier F: absolute floor — anything active, ignore equipment
  active.forEach(ex => consider(ex, 6, true));

  return [...ranked.values()];
}

// Greedy pick that honors tier priority while spreading movement patterns and
// avoiding duplicate names across the whole workout.
function pickForGroup(mg, equipment, difficulty, targetCount, usedNames, patternCounts, { focus, baseIndex } = {}) {
  const candidates = rankedCandidates(mg, equipment, difficulty);

  // Focus-based compound bias: for Strength, push compounds earlier in sort.
  const biasCompound = focus === 'Strength';
  // Focus-based bodyweight bias: for Endurance, prefer bodyweight/light moves.
  const biasBodyweight = focus === 'Endurance';

  const picked = [];

  for (let i = 0; i < targetCount; i++) {
    const available = candidates.filter(c => !usedNames.has(c.ex.name));
    if (available.length === 0) break;

    // Sort by tier, then least-used movement pattern, then random tiebreak.
    const jittered = shuffle(available);
    jittered.sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      if (biasCompound) {
        const aC = a.ex.movementType === 'Compound' ? 0 : 1;
        const bC = b.ex.movementType === 'Compound' ? 0 : 1;
        if (aC !== bC) return aC - bC;
      }
      if (biasBodyweight) {
        const aB = a.ex.equipment === 'Bodyweight' ? 0 : 1;
        const bB = b.ex.equipment === 'Bodyweight' ? 0 : 1;
        if (aB !== bB) return aB - bB;
      }
      const pa = patternCounts[a.ex.movementType] || 0;
      const pb = patternCounts[b.ex.movementType] || 0;
      return pa - pb;
    });

    const choice = jittered[0];
    usedNames.add(choice.ex.name);
    patternCounts[choice.ex.movementType] = (patternCounts[choice.ex.movementType] || 0) + 1;
    picked.push(toWorkoutExercise(choice.ex, mg, difficulty, { tier: choice.tier, fallbackUsed: choice.fallbackUsed, focus, exerciseIndex: (baseIndex || 0) + i }));
  }

  return picked;
}

function targetStrengthCount(count, addCardio, difficulty) {
  let total;
  if (count <= 1) total = 5;
  else if (count === 2) total = 6;
  else if (count === 3) total = 7;
  else total = 8;
  // Hard/Advanced sessions run one lift longer so difficulty changes volume,
  // not just sets/reps. Easy keeps the base so it never feels too short.
  if (difficulty === 'Hard' || difficulty === 'Advanced') total += 1;
  // Cardio adds one block; trim one strength slot so the session stays balanced.
  return addCardio ? Math.max(count, total - 1) : total;
}

// Curated conditioning finishers. The `cardioFinisher` flag in the exercise
// data is unreliable (it tags strength lifts like barbell lunges as cardio),
// so a genuine bodyweight-first pool guarantees a real cardio block.
const CARDIO_FINISHER_MOVES = [
  { name: 'Burpees', coachNote: 'Explode up on every rep and control the drop back down.', combatCarryover: 'Builds the get-up-and-go engine for scrambles.' },
  { name: 'Mountain Climbers', coachNote: 'Drive the knees fast while keeping the hips low.', combatCarryover: 'Sharpens hip drive and ground movement.' },
  { name: 'Jumping Jacks', coachNote: 'Stay light on the feet and keep a steady rhythm.', combatCarryover: 'Warms the shoulders and keeps the heart rate up.' },
  { name: 'High Knees', coachNote: 'Pump the arms and drive the knees to hip height.', combatCarryover: 'Trains footwork cadence and endurance.' },
  { name: 'Jump Rope', coachNote: 'Small quick bounces from the ankles, wrists do the work.', combatCarryover: 'Classic boxing conditioning for feet and timing.' },
  { name: 'Skater Hops', coachNote: 'Bound side to side and land soft on a bent knee.', combatCarryover: 'Builds lateral power for slips and pivots.' },
  { name: 'Squat Jumps', coachNote: 'Sink to a squat and jump as high as you can each rep.', combatCarryover: 'Develops explosive leg drive.' },
  { name: 'Fast Feet Shuffle', coachNote: 'Chop the feet as quickly as possible, stay on the balls of your feet.', combatCarryover: 'Improves foot speed and stance transitions.' },
];

function buildCardioBlock(equipment, difficulty) {
  const move = shuffle(CARDIO_FINISHER_MOVES)[0];
  const work = difficulty === 'Easy' ? 30 : (difficulty === 'Hard' || difficulty === 'Advanced') ? 45 : 40;
  const rest = difficulty === 'Easy' ? 30 : (difficulty === 'Hard' || difficulty === 'Advanced') ? 20 : 25;
  const source = {
    id: `cardio_finisher_${move.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    name: move.name,
    primaryMuscle: 'Cardio',
    secondaryMuscles: [],
    equipment: 'Bodyweight',
    difficulty,
    movementType: 'Cardio',
    trainingStyle: 'Conditioning',
    durationSeconds: work,
    restSeconds: rest,
    reps: null,
    coachNote: move.coachNote,
    voiceIntro: `${move.name}. ${move.coachNote}`,
    voiceCountingType: 'timed_interval',
    tempo: null,
    combatCarryover: move.combatCarryover,
    bodyMapRegion: 'Full Body',
    videoUrl: '',
    previewTip: move.coachNote,
  };

  const item = toWorkoutExercise(source, 'Cardio', difficulty);
  item.muscle = 'CARDIO';
  item.voiceCountingType = 'timed_interval';
  item.reps = `${work}s`;
  item.durationSeconds = work;
  item.restSeconds = rest;
  item.rest = `${rest}s`;
  return item;
}

function buildOnce(cfg) {
  const { muscleGroups, equipment, difficulty, addCardio, focus } = cfg;

  // CARDIO ONLY: pull exclusively from the cardio pool.
  if (focus === 'Cardio Only') {
    const count = Math.min(8, Math.max(4, muscleGroups.length + 3));
    const pool = shuffle(CARDIO_FINISHER_MOVES);
    const usedNames = new Set();
    const exercises = [];
    for (let i = 0; i < count; i++) {
      const move = pool[i % pool.length];
      if (usedNames.has(move.name) && i < pool.length) continue;
      usedNames.add(move.name);
      const block = buildCardioBlock(equipment, difficulty);
      block.name = move.name;
      block.id = `cardio_finisher_${move.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
      block.coachNote = move.coachNote;
      block.combatCarryover = move.combatCarryover;
      exercises.push(block);
    }
    return exercises;
  }

  const count = muscleGroups.length;
  const strengthTarget = targetStrengthCount(count, addCardio, difficulty);

  const perGroup = Math.floor(strengthTarget / count);
  const remainder = strengthTarget - perGroup * count;

  const usedNames = new Set();
  const patternCounts = {};
  const exercises = [];

  // Randomize which groups get the extra slot so regenerate varies emphasis.
  const order = shuffle(muscleGroups.map((mg, idx) => ({ mg, idx })));
  const extraForIndex = new Set(order.slice(0, remainder).map(o => o.idx));

  let runningIndex = 0;
  muscleGroups.forEach((mg, idx) => {
    const groupTarget = Math.max(1, perGroup + (extraForIndex.has(idx) ? 1 : 0));
    const picks = pickForGroup(mg, equipment, difficulty, groupTarget, usedNames, patternCounts, { focus, baseIndex: runningIndex });
    runningIndex += picks.length;
    exercises.push(...picks);
  });

  if (addCardio) {
    const cardio = buildCardioBlock(equipment, difficulty);
    if (cardio && !usedNames.has(cardio.name)) exercises.push(cardio);
  }

  return exercises;
}

// Regenerate memory: remember the last few generated name-sets per config so
// tapping regenerate produces something different when the pool allows.
function configSignature(cfg) {
  return [
    [...cfg.muscleGroups].sort().join(','),
    cfg.equipment,
    cfg.difficulty,
    cfg.addCardio ? 'cardio' : 'nocardio',
    cfg.focus,
  ].join('|');
}

function workoutSignature(workout) {
  return workout.map(e => e.name).sort().join('||');
}

function loadHistory() {
  try {
    if (typeof localStorage === 'undefined') return {};
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function saveHistory(signature, workoutSig) {
  try {
    if (typeof localStorage === 'undefined') return;
    const all = loadHistory();
    const list = Array.isArray(all[signature]) ? all[signature] : [];
    const next = [workoutSig, ...list.filter(s => s !== workoutSig)].slice(0, HISTORY_DEPTH);
    all[signature] = next;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(all));
  } catch {
    /* ignore quota / serialization errors */
  }
}

// Validation helper (PART 2 #9). Removes duplicate names, strips cardio when it
// was not requested, and guarantees a non-empty result when criteria exist.
export function validateWorkout(workout, cfg) {
  const seen = new Set();
  const cleaned = [];
  const isCardioOnly = cfg.focus === 'Cardio Only';

  workout.forEach(ex => {
    if (!ex || !ex.name) return;
    if (seen.has(ex.name)) return;
    if (!cfg.addCardio && !isCardioOnly && ex.muscle === 'CARDIO') return;
    seen.add(ex.name);
    cleaned.push(ex);
  });

  return cleaned;
}

export function generateFitModeWorkout(cfg) {
  const safeCfg = {
    muscleGroups: Array.isArray(cfg?.muscleGroups) ? cfg.muscleGroups : [],
    equipment: cfg?.equipment || 'Bodyweight',
    difficulty: cfg?.difficulty || 'Normal',
    addCardio: !!cfg?.addCardio,
    focus: cfg?.focus || 'Strength',
  };

  if (safeCfg.muscleGroups.length === 0) return [];

  const signature = configSignature(safeCfg);
  const recent = loadHistory()[signature] || [];


  // Get names from the most recent workout for this signature to check novelty.
  const lastNames = recent.length > 0 ? new Set(recent[0].split('||')) : null;

  let chosen = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const workout = validateWorkout(buildOnce(safeCfg), safeCfg);
    if (workout.length === 0) continue;

    const wSig = workoutSignature(workout);
    // Must differ from recent history signatures.
    if (recent.includes(wSig)) continue;

    // Must have at least 40% different exercises from the most recent workout.
    if (lastNames && lastNames.size > 0) {
      const currentNames = workout.map(e => e.name);
      const diffCount = currentNames.filter(n => !lastNames.has(n)).length;
      const diffRatio = diffCount / currentNames.length;
      if (diffRatio < 0.4) continue;
    }

    chosen = workout;
    break;
  }

  if (!chosen || chosen.length === 0) {
    // Never return empty when valid criteria are selected.
    // Pool too small to achieve novelty -- allow repeat but reshuffle order.
    const fallback = validateWorkout(buildOnce(safeCfg), safeCfg);
    chosen = shuffle(fallback);
  }

  saveHistory(signature, workoutSignature(chosen));
  return chosen;
}

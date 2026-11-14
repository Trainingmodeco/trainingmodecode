import { FIT_MODE_EXERCISES } from './fitModeExerciseData';
import { applySetScheme, builderWorkoutSeconds } from '../data/builderTiming';

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

// Cable stacks and machines are a gym, not a home. WEIGHTED means what fits
// in a garage — dumbbells, a bar, kettlebells, bands.
const GYM_ONLY = new Set(['Cable', 'Machine']);
function matchesEquipment(exercise, equipment) {
  if (GYM_ONLY.has(exercise.equipment)) return false;
  if (equipment === 'Hybrid') return true;
  if (equipment === 'Bodyweight') return exercise.equipment === 'Bodyweight';
  return exercise.equipment !== 'Bodyweight';
}

function diffDistance(exercise, difficulty) {
  const target = DIFF_ORDER[difficulty] ?? 1;
  const exDiff = DIFF_ORDER[exercise.difficulty] ?? 1;
  return Math.abs(exDiff - target);
}

// Strength used to prescribe 4×4-8 with two minutes' rest — a powerlifting
// template that made a "Normal" home session run an hour and put "120s rest"
// on every row. These are a coach's home-gym numbers.
const FOCUS_PARAMS = {
  Strength:   { reps: '6-10',  sets: 3, setsHigh: 4, rest: 75,  restRange: [60, 90],  biasCompound: true },
  Hypertrophy:{ reps: '8-12',  sets: 3, setsHigh: 4, rest: 60,  restRange: [45, 75],  biasCompound: false },
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

// The sets, reps and rest a library move is dealt at. The focus and
// difficulty tables are written for one movement a rep. A complex whose rep
// is a chain of lifts (fixedDose) keeps its own reps and never rests less
// than it asks: "15-20 reps, 35s rest" of a snatch into a squat is not a
// dose anyone should be dealt. Sets still follow the table.
export function builderDose(exercise, difficulty, focus, exerciseIndex = 0) {
  const byTable = focus && FOCUS_PARAMS[focus]
    ? tuneForFocus(exercise, difficulty, focus, exerciseIndex)
    : tuneForDifficulty(exercise, difficulty);
  return exercise.fixedDose && !exercise.durationSeconds && exercise.reps
    ? { ...byTable, reps: exercise.reps, restSeconds: Math.max(byTable.restSeconds, exercise.restSeconds || 0) }
    : byTable;
}

// Full-fidelity mapping from a raw data entry to a generated workout item.
// Keeps all useful metadata plus the preview-media foundation fields.
function toWorkoutExercise(exercise, muscleLabel, difficulty, { tier, fallbackUsed, focus, exerciseIndex } = {}) {
  const tuned = builderDose(exercise, difficulty, focus, exerciseIndex || 0);
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
  // Carried on the row so a swap knows this dose is the move's own.
  if (exercise.fixedDose) item.fixedDose = true;
  return item;
}

// Build a tier-ranked candidate list for a single muscle group. Lower tier
// number = better match. Each candidate appears once (best tier wins).
//
// Every tier keeps to the athlete's equipment, and an Easy workout never
// takes a Hard move at any tier: the last tiers used to widen to "any
// difficulty" and then "anything active", which put Handstand Holds in an
// Easy session and barbell lifts in a bodyweight one. A thin pool now makes
// a shorter list instead, and the time fit adds sets to fill the minutes.
function rankedCandidates(mg, equipment, difficulty) {
  const easyCap = (ex) => difficulty !== 'Easy' || diffDistance(ex, difficulty) <= 1;
  const active = FIT_MODE_EXERCISES.filter(ex => ex.active && !ex.cardioFinisher && matchesEquipment(ex, equipment) && easyCap(ex));
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
    if (ex.primaryMuscle === mg && ex.difficulty === difficulty) consider(ex, 0, false);
  });
  // Tier B: primary + equipment, difficulty within one step
  active.forEach(ex => {
    if (ex.primaryMuscle === mg && diffDistance(ex, difficulty) <= 1) consider(ex, 1, false);
  });
  // Tier B2: primary + equipment, any difficulty (still never Hard for Easy)
  active.forEach(ex => {
    if (ex.primaryMuscle === mg) consider(ex, 2, false);
  });
  // Tier C: secondary muscle match
  active.forEach(ex => {
    if ((ex.secondaryMuscles || []).includes(mg)) consider(ex, 3, false);
  });
  // Tier D: related compound movement
  const related = RELATED_MUSCLES[mg] || [];
  active.forEach(ex => {
    if (ex.movementType === 'Compound' &&
        (related.includes(ex.primaryMuscle) || (ex.secondaryMuscles || []).some(m => related.includes(m)))) {
      consider(ex, 4, true);
    }
  });
  // Tier E: any safe all-around movement (last resort)
  active.forEach(ex => {
    if (ex.primaryMuscle === 'Full Body' || ex.movementType === 'Compound') consider(ex, 5, true);
  });

  return [...ranked.values()];
}

// Whether a library move may be offered as a SWAP in a workout of this
// equipment and difficulty: the generator's equipment rule (no cable or
// machine for a garage athlete) and within one difficulty step, so Easy is
// never offered a Hard move nor Hard an Easy one. For the Builder's swap list.
export function fitsBuilderSlot(exercise, { equipment, difficulty } = {}) {
  if (!exercise || !exercise.active || !matchesEquipment(exercise, equipment || 'Bodyweight')) return false;
  return diffDistance(exercise, difficulty || 'Normal') <= 1;
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

// The list never runs past eight rows: that is what fits above START on a
// phone, and more than that is a second session, not a longer one.
export const MAX_EXERCISES = 8;

// How many sets a row may grow to when a long session needs the volume (an
// hour on eight rows is five sets a row at Easy's long rests); Hard may go to
// six.
const MAX_SETS = { Easy: 5, Normal: 5, Hard: 6, Advanced: 6 };

// Fit the picked rows to the minutes the athlete chose, by the player's own
// timeline (data/builderTiming). `pool` is every row the session could use, in
// the order they should be dropped from the end (one per group first). Each
// row count is tried with its sets moved one at a time toward the minutes,
// and the closest wins. It used to count rows on a
// flat 35 s a set and keep at least three whatever the time, so a 15-minute
// Hard session ran 22 minutes and a 60-minute one stopped near 40.
function fitToDuration(pool, cardio, cfg) {
  const target = (Number(cfg.duration) || 30) * 60;
  const scheme = cfg.setScheme;
  const shaped = applySetScheme(pool, scheme);
  const total = (rows) => builderWorkoutSeconds(cardio ? [...rows, cardio] : rows);
  const most = MAX_SETS[cfg.difficulty] || 5;
  // A short session drops rows before it thins Hard below three sets.
  const least = cfg.difficulty === 'Hard' || cfg.difficulty === 'Advanced' ? 3 : 2;

  // The first k rows with their sets moved toward the minutes. Sets are ours
  // to change on every row under AUTO, and only on bodyweight rows under a
  // scheme (the scheme fixes every loaded lift).
  const shape = (k) => {
    const rows = shaped.slice(0, k).map(ex => ({ ...ex }));
    const free = rows.map((ex, i) => (!scheme?.sets || String(ex.equipment || '').toLowerCase() === 'bodyweight' ? i : -1)).filter(i => i >= 0);
    for (let guard = 0; guard < 64 && free.length; guard++) {
      const now = total(rows);
      const step = now < target ? 1 : -1;
      // The row that moves: the fewest sets when adding, the most when taking.
      const order = [...free].sort((x, y) => step * (rows[x].sets - rows[y].sets));
      const i = order.find(j => (step > 0 ? rows[j].sets < most : rows[j].sets > least));
      if (i === undefined) break;
      rows[i].sets += step;
      if (Math.abs(total(rows) - target) >= Math.abs(now - target)) { rows[i].sets -= step; break; }
    }
    return rows;
  };

  // Every row count, shaped. Among those within 5% of the minutes the one
  // that moved the fewest sets off the level's own numbers wins (more rows on
  // a tie), so a Hard 30 is six full rows, not four stretched ones; when none
  // is that close, the closest.
  const tries = [];
  for (let k = 1; k <= shaped.length; k++) {
    const rows = shape(k);
    const moved = rows.reduce((n, ex, i) => n + Math.abs(ex.sets - shaped[i].sets), 0);
    tries.push({ rows, off: Math.abs(total(rows) - target), moved });
  }
  if (!tries.length) return [];
  const near = tries.filter(t => t.off <= 0.05 * target);
  const pick = near.length
    ? near.reduce((a, b) => (b.moved < a.moved || (b.moved === a.moved && b.rows.length > a.rows.length) ? b : a))
    : tries.reduce((a, b) => (b.off < a.off ? b : a));
  return pick.rows;
}

// The minutes the setup card can promise, as { lo, hi }. A set scheme fixes
// every loaded lift's sets, reps and rest, and the list stops at eight rows,
// so a light scheme over a long session (3×10 for an hour) cannot fill the
// DURATION picked. Then the card shows what the build runs instead: exact at
// WEIGHTED, where every row is a loaded lift, and a range at HYBRID, whose
// bodyweight rows still grow toward the minutes. Rows that cannot change, so
// this is fitToDuration's own pick: the most rows within 5%, else the closest.
export function builderPromisedMinutes({ duration, equipment, setScheme } = {}) {
  const minutes = Number(duration) || 30;
  const asked = { lo: minutes, hi: minutes };
  if (!setScheme?.sets || equipment === 'Bodyweight') return asked;
  const target = minutes * 60;
  const row = { equipment: 'Dumbbell', sets: setScheme.sets, reps: setScheme.reps, restSeconds: setScheme.restSeconds };
  const tries = [];
  for (let k = 1; k <= MAX_EXERCISES; k++) tries.push(builderWorkoutSeconds(Array(k).fill(row)));
  const near = tries.filter(s => Math.abs(s - target) <= 0.05 * target);
  const sec = near.length ? near[near.length - 1] : tries.reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a));
  if (Math.abs(sec - target) <= 0.15 * target) return asked;
  const built = Math.max(1, Math.round(sec / 60));
  if (equipment !== 'Hybrid') return { lo: built, hi: built };
  return { lo: Math.min(built, minutes), hi: Math.max(built, minutes) };
}

// The setup card's time tag: "30 min" when the build fills the DURATION,
// "~34 min" or "34–60 min" when the set scheme cannot.
export function builderPromisedLabel(cfg = {}) {
  const minutes = Number(cfg.duration) || 30;
  const { lo, hi } = builderPromisedMinutes(cfg);
  if (lo === hi) return lo === minutes ? `${lo} min` : `~${lo} min`;
  return `${lo}–${hi} min`;
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

  // Every row the session could hold, dealt one group at a time in a random
  // group order (round one gives each group its first move, round two its
  // second, …), so cutting from the end for a short session drops whole
  // groups' extras first, and a full-body day with more groups than rows
  // trains a different handful each regenerate.
  const cap = MAX_EXERCISES - (addCardio ? 1 : 0);
  const order = shuffle(muscleGroups);
  const usedNames = new Set();
  const patternCounts = {};
  const pool = [];
  for (let round = 0; pool.length < cap; round++) {
    let added = 0;
    for (const mg of order) {
      if (pool.length >= cap) break;
      const [pick] = pickForGroup(mg, equipment, difficulty, 1, usedNames, patternCounts, { focus, baseIndex: pool.length });
      if (!pick) continue;
      pick._group = order.indexOf(mg);
      pick._round = round;
      pool.push(pick);
      added++;
    }
    if (!added) break;
  }

  const cardio = addCardio ? buildCardioBlock(equipment, difficulty) : null;
  const useCardio = cardio && !usedNames.has(cardio.name) ? cardio : null;
  const fitted = fitToDuration(pool, useCardio, cfg);
  // Back in muscle order for the list: a group's moves sit together.
  const exercises = fitted
    .sort((x, y) => x._group - y._group || x._round - y._round)
    .map(({ _group, _round, ...ex }) => ex);
  if (useCardio) exercises.push(useCardio);
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
    cfg.duration,
    cfg.setScheme ? `${cfg.setScheme.sets}x${cfg.setScheme.reps}/${cfg.setScheme.restSeconds}` : 'auto',
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
    duration: Number(cfg?.duration) || 30,
    // The scheme the Builder lays over the list after: the time fit has to
    // count the sets it will run.
    setScheme: cfg?.setScheme?.sets ? cfg.setScheme : null,
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

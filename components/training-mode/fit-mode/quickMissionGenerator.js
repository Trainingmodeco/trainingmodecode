// Quick Mission generator.
//
// Two things the old one got wrong, both found in beta: the FOCUS the athlete
// picked (Upper / Lower / Core / Combat) never reached it — one full-body pool
// served every choice, so "Upper" opened with jump squats — and the length
// came from a rule of thumb (three-to-five exercises, two-to-three rounds)
// that made a 5-minute mission run eleven. Every move now carries the focus
// it serves, and the exercise count, rounds and rest are solved against the
// minutes asked for, using the same per-rep cadence the timer counts at.

// tags: upper · lower · core · combat · full. A move can serve several.
const BODYWEIGHT_POOL = [
  { name: 'Push-Ups', tags: ['upper', 'full'] },
  { name: 'Diamond Push-Ups', tags: ['upper'] },
  { name: 'Pike Push-Ups', tags: ['upper'] },
  { name: 'Dips', tags: ['upper'] },
  { name: 'Shoulder Taps', tags: ['upper', 'core'] },
  { name: 'Superman Hold', tags: ['upper', 'core'], timed: true },
  { name: 'Inchworms', tags: ['upper', 'full'] },
  { name: 'Squats', tags: ['lower', 'full'] },
  { name: 'Jump Squats', tags: ['lower', 'combat'] },
  { name: 'Lunges', tags: ['lower', 'full'] },
  { name: 'Reverse Lunges', tags: ['lower'] },
  { name: 'Lateral Lunges', tags: ['lower'] },
  { name: 'Glute Bridges', tags: ['lower'] },
  { name: 'Step-Ups', tags: ['lower'] },
  { name: 'Wall Sit', tags: ['lower'], timed: true },
  { name: 'Calf Raises', tags: ['lower'] },
  { name: 'Skater Hops', tags: ['lower', 'combat'] },
  { name: 'Tuck Jumps', tags: ['lower', 'combat'] },
  { name: 'Sit-Ups', tags: ['core'] },
  { name: 'Crunches', tags: ['core'] },
  { name: 'Bicycle Crunches', tags: ['core'] },
  { name: 'Leg Raises', tags: ['core'] },
  { name: 'Russian Twists', tags: ['core', 'combat'] },
  { name: 'Flutter Kicks', tags: ['core'] },
  { name: 'Plank Hold', tags: ['core'], timed: true },
  { name: 'Side Plank', tags: ['core'], timed: true },
  { name: 'Hollow Hold', tags: ['core'], timed: true },
  { name: 'Plank Jacks', tags: ['core', 'full'], timed: true },
  { name: 'Mountain Climbers', tags: ['core', 'full', 'combat'], timed: true },
  { name: 'Burpees', tags: ['full', 'combat'], timed: true },
  { name: 'Squat Thrusts', tags: ['full'] },
  { name: 'Bear Crawls', tags: ['full', 'upper'], timed: true },
  { name: 'High Knees', tags: ['full', 'combat'], timed: true },
  { name: 'Jumping Jacks', tags: ['full'], timed: true },
  { name: 'Sprawls', tags: ['combat', 'full'] },
  { name: 'Shadowbox Sprint', tags: ['combat'], timed: true },
  { name: 'Knee Strikes', tags: ['combat', 'core'] },
  { name: 'Squat to Front Kick', tags: ['combat', 'lower'] },
  { name: 'Sprawl to Jab-Cross', tags: ['combat', 'full'] },
  { name: 'Elbow Strikes', tags: ['combat', 'upper'] },
  { name: 'Slip and Rip', tags: ['combat', 'core'] },
  { name: 'Speed Punches', tags: ['combat', 'upper'], timed: true },
];

const WEIGHTED_POOL = [
  { name: 'Dumbbell Press', tags: ['upper'] },
  { name: 'Bent-Over Rows', tags: ['upper'] },
  { name: 'Shoulder Press', tags: ['upper'] },
  { name: 'Bicep Curls', tags: ['upper'] },
  { name: 'Triceps Extensions', tags: ['upper'] },
  { name: 'Lateral Raises', tags: ['upper'] },
  { name: 'Floor Press', tags: ['upper'] },
  { name: 'Hammer Curls', tags: ['upper'] },
  { name: 'Chest Flys', tags: ['upper'] },
  { name: 'Dumbbell Rows', tags: ['upper'] },
  { name: 'Goblet Squats', tags: ['lower', 'full'] },
  { name: 'Weighted Lunges', tags: ['lower'] },
  { name: 'Romanian Deadlifts', tags: ['lower'] },
  { name: 'Deadlifts', tags: ['lower', 'full'] },
  { name: 'Front Squats', tags: ['lower'] },
  { name: 'Sumo Deadlifts', tags: ['lower'] },
  { name: 'Kettlebell Swings', tags: ['lower', 'full', 'combat'] },
  { name: 'Weighted Russian Twists', tags: ['core', 'combat'] },
  { name: 'Weighted Sit-Ups', tags: ['core'] },
  { name: 'Dumbbell Side Bends', tags: ['core'] },
  { name: 'Farmer Carries', tags: ['core', 'full'], timed: true },
  { name: 'Clean and Press', tags: ['full', 'combat'] },
  { name: 'Thrusters', tags: ['full', 'combat'] },
  { name: 'Dumbbell Snatch', tags: ['full', 'combat'] },
  { name: 'Weighted Punches', tags: ['combat', 'upper'], timed: true },
];

const HYBRID_POOL = [...BODYWEIGHT_POOL, ...WEIGHTED_POOL];

const CARDIO_FINISHER_POOL = [
  'Burpees', 'Mountain Climbers', 'High Knees', 'Jumping Jacks',
  'Sprawls', 'Battle Ropes', 'Shuttle Runs', 'Bear Crawls',
];

const DIFFICULTY_CONFIG = {
  Easy:     { repsMin: 6,  repsMax: 10, workMin: 20, workMax: 30, rest: 40 },
  Normal:   { repsMin: 10, repsMax: 14, workMin: 30, workMax: 40, rest: 30 },
  Hard:     { repsMin: 14, repsMax: 20, workMin: 40, workMax: 50, rest: 20 },
  Advanced: { repsMin: 18, repsMax: 25, workMin: 45, workMax: 60, rest: 15 },
};

// What the timer actually spends per slot: the coach's intro line, then
// either the count (one rep per cadence tick) or the work window, then rest.
const CADENCE_SEC = 2;
const INTRO_SEC = 5;
const REST_MIN = 15;
const REST_MAX = 90;

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getPool(workoutType) {
  if (workoutType === 'Bodyweight') return BODYWEIGHT_POOL;
  if (workoutType === 'Weighted') return WEIGHTED_POOL;
  return HYBRID_POOL;
}

const FOCUS_TAG = { 'Upper': 'upper', 'Lower': 'lower', 'Core': 'core', 'Combat': 'combat' };

// A full-body mission deals from each region in turn so six moves never come
// out as four squats and two planks.
function pickFullBody(pool, count) {
  const byTag = { upper: [], lower: [], core: [], full: [] };
  shuffle(pool).forEach(m => m.tags.forEach(t => { if (byTag[t]) byTag[t].push(m); }));
  const order = ['lower', 'upper', 'core', 'full'];
  const picked = [];
  const used = new Set();
  let guard = 0;
  while (picked.length < count && guard++ < 60) {
    const tag = order[picked.length % order.length];
    const next = byTag[tag].find(m => !used.has(m.name)) || shuffle(pool).find(m => !used.has(m.name));
    if (!next) break;
    used.add(next.name);
    picked.push(next);
  }
  return picked;
}

function pickFocused(pool, tag, count) {
  const primary = shuffle(pool.filter(m => m.tags[0] === tag));
  const secondary = shuffle(pool.filter(m => m.tags[0] !== tag && m.tags.includes(tag)));
  const filler = shuffle(pool.filter(m => !m.tags.includes(tag) && m.tags.includes('full')));
  return [...primary, ...secondary, ...filler].slice(0, count);
}

function slotSeconds(ex) {
  const work = ex.mode === 'timed' ? ex.work : ex.reps * CADENCE_SEC;
  return INTRO_SEC + work + ex.rest;
}

export function estimateQuickMissionSeconds(mission) {
  const all = [...(mission.exercises || []), ...(mission.finisherExercises || [])];
  const perRound = all.reduce((s, ex) => s + slotSeconds(ex), 0);
  return Math.round(perRound * (mission.rounds || 1));
}

// "12 reps" / "40s" — the dose the setup card prints beside a move.
export function quickMissionDose(ex) {
  return ex.mode === 'timed' ? `${ex.work}s` : `${ex.reps} reps`;
}

const TITLES = {
  'Full Body': ['BODYWEIGHT BLITZ', 'CALISTHENICS CIRCUIT', 'NO-GEAR GRIND', 'RAW POWER'],
  'Upper': ['UPPER BODY BLITZ', 'PUSH & PULL CIRCUIT', 'ARMS & CHEST GRIND'],
  'Lower': ['LEG DAY BLITZ', 'LOWER BODY BURN', 'SQUAT & LUNGE CIRCUIT'],
  'Core': ['CORE CRUSHER', 'MIDLINE MISSION', 'ABS OF STEEL'],
  'Combat': ['FIGHT CONDITIONING', 'STRIKE CIRCUIT', 'RING READY'],
};
const TYPE_TITLES = {
  Weighted: ['IRON CIRCUIT', 'LOADED MISSION', 'HEAVY METAL', 'WEIGHT ROOM WAR'],
  Hybrid: ['HYBRID HUSTLE', 'MIXED MISSION', 'FULL SPECTRUM', 'TOTAL ASSAULT'],
};

export function generateQuickMission({ workoutType = 'Bodyweight', duration = 10, difficulty = 'Normal', format = 'Auto', cardioFinisher = false, focus = 'Full Body' } = {}) {
  const pool = getPool(workoutType);
  const diffCfg = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.Normal;
  const mins = Math.max(3, Number(duration) || 10);
  const budget = mins * 60;
  const finisherBudget = cardioFinisher ? Math.min(120, budget * 0.2) : 0;
  const mainBudget = budget - finisherBudget;

  const rounds = mins <= 7 ? 1 : mins <= 15 ? 2 : mins <= 25 ? 3 : 4;
  const tag = FOCUS_TAG[focus];

  const build = (move) => {
    const useTimed = format === 'Timed' || (format === 'Auto' && !!move.timed);
    if (useTimed) return { name: move.name, mode: 'timed', work: rand(diffCfg.workMin, diffCfg.workMax), rest: diffCfg.rest };
    return { name: move.name, mode: 'reps', reps: rand(diffCfg.repsMin, diffCfg.repsMax), rest: diffCfg.rest };
  };

  // Deal up to eight moves, then keep only as many as the minutes hold.
  const dealt = (tag ? pickFocused(pool, tag, 8) : pickFullBody(pool, 8)).map(build);
  const exercises = [];
  for (const ex of dealt) {
    const next = [...exercises, ex];
    const est = next.reduce((s, e) => s + slotSeconds(e), 0) * rounds;
    if (exercises.length >= 3 && est > mainBudget * 1.05) break;
    exercises.push(ex);
    if (exercises.length >= 8) break;
  }

  // Close the remaining gap with rest: longer when the minutes are generous,
  // shorter when the count already fills them. Never below 15 s.
  const est = exercises.reduce((s, e) => s + slotSeconds(e), 0) * rounds;
  const perSlot = (mainBudget - est) / Math.max(1, exercises.length * rounds);
  exercises.forEach(ex => { ex.rest = Math.round(Math.max(REST_MIN, Math.min(REST_MAX, ex.rest + perSlot)) / 5) * 5; });

  let finisherExercises = [];
  if (cardioFinisher) {
    const taken = new Set(exercises.map(e => e.name));
    const finisherPool = shuffle(CARDIO_FINISHER_POOL.filter(e => !taken.has(e)));
    finisherExercises = finisherPool.slice(0, 2).map(name => ({
      name, mode: 'timed', work: rand(Math.max(diffCfg.workMin, 20), diffCfg.workMax), rest: rand(15, 30), isFinisher: true,
    }));
  }

  const titlePool = workoutType === 'Bodyweight' ? (TITLES[focus] || TITLES['Full Body']) : (TYPE_TITLES[workoutType] || TYPE_TITLES.Hybrid);
  const title = titlePool[rand(0, titlePool.length - 1)];

  return {
    title,
    workoutType,
    duration: mins,
    difficulty,
    format,
    focus,
    exercises,
    finisherExercises,
    rounds,
    cardioFinisher,
  };
}

const BODYWEIGHT_POOL = [
  'Push-Ups', 'Squats', 'Lunges', 'Sit-Ups', 'Crunches', 'Plank Hold',
  'Mountain Climbers', 'Burpees', 'Dips', 'Jump Squats', 'Glute Bridges',
  'Bicycle Crunches', 'Lateral Lunges', 'Bear Crawls', 'High Knees',
  'Tuck Jumps', 'Jumping Jacks', 'Step-Ups', 'Wall Sit', 'Sprawls',
];

const WEIGHTED_POOL = [
  'Dumbbell Press', 'Bent-Over Rows', 'Goblet Squats', 'Kettlebell Swings',
  'Deadlifts', 'Shoulder Press', 'Bicep Curls', 'Triceps Extensions',
  'Weighted Lunges', 'Farmer Carries', 'Dumbbell Rows', 'Lateral Raises',
  'Front Squats', 'Floor Press', 'Romanian Deadlifts', 'Hammer Curls',
  'Overhead Triceps Press', 'Sumo Deadlifts', 'Clean and Press', 'Chest Flys',
];

const HYBRID_POOL = [
  'Push-Ups', 'Goblet Squats', 'Burpees', 'Dumbbell Rows', 'Lunges',
  'Kettlebell Swings', 'Mountain Climbers', 'Shoulder Press', 'Squats',
  'Bicep Curls', 'Plank Hold', 'Weighted Lunges', 'Bear Crawls',
  'Farmer Carries', 'Dips', 'Deadlifts', 'Jump Squats', 'Bent-Over Rows',
];

const CARDIO_FINISHER_POOL = [
  'Burpees', 'Mountain Climbers', 'High Knees', 'Jumping Jacks',
  'Sprawls', 'Battle Ropes', 'Shuttle Runs', 'Bear Crawls',
];

const DIFFICULTY_CONFIG = {
  Easy: { repsMin: 5, repsMax: 10, workMin: 20, workMax: 30, restAdd: 15 },
  Normal: { repsMin: 10, repsMax: 15, workMin: 30, workMax: 40, restAdd: 0 },
  Hard: { repsMin: 15, repsMax: 25, workMin: 40, workMax: 50, restAdd: -10 },
  Advanced: { repsMin: 20, repsMax: 30, workMin: 45, workMax: 60, restAdd: -15 },
};

const REST_RANGES = {
  Bodyweight: { min: 30, max: 60 },
  Weighted: { min: 45, max: 120 },
  Hybrid: { min: 30, max: 90 },
};

const TIMED_EXERCISES = new Set([
  'Plank Hold', 'Mountain Climbers', 'High Knees', 'Jumping Jacks',
  'Bear Crawls', 'Wall Sit', 'Battle Ropes', 'Shuttle Runs', 'Burpees',
  'Sprawls', 'Farmer Carries',
]);

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

function getExerciseCount(duration) {
  if (duration <= 20) return rand(3, 5);
  if (duration <= 45) return rand(4, 6);
  return rand(5, 8);
}

function getRoundCount(duration, exerciseCount) {
  const avgTimePerExercise = 50;
  const estimatedRounds = Math.floor(duration * 60 / (exerciseCount * avgTimePerExercise));
  if (duration <= 20) return Math.min(Math.max(estimatedRounds, 2), 3);
  if (duration <= 45) return Math.min(Math.max(estimatedRounds, 3), 5);
  return Math.min(Math.max(estimatedRounds, 4), 8);
}

function isTimedExercise(name) {
  return TIMED_EXERCISES.has(name);
}

export function generateQuickMission({ workoutType, duration, difficulty, format, cardioFinisher }) {
  const pool = getPool(workoutType);
  const diffCfg = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.Normal;
  const restRange = REST_RANGES[workoutType] || REST_RANGES.Bodyweight;

  const exerciseCount = getExerciseCount(duration);
  const rounds = getRoundCount(duration, exerciseCount);

  const shuffled = shuffle(pool);
  const selected = shuffled.slice(0, exerciseCount);

  const exercises = selected.map(name => {
    const useTimed = format === 'Timed' || (format === 'Auto' && isTimedExercise(name));

    const restBase = rand(restRange.min, restRange.max) + diffCfg.restAdd;
    const rest = Math.max(15, Math.min(120, restBase));

    if (useTimed) {
      const work = rand(diffCfg.workMin, diffCfg.workMax);
      return { name, mode: 'timed', work, rest };
    }
    const reps = rand(diffCfg.repsMin, diffCfg.repsMax);
    return { name, mode: 'reps', reps, rest };
  });

  let finisherExercises = [];
  if (cardioFinisher) {
    const finisherPool = shuffle(CARDIO_FINISHER_POOL.filter(e => !selected.includes(e)));
    const finisherCount = Math.min(2, finisherPool.length);
    finisherExercises = finisherPool.slice(0, finisherCount).map(name => {
      const work = rand(Math.max(diffCfg.workMin, 20), diffCfg.workMax);
      const rest = rand(15, 45);
      return { name, mode: 'timed', work, rest, isFinisher: true };
    });
  }

  const titles = {
    Bodyweight: ['BODYWEIGHT BLITZ', 'CALISTHENICS CIRCUIT', 'NO-GEAR GRIND', 'RAW POWER'],
    Weighted: ['IRON CIRCUIT', 'LOADED MISSION', 'HEAVY METAL', 'WEIGHT ROOM WAR'],
    Hybrid: ['HYBRID HUSTLE', 'MIXED MISSION', 'FULL SPECTRUM', 'TOTAL ASSAULT'],
  };
  const titlePool = titles[workoutType] || titles.Hybrid;
  const title = titlePool[rand(0, titlePool.length - 1)];

  return {
    title,
    workoutType,
    duration,
    difficulty,
    format,
    exercises,
    finisherExercises,
    rounds,
    cardioFinisher,
  };
}

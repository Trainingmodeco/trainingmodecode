// Quick Mission generator.
//
// Two things the old one got wrong, both found in beta: the FOCUS the athlete
// picked (Upper / Lower / Core / Combat) never reached it — one full-body pool
// served every choice, so "Upper" opened with jump squats — and the length
// came from a rule of thumb (three-to-five exercises, two-to-three rounds)
// that made a 5-minute mission run eleven. Every move now carries the focus
// it serves, and the exercise count, rounds and rest are solved against the
// minutes asked for.
//
// The minutes are the REAL guided run: the estimate below is the timeline the
// runner spends (data/quickMissionTiming: the intro and GET READY, a counted
// set one beat a rep, a timed move its seconds, a rest to the second, no rest
// after the very last set), not a rule of thumb. The fit deals up to ten
// moves, picks how many fit the minutes at the level's own work and rest, and
// then nudges the rests (and, last, a rep or five seconds) in small steps
// until the run lands within a few seconds of what was asked, at every minute
// from 5 to 60. The same seed gives the same moves and doses whatever the
// minutes, so a slider that scrubs the minutes grows and shrinks one workout
// rather than dealing a new one at every step.
//
// WEIGHTED and HYBRID (the setup screen's GEAR key): a loaded move gets its
// own table (fewer reps, longer rest), is flagged isWeighted so the timer
// never counts it (the set ends on DONE, at the athlete's pace) and is timed
// at a controlled pace plus the pick-up, so "About N min" stays honest. A
// hybrid alternates a loaded move with a bodyweight one.
import { quickMissionTimeline, introSeconds, workSeconds, moveSeconds } from '../data/quickMissionTiming';

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
].map(m => ({ ...m, loaded: true }));

const HYBRID_POOL = [...BODYWEIGHT_POOL, ...WEIGHTED_POOL];

const CARDIO_FINISHER_POOL = [
  'Burpees', 'Mountain Climbers', 'High Knees', 'Jumping Jacks',
  'Sprawls', 'Battle Ropes', 'Shuttle Runs', 'Bear Crawls',
];

export const DIFFICULTY_CONFIG = {
  Easy:     { repsMin: 6,  repsMax: 10, workMin: 20, workMax: 30, rest: 40 },
  Normal:   { repsMin: 10, repsMax: 14, workMin: 30, workMax: 40, rest: 30 },
  Hard:     { repsMin: 14, repsMax: 20, workMin: 40, workMax: 50, rest: 20 },
  Advanced: { repsMin: 18, repsMax: 25, workMin: 45, workMax: 60, rest: 15 },
};
// The bodyweight table is for air squats and push-ups: HARD there is twenty
// reps on twenty seconds of rest, which is the wrong prescription for a
// deadlift or a clean and press. Harder here means more work and less rest,
// but never past fifteen reps of a loaded move.
export const LOADED_CONFIG = {
  Easy:     { repsMin: 8,  repsMax: 10, workMin: 20, workMax: 30, rest: 60 },
  Normal:   { repsMin: 10, repsMax: 12, workMin: 30, workMax: 40, rest: 45 },
  Hard:     { repsMin: 12, repsMax: 15, workMin: 40, workMax: 45, rest: 40 },
  Advanced: { repsMin: 13, repsMax: 15, workMin: 40, workMax: 50, rest: 30 },
};

// Rest bounds (a rest is always a multiple of 5 s). Loaded sets rest longer.
const REST_MIN = 15;
const REST_MAX = 90;
const LOADED_REST_MIN = 30;
const LOADED_REST_MAX = 120;
// Moves dealt to every mission; the minutes decide how many of them run.
const DEAL = 10;
// How close the fit tries to land, seconds. The sweep tests hold it to 30.
const FIT_TOLERANCE_SEC = 2;
// The most the polish moves one rest from where the spread put it.
const REST_DRIFT = 10;

// Rounds and the most moves a round takes, by length. Up to 7 minutes the
// mission is one round; the slider's 5 to 60 minutes go through two to six
// rounds. Up to 35 minutes a round is up to eight moves; past that the mission
// gets a fifth and a sixth round and up to ten moves, so 45 to 60 minutes is
// more work, not a minute and a half of rest after every set.
function roundsFor(mins) {
  return mins <= 7 ? 1 : mins <= 15 ? 2 : mins <= 25 ? 3 : mins <= 35 ? 4 : mins <= 45 ? 5 : 6;
}
function movesFor(mins) {
  return mins <= 35 ? 8 : 10;
}

// A seeded random source for a repeatable deal (mulberry32): the setup screen
// seeds it so the card stays put while the minutes move.
export function seededRng(seed) {
  let a = (Number(seed) >>> 0) || 1;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// A string to a seed (FNV-1a), for seeding by the visit's choices.
export function seedFrom(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function rand(min, max, rng = Math.random) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function shuffle(arr, rng = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
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
// out as four squats and two planks. `offset` starts the turn elsewhere.
function pickFullBody(pool, count, offset, rng) {
  const byTag = { upper: [], lower: [], core: [], full: [] };
  shuffle(pool, rng).forEach(m => m.tags.forEach(t => { if (byTag[t]) byTag[t].push(m); }));
  const order = ['lower', 'upper', 'core', 'full'];
  const picked = [];
  const used = new Set();
  let guard = 0;
  while (picked.length < count && guard++ < 60) {
    const tag = order[(picked.length + offset) % order.length];
    const next = byTag[tag].find(m => !used.has(m.name)) || shuffle(pool, rng).find(m => !used.has(m.name));
    if (!next) break;
    used.add(next.name);
    picked.push(next);
  }
  return picked;
}

function pickFocused(pool, tag, count, rng) {
  const primary = shuffle(pool.filter(m => m.tags[0] === tag), rng);
  const secondary = shuffle(pool.filter(m => m.tags[0] !== tag && m.tags.includes(tag)), rng);
  const filler = shuffle(pool.filter(m => !m.tags.includes(tag) && m.tags.includes('full')), rng);
  return [...primary, ...secondary, ...filler].slice(0, count);
}

// Up to `count` moves for the type and focus. A hybrid takes a loaded move,
// then a bodyweight one, in turn. On a full-body mission the bodyweight deal
// starts on another region, so a pair is never two lower-body moves; a
// bodyweight move the loaded list already has a version of ('Lunges' beside
// 'Weighted Lunges') is left out.
function pickMoves(workoutType, tag, count, rng) {
  const deal = (pool, offset) => (tag ? pickFocused(pool, tag, count, rng) : pickFullBody(pool, count, offset, rng));
  if (workoutType !== 'Hybrid') return deal(getPool(workoutType), 0);
  const loaded = deal(WEIGHTED_POOL, 0);
  const bw = deal(BODYWEIGHT_POOL, 2).filter(m => !loaded.some(l => l.name.includes(m.name)));
  const out = [];
  for (let i = 0; out.length < count && (i < loaded.length || i < bw.length); i++) {
    if (loaded[i]) out.push(loaded[i]);
    if (bw[i] && out.length < count) out.push(bw[i]);
  }
  return out;
}

// The real guided run, in seconds (data/quickMissionTiming: the intro and GET
// READY, every set and rest, no rest after the last set). What the card's
// "about N min", the AT YOUR PACE target and the generator's fit all read.
export function estimateQuickMissionSeconds(mission) {
  return Math.round(quickMissionTimeline(mission).totalSec);
}

// The seconds the moves themselves take (counted reps, holds, a loaded set's
// pick-up) with no coach lines and no rest: the least a mission can honestly
// take. AT YOUR PACE sets its fastest finish from it (data/soloFromGenerated).
export function estimateQuickMissionWorkSeconds(mission) {
  const all = [...(mission.exercises || []), ...(mission.finisherExercises || [])];
  const ctx = { workoutType: mission.workoutType || 'Bodyweight' };
  const perRound = all.reduce((s, ex) => s + moveSeconds(ex, ctx), 0);
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
  Weighted: {
    'Full Body': ['IRON CIRCUIT', 'LOADED MISSION', 'HEAVY METAL', 'WEIGHT ROOM WAR'],
    'Upper': ['IRON UPPER', 'PRESS & PULL', 'LOADED ARMS'],
    'Lower': ['IRON LEGS', 'HINGE & SQUAT', 'LOADED LEG DAY'],
    'Core': ['LOADED CORE', 'IRON MIDLINE', 'WEIGHTED ABS'],
    'Combat': ['HEAVY HANDS', 'LOADED FIGHT CIRCUIT', 'IRON ROUNDS'],
  },
  Hybrid: {
    'Full Body': ['HYBRID HUSTLE', 'MIXED MISSION', 'FULL SPECTRUM', 'TOTAL ASSAULT'],
    'Upper': ['HYBRID UPPER', 'PUSH, PRESS & PULL', 'MIXED UPPER'],
    'Lower': ['HYBRID LEGS', 'MIXED LEG DAY', 'SQUAT & SWING'],
    'Core': ['HYBRID CORE', 'MIXED MIDLINE', 'CORE UNDER LOAD'],
    'Combat': ['HYBRID FIGHT CIRCUIT', 'MIXED STRIKE CIRCUIT', 'RING READY HYBRID'],
  },
};

// How the fit may move a move's dose: its reps or seconds within its level's
// own table, a rep or five seconds at a time.
const roundTo5 = (n) => Math.round(n / 5) * 5;

export function generateQuickMission({
  workoutType = 'Bodyweight', duration = 10, difficulty = 'Normal', format = 'Auto', cardioFinisher = false, focus = 'Full Body', rng = Math.random,
} = {}) {
  const diffCfg = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.Normal;
  const loadCfg = LOADED_CONFIG[difficulty] || LOADED_CONFIG.Normal;
  const mins = Math.max(3, Number(duration) || 10);
  const target = mins * 60;

  const rounds = roundsFor(mins);
  const maxMoves = movesFor(mins);
  const tag = FOCUS_TAG[focus];

  // One dealt move as a slot, with the table it was dealt from (the fit keeps
  // every dose inside it).
  const build = (move) => {
    const useTimed = format === 'Timed' || (format === 'Auto' && !!move.timed);
    const c = move.loaded ? loadCfg : diffCfg;
    const ex = useTimed
      ? { name: move.name, mode: 'timed', work: rand(c.workMin, c.workMax, rng), rest: c.rest }
      : { name: move.name, mode: 'reps', reps: rand(c.repsMin, c.repsMax, rng), rest: c.rest };
    return { ex: move.loaded ? { ...ex, isWeighted: true } : ex, table: c, loaded: !!move.loaded };
  };

  // Deal ten, in a fixed order, whatever the minutes: the first moves and their
  // doses are the same at 8 minutes and at 9.
  const dealt = pickMoves(workoutType, tag, DEAL, rng).map(build);

  // The cardio finisher (two timed moves at the end of every round) is part of
  // the round, so it is part of the minutes.
  let finisherSlots = [];
  if (cardioFinisher) {
    const taken = new Set(dealt.map(d => d.ex.name));
    const finisherPool = shuffle(CARDIO_FINISHER_POOL.filter(e => !taken.has(e)), rng);
    finisherSlots = finisherPool.slice(0, 2).map(name => ({
      ex: { name, mode: 'timed', work: rand(Math.max(diffCfg.workMin, 20), diffCfg.workMax, rng), rest: roundTo5(rand(15, 30, rng)), isFinisher: true },
      table: diffCfg, loaded: false, finisher: true,
    }));
  }

  // The fit. A slot's seconds are linear in its dose and rest, so the run is
  //   intro + rounds x (work of the round) + sum of (rest x the times it runs)
  // where every rest runs once a round except the last slot's, which does not
  // run after the final set.
  const ctx = { workoutType, voice: true };
  const first = dealt[0].ex;
  const intro = introSeconds({ workoutType, first, rounds, slotsPerRound: 1, format: undefined, voice: true });
  const restBounds = (slot) => (slot.loaded ? [LOADED_REST_MIN, LOADED_REST_MAX] : [REST_MIN, REST_MAX]);
  const timesRun = (list, i) => (i === list.length - 1 ? rounds - 1 : rounds);
  // `restOf` lets the fit ask "what if" without touching the slots.
  const runSeconds = (list, restOf = (sl) => sl.ex.rest) => intro
    + list.reduce((s, sl, i) => s + rounds * workSeconds(sl.ex, ctx) + timesRun(list, i) * restOf(sl), 0);
  const clampRaw = (sl, rest) => { const [lo, hi] = restBounds(sl); return Math.max(lo, Math.min(hi, rest)); };
  const clampRest = (sl, rest) => Math.round(clampRaw(sl, rest) / 5) * 5;

  // How many moves: the count whose own work and rest, at the level's table,
  // needs the least stretching or squeezing of the rests to fill the minutes.
  // A count that the rest bounds stop from landing within CLOSE seconds of the
  // minutes is last choice. Never fewer than three moves.
  const CLOSE = 8;
  const most = Math.max(3, Math.min(maxMoves, dealt.length));
  let best = null;
  for (let n = Math.min(3, most); n <= most; n += 1) {
    const list = [...dealt.slice(0, n), ...finisherSlots];
    const weight = list.reduce((s, _, i) => s + timesRun(list, i), 0);
    const shift = weight > 0 ? (target - runSeconds(list)) / weight : 0;
    // Judged unrounded: rounding every rest to 5 s is the polish's to settle.
    const spread = (sl) => clampRaw(sl, sl.ex.rest + shift);
    const miss = Math.abs(runSeconds(list, spread) - target);
    const moved = list.reduce((s, sl) => s + Math.abs(spread(sl) - sl.ex.rest), 0) / list.length;
    const score = Math.max(0, miss - CLOSE) * 1000 + moved;
    if (!best || score < best.score) best = { n, list, shift, score };
  }
  const slots = best.list;
  // Spread the shift over every rest, then polish. `base` is where each rest
  // started: the polish keeps every rest within REST_DRIFT of it, so the rests
  // of one workout stay alike.
  slots.forEach(sl => {
    sl.ex.rest = clampRest(sl, sl.ex.rest + best.shift);
    sl.base = sl.ex.rest;
  });

  // Polish: small steps (a rest 5 s, a rep, or five seconds of a hold) taken
  // one at a time while one lands the run closer. Rests first (nobody sees
  // them), a dose only when the rests cannot get closer.
  const total = () => runSeconds(slots);
  const stepsFor = (kind) => {
    const out = [];
    slots.forEach((sl, i) => {
      const { ex, table } = sl;
      if (kind === 'rest') {
        const [lo, hi] = restBounds(sl);
        [-5, 5].forEach(d => { if (ex.rest + d >= Math.max(lo, sl.base - REST_DRIFT) && ex.rest + d <= Math.min(hi, sl.base + REST_DRIFT)) out.push({ i, d, key: 'rest' }); });
      } else if (!sl.finisher) {
        if (ex.mode === 'reps') [-1, 1].forEach(d => { if (ex.reps + d >= table.repsMin && ex.reps + d <= table.repsMax) out.push({ i, d, key: 'reps' }); });
        else [-5, 5].forEach(d => { if (ex.work + d >= table.workMin && ex.work + d <= table.workMax) out.push({ i, d, key: 'work' }); });
      }
    });
    return out;
  };
  const tryKind = (kind) => {
    for (let guard = 0; guard < 200; guard += 1) {
      const err = Math.abs(total() - target);
      if (err <= FIT_TOLERANCE_SEC) break;
      const steps = stepsFor(kind);
      // One step that lands the run strictly closer, the closest of them.
      let pick = null;
      for (const st of steps) {
        slots[st.i].ex[st.key] += st.d;
        const e = Math.abs(total() - target);
        slots[st.i].ex[st.key] -= st.d;
        if (e < err - 1e-9 && (!pick || e < pick.e - 1e-9)) pick = { moves: [st], e };
      }
      // None does: two rest steps together (one slot longer, another shorter)
      // can still land finer, because the last slot's rest runs one round fewer.
      if (!pick && kind === 'rest') {
        for (const a of steps) for (const b of steps) {
          if (a.i >= b.i) continue;
          slots[a.i].ex.rest += a.d; slots[b.i].ex.rest += b.d;
          const e = Math.abs(total() - target);
          slots[a.i].ex.rest -= a.d; slots[b.i].ex.rest -= b.d;
          if (e < err - 1e-9 && (!pick || e < pick.e - 1e-9)) pick = { moves: [a, b], e };
        }
      }
      if (!pick) break;
      pick.moves.forEach(st => { slots[st.i].ex[st.key] += st.d; });
    }
  };
  tryKind('rest');
  if (Math.abs(total() - target) > FIT_TOLERANCE_SEC) { tryKind('dose'); tryKind('rest'); }

  const exercises = slots.filter(sl => !sl.finisher).map(sl => sl.ex);
  const finisherExercises = slots.filter(sl => sl.finisher).map(sl => sl.ex);

  const typeTitles = workoutType === 'Bodyweight' ? TITLES : (TYPE_TITLES[workoutType] || TYPE_TITLES.Hybrid);
  const titlePool = typeTitles[focus] || typeTitles['Full Body'];
  const title = titlePool[rand(0, titlePool.length - 1, rng)];

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

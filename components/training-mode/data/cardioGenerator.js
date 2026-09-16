import { CC_EXERCISE_LIBRARY } from './combatConditioningData';

// The cardio session builder — the Workout Builder's logic, pointed at cardio.
//
// WHERE THE MOVES COME FROM. Not a new list. CC_EXERCISE_LIBRARY already holds
// 50 movements with difficulty, equipment, coaching cues and safety notes, and
// Combat Conditioning has been using them for months. Writing a second pool
// would mean two lists to keep in step and two places for a bad cue to hide.
// This filters that library to what belongs in a cardio session and adds only
// the handful of movements it genuinely lacks.
//
// WHAT BELONGS. Plyometric and high-intensity work that raises a heart rate
// with no setup: things you can do in a garage, a park or a hotel room. The
// equipment allow-list is deliberately short — bodyweight, a rope, a ball, a
// bag, a bar, a battle rope. Anything needing a rack, a barbell, a cable
// machine, cones or an agility ladder is excluded, because a generated session
// the athlete cannot start is worse than no suggestion at all.

// Categories in the library that produce conditioning work rather than strength.
const CARDIO_CATEGORIES = new Set([
  'Cardio', 'Plyometrics', 'Conditioning', 'Combat Skill Conditioning', 'Intervals',
]);

// Kit a normal person has or a normal gym has by the door.
const BASIC_EQUIPMENT = new Set([
  'Bodyweight', 'Jump Rope', 'Medicine Ball', 'Heavy Bag', 'Pull-Up Bar', 'Battle Rope',
]);

// A few movements the library files under Strength or Core that are really
// conditioning when run on a clock — ball slams are the obvious one, and were
// named directly. Included by name rather than by widening the category filter,
// which would drag in deadlifts and cleans with them.
const INCLUDED_NAMES = new Set([
  'Medicine Ball Slams',
  'Medicine Ball Rotational Throw',
]);

// Never generated: too technical to prescribe unsupervised, or needs a setup
// the athlete probably does not have in front of them.
const EXCLUDED_NAMES = new Set([
  'Speed Bag Work',            // needs a speed bag and the skill to use one
  'Shadowbox 5-Minute Rounds', // a whole session, not an interval
]);

// The movements the owner named that the library does not carry. Same shape as
// a library entry so everything downstream treats them identically.
const ADDITIONS = [
  { id: 'CG01', name: 'High Knees', category: 'Cardio', difficulty: 'Easy', equipment: 'Bodyweight',
    coachingCue: 'Knees to hip height, quick feet, stay tall through the chest.' },
  { id: 'CG02', name: 'Mountain Climbers', category: 'Conditioning', difficulty: 'Easy', equipment: 'Bodyweight',
    coachingCue: 'Hips low and still. Drive the knee, do not bounce the hips.' },
  { id: 'CG03', name: 'Shadowbox — Hands Only', category: 'Combat Skill Conditioning', difficulty: 'Easy', equipment: 'Bodyweight',
    coachingCue: 'Punches only. Hands back to the chin every time.' },
  { id: 'CG04', name: 'Shadowbox — Kicks Only', category: 'Combat Skill Conditioning', difficulty: 'Normal', equipment: 'Bodyweight',
    coachingCue: 'Kicks only. Reset your stance between each one.' },
  { id: 'CG05', name: 'Shadowbox — Knees Only', category: 'Combat Skill Conditioning', difficulty: 'Normal', equipment: 'Bodyweight',
    coachingCue: 'Knees only. Pull down on the collar tie as the knee lands.' },
  { id: 'CG06', name: 'Battle Rope Waves', category: 'Conditioning', difficulty: 'Normal', equipment: 'Battle Rope',
    coachingCue: 'Small fast waves. Athletic stance, breathe out on every rep.' },
  { id: 'CG07', name: 'Battle Rope Slams', category: 'Conditioning', difficulty: 'Hard', equipment: 'Battle Rope',
    coachingCue: 'Whole body. Overhead, then slam through the floor.' },
  { id: 'CG08', name: 'Hurdle Jumps', category: 'Plyometrics', difficulty: 'Hard', equipment: 'Bodyweight',
    coachingCue: 'Over a low hurdle or a bag. Land soft, absorb, go again.' },
  { id: 'CG09', name: 'Explosive Pull-Ups', category: 'Plyometrics', difficulty: 'Hard', equipment: 'Pull-Up Bar',
    coachingCue: 'Pull fast enough that your chest clears the bar. Control the way down.' },
];

// Difficulty gates on level. An athlete on their first week should not be
// handed tuck jumps by a machine that has never seen them move.
// Normal opens at level 2 rather than 3: holding a second-session athlete to
// four Easy movements is not caution, it is a thin product. The real safety
// lever is the work/rest scaling below, which gives a beginner 30 seconds on
// and 30 off regardless of what the movement is.
const DIFFICULTY_MIN_LEVEL = { Easy: 1, Normal: 2, Hard: 6, Advanced: 99 };

/** Every movement this builder may ever produce. */
export function cardioMovePool() {
  const fromLibrary = CC_EXERCISE_LIBRARY.filter(e =>
    (CARDIO_CATEGORIES.has(e.category) || INCLUDED_NAMES.has(e.name))
    && BASIC_EQUIPMENT.has(e.equipment)
    && !EXCLUDED_NAMES.has(e.name)
    && e.difficulty !== 'Advanced');
  return [...fromLibrary, ...ADDITIONS];
}

/** The movements allowed at this level and with this kit. */
export function availableMoves(level = 1, equipment = null) {
  const kit = equipment instanceof Set ? equipment : null;
  return cardioMovePool().filter(m => {
    if ((DIFFICULTY_MIN_LEVEL[m.difficulty] ?? 99) > level) return false;
    if (kit && m.equipment !== 'Bodyweight' && !kit.has(m.equipment)) return false;
    return true;
  });
}

// Work and rest scale with level: longer efforts and shorter recoveries as the
// athlete earns them. These are the same shapes the interval protocols use, so
// a generated session and a hand-built one feel like the same product.
export function scaleForLevel(level = 1) {
  if (level >= 9) return { workSec: 50, restSec: 10, rounds: 4 };
  if (level >= 6) return { workSec: 45, restSec: 15, rounds: 3 };
  if (level >= 3) return { workSec: 40, restSec: 20, rounds: 3 };
  return { workSec: 30, restSec: 30, rounds: 2 };
}

function pickDistinct(pool, count, rng) {
  const bag = pool.slice();
  const out = [];
  while (out.length < count && bag.length) {
    out.push(...bag.splice(Math.floor(rng() * bag.length), 1));
  }
  return out;
}

/**
 * Build a session. Deterministic when handed an `rng`, so it can be tested.
 * Returns { moves, workSec, restSec, rounds, totalSec }.
 */
export function generateCardioSession({ level = 1, moveCount = 5, equipment = null, rng = Math.random } = {}) {
  const pool = availableMoves(level, equipment);
  const scale = scaleForLevel(level);
  // A session should not be five variations of the same thing. Take at most two
  // per category first, and only fall back to the wider pool if that cannot
  // fill the card — which happens at level 1, where the pool is small.
  const byCategory = new Map();
  for (const m of pool) {
    const list = byCategory.get(m.category) || [];
    list.push(m);
    byCategory.set(m.category, list);
  }
  const spread = [];
  for (const list of byCategory.values()) spread.push(...pickDistinct(list, 2, rng));
  const chosen = pickDistinct(spread, moveCount, rng);
  if (chosen.length < moveCount) {
    const rest = pool.filter(m => !chosen.includes(m));
    chosen.push(...pickDistinct(rest, moveCount - chosen.length, rng));
  }
  return withTotals({ moves: chosen, ...scale });
}

function withTotals(s) {
  const perRound = s.moves.length * (s.workSec + s.restSec);
  return { ...s, totalSec: perRound * s.rounds };
}

/** Replace one movement with a fresh one, keeping everything else. */
export function swapMove(session, index, { level = 1, equipment = null, rng = Math.random } = {}) {
  if (!session?.moves?.[index]) return session;
  const inUse = new Set(session.moves.map(m => m.id));
  const options = availableMoves(level, equipment).filter(m => !inUse.has(m.id));
  if (options.length === 0) return session;
  const moves = session.moves.slice();
  moves[index] = options[Math.floor(rng() * options.length)];
  return withTotals({ ...session, moves });
}

/** Move one movement up or down the card. */
export function reorderMove(session, index, direction) {
  const moves = session?.moves?.slice();
  if (!moves) return session;
  const next = index + (direction === 'up' ? -1 : 1);
  if (next < 0 || next >= moves.length) return session;
  [moves[index], moves[next]] = [moves[next], moves[index]];
  return { ...session, moves };
}

/** Drop one, as long as at least two remain — one movement is not a circuit. */
export function removeMove(session, index) {
  if (!session?.moves || session.moves.length <= 2) return session;
  const moves = session.moves.filter((_, i) => i !== index);
  return withTotals({ ...session, moves });
}

/** Change work / rest / rounds after generating. */
export function retimeSession(session, patch) {
  return withTotals({ ...session, ...patch });
}

/** The session as the interval player wants it. */
export function sessionToIntervalConfig(session, warmupMin = 0) {
  return {
    warmupSeconds: Math.round((warmupMin || 0) * 60),
    workSeconds: session.workSec,
    restSeconds: session.restSec,
    // Every movement is its own interval, repeated for the round count.
    rounds: session.moves.length * session.rounds,
    cooldownSeconds: 0,
  };
}

/** The movement the coach should name at interval `i` (zero-based). */
export function moveAtInterval(session, i) {
  if (!session?.moves?.length) return null;
  return session.moves[i % session.moves.length];
}

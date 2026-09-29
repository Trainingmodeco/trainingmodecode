// Named workouts for Quick Mission — the classics people ask for by name.
//
// Each one builds a mission in exactly the shape QuickMissionActive already
// runs ({ exercises, finisherExercises, rounds }). Workouts with bookends
// (Murph's two runs) are flattened into one round, because the timer repeats
// every exercise each round. `lines` is what the setup card prints — the
// workout as a coach would write it on a whiteboard, not 62 rows.
//
// Exercise extras the timer understands:
//   unit  — the word after the target instead of REPS ("MILE", "HALF MILE")
//   calls — [{ t, say }]: the coach speaks `say` `t` seconds into a timed move
//
// Murph and Half Murph follow the published hero workout. Sally Up uses the
// challenge's idea — hold at the bottom until UP — on our own call pattern
// (no music). Deadly Seven and 5 Minutes of Hell are Training Mode's versions.

import { LIBRARY_CLASSICS } from './workoutLibrary';

const TRANSITION = 5; // seconds between moves inside a named workout

const reps = (name, n, extra = {}) => ({ name, mode: 'reps', reps: n, rest: TRANSITION, ...extra });
const timed = (name, work, extra = {}) => ({ name, mode: 'timed', work, rest: TRANSITION, ...extra });

// Down / up holds for a Sally Up set: every hold at the bottom is a little
// different, so there is no rhythm to cheat. Returns the call list and the
// total seconds.
function sallyCalls() {
  const downs = [4, 4, 6, 4, 8, 4, 4, 10, 4, 6, 12, 4, 4, 8, 15, 4, 6, 20];
  const calls = [];
  let t = 0;
  downs.forEach((hold, i) => {
    calls.push({ t, say: 'Down' });
    t += hold;
    calls.push({ t, say: i === downs.length - 1 ? 'Up. Done.' : 'Up' });
    t += 3;
  });
  return { calls, total: t };
}

function murph({ half = false } = {}) {
  const rounds = half ? 10 : 20;
  const run = half ? reps('Half Mile Run', 1, { unit: 'HALF MILE' }) : reps('Mile Run', 1, { unit: 'MILE' });
  const exercises = [{ ...run, rest: 30 }];
  for (let r = 0; r < rounds; r += 1) {
    exercises.push(reps('Pull-Ups', 5), reps('Push-Ups', 10), reps('Squats', 15, { rest: r === rounds - 1 ? 30 : 10 }));
  }
  exercises.push({ ...run });
  return exercises;
}

export const NAMED_WORKOUTS = [
  {
    id: 'murph',
    title: 'MURPH',
    tag: 'Hero workout',
    focus: 'Full Body',
    estMin: 55,
    needs: 'Pull-up bar',
    lines: [['Run', '1 mile'], ['Pull-Ups', '100'], ['Push-Ups', '200'], ['Squats', '300'], ['Run', '1 mile']],
    note: 'Partitioned: 20 rounds of 5 pull-ups · 10 push-ups · 15 squats between the runs. Tap DONE when each run is finished.',
    build: () => murph(),
  },
  {
    id: 'half_murph',
    title: 'HALF MURPH',
    tag: 'Hero workout',
    focus: 'Full Body',
    estMin: 28,
    needs: 'Pull-up bar',
    lines: [['Run', '½ mile'], ['Pull-Ups', '50'], ['Push-Ups', '100'], ['Squats', '150'], ['Run', '½ mile']],
    note: '10 rounds of 5 pull-ups · 10 push-ups · 15 squats between the runs.',
    build: () => murph({ half: true }),
  },
  {
    id: 'sally_squats',
    title: 'SALLY UP · SQUATS',
    tag: 'Challenge',
    focus: 'Lower',
    estMin: 4,
    lines: [['Squat', 'hold down · stand on UP'], ['Holds', 'grow from 4s to 20s']],
    note: 'Sink on DOWN and hold at the bottom until the coach says UP. Never fully rest.',
    build: () => { const s = sallyCalls(); return [timed('Sally Up Squats', s.total, { calls: s.calls, rest: 1 })]; },
  },
  {
    id: 'sally_pushups',
    title: 'SALLY UP · PUSH-UPS',
    tag: 'Challenge',
    focus: 'Upper',
    estMin: 4,
    lines: [['Push-Up', 'hold low · press on UP'], ['Holds', 'grow from 4s to 20s']],
    note: 'Lower on DOWN and hold an inch off the floor until UP. Knees down is fine — keep holding.',
    build: () => { const s = sallyCalls(); return [timed('Sally Up Push-Ups', s.total, { calls: s.calls, rest: 1 })]; },
  },
  {
    id: 'deadly_seven',
    title: 'DEADLY SEVEN',
    tag: 'Training Mode',
    focus: 'Full Body',
    estMin: 30,
    lines: [['7 rounds', '7 moves × 7 reps'], ['Burpees · Push-Ups · Jump Squats', ''], ['Lunges · Sit-Ups · Mountain Climbers · Tuck Jumps', '']],
    note: 'Seven moves, seven reps, seven rounds. 20 seconds between rounds.',
    build: () => {
      const moves = ['Burpees', 'Push-Ups', 'Jump Squats', 'Lunges', 'Sit-Ups', 'Mountain Climbers', 'Tuck Jumps'];
      const out = [];
      for (let r = 0; r < 7; r += 1) {
        moves.forEach((m, i) => out.push(reps(m, 7, { rest: i === moves.length - 1 && r < 6 ? 20 : TRANSITION })));
      }
      return out;
    },
  },
  {
    id: 'hell_mma',
    title: '5 MINUTES OF HELL · MMA',
    tag: 'Training Mode',
    focus: 'Combat',
    estMin: 6,
    lines: [['Sprawls', '1:00'], ['Shadowbox Sprint', '1:00'], ['Knee Strikes', '1:00'], ['Ground & Pound', '1:00'], ['Burpees', '1:00']],
    note: 'Five straight minutes, all-out. Three seconds to switch — no rest.',
    build: () => ['Sprawls', 'Shadowbox Sprint', 'Knee Strikes', 'Ground and Pound', 'Burpees'].map((m, i, a) => timed(m, 60, { rest: i === a.length - 1 ? 1 : 3 })),
  },
  {
    id: 'hell_general',
    title: '5 MINUTES OF HELL',
    tag: 'Training Mode',
    focus: 'Full Body',
    estMin: 6,
    lines: [['Jumping Jacks', '1:00'], ['Mountain Climbers', '1:00'], ['Squat Jumps', '1:00'], ['Push-Ups', '1:00'], ['Burpees', '1:00']],
    note: 'Five straight minutes, all-out. Three seconds to switch — no rest.',
    build: () => ['Jumping Jacks', 'Mountain Climbers', 'Squat Jumps', 'Push-Ups', 'Burpees'].map((m, i, a) => timed(m, 60, { rest: i === a.length - 1 ? 1 : 3 })),
  },
];

// The owner's own sessions (data/workoutLibrary) join the classics.
NAMED_WORKOUTS.push(...LIBRARY_CLASSICS);

export const namedWorkoutById = (id) => NAMED_WORKOUTS.find(w => w.id === id) || null;

// The mission object QuickMissionActive runs.
export function buildNamedMission(id) {
  const w = namedWorkoutById(id);
  if (!w) return null;
  return {
    title: w.title,
    workoutType: w.workoutType || 'Bodyweight',
    duration: w.estMin,
    difficulty: 'Hard',
    format: 'Auto',
    focus: w.focus,
    exercises: w.build(),
    finisherExercises: [],
    rounds: w.rounds || 1,
    cardioFinisher: false,
    named: w.id,
  };
}

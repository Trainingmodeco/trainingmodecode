// Fit Challenge looks · sample data only (nothing here is read by the app).
//
// Move names are the app's own: Quick Mission's move catalog
// (data/missionMoves: Dive Bomber Push-Ups, Air Squats) and the Workout
// Builder library (fit-mode/fitModeExerciseData*: Inverted Rows, Hanging Knee
// Raises, ...). Every one has a plain clip in both voices EXCEPT Reverse Curls,
// which is in neither list (see docs/fit-challenge/LOOKS-NOTES.md).
//
// A move: { id, name, reps | seconds, pattern, bar?, noBar? }. `bar` marks a
// move that needs a pull-up bar; `noBar` is what it becomes without one.

// FULL BODY WARRIOR: the spec's default circuit, renamed (the app's naming
// rule: no franchise names). 99 reps a round: 198 / 297 / 396 / 495.
export const WARRIOR = [
  { id: 'dive', name: 'Dive Bomber Push-Ups', reps: 12, pattern: 'push' },
  { id: 'push', name: 'Push-Ups', reps: 16, pattern: 'push' },
  { id: 'pull', name: 'Pull-Ups', reps: 8, pattern: 'pull', bar: true, noBar: { id: 'snow', name: 'Reverse Snow Angels', reps: 12, pattern: 'pull' } },
  { id: 'rows', name: 'Inverted Rows', reps: 16, pattern: 'pull' },
  { id: 'pike', name: 'Pike Push-Ups', reps: 8, pattern: 'push' },
  { id: 'squat', name: 'Air Squats', reps: 15, pattern: 'legs' },
  { id: 'hkr', name: 'Hanging Knee Raises', reps: 12, pattern: 'core', bar: true, noBar: { id: 'legraise', name: 'Leg Raises', reps: 12, pattern: 'core' } },
  { id: 'rcurl', name: 'Reverse Curls', reps: 12, pattern: 'arms' },
];

// SHUFFLE: a different balanced deal at the same level, gear, focus and
// rounds (3 push, 2 pull, legs, core, arms), with a timed core hold. It takes
// one of the generator's own full-body titles.
export const SHUFFLED_TITLE = 'CALISTHENICS CIRCUIT';
export const SHUFFLED = [
  { id: 'decline', name: 'Decline Push-Ups', reps: 12, pattern: 'push' },
  { id: 'chin', name: 'Chin-Ups', reps: 8, pattern: 'pull', bar: true, noBar: { id: 'snow', name: 'Reverse Snow Angels', reps: 12, pattern: 'pull' } },
  { id: 'diamond', name: 'Diamond Push-Ups', reps: 10, pattern: 'push' },
  { id: 'wrows', name: 'Wide Inverted Rows', reps: 12, pattern: 'pull' },
  { id: 'dolphin', name: 'Dolphin Push-Ups', reps: 10, pattern: 'push' },
  { id: 'lunge', name: 'Walking Lunges', reps: 16, pattern: 'legs' },
  { id: 'hollow', name: 'Hollow Body Hold', seconds: 30, pattern: 'core' },
  { id: 'dips', name: 'Triceps Dips', reps: 12, pattern: 'arms' },
];

// A program day on the same card: PUSH / PULL / LEGS, day 2 (PULL).
export const PROGRAM = { name: 'PUSH / PULL / LEGS', days: ['PUSH', 'PULL', 'LEGS'], dayIndex: 1, title: 'PULL DAY' };
export const PULL_DAY = [
  { id: 'pull', name: 'Pull-Ups', reps: 8, pattern: 'pull', bar: true, noBar: { id: 'haulers', name: 'Arm Haulers', reps: 12, pattern: 'pull' } },
  { id: 'rows', name: 'Inverted Rows', reps: 12, pattern: 'pull' },
  { id: 'chin', name: 'Chin-Ups', reps: 8, pattern: 'pull', bar: true, noBar: { id: 'towel', name: 'Resistance Towel Curls', reps: 10, pattern: 'arms' } },
  { id: 'snow', name: 'Reverse Snow Angels', reps: 12, pattern: 'pull' },
  { id: 'wrows', name: 'Wide Inverted Rows', reps: 12, pattern: 'pull' },
  { id: 'chinhold', name: 'Chin-Up Hold', seconds: 20, pattern: 'arms', bar: true, noBar: { id: 'isotowel', name: 'Isometric Towel Curls', seconds: 30, pattern: 'arms' } },
];

// The swap sheet on Pull-Ups (same pattern, the level's range, the gear you
// have): OptionRow's option shape. An option on the same bar as the move it
// replaces shows no gear tag (the NOW box already says PULL-UP BAR), so a long
// name has the row to itself instead of breaking at its hyphen on a 360px phone.
export const PULL_UP_SWAPS = [
  { id: 'negatives', kind: 'easier', label: 'EASIER', name: 'Pull-Up Negatives', doseFrom: '8', doseTo: '5', gear: 'none',
    cues: ['Jump or step to the top, chin over the bar.', 'Lower for a slow count of five.', 'Arms straight at the bottom, then reset.'] },
  { id: 'chin', kind: 'similar', label: 'SIMILAR', name: 'Chin-Ups', doseFrom: '8', doseTo: '8', gear: 'none',
    cues: ['Palms toward you, hands shoulder-width.', 'Pull your chest to the bar.', 'Lower all the way down.'] },
  { id: 'archer', kind: 'harder', label: 'HARDER', name: 'Archer Pull-Ups', doseFrom: '8', doseTo: '5', gear: 'none',
    cues: ['Wide grip.', 'Pull toward one hand, the other arm long.', 'Switch sides each rep.'] },
  { id: 'snow', kind: 'no-gear', label: 'NO GEAR', name: 'Reverse Snow Angels', doseFrom: '8', doseTo: '12', gear: 'none',
    cues: ['Lie face down, arms by your sides.', 'Sweep the arms overhead, thumbs up.', 'Squeeze the shoulder blades all the way.'] },
];

// CHOOSE, by the spec's categories. Titles are the app's own library
// missions and classics (data/namedWorkouts, data/workoutLibrary).
export const CHOOSE_GROUPS = [
  { id: 'full', label: 'Full Body', items: [
    { id: 'warrior', title: 'FULL BODY WARRIOR', line: '8 moves · 99 reps a round', onCard: true },
    { id: 'deadly7', title: 'DEADLY SEVEN', line: '7 moves × 7 reps · 7 rounds' },
  ] },
  { id: 'upper', label: 'Upper Body', items: [
    { id: 'pushup_division', title: 'PUSH-UP DIVISION', line: '14 push-up styles · 30s each' },
  ] },
  { id: 'lower', label: 'Lower Body', items: [
    { id: 'legendary', title: 'LEGENDARY SQUAT', line: '9 leg moves · 2 rounds' },
  ] },
  { id: 'core', label: 'Core & Abs', items: [
    { id: 'abs3', title: '3 LEVEL ABS', line: '9 ab moves · 40s each · 3 rounds' },
  ] },
  { id: 'combat', label: 'Combat Conditioning', items: [
    { id: 'hell_mma', title: '5 MINUTES OF HELL · MMA', line: '5 moves · 60s each' },
  ] },
];

// BONUS TRAINING (never in the totals).
export const BONUS = [
  { id: 'run', name: 'Morning Run', dose: '20 min, easy', link: { label: 'CARDIO' } },
  { id: 'lsit', name: 'L-Sit Hold', dose: '3 × 20s' },
  { id: 'handstand', name: 'Handstand Hold', dose: '3 × 30s, against a wall' },
  { id: 'mobility', name: 'Mobility', dose: '10 min' },
  { id: 'carry', name: 'Farmer Carries', dose: '3 × 40s', gear: 'WEIGHTS' },
  { id: 'shadow', name: 'Shadowboxing', dose: '3 × 2 min', link: { label: 'FIGHT' } },
];

// The CHECK-OFF run: round 3 of 5, rounds 1 and 2 done, 4 of 8 ticked.
export const TRACKER = {
  rounds: 5,
  doneRounds: 2,
  tickedInCurrent: 4,
  roundTimes: [7 * 60 + 2, 7 * 60 + 31],
  thisRoundSec: 3 * 60 + 14,
};

// The finished run: 5 rounds, 495 reps, 38:12, 100%.
export const RESULT = {
  splits: [7 * 60 + 2, 7 * 60 + 31, 7 * 60 + 46, 7 * 60 + 52, 8 * 60 + 1], // 38:12 in all
  // Paid as a generated Quick Mission is today: the minutes the card promised
  // (about 35 at 5 rounds) × MEDIUM's 15 a minute, + 30 for finishing.
  xp: 35 * 15 + 30,
};

// YOUR WORKOUTS: newest first (today is Monday 23 November 2026).
export const HISTORY = [
  { id: 'h1', dow: 'SAT', day: 21, mon: 'NOV', name: 'FULL BODY WARRIOR', rounds: 5, roundsOf: 5, reps: 495, elapsedSec: 38 * 60 + 12, pct: 100 },
  { id: 'h2', dow: 'THU', day: 19, mon: 'NOV', name: 'PULL DAY', rounds: 4, roundsOf: 4, reps: 208, holdSec: 80, elapsedSec: 24 * 60 + 40, pct: 100 },
  { id: 'h3', dow: 'TUE', day: 17, mon: 'NOV', name: 'FULL BODY WARRIOR', rounds: 3, roundsOf: 4, reps: 297, elapsedSec: 22 * 60 + 5, pct: 75 },
  { id: 'h4', dow: 'SUN', day: 15, mon: 'NOV', name: 'CALISTHENICS CIRCUIT', rounds: 4, roundsOf: 4, reps: 320, holdSec: 120, elapsedSec: 26 * 60 + 31, pct: 100 },
  { id: 'h5', dow: 'FRI', day: 13, mon: 'NOV', name: 'CORE CRUSHER', rounds: 3, roundsOf: 3, reps: 180, holdSec: 180, elapsedSec: 15 * 60 + 20, pct: 100 },
  { id: 'h6', dow: 'WED', day: 11, mon: 'NOV', name: 'LEG DAY BLITZ', rounds: 4, roundsOf: 4, reps: 388, elapsedSec: 29 * 60 + 47, pct: 100 },
];

// Quick Mission v2 · the launch missions, how they build, the MISSION SELECT
// shelf, swaps and the remembered shelf choices.
//
// A MissionDef is authored per level (beginner / standard / elite) from the
// move catalog (data/missionMoves). buildLoadoutMission turns one level into
// the mission QuickMissionActive and QuickMissionSolo run: a superset of the
// classic mission shape ({ exercises, finisherExercises, rounds }) plus the
// v2 card, score and pace fields. Everything in a built mission is plain JSON:
// it is stashed for resume and stored with the session.
//
// The swap model: a swap is always rebuilt from the AUTHORED base slot to the
// target move, never from the move on screen, so a pick made in one step or
// through a chain of swaps gives the same mission, in Setup and in SOLO.
//
// Tiers: where the source gives Rx and Scaled loads, Rx is ELITE and Scaled is
// STANDARD. Pace targets for TUTORIAL STAGE, TURBO BUTTON and QUOTA 300 come
// from the source; the other eight are coach estimates (see each paceBasis).
// `knownAs` is stored, never rendered.
import {
  LEVELS, LEVEL_LABEL, GEAR_LABEL, GEAR_WORD, ALT_LABEL,
  moveById, cadenceFor, estMsFor, slotDose, windowRest, rowItems,
} from './missionMoves';
import { NAMED_WORKOUTS, CLASSIC_TAGS } from './namedWorkouts';
import { loadEquipment } from './equipmentProfile';
import { missionClockSec, estimateWorkSeconds } from './missionSolo';

export const LOADOUTS = [
  { id: 'all', label: 'ALL' }, { id: 'none', label: 'NO GEAR' }, { id: 'bell', label: '1 BELL / DB' },
  { id: 'barbell', label: 'BARBELL' }, { id: 'mixed', label: 'MIXED' },
];
export const THEMES = [
  { id: 'all', label: 'ALL', help: 'Every mission for this loadout.' },
  { id: 'striking', label: 'STRIKING', help: 'Fight-round clocks, strikes and sprawls. No bag needed.' },
  { id: 'burpees', label: 'BURPEES', help: 'Burpee missions, up to 300 reps.' },
  { id: 'century', label: 'CENTURY', help: 'High-rep missions, 100 to 300 reps.' },
];
export const LOADOUT_GEAR = {
  none: ['none'],
  bell: ['none', 'bell', 'db', 'rower'],          // rower: CHECKPOINT 20's optional minute-4 swap
  barbell: ['none', 'barbell', 'plate'],
  mixed: ['none', 'bell', 'db', 'barbell', 'plate', 'rower'],
};
export const FORMAT_LABEL = { emom: 'EMOM', amrap: 'AMRAP', forTime: 'FOR TIME', intervals: 'INTERVALS' };
export const GUIDED_HELP_AMRAP = 'The coach runs the clock and calls the time. The moves stay on screen.';
export const SOLO_HELP = 'Your pace. The whole workout on one screen, one clock.';
export const SOLO_ONLY_HELP = 'SOLO only for now. Guided is coming.';

// ── authoring helpers ───────────────────────────────────────────────────────
// r: reps slot · t: timed slot · amrap: timed list (an AMRAP block) ·
// complex: reps list · s: list step. `extra` carries swapKey (required),
// window, prefix, calls, name, cadenceMs, setupMs, say, sideSay, note,
// noteIf, sides (null removes the catalog's) and count.
const r = (moveId, reps, rest, extra = {}) => ({ moveId, mode: 'reps', reps, rest, ...extra });
const t = (moveId, work, rest, extra = {}) => ({ moveId, mode: 'timed', work, rest, ...extra });
const amrap = (work, rest, list, calls, extra = {}) => ({
  name: 'AMRAP', sayLead: 'AMRAP', mode: 'timed', work, rest, list, ...(calls && calls.length ? { calls } : {}), ...extra,
});
const complex = (name, list, extra = {}) => ({ name, mode: 'reps', reps: list.reduce((n, st) => n + st.reps, 0), rest: 0, list, ...extra });
const s = (moveId, reps, extra = {}) => ({ moveId, reps, ...extra });

const C180 = [{ t: 90, say: 'Halfway.' }, { t: 120, say: 'One minute.' }, { t: 170, say: 'Ten seconds.' }];
const C180B = [{ t: 120, say: 'One minute.' }, { t: 170, say: 'Ten seconds.' }];
const C120 = [{ t: 60, say: 'One minute.' }, { t: 110, say: 'Ten seconds.' }];
const C720 = [{ t: 360, say: 'Halfway.' }, { t: 660, say: 'One minute.' }, { t: 710, say: 'Ten seconds.' }];
const C600 = [{ t: 300, say: 'Halfway.' }, { t: 540, say: 'One minute.' }, { t: 590, say: 'Ten seconds.' }];
// Wipers: one pass every 2 s on the calls. 'Five' = five seconds left (20 s work only).
export const W20 = [[0, 'Left'], [2, 'Right'], [4, 'Left'], [6, 'Right'], [8, 'Left'], [10, 'Right'], [12, 'Left'], [14, 'Right'], [15, 'Five'], [16, 'Left'], [18, 'Right']].map(([at, say]) => ({ t: at, say }));
// 15 s work: no 'Five' (it would land on the 10 s 'Right' and break the sweep rhythm).
export const W15 = [[0, 'Left'], [2, 'Right'], [4, 'Left'], [6, 'Right'], [8, 'Left'], [10, 'Right'], [12, 'Left'], [14, 'Right']].map(([at, say]) => ({ t: at, say }));

// ── 1 · IRON CLOCK 16 ───────────────────────────────────────────────────────
const IRON_STD = [
  r('bb-deadlift', 10, 0, { swapKey: 'deadlift', window: 60, prefix: 'MIN 1' }),
  r('bb-bent-over-row', 10, 0, { swapKey: 'row', window: 60, prefix: 'MIN 2' }),
  r('bb-front-squat', 8, 0, { swapKey: 'squat', window: 60, prefix: 'MIN 3', setupMs: 4000 }), // coach estimate: rep 1 includes cleaning the bar up
  r('bb-push-press', 8, 0, { swapKey: 'press', window: 60, prefix: 'MIN 4' }),
];
const IRON_PACE = { elite: { held: 16, of: 16, setSec: 20 }, standard: { held: 16, of: 16, setSec: 25 }, beginner: { held: 14, of: 16, setSec: 30 } };
const IRON_CLOCK = {
  id: 'iron_clock_16', launch: 1, title: 'IRON CLOCK 16', tag: 'Barbell', loadout: 'barbell', themes: [], format: 'emom',
  difficulty: 'Normal', focus: 'Full Body', workoutType: 'Weighted', hotel: false, quiet: false, guided: true, knownAs: '',
  loadoutLine: '1 BARBELL + PLATES', missionLine: 'EMOM 16 · 4 LIFTS · REST THE REST OF EACH MINUTE',
  scoreLine: 'MINUTES HELD, OUT OF 16', scoreRule: { kind: 'minutesHeld' },
  scale: 'Lighter bar, or 3 rounds.',
  note: 'Warm up 3 min, then 1 round with the empty bar. Clean the bar up on the first front squat, or take it from a rack. Add 2.5 kg the next time you hold 16/16.',
  introSay: 'Iron clock. One lift every minute. Rest for what is left of it.',
  guidedHelp: 'The coach counts every rep and starts each minute.',
  paceBasis: 'Coach estimate from the count: 10 deadlifts at 2.0 / 2.5 / 3.0 s a rep (elite / standard / beginner).',
  defaultLevel: 'standard',
  levels: {
    beginner: {
      detail: 'Empty bar 20/15 kg · 8 / 8 / 6 / 6 · 12 min', minutes: 12, load: '20/15 kg bar', rounds: 3,
      missionLine: 'EMOM 12 · 4 LIFTS · REST THE REST OF EACH MINUTE',
      slots: [r('bb-deadlift', 8, 0, { swapKey: 'deadlift', window: 60, prefix: 'MIN 1' }),
        r('bb-bent-over-row', 8, 0, { swapKey: 'row', window: 60, prefix: 'MIN 2' }),
        r('plate-goblet-squat', 6, 0, { swapKey: 'squat', window: 60, prefix: 'MIN 3' }),
        r('bb-strict-press', 6, 0, { swapKey: 'press', window: 60, prefix: 'MIN 4' })],
      pace: { elite: { held: 12, of: 12, setSec: 16 }, standard: { held: 12, of: 12, setSec: 20 }, beginner: { held: 10, of: 12, setSec: 25 } },
    },
    standard: { detail: '35/25 kg · 10 / 10 / 8 / 8 · 16 min', minutes: 16, load: '35/25 kg (77/55 lb)', rounds: 4, slots: IRON_STD, pace: IRON_PACE },
    elite: { detail: '50/35 kg · 10 / 10 / 8 / 8 · 16 min · elite count', minutes: 16, load: '50/35 kg (110/77 lb)', rounds: 4, slots: IRON_STD, pace: IRON_PACE },
  },
};

// ── 2 · ONE-BELL 300 ────────────────────────────────────────────────────────
const oneBell = (pushUpId, lastRest) => [
  r('kb-swing', 10, 5, { swapKey: 'swing' }), r('kb-clean', 10, 5, { swapKey: 'clean' }), r('kb-press', 10, 5, { swapKey: 'press' }),
  r('kb-row', 10, 5, { swapKey: 'row' }), r('kb-reverse-lunge', 10, 5, { swapKey: 'lunge' }), r(pushUpId, 10, lastRest, { swapKey: 'push-up' }),
];
const ONE_BELL = {
  id: 'one_bell_300', launch: 2, title: 'ONE-BELL 300', tag: 'Kettlebell', loadout: 'bell', themes: [], format: 'forTime',
  difficulty: 'Hard', focus: 'Full Body', workoutType: 'Weighted', hotel: true, quiet: false, guided: true, knownAs: '',
  loadoutLine: '1 KETTLEBELL (OR 1 DUMBBELL)', scoreLine: 'TIME, OR REPS AT THE CAP', scoreRule: { kind: 'time' },
  scale: 'Lighter bell (16/8 kg), or 3 rounds.',
  note: 'Pick a bell you can strict-press 8 times per arm, fresh. When the presses slow, push-press rather than arch your back.',
  introSay: 'One bell, three hundred reps. Ten of each move, every round.',
  guidedHelp: "The coach counts every rep and calls what's next.",
  paceBasis: 'Coach estimate: about 4 minutes a round for most people (3 for elite, 5 for a beginner).',
  defaultLevel: 'standard',
  levels: {
    beginner: {
      detail: 'Half loadout · 3 rounds · 12/8 kg · cap 20:00', minutes: 12, load: '12/8 kg (26/18 lb)', rounds: 3, capSec: 1200,
      missionLine: '180 REPS · 3 ROUNDS FOR TIME · CAP 20:00',
      slots: oneBell('knee-push-up', 30), pace: { elite: 480, standard: 660, beginner: 900 },
    },
    standard: {
      detail: '5 rounds · M 20 / W 12 kg · cap 30:00', minutes: 20, load: 'M 20 kg (44 lb) / W 12 kg (26 lb)', rounds: 5, capSec: 1800,
      missionLine: '300 REPS · 5 ROUNDS FOR TIME · CAP 30:00',
      slots: oneBell('push-up', 20), pace: { elite: 900, standard: 1200, beginner: 1500 },
    },
    elite: {
      detail: '5 rounds · 24/16 kg · cap 30:00', minutes: 22, load: '24/16 kg (53/35 lb)', rounds: 5, capSec: 1800,
      missionLine: '300 REPS · 5 ROUNDS FOR TIME · CAP 30:00',
      slots: oneBell('push-up', 20), pace: { elite: 990, standard: 1320, beginner: 1650 },
    },
  },
};

// ── 3 · FIVE ROUND BOUT ─────────────────────────────────────────────────────
const BOUT_STD = [amrap(180, 60, [s('bb-power-clean', 3, { swapKey: 'clean' }), s('push-up', 6, { swapKey: 'push-up' }), s('air-squat', 9, { swapKey: 'squat' })], C180, { swapKey: 'block' })];
const FIVE_ROUND = {
  id: 'five_round_bout', launch: 3, title: 'FIVE ROUND BOUT', tag: 'Striking', loadout: 'mixed', themes: ['striking'], format: 'amrap',
  difficulty: 'Hard', focus: 'Full Body', workoutType: 'Hybrid', hotel: true, quiet: false, guided: true, knownAs: 'The Chief',
  loadoutLine: '1 BARBELL, OR 2 DUMBBELLS OR 2 KETTLEBELLS', scoreLine: 'ROUNDS + REPS, ALL BLOCKS ADDED', scoreRule: { kind: 'roundsReps' },
  scale: 'Lighter bar, or the beginner level (3 blocks, dumbbells).',
  note: "Never been coached on the barbell power clean? Use dumbbells. Don't learn a clean under a clock. Restart at the cleans every block. Warm up 5 min: 2 easy rounds, then empty-bar deadlifts, high pulls and hang cleans.",
  introSay: 'Five round bout. Three-minute rounds, one minute of rest. Restart at the cleans every round.',
  guidedHelp: GUIDED_HELP_AMRAP,
  paceBasis: 'Coach estimate: a round takes about 30 s elite, 45 s standard, 60 s beginner.',
  defaultLevel: 'standard',
  levels: {
    beginner: {
      detail: '3 × 3:00 · DB cleans 10/7 kg · incline push-ups · bench squats', minutes: 11, load: '2 dumbbells, 10/7 kg (20/15 lb)', rounds: 3,
      missionLine: '3 × 3:00 AMRAP · 1:00 REST · 3 DB CLEANS · 6 INCLINE PUSH-UPS · 9 BENCH SQUATS',
      slots: [amrap(180, 60, [s('db-power-clean', 3, { swapKey: 'clean' }), s('incline-push-up', 6, { swapKey: 'push-up' }), s('bench-squat', 9, { swapKey: 'squat' })], C180, { swapKey: 'block' })],
      pace: { elite: 21, standard: 15, beginner: 10 },
    },
    standard: {
      detail: '5 × 3:00 · 43/29 kg bar or 2 × 16/12 kg bells', minutes: 19, load: '43/29 kg (95/65 lb) bar, or 2 × 16/12 kg kettlebells', rounds: 5,
      missionLine: '5 × 3:00 AMRAP · 1:00 REST · 3 POWER CLEANS · 6 PUSH-UPS · 9 AIR SQUATS',
      slots: BOUT_STD, pace: { elite: 27, standard: 20, beginner: 14 },
    },
    elite: {
      detail: '5 × 3:00 · 60/43 kg bar', minutes: 19, load: '60/43 kg (135/95 lb) bar, or 2 × 22.5/15 kg dumbbells', rounds: 5,
      missionLine: '5 × 3:00 AMRAP · 1:00 REST · 3 POWER CLEANS · 6 PUSH-UPS · 9 AIR SQUATS',
      slots: BOUT_STD, pace: { elite: 25, standard: 18, beginner: 12 },
    },
  },
};

// ── 4 · BEST OF 3 ───────────────────────────────────────────────────────────
const BEST_OF_3 = {
  id: 'best_of_3', launch: 4, title: 'BEST OF 3', tag: 'Striking', loadout: 'none', themes: ['striking'], format: 'amrap',
  difficulty: 'Normal', focus: 'Conditioning', workoutType: 'Bodyweight', hotel: true, quiet: false, guided: true, knownAs: '',
  loadoutLine: 'NO GEAR', scoreLine: 'ROUNDS + REPS, ALL 3 ROUNDS ADDED', scoreRule: { kind: 'roundsReps' },
  scale: 'Beginner level: 3 × 2:00 with squat thrusts.',
  note: "Warm up 1 min of light shadowboxing and 10 squats. Win the decision: match or beat round 1 in round 3. Don't snap the elbow straight on the punches.",
  introSay: 'Best of three. Three-minute rounds, like a real fight.',
  tips: ['Remember your round one score.', 'Match round one or beat it to win the decision.'],
  guidedHelp: GUIDED_HELP_AMRAP,
  paceBasis: 'Coach estimate: one clean round takes about 30 s (25 s elite, 45 s beginner).',
  defaultLevel: 'standard',
  levels: {
    beginner: {
      detail: '3 × 2:00 · squat thrusts, no hop', minutes: 8, rounds: 3,
      missionLine: '3 × 2:00 AMRAP · 1:00 REST · 3 SQUAT THRUSTS · 10 SQUATS · 10 ONE-TWOS',
      slots: [amrap(120, 60, [s('squat-thrust', 3, { swapKey: 'sprawl' }), s('air-squat', 10, { swapKey: 'squat' }), s('one-two', 10, { swapKey: 'one-two' })], C120, { swapKey: 'block' })],
      pace: { elite: 15, standard: 11, beginner: 8 },
    },
    standard: {
      detail: '3 × 3:00 · sprawls · squats · one-twos', minutes: 11, rounds: 3,
      missionLine: '3 × 3:00 AMRAP · 1:00 REST · 5 SPRAWLS · 10 SQUATS · 10 ONE-TWOS',
      slots: [amrap(180, 60, [s('sprawl', 5, { swapKey: 'sprawl' }), s('air-squat', 10, { swapKey: 'squat' }), s('one-two', 10, { swapKey: 'one-two' })], C180B, { swapKey: 'block' })],
      pace: { elite: 21, standard: 17, beginner: 12 },
    },
    elite: {
      detail: '3 × 3:00 · burpees · jump squats', minutes: 11, rounds: 3,
      missionLine: '3 × 3:00 AMRAP · 1:00 REST · 5 BURPEES · 10 JUMP SQUATS · 10 ONE-TWOS',
      slots: [amrap(180, 60, [s('burpee', 5, { swapKey: 'sprawl' }), s('jump-squat', 10, { swapKey: 'squat' }), s('one-two', 10, { swapKey: 'one-two' })], C180B, { swapKey: 'block' })],
      pace: { elite: 18, standard: 14, beginner: 10 },
    },
  },
};

// ── 5 · STEEL PLATING ───────────────────────────────────────────────────────
// Complex counts: elite 2×2.0 + 2.0 + 3×2.0 = 12 s; standard 15 s; beginner
// 18 s — each level's setSec for its own tier.
const steelSteps = (cleanId, squatId) => [s(cleanId, 2, { swapKey: 'clean' }), s('kb-press', 1, { swapKey: 'press' }), s(squatId, 3, { swapKey: 'squat' })];
const steelPair = (cleanId, squatId) => [
  complex('Left Arm Complex', steelSteps(cleanId, squatId), { swapKey: 'complex', window: 60, prefix: 'ODD MIN', sideSay: 'left arm', say: 'the left arm complex' }),
  complex('Right Arm Complex', steelSteps(cleanId, squatId), { swapKey: 'complex', window: 60, prefix: 'EVEN MIN', sideSay: 'right arm', say: 'the right arm complex' }),
];
const STEEL = {
  id: 'steel_plating', launch: 5, title: 'STEEL PLATING', tag: 'Kettlebell', loadout: 'bell', themes: [], format: 'emom',
  difficulty: 'Hard', focus: 'Full Body', workoutType: 'Weighted', hotel: true, quiet: false, guided: true,
  knownAs: 'Armor Building Complex (Dan John), single-bell EMOM version',
  loadoutLine: '1 KETTLEBELL (OR 1 DUMBBELL) · CHECK THE CEILING', scoreLine: 'MINUTES HELD, OUT OF 20', scoreRule: { kind: 'minutesHeld' },
  scale: 'Lighter bell, or EMOM 10.',
  note: 'Same arm all minute, never park the bell. Odd minutes left, even minutes right. If the bell bangs your forearm, clean from the hang. Warm up 2 min: halos, goblet squats, 10 light swings.',
  introSay: 'Steel plating. Every minute: two cleans, one press, three front squats.',
  guidedHelp: 'The coach counts every complex and starts each minute.',
  paceBasis: 'Coach estimate from the count: one complex takes 12 s at the elite count, 15 s standard, 18 s beginner.',
  defaultLevel: 'standard',
  levels: {
    beginner: {
      detail: 'EMOM 10 · 12/8 kg · hang cleans · goblet squats', minutes: 10, load: '12/8 kg (26/18 lb)', rounds: 5,
      missionLine: 'EMOM 10 · 2 HANG CLEANS + 1 PRESS + 3 GOBLET SQUATS · ALTERNATE ARMS',
      slots: steelPair('kb-hang-clean', 'goblet-squat'),
      pace: { elite: { held: 10, of: 10, setSec: 12 }, standard: { held: 10, of: 10, setSec: 15 }, beginner: { held: 9, of: 10, setSec: 18 } },
    },
    standard: {
      detail: 'EMOM 20 · a bell you can press 5-6 times', minutes: 20, load: 'M 20-24 kg / W 12-16 kg', rounds: 10,
      missionLine: 'EMOM 20 · 2 CLEANS + 1 PRESS + 3 FRONT SQUATS · ALTERNATE ARMS',
      slots: steelPair('kb-clean', 'kb-front-squat'),
      pace: { elite: { held: 20, of: 20, setSec: 12 }, standard: { held: 20, of: 20, setSec: 15 }, beginner: { held: 18, of: 20, setSec: 20 } },
    },
    elite: {
      detail: 'EMOM 20 · two bells, every minute', minutes: 20, load: '2 × 24 / 2 × 16 kg', rounds: 20, // ONE slot × 20 rounds = 20 minutes
      loadoutLine: '2 KETTLEBELLS (OR 2 DUMBBELLS) · CHECK THE CEILING',
      missionLine: 'EMOM 20 · 2 CLEANS + 1 PRESS + 3 FRONT SQUATS · TWO BELLS',
      slots: [complex('Double-Bell Complex', steelSteps('kb-clean', 'kb-front-squat'), { swapKey: 'complex', window: 60, prefix: 'EVERY MIN', sideSay: 'both bells', say: 'the double-bell complex' })],
      pace: { elite: { held: 20, of: 20, setSec: 12 }, standard: { held: 20, of: 20, setSec: 15 }, beginner: { held: 18, of: 20, setSec: 20 } },
    },
  },
};

// ── 6 · CHECKPOINT 20 ───────────────────────────────────────────────────────
// Tagged 1 BELL / DB: the rower is an optional SIMILAR swap on minute 4, which
// LOADOUT_GEAR.bell allows. The default stays the shadowbox (home/travel).
const CHECK_STD = [
  r('kb-swing', 15, 0, { swapKey: 'swing', window: 60, prefix: 'MIN 1' }), r('push-up', 12, 0, { swapKey: 'push-up', window: 60, prefix: 'MIN 2' }),
  r('goblet-squat', 12, 0, { swapKey: 'squat', window: 60, prefix: 'MIN 3' }), t('air-boxing', 40, 0, { swapKey: 'shadowbox', window: 60, prefix: 'MIN 4' }),
];
const CHECKPOINT = {
  id: 'checkpoint_20', launch: 6, title: 'CHECKPOINT 20', tag: 'Striking', loadout: 'bell', themes: ['striking'], format: 'emom',
  difficulty: 'Normal', focus: 'Full Body', workoutType: 'Hybrid', hotel: true, quiet: false, guided: true, knownAs: '',
  loadoutLine: '1 KETTLEBELL · ROWER OPTIONAL', scoreLine: 'CHECKPOINTS CLEARED, OUT OF 20', scoreRule: { kind: 'minutesHeld' },
  scale: 'Lighter bell (16/12 kg), or EMOM 12.',
  note: 'Finish inside each minute; the rest of it is rest. Miss 3 minutes and the run is over. Load check in round 1: you should have 20 to 30 s left every minute. Under 15 s means the bell is too heavy. Got a rower? Swap minute 4 to 12/9 calories.',
  introSay: 'Checkpoint. Finish each set inside the minute. The rest of the minute is yours.',
  guidedHelp: 'The coach counts every rep and starts each minute.',
  paceBasis: 'Coach estimate from the count and the round-1 load check.',
  defaultLevel: 'standard',
  levels: {
    beginner: {
      detail: 'EMOM 12 · 3 rounds · 12/8 kg · knee push-ups', minutes: 12, load: '12/8 kg (26/18 lb)', rounds: 3,
      missionLine: 'EMOM 12 · SWINGS · PUSH-UPS · GOBLET SQUATS · SHADOWBOX',
      slots: [r('kb-swing', 10, 0, { swapKey: 'swing', window: 60, prefix: 'MIN 1' }), r('knee-push-up', 8, 0, { swapKey: 'push-up', window: 60, prefix: 'MIN 2' }),
        r('goblet-squat', 8, 0, { swapKey: 'squat', window: 60, prefix: 'MIN 3' }), t('air-boxing', 30, 0, { swapKey: 'shadowbox', window: 60, prefix: 'MIN 4' })],
      pace: { elite: { held: 12, of: 12, setSec: 20 }, standard: { held: 12, of: 12, setSec: 30 }, beginner: { held: 10, of: 12, setSec: 40 } },
    },
    standard: {
      detail: 'EMOM 20 · 5 rounds · 24/16 kg', minutes: 20, load: '24/16 kg (53/35 lb), Russian swing to eye level', rounds: 5,
      missionLine: 'EMOM 20 · SWINGS · PUSH-UPS · GOBLET SQUATS · SHADOWBOX',
      slots: CHECK_STD,
      pace: { elite: { held: 20, of: 20, setSec: 25 }, standard: { held: 20, of: 20, setSec: 35 }, beginner: { held: 17, of: 20, setSec: 45 } },
    },
    elite: {
      detail: 'EMOM 24 · 6 rounds · 24/16 kg', minutes: 24, load: '24/16 kg (53/35 lb)', rounds: 6,
      missionLine: 'EMOM 24 · SWINGS · PUSH-UPS · GOBLET SQUATS · SHADOWBOX',
      slots: CHECK_STD,
      pace: { elite: { held: 24, of: 24, setSec: 25 }, standard: { held: 24, of: 24, setSec: 35 }, beginner: { held: 21, of: 24, setSec: 45 } },
    },
  },
};

// ── 7 · ROOM 12 ─────────────────────────────────────────────────────────────
// quiet: true keeps every jump move out of its swaps.
const ROOM_12 = {
  id: 'room_12', launch: 7, title: 'ROOM 12', tag: 'Hotel Room', loadout: 'none', themes: [], format: 'amrap',
  difficulty: 'Normal', focus: 'Full Body', workoutType: 'Bodyweight', hotel: true, quiet: true, guided: true, knownAs: '',
  loadoutLine: 'NO GEAR · 2 × 1.5 M OF FLOOR', scoreLine: 'ROUNDS + REPS', scoreRule: { kind: 'roundsReps' },
  scale: 'Beginner level: 10 minutes, incline push-ups on the desk, crunches.',
  note: 'Nothing jumps, so it is safe for the room below. Warm up 2 min: march in place, arm circles, 5 slow lunges per leg. Incline push-ups go on the desk, not the soft bed.',
  introSay: 'Room twelve. No jumping. As many rounds as you can.',
  guidedHelp: GUIDED_HELP_AMRAP,
  paceBasis: 'Coach estimate: a round takes about 65-80 s for an intermediate.',
  defaultLevel: 'standard',
  levels: {
    beginner: {
      detail: 'AMRAP 10 · incline push-ups · crunches', minutes: 10, rounds: 1,
      missionLine: 'AMRAP 10 · 6 INCLINE PUSH-UPS · 8 REVERSE LUNGES · 12 CLIMBERS · 8 CRUNCHES',
      slots: [amrap(600, 0, [s('incline-push-up', 6, { swapKey: 'push-up' }), s('reverse-lunge', 8, { swapKey: 'lunge' }), s('mountain-climber', 12, { swapKey: 'climber' }), s('crunch', 8, { swapKey: 'core' })], C600, { swapKey: 'block' })],
      pace: { elite: 14, standard: 11, beginner: 8 },
    },
    standard: {
      detail: 'AMRAP 12 · no jumping', minutes: 12, rounds: 1,
      missionLine: 'AMRAP 12 · 8 PUSH-UPS · 12 REVERSE LUNGES · 16 CLIMBERS · 8 V-UPS',
      slots: [amrap(720, 0, [s('push-up', 8, { swapKey: 'push-up' }), s('reverse-lunge', 12, { swapKey: 'lunge' }), s('mountain-climber', 16, { swapKey: 'climber' }), s('v-up', 8, { swapKey: 'core' })], C720, { swapKey: 'block' })],
      pace: { elite: 12, standard: 10, beginner: 7 },
    },
    elite: {
      detail: 'AMRAP 12 · diamond push-ups · split squats', minutes: 12, rounds: 1,
      missionLine: 'AMRAP 12 · 8 DIAMOND PUSH-UPS · 12 SPLIT SQUATS · 16 CLIMBERS · 8 V-UPS',
      slots: [amrap(720, 0, [s('diamond-push-up', 8, { swapKey: 'push-up' }), s('bulgarian-split-squat', 12, { swapKey: 'lunge' }), s('mountain-climber', 16, { swapKey: 'climber' }), s('v-up', 8, { swapKey: 'core' })], C720, { swapKey: 'block' })],
      pace: { elite: 10, standard: 8, beginner: 6 },
    },
  },
};

// ── 8 · 21-HIT COMBO (SOLO only in Drop A) ──────────────────────────────────
// The bar transitions follow the back-squat key: with back squats the bar goes
// behind the neck on the last push press and comes off the back after.
const BACK_NOTE_SQUAT = { key: 'back-squat', is: 'bb-back-squat', then: 'On the last push press, lower the bar behind the neck onto the back.', else: null };
const BACK_NOTE_CLEAN = { key: 'back-squat', is: 'bb-back-squat', then: 'Press the bar off the back, then lower it to the hips.', else: 'Lower the bar to the hips.' };
const hitSteps = (backSquatStep) => [
  s('bb-dead-stop-row', 3, { swapKey: 'row' }), s('bb-clean-press', 3, { swapKey: 'clean-press' }), s('bb-push-press', 3, { swapKey: 'push-press' }),
  backSquatStep,
  s('bb-hang-power-clean', 3, { swapKey: 'hang-clean', noteIf: BACK_NOTE_CLEAN }),
  s('bb-front-squat', 3, { swapKey: 'front-squat' }), s('bb-deadlift', 3, { swapKey: 'deadlift' }),
];
const HIT_BACK = s('bb-back-squat', 3, { swapKey: 'back-squat', noteIf: BACK_NOTE_SQUAT });
const HIT_COMBO = {
  id: 'hit_combo_21', launch: 8, title: '21-HIT COMBO', tag: 'Barbell', loadout: 'barbell', themes: [], format: 'amrap',
  difficulty: 'Hard', focus: 'Full Body', workoutType: 'Weighted', hotel: false, quiet: false, guided: false, knownAs: '',
  loadoutLine: '1 BARBELL + BUMPER PLATES · 2 × 2 M', scoreLine: 'ROUNDS + REPS', scoreRule: { kind: 'roundsReps' },
  scale: 'Lighter bar, or the beginner level. Hotel gym: 2 dumbbells, same 7 moves.',
  note: 'Warm up 5 min of easy cardio, then 2 rounds with the empty bar. Put the bar down whenever form slips: the score is rounds, not unbroken sets. Sore shoulders: swap Back Squats for Front-Rack Reverse Lunges.',
  introSay: '',
  guidedHelp: '', // SOLO only; the card shows SOLO_ONLY_HELP
  paceBasis: 'Coach estimate: one clean round takes 60-75 s; the target is about 8-11 rounds at 50/35 kg.',
  defaultLevel: 'standard',
  levels: {
    beginner: {
      detail: 'AMRAP 10 · empty bar · no behind-the-neck', minutes: 10, load: '20/15 kg empty bar', rounds: 1,
      missionLine: 'AMRAP 10 · 3 EACH OF 7 LIFTS · LUNGES FOR BACK SQUATS',
      excludeAlts: ['bb-back-squat'], // beginners skip both behind-the-neck transitions; no swap may bring them back
      slots: [amrap(600, 0, hitSteps(s('bb-front-rack-lunge', 6, { swapKey: 'back-squat', noteIf: BACK_NOTE_SQUAT })), [], { swapKey: 'block' })],
      pace: { elite: 9, standard: 7, beginner: 5 },
    },
    standard: {
      detail: 'AMRAP 15 · 35/25 kg', minutes: 15, load: '35/25 kg (77/55 lb)', rounds: 1,
      missionLine: 'AMRAP 15 · 3 EACH OF 7 LIFTS · 21 REPS A ROUND',
      slots: [amrap(900, 0, hitSteps(HIT_BACK), [], { swapKey: 'block' })],
      pace: { elite: 12, standard: 10, beginner: 8 },
    },
    elite: {
      detail: 'AMRAP 15 · 50/35 kg', minutes: 15, load: '50/35 kg (110/77 lb)', rounds: 1,
      missionLine: 'AMRAP 15 · 3 EACH OF 7 LIFTS · 21 REPS A ROUND',
      slots: [amrap(900, 0, hitSteps(HIT_BACK), [], { swapKey: 'block' })],
      pace: { elite: 11, standard: 9, beginner: 7 },
    },
  },
};

// ── 9 · TUTORIAL STAGE ──────────────────────────────────────────────────────
// STANDARD counts at the beginner column (sprawl 3.0 s, Hindu squat 2.5 s),
// with the verified teep 3.0 s and one-two 1.0 s set explicitly. ELITE counts
// at the standard column.
const TUTORIAL = {
  id: 'tutorial_stage', launch: 9, title: 'TUTORIAL STAGE', tag: 'Striking', loadout: 'none', themes: ['striking'], format: 'intervals',
  difficulty: 'Easy', focus: 'Combat', workoutType: 'Bodyweight', hotel: false, quiet: false, guided: true, knownAs: '',
  countAt: { beginner: 'beginner', standard: 'beginner', elite: 'standard' },
  loadoutLine: 'NO GEAR · 2 × 2 M, A STRIDE CLEAR BEHIND YOU', scoreLine: 'SPRAWLS + HINDU SQUATS',
  scoreRule: { kind: 'reps', label: 'SPRAWLS + HINDU SQUATS', keys: ['sprawl', 'hindu-squat'], agg: 'total' },
  scale: 'Beginner level: 20-second blocks with a 10-second reset.',
  note: 'Warm up 2 min: easy shadowbox, slow heels-down squats, 5 step-back sprawls, leg swings. Front-of-knee pain: switch to heels-down squats. Wrist pain: Level-Change Drops.',
  introSay: 'Tutorial stage. Lunge to teep, one-twos, sprawls, Hindu squats.',
  tips: ['Hips down on the sprawl.', 'Heels can stay down on the squat.'],
  guidedHelp: 'The coach sets the pace on every block.',
  paceBasis: 'Coach estimate from the cadence (sprawl 3.0 s, Hindu squat 2.5 s; elite 2.5 / 2.0 s).',
  defaultLevel: 'standard',
  levels: {
    beginner: {
      detail: '3 × 2:00 · 0:20 work, 0:10 reset · step-back sprawls · heels-down squats', minutes: 8, rounds: 3,
      missionLine: '3 ROUNDS · 0:20 BLOCKS · TEEP · ONE-TWO · SPRAWL · SQUAT',
      slots: [t('lunge-to-teep', 20, 10, { swapKey: 'teep' }), t('one-two', 20, 10, { swapKey: 'one-two' }),
        t('step-back-sprawl', 20, 10, { swapKey: 'sprawl' }), t('heels-down-hindu-squat', 20, 60, { swapKey: 'hindu-squat' })],
      pace: { elite: 55, standard: 45, beginner: 40 },
    },
    standard: {
      detail: '3 × 2:00 · four 0:30 blocks', minutes: 8, rounds: 3,
      missionLine: '3 ROUNDS × 2:00 · TEEP · ONE-TWO · SPRAWL · HINDU SQUAT',
      slots: [t('lunge-to-teep', 30, 0, { swapKey: 'teep', cadenceMs: 3000 }), // about 5/5 per 0:30 (verified)
        t('one-two', 30, 0, { swapKey: 'one-two', cadenceMs: 1000 }), // 1.0 s (verified)
        t('sprawl', 30, 0, { swapKey: 'sprawl' }), t('hindu-squat', 30, 60, { swapKey: 'hindu-squat' })],
      pace: { elite: 80, standard: 65, beginner: 50 },
    },
    elite: {
      detail: '3 × 3:00 · adds knee strikes and a one-two burnout', minutes: 11, rounds: 3, difficulty: 'Normal',
      missionLine: '3 ROUNDS × 3:00 · TEEP · ONE-TWO · SPRAWL · SQUAT · KNEES · BURNOUT',
      slots: [t('lunge-to-teep', 30, 0, { swapKey: 'teep' }), t('one-two', 30, 0, { swapKey: 'one-two' }), t('sprawl', 30, 0, { swapKey: 'sprawl' }),
        t('hindu-squat', 30, 0, { swapKey: 'hindu-squat' }), t('knee-strike', 30, 0, { swapKey: 'knee' }),
        t('one-two', 30, 60, { swapKey: 'one-two', name: 'One-Two Burnout', count: false })], // max effort: no pace count
      pace: { elite: 80, standard: 65, beginner: 50 },
    },
  },
};

// ── 10 · TURBO BUTTON ───────────────────────────────────────────────────────
// Windshield Wiper Punches are never counted and never scored.
const turbo = ({ work, rest, sprawlId, pushId, calls }) => [
  ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (i % 2 === 0
    ? t('windshield-wiper-punches', work, rest, { swapKey: 'wipers', calls, prefix: 'BLOCK A' })
    : t(sprawlId, work, i === 7 ? 60 : rest, { swapKey: 'sprawl', prefix: 'BLOCK A' }))),
  ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (i % 2 === 0
    ? t('switch-kick', work, rest, { swapKey: 'kick', prefix: 'BLOCK B' })
    : t(pushId, work, i === 7 ? 0 : rest, { swapKey: 'hindu-push-up', prefix: 'BLOCK B' }))),
];
const TURBO_STD = turbo({ work: 20, rest: 10, sprawlId: 'sprawl', pushId: 'hindu-push-up', calls: W20 });
const TURBO = {
  id: 'turbo_button', launch: 10, title: 'TURBO BUTTON', tag: 'Striking', loadout: 'none', themes: ['striking'], format: 'intervals',
  difficulty: 'Normal', focus: 'Combat', workoutType: 'Bodyweight', hotel: false, quiet: false, guided: true,
  knownAs: 'Tabata-style intervals (20 s on / 10 s off x 8 per 4:00 block)',
  loadoutLine: "NO GEAR · AN ARM'S LENGTH CLEAR EACH SIDE", scoreLine: 'LOWEST SPRAWLS + KICKS + HINDU PUSH-UPS',
  scoreRule: { kind: 'reps', label: 'LOWEST SPRAWLS + KICKS + HINDU PUSH-UPS', keys: ['sprawl', 'kick', 'hindu-push-up'], agg: 'lowest' },
  scale: 'Beginner level: 15 on, 15 off. Smaller wiper sweeps.',
  note: 'Warm up 2 min with 10 leg swings each way per leg; max-speed kicks need warm hips. Wipers: punch through every call. Hamstring or groin twinge on a kick: switch to low kicks. Shoulder pinch or low-back pain on Hindu push-ups: knees down.',
  introSay: 'Turbo button. Two blocks of short bursts. Full speed, hands up.',
  guidedHelp: 'The coach calls the wipers and sets the pace on every burst.',
  paceBasis: 'Coach estimate from the cadence (2.5 s sprawl, kick and Hindu push-up; elite 2.25 / 2.0 / 2.25 s), with a fatigue drop.',
  defaultLevel: 'standard',
  levels: {
    beginner: {
      detail: '2 blocks × 8 × 15/15 · step-back sprawls · knee Hindu push-ups', minutes: 9, rounds: 1,
      missionLine: '2 BLOCKS × 8 × 15/15 · 1:00 BETWEEN',
      slots: turbo({ work: 15, rest: 15, sprawlId: 'step-back-sprawl', pushId: 'knee-hindu-push-up', calls: W15 }),
      pace: { elite: 16, standard: 14, beginner: 12 },
    },
    standard: {
      detail: '2 blocks × 8 × 20/10 · 1:00 between', minutes: 9, rounds: 1,
      missionLine: '2 BLOCKS × 8 × 20/10 · 1:00 BETWEEN',
      slots: TURBO_STD, pace: { elite: 25, standard: 20, beginner: 15 },
    },
    elite: {
      detail: '2 blocks × 8 × 20/10 · elite count', minutes: 9, rounds: 1,
      missionLine: '2 BLOCKS × 8 × 20/10 · 1:00 BETWEEN',
      slots: TURBO_STD, pace: { elite: 25, standard: 20, beginner: 15 },
    },
  },
};

// ── 11 · QUOTA 300 ──────────────────────────────────────────────────────────
// Tuck-jump burpees (maxTotalReps 100) are offered only at ROOKIE 90. The
// FULL 300 detail tells the athlete to hold CONTENDER first; nothing enforces it.
const QUOTA = {
  id: 'quota_300', launch: 11, title: 'QUOTA 300', tag: 'Burpees', loadout: 'none', themes: ['burpees'], format: 'emom',
  difficulty: 'Brutal', focus: 'Full Body', workoutType: 'Bodyweight', hotel: false, quiet: false, guided: true,
  knownAs: 'Burpee EMOM (10 burpees every minute)',
  loadoutLine: 'NO GEAR · 2 × 1 M OF FLOOR', scoreLine: 'MINUTES HELD', scoreRule: { kind: 'minutesHeld' },
  scale: 'Lower the count (6, 7 or 8 a minute) before you shorten the clock. Miss two minutes? Drop to 7 a minute. Step-back burpees for knees or a quiet floor.',
  note: 'Chest and thighs to the floor, full hip extension, a small jump with an overhead clap. Dizziness, chest pain or sharp pain ends the run, and the score stands. Build up: ROOKIE 90, then CONTENDER 150, then the full 300.',
  introSay: 'Quota. Every minute, on the minute.',
  guidedHelp: 'The coach counts every burpee and starts each minute.',
  paceBasis: 'Coach estimate. 10 burpees a minute is about 56% of the one-hour world-record pace.',
  defaultLevel: 'standard',
  levels: {
    beginner: {
      detail: 'ROOKIE 90 · 6 a minute for 15 min', minutes: 15, rounds: 15, difficulty: 'Hard',
      missionLine: 'EMOM 15 · 6 BURPEES EVERY MINUTE · 90',
      slots: [r('burpee', 6, 0, { swapKey: 'burpee', window: 60, prefix: 'EVERY MIN', cadenceMs: 4000 })],
      pace: { elite: { held: 15, of: 15, setSec: 15 }, standard: { held: 15, of: 15, setSec: 20 }, beginner: { held: 15, of: 15, setSec: 30 } },
    },
    standard: {
      detail: 'CONTENDER 150 · 10 a minute for 15 min', minutes: 15, rounds: 15, difficulty: 'Hard',
      missionLine: 'EMOM 15 · 10 BURPEES EVERY MINUTE · 150',
      slots: [r('burpee', 10, 0, { swapKey: 'burpee', window: 60, prefix: 'EVERY MIN' })],
      pace: { elite: { held: 15, of: 15, setSec: 25 }, standard: { held: 15, of: 15, setSec: 35 }, beginner: { held: 12, of: 15, setSec: null } },
    },
    elite: {
      detail: 'FULL 300 · 30 min · after you hold CONTENDER 150', minutes: 30, rounds: 30,
      missionLine: 'EMOM 30 · 10 BURPEES EVERY MINUTE · 300',
      slots: [r('burpee', 10, 0, { swapKey: 'burpee', window: 60, prefix: 'EVERY MIN' })],
      pace: { elite: { held: 30, of: 30, setSec: 25 }, standard: { held: 15, of: 30, setSec: null }, beginner: { held: 10, of: 30, setSec: null } },
    },
  },
};

export const LOADOUT_MISSIONS = [IRON_CLOCK, ONE_BELL, FIVE_ROUND, BEST_OF_3, STEEL, CHECKPOINT, ROOM_12, HIT_COMBO, TUTORIAL, TURBO, QUOTA];

// Test-only: fixture defs (a box move, a flying knee) the unit tests build.
// Never on the shelf.
const TEST_DEFS = new Map();
export function _registerTestMissionDefs(defs) { (defs || []).forEach(d => TEST_DEFS.set(d.id, d)); }

// ── defs, gear, safety ──────────────────────────────────────────────────────
export function missionDefById(id) { return LOADOUT_MISSIONS.find(d => d.id === id) || TEST_DEFS.get(id) || null; }
export function levelsOf(def) {
  return LEVELS.filter(l => def?.levels?.[l]).map(l => ({ id: l, label: LEVEL_LABEL[l], detail: def.levels[l].detail }));
}
// What the viewer has with them. A phone that never set its gear is treated
// as having none (not loadEquipment's "you own everything"), so a hotel-room
// viewer is never offered heavy-bag alts.
export function gearProfile() {
  let raw = null;
  try { raw = localStorage.getItem('tm_equipment'); } catch { return new Set(['none']); }
  const out = new Set(['none']);
  if (raw == null) return out;
  if (loadEquipment().has('HEAVY_BAG')) out.add('bag');
  return out;
}
export function allowedGear(loadout, profile) {
  return new Set([...(LOADOUT_GEAR[loadout] || ['none']), ...(profile || [])]);
}

const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
const hasList = (slot) => Array.isArray(slot?.list);
const SLOT_KEYS = ['name', 'moveId', 'baseMoveId', 'defaultMoveId', 'swapKey', 'mode', 'reps', 'work', 'rest', 'window', 'cadenceMs', 'setupMs',
  'unit', 'sides', 'list', 'calls', 'prefix', 'say', 'sayLead', 'sideSay', 'note', 'count', 'scaled'];
const STEP_KEYS = ['name', 'moveId', 'baseMoveId', 'defaultMoveId', 'swapKey', 'reps', 'unit', 'sides', 'cadenceMs', 'say', 'note', 'noteIf', 'scaled'];
// Only the fields a Slot / Step has, in one order, with no undefined noise.
const pick = (src, keys) => {
  const o = {};
  keys.forEach(k => { if (src[k] !== undefined && src[k] !== null) o[k] = src[k]; else if (k === 'cadenceMs' && src[k] === null) o[k] = null; });
  return o;
};
const countCol = (def, level) => def?.countAt?.[level] || level;

// One authored slot or step at its base move, filled from the catalog.
function baseStep(d, col, amrapStep) {
  const move = moveById(d.moveId);
  return pick({
    ...clone(d),
    name: d.name || move?.name || d.moveId,
    baseMoveId: d.moveId, defaultMoveId: d.moveId,
    unit: move?.unit === 'cal' ? 'CAL' : undefined,
    sides: amrapStep && d.sides !== null ? (d.sides || move?.sides) : undefined, // complex steps never carry sides
    cadenceMs: 'cadenceMs' in d ? d.cadenceMs : cadenceFor(d.moveId, col),
  }, STEP_KEYS);
}
function baseSlot(d, col) {
  if (hasList(d)) {
    const timed = d.mode === 'timed';
    const list = d.list.map(st => baseStep(st, col, timed));
    return pick({ ...clone(d), list, reps: timed ? undefined : list.reduce((n, st) => n + (st.reps || 0), 0) }, SLOT_KEYS);
  }
  const move = moveById(d.moveId);
  return pick({
    ...clone(d),
    name: d.name || move?.name || d.moveId,
    baseMoveId: d.moveId, defaultMoveId: d.moveId,
    cadenceMs: 'cadenceMs' in d ? d.cadenceMs : cadenceFor(d.moveId, col),
    unit: d.mode === 'reps' && move?.unit === 'cal' ? 'CAL' : undefined,
    sides: d.sides === null ? undefined : (d.sides || move?.sides),
  }, SLOT_KEYS);
}
function baseSlots(def, level) {
  const col = countCol(def, level);
  return (def?.levels?.[level]?.slots || []).map(d => baseSlot(d, col));
}
// The authored base slots of a built mission (or its own slots, for a mission
// with no def).
function baseOf(mission) {
  const def = missionDefById(mission?.id);
  const base = def ? baseSlots(def, mission.level) : null;
  return base && base.length === (mission?.exercises || []).length ? base : (mission?.exercises || []);
}
// Every slot/step that carries swapKey (a list slot's own key never counts).
function keyItems(mission, swapKey) {
  const out = [];
  (mission?.exercises || []).forEach(slot => {
    if (hasList(slot)) slot.list.forEach(st => { if (st.swapKey === swapKey) out.push(st); });
    else if (slot.swapKey === swapKey) out.push(slot);
  });
  return out;
}
const allItems = (mission) => (mission?.exercises || []).flatMap(slot => (hasList(slot) ? slot.list : [slot]));

// Reps × x, with anything from 25 up rounded to the nearest 5.
const scaleReps = (reps, x = 1) => {
  const n = Math.max(1, Math.round((reps || 0) * x));
  return n >= 25 ? Math.round(n / 5) * 5 : n;
};
const round5 = (n) => Math.round(n / 5) * 5;

// The reps a key would ask for with moveId in it (volume safety). `x` is the
// count multiplier from the base (default 1).
export function totalRepsForKey(mission, swapKey, moveId, x = 1) {
  const n = mission?.rounds || 1;
  const amrapRounds = typeof mission?.pace?.elite === 'number' ? mission.pace.elite : n;
  let total = 0;
  baseOf(mission).forEach(slot => {
    if (hasList(slot)) {
      slot.list.forEach(st => { if (st.swapKey === swapKey) total += scaleReps(st.reps, x) * (slot.mode === 'timed' ? amrapRounds : n); });
      return;
    }
    if (slot.swapKey !== swapKey) return;
    if (slot.mode === 'timed') total += Math.floor(((slot.work || 0) * 1000) / estMsFor(moveId, mission.level)) * n;
    else total += scaleReps(slot.reps, x) * n;
  });
  return total;
}
// The safety and gear filters every swap goes through. alt = { id, x? }; x is
// read as the count multiplier from the base.
export function altAllowed(mission, swapKey, alt, { gear = gearProfile() } = {}) {
  const move = moveById(alt?.id);
  if (!mission || !move) return false;
  if (!allowedGear(mission.loadout, gear).has(move.gear)) return false;                        // 1 · gear
  const others = allItems(mission).filter(it => it.swapKey !== swapKey);
  if (others.some(it => it.moveId === alt.id)) return false;                                   // 2 · not another row's move
  // DROP-A NOTE: rule 3 reads the AUTHORED slot mode, so a shadowbox minute swapped to row calories can still swap back.
  if (move.timedOnly) {                                                                        // 3 · timed-only: plain timed slots
    const base = baseOf(mission);
    const plain = base.filter(sl => !hasList(sl) && sl.swapKey === swapKey);
    const inList = base.some(sl => hasList(sl) && sl.list.some(st => st.swapKey === swapKey));
    if (inList || !plain.length || plain.some(sl => sl.mode !== 'timed')) return false;
  }
  if (mission.level === 'beginner' && move.flyingKnee) return false;                           // 4 · no flying knees for beginners
  // DROP-A NOTE: rule 5 looks at the OTHER keys, so swapping a flying knee itself onto a jump move stays possible.
  if (move.jumps && others.some(it => moveById(it.moveId)?.flyingKnee)) return false;          // 5 · landing budget
  if (move.jumps && mission.quiet) return false;                                               // 6 · quiet room
  if ((mission.excludeAlts || []).includes(alt.id)) return false;                              // 7 · level exclusions
  if (move.maxTotalReps != null && totalRepsForKey(mission, swapKey, alt.id, alt.x ?? 1) > move.maxTotalReps) return false; // 8 · volume
  return true;
}
// Every move the key can hold: breadth-first from the base over the authored
// alts. x = the product of alt.x along the first (shortest) path.
export function reachableMoves(mission, swapKey, { gear = gearProfile() } = {}) {
  return walkAlts(mission, swapKey, (alt) => altAllowed(mission, swapKey, alt, { gear }));
}
function walkAlts(mission, swapKey, allow) {
  const out = new Map();
  const first = keyItems(mission, swapKey)[0];
  if (!first) return out;
  out.set(first.baseMoveId, { x: 1 });
  const queue = [first.baseMoveId];
  while (queue.length) {
    const id = queue.shift();
    const { x } = out.get(id);
    (moveById(id)?.alts || []).forEach(alt => {
      if (out.has(alt.id)) return;
      const ax = x * (alt.x ?? 1);
      if (!allow({ ...alt, x: ax })) return;
      out.set(alt.id, { x: ax });
      queue.push(alt.id);
    });
  }
  return out;
}
export function isSwapAllowed(mission, swapKey, moveId, { gear = gearProfile() } = {}) {
  const first = keyItems(mission, swapKey)[0];
  if (!first || !moveById(moveId)) return false;
  return moveId === first.baseMoveId || moveId === first.defaultMoveId || reachableMoves(mission, swapKey, { gear }).has(moveId);
}

// ── build and swap ──────────────────────────────────────────────────────────
// The built mission for one level, gear defaults and the user's swaps applied.
// null for an unknown id or a level the def does not have.
export function buildLoadoutMission(id, { level, swaps = {}, gear = gearProfile() } = {}) {
  const def = missionDefById(id);
  if (!def) return null;
  const lv = level || def.defaultLevel;
  const L = def.levels?.[lv];
  if (!L) return null;
  let m = {
    title: def.title,
    workoutType: def.workoutType,
    duration: L.minutes,
    difficulty: L.difficulty || def.difficulty,
    focus: def.focus,
    format: def.format,
    exercises: baseSlots(def, lv),
    finisherExercises: [],
    rounds: L.rounds,
    cardioFinisher: false,
    named: def.id,
    v2: true,
    id: def.id,
    level: lv,
    levelLabel: LEVEL_LABEL[lv],
    levelDetail: L.detail,
    load: L.load || null,
    capSec: L.capSec || 0,
    clockSec: 0,
    loadout: def.loadout,
    themes: [...(def.themes || [])],
    scoreRule: clone(def.scoreRule),
    pace: clone(L.pace),
    paceBasis: def.paceBasis,
    hotel: !!def.hotel,
    quiet: !!def.quiet,
    guided: !!def.guided,
    guidedHelp: def.guidedHelp || '',
    knownAs: def.knownAs || '',
    tag: def.tag,
    loadoutLine: L.loadoutLine || def.loadoutLine,
    missionLine: L.missionLine || def.missionLine || '',
    scoreLine: def.scoreLine,
    scale: def.scale,
    note: def.note,
    introSay: def.introSay || '',
    tips: [...(def.tips || [])],
    excludeAlts: [...(L.excludeAlts || [])],
    scaled: false,
    swaps: [],
    gearBanner: null,
  };
  m = resolveNotes(m);
  m.exercises = m.exercises.map(slot => (slot.window ? { ...slot, rest: windowRest(slot, estimateWorkSeconds(slot)) } : slot));
  m.clockSec = missionClockSec(m);

  // Gear defaults: a base move whose gear the viewer lacks opens on its first
  // allowed alt (a NO GEAR one first). The card shows a banner, not SCALED.
  const allowed = allowedGear(def.loadout, gear);
  rowItems(m).forEach(({ item }) => {
    const base = moveById(item.baseMoveId);
    if (!base || allowed.has(base.gear)) return;
    const ok = base.alts.filter(a => altAllowed(m, item.swapKey, a, { gear }));
    const alt = ok.find(a => a.kind === 'no-gear') || ok[0];
    if (!alt) return;
    m = withDefault(m, item.swapKey, alt.id);
    m = swapMissionMove(m, item.swapKey, alt.id, { gear });
    if (!m.gearBanner) m.gearBanner = `No ${GEAR_WORD[base.gear] || base.gear} in your gear. Using ${moveById(alt.id).name}. Tap the swap icon to change.`;
  });

  // The user's picks, in card order. Invalid ones (say, after a level change) drop silently.
  rowItems(m).forEach(({ item }) => {
    const to = swaps?.[item.swapKey];
    if (typeof to !== 'string' || to === item.moveId) return;
    if (isSwapAllowed(m, item.swapKey, to, { gear })) m = swapMissionMove(m, item.swapKey, to, { gear });
  });
  return m;
}
function withDefault(mission, swapKey, moveId) {
  const set = (it) => (it.swapKey === swapKey ? { ...it, defaultMoveId: moveId } : it);
  return { ...mission, exercises: mission.exercises.map(slot => (hasList(slot) ? { ...slot, list: slot.list.map(set) } : set(slot))) };
}

// One slot/step rebuilt from its authored base onto `toId`.
function convert(b, toId, { x, col, level, step, amrapStep, defaultMoveId }) {
  const keys = step ? STEP_KEYS : SLOT_KEYS;
  if (toId === b.moveId) return pick({ ...clone(b), defaultMoveId }, keys);
  const to = moveById(toId);
  const out = { ...clone(b), name: to.name, moveId: toId, defaultMoveId, say: undefined, scaled: true };
  const baseTimed = !step && b.mode === 'timed';
  if (!baseTimed) {
    if (to.timedOnly && !step) {
      out.mode = 'timed';
      out.work = Math.max(10, round5((b.reps * estMsFor(b.moveId, level)) / 1000));
      out.reps = undefined;
    } else {
      out.reps = scaleReps(b.reps, x);
    }
  } else if (to.repsOnly) {
    out.mode = 'reps';
    out.reps = Math.max(1, Math.round((b.work * 1000) / estMsFor(toId)));
    out.work = undefined;
  }
  out.unit = (step || out.mode === 'reps') && to.unit === 'cal' ? 'CAL' : undefined;
  out.cadenceMs = cadenceFor(toId, col); // an authored cadenceMs belongs to the base move only
  if (out.calls && !to.callsOk) out.calls = undefined;
  out.sides = !step || amrapStep ? to.sides : undefined; // complex steps never carry sides
  return pick(out, keys);
}

// A NEW mission with every slot/step of swapKey rebuilt from its authored base
// onto moveId. The input is not changed. `gear` (optional, default the stored
// profile) only picks the count multiplier's path; an authored `say` belongs to
// the base move and is dropped on a swap, setupMs and count: false stay.
export function swapMissionMove(mission, swapKey, moveId, { gear = gearProfile() } = {}) {
  const def = missionDefById(mission?.id);
  if (!def || !moveById(moveId)) return mission;
  const base = baseSlots(def, mission.level);
  if (base.length !== mission.exercises.length) return mission;
  const col = countCol(def, mission.level);
  const x = reachableMoves(mission, swapKey, { gear }).get(moveId)?.x
    ?? walkAlts(mission, swapKey, () => true).get(moveId)?.x ?? 1;
  const opts = { x, col, level: mission.level };

  const exercises = mission.exercises.map((slot, i) => {
    const b = base[i];
    if (hasList(slot)) {
      if (!slot.list.some(st => st.swapKey === swapKey)) return clone(slot);
      const amrapStep = slot.mode === 'timed';
      const list = slot.list.map((st, j) => (st.swapKey === swapKey && b.list?.[j]
        ? convert(b.list[j], moveId, { ...opts, step: true, amrapStep, defaultMoveId: st.defaultMoveId })
        : clone(st)));
      const out = { ...clone(slot), list };
      if (!amrapStep) out.reps = list.reduce((n, st) => n + (st.reps || 0), 0);
      if (out.window) out.rest = windowRest(out, estimateWorkSeconds(out));
      return pick(out, SLOT_KEYS);
    }
    if (slot.swapKey !== swapKey) return clone(slot);
    const out = convert(b, moveId, { ...opts, step: false, defaultMoveId: slot.defaultMoveId });
    if (out.window) out.rest = windowRest(out, estimateWorkSeconds(out));
    return out;
  });

  let next = resolveNotes({ ...mission, exercises });
  const first = keyItems(next, swapKey)[0];
  const swaps = (mission.swaps || []).map(e => ({ ...e }));
  const at = swaps.findIndex(e => e.swapKey === swapKey);
  const entry = first && moveId !== first.baseMoveId
    ? { swapKey, from: first.baseMoveId, to: moveId, ...(moveId === first.defaultMoveId ? { auto: true } : {}) }
    : null;
  if (at >= 0) { if (entry) swaps[at] = entry; else swaps.splice(at, 1); } else if (entry) swaps.push(entry);
  next = { ...next, swaps, scaled: allItems(next).some(it => it.moveId !== it.baseMoveId) };
  next.clockSec = missionClockSec(next);
  return next;
}
// Step notes that follow another key's current move (21-HIT's bar transitions).
export function resolveNotes(mission) {
  const current = (key) => allItems(mission).find(it => it.swapKey === key)?.moveId;
  const fix = (st) => {
    if (!st.noteIf) return st;
    const note = current(st.noteIf.key) === st.noteIf.is ? st.noteIf.then : st.noteIf.else;
    const out = { ...st };
    if (note) out.note = note; else delete out.note;
    return pick(out, STEP_KEYS);
  };
  return { ...mission, exercises: (mission?.exercises || []).map(slot => (hasList(slot) ? { ...slot, list: slot.list.map(fix) } : slot)) };
}
// What the swap sheet lists: the CURRENT move's authored alts that pass the
// filters, stop-rule alts first, max 4.
export function swapOptions(mission, swapKey, { gear = gearProfile() } = {}) {
  const first = keyItems(mission, swapKey)[0];
  const current = moveById(first?.moveId);
  if (!first || !current) return [];
  const reach = reachableMoves(mission, swapKey, { gear });
  const curX = reach.get(first.moveId)?.x ?? 1;
  const ok = current.alts.filter(a => a.id !== first.moveId && altAllowed(mission, swapKey, { ...a, x: curX * (a.x ?? 1) }, { gear }));
  const ordered = [...ok.filter(a => a.stop), ...ok.filter(a => !a.stop)].slice(0, 4);
  const doseFrom = slotDose(first);
  return ordered.map(a => {
    const move = moveById(a.id);
    const after = swapMissionMove(mission, swapKey, a.id, { gear });
    return {
      id: a.id, name: move.name, kind: a.kind, label: ALT_LABEL[a.kind], gear: move.gear, gearLabel: GEAR_LABEL[move.gear],
      doseFrom, doseTo: slotDose(keyItems(after, swapKey)[0]), ...(a.stop ? { stop: a.stop } : {}), cues: [...move.cues],
    };
  });
}

// ── the card ────────────────────────────────────────────────────────────────
export function cardRows(mission, { gear = gearProfile() } = {}) {
  return rowItems(mission).map(({ item, parent }, i) => {
    let dose = slotDose(item);
    if (!parent) {
      const occ = (mission.exercises || []).filter(sl => !hasList(sl) && sl.swapKey === item.swapKey).map(slotDose);
      if (occ.length > 1 && occ.every(d => d === occ[0])) dose = `${occ.length} × ${occ[0]}`;
    }
    const swapped = item.moveId !== item.baseMoveId;
    return {
      swapKey: item.swapKey,
      num: i + 1,
      prefix: parent ? null : item.prefix || null,
      name: item.name,
      dose,
      load: null,
      note: item.note || null,
      moveId: item.moveId,
      baseMoveId: item.baseMoveId,
      defaultMoveId: item.defaultMoveId,
      baseName: moveById(item.baseMoveId)?.name || item.name,
      swapped,
      undoable: item.moveId !== item.defaultMoveId,
      canSwap: swapped || swapOptions(mission, item.swapKey, { gear }).length > 0,
    };
  });
}
const themeLabel = (id) => THEMES.find(th => th.id === id && id !== 'all')?.label || null;
const loadoutLabel = (id) => LOADOUTS.find(l => l.id === id)?.label || String(id || '').toUpperCase();
export function missionCardModel(mission, { gear = gearProfile() } = {}) {
  const tags = [`~${mission.duration} MIN`, String(mission.difficulty || '').toUpperCase()];
  if (mission.hotel) tags.push('HOTEL OK');
  if (mission.quiet) tags.push('QUIET');
  if (mission.scaled) tags.push('SCALED');
  if (!mission.guided) tags.push('SOLO ONLY');
  return {
    eyebrow: `Mission · ${mission.tag}`,
    title: mission.title,
    tags,
    accentTag: themeLabel(mission.themes?.[0]),
    loadoutLine: mission.loadoutLine,
    missionLine: mission.missionLine,
    scoreLine: mission.scoreLine,
    rows: cardRows(mission, { gear }),
    scale: mission.scale,
    note: mission.note,
    banner: mission.gearBanner || null,
    soloOnly: !mission.guided,
    guidedHelp: mission.guidedHelp || '',
  };
}

// ── the shelf and prefs ─────────────────────────────────────────────────────
export function classicMeta(namedWorkout) {
  const tag = CLASSIC_TAGS[namedWorkout?.id] || {};
  const loadout = namedWorkout?.loadout || tag.loadout || 'none';
  const themes = [...(namedWorkout?.themes || tag.themes || [])];
  return { loadout, loadoutLabel: loadoutLabel(loadout), themes, accentTag: themeLabel(themes[0]) };
}
// v2 missions first (launch order), then the 17 classics in their order.
export function shelfEntries() {
  const v2 = [...LOADOUT_MISSIONS].sort((a, b) => a.launch - b.launch).map(d => ({
    id: d.id, kind: 'v2', title: d.title, loadout: d.loadout, themes: [...d.themes], pro: false, soloOnly: !d.guided,
  }));
  const classics = NAMED_WORKOUTS.map(w => {
    const meta = classicMeta(w);
    return { id: w.id, kind: 'classic', title: w.title, loadout: meta.loadout, themes: meta.themes, pro: !!w.pro, soloOnly: false };
  });
  return [...v2, ...classics];
}
export function filterShelf(entries, { loadout = 'all', theme = 'all' } = {}) {
  return (entries || []).filter(e => (loadout === 'all' || e.loadout === loadout) && (theme === 'all' || (e.themes || []).includes(theme)));
}
export function themeCounts(entries, loadout = 'all') {
  const within = filterShelf(entries, { loadout });
  const out = {};
  THEMES.forEach(th => { out[th.id] = filterShelf(within, { theme: th.id }).length; });
  return out;
}
export function emptyShelfCopy({ loadout = 'all', theme = 'all' } = {}) {
  const lo = loadoutLabel(loadout);
  if (theme !== 'all') {
    const th = (themeLabel(theme) || String(theme)).toLowerCase();
    // DROP-A NOTE: no SHOW NO GEAR button when NO GEAR is already the loadout (it would do nothing; never empty in Drop A).
    return { text: `No ${th} missions for ${lo} yet.`, action: loadout === 'none' ? null : { label: 'SHOW NO GEAR', loadout: 'none' } };
  }
  return { text: `No ${lo} missions yet. Try MIXED, or SURPRISE ME for a no-gear mission.`, action: null };
}

export const SHELF_PREFS_KEY = 'tm_qm_shelf_v1';
const PREF_DEFAULTS = { loadout: 'all', theme: 'all', mode: 'guided', levels: {} };
function cleanPrefs(p) {
  const levels = {};
  Object.entries(p?.levels && typeof p.levels === 'object' ? p.levels : {}).forEach(([id, l]) => { if (LEVELS.includes(l)) levels[id] = l; });
  return {
    loadout: LOADOUTS.some(l => l.id === p?.loadout) ? p.loadout : PREF_DEFAULTS.loadout,
    theme: THEMES.some(th => th.id === p?.theme) ? p.theme : PREF_DEFAULTS.theme,
    mode: p?.mode === 'solo' || p?.mode === 'guided' ? p.mode : PREF_DEFAULTS.mode,
    levels,
  };
}
export function loadShelfPrefs() {
  try {
    const raw = localStorage.getItem(SHELF_PREFS_KEY);
    return cleanPrefs(raw ? JSON.parse(raw) : null);
  } catch { return cleanPrefs(null); }
}
export function saveShelfPrefs(patch = {}) {
  const cur = loadShelfPrefs();
  const next = cleanPrefs({ ...cur, ...patch, levels: { ...cur.levels, ...(patch?.levels || {}) } });
  try { localStorage.setItem(SHELF_PREFS_KEY, JSON.stringify(next)); } catch { /* storage full or blocked */ }
  return next;
}

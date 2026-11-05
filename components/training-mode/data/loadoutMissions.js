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
// from the source; the other eight launch missions are coach estimates (see
// each paceBasis). Missions 12-26 are SOLO only for now (see their block);
// 27-30 are the owner's own, GUIDED and SOLO, and 31 (OVERTIME 20) is a
// verified catalog mission, GUIDED and SOLO. `knownAs` is stored, never
// rendered; `origin` marks a Coach TM original.
import {
  LEVELS, LEVEL_LABEL, GEAR_LABEL, GEAR_WORD, ALT_LABEL,
  moveById, cadenceFor, estMsFor, slotDose, windowRest, rowItems, regionOf, maxStopLine,
} from './missionMoves';
import { NAMED_WORKOUTS, CLASSIC_TAGS } from './namedWorkouts';
import { loadEquipment } from './equipmentProfile';
import { missionClockSec, estimateWorkSeconds, isMaxReps } from './missionSolo';

export const LOADOUTS = [
  { id: 'all', label: 'ALL' }, { id: 'none', label: 'NO GEAR' }, { id: 'bell', label: '1 BELL / DB' },
  { id: 'barbell', label: 'BARBELL' }, { id: 'mixed', label: 'MIXED' },
];
export const THEMES = [
  { id: 'all', label: 'ALL', help: 'Every mission for this loadout.' },
  { id: 'striking', label: 'STRIKING', help: 'Fight-round clocks, strikes and sprawls. No bag needed.' },
  { id: 'burpees', label: 'BURPEES', help: 'Burpee missions, up to 300 reps.' },
  { id: 'century', label: 'CENTURY', help: 'High-rep missions, 100 to 300 reps.' },
  { id: 'maxout', label: 'MAX OUT', help: 'Max reps on a move, then switch.' },
];
export const LOADOUT_GEAR = {
  none: ['none'],
  bell: ['none', 'bell', 'db', 'rower'],          // rower: CHECKPOINT 20's optional minute-4 swap
  barbell: ['none', 'barbell', 'plate'],
  mixed: ['none', 'bell', 'db', 'barbell', 'plate', 'rower', 'bar'], // bar: OXYGEN DEBT's and HOT LAPS' pull-ups
};
// maxSets: NO CONTINUES, sets until the bell touches the floor; maxRounds:
// UPPER LOWER DIPS, rounds until one can't be finished (both untilDown);
// maxReps: MAX OUT, one set of max clean reps at each station, round after round.
export const FORMAT_LABEL = { emom: 'EMOM', amrap: 'AMRAP', forTime: 'FOR TIME', intervals: 'INTERVALS', maxSets: 'MAX SETS', maxRounds: 'MAX ROUNDS', maxReps: 'MAX REPS' };
// The format word a viewer reads: a mission's own (TOUCH THE SKY runs the
// for-time clock but is not a race: COMPLEX), else its format's.
export function formatLabelOf(m) { return m?.formatLabel || FORMAT_LABEL[m?.format] || ''; }
export const GUIDED_HELP_AMRAP = 'The coach runs the clock and calls the time. The moves stay on screen.';
// How START runs a mission: GUIDED, or AT YOUR PACE (stored and routed as
// 'solo': saved sessions, resume stashes and analytics keep that word). The
// words the first page, ADJUST and the run screen print.
export const RUN_MODES = [{ id: 'guided', label: 'GUIDED' }, { id: 'solo', label: 'AT YOUR PACE' }];
export const GUIDED_HELP = 'The coach calls every move and keeps time.';
export const SOLO_HELP = 'The moves and a timer. Beeps, no coach voice.';
export const SOLO_ONLY_HELP = 'Only at your pace for now. Guided is coming.';
// A named classic (Murph, Sally Up, 5 Minutes of Hell…) is built around the coach's calls.
export const CLASSIC_HELP = 'This classic runs with the coach.';

// ── authoring helpers ───────────────────────────────────────────────────────
// r: reps slot · t: timed slot · amrap: timed list (an AMRAP block) ·
// complex: reps list · s: list step. `extra` carries swapKey (required),
// window, prefix, calls, name, cadenceMs, setupMs, say, sideSay, note,
// noteIf, sides (null removes the catalog's), count and scored.
// A level can override loadoutLine, missionLine, scoreLine and scoreRule.
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
  guidedHelp: '', // at your pace only; the card shows SOLO_ONLY_HELP
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

// ── 12-26 · SOLO only for now (guided is coming) ───────────────────────────
// The researched barbell, bell and mixed missions (missions/data2.json, with
// catalog.json behind it), shipped the way 21-HIT COMBO is: guided: false,
// and the card shows SOLO_ONLY_HELP. Tiers follow the rule above: Rx is
// ELITE, Scaled STANDARD, the source's beginner option BEGINNER. A pace is a
// coach estimate unless its paceBasis names a published range. Where SOLO
// needed a different shape than the source's, the comment says so.
const SOLO_COPY = { introSay: '', guidedHelp: '' }; // at your pace only; the card shows SOLO_ONLY_HELP
// A ladder (a for-time workout whose rungs differ): one complex per rung, so
// SOLO's ROUND tap counts rungs and a capped run prefills the reps through them.
const rungs = (counts, steps) => counts.map((n, i) => complex(`Rung ${i + 1}`, steps(n, i), { swapKey: 'rung' }));
// A step note that holds only for the row's base move: a swap clears it.
const baseNote = (key, moveId, then) => ({ noteIf: { key, is: moveId, then, else: null } });

// ── 12 · HONOR ROUNDS ───────────────────────────────────────────────────────
// A hero tribute workout, kept as written. Its 1 BELL / DB version is an
// AMRAP 10, a format of its own, so it rides in `scale` rather than as a
// level. BEGINNER opens on the source's technique-safe lifts (hang muscle
// cleans, push presses): don't learn a clean or a jerk under a clock.
// Pace: each published range is one athlete level at its own load, so the
// tiers are set per level and never get faster as the bar gets heavier.
const honor = (cleanId, jerkId) => [
  r('bb-deadlift', 12, 0, { swapKey: 'deadlift' }), r(cleanId, 9, 0, { swapKey: 'clean' }), r(jerkId, 6, 0, { swapKey: 'jerk' }),
];
const HONOR = {
  id: 'honor_rounds', launch: 12, title: 'HONOR ROUNDS', tag: 'Barbell', loadout: 'barbell', themes: [], format: 'forTime',
  difficulty: 'Hard', focus: 'Full Body', workoutType: 'Weighted', hotel: false, quiet: false, guided: false,
  knownAs: 'DT (CrossFit Hero WOD honoring USAF SSgt Timothy P. Davis)',
  loadoutLine: '1 BARBELL + BUMPER PLATES', scoreLine: 'TIME, OR REPS AT THE CAP (135 FINISHES)', scoreRule: { kind: 'time' },
  scale: 'Lighter bar, or the beginner level. No barbell? The 1 BELL / DB version: 2 easy rounds at half reps, then AMRAP 10 of 12 deadlifts, 9 hang power cleans and 6 shoulder-to-overheads with 2 × 22.5/15 kg (50/35 lb) dumbbells, for 5+ rounds. Lighter: 2 × 15/10 kg (35/20 lb), or one 16/12 kg (35/26 lb) bell. Beginner: AMRAP 8 of 8-6-4 with 2 × 7.5/5 kg (15/10 lb), strict press. Clean not learned yet? A hammer curl to the shoulder.',
  note: 'A tribute workout. Warm up 5 min, then 2 empty-bar rounds of 6 / 4 / 2, then build to the working bar. Back rounding on the deadlifts? Go lighter, not faster, and drop the bar between moves rather than grind. Shoulder pain? Drop the overhead: 12 deadlifts + 9 hang cleans. Never been coached on the clean or the jerk? Hang Muscle Cleans and Push Press.',
  ...SOLO_COPY,
  paceBasis: 'Published: elite under 5 min and advanced athletes 6-9 at 70/47.5 kg; intermediates 10-14 at 43/29 kg. Each range is one athlete level at its own load. The rest are coach estimates.',
  defaultLevel: 'standard',
  levels: {
    beginner: {
      detail: '3 rounds · empty bar · hang muscle cleans · push presses', minutes: 6, load: '20/15 kg empty bar', rounds: 3, capSec: 1200,
      missionLine: '3 ROUNDS FOR TIME · 12 DEADLIFTS · 9 HANG MUSCLE CLEANS · 6 PUSH PRESSES · CAP 20:00',
      scoreLine: 'TIME, OR REPS AT THE CAP (81 FINISHES)',
      slots: honor('bb-hang-muscle-clean', 'bb-push-press'), pace: { elite: 180, standard: 360, beginner: 600 },
    },
    standard: {
      detail: '5 rounds · 43/29 kg · cap 20:00', minutes: 8, load: '43/29 kg (95/65 lb)', rounds: 5, capSec: 1200,
      missionLine: '5 ROUNDS FOR TIME · 12 DEADLIFTS · 9 HANG POWER CLEANS · 6 PUSH JERKS · CAP 20:00',
      slots: honor('bb-hang-power-clean', 'bb-push-jerk'), pace: { elite: 210, standard: 450, beginner: 720 },
    },
    elite: {
      detail: '5 rounds · 70/47.5 kg · cap 20:00', minutes: 9, load: '70/47.5 kg (155/105 lb)', rounds: 5, capSec: 1200,
      missionLine: '5 ROUNDS FOR TIME · 12 DEADLIFTS · 9 HANG POWER CLEANS · 6 PUSH JERKS · CAP 20:00',
      slots: honor('bb-hang-power-clean', 'bb-push-jerk'), pace: { elite: 300, standard: 540, beginner: 840 },
    },
  },
};

// ── 13 · KO SPRINT 30 ───────────────────────────────────────────────────────
// The source's technique-first version is 'recommended for anyone without
// coaching', so BEGINNER opens on its Hang Power Clean + Push Press singles
// (the full clean and jerk is the HARDER swap), and they are the EASIER swap
// at the other levels. Its EMOM 10 × 3 with the empty bar is a clock of its
// own, so it is in the note.
const koSprint = (moveId = 'bb-clean-jerk') => [r(moveId, 30, 0, { swapKey: 'clean-jerk' })];
const KO_SPRINT = {
  id: 'ko_sprint_30', launch: 13, title: 'KO SPRINT 30', tag: 'Barbell', loadout: 'barbell', themes: [], format: 'forTime',
  difficulty: 'Hard', focus: 'Full Body', workoutType: 'Weighted', hotel: false, quiet: false, guided: false,
  knownAs: "Grace (CrossFit 'Girl' benchmark; credit line / captions only)",
  loadoutLine: '1 BARBELL + BUMPER PLATES', scoreLine: 'TIME, OR REPS AT THE CAP', scoreRule: { kind: 'time' },
  scale: 'Pick a bar you can finish in 3-6 min: a lighter bar, or the beginner level. Hotel gym: 30 alternating single-dumbbell clean and jerks.',
  note: 'Warm up 8-10 min, with 3 sets of 3 clean and jerks climbing to the working bar. Never been coached on the clean and jerk? The beginner level: Hang Power Clean + Push Press singles. Or skip the race: 3 empty-bar reps every minute for 10 min. Bumper plates: the reps come down from overhead.',
  ...SOLO_COPY,
  paceBasis: 'Published guidance: scale so all 30 finish inside 5 min; elite athletes finish under 2 at 61/43 kg. The rest are coach estimates.',
  defaultLevel: 'standard',
  levels: {
    beginner: {
      detail: '30 hang power clean + push press singles · 34/25 kg · cap 10:00', minutes: 5, load: '34/25 kg (75/55 lb), or the 20/15 kg empty bar', rounds: 1, capSec: 600,
      missionLine: '30 HANG POWER CLEAN + PUSH PRESS SINGLES FOR TIME · CAP 10:00',
      slots: koSprint('bb-hang-clean-push-press'), pace: { elite: 90, standard: 270, beginner: 420 },
    },
    standard: {
      detail: '30 reps · 52/34 kg · cap 10:00', minutes: 5, load: '52/34 kg (115/75 lb)', rounds: 1, capSec: 600,
      missionLine: '30 CLEAN AND JERKS FOR TIME · CAP 10:00', slots: koSprint(), pace: { elite: 105, standard: 300, beginner: 480 },
    },
    elite: {
      detail: '30 reps · 61/43 kg · cap 10:00', minutes: 6, load: '61/43 kg (135/95 lb)', rounds: 1, capSec: 600,
      missionLine: '30 CLEAN AND JERKS FOR TIME · CAP 10:00', slots: koSprint(), pace: { elite: 120, standard: 330, beginner: 540 },
    },
  },
};

// ── 14 · OVERHEAD RUSH ──────────────────────────────────────────────────────
const rush = (liftId, lifts, burpeeId) => [r(liftId, lifts, 0, { swapKey: 'lift' }), r(burpeeId, 10, 0, { swapKey: 'burpee' })];
const OVERHEAD_RUSH = {
  id: 'overhead_rush', launch: 14, title: 'OVERHEAD RUSH', tag: 'Barbell', loadout: 'barbell', themes: ['burpees'], format: 'forTime',
  difficulty: 'Hard', focus: 'Conditioning', workoutType: 'Weighted', hotel: false, quiet: false, guided: false,
  knownAs: 'CrossFit Open 20.1 (captions only)',
  loadoutLine: '1 BARBELL + BUMPER PLATES · 2 × 3 M OF FLOOR', scoreLine: 'TIME, OR REPS AT THE CAP (180 FINISHES)', scoreRule: { kind: 'time' },
  scale: 'Lighter bar, or the beginner level. Step over the bar instead of jumping it. Hotel gym: one dumbbell, alternating ground-to-overheads, burpees over the dumbbell.',
  note: 'Warm up 5 min, then 2 empty-bar rounds of 4 ground-to-overheads and 5 burpees. Clean and jerk or clean and press; snatch only if you are trained in it. Never been coached? Three steps: deadlift, hang muscle clean, push press.',
  ...SOLO_COPY,
  paceBasis: 'Coach estimate: a round takes about 1:00-1:30 for most, under 50 s elite.',
  defaultLevel: 'standard',
  levels: {
    beginner: {
      detail: '6 rounds · 6 lifts · empty bar · step-over burpees', minutes: 8, load: '20/15 kg empty bar', rounds: 6, capSec: 900,
      missionLine: '6 ROUNDS FOR TIME · 6 THREE-STEP GROUND-TO-OVERHEADS · 10 STEP-OVER BURPEES · CAP 15:00',
      scoreLine: 'TIME, OR REPS AT THE CAP (96 FINISHES)',
      slots: rush('bb-g2oh-three-step', 6, 'bar-step-over-burpee'), pace: { elite: 300, standard: 480, beginner: 660 },
    },
    standard: {
      detail: '10 rounds · 29/20 kg · stepping over the bar is fine', minutes: 12, load: '29/20 kg (65/45 lb)', rounds: 10, capSec: 900,
      missionLine: '10 ROUNDS FOR TIME · 8 GROUND-TO-OVERHEADS · 10 BAR-FACING BURPEES · CAP 15:00',
      slots: rush('bb-ground-to-overhead', 8, 'bar-facing-burpee'), pace: { elite: 450, standard: 720, beginner: 840 },
    },
    elite: {
      detail: '10 rounds · 43/29 kg · cap 15:00', minutes: 13, load: '43/29 kg (95/65 lb)', rounds: 10, capSec: 900,
      missionLine: '10 ROUNDS FOR TIME · 8 GROUND-TO-OVERHEADS · 10 BAR-FACING BURPEES · CAP 15:00',
      slots: rush('bb-ground-to-overhead', 8, 'bar-facing-burpee'), pace: { elite: 480, standard: 780, beginner: 870 },
    },
  },
};

// ── 15 · BURNOUT 21 ─────────────────────────────────────────────────────────
// The source has no cap; the 30:00 (BEGINNER 20:00) is the app's.
const burnout = (burpeeId) => (n) => [s('bb-thruster', n, { swapKey: 'thruster' }), s(burpeeId, n, { swapKey: 'burpee' })];
const BURNOUT = {
  id: 'burnout_21', launch: 15, title: 'BURNOUT 21', tag: 'Barbell', loadout: 'barbell', themes: ['burpees'], format: 'forTime',
  difficulty: 'Brutal', focus: 'Conditioning', workoutType: 'Weighted', hotel: false, quiet: false, guided: false,
  knownAs: 'CrossFit Open 14.5 / 16.5 (captions only)',
  loadoutLine: '1 BARBELL + PLATES · 2 × 3 M OF FLOOR', scoreLine: 'TIME, OR REPS AT THE CAP (168 FINISHES)', scoreRule: { kind: 'time' },
  scale: 'Lighter bar (29/20 kg), or the beginner level: 15 down to 3 with the empty bar and step-over burpees. Hotel gym: dumbbell thrusters, burpees over the dumbbell.',
  note: 'Warm up 5 min, then 2 rounds of 5 empty-bar thrusters and 5 burpees. Tap ROUND after each rung. If the thruster turns into a back-arching press, split it: a front squat, then a push press.',
  ...SOLO_COPY,
  paceBasis: 'Published: elite times at 43/29 kg were about 7:15-7:45. The rest are coach estimates (a solid intermediate: about 15-22 min).',
  defaultLevel: 'standard',
  levels: {
    beginner: {
      detail: '15-12-9-6-3 · empty bar · step-over burpees · cap 20:00', minutes: 10, load: '20/15 kg empty bar', rounds: 1, capSec: 1200,
      missionLine: '15-12-9-6-3 FOR TIME · THRUSTERS + STEP-OVER BURPEES · 90 REPS · CAP 20:00',
      scoreLine: 'TIME, OR REPS AT THE CAP (90 FINISHES)',
      slots: rungs([15, 12, 9, 6, 3], burnout('bar-step-over-burpee')), pace: { elite: 240, standard: 600, beginner: 960 },
    },
    standard: {
      detail: '21 down to 3 · 29/20 kg · cap 30:00', minutes: 16, load: '29/20 kg (65/45 lb)', rounds: 1, capSec: 1800,
      missionLine: '21-18-15-12-9-6-3 FOR TIME · THRUSTERS + BAR-FACING BURPEES · 168 REPS · CAP 30:00',
      slots: rungs([21, 18, 15, 12, 9, 6, 3], burnout('bar-facing-burpee')), pace: { elite: 420, standard: 960, beginner: 1500 },
    },
    elite: {
      detail: '21 down to 3 · 43/29 kg · cap 30:00', minutes: 18, load: '43/29 kg (95/65 lb)', rounds: 1, capSec: 1800,
      missionLine: '21-18-15-12-9-6-3 FOR TIME · THRUSTERS + BAR-FACING BURPEES · 168 REPS · CAP 30:00',
      slots: rungs([21, 18, 15, 12, 9, 6, 3], burnout('bar-facing-burpee')), pace: { elite: 465, standard: 1080, beginner: 1620 },
    },
  },
};

// ── 16 · STANCE BREAKER 9 ───────────────────────────────────────────────────
const stance = (sec, squatId, jumpId, lungeNote) => [amrap(sec, 0, [
  s('bb-rdl', 8, { swapKey: 'rdl', ...baseNote('rdl', 'bb-rdl', 'Deadlift the bar up once, then hinge to knee height.') }), s(squatId, 8, { swapKey: 'squat' }),
  s('reverse-lunge', 12, { swapKey: 'lunge', ...(lungeNote ? { note: lungeNote } : {}) }), s(jumpId, 8, { swapKey: 'jump' }),
], [], { swapKey: 'block' })];
const STANCE = {
  id: 'stance_breaker_9', launch: 16, title: 'STANCE BREAKER 9', tag: 'Barbell', loadout: 'barbell', themes: [], format: 'amrap',
  difficulty: 'Normal', focus: 'Lower', workoutType: 'Weighted', hotel: false, quiet: false, guided: false, knownAs: '',
  loadoutLine: '1 BARBELL + PLATES · NO RACK · 2 × 2 M', scoreLine: 'ROUNDS + REPS', scoreRule: { kind: 'roundsReps' },
  scale: 'Lighter bar (30/20 kg), or the beginner level. Have a rack? Back squats instead of Zercher squats. Hotel gym: 2 dumbbells, the same 4 moves.',
  note: 'Warm up 3 min easy, then 1 round with the empty bar. No Olympic lifts and no rack: the bar comes off the floor once for the RDLs and rests in your elbows for the squats.',
  ...SOLO_COPY,
  paceBasis: 'Coach estimate: about 4-6 rounds at 40/30 kg; one round takes about 100 s.',
  defaultLevel: 'standard',
  levels: {
    beginner: {
      detail: 'AMRAP 6 · empty bar · plate goblet squats · air squats', minutes: 6, load: '20/15 kg empty bar · a 10 kg plate', rounds: 1,
      missionLine: 'AMRAP 6 · 8 RDLS · 8 PLATE GOBLET SQUATS · 12 REVERSE LUNGES · 8 AIR SQUATS',
      slots: stance(360, 'plate-goblet-squat', 'air-squat', 'Hold a chair if you need to.'), pace: { elite: 5, standard: 4, beginner: 3 },
    },
    standard: {
      detail: 'AMRAP 9 · 30/20 kg', minutes: 9, load: '30/20 kg (66/44 lb)', rounds: 1,
      missionLine: 'AMRAP 9 · 8 RDLS · 8 ZERCHER SQUATS · 12 REVERSE LUNGES · 8 JUMP SQUATS',
      slots: stance(540, 'bb-zercher-squat', 'jump-squat'), pace: { elite: 7, standard: 6, beginner: 4 },
    },
    elite: {
      detail: 'AMRAP 9 · 40/30 kg', minutes: 9, load: '40/30 kg (88/66 lb)', rounds: 1,
      missionLine: 'AMRAP 9 · 8 RDLS · 8 ZERCHER SQUATS · 12 REVERSE LUNGES · 8 JUMP SQUATS',
      slots: stance(540, 'bb-zercher-squat', 'jump-squat'), pace: { elite: 6, standard: 5, beginner: 4 },
    },
  },
};

// ── 17 · ROOKIE ROUND 8 ─────────────────────────────────────────────────────
// The source is one level (the empty bar) with an easier and a level-up
// option: those are BEGINNER and ELITE.
const rookie = (sec, pushId) => [amrap(sec, 0, [
  s('bb-bent-over-row', 8, { swapKey: 'row' }), s('bb-strict-press', 8, { swapKey: 'press', ...baseNote('press', 'bb-strict-press', 'Pull the bar to the shoulders, no dip, then press.') }),
  s(pushId, 8, { swapKey: 'push-up' }),
], [], { swapKey: 'block' })];
const ROOKIE = {
  id: 'rookie_round_8', launch: 17, title: 'ROOKIE ROUND 8', tag: 'Barbell', loadout: 'barbell', themes: [], format: 'amrap',
  difficulty: 'Easy', focus: 'Upper', workoutType: 'Weighted', hotel: false, quiet: false, guided: false, knownAs: '',
  loadoutLine: '1 BARBELL (THE EMPTY BAR IS FINE) · 2 × 2 M', scoreLine: 'ROUNDS + REPS', scoreRule: { kind: 'roundsReps' },
  scale: 'Easier: a broomstick or a 10 kg technique bar, incline push-ups, 5 min (the beginner level). Level up: a 30/20 kg bar. Hotel gym: 2 light dumbbells.',
  note: 'Never touched a barbell? Start here: no Olympic lifts, nothing heavy. Flat back on the rows, glutes tight on the press, body in one line on the push-ups.',
  ...SOLO_COPY,
  paceBasis: 'Coach estimate: about 6-8 rounds with the empty bar; one round takes about 60 s.',
  defaultLevel: 'standard',
  levels: {
    beginner: {
      detail: 'AMRAP 5 · a broomstick or a 10 kg bar · incline push-ups', minutes: 5, load: 'A broomstick or a 10 kg technique bar', rounds: 1,
      missionLine: 'AMRAP 5 · 8 BENT-OVER ROWS · 8 STRICT PRESSES · 8 INCLINE PUSH-UPS',
      slots: rookie(300, 'incline-push-up'), pace: { elite: 6, standard: 5, beginner: 3 },
    },
    standard: {
      detail: 'AMRAP 8 · the empty bar', minutes: 8, load: '20/15 kg empty bar', rounds: 1,
      missionLine: 'AMRAP 8 · 8 BENT-OVER ROWS · 8 STRICT PRESSES · 8 PUSH-UPS',
      slots: rookie(480, 'push-up'), pace: { elite: 9, standard: 7, beginner: 5 },
    },
    elite: {
      detail: 'AMRAP 8 · 30/20 kg', minutes: 8, load: '30/20 kg (66/44 lb)', rounds: 1,
      missionLine: 'AMRAP 8 · 8 BENT-OVER ROWS · 8 STRICT PRESSES · 8 PUSH-UPS',
      slots: rookie(480, 'push-up'), pace: { elite: 8, standard: 6, beginner: 4 },
    },
  },
};

// ── 18 · FIRST BELL ─────────────────────────────────────────────────────────
// One clock, two blocks of windows: a swing set every :30 (10 × 10 = 100 in
// 5:00), the 10th set's restAfter for the 1:00 rest, then a get-up every
// minute. The source's warm-up is in the note, off the clock. BEGINNER rests
// as needed in the source; SOLO needs a fixed clock, so its sets get a full
// minute each. The source scores the pass and the bell; SOLO stores the
// windows held, and the level records the bell's range.
const firstBell = (swingId, window, getUpId) => [
  ...Array.from({ length: 10 }, (_, i) => r(swingId, 10, 0, { swapKey: 'swing', window, prefix: window === 60 ? 'EVERY MIN' : 'EVERY :30', ...(i === 9 ? { restAfter: 60 } : {}) })),
  ...Array.from({ length: 10 }, () => r(getUpId, 1, 0, { swapKey: 'get-up', window: 60, prefix: 'EVERY MIN', note: 'Switch sides every minute.' })),
];
const FIRST_BELL = {
  id: 'first_bell', launch: 18, title: 'FIRST BELL', tag: 'Kettlebell', loadout: 'bell', themes: [], format: 'emom',
  difficulty: 'Normal', focus: 'Full Body', workoutType: 'Weighted', hotel: true, quiet: false, guided: false,
  knownAs: "Kettlebell Simple & Sinister, 'Simple' timed standard (Pavel Tsatsouline / StrongFirst)",
  loadoutLine: '1 KETTLEBELL (OR 1 DUMBBELL) · 2 × 2 M, CLEAR IN FRONT', scoreLine: 'SETS HELD, OUT OF 20',
  scoreRule: { kind: 'minutesHeld', label: 'SETS HELD' },
  scale: 'The clock is a test, not the daily default. Move up one bell size only when the whole session feels easy inside the times. Dumbbell: swing one by the head; get-ups with a light one, wrist straight.',
  note: 'Warm up 5 min first: 3 easy rounds of 5 prying goblet squats, 5 halos each way and 10 hip bridges, light bell. Switch arms every swing set. Get-ups: eyes on the bell, arm locked, never rush. Shoulder pain? Half get-ups, no weight. Pick the level that matches your bell: it is saved with the score.',
  ...SOLO_COPY,
  paceBasis: 'The pass: all 100 swings inside 5:00 and all 10 get-ups inside 10:00. Set times are the swing sets, a coach estimate.',
  defaultLevel: 'standard',
  levels: {
    beginner: {
      detail: 'Two-hand swings, a minute a set · get-ups with a shoe on the fist', minutes: 21, load: 'Swings 16/12 kg (35/26 lb) · get-ups no weight', rounds: 1,
      missionLine: '10 × 10 SWINGS, ONE SET A MINUTE · REST 1:00 · 10 GET-UPS, ONE A MINUTE',
      slots: firstBell('kb-swing', 60, 'bw-turkish-get-up'),
      pace: { elite: { held: 20, of: 20, setSec: 15 }, standard: { held: 20, of: 20, setSec: 18 }, beginner: { held: 18, of: 20, setSec: 23 } },
    },
    standard: {
      detail: 'Swings M 24 / W 16 kg · get-ups M 16 / W 8 kg', minutes: 16, load: 'Swings M 24 kg (53 lb) / W 16 kg (35 lb) · get-ups M 16 kg (35 lb) / W 8 kg (18 lb), or a shoe on the fist', rounds: 1,
      missionLine: '100 ONE-ARM SWINGS IN 5:00 · REST 1:00 · 10 GET-UPS IN 10:00',
      slots: firstBell('kb-one-arm-swing', 30, 'kb-turkish-get-up'),
      pace: { elite: { held: 20, of: 20, setSec: 15 }, standard: { held: 20, of: 20, setSec: 18 }, beginner: { held: 17, of: 20, setSec: null } },
    },
    elite: {
      detail: 'The full standard: swings M 32 / W 24 kg · get-ups M 32 / W 16 kg', minutes: 16, load: 'Swings M 32 kg (70 lb) / W 24 kg (53 lb) · get-ups M 32 kg (70 lb) / W 16 kg (35 lb)', rounds: 1,
      missionLine: '100 ONE-ARM SWINGS IN 5:00 · REST 1:00 · 10 GET-UPS IN 10:00',
      slots: firstBell('kb-one-arm-swing', 30, 'kb-turkish-get-up'),
      pace: { elite: { held: 20, of: 20, setSec: 15 }, standard: { held: 20, of: 20, setSec: 18 }, beginner: { held: 16, of: 20, setSec: null } },
    },
  },
};

// ── 19 · CONTINUE? · BELL ───────────────────────────────────────────────────
// The 10→1 ladder is ELITE (24/16 kg) and STANDARD (the scaled 16/12 kg); the
// original 5→1 ladder is BEGINNER, with its own 10:00 cap.
const stepDown = (top, pushId) => rungs(Array.from({ length: top }, (_, i) => top - i), (n) => [
  s('kb-swing', 15, { swapKey: 'swing', note: 'Every rung.' }), s('goblet-squat', n, { swapKey: 'squat' }), s(pushId, n, { swapKey: 'push-up' }),
]);
const CONTINUE_BELL = {
  id: 'continue_bell', launch: 19, title: 'CONTINUE? · BELL', tag: 'Kettlebell', loadout: 'bell', themes: [], format: 'forTime',
  difficulty: 'Hard', focus: 'Conditioning', workoutType: 'Weighted', hotel: true, quiet: false, guided: false,
  knownAs: 'Humane Burpee (Dan John), 10→1 variant',
  loadoutLine: '1 KETTLEBELL (OR 1 DUMBBELL) · A SWING LANE CLEAR OF THE TV', scoreLine: 'TIME, OR REPS AT THE CAP', scoreRule: { kind: 'time' },
  scale: 'Lighter bell (16/12 kg), or the beginner level: 5 rungs down to 1, and 10 swings if 15 breaks your form. Dumbbell: swings and goblet squats with one dumbbell.',
  note: '15 swings every rung; only the squats and push-ups shrink, so it gets easier as you go. Tap ROUND after each rung. Park the bell when your back rounds or the bell drifts forward: that is a rest, not a fail.',
  ...SOLO_COPY,
  paceBasis: 'Coach estimate: 15 swings take about 25 s; the ladder runs about 10-14 min.',
  defaultLevel: 'standard',
  levels: {
    beginner: {
      detail: '5 down to 1 · 12/8 kg · incline push-ups · cap 10:00', minutes: 6, load: '12/8 kg (26/18 lb)', rounds: 1, capSec: 600,
      missionLine: '15 SWINGS EVERY RUNG · SQUATS AND INCLINE PUSH-UPS 5 DOWN TO 1 · CAP 10:00',
      slots: stepDown(5, 'incline-push-up'), pace: { elite: 240, standard: 360, beginner: 540 },
    },
    standard: {
      detail: '10 down to 1 · 16/12 kg · cap 20:00', minutes: 13, load: '16/12 kg (35/26 lb)', rounds: 1, capSec: 1200,
      missionLine: '15 SWINGS EVERY RUNG · SQUATS AND PUSH-UPS 10 DOWN TO 1 · CAP 20:00',
      slots: stepDown(10, 'push-up'), pace: { elite: 540, standard: 780, beginner: 1080 },
    },
    elite: {
      detail: '10 down to 1 · 24/16 kg · cap 20:00', minutes: 14, load: 'M 24 kg (53 lb) / W 16 kg (35 lb)', rounds: 1, capSec: 1200,
      missionLine: '15 SWINGS EVERY RUNG · SQUATS AND PUSH-UPS 10 DOWN TO 1 · CAP 20:00',
      slots: stepDown(10, 'push-up'), pace: { elite: 600, standard: 840, beginner: 1140 },
    },
  },
};

// ── 20 · CARRY-ON 15 ────────────────────────────────────────────────────────
// The source gives one load range (M 16-22.5 / W 8-12 kg): its low end is
// STANDARD, its top ELITE. quiet: nothing jumps, and nothing swings near the
// furniture (no swap reaches a swing).
const carryOn = (sec, n, lungeId, pushId) => [amrap(sec, 0, [
  s('db-rdl', n, { swapKey: 'rdl' }), s('db-row', n, { swapKey: 'row', note: 'Brace a hand on the bed or the desk.' }),
  s(lungeId, n, { swapKey: 'lunge' }), s(pushId, n, { swapKey: 'push-up' }),
], [], { swapKey: 'block' })];
const CARRY_ON = {
  id: 'carry_on_15', launch: 20, title: 'CARRY-ON 15', tag: 'Hotel Room', loadout: 'bell', themes: [], format: 'amrap',
  difficulty: 'Normal', focus: 'Full Body', workoutType: 'Weighted', hotel: true, quiet: true, guided: false, knownAs: '',
  loadoutLine: '1 DUMBBELL OR KETTLEBELL · 2 M² OF FLOOR', scoreLine: 'ROUNDS + REPS', scoreRule: { kind: 'roundsReps' },
  scale: 'Beginner level: AMRAP 10 of 6 each, a light bell, incline push-ups and bodyweight lunges. No bell? A backpack of water bottles or books, about 8-10 kg, for the RDLs, rows and lunges.',
  note: 'Built for a hotel room: nothing jumps, and nothing swings near the furniture. Incline push-ups go on the desk, not the soft bed.',
  ...SOLO_COPY,
  paceBasis: 'Coach estimate: about 6-7 rounds for an intermediate; one round takes about 2:20.',
  defaultLevel: 'standard',
  levels: {
    beginner: {
      detail: 'AMRAP 10 · 6 each · 8/5 kg · incline push-ups', minutes: 10, load: '8/5 kg (18/10 lb)', rounds: 1,
      missionLine: 'AMRAP 10 · 6 RDLS · 6 ROWS · 6 REVERSE LUNGES · 6 INCLINE PUSH-UPS',
      slots: carryOn(600, 6, 'reverse-lunge', 'incline-push-up'), pace: { elite: 10, standard: 8, beginner: 6 },
    },
    standard: {
      detail: 'AMRAP 15 · M 16 kg / W 8 kg', minutes: 15, load: 'M 16 kg (35 lb) / W 8 kg (18 lb)', rounds: 1,
      missionLine: 'AMRAP 15 · 10 RDLS · 10 ROWS · 10 GOBLET REVERSE LUNGES · 10 PUSH-UPS',
      slots: carryOn(900, 10, 'kb-reverse-lunge', 'push-up'), pace: { elite: 8, standard: 6, beginner: 4 },
    },
    elite: {
      detail: 'AMRAP 15 · M 22.5 kg / W 12 kg', minutes: 15, load: 'M 22.5 kg (50 lb) / W 12 kg (25 lb)', rounds: 1,
      missionLine: 'AMRAP 15 · 10 RDLS · 10 ROWS · 10 GOBLET REVERSE LUNGES · 10 PUSH-UPS',
      slots: carryOn(900, 10, 'kb-reverse-lunge', 'push-up'), pace: { elite: 7, standard: 6, beginner: 4 },
    },
  },
};

// ── 21 · SURGE 20/10 ────────────────────────────────────────────────────────
// 20/10 timing, rotating three moves through 8 rounds. The score is each
// move's lowest round, added (the TURBO BUTTON convention). Like every
// interval clock, the last 0:10 rest is not run: 11:50. ELITE counts at the
// standard column: its heavier bell is slower, so the clock-end prefill
// (44) stays at or under its own elite mark.
const surge = (work, rest, squatId) => [
  t('kb-swing', work, rest, { swapKey: 'swing' }), t(squatId, work, rest, { swapKey: 'thruster' }), t('mountain-climber', work, rest, { swapKey: 'climber' }),
];
const SURGE = {
  id: 'surge_20_10', launch: 21, title: 'SURGE 20/10', tag: 'Kettlebell', loadout: 'bell', themes: [], format: 'intervals',
  difficulty: 'Hard', focus: 'Conditioning', workoutType: 'Weighted', hotel: true, quiet: false, guided: false,
  knownAs: 'Tabata intervals (20 s on / 10 s off x 8), rotating',
  countAt: { elite: 'standard' },
  loadoutLine: '1 KETTLEBELL (OR 1 DUMBBELL) · A CLEAR SWING LANE', scoreLine: 'LOWEST SWINGS + THRUSTERS + CLIMBERS',
  scoreRule: { kind: 'reps', label: 'LOWEST SWINGS + THRUSTERS + CLIMBERS', keys: ['swing', 'thruster', 'climber'], agg: 'lowest' },
  scale: 'Lighter bell (16/8 kg), or the beginner level: 15 on, 15 off for 6 rounds, with goblet squats for the thrusters. Dumbbell: swings and goblet thrusters with one dumbbell.',
  note: 'Warm up 3 min first: halos, goblet squats, 10 easy swings. Max-effort intervals done cold are where backs get tweaked. Fast but crisp: fewer clean swings beat sloppy ones, so park the bell if your back rounds.',
  ...SOLO_COPY,
  paceBasis: 'Coach estimate from the count, with a fatigue drop. The 20 on, 10 off timing comes from a cycling study; this rotation is a gym variant.',
  defaultLevel: 'standard',
  levels: {
    beginner: {
      detail: '6 rounds · 0:15 on, 0:15 off · 12/8 kg · goblet squats', minutes: 9, load: '12/8 kg (26/18 lb)', rounds: 6,
      missionLine: '6 ROUNDS · 0:15 ON, 0:15 OFF · SWINGS · GOBLET SQUATS · CLIMBERS',
      scoreLine: 'LOWEST SWINGS + SQUATS + CLIMBERS',
      scoreRule: { kind: 'reps', label: 'LOWEST SWINGS + SQUATS + CLIMBERS', keys: ['swing', 'thruster', 'climber'], agg: 'lowest' },
      slots: surge(15, 15, 'goblet-squat'), pace: { elite: 36, standard: 27, beginner: 22 },
    },
    standard: {
      detail: '8 rounds · 0:20 on, 0:10 off · 16/8 kg', minutes: 12, load: '16/8 kg (35/18 lb)', rounds: 8,
      missionLine: '8 ROUNDS · 0:20 ON, 0:10 OFF · SWINGS · GOBLET THRUSTERS · CLIMBERS',
      slots: surge(20, 10, 'kb-goblet-thruster'), pace: { elite: 46, standard: 37, beginner: 29 },
    },
    elite: {
      detail: '8 rounds · 0:20 on, 0:10 off · 20/12 kg', minutes: 12, load: 'M 20 kg (44 lb) / W 12 kg (26 lb)', rounds: 8,
      missionLine: '8 ROUNDS · 0:20 ON, 0:10 OFF · SWINGS · GOBLET THRUSTERS · CLIMBERS',
      slots: surge(20, 10, 'kb-goblet-thruster'), pace: { elite: 44, standard: 35, beginner: 27 },
    },
  },
};

// ── 22 · MIDLINE LOCK ───────────────────────────────────────────────────────
// Loaded anti-movement core: no arching, leaning or twisting. ELITE is the
// source's harder option (16/12 kg, a 3 s pause on every dead bug).
const midline = (sec, bugId, pullId, bugNote) => [amrap(sec, 0, [
  s(bugId, 10, { swapKey: 'dead-bug', ...(bugNote ? { note: bugNote } : {}) }), s('kb-suitcase-deadlift', 10, { swapKey: 'suitcase' }),
  s(pullId, 10, { swapKey: 'pull-through' }), s('kb-halo', 10, { swapKey: 'halo', note: 'Five each way.' }),
], [], { swapKey: 'block' })];
const MIDLINE = {
  id: 'midline_lock', launch: 22, title: 'MIDLINE LOCK', tag: 'Kettlebell', loadout: 'bell', themes: [], format: 'amrap',
  difficulty: 'Easy', focus: 'Core', workoutType: 'Weighted', hotel: true, quiet: true, guided: false, knownAs: '',
  loadoutLine: '1 LIGHT KETTLEBELL OR DUMBBELL · A MAT OF FLOOR', scoreLine: 'ROUNDS + REPS', scoreRule: { kind: 'roundsReps' },
  scale: 'Beginner level: bodyweight dead bugs, an 8 kg bell (or a water jug or backpack), knee plank pull-throughs, AMRAP 6. No bell? Backpack halos, and a loaded backpack for the rest.',
  note: 'Here the core stops motion: no arching, leaning or twisting. Slow and controlled, ribs down. Clean rounds count, not fast ones.',
  ...SOLO_COPY,
  paceBasis: 'Coach estimate: about 5 rounds; one slow round takes about 2 min.',
  defaultLevel: 'standard',
  levels: {
    beginner: {
      detail: 'AMRAP 6 · bodyweight dead bugs · 8 kg · knee plank', minutes: 6, load: '8 kg (18 lb), or a water jug or backpack', rounds: 1,
      missionLine: 'AMRAP 6 · 10 DEAD BUGS · 10 SUITCASE DEADLIFTS · 10 KNEE PULL-THROUGHS · 10 HALOS',
      slots: midline(360, 'dead-bug', 'kb-knee-pull-through'), pace: { elite: 4, standard: 3, beginner: 2 },
    },
    standard: {
      detail: 'AMRAP 10 · M 12-16 kg / W 8 kg', minutes: 10, load: 'M 12-16 kg (26-35 lb) / W 8 kg (18 lb)', rounds: 1,
      missionLine: 'AMRAP 10 · 10 DEAD BUGS · 10 SUITCASE DEADLIFTS · 10 PULL-THROUGHS · 10 HALOS',
      slots: midline(600, 'kb-dead-bug', 'kb-plank-pull-through'), pace: { elite: 6, standard: 5, beginner: 4 },
    },
    elite: {
      detail: 'AMRAP 10 · 16/12 kg · a 3 s pause on every dead bug', minutes: 10, load: '16/12 kg (35/26 lb)', rounds: 1,
      missionLine: 'AMRAP 10 · 10 PAUSED DEAD BUGS · 10 SUITCASE DEADLIFTS · 10 PULL-THROUGHS · 10 HALOS',
      slots: midline(600, 'kb-dead-bug', 'kb-plank-pull-through', 'Pause 3 s at the bottom of every rep.'), pace: { elite: 5, standard: 4, beginner: 3 },
    },
  },
};

// ── 23 · LEG SWEEP ──────────────────────────────────────────────────────────
// The bed is the bench. The source's load (M 16-22.5 / W 8-12 kg) is ELITE,
// its scaled 8-12 kg STANDARD for men; women step down to 6-8 kg there (a
// coach estimate), so each level is a real step for both.
const legSweep = (sec, splitId, thrustId) => [amrap(sec, 0, [
  s(splitId, 12, { swapKey: 'split-squat' }), s(thrustId, 12, { swapKey: 'hip-thrust' }), s('kb-lateral-lunge', 10, { swapKey: 'lateral-lunge' }),
], [], { swapKey: 'block' })];
const LEG_SWEEP = {
  id: 'leg_sweep', launch: 23, title: 'LEG SWEEP', tag: 'Hotel Room', loadout: 'bell', themes: [], format: 'amrap',
  difficulty: 'Normal', focus: 'Lower', workoutType: 'Weighted', hotel: true, quiet: true, guided: false, knownAs: '',
  loadoutLine: '1 DUMBBELL OR KETTLEBELL + A BED OR SOFA', scoreLine: 'ROUNDS + REPS', scoreRule: { kind: 'roundsReps' },
  scale: 'Lighter bell (M 8-12 / W 6-8 kg), or the beginner level: split squats with the back foot on the floor and a hand on the wall, glute bridges on the floor, AMRAP 8.',
  note: 'Use the bed or a wall-braced sofa, never a rolling desk chair. A towel under the dumbbell on the hip thrusts.',
  ...SOLO_COPY,
  paceBasis: 'Coach estimate: about 4-5 rounds; one round takes about 2:20.',
  defaultLevel: 'standard',
  levels: {
    beginner: {
      detail: 'AMRAP 8 · split squats · glute bridges · a light bell', minutes: 8, load: 'A light bell, 8 kg (18 lb), for the lateral lunges', rounds: 1,
      missionLine: 'AMRAP 8 · 6/6 SPLIT SQUATS · 12 GLUTE BRIDGES · 10 LATERAL LUNGES',
      slots: legSweep(480, 'split-squat', 'glute-bridge'), pace: { elite: 5, standard: 4, beginner: 3 },
    },
    standard: {
      detail: 'AMRAP 12 · M 8-12 kg / W 6-8 kg', minutes: 12, load: 'M 8-12 kg (18-25 lb) / W 6-8 kg (13-18 lb)', rounds: 1,
      missionLine: 'AMRAP 12 · 6/6 SPLIT SQUATS · 12 HIP THRUSTS · 10 LATERAL LUNGES',
      slots: legSweep(720, 'kb-bulgarian-split-squat', 'db-hip-thrust'), pace: { elite: 7, standard: 5, beginner: 4 },
    },
    elite: {
      detail: 'AMRAP 12 · M 16-22.5 kg / W 8-12 kg', minutes: 12, load: 'M 16-22.5 kg (35-50 lb) / W 8-12 kg (18-25 lb)', rounds: 1,
      missionLine: 'AMRAP 12 · 6/6 SPLIT SQUATS · 12 HIP THRUSTS · 10 LATERAL LUNGES',
      slots: legSweep(720, 'kb-bulgarian-split-squat', 'db-hip-thrust'), pace: { elite: 6, standard: 4, beginner: 3 },
    },
  },
};

// ── 24 · CHARGE UP 12 ───────────────────────────────────────────────────────
// An ascending ladder on the AMRAP clock: both steps climb 2 a rung (`climb`),
// A ROUND tap marks a rung, and the score is total reps: the source's 'rung + reps
// into the next' as one number (through the 14s is 112). Paces are the
// source's rung marks in reps; BEGINNER is its ROOKIE 8:00. The source sets
// its elite and standard marks (the 18s, the 14s) at the Rx bell and its
// beginner mark (the 10s) at 15/10 kg, so STANDARD (15/10 kg) keeps all three
// and ELITE (the Rx bell) steps its beginner mark down to the 8s.
const chargeUp = (sec) => [amrap(sec, 0, [
  s('db-devil-press', 2, { swapKey: 'press' }), s('db-lateral-burpee-over', 2, { swapKey: 'burpee' }),
], [], { swapKey: 'block', climb: 2 })];
const CHARGE_UP = {
  id: 'charge_up_12', launch: 24, title: 'CHARGE UP 12', tag: 'Dumbbell', loadout: 'bell', themes: ['burpees'], format: 'amrap',
  difficulty: 'Hard', focus: 'Full Body', workoutType: 'Weighted', hotel: false, quiet: false, guided: false,
  knownAs: "Ascending dumbbell / burpee ladder (inspired by CrossFit Open 17.1's dumbbell snatch and burpee box jump-over)",
  loadoutLine: '1 HEX DUMBBELL · 2 × 2 M, ROOM TO PRESS OVERHEAD', scoreLine: 'TOTAL REPS: EVERY RUNG CLEARED, PLUS INTO THE NEXT',
  scoreRule: { kind: 'reps', label: 'TOTAL REPS', keys: ['press', 'burpee'], agg: 'total' },
  scale: 'Lighter bell first, then start the ladder at 1 and add 1 a rung. Step-back burpees for knees. No dumbbell: burpees and lateral burpees over a line. Harder: two dumbbells.',
  note: 'Warm up 5 min: easy jacks, hip hinges, light deadlifts and hang clean and presses, 5 burpees, hops over a line. Tap ROUND after each rung. Back rounding on the pull, or a soft lockout: a lighter bell. Never drop it from overhead. Dizziness, chest pain or sharp pain ends the run, and the score stands.',
  ...SOLO_COPY,
  paceBasis: 'Coach estimate from the rep times (devil press 4 / 6 / 9 s, burpee-over 3 / 4.5 / 6 s), plus a breath a rung. The elite and standard marks (the 18s, the 14s) were set with the heavier bell and hold for both 12:00 levels. The beginner mark is the 10s at 15/10 kg, the 8s with the heavier bell.',
  defaultLevel: 'standard',
  levels: {
    beginner: {
      detail: 'AMRAP 8 · 15/10 kg or 10/5 kg', minutes: 8, load: '15/10 kg (33/22 lb), or 10/5 kg (22/11 lb)', rounds: 1,
      missionLine: 'AMRAP 8 LADDER · 2 + 2, THEN 4 + 4, +2 A RUNG',
      slots: chargeUp(480), pace: { elite: 112, standard: 60, beginner: 40 },
    },
    standard: {
      detail: 'AMRAP 12 · 15/10 kg', minutes: 12, load: '15/10 kg (33/22 lb)', rounds: 1,
      missionLine: 'AMRAP 12 LADDER · 2 + 2, THEN 4 + 4, +2 A RUNG',
      slots: chargeUp(720), pace: { elite: 180, standard: 112, beginner: 60 },
    },
    elite: {
      detail: 'AMRAP 12 · 22.5/15 kg', minutes: 12, load: '22.5/15 kg (50/35 lb)', rounds: 1,
      missionLine: 'AMRAP 12 LADDER · 2 + 2, THEN 4 + 4, +2 A RUNG',
      slots: chargeUp(720), pace: { elite: 180, standard: 112, beginner: 40 },
    },
  },
};

// ── 25 · OXYGEN DEBT ────────────────────────────────────────────────────────
// 21-15-9, a ladder of three rungs. STANDARD is the source's intermediate
// (34/25 kg, 12-9-6 pull-ups). The 10:00 cap is a gym convention.
const debt = (thrusters, pulls, pullId) => rungs(thrusters, (n, i) => [
  s('bb-thruster', n, { swapKey: 'thruster' }), s(pullId, pulls[i], { swapKey: 'pull-up' }),
]);
const OXYGEN_DEBT = {
  id: 'oxygen_debt', launch: 25, title: 'OXYGEN DEBT', tag: 'Sprint', loadout: 'mixed', themes: [], format: 'forTime',
  difficulty: 'Brutal', focus: 'Full Body', workoutType: 'Weighted', hotel: true, quiet: false, guided: false, knownAs: 'Fran',
  loadoutLine: '1 BARBELL + A PULL-UP BAR, OR 2 DUMBBELLS', scoreLine: 'TIME, OR REPS AT THE CAP', scoreRule: { kind: 'time' },
  scale: 'Lighter bar, or the beginner level: 15-12-9 with an empty bar or 2 light dumbbells, and jumping pull-ups. Dumbbells: 2 × 15/10 kg. No bar on the road: dumbbell bent-over rows, the same reps.',
  note: 'Warm up 8-10 min first; this is a 5-8 min sprint. 3 min easy cardio, 2 rounds of 5 empty-bar thrusters and 5 pull-ups or ring rows, then 5 thrusters at work weight. Tap ROUND after each rung. Kip only if you already can. Never row under a hotel table: it can tip.',
  ...SOLO_COPY,
  paceBasis: 'Coach estimate: 5-8 min for most; elite athletes finish in under 3.',
  defaultLevel: 'standard',
  levels: {
    beginner: {
      detail: '15-12-9 · empty bar or 2 × 5-7.5 kg · jumping pull-ups', minutes: 5, load: '20/15 kg empty bar, or 2 × 5-7.5 kg dumbbells', rounds: 1, capSec: 600,
      missionLine: '15-12-9 FOR TIME · THRUSTERS · JUMPING PULL-UPS · CAP 10:00',
      slots: debt([15, 12, 9], [15, 12, 9], 'jumping-pull-up'), pace: { elite: 150, standard: 300, beginner: 480 },
    },
    standard: {
      detail: '21-15-9 · 34/25 kg · 12-9-6 pull-ups', minutes: 6, load: '34/25 kg (75/55 lb)', rounds: 1, capSec: 600,
      missionLine: '21-15-9 THRUSTERS · 12-9-6 PULL-UPS · FOR TIME · CAP 10:00',
      slots: debt([21, 15, 9], [12, 9, 6], 'pull-up'), pace: { elite: 150, standard: 330, beginner: 510 },
    },
    elite: {
      detail: '21-15-9 · 43/29 kg', minutes: 6, load: '43/29 kg (95/65 lb)', rounds: 1, capSec: 600,
      missionLine: '21-15-9 FOR TIME · THRUSTERS · PULL-UPS · CAP 10:00',
      slots: debt([21, 15, 9], [21, 15, 9], 'pull-up'), pace: { elite: 180, standard: 360, beginner: 540 },
    },
  },
};

// ── 26 · HOT LAPS ───────────────────────────────────────────────────────────
// The run is a manual DONE in metres. Its row is scored: false, so a capped
// score counts the swings and pull-ups only, even after the run is swapped
// to rower calories or high knees. ELITE swings overhead as written; the
// other levels swing to eye level (the source's rule for anyone uncoached).
const laps = (metres, swingId, swings, pullId, pulls) => [
  r('run', metres, 0, { swapKey: 'run', scored: false }), r(swingId, swings, 0, { swapKey: 'swing' }), r(pullId, pulls, 0, { swapKey: 'pull-up' }),
];
const HOT_LAPS = {
  id: 'hot_laps', launch: 26, title: 'HOT LAPS', tag: 'Running', loadout: 'mixed', themes: [], format: 'forTime',
  difficulty: 'Hard', focus: 'Conditioning', workoutType: 'Weighted', hotel: false, quiet: false, guided: false, knownAs: 'Helen',
  loadoutLine: '1 KETTLEBELL + A PULL-UP BAR · A 400 M ROUTE OR A TREADMILL', scoreLine: 'TIME, OR SWINGS + PULL-UPS AT THE CAP', scoreRule: { kind: 'time' },
  scale: 'Lighter bell, or the beginner level: 200 m, 15 swings at 12/8 kg, 9 jumping pull-ups. Travel: a treadmill, dumbbell swings, and single-arm rows for the pull-ups.',
  note: 'Warm up 6-8 min: an easy 400 m jog, then 2 rounds of 10 swings to eye level and 5 pull-ups or ring rows. Never been coached on swings? Stop them at eye level: the overhead finish is where tired backs arch. Tap ROUND after each lap.',
  ...SOLO_COPY,
  paceBasis: 'Coach estimate: 10-14 min for most; a 400 m run takes about 1:45-2:30.',
  defaultLevel: 'standard',
  levels: {
    beginner: {
      detail: '200 m · 15 swings at 12/8 kg · 9 jumping pull-ups', minutes: 8, load: '12/8 kg (26/18 lb)', rounds: 3, capSec: 1200,
      missionLine: '3 ROUNDS FOR TIME · 200 M RUN · 15 SWINGS · 9 JUMPING PULL-UPS · CAP 20:00',
      slots: laps(200, 'kb-swing', 15, 'jumping-pull-up', 9), pace: { elite: 330, standard: 480, beginner: 720 },
    },
    standard: {
      detail: '400 m · 21 swings at 16/12 kg · 6 pull-ups', minutes: 11, load: '16/12 kg (35/26 lb)', rounds: 3, capSec: 1200,
      missionLine: '3 ROUNDS FOR TIME · 400 M RUN · 21 SWINGS · 6 PULL-UPS · CAP 20:00',
      slots: laps(400, 'kb-swing', 21, 'pull-up', 6), pace: { elite: 450, standard: 660, beginner: 960 },
    },
    elite: {
      detail: '400 m · 21 overhead swings at 24/16 kg · 12 pull-ups', minutes: 12, load: '24/16 kg (53/35 lb)', rounds: 3, capSec: 1200,
      missionLine: '3 ROUNDS FOR TIME · 400 M RUN · 21 AMERICAN SWINGS · 12 PULL-UPS · CAP 20:00',
      slots: laps(400, 'kb-american-swing', 21, 'pull-up', 12), pace: { elite: 480, standard: 720, beginner: 1020 },
    },
  },
};

// ── 27-29 · the owner's own workouts ───────────────────────────────────────
// Coach TM originals, owner-approved designs: `origin` says so (the content
// kit reads it), and there is no knownAs. GUIDED and SOLO. Every pace target
// is a coach estimate (see each paceBasis).
const OWN = { knownAs: '', origin: 'Coach TM original' };

// ── 27 · BAR FIGHT ──────────────────────────────────────────────────────────
// The owner's round, as written: four 0:30 bar drills back to back (the
// regrip is inside each 0:30), then the bar goes down for the shadowbox, then
// 0:30 of rest, the round's only rest. Scored the TURBO BUTTON way: each
// punch's lowest round, added. The count is a fresh first round, so the
// marks sit below it the house way (STANDARD's standard mark is about 0.83 of
// the count, its elite mark a little over it): 3-5 rounds of a loaded bar
// held out slow down. ELITE's heavier bar counts at the standard column, so
// its clock-end prefill (44) never beats its own elite mark. Only ELITE may
// hop on the squats: below it, no swap reaches a jump.
const barFight = (shadowSec) => [
  t('bb-punch-out', 30, 0, { swapKey: 'front-press' }), t('bb-explosive-press', 30, 0, { swapKey: 'overhead-press' }),
  t('bb-uppercut', 30, 0, { swapKey: 'uppercut' }), t('bb-explosive-front-squat', 30, 0, { swapKey: 'front-squat' }),
  // The switch call puts the bar down first: 'Bar down. Explosive shadowboxing. Go.'
  t('explosive-shadowbox', shadowSec, 30, { swapKey: 'shadowbox', say: 'bar down. Explosive shadowboxing' }),
];
const NO_HOP = ['bb-front-squat-hop', 'jump-squat'];
const BAR_FIGHT = {
  id: 'bar_fight', launch: 27, title: 'BAR FIGHT', tag: 'Striking', loadout: 'barbell', themes: ['striking'], format: 'intervals',
  difficulty: 'Normal', focus: 'Combat', workoutType: 'Weighted', hotel: false, quiet: false, guided: true, ...OWN,
  countAt: { elite: 'standard' },
  loadoutLine: '1 LIGHT BARBELL · 2 × 2 M, CLEAR IN FRONT', scoreLine: 'LOWEST FRONT PRESSES + UPPERCUTS',
  scoreRule: { kind: 'reps', label: 'LOWEST FRONT PRESSES + UPPERCUTS', keys: ['front-press', 'uppercut'], agg: 'lowest' },
  scale: 'Lighter bar, a broomstick or 2 light dumbbells, or the beginner level. Sore shoulders: Plate Punch-Outs or One-Twos.',
  note: 'Warm up 3 min: easy shadowboxing, arm circles, 10 empty-bar front squats. Light and fast: if the bar slows down, it is too heavy. Core braced, shoulders down, never lock the elbows hard. Using a plate? Swap all four bar drills to the plate. Set the bar down before you shadowbox. Only ELITE may add a small hop on the squats.',
  introSay: 'Bar fight. Four fast bar drills, then set the bar down and shadowbox. Light bar, fast hands.',
  tips: ['Shoulders down, core braced.', 'Light bar, fast hands.'],
  guidedHelp: 'The coach sets the pace on every bar drill and calls the next one.',
  paceBasis: "Coach estimate. The count (front press 1.25 s, uppercut 1.5 s; beginner 1.5 / 2.0 s) is a fresh first round; the marks allow for a loaded bar held out for 3-5 rounds. The score is each punch's lowest round, added.",
  defaultLevel: 'standard',
  levels: {
    beginner: {
      detail: '3 rounds · a light bar 7-11 kg · 0:30 shadowbox', minutes: 9, load: 'Light bar 7-11 kg (15-25 lb), a broomstick or 2 light dumbbells', rounds: 3,
      missionLine: '3 ROUNDS · 4 × 0:30 BAR DRILLS · 0:30 SHADOWBOX · 0:30 REST', excludeAlts: NO_HOP,
      slots: barFight(30), pace: { elite: 35, standard: 29, beginner: 24 },
    },
    standard: {
      detail: '4 rounds · the empty bar · 0:45 shadowbox', minutes: 13, load: 'Empty bar 20/15 kg (45/35 lb)', rounds: 4,
      missionLine: '4 ROUNDS · 4 × 0:30 BAR DRILLS · 0:45 SHADOWBOX · 0:30 REST', excludeAlts: NO_HOP,
      slots: barFight(45), pace: { elite: 46, standard: 37, beginner: 30 },
    },
    elite: {
      detail: '5 rounds · the bar + 2.5 kg a side · 1:00 shadowbox · a hop is allowed', minutes: 17, load: 'Empty bar + 2.5 kg (5 lb) a side', rounds: 5, difficulty: 'Hard',
      missionLine: '5 ROUNDS · 4 × 0:30 BAR DRILLS · 1:00 SHADOWBOX · 0:30 REST',
      slots: barFight(60), pace: { elite: 44, standard: 35, beginner: 28 },
    },
  },
};

// ── 28 · TOUCH THE SKY ──────────────────────────────────────────────────────
// A barbell complex, down the lifts and back up, without setting the bar
// down: one complex a round, 2:00 of rest after it. Not a race: the score is
// the rounds held with the bar never down (scoreRule 'roundsHeld'), plus the
// reps into the next round at the cap; the time is kept for the record. It
// runs on the for-time clock (count-up, ROUND, FINISH, the cap), and SOLO
// times the 2:00 rest after each ROUND (missionSolo roundRestSec). The pace
// tiers are rounds held ({ held, of }); timeSec is the time at the count with
// the rests, which only the honesty floor, the expected time and the XP read.
// The count is a strength cadence, the level's own (ELITE's heavier bar at
// the standard column); rep 1 includes setting up over the bar.
//
// No swap may put the bar down inside the round: the backpack, plate and
// no-gear moves, and back squats (the bar overhead behind the neck between a
// good morning and a press), are never offered. A heavy row's lighter option
// is a lighter bar: the scale line. Swapping the good mornings to RDLs means
// lowering the bar to the hips and cleaning it back up: the step says so.
// Every front squat comes straight from the rack, so the cleans never swap
// down to High Pulls (no catch: the bar would never reach the rack). Power
// Cleans' own cue offers dumbbells, which this bar-only mission has none of:
// the step names the bar move instead.
const SKY_OUT = ['backpack-rdl', 'plate-goblet-squat', 'pike-push-up', 'bb-back-squat', 'bb-high-pull'];
const SKY_POWER = { key: 'clean', is: 'bb-power-clean', then: 'Never been coached on the clean? Take Hang Muscle Cleans.', else: null };
const SKY_GM_DOWN = { key: 'good-morning', is: 'bb-rdl', then: 'Lower the bar to the hips for the RDLs, then clean it back up.', else: null };
const SKY_GM_UP = { key: 'good-morning', is: 'bb-rdl', then: 'Lower the bar to the hips for the RDLs.', else: null };
const SKY_RACKED = { key: 'front-squat', is: 'bb-front-squat', then: 'The bar is already in the rack.', else: null };
const sky = (n) => [complex('Touch the Sky', [
  s('bb-deadlift', n, { swapKey: 'deadlift' }), s('bb-hang-power-clean', n, { swapKey: 'clean', noteIf: SKY_POWER }), s('bb-front-rack-good-morning', n, { swapKey: 'good-morning', noteIf: SKY_GM_DOWN }),
  s('bb-front-squat', n, { swapKey: 'front-squat', noteIf: SKY_RACKED }), s('bb-strict-press', n, { swapKey: 'press' }), s('bb-front-squat', n, { swapKey: 'front-squat', noteIf: SKY_RACKED }),
  s('bb-front-rack-good-morning', n, { swapKey: 'good-morning', noteIf: SKY_GM_UP }), s('bb-hang-power-clean', n, { swapKey: 'clean' }), s('bb-deadlift', n, { swapKey: 'deadlift' }),
], { swapKey: 'complex', rest: 120, setupMs: 3000 })];
// The tiers: an elite or a standard lifter holds every round at the level;
// a beginner at it usually puts the bar down once.
const skyPace = (of, [elite, standard, beginner]) => ({
  elite: { held: of, of, timeSec: elite }, standard: { held: of, of, timeSec: standard }, beginner: { held: of - 1, of, timeSec: beginner },
});
const TOUCH_THE_SKY = {
  id: 'touch_the_sky', launch: 28, title: 'TOUCH THE SKY', tag: 'Barbell', loadout: 'barbell', themes: [], format: 'forTime', formatLabel: 'COMPLEX',
  difficulty: 'Hard', focus: 'Full Body', workoutType: 'Weighted', hotel: false, quiet: false, guided: true, ...OWN,
  countAt: { elite: 'standard' },
  loadoutLine: '1 BARBELL + PLATES · 2 × 2 M', scoreLine: 'ROUNDS WITH THE BAR NEVER DOWN · THE TIME IS FOR THE RECORD',
  scoreRule: { kind: 'roundsHeld', label: 'ROUNDS, BAR NEVER DOWN' },
  scale: 'Lighter bar, or the beginner level: 2 rounds of 3 each. Never been coached on the clean? Hang Muscle Cleans. Good mornings feel wrong? Romanian Deadlifts.',
  note: "Warm up 5 min, then 1 round with the empty bar. Pick the load your press can handle for every rep. Don't put the bar down inside a round. Low back rounding on the good mornings? Stop the round there. Not a race: every rep clean, rest the full 2:00. In AT YOUR PACE, tap ROUND after each round to time the rest.",
  introSay: "Touch the sky. Five of each, down the lifts and back up. Don't put the bar down until the round is done.",
  tips: ['Pick a load your press can handle for every rep.', 'Chest up and soft knees on the good mornings.'],
  guidedHelp: 'The coach counts every rep, calls each lift and times the rests.',
  paceBasis: 'Coach estimate: a round takes about 2:00 at the count. The score is the rounds you hold with the bar never down. The time, rests in it, is for the record, not a race.',
  defaultLevel: 'standard',
  levels: {
    beginner: {
      detail: '2 rounds · 3 each · the empty bar · cap 15:00', minutes: 6, load: 'The empty bar, 20/15 kg (45/35 lb), or lighter', rounds: 2, capSec: 900,
      introSay: "Touch the sky. Three of each, down the lifts and back up. Don't put the bar down until the round is done.",
      missionLine: '2 ROUNDS · 27 REPS A ROUND, BAR NEVER DOWN · 2:00 REST · CAP 15:00', excludeAlts: SKY_OUT,
      slots: sky(3), pace: skyPace(2, [270, 330, 420]),
    },
    standard: {
      detail: '3 rounds · M 43 kg / W 30 kg · cap 20:00', minutes: 11, load: 'M 43 kg (95 lb) / W 30 kg (65 lb)', rounds: 3, capSec: 1200,
      missionLine: '3 ROUNDS · 45 REPS A ROUND, BAR NEVER DOWN · 2:00 REST · CAP 20:00', excludeAlts: SKY_OUT,
      slots: sky(5), pace: skyPace(3, [570, 660, 780]),
    },
    elite: {
      detail: '4 rounds · M 57-66 kg / W 39-43 kg · cap 25:00', minutes: 15, load: 'M 57-66 kg (125-145 lb) / W 39-43 kg (85-95 lb)', rounds: 4, capSec: 1500,
      missionLine: '4 ROUNDS · 45 REPS A ROUND, BAR NEVER DOWN · 2:00 REST · CAP 25:00', excludeAlts: SKY_OUT,
      slots: sky(5), pace: skyPace(4, [880, 1000, 1160]),
    },
  },
};

// ── 29 · NO CONTINUES ───────────────────────────────────────────────────────
// Max effort until the bell touches the floor (`untilDown`; see missionSolo).
// A SET is one block: both hands, then the left arm, then the right, and
// round again. The blocks chain with no rest; rep 1 of each includes the
// hand switch. 30 rounds (90 sets) is more than any 30:00 run reaches at
// the count, so the safety cap always ends the run first. No swap may take
// the bell out of the hand: that is the bell touching the floor, the end of
// the run. So the moves that start from the floor, every no-gear move (a
// backpack, a push-up, a bridge) and every dumbbell move (picking one up
// means putting the bell down) are never offered: only a swap that keeps the
// same bell in the hand (halos, cleans, high pulls, push presses). A
// dumbbell for the whole run is the scale line. Where that leaves a row with
// no swap (the swings, the rows), the lighter option is a lighter bell.
const NC_FLOOR = [
  'kb-deadlift', 'kb-suitcase-deadlift', 'backpack-suitcase-deadlift', 'backpack-row', 'backpack-rdl', 'backpack-halo',
  'pike-push-up', 'incline-push-up', 'knee-push-up', 'push-up', 'diamond-push-up', 'glute-bridge', 'hip-thrust', 'db-hip-thrust',
  'db-swing', 'db-one-arm-swing', 'db-row', 'db-rdl', 'db-press', 'db-halo', 'db-snatch', 'db-clean',
];
const ncBoth = (n) => [
  s('kb-swing', n, { swapKey: 'swing2', name: 'Two-Hand Swings', say: 'swings' }), s('kb-two-hand-row', n, { swapKey: 'row2', say: 'rows' }),
  s('kb-two-hand-high-pull', n, { swapKey: 'pull2', say: 'high pulls' }), s('kb-horn-press', n, { swapKey: 'press2', say: 'presses', note: 'By the horns.' }),
];
// Kettlebell Hang Cleans keep the bell in hand, but their cue starts with a
// deadlift from the floor: the step says to start from the hang.
const NC_HANG = { key: 'snatch', is: 'kb-hang-clean', then: 'Start from the hang: the bell never touches the floor.', else: null };
const ncArm = (n, pullId) => [
  s('kb-one-arm-swing', n, { swapKey: 'swing1', say: 'swings', note: 'All four on the left arm, then the right.' }), s('kb-row', n, { swapKey: 'row1', name: 'One-Arm Rows' }),
  s(pullId, n, { swapKey: 'snatch', noteIf: NC_HANG, ...(pullId === 'kb-one-arm-high-pull' ? { say: 'high pulls' } : {}) }), s('kb-press', n, { swapKey: 'press1', name: 'One-Arm Presses' }),
];
const ncBlock = (name, say, list) => complex(name, list, { swapKey: 'block', sideSay: say, say, setupMs: 2000 });
const noContinues = (n, pullId) => [ncBlock('Both Hands', 'both hands', ncBoth(n)), ncBlock('Left Arm', 'left arm', ncArm(n, pullId)), ncBlock('Right Arm', 'right arm', ncArm(n, pullId))];
const NO_CONTINUES = {
  id: 'no_continues', launch: 29, title: 'NO CONTINUES', tag: 'Kettlebell', loadout: 'bell', themes: [], format: 'maxSets',
  // Not HOTEL OK: snatches and presses overhead, to grip failure, need the ceiling clear.
  difficulty: 'Hard', focus: 'Full Body', workoutType: 'Weighted', hotel: false, quiet: false, guided: true, ...OWN,
  untilDown: true,
  safety: 'Grip starting to open? Park the bell between your feet. Never let it fly.',
  loadoutLine: '1 KETTLEBELL (OR 1 DUMBBELL) · A CLEAR SWING LANE · CHECK THE CEILING', scoreLine: 'SETS + REPS, AND THE TIME', scoreRule: { kind: 'setsReps', label: 'SETS + REPS' },
  scale: 'Lighter bell, or the beginner level (one-arm high pulls for the snatches). Dumbbell: hold it by one end for the two-hand moves.',
  note: "Warm up 3 min: halos, goblet squats, 10 easy swings. Each block is a set: both hands, the left arm, the right arm, then round again. Swing or snatch feeling loose? Don't start the next one. Hot spot or a tear on the palm: put it down. The run ends when the bell touches the floor: tap I PUT IT DOWN. The clock stops at 30:00.",
  introSay: 'No continues. Both hands, left arm, right arm, and keep cycling. When your grip starts to open, park the bell between your feet.',
  guidedHelp: 'The coach counts every rep and calls each switch. Tap I PUT IT DOWN when the bell touches the floor.',
  paceBasis: "Coach estimate: a set takes about 25 s at the count (45 s at ELITE's 5 reps). Grip, not lungs, usually ends it.",
  defaultLevel: 'standard',
  levels: {
    beginner: {
      detail: '3 each · 12/8 kg · one-arm high pulls', minutes: 6, load: '12/8 kg (26/18 lb)', rounds: 30, capSec: 1800,
      missionLine: 'BOTH HANDS · LEFT ARM · RIGHT ARM · 3 EACH · UNTIL THE BELL TOUCHES THE FLOOR',
      excludeAlts: [...NC_FLOOR, 'kb-snatch'], // the beginner pulls high; no swap brings the snatch in
      slots: noContinues(3, 'kb-one-arm-high-pull'), pace: { elite: 15, standard: 10, beginner: 6 },
    },
    standard: {
      detail: '3 each · 16/12 kg', minutes: 5, load: '16/12 kg (35/26 lb)', rounds: 30, capSec: 1800,
      missionLine: 'BOTH HANDS · LEFT ARM · RIGHT ARM · 3 EACH · UNTIL THE BELL TOUCHES THE FLOOR', excludeAlts: NC_FLOOR,
      slots: noContinues(3, 'kb-snatch'), pace: { elite: 12, standard: 8, beginner: 5 },
    },
    elite: {
      detail: '5 each · 24/16 kg', minutes: 7, load: '24/16 kg (53/35 lb)', rounds: 30, capSec: 1800,
      missionLine: 'BOTH HANDS · LEFT ARM · RIGHT ARM · 5 EACH · UNTIL THE BELL TOUCHES THE FLOOR', excludeAlts: NC_FLOOR,
      slots: noContinues(5, 'kb-snatch'), pace: { elite: 9, standard: 6, beginner: 4 },
    },
  },
};

// ── 30 · UPPER LOWER DIPS ───────────────────────────────────────────────────
// The owner's own: 8 dips, then 16 squats, and round again until the dips or
// the squats can't be finished. It runs on NO CONTINUES' until-down engine,
// counting ROUNDS (downUnit 'round'): GUIDED counts every dip and squat and
// calls each round; SOLO taps ROUND after each one (the round timer keeps
// the splits). I'M DONE ends it as a finish, and the 30:00 cap ends it the
// same way. 60 rounds is more than any 30:00 run reaches at the count, so
// the cap always comes first. NO GEAR: the dips go on a fixed bench, a
// sturdy chair against a wall, or parallel bars (never two chairs). Every
// dip stops at 90°; a shoulder pinch is the stop rule (incline push-ups,
// first on every dip row). Every level squats with air squats: a run to
// failure must never end on landings, so no jump is offered at any level
// (altAllowed's until-down rule). ELITE is the parallel-bar dips. The squat
// row stays a squat: no swap walks on to the sprawl and burpee family.
const ULD_OUT = ['squat-thrust', 'sprawl', 'step-back-sprawl', 'level-change-drop', 'burpee', 'step-back-burpee', 'burpee-tuck-jump', 'hindu-squat-knee-strike'];
const uld = (dipId, squatId, dipExtra = {}) => [complex('Dips + Squats', [
  s(dipId, 8, { swapKey: 'dip', ...dipExtra }), s(squatId, 16, { swapKey: 'squat' }),
], { swapKey: 'round', say: 'dips and squats', setupMs: 2000 })];
const UPPER_LOWER_DIPS = {
  id: 'upper_lower_dips', launch: 30, title: 'UPPER LOWER DIPS', tag: 'Bodyweight', loadout: 'none', themes: ['century'], format: 'maxRounds',
  difficulty: 'Hard', focus: 'Full Body', workoutType: 'Bodyweight', hotel: false, quiet: false, guided: true, ...OWN,
  untilDown: true, downUnit: 'round',
  safety: 'Dips stop when your elbows reach 90°. Never sink deeper. Shoulder pinch? Stop the dips.',
  loadoutLine: 'NO GEAR · A FIXED BENCH, A STURDY CHAIR OR PARALLEL BARS FOR THE DIPS', scoreLine: 'ROUNDS + REPS, AND THE TIME', scoreRule: { kind: 'setsReps', label: 'ROUNDS + REPS' },
  scale: 'Beginner level: bent-knee bench dips. Shoulder pinch on any dip? Swap to incline push-ups. ELITE: parallel-bar dips.',
  note: "Warm up 3 min: arm circles, 10 slow squats, 5 incline push-ups. One round is 8 dips, then 16 squats. Go again until you can't finish the dips or the squats, then tap I'M DONE. Never dip on a chair with wheels. The clock stops at 30:00.",
  introSay: "Upper lower dips. Eight dips, sixteen squats, and round again. Stop every dip at ninety degrees. When you can't finish a round, tap I'm done.",
  guidedHelp: "The coach counts every dip and squat and calls each round. Tap I'M DONE when you can't finish one.",
  paceBasis: 'Coach estimate: a round takes about 50 s at the count. The dips usually end it.',
  defaultLevel: 'standard',
  levels: {
    beginner: {
      detail: '8 bent-knee bench dips · 16 squats', minutes: 7, rounds: 60, capSec: 1800, excludeAlts: ULD_OUT,
      missionLine: "8 BENT-KNEE BENCH DIPS · 16 SQUATS · ROUND AGAIN UNTIL YOU CAN'T",
      slots: uld('bench-dip-bent', 'air-squat'), pace: { elite: 14, standard: 9, beginner: 5 },
    },
    standard: {
      detail: '8 bench or bar dips · 16 squats', minutes: 7, rounds: 60, capSec: 1800, excludeAlts: ULD_OUT,
      missionLine: "8 BENCH OR BAR DIPS · 16 SQUATS · ROUND AGAIN UNTIL YOU CAN'T",
      slots: uld('bench-dip', 'air-squat', baseNote('dip', 'bench-dip', 'Parallel bars? Swap to bar dips.')), pace: { elite: 12, standard: 8, beginner: 5 },
    },
    elite: {
      detail: '8 bar dips · 16 squats', minutes: 5, rounds: 60, capSec: 1800, excludeAlts: ULD_OUT,
      missionLine: "8 PARALLEL-BAR DIPS · 16 SQUATS · ROUND AGAIN UNTIL YOU CAN'T",
      slots: uld('parallel-bar-dip', 'air-squat'), pace: { elite: 10, standard: 6, beginner: 4 },
    },
  },
};

// ── 31 · OVERTIME 20 ────────────────────────────────────────────────────────
// A well-known bodyweight benchmark, kept as published: AMRAP 20 of 5
// pull-ups, 10 push-ups and 15 squats, in order (knownAs: captions only).
// STANDARD is the published workout, ELITE adds the source's 9/6 kg vest,
// BEGINNER is its lower-volume 12-minute version (3 / 6 / 9). The scaled
// moves the source gives an intermediate (jumping pull-ups, knee push-ups)
// are the EASIER swaps, except jumping pull-ups: a QUIET, HOTEL OK mission
// never offers a jump to a bar (excludeAlts). NO GEAR: a pull-up bar is optional, so gearPlus lets
// the bar moves in, and a solid door frame is the no-bar swap: altsPlus adds
// Door Frame Rows to the bar moves for this mission only, so no other
// mission's swaps change. GUIDED runs it like ROOM 12: one AMRAP block, the
// coach on the clock. Pace: the source's published guide for the 20-minute
// version at STANDARD; the vest and 12-minute marks are coach estimates.
const C1200 = [{ t: 600, say: 'Halfway.' }, { t: 1140, say: 'One minute.' }, { t: 1190, say: 'Ten seconds.' }];
const DOOR = [{ id: 'door-frame-row', kind: 'no-gear' }];
const OT_OUT = ['jumping-pull-up'];
const overtime = (sec, calls, pullId, pushId, n) => [amrap(sec, 0, [
  s(pullId, n, { swapKey: 'pull' }), s(pushId, 2 * n, { swapKey: 'push-up' }), s('air-squat', 3 * n, { swapKey: 'squat' }),
], calls, { swapKey: 'block' })];
const OVERTIME = {
  id: 'overtime_20', launch: 31, title: 'OVERTIME 20', tag: 'Bodyweight', loadout: 'none', themes: [], format: 'amrap',
  difficulty: 'Hard', focus: 'Full Body', workoutType: 'Bodyweight', hotel: true, quiet: true, guided: true, knownAs: 'Cindy',
  gearPlus: ['bar'], altsPlus: { 'pull-up': DOOR, 'ring-row': DOOR },
  loadoutLine: 'NO GEAR · A PULL-UP BAR, OR A SOLID DOOR FRAME', scoreLine: 'ROUNDS + REPS', scoreRule: { kind: 'roundsReps' },
  scale: 'Beginner level: AMRAP 12 of 3 door frame rows, 6 incline push-ups and 9 squats. No bar? Swap the pull-ups to door frame rows. Easier: ring rows and knee push-ups. No kipping until you can do 5 strict pull-ups.',
  note: 'Warm up 3 min: march in place, arm circles, 5 door frame rows, 10 squats, 5 push-ups. Go in order: pull-ups, push-ups, squats, then round again. Incline push-ups go on a desk or counter, not the soft bed.',
  introSay: 'Overtime twenty. Five pull-ups, ten push-ups, fifteen squats. As many rounds as you can.',
  guidedHelp: GUIDED_HELP_AMRAP,
  paceBasis: 'Published guide for the 20-minute version, and sources disagree: beginner 8-12 rounds, intermediate 13-18, advanced 19-23, elite 24+. The published bands allow kipping; strict rounds run lower. The vest and 12-minute marks are coach estimates. Your last score is the real benchmark.',
  defaultLevel: 'standard',
  levels: {
    beginner: {
      detail: 'AMRAP 12 · 3 door frame rows · 6 incline push-ups · 9 squats', minutes: 12, rounds: 1,
      missionLine: 'AMRAP 12 · 3 DOOR FRAME ROWS · 6 INCLINE PUSH-UPS · 9 SQUATS',
      introSay: 'Overtime twelve. Three rows, six push-ups, nine squats. As many rounds as you can.',
      slots: overtime(720, C720, 'door-frame-row', 'incline-push-up', 3), pace: { elite: 18, standard: 12, beginner: 8 }, excludeAlts: OT_OUT,
    },
    standard: {
      detail: 'AMRAP 20 · 5 pull-ups · 10 push-ups · 15 squats', minutes: 20, rounds: 1,
      missionLine: 'AMRAP 20 · 5 PULL-UPS · 10 PUSH-UPS · 15 SQUATS',
      slots: overtime(1200, C1200, 'pull-up', 'push-up', 5), pace: { elite: 24, standard: 13, beginner: 8 }, excludeAlts: OT_OUT,
    },
    elite: {
      detail: 'AMRAP 20 · 9/6 kg vest', minutes: 20, load: '9/6 kg (20/14 lb) vest', rounds: 1,
      loadoutLine: 'A 9/6 KG VEST · A PULL-UP BAR, OR A SOLID DOOR FRAME',
      missionLine: 'AMRAP 20 · 5 PULL-UPS · 10 PUSH-UPS · 15 SQUATS · IN A VEST',
      slots: overtime(1200, C1200, 'pull-up', 'push-up', 5), pace: { elite: 20, standard: 12, beginner: 7 }, excludeAlts: OT_OUT,
    },
  },
};

// ── 32-36 · MAX OUT ─────────────────────────────────────────────────────────
// Five max-rep workouts (format 'maxReps', theme MAX OUT): a rotation of
// stations, one SET at each, clean reps until the form breaks, then DONE and
// the reps entered; the next station works a different muscle region while the
// last one rests, and after the last station the round's longer rest. The
// rounds are the sets each (2 to 5). GUIDED and AT YOUR PACE both run them
// (data/missionSolo MAX REPS). The score is every rep added; the XP is time
// plus the finish, never reps (maxRepsXp). Owner-approved safety: no barbell
// bench, back squat or deadlift to failure (push-ups, dumbbell floor presses,
// front squats and a capped backpack deadlift instead); rows come to the floor
// every rep; a loaded set leaves reps in the tank. Every number below is a
// coach estimate (see paceBasis): first-set reps in `reps`, a rest after every
// set (the last station's is the round rest).
const mx = (moveId, reps, rest, extra = {}) => ({ moveId, mode: 'reps', reps, rest, max: true, cadenceMs: null, sides: null, ...extra });
const MAX_CHG = { beginner: 30, standard: 25, elite: 20 };
const MAX_RND = { beginner: 90, standard: 75, elite: 60 };
// rows: [moveId, first-set reps, swapKey, reps to leave in the tank?]. `plus`:
// seconds added to every station change (TANK MODE's bar change).
const station = (lv, rows, plus = 0) => rows.map(([id, reps, key, leave = 0], i) => mx(id, reps, i === rows.length - 1 ? MAX_RND[lv] : MAX_CHG[lv] + plus, {
  swapKey: key, prefix: `STATION ${i + 1}`, ...(leave ? { leave } : {}),
}));
const MAX_COMMON = {
  tag: 'Max Reps', themes: ['maxout'], format: 'maxReps', difficulty: 'Hard', focus: 'Full Body', guided: true, ...OWN,
  scoreLine: 'TOTAL REPS, EVERY SET ADDED', scoreRule: { kind: 'totalReps', label: 'TOTAL REPS' },
  guidedHelp: 'The coach calls each move and the rests. You tap DONE and enter your reps.',
  paceBasis: 'Coach estimate: first-set reps, each later set about 85% of the one before; hinge moves flat at their cap.',
  defaultLevel: 'standard',
};
const MAX_NOTE = 'Warm up 3 to 4 minutes. Go in order, then round again. Stop a set the moment your form breaks: the last clean rep counts. Breathe out on the effort, never hold your breath. Chest pain, dizziness or a sharp pain: stop. Dark urine or severe swelling after: see a doctor.';
const STOP_TWO = ' Stop two reps short.';

// ── 32 · BOSS RUSH ──────────────────────────────────────────────────────────
const BOSS_RUSH = {
  ...MAX_COMMON, id: 'boss_rush', launch: 32, title: 'BOSS RUSH', loadout: 'none', workoutType: 'Bodyweight', hotel: true, quiet: true,
  loadoutLine: 'NO GEAR · 2 × 2 M OF FLOOR',
  safety: 'Stop a set when your form breaks, not when it burns. Sit-ups: hands on your chest, never pull on your neck.',
  scale: 'Beginner: knee push-ups and crunches, 2 rounds, stop 2 reps short. Harder: diamond push-ups, V-ups.',
  note: `${MAX_NOTE} Reps drop every round. That is the point.`,
  introSay: 'Boss rush. Push-ups, squats, sit-ups. Max reps on each, then switch.',
  levels: {
    beginner: {
      detail: '2 rounds · knee push-ups, squats, crunches', minutes: 8, rounds: 2, capSec: 900, difficulty: 'Normal',
      missionLine: '2 ROUNDS · KNEE PUSH-UPS · SQUATS · CRUNCHES · MAX REPS',
      introSay: `Boss rush. Push-ups, squats, sit-ups. Max reps on each, then switch.${STOP_TWO}`,
      slots: station('beginner', [['knee-push-up', 12, 'push', 2], ['air-squat', 20, 'squat', 2], ['crunch', 15, 'core', 2]]),
      pace: { elite: 115, standard: 85, beginner: 60 },
    },
    standard: {
      detail: '3 rounds · push-ups, squats, sit-ups', minutes: 13, rounds: 3, capSec: 1200,
      missionLine: '3 ROUNDS · PUSH-UPS · SQUATS · SIT-UPS · MAX REPS',
      slots: station('standard', [['push-up', 20, 'push'], ['air-squat', 30, 'squat'], ['sit-up', 25, 'core']]),
      pace: { elite: 250, standard: 195, beginner: 135 },
    },
    elite: {
      detail: '5 rounds · push-ups, squats, sit-ups', minutes: 23, rounds: 5, capSec: 2100,
      missionLine: '5 ROUNDS · PUSH-UPS · SQUATS · SIT-UPS · MAX REPS',
      slots: station('elite', [['push-up', 35, 'push'], ['air-squat', 40, 'squat'], ['sit-up', 35, 'core']]),
      pace: { elite: 530, standard: 410, beginner: 285 },
    },
  },
};

// ── 33 · HEALTH BAR ─────────────────────────────────────────────────────────
// MIXED (its loadout lets the pull-up bar in): the backpack deadlift is the
// owner's deadlift, capped, with core last so the sit-up family never follows a
// loaded hinge. No bar: the pull-ups swap to dumbbell rows. MIXED also lets the
// barbell in, so the hinge row may never swap on to a barbell deadlift or RDL:
// no barbell deadlift to failure (HB_OUT).
const HB_OUT = ['bb-deadlift', 'bb-rdl'];
const HEALTH_BAR = {
  ...MAX_COMMON, id: 'health_bar', launch: 33, title: 'HEALTH BAR', loadout: 'mixed', workoutType: 'Bodyweight', hotel: false, quiet: false,
  loadoutLine: 'A PULL-UP BAR · A BACKPACK, 8-10 KG (12-15 KG AT ELITE) · 2 × 2 M OF FLOOR',
  safety: 'Let go and drop to the floor when your grip opens. Stop the lift when your back wants to round. Grip gone? Hug the pack to your chest.',
  scale: 'Beginner: jumping pull-ups, slow climbers. No bar: swap the pull-ups to dumbbell rows.',
  note: `${MAX_NOTE} Pack the backpack with water bottles or books and keep it tight to your back.`,
  introSay: 'Health bar. Pull-ups, backpack deadlifts, mountain climbers. Max reps on each, then switch.',
  levels: {
    beginner: {
      detail: '2 rounds · jumping pull-ups, backpack deadlifts, slow climbers', minutes: 8, rounds: 2, capSec: 900, difficulty: 'Normal',
      missionLine: '2 ROUNDS · JUMPING PULL-UPS · BACKPACK DEADLIFTS · SLOW CLIMBERS · MAX REPS', excludeAlts: HB_OUT,
      introSay: `Health bar. Pull-ups, backpack deadlifts, mountain climbers. Max reps on each, then switch.${STOP_TWO}`,
      slots: station('beginner', [['jumping-pull-up', 10, 'pull', 2], ['backpack-rdl', 10, 'hinge', 2], ['slow-climber', 30, 'core', 2]]),
      pace: { elite: 120, standard: 95, beginner: 65 },
    },
    standard: {
      detail: '3 rounds · pull-ups, backpack deadlifts, climbers', minutes: 11, rounds: 3, capSec: 1200,
      missionLine: '3 ROUNDS · PULL-UPS · BACKPACK DEADLIFTS · CLIMBERS · MAX REPS', excludeAlts: HB_OUT,
      slots: station('standard', [['pull-up', 8, 'pull'], ['backpack-rdl', 12, 'hinge'], ['mountain-climber', 60, 'core']]),
      pace: { elite: 275, standard: 210, beginner: 150 },
    },
    elite: {
      detail: '4 rounds · pull-ups, backpack deadlifts, climbers', minutes: 15, rounds: 4, capSec: 1500,
      missionLine: '4 ROUNDS · PULL-UPS · BACKPACK DEADLIFTS · CLIMBERS · MAX REPS', excludeAlts: HB_OUT,
      slots: station('elite', [['pull-up', 15, 'pull'], ['backpack-rdl', 12, 'hinge'], ['mountain-climber', 100, 'core']]),
      pace: { elite: 540, standard: 415, beginner: 290 },
    },
  },
};

// ── 34 · COMBO METER ────────────────────────────────────────────────────────
const COMBO_METER = {
  ...MAX_COMMON, id: 'combo_meter', launch: 34, title: 'COMBO METER', loadout: 'bell', workoutType: 'Weighted', hotel: false, quiet: false,
  loadoutLine: '1 KETTLEBELL (OR 1 DUMBBELL) · A CLEAR SWING LANE · CHECK THE CEILING',
  safety: 'Stop a set when the bell slows or your back wants to round. Never press through a stall.',
  scale: 'Pick a bell you could swing 20 times. Beginner: lighter bell, dead bugs with no bell.',
  note: `${MAX_NOTE} Set the bell down before the dead bugs.`,
  introSay: 'Combo meter. Swings, presses, squats, dead bugs. Max clean reps on each, then switch.',
  levels: {
    beginner: {
      detail: '2 rounds · 12/8 kg · swings, presses, squats, dead bugs', minutes: 10, load: '12/8 kg (26/18 lb) bell', rounds: 2, capSec: 1200, difficulty: 'Normal',
      missionLine: '2 ROUNDS · SWINGS · PRESSES · SQUATS · DEAD BUGS · MAX REPS', excludeAlts: ['pike-push-up'],
      introSay: `Combo meter. Swings, presses, squats, dead bugs. Max clean reps on each, then switch.${STOP_TWO}`,
      slots: station('beginner', [['kb-swing', 12, 'hinge', 2], ['kb-horn-press', 8, 'press', 2], ['goblet-squat', 15, 'squat', 2], ['dead-bug', 16, 'core', 2]]),
      pace: { elite: 125, standard: 95, beginner: 65 },
    },
    standard: {
      detail: '3 rounds · 16/12 kg · swings, presses, squats, dead bugs', minutes: 16, load: '16/12 kg (35/26 lb) bell', rounds: 3, capSec: 1500,
      missionLine: '3 ROUNDS · SWINGS · PRESSES · SQUATS · DEAD BUGS · MAX REPS', excludeAlts: ['pike-push-up'],
      slots: station('standard', [['kb-swing', 15, 'hinge'], ['kb-horn-press', 12, 'press'], ['goblet-squat', 20, 'squat'], ['kb-dead-bug', 20, 'core']]),
      pace: { elite: 230, standard: 180, beginner: 125 },
    },
    elite: {
      detail: '4 rounds · 24/16 kg · swings, presses, squats, dead bugs', minutes: 21, load: '24/16 kg (53/35 lb) bell', rounds: 4, capSec: 2100,
      missionLine: '4 ROUNDS · SWINGS · PRESSES · SQUATS · DEAD BUGS · MAX REPS', excludeAlts: ['pike-push-up'],
      slots: station('elite', [['kb-swing', 15, 'hinge'], ['kb-horn-press', 15, 'press'], ['goblet-squat', 25, 'squat'], ['kb-dead-bug', 24, 'core']]),
      pace: { elite: 370, standard: 285, beginner: 200 },
    },
  },
};

// ── 35 · TANK MODE ──────────────────────────────────────────────────────────
// The barbell is for rows and front squats only, always two reps short. Rows
// are dead-stop: the bar is on the floor at every failure. A barbell bench,
// back squat or deadlift to failure needs a rack and a spotter, so none is
// offered. +5 s on every station change for the bar.
const TANK_MODE = {
  ...MAX_COMMON, id: 'tank_mode', launch: 35, title: 'TANK MODE', loadout: 'barbell', workoutType: 'Weighted', hotel: false, quiet: false,
  loadoutLine: '1 BARBELL + PLATES · A CLEAR FLOOR · BUMPER PLATES IF YOU HAVE THEM',
  safety: 'Stop 2 reps short on every set. Clear floor, bumper plates if you have them, never grind a rep.',
  scale: 'Barbell bench, back squat and deadlift are not offered: they need a rack and a spotter. Beginner: empty bar.',
  note: `${MAX_NOTE} The bar goes down on the floor at the end of every row set.`,
  introSay: 'Tank mode. Rows, push-ups, front squats. Max clean reps. Stop two short.',
  levels: {
    beginner: {
      detail: '2 rounds · empty bar · rows, knee push-ups, goblet squats', minutes: 8, load: 'empty bar 20/15 kg (45/33 lb)', rounds: 2, capSec: 900, difficulty: 'Normal',
      missionLine: '2 ROUNDS · ROWS · KNEE PUSH-UPS · GOBLET SQUATS · MAX REPS', excludeAlts: ['bb-back-squat'],
      slots: station('beginner', [['bb-dead-stop-row', 12, 'pull', 2], ['knee-push-up', 12, 'push', 2], ['plate-goblet-squat', 12, 'squat', 2]], 5),
      pace: { elite: 85, standard: 65, beginner: 45 },
    },
    standard: {
      detail: '3 rounds · 30/20 kg · rows, push-ups, front squats', minutes: 12, load: '30/20 kg (65/45 lb)', rounds: 3, capSec: 1200,
      missionLine: '3 ROUNDS · ROWS · PUSH-UPS · FRONT SQUATS · MAX REPS', excludeAlts: ['bb-back-squat'],
      slots: station('standard', [['bb-dead-stop-row', 15, 'pull', 2], ['push-up', 20, 'push'], ['bb-front-squat', 15, 'squat', 2]], 5),
      pace: { elite: 165, standard: 130, beginner: 90 },
    },
    elite: {
      detail: '4 rounds · 45/30 kg · rows, push-ups, front squats', minutes: 18, load: '45/30 kg (100/65 lb)', rounds: 4, capSec: 1800,
      missionLine: '4 ROUNDS · ROWS · PUSH-UPS · FRONT SQUATS · MAX REPS', excludeAlts: ['bb-back-squat'],
      slots: station('elite', [['bb-dead-stop-row', 20, 'pull', 2], ['push-up', 35, 'push'], ['bb-front-squat', 20, 'squat', 2]], 5),
      pace: { elite: 310, standard: 240, beginner: 165 },
    },
  },
};

// ── 36 · DUAL WIELD ─────────────────────────────────────────────────────────
// Two dumbbells. The floor press is the safe bench: the floor stops the depth
// and a dumbbell can be lowered to the side. No pull-up bar needed.
const DUAL_WIELD = {
  ...MAX_COMMON, id: 'dual_wield', launch: 36, title: 'DUAL WIELD', loadout: 'mixed', workoutType: 'Hybrid', hotel: true, quiet: false,
  loadoutLine: '2 DUMBBELLS · FLOOR SPACE · A PULL-UP BAR IF YOU HAVE ONE',
  safety: 'A stalled dumbbell goes down to your sides, never over your face. Stop a lunge at the first wobble.',
  scale: 'Pick dumbbells you could floor-press about 15 times. Beginner: lighter dumbbells, knee pull-throughs.',
  note: `${MAX_NOTE} Set the dumbbells down before you change station.`,
  introSay: 'Dual wield. Floor presses, lunges, rows, pull-throughs. Max clean reps on each, then switch.',
  levels: {
    beginner: {
      detail: '2 rounds · floor presses, lunges, rows, knee pull-throughs', minutes: 10, rounds: 2, capSec: 900, difficulty: 'Normal',
      missionLine: '2 ROUNDS · FLOOR PRESSES · LUNGES · ROWS · KNEE PULL-THROUGHS · MAX REPS',
      introSay: `Dual wield. Floor presses, lunges, rows, pull-throughs. Max clean reps on each, then switch.${STOP_TWO}`,
      slots: station('beginner', [['db-floor-press', 10, 'chest', 2], ['kb-reverse-lunge', 12, 'quads', 2], ['db-bent-over-row', 10, 'back', 2], ['kb-knee-pull-through', 12, 'core', 2]]),
      pace: { elite: 105, standard: 80, beginner: 55 },
    },
    standard: {
      detail: '3 rounds · floor presses, lunges, rows, pull-throughs', minutes: 15, rounds: 3, capSec: 1500,
      missionLine: '3 ROUNDS · FLOOR PRESSES · LUNGES · ROWS · PULL-THROUGHS · MAX REPS',
      slots: station('standard', [['db-floor-press', 15, 'chest'], ['kb-reverse-lunge', 20, 'quads'], ['db-bent-over-row', 14, 'back'], ['kb-plank-pull-through', 20, 'core']]),
      pace: { elite: 230, standard: 180, beginner: 125 },
    },
    elite: {
      detail: '4 rounds · floor presses, lunges, rows, pull-throughs', minutes: 21, rounds: 4, capSec: 2100,
      missionLine: '4 ROUNDS · FLOOR PRESSES · LUNGES · ROWS · PULL-THROUGHS · MAX REPS',
      slots: station('elite', [['db-floor-press', 20, 'chest'], ['kb-reverse-lunge', 24, 'quads'], ['db-bent-over-row', 18, 'back'], ['kb-plank-pull-through', 30, 'core']]),
      pace: { elite: 380, standard: 295, beginner: 205 },
    },
  },
};

export const LOADOUT_MISSIONS = [
  IRON_CLOCK, ONE_BELL, FIVE_ROUND, BEST_OF_3, STEEL, CHECKPOINT, ROOM_12, HIT_COMBO, TUTORIAL, TURBO, QUOTA,
  HONOR, KO_SPRINT, OVERHEAD_RUSH, BURNOUT, STANCE, ROOKIE, FIRST_BELL, CONTINUE_BELL, CARRY_ON, SURGE, MIDLINE, LEG_SWEEP, CHARGE_UP, OXYGEN_DEBT, HOT_LAPS,
  BAR_FIGHT, TOUCH_THE_SKY, NO_CONTINUES, UPPER_LOWER_DIPS, OVERTIME,
  BOSS_RUSH, HEALTH_BAR, COMBO_METER, TANK_MODE, DUAL_WIELD,
];

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
// `plus`: gear one mission lets in on top of its loadout (OVERTIME 20's
// optional pull-up bar, def.gearPlus).
export function allowedGear(loadout, profile, plus = null) {
  return new Set([...(LOADOUT_GEAR[loadout] || ['none']), ...(profile || []), ...(plus || [])]);
}
// A move's alts in this mission: the catalog's, plus any the mission adds
// for itself (def.altsPlus: OVERTIME 20's door frame rows on the bar moves).
function altsOf(mission, moveId) {
  const own = moveById(moveId)?.alts || [];
  const plus = mission?.altsPlus?.[moveId];
  return Array.isArray(plus) && plus.length ? [...own, ...plus.filter(a => !own.some(o => o.id === a.id))] : own;
}

const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
const hasList = (slot) => Array.isArray(slot?.list);
// restAfter: an EMOM's rest after this window (FIRST BELL). climb: reps an
// AMRAP block adds to every step each round (CHARGE UP 12). scored: false
// keeps a row out of the score whatever move a swap puts in it (HOT LAPS'
// run). See missionSolo.
const SLOT_KEYS = ['name', 'moveId', 'baseMoveId', 'defaultMoveId', 'swapKey', 'mode', 'reps', 'work', 'rest', 'window', 'cadenceMs', 'setupMs',
  'unit', 'sides', 'list', 'calls', 'prefix', 'say', 'sayLead', 'sideSay', 'note', 'count', 'scaled', 'restAfter', 'climb', 'scored',
  'max', 'leave']; // max: a MAX REPS station (the athlete's own set); leave: reps left in the tank
const STEP_KEYS = ['name', 'moveId', 'baseMoveId', 'defaultMoveId', 'swapKey', 'reps', 'unit', 'sides', 'cadenceMs', 'say', 'note', 'noteIf', 'scaled', 'scored'];
// Only the fields a Slot / Step has, in one order, with no undefined noise.
const pick = (src, keys) => {
  const o = {};
  keys.forEach(k => { if (src[k] !== undefined && src[k] !== null) o[k] = src[k]; else if (k === 'cadenceMs' && src[k] === null) o[k] = null; });
  return o;
};
const countCol = (def, level) => def?.countAt?.[level] || level;
// The display unit of a move counted in calories or metres (HOT LAPS' run).
const UNIT_WORD = { cal: 'CAL', m: 'M' };

// One authored slot or step at its base move, filled from the catalog.
function baseStep(d, col, amrapStep) {
  const move = moveById(d.moveId);
  return pick({
    ...clone(d),
    name: d.name || move?.name || d.moveId,
    baseMoveId: d.moveId, defaultMoveId: d.moveId,
    unit: UNIT_WORD[move?.unit],
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
    unit: d.mode === 'reps' ? UNIT_WORD[move?.unit] : undefined,
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
  // A total-reps AMRAP (CHARGE UP 12) reads its pace in reps here, which only
  // over-counts: the volume cap stays on the safe side.
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
  if (!allowedGear(mission.loadout, gear, mission.gearPlus).has(move.gear)) return false;      // 1 · gear
  const others = allItems(mission).filter(it => it.swapKey !== swapKey);
  if (others.some(it => it.moveId === alt.id)) return false;                                   // 2 · not another row's move
  // Rule 3 reads the AUTHORED slot mode, so a shadowbox minute swapped to row calories can still swap back.
  if (move.timedOnly) {                                                                        // 3 · timed-only: plain timed slots
    const base = baseOf(mission);
    const plain = base.filter(sl => !hasList(sl) && sl.swapKey === swapKey);
    const inList = base.some(sl => hasList(sl) && sl.list.some(st => st.swapKey === swapKey));
    if (inList || !plain.length || plain.some(sl => sl.mode !== 'timed')) return false;
  }
  if (mission.level === 'beginner' && move.flyingKnee) return false;                           // 4 · no flying knees for beginners
  // Rule 5 looks at the OTHER keys, so swapping a flying knee itself onto a jump move stays possible.
  if (move.jumps && others.some(it => moveById(it.moveId)?.flyingKnee)) return false;          // 5 · landing budget
  if (move.jumps && mission.quiet) return false;                                               // 6 · quiet room
  if ((mission.excludeAlts || []).includes(alt.id)) return false;                              // 7 · level exclusions
  if (move.maxTotalReps != null && totalRepsForKey(mission, swapKey, alt.id, alt.x ?? 1) > move.maxTotalReps) return false; // 8 · volume
  if (move.jumps && (mission.untilDown || isMaxReps(mission))) return false;                   // 9 · a run to failure never ends on landings
  if (isMaxReps(mission)) {                                                                    // 10 · a MAX OUT swap stays in its station's muscle region,
    const base = baseOf(mission).flatMap(sl => (hasList(sl) ? sl.list : [sl])).find(it => it.swapKey === swapKey);
    if (!base || regionOf(alt.id) !== regionOf(base.moveId)) return false;                     //      is no 'all on one side, then switch' move
    if (move.sides === 'switch' || move.timedOnly) return false;                               //      and no timed-only move
  }
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
    altsOf(mission, id).forEach(alt => {
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
    scoreRule: clone(L.scoreRule || def.scoreRule),
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
    scoreLine: L.scoreLine || def.scoreLine,
    scale: def.scale,
    note: def.note,
    // A level's own brief when its reps differ (BEGINNER's 3 of each).
    introSay: L.introSay ?? def.introSay ?? '',
    tips: [...(def.tips || [])],
    excludeAlts: [...(L.excludeAlts || [])],
    scaled: false,
    swaps: [],
    gearBanner: null,
    // Only on the missions that have them, so every other mission builds as before.
    ...(def.origin ? { origin: def.origin } : {}),
    ...(def.formatLabel ? { formatLabel: def.formatLabel } : {}),
    ...(def.untilDown ? { untilDown: true } : {}),
    ...(def.downUnit ? { downUnit: def.downUnit } : {}),
    ...(def.safety ? { safety: def.safety } : {}),
    ...(def.gearPlus ? { gearPlus: [...def.gearPlus] } : {}),
    ...(def.altsPlus ? { altsPlus: clone(def.altsPlus) } : {}),
  };
  m = resolveNotes(m);
  m.exercises = m.exercises.map(slot => (slot.window ? { ...slot, rest: windowRest(slot, estimateWorkSeconds(slot)) } : slot));
  m.clockSec = missionClockSec(m);

  // Gear defaults: a base move whose gear the viewer lacks opens on its first
  // allowed alt (a NO GEAR one first). The card shows a banner, not SCALED.
  const allowed = allowedGear(def.loadout, gear, def.gearPlus);
  rowItems(m).forEach(({ item }) => {
    const base = moveById(item.baseMoveId);
    if (!base || allowed.has(base.gear)) return;
    const ok = altsOf(m, item.baseMoveId).filter(a => altAllowed(m, item.swapKey, a, { gear }));
    const alt = ok.find(a => a.kind === 'no-gear') || ok[0];
    if (!alt) return;
    m = withDefault(m, item.swapKey, alt.id);
    m = swapMissionMove(m, item.swapKey, alt.id, { gear });
    if (!m.gearBanner) m.gearBanner = `No ${GEAR_WORD[base.gear] || base.gear} in your gear. Using ${moveById(alt.id).name}. Tap the swap icon to change.`;
  });

  // The user's picks, in the order they were made (the map's insertion order),
  // so the rebuild replays what SOLO applied live. A pick can depend on an
  // earlier one: Back Squats → Front Squats is only legal once the front-squat
  // row has moved off that move (rule 2). In card order such a pick was
  // checked too early and dropped. A pick that fails is retried after every
  // pass that applied something, so the result never hangs on the order
  // either. What still fails (say, after a level change) drops silently.
  let pending = Object.entries(swaps || {}).filter(([, to]) => typeof to === 'string');
  for (let applied = true; applied && pending.length;) {
    applied = false;
    pending = pending.filter(([key, to]) => {
      const item = rowItems(m).find(r => r.item.swapKey === key)?.item;
      if (!item || to === item.moveId) return false;
      if (!isSwapAllowed(m, key, to, { gear })) return true;
      m = swapMissionMove(m, key, to, { gear });
      applied = true;
      return false;
    });
  }
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
  out.unit = step || out.mode === 'reps' ? UNIT_WORD[to.unit] : undefined;
  out.cadenceMs = cadenceFor(toId, col); // an authored cadenceMs belongs to the base move only
  if (out.calls && !to.callsOk) out.calls = undefined;
  out.sides = !step || amrapStep ? to.sides : undefined; // complex steps never carry sides
  // A MAX REPS station is the athlete's own set whatever move is in it: never counted, no sides.
  if (b.max === true) { out.cadenceMs = null; out.sides = undefined; }
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
  const ok = altsOf(mission, first.moveId).filter(a => a.id !== first.moveId && altAllowed(mission, swapKey, { ...a, x: curX * (a.x ?? 1) }, { gear }));
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
// A key that runs at different counts (a ladder's rungs) reads them all,
// '21-18-15-12-9-6-3', or first→last past seven rungs ('10→1').
const ladderDose = (items) => {
  const v = items.map(it => (it.mode === 'timed' ? slotDose(it) : String(it.reps)));
  return v.length <= 7 ? v.join('-') : `${v[0]}→${v[v.length - 1]}`;
};
export function cardRows(mission, { gear = gearProfile() } = {}) {
  return rowItems(mission).map(({ item, parent }, i) => {
    let dose = slotDose(item);
    const occ = parent
      ? (mission.exercises || []).flatMap(sl => (hasList(sl) ? sl.list.filter(st => st.swapKey === item.swapKey) : []))
      : (mission.exercises || []).filter(sl => !hasList(sl) && sl.swapKey === item.swapKey);
    const doses = occ.map(slotDose);
    // A key that comes round twice inside one complex (TOUCH THE SKY's way
    // down and back up): '2 × 5'.
    const inList = parent ? parent.list.filter(st => st.swapKey === item.swapKey).length : 0;
    if (parent?.climb) dose = `${[0, 1, 2].map(k => item.reps + k * parent.climb).join(', ')}…`; // CHARGE UP 12: '2, 4, 6…'
    else if (doses.some(d => d !== doses[0])) dose = ladderDose(occ);
    else if (inList > 1) dose = `${inList} × ${doses[0]}`;
    else if (!parent && doses.length > 1) dose = `${doses.length} × ${doses[0]}`;
    const swapped = item.moveId !== item.baseMoveId;
    return {
      swapKey: item.swapKey,
      num: i + 1,
      prefix: parent ? null : item.prefix || null,
      name: item.name,
      dose,
      load: null,
      // A MAX REPS station says when to stop the set; its text follows the move on it.
      note: item.max === true ? maxStopLine(item, mission.level) : item.note || null,
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
  if (!mission.guided) tags.push('YOUR PACE ONLY');
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
    ...(mission.safety ? { safety: mission.safety } : {}), // NO CONTINUES: shown big on the card and through the run
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
// The Mission Library's LOADOUT chip counts, within the THEME picked (the
// THEME counts are within the LOADOUT, above).
export function loadoutCounts(entries, theme = 'all') {
  const within = filterShelf(entries, { theme });
  const out = {};
  LOADOUTS.forEach(l => { out[l.id] = filterShelf(within, { loadout: l.id }).length; });
  return out;
}
// A classic's format word on its library row, the way a launch mission's
// row ends on EMOM or AMRAP. Its tag (Training Mode, Day Zero) says where it
// comes from, not how it runs.
const CLASSIC_FORMAT = {
  murph: 'FOR TIME', half_murph: 'FOR TIME',
  sally_squats: 'CHALLENGE', sally_pushups: 'CHALLENGE',
  deadly_seven: 'ROUNDS', hell_mma: 'NON-STOP', hell_general: 'NON-STOP',
  strike_fitness_easy: 'INTERVALS', strike_fitness_mid: 'INTERVALS', strike_fitness_adv: 'INTERVALS',
  pushup_division: 'INTERVALS', abs_3_level: 'CIRCUIT', fitness_test: 'TEST', burpee_hell: 'INTERVALS',
  legendary_squat: 'CIRCUIT', hero_training: 'CIRCUIT', chaos_engine: 'CIRCUIT',
};
// "~16 MIN · BARBELL · EMOM" — a Mission Library row's second line: minutes
// at `level` (the mission's default level when none is given), the loadout,
// then the format.
export function shelfEntryLine(entry, { level } = {}) {
  if (entry?.kind === 'v2') {
    const def = missionDefById(entry.id);
    const L = def?.levels?.[level] || def?.levels?.[def?.defaultLevel];
    return [L ? `~${L.minutes} MIN` : null, loadoutLabel(entry.loadout), formatLabelOf(def) || null].filter(Boolean).join(' · ');
  }
  const w = NAMED_WORKOUTS.find(n => n.id === entry?.id);
  return [w?.estMin ? `~${w.estMin} MIN` : null, loadoutLabel(entry?.loadout), CLASSIC_FORMAT[entry?.id] || null].filter(Boolean).join(' · ');
}
export function emptyShelfCopy({ loadout = 'all', theme = 'all' } = {}) {
  const lo = loadoutLabel(loadout);
  if (theme !== 'all') {
    const th = (themeLabel(theme) || String(theme)).toLowerCase();
    // No SHOW NO GEAR button when NO GEAR is already the loadout (it would do nothing; never empty in Drop A).
    return { text: `No ${th} missions for ${lo} yet.`, action: loadout === 'none' ? null : { label: 'SHOW NO GEAR', loadout: 'none' } };
  }
  return { text: `No ${lo} missions yet. Try MIXED, or today's mission on the card.`, action: null };
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

// ── Build Workout's MAX OUT button ──────────────────────────────────────────
// Build Workout picks gear and difficulty; the MAX OUT button hands them to the
// Mission Library: BODYWEIGHT lists the no-gear workouts, WEIGHTED the one-bell
// ones, HYBRID the mixed ones, and EASY / NORMAL / HARD set the level every MAX
// OUT workout opens on (BEGINNER / STANDARD / ELITE). It saves the library's
// shelf prefs (theme MAX OUT, that loadout, those levels) and returns what it
// saved; picking by muscle comes later.
const MAX_OUT_LOADOUT = { BODYWEIGHT: 'none', WEIGHTED: 'bell', HYBRID: 'mixed' };
const MAX_OUT_LEVEL = { EASY: 'beginner', NORMAL: 'standard', HARD: 'elite' };
export const MAX_OUT_IDS = LOADOUT_MISSIONS.filter(d => (d.themes || []).includes('maxout')).map(d => d.id);
export function maxOutHandoff({ equipment, difficulty } = {}) {
  const loadout = MAX_OUT_LOADOUT[String(equipment || '').toUpperCase()] || 'all';
  const level = MAX_OUT_LEVEL[String(difficulty || '').toUpperCase()] || 'standard';
  const prefs = saveShelfPrefs({ theme: 'maxout', loadout, levels: Object.fromEntries(MAX_OUT_IDS.map(id => [id, level])) });
  return { loadout, level, prefs };
}
// The level the Mission Library opens a MAX OUT workout on: the one picked on
// its card (or handed over by Build Workout), else its default. Every other
// mission keeps opening on its default, as the library always did.
export function libraryLevelFor(id, prefs = loadShelfPrefs()) {
  const def = missionDefById(id);
  if (def?.format !== 'maxReps') return undefined;
  const stored = prefs?.levels?.[id];
  return stored && def.levels?.[stored] ? stored : undefined;
}

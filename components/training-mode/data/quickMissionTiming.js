// Quick Mission · how long a guided run really takes, in one pure module.
//
// QuickMissionActive (the guided runner) and the generator
// (fit-mode/quickMissionGenerator) both read the numbers below, so the minutes
// the setup card promises are the minutes the runner spends. Nothing here
// touches React or storage.
//
// The real timeline of today's generated mission in the v2 runner (the public
// one, data/qmV2), from START to the last set:
//
//   intro     the safe-weight brief (Weighted and Hybrid only) and its pause,
//             the coach's start line, a short pause, the bell and its pause,
//             then GET READY for move 1 (data/missionMoves getReadySeconds:
//             5 seconds plus the lead line, 7 at the least)
//   a move    a counted rep set runs one beat per CADENCE_MS and ends when the
//             last number has been said; a timed move runs its work seconds; a
//             loaded set (and a rep move the coach does not count) is the
//             athlete's own pace and ends on DONE
//   a rest    the move's rest, to the second. The coach's lines (the rest
//             call, the next move, the 3-2-1) are spoken INSIDE the rest, so
//             they add nothing
//   the end   the last set of the last round ends the run at once: no rest
//             after it. The finish bell (QM_FINISH_BELL_MS) rings after that
//             and is not part of the workout
//
// Every round runs the same list, so the round change is just the last move's
// rest ("Round 2 complete. Rest.").
//
// What is exact and what is assumed. Everything above is a timer in the runner
// except two human things: how long a loaded set takes (QM_LOADED_REP_SEC a
// rep and QM_LOADED_SETUP_SEC to pick the weight up, the athlete's own pace)
// and how long the coach's voice takes (the repo's own speechSeconds estimate
// for the intro, and QM_LAST_NUMBER_SEC for the last number of a counted set,
// which the runner waits for, but never longer than QM_LAST_NUMBER_WAIT_MS: a
// slow voice, or a long "Up next" line still being said, does not stretch the
// set). `voice: false` leaves the speech out: that is a run with the coach's
// voice off, or a browser with no speech, and then the whole estimate is timers.
//
// A set that ends on DONE keeps to its slot. The model budgets it
// (manualSetSeconds), and the runner holds the run to that budget at any pace:
// DONE early and the unused seconds go into the rest after it, DONE late and
// the rest is cut down (never below QM_MANUAL_REST_FLOOR_SEC), so a quick lifter
// and a slow one both finish at the minutes on the card (manualRestSeconds). Only
// the last set of the last round has no rest to move seconds into.
//
// Calibration (scripts/measure-qm-timeline.mjs: the production bundle, a fake
// clock, START to the last set, no speech, a loaded set tapped at the model's
// own pace). Bodyweight, Weighted and Hybrid missions at every level, 5 to 45
// minutes (and as many 60 minute runs as finished): the real run is 1.6 to 6.6 s
// longer than `voice: false` here, the 1.6 being the one-second poll of the
// script plus the 60 ms the runner's waits round up to, and the rest the poll
// lag on a loaded set. The generator fits `voice: true` to the minutes asked
// within 8 s at every minute from 5 to 60 (test-qm-generator), so a run with the
// coach talking lands within 30 s of the minutes asked with room to spare. With
// the voice off a 60 minute bodyweight mission runs about 23 s short (29 at the
// most): the last number of every counted set is no longer waited for.
import { speechSeconds, getReadySeconds, leadLine } from './missionMoves';
import { getCoachCopy } from './coachCopy';

// ── the runner's numbers ────────────────────────────────────────────────────
// One rep a tick. The setup config's cadenceMs is CADENCE_PRESETS.moderate
// (shared/CadenceSlider), pinned equal by test-qm-generator.
export const QM_CADENCE_MS = 2000;
// A loaded set: seconds a rep, and the pick-up before the first one.
export const QM_LOADED_REP_SEC = 3;
export const QM_LOADED_SETUP_SEC = 5;
// The runner waits for the last number of a counted set to be spoken before
// the next move starts: about half a second (voice on).
export const QM_LAST_NUMBER_SEC = 0.5;
export const QM_LAST_NUMBER_WAIT_MS = 700;
// The least rest a late DONE can cut a set's rest down to (a rest shorter than
// this keeps its own length).
export const QM_MANUAL_REST_FLOOR_SEC = 10;
// The intro, step by step (QuickMissionActive runIntroV2 reads these).
export const QM_WEIGHT_BRIEF = 'Choose a safe weight before starting. Form first. Control every rep.';
export const QM_WEIGHT_BRIEF_HOLD_MS = 800;
export const QM_INTRO_HOLD_MS = 400;
export const QM_INTRO_BELL_MS = 600;
// The bell after the last set, before the result (not part of the workout).
export const QM_FINISH_BELL_MS = 1800;

// ── which moves the coach counts ────────────────────────────────────────────
// A counted move runs on the beat; any other rep move waits for DONE. The
// runner decides by name (a loaded set is never counted).
export const CADENCE_SAFE_NAMES = new Set([
  'push-ups', 'pushups', 'push ups',
  'squats', 'bodyweight squats', 'air squats',
  'lunges', 'forward lunges', 'reverse lunges', 'lateral lunges', 'walking lunges',
  'sit-ups', 'situps', 'sit ups',
  'crunches', 'bicycle crunches',
  'dips', 'tricep dips',
  'jump squats', 'jumping squats', 'squat jumps',
  'glute bridges', 'hip bridges',
  'burpees',
  'sprawls',
  'mountain climbers',
  'knee push-ups',
  'explosive push-ups',
  'superman push-ups',
  'diamond push-ups',
  'wide push-ups',
  'pike push-ups',
  'decline push-ups',
  'calf raises',
  'leg raises',
  'flutter kicks',
  'high knees',
  'jumping jacks',
  'step-ups',
  'box jumps',
  'tuck jumps',
  // The focus-tagged Quick Mission pool (fit-mode/quickMissionGenerator).
  'shoulder taps', 'inchworms', 'squat thrusts', 'skater hops',
  'russian twists', 'knee strikes', 'squat to front kick', 'sprawl to jab-cross',
  'elbow strikes', 'slip and rip', 'reverse lunges', 'plank jacks',
]);

// Whether the coach counts this slot. missionCfg: { cadenceCount, workoutType }.
export function isCadenceEligible(exercise, missionCfg) {
  if (missionCfg.cadenceCount === false) return false;
  if (exercise.mode !== 'reps') return false;
  if (missionCfg.workoutType === 'Weighted') return false;
  if (missionCfg.workoutType === 'Hybrid' && exercise.isWeighted) return false;
  const name = (exercise.name || '').toLowerCase().trim();
  return CADENCE_SAFE_NAMES.has(name);
}

// ── one move ────────────────────────────────────────────────────────────────
const isLoadedType = (workoutType) => workoutType === 'Weighted' || workoutType === 'Hybrid';

// The seconds the move itself takes, with no voice: a timed move its work, a
// counted set one beat a rep, a loaded set the pick-up and a controlled
// rep each, any other rep move a rep a beat. `ctx`: { workoutType,
// cadenceCount, cadenceMs }.
export function moveSeconds(ex, ctx = {}) {
  if (ex.mode === 'timed') return ex.work;
  const beat = (ctx.cadenceMs || QM_CADENCE_MS) / 1000;
  if (!isCadenceEligible(ex, { cadenceCount: ctx.cadenceCount, workoutType: ctx.workoutType }) && ex.isWeighted) {
    return QM_LOADED_SETUP_SEC + ex.reps * QM_LOADED_REP_SEC;
  }
  return ex.reps * beat;
}
// The move's seconds in the guided run: the move, plus (voice on) the last
// number of a counted set, which the runner waits for.
export function workSeconds(ex, ctx = {}) {
  const counted = ex.mode === 'reps' && isCadenceEligible(ex, { cadenceCount: ctx.cadenceCount, workoutType: ctx.workoutType });
  return moveSeconds(ex, ctx) + (counted && ctx.voice !== false ? QM_LAST_NUMBER_SEC : 0);
}

// A set that ends on DONE (a loaded set, or a rep move the coach does not
// count): the seconds it is budgeted, or null for a set the clock ends (a timed
// move, or a counted set). ctx as moveSeconds.
export function manualSetSeconds(ex, ctx = {}) {
  if (!ex || ex.mode !== 'reps') return null;
  if (isCadenceEligible(ex, { cadenceCount: ctx.cadenceCount, workoutType: ctx.workoutType })) return null;
  return moveSeconds(ex, ctx);
}
// The rest after a set that ended on DONE `workedSec` seconds after it began:
// the move's own rest, plus the seconds left of its budget (or minus the seconds
// it went over), to the second, never below the floor. A set the clock ends, or
// a time that is not known (a run restored into work), keeps the move's rest.
export function manualRestSeconds(ex, workedSec, ctx = {}) {
  const rest = Number(ex?.rest) || 0;
  const budget = manualSetSeconds(ex, ctx);
  if (budget == null || !Number.isFinite(workedSec)) return rest;
  return Math.max(Math.min(rest, QM_MANUAL_REST_FLOOR_SEC), Math.round(rest + budget - workedSec));
}

// ── the intro ───────────────────────────────────────────────────────────────
// START to the first move's work: the brief, the start line, the pauses, the
// bell, GET READY. `first` is the first slot of round 1; `rounds` and
// `slotsPerRound` shape its lead line ("Round 1. Push-Ups. Ready? On my
// count.").
export function introSeconds({ workoutType, first, rounds = 1, slotsPerRound = 1, format, cadenceCount, voice = true }) {
  const ctx = { workoutType, cadenceCount };
  let sec = 0;
  if (voice) {
    if (isLoadedType(workoutType)) sec += speechSeconds(QM_WEIGHT_BRIEF) + QM_WEIGHT_BRIEF_HOLD_MS / 1000;
    sec += speechSeconds(getCoachCopy('sessionStart'));
    sec += QM_INTRO_HOLD_MS / 1000;
  }
  sec += QM_INTRO_BELL_MS / 1000;
  if (first) {
    const lead = leadLine(first, { round: 1, idx: 0, rounds, slotsPerRound, format, legacyCounted: isCadenceEligible(first, ctx) });
    sec += getReadySeconds(lead);
  }
  return sec;
}

// ── the whole run ───────────────────────────────────────────────────────────
// The mission's real guided timeline, in seconds:
//   { introSec, workSec, restSec, totalSec, slots: [{ name, work, rest }], rounds }
// `workSec` and `restSec` are over every round; the last slot's rest is not
// run in the last round, so it is taken off. opts: { voice, cadenceCount,
// cadenceMs }.
export function quickMissionTimeline(mission, opts = {}) {
  const all = [...(mission?.exercises || []), ...(mission?.finisherExercises || [])];
  const rounds = Math.max(1, Math.floor(Number(mission?.rounds) || 1));
  const workoutType = mission?.workoutType || 'Bodyweight';
  const ctx = { workoutType, cadenceCount: opts.cadenceCount, cadenceMs: opts.cadenceMs, voice: opts.voice };
  const slots = all.map(ex => ({ name: ex.name, work: workSeconds(ex, ctx), rest: ex.rest }));
  const roundWork = slots.reduce((s, x) => s + x.work, 0);
  const roundRest = slots.reduce((s, x) => s + x.rest, 0);
  const lastRest = slots.length ? slots[slots.length - 1].rest : 0;
  const introSec = all.length
    ? introSeconds({ workoutType, first: all[0], rounds, slotsPerRound: all.length, format: mission?.format, cadenceCount: opts.cadenceCount, voice: opts.voice })
    : 0;
  const workSec = roundWork * rounds;
  const restSec = roundRest * rounds - lastRest;
  return { introSec, workSec, restSec, totalSec: introSec + workSec + restSec, slots, rounds };
}

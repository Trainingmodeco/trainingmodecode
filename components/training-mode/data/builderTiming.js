// Workout Builder · how long a generated workout really takes in the guided
// player (FitBuilderGuidedPlayer), in one pure module.
//
// The generator (fit-mode/fitModeGenerator) fits the list to the minutes the
// athlete picked with these numbers, so the DURATION on the setup card is the
// length of the session the player runs. test-qm-generator pins each constant
// below to the player's own source, so the two cannot drift apart quietly.
//
// One set in the player, by the row's kind (the player's classify):
//   reps     a bodyweight rep set: the intro line, one rep a cadence beat
//            (2 s until the athlete moves the slider), a short tail
//   weighted a loaded set: set 1 waits on START — LIFT after the load call,
//            later sets run "get into position", a 5 s count, "Get ready.
//            Lift."; the lift itself is the athlete's own pace (a pick-up and
//            a controlled rep each, the Quick Mission numbers), ended with SET
//            DONE, and never longer than the player's window
//   hold     a timed set: the intro, a 5 s count, "Get ready. Go.", the hold
// Between sets the row's rest runs to the second ("Set complete. Rest." is
// spoken inside it). After a row's last set the player says it is complete,
// opens the map on the next row and counts 3-2-1 once the athlete taps it.
//
// Left out on purpose: the warm-up (its own OFF / 5 / 10 MIN row before START)
// and a cardio add-on (its own timer after the workout).

// ── the player's numbers ────────────────────────────────────────────────────
export const BUILDER_CADENCE_SEC = 2;
export const BUILDER_REP_INTRO_SEC = 2.6;
export const BUILDER_REP_TAIL_SEC = 0.7;
// Weighted, set 1: the load call and the athlete's START — LIFT tap.
export const BUILDER_GET_READY_SEC = 5;
// Weighted, later sets: the spoken line, the 5 s count, "Get ready. Lift."
export const BUILDER_POSITION_SEC = 2.8 + 5 + 1.2;
// Hold: the spoken line, the 5 s count, "Get ready. Go."
export const BUILDER_HOLD_INTRO_SEC = 2.4 + 5 + 1;
// A loaded set at the athlete's pace (the Quick Mission's own numbers).
export const BUILDER_LOADED_SETUP_SEC = 5;
export const BUILDER_LOADED_REP_SEC = 3;
// "<Exercise> complete.", the map sliding up, the athlete's tap on the next
// row (about two seconds) and the 3-2-1 count-in.
export const BUILDER_ROW_DONE_SEC = 0.9;
export const BUILDER_NEXT_ROW_SEC = 1.2 + 2 + 3 * 0.65;
// START on the list to the first set: the 3-2-1 count-in.
export const BUILDER_START_SEC = 3 * 0.65;

// The player's classify(), the same rules.
export function builderSetKind(ex) {
  const repsStr = String(ex?.reps ?? '');
  const hold = repsStr.match(/^(\d+)\s*s$/i);
  if (hold) return { kind: 'hold', seconds: parseInt(hold[1], 10) };
  const nums = repsStr.match(/\d+/g);
  const reps = nums ? parseInt(nums[nums.length - 1], 10) : 10;
  if (String(ex?.equipment || '').toLowerCase().includes('bodyweight')) return { kind: 'reps', reps };
  const windowSec = Math.max(60, Math.ceil((reps * 12) / 30) * 30);
  return { kind: 'weighted', reps, windowSec };
}

// Seconds of one set (no rest), `setNo` from 1.
export function builderSetSeconds(ex, setNo = 1) {
  const plan = builderSetKind(ex);
  if (plan.kind === 'reps') return BUILDER_REP_INTRO_SEC + plan.reps * BUILDER_CADENCE_SEC + BUILDER_REP_TAIL_SEC;
  if (plan.kind === 'hold') return BUILDER_HOLD_INTRO_SEC + plan.seconds;
  const lift = Math.min(plan.windowSec, BUILDER_LOADED_SETUP_SEC + plan.reps * BUILDER_LOADED_REP_SEC);
  return (setNo === 1 ? BUILDER_GET_READY_SEC : BUILDER_POSITION_SEC) + lift;
}

const restOf = (ex) => Number(ex?.restSeconds) || parseInt(ex?.rest, 10) || 60;
const setsOf = (ex) => Math.max(1, Math.floor(Number(ex?.sets) || 3));

// One row: every set, the rests between them, and the row's own finish.
export function builderRowSeconds(ex) {
  const sets = setsOf(ex);
  let sec = 0;
  for (let s = 1; s <= sets; s++) sec += builderSetSeconds(ex, s);
  return sec + (sets - 1) * restOf(ex) + BUILDER_ROW_DONE_SEC;
}

// The whole list, START to the last set: every row plus the hand-over to the
// next one.
export function builderWorkoutSeconds(list) {
  const rows = Array.isArray(list) ? list.filter(Boolean) : [];
  if (!rows.length) return 0;
  return BUILDER_START_SEC + rows.reduce((s, ex) => s + builderRowSeconds(ex), 0) + (rows.length - 1) * BUILDER_NEXT_ROW_SEC;
}

// Whole minutes, for a card ("~38 min").
export function builderWorkoutMinutes(list) {
  return Math.max(1, Math.round(builderWorkoutSeconds(list) / 60));
}

// A set scheme (3×10, 5×5, …) as the Builder applies it after generating:
// every non-bodyweight row takes the scheme's sets, reps and rest; bodyweight
// rows keep their own numbers. The same rule as FitBuilderWorkout's
// applyScheme, so a row already shaped here comes out of it unchanged.
export function applySetScheme(list, scheme) {
  if (!scheme?.sets) return list;
  return list.map(ex =>
    String(ex.equipment || '').toLowerCase() === 'bodyweight'
      ? ex
      : { ...ex, sets: scheme.sets, reps: scheme.reps, rest: `${scheme.restSeconds}s`, restSeconds: scheme.restSeconds }
  );
}

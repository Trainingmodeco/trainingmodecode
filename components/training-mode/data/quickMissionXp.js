import { resolveOutcome, xpForOutcome } from '../shared/sessionOutcome';
import { quickMissionXp } from './userStats';

// The ONE place a Quick Mission's XP is settled.
//
// App.jsx used to bank the flat per-exercise rate with no integrity check while
// the complete screen ran the verdict, so a run the anti-cheat refused showed
// "0 XP · VALIDATION FAILED" above a level bar that had just moved by the full
// amount. Both callers now ask here, so what the athlete reads is what gets
// banked. Same shape as data/fightSessionXp.
//
// The base already counts only completed exercises (the End dialog's promise),
// so pass and partial keep it as is; the verdict zeroes a refused run and
// scales a failed one (sessionOutcome.xpForOutcome).
export function settleQuickMissionXp({ exercisesCompleted, totalExercises, completed, difficulty, integrityResult }) {
  const baseXp = quickMissionXp(exercisesCompleted, completed);
  const verdict = resolveOutcome({ completed: exercisesCompleted, total: totalExercises, difficulty, integrityResult });
  return { verdict, baseXp, xp: xpForOutcome(verdict.outcome, baseXp) };
}

import { calculatePartialXp } from '../utils/missionIntegrity';
import { resolveOutcome, xpForOutcome, EARLY_MESSAGE } from '../shared/sessionOutcome';
import { fightTimerXp, comboCoachXp } from './userStats';

// The ONE place a fight-timer session's XP is settled.
//
// The summary screen used to run the outcome engine (stopped early → partial
// credit, integrity fail → nothing) while the recorder in App.jsx banked the
// flat per-round rate. A Just Train ended after two rounds showed "+5 XP" and
// saved 20. Both callers now ask here, so what the athlete reads is what the
// level bar moves by.
//
// mode: 'fight' (Fight Focus) · 'justTrain' · 'combo' (Combo Coach)
// bonusXp: live-verdict XP from the session (rushes, clean rounds) — signed.
// It rides the settled number, never a session the integrity gate refused.
export function settleFightXp({ completed, total, difficulty, integrityResult, mode = 'fight', bonusXp = 0 }) {
  const done = Math.max(0, Number(completed) || 0);
  const planned = Math.max(1, Number(total) || 1);
  const baseXp = mode === 'combo'
    ? comboCoachXp(done, planned)
    : fightTimerXp(done, planned, { justTrain: mode === 'justTrain' });
  const verdict = resolveOutcome({ completed: done, total: planned, difficulty, integrityResult });
  const rawXp = integrityResult?.awardXp
    ? calculatePartialXp(baseXp, integrityResult.validCompletedUnits, integrityResult.totalRequiredUnits)
    : (integrityResult ? 0 : baseXp);
  const refused = integrityResult && integrityResult.awardXp === false;
  const bonus = refused || verdict.outcome === 'validation_failed' ? 0 : Math.round(Number(bonusXp) || 0);
  const xp = Math.max(0, xpForOutcome(verdict.outcome, rawXp) + bonus);
  // refused: the integrity check paid nothing, so no bonus line may be shown.
  return { verdict, baseXp, bonusXp: bonus, xp, refused: !!refused || verdict.outcome === 'validation_failed' };
}

// The headline and the one-line reason the summary shows. Quitting before a
// round is done is a deliberate stop, not a failed mission; and a session that
// pays nothing says why, in the words used for an early end everywhere else.
export function fightSummaryCopy({ verdict, xp }) {
  const endedEarly = verdict.outcome === 'fail' && verdict.completionRatio === 0;
  return {
    eyebrow: endedEarly ? 'SESSION ENDED' : verdict.preset.eyebrow,
    title: endedEarly ? 'ENDED EARLY' : verdict.preset.title,
    // The card's look: a session stopped at the start is 'ended' (quiet, no
    // failure art), and its headline already says so, so the "incomplete"
    // bar under it is left out.
    variant: endedEarly ? 'ended' : verdict.preset.variant,
    quiet: endedEarly,
    // fail and validation_failed already print verdict.response under the headline
    note: xp === 0 && verdict.outcome === 'partial' ? EARLY_MESSAGE : null,
  };
}

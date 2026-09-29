import { calculatePartialXp } from '../utils/missionIntegrity';
import { resolveOutcome, xpForOutcome } from '../shared/sessionOutcome';
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
export function settleFightXp({ completed, total, difficulty, integrityResult, mode = 'fight' }) {
  const done = Math.max(0, Number(completed) || 0);
  const planned = Math.max(1, Number(total) || 1);
  const baseXp = mode === 'combo'
    ? comboCoachXp(done, planned)
    : fightTimerXp(done, planned, { justTrain: mode === 'justTrain' });
  const verdict = resolveOutcome({ completed: done, total: planned, difficulty, integrityResult });
  const rawXp = integrityResult?.awardXp
    ? calculatePartialXp(baseXp, integrityResult.validCompletedUnits, integrityResult.totalRequiredUnits)
    : (integrityResult ? 0 : baseXp);
  return { verdict, baseXp, xp: xpForOutcome(verdict.outcome, rawXp) };
}

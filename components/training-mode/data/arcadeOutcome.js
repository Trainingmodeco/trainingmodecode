// The classic Arcade's end screen (ArcadeStageClearOverlay) picks one of its
// four screens from the result the player hands it. Pure, so the choice can be
// tested without rendering.
//
// A player's own flags win (invalid / partial / hardFail / missionFailed);
// otherwise the engine decides from the counts, the same resolveOutcome call
// every other mode uses. A result with no counts reads as 0 of 1, a fail: the
// normal (non-benchmark) clear used to carry none, so a cleared stage showed
// MISSION FAILED over a clear that was already saved. normalClearResult puts
// them on, the way ArcadeBenchmarkPlayer does.
import { resolveOutcome } from '../shared/sessionOutcome';

// → { verdict (null when a flag decided), screen: 'invalid'|'failed'|'partial'|'cleared' }
export function arcadeOverlayOutcome(result) {
  const flagged = result?.invalid === true || result?.partial === true
    || result?.hardFail === true || result?.missionFailed === true;
  const verdict = flagged ? null : resolveOutcome({
    completed: result?.completedTasks ?? result?.completedRounds,
    total: result?.totalTasks ?? result?.totalRounds,
    difficulty: result?.difficulty,
    integrityResult: result?.integrityResult,
    safetyFlag: result?.safetyFlag,
  });
  const isInvalid = result?.invalid === true || verdict?.outcome === 'validation_failed';
  const isPartial = result?.partial === true || verdict?.outcome === 'partial';
  const isHardFail = result?.hardFail === true || result?.missionFailed === true || verdict?.outcome === 'fail';
  const screen = isInvalid ? 'invalid' : isHardFail ? 'failed' : isPartial ? 'partial' : 'cleared';
  return { verdict, screen };
}

// The result of a normal stage cleared in full: every task of every block it
// ran is done (`taskCount`, at least 1), with the run's time and stars.
export function normalClearResult({ xp = 0, statRewards = null, taskCount = 1, ...run } = {}) {
  const n = Math.max(1, Math.round(Number(taskCount) || 0));
  return {
    invalid: false,
    rank: null,
    points: xp,
    xpEarned: xp,
    statRewards,
    ...run, // elapsedSeconds / stars / newBest from the timed run
    completedTasks: n,
    totalTasks: n,
  };
}

// The classic stage's clock (ArcadeSessionPlayer): best time and stars are
// the wall time from the end of the briefing to the clear. A RETRY starts the
// run again from its briefing, so it starts the clock again too: before, the
// retried run kept the first attempt's start, and its time (and stars)
// counted the failed run's minutes. For everyone (owner, 2026-11-23).
//   stageClockStart(startedAt, now): the briefing is done; a clock already
//     running (a resumed session) keeps its start.
//   STAGE_CLOCK_RETRY: the clock a RETRY leaves (none: the next briefing starts it).
//   stageElapsedSeconds(startedAt, now): whole seconds, or null with no clock.
export const STAGE_CLOCK_RETRY = null;
export function stageClockStart(startedAt, now = Date.now()) {
  return startedAt == null ? now : startedAt;
}
export function stageElapsedSeconds(startedAt, now = Date.now()) {
  return startedAt ? Math.round((now - startedAt) / 1000) : null;
}

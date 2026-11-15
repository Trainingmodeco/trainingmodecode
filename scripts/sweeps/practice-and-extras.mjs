// Fight Mode practice drills, the Just Train round brief, and the Workout Builder weight call: three sources of
// spoken lines that no sweep or coverage walk built (found by the second look of the 2026-11-14 audit).
//
// Practice says spokenCall(call) for every call of a drill (PracticeRound.jsx advanceCall) and the rest line (its bells effect).
//   The Ladder (data/practiceMoves.js): a move's drill is buildRound(drillFor(moves, move, learned)). Its calls are the
//   move's own, the calls of the learned moves before it, and combinations of their names ("jab, cross"). Which moves
//   are learned changes the round, so every move is built alone and after each single move before it: that gives every
//   pair of names a round can chain, whatever is learned. TEST OUT drills a whole group at once (groupDrill). The
//   learned count sets the level: every tier. PracticeMode.jsx builds drills no other way (startDrill, startGroup).
// Just Train (JustTrainSetup.jsx lines 62-64, 148; FightFocusTimer.jsx line 336): every round says "Round N. Free flow. Your round, your pace."
// Load (FitBuilderGuidedPlayer.jsx lines 506 and 526): "Load W. Get ready. Lift." where W is the athlete's weight; in kg the step is
//   2.5 (data/weightLog.js stepFor), so W runs over halves (22.5). Whole numbers over 100 are the number composer's.
const ROOT = new URL('../../components/training-mode/', import.meta.url);
const imp = (p) => import(new URL(p, ROOT).href);

export default async () => {
  const { PRACTICE_DISCIPLINES } = await imp('practiceData.js');
  const { buildRound, spokenCall } = await imp('data/practiceRound.js');
  const { movesFor, groupsOf, drillFor, groupDrill } = await imp('data/practiceMoves.js');
  const LEARNED = [1, 3, 7, 11, 20];
  const said = (round, into) => { for (const g of round.groups) for (const c of g.calls) into.push(spokenCall(c)); };
  const moveCalls = [], groupCalls = [], rests = [];
  for (const disc of PRACTICE_DISCIPLINES) {
    const moves = movesFor(disc);
    moves.forEach((move, i) => {
      // Nothing learned before it, then each earlier move learned on its own.
      for (const before of [null, ...moves.slice(0, i)]) {
        const input = drillFor(moves, move, before ? { [before.id]: true } : {});
        for (const learned of LEARNED) {
          const r = buildRound({ ...input, learned });
          said(r, moveCalls);
          for (let n = 1; n < r.plan.rounds; n++) rests.push(`Rest. Round ${n + 1} next.`);
        }
      }
    });
    for (const { group } of groupsOf(moves)) {
      for (const learned of LEARNED) said(buildRound({ ...groupDrill(moves, group, {}), learned }), groupCalls);
    }
  }
  const justTrain = [];
  for (let n = 1; n <= 20; n++) justTrain.push(`Round ${n}. Free flow. Your round, your pace.`, `Round ${n}. Free flow.`);
  // kg halves (2.5 to 300 in 2.5); lb is whole numbers, proven by the composer. Load is said by the guided player at 506 and 526.
  const loads = []; for (let w = 2.5; w <= 300 + 1e-9; w += 2.5) loads.push(`Load ${Math.round(w * 10) / 10}. Get ready. Lift.`);
  return [
    { feature: 'Fight Mode', name: 'Practice drill of a move: its calls and the learned moves before it, every discipline and level (practiceMoves drillFor)', lines: [...new Set(moveCalls)] },
    { feature: 'Fight Mode', name: 'Practice TEST OUT drill of a group, every discipline and level (practiceMoves groupDrill)', lines: [...new Set(groupCalls)] },
    { feature: 'Fight Mode', name: 'Practice drill rest (PracticeRound.jsx)', lines: [...new Set(rests)] },
    { feature: 'Fight Mode', name: 'Just Train round start (FightFocusTimer.jsx:336)', lines: justTrain },
    { feature: 'Workout Builder', name: 'Load call over kg halves (FitBuilderGuidedPlayer.jsx:506 and :526)', lines: loads },
  ];
};

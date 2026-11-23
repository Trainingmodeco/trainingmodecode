// The Fit WORKOUT CARD (switch fitCard: components/training-mode/fit-challenge/
// FitCardSetup.jsx, data/fitCard.js). The card adds no spoken line of its own:
// GUIDED runs the card's mission in the Quick Mission runner (QuickMissionActive),
// which says each move by name and the round calls; CHECK-OFF is silent (bells
// and beeps). What the card adds is VALUES: the balanced deal's moves, FULL BODY
// WARRIOR's fixed doses, + / − rounds from 1 to 10 (the generator alone stops
// at 6), a swap or a no-bar stand-in in any slot.
//
// So this sweep builds the card's missions with the app's own builder
// (cardMission) over what the page can produce (every level, gear, a minute grid
// of 5 to 60, rounds 1 to 10, the bar on and off, today's deal and WARRIOR, and
// a swap into every slot), and says each slot the way the runner does: the lead
// line in every round (its "Round N." prefix), the chained, short-rest, switch
// and up-next lines (data/missionMoves), and the round-end rest call.
//
// A bodyweight rep move is said exactly as the runner says it: counted
// (isCadenceEligible: the card deals its moves with `counted`, so the coach
// counts pull-ups and rows too and never falls back to the manual line). A
// loaded set is never counted, and its manual line ("Your pace. Tap DONE when
// the set is done.") has no recording yet; that gap is today's (every weighted
// Quick Mission has it, see the pool sweep in spoken-sweeps.mjs), so a loaded
// move is said here the way that sweep says it.
const range = (lo, hi, step = 1) => { const out = []; for (let v = lo; v <= hi + 1e-9; v += step) out.push(v); return out; };

export default async function sweep() {
  const C = await import('../../components/training-mode/data/fitCard.js');
  const mm = await import('../../components/training-mode/data/missionMoves.js');
  const { isCadenceEligible } = await import('../../components/training-mode/data/quickMissionTiming.js');
  const lead = new Set(), other = new Set(), rest = new Set();
  const sayMission = (m) => {
    const slots = m.exercises;
    const counted = (sl) => (sl.isWeighted ? true : isCadenceEligible(sl, { cadenceCount: true, workoutType: m.workoutType }));
    for (let r = 1; r <= m.rounds; r++) {
      slots.forEach((sl, idx) => lead.add(mm.leadLine(sl, { round: r, idx, rounds: m.rounds, slotsPerRound: slots.length, legacyCounted: counted(sl) })));
      if (r < m.rounds) rest.add(mm.restOpener({ restSec: slots[slots.length - 1].rest, roundEnd: true, completedRound: r }));
    }
    for (const sl of slots) other.add(mm.chainedLine(sl, { legacyCounted: counted(sl) })).add(mm.shortRestLine(sl)).add(mm.switchLine(sl)).add(`Up next: ${mm.spokenMove(sl)}.`);
  };
  const LEVELS = ['Easy', 'Normal', 'Hard', 'Advanced'];
  const GEAR = ['Bodyweight', 'Weighted', 'Hybrid'];
  for (const difficulty of LEVELS) for (const workoutType of GEAR) for (const duration of range(5, 60, 5)) for (const bar of [true, false]) {
    const cfg = { workoutType, duration, difficulty, focus: 'Full Body', format: 'Auto', cardioFinisher: false };
    for (const source of [{ kind: 'deal', seed: 20261123 + duration, shuffles: 0 }, { kind: 'warrior' }]) {
      const base = C.cardMission(cfg, { source, bar });
      for (const rounds of [1, base.rounds, C.CARD_MAX_ROUNDS]) sayMission(C.cardMission(cfg, { source, bar, rounds }));
      // A swap into every slot: each option the sheet offers, said in its slot.
      base.exercises.forEach((_, i) => {
        for (const o of C.cardSwapOptions(base, i, { bar })) sayMission(C.cardMission(cfg, { source, bar, swaps: { [i]: o.name }, rounds: 2 }));
      });
    }
  }
  return [
    { feature: 'Quick Mission', name: 'workout card: every slot\'s lead line in rounds 1 to 10 (balanced deal, WARRIOR, swaps, no bar)', lines: [...lead] },
    { feature: 'Quick Mission', name: 'workout card: chained, short-rest, switch and up-next lines for every card move and dose', lines: [...other] },
    { feature: 'Quick Mission', name: 'workout card: the round-end rest call for rounds 1 to 9', lines: [...rest] },
  ];
}

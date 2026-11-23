// Fit Challenge looks: the WORKOUT CARD's arithmetic (data/challengeTotals).
// 99 reps a round makes 198 / 297 / 396 / 495 over 2-5 rounds; a swap changes
// one row and the totals; a round counts only when every move in it is ticked;
// a timed move counts in seconds, never in reps.
// Run with `npm run test:challenge`.
const T = await import('../components/training-mode/data/challengeTotals.js');

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}  ${extra}`); } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const section = (t) => console.log(`\n${t}`);

// FULL BODY WARRIOR, the default card (the spec's moves in the library's names).
const WARRIOR = [
  { id: 'dive', name: 'Dive Bomber Push-Ups', reps: 12, pattern: 'push' },
  { id: 'push', name: 'Push-Ups', reps: 16, pattern: 'push' },
  { id: 'pull', name: 'Pull-Ups', reps: 8, pattern: 'pull', bar: true, noBar: { id: 'snow', name: 'Reverse Snow Angels', reps: 12, pattern: 'pull' } },
  { id: 'rows', name: 'Inverted Rows', reps: 16, pattern: 'pull' },
  { id: 'pike', name: 'Pike Push-Ups', reps: 8, pattern: 'push' },
  { id: 'squat', name: 'Air Squats', reps: 15, pattern: 'legs' },
  { id: 'hkr', name: 'Hanging Knee Raises', reps: 12, pattern: 'core', bar: true, noBar: { id: 'legs', name: 'Leg Raises', reps: 12, pattern: 'core' } },
  { id: 'rcurl', name: 'Reverse Curls', reps: 12, pattern: 'arms' },
];

section('totals: 99 a round over 2 to 5 rounds');
check('99 reps a round, 8 moves, no timed work', eq(T.roundTotals(WARRIOR), { moves: 8, reps: 99, seconds: 0 }), JSON.stringify(T.roundTotals(WARRIOR)));
for (const [r, want] of [[2, 198], [3, 297], [4, 396], [5, 495]]) {
  const t = T.challengeTotals(WARRIOR, r);
  check(`${r} rounds: ${want} reps`, t.totalReps === want && t.rounds === r && t.repsPerRound === 99, JSON.stringify(t));
}
check('the round choices are 2, 3, 4 and 5', eq(T.ROUND_CHOICES, [2, 3, 4, 5]));
check('rounds clamp to 2..5', T.clampRounds(1) === 2 && T.clampRounds(9) === 5 && T.clampRounds(3.4) === 3 && T.clampRounds('x') === 2);
const mins = [2, 3, 4, 5].map((r) => T.challengeTotals(WARRIOR, r).estMinutes);
check('more rounds take longer (about 13 / 20 / 27 / 35 min)', eq(mins, [13, 20, 27, 35]), JSON.stringify(mins));
check('the estimate: 3 s a rep, 10 s a change, 60 s between rounds', T.estimateSeconds(WARRIOR, 1) === 99 * 3 + 7 * 10 && T.estimateSeconds(WARRIOR, 2) === 2 * (99 * 3 + 70) + 60);
check('no moves or no rounds: nothing', T.challengeTotals([], 4).totalReps === 0 && T.challengeTotals([], 4).estMinutes === 0 && T.challengeTotals(WARRIOR, 0).totalReps === 0);

section('a swap changes only its row');
const swapped = T.swapMove(WARRIOR, 2, { id: 'chin', name: 'Chin-Ups', reps: 10, pattern: 'pull', bar: true });
check('one row differs, at the index swapped', swapped.filter((m, i) => m !== WARRIOR[i]).length === 1 && swapped[2].name === 'Chin-Ups');
check('the other seven are the very same moves', swapped.every((m, i) => i === 2 || m === WARRIOR[i]));
check('the list is not changed in place', WARRIOR[2].name === 'Pull-Ups' && swapped !== WARRIOR);
check('the totals follow: 8 reps out, 10 in = 101 a round, 404 over 4', T.challengeTotals(swapped, 4).repsPerRound === 101 && T.challengeTotals(swapped, 4).totalReps === 404);
check('the rounds stay as they were', T.challengeTotals(swapped, 4).rounds === 4);

section('without a pull-up bar');
const noBar = T.withoutBar(WARRIOR);
check('Pull-Ups and Hanging Knee Raises step aside', noBar[2].name === 'Reverse Snow Angels' && noBar[6].name === 'Leg Raises');
check('each says what it stands in for', noBar[2].noBarFor === 'Pull-Ups' && noBar[6].noBarFor === 'Hanging Knee Raises');
check('the six floor moves stay', noBar.every((m, i) => (i === 2 || i === 6 ? m !== WARRIOR[i] : m === WARRIOR[i])));
check('103 a round (8 → 12 rows), 412 over 4', T.challengeTotals(noBar, 4).repsPerRound === 103 && T.challengeTotals(noBar, 4).totalReps === 412);
check('still balanced', T.isBalanced(noBar));

section('the balanced full-body deal');
check('3 push, 2 pull, 1 legs, 1 core, 1 arms', eq(T.patternCounts(WARRIOR), { push: 3, pull: 2, legs: 1, core: 1, arms: 1 }) && T.isBalanced(WARRIOR));
check('one line: "3 push · 2 pull · legs · core · arms"', T.balanceLine(WARRIOR) === '3 push · 2 pull · legs · core · arms', T.balanceLine(WARRIOR));
check('a pull day is not a full-body deal', !T.isBalanced(WARRIOR.map((m) => ({ ...m, pattern: 'pull' }))));

section('the tracker: a round counts only when every move is ticked');
let ticks = T.emptyTicks(5, 8);
check('an empty grid: 5 rounds of 8, nothing done', ticks.length === 5 && ticks.every((r) => r.length === 8 && r.every((v) => v === false)));
let p = T.tickProgress(WARRIOR, ticks);
check('… round 1 is current, 0%, 495 reps left', p.currentRound === 1 && p.roundsDone === 0 && p.pct === 0 && p.repsLeft === 495 && !p.done);
for (let r = 0; r < 2; r++) for (let i = 0; i < 8; i++) ticks = T.setTick(ticks, r, i, true);
for (let i = 0; i < 4; i++) ticks = T.setTick(ticks, 2, i, true);
p = T.tickProgress(WARRIOR, ticks);
check('2 rounds and 4 of round 3: 2 rounds done, round 3 current', p.roundsDone === 2 && p.currentRound === 3, JSON.stringify(p));
check('… the partial round does not count as a round', !T.roundComplete(ticks[2]) && T.roundComplete(ticks[1]));
check('… 250 reps done, 245 left, 20 of 40 ticks = 50%', p.repsDone === 250 && p.repsLeft === 245 && p.ticked === 20 && p.cells === 40 && p.pct === 50, JSON.stringify(p));
const almost = (() => { let g = ticks; for (let i = 4; i < 7; i++) g = T.setTick(g, 2, i, true); return g; })();
check('7 of 8 ticked is still not a round', T.tickProgress(WARRIOR, almost).roundsDone === 2);
check('the 8th tick completes it', T.tickProgress(WARRIOR, T.setTick(almost, 2, 7, true)).roundsDone === 3);
check('setTick with no value toggles, and leaves the old grid alone', T.setTick(ticks, 2, 0)[2][0] === false && ticks[2][0] === true);
let all = T.emptyTicks(5, 8).map((r) => r.map(() => true));
p = T.tickProgress(WARRIOR, all);
check('everything ticked: done, 495 reps, 100%, no current round', p.done && p.repsDone === 495 && p.repsLeft === 0 && p.pct === 100 && p.currentRound === null);
check('an empty round is never complete', !T.roundComplete([]) && !T.roundComplete(null));

section('timed moves count in seconds, not reps');
const SHUFFLED = [
  { name: 'Decline Push-Ups', reps: 12, pattern: 'push' },
  { name: 'Chin-Ups', reps: 8, pattern: 'pull' },
  { name: 'Diamond Push-Ups', reps: 10, pattern: 'push' },
  { name: 'Wide Inverted Rows', reps: 12, pattern: 'pull' },
  { name: 'Dolphin Push-Ups', reps: 10, pattern: 'push' },
  { name: 'Walking Lunges', reps: 16, pattern: 'legs' },
  { name: 'Hollow Body Hold', seconds: 30, pattern: 'core' },
  { name: 'Triceps Dips', reps: 12, pattern: 'arms' },
];
check('a hold is timed, a rep move is not', T.isTimed(SHUFFLED[6]) && !T.isTimed(SHUFFLED[0]) && !T.isTimed({ reps: 10, seconds: 30 }));
const s4 = T.challengeTotals(SHUFFLED, 4);
check('80 reps + 30 s a round; 320 reps + 120 s over 4', s4.repsPerRound === 80 && s4.secondsPerRound === 30 && s4.totalReps === 320 && s4.totalSeconds === 120, JSON.stringify(s4));
check('the hold\'s seconds are in the time, not in the reps', T.estimateSeconds(SHUFFLED, 1) === 80 * 3 + 30 + 70);
let tk = T.emptyTicks(4, 8);
tk = T.setTick(tk, 0, 6, true);
p = T.tickProgress(SHUFFLED, tk);
check('ticking the hold: 30 s done, 0 reps done', p.secondsDone === 30 && p.repsDone === 0 && p.secondsLeft === 90 && p.repsLeft === 320);
check('still balanced (the hold is the core move)', T.isBalanced(SHUFFLED));

section('words');
check('doses: "12 reps", "30s", "2:00"', T.doseWord(WARRIOR[0]) === '12 reps' && T.doseWord(SHUFFLED[6]) === '30s' && T.holdWord(120) === '2:00');
check('the clock: 38:12, 1:02:05', T.mmss(2292) === '38:12' && T.mmss(3725) === '1:02:05');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

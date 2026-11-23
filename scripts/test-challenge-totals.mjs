// The Fit WORKOUT CARD: its arithmetic (data/challengeTotals: 99 reps a round
// makes 198 / 297 / 396 / 495 over 2-5 rounds; a swap changes one row and the
// totals; a round counts only when every move in it is ticked; a timed move
// counts in seconds, never in reps), and, since it was wired (switch fitCard,
// docs/fit-challenge/BUILD-NOTES.md): the rounds dealt from the time and the +
// button, the balanced deal and FULL BODY WARRIOR, the bar switch and swaps,
// the switch-off path, SAVE WORKOUT and YOUR WORKOUTS, the cardio cool-down
// hand-off, END in the START OVER? box, and XP paid once.
// Run with `npm run test:challenge` (in check:all).
import fs from 'node:fs';

const store = new Map();
const ls = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
globalThis.localStorage = ls;
globalThis.window = { localStorage: ls, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } };
globalThis.Event = globalThis.Event || class { constructor(t) { this.type = t; } };
const read = (rel) => fs.readFileSync(new URL(`../components/training-mode/${rel}`, import.meta.url), 'utf8');
const code = (rel) => read(rel).replace(/^\s*\/\/.*$/gm, '');

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

// ── wired: the card (data/fitCard) ──────────────────────────────────────────
const C = await import('../components/training-mode/data/fitCard.js');
const S = await import('../components/training-mode/data/fitCardStore.js');
const G = await import('../components/training-mode/fit-mode/quickMissionGenerator.js');
const X = await import('../components/training-mode/data/quickMissionXp.js');
const U = await import('../components/training-mode/data/userStats.js');
const MS = await import('../components/training-mode/data/missionSolo.js');
const SG = await import('../components/training-mode/data/soloFromGenerated.js');
const CA = await import('../components/training-mode/data/cardioAddon.js');
const CS = await import('../components/training-mode/data/cardioSessions.js');
const cfgOf = (o = {}) => ({ workoutType: 'Bodyweight', duration: 20, difficulty: 'Normal', focus: 'Full Body', format: 'Auto', cardioFinisher: false, ...o });
const SEED = C.daySeed(new Date(2026, 10, 23, 10));
const deal = (o = {}, opts = {}) => C.cardMission(cfgOf(o), { source: { kind: 'deal', seed: SEED, shuffles: 0 }, ...opts });

section('rounds: dealt from the time, as Quick Mission does');
for (const mins of [5, 10, 15, 20, 30, 45, 60]) {
  const m = deal({ duration: mins });
  const off = Math.abs(G.estimateQuickMissionSeconds(m) - mins * 60);
  check(`${mins} min: ${G.roundsFor(mins)} rounds, the run lands within 30 s of the minutes (${Math.round(off)} s off), the minutes stay ${mins}`, m.rounds === G.roundsFor(mins) && off <= 30 && m.duration === mins, JSON.stringify({ r: m.rounds, d: m.duration, off }));
}
check('the same day gives the same deal; another day another', JSON.stringify(deal().exercises) === JSON.stringify(deal().exercises)
  && JSON.stringify(deal().exercises) !== JSON.stringify(C.cardMission(cfgOf(), { source: { kind: 'deal', seed: C.daySeed(new Date(2026, 10, 24, 10)), shuffles: 0 } }).exercises));
check('SHUFFLE deals new moves with the same level, gear, focus and rounds', (() => {
  const a = deal(), b = C.cardMission(cfgOf(), { source: { kind: 'deal', seed: SEED, shuffles: 1 } });
  return JSON.stringify(a.exercises.map((e) => e.name)) !== JSON.stringify(b.exercises.map((e) => e.name)) && a.rounds === b.rounds && a.difficulty === b.difficulty && a.workoutType === b.workoutType;
})());

section('the + button: a round more, its reps, the time and the XP follow');
{
  const m0 = deal();
  const r1 = C.stepRounds(m0.rounds, 1);
  const m1 = deal({}, { rounds: r1 });
  const t0 = C.cardTotals(m0), t1 = C.cardTotals(m1);
  check(`+ from ${m0.rounds} makes ${r1} rounds of the same moves and doses`, r1 === m0.rounds + 1 && m1.rounds === r1 && JSON.stringify(m1.exercises) === JSON.stringify(m0.exercises));
  check(`the sum follows: ${t1.repsPerRound} × ${r1} = ${t1.totalReps}`, t1.repsPerRound === t0.repsPerRound && t1.totalReps === t0.repsPerRound * r1 && t1.totalSeconds === t0.secondsPerRound * r1);
  check(`the time follows (about ${t0.estMinutes} → ${t1.estMinutes} min) and the minutes the XP reads are the card's`, t1.estMinutes > t0.estMinutes && m1.duration === C.missionMinutes(m1));
  check(`the XP follows the minutes (${C.cardWorkXp(m0)} → ${C.cardWorkXp(m1)})`, C.cardWorkXp(m1) > C.cardWorkXp(m0) && C.cardWorkXp(m1) === X.generatedMissionXp(m1));
  check('− takes it back off: the same card as the time made', JSON.stringify(deal({}, { rounds: C.stepRounds(r1, -1) }).exercises) === JSON.stringify(m0.exercises) && C.stepRounds(r1, -1) === m0.rounds);
  check('rounds stay between 1 and 10', C.stepRounds(1, -1) === 1 && C.stepRounds(10, 1) === 10 && deal({}, { rounds: 99 }).rounds === 10 && deal({}, { rounds: 0 }).rounds === 1);
  const xs = [2, 3, 4, 5].map((r) => C.cardWorkXp(deal({}, { rounds: r })));
  check(`5 rounds pays more than 2 (${xs.join(' < ')})`, xs.every((v, i) => !i || v > xs[i - 1]));
  const lv = ['Easy', 'Normal', 'Hard', 'Advanced'].map((d) => C.cardWorkXp(deal({ difficulty: d })));
  check(`the same minutes never pay less at a harder level (${lv.join(' ≤ ')})`, lv.every((v, i) => !i || v >= lv[i - 1]));
}

section('the balanced deal and FULL BODY WARRIOR');
{
  const m = deal({ duration: 35 });
  const b = C.cardBalance(m);
  check(`35 min deals the full circuit: ${b?.line}`, m.exercises.length === 8 && b?.full === true && b.line === '3 push · 2 pull · legs · core · arms', JSON.stringify(m.exercises.map((e) => e.name)));
  check('every move of every deal is a card move with a plain clip (QUICK_MISSION_POOL_NAMES, swept by test:spoken)', [5, 12, 20, 33, 47, 60].every((d) => ['Bodyweight', 'Weighted', 'Hybrid'].every((g) => ['Easy', 'Advanced'].every((lv) => deal({ duration: d, workoutType: g, difficulty: lv }).exercises.every((e) => G.QUICK_MISSION_POOL_NAMES.includes(e.name) && C.cardMoveInfo(e.name))))));
  check('EASY never deals a tier-3 move', [5, 20, 40, 60].every((d) => [0, 1, 2, 3].every((n) => C.cardMission(cfgOf({ duration: d, difficulty: 'Easy' }), { source: { kind: 'deal', seed: SEED + n, shuffles: n } }).exercises.every((e) => C.cardMoveInfo(e.name).tier < 3))));
  const w = C.cardMission(cfgOf(), { source: { kind: 'warrior' } });
  check('FULL BODY WARRIOR: 8 moves, 99 reps a round, balanced', w.title === 'FULL BODY WARRIOR' && w.exercises.length === 8 && C.cardTotals(w).repsPerRound === 99 && C.cardBalance(w).full);
  check('… Reverse Curls waits for a recording: Resistance Towel Curls holds its place', !w.exercises.some((e) => e.name === 'Reverse Curls') && w.exercises[7].name === 'Resistance Towel Curls');
  const wr = [10, 20, 30, 45].map((d) => C.cardMission(cfgOf({ duration: d }), { source: { kind: 'warrior' } }).rounds);
  check(`… its rounds come from the time (10/20/30/45 min: ${wr.join(' / ')})`, wr.every((r, i) => !i || r >= wr[i - 1]) && wr[0] < wr[3]);
  check('… Inverted Rows stay, noted "table or low bar"', C.gearNoteOf('Inverted Rows') === 'table or low bar' && w.exercises.some((e) => e.name === 'Inverted Rows'));
}

section('no pull-up bar, and swaps: the clock and the XP never move');
{
  const w = C.cardMission(cfgOf(), { source: { kind: 'warrior' } });
  const nb = C.cardMission(cfgOf(), { source: { kind: 'warrior' }, bar: false });
  check('Pull-Ups → Reverse Snow Angels, Hanging Knee Raises → Leg Raises, each saying what it stands in for', nb.exercises[2].name === 'Reverse Snow Angels' && nb.exercises[2].noBarFor === 'Pull-Ups' && nb.exercises[6].name === 'Leg Raises' && nb.exercises[6].noBarFor === 'Hanging Knee Raises');
  // (The run's model times a counted set's last number by the word, so a
  // stand-in can move the estimate by a second, never the minutes.)
  check('… the same reps and rest, so the same minutes and XP', nb.exercises.every((e, i) => e.reps === w.exercises[i].reps && e.rest === w.exercises[i].rest) && Math.abs(C.cardTotals(nb).estSeconds - C.cardTotals(w).estSeconds) <= 5 && C.cardTotals(nb).estMinutes === C.cardTotals(w).estMinutes && C.cardWorkXp(nb) === C.cardWorkXp(w));
  const both = C.applyBar([{ name: 'Pull-Ups', mode: 'reps', reps: 8, rest: 30 }, { name: 'Reverse Snow Angels', mode: 'reps', reps: 12, rest: 30 }], false);
  check('a stand-in already on the card is never dealt twice', both[0].name === 'Superman Pulls' && both[1].name === 'Reverse Snow Angels');
  const opts = C.cardSwapOptions(w, 2);
  check(`Pull-Ups' swaps: ${opts.map((o) => `${o.label} ${o.name}`).join(', ')}`, opts.length >= 2 && opts.every((o) => C.cardMoveInfo(o.name).pattern === 'pull' && !w.exercises.some((e) => e.name === o.name)) && opts.some((o) => o.kind === 'no-gear'));
  check('with the bar off no swap offers a bar move', C.cardSwapOptions(nb, 3, { bar: false }).every((o) => !C.cardMoveInfo(o.name).bar));
  const sw = C.cardMission(cfgOf(), { source: { kind: 'warrior' }, swaps: { 2: opts[0].name } });
  check('a swap changes one row (its name), keeps its dose and rest, the time and the XP', sw.exercises.filter((e, i) => e.name !== w.exercises[i].name).length === 1 && sw.exercises[2].reps === 8 && C.cardTotals(sw).estMinutes === C.cardTotals(w).estMinutes && C.cardWorkXp(sw) === C.cardWorkXp(w));
  const d = deal({ duration: 30 });
  check('a hold swaps only for a hold, reps for reps', d.exercises.every((e, i) => C.cardSwapOptions(d, i).every((o) => !!C.cardMoveInfo(o.name).timed === (e.mode === 'timed'))));
}

section('the switch off: Fit Mode exactly as before');
{
  const F = read('data/retentionFlags.js');
  check('fitCard is off for everyone (FOR_EVERYONE), on only with the owner preview', /fitCard: false/.test(F) && /retentionOn = \(key\) => !!FOR_EVERYONE\[key\] \|\| isOwnerPreview\(\)/.test(F));
  const rng = (n) => G.seededRng(n);
  const same = [5, 9, 20, 37, 60].every((d) => ['Bodyweight', 'Weighted', 'Hybrid'].every((g) => ['Full Body', 'Upper', 'Core'].every((f) => {
    const a = G.generateQuickMission({ workoutType: g, duration: d, focus: f, difficulty: 'Normal', rng: rng(d * 7 + 1) });
    const b = G.generateQuickMission({ workoutType: g, duration: d, focus: f, difficulty: 'Normal', rng: rng(d * 7 + 1), balanced: false });
    return JSON.stringify(a) === JSON.stringify(b);
  })));
  check('the generator without `balanced` deals exactly what it did (no new field, the same draws)', same);
  check('a mission dealt without the card carries no pattern or card fields', !JSON.stringify(G.generateQuickMission({ duration: 20, rng: rng(3) })).match(/pattern|noBarFor|"card"/));
  check('the Quick Mission page: QuickMissionSetup unless the switch is on (read once per mount)', /useState\(\(\) => retentionOn\('fitCard'\)\)/.test(code('fit-challenge/QuickMissionScreen.jsx')) && /card \? <FitCardSetup \{\.\.\.props\}\/> : <QuickMissionSetup \{\.\.\.props\}\/>/.test(code('fit-challenge/QuickMissionScreen.jsx')));
  const R = code('ScreenRouter.jsx');
  check('the router: CHECK-OFF and the card results only for a cfg, stash or result that says so', /qmCfg\.checkOff === true/.test(R) && /resumeData\.checkOff === true/.test(R) && /screen === 'qm_complete' && qmResult\?\.card/.test(R));
  check('Programs and Progress read the switch once per mount', /useState\(\(\) => retentionOn\('fitCard'\)\)/.test(code('ProgramsScreen.jsx')) && /useState\(\(\) => retentionOn\('fitCard'\)\)/.test(code('ProgressScreen.jsx')));
  const A = code('App.jsx');
  check('App: a card only from the result or the cfg (never set without the switch)', /const card = result\?\.card \|\| qmCfg\?\.card \|\| null;/.test(A) && /\.\.\.\(cardFields \? \{ cardFields \} : \{\}\)/.test(A));
  check('no card, no extra row fields', JSON.stringify(C.cardRowFields(null)) === '{}');
  // The stored keys gain no field until the card writes one.
  check('tm_qm_keys_v1 keeps its four keys until the card sets the bar', (() => {
    const src = read('data/quickMissionConfig.js');
    return /\.\.\.\(typeof k\?\.bar === 'boolean' \? \{ bar: k\.bar \} : \{\}\)/.test(src);
  })());
}

section('SAVE WORKOUT and YOUR WORKOUTS');
{
  store.clear();
  const w = C.cardMission(cfgOf(), { source: { kind: 'warrior' }, rounds: 4 });
  const snap = C.snapshotOf(w);
  const e1 = S.saveCardWorkout(snap, 1000);
  check('SAVE WORKOUT keeps the moves, doses, rests and rounds', S.loadSavedWorkouts().length === 1 && e1.rounds === 4 && e1.exercises.length === 8 && e1.exercises[0].rest === w.exercises[0].rest);
  S.saveCardWorkout(snap, 2000);
  check('the same workout saved twice is kept once', S.loadSavedWorkouts().length === 1 && S.isSaved(snap));
  for (let i = 0; i < 12; i++) S.saveCardWorkout({ ...snap, rounds: (i % 10) + 1, title: `W${i}` }, 3000 + i);
  check(`the shelf holds ${S.MAX_SAVED}, newest first`, S.loadSavedWorkouts().length === S.MAX_SAVED && S.loadSavedWorkouts()[0].title === 'W11');
  const again = C.snapshotMission(e1);
  check('a saved workout runs exactly as saved', again.rounds === 4 && JSON.stringify(again.exercises.map((e) => [e.name, e.reps, e.rest])) === JSON.stringify(w.exercises.map((e) => [e.name, e.reps, e.rest])));
  check('the store is synced (cloudSync SYNC_KEYS)', /'tm_fit_card_v1'/.test(read('data/cloudSync.js')));
  S.rememberCardRun('card-a', snap);
  check('a finished card run is kept for YOUR WORKOUTS\' repeat', S.cardRunById('card-a')?.title === 'FULL BODY WARRIOR' && S.cardRunById('nope') === null);
  check('CHECK-OFF is on until turned off, and remembered', S.checkOffOn() === true && S.setCheckOff(false) === false && S.checkOffOn() === false && S.setCheckOff(true) === true);

  const at = (d, h) => new Date(2026, 10, d, h, 0, 0).toISOString();
  const sessions = [
    { id: 'a', type: 'Quick Mission', completedAt: at(21, 9), completedCount: 40, totalCount: 40, xpEarned: 555, elapsedSec: 2292, ...C.cardRowFields({ title: 'FULL BODY WARRIOR', rounds: 5 }, { roundsDone: 5, repsDone: 495, cardId: 'card-a' }) },
    { id: 'b', type: 'Fight Focus', completedAt: at(22, 18), completedCount: 3, totalCount: 3, xpEarned: 90 },
    { id: 'c', type: 'Mission of the Day', completedAt: at(22, 18), completedCount: 1, totalCount: 1, xpEarned: 25 },
    { id: 'd', type: 'Cardio', completedAt: at(20, 7), completedCount: 1, totalCount: 1, xpEarned: 120, method: 'Outdoor Run', completedTimeSeconds: 1200 },
    { id: 'e', type: 'Quick Mission', completedAt: at(10, 7), completedCount: 6, totalCount: 8, xpEarned: 200 },
    { id: 'f', type: 'Hybrid Training Bonus', completedAt: at(21, 9), completedCount: 1, totalCount: 1, xpEarned: 40 },
  ];
  const rows = C.workoutRows(sessions);
  check('every mode, newest first, no XP-only rows', rows.map((r) => r.id).join('') === 'bade');
  check('a card row: its title, rounds and reps, time and %', rows[1].name === 'FULL BODY WARRIOR' && rows[1].line === '5 rounds · 495 reps' && rows[1].elapsedSec === 2292 && rows[1].pct === 100 && rows[1].cardId === 'card-a');
  check('an older row reads as its mode', rows[3].name === 'QUICK MISSION' && rows[3].line === '6 of 8 sets' && rows[3].pct === 75);
  check('a cardio row: its method and minutes', rows[2].name === 'OUTDOOR RUN' && rows[2].line === 'Cardio · 20 min');
  const wk = C.lastWeek(rows, new Date(2026, 10, 23, 10).getTime());
  check(`the last 7 days: ${wk.count} workouts, ${wk.xp} XP`, wk.count === 3 && wk.xp === 555 + 90 + 120);
  check('a row only carries scalars (the synced snapshot is rewritten whole)', Object.values(C.cardRowFields({ title: 'X', rounds: 3 }, { roundsDone: 2, repsDone: 100, holdSec: 30, cardId: 'k' })).every((v) => typeof v !== 'object'));
}

section('the bonus cardio hand-off: straight into a cool-down, never paid');
{
  const a = C.coolDownAddon();
  check('BONUS TRAINING lists Cardio first', C.BONUS_ITEMS[0].id === 'cardio' && C.BONUS_ITEMS[0].cardio === true);
  check('ticked, it is an enabled cardio add-on: an easy 10-minute walk, marked cool-down and bonus', a.enabled === true && a.coolDown === true && a.bonus === true && a.cardioType === 'walk' && a.targetTimeSeconds === 600 && a.style === 'steady' && C.isCoolDown(a));
  const pl = CA.cardioAddonToPlayer(a);
  check('the cardio finisher plays it as its steady timer (its own existing lines)', pl.format === 'steady' && pl.durationSeconds === 600);
  const FS = code('fit-challenge/FitCardSetup.jsx');
  check('START carries it as the run\'s cardio add-on, so the workout goes straight into it (App → CardioFinisherPlayer)', /const cardioAddon = bonusTicks\.cardio \? coolDownAddon\(\) : null;/.test(FS) && /onStart\?\.\(\{\s*\.\.\.cfg, cardioAddon,/.test(FS) && /const addon = qmCfg\?\.cardioAddon;\s*if \(addon\?\.enabled\)/.test(code('App.jsx')));
  check('no cardio XP and no hybrid bonus for it', /awardXp: addon\.bonus !== true/.test(code('CardioFinisherPlayer.jsx')) && /ctx\?\.addon\?\.bonus !== true/.test(code('App.jsx')));
  store.clear();
  const before = U.loadStats().xp;
  CS.logCardioSession({ completedTimeSeconds: 600, completed: true }, { awardXp: false });
  check('a cardio session logged unpaid leaves the XP as it was', U.loadStats().xp === before);
}

section('END in the START OVER? box, and XP paid once');
{
  const DC = code('fit-challenge/ui/DiscardConfirm.jsx');
  check('START OVER? has KEEP GOING, the throw-away and END at the bottom', /label="KEEP GOING"/.test(DC) && /label=\{confirmLabel\}/.test(DC) && /\{onEnd && \(/.test(DC) && /label="END"/.test(DC));
  const FC = code('fit-challenge/FitCheckOffSolo.jsx');
  check('… END ends the run the normal way (as AT YOUR PACE\'s END: banked, a stopped run)', /onEnd=\{\(\) => finish\('stop'\)\}/.test(FC) && /stopped: end === 'stop'/.test(FC));
  check('… SHUFFLE asks only when there are ticks to lose', /const shuffleTap = \(\) => \(progress \? setAsk\(\{ kind: 'shuffle' \}\) : doShuffle\(\)\);/.test(FC));

  const gen = deal();
  const solo = SG.soloFromGenerated(gen);
  const slots = MS.totalSlots(solo);
  const res = (o) => ({ mode: 'solo', completed: true, format: solo.format, mission: solo, elapsedSec: solo.pace.standard, totalSlots: slots, exercisesCompleted: slots, ...o });
  const full = MS.settleSoloXp(res({}));
  check(`a finished CHECK-OFF run pays the card's minutes at its level (+30 on banking): ${full.xp}`, full.outcome === 'pass' && full.xp > 0);
  check('ticks never pay: the same run with every tick or none settles alike', MS.settleSoloXp(res({ ticks: [[true]] })).xp === full.xp && MS.settleSoloXp(res({ ticks: [] })).xp === full.xp);
  check('the too-fast floor stays (a finish in one minute pays 0)', MS.settleSoloXp(res({ elapsedSec: 60 })).xp === 0 && MS.settleSoloXp(res({ elapsedSec: 60 })).outcome === 'too_fast');
  const stop = MS.settleSoloXp(res({ completed: false, stopped: true, elapsedSec: Math.round(solo.pace.standard / 2), exercisesCompleted: 5 }));
  check(`END halfway pays its share by time (${stop.xp} of ${full.xp})`, stop.outcome === 'partial' && stop.xp > 0 && stop.xp < full.xp);

  store.clear();
  const xp1 = U.addQuickMissionSoloSession({ xpEarned: full.xp, missionId: 'generated', completed: true, completedCount: slots, totalCount: slots, cardFields: C.cardRowFields(C.snapshotOf(gen), { roundsDone: gen.rounds, repsDone: C.cardTotals(gen).totalReps, cardId: 'card-x' }) });
  const after = U.loadStats();
  check('the run banks one row with the card\'s fields', after.sessions.length === 1 && after.sessions[0].title === gen.title && after.sessions[0].cardId === 'card-x' && after.xp === xp1);
  S.saveCardWorkout(C.snapshotOf(gen));
  S.saveCardWorkout(C.snapshotOf(gen));
  check('SAVE WORKOUT (twice) writes no second row and no XP', U.loadStats().sessions.length === 1 && U.loadStats().xp === xp1);
  check('SAVE WORKOUT never touches the stats (data/fitCardStore imports no userStats)', !/userStats|addXp|saveStats/.test(code('data/fitCardStore.js')) && !/userStats|addQuickMission/.test(code('fit-challenge/FitCardResults.jsx')));
  const done = C.cardRunDone(C.snapshotOf(gen), { ticks: T.emptyTicks(gen.rounds, gen.exercises.length).map((r, i) => r.map(() => i === 0)) });
  check('a run\'s reps for its row: one round ticked is one round of reps', done.roundsDone === 1 && done.repsDone === C.cardTotals(gen).repsPerRound && done.ticked === gen.exercises.length);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

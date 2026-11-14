// The Workout Builder's guided player (components/training-mode/FitBuilderGuidedPlayer.jsx):
// the lines whose NUMBERS come from the edit sheet, the custom set scheme and the
// generator, said over a library exercise's name. The names themselves are swept
// by the "a library exercise said by name" sweep in spoken-sweeps.mjs and by the
// concept and named-workout modules; here one probe name carries the numbers
// (a number clip does not depend on the name, and a sentence is planned apart).
//
// Where the numbers can come from (every value a screen can produce):
//   · rest: shared/ExerciseEditSheet.jsx steps REST by 15 inside 15-300 from the
//     dealt value; the custom set scheme (FitBuilderSetup.jsx:272-276) is a number
//     field that takes ANY whole second of 15-300; the generator deals 18, 20, 25,
//     30, 35, 38, 45, 60 and 75 (fitModeGenerator.js FOCUS_PARAMS and the
//     difficulty tables, a timed move resting half). So every whole second of
//     15-300 is a rest the player can say. restMax = ex.restSeconds || parseInt(ex.rest) || 60 (:143).
//   · sets 1-8 (edit sheet and custom scheme; the generator deals 2-4); chain rounds
//     2-5 for a circuit, a superset's rounds are the sets of its first move (1-8)
//     (FitBuilderWorkout.jsx:938): so "Set s of T" and "Round r of R" for 1-8.
//   · reps 1-60 (edit sheet; the custom scheme stops at 50); a hold is 10-180 s in
//     fives from the dealt value (the library deals 20, 30, 40 and 45; the cardio
//     finisher 30, 40, 45).
// Lines built, each as the player builds it (the helper below is copied with its line):
//   :433  `Set complete. Rest ${sayWindow(restMax)}.`
//   :418  `Round ${round} complete. Rest ${sayWindow(restMax)}.` (round 1 to the one before the last)
//   :482  `${name}. ${unit}. ${reps} reps. On my count.` for a bodyweight move, with
//         unit `Set s of T` (:472) or `Round r of R`, and :496 the rep count String(i)
//   :519  `${name}. ${unit}. ${reps} reps. ${window} to complete, with ${rest} rest. Get into position.`
//         for a weighted move from its second set on (set 1 says "Load N. Get ready. Lift."
//         at :506), the window being classify()'s (:100) ~12 s a rep rounded up to 30 s
//   :538  `${name}. ${unit}. ${seconds} seconds. Get into position.` for a hold
//   :557  `${elapsed} seconds down.` every 30 s of a hold while more than 5 s remain
//   :506, :526  `Load ${w}. Get ready. Lift.`, w the working weight the athlete sets
//         (5 lb or 2.5 kg a tap; a kg half such as 7.5 is said as a decimal). It is a
//         line of its own at the end of this list, beyond the numbers above, so it can
//         be told apart.
// The names of :410, :442, :663 and :682 ("Straight into X", "X complete", "Skipping to X",
// "Back to X") carry no number; they are the library name sweep's.

const sayWindowOf = (sec) => (sec % 60 === 0 ? `${sec / 60} minute${sec >= 120 ? 's' : ''}` : `${sec} seconds`); // FitBuilderGuidedPlayer.jsx:86, copied
const weightedWindow = (reps) => Math.max(60, Math.ceil((reps * 12) / 30) * 30); // FitBuilderGuidedPlayer.jsx:100, copied
const range = (lo, hi, step = 1) => { const out = []; for (let v = lo; v <= hi + 1e-9; v += step) out.push(Math.round(v * 100) / 100); return out; };

const FEATURE = 'Workout Builder';
const PROBE = 'Goblet Squats';

export default async () => {
  if (typeof globalThis.localStorage === 'undefined') {
    const store = new Map();
    globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), clear: () => store.clear(), key: () => null, length: 0 };
  }
  const { FIT_MODE_EXERCISES } = await import('../../components/training-mode/fit-mode/fitModeExerciseData.js');
  const active = FIT_MODE_EXERCISES.filter((e) => e.active !== false);
  const name = active.some((e) => e.name === PROBE) ? PROBE : active[0].name;
  const sayWindow = sayWindowOf;

  // ── rest ────────────────────────────────────────────────────────────────
  const GENERATOR_RESTS = [18, 20, 25, 30, 35, 38, 45, 60, 75];
  const allRests = [...new Set([...range(15, 300), ...GENERATOR_RESTS])].sort((a, b) => a - b);
  // The weighted line carries rest and reps at once: kept bounded to the edit sheet's steps of 15 plus the generator's.
  const stepRests = [...new Set([...range(15, 300, 15), ...GENERATOR_RESTS])].sort((a, b) => a - b);

  const restLines = [];
  for (const r of allRests) {
    restLines.push(`Set complete. Rest ${sayWindow(r)}.`);
    for (let round = 1; round <= 7; round++) restLines.push(`Round ${round} complete. Rest ${sayWindow(r)}.`);
  }

  // ── set and round counts ───────────────────────────────────────────────
  const unitLines = [];
  for (let T = 1; T <= 8; T++) for (let s = 1; s <= T; s++) unitLines.push(`${name}. Set ${s} of ${T}. 10 reps. On my count.`);
  for (let R = 1; R <= 8; R++) for (let r = 1; r <= R; r++) unitLines.push(`${name}. Round ${r} of ${R}. 10 reps. On my count.`);

  // ── bodyweight reps, and the count aloud ───────────────────────────────
  const repLines = [];
  for (const n of range(1, 60)) repLines.push(`${name}. Set 1 of 3. ${n} reps. On my count.`);
  for (const n of range(1, 60)) repLines.push(String(n)); // :496, speakAsync(String(i)) for every rep of the set

  // ── weighted set ────────────────────────────────────────────────────────
  const weightedLines = [];
  for (const reps of range(1, 60)) {
    for (const r of stepRests) weightedLines.push(`${name}. Set 2 of 3. ${reps} reps. ${sayWindow(weightedWindow(reps))} to complete, with ${sayWindow(r)} rest. Get into position.`);
  }

  // ── holds ───────────────────────────────────────────────────────────────
  // The dealt holds: the library's (durationSeconds, or a reps string such as "30s") and the generator's
  // 30, 40 and 45; the edit sheet then steps 5 s up and down inside 10-180 from whatever it started on.
  const starts = new Set([10, 30, 40, 45]);
  for (const e of FIT_MODE_EXERCISES) {
    if (Number.isFinite(e.durationSeconds) && e.durationSeconds > 0) starts.add(e.durationSeconds);
    const m = String(e.reps ?? '').trim().match(/^(\d+)\s*s$/i);
    if (m) starts.add(parseInt(m[1], 10));
  }
  const holds = new Set();
  for (const h0 of starts) {
    for (let h = h0; h >= 10; h -= 5) holds.add(h);
    for (let h = h0; h <= 180; h += 5) holds.add(h);
  }
  for (const h of range(10, 180, 5)) holds.add(h);
  const holdLines = []; const downLines = [];
  for (const h of [...holds].sort((a, b) => a - b)) {
    holdLines.push(`${name}. Set 1 of 3. ${h} seconds. Get into position.`);
    for (let elapsed = 30; h - elapsed > 5; elapsed += 30) downLines.push(`${elapsed} seconds down.`); // :557
  }

  // ── the working weight ─────────────────────────────────────────────────
  // Beyond the list: 5 lb a tap up to 660 lb (300 kg) and 2.5 kg a tap up to 300 kg. The edit sheet stops at 2000
  // but no lift is that heavy; the whole numbers plan from the number clips, a half such as 7.5 does not.
  const loadLines = [...range(5, 660, 5), ...range(2.5, 300, 2.5)].map((w) => `Load ${w}. Get ready. Lift.`);

  return [
    { feature: FEATURE, name: 'guided player rests: Set complete and Round complete over every rest 15-300 s and the generator\'s (FitBuilderGuidedPlayer.jsx:418, :433)', lines: restLines },
    { feature: FEATURE, name: 'guided player "Set s of T" and "Round r of R" for 1-8 (:472, :482)', lines: unitLines },
    { feature: FEATURE, name: 'guided player bodyweight reps 1-60 and the rep count aloud (:482, :496)', lines: repLines },
    { feature: FEATURE, name: 'guided player weighted set: reps 1-60 with its window and rest (:519)', lines: weightedLines },
    { feature: FEATURE, name: 'guided player holds 10-180 s and the library\'s own (:538)', lines: holdLines },
    { feature: FEATURE, name: 'guided player hold call-out "N seconds down." (:557)', lines: downLines },
    { feature: FEATURE, name: 'guided player working weight "Load N." (:506, :526), beyond the numbers above', lines: loadLines },
  ].map((s) => ({ ...s, lines: [...new Set(s.lines)] }));
};

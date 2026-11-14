// The Concept drops' fit training days (data/concepts/index.js), said by the
// Workout Builder's guided player (FitBuilderGuidedPlayer.jsx). A concept fit
// day is handed to that player whole (fitDayCfg savedExercises), so every
// line is an exercise name in the player's shapes plus the real numbers of
// that day's rows.
//
// The coverage tool only collected day 1 (fitDayCfg ignores `day` without
// saved progress). Here the day-indexed builder fitDayExercises(concept, i,
// { tier, home, progress }) is called for every concept in CONCEPT_SCHEDULE,
// every training day, every tier (easy, normal, hard), both home flags, and,
// for a skill ladder row, every rung of its ladder (progress.rungs seeds the
// rung, so a rung the athlete reaches later is swept too).
//
// Lines built:
//  1. Every distinct exercise name through libraryNameLines (spoken-sweeps.mjs),
//     the shapes of FitBuilderGuidedPlayer.jsx:410, :442, :482, :519, :538,
//     :663, :682.
//  2. The real plan of every distinct exercise row, built as the player builds
//     it: the intro with its real set count, reps, hold seconds, weighted
//     window and rest (:482, :519, :538), "Set complete. Rest ..." (:433), the
//     hold call-outs "N seconds down." every 30 s (:557), and, for a chained
//     circuit or superset, the round lines (:472, :410, :418, :424) with the
//     real round count.
//  3. The run intro of a concept run day (Cardio Mode, rc.buildRunIntro) for
//     each distance the concepts set (Night Vigilante miles, One Hundred km).
//
// Not spoken from concept data: the day title (conceptTitle) and day label are
// shown on screen only (FitBuilderWorkout.jsx:107 buildTitle), the coach note
// (voiceIntro) is not said by the guided player, and "Load N" is the weight
// the athlete types. The call-out quotes (QUOTES, :67) are fixed lines of the
// player, not concept data.
//
// What is and is not covered here. Only the REAL numbers of the concepts' days are
// built: the sets, reps, hold seconds, weighted windows and rests that
// fitDayExercises deals. The player's numbers over every value the screens allow
// (rest "Set complete. Rest N." and "Round N complete. Rest N." for every second
// of 15-300 as the edit sheet and the custom set scheme allow, "Set s of T" and
// "Round r of R" for 1-8, reps 1-60, the weighted window with its rest, holds
// 10-180 s, "N seconds down.", the working weight "Load N.") are NOT proven here
// and are not proven by spoken-sweeps.mjs either (its Workout Builder sweep says
// library names only): they are swept by sweeps/builder-numbers.mjs. (The Quick
// Mission rest call over 1 to 300 s is a different screen, swept by spoken-sweeps.mjs.)
import { libraryNameLines } from '../spoken-sweeps.mjs';

const TIERS = ['easy', 'normal', 'hard'];

export default async () => {
  const con = await import('../../components/training-mode/data/concepts/index.js');
  const rc = await import('../../components/training-mode/data/runCoach.js');

  // FitBuilderGuidedPlayer.jsx:86, copied character for character.
  const sayWindow = (sec) => (sec % 60 === 0 ? `${sec / 60} minute${sec >= 120 ? 's' : ''}` : `${sec} seconds`);
  // FitBuilderGuidedPlayer.jsx:89-103 (classify), same rules.
  const classify = (ex) => {
    const repsStr = String(ex.reps || '');
    const hold = repsStr.match(/^(\d+)\s*s$/i);
    if (hold) return { kind: 'hold', seconds: parseInt(hold[1], 10) };
    const nums = repsStr.match(/\d+/g);
    const reps = nums ? parseInt(nums[nums.length - 1], 10) : 10;
    if (String(ex.equipment || '').toLowerCase().includes('bodyweight')) return { kind: 'reps', reps };
    return { kind: 'weighted', reps, windowSec: Math.max(60, Math.ceil((reps * 12) / 30) * 30) };
  };
  // FitBuilderGuidedPlayer.jsx:143, rest seconds of a row.
  const restOf = (ex) => ex?.restSeconds || parseInt(ex?.rest) || 60;
  // index.js fitDayCfg, the circuit rounds a day hands the player.
  const circuitRounds = (day, tier) => Object.fromEntries(Object.entries(day?.circuits || {}).map(([k, v]) => [`concept-${k}`, Math.max(2, Math.min(5, v[tier] ?? v.normal ?? 3))]));

  // One line per spoken call of one exercise at one unit of work.
  const introLine = (ex, plan, unit) => {
    if (plan.kind === 'reps') return `${ex.name}. ${unit}. ${plan.reps} reps. On my count.`; // :482
    if (plan.kind === 'weighted') return `${ex.name}. ${unit}. ${plan.reps} reps. ${sayWindow(plan.windowSec)} to complete, with ${sayWindow(restOf(ex))} rest. Get into position.`; // :519
    return `${ex.name}. ${unit}. ${plan.seconds} seconds. Get into position.`; // :538
  };

  // Every concept, training day, tier, home flag and ladder rung.
  const rows = []; // { ex, chainRounds, group }
  const runGoals = [];
  for (const entry of con.CONCEPT_SCHEDULE) {
    const concept = entry.concept;
    const days = con.fitTrainingDays(concept);
    const ladderIds = Object.keys(concept.ladders || {});
    // Progress states: none, then each ladder pinned to each rung together.
    const maxRungs = Math.max(0, ...ladderIds.map((id) => concept.ladders[id].rungs.length));
    const progresses = [{ rungs: {} }];
    for (let r = 0; r < maxRungs; r++) progresses.push({ rungs: Object.fromEntries(ladderIds.map((id) => [id, Math.min(r, concept.ladders[id].rungs.length - 1)])) });
    days.forEach((day, i) => {
      if (day.run) {
        const unit = day.run.mi ? 'mi' : 'km';
        for (const t of TIERS) {
          const v = day.run[unit]?.[t] ?? day.run[unit]?.normal;
          for (const g of [].concat(v)) runGoals.push({ goal: Number(g), unit });
        }
      }
      for (const tier of TIERS) for (const home of [false, true]) for (const progress of progresses) {
        const list = con.fitDayExercises(concept, i, { tier, home, progress });
        const chainRounds = circuitRounds(day, tier);
        for (const ex of list) rows.push({ ex, chainRounds, group: list.filter((o) => o._chain && o._chain === ex._chain) });
      }
    });
  }

  const names = new Set(rows.map((r) => r.ex.name));
  const lines = new Set();
  for (const n of names) for (const l of libraryNameLines(n)) lines.add(l);

  for (const { ex, chainRounds, group } of rows) {
    const plan = classify(ex);
    const rest = sayWindow(restOf(ex));
    if (ex._chain) {
      // FitBuilderWorkout.jsx:937-938: a circuit is 3+ moves and takes the
      // day's round count, a 2-move superset runs the first move's sets.
      const circuit = group.length >= 3;
      const rounds = circuit ? (chainRounds[ex._chain] || 3) : (group[0]?.sets || 3);
      for (let round = 1; round <= rounds; round++) {
        lines.add(introLine(ex, plan, `Round ${round} of ${rounds}`));
        const next = group[group.indexOf(ex) + 1];
        if (group.indexOf(ex) < group.length - 1) lines.add(next ? `Straight into ${next.name}. No rest.` : 'Straight into the next move.'); // :410
        else if (round < rounds) lines.add(`Round ${round} complete. Rest ${rest}.`); // :418
        else lines.add(`${circuit ? 'Circuit' : 'Superset'} complete.`); // :424
      }
    } else {
      const sets = ex.sets || 3;
      for (let s = 1; s <= sets; s++) {
        lines.add(introLine(ex, plan, `Set ${s} of ${sets}`));
        if (s < sets) lines.add(`Set complete. Rest ${rest}.`); // :433
      }
    }
    if (plan.kind === 'hold') for (let e = 30; e < plan.seconds - 5; e += 30) lines.add(`${e} seconds down.`); // :557
    if (plan.kind === 'weighted' && plan.windowSec >= 30) lines.add('30 seconds.'); // :514, :533
  }

  const runLines = new Set();
  const seen = new Set();
  for (const { goal, unit } of runGoals) {
    const k = `${goal}${unit}`; if (seen.has(k)) continue; seen.add(k);
    // App.jsx:1144 opens Cardio Mode with { goal, unit }. The method label is
    // the athlete's choice; the full method range is proven by the Cardio run
    // intro sweep in spoken-sweeps.mjs, so a GPS jog and a machine run are
    // enough here.
    for (const [methodLabel, useGps] of [['Jog', true], ['Running', false]]) {
      for (const l of rc.buildRunIntro({ methodLabel, useGps, distance: goal, unit, targetSec: Math.round(goal * 540), eliteSec: Math.round(goal * 360) }).lines) runLines.add(l);
    }
  }

  return [
    { feature: 'Concept drops', name: 'fit days: every exercise name (every concept, day, tier, home flag, ladder rung) in the guided player shapes', lines: [...lines] },
    { feature: 'Concept drops', name: 'fit days: run day intro at each concept run distance', lines: [...runLines] },
  ];
};

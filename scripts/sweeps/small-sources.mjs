// Three small sources of spoken lines that no other sweep covers.
//
//  (a) Combat Conditioning (components/training-mode/CombatConditioningActive.jsx):
//      every speak call of the player, built over every drill the generator can deal.
//  (b) Combo Coach (components/training-mode/ComboCoachActive.jsx): the round intro
//      and the other calls that carry a setup value (discipline, round, cadence).
//  (c) Workout Builder cardio finisher (components/training-mode/fit-mode/fitModeGenerator.js):
//      the finisher move names, said by the guided player.
import fs from 'node:fs';
import { libraryNameLines } from '../spoken-sweeps.mjs';

const TM = new URL('../../components/training-mode/', import.meta.url);
const range = (lo, hi, step = 1) => { const out = []; for (let v = lo; v <= hi + 1e-9; v += step) out.push(Math.round(v * 100) / 100); return out; };

// ---------------------------------------------------------------------------
// (a) Combat Conditioning
// ---------------------------------------------------------------------------

// CombatConditioningActive.jsx:32-37, getEquipmentPrep, copied character for
// character (it is a function inside a .jsx file, so it cannot be imported).
// Its three answers are literals that sit outside any speak call.
function getEquipmentPrep(drill) {
  const name = (drill.name || '').toLowerCase();
  if (/bag|heavy bag|speed bag/i.test(name)) return 'Prepare your bag.';
  if (/dumbbell|kettlebell|barbell|weight|cable|landmine|plate|trap bar/i.test(drill.name || ''))
    return 'Grab your weight and prepare.';
  return 'Get in position.';
}

// Every mission the Combat Conditioning setup can start, built by the app's own
// generator, to learn which drills it really deals and with which numbers. The
// generator shuffles with Math.random, so it is run many times under a seeded
// generator (restored afterwards). The setup (CombatConditioningSetup.jsx:102,
// :23-28, :528-530) offers: styles Boxing, Kickboxing / Muay Thai and MMA; the four
// focus presets; difficulty Easy to Advanced; equipment NONE, BAG, WEIGHTS mapped to
// Bodyweight, Bags & Combat Gear, Basic Gym; rounds 2-12, work 10-120 s and rest 0-90 s.
// The WORK and REST steppers step by five but their centre value is a text field (shared/Stepper.jsx
// StepperRow: digits only, parsed by parseInt, clamped to min..max on blur), so ANY whole second of
// 10-120 (work) and 0-90 (rest) can be typed and reaches the generator (CombatConditioningSetup.jsx:445
// always passes both). 'Any' and 'Full Gym' are added here too (the generator accepts them).
async function harvestCombatConditioning() {
  const G = await import('../../components/training-mode/data/combatConditioningGenerator.js');
  const D = await import('../../components/training-mode/data/combatConditioningData.js');
  const STYLES = ['Boxing', 'Kickboxing / Muay Thai', 'MMA'];
  const FOCI = ['gas-tank', 'power', 'strike-strength', 'fight-athlete'];
  const DIFFS = ['Easy', 'Normal', 'Hard', 'Advanced'];
  const EQUIP = ['Bodyweight', 'Bags & Combat Gear', 'Basic Gym', 'Any', 'Full Gym'];
  // name -> { reps:Set, shapes:Set } where shape is 'timed' | 'cadence' | 'manual'
  const seen = new Map();
  const note = (d) => {
    if (!d || !d.name) return;
    const e = seen.get(d.name) || { reps: new Set(), shapes: new Set() };
    // Same branch order as CombatConditioningActive.jsx:311-328 (startDrill).
    if (d.workType === 'timed') e.shapes.add('timed');
    else if (d.workType === 'reps' && d.isCadenceSafe && !d.isManualDone) { e.shapes.add('cadence'); e.reps.add(d.reps || 10); }
    else { e.shapes.add('manual'); if (d.reps) e.reps.add(d.reps); }
    seen.set(d.name, e);
  };
  const realRandom = Math.random;
  let s = 7;
  Math.random = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  try {
    for (let rep = 0; rep < 25; rep++) for (const style of STYLES) for (const focus of FOCI) for (const difficulty of DIFFS) for (const equipment of EQUIP) {
      for (const cfg of [
        { style, focus, difficulty, equipment, duration: 20, format: 'Auto', rounds: 5, workSec: 40, restSec: 15 },
        { style, focus, difficulty, equipment, duration: 20, format: 'Auto', rounds: 3, workSec: 10, restSec: 0 },
      ]) {
        let m = null;
        try { m = G.generateCombatConditioningMission({ ...cfg, voiceOn: true, cadenceCount: true }); } catch { m = null; }
        for (const d of m?.drills || []) note(d);
      }
    }
  } finally { Math.random = realRandom; }
  // The pools themselves: every library drill and every prebuilt drill, so a
  // drill the seeded runs happened not to deal is still said. A drill the library
  // does not know (a prebuilt names it) is a timed drill in the generator.
  const pool = new Set([...D.CC_EXERCISE_LIBRARY.map((e) => e.name), ...D.CC_PREBUILT_WORKOUTS.flatMap((w) => w.exercises)]);
  for (const name of pool) {
    const e = seen.get(name) || { reps: new Set(), shapes: new Set() };
    const lib = D.CC_EXERCISE_LIBRARY.find((x) => x.name.toLowerCase() === name.toLowerCase());
    if (!lib) e.shapes.add('timed');
    else {
      if (['Timed', 'Time/Distance', 'Timed or Reps'].includes(lib.workType)) e.shapes.add('timed');
      if (lib.workType === 'Reps' || lib.workType === 'Timed or Reps') e.shapes.add(lib.isManualDone ? 'manual' : (lib.isCadenceSafe ? 'cadence' : 'manual'));
    }
    if (!e.shapes.size) e.shapes.add('timed');
    seen.set(name, e);
  }
  return { seen, STYLES, pool: [...pool] };
}

async function combatConditioning() {
  const { seen, STYLES } = await harvestCombatConditioning();
  const names = [...seen.keys()];
  const maxReps = Math.max(30, ...[...seen.values()].flatMap((e) => [...e.reps]));

  // Opener, CombatConditioningActive.jsx:160. The style is the mission's style.
  const opener = STYLES.map((style) => `Combat Conditioning started. ${style} conditioning. Round 1.`);

  // Drill start, :312 (timed), :319 (reps on the cadence), :327 (reps, tap done).
  // Each name with every shape and every rep count the generator dealt for it
  // (work seconds: the default 40 here, every whole second of 10-120 is swept below).
  const drillStart = [];
  for (const name of names) {
    const e = seen.get(name);
    if (e.shapes.has('timed')) drillStart.push(`${name}. 40 seconds. Ready. Begin.`);
    const reps = e.reps.size ? [...e.reps] : [10];
    for (const r of reps) {
      if (e.shapes.has('cadence')) drillStart.push(`${name}. ${r} reps. On my count. Begin.`);
      if (e.shapes.has('manual')) drillStart.push(`${name}. ${r} reps. Move with control. Tap done when complete.`);
    }
  }

  // The numbers of those lines, over every value the setup and the data give a
  // drill: work every whole second of 10-120 (the WORK field is typable, the
  // generator hands the number to every timed drill unchanged), reps 1 to the
  // largest dealt. One name of each prep kind is enough for the number part.
  // The player says the work time as `${d.workSeconds || 30} seconds`
  // (CombatConditioningActive.jsx:343): there is no minutes formatter on this
  // line (60 and 90 are said "60 seconds" and "90 seconds", and normalizeSpeech
  // only rewrites a clock time such as "1:30"), so nothing else is built.
  const probe = ['Burpees', 'Heavy Bag Power Punch Intervals', 'Kettlebell Swings'];
  const numbers = [];
  for (const name of probe) {
    for (const w of range(10, 120)) numbers.push(`${name}. ${w} seconds. Ready. Begin.`);
    for (let r = 1; r <= maxReps; r++) numbers.push(`${name}. ${r} reps. On my count. Begin.`, `${name}. ${r} reps. Move with control. Tap done when complete.`);
  }
  // (`${d.reps || '--'}` at :327 says "--" only for a reps drill with no reps; the
  // generator always gives a reps drill a count, so that line is never built.)

  // Rest between drills, CombatConditioningActive.jsx:412, `Rest. ${drill.restSeconds || 15} seconds.`
  // The seconds are the REST field, every whole second of 0-90 (0 is said as 15
  // because of `|| 15`, so 1-90 plus the 15 already built for every name). Said
  // as plain seconds like the work time, no minutes form. The name is every drill
  // of the pools as "next", with the prep sentence getEquipmentPrep gives it.
  const rest = [];
  for (const name of names) rest.push(`Rest. 15 seconds. Up next: ${name}. ${getEquipmentPrep({ name })}`);
  for (const name of probe) for (const sec of range(1, 90)) rest.push(`Rest. ${sec} seconds. Up next: ${name}. ${getEquipmentPrep({ name })}`);

  // End of a round, :365. Rounds 2-12 are offered, so rounds 1-11 end with a
  // next round. pausesThisRoundRef is reset to 0 on the line just before the
  // call, so the clean-round sentence is always present; the version without
  // it cannot be spoken and is not built.
  const rounds = range(1, 11).map((n) => `Round ${n} complete. Clean round. Plus five. Prepare for Round ${n + 1}.`);

  // Cadence count, :221 (speakAsync(String(i))): 1 to the largest rep count.
  const counts = range(1, maxReps).map(String);

  // Closing, :502.
  const closing = ['Conditioning complete. Good work.'];

  return [
    { feature: 'Combat Conditioning', name: 'player opener, round end and closing', lines: [...opener, ...rounds, ...closing] },
    { feature: 'Combat Conditioning', name: 'drill start for every drill the generator can deal', lines: drillStart },
    { feature: 'Combat Conditioning', name: 'drill start numbers (work every second 10-120, reps 1 to max)', lines: numbers },
    { feature: 'Combat Conditioning', name: 'rest call for every drill as next, with its prep sentence (rest every second 0-90)', lines: rest },
    { feature: 'Combat Conditioning', name: 'cadence rep count', lines: counts },
  ];
}

// ---------------------------------------------------------------------------
// (b) Combo Coach
// ---------------------------------------------------------------------------

async function comboCoach() {
  const { MULTI_ANNOUNCE, comboCoachMultiRound } = await import('../../components/training-mode/data/multiOpponent.js');
  const { RUSH_ACTIVATION, RUSH_COMPLETE, createRushVoice } = await import('../../components/training-mode/data/rushVoice.js');
  const { stakesFor } = await import('../../components/training-mode/data/xpStakes.js');

  // Disciplines of the shared tabs (components/training-mode/shared/DisciplineTabs.jsx).
  const DISCIPLINES = ['Boxing', 'Kickboxing', 'Muay Thai', 'MMA'];
  const DIFFS = ['Easy', 'Normal', 'Hard', 'Advanced'];
  // ComboCoachSetup.jsx:144, CADENCE stepper: min 2, max 8, step 0.5. The field is
  // also typable, and the label is `${cadenceSec.toFixed(1)}s` (:165), so any value
  // to one decimal can reach the intro: 2.0 to 8.0 in tenths.
  const cadences = range(2, 8, 0.1);
  // ComboCoachSetup.jsx:140, ROUNDS stepper: 1-12.
  const roundNos = range(1, 12);

  // ComboCoachActive.jsx:424-426 (runIntro). Re-typed: the intro is assembled in the
  // component. speedLabel is `${cadenceSec.toFixed(1)}s`, so it always starts with a
  // digit and the "second cadence" form is the one said.
  const speedSpokenFor = (speedLabel) => (/^\d/.test(String(speedLabel)) ? `${parseFloat(speedLabel)} second cadence` : `${speedLabel} speed`);
  const intro = [];
  for (const discipline of DISCIPLINES) for (const c of cadences) for (const n of roundNos) {
    intro.push(`Round ${n}. ${discipline}. ${speedSpokenFor(`${c.toFixed(1)}s`)}.`);
  }
  // The same line when the speed label is a word (never produced by the setup today:
  // speedFor gives slow/medium/turbo to the speed field, not to the label).
  // It is not built, as it cannot be said.

  // ComboCoachActive.jsx:426, the multiple-opponents round: `Round ${n}. ${MULTI_ANNOUNCE}`.
  // The round is whichever comboCoachMultiRound picks for a difficulty and round count.
  const multi = new Set();
  for (const d of DIFFS) for (const r of roundNos) {
    const idx = comboCoachMultiRound(d, r);
    if (idx >= 0) multi.add(`Round ${idx + 1}. ${MULTI_ANNOUNCE}`);
  }

  // ComboCoachActive.jsx:405-431: the count-in 3, 2, 1 and "Go!" (literals).
  // :586: the number countdown of the final 10 seconds of a rush round, String(remaining).
  // :313: "Clean round. Plus five." (literal). :635: the rest cues (literals).
  // :305: `Rush held. Plus ${xp} X P.` where xp is the win of the tier of the difficulty.
  // :543 and :556: RUSH_ACTIVATION and RUSH_COMPLETE. :570: the shuffled push cues.
  // :613: the closing line of getCoachCopy('fightComplete') in the four coach styles.
  const fixed = ['3', '2', '1', 'Go!', 'Clean round. Plus five.', 'Rest. Up next: multiple opponents.', 'Rest.', RUSH_ACTIVATION, RUSH_COMPLETE];
  for (const n of range(1, 10)) fixed.push(String(n));
  for (const d of DIFFS) fixed.push(`Rush held. Plus ${stakesFor(d).win} X P.`);
  const voice = createRushVoice();
  for (let i = 0; i < 40; i++) fixed.push(voice.nextLine());
  const copy = fs.readFileSync(new URL('data/coachCopy.js', TM), 'utf8');
  const block = copy.match(/fightComplete:\s*\{([^}]*)\}/)?.[1] || '';
  for (const m of block.matchAll(/:\s*(["'])((?:(?!\1).)*)\1/g)) fixed.push(m[2]);

  // Not built here: the combo calls (styled.speech, :731), the defense calls (:695),
  // the switch calls (:669) and the encouragement quotes (:510). They come from the
  // strike and combo pools, which other sweeps and the bank inventory cover.
  return [
    { feature: 'Fight Mode', name: 'Combo Coach round intro (discipline, round 1-12, cadence 2.0-8.0 in tenths)', lines: intro },
    { feature: 'Fight Mode', name: 'Combo Coach multiple-opponents round announce', lines: [...multi] },
    { feature: 'Fight Mode', name: 'Combo Coach count-in, rush, rest and closing calls', lines: fixed },
  ];
}

// ---------------------------------------------------------------------------
// (c) Workout Builder cardio finisher
// ---------------------------------------------------------------------------

// CARDIO_FINISHER_MOVES (fitModeGenerator.js:383) is a const that is not exported,
// so its names are read from the source text of that array. The array feeds
// buildCardioBlock (:394) and the Cardio Only focus (:436). The block is timed:
// its reps field is `${work}s` with work 30 (Easy), 45 (Hard, Advanced) or 40, which
// the guided player classifies as a hold (FitBuilderGuidedPlayer.jsx:90-92) and says
// at :538 as `${ex.name}. ${unit}. ${plan.seconds} seconds. Get into position.`
function cardioFinisher() {
  const src = fs.readFileSync(new URL('fit-mode/fitModeGenerator.js', TM), 'utf8');
  const start = src.indexOf('const CARDIO_FINISHER_MOVES');
  const block = src.slice(start, src.indexOf('];', start));
  const names = [...new Set([...block.matchAll(/name: '([^']+)'/g)].map((m) => m[1]))];
  const lines = [];
  for (const n of names) {
    lines.push(...libraryNameLines(n));
    // The hold line for the other two durations the finisher can have
    // (libraryNameLines carries 30 seconds only).
    for (const sec of [40, 45]) lines.push(`${n}. Set 1 of 3. ${sec} seconds. Get into position.`);
  }
  return [{ feature: 'Workout Builder', name: 'cardio finisher moves in the guided-player line shapes', lines }];
}

export default async () => {
  const all = [...(await combatConditioning()), ...(await comboCoach()), ...cardioFinisher()];
  return all.map((s) => ({ ...s, lines: [...new Set(s.lines.filter((l) => typeof l === 'string' && l.trim()))] }));
};

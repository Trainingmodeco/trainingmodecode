// Quick Mission · AT YOUR PACE for today's (generated) mission.
//
// The run screen that already exists for the Mission Library (QuickMissionSolo:
// the moves, one clock, a ROUND button, no coach voice) is only fed v2 library
// missions. This file turns a GENERATED mission (fit-mode/quickMissionGenerator)
// into a mission that screen runs, so "just show me the list and a timer" works
// for the first page's mission too. Pure: no React, no storage.
//
// What it builds is a count-up FOR TIME run over the mission's own rounds:
//   · every move listed once (reps or seconds), and "3 rounds of the list";
//   · no rests of its own: the athlete rests as long as they need and the
//     clock keeps counting (the rests only shape the pace targets);
//   · ROUND once per round when it has two or more (FINISH is the last one),
//     FINISH alone when it has one;
//   · a cardio finisher (the generator's two timed moves) is part of every
//     round's list, exactly as it is in the guided run.
//
// Pace targets come from what the coach-guided run would take
// (estimateQuickMissionSeconds): STANDARD about that, ELITE faster, BEGINNER
// slower, all on 15-second marks.
//
// XP is the guided XP, not a new rule. The mission carries no `v2` flag, so
// missionSolo's minute rules never apply to it: a full finish pays 15 a slot
// plus the 30 finish bonus (userStats quickMissionXp), the same as guided.
// The honesty floors are the existing ones (settleSoloXp: half the ELITE
// time), and a stopped run pays by the share of the STANDARD time it ran.
import { estimateQuickMissionSeconds, estimateQuickMissionWorkSeconds, generateQuickMission } from '../fit-mode/quickMissionGenerator';

// The setup screen's words for the levels (data/quickMissionConfig
// QM_LEVEL_WORD): MEDIUM for the stored 'Normal'.
const LEVEL_WORD = { Easy: 'EASY', Normal: 'MEDIUM', Hard: 'HARD', Advanced: 'HARD' };
const STEP = 15;
const mark = (sec) => Math.max(STEP, Math.round(sec / STEP) * STEP);

// A generated mission is one the generator dealt: not a library mission
// (v2), a classic or a plan day (named), and not already adapted.
export function isGeneratedMission(m) {
  return !!m && Array.isArray(m.exercises) && m.exercises.length > 0 && !m.v2 && !m.named && !m.planId && !m.atYourPace;
}

// Whether a mission can run at your pace: today's generated mission, or a
// library mission that also has a guided version (one only offered at your pace
// is always run that way and has nothing to switch from).
export function missionRunsAtYourPace(m) {
  return isGeneratedMission(m) || (m?.v2 === true && m?.guided === true);
}

// ELITE, STANDARD and BEGINNER finish times, in seconds, strictly in that order.
// STANDARD is the guided estimate. ELITE is 70% of it, but never under 1.2 x the
// moves' own seconds (the engine's floor is half of ELITE, so a finish at the
// floor still took 60% of the moves' time). BEGINNER is 1.4 x.
export function paceTiersFor(gen) {
  const est = estimateQuickMissionSeconds(gen);
  const work = estimateQuickMissionWorkSeconds(gen);
  const standard = mark(est);
  const elite = Math.max(STEP, Math.min(standard - STEP, mark(Math.max(0.7 * est, 1.2 * work))));
  const beginner = Math.max(standard + STEP, mark(1.4 * est));
  return { elite, standard, beginner };
}

// One generated move as a slot QuickMissionSolo lists. The doses read "12 reps"
// and "40s" (slotDose), like the setup card. No rest (see above). swapKey is
// what the row list keys on; no moveId, so the swap button never shows.
function slotOf(ex, i) {
  const base = { name: ex.name, swapKey: `m${i + 1}`, mode: ex.mode === 'timed' ? 'timed' : 'reps', rest: 0 };
  const dose = ex.mode === 'timed' ? { work: ex.work } : { reps: ex.reps, unit: 'reps' };
  return {
    ...base, ...dose,
    ...(ex.isWeighted ? { isWeighted: true } : {}),
    ...(ex.isFinisher ? { isFinisher: true, prefix: 'FINISHER' } : {}),
  };
}

// The adapted mission, or null when there is nothing to run.
export function soloFromGenerated(gen) {
  if (!gen || !Array.isArray(gen.exercises)) return null;
  const moves = [...gen.exercises, ...(gen.finisherExercises || [])].filter(ex => ex && ex.name);
  if (!moves.length) return null;
  const rounds = Math.max(1, Math.floor(Number(gen.rounds) || 1));
  const loaded = moves.some(ex => ex.isWeighted);
  const pace = paceTiersFor({ exercises: gen.exercises, finisherExercises: gen.finisherExercises || [], rounds });
  return {
    title: gen.title,
    workoutType: gen.workoutType,
    duration: gen.duration,
    difficulty: gen.difficulty,
    focus: gen.focus,
    format: 'forTime',
    formatLabel: 'CIRCUIT',
    exercises: moves.map(slotOf),
    finisherExercises: [],
    rounds,
    cardioFinisher: false,
    // Marks it as the generated mission run at your pace (isGeneratedMission,
    // the session row's missionId) and says how it plays.
    id: 'generated',
    atYourPace: true,
    guided: true,
    levelLabel: LEVEL_WORD[gen.difficulty] || String(gen.difficulty || '').toUpperCase(),
    capSec: Math.ceil((2 * pace.standard) / 60) * 60,
    clockSec: 0,
    pace,
    paceBasis: 'Set from your moves and a normal rest between them.',
    scoreRule: { kind: 'time' },
    scoreLine: 'TIME',
    missionLine: rounds === 1 ? '1 ROUND · THE WHOLE LIST' : `${rounds} ROUNDS · THE WHOLE LIST EACH TIME`,
    ...(loaded ? { note: 'Pick a safe weight for every loaded set. Rest as long as you need; the clock keeps counting.' } : {}),
    scaled: false,
    swaps: [],
    // One round: FINISH is the only tap. Two or more: ROUND ends each round.
    ...(rounds === 1 ? { noRoundTimer: true } : {}),
  };
}

// How a Quick Mission starts when nothing asked for a run: the one place
// every start without a choice screen goes through (App goQuickMissionActive:
// the Fit hub's and Home's START, a replay). cfg is the Quick Mission config.
//   · an explicit cfg.mode ('guided' or 'solo') is honoured;
//   · a library mission (v2), a classic and a plan day never change;
//   · otherwise today's generated mission follows `savedMode`, the choice the
//     athlete saved on the first page: 'solo' (shown as AT YOUR PACE) runs it
//     here, anything else leaves the config exactly as it was.
// A config with no mission yet (the hub's) deals one here, because the
// adapted mission has to exist before the run screen opens. The returned
// config carries the adapted mission, so a replay and a resume bring back the
// very same moves.
export function resolveQuickMissionRun(cfg, savedMode) {
  if (!cfg || typeof cfg !== 'object' || cfg.v2) return cfg;
  if (cfg.mode === 'guided') return cfg;
  if (cfg.mode == null && savedMode !== 'solo') return cfg;
  if (cfg.mission && !isGeneratedMission(cfg.mission)) return cfg;
  const mission = soloFromGenerated(cfg.mission ?? generateQuickMission(cfg));
  return mission ? { ...cfg, mission, mode: 'solo' } : cfg;
}

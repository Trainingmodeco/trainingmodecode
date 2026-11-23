// Fit · THE WORKOUT CARD, wired (switch `fitCard`, data/retentionFlags).
// Pure: no React, no storage. What the Quick Mission card shows is what START
// runs, so every number on the card comes from here.
//
// The owner's choices (docs/fit-challenge/BUILD-NOTES.md):
//   · TIME stays the input. The generator deals the moves, the reps and the
//     rounds for the minutes (fit-mode/quickMissionGenerator, as today); a
//     Full Body card is dealt by pattern (the balanced deal: 3 push, 2 pull,
//     legs, core, arms). The card shows the rounds and the totals
//     ("99 × 4 = 396 · About 27 min"), and + adds a round (the same list
//     again: every round of a generated mission runs the same moves), − takes
//     one off. The minutes follow the rounds by the run's own timing model
//     (estimateQuickMissionSeconds), and the XP follows the minutes
//     (data/quickMissionXp: minutes × the level's rate), so 5 rounds pays
//     more than 2 and a harder level never pays less.
//   · The card opens on a fresh balanced deal each day (one seed a day,
//     SHUFFLE deals the next), and FULL BODY WARRIOR is one tap away in CHOOSE.
//   · PULL-UP BAR off: a bar move becomes its stand-in (same reps and rest, so
//     the clock and the XP do not move) and says what it stands in for.
//   · A swap replaces one move by another of the same pattern and the same
//     kind (reps for reps, a hold for a hold): its dose and rest stay, so a
//     swap never changes the clock or the XP.
import {
  generateQuickMission, estimateQuickMissionSeconds, seededRng, quickMissionSeed, seedFrom,
  BALANCED_BODYWEIGHT, BALANCED_WEIGHTED, DIFFICULTY_CONFIG,
} from '../fit-mode/quickMissionGenerator';
import { generatedMissionXp } from './quickMissionXp';
import { challengeTotals, balanceLine, isBalanced, PATTERNS } from './challengeTotals';
import { FIT_MODE_EXERCISES } from '../fit-mode/fitModeExerciseData';
import { createCardioAddon } from './cardioAddon';

export const CARD_MIN_ROUNDS = 1;
export const CARD_MAX_ROUNDS = 10;
const clampR = (n) => Math.min(CARD_MAX_ROUNDS, Math.max(CARD_MIN_ROUNDS, Math.round(Number(n) || 1)));

// ── the moves ────────────────────────────────────────────────────────────────
const INFO = new Map([...BALANCED_BODYWEIGHT, ...BALANCED_WEIGHTED].map((m) => [m.name, m]));
// What the card knows about a move: its pattern, tier, gear ({ bar, table }),
// stand-ins. null for a move outside the balanced pools (a focus deal's).
export const cardMoveInfo = (name) => INFO.get(name) || null;
// The small line under a move that needs gear the athlete may not have.
export const TABLE_NOTE = 'table or low bar';
export const gearNoteOf = (name) => (cardMoveInfo(name)?.table ? TABLE_NOTE : null);

// FULL BODY WARRIOR: the spec's circuit in the app's names (the name guard
// bans franchise names). Reverse Curls waits for the next recording batch
// (exercise-loops/PENDING.md); Resistance Towel Curls, already recorded in
// both voices, holds its place. 99 reps a round.
export const WARRIOR_ID = 'full-body-warrior';
export const WARRIOR_TITLE = 'FULL BODY WARRIOR';
export const WARRIOR_MOVES = [
  { name: 'Dive Bomber Push-Ups', reps: 12 },
  { name: 'Push-Ups', reps: 16 },
  { name: 'Pull-Ups', reps: 8 },
  { name: 'Inverted Rows', reps: 16 },
  { name: 'Pike Push-Ups', reps: 8 },
  { name: 'Air Squats', reps: 15 },
  { name: 'Hanging Knee Raises', reps: 12 },
  { name: 'Resistance Towel Curls', reps: 12 },
];

// A seed a day: the card opens on the same deal all day, and a new one the next.
export const dayKey = (d = new Date()) => {
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
export const daySeed = (d = new Date()) => seedFrom(`fitcard:${dayKey(d)}`);

// The minutes a mission runs, by the guided run's own model.
export const missionMinutes = (m) => Math.max(1, Math.round(estimateQuickMissionSeconds(m) / 60));

// FULL BODY WARRIOR as a mission: its fixed doses, the level's rest, and the
// rounds that come closest to the minutes asked (the time stays the input).
export function warriorMission(cfg = {}) {
  const level = DIFFICULTY_CONFIG[cfg.difficulty] ? cfg.difficulty : 'Normal';
  const rest = DIFFICULTY_CONFIG[level].rest;
  const base = {
    title: WARRIOR_TITLE, workoutType: 'Bodyweight', difficulty: level, format: 'Auto', focus: 'Full Body',
    exercises: WARRIOR_MOVES.map((m) => ({ name: m.name, mode: 'reps', reps: m.reps, rest, counted: true })),
    finisherExercises: [], cardioFinisher: false, rounds: 1, duration: 0,
  };
  const target = Math.max(5, Number(cfg.duration) || 20) * 60;
  let best = 1, miss = Infinity;
  for (let r = CARD_MIN_ROUNDS; r <= CARD_MAX_ROUNDS; r += 1) {
    const d = Math.abs(estimateQuickMissionSeconds({ ...base, rounds: r }) - target);
    if (d < miss) { miss = d; best = r; }
  }
  const m = { ...base, rounds: best };
  return { ...m, duration: missionMinutes(m) };
}

// A saved or repeated workout (a snapshot, see snapshotOf) as a mission.
export function snapshotMission(s) {
  const exercises = (s?.exercises || []).filter((e) => e && e.name).map((e) => ({
    name: e.name, mode: e.mode === 'timed' ? 'timed' : 'reps',
    ...(e.mode === 'timed' ? { work: Math.max(5, Math.round(e.work) || 30) } : { reps: Math.max(1, Math.round(e.reps) || 10) }),
    rest: Math.max(0, Math.round(e.rest) || 0), ...(e.isWeighted ? { isWeighted: true } : {}),
    ...(e.counted && e.mode !== 'timed' && !e.isWeighted ? { counted: true } : {}),
  }));
  const m = {
    title: String(s?.title || 'MY WORKOUT').toUpperCase(), workoutType: s?.workoutType || 'Bodyweight',
    difficulty: DIFFICULTY_CONFIG[s?.difficulty] ? s.difficulty : 'Normal', format: 'Auto', focus: s?.focus || 'Full Body',
    exercises, finisherExercises: [], cardioFinisher: false, rounds: clampR(s?.rounds || 1), duration: 0,
  };
  return { ...m, duration: missionMinutes(m) };
}

// What a card run keeps (YOUR WORKOUTS' repeat, SAVE WORKOUT): the moves as
// they ran, with their doses and rests, and the rounds. No noBarFor: a saved
// workout runs exactly what was on the card.
export function snapshotOf(mission, extra = {}) {
  return {
    title: mission.title, workoutType: mission.workoutType, difficulty: mission.difficulty, focus: mission.focus,
    rounds: mission.rounds,
    exercises: (mission.exercises || []).map((e) => ({
      name: e.name, mode: e.mode, ...(e.mode === 'timed' ? { work: e.work } : { reps: e.reps }), rest: e.rest,
      ...(e.isWeighted ? { isWeighted: true } : {}), ...(e.counted ? { counted: true } : {}),
    })),
    ...extra,
  };
}

// The stand-in for a bar move: its first stand-in that is not already on the
// card (so a card never lists one move twice).
function standInFor(name, taken) {
  const info = cardMoveInfo(name);
  if (!info?.bar) return null;
  return (info.noBar || []).find((n) => !taken.has(n)) || null;
}

// Without a pull-up bar: every bar move becomes its stand-in, with the same
// dose and rest, marked with what it stands in for.
export function applyBar(exercises, bar) {
  if (bar) return exercises;
  const taken = new Set(exercises.map((e) => e.name));
  return exercises.map((e) => {
    const n = standInFor(e.name, taken);
    if (!n) return e;
    taken.add(n);
    return { ...e, name: n, noBarFor: e.name };
  });
}

// swaps: { [index]: name }. A swap keeps the dose and the rest.
export function applySwaps(exercises, swaps = {}) {
  return exercises.map((e, i) => (swaps[i] && swaps[i] !== e.name ? { ...e, name: swaps[i], swappedFrom: e.name } : e));
}

// ── the card ────────────────────────────────────────────────────────────────
// source: { kind: 'deal', seed, shuffles } | { kind: 'warrior' } | { kind: 'saved', snapshot, id? }
// rounds: the rounds the athlete set with + / − (null: what the time made).
// bar: the PULL-UP BAR switch. swaps: { [index]: name } on the dealt moves.
export function cardMission(cfg, { source = { kind: 'deal', seed: 1, shuffles: 0 }, rounds = null, bar = true, swaps = {} } = {}) {
  let base;
  if (source.kind === 'warrior') base = warriorMission(cfg);
  else if (source.kind === 'saved') base = snapshotMission(source.snapshot);
  else base = generateQuickMission({ ...cfg, rng: seededRng(quickMissionSeed(source.seed, source.shuffles || 0, cfg.duration)), balanced: true });
  const baseRounds = base.rounds;
  const exercises = applyBar(applySwaps(base.exercises, swaps), bar);
  const r = rounds == null ? baseRounds : clampR(rounds);
  const m = { ...base, exercises, rounds: r };
  // The minutes follow the rounds (and so does the XP). With the rounds the
  // time made, the minutes stay the ones asked for, as today.
  return {
    ...m,
    duration: r === baseRounds && source.kind === 'deal' ? base.duration : missionMinutes(m),
    card: { kind: source.kind, baseRounds, bar: !!bar },
  };
}

// The rounds after a + or a −.
export const stepRounds = (rounds, delta) => clampR((Number(rounds) || 1) + delta);

// A move as challengeTotals counts it: reps, or a hold's seconds.
export const amountOf = (ex) => (ex.mode === 'timed' ? { name: ex.name, seconds: ex.work } : { name: ex.name, reps: ex.reps });

// The card's sum: reps a round × rounds = total, the holds in seconds, and
// how long it really takes (the run's own model, not challengeTotals' rough one).
export function cardTotals(mission) {
  const t = challengeTotals((mission.exercises || []).map(amountOf), mission.rounds);
  const est = estimateQuickMissionSeconds(mission);
  return { ...t, estSeconds: Math.round(est), estMinutes: Math.max(1, Math.round(est / 60)) };
}

// XP the card's run pays when finished (the minutes at the level's rate, the
// finish bonus on top: userStats quickMissionXp).
export const cardWorkXp = (mission) => generatedMissionXp(mission) ?? 0;

// The BALANCED line, when the card is a balanced deal (every move has a pattern).
export function cardBalance(mission) {
  const moves = (mission.exercises || []).map((e) => ({ pattern: cardMoveInfo(e.name)?.pattern }));
  if (!moves.length || moves.some((m) => !m.pattern)) return null;
  return { line: balanceLine(moves), full: isBalanced(moves) };
}

// ── swaps ───────────────────────────────────────────────────────────────────
const KIND = { 1: ['easier', 'EASIER'], 2: ['similar', 'SIMILAR'], 3: ['harder', 'HARDER'] };
// The swap sheet's options for move `index`: one EASIER, SIMILAR and HARDER
// move of its pattern and kind (lower, same and higher tier), and a NO GEAR one
// when it needs a bar or a table. Never a move already on the card; never a
// bar move with the bar switched off. Loaded moves swap for loaded moves.
export function cardSwapOptions(mission, index, { bar = true } = {}) {
  const ex = mission.exercises?.[index];
  const info = ex ? cardMoveInfo(ex.name) : null;
  if (!info) return [];
  const timed = ex.mode === 'timed';
  const taken = new Set(mission.exercises.map((e) => e.name));
  const pool = (info.loaded ? BALANCED_WEIGHTED : BALANCED_BODYWEIGHT)
    .filter((m) => m.pattern === info.pattern && !!m.timed === timed && !taken.has(m.name) && (bar || !m.bar));
  const dose = timed ? `${ex.work}s` : String(ex.reps);
  const out = [];
  const add = (m, kind, label) => {
    if (!m || out.some((o) => o.name === m.name)) return;
    out.push({
      id: m.name, kind, label, name: m.name, doseFrom: dose, doseTo: dose,
      // The same gear as the move it replaces shows no tag (the NOW box says it).
      gear: (m.bar && !info.bar) || (m.table && !info.table) ? 'gear' : 'none', gearLabel: m.bar ? 'PULL-UP BAR' : m.table ? 'TABLE' : '',
      cues: cuesOf(m.name),
    });
  };
  const nearest = (list, dir) => [...list].sort((a, b) => dir * (a.tier - b.tier))[0];
  add(nearest(pool.filter((m) => m.tier < info.tier), -1), ...KIND[1]);
  add(pool.find((m) => m.tier === info.tier), ...KIND[2]);
  add(nearest(pool.filter((m) => m.tier > info.tier), 1), ...KIND[3]);
  if (info.bar || info.table) add(pool.find((m) => !m.bar && !m.table), 'no-gear', 'NO GEAR');
  return out;
}

// A move's cues, from the Workout Builder library's coach note (a sentence a
// line). A move the library does not have has none: the sheet then shows
// only USE THIS MOVE under its name.
const LIB = new Map(FIT_MODE_EXERCISES.filter((e) => e.active !== false).map((e) => [e.name, e]));
export function cuesOf(name) {
  const note = LIB.get(name)?.coachNote;
  return note ? String(note).split(/(?<=\.)\s+/).filter(Boolean).slice(0, 3) : [];
}

// ── words ───────────────────────────────────────────────────────────────────
export const doseOf = (ex) => (ex.mode === 'timed' ? `${ex.work}s` : `${ex.reps} reps`);
export const roundsWord = (n) => `${n} ${n === 1 ? 'round' : 'rounds'}`;

// ── YOUR WORKOUTS ───────────────────────────────────────────────────────────
// Every mode's sessions, newest first, one row each. A row from a card run
// carries its title, rounds and reps (scalars on the session row: the synced
// snapshot is rewritten whole on every save, so no arrays); an older row reads
// as its mode. XP-only rows (the daily bonus, the hybrid bonus) are not workouts.
const NOT_WORKOUTS = new Set(['Mission of the Day', 'Hybrid Training Bonus']);
const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const MODE_NAME = {
  'Quick Mission': 'QUICK MISSION', 'Fit Mode': 'WORKOUT BUILDER', 'Fight Focus': 'FIGHT FOCUS', 'Combo Coach': 'COMBO COACH',
  'Training Camp': 'TRAINING CAMP', 'Combat Conditioning': 'COMBAT CONDITIONING', Cardio: 'CARDIO', Practice: 'PRACTICE',
  'Start Here': 'START HERE', "Coach's Tapes": "COACH'S TAPES",
};
const UNIT = { 'Fit Mode': 'exercises', 'Combat Conditioning': 'drills', 'Quick Mission': 'sets' };
const plural = (n, w) => `${n} ${n === 1 ? w.replace(/s$/, '') : w}`;

export function workoutRow(s) {
  const d = new Date(s.completedAt);
  const done = Math.max(0, Number(s.completedCount) || 0);
  const of = Math.max(0, Number(s.totalCount) || 0);
  const pct = of > 0 ? Math.min(100, Math.round((done / of) * 100)) : 0;
  let name = MODE_NAME[s.type] || String(s.type || 'WORKOUT').toUpperCase();
  let line;
  if (s.type === 'Quick Mission' && s.title) {
    name = String(s.title).toUpperCase();
    const r = Number(s.rounds) || 0, rOf = Number(s.roundsOf) || r;
    line = `${r === rOf ? roundsWord(r) : `${r} of ${rOf} rounds`} · ${Number(s.totalReps) || 0} reps`;
  } else if (s.type === 'Cardio') {
    name = String(s.method || 'Cardio').toUpperCase();
    const mins = Math.round((Number(s.completedTimeSeconds) || 0) / 60);
    line = `Cardio · ${mins} min`;
  } else if (s.type === 'Training Camp') {
    line = `Level ${s.campLevel ?? '?'} · ${done} of ${of} rounds`;
  } else if (s.type === 'Practice' || s.type === 'Start Here') {
    line = s.lessonTitle ? String(s.lessonTitle) : `${done} of ${of}`;
  } else {
    line = `${done} of ${plural(of, UNIT[s.type] || 'rounds')}`;
  }
  const elapsed = Number(s.elapsedSec) || (s.type === 'Cardio' ? Number(s.completedTimeSeconds) || 0 : 0);
  return {
    id: s.id || s.completedAt, at: d.getTime(), dow: DOW[d.getDay()], day: d.getDate(), mon: MON[d.getMonth()],
    name, line, elapsedSec: elapsed || null, xp: Math.max(0, Number(s.xpEarned) || 0), pct,
    cardId: s.cardId || null,
  };
}

export function workoutRows(sessions) {
  return (Array.isArray(sessions) ? sessions : [])
    .filter((s) => s && s.completedAt && !NOT_WORKOUTS.has(s.type))
    .map(workoutRow)
    .sort((a, b) => b.at - a.at);
}

// The last seven days (today and the six before): workouts, XP and the time known.
export function lastWeek(rows, now = Date.now()) {
  const from = new Date(now); from.setHours(0, 0, 0, 0); from.setDate(from.getDate() - 6);
  const week = rows.filter((r) => r.at >= from.getTime() && r.at <= now);
  return {
    count: week.length,
    xp: week.reduce((a, r) => a + r.xp, 0),
    seconds: week.reduce((a, r) => a + (r.elapsedSec || 0), 0),
  };
}

// The fields a card run adds to its session row (all scalars).
export function cardRowFields(card, { roundsDone, repsDone, holdSec, cardId } = {}) {
  if (!card) return {};
  return {
    title: String(card.title || '').slice(0, 40),
    rounds: Math.max(0, Math.round(Number(roundsDone) || 0)),
    roundsOf: Math.max(0, Math.round(Number(card.rounds) || 0)),
    totalReps: Math.max(0, Math.round(Number(repsDone) || 0)),
    ...(holdSec > 0 ? { holdSec: Math.round(holdSec) } : {}),
    ...(cardId ? { cardId } : {}),
  };
}

// How much of a card run was done, from what the runner reports: the
// CHECK-OFF ticks when there are any, else the sets done in order (a guided
// run, or AT YOUR PACE's ROUND taps and its share of the time).
export function cardRunDone(card, { ticks, exercisesCompleted } = {}) {
  const moves = (card?.exercises || []).map(amountOf);
  const per = moves.length || 1;
  if (Array.isArray(ticks) && ticks.length) {
    let reps = 0, secs = 0, cells = 0, ticked = 0;
    ticks.forEach((row) => row.forEach((on, i) => { cells++; if (on && moves[i]) { ticked++; reps += moves[i].reps || 0; secs += moves[i].seconds || 0; } }));
    const roundsDone = ticks.filter((r) => r.length && r.every(Boolean)).length;
    return { roundsDone, repsDone: reps, holdSec: secs, ticked, cells, pct: cells ? Math.round((ticked / cells) * 100) : 0 };
  }
  const n = Math.max(0, Math.round(Number(exercisesCompleted) || 0));
  let reps = 0, secs = 0;
  for (let k = 0; k < n; k++) { const m = moves[k % per]; reps += m?.reps || 0; secs += m?.seconds || 0; }
  const cells = per * (Number(card?.rounds) || 1);
  return { roundsDone: Math.floor(n / per), repsDone: reps, holdSec: secs, ticked: n, cells, pct: cells ? Math.min(100, Math.round((n / cells) * 100)) : 0 };
}

// ── BONUS TRAINING ──────────────────────────────────────────────────────────
// Optional work under the card: never in the totals, the XP or the results.
// Cardio is the top one (the owner's note): ticking it sends the workout
// straight into a cardio cool-down when it ends, the cardio finisher Quick
// Mission already runs after a mission (App goQuickMissionComplete →
// CardioFinisherPlayer, a steady timer with its own existing lines), here as
// an easy 10-minute walk. As bonus work it pays no XP (no cardio XP, no
// hybrid bonus). The rest are ticks for the athlete's own record, kept for the
// visit only; Shadowboxing links to Fight Mode.
export const COOL_DOWN_MIN = 10;
export function coolDownAddon() {
  return {
    ...createCardioAddon({ sourceMode: 'Quick Mission', cardioType: 'walk', targetType: 'time', targetTimeSeconds: COOL_DOWN_MIN * 60, style: 'steady', bonusEligible: false }),
    coolDown: true, bonus: true, goal: 'time', intensity: 'easy', durationMin: COOL_DOWN_MIN, generated: false,
  };
}
export const isCoolDown = (addon) => !!addon && addon.enabled === true && addon.coolDown === true;
export const BONUS_ITEMS = [
  { id: 'cardio', name: 'Cardio cool-down', dose: `${COOL_DOWN_MIN} min easy walk, straight after`, cardio: true },
  { id: 'lsit', name: 'L-Sit Hold', dose: '3 × 20s' },
  { id: 'handstand', name: 'Handstand Hold', dose: '3 × 30s, against a wall' },
  { id: 'mobility', name: 'Mobility', dose: '10 min' },
  { id: 'carry', name: 'Farmer Carries', dose: '3 × 40s', gear: 'WEIGHTS' },
  { id: 'shadow', name: 'Shadowboxing', dose: '3 × 2 min', link: 'fight' },
];

export { PATTERNS };

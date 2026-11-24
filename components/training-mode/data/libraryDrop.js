// The full workout behind a library row's + (MissionLibrarySheet, and CHOOSE on
// the Fit card's Quick Mission): every move with its reps or time, the rounds,
// the format and the gear, the way the card's SEE ALL lists a workout. Pure:
// no React, no storage beyond gearProfile().
//
//   { summary, facts: [[label, value], ...], moves: [{ prefix, name, dose, note }] }
import { buildLoadoutMission, missionCardModel, classicMeta, classicFormat, formatLabelOf, gearProfile } from './loadoutMissions';
import { namedWorkoutById } from './namedWorkouts';
import { summaryLines } from './workoutLibrary';

const isNote = (a) => /^[+×]\s/.test(a);
const roundsWord = (n) => `${n} ${n === 1 ? 'ROUND' : 'ROUNDS'}`;
const clean = (facts) => facts.filter((f) => f && f[1]);

// A launch mission's rounds, in words (an AMRAP of one block, or a run until the
// bell is down, has no round count to give).
function roundsOf(m) {
  if (m.format === 'maxSets' || m.format === 'maxRounds') return 'AS MANY AS YOU CAN';
  if (m.format === 'amrap' && (m.rounds || 1) === 1) return 'AS MANY AS YOU CAN';
  return roundsWord(m.rounds || 1);
}

// A launch mission (kind 'v2') at its default level, or at `level` (a MAX OUT
// workout opened on the level Build Workout handed over).
export function missionDrop(id, { gear = gearProfile(), level } = {}) {
  const m = buildLoadoutMission(id, { gear, level });
  if (!m) return null;
  const card = missionCardModel(m, { gear });
  return {
    summary: card.missionLine || '',
    facts: clean([['FORMAT', formatLabelOf(m)], ['ROUNDS', roundsOf(m)], ['GEAR', card.loadoutLine], ['LOAD', m.load]]),
    moves: card.rows.map((r) => ({ prefix: r.prefix || null, name: r.name, dose: r.dose, note: r.note || null })),
  };
}

// A classic (kind 'classic'): the whiteboard lines, or every move of the build
// when the whiteboard is cut short ("+ 3 more").
export function classicDrop(id) {
  const w = namedWorkoutById(id);
  if (!w) return null;
  const meta = classicMeta(w);
  const cut = w.lines.some(([a]) => /^\+\s/.test(a));
  const lines = cut ? summaryLines(w.build(), 99) : w.lines.filter(([a]) => !isNote(a));
  const fromNote = Number((w.lines.map(([a]) => a).find((a) => /^×\s/.test(a)) || '').match(/\d+/)?.[0]);
  const rounds = w.rounds > 1 ? w.rounds : fromNote > 1 ? fromNote : 0;
  return {
    summary: w.note || '',
    facts: clean([['FORMAT', classicFormat(id)], ['ROUNDS', rounds ? roundsWord(rounds) : ''], ['GEAR', [meta.loadoutLabel, w.needs].filter(Boolean).join(' · ').toUpperCase()]]),
    moves: lines.map(([name, dose]) => ({ prefix: null, name, dose: dose || null, note: null })),
  };
}

// A library entry of the shelf ({ kind: 'v2' | 'classic', id }).
export function libraryDrop(entry, opts) {
  if (!entry) return null;
  return entry.kind === 'v2' ? missionDrop(entry.id, opts) : classicDrop(entry.id);
}

// A card's own list (today's deal, FULL BODY WARRIOR, a saved workout): the
// exercises as the card dealt them, in rounds.
export function exercisesDrop(exercises, { rounds, gear = '', summary = '' } = {}) {
  return {
    summary,
    facts: clean([['FORMAT', 'ROUNDS'], ['ROUNDS', rounds ? roundsWord(rounds) : ''], ['GEAR', String(gear || '').toUpperCase()]]),
    moves: (exercises || []).map((e) => ({ prefix: null, name: e.name, dose: e.mode === 'timed' ? `${e.work}s` : `${e.reps} reps`, note: null })),
  };
}

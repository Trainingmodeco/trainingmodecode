// Guided interval programmes for the machines.
//
// A programme is a list of segments — warm, easy, hard, sprint, recover, cool
// — each with a length. The athlete's effort tier (EASY / NORMAL / HARD, see
// runEffort.js) decides how fast each kind is, so one programme serves a
// beginner and a fighter without two copies of it.
//
// On a TREADMILL the announcer speaks the belt speed to set, five seconds
// ahead of every change, and the athlete moves the belt themselves. On a BIKE
// or a ROWER consoles do not share a pace unit, so the same programmes speak
// effort words instead — all out, easy spin, light strokes.
//
// The library: the fighter standards first (round-shaped work), then the
// classic protocols, then the owner's screenshot programmes.

import { kindSpeed } from './runEffort';
import { clampSpeed, fmtSpeed, speedUnitLabel } from './machineSpeed';
import { speakDuration } from './runCoach';

const seg = (kind, seconds, extra = {}) => ({ kind, seconds, ...extra });
const rep = (n, list) => Array.from({ length: n }, () => list).flat();

export const PROGRAMS = [
  {
    id: 'fight-3x1',
    label: 'FIGHT ROUNDS 3×1',
    blurb: 'Three minutes on, one off, five rounds. A boxing card, on a belt.',
    tag: 'fighter',
    segments: [seg('warm', 300), ...rep(5, [seg('hard', 180), seg('recover', 60)]), seg('cool', 180)],
  },
  {
    id: 'fight-5x1',
    label: 'FIGHT ROUNDS 5×1',
    blurb: 'Five minutes on, one off, three rounds. MMA round structure.',
    tag: 'fighter',
    segments: [seg('warm', 300), ...rep(3, [seg('hard', 300), seg('recover', 60)]), seg('cool', 180)],
  },
  {
    id: 'tabata',
    label: 'TABATA SPRINTS',
    blurb: 'Twenty on, ten off, eight times. Four minutes that feel like forty.',
    tag: 'classic',
    segments: [seg('warm', 300), ...rep(8, [seg('sprint', 20), seg('recover', 10)]), seg('cool', 180)],
  },
  {
    id: 'thirty-thirty',
    label: '30 / 30 ASSAULT',
    blurb: 'Thirty seconds flat out, thirty easy, twelve times. Fighter conditioning.',
    tag: 'fighter',
    segments: [seg('warm', 300), ...rep(12, [seg('sprint', 30), seg('recover', 30)]), seg('cool', 180)],
  },
  {
    id: 'ladder',
    label: 'LADDER',
    blurb: 'One, two, three minutes hard and back down, equal recovery each rung.',
    tag: 'classic',
    segments: [
      seg('warm', 300),
      seg('hard', 60), seg('recover', 60),
      seg('hard', 120), seg('recover', 120),
      seg('hard', 180), seg('recover', 180),
      seg('hard', 120), seg('recover', 120),
      seg('hard', 60), seg('recover', 60),
      seg('cool', 300),
    ],
  },
  {
    id: 'norwegian-4x4',
    label: 'NORWEGIAN 4×4',
    blurb: 'Four minutes hard, three easy, four times. The VO2 max standard.',
    tag: 'classic',
    segments: [seg('warm', 300), ...rep(4, [seg('hard', 240), seg('recover', 180)]), seg('cool', 300)],
  },
  {
    id: 'hiit-25',
    label: 'HIIT 25',
    blurb: 'Warm, jog, then four all-out minutes with two-minute walks between.',
    tag: 'screenshot',
    segments: [
      seg('warm', 300), seg('easy', 300),
      seg('sprint', 60, { incline: 2.5 }), seg('recover', 120),
      seg('sprint', 60, { incline: 2.5 }), seg('recover', 120),
      seg('sprint', 60, { incline: 2.5 }), seg('recover', 120),
      seg('sprint', 60, { incline: 2.5 }),
      seg('cool', 300),
    ],
  },
  {
    id: 'hill-sprint-30',
    label: 'HILL & SPRINT 30',
    blurb: 'Hills climb by a percent, sprints climb by a step, then both again.',
    tag: 'screenshot',
    segments: [
      seg('warm', 300),
      // hills — incline rises, speed steady
      seg('hard', 30, { incline: 4, scale: 0.9 }), seg('hard', 30, { incline: 5, scale: 0.9 }), seg('hard', 30, { incline: 6, scale: 0.9 }), seg('recover', 60),
      seg('hard', 30, { incline: 5, scale: 0.9 }), seg('hard', 30, { incline: 6, scale: 0.9 }), seg('hard', 30, { incline: 7, scale: 0.9 }), seg('recover', 60),
      // sprints — speed rises
      seg('sprint', 30, { scale: 0.82 }), seg('sprint', 30, { scale: 0.88 }), seg('sprint', 30, { scale: 0.94 }), seg('recover', 60),
      seg('sprint', 30, { scale: 0.88 }), seg('sprint', 30, { scale: 0.94 }), seg('sprint', 30, { scale: 1.0 }), seg('recover', 60),
      // hills again, one percent steeper
      seg('hard', 30, { incline: 5, scale: 0.9 }), seg('hard', 30, { incline: 6, scale: 0.9 }), seg('hard', 30, { incline: 7, scale: 0.9 }), seg('recover', 60),
      seg('hard', 30, { incline: 6, scale: 0.9 }), seg('hard', 30, { incline: 7, scale: 0.9 }), seg('hard', 30, { incline: 8, scale: 0.9 }), seg('recover', 60),
      // sprints again, a step faster
      seg('sprint', 30, { scale: 0.88 }), seg('sprint', 30, { scale: 0.94 }), seg('sprint', 30, { scale: 1.0 }), seg('recover', 60),
      seg('sprint', 30, { scale: 0.94 }), seg('sprint', 30, { scale: 1.0 }), seg('sprint', 30, { scale: 1.06 }), seg('recover', 60),
      seg('cool', 300),
    ],
  },
  {
    id: 'rise-shine-20',
    label: 'RISE & SHINE 20',
    blurb: 'A minute fast, a minute easy, seven times — each fast minute a touch faster.',
    tag: 'screenshot',
    segments: [
      seg('warm', 180),
      seg('hard', 60, { scale: 0.93 }), seg('easy', 60),
      seg('hard', 60, { scale: 0.96 }), seg('easy', 60),
      seg('hard', 60, { scale: 0.99 }), seg('easy', 60),
      seg('hard', 60, { scale: 1.02 }), seg('easy', 60),
      seg('hard', 60, { scale: 1.05 }), seg('easy', 60),
      seg('hard', 60, { scale: 1.08 }), seg('easy', 60),
      seg('hard', 60, { scale: 1.10 }), seg('easy', 60),
      seg('cool', 180),
    ],
  },
  {
    id: 'sprint-recover',
    label: 'SPRINT / RECOVER',
    blurb: 'Light warm-up, thirty seconds all out, two minutes easy, eight times.',
    tag: 'fighter',
    segments: [seg('warm', 300), ...rep(8, [seg('sprint', 30), seg('recover', 120)]), seg('cool', 180)],
  },
];

export const programById = (id) => PROGRAMS.find(p => p.id === id) || PROGRAMS[0];

export function programSeconds(program) {
  return (program?.segments || []).reduce((s, x) => s + (x.seconds || 0), 0);
}
export const programMinutes = (program) => Math.round(programSeconds(program) / 60);

const KIND_LABEL = { warm: 'WARM-UP', easy: 'EASY', hard: 'RUN', sprint: 'SPRINT', recover: 'RECOVER', cool: 'COOL DOWN' };

// Spoken names per machine. The treadmill gets the numeric speed on top of
// these; the bike and the rower get only these.
const EFFORT_WORDS = {
  treadmill: { warm: 'Warm-up', easy: 'Easy', hard: 'Run', sprint: 'Sprint', recover: 'Recover', cool: 'Cool down' },
  bike:      { warm: 'Light warm-up spin', easy: 'Easy spin', hard: 'Strong spin', sprint: 'All out', recover: 'Recover, easy spin', cool: 'Cool down, easy spin' },
  row:       { warm: 'Light warm-up strokes', easy: 'Easy strokes', hard: 'Strong strokes', sprint: 'All out', recover: 'Recover, easy strokes', cool: 'Cool down, easy strokes' },
};

function speechFor(kind, machine, speed, unit, seconds, incline) {
  const words = (EFFORT_WORDS[machine] || EFFORT_WORDS.treadmill)[kind] || kind;
  const dur = speakDuration(seconds);
  if (machine === 'treadmill' && speed != null) {
    const inc = incline > 0 ? ` Incline ${incline} percent.` : '';
    return {
      pre: `${words} coming. Set ${fmtSpeed(speed)}.${inc} Five seconds.`,
      start: kind === 'sprint' ? `Go. ${dur}.` : `${words}. Set ${fmtSpeed(speed)}. ${dur}.`,
    };
  }
  return {
    pre: `${words} coming. Five seconds.`,
    start: kind === 'sprint' ? `Go. All out. ${dur}.` : `${words}. ${dur}.`,
  };
}

/**
 * Resolve a programme for a machine at an effort tier. Returns the segments
 * with absolute start/end seconds, the speed to set (treadmill only) and the
 * two lines the announcer speaks for each: `pre` five seconds ahead, `start`
 * on the change. The first segment has no `pre` — the intro covers it.
 */
export function expandProgram(program, { machine = 'treadmill', tier = 'normal', unit = 'mi' } = {}) {
  let t = 0;
  const segments = (program?.segments || []).map((s, index) => {
    const base = kindSpeed(s.kind, tier, unit);
    const speed = machine === 'treadmill' ? clampSpeed(base * (s.scale || 1), unit) : null;
    const speech = speechFor(s.kind, machine, speed, unit, s.seconds, s.incline || 0);
    const out = {
      index, kind: s.kind, seconds: s.seconds, startSec: t, endSec: t + s.seconds,
      speed, incline: s.incline || 0,
      label: KIND_LABEL[s.kind] || s.kind.toUpperCase(),
      target: machine === 'treadmill' && speed != null
        ? `${fmtSpeed(speed)} ${speedUnitLabel(unit)}${s.incline ? ` · ${s.incline}%` : ''}`
        : (EFFORT_WORDS[machine] || EFFORT_WORDS.treadmill)[s.kind],
      pre: index === 0 ? null : speech.pre,
      start: speech.start,
    };
    t += s.seconds;
    return out;
  });
  return { id: program.id, label: program.label, machine, tier, unit, totalSec: t, segments };
}

/** Index of the segment running at `sec`, or -1 once the programme is over. */
export function segmentAt(expanded, sec) {
  const list = expanded?.segments || [];
  for (let i = 0; i < list.length; i++) if (sec < list[i].endSec) return i;
  return -1;
}

/** The programmes offered for a machine. Everything runs anywhere; the order flatters the machine. */
export function programsFor(machine) {
  if (machine === 'bike' || machine === 'row') {
    const simple = PROGRAMS.filter(p => p.id === 'sprint-recover');
    return [...simple, ...PROGRAMS.filter(p => p.id !== 'sprint-recover' && p.id !== 'hill-sprint-30')];
  }
  return PROGRAMS;
}

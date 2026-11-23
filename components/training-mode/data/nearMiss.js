// Near-miss retry (retention feature 3, switch `nearMiss`): how close a
// session came, in plain words, from the real counts its end screen has.
// Pure: it reads nothing and writes nothing, and it never makes up a number:
// no count, no line.
//
//   nearMiss({ unit: 'rounds', done: 4, total: 5, outcome: 'partial' })
//     → { kind: 'count', gap: 1, line: '1 round to go', value: 4, max: 5, left: '4 OF 5 ROUNDS', right: null }
//   nearMiss({ unit: 'drills', done: 6, total: 8, outcome: 'fail' }) → line '2 drills short'
//   nearMiss({ unit: 'time', timeSec: 402, tiers, stars: 2 })
//     → { kind: 'time', gapSec: 13, line: '13 s off ★★★', value: 390, max: 402,
//         left: 'YOUR TIME 6:42', right: '★★★ UNDER 6:30', nextStars: 3 }
//
// Counts: the gap is the work left of the session (total − done). A session
// stopped short says "to go"; one that failed says "short". Nothing done at all
// is not a near miss (null): the screen stays as it is.
// Time: the classic saga's star tiers (fastest first or in any order,
// { stars, maxMinutes }, strict: under, not at). `stars` is what the stage
// holds now; the gap is this run's time to the next star above it.

const UNIT_WORDS = {
  rounds: ['round', 'rounds'],
  exercises: ['exercise', 'exercises'],
  drills: ['drill', 'drills'],
  tasks: ['task', 'tasks'],
  sets: ['set', 'sets'],
};

const whole = (n) => (Number.isFinite(Number(n)) ? Math.floor(Number(n)) : NaN);
const mmss = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
const fmtGap = (sec) => { const s = Math.max(1, Math.round(sec)); return s < 60 ? `${s} s` : mmss(s); };
export const starMarks = (n) => '★'.repeat(Math.max(0, Math.min(5, Math.round(n || 0))));

export function nearMiss(input = {}) {
  if (input.unit === 'time') return timeMiss(input);
  return countMiss(input);
}

function countMiss({ unit, done, total, outcome }) {
  const words = UNIT_WORDS[unit];
  if (!words) return null;
  const d = whole(done), t = whole(total);
  if (!(t > 0) || !(d > 0) || d >= t) return null;
  const gap = t - d;
  const word = gap === 1 ? words[0] : words[1];
  return {
    kind: 'count', unit, gap,
    line: `${gap} ${word} ${outcome === 'fail' ? 'short' : 'to go'}`,
    value: d, max: t,
    left: `${d} OF ${t} ${words[1].toUpperCase()}`,
    right: null,
  };
}

function timeMiss({ timeSec, tiers, stars, maxStars = 3 }) {
  const time = Number(timeSec);
  if (!Number.isFinite(time) || time <= 0 || !Array.isArray(tiers) || !tiers.length) return null;
  const held = Math.max(0, Math.round(Number(stars) || 0));
  if (held >= maxStars) return null;
  const tier = tiers.find((x) => x && x.stars === held + 1 && Number(x.maxMinutes) > 0);
  if (!tier) return null;
  const needSec = Math.round(tier.maxMinutes * 60);
  if (time < needSec) return null; // the run already made that star
  const gapSec = Math.round(time) - needSec + 1;
  return {
    kind: 'time', gapSec, nextStars: tier.stars,
    line: `${fmtGap(gapSec)} off ${starMarks(tier.stars)}`,
    value: needSec, max: Math.round(time),
    left: `YOUR TIME ${mmss(time)}`,
    right: `${starMarks(tier.stars)} UNDER ${mmss(needSec)}`,
  };
}

// The panel shows on a partial or a failed end, and on a clear only for the
// time gap to a star (the classic stage-clear screen).
export function showsNearMiss(miss, outcome) {
  if (!miss) return false;
  if (miss.kind === 'time') return true;
  return outcome === 'partial' || outcome === 'fail';
}

// Negative split — the second half of a run faster than the first. Judged
// from the run's trace ({ t: seconds, d: distance }) by interpolating the
// time at the halfway mark. GPS runs only: a machine's distance comes from a
// dial the athlete sets, which is not a measurement. Pays a flat bonus and
// never costs anything.
import { NEGATIVE_SPLIT_XP } from './xpStakes';

export const NEGATIVE_SPLIT_MIN_MI = 2;
export const NEGATIVE_SPLIT_MIN_KM = 3;
export const NEGATIVE_SPLIT_MARGIN = 0.01; // second half at least 1% faster

function timeAt(trace, dist) {
  for (let i = 1; i < trace.length; i++) {
    const a = trace[i - 1], b = trace[i];
    if (b.d >= dist) {
      if (b.d === a.d) return b.t;
      return a.t + (b.t - a.t) * ((dist - a.d) / (b.d - a.d));
    }
  }
  return null;
}

export function judgeNegativeSplit({ trace, totalDistance, totalSec, unit = 'mi', gps = true }) {
  const min = unit === 'km' ? NEGATIVE_SPLIT_MIN_KM : NEGATIVE_SPLIT_MIN_MI;
  const d = Number(totalDistance) || 0;
  const el = Number(totalSec) || 0;
  const eligible = !!gps && d >= min && el > 0 && Array.isArray(trace) && trace.length >= 4;
  if (!eligible) return { eligible: false, pass: false, firstHalfSec: null, secondHalfSec: null, xp: 0 };
  const half = timeAt(trace, d / 2);
  if (half == null || half <= 0 || half >= el) return { eligible: false, pass: false, firstHalfSec: null, secondHalfSec: null, xp: 0 };
  const first = half;
  const second = el - half;
  const pass = second <= first * (1 - NEGATIVE_SPLIT_MARGIN);
  return { eligible: true, pass, firstHalfSec: Math.round(first), secondHalfSec: Math.round(second), xp: pass ? NEGATIVE_SPLIT_XP : 0 };
}

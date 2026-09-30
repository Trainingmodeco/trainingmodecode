// Round intensity — did the athlete finish stronger than they started?
// The strikes the phone counted in the first two rounds set the session's
// baseline; the final round is judged against it. Beat the baseline by 15%
// and the finish pays the tier's win. There is no loss: fading late is
// information, not a penalty. The same live-phone gate as the rush verdict
// applies — a phone that could not see the athlete makes this BLIND.
import { stakesFor } from './xpStakes';

export const INTENSITY_FACTOR = 1.15;
export const INTENSITY_MIN_ROUNDS = 3;
export const INTENSITY_BASELINE_ROUNDS = 2;
export const INTENSITY_MIN_RATE = 0.4; // strikes per second across the baseline rounds

export function judgeRoundIntensity({ perRoundStrikes, roundSec, motionSeen, tier = 'normal' }) {
  const rounds = Array.isArray(perRoundStrikes) ? perRoundStrikes.map(n => Math.max(0, Number(n) || 0)) : [];
  const sec = Number(roundSec) || 0;
  const blank = { verdict: 'blind', baseline: null, final: null, ratio: null, xp: 0 };
  if (!motionSeen || sec <= 0 || rounds.length < INTENSITY_MIN_ROUNDS) return blank;
  const base = rounds.slice(0, INTENSITY_BASELINE_ROUNDS);
  const baseline = base.reduce((a, b) => a + b, 0) / base.length;
  if (baseline / sec < INTENSITY_MIN_RATE) return blank;
  const final = rounds[rounds.length - 1];
  const ratio = final / baseline;
  const pass = ratio >= INTENSITY_FACTOR;
  return { verdict: pass ? 'pass' : 'hold', baseline: Math.round(baseline), final, ratio, xp: pass ? stakesFor(tier).win : 0 };
}

// Rush verdict — did the athlete actually speed up when the coach called the
// rush? Judged from the accelerometer strike count, against the athlete's own
// rate earlier in the same round, so it is relative to them and not a table.
//
// The phone has to be able to see the athlete for a verdict to count. If
// motion never arrived, or the pre-rush baseline is too short or too thin to
// trust (phone on the floor, on the bag frame, in a locker), the rush is
// BLIND: no XP either way, no popup. Nobody loses XP because the phone
// could not track them.
import { stakesFor } from './xpStakes';

export const RUSH_PASS_FACTOR = 1.2;       // rush rate ≥ 1.2× baseline → pass
export const RUSH_FAIL_FACTOR = 0.85;      // rush rate < 0.85× baseline → fail (they slowed)
export const RUSH_MIN_BASELINE_SEC = 15;   // need this much non-rush work before the call
export const RUSH_MIN_BASELINE_RATE = 0.4; // strikes per second (24/min) — below this the phone is not seeing much
export const RUSH_MIN_WINDOW_SEC = 5;      // a rush shorter than this is noise
export const RUSH_MIN_STRIKES = 4;         // a pass needs at least this many strikes in the window

export function newRushTally() {
  return { passes: 0, fails: 0, held: 0, blind: 0, results: [] };
}

// verdict: 'pass' | 'fail' | 'hold' (in the neutral band) | 'blind' (could not judge)
export function judgeRush({ motionSeen, baselineStrikes, baselineSec, rushStrikes, rushSec }) {
  const bSec = Number(baselineSec) || 0;
  const rSec = Number(rushSec) || 0;
  const bStrikes = Math.max(0, Number(baselineStrikes) || 0);
  const rStrikes = Math.max(0, Number(rushStrikes) || 0);
  const baselineRate = bSec > 0 ? bStrikes / bSec : 0;
  const rushRate = rSec > 0 ? rStrikes / rSec : 0;
  const blind = !motionSeen || bSec < RUSH_MIN_BASELINE_SEC || baselineRate < RUSH_MIN_BASELINE_RATE || rSec < RUSH_MIN_WINDOW_SEC;
  if (blind) return { verdict: 'blind', baselineRate, rushRate, ratio: null };
  const ratio = rushRate / baselineRate;
  if (ratio >= RUSH_PASS_FACTOR && rStrikes >= RUSH_MIN_STRIKES) return { verdict: 'pass', baselineRate, rushRate, ratio };
  if (ratio < RUSH_FAIL_FACTOR) return { verdict: 'fail', baselineRate, rushRate, ratio };
  return { verdict: 'hold', baselineRate, rushRate, ratio };
}

// Records one judged rush on the tally and returns the XP delta it carries.
export function tallyRush(tally, judged, tier = 'normal') {
  const { win, loss } = stakesFor(tier);
  let xp = 0;
  if (judged.verdict === 'pass') { tally.passes += 1; xp = win; }
  else if (judged.verdict === 'fail') { tally.fails += 1; xp = -loss; }
  else if (judged.verdict === 'hold') tally.held += 1;
  else tally.blind += 1;
  tally.results.push({ ...judged, xp });
  return xp;
}

export function rushSummary(tally, tier = 'normal') {
  const t = tally || newRushTally();
  const { win, loss } = stakesFor(tier);
  const won = t.passes * win;
  const lost = t.fails * loss;
  return {
    passes: t.passes, fails: t.fails, held: t.held || 0, blind: t.blind || 0,
    attempts: t.passes + t.fails + (t.held || 0), won, lost, xp: won - lost, stakes: { win, loss },
  };
}

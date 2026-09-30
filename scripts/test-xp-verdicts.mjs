// Live XP verdicts: the shared stakes table, rush verdicts (blind when the
// phone cannot see the athlete), clean-round bonus, negative splits, and the
// fight settle with a bonus riding it. Run with `npm run test:xp`.
import { XP_STAKES_BY_TIER, stakesFor, tierKey, cleanRoundXp, CLEAN_ROUND_XP, NEGATIVE_SPLIT_XP } from '../components/training-mode/data/xpStakes.js';
import { judgeRush, tallyRush, newRushTally, rushSummary, RUSH_MIN_BASELINE_SEC } from '../components/training-mode/data/rushVerdict.js';
import { judgeNegativeSplit } from '../components/training-mode/data/negativeSplit.js';
import { chaseXp, CHASE_XP } from '../components/training-mode/data/chase.js';
import { pickXpBanner } from '../components/training-mode/data/xpBanners.js';

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}  ${extra}`); } };

// ── stakes ────────────────────────────────────────────────────────────────
check('three tiers', Object.keys(XP_STAKES_BY_TIER).length === 3);
check('every tier: win pays more than loss costs', Object.values(XP_STAKES_BY_TIER).every(t => t.win > t.loss));
check('NORMAL is 10 / 5', stakesFor('normal').win === 10 && stakesFor('normal').loss === 5);
check('HARD raises both', stakesFor('hard').win > stakesFor('normal').win && stakesFor('hard').loss > stakesFor('normal').loss);
check('fight difficulty names map', tierKey('Easy') === 'easy' && tierKey('Normal') === 'normal' && tierKey('Hard') === 'hard' && tierKey('Advanced') === 'hard');
check('unknown tier is NORMAL', tierKey('savage') === 'hard' && tierKey(undefined) === 'normal' && tierKey('???') === 'normal');
check('chase stakes are the shared table', chaseXp('hard').win === stakesFor('hard').win && CHASE_XP === 10);
check('clean round bonus', cleanRoundXp(3) === 3 * CLEAN_ROUND_XP && cleanRoundXp(0) === 0 && cleanRoundXp(-2) === 0);

// ── rush verdicts ─────────────────────────────────────────────────────────
const live = { motionSeen: true, baselineStrikes: 60, baselineSec: 60 }; // 1 strike/s before the call
check('blind without motion', judgeRush({ ...live, motionSeen: false, rushStrikes: 20, rushSec: 10 }).verdict === 'blind');
check('blind on a thin baseline', judgeRush({ ...live, baselineSec: RUSH_MIN_BASELINE_SEC - 1, baselineStrikes: 20, rushStrikes: 20, rushSec: 10 }).verdict === 'blind');
check('blind when the phone barely saw anything', judgeRush({ motionSeen: true, baselineStrikes: 3, baselineSec: 60, rushStrikes: 0, rushSec: 10 }).verdict === 'blind');
check('blind on a tiny window', judgeRush({ ...live, rushStrikes: 5, rushSec: 3 }).verdict === 'blind');
check('pass at 1.5× the baseline', judgeRush({ ...live, rushStrikes: 15, rushSec: 10 }).verdict === 'pass');
check('pass exactly at the factor', judgeRush({ ...live, rushStrikes: 12, rushSec: 10 }).verdict === 'pass');
check('hold in the neutral band', judgeRush({ ...live, rushStrikes: 10, rushSec: 10 }).verdict === 'hold');
check('fail when they slow down', judgeRush({ ...live, rushStrikes: 6, rushSec: 10 }).verdict === 'fail');
check('a standing athlete with a live phone fails', judgeRush({ ...live, rushStrikes: 0, rushSec: 10 }).verdict === 'fail');
check('phone on the floor never fails', judgeRush({ motionSeen: false, baselineStrikes: 0, baselineSec: 120, rushStrikes: 0, rushSec: 10 }).verdict === 'blind');
check('phone on the floor with motion flag but nothing counted never fails', judgeRush({ motionSeen: true, baselineStrikes: 0, baselineSec: 120, rushStrikes: 0, rushSec: 10 }).verdict === 'blind');
{
  const t = newRushTally();
  const a = tallyRush(t, judgeRush({ ...live, rushStrikes: 15, rushSec: 10 }), 'normal');
  const b = tallyRush(t, judgeRush({ ...live, rushStrikes: 6, rushSec: 10 }), 'normal');
  const c = tallyRush(t, judgeRush({ ...live, rushStrikes: 10, rushSec: 10 }), 'normal');
  const d = tallyRush(t, judgeRush({ ...live, motionSeen: false, rushStrikes: 10, rushSec: 10 }), 'normal');
  check('tally deltas +10 / −5 / 0 / 0', a === 10 && b === -5 && c === 0 && d === 0, `${a} ${b} ${c} ${d}`);
  const s = rushSummary(t, 'normal');
  check('summary counts', s.passes === 1 && s.fails === 1 && s.held === 1 && s.blind === 1 && s.attempts === 3);
  check('summary nets +5', s.xp === 5 && s.won === 10 && s.lost === 5);
  check('summary at HARD nets +7', rushSummary(t, 'hard').xp === 15 - 8);
  check('empty summary is zero', rushSummary(null).xp === 0 && rushSummary(newRushTally()).attempts === 0);
}

// ── negative splits ───────────────────────────────────────────────────────
const trace = (segments) => { // [[secondsForHalf1], ...] → even-paced trace points
  const out = [{ t: 0, d: 0 }]; let t = 0, d = 0;
  segments.forEach(([sec, dist]) => { for (let i = 1; i <= 10; i++) { t += sec / 10; d += dist / 10; out.push({ t: +t.toFixed(1), d: +d.toFixed(4) }); } });
  return out;
};
{
  const neg = trace([[600, 1.5], [540, 1.5]]); // 10:00 then 9:00 for 1.5 mi each
  const r = judgeNegativeSplit({ trace: neg, totalDistance: 3, totalSec: 1140, unit: 'mi', gps: true });
  check('negative split passes', r.eligible && r.pass && r.xp === NEGATIVE_SPLIT_XP, JSON.stringify(r));
  check('halves measured', r.firstHalfSec === 600 && r.secondHalfSec === 540, `${r.firstHalfSec} ${r.secondHalfSec}`);
  const pos = trace([[540, 1.5], [600, 1.5]]);
  const p = judgeNegativeSplit({ trace: pos, totalDistance: 3, totalSec: 1140, unit: 'mi', gps: true });
  check('positive split: eligible, no pass, no loss', p.eligible && !p.pass && p.xp === 0);
  const even = trace([[600, 1.5], [598, 1.5]]);
  check('inside the 1% margin is not a pass', !judgeNegativeSplit({ trace: even, totalDistance: 3, totalSec: 1198, unit: 'mi', gps: true }).pass);
  check('too short is ineligible', !judgeNegativeSplit({ trace: trace([[300, 0.75], [270, 0.75]]), totalDistance: 1.5, totalSec: 570, unit: 'mi', gps: true }).eligible);
  check('machine runs are ineligible', !judgeNegativeSplit({ trace: neg, totalDistance: 3, totalSec: 1140, unit: 'mi', gps: false }).eligible);
  check('km threshold is 3 km', judgeNegativeSplit({ trace: trace([[600, 1.6], [540, 1.6]]), totalDistance: 3.2, totalSec: 1140, unit: 'km', gps: true }).eligible);
  check('no trace is ineligible', !judgeNegativeSplit({ trace: [], totalDistance: 5, totalSec: 3000, unit: 'mi', gps: true }).eligible);
}

// ── plate picks ───────────────────────────────────────────────────────────
check('fight gain is the crown', pickXpBanner('gain', { mode: 'fight' }).id === 'crown');
check('cardio gain is iron', pickXpBanner('gain', { mode: 'cardio' }).id === 'iron');
check('fight loss is the gloves', pickXpBanner('loss', { mode: 'fight' }).id === 'gloves');
check('camp stage loss is the reaper', pickXpBanner('loss', { mode: 'fight', camp: true }).id === 'reaper');
check('HARD loss is the reaper', pickXpBanner('loss', { mode: 'cardio', tier: 'hard' }).id === 'reaper');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

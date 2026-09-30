// Effort tiers, the chase engine and the guided programme library — the pure
// rules behind RUN / JOG / MACHINE and INTERVALS. Run: npm run test:intervals
import {
  EFFORT_MPH, effortMph, effortSpeed, effortPaceSec, kindSpeed, normalizeTier,
} from '../components/training-mode/data/runEffort.js';
import {
  newChaseState, firstChaseAt, nextChaseAt, chaseWindow, canStartChase,
  chasePaceFromWindow, evaluateChase, chaseBeepAt, chaseSummary,
  CHASE_FIRST_MIN_SEC, CHASE_FIRST_MAX_SEC, CHASE_GAP_MIN_SEC, CHASE_GAP_MAX_SEC,
  CHASE_WINDOW_MIN_SEC, CHASE_WINDOW_MAX_SEC, CHASE_XP, CHASE_XP_BY_TIER, chaseXp, CHASE_TAIL_GUARD_SEC,
} from '../components/training-mode/data/chase.js';
import {
  PROGRAMS, programById, programSeconds, programMinutes, expandProgram, segmentAt, programsFor,
} from '../components/training-mode/data/intervalPrograms.js';

let fail = 0;
let pass = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; } else { fail++; console.log(`FAIL  ${name} ${extra}`); }
};

// ── effort tiers ──────────────────────────────────────────────────────────
check('jog band 3-5', EFFORT_MPH.jog.easy === 3 && EFFORT_MPH.jog.normal === 4 && EFFORT_MPH.jog.hard === 5);
check('run band 6-8', EFFORT_MPH.run.easy === 6 && EFFORT_MPH.run.normal === 7 && EFFORT_MPH.run.hard === 8);
check('sprint 9+', EFFORT_MPH.sprint.easy === 9 && EFFORT_MPH.sprint.normal === 10 && EFFORT_MPH.sprint.hard > 10);
check('normal jog is 15:00/mi', effortPaceSec('jog', 'normal', 'mi') === 900);
check('hard run is 7:30/mi', effortPaceSec('run', 'hard', 'mi') === 450);
check('km speed converts', Math.abs(effortSpeed('run', 'normal', 'km') - 11.3) < 0.05, String(effortSpeed('run', 'normal', 'km')));
check('bad tier falls to normal', normalizeTier('savage') === 'normal' && effortMph('run', 'savage') === 7);
check('warm-up is easy jog at any tier', kindSpeed('warm', 'hard') === 3 && kindSpeed('cool', 'easy') === 3);
check('recover is jog AT tier', kindSpeed('recover', 'hard') === 5 && kindSpeed('recover', 'easy') === 3);
check('hard is run at tier, sprint is sprint at tier', kindSpeed('hard', 'normal') === 7 && kindSpeed('sprint', 'hard') === 11.5);

// ── chase scheduling ──────────────────────────────────────────────────────
const lo = () => 0, hi = () => 0.999999;
check('first chase never before 4 min', firstChaseAt(lo) === CHASE_FIRST_MIN_SEC && firstChaseAt(hi) === CHASE_FIRST_MAX_SEC);
check('next chase 3-6 min later', nextChaseAt(600, lo) === 600 + CHASE_GAP_MIN_SEC && nextChaseAt(600, hi) === 600 + CHASE_GAP_MAX_SEC);
check('window 40-60 s', chaseWindow(lo) === CHASE_WINDOW_MIN_SEC && chaseWindow(hi) === CHASE_WINDOW_MAX_SEC);
for (let i = 0; i < 200; i++) {
  const w = chaseWindow();
  if (w < CHASE_WINDOW_MIN_SEC || w > CHASE_WINDOW_MAX_SEC) { check('random window in range', false, String(w)); break; }
}
check('not before its second', !canStartChase({ nowSec: 239, nextAtSec: 240, baselinePaceSec: 600 }));
check('starts on its second with a baseline', canStartChase({ nowSec: 240, nextAtSec: 240, baselinePaceSec: 600 }));
check('no baseline, no chase', !canStartChase({ nowSec: 300, nextAtSec: 240, baselinePaceSec: null }));
check('free run ignores the tail guard', canStartChase({ nowSec: 300, nextAtSec: 240, baselinePaceSec: 600, remainingSec: null }));
check('targeted run protects the last two minutes', !canStartChase({ nowSec: 300, nextAtSec: 240, baselinePaceSec: 600, remainingSec: CHASE_TAIL_GUARD_SEC + 30, windowSec: 60 }));
check('targeted run with room allows it', canStartChase({ nowSec: 300, nextAtSec: 240, baselinePaceSec: 600, remainingSec: CHASE_TAIL_GUARD_SEC + 61, windowSec: 60 }));

// ── chase evaluation (pace = seconds per unit; faster = smaller) ──────────
const MPM = 1609.344;
check('15% faster passes', evaluateChase({ baselinePaceSec: 600, chasePaceSec: 510 }).pass);
check('exactly 15% passes', evaluateChase({ baselinePaceSec: 600, chasePaceSec: 510 }).requiredPaceSec === 510);
check('10% faster fails', !evaluateChase({ baselinePaceSec: 600, chasePaceSec: 540 }).pass);
check('same pace fails', !evaluateChase({ baselinePaceSec: 600, chasePaceSec: 600 }).pass);
check('slower fails', !evaluateChase({ baselinePaceSec: 600, chasePaceSec: 660 }).pass);
check('no chase pace fails safely', !evaluateChase({ baselinePaceSec: 600, chasePaceSec: null }).pass);
// 10:00/mi baseline = 2.68 m/s. Over a 45 s window at 15% faster (8:30/mi) you cover ~142 m.
const p = chasePaceFromWindow({ startMeters: 1000, endMeters: 1142, seconds: 45, metersPerUnitValue: MPM });
check('window pace from metres', Math.abs(p - 510) < 2, String(p));
check('too little ground is null', chasePaceFromWindow({ startMeters: 1000, endMeters: 1010, seconds: 45, metersPerUnitValue: MPM }) === null);
check('a standing athlete fails the chase', !evaluateChase({ baselinePaceSec: 600, chasePaceSec: chasePaceFromWindow({ startMeters: 1000, endMeters: 1000, seconds: 45, metersPerUnitValue: MPM }) }).pass);

// ── beeps and summary ─────────────────────────────────────────────────────
check('slow beep every ten seconds', chaseBeepAt(40) === 'slow' && chaseBeepAt(30) === 'slow' && chaseBeepAt(35) === null);
check('fast beep in the last five', chaseBeepAt(5) === 'fast' && chaseBeepAt(1) === 'fast' && chaseBeepAt(0) === null);
const st = newChaseState(); st.passes = 3; st.fails = 1;
const sum = chaseSummary(st);
check('summary nets wins minus losses at NORMAL', sum.attempts === 4 && sum.won === 30 && sum.lost === 5 && sum.xp === 25);
check('CHASE_XP is the NORMAL win', CHASE_XP === CHASE_XP_BY_TIER.normal.win && CHASE_XP === 10);
check('HARD raises both stakes', chaseXp('hard').win > chaseXp('normal').win && chaseXp('hard').loss > chaseXp('normal').loss);
check('EASY lowers both stakes', chaseXp('easy').win < chaseXp('normal').win && chaseXp('easy').loss < chaseXp('normal').loss);
check('every tier: a win pays more than a loss costs', Object.values(CHASE_XP_BY_TIER).every(t => t.win > t.loss));
check('unknown tier falls back to NORMAL', chaseXp('???').win === 10 && chaseXp(null).loss === 5);
check('SAVAGE and Advanced count as HARD', chaseXp('savage').win === 15 && chaseXp('Advanced').loss === 8);
check('summary at HARD', chaseSummary(st, 'hard').xp === 3 * 15 - 8);
check('a fail-only run nets negative', chaseSummary({ passes: 0, fails: 2 }, 'normal').xp === -10);
check('empty summary is zero', chaseSummary(newChaseState()).xp === 0 && chaseSummary(null).attempts === 0);

// ── programme library ─────────────────────────────────────────────────────
check('ten programmes', PROGRAMS.length === 10, String(PROGRAMS.length));
const ids = new Set(PROGRAMS.map(p => p.id));
check('ids unique', ids.size === PROGRAMS.length);
const expectMin = { 'fight-3x1': 28, 'fight-5x1': 26, tabata: 12, 'thirty-thirty': 20, ladder: 28, 'norwegian-4x4': 38, 'hiit-25': 25, 'hill-sprint-30': 30, 'rise-shine-20': 20, 'sprint-recover': 28 };
for (const p of PROGRAMS) {
  check(`${p.id} minutes = ${expectMin[p.id]}`, programMinutes(p) === expectMin[p.id], String(programMinutes(p)));
  check(`${p.id} starts warm, ends cool`, p.segments[0].kind === 'warm' && p.segments[p.segments.length - 1].kind === 'cool');
  for (const machine of ['treadmill', 'bike', 'row']) {
    for (const tier of ['easy', 'normal', 'hard']) {
      const x = expandProgram(p, { machine, tier, unit: 'mi' });
      check(`${p.id}/${machine}/${tier} total matches`, x.totalSec === programSeconds(p));
      // contiguous, no gaps
      let ok = x.segments[0].startSec === 0;
      for (let i = 1; i < x.segments.length; i++) ok = ok && x.segments[i].startSec === x.segments[i - 1].endSec;
      check(`${p.id}/${machine}/${tier} contiguous`, ok);
      check(`${p.id}/${machine}/${tier} first has no pre-call`, x.segments[0].pre === null && !!x.segments[0].start);
      if (machine === 'treadmill') {
        check(`${p.id}/${tier} treadmill speeds set`, x.segments.every(s => s.speed > 0 && /Set \d+\.\d/.test(s.start) || s.kind === 'sprint'));
        const sprintSegs = x.segments.filter(s => s.kind === 'sprint');
        check(`${p.id}/${tier} sprints are in the sprint band`, sprintSegs.every(s => s.speed >= 7.3), sprintSegs.map(s => s.speed).join(','));
        const warm = x.segments[0];
        check(`${p.id}/${tier} warm-up is 3.0`, warm.speed === 3);
      } else {
        check(`${p.id}/${machine}/${tier} effort words, no numbers`, x.segments.every(s => s.speed == null && !/\d\.\d/.test(s.start) && !/\d\.\d/.test(s.target)));
      }
    }
  }
}
// tier changes the numbers
const e = expandProgram(programById('fight-3x1'), { tier: 'easy' }), h = expandProgram(programById('fight-3x1'), { tier: 'hard' });
check('hard tier runs faster than easy', h.segments[1].speed > e.segments[1].speed && h.segments[1].speed === 8 && e.segments[1].speed === 6);
// rising sprints in hill & sprint
const hs = expandProgram(programById('hill-sprint-30'), { tier: 'normal' }).segments.filter(s => s.kind === 'sprint').map(s => s.speed);
check('hill & sprint sprints climb', hs[0] < hs[1] && hs[1] < hs[2] && hs[hs.length - 1] > hs[0], hs.join(','));
// segmentAt
const x = expandProgram(programById('tabata'), {});
check('segmentAt start', segmentAt(x, 0) === 0 && x.segments[0].kind === 'warm');
check('segmentAt first sprint', x.segments[segmentAt(x, 300)].kind === 'sprint');
check('segmentAt boundary goes to the next', segmentAt(x, 320) === 2 && x.segments[2].kind === 'recover');
check('segmentAt past the end is -1', segmentAt(x, x.totalSec) === -1);
// machine lists
check('bike list leads with sprint/recover and drops the hill programme', programsFor('bike')[0].id === 'sprint-recover' && !programsFor('row').some(p => p.id === 'hill-sprint-30'));
check('treadmill list is the full library', programsFor('treadmill').length === PROGRAMS.length);
// speech shape — the owner's example
const fr = expandProgram(programById('fight-3x1'), { tier: 'normal' }).segments;
check('warm-up speech sets 3.0 for five minutes', /Warm-up\. Set 3\.0\. 5 minutes\./.test(fr[0].start), fr[0].start);
check('run pre-call five seconds ahead', /Run coming\. Set 7\.0\. Five seconds\./.test(fr[1].pre), fr[1].pre);
const tb = expandProgram(programById('tabata'), { tier: 'normal' }).segments;
check('sprint pre-call then Go', /Sprint coming\. Set 10\.0\./.test(tb[1].pre) && /^Go\. 20 seconds\.$/.test(tb[1].start), `${tb[1].pre} | ${tb[1].start}`);
const bk = expandProgram(programById('sprint-recover'), { machine: 'bike', tier: 'normal' }).segments;
check('bike sprint is all out, recovery an easy spin', /^Go\. All out\./.test(bk[1].start) && /Recover, easy spin/.test(bk[2].start), `${bk[1].start} | ${bk[2].start}`);

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

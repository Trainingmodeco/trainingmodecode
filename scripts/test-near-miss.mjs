// Near-miss retry (retention feature 3): the classic Arcade clear's verdict
// (the bug: a cleared stage read as MISSION FAILED), the plain-words gap from
// the real counts, the retry safety rule, today's tries log, and what a stage
// was (boss / final / title). Run with `npm run test:nearmiss`.
process.env.TZ = 'America/New_York';
const store = new Map();
let writes = 0;
const ls = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { writes++; store.set(k, String(v)); },
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
globalThis.localStorage = ls;
const listeners = [];
globalThis.window = { localStorage: ls, addEventListener(t, f) { if (t === 'storage') listeners.push(f); }, removeEventListener() {}, dispatchEvent() { return true; } };
// The stats are cached in memory: a write from "another tab" drops the cache.
const setStats = (v) => { store.set('tm_user_stats', JSON.stringify(v)); listeners.forEach((f) => f({ key: 'tm_user_stats' })); };
globalThis.Event = globalThis.Event || class { constructor(t) { this.type = t; } };

const O = await import('../components/training-mode/data/arcadeOutcome.js');
const N = await import('../components/training-mode/data/nearMiss.js');
const R = await import('../components/training-mode/data/retrySafety.js');
const S = await import('../components/training-mode/data/nearMissStore.js');
const F = await import('../components/training-mode/data/retentionFlags.js');
const P = await import('../components/training-mode/data/pathStars.js');
const A = await import('../components/training-mode/data/trainingArcadeData.js');
const CI = await import('../components/training-mode/data/concepts/index.js');
const { CAMPAIGN_SERIES } = await import('../components/training-mode/data/arcadeCampaignSeries.js');

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}  ${extra}`); } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const section = (t) => console.log(`\n${t}`);
const at = (y, m, d, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime();

section('the classic clear (ArcadeSessionPlayer → ArcadeStageClearOverlay)');
// What the normal clear handed the overlay before the fix: no counts.
const oldClear = { invalid: false, rank: null, points: 300, xpEarned: 300, statRewards: null, elapsedSeconds: 1300, stars: 2, newBest: true };
check('the bug: a clear with no counts reads as a fail (MISSION FAILED)', O.arcadeOverlayOutcome(oldClear).screen === 'failed', O.arcadeOverlayOutcome(oldClear).screen);
const fixed = O.normalClearResult({ xp: 300, statRewards: null, taskCount: 7, elapsedSeconds: 1300, stars: 2, newBest: true });
check('the fix: the clear carries every task done (7 of 7)', fixed.completedTasks === 7 && fixed.totalTasks === 7);
check('… and reads as cleared', O.arcadeOverlayOutcome(fixed).screen === 'cleared' && O.arcadeOverlayOutcome(fixed).verdict.outcome === 'pass');
check('… keeping the run\'s time, stars and XP', fixed.elapsedSeconds === 1300 && fixed.stars === 2 && fixed.newBest === true && fixed.xpEarned === 300 && fixed.points === 300 && fixed.invalid === false);
check('a stage with no tasks still reads as one task done', O.normalClearResult({ taskCount: 0 }).totalTasks === 1 && O.arcadeOverlayOutcome(O.normalClearResult({ taskCount: 0 })).screen === 'cleared');
check('every difficulty word passes a full clear', ['standard', 'easy', 'normal', 'hard', 'advanced', undefined].every((d) => O.arcadeOverlayOutcome({ ...fixed, difficulty: d }).screen === 'cleared'));
check('the benchmark\'s clear (its own counts) still reads cleared', O.arcadeOverlayOutcome({ invalid: false, rank: 'A', completedTasks: 3, totalTasks: 3, elapsedSeconds: 900 }).screen === 'cleared');
check('a benchmark ended with 2 of 3 tested reads partial', O.arcadeOverlayOutcome({ invalid: false, completedTasks: 2, totalTasks: 3 }).screen === 'partial');
check('an invalid result reads invalid', O.arcadeOverlayOutcome({ invalid: true, reason: 'x' }).screen === 'invalid');
check('a player\'s flags win: partial / hardFail / missionFailed', O.arcadeOverlayOutcome({ partial: true }).screen === 'partial'
  && O.arcadeOverlayOutcome({ hardFail: true }).screen === 'failed' && O.arcadeOverlayOutcome({ missionFailed: true, partial: true }).screen === 'failed');

section('the classic RETRY\'s clock (for everyone, owner 2026-11-23)');
{
  const OPc = A.getSeriesById('one-punch-protocol');
  const stg = OPc.stages[1]; // 3★ < 22:00, 2★ < 28:00, 1★ < 36:00
  const t0 = at(2026, 11, 23, 9);
  const min = 60 * 1000;
  // First go: the briefing ends at 9:00, the athlete stops 11 minutes in.
  let clock = O.stageClockStart(null, t0);
  check('the first briefing starts the clock', clock === t0);
  // RETRY, a new briefing at 9:12, a clear 20:30 later.
  clock = O.STAGE_CLOCK_RETRY;
  check('RETRY leaves no clock running', clock == null);
  const t1 = t0 + 12 * min;
  clock = O.stageClockStart(clock, t1);
  const end = t1 + 20.5 * min;
  const sec = O.stageElapsedSeconds(clock, end);
  check('the retried run is timed from its own briefing: 20:30, not 32:30', sec === 1230, String(sec));
  check('… so it earns its own stars (★★★ under 22:00)', A.getStarsForTime(stg, sec) === 3, String(A.getStarsForTime(stg, sec)));
  const oldSec = O.stageElapsedSeconds(t0, end);
  check('the old clock (from the first go) would have read 32:30 and ★', oldSec === 1950 && A.getStarsForTime(stg, oldSec) === 1, `${oldSec} ${A.getStarsForTime(stg, oldSec)}`);
  check('a resumed session keeps the start it was given', O.stageClockStart(t0, t1) === t0);
  check('no clock: no time (and no stars from it)', O.stageElapsedSeconds(null, end) === null);
  // The player resets it on every RETRY, with or without the near-miss switch.
  const src = (await import('node:fs')).readFileSync(new URL('../components/training-mode/ArcadeSessionPlayer.jsx', import.meta.url), 'utf8');
  const retryBody = (src.match(/const handleRetryStage = useCallback\(\(\) => \{([\s\S]*?)\n {2}\}, \[/) || [])[1] || '';
  check('ArcadeSessionPlayer: RETRY resets the clock with no switch around it',
    /sessionStartedAtRef\.current = STAGE_CLOCK_RETRY;/.test(retryBody) && !/nearMissOn|retentionOn/.test(retryBody), retryBody.slice(0, 160));
  check('… the briefing starts it through stageClockStart, the clear reads stageElapsedSeconds',
    /sessionStartedAtRef\.current = stageClockStart\(sessionStartedAtRef\.current, Date\.now\(\)\)/.test(src) && /stageElapsedSeconds\(sessionStartedAtRef\.current, Date\.now\(\)\)/.test(src));
}

section('the gap from the counts');
let m = N.nearMiss({ unit: 'rounds', done: 4, total: 5, outcome: 'partial' });
check('4 of 5 rounds, stopped: "1 round to go"', m?.line === '1 round to go' && m.gap === 1, m?.line);
check('… bar 4 of 5, label "4 OF 5 ROUNDS"', m.value === 4 && m.max === 5 && m.left === '4 OF 5 ROUNDS' && m.right === null);
check('6 of 8 drills, failed: "2 drills short"', N.nearMiss({ unit: 'drills', done: 6, total: 8, outcome: 'fail' })?.line === '2 drills short');
check('exercises, tasks, sets: their own words', N.nearMiss({ unit: 'exercises', done: 9, total: 12 })?.line === '3 exercises to go'
  && N.nearMiss({ unit: 'tasks', done: 2, total: 3 })?.line === '1 task to go' && N.nearMiss({ unit: 'sets', done: 3, total: 5 })?.line === '2 sets to go');
m = N.nearMiss({ unit: 'rounds', done: 0, total: 3, outcome: 'fail' });
check('nothing done (owner: "show 3 rounds to go there too"): "3 rounds to go", never "short"', m?.line === '3 rounds to go' && m.gap === 3 && m.nothing === true, m?.line);
check('… an empty bar, 0 of 3, label "0 OF 3 ROUNDS"', m.value === 0 && m.max === 3 && m.left === '0 OF 3 ROUNDS' && m.right === null);
check('… stopped (partial) reads the same, every unit in its own words', N.nearMiss({ unit: 'rounds', done: 0, total: 3, outcome: 'partial' })?.line === '3 rounds to go'
  && N.nearMiss({ unit: 'exercises', done: 0, total: 12, outcome: 'fail' })?.line === '12 exercises to go' && N.nearMiss({ unit: 'drills', done: 0, total: 1, outcome: 'fail' })?.line === '1 drill to go');
check('… work done is not "nothing" (1 of 3 failed: "2 rounds short")', N.nearMiss({ unit: 'rounds', done: 1, total: 3, outcome: 'fail' })?.nothing === false && N.nearMiss({ unit: 'rounds', done: 1, total: 3, outcome: 'fail' })?.line === '2 rounds short');
check('a missing count is not "nothing done": null, undefined, \'\' give no line', N.nearMiss({ unit: 'rounds', done: null, total: 3 }) === null
  && N.nearMiss({ unit: 'rounds', done: undefined, total: 3 }) === null && N.nearMiss({ unit: 'rounds', done: '', total: 3 }) === null && N.nearMiss({ unit: 'rounds', done: -1, total: 3 }) === null);
check('nothing of nothing (0 of 0): no line', N.nearMiss({ unit: 'rounds', done: 0, total: 0 }) === null);
check('all done: no gap', N.nearMiss({ unit: 'rounds', done: 5, total: 5 }) === null && N.nearMiss({ unit: 'rounds', done: 6, total: 5 }) === null);
check('no total, a made-up unit, NaN: no line (never invents a number)', N.nearMiss({ unit: 'rounds', done: 2 }) === null
  && N.nearMiss({ unit: 'reps', done: 92, total: 100 }) === null && N.nearMiss({ unit: 'rounds', done: 'x', total: 3 }) === null && N.nearMiss({}) === null);
check('fractions are counted whole (2.7 of 4 → 2 of 4)', N.nearMiss({ unit: 'rounds', done: 2.7, total: 4 })?.line === '2 rounds to go');

section('the gap to the next star (the classic saga\'s time tiers)');
const OP = A.getSeriesById('one-punch-protocol');
const op2 = OP.stages[1]; // 3★ < 22:00, 2★ < 28:00, 1★ < 36:00
const tiers = P.stageStarRule(OP, op2).tiers;
m = N.nearMiss({ unit: 'time', timeSec: 22 * 60 + 12, tiers, stars: 2 });
check('22:12 with 2★ held: "12 s off ★★★" (the two times as shown)', m?.line === '12 s off ★★★' && m.gapSec === 12, m?.line);
check('… labels: YOUR TIME 22:12 · ★★★ UNDER 22:00, bar 1320 of 1332', m.left === 'YOUR TIME 22:12' && m.right === '★★★ UNDER 22:00' && m.value === 1320 && m.max === 1332 && m.nextStars === 3);
check('exactly 22:00 is still 1 s off', N.nearMiss({ unit: 'time', timeSec: 1320, tiers, stars: 2 })?.line === '1 s off ★★★');
check('a gap over a minute reads m:ss: 29:10 with 1★ → "1:10 off ★★"', N.nearMiss({ unit: 'time', timeSec: 29 * 60 + 10, tiers, stars: 1 })?.line === '1:10 off ★★');
m = N.nearMiss({ unit: 'time', timeSec: 22 * 60 + 12.7, tiers, stars: 2 });
check('a fraction of a second is cut as the clear screen shows it: 22:12.7 → YOUR TIME 22:12, 12 s off', m?.left === 'YOUR TIME 22:12' && m.line === '12 s off ★★★' && m.max === 1332, `${m?.left} ${m?.line}`);
check('22:59.6 reads 22:59, never 22:60', N.nearMiss({ unit: 'time', timeSec: 22 * 60 + 59.6, tiers, stars: 2 })?.left === 'YOUR TIME 22:59');
{
  // Every time from the line to 10 minutes over, in tenths: the gap is the
  // difference of the two times the panel shows (at least 1 s).
  const sec = (t) => { const [mm, x] = t.split(':').map(Number); return mm * 60 + x; };
  let bad = null;
  for (let t = 22 * 60; t <= 32 * 60 && !bad; t += 0.1) {
    const x = N.nearMiss({ unit: 'time', timeSec: t, tiers, stars: 2 });
    const shown = sec(x.left.replace('YOUR TIME ', '')), need = sec(x.right.replace('★★★ UNDER ', ''));
    const g = x.line.split(' off ')[0];
    const gap = g.endsWith(' s') ? Number(g.slice(0, -2)) : sec(g);
    if (gap !== Math.max(1, shown - need) || gap !== x.gapSec) bad = `${t.toFixed(1)}: ${x.left} · ${x.right} → ${x.line}`;
  }
  check('the gap always agrees with YOUR TIME and the tier as shown (22:00 to 32:00 in tenths)', !bad, bad || '');
}
check('3★ held: nothing left', N.nearMiss({ unit: 'time', timeSec: 2000, tiers, stars: 3 }) === null);
check('a time already under the next star: no gap', N.nearMiss({ unit: 'time', timeSec: 1200, tiers, stars: 2 }) === null);
check('no time, no tiers: no line', N.nearMiss({ unit: 'time', timeSec: null, tiers, stars: 1 }) === null && N.nearMiss({ unit: 'time', timeSec: 900, tiers: null, stars: 1 }) === null);
check('a stage with no star tiers (Demon Back) has none to chase', P.stageStarRule(A.getSeriesById('demon-back-protocol'), A.getSeriesById('demon-back-protocol').stages[0]).kind === 'none');

section('when the panel shows');
const cnt = N.nearMiss({ unit: 'rounds', done: 2, total: 3 });
check('partial and fail: yes', N.showsNearMiss(cnt, 'partial') && N.showsNearMiss(cnt, 'fail'));
check('a pass or a refused session: no', !N.showsNearMiss(cnt, 'pass') && !N.showsNearMiss(cnt, 'validation_failed') && !N.showsNearMiss(null, 'partial'));
check('a star gap on a clear: yes', N.showsNearMiss(N.nearMiss({ unit: 'time', timeSec: 1332, tiers, stars: 2 }), 'pass'));

section('retry safety');
check('a first try, the first session today: RETRY', eq(R.canRetryNow({ attemptsToday: 1, sessionsToday: 1 }), { allowed: true, reason: null, line: null }));
check('a boss: no RETRY, come back tomorrow', R.canRetryNow({ boss: true }).allowed === false && R.canRetryNow({ boss: 'boss' }).reason === 'boss' && /tomorrow/.test(R.canRetryNow({ boss: true }).line));
check('a saga\'s final stage, the title fight: their own line', R.canRetryNow({ boss: 'final' }).reason === 'final' && R.canRetryNow({ boss: 'title' }).line === 'That was the title fight. Come back fresh tomorrow.');
check('MAX OUT (max effort): no RETRY', R.canRetryNow({ maxEffort: true }).reason === 'max');
check('the second try at the same session today: no RETRY', R.canRetryNow({ attemptsToday: 2 }).reason === 'attempts');
check('the third finished session today: no RETRY', R.canRetryNow({ attemptsToday: 1, sessionsToday: 3 }).reason === 'load' && R.canRetryNow({ sessionsToday: 2 }).allowed);
check('a boss outranks the counts', R.canRetryNow({ boss: true, attemptsToday: 5, sessionsToday: 9 }).reason === 'boss');
const lines = ['boss', 'final', 'title'].map((b) => R.canRetryNow({ boss: b }).line).concat([R.canRetryNow({ maxEffort: true }).line, R.canRetryNow({ attemptsToday: 2 }).line, R.canRetryNow({ sessionsToday: 3 }).line]);
check('every line is plain and says when: "Come back fresh tomorrow."', lines.every((l) => /Come back fresh tomorrow\.$/.test(l) && l.length < 60), JSON.stringify(lines));

section('today\'s finished sessions (local day)');
const day = at(2026, 11, 23, 15);
const rowAt = (t, extra = {}) => ({ id: `r${t}`, type: 'Fight Focus', completedAt: new Date(t).toISOString(), completedCount: 3, totalCount: 3, xpEarned: 90, ...extra });
const rows = [
  rowAt(at(2026, 11, 23, 8)), rowAt(at(2026, 11, 23, 10)),
  rowAt(at(2026, 11, 22, 23, 30)), // yesterday, local
  rowAt(at(2026, 11, 23, 9), { type: 'Mission of the Day', tiers: { sessionMode: 'bonus' } }),
  rowAt(at(2026, 11, 23, 11), { unverified: true }),
  rowAt(at(2026, 11, 23, 12), { completedCount: 0, xpEarned: 0 }),
];
check('2 today: the bonus, refused and no-work rows and yesterday left out', R.sessionsOn(rows, day) === 2, R.sessionsOn(rows, day));
check('23:30 local yesterday is 04:30 UTC today, still yesterday', R.sessionsOn([rowAt(at(2026, 11, 22, 23, 30))], day) === 0);

section('today\'s tries log');
const key = R.timerRetryKey({ mode: 'Fight Focus', rounds: 3, roundMin: 3, difficulty: 'Normal' }, 'Boxing');
let log = R.withTry(null, key, day);
check('one try logged today', log.day === '2026-11-23' && R.triesOn(log, key, day) === 1);
log = R.withTry(log, key, day);
check('two tries', R.triesOn(log, key, day) === 2);
check('tomorrow the log counts nothing', R.triesOn(log, key, at(2026, 11, 24, 7)) === 0);
check('the next write tomorrow drops yesterday', eq(R.withTry(log, key, at(2026, 11, 24, 7)), { day: '2026-11-24', tries: { [key]: 1 } }));

section('the same stage or session');
const ff = { mode: 'Fight Focus', rounds: 3, roundMin: 3, difficulty: 'Normal' };
check('the same timer cfg → the same key', R.timerRetryKey({ ...ff }, 'Boxing') === R.timerRetryKey(ff, 'Boxing'));
check('more rounds, another discipline, Just Train, Combo → other keys', new Set([R.timerRetryKey(ff, 'Boxing'), R.timerRetryKey({ ...ff, rounds: 4 }, 'Boxing'), R.timerRetryKey(ff, 'Muay Thai'), R.timerRetryKey({ ...ff, mode: 'Just Train' }, 'Boxing'), R.timerRetryKey({ ...ff, mode: 'Combo Coach' }, 'Boxing')]).size === 5);
check('a concept stage keys on its concept, arc and stage', R.timerRetryKey({ ...ff, conceptId: 'one-hundred', conceptArc: 'fit', conceptStage: 2 }) === 'concept|one-hundred|fit|2');
check('arcade, camp, QM, CC and Fit keys', R.arcadeRetryKey('grappler-protocol', 'ARC_GRAPPLER_STG02') === 'arcade|grappler-protocol|arc_grappler_stg02'
  && R.campRetryKey('Boxing', 5) === 'camp|boxing|5|s1' && R.campRetryKey('Boxing', 5, 's2') !== R.campRetryKey('Boxing', 5)
  && R.quickMissionRetryKey({ title: 'Iron Hour', difficulty: 'normal', rounds: 3 }) === 'qm|iron hour|normal|3'
  && R.quickMissionRetryKey({ id: 'generated', title: 'Iron Hour', difficulty: 'normal', rounds: 3 }) !== R.quickMissionRetryKey({ id: 'generated', title: 'Steel Ten', difficulty: 'normal', rounds: 3 })
  && R.combatRetryKey({ missionName: 'Pressure', style: 'Boxing', difficulty: 'Hard' }) === 'cc|pressure|boxing|hard'
  && R.fitRetryKey({ muscleGroups: ['Chest', 'Back'], equipment: 'Bodyweight', difficulty: 'Beginner' }) === 'fit|chest+back|bodyweight|beginner');

section('the store: an end screen settles once');
store.clear();
const now0 = Date.now();
const today = (h) => { const d = new Date(now0); d.setHours(h, 0, 0, 0); return d.toISOString(); };
setStats({ xp: 300, sessions: [{ id: 'a', type: 'Fight Focus', completedAt: today(0), completedCount: 2, totalCount: 3, xpEarned: 40 }] });
const facts = { key, unit: 'rounds', done: 2, total: 3, outcome: 'partial' };
const tok1 = {};
let st = S.settleNearMiss({ ...facts, token: tok1 });
check('first try: 1 of 1, RETRY offered, the gap shown', st.gate.allowed && st.gate.attemptsToday === 1 && st.show && st.miss.line === '1 round to go', JSON.stringify(st.gate));
S.noteAttempt(st); S.noteAttempt(st);
check('noted once however often the screen renders', R.triesOn(S.loadRetryLog(), key) === 1);
check('… and settling it again counts it once', S.settleNearMiss({ ...facts, token: tok1 }).gate.attemptsToday === 1);
st = S.settleNearMiss({ ...facts, token: {} });
check('the retry\'s own end (a new result): 2 tries, no RETRY', !st.gate.allowed && st.gate.reason === 'attempts' && st.gate.attemptsToday === 2);
const other = S.settleNearMiss({ ...facts, key: R.timerRetryKey({ ...ff, rounds: 5 }, 'Boxing'), token: {} });
check('another session today still gets its RETRY', other.gate.allowed);
setStats({ xp: 300, sessions: [0, 0, 0].map((_, i) => ({ id: `s${i}`, type: 'Fight Focus', completedAt: today(0), completedCount: 3, totalCount: 3, xpEarned: 90 })) });
check('3 finished sessions today: no RETRY', S.settleNearMiss({ ...facts, key: 'fight|x', token: {} }).gate.reason === 'load');
check('a boss end: no RETRY whatever the counts', S.settleNearMiss({ ...facts, key: 'arcade|y', boss: 'boss', token: {} }).gate.reason === 'boss');
check('a pass is settled (its try logged) but shows no panel', S.settleNearMiss({ ...facts, key: 'fight|z', done: 3, outcome: 'pass', token: {} }).show === false);
check('no key: nothing settled', S.settleNearMiss({ unit: 'rounds', done: 1, total: 2 }) === null);

section('only a finished, valid session is a try (review fix)');
store.clear();
setStats({ xp: 300, sessions: [] });
const rk = 'fight|refused';
let rs = S.settleNearMiss({ key: rk, unit: 'rounds', done: 2, total: 3, outcome: 'validation_failed', token: {} });
check('a refused session (validation_failed): not a try, no panel', rs.counts === false && rs.gate.attemptsToday === 0 && rs.show === false, JSON.stringify(rs.gate));
S.noteAttempt(rs);
check('… and nothing logged', R.triesOn(S.loadRetryLog(), rk) === 0 && !store.has(S.RETRY_LOG_KEY));
rs = S.settleNearMiss({ key: rk, unit: 'rounds', done: 2, total: 3, outcome: 'partial', token: {} });
check('the next honest partial is the first go: RETRY offered', rs.counts === true && rs.gate.attemptsToday === 1 && rs.gate.allowed && rs.show);
const rz = S.settleNearMiss({ key: 'fight|zero', unit: 'rounds', done: 0, total: 3, outcome: 'fail', token: {} });
S.noteAttempt(rz);
check('a session ended with nothing done: not a try, nothing logged', rz.counts === false && R.triesOn(S.loadRetryLog(), 'fight|zero') === 0);

section('a session ended with nothing done: the panel, still no try (owner 2026-11-23)');
check('the SESSION ENDED card shows the panel: 3 ROUNDS TO GO, RETRY offered on a first go', rz.show === true && rz.miss?.line === '3 rounds to go'
  && rz.gate.allowed === true && rz.gate.attemptsToday === 0, JSON.stringify({ show: rz.show, gate: rz.gate }));
{
  const zk = 'fight|zero2';
  const z = () => S.settleNearMiss({ key: zk, unit: 'rounds', done: 0, total: 3, outcome: 'fail', token: {} });
  for (let i = 0; i < 4; i++) S.noteAttempt(z());
  check('ending with nothing done again and again logs no try: RETRY still offered', R.triesOn(S.loadRetryLog(), zk) === 0 && z().gate.allowed);
  S.noteAttempt(S.settleNearMiss({ key: zk, unit: 'rounds', done: 2, total: 3, outcome: 'partial', token: {} }));
  S.noteAttempt(S.settleNearMiss({ key: zk, unit: 'rounds', done: 1, total: 3, outcome: 'partial', token: {} }));
  const after = z();
  check('… but after two real goes at it today: no RETRY, "Two goes at this one today", the way out only', after.show && after.gate.allowed === false && after.gate.reason === 'attempts' && after.gate.attemptsToday === 2, JSON.stringify(after.gate));
  check('… a boss stage ended with nothing done: no RETRY', S.settleNearMiss({ key: 'arcade|zboss', boss: 'boss', unit: 'rounds', done: 0, total: 6, outcome: 'fail', token: {} }).gate.reason === 'boss');
  check('… MAX OUT with no set done: no RETRY', S.settleNearMiss({ key: 'qm|zmax', maxEffort: true, unit: 'sets', done: 0, total: 5, outcome: 'fail', token: {} }).gate.reason === 'max');
  const zs = Array.from({ length: 3 }, (_, i) => ({ id: `z${i}`, type: 'Fight Focus', completedAt: today(0), completedCount: 3, totalCount: 3, xpEarned: 90 }));
  setStats({ xp: 300, sessions: [...zs, { id: 'z-none', type: 'Fight Focus', completedAt: today(0), completedCount: 0, totalCount: 3, xpEarned: 0 }] });
  const z3 = S.settleNearMiss({ key: 'fight|zload', unit: 'rounds', done: 0, total: 3, outcome: 'fail', token: {} });
  check('… after three finished sessions today: no RETRY (the nothing-done row is not a session)', z3.gate.reason === 'load' && z3.gate.sessionsToday === 3, JSON.stringify(z3.gate));
  setStats({ xp: 300, sessions: [{ id: 'z-only', type: 'Fight Focus', completedAt: today(0), completedCount: 0, totalCount: 3, xpEarned: 0 }] });
  check('… a refused session with nothing done: no panel', S.settleNearMiss({ key: 'fight|zref', unit: 'rounds', done: 0, total: 3, outcome: 'validation_failed', token: {} }).show === false);
  check('… a pass never shows it', N.showsNearMiss(N.nearMiss({ unit: 'rounds', done: 0, total: 3 }), 'pass') === false);
}
{
  // The classic overlay: a benchmark (One Hundred's stage 1) ended before its first exercise was tested.
  const OPz = A.getSeriesById('one-punch-protocol');
  const cz = S.classicNearMiss(OPz, OPz.stages[0], { invalid: false, completedTasks: 0, totalTasks: 3 });
  check('the classic overlay with nothing done: the panel (3 exercises to go), no try', cz.show && cz.counts === false && cz.miss.line === '3 exercises to go' && cz.miss.nothing, cz?.miss?.line);
  check('… a classic result with no counts at all still shows none (never a made-up number)', S.classicNearMiss(OPz, OPz.stages[0], { invalid: false, partial: true }).show === false);
}
check('countsAsTry: a pass, a partial, a time clear and a count-less end count; refused or 0 done do not',
  R.countsAsTry({ outcome: 'pass', unit: 'rounds', done: 3 }) && R.countsAsTry({ outcome: 'partial', unit: 'exercises', done: 1 })
  && R.countsAsTry({ outcome: 'pass', unit: 'time' }) && R.countsAsTry({ outcome: 'partial' })
  && !R.countsAsTry({ outcome: 'validation_failed', unit: 'rounds', done: 3 }) && !R.countsAsTry({ outcome: 'fail', unit: 'tasks', done: 0 }));
const OPs = A.getSeriesById('one-punch-protocol');
const inv = S.classicNearMiss(OPs, OPs.stages[1], { invalid: true, reason: 'x', completedTasks: 2, totalTasks: 3 });
S.noteAttempt(inv);
check('the classic overlay\'s refused run: not a try, nothing logged', inv.counts === false && inv.show === false
  && R.triesOn(S.loadRetryLog(), R.arcadeRetryKey(OPs.id, OPs.stages[1].id)) === 0);
const part = S.classicNearMiss(OPs, OPs.stages[0], { invalid: false, completedTasks: 2, totalTasks: 3 });
check('… its partial is a try (outcome partial)', part.counts === true && part.show && part.gate.attemptsToday === 1);
check('the log key is in cloud sync', (await import('../components/training-mode/data/cloudSync.js')).SYNC_KEYS.includes(S.RETRY_LOG_KEY));

section('what a stage was');
check('One Hundred stage 10 is the boss; stage 2 is not', S.classicStageBoss(OP, OP.stages[9]) === 'boss' && S.classicStageBoss(OP, OP.stages[1]) === false);
const grap = CAMPAIGN_SERIES.find((s) => s.id === 'grappler-protocol');
const grapBoss = grap.stages.find((s) => s.isBoss);
check('a v2 campaign\'s boss stage (The Grappler, stage 10)', S.arcadeStageBoss(grap.v2Campaign, grapBoss.id, grap) === 'boss' && grapBoss.stageNumber === 10);
check('… its stage 2 is not', S.arcadeStageBoss(grap.v2Campaign, grap.stages[1].id, grap) === false);
const entry = CI.CONCEPT_SCHEDULE.find((e) => CI.arcStages(e.concept, 'hybrid').some((s) => s.boss));
const cStages = CI.arcStages(entry.concept, 'hybrid');
const bossIdx = cStages.findIndex((s) => s.boss);
check('a concept saga\'s boss stage, from its cfg', S.conceptStageBoss({ conceptId: entry.concept.id, conceptArc: 'hybrid', conceptStage: bossIdx }) === 'boss');
check('… its first stage is not; a plain Fight Focus cfg is not', S.conceptStageBoss({ conceptId: entry.concept.id, conceptArc: 'hybrid', conceptStage: 0 }) === false && S.conceptStageBoss({ mode: 'Fight Focus' }) === false);

section('camp: RETRY opens the map on that level');
S.requestCampRetry(5);
check('taken once', S.takeCampRetry() === 5 && S.takeCampRetry() === null);

section('the switch');
store.clear();
check('off for everyone', F.retentionOn('nearMiss') === false);
store.set('tm_owner_preview', '1');
check('on with the owner preview', F.retentionOn('nearMiss') === true);

section('pure parts write nothing');
const w0 = writes;
N.nearMiss({ unit: 'rounds', done: 1, total: 2 }); R.canRetryNow({}); R.sessionsOn(rows, day); R.withTry(null, 'k'); O.arcadeOverlayOutcome(fixed);
S.settleNearMiss({ ...facts, token: {} });
check('nearMiss, canRetryNow, the outcome and a settle write nothing', writes === w0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

// Training Camp stars and the camp's health check (the owner's answers,
// 2026-11-23): the star rule from the session rows (★ the clear, ★★ every
// round done and verified, ★★★ the camp's way: no round cut short, and on a
// split level Session 2 four to eight hours after Session 1), older clears at
// one star, the best run kept, a replay's Session 1 waiting for its Session 2
// (eight hours at most, then a replay starts again at Session 1), the replay
// card's tiles and line, the lines that say what the next star needs, the path's nodes with stars,
// the end screen's row, the row a camp session banks, the timers' cut-round
// carry, and the health check asked the first time and after a 30-day break
// (never re-asked for an athlete who flagged a yes).
// Run with `npm run test:camp`.
const store = new Map();
const ls = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
globalThis.localStorage = ls;
globalThis.window = { localStorage: ls, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } };
globalThis.Event = globalThis.Event || class { constructor(t) { this.type = t; } };

const S = await import('../components/training-mode/data/campStars.js');
const P = await import('../components/training-mode/data/pathStars.js');
const N = await import('../components/training-mode/data/pathNextUp.js');
const Q = await import('../components/training-mode/data/parq.js');
const U = await import('../components/training-mode/data/userStats.js');
const { readCarry } = await import('../components/training-mode/data/fightResume.js');
const { SCREEN_GUIDES } = await import('../components/training-mode/shared/screenGuides.js');
const { campLevels } = await import('../components/training-mode/protocol/content.ts');

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}  ${extra}`); } };
const section = (t) => console.log(`\n${t}`);

const H = 3600000;
const T0 = new Date(2026, 10, 16, 8, 0, 0).getTime(); // a Monday, 08:00 local
const at = (h) => new Date(T0 + h * H).toISOString();
let n = 0;
// A camp row as App banks it: `endH` hours after T0, `lenMin` long.
const camp = (level, slot, endH, { cut = 0, verified = true, done = 6, total = 6, lenMin = 30, startH } = {}) => ({
  id: `c${++n}`, type: 'Training Camp', completedAt: at(endH), completedCount: done, totalCount: total, xpEarned: 120, campLevel: level,
  camp: { slot, verified, cut, startedAt: at(startH ?? endH - lenMin / 60) },
});
const old = (level, endH) => ({ id: `o${++n}`, type: 'Training Camp', completedAt: at(endH), completedCount: 6, totalCount: 6, xpEarned: 120, campLevel: level });
const stars = (level, kind, rows, cleared = true) => S.campLevelStars({ level, kind, cleared, rows }).stars;

section('kinds from the camp\'s own level data');
check('levels 1-3 single, 4-11 split, 12 the title', campLevels.every((lv) => S.campKind(lv) === (lv.level <= 3 ? 'single' : lv.level <= 11 ? 'split' : 'title')));

section('which rows count');
const mixed = [old(2, 1), camp(2, 'one', 2), { ...camp(2, 'one', 3), type: 'Fight Focus' }, camp(3, 'one', 4), { ...camp(2, 'one', 5), camp: null }];
check('only Training Camp rows of the level with `camp`, oldest first', S.campRowsOf(mixed, 2).map((r) => r.id).join() === mixed[1].id);
const tie = [camp(5, 's2', 10, { startH: 9 }), camp(5, 's1', 10, { startH: 9 })];
tie[0].completedAt = tie[1].completedAt;
check('rows banked at the same moment keep the order they were banked in', S.campRowsOf(tie, 5)[0].camp.slot === 's2');

section('single levels (1-3) and the title fight');
check('not cleared: no stars, whatever the rows say', stars(1, 'single', [camp(1, 'one', 1)], false) === 0);
check('an older clear (no row says how): one star', stars(1, 'single', [old(1, 1)]) === 1);
check('an arcade v2 stage\'s row (same type, no `camp`) adds nothing', stars(2, 'single', [old(2, 1), old(2, 2)]) === 1);
check('every round done and verified, one cut short: two', stars(1, 'single', [camp(1, 'one', 1, { cut: 1 })]) === 2);
check('every round to the bell: three', stars(1, 'single', [camp(1, 'one', 1)]) === 3);
check('a cut count not on record is not clean: two', stars(1, 'single', [camp(1, 'one', 1, { cut: null })]) === 2);
check('not verified: the clear alone', stars(1, 'single', [camp(1, 'one', 1, { verified: false })]) === 1);
check('a stopped session (4 of 6) is no run', stars(1, 'single', [camp(1, 'one', 1, { done: 4 })]) === 1);
check('a run on the wrong slot does not count', stars(1, 'single', [camp(1, 's1', 1)]) === 1);
check('the best run is kept (3 then 2)', stars(3, 'single', [camp(3, 'one', 1), camp(3, 'one', 30, { cut: 2 })]) === 3);
check('… and (2 then 3)', stars(3, 'single', [camp(3, 'one', 1, { cut: 2 }), camp(3, 'one', 30)]) === 3);
check('the title fight to the bell: three', stars(12, 'title', [camp(12, 'one', 1)]) === 3);
check('the title fight with a round cut short: two', stars(12, 'title', [camp(12, 'one', 1, { cut: 1 })]) === 2);

section('split levels (4-11): Session 2 four to eight hours after Session 1');
const split = (gapH, o1 = {}, o2 = {}) => [camp(6, 's1', 1, o1), camp(6, 's2', 1 + gapH + 0.5, { startH: 1 + gapH, ...o2 })];
check('5 h apart, both to the bell: three', stars(6, 'split', split(5)) === 3);
check('exactly 4 h: three', stars(6, 'split', split(4)) === 3);
check('exactly 8 h: three', stars(6, 'split', split(8)) === 3);
check('3 h 59 min: two', stars(6, 'split', split(4 - 1 / 60)) === 2);
check('8 h 1 min: two', stars(6, 'split', split(8 + 1 / 60)) === 2);
check('the next day: two', stars(6, 'split', split(24)) === 2);
check('the gap is from S1\'s end to S2\'s start (S2 ended 8 h 20 min after S1, started 7 h 50 min after): three',
  stars(6, 'split', [camp(6, 's1', 1), camp(6, 's2', 1 + 8 + 1 / 3, { startH: 1 + 7 + 5 / 6 })]) === 3);
check('on time, a round of S1 cut short: two', stars(6, 'split', split(5, { cut: 1 })) === 2);
check('on time, a round of S2 cut short: two', stars(6, 'split', split(5, {}, { cut: 1 })) === 2);
check('S2 not verified: no run (the clear)', stars(6, 'split', split(5, {}, { verified: false })) === 1);
check('S2 with no S1 on record (S1 before this build): the clear', stars(6, 'split', [old(6, 1), camp(6, 's2', 6)]) === 1);
const full = [camp(7, 's1', 1, { startH: 0 }), camp(7, 's2', 1, { startH: 0 })];
check('a FULL CAMP sitting (both blocks at once): two', stars(7, 'split', full) === 2);
check('one Session 1 pairs with one Session 2 (a second S2 alone adds no run)',
  S.campRuns('split', S.campRowsOf([camp(8, 's1', 1), camp(8, 's2', 6, { startH: 5.5 }), camp(8, 's2', 40, { startH: 39.5 })], 8)).length === 1);
check('the latest S1 before the S2 is its pair', stars(8, 'split', [camp(8, 's1', 1), camp(8, 's1', 20), camp(8, 's2', 25.5, { startH: 25 })]) === 3);
check('a stopped S1 does not pair', stars(8, 'split', [camp(8, 's1', 1, { done: 2 }), camp(8, 's2', 6, { startH: 5.5 })]) === 1);

section('a run under way, and which session a replay runs');
// `now` for a Session 1 that ended at T0 + 1 h: `h` hours after it ended.
const after = (h) => T0 + H + h * H;
check('no rows: a replay starts at Session 1', S.campReplaySlot(9, [], after(1)) === 's1');
check('S1 replayed an hour ago: Session 2 next', S.campReplaySlot(9, [camp(9, 's1', 1)], after(1)) === 's2');
check('S1 then S2: Session 1 again', S.campReplaySlot(9, [camp(9, 's1', 1), camp(9, 's2', 6, { startH: 5.5 })], after(6)) === 's1');
check('a stopped S1 is no S1: Session 1 again', S.campReplaySlot(9, [camp(9, 's1', 1, { done: 3 })], after(1)) === 's1');
check('an older S2 row (no `camp`) does not end the run', S.campReplaySlot(9, [camp(9, 's1', 1), old(9, 3)], after(3)) === 's2');
const pend = S.campLevelStars({ level: 9, kind: 'split', cleared: true, rows: [camp(9, 's1', 1)], now: after(2) }).pending;
check('the waiting Session 1: when it ended, and clean', pend && pend.endedAt === T0 + H && pend.clean === true);

section('a replayed Session 1 waits eight hours, no longer');
const lone = [camp(9, 's1', 1)];
check('exactly 8 h after it ended: still Session 2 (8:00 counts)', S.campReplaySlot(9, lone, after(8)) === 's2');
check('8 h 1 min after: the run has lapsed, Session 1 again', S.campReplaySlot(9, lone, after(8 + 1 / 60)) === 's1');
check('weeks later: Session 1 again', S.campReplaySlot(9, lone, after(24 * 21)) === 's1');
check('no clock given: today\'s (a Session 1 from 2026-11-16 has lapsed by now)', S.campReplaySlot(9, lone) === 's1');
check('pendingSession1 on its own: the same rule', S.pendingSession1(S.campRowsOf(lone, 9), after(8)) !== null
  && S.pendingSession1(S.campRowsOf(lone, 9), after(9)) === null);
const lapsed = S.campLevelStars({ level: 6, kind: 'split', cleared: true, rows: [...split(24), camp(6, 's1', 60)], now: T0 + 60 * H + 9 * H });
check('campLevelStars: a lapsed Session 1 is not pending; the stars stay the best run\'s', lapsed.pending === null && lapsed.stars === 2);
check('the replay sheet\'s line after it lapsed: the third star\'s need again, not "Session 1 replayed"',
  S.campNextStarLine(lapsed) === 'Third star: Session 2 four to eight hours after Session 1, no round cut short.');
check('the end screen\'s line uses the same rule', S.campEndStars(lapsed, { justS1: true })?.line === 'Next star: Session 2 four to eight hours after Session 1, no round cut short.');
const fresh = [...split(24), camp(6, 's1', 60), camp(6, 's1', 200), camp(6, 's2', 205.5, { startH: 205 })];
check('a lapsed S1, then a new S1 and S2 on time: three', S.campLevelStars({ level: 6, kind: 'split', cleared: true, rows: fresh, now: T0 + 206 * H }).stars === 3);

section('the level card on a replay (switch `path`)');
const c1 = S.campReplayCard('s1');
check('Session 1 next: S1 up next, S2 after it, the line says how a replay runs',
  c1.s1 === 'next' && c1.s2 === 'later' && c1.line === 'Replay: Session 1, then Session 2 four to eight hours later, for the stars.');
const c2 = S.campReplayCard('s2');
check('Session 2 next: S1 replayed, S2 up next', c2.s1 === 'done' && c2.s2 === 'next' && c2.line === 'Replay: Session 2 four to eight hours after Session 1, for the stars.');
const cf = S.campReplayCard('s1', { full: true });
check('FULL CAMP picked: both blocks at once, two stars at most', cf.s1 === 'next' && /two stars at most/.test(cf.line));
check('no card line says "unlocks" or "level clears"', [c1, c2, cf].every((c) => !/unlocks|level clears/i.test(c.line)));
check('each card line short enough for two lines at 360 px', [c1, c2, cf].every((c) => c.line.length <= 80), [c1, c2, cf].map((c) => c.line.length).join());

section('the path\'s nodes');
const rows = [camp(1, 'one', 1), camp(2, 'one', 30, { cut: 1 }), old(3, 40), camp(4, 's1', 50), camp(4, 's2', 56, { startH: 55 })];
const map = S.campStarsMap({ levels: campLevels, current: 5, rows });
check('cleared levels only, from the rows: 3, 2, 1 (older), 3', JSON.stringify(map) === JSON.stringify({ 1: 3, 2: 2, 3: 1, 4: 3 }), JSON.stringify(map));
check('the title won: every level counts as cleared', Object.keys(S.campStarsMap({ levels: campLevels, current: 12, campDone: true, rows: [] })).length === 12);
let cp = P.campPath({ levels: campLevels, current: 5, sessions: { 4: { s1: true, s2: true }, 5: { s1: true } }, stars: map });
const nodeAt = (lv) => cp.nodes.find((x) => x.number === lv);
check('a cleared node shows its stars of 3, no check', nodeAt(1).stars === 3 && nodeAt(1).max === 3 && !nodeAt(1).check && nodeAt(3).stars === 1);
check('a cleared split level drops its pips (both sessions done), the current keeps them', nodeAt(4).pips === null && nodeAt(5).pips?.s1 === true && nodeAt(5).pips?.s2 === false);
check('current and locked levels: no stars', nodeAt(5).stars === 0 && nodeAt(6).stars === 0 && nodeAt(6).pips?.s1 === false);
check('the totals: 9 earned of 36', cp.earned === 9 && cp.total === 36 && cp.hasStars);
cp = P.campPath({ levels: campLevels, current: 5, sessions: { 5: { s1: true } } });
check('without stars: a check and the pips, as before', cp.nodes[3].check === true && cp.nodes[3].stars === null && cp.nodes[3].pips?.s1 === true && !cp.hasStars);

section('what the next star needs');
const info = (level, kind, rws, cleared = true) => S.campLevelStars({ level, kind, cleared, rows: rws });
check('older clear: says so, and the second star', S.campNextStarLine(info(3, 'single', [old(3, 1)])) === 'Cleared before camp stars were kept. Second star: every round done and verified.');
check('split, two: the gap and no cut', S.campNextStarLine(info(6, 'split', split(24))) === 'Third star: Session 2 four to eight hours after Session 1, no round cut short.');
check('single, two: to the bell', S.campNextStarLine(info(1, 'single', [camp(1, 'one', 1, { cut: 1 })])) === 'Third star: every round to the bell, none cut short.');
check('three: all three', S.campNextStarLine(info(1, 'single', [camp(1, 'one', 1)])) === 'All three stars. Replays keep your best.');
const infoAt = (level, kind, rws, now) => S.campLevelStars({ level, kind, cleared: true, rows: rws, now });
check('a clean Session 1 replayed: when Session 2 counts', /^Session 1 replayed: Session 2 four to eight hours after it/.test(S.campNextStarLine(infoAt(6, 'split', [...split(24), camp(6, 's1', 60)], T0 + 61 * H))));
check('not cleared: no line', S.campNextStarLine(info(6, 'split', [], false)) === '');
check('the end screen: all three', S.campEndStars(info(1, 'single', [camp(1, 'one', 1)]))?.line === 'All three stars.');
check('the end screen: the next star', S.campEndStars(info(6, 'split', split(24)))?.line === 'Next star: Session 2 four to eight hours after Session 1, no round cut short.');
check('the end screen after a clean Session 1 replay: from now', /^Session 2 four to eight hours from now/.test(S.campEndStars(infoAt(6, 'split', [...split(24), camp(6, 's1', 60)], T0 + 60 * H), { justS1: true })?.line || ''));
check('the end screen on a level not cleared: nothing', S.campEndStars(info(6, 'split', [], false)) === null);
const lines = [S.campNextStarLine(info(3, 'single', [old(3, 1)])), S.campNextStarLine(info(6, 'split', split(24)))];
check('each line short enough for two lines at 360 px', lines.every((l) => l.length <= 100), lines.map((l) => l.length).join());

section('the row a camp session banks (userStats.addCampSession)');
store.clear();
U.addCampSession(6, 6, 6, 140, { camp: { slot: 's1', verified: true, cut: 0, startedAt: at(0) } });
U.addCampSession(2, 3, 6, 40);
const banked = U.loadStats().sessions;
check('the camp fields ride on the row; the XP is as given', banked[0].campLevel === 6 && banked[0].camp?.slot === 's1' && banked[0].camp.cut === 0 && banked[0].xpEarned === 140);
check('without them (an arcade v2 stage), the row is as before', banked[1].camp === undefined && banked[1].campLevel === 2);

section('the camp end screen\'s row (pathNextUp.campSessionEndStars, the real stores)');
store.clear();
store.set('tm_camp_progress', '7');
const endRows = [camp(6, 's1', 1), camp(6, 's2', 6.5, { startH: 6 })];
check('a valid session on a cleared level: its stars and line', N.campSessionEndStars({ level: 6, sessionValid: true, slot: 's2' }, endRows)?.stars === 3);
check('a replayed Session 1: the line says when Session 2 counts', /from now/.test(N.campSessionEndStars({ level: 6, sessionValid: true, replayS1: true }, [...endRows.slice(0, 1), { ...endRows[1], camp: { ...endRows[1].camp, cut: 2 } }, camp(6, 's1', 40)], T0 + 40 * H)?.line || ''));
check('the current level (not cleared): no row', N.campSessionEndStars({ level: 7, sessionValid: true }, endRows) === null);
check('a stopped session: no row', N.campSessionEndStars({ level: 6, sessionValid: false }, endRows) === null);
check('an arcade stage: no row', N.campSessionEndStars({ arcade: true, level: 6, sessionValid: true }, endRows) === null);
check('reads the real rows when none are given', N.campSessionEndStars({ level: 6, sessionValid: true }) ?.stars === 1);

section('a restored round timer keeps its cut rounds');
check('the carry keeps the count, clamped to the rounds', readCarry({ cut: 2 }, 6).cut === 2 && readCarry({ cut: 99 }, 6).cut === 6 && readCarry(undefined, 6).cut === 0);

section('the guide');
const g = SCREEN_GUIDES.training_camp_stars;
check('the camp\'s guide with stars: the same steps, then LEVEL STARS', g.length === SCREEN_GUIDES.training_camp.length + 1 && g.at(-1).title === '★ LEVEL STARS' && g.at(-1).target === null);

section('the health check: the first time and after a long break');
const NOW = new Date(2026, 10, 19, 10, 0, 0).getTime();
const DAY = 86400000;
const fight = (daysAgo) => ({ id: `f${++n}`, type: 'Fight Focus', completedAt: new Date(NOW - daysAgo * DAY).toISOString(), completedCount: 3, totalCount: 3, xpEarned: 90 });
const taken = (daysAgo, anyYes = false) => ({ done: true, anyYes, ts: NOW - daysAgo * DAY });
check('never taken: asked ("first")', Q.parqDue({ done: false }, [], NOW) === 'first');
check('taken today: not asked', Q.parqDue(taken(0), [fight(1)], NOW) === null);
check('last training 29 days ago, check 200 days ago: not asked', Q.parqDue(taken(200), [fight(29)], NOW) === null);
check('last training 30 days ago (the RUSTY line): asked again ("break")', Q.parqDue(taken(200), [fight(30)], NOW) === 'break');
check('the threshold is RUSTY\'s', Q.PARQ_BREAK_DAYS === 30);
check('trained long ago, but the check itself is 10 days old: not asked', Q.parqDue(taken(10), [fight(90)], NOW) === null);
check('never trained, check 31 days old: asked again', Q.parqDue(taken(31), [], NOW) === 'break');
check('a flagged yes: never re-asked, even after a year away', Q.parqDue(taken(400, true), [fight(365)], NOW) === null);
check('no date at all to measure from: not asked', Q.parqDue({ done: true, anyYes: false }, [], NOW) === null);
const bonus = { ...fight(2), type: 'Mission of the Day' };
check('a bonus row is no training day (the week streak\'s rule)', Q.parqDue(taken(200), [fight(45), bonus], NOW) === 'break');
const late = new Date(NOW - 30 * DAY); late.setHours(23, 50, 0, 0);
check('local calendar days: 30 days ago at 23:50 is 30 days', Q.parqDue(taken(200), [{ ...fight(0), completedAt: late.toISOString() }], NOW) === 'break');

{
  // The owner (2026-11-23): everything new stays on their phone until January.
  // The re-ask after a long break is new, so only the owner preview (switch
  // `path`) gets it; everyone else keeps the one first ask.
  const fs = await import('node:fs');
  const map = fs.readFileSync(new URL('../components/training-mode/TrainingCampMap.jsx', import.meta.url), 'utf8');
  check('the re-ask after a long break is owner-only (switch path); the first ask is for everyone',
    /due === 'break' && !retentionOn\('path'\) \? null : due/.test(map));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

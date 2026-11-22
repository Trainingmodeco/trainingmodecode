// The weekly streak, freezes and the daily mission (retention feature 1):
// week boundaries (Monday to Sunday, local), Sunday/Monday edges, time zones
// (a row near midnight UTC in a zone that is not UTC), target changes from
// next Monday, freeze use and earn, at most 2, carry-over of a real history,
// a row synced in late, award rows and no-work rows left out, the end-screen
// and Home moments, and the daily mission's deal and one-time bonus.
// Run with `npm run test:streak`.
const store = new Map();
let failWrites = false;
const ls = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { if (failWrites) throw new Error('quota'); store.set(k, String(v)); },
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
globalThis.localStorage = ls;
globalThis.window = { localStorage: ls, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } };
globalThis.Event = globalThis.Event || class { constructor(t) { this.type = t; } };

process.env.TZ = 'America/New_York';

const W = await import('../components/training-mode/data/weekStreak.js');
const D = await import('../components/training-mode/data/dailyMission.js');
const S = await import('../components/training-mode/data/weekStreakStore.js');
const U = await import('../components/training-mode/data/userStats.js');
const { SYNC_KEYS } = await import('../components/training-mode/data/cloudSync.js');

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}  ${extra}`); } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// A local wall-clock time in the current TZ, as a Date.
const at = (iso, hh = 12, mm = 0) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d, hh, mm); };
let n = 0;
const row = (iso, hh = 12, extra = {}) => ({ id: `r${++n}`, type: 'Fight Focus', completedAt: at(iso, hh).toISOString(), completedCount: 3, totalCount: 3, xpEarned: 80, ...extra });
// Training on the given weekdays (0 = Monday) of the week that starts `monday`.
const week = (monday, idxs, extra) => idxs.map((i) => row(W.addDaysIso(monday, i), 12, extra));
const T4 = { target: 4, targets: [] };

// Reference weeks (Mondays), oldest first; M[7] is the week of NOW.
const M = ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23'];

// ── dates ─────────────────────────────────────────────────────────────────
check('Monday is weekday 0, Sunday 6', W.weekdayIndex('2026-11-23') === 0 && W.weekdayIndex('2026-11-29') === 6);
check('week of a Sunday starts the Monday before', W.weekStartIso('2026-11-29') === '2026-11-23');
check('week of a Monday is itself', W.weekStartIso('2026-11-23') === '2026-11-23');
check('across a month and a year', W.weekStartIso('2027-01-01') === '2026-12-28' && W.addDaysIso('2026-12-31', 1) === '2027-01-01');
check('a DST change does not move a day', W.addDaysIso('2026-11-01', 1) === '2026-11-02' && W.addDaysIso('2026-03-08', 1) === '2026-03-09');
check('clamp: 7 reads 6, 1 reads 2, junk reads 4', W.clampTarget(7) === 6 && W.clampTarget(1) === 2 && W.clampTarget('x') === 4);

// ── what counts ───────────────────────────────────────────────────────────
check('a finished session counts', W.isTrainingRow(row('2026-11-20')));
check('Mission of the Day row is left out', !W.isTrainingRow(row('2026-11-20', 12, { type: 'Mission of the Day', completedCount: 1, xpEarned: 25 })));
check('Hybrid bonus and Start Here rows are left out', !W.isTrainingRow(row('2026-11-20', 12, { type: 'Hybrid Training Bonus' })) && !W.isTrainingRow(row('2026-11-20', 12, { type: 'Start Here' })));
check('a 0-round END is left out', !W.isTrainingRow(row('2026-11-20', 12, { completedCount: 0, xpEarned: 0 })));
check('a refused (validation_failed) session is left out', !W.isTrainingRow(row('2026-11-20', 12, { unverified: true, xpEarned: 0 })));
check('a quit that paid nothing is left out', !W.isTrainingRow(row('2026-11-20', 12, { type: 'Quick Mission', completedCount: 2, xpEarned: 0 })));
check('a tape not cleared is left out', !W.isTrainingRow(row('2026-11-20', 12, { type: "Coach's Tapes", kind: 'fit', completedCount: 0, xpEarned: 0 })));
check('a run with no time and no distance is left out', !W.isTrainingRow(row('2026-11-20', 12, { type: 'Cardio', completedCount: 1, xpEarned: 20, completedTimeSeconds: 0, completedDistance: null })));
check('a logged run counts', W.isTrainingRow(row('2026-11-20', 12, { type: 'Cardio', completedCount: 1, xpEarned: 120, completedTimeSeconds: 1200 })));
check('junk rows are left out', !W.isTrainingRow(null) && !W.isTrainingRow({}) && !W.isTrainingRow({ type: 'Fight Focus', completedAt: 'not a date', completedCount: 1, xpEarned: 1 }));

// ── the replay ────────────────────────────────────────────────────────────
const NOW = at('2026-11-26', 18); // Thursday of the week of Nov 23
{
  const r = W.computeWeekStreak([], T4, NOW);
  check('no history: streak 0, 1 freeze, target 4', r.streak === 0 && r.freezes === 1 && r.thisWeek.target === 4 && r.thisWeek.done === 0);
  check('no history: Mon-Wed rest, Thu today, Fri-Sun future', eq(r.thisWeek.days, ['rest', 'rest', 'rest', 'today', 'future', 'future', 'future']));
}
{
  const rows = [...week(M[5], [0, 1, 2, 3]), ...week(M[6], [0, 2, 4, 6]), ...week(M[7], [0, 2])];
  const r = W.computeWeekStreak(rows, T4, NOW);
  check('two past weeks on target, current week open: streak 2', r.streak === 2, JSON.stringify(r));
  check('current week 2 of 4, never missed until it ends', r.thisWeek.done === 2 && r.thisWeek.target === 4);
  check('dots: done, rest, done, today, future…', eq(r.thisWeek.days, ['done', 'rest', 'done', 'today', 'future', 'future', 'future']));
  const r2 = W.computeWeekStreak([...rows, row('2026-11-26', 9)], T4, NOW);
  check('training today fills today\'s dot', r2.thisWeek.days[3] === 'done' && r2.thisWeek.done === 3 && r2.streak === 2);
  const r3 = W.computeWeekStreak([...rows, row('2026-11-24', 9), row('2026-11-26', 9)], T4, NOW);
  check('current week counts once it reaches the target', r3.streak === 3 && r3.thisWeek.done === 4);
  check('two sessions on one day are one training day', W.computeWeekStreak([...rows, row('2026-11-26', 7), row('2026-11-26', 19)], T4, NOW).thisWeek.done === 3);
}
// Sunday / Monday edges (local time).
{
  const rows = [...week(M[6], [0, 1, 2]), { ...row('2026-11-22', 23), completedAt: at('2026-11-22', 23, 59).toISOString() }];
  const r = W.computeWeekStreak(rows, T4, NOW);
  check('a Sunday 23:59 session counts in the week that ends that Sunday', r.streak === 1 && r.thisWeek.done === 0);
  const rows2 = [...week(M[6], [0, 1, 2]), { ...row('2026-11-23', 0), completedAt: at('2026-11-23', 0, 1).toISOString() }];
  const r2 = W.computeWeekStreak(rows2, T4, NOW);
  check('a Monday 00:01 session counts in the new week', r2.thisWeek.done === 1 && r2.thisWeek.days[0] === 'done');
  check('…and the week before stays short (3 of 4): no streak to protect', r2.streak === 0 && r2.freezes === 1);
  const sun = W.computeWeekStreak(week(M[7], [0, 1, 2, 3]), T4, at('2026-11-29', 22));
  check('on Sunday the dots are all past or today', eq(sun.thisWeek.days, ['done', 'done', 'done', 'done', 'rest', 'rest', 'today']) && sun.streak === 1);
  const mon = W.computeWeekStreak(week(M[7], [0, 1, 2, 3]), T4, at('2026-11-30', 6));
  check('next Monday morning: last week kept, new week open', mon.streak === 1 && mon.thisWeek.done === 0 && mon.thisWeek.days[0] === 'today');
}
// Time zones: a row near midnight UTC.
{
  process.env.TZ = 'America/Los_Angeles';
  // 2026-11-24 03:30 UTC is Monday Nov 23, 19:30 in Los Angeles.
  const rows = [{ id: 'tz', type: 'Fight Focus', completedAt: '2026-11-24T03:30:00.000Z', completedCount: 2, xpEarned: 40 }];
  const r = W.computeWeekStreak(rows, T4, new Date('2026-11-24T20:00:00Z'));
  check('LA: a row at 03:30 UTC Tuesday is Monday evening locally', r.thisWeek.days[0] === 'done' && r.thisWeek.days[1] !== 'done', JSON.stringify(r.thisWeek.days));
  // 2026-11-23 06:30 UTC is Monday in UTC but Sunday 22:30 in Los Angeles.
  const r2 = W.computeWeekStreak([{ id: 'tz2', type: 'Fight Focus', completedAt: '2026-11-23T06:30:00.000Z', completedCount: 2, xpEarned: 40 }], T4, new Date('2026-11-24T20:00:00Z'));
  check('LA: 06:30 UTC Monday is Sunday night locally, last week', r2.thisWeek.done === 0);
  process.env.TZ = 'Asia/Tokyo';
  // 2026-11-22 15:30 UTC is Monday Nov 23, 00:30 in Tokyo.
  const r3 = W.computeWeekStreak([{ id: 'tz3', type: 'Fight Focus', completedAt: '2026-11-22T15:30:00.000Z', completedCount: 2, xpEarned: 40 }], T4, new Date('2026-11-24T03:00:00Z'));
  check('Tokyo: 15:30 UTC Sunday is Monday 00:30 locally, this week', r3.thisWeek.done === 1 && r3.thisWeek.days[0] === 'done');
  process.env.TZ = 'America/New_York';
}
// Freezes: use, earn, the cap.
{
  // 4 weeks on target → +1 freeze (2 held), then a short week uses one.
  const rows = [...week(M[0], [0, 1, 2, 3]), ...week(M[1], [0, 1, 2, 3]), ...week(M[2], [0, 1, 2, 3]), ...week(M[3], [0, 1, 2, 3])];
  const after4 = W.computeWeekStreak(rows, T4, at('2026-11-03', 12));
  check('4 weeks on target: streak 4, freeze earned (2 held)', after4.streak === 4 && after4.freezes === 2 && after4.events.some((e) => e.type === 'freeze_earned' && e.week === M[3]));
  check('at 2 held, no next freeze is counted down', after4.nextFreezeIn === null);
  const miss = W.computeWeekStreak([...rows, ...week(M[4], [0])], T4, at('2026-11-10', 12));
  check('a short week spends a freeze, streak kept', miss.streak === 4 && miss.freezes === 1 && miss.events.some((e) => e.type === 'freeze_used' && e.week === M[4]));
  const miss2 = W.computeWeekStreak([...rows], T4, at('2026-11-17', 12));
  check('two empty weeks spend both freezes, streak still 4', miss2.streak === 4 && miss2.freezes === 0);
  const miss3 = W.computeWeekStreak([...rows], T4, at('2026-11-24', 12));
  check('a third short week with no freeze resets the streak', miss3.streak === 0 && miss3.freezes === 0 && miss3.events.some((e) => e.type === 'reset' && e.week === M[6]));
  // A freeze week keeps the run but adds nothing: 3 on, freeze, 1 on → earns at the 4th week ON target.
  const run = [...week(M[0], [0, 1, 2, 3]), ...week(M[1], [0, 1, 2, 3]), ...week(M[2], [0, 1, 2, 3]), ...week(M[4], [0, 1, 2, 3])];
  const r = W.computeWeekStreak(run, T4, at('2026-11-10', 12));
  check('a freeze-covered week adds nothing to the streak', r.streak === 4, JSON.stringify(r));
  check('…keeps the run: the freeze back at the 4th week on target', r.freezes === 1 && r.events.filter((e) => e.type === 'freeze_used').length === 1 && r.events.some((e) => e.type === 'freeze_earned' && e.week === M[4]));
  // Hold at most 2: 12 weeks on target from 1 freeze gives 2, not 4.
  const long = [];
  for (let w = 0; w < 12; w++) long.push(...week(W.addDaysIso('2026-08-31', w * 7), [0, 1, 2, 3]));
  const capped = W.computeWeekStreak(long, T4, at('2026-11-23', 12));
  check('never more than 2 freezes', capped.freezes === 2 && capped.streak === 12 && capped.events.filter((e) => e.type === 'freeze_earned').length === 1);
  // The current week earns its freeze once it is on target.
  const cur = W.computeWeekStreak([...week(M[4], [0, 1, 2, 3]), ...week(M[5], [0, 1, 2, 3]), ...week(M[6], [0, 1, 2, 3]), ...week(M[7], [0, 1, 2, 3])], T4, NOW);
  check('the 4th week on target earns its freeze the day it lands', cur.streak === 4 && cur.freezes === 2 && cur.events.some((e) => e.type === 'freeze_earned' && e.week === M[7]));
  // A first, partial week costs nothing.
  const first = W.computeWeekStreak(week(M[6], [5, 6]), T4, NOW);
  check('a first partial week does not spend the starting freeze', first.freezes === 1 && first.streak === 0);
}
// Target changes apply from next Monday.
{
  const nowWed = at('2026-11-25', 12);
  const log = W.withTargetChange(T4, 2, nowWed);
  check('a change writes the old value for every week and the new from next Monday', eq(log, [{ from: '', days: 4 }, { from: '2026-11-30', days: 2 }]), JSON.stringify(log));
  const s2 = { target: 2, targets: log };
  const r = W.computeWeekStreak(week(M[7], [0, 1]), s2, nowWed);
  check('…the current week keeps 4', r.thisWeek.target === 4 && r.thisWeek.done === 2 && r.streak === 0);
  check('…the picker shows the pending 2', W.pendingTarget(s2, nowWed) === 2);
  const r2 = W.computeWeekStreak(week(M[7], [0, 1]), s2, at('2026-12-01', 12));
  check('…next week reads 2; last week (2 of 4) was short with no streak', r2.thisWeek.target === 2 && r2.streak === 0);
  const back = W.withTargetChange(s2, 4, nowWed);
  check('picking the value that holds drops the pending change', eq(back, [{ from: '', days: 4 }]));
  const again = W.withTargetChange(s2, 5, nowWed);
  check('a second change the same week replaces the first', eq(again, [{ from: '', days: 4 }, { from: '2026-11-30', days: 5 }]));
  // An old change keeps holding for its weeks.
  const hist = { target: 3, targets: [{ from: '', days: 4 }, { from: M[5], days: 3 }] };
  const rh = W.computeWeekStreak([...week(M[4], [0, 1, 2]), ...week(M[5], [0, 1, 2])], hist, at('2026-11-17', 12));
  check('past weeks are judged by the target that held then', rh.streak === 1 && rh.events.some((e) => e.type === 'week_complete' && e.week === M[5]));
}
// Carry-over: an existing athlete's real history.
{
  // Trained 3-5 days a week for six weeks, one light week, then this week.
  const rows = [
    ...week(M[0], [0, 2, 4, 5]), ...week(M[1], [1, 3, 5, 6]), ...week(M[2], [0, 1, 2, 3, 4]),
    ...week(M[3], [0, 3]), ...week(M[4], [0, 2, 4, 6]), ...week(M[5], [1, 2, 4, 5]), ...week(M[6], [0, 1, 3, 5]),
    ...week(M[7], [0, 1]),
    row(M[3], 12, { type: 'Mission of the Day', completedCount: 1, xpEarned: 25 }), row(W.addDaysIso(M[3], 1), 12, { completedCount: 0, xpEarned: 0 }),
  ];
  const r = W.computeWeekStreak(rows, T4, NOW);
  check('carry-over: a light week is covered by the starting freeze: 6-week streak', r.streak === 6 && r.freezes === 1, JSON.stringify({ s: r.streak, f: r.freezes }));
  check('carry-over: the award row and the 0-round row did not save the light week', r.events.some((e) => e.type === 'freeze_used' && e.week === M[3]));
  check('carry-over: longest is 6', r.longest === 6);
}
// A row synced in late (from another device, or finished offline).
{
  const rows = [...week(M[6], [0, 1, 2])];
  const before = W.computeWeekStreak(rows, T4, NOW);
  const late = { ...row('2026-11-21', 18), id: 'late' };
  const after = W.computeWeekStreak([...rows, late], T4, NOW);
  check('before the sync: last week short, nothing to protect', before.streak === 0 && before.freezes === 1);
  check('after the sync: last week on target, streak 1', after.streak === 1 && after.freezes === 1);
  check('rows in any order give the same answer', eq(W.computeWeekStreak([late, ...rows.reverse()], T4, NOW), after));
}
// Clock: a row from a clock running ahead counts once its day comes.
{
  const ahead = row('2026-11-27', 10);
  const r = W.computeWeekStreak([ahead], T4, NOW);
  check('a row dated tomorrow does not fill tomorrow\'s dot yet', r.thisWeek.done === 0 && r.thisWeek.days[4] === 'future');
  check('…and counts on its day', W.computeWeekStreak([ahead], T4, at('2026-11-27', 12)).thisWeek.done === 1);
}

// ── the moments ───────────────────────────────────────────────────────────
{
  const base = [...week(M[5], [0, 1, 2, 3]), ...week(M[6], [0, 1, 2, 3]), ...week(M[7], [0, 2])];
  const just = { ...row('2026-11-26', 18), completedAt: new Date(NOW.getTime() - 60000).toISOString() };
  const m = W.sessionMoment({ rows: [...base, just], settings: T4, now: NOW.getTime() });
  check('strip: today\'s first session → TRAINING DAY 3 OF 4, today\'s dot pops', m && m.kind === 'kept' && m.done === 3 && m.target === 4 && m.popIndex === 3 && m.streak === 2, JSON.stringify(m));
  check('strip copy', W.momentCopy(m).title === 'TRAINING DAY 3 OF 4 · STREAK KEPT' && W.momentCopy(m).sub === '1 more day this week keeps your streak going.');
  check('strip: not twice on one day', W.sessionMoment({ rows: [...base, just], settings: T4, now: NOW.getTime(), shown: { day: '2026-11-26' } }) === null);
  check('strip: not for a second session on the same day', W.sessionMoment({ rows: [...base, row('2026-11-26', 8), just], settings: T4, now: NOW.getTime() }) === null);
  const stale = { ...just, completedAt: new Date(NOW.getTime() - 3600000).toISOString() };
  check('strip: not for a session banked an hour ago', W.sessionMoment({ rows: [...base, stale], settings: T4, now: NOW.getTime() }) === null);
  check('strip: not after a 0-round END', W.sessionMoment({ rows: [...base, { ...just, completedCount: 0, xpEarned: 0 }], settings: T4, now: NOW.getTime() }) === null);
  const done4 = W.sessionMoment({ rows: [...base, row('2026-11-24', 9), just], settings: T4, now: NOW.getTime() });
  check('strip: the 4th day → WEEK COMPLETE · 4 OF 4 · 3-WEEK STREAK', done4.kind === 'complete' && W.momentCopy(done4).title === 'WEEK COMPLETE · 4 OF 4 · 3-WEEK STREAK');
  const SAT = at('2026-11-28', 11);
  const justSat = { ...row('2026-11-28', 11), completedAt: new Date(SAT.getTime() - 60000).toISOString() };
  const extra = W.sessionMoment({ rows: [...base, row('2026-11-24', 9), row('2026-11-26', 9), justSat], settings: T4, now: SAT.getTime() });
  check('strip: a 5th day → TARGET MET', extra.kind === 'extra' && W.momentCopy(extra).title === 'TRAINING DAY 5 · TARGET MET');
  const fresh = W.sessionMoment({ rows: [just], settings: T4, now: NOW.getTime() });
  check('strip: a new athlete is not told about a streak they do not have', W.momentCopy(fresh).title === 'TRAINING DAY 1 OF 4' && W.momentCopy(fresh).sub === '3 more days this week start a week streak.');
  check('strip copy: 2 more days keep the streak', W.momentCopy({ kind: 'kept', done: 2, target: 4, streak: 3, freezeEarned: null }).sub === '2 more days this week keep your streak going.');
  // Freeze earned on the strip.
  const run3 = [...week(M[4], [0, 1, 2, 3]), ...week(M[5], [0, 1, 2, 3]), ...week(M[6], [0, 1, 2, 3]), ...week(M[7], [0, 1, 2])];
  const runMoment = W.sessionMoment({ rows: [...run3, just], settings: T4, now: NOW.getTime() });
  check('strip: the 4th week on target earns a freeze line', runMoment.kind === 'complete' && runMoment.freezeEarned && runMoment.freezeEarned.freezes === 2 && W.momentCopy(runMoment).freeze === 'FREEZE EARNED · YOU HOLD 2 OF 2');
  check('strip: a freeze already seen is not shown again', W.sessionMoment({ rows: [...run3, just], settings: T4, now: NOW.getTime(), shown: { seen: [runMoment.freezeEarned.id] } }).freezeEarned === null);
}
{
  const rows = [...week(M[4], [0, 1, 2, 3]), ...week(M[5], [0, 1, 2, 3]), ...week(M[6], [0])];
  const wk = W.computeWeekStreak(rows, T4, at('2026-11-24', 9));
  const n1 = W.homeNotice(wk, {});
  check('Home: the week after a short one, the freeze-used notice', n1 && n1.kind === 'freeze_used' && n1.streak === 2 && n1.freezes === 0);
  check('Home: notice copy is plain and short', W.noticeCopy(n1) === 'A freeze covered last week: your 2-week streak is safe.', W.noticeCopy(n1));
  check('Home: shown once', W.homeNotice(wk, { seen: [n1.id] }) === null);
  const later = W.computeWeekStreak(rows, T4, at('2026-12-08', 9));
  check('Home: an old freeze is news to nobody', W.homeNotice(later, {})?.kind !== 'freeze_used');
  const earnedWk = W.computeWeekStreak([...week(M[3], [0, 1, 2, 3]), ...week(M[4], [0, 1, 2, 3]), ...week(M[5], [0, 1, 2, 3]), ...week(M[6], [0, 1, 2, 3])], T4, at('2026-11-23', 9));
  const n2 = W.homeNotice(earnedWk, {});
  check('Home: a freeze earned last week and not yet seen', n2 && n2.kind === 'freeze_earned' && W.noticeCopy(n2) === 'Freeze earned: 4 weeks on target. You hold 2\u00A0of\u00A02.');
}
// No franchise names, no guilt words in the copy.
{
  const BANNED = /goku|vegeta|saiyan|dragon ball|saitama|batman|street fighter|ryu\b|ken\b/i;
  const GUILT = /lost|failed|broke|shame|lazy|miss(ed)? out|don't let/i;
  const all = [
    W.momentCopy({ kind: 'kept', done: 2, target: 4, streak: 3, freezeEarned: { freezes: 2 } }),
    W.momentCopy({ kind: 'complete', done: 4, target: 4, streak: 10, freezeEarned: null }),
    W.momentCopy({ kind: 'extra', done: 5, target: 4, streak: 1, freezeEarned: null }),
  ].flatMap((c) => [c.title, c.sub, c.freeze]).filter(Boolean)
    .concat([W.noticeCopy({ kind: 'freeze_used', streak: 3, freezes: 1, target: 4 }), W.noticeCopy({ kind: 'freeze_earned', freezes: 2 })]);
  check('copy: no franchise names', !all.some((t) => BANNED.test(t)));
  check('copy: no guilt words', !all.some((t) => GUILT.test(t)), all.find((t) => GUILT.test(t)));
}

// ── the store: target from the Game Plan, markers ────────────────────────
{
  store.clear();
  check('never chose: target 4', S.weekSettings().target === 4 && S.chosenWeekTarget(NOW.getTime()) === 4);
  store.set('tm_game_plan_v1', JSON.stringify({ setup: true, daysPerWeek: 7 }));
  check('an old Game Plan of 7 days reads 6', S.weekSettings().target === 6);
  store.set('tm_game_plan_v1', JSON.stringify({ setup: true, daysPerWeek: 3 }));
  check('an old Game Plan of 3 days reads 3', S.weekSettings().target === 3);
  store.clear();
  const gp = S.setWeekTarget(5, NOW.getTime());
  check('a pick saves days per week now and the log from next Monday', gp.daysPerWeek === 5 && eq(gp.weekTargets, [{ from: '', days: 4 }, { from: '2026-11-30', days: 5 }]));
  check('…this week still 4, the picker shows 5', S.loadWeekStreak(NOW.getTime(), []).thisWeek.target === 4 && S.chosenWeekTarget(NOW.getTime()) === 5);
  store.clear();
  const gp2 = S.saveGamePlanKeepingTarget({ sessionMinutes: 30 });
  check('saving the minutes first does not turn a never-chosen 4 into the plan\'s 3', gp2.sessionMinutes === 30 && gp2.daysPerWeek === 4 && S.weekSettings().target === 4 && S.chosenWeekTarget(NOW.getTime()) === 4);
  const gp3 = S.saveGamePlanKeepingTarget({ preferredTime: 'evening' });
  check('…and a later answer leaves the target alone', gp3.daysPerWeek === 4 && eq(gp3.weekTargets, [{ from: '', days: 4 }]));
  S.markWeekMoments({ day: '2026-11-26', seen: ['earned:2026-11-23'] });
  S.markWeekMoments({ seen: ['used:2026-11-16'] });
  const mk = S.loadWeekMoments();
  check('markers merge and keep the day', mk.day === '2026-11-26' && eq(mk.seen, ['earned:2026-11-23', 'used:2026-11-16']));
  for (let i = 0; i < 40; i++) S.markWeekMoments({ seen: [`x:${i}`] });
  check('markers stay small', S.loadWeekMoments().seen.length <= 24);
  store.set('tm_week_moments_v1', '{not json');
  check('unreadable markers read as none', eq(S.loadWeekMoments(), { day: null, seen: [] }));
  check('new keys are synced', SYNC_KEYS.includes('tm_week_moments_v1') && SYNC_KEYS.includes('tm_daily_mission_v2') && SYNC_KEYS.includes('tm_game_plan_v1'));
}

// ── the daily mission ─────────────────────────────────────────────────────
{
  const fighter = { goal: 'Train Like a Fighter', discipline: 'Muay Thai', encouragement: 'high' };
  const fitter = { goal: 'Get Fit', discipline: 'Boxing' };
  const level6 = { xp: 2600, sessions: [{ type: 'Fight Focus', completedAt: at('2026-11-10').toISOString(), completedCount: 3, xpEarned: 2600 }] };
  const a = D.dealDailyMission({ date: '2026-11-26', profile: fighter, stats: level6 });
  const b = D.dealDailyMission({ date: '2026-11-26', profile: fighter, stats: level6 });
  check('same date, same mission', eq(a, b));
  check('a fighter gets one Fight Focus round of their discipline', a.side === 'fight' && a.title === 'One Round: Muay Thai' && a.minutes === 3 && a.discipline === 'Muay Thai');
  check('…on their level (level 6 is Hard)', a.difficulty === 'Hard' && a.line === 'Fight Focus · Hard · fits your level', a.line);
  check('…paying the existing bonus', a.bonusXp === U.XP_DAILY_MISSION_BONUS && U.XP_DAILY_MISSION_BONUS === 25);
  const yest = { ...level6, sessions: [...level6.sessions, row('2026-11-25', 19)] };
  const c = D.dealDailyMission({ date: '2026-11-26', profile: fighter, stats: yest });
  check('the day after a session: one step easier, and it says so', c.difficulty === 'Normal' && c.lighter && c.line === 'Fight Focus · Normal · lighter after yesterday');
  const award = { ...level6, sessions: [...level6.sessions, row('2026-11-25', 19, { type: 'Mission of the Day', completedCount: 1, xpEarned: 25 })] };
  check('an award row yesterday is not a session', !D.dealDailyMission({ date: '2026-11-26', profile: fighter, stats: award }).lighter);
  const f = D.dealDailyMission({ date: '2026-11-26', profile: fitter, stats: { xp: 0, sessions: [] } });
  check('a fit athlete gets a 3-minute Quick Mission', f.side === 'fit' && f.minutes === 3 && D.DAILY_FOCI.includes(f.focus) && f.title === `Quick Mission: ${f.focus}`);
  check('…level 1 is Easy', f.difficulty === 'Easy' && f.line === 'No gear · Easy · fits your level');
  const easyYest = D.dealDailyMission({ date: '2026-11-26', profile: fitter, stats: { xp: 0, sessions: [row('2026-11-25', 8, { type: 'Quick Mission' })] } });
  check('…Easy cannot go lower, so it does not claim to be lighter', easyYest.difficulty === 'Easy' && !easyYest.lighter);
  const foci = new Set(Array.from({ length: 30 }, (_, i) => D.dealDailyMission({ date: W.addDaysIso('2026-11-01', i), profile: fitter, stats: {} }).focus));
  check('the focus changes with the date', foci.size >= 3);
  check('no goal: the side with more XP', D.missionSide({}, { xp: 900, sessions: [{ type: 'Quick Mission', completedAt: at('2026-11-10').toISOString(), xpEarned: 900, completedCount: 3 }] }) === 'fit' && D.missionSide({}, {}) === 'fight');
  const cfg = D.dailyMissionCfg(a, { profile: fighter });
  check('fight START: 1 round of 3 minutes, no warm-up, tagged with the date', cfg.rounds === 1 && cfg.roundMin === 3 && cfg.warmupMin === 0 && cfg.difficulty === 'Hard' && cfg.dailyMission === '2026-11-26' && cfg.encouragement === 'high');
  const qcfg = D.dailyMissionCfg(f, { qmConfig: (o) => ({ ...o, built: true }) });
  check('fit START: a 3-minute Quick Mission of the focus, tagged', qcfg.built && qcfg.duration === 3 && qcfg.focus === f.focus && qcfg.difficulty === 'Easy' && qcfg.dailyMission === '2026-11-26');

  // The fit mission really is about 3 minutes, at every level and focus.
  const { generateQuickMission, estimateQuickMissionSeconds } = await import('../components/training-mode/fit-mode/quickMissionGenerator.js');
  const off = [];
  for (const goal of ['Get Fit']) for (const xp of [0, 1500, 3500, 9000]) for (let i = 0; i < 20; i++) {
    const m = D.dealDailyMission({ date: W.addDaysIso('2026-11-01', i), profile: { goal }, stats: { xp, sessions: [{ type: 'Quick Mission', completedAt: at('2026-10-01').toISOString(), xpEarned: xp, completedCount: 3 }] } });
    const c = D.dailyMissionCfg(m, { qmConfig: (o) => ({ ...o }) });
    const secs = estimateQuickMissionSeconds(generateQuickMission({ duration: c.duration, focus: c.focus, difficulty: c.difficulty }));
    if (Math.abs(secs - 180) > 30) off.push(`${m.focus}/${m.difficulty}: ${secs}s`);
  }
  check('a 3-minute Quick Mission runs 3 minutes (within 30 s) at every level and focus', off.length === 0, off.slice(0, 3).join(', '));

  // Storage: today's mission, kept for the day; the bonus once.
  store.clear();
  const now = at('2026-11-26', 10).getTime();
  const t1 = D.todaysDailyMission({ now, profile: fighter, stats: level6 });
  check('a fresh deal is not saved by reading', !t1.saved && !t1.done && !store.has(D.DAILY_MISSION_KEY));
  D.rememberDailyMission(t1.mission);
  const t2 = D.todaysDailyMission({ now: now + 3600000, profile: fitter, stats: { xp: 0, sessions: [] } });
  check('kept all day, whatever changes', t2.saved && eq(t2.mission, t1.mission));
  const before = U.loadStats().xp;
  check('not paid for an invalid session', D.settleDailyMission({ cfg, valid: false, now }) === 0);
  check('not paid for a session not started from the card', D.settleDailyMission({ cfg: { ...cfg, dailyMission: undefined }, valid: true, now }) === 0);
  check('not paid for yesterday\'s card', D.settleDailyMission({ cfg: { ...cfg, dailyMission: '2026-11-25' }, valid: true, now }) === 0);
  failWrites = true;
  check('not paid when the done flag cannot be saved', D.settleDailyMission({ cfg, valid: true, now }) === 0 && U.loadStats().xp === before);
  failWrites = false;
  check('paid once for the valid session from today\'s card', D.settleDailyMission({ cfg, valid: true, now }) === 25 && U.loadStats().xp === before + 25);
  check('…and never again that day', D.settleDailyMission({ cfg, valid: true, now: now + 60000 }) === 0 && U.loadStats().xp === before + 25);
  check('…today\'s card reads done', D.todaysDailyMission({ now, profile: fighter, stats: level6 }).done);
  check('…the bonus row is an award, not a training day', !W.isTrainingRow(U.loadStats().sessions.at(-1)) && U.loadStats().sessions.at(-1).type === 'Mission of the Day');
  check('just done: for the end screen', D.justDoneDailyMission(now + 30000)?.xp === 25 && D.justDoneDailyMission(now + 3600000) === null);
  const tomorrow = D.todaysDailyMission({ now: at('2026-11-27', 8).getTime(), profile: fighter, stats: level6 });
  check('a new mission the next day, not done', !tomorrow.done && tomorrow.mission.date === '2026-11-27');
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

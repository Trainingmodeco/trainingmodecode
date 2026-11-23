// The weekly streak, freezes and the daily mission (retention feature 1):
// week boundaries (Monday to Sunday, local), Sunday/Monday edges, time zones
// (a row near midnight UTC in a zone that is not UTC), target changes from
// next Monday, freeze use and earn, at most 2, carry-over of a real history,
// a row synced in late, award rows and no-work rows left out, the end-screen
// and Home moments, and Today's Bout (Home's one card): its pick, held for the
// day, and its once-a-day bonus for a session started from the card.
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
check('a tape not cleared is left out even when paid (a partial)', !W.isTrainingRow(row('2026-11-20', 12, { type: "Coach's Tapes", kind: 'fit', completedCount: 0, xpEarned: 33 })));
check('a cleared tape the daily caps paid nothing still counts', W.isTrainingRow(row('2026-11-20', 12, { type: "Coach's Tapes", kind: 'fight', completedCount: 1, xpEarned: 0 })));
{
  // A day whose only cleared tape was capped (two partials paid first) is a training day.
  const tapeDay = [
    row('2026-11-18', 9, { type: "Coach's Tapes", kind: 'fit', completedCount: 0, xpEarned: 38 }),
    row('2026-11-18', 10, { type: "Coach's Tapes", kind: 'fit', completedCount: 0, xpEarned: 45 }),
    row('2026-11-18', 11, { type: "Coach's Tapes", kind: 'fight', completedCount: 1, xpEarned: 0 }),
  ];
  check('…so its day is a training day', W.trainingDays(tapeDay, '2026-11-22').has('2026-11-18'));
}
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
  check('strip: the 4th week on target earns a 1UP line', runMoment.kind === 'complete' && runMoment.freezeEarned && runMoment.freezeEarned.freezes === 2 && W.momentCopy(runMoment).freeze === '1UP EARNED · YOU HOLD 2 OF 2');
  check('strip: a freeze already seen is not shown again', W.sessionMoment({ rows: [...run3, just], settings: T4, now: NOW.getTime(), shown: { seen: [runMoment.freezeEarned.id] } }).freezeEarned === null);
  // A cardio finisher banks a Cardio row of its own after the session's, before the end screen.
  const ago = (min) => new Date(NOW.getTime() - min * 60000).toISOString();
  const mainRow = { ...row('2026-11-26', 18, { type: 'Quick Mission' }), completedAt: ago(12) };
  const finRow = { id: 'fin', type: 'Cardio', completedAt: ago(1), completedCount: 1, totalCount: 1, xpEarned: 30, completedTimeSeconds: 600 };
  const withFin = W.sessionMoment({ rows: [...base, mainRow, finRow], settings: T4, now: NOW.getTime(), finisher: true });
  check('strip: a session with a cardio finisher still gets TRAINING DAY 3 OF 4', withFin && withFin.kind === 'kept' && withFin.done === 3, JSON.stringify(withFin));
  const longFin = W.sessionMoment({ rows: [...base, { ...mainRow, completedAt: ago(40) }, finRow], settings: T4, now: NOW.getTime(), finisher: true });
  check('strip: …even when the finisher ran longer than the fresh window', longFin && longFin.done === 3);
  const finWeek = W.sessionMoment({ rows: [...run3, mainRow, finRow], settings: T4, now: NOW.getTime(), finisher: true });
  check('strip: …and the week it completes with the freeze it earns', finWeek && finWeek.kind === 'complete' && finWeek.freezeEarned?.freezes === 2);
  check('strip: a finisher does not make a second session of the day the first', W.sessionMoment({ rows: [...base, row('2026-11-26', 8), mainRow, finRow], settings: T4, now: NOW.getTime(), finisher: true }) === null);
  check('strip: without a finisher a Cardio row is still another session', W.sessionMoment({ rows: [...base, mainRow, finRow], settings: T4, now: NOW.getTime() }) === null);
  check('strip: a finisher with no Cardio row counted leaves the rule as it was', W.sessionMoment({ rows: [...base, row('2026-11-26', 8), { ...just, type: 'Quick Mission' }, { ...finRow, completedTimeSeconds: 0 }], settings: T4, now: NOW.getTime(), finisher: true }) === null
    && W.sessionMoment({ rows: [...base, { ...just, type: 'Quick Mission' }, { ...finRow, completedTimeSeconds: 0 }], settings: T4, now: NOW.getTime(), finisher: true })?.done === 3);
}
{
  const rows = [...week(M[4], [0, 1, 2, 3]), ...week(M[5], [0, 1, 2, 3]), ...week(M[6], [0])];
  const wk = W.computeWeekStreak(rows, T4, at('2026-11-24', 9));
  const n1 = W.homeNotice(wk, {});
  check('Home: the week after a short one, the freeze-used notice', n1 && n1.kind === 'freeze_used' && n1.streak === 2 && n1.freezes === 0);
  check('Home: notice copy is plain and short, the freeze called a 1UP', W.noticeCopy(n1) === 'A 1UP covered last week: your 2-week streak is safe.', W.noticeCopy(n1));
  check('Home: shown once', W.homeNotice(wk, { seen: [n1.id] }) === null);
  const later = W.computeWeekStreak(rows, T4, at('2026-12-08', 9));
  check('Home: an old freeze is news to nobody', W.homeNotice(later, {})?.kind !== 'freeze_used');
  const earnedWk = W.computeWeekStreak([...week(M[3], [0, 1, 2, 3]), ...week(M[4], [0, 1, 2, 3]), ...week(M[5], [0, 1, 2, 3]), ...week(M[6], [0, 1, 2, 3])], T4, at('2026-11-23', 9));
  const n2 = W.homeNotice(earnedWk, {});
  check('Home: a 1UP earned last week and not yet seen', n2 && n2.kind === 'freeze_earned' && W.noticeCopy(n2) === '1UP earned: 4 weeks on target. You hold 2\u00A0of\u00A02.');
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
  check('copy: the freeze is called a 1UP on screen (no "freeze", no ❄)', !all.some((t) => /freeze|❄/i.test(t)) && all.filter((t) => /1UP/.test(t)).length === 3, all.join(' | '));
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

// ── Today's Bout: the pick (pure) ────────────────────────────────────────────
{
  const L = await import('../components/training-mode/data/lastSession.js');
  const P = await import('../components/training-mode/data/pathStars.js');
  const date = '2026-11-26';
  const timer = { kind: 'timer', cfg: { mode: 'Technical', rounds: 3, roundMin: 3, restSec: 60, difficulty: 'Normal' }, disc: 'Boxing', at: 1 };
  const a = D.pickTodaysBout({ date, last: timer, lastInfo: L.describeSession(timer), suggestion: { title: 'X', actionType: 'fightFocus' } });
  check('pick: the last session first, ready to run again', a.kind === 'last' && a.title === 'Fight Focus' && a.side === 'fight' && a.cta === 'START' && a.run.type === 'replay' && eq(a.run.last, timer), JSON.stringify(a));
  check('pick: its length is the tag, not the line', a.minutes === 11 && eq(a.parts, ['Boxing · 3 rounds', 'Normal']));
  check('pick: a repeat says so ("Same as last time")', a.why === 'Same as last time' && eq(D.boutMeta(a), ['11 MIN', 'SAME AS LAST TIME']));
  check('pick: it pays the existing Mission of the Day amount', a.bonusXp === U.XP_DAILY_MISSION_BONUS && U.XP_DAILY_MISSION_BONUS === 25 && D.BOUT_BONUS_XP === 25);
  const one = { ...timer, cfg: { ...timer.cfg, rounds: 1 } };
  check('pick: one round reads "1 round"', D.pickTodaysBout({ date, last: one, lastInfo: L.describeSession(one) }).parts[0] === 'Boxing · 1 round');
  const camp = { kind: 'camp', cfg: { level: 5, difficulty: 'normal', format: 'single' }, disc: 'Boxing', at: 1 };
  const c = D.pickTodaysBout({ date, last: camp, lastInfo: L.describeSession(camp) });
  check('pick: the camp continues on its map, no "same as last time", no length', c.kind === 'last' && c.cta === 'CONTINUE' && c.why === null && c.minutes === null);
  const next = { kind: 'camp', saga: 'Training Camp', number: 5, title: 'Volume', disc: 'Boxing' };
  const n2 = D.pickTodaysBout({ date, last: camp, lastInfo: L.describeSession(camp), next, nextLine: P.nextUpLine(next) });
  check('pick: on the path, NEXT UP folds in (the node, CONTINUE, opens it)', n2.kind === 'next' && n2.run.type === 'next' && n2.run.next === next && n2.cta === 'CONTINUE' && n2.parts.includes('Level 5') && /Next up in Training Camp/.test(n2.label));
  check('pick: NEXT UP only folds for a saga or the camp', D.pickTodaysBout({ date, last: timer, lastInfo: L.describeSession(timer), next, nextLine: P.nextUpLine(next) }).kind === 'last');
  const prog = { kind: 'fit', cfg: { programId: 'bro', difficulty: 'Normal', duration: 40 }, at: 1 };
  check('pick: a program moves to its next day, so no "same as last time"', D.pickTodaysBout({ date, last: prog, lastInfo: { mode: 'fit', title: 'Bro Split', sub: 'Next: Chest day', diff: 'Normal', time: '40 min' } }).why === null);
  const plan = { kind: 'train', session: { label: 'Combo Coach' }, gapMin: 20, actionType: 'comboCoach' };
  const p = D.pickTodaysBout({ date, plan, suggestion: { title: 'X', actionType: 'fightFocus' } });
  check('pick: no history, a Game Plan: its session for the window', p.kind === 'bout' && p.title === 'Combo Coach' && eq(p.parts, ['Fits your ~20 min window']) && p.run.actionType === 'comboCoach' && p.minutes === null && p.why === null);
  const rest = D.pickTodaysBout({ date, plan: { kind: 'rest_day', reason: '…Your combo is safe.' }, suggestion: { title: 'Fight Focus — 3 Round Starter', actionType: 'fightFocus', actionPayload: 'Boxing' } });
  check('pick: a planned rest day says rest never breaks the week streak; TRAIN ANYWAY runs the first pick', rest.cta === 'TRAIN ANYWAY' && /never break your week streak/.test(rest.parts[0]) && !/combo/i.test(rest.parts[0]) && rest.run.actionType === 'fightFocus');
  const rec = D.pickTodaysBout({ date, plan: { kind: 'recovery', reason: 'No known free block today.' } });
  check('pick: a recovery round opens the Quick Mission page', rec.cta === 'QUICK MISSION' && rec.run.type === 'qmSetup');
  const fit = D.pickTodaysBout({ date, suggestion: { title: 'Quick Mission — 12 Min Starter', subtitle: 'A short bodyweight circuit to get moving.', actionType: 'quickMission', actionPayload: { duration: 12, focus: 'Full Body' }, mode: 'fit' } });
  check('pick: a new fit athlete gets the first pick on their own level', fit.side === 'fit' && fit.minutes === 12 && fit.why === 'Fits your level' && fit.run.payload.duration === 12);
  check('pick: the tag leaves out minutes the title already says', eq(D.boutMeta(fit), ['FITS YOUR LEVEL']) && eq(D.boutMeta(fit, { atPace: true }), ['FITS YOUR LEVEL', 'AT YOUR PACE']));
  const easy = D.pickTodaysBout({ date, suggestion: { title: 'Quick Mission — Active Recovery', actionType: 'quickMission', actionPayload: { duration: 10, difficulty: 'Easy' }, mode: 'fit' } });
  check('pick: a fixed easy level does not claim to fit the athlete', easy.why === null && eq(D.boutMeta(easy), ['10 MIN']));
  const sh = D.pickTodaysBout({ date, suggestion: { title: 'Start Here — Learn the Basics', subtitle: 'Complete your first beginner lesson before Fight Focus.', actionType: 'startHere', actionPayload: null, mode: 'fight' } });
  check('pick: a pick with no length has no tag', sh.minutes === null && D.boutMeta(sh).length === 0 && sh.run.actionType === 'startHere');
  const sp = D.surpriseBout({ date, cfg: { duration: 15, focus: 'Core', difficulty: 'Hard' }, level: 'Hard' });
  check('SURPRISE ME: a Surprise Mission with its length', sp.kind === 'surprise' && sp.title === 'Surprise Mission' && eq(sp.parts, ['Core', 'Hard']) && eq(D.boutMeta(sp), ['15 MIN']) && sp.run.cfg.duration === 15);
  check('a pick is plain data (it is stored for the day)', eq(JSON.parse(JSON.stringify(a)), a) && eq(JSON.parse(JSON.stringify(n2)), n2));
}

// ── Today's Bout: fresh days and repeat days (owner, 2026-11-23) ─────────────
{
  const L = await import('../components/training-mode/data/lastSession.js');
  const P = await import('../components/training-mode/data/pathStars.js');
  const fighter = { goal: 'Train Like a Fighter', discipline: 'Muay Thai', encouragement: 'high' };
  const fitter = { goal: 'Get Fit', discipline: 'Boxing' };
  const level6 = { xp: 2600, sessions: [{ type: 'Fight Focus', completedAt: at('2026-11-10').toISOString(), completedCount: 3, totalCount: 3, xpEarned: 2600 }] };
  const date = '2026-11-26';
  // The deal (the old Daily Mission's, 3 minutes, side and level).
  const a = D.freshBout({ date, profile: fighter, stats: level6 });
  check('fresh: same date, same deal', eq(a, D.freshBout({ date, profile: fighter, stats: level6 })));
  check('fresh: a fighter gets one 3-minute Fight Focus round of their discipline', a.kind === 'fresh' && a.turn === 'fresh' && a.side === 'fight' && a.title === 'One Round: Muay Thai' && a.minutes === 3 && a.cta === 'START', JSON.stringify(a));
  check('fresh: …on their level (level 6 is Hard), the card says it is new', eq(a.parts, ['Fight Focus', 'Hard']) && a.why === 'Something new today' && eq(D.boutMeta(a), ['3 MIN', 'SOMETHING NEW TODAY']));
  check('fresh: …paying the same bonus', a.bonusXp === 25);
  const c = a.run.last.cfg;
  check('fresh: START runs 1 round of 3 minutes, no warm-up, the athlete\'s encouragement, its discipline', a.run.type === 'replay' && a.run.last.kind === 'timer' && a.run.last.disc === 'Muay Thai' && c.rounds === 1 && c.roundMin === 3 && c.warmupMin === 0 && c.difficulty === 'Hard' && c.encouragement === 'high' && c.mode === 'Technical' && !c.ghost);
  check('fresh: its config is tagged with the day (never stored as the last session)', c.freshBout === date);
  const yest = { ...level6, sessions: [...level6.sessions, row('2026-11-25', 19)] };
  const lighter = D.freshBout({ date, profile: fighter, stats: yest });
  check('fresh: the day after a session, one step easier, and it says so', lighter.run.last.cfg.difficulty === 'Normal' && eq(lighter.parts, ['Fight Focus', 'Normal', 'Lighter after yesterday']));
  const adv = { xp: 6750, sessions: [{ type: 'Fight Focus', completedAt: at('2026-11-10').toISOString(), completedCount: 3, totalCount: 3, xpEarned: 6750 }, row('2026-11-25', 19)] };
  const advFresh = D.freshBout({ date, profile: fighter, stats: adv });
  check('fresh: an Advanced fighter one step down is still Hard, so no "lighter" claim', advFresh.run.last.cfg.difficulty === 'Hard' && eq(advFresh.parts, ['Fight Focus', 'Hard']));
  const award = { ...level6, sessions: [...level6.sessions, row('2026-11-25', 19, { type: 'Mission of the Day', completedCount: 1, totalCount: 1, xpEarned: 25 })] };
  check('fresh: an award row yesterday is not a session', eq(D.freshBout({ date, profile: fighter, stats: award }).parts, ['Fight Focus', 'Hard']));
  const f = D.freshBout({ date, profile: fitter, stats: { xp: 0, sessions: [] } });
  check('fresh: a fit athlete gets a 3-minute Quick Mission', f.side === 'fit' && f.minutes === 3 && D.FRESH_FOCI.includes(f.run.qm.focus) && f.title === `Quick Mission: ${f.run.qm.focus}` && f.run.type === 'freshQm' && f.run.qm.duration === 3);
  check('fresh: …level 1 is Easy', f.run.qm.difficulty === 'Easy' && eq(f.parts, ['No gear', 'Easy']));
  const easyYest = D.freshBout({ date, profile: fitter, stats: { xp: 0, sessions: [row('2026-11-25', 8, { type: 'Quick Mission' })] } });
  check('fresh: …Easy cannot go lower, so it does not claim to be lighter', easyYest.run.qm.difficulty === 'Easy' && eq(easyYest.parts, ['No gear', 'Easy']));
  const foci = new Set(Array.from({ length: 30 }, (_, i) => D.freshBout({ date: W.addDaysIso('2026-11-01', i), profile: fitter, stats: {} }).run.qm.focus));
  check('fresh: the focus changes with the date', foci.size >= 3);
  check('fresh: no goal, the side with more XP', D.freshSide({}, { xp: 900, sessions: [{ type: 'Quick Mission', completedAt: at('2026-11-10').toISOString(), xpEarned: 900, completedCount: 3 }] }) === 'fit' && D.freshSide({}, {}) === 'fight');
  check('fresh: plain data (it is stored for the day)', eq(JSON.parse(JSON.stringify(a)), a) && eq(JSON.parse(JSON.stringify(f)), f));
  // The fit deal really is about 3 minutes, at every level and focus.
  const { generateQuickMission, estimateQuickMissionSeconds } = await import('../components/training-mode/fit-mode/quickMissionGenerator.js');
  const off = [];
  for (const xp of [0, 1500, 3500, 9000]) for (let i = 0; i < 20; i++) {
    const m = D.freshBout({ date: W.addDaysIso('2026-11-01', i), profile: { goal: 'Get Fit' }, stats: { xp, sessions: [{ type: 'Quick Mission', completedAt: at('2026-10-01').toISOString(), xpEarned: xp, completedCount: 3 }] } });
    const secs = estimateQuickMissionSeconds(generateQuickMission(m.run.qm));
    if (Math.abs(secs - 180) > 30) off.push(`${m.run.qm.focus}/${m.run.qm.difficulty}: ${secs}s`);
  }
  check('fresh: a 3-minute Quick Mission runs 3 minutes (within 30 s) at every level and focus', off.length === 0, off.slice(0, 3).join(', '));

  // Whose turn.
  check('turns: a fresh day only after a repeat day', D.turnAfter('repeat') === 'fresh' && D.turnAfter('fresh') === 'repeat' && D.turnAfter('pick') === 'repeat' && D.turnAfter(null) === 'repeat');
  check('turns: a bout held before turns existed reads from its kind', D.turnOf({ kind: 'last' }) === 'repeat' && D.turnOf({ kind: 'next' }) === 'repeat' && D.turnOf({ kind: 'bout' }) === 'pick' && D.turnOf({ kind: 'fresh' }) === 'fresh' && D.turnOf({ kind: 'surprise', turn: 'fresh' }) === 'fresh' && D.turnOf(null) === null);
  const timer = { kind: 'timer', cfg: { mode: 'Technical', rounds: 3, roundMin: 3, restSec: 60, difficulty: 'Normal' }, disc: 'Boxing', at: 1 };
  const pick = (prevTurn, extra = {}) => D.pickTodaysBout({ date, last: timer, lastInfo: L.describeSession(timer), prevTurn, profile: fighter, stats: level6, ...extra });
  check('pick: after a repeat day, a fresh deal', eq(pick('repeat'), a));
  check('pick: after a fresh day, the last session again ("Same as last time")', pick('fresh').kind === 'last' && pick('fresh').turn === 'repeat' && pick('fresh').why === 'Same as last time');
  check('pick: with no day held before, or after a new athlete\'s pick, a repeat day', pick(null).kind === 'last' && pick('pick').kind === 'last');
  const camp = { kind: 'camp', cfg: { level: 5, difficulty: 'normal', format: 'single' }, disc: 'Boxing', at: 1 };
  const next = { kind: 'camp', saga: 'Training Camp', number: 5, title: 'Volume', disc: 'Boxing' };
  const nx = D.pickTodaysBout({ date, last: camp, lastInfo: L.describeSession(camp), next, nextLine: P.nextUpLine(next), prevTurn: 'fresh' });
  check('pick: the next stage is a repeat day too (a fresh day follows it)', nx.kind === 'next' && nx.turn === 'repeat' && D.turnAfter(D.turnOf(nx)) === 'fresh');
  check('pick: a saga or camp player\'s fresh day is a fresh deal', D.pickTodaysBout({ date, last: camp, lastInfo: L.describeSession(camp), next, nextLine: P.nextUpLine(next), prevTurn: 'repeat', profile: fighter, stats: level6 }).kind === 'fresh');
  const newbie = D.pickTodaysBout({ date, prevTurn: 'repeat', suggestion: { title: 'Quick Mission — 12 Min Starter', actionType: 'quickMission', actionPayload: { duration: 12 }, mode: 'fit' }, profile: fitter, stats: { xp: 0, sessions: [] } });
  check('pick: a brand-new athlete (no last session) keeps the setup\'s pick, whatever the turn', newbie.kind === 'bout' && newbie.turn === 'pick' && newbie.title === 'Quick Mission — 12 Min Starter');
  const plan = D.pickTodaysBout({ date, plan: { kind: 'train', session: { label: 'Combo Coach' }, gapMin: 20, actionType: 'comboCoach' } });
  check('pick: the Game Plan\'s bout for a new athlete is a pick too', plan.turn === 'pick');

  // Held day by day: the turns alternate, from the box.
  const hold = (iso, extra = {}) => {
    const t = D.todaysBout({ now: at(iso, 9).getTime() });
    if (t.bout) return t.bout;
    const b = D.pickTodaysBout({ date: iso, last: timer, lastInfo: L.describeSession(timer), prevTurn: t.prevTurn, profile: fighter, stats: level6, ...extra });
    D.holdBout(b);
    return D.todaysBout({ now: at(iso, 9).getTime() }).bout;
  };
  store.clear();
  const days = ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27'].map((iso) => hold(iso).kind);
  check('held: repeat, fresh, repeat, fresh, repeat', eq(days, ['last', 'fresh', 'last', 'fresh', 'last']), days.join(','));
  check('held: the same day reads the same bout all day (a reload)', hold('2026-11-27').kind === 'last' && D.todaysBout({ now: at('2026-11-27', 23, 59).getTime() }).bout.kind === 'last');
  check('held: a skipped day does not break the turns (3 days later, after a repeat: fresh)', hold('2026-11-30').kind === 'fresh' && hold('2026-12-04').kind === 'last');
  check('held: prevTurn reads only an earlier day', D.todaysBout({ now: at('2026-12-04', 12).getTime() }).prevTurn === null && D.todaysBout({ now: at('2026-12-05', 12).getTime() }).prevTurn === 'repeat');
  // SURPRISE ME keeps the day's turn.
  store.clear();
  hold('2026-11-23');
  D.rerollBout(D.surpriseBout({ date: '2026-11-23', cfg: { duration: 15, focus: 'Core', difficulty: 'Hard' }, level: 'Hard' }));
  check('SURPRISE ME on a repeat day: still a repeat day, so a fresh day follows', D.todaysBout({ now: at('2026-11-23', 12).getTime() }).bout.kind === 'surprise' && hold('2026-11-24').kind === 'fresh');
  D.rerollBout(D.surpriseBout({ date: '2026-11-24', cfg: { duration: 15, focus: 'Core', difficulty: 'Hard' }, level: 'Hard' }));
  check('SURPRISE ME on a fresh day: still a fresh day, so a repeat day follows', hold('2026-11-25').kind === 'last');
  // A new athlete: the setup's pick first, then a repeat day, then a fresh one.
  store.clear();
  const first = D.pickTodaysBout({ date: '2026-11-23', prevTurn: D.todaysBout({ now: at('2026-11-23', 9).getTime() }).prevTurn, suggestion: { title: 'Fight Focus — 3 Round Starter', actionType: 'fightFocus', actionPayload: 'Boxing', mode: 'fight' } });
  D.holdBout(first);
  check('new athlete: the setup\'s pick, then their last session, then something fresh', first.kind === 'bout' && hold('2026-11-24').kind === 'last' && hold('2026-11-25').kind === 'fresh');
  // The boxes from before.
  store.clear();
  store.set(D.DAILY_MISSION_KEY, JSON.stringify({ date: '2026-11-25', mission: { title: 'One Round: Boxing' }, done: true }));
  check('an old daily mission box (a fresh deal every day): the next day is a repeat day', D.todaysBout({ now: at('2026-11-26', 9).getTime() }).prevTurn === 'fresh' && hold('2026-11-26').kind === 'last');
  store.set(D.DAILY_MISSION_KEY, JSON.stringify({ v: 3, date: '2026-11-25', bout: { date: '2026-11-25', kind: 'last', title: 'Fight Focus' }, done: false }));
  check('a bout held before the turns (the last session): the next day is fresh', D.todaysBout({ now: at('2026-11-26', 9).getTime() }).prevTurn === 'repeat' && hold('2026-11-26').kind === 'fresh');
  store.set(D.DAILY_MISSION_KEY, '{not json');
  check('an unreadable box: a repeat day', D.todaysBout({ now: at('2026-11-26', 9).getTime() }).prevTurn === null && hold('2026-11-26').kind === 'last');

  // A fresh session is never stored as the last session; any other is.
  store.clear();
  L.rememberSession('timer', timer.cfg, 'Boxing');
  const before = store.get('tm_last_session_v1');
  L.rememberSession('timer', a.run.last.cfg, 'Muay Thai');
  L.rememberSession('quick_mission', { duration: 3, focus: 'Core', difficulty: 'Easy', freshBout: date });
  check('last session: a fresh round or a fresh Quick Mission is not stored', store.get('tm_last_session_v1') === before && L.loadLastSession().disc === 'Boxing');
  L.rememberSession('timer', { ...timer.cfg, rounds: 5 }, 'Boxing');
  check('last session: any other session is, as before', L.loadLastSession().cfg.rounds === 5);

  // The bonus on a fresh day: the same rules (started from the card, run to its end, once a day).
  U.addBonusXp(1); store.clear();
  const now = Date.now();
  const fr = D.freshBout({ date: W.localIso(now), profile: fighter, stats: level6 });
  D.holdBout(fr);
  await new Promise((res) => setTimeout(res, 3)); D.armTodaysBout(); await new Promise((res) => setTimeout(res, 3));
  U.addFightFocusSession(1, 1);
  check('fresh day: its 1-round session from START pays +25 once', D.settleTodaysBout() === 25 && D.todaysBout({ stats: U.loadStats() }).done && D.todaysBout().bout.kind === 'fresh');

  // Wiring: Home builds the fresh Quick Mission tagged with its day; App's replay of a timer goes through rememberSession.
  const fs = await import('node:fs');
  const src = (f) => fs.readFileSync(new URL(`../components/training-mode/${f}`, import.meta.url), 'utf8');
  const home = src('HomeDashboard.jsx');
  check('wiring: Home runs a fresh Quick Mission tagged with its day, and passes the turn to the pick', /freshBout: b\?\.date/.test(home) && /r\.type === 'freshQm'/.test(home) && /prevTurn: t\.prevTurn/.test(home));
}

// ── Today's Bout: what pays ──────────────────────────────────────────────────
{
  const today = '2026-11-26';
  const r = (extra) => row(today, 12, extra);
  check('counts: a finished Fight Focus', D.boutRowCounts(r(), today));
  check('counts: not a partial (1 of 3 rounds)', !D.boutRowCounts(r({ completedCount: 1 }), today));
  check('counts: not a refused session', !D.boutRowCounts(r({ unverified: true }), today));
  check('counts: not a zero-work session', !D.boutRowCounts(r({ completedCount: 0, xpEarned: 0 }), today));
  check('counts: not an award row', !D.boutRowCounts(r({ type: 'Mission of the Day', completedCount: 1, totalCount: 1, xpEarned: 25 }), today));
  check('counts: not a row of another day', !D.boutRowCounts(r(), '2026-11-27'));
  check('counts: a Quick Mission at your pace by its own flag (MAX REPS saves fewer sets than slots)', D.boutRowCounts(r({ type: 'Quick Mission', mode: 'solo', completed: true, completedCount: 3, totalCount: 8 }), today) && !D.boutRowCounts(r({ type: 'Quick Mission', mode: 'solo', completed: false, completedCount: 8, totalCount: 8 }), today));
  check('counts: a guided Quick Mission with a skipped move did not run to its end', !D.boutRowCounts(r({ type: 'Quick Mission', completedCount: 5, totalCount: 6 }), today));
  check('counts: Practice, Cardio, a cleared tape, Camp, Combat Conditioning, Combo, Fit',
    ['Practice', 'Training Camp', 'Combat Conditioning', 'Combo Coach', 'Fit Mode'].every((type) => D.boutRowCounts(r({ type }), today))
    && D.boutRowCounts(r({ type: 'Cardio', completedCount: 1, totalCount: 1, completedTimeSeconds: 900 }), today)
    && D.boutRowCounts(r({ type: "Coach's Tapes", kind: 'fit', completedCount: 1, totalCount: 1, xpEarned: 0 }), today));
}

// ── Today's Bout: held for the day, the bonus once ───────────────────────────
{
  const reset = () => { U.addBonusXp(1); store.clear(); }; // a save drops the stats cache; then start empty
  // START on the card: a real session banks well after the tap, never in the same millisecond.
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
  const arm = async () => { await sleep(3); D.armTodaysBout(); await sleep(3); };
  reset();
  const day = at('2026-11-26', 9).getTime();
  const t0 = D.todaysBout({ now: day });
  check('a fresh day holds no bout, not done', t0.bout === null && !t0.done && !t0.saved && t0.date === '2026-11-26');
  const bout = { date: '2026-11-26', kind: 'bout', side: 'fit', title: 'Quick Mission — 12 Min Starter', parts: [], cta: 'START', minutes: 12, why: 'Fits your level', bonusXp: 25, run: { type: 'route', actionType: 'quickMission', payload: { duration: 12 } } };
  check('holding a pick saves it', D.holdBout(bout) && D.todaysBout({ now: day }).saved);
  const other = { ...bout, title: 'Fight Focus', side: 'fight' };
  check('a later pick the same day does not replace it (a reload, another session, a level change)', !D.holdBout(other) && eq(D.todaysBout({ now: day + 6 * 3600000 }).bout, bout));
  U.addFightFocusSession(3, 3);
  check('…not even after a session not started from the card', eq(D.todaysBout({ now: day + 7 * 3600000, stats: U.loadStats() }).bout, bout) && !D.todaysBout({ now: day, stats: U.loadStats() }).done);
  check('a new bout at local midnight', D.todaysBout({ now: at('2026-11-27', 0, 1).getTime() }).bout === null && D.todaysBout({ now: at('2026-11-26', 23, 59).getTime() }).bout !== null);
  const sp = D.surpriseBout({ date: '2026-11-26', cfg: { duration: 15, focus: 'Core', difficulty: 'Hard' }, level: 'Hard' });
  check('SURPRISE ME replaces the held bout for the day (the day keeps its turn)', D.rerollBout(sp) && eq(D.todaysBout({ now: day }).bout, { ...sp, turn: 'pick' }));

  // The bonus: started from the card, run to its end, once a day.
  reset();
  const now = Date.now();
  const iso = W.localIso(now);
  D.holdBout({ ...bout, date: iso });
  check('no START, no bonus: a session not started from the card', (U.addFightFocusSession(3, 3), D.settleTodaysBout()) === 0 && !D.todaysBout({ stats: U.loadStats() }).done);
  await arm();
  U.addBonusXp(5);
  check('an XP-only write is not the card\'s session (the arm stays)', D.settleTodaysBout() === 0 && D.boutArm() !== null);
  U.addHybridTrainingBonus();
  check('an award row is not the card\'s session (the arm stays)', D.settleTodaysBout() === 0 && D.boutArm() !== null);
  U.addFightFocusSession(0, 3, { xp: 0 });
  check('a zero-work session from the card pays nothing, and uses up that START', D.settleTodaysBout() === 0 && D.boutArm() === null);
  await arm(); U.addFightFocusSession(3, 3, { xp: 0, unverified: true });
  check('a refused session from the card pays nothing', D.settleTodaysBout() === 0 && !D.todaysBout({ stats: U.loadStats() }).done);
  await arm(); U.addComboCoachSession(1, 3);
  check('a session stopped short pays nothing', D.settleTodaysBout() === 0);
  U.addFightFocusSession(3, 3);
  check('…nor the next one, not started from the card', D.settleTodaysBout() === 0);
  await arm();
  failWrites = true;
  const xp0 = U.loadStats().xp;
  check('not paid when the done flag cannot be saved', D.settleTodaysBout({ stats: { sessions: [{ ...row(iso), completedAt: new Date().toISOString() }] } }) === 0 && U.loadStats().xp === xp0);
  failWrites = false;
  await arm();
  const before = U.loadStats().xp;
  U.addPracticeSession('Jab', 2, 2, 30);
  const paid = D.settleTodaysBout();
  check('paid once for a valid session from the card that ran to its end (any route: here a Practice drill)', paid === 25 && U.loadStats().xp === before + 30 + 25, `paid ${paid}`);
  const bonusRow = U.loadStats().sessions.at(-1);
  check('…the bonus row is an award tagged with the day, not a training day', bonusRow.type === 'Mission of the Day' && bonusRow.bout === iso && !W.isTrainingRow(bonusRow));
  check('…the card reads done, its bout kept', D.todaysBout({ stats: U.loadStats() }).done && D.todaysBout().bout?.title === bout.title);
  check('…the end screen finds it', D.justDoneDailyMission(Date.now() + 30000)?.xp === 25 && D.justDoneDailyMission(Date.now() + 3600000) === null);
  await arm(); U.addFightFocusSession(3, 3);
  check('…and never again that day (TRAIN AGAIN from the done card)', D.settleTodaysBout() === 0 && U.loadStats().sessions.filter((s) => s.type === 'Mission of the Day').length === 1);

  // SURPRISE ME, then START: paid once.
  reset();
  D.holdBout({ ...bout, date: iso });
  D.rerollBout(D.surpriseBout({ date: iso, cfg: { duration: 15, focus: 'Core', difficulty: 'Hard' }, level: 'Hard' }));
  await arm();
  U.addQuickMissionSoloSession({ xpEarned: 120, completed: true, completedCount: 6, totalCount: 6 });
  const s1 = D.settleTodaysBout();
  await arm();
  U.addQuickMissionSoloSession({ xpEarned: 120, completed: true, completedCount: 6, totalCount: 6 });
  check('SURPRISE ME then START: the surprise pays once', s1 === 25 && D.settleTodaysBout() === 0 && D.todaysBout().bout?.kind === 'surprise');

  // Back on Home: a START that started nothing no longer counts; a session paused since keeps it.
  reset();
  D.armTodaysBout({ now: now - 60000 });
  check('back on Home with a session paused since START: the arm stays', !D.releaseBoutArm({ pausedAt: [now - 30000] }) && D.boutArm() !== null);
  check('back on Home with nothing started (an older pause only): the arm is dropped', D.releaseBoutArm({ pausedAt: [now - 120000] }) && D.boutArm() === null);
  U.addFightFocusSession(3, 3);
  check('…so the next session pays nothing', D.settleTodaysBout() === 0);
  // START, then the card's session paused, then an unrelated session (review fix): not the card's.
  reset();
  D.holdBout({ ...bout, date: iso });
  await arm();
  const pausedTs = Date.now();
  check('pausing the card\'s session holds the arm', D.holdBoutArm(pausedTs) && D.boutArm()?.held === pausedTs);
  check('…a later pause (another session\'s) does not take its place', !D.holdBoutArm(pausedTs + 5) && D.boutArm()?.held === pausedTs);
  await sleep(3); U.addQuickMissionSoloSession({ xpEarned: 120, completed: true, completedCount: 6, totalCount: 6 });
  check('START, pause, an unrelated session run to its end: no bonus, the card not done, the arm kept', D.settleTodaysBout() === 0 && !D.todaysBout({ stats: U.loadStats() }).done && D.boutArm() !== null);
  U.addPracticeSession('Jab', 2, 2, 30);
  check('…nor a Practice drill meanwhile', D.settleTodaysBout() === 0 && D.boutArm() !== null);
  check('resuming another paused session changes nothing', !D.resumeBoutArm(pausedTs - 1) && D.boutArm()?.held === pausedTs);
  check('on Home, the card\'s paused session keeps the arm', !D.releaseBoutArm({ pausedAt: [pausedTs + 5, pausedTs] }) && D.boutArm() !== null);
  await sleep(3);
  check('RESUME of the card\'s session: the arm counts from now', D.resumeBoutArm(pausedTs) && D.boutArm() !== null && D.boutArm().held === undefined);
  await sleep(3); U.addFightFocusSession(3, 3);
  check('…and its own finished row pays, once', D.settleTodaysBout() === 25 && U.loadStats().sessions.filter((s) => s.type === 'Mission of the Day').length === 1);
  // The same, the card's session stopped short: the unrelated full rows banked while it waited are not read.
  reset();
  D.holdBout({ ...bout, date: iso });
  await arm();
  const pausedTs2 = Date.now();
  D.holdBoutArm(pausedTs2);
  await sleep(3); U.addFightFocusSession(3, 3);
  D.settleTodaysBout();
  await sleep(3); D.resumeBoutArm(pausedTs2);
  await sleep(3); U.addComboCoachSession(1, 3);
  check('START, pause, unrelated session, RESUME, stopped short: nothing (the unrelated row is not the card\'s)', D.settleTodaysBout() === 0 && !D.todaysBout({ stats: U.loadStats() }).done && D.boutArm() === null);
  // The card's paused session gone (replaced by another of its kind, or discarded): back on Home the arm goes.
  reset();
  await arm();
  const pausedTs3 = Date.now();
  D.holdBoutArm(pausedTs3);
  check('the card\'s paused session replaced by another: on Home the arm is dropped', D.releaseBoutArm({ pausedAt: [pausedTs3 + 50] }) && D.boutArm() === null);
  // A cloud restore brings rows from another device, newer than the START (review fix).
  reset();
  D.holdBout({ ...bout, date: iso });
  await arm();
  U.addFightFocusSession(3, 3); // stands in for a restored row from another phone
  check('a cloud restore with a newer row: no bonus, the START dropped', D.settleTodaysBout({ restored: true }) === 0 && D.boutArm() === null && !D.todaysBout({ stats: U.loadStats() }).done);
  U.addFightFocusSession(3, 3);
  check('…so the next session pays nothing either', D.settleTodaysBout() === 0);
  {
    const fs = await import('node:fs');
    const src = (f) => fs.readFileSync(new URL(`../components/training-mode/${f}`, import.meta.url), 'utf8');
    const app = src('App.jsx'), cloud = src('data/cloudSync.js');
    check('wiring: the cloud restore marks its event, App passes it on', /CustomEvent\('training-mode-stats-updated', \{ detail: \{ restored: true \} \}\)/.test(cloud) && /settleTodaysBout\(\{ restored: !!e\?\.detail\?\.restored \}\)/.test(app));
    check('wiring: App holds the arm on a pause and releases it on that session\'s RESUME', /if \(weeksOn\) holdBoutArm\(paused\.timestamp\)/.test(app) && /if \(weeksOn\) resumeBoutArm\(ps\.timestamp\)/.test(app));
  }
  // A START from yesterday's card (a session run past midnight) pays nothing today.
  store.set(D.BOUT_ARM_KEY, JSON.stringify({ date: '2026-01-01', at: now - 1000 }));
  U.addFightFocusSession(3, 3);
  check('a START from yesterday\'s card pays nothing today, and is dropped', D.settleTodaysBout() === 0 && !store.has(D.BOUT_ARM_KEY));

  // Never twice across devices.
  reset();
  D.holdBout({ ...bout, date: iso });
  await arm(); U.addFightFocusSession(3, 3);
  check('device A: paid', D.settleTodaysBout() === 25);
  const aBox = store.get(D.DAILY_MISSION_KEY), aStats = store.get('tm_user_stats');
  // Device B restores A's synced keys (the arm is not one of them), then trains from its card.
  reset();
  store.set(D.DAILY_MISSION_KEY, aBox); store.set('tm_user_stats', aStats); U.addBonusXp(0);
  check('the arm is device-local: not in cloud sync', !SYNC_KEYS.includes(D.BOUT_ARM_KEY) && SYNC_KEYS.includes(D.DAILY_MISSION_KEY));
  check('device B shows A\'s bout, done', D.todaysBout({ stats: U.loadStats() }).done && D.todaysBout().bout?.title === bout.title);
  await arm(); U.addFightFocusSession(3, 3);
  check('device B: a synced done flag pays nothing more', D.settleTodaysBout() === 0);
  // A stale box (synced from a device that had not paid) beside A's rows: the tagged bonus row still reads as paid.
  store.set(D.DAILY_MISSION_KEY, JSON.stringify({ v: 3, date: iso, bout: { ...bout, date: iso }, done: false, doneAt: null, xp: 0 }));
  check('a stale box beside the synced rows: the card still reads done', D.todaysBout({ stats: U.loadStats() }).done);
  await arm(); U.addFightFocusSession(3, 3);
  check('…and pays nothing', D.settleTodaysBout() === 0 && U.loadStats().sessions.filter((s) => s.type === 'Mission of the Day').length === 1);

  // The old daily mission's box (before the merge) on the same day.
  reset();
  store.set(D.DAILY_MISSION_KEY, JSON.stringify({ date: iso, mission: { title: 'One Round: Boxing' }, done: true, doneAt: new Date().toISOString(), xp: 25 }));
  const old = D.todaysBout();
  check('an old daily mission box: no bout held (Home picks one), its done flag kept', old.bout === null && old.done && !old.saved);
  D.holdBout({ ...bout, date: iso });
  const box = JSON.parse(store.get(D.DAILY_MISSION_KEY));
  check('…holding the pick keeps done, its time and XP (the strip still finds it)', box.v === 3 && box.done && box.xp === 25 && box.bout.title === bout.title && D.justDoneDailyMission(Date.now() + 1000)?.xp === 25);
  await arm(); U.addFightFocusSession(3, 3);
  check('…and that day\'s bonus does not pay again', D.settleTodaysBout() === 0);
  D.holdBout({ ...bout, date: '2026-11-29' });
  const nb = JSON.parse(store.get(D.DAILY_MISSION_KEY));
  check('a new day\'s bout starts not done', nb.date === '2026-11-29' && !nb.done && nb.doneAt === null && nb.xp === 0);

  // Switch off: the old Mission of the Day bonus row is as it was.
  reset();
  U.addDailyMissionBonus();
  check('switch off: the old bonus row carries no tag', !('bout' in U.loadStats().sessions.at(-1)));
}

// ── cross-feature review fixes (2026-11-23) ─────────────────────────────────
{
  const MS = await import('../components/training-mode/data/missionSolo.js');
  const { generateQuickMission } = await import('../components/training-mode/fit-mode/quickMissionGenerator.js');
  // The daily mission's 3-minute generated Quick Mission, run GUIDED (no settle of its own),
  // tapped through too fast: its screen reads VALIDATION FAILED.
  const gen = generateQuickMission({ duration: 3, focus: 'Full Body', difficulty: 'Easy' });
  const n6 = 6;
  const tooFast = { completed: true, exercisesCompleted: n6, totalExercises: n6, mission: gen, integrityResult: { awardXp: false, validityStatus: 'tooFast', reason: 'Too fast.' } };
  check('refused: a guided generated mission the integrity check refused', gen && gen.v2 !== true && MS.guidedRunRefused(tooFast));
  check('refused: not a clean run', !MS.guidedRunRefused({ ...tooFast, integrityResult: { awardXp: true, validityStatus: 'complete' } }));
  check('refused: not an ordinary early exit (no cheat flag)', !MS.guidedRunRefused({ ...tooFast, completed: false, exercisesCompleted: 1, integrityResult: { awardXp: false, validityStatus: 'partial' } }));
  check('refused: not a run with no integrity result', !MS.guidedRunRefused({ ...tooFast, integrityResult: null }));

  // What App banks for it with the switch on: the row pays as before (old behaviour), marked
  // unverified, so it fills no training day; and, started from Today's Bout, it pays no bonus.
  U.addBonusXp(1); store.clear(); // a save drops the stats cache; then start empty
  const today = Date.now();
  D.armTodaysBout({ now: today - 1000 });
  const refused = MS.guidedRunRefused(tooFast);
  const xp = U.addQuickMissionSession(n6, n6, true, refused ? { unverified: true } : undefined, U.quickMissionXp(n6, n6, true, gen));
  const qmRow = U.loadStats().sessions.at(-1);
  check('refused: its row still banks its XP, marked unverified', xp > 0 && qmRow.xpEarned === xp && qmRow.unverified === true);
  check('refused: …and fills no training day', !W.isTrainingRow(qmRow) && S.loadWeekStreak(today).thisWeek.done === 0);
  const xpBefore = U.loadStats().xp;
  check('refused: …and pays no Today\'s Bout bonus', D.settleTodaysBout({ now: today }) === 0 && U.loadStats().xp === xpBefore && !store.has(D.DAILY_MISSION_KEY));

  // Combat Conditioning: its screen can read VALIDATION FAILED while App banks the drills' XP (old).
  // With the switch on App marks that row unverified, so a refused session from Today's Bout pays nothing.
  const ccTooFast = { drillsCompleted: 6, totalDrills: 6, integrityResult: { awardXp: false, validityStatus: 'tooFast', reason: 'Too fast.' } };
  check('refused CC: the screen\'s own verdict', MS.combatRunRefused(ccTooFast, 'Normal') && !MS.combatRunRefused({ ...ccTooFast, integrityResult: { awardXp: true, validityStatus: 'complete' } }, 'Normal') && !MS.combatRunRefused({ ...ccTooFast, integrityResult: null }, 'Normal'));
  U.addBonusXp(1); store.clear();
  await new Promise((res) => setTimeout(res, 3)); D.armTodaysBout(); await new Promise((res) => setTimeout(res, 3));
  U.addCombatConditioningSession(6, 6, 3, 3, true, { unverified: true });
  const ccRow = U.loadStats().sessions.at(-1);
  check('refused CC: its row is marked unverified, fills no training day, pays no bonus', ccRow.unverified === true && ccRow.xpEarned > 0 && !W.isTrainingRow(ccRow) && D.settleTodaysBout() === 0);
  U.addCombatConditioningSession(6, 6, 3, 3, true);
  check('switch off: the CC row is as before (no flag)', !('unverified' in U.loadStats().sessions.at(-1)));

  // A cardio finisher banks its Cardio row after the session's, before the end screen mounts.
  U.addBonusXp(1); store.clear();
  U.addQuickMissionSession(n6, n6, true, undefined, U.quickMissionXp(n6, n6, true, gen));
  U.addCardioSession({ completedTimeSeconds: 600, methodLabel: 'Run' });
  const stripFin = S.takeEndScreenStrip(Date.now(), { finisher: true });
  check('finisher: the end screen still shows today\'s strip', stripFin?.moment?.done === 1 && W.momentCopy(stripFin.moment).title === 'TRAINING DAY 1 OF 4', JSON.stringify(stripFin));
  check('finisher: without the flag the Cardio row reads as a second session (the old miss)', S.takeEndScreenStrip(Date.now()) === null);
}

// ── the week streak where the day streak was (owner, 2026-11-23) ─────────────
// Profile, Progress, the Level page, the share card and the come-back reminder
// show the week streak with the switch on; with it off, as before.
{
  // The come-back reminder's streak case.
  const wk = (streak, done, target, todayIndex) => ({ streak, thisWeek: { done, target, todayIndex } });
  check('at stake: a streak, 1 day still to get, days left', eq(W.streakAtStake(wk(9, 3, 4, 3)), { streak: 9, need: 1 }));
  check('at stake: not without a streak', W.streakAtStake(wk(0, 1, 4, 2)) === null);
  check('at stake: not once this week is on target', W.streakAtStake(wk(9, 4, 4, 2)) === null && W.streakAtStake(wk(9, 5, 4, 5)) === null);
  check('at stake: not when the days left cannot get there (Sunday, 2 to go)', W.streakAtStake(wk(9, 2, 4, 6)) === null && eq(W.streakAtStake(wk(9, 3, 4, 6)), { streak: 9, need: 1 }));
  check('at stake: Monday counts today', eq(W.streakAtStake(wk(3, 0, 4, 0)), { streak: 3, need: 4 }));
  check('reminder line: the week streak and the days, plain', W.streakReminderCopy({ streak: 9, need: 2 }) === '9-week streak: 2 more days this week.'
    && W.streakReminderCopy({ streak: 1, need: 1 }) === '1-week streak: 1 more day this week.' && W.streakReminderCopy(null) === null);
  check('reminder line: no guilt words', !/(lose|losing|break|fail|miss)/i.test(W.streakReminderCopy({ streak: 9, need: 2 })));

  // The reminder itself, on the real clock: trained yesterday, a long week streak behind.
  const R = await import('../components/training-mode/data/reminderEngine.js');
  U.addBonusXp(1); store.clear();
  const now = Date.now();
  const today = W.localIso(now);
  const yIso = W.addDaysIso(today, -1);
  const mon = W.weekStartIso(today);
  const rows = [];
  for (let k = 1; k <= 9; k++) for (const i of [0, 1, 2, 3]) rows.push(row(W.addDaysIso(W.addDaysIso(mon, -7 * k), i), 12));
  rows.push(row(yIso, 12));
  store.set('tm_user_stats', JSON.stringify({ xp: 0, sessions: rows })); U.addBonusXp(0);
  store.set('tm_user_stats', JSON.stringify({ xp: 0, sessions: rows }));
  const week = S.loadWeekStreak(now);
  const stake = W.streakAtStake(week);
  const r = R.getDashboardReminder({ weeks: true });
  check('reminder (switch on): the week streak\'s case when the week is at stake, else not the streak case',
    stake ? (r.category === 'streak' && r.message === W.streakReminderCopy(stake) && r.actionLabel === 'Keep Streak' && r.streak === week.streak)
      : (r?.category !== 'streak'), JSON.stringify({ r, stake, week: week.thisWeek, streak: week.streak }));
  check('reminder (switch on): the streak is the week streak, not the day count', week.streak >= 9);
  const off = R.getDashboardReminder();
  check('reminder (switch off): the old day streak case, its old lines', off.category === 'streak' && off.streak === U.getStreak(U.loadStats()) && !/week streak/.test(off.message));
  // A week streak with this week's target already met: no streak case.
  const met = [...rows];
  for (let i = 0; i < 7; i++) { const d = W.addDaysIso(mon, i); if (d < today && d !== yIso) met.push(row(d, 12)); }
  store.set('tm_user_stats', JSON.stringify({ xp: 0, sessions: met })); U.addBonusXp(0); store.set('tm_user_stats', JSON.stringify({ xp: 0, sessions: met }));
  const w2 = S.loadWeekStreak(now);
  check('reminder (switch on): this week already on target, so no streak case', w2.thisWeek.done >= w2.thisWeek.target ? R.getDashboardReminder({ weeks: true })?.category !== 'streak' : true);
  check('weekStreakCount is the week streak', S.weekStreakCount(now) === S.loadWeekStreak(now).streak && S.weekStreakCount(now, []) === 0);

  // The share text.
  const SU = await import('../components/training-mode/data/shareUtils.js');
  const txt = (extra) => SU.buildShareText({ mode: 'Fight Focus', xpEarned: 90, ...extra });
  check('share text: the week streak in weeks', /Streak: 9 weeks/.test(txt({ streak: 9, streakUnit: 'week' })) && /Streak: 1 week\n/.test(txt({ streak: 1, streakUnit: 'week' })));
  check('share text (switch off): days, as before', /Streak: 9 days/.test(txt({ streak: 9 })) && !/Streak/.test(txt({ streak: 0, streakUnit: 'week' })));

  // Wiring: every screen that showed the day streak reads the week streak under the switch.
  const fs = await import('node:fs');
  const src = (f) => fs.readFileSync(new URL(`../components/training-mode/${f}`, import.meta.url), 'utf8');
  check('wiring: Profile\'s tile', /weeksOn \? weekStreakCount\(Date\.now\(\), stats\.sessions\) : getStreak\(stats\)/.test(src('Profile.jsx')) && /weeksOn \? 'WEEK STREAK' : 'STREAK'/.test(src('Profile.jsx')));
  check('wiring: Progress\'s rank card', /weeksOn \? weekStreakCount\(Date\.now\(\), stats\.sessions\) : getStreak\(stats\)/.test(src('ProgressScreen.jsx')) && /WEEK STREAK/.test(src('ProgressScreen.jsx')));
  check('wiring: the Level page', /weekStreak: weekStreakCount\(/.test(src('LevelView.jsx')));
  check('wiring: the end screen hands the share card the week streak', /weeksOn \? weekStreakCount\(Date\.now\(\), stats0\.sessions\) : getStreak\(stats0\)/.test(src('shared/MissionComplete.jsx')) && /streakUnit: 'week'/.test(src('shared/MissionComplete.jsx')));
  check('wiring: the share card (end screens, Cardio, ghost battles) labels it WEEK STREAK', /streakLabel: 'WEEK STREAK'/.test(src('SharePromptModal.jsx')) && /streakLabel: 'WEEK STREAK'/.test(src('shared/GhostResultScreen.jsx'))
    && (src('data/shareCard.js').match(/data\.streakLabel \|\| 'DAY STREAK'/g) || []).length === 2);
  check('wiring: Home\'s come-back reminder gets the switch', /<ReminderCard[\s\S]{0,120}weeks=\{weeksOn\}/.test(src('HomeDashboard.jsx')) && /getDashboardReminder\(\{ weeks \}\)/.test(src('shared/ReminderCard.jsx')));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

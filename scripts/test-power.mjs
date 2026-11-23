// POWER, RUSTY and REVIVE (retention, switch `power`): the thresholds (full for
// days 0 to 3, the straight drain to 0% at day 28, 'low' at 40% or less,
// RUSTY from day 30), local-day edges and far time zones, a brand-new athlete,
// refused / zero-work / award rows left out, the rusty spell's key, the low
// notice once per drain, the revive found once, and that nothing in XP,
// levels or the week streak changes (only the shown markers are written).
// Run with `npm run test:power`.
import fs from 'node:fs';

const store = new Map();
const ls = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
globalThis.localStorage = ls;
globalThis.window = { localStorage: ls, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } };
globalThis.Event = globalThis.Event || class { constructor(t) { this.type = t; } };

process.env.TZ = 'America/New_York';

const P = await import('../components/training-mode/data/power.js');
const PS = await import('../components/training-mode/data/powerStore.js');
const W = await import('../components/training-mode/data/weekStreak.js');
const U = await import('../components/training-mode/data/userStats.js');
const { SYNC_KEYS } = await import('../components/training-mode/data/cloudSync.js');

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}  ${extra}`); } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// A local wall-clock time in the current TZ.
const at = (iso, hh = 12, mm = 0) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d, hh, mm); };
let n = 0;
const row = (iso, hh = 12, extra = {}) => ({ id: `r${++n}`, type: 'Fight Focus', completedAt: at(iso, hh).toISOString(), completedCount: 3, totalCount: 3, xpEarned: 80, ...extra });
const TODAY = '2026-11-23';
const NOW = at(TODAY, 10).getTime();
const ago = (days) => W.addDaysIso(TODAY, -days);

// ── the thresholds ─────────────────────────────────────────────────────────
{
  const p = (d) => P.powerAt([row(ago(d))], NOW);
  for (const d of [0, 1, 2, 3]) check(`day ${d}: full, 100%`, p(d).state === 'full' && p(d).pct === 100 && p(d).daysSince === d);
  check('day 4: draining, 96%', p(4).state === 'draining' && p(4).pct === 96);
  check('day 10: 72%', p(10).pct === 72 && p(10).state === 'draining');
  check('day 17: 44%, still draining', p(17).pct === 44 && p(17).state === 'draining');
  check('day 18: 40%, low', p(18).pct === 40 && p(18).state === 'low');
  check('day 19: 36%, low', p(19).pct === 36 && p(19).state === 'low');
  check('day 28: 0%, low', p(28).pct === 0 && p(28).state === 'low');
  check('day 29: 0%, low (not RUSTY yet)', p(29).pct === 0 && p(29).state === 'low');
  check('day 30: RUSTY', p(30).state === 'rusty' && p(30).pct === 0 && p(30).daysSince === 30);
  check('day 34: RUSTY, 34 days since', p(34).state === 'rusty' && p(34).daysSince === 34 && p(34).lastDay === ago(34));
  // A straight line: 4 points a day from day 3 to day 28.
  let straight = true;
  for (let d = 3; d < 28; d++) if (P.pctAfter(d) - P.pctAfter(d + 1) !== 4) straight = false;
  check('a straight drain: 4% a day from day 3 to day 28', straight);
  check('the newest training day counts, not the first', P.powerAt([row(ago(40)), row(ago(2))], NOW).state === 'full');
  check('a row dated after today counts from its own day', P.powerAt([row(ago(20)), row(W.addDaysIso(TODAY, 2))], NOW).daysSince === 20);
}

// ── local-day edges ────────────────────────────────────────────────────────
{
  // Trained at 23:30 four days ago, now 00:30: only 3 days and an hour, but 4 local days.
  const late = [{ ...row(ago(4)), completedAt: at(ago(4), 23, 30).toISOString() }];
  check('local days, not hours: 23:30 four days ago is day 4 at 00:30', P.powerAt(late, at(TODAY, 0, 30).getTime()).daysSince === 4);
  const early = [{ ...row(ago(3)), completedAt: at(ago(3), 0, 5).toISOString() }];
  check('…and 00:05 three days ago is still day 3 at 23:55 (full)', P.powerAt(early, at(TODAY, 23, 55).getTime()).state === 'full');
  // The day RUSTY starts: at local midnight, not 30 × 24 hours later.
  const r30 = [{ ...row(ago(30)), completedAt: at(ago(30), 23, 50).toISOString() }];
  check('RUSTY from the local day 30 begins (00:01)', P.powerAt(r30, at(TODAY, 0, 1).getTime()).state === 'rusty');
  const r29 = [{ ...row(ago(29)), completedAt: at(ago(29), 0, 10).toISOString() }];
  check('…and not on day 29 at 23:59', P.powerAt(r29, at(TODAY, 23, 59).getTime()).state === 'low');
  // A daylight-saving change (1 November 2026 in New York) moves no day.
  check('across the clock change: 1 Oct to 5 Nov is 35 days', P.daysBetween('2026-10-01', '2026-11-05') === 35);
  check('a spring change too: 1 Mar to 15 Mar is 14 days', P.daysBetween('2027-03-01', '2027-03-15') === 14);
}

// ── far time zones: the same instant is a different local day ──────────────
{
  const instant = '2026-11-01T11:00:00.000Z';
  const r = [{ ...row('2026-11-01'), completedAt: instant }];
  // Now: 1 December 10:30 UTC, which is the 2nd at 00:30 in UTC+14 and the 30th at 23:30 in UTC-11.
  const nowUtc = Date.parse('2026-12-01T10:30:00.000Z');
  process.env.TZ = 'Pacific/Kiritimati'; // UTC+14: the row is 2 November, 01:00
  const k = P.powerAt(r, nowUtc);
  check('UTC+14: the row is the 2nd and now the 2nd of December, local: 30 days, RUSTY', k.lastDay === '2026-11-02' && k.daysSince === 30 && k.state === 'rusty', JSON.stringify(k));
  process.env.TZ = 'Pacific/Pago_Pago'; // UTC-11: the row is 1 November, 00:00
  const s = P.powerAt(r, nowUtc);
  check('UTC-11: the same two instants are the 1st and the 30th, local: 29 days, low', s.lastDay === '2026-11-01' && s.daysSince === 29 && s.state === 'low', JSON.stringify(s));
  process.env.TZ = 'America/New_York';
}

// ── a brand-new athlete, and rows that do not count ────────────────────────
{
  const fresh = P.powerAt([], NOW);
  check('a brand-new athlete: new, 100%, no days', fresh.state === 'new' && fresh.pct === 100 && fresh.daysSince === null && fresh.lastDay === null);
  check('…gets no low notice and no RUSTY pop-up', P.lowNotice(fresh) === null && P.rustyPopup(fresh) === null);
  check('…and no power notice on Home', P.powerNotice([], NOW, {}) === null);
  const junk = [
    { id: 'b', type: 'Mission of the Day', completedAt: at(ago(1)).toISOString(), completedCount: 1, xpEarned: 25 },
    { id: 's', type: 'Start Here', completedAt: at(ago(1)).toISOString(), xpEarned: 50 },
    { ...row(ago(1)), unverified: true },
    { ...row(ago(1)), completedCount: 0, xpEarned: 0 },
    { ...row(ago(1)), xpEarned: 0 },
    { id: 'c', type: 'Cardio', completedAt: at(ago(1)).toISOString(), xpEarned: 10, completedTimeSeconds: 0 },
    { id: 'x', type: 'Fight Focus' },
  ];
  check('only award, refused and no-work rows: still new', P.powerAt(junk, NOW).state === 'new');
  const old = P.powerAt([row(ago(40)), ...junk], NOW);
  check('award, refused and zero-work rows do not refill power: RUSTY, 40 days', old.state === 'rusty' && old.daysSince === 40);
  check('…and do not revive', P.homeRevive([row(ago(40)), ...junk], NOW, {}) === null);
  check('a cleared Coach\'s Tape paid 0 XP is a training day', P.powerAt([row(ago(40)), { id: 't', type: "Coach's Tapes", completedAt: at(ago(1)).toISOString(), xpEarned: 0, completed: true }], NOW).daysSince === 1);
}

// ── the rusty spell, the low drain: once each ──────────────────────────────
{
  const rusty = P.powerAt([row(ago(34))], NOW);
  const pop = P.rustyPopup(rusty, {});
  check('RUSTY: the pop-up is due, keyed by the last training day', pop && pop.id === `rusty:${ago(34)}` && pop.daysSince === 34);
  check('…once per rusty spell', P.rustyPopup(rusty, { seen: [pop.id] }) === null);
  check('…the same spell a week later: still shown', P.rustyPopup(P.powerAt([row(ago(34))], at(W.addDaysIso(TODAY, 7), 10).getTime()), { seen: [pop.id] }) === null);
  const next = P.powerAt([row(ago(80)), row(ago(34))], NOW);
  check('a later spell has its own key', P.rustyPopup(next, { seen: [`rusty:${ago(80)}`] })?.id === `rusty:${ago(34)}`);
  check('no pop-up while low or draining', P.rustyPopup(P.powerAt([row(ago(20))], NOW), {}) === null && P.rustyPopup(P.powerAt([row(ago(8))], NOW), {}) === null);
  const low = P.powerAt([row(ago(19))], NOW);
  const ln = P.lowNotice(low, {});
  check('low: the notice, keyed by the drain', ln && ln.id === `low:${ago(19)}` && ln.pct === 36);
  check('…once per drain (the next day, still low, nothing)', P.lowNotice(P.powerAt([row(ago(19))], at(W.addDaysIso(TODAY, 1), 10).getTime()), { seen: [ln.id] }) === null);
  check('…not while draining or RUSTY', P.lowNotice(P.powerAt([row(ago(17))], NOW), {}) === null && P.lowNotice(rusty, {}) === null);
  // Review F2: no number in the notice (the POWER line right above shows it).
  check('the low notice copy, with no number', P.powerNoticeCopy(ln).replace(/\u00A0/g, ' ') === 'Your POWER is running low. One session revives it.' && !/\d/.test(P.powerNoticeCopy(ln)), P.powerNoticeCopy(ln));
  check('…and a narrow line breaks only between its two sentences', P.powerNoticeCopy(ln).split(' ').length === 2);
  const c = P.rustyCopy(rusty);
  check('the RUSTY copy', c.title === 'RUSTY' && c.since === '34 days since your last session.' && c.kept === 'Your level, XP, streak and badges are all still here.');
}

// ── the revive ─────────────────────────────────────────────────────────────
{
  const justNow = () => ({ ...row(TODAY), completedAt: new Date(NOW - 60000).toISOString() });
  const back = [row(ago(35)), justNow()];
  const m = P.reviveMoment({ rows: back, now: NOW });
  check('end screen: the session after a RUSTY spell revives', m && m.from === 'rusty' && m.daysSince === 35 && m.id === `revive:${ago(35)}` && m.day === TODAY);
  check('…once per revive', P.reviveMoment({ rows: back, now: NOW, shown: { seen: [m.id] } }) === null);
  check('the power is full right after', P.powerAt(back, NOW).state === 'full' && P.powerAt(back, NOW).pct === 100);
  const fromLow = P.reviveMoment({ rows: [row(ago(20)), justNow()], now: NOW });
  check('after a low drain (20 days): revives from low', fromLow && fromLow.from === 'low');
  check('after 18 days (40%, low): revives', P.reviveMoment({ rows: [row(ago(18)), justNow()], now: NOW })?.from === 'low');
  check('after 17 days (44%, draining): no revive line', P.reviveMoment({ rows: [row(ago(17)), justNow()], now: NOW }) === null);
  check('a brand-new athlete\'s first session is no revive', P.reviveMoment({ rows: [justNow()], now: NOW }) === null);
  check('a second session the same day: no second line', P.reviveMoment({ rows: [row(ago(35)), row(TODAY, 8), justNow()], now: NOW }) === null);
  check('a session banked long ago today: not this end screen', P.reviveMoment({ rows: [row(ago(35)), { ...row(TODAY), completedAt: new Date(NOW - 40 * 60000).toISOString() }], now: NOW }) === null);
  check('a refused session does not revive (the end screen of it shows none)', P.reviveMoment({ rows: [row(ago(35)), { ...justNow(), unverified: true }], now: NOW }) === null);
  const main = { ...row(TODAY, 9, { type: 'Quick Mission' }), completedAt: new Date(NOW - 12 * 60000).toISOString() };
  const fin = { id: 'fin', type: 'Cardio', completedAt: new Date(NOW - 60000).toISOString(), completedCount: 1, totalCount: 1, xpEarned: 30, completedTimeSeconds: 600 };
  check('a session with a cardio finisher still shows its revive', P.reviveMoment({ rows: [row(ago(35)), main, fin], now: NOW, finisher: true })?.from === 'rusty');
  // On Home (a session that ended with no YOUR PROGRESS card).
  const h = P.homeRevive([row(ago(35)), row(TODAY, 8)], NOW, {});
  check('Home: a revive today not yet shown', h && h.id === `revive:${ago(35)}`);
  check('Home: …once (the end screen or Home marked it)', P.homeRevive([row(ago(35)), row(TODAY, 8)], NOW, { seen: [h.id] }) === null);
  check('Home: a revive yesterday still shows', P.homeRevive([row(ago(36)), row(ago(1))], NOW, {})?.from === 'rusty');
  check('Home: two days ago is news to nobody', P.homeRevive([row(ago(37)), row(ago(2))], NOW, {}) === null);
  check('Home: a revive comes before a low notice', P.powerNotice([row(ago(35)), row(TODAY, 8)], NOW, {})?.kind === 'revive');
  check('Home: the revive copy', P.powerNoticeCopy({ kind: 'revive' }) === 'Revived: your fighter is back to 100% power.');
  check('the end-screen line', P.REVIVE_LINE === 'REVIVED · POWER 100%');
}

// ── the store: markers only, and nothing earned changes ────────────────────
{
  store.clear();
  U.invalidateStatsCache?.();
  const rows = [row(ago(70)), row(ago(66)), row(ago(64)), row(ago(34))];
  const stats = { xp: 4321, sessions: rows };
  store.set('tm_user_stats', JSON.stringify(stats));
  U.invalidateStatsCache?.();
  const before = new Map(store);
  const lvl = U.getLevel(U.loadStats().xp);
  const wk = W.computeWeekStreak(U.loadStats().sessions, { target: 4, targets: [] }, NOW);
  const due = PS.dueRustyPopup(NOW);
  check('store: RUSTY is due from the saved rows', due && due.id === `rusty:${ago(34)}`);
  PS.markPowerMoments([due.id]);
  check('store: …and not after it was shown', PS.dueRustyPopup(NOW) === null);
  PS.takePowerNotice(NOW); PS.takeReviveMoment(NOW); PS.loadPower(NOW);
  const changed = [...store.keys()].filter((k) => store.get(k) !== before.get(k));
  check('only the shown markers are written (tm_power_moments_v1)', eq(changed, ['tm_power_moments_v1']), JSON.stringify(changed));
  check('the stats row is byte for byte the same', store.get('tm_user_stats') === before.get('tm_user_stats'));
  U.invalidateStatsCache?.();
  check('XP and level unchanged', U.loadStats().xp === 4321 && U.getLevel(U.loadStats().xp) === lvl);
  check('the week streak unchanged', eq(W.computeWeekStreak(U.loadStats().sessions, { target: 4, targets: [] }, NOW), wk));
  check('power.js writes nothing and imports no store', !/localStorage|safeSetItem|userStats|addXp|saveStats/.test(fs.readFileSync(new URL('../components/training-mode/data/power.js', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '')));
  for (let i = 0; i < 30; i++) PS.markPowerMoments([`low:x${i}`]);
  check('the markers are capped (24)', PS.loadPowerMoments().seen.length === 24);
  store.set('tm_power_moments_v1', '{not json');
  check('an unreadable marker key reads as nothing shown', eq(PS.loadPowerMoments(), { seen: [] }));
  check('tm_power_moments_v1 is synced (cloudSync SYNC_KEYS)', SYNC_KEYS.includes('tm_power_moments_v1'));
  const flags = fs.readFileSync(new URL('../components/training-mode/data/retentionFlags.js', import.meta.url), 'utf8');
  check('the power switch is off for everyone', /FOR_EVERYONE = \{[^}]*\bpower: false/.test(flags));
}

// ── the wiring: the open's one pop-up turn, REVIVE is the top START ───────
{
  const src = (f) => fs.readFileSync(new URL(`../components/training-mode/${f}`, import.meta.url), 'utf8');
  const app = src('App.jsx');
  const open = app.slice(app.indexOf('goAfterSplash:'), app.indexOf('completeOnboarding:'));
  const at = (k) => open.indexOf(k);
  const rest = app.slice(app.indexOf('const openQueueRest = () => {'), app.indexOf('const actions = {'));
  const rat = (k) => rest.indexOf(k);
  check('App: RUSTY takes a turn in the open queue, after a friend\'s haunt and before the rest of it',
    at('unseenHaunt()') >= 0 && at('dueRustyPopup()') > at('unseenHaunt()') && at('openQueueRest()') > at('dueRustyPopup()'));
  check('App: the rest of the queue, in order: the ghost offer, the concept drop, the comeback, the weekly lesson',
    rat('maybeOfferChallenge(') >= 0 && rat('maybeOfferChallenge(') < rat('dueConceptPopup()') && rat('dueConceptPopup()') < rat('dueComeback()') && rat('dueComeback()') < rat('shouldShowWeekly('));
  check('App: …only with the power switch, and returns (one interstitial per open)', /if \(powerOn && [^)]*dueRustyPopup\(\)\) \{ rustyTurnRef\.current = true; setRustyTurn\(true\); return; \}/.test(open));
  // Regression (review F1): a turn Home could not use (a paused session, the
  // guide) was spent: the ghost offer, the drop, the comeback and the lesson
  // were all skipped for that open. Now App runs the rest of the queue.
  const done = app.slice(app.indexOf('const onRustyDone = (shown) => {'));
  check('App: a RUSTY turn Home did not use runs the rest of the queue (unless an App pop-up is up), once',
    /if \(!rustyTurnRef\.current\) return;\s*rustyTurnRef\.current = false;\s*setRustyTurn\(false\);\s*if \(!shown && !appPopupOpen\) openQueueRest\(\);/.test(done.slice(0, 400))
    && /onRustyDone=\{onRustyDone\}/.test(app));
  check('App: the pop-up waits behind any App pop-up', /appPopupOpen = !!\(showParqGate \|\| hauntIntro \|\| ghostView \|\| comeback \|\| conceptPopup \|\| practiceInvite \|\| pathTour \|\| pendingChallenge\)/.test(app));
  const home = src('HomeDashboard.jsx');
  check('Home: REVIVE runs the top card\'s START (Today\'s Bout\'s, armed, so its bonus rules apply)', /const startTop = \(\) => \{\s*if \(b\) \{ armBout\(\); runBout\(b\.run\); return; \}\s*card\.onGo\?\.\(\);/.test(home) && /onRevive=\{\(\) => \{ setRustyPop\(null\); startTop\(\); \}\}/.test(home));
  check('Home: never over a paused session, the guide or an App pop-up', /const due = powerOn && !pausedSession && !helpOpen && !appPopupOpen \? dueRustyPopup\(\) : null;/.test(home) && /rustyPop && !appPopupOpen && !helpOpen &&/.test(home));
  check('Home: answers the turn with whether the pop-up showed', /if \(due\) \{ markPowerMoments\(\[due\.id\]\); setRustyPop\(due\); \}\s*onRustyDone\?\.\(!!due\);/.test(home));
  const pop = src('retention/ui/RustyPopup.jsx');
  check('the pop-up eats the click after REVIVE and LATER, and ignores its first moment', /swallowNextClick\(\); onRevive/.test(pop) && /swallowNextClick\(\); onLater/.test(pop) && /GUARD_MS/.test(pop));
  check('no spoken line: nothing in the POWER UI speaks', !/speak|voiceCoach|playClip|say\(/.test(['retention/ui/RustyPopup.jsx', 'retention/ui/PowerLine.jsx', 'retention/ui/ReviveLine.jsx', 'retention/ui/RustyLook.jsx', 'data/power.js', 'data/powerStore.js'].map(src).join('\n').replace(/\/\/.*$/gm, '')));
}

// ── the copy: plain, true, no guilt, app names only ────────────────────────
{
  const BANNED = /goku|vegeta|saiyan|dragon ball|saitama|batman|street fighter|mario|nintendo|ryu\b|ken\b/i;
  const GUILT = /lost|failed|broke|shame|lazy|miss(ed)? out|don't let|punish|penalt/i;
  const c = P.rustyCopy({ daysSince: 34 });
  const all = [c.title, c.since, c.kept, P.REVIVE_LINE, P.powerNoticeCopy({ kind: 'low', pct: 36 }), P.powerNoticeCopy({ kind: 'revive' })];
  check('copy: no franchise names', !all.some((t) => BANNED.test(t)));
  check('copy: no guilt words', !all.some((t) => GUILT.test(t)), all.find((t) => GUILT.test(t)));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

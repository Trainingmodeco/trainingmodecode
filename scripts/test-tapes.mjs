// Coach's Tapes: link parsing, the pending record and its expiry, the
// comeback unlocks, XP quotes and the daily caps, shelf counts, and the
// owner-only gate. Run with `npm run test:tapes`.
const store = new Map();
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
};
const T = await import('../components/training-mode/data/tapes.js');
const U = await import('../components/training-mode/data/userStats.js');

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}  ${extra}`); } };
const reset = () => store.clear();
const MIN = 60 * 1000;
const t0 = new Date('2026-11-02T18:00:00').getTime();

// ── gate ────────────────────────────────────────────────────────────────────
reset();
check('hidden from users', T.tapesEnabled() === false);
store.set('tm_owner_preview', '1');
check('owner preview shows the shelf', T.tapesEnabled() === true);

// ── links ───────────────────────────────────────────────────────────────────
check('parse: watch URL', T.parseYoutubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s') === 'dQw4w9WgXcQ');
check('parse: youtu.be', T.parseYoutubeId('https://youtu.be/dQw4w9WgXcQ?si=abc') === 'dQw4w9WgXcQ');
check('parse: shorts and live', T.parseYoutubeId('https://youtube.com/shorts/dQw4w9WgXcQ') === 'dQw4w9WgXcQ' && T.parseYoutubeId('https://www.youtube.com/live/dQw4w9WgXcQ') === 'dQw4w9WgXcQ');
check('parse: bare id', T.parseYoutubeId(' dQw4w9WgXcQ ') === 'dQw4w9WgXcQ');
check('parse: junk is null', T.parseYoutubeId('not a link') === null && T.parseYoutubeId('') === null);
const bag = T.tapeById('bag-01');
check('no video until a link is set', T.tapeVideoId(bag) === null);
check('owner link sets the video', T.setTapeLink('bag-01', 'https://youtu.be/dQw4w9WgXcQ') === 'dQw4w9WgXcQ' && T.tapeVideoId(bag) === 'dQw4w9WgXcQ');
check('url with a start time', T.youtubeUrl('dQw4w9WgXcQ', 90) === 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90s');
check('the linked tape is featured', T.featuredTape().id === 'bag-01');
check('a bad paste keeps the link', T.setTapeLink('bag-01', 'https://www.youtube.com/playlist?list=PLx1y2z3') === null && T.tapeVideoId(bag) === 'dQw4w9WgXcQ');
check('clearing the link', T.setTapeLink('bag-01', '') === '' && T.tapeVideoId(bag) === null);
check('no link: the first tape is featured', T.featuredTape().id === T.TAPES[0].id);

// ── pending + comeback ──────────────────────────────────────────────────────
reset(); store.set('tm_owner_preview', '1');
T.startTape('bag-01', t0);
check('pending after PLAY', T.pendingTape(t0 + MIN)?.id === 'bag-01');
let r = T.returnState(T.pendingTape(t0 + 3 * MIN), t0 + 3 * MIN);
check('3 min in: nothing unlocked yet', r && !r.canClear && !r.canPartial && r.awayMin === 3 && r.partialInMin === 3);
r = T.returnState(T.pendingTape(t0 + 7 * MIN), t0 + 7 * MIN);
check('7 min in: PARTIAL open, CLEARED counting down', r.canPartial && !r.canClear && r.clearInMin === 8);
r = T.returnState(T.pendingTape(t0 + 15 * MIN), t0 + 15 * MIN);
check('15 min in (60% of 24): CLEARED open', r.canClear);
check('pending expires after 6 h', T.pendingTape(t0 + 7 * 60 * MIN) === null);
T.startTape('bag-01', t0); T.clearPending();
check('CANCEL drops the pending record', T.pendingTape(t0 + MIN) === null);
T.startTape('bag-01', t0);
check('fresh pending is not seen', !T.pendingTape(t0 + MIN).seen);
T.markPendingSeen();
check('seen once the bar shows', T.pendingTape(t0 + MIN).seen === true);
T.snoozePending(t0 + 5 * MIN);
check('NOT YET keeps the tape pending', T.pendingTape(t0 + 6 * MIN)?.snoozedAt === t0 + 5 * MIN && T.pendingTape(t0 + 6 * MIN).id === 'bag-01');

// ── XP ──────────────────────────────────────────────────────────────────────
reset(); store.set('tm_owner_preview', '1');
check('3 XP a minute', T.tapeXp(bag) === 72 && T.tapeXp(T.tapeById('shadow-01')) === 66);
check('quote: cleared / partial / skip', T.quoteTape('bag-01', 'cleared', t0) === 72 && T.quoteTape('bag-01', 'partial', t0) === 36 && T.quoteTape('bag-01', 'skip', t0) === 0);
T.startTape('bag-01', t0);
let s = T.settleTape('bag-01', 'cleared', t0 + 20 * MIN);
check('cleared pays and clears pending', s.xp === 72 && s.reason === null && T.pendingTape(t0 + 21 * MIN) === null);
check('XP lands in the stats as a Fight-side tape session', U.loadStats().xp === 72 && U.loadStats().sessions.at(-1).type === "Coach's Tapes" && U.loadStats().sessions.at(-1).kind === 'fight');
T.startTape('bag-01', t0 + 30 * MIN);
s = T.settleTape('bag-01', 'cleared', t0 + 60 * MIN);
check('same tape again today: logged, no XP', s.xp === 0 && s.reason === 'repeat' && U.loadStats().xp === 72);
T.startTape('bw-01', t0 + 70 * MIN); s = T.settleTape('bw-01', 'partial', t0 + 90 * MIN);
check('second tape today pays (partial = half)', s.xp === 45 && U.loadStats().sessions.at(-1).kind === 'fit' && U.loadStats().xp === 117);
T.startTape('kb-01', t0 + 100 * MIN); s = T.settleTape('kb-01', 'cleared', t0 + 130 * MIN);
check('third paid clear in a day is capped', s.xp === 0 && s.reason === 'daily_cap');
const t1 = t0 + 24 * 60 * MIN;
T.startTape('kb-01', t1); s = T.settleTape('kb-01', 'cleared', t1 + 20 * MIN);
check('next day pays again', s.xp === 75);
T.startTape('cond-01', t1 + 30 * MIN); s = T.settleTape('cond-01', 'skip', t1 + 40 * MIN);
check("didn't do it: no XP, no session, no log", s.xp === 0 && U.loadStats().sessions.filter(x => x.tapeId === 'cond-01').length === 0 && T.pendingTape(t1 + 41 * MIN) === null && !T.loadTapes().log.some(e => e.id === 'cond-01'));
const c = T.tapeCounts();
check('shelf counts: cleared only', c.fight.done === 1 && c.fit.done === 1 && c.fit.total === 3 && c.fight.total === 3);
check('clearedToday', T.clearedToday('kb-01', t1 + 50 * MIN) && !T.clearedToday('kb-01', t0 + 50 * MIN));
// the cleared map outlives the trimmed log
{ const st = T.loadTapes(); st.log = Array.from({ length: 401 }, (_, i) => ({ id: 'bw-01', at: t1 + i, verdict: 'partial', xp: 0 })); localStorage.setItem('tm_tapes_v1', JSON.stringify(st)); }
T.startTape('bw-01', t1 + 60 * MIN); T.settleTape('bw-01', 'partial', t1 + 80 * MIN);
check('badges survive the log trim', T.loadTapes().log.length === 400 && T.tapeCounts().fight.done === 1 && T.tapeCounts().cleared.has('bag-01'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

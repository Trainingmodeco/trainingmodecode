// Retention preview: every new screen state of the retention features, seeded
// with sample data, opened on the web dev server and photographed at three
// phone sizes. Fails when anything overflows the viewport or any text is cut
// off (the owner's visual rule, RETENTION-PLAN.md).
//
//   node scripts/retention-preview.mjs <out-dir> [--base http://localhost:8081] [--only <regex>] [--sizes 360x780,390x844,430x932,360x640]
//
// --sizes: the phone sizes (default 360x780, 390x844 and 430x932); a size off
// the default list is saved as <state>-<w>x<h>.png.
// Needs the dev server: CI=1 EXPO_NO_TELEMETRY=1 npx expo start --web --port 8081
// (CI mode does not reload: restart it after an edit). Chrome: CHROME_PATH, or
// Playwright's "chrome" channel, or /usr/bin/google-chrome.
//
// Each state seeds localStorage (the owner preview is on, so every retention
// switch is), opens a screen, and is checked at 360x780, 390x844 and 430x932:
//   - nothing reaches past the viewport's sides (and the page never scrolls sideways);
//   - inside the state's own elements (`check` selectors), no text box is cut:
//     scrollWidth > clientWidth on a box that clips, a clamped box that hides
//     lines, or a text box outside the box that clips it.
// Text cut elsewhere on the page is printed as a warning, not a failure.
// Features 2 and 3 add their states to STATES (f1-, f2-, f3- names); 1UP,
// POWER, RUSTY and REVIVE add f4- (the f1 states show the 1UP: no "freeze" left).
//
// Every state runs on one fixed local day and time (Thursday 19 November 2026,
// 10:00, on Playwright's clock), so every run gives the same pictures: the
// sample weeks have Monday to Wednesday trained where a state trains this week
// (3 of 4 days), and the week-complete end screen always runs. The gallery
// states also save each card as its own crop at the phone's scale (2), so
// their text can be read: <state>-<width>-cardNN.png.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const OUT = args.find((a, i) => !a.startsWith('--') && !['--base', '--only', '--sizes'].includes(args[i - 1]));
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const BASE = (opt('--base') || 'http://localhost:8081').replace(/\/$/, '') + '/';
const ONLY = opt('--only') ? new RegExp(opt('--only')) : null;
if (!OUT) { console.error('usage: node scripts/retention-preview.mjs <out-dir> [--base URL] [--only regex]'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });

const DEFAULT_SIZES = [[360, 780], [390, 844], [430, 932]];
const SIZES = opt('--sizes') ? opt('--sizes').split(',').map((x) => x.split('x').map(Number)) : DEFAULT_SIZES;
const sizeTag = ([w, h]) => (DEFAULT_SIZES.some(([dw, dh]) => dw === w && dh === h) ? `${w}` : `${w}x${h}`);

// ── sample data ────────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const NOW = new Date(2026, 10, 19, 10, 0, 0, 0); // a Thursday, local time
const NOW_MS = NOW.getTime();
const todayIdx = (NOW.getDay() + 6) % 7; // 0 = Monday
const monday = (weeksBack) => { const d = new Date(NOW); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - todayIdx - 7 * weeksBack); return d; };
let rowN = 0;
const row = (date, type = 'Fight Focus', extra = {}) => ({ id: `p${++rowN}`, type, completedAt: date.toISOString(), completedCount: 3, totalCount: 3, xpEarned: 90, ...extra });
// Training on weekdays `idxs` (0 = Monday) of the week `weeksBack` weeks ago, only days before today in this week.
const trainWeek = (weeksBack, idxs, type) => idxs.flatMap((i) => {
  const d = monday(weeksBack); d.setDate(d.getDate() + i);
  if (weeksBack === 0 && i >= todayIdx) return [];
  return [row(d, type)];
});
// `onTarget` full weeks of 4 days before this one, then `thisWeek` days this week (before today).
const history = ({ onTarget = 0, gapWeeks = [], thisWeek = 0, type } = {}) => {
  const rows = [];
  for (let w = onTarget + gapWeeks.length; w >= 1; w--) {
    if (gapWeeks.includes(w)) { rows.push(...trainWeek(w, [1], type)); continue; }
    rows.push(...trainWeek(w, [0, 2, 4, 5], type));
  }
  rows.push(...trainWeek(0, [0, 1, 2, 3, 4, 5].slice(0, thisWeek), type));
  return rows;
};
const stats = (rows, xp) => JSON.stringify({ xp: xp ?? rows.reduce((a, r) => a + r.xpEarned, 0), sessions: rows });

const FIGHTER = { name: 'TRAINEE', sex: 'male', experience: 'Some Training', goal: 'Train Like a Fighter', discipline: 'Boxing', voiceCoach: 'FEMALE', coachStyle: 'STANDARD', encouragement: 'normal', callStyle: 'names' };
const FITTER = { ...FIGHTER, goal: 'Get Fit' };
const BASE_KEYS = {
  trainingModeOnboardingComplete: 'true',
  trainingModeTourComplete: 'true',
  tm_owner_preview: '1',
  tm_arcade_intro_seen: '{}',
  tm_camp_parq: JSON.stringify({ done: true, anyYes: false, ts: NOW_MS }),
  tm_practice_invite_v1: JSON.stringify({ introShownAt: NOW.toISOString() }),
};

// ── screens ────────────────────────────────────────────────────────────────
const wait = (page, ms) => page.waitForTimeout(ms);
async function home(page, w) {
  await page.goto(BASE, { waitUntil: 'networkidle' }); await wait(page, 1800);
  await page.mouse.click(Math.round(w / 2), 120); await wait(page, 1800);
  await page.locator('button[aria-label="Close"]').first().click({ force: true, timeout: 1200 }).catch(() => {});
  await wait(page, 900);
}
async function profileEditor(page, w) {
  await home(page, w);
  await page.getByRole('button', { name: /^PROFILE$/ }).first().click({ timeout: 4000 }); await wait(page, 1200);
  await page.getByRole('button', { name: /TAP TO EDIT/ }).first().click({ timeout: 4000 }); await wait(page, 1200);
  await page.locator('[data-retention="week-target"]').scrollIntoViewIfNeeded({ timeout: 4000 }); await wait(page, 500);
}
// Today's Bout for real on a fake clock: START on the card (the last session,
// one 3-minute Fight Focus round), the round runs, the end screen opens with
// its strip and the day's bonus.
async function runDailyMission(page, w) {
  await home(page, w);
  const now = () => page.evaluate(() => Date.now());
  await page.clock.pauseAt((await now()) + 500);
  await page.locator('[data-retention="todays-bout"] button.hm-go').first().click({ timeout: 4000 });
  for (let i = 0; i < 400; i++) {
    await page.clock.runFor(1000);
    const t = await page.evaluate(() => document.body.innerText);
    if (/YOUR PROGRESS/.test(t)) break;
    const cont = page.getByRole('button', { name: /^CONTINUE$/ });
    if (/LEVEL UP/i.test(t) && await cont.count()) await cont.first().click({ timeout: 2000 }).catch(() => {});
  }
  await page.clock.resume();
  await wait(page, 2500);
  if (!/YOUR PROGRESS/.test(await page.evaluate(() => document.body.innerText))) throw new Error('today\'s bout did not reach its end screen');
}
// ── feature 2: the path + stars ──────────────────────────────────────────────
// The classic saga: stages 1-5 cleared with 3, 3, 2, 1, 3 stars and best times; stage 6 is current.
const OP_STARS = [3, 3, 2, 1, 3];
const OP_BEST = [14 * 60 + 20, 21 * 60 + 5, 17 * 60 + 40, 30 * 60 + 5, 15 * 60 + 51];
const DAY = 86400000;
const stageEntry = (i, extra) => ({ fit: true, fight: true, completed: true, completedAt: NOW_MS - (8 - i) * DAY, ...extra });
const sagaProgress = (id, entries) => ({ [id]: { completedStages: entries, unlockedStages: [1], currentStage: Object.keys(entries).length + 1, xpEarned: 0, badges: [], statXp: {}, attempts: [] } });
const OP_SEED = () => ({
  tm_user_profile: JSON.stringify(FIGHTER), tm_user_stats: stats(history({ onTarget: 3, thisWeek: Math.min(2, todayIdx) }), 5200),
  tm_arcade_progress: JSON.stringify(sagaProgress('one-punch-protocol', Object.fromEntries(OP_STARS.map((st, i) => [`op-stage-${i + 1}`, stageEntry(i, { stars: st, bestTimeSeconds: OP_BEST[i], lastTimeSeconds: OP_BEST[i] })])))),
  tm_last_session_v1: JSON.stringify({ kind: 'arcade', cfg: { seriesId: 'one-punch-protocol', title: 'One Hundred', stageNumber: 5, mode: 'fit', settings: null }, disc: null, at: NOW_MS - DAY }),
});
// A multi-path v2 saga (The Grappler): FIT, FIT + FIGHT, all three cleared on stages 1-3; stage 4 is current.
const GRAP_SEED = () => ({
  tm_user_profile: JSON.stringify(FIGHTER), tm_user_stats: stats(history({ onTarget: 2, thisWeek: Math.min(1, todayIdx) }), 3000),
  tm_arcade_intro_seen: JSON.stringify({ 'grappler-protocol': true }),
  tm_arcade_progress: JSON.stringify(sagaProgress('grappler-protocol', {
    ARC_GRAPPLER_STG01: stageEntry(0, { paths: ['fit'], stars: 1 }),
    ARC_GRAPPLER_STG02: stageEntry(1, { paths: ['fit', 'fight'], stars: 2 }),
    ARC_GRAPPLER_STG03: stageEntry(2, { paths: ['fight', 'fit', 'both'], stars: 3 }),
  })),
  tm_last_session_v1: JSON.stringify({ kind: 'arcade', cfg: { seriesId: 'grappler-protocol', title: 'The Grappler', stageNumber: 3, mode: 'both', settings: { difficulty: 'normal', voiceCoach: true, sound: 'on' } }, disc: null, at: NOW_MS - DAY }),
});
// Training Camp: levels 1-4 cleared, level 5 current with S1 done. The camp
// rows (6 to 8 weeks back, before the week history) give the levels their
// stars (data/campStars): level 1 every round to the bell (3), level 2 a
// round cut short (2), level 3 cleared before stars were kept (1: its row has
// no `camp`), level 4 Session 2 two and a half hours after Session 1 (2).
const campRowAt = (weeksBack, dayIdx, hour, level, slot, { cut = 0, lenMin = 20, total = 6 } = {}) => {
  const end = monday(weeksBack); end.setDate(end.getDate() + dayIdx); end.setHours(hour, 0, 0, 0);
  const start = new Date(end.getTime() - lenMin * 60000);
  return row(end, 'Training Camp', { completedCount: total, totalCount: total, xpEarned: 120, campLevel: level, ...(slot ? { camp: { slot, verified: true, cut, startedAt: start.toISOString() } } : {}) });
};
const CAMP_STAR_ROWS = () => [
  campRowAt(8, 0, 9, 1, 'one'),
  campRowAt(8, 2, 9, 2, 'one', { cut: 1 }),
  campRowAt(7, 0, 9, 3, null),
  campRowAt(6, 0, 9, 4, 's1'),
  campRowAt(6, 0, 12, 4, 's2', { lenMin: 30 }),
];
// The camp seed with level 4's Session 1 replayed (every round to the bell)
// on weekday `dayIdx` of this week at `hour` (the fixed clock is Thursday 10:00).
const CAMP_S1_SEED = (dayIdx, hour) => () => ({
  ...CAMP_SEED(),
  tm_user_stats: stats([...CAMP_STAR_ROWS(), campRowAt(0, dayIdx, hour, 4, 's1'), ...history({ onTarget: 2, thisWeek: Math.min(1, todayIdx) })], 3000),
});
const CAMP_SEED = () => ({
  tm_user_profile: JSON.stringify(FIGHTER), tm_user_stats: stats([...CAMP_STAR_ROWS(), ...history({ onTarget: 2, thisWeek: Math.min(1, todayIdx) })], 3000),
  tm_camp_progress: '5', tm_camp_sessions: JSON.stringify({ 4: { s1: true, s2: true }, 5: { s1: true } }),
  tm_last_session_v1: JSON.stringify({ kind: 'camp', cfg: { level: 5, difficulty: 'normal', format: 'single', archetypeName: 'Pressure Fighter' }, disc: 'Boxing', at: NOW_MS - DAY }),
});
// The saga or the camp of the last session, on its path: Home's ADJUST (with
// NEXT UP folded into the Continue card, CONTINUE opens the current node).
async function continueLast(page, w) {
  await home(page, w);
  await page.getByRole('button', { name: /^ADJUST$/ }).first().click({ timeout: 4000 });
  await wait(page, 2200);
}
// NEXT UP: the Continue card it folded into (or its own row), opening the
// saga or the camp on its current node.
async function nextUp(page, w) {
  await home(page, w);
  await page.locator('[data-retention="next-up"] button.hm-go, button[data-retention="next-up"]').first().click({ timeout: 4000 });
  await wait(page, 2400);
}
// A cleared camp level's replay sheet → REPLAY → the level's own card.
const openCampReplayCard = (level) => async (page, w) => {
  await tapNode(`[aria-label^="Level ${level},"]`)(page, w);
  await page.locator('[data-retention="replay-sheet"] button', { hasText: 'REPLAY' }).first().click({ timeout: 4000 });
  await wait(page, 900);
};
const tapNode = (sel) => async (page, w) => {
  await continueLast(page, w);
  await page.locator(sel).first().click({ timeout: 4000 });
  await wait(page, 900);
};

// The real v2 stage, replayed from the path on a fake clock: The Grappler's
// stage 1 (FIT cleared) → its replay sheet → FIGHT → REPLAY → the rounds run →
// the shared end screen with its stars row (now 2 of 3).
async function replayV2Stage(page, w) {
  await continueLast(page, w);
  await page.locator('[aria-label^="Stage 1,"]').first().click({ timeout: 4000 }); await wait(page, 800);
  await page.locator('[data-retention="replay-sheet"] [role="radio"]', { hasText: 'FIGHT' }).first().click({ timeout: 4000 });
  const now = () => page.evaluate(() => Date.now());
  await page.clock.pauseAt((await now()) + 500);
  await page.locator('[data-retention="replay-sheet"] button', { hasText: 'REPLAY' }).first().click({ timeout: 4000 });
  for (let i = 0; i < 900; i++) {
    await page.clock.runFor(2000);
    const t = await page.evaluate(() => document.body.innerText);
    if (/YOUR PROGRESS/.test(t)) break;
    const cont = page.getByRole('button', { name: /^CONTINUE$/ });
    if (/LEVEL UP/i.test(t) && await cont.count()) await cont.first().click({ timeout: 2000 }).catch(() => {});
  }
  await page.clock.resume();
  await wait(page, 3000);
  if (!/YOUR PROGRESS/.test(await page.evaluate(() => document.body.innerText))) throw new Error('the stage did not reach its end screen');
}

// ── feature 3: near-miss retry ────────────────────────────────────────────────
// A 3-round Fight Focus (1-minute rounds) as the last session: Home's Continue
// runs it, the fake clock plays round 1 and the rest after it, END stops it in
// round 2: the end screen reads 1 of 3, its panel "2 ROUNDS TO GO".
const FF_LAST = { kind: 'timer', cfg: { difficulty: 'Normal', mode: 'Technical', rounds: 3, roundMin: 1, restSec: 20, voiceOn: false, rushMode: false, encouragement: 'normal', warmupMin: 0 }, disc: 'Boxing', at: NOW_MS - DAY };
const todayAt = (h) => { const d = new Date(NOW); d.setHours(h, 0, 0, 0); return d.getTime() < NOW_MS ? d : new Date(NOW_MS - 3600000); };
const FF_SEED = (todayRows = 0) => () => ({
  tm_user_profile: JSON.stringify(FIGHTER),
  tm_user_stats: stats([...history({ onTarget: 3, thisWeek: Math.min(2, todayIdx) }), ...Array.from({ length: todayRows }, (_, i) => row(todayAt(i)))]),
  tm_last_session_v1: JSON.stringify(FF_LAST),
});
// Runs the clock until `done(text)`; taps CONTINUE past a level-up.
async function runClock(page, done, { stepMs = 1000, max = 900 } = {}) {
  for (let i = 0; i < max; i++) {
    await page.clock.runFor(stepMs);
    const t = await page.evaluate(() => document.body.innerText);
    if (done(t)) return t;
    const cont = page.getByRole('button', { name: /^CONTINUE$/ });
    if (/LEVEL UP/i.test(t) && await cont.count()) await cont.first().click({ timeout: 2000 }).catch(() => {});
  }
  throw new Error('the clock ran out before the screen came');
}
// END → END SESSION on the round timer (Fight Focus, a camp or v2 stage), then on to the end screen.
async function endTimer(page, afterSec) {
  await page.clock.runFor(afterSec * 1000);
  // dispatchEvent: on a camp or v2 stage the round's caption can sit over the buttons.
  await page.getByRole('button', { name: /^END$/ }).first().dispatchEvent('click', {}, { timeout: 4000 });
  await wait(page, 300);
  await page.getByRole('button', { name: /^END SESSION$/ }).first().dispatchEvent('click', {}, { timeout: 4000 });
  await runClock(page, (t) => /YOUR PROGRESS/.test(t), { max: 60 });
  await page.clock.resume();
  await wait(page, 2500);
}
async function stopFightFocus(page, w) {
  await home(page, w);
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 500);
  await page.locator('[data-guide="home-continue"] button.hm-go').first().click({ timeout: 4000 });
  // The count-in, round 1 (60 s), its rest (20 s), and 10 s into round 2.
  await endTimer(page, 3 + 60 + 20 + 10);
}
// The Grappler's stage 1 replayed on FIGHT from the path, stopped in the rest
// after its first round: 1 of 6 rounds, "5 ROUNDS TO GO".
async function stopV2Stage(page, w) {
  await continueLast(page, w);
  await page.locator('[aria-label^="Stage 1,"]').first().click({ timeout: 4000 }); await wait(page, 800);
  await page.locator('[data-retention="replay-sheet"] [role="radio"]', { hasText: 'FIGHT' }).first().click({ timeout: 4000 });
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 500);
  await page.locator('[data-retention="replay-sheet"] button', { hasText: 'REPLAY' }).first().click({ timeout: 4000 });
  // Past the warm-up (SKIP) and the count-in into round 1, then to its rest.
  await runClock(page, (t) => /SKIP → START/.test(t), { max: 20 });
  await page.getByRole('button', { name: /SKIP → START/ }).first().dispatchEvent('click', {}, { timeout: 4000 });
  await runClock(page, (t) => /\bEND\b/.test(t), { max: 60 });
  await runClock(page, (t) => /NEXT: ROUND 2/.test(t), { stepMs: 2000, max: 400 });
  await endTimer(page, 2);
}

// The v2 stop, then RETRY on its panel (the same stage again), stopped the
// same way: the second go today, so no RETRY this time.
async function stopV2StageTwice(page, w) {
  await stopV2Stage(page, w);
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 500);
  await page.locator('[data-retention="near-miss"] button', { hasText: 'RETRY' }).first().click({ timeout: 4000 });
  await runClock(page, (t) => /SKIP → START/.test(t), { max: 20 });
  await page.getByRole('button', { name: /SKIP → START/ }).first().dispatchEvent('click', {}, { timeout: 4000 });
  await runClock(page, (t) => /\bEND\b/.test(t), { max: 60 });
  await runClock(page, (t) => /NEXT: ROUND 2/.test(t), { stepMs: 2000, max: 400 });
  await endTimer(page, 2);
}
// Training Camp level 5, fresh: START SESSION 1 → readiness → gear → the round
// timer, stopped in the rest after round 1. Its panel's RETRY opens the camp
// map on level 5's card (START → readiness → gear again).
const CAMP_FRESH_SEED = () => ({ ...CAMP_SEED(), tm_camp_sessions: JSON.stringify({ 4: { s1: true, s2: true } }) });
async function stopCampAndRetry(page, w) {
  await nextUp(page, w);
  await page.getByRole('button', { name: /START SESSION 1/ }).first().click({ timeout: 4000 }); await wait(page, 800);
  await page.getByRole('button', { name: /^NO$/ }).first().click({ timeout: 4000 });
  await page.getByRole('button', { name: /CHECK IN/ }).first().click({ timeout: 4000 }); await wait(page, 800);
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 500);
  await page.getByRole('button', { name: /CONTINUE/ }).first().click({ timeout: 4000 });
  await runClock(page, (t) => /SKIP → START/.test(t), { max: 20 });
  await page.getByRole('button', { name: /SKIP → START/ }).first().dispatchEvent('click', {}, { timeout: 4000 });
  await runClock(page, (t) => /\bEND\b/.test(t), { max: 60 });
  await runClock(page, (t) => /NEXT: ROUND 2/.test(t), { stepMs: 2000, max: 400 });
  await endTimer(page, 2);
  await page.locator('[data-retention="near-miss"] button', { hasText: 'RETRY' }).first().click({ timeout: 4000 });
  await wait(page, 2000);
}
// The same, with the one-time health check (PAR-Q) still to take when RETRY
// lands on the map: the sheet comes first (stopCampAndRetryParqSheet stops
// there), and once it is done level 5's card opens all the same (the retry is
// kept, not dropped).
async function stopCampAndRetryParqSheet(page, w) {
  await nextUp(page, w);
  await page.getByRole('button', { name: /START SESSION 1/ }).first().click({ timeout: 4000 }); await wait(page, 800);
  await page.getByRole('button', { name: /^NO$/ }).first().click({ timeout: 4000 });
  await page.getByRole('button', { name: /CHECK IN/ }).first().click({ timeout: 4000 }); await wait(page, 800);
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 500);
  await page.getByRole('button', { name: /CONTINUE/ }).first().click({ timeout: 4000 });
  await runClock(page, (t) => /SKIP → START/.test(t), { max: 20 });
  await page.getByRole('button', { name: /SKIP → START/ }).first().dispatchEvent('click', {}, { timeout: 4000 });
  await runClock(page, (t) => /\bEND\b/.test(t), { max: 60 });
  await runClock(page, (t) => /NEXT: ROUND 2/.test(t), { stepMs: 2000, max: 400 });
  await endTimer(page, 2);
  await page.evaluate(() => localStorage.removeItem('tm_camp_parq'));
  await page.locator('[data-retention="near-miss"] button', { hasText: 'RETRY' }).first().click({ timeout: 4000 });
  await wait(page, 1500);
  if (!/HEALTH CHECK/.test(await page.evaluate(() => document.body.innerText))) throw new Error('the PAR-Q sheet did not come up');
}
async function stopCampAndRetryParq(page, w) {
  await stopCampAndRetryParqSheet(page, w);
  for (const b of await page.getByRole('button', { name: /^Q\d+ NO$/ }).all()) await b.click({ timeout: 2000 });
  await page.getByRole('button', { name: /✓ CONTINUE/ }).first().click({ timeout: 4000 });
  await wait(page, 2000);
}

// A cleared camp level replayed from the path for real, on a fake clock: its
// replay sheet → REPLAY → the level's card (START SESSION n) → readiness →
// gear → the warm-up skipped → every round to the bell → the end screen.
async function replayCampLevel(page, w, level) {
  await continueLast(page, w);
  await page.locator(`[aria-label^="Level ${level},"]`).first().click({ timeout: 4000 }); await wait(page, 900);
  await page.locator('[data-retention="replay-sheet"] button', { hasText: 'REPLAY' }).first().click({ timeout: 4000 }); await wait(page, 700);
  await page.getByRole('button', { name: /▶ START/ }).first().click({ timeout: 4000 }); await wait(page, 800);
  await page.getByRole('button', { name: /^NO$/ }).first().click({ timeout: 4000 });
  await page.getByRole('button', { name: /CHECK IN/ }).first().click({ timeout: 4000 }); await wait(page, 800);
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 500);
  await page.getByRole('button', { name: /CONTINUE/ }).first().click({ timeout: 4000 });
  await runClock(page, (t) => /SKIP → START/.test(t), { max: 20 });
  await page.getByRole('button', { name: /SKIP → START/ }).first().dispatchEvent('click', {}, { timeout: 4000 });
  await runClock(page, (t) => /YOUR PROGRESS/.test(t), { stepMs: 2000, max: 900 });
  await page.clock.resume();
  await wait(page, 3000);
}
// The camp opened from Home after a long break: the RUSTY pop-up (POWER) is
// put off with LATER first, then ADJUST opens the camp.
async function campAfterBreak(page, w) {
  await home(page, w);
  if (await page.locator('[data-retention="rusty-card"]').count()) await rustyLater(page);
  await page.getByRole('button', { name: /^ADJUST$/ }).first().click({ timeout: 4000 });
  await wait(page, 2200);
}
// A camp athlete away `daysAgo` days, whose health check was taken 200 days
// ago (anyYes: flagged a yes).
const CAMP_BREAK_SEED = (daysAgo, anyYes = false) => () => ({
  ...CAMP_SEED(),
  tm_user_stats: stats([...CAMP_STAR_ROWS(), ...[3, 7, 10].map((k) => row(dayAgo(daysAgo + k))), row(dayAgo(daysAgo))], 3000),
  tm_last_session_v1: JSON.stringify({ kind: 'camp', cfg: { level: 5, difficulty: 'normal', format: 'single', archetypeName: 'Pressure Fighter' }, disc: 'Boxing', at: dayAgo(daysAgo).getTime() }),
  tm_camp_parq: JSON.stringify({ done: true, anyYes, ts: NOW_MS - 200 * DAY }),
});
// The same Fight Focus run to its end (3 rounds of 1 minute): MISSION COMPLETE,
// its round recap, the integrity banner and the share card.
async function finishFightFocus(page, w) {
  await home(page, w);
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 500);
  await page.locator('[data-guide="home-continue"] button.hm-go').first().click({ timeout: 4000 });
  await runClock(page, (t) => /YOUR PROGRESS/.test(t), { max: 400 });
  await page.clock.resume();
  await wait(page, 2500);
}
// Fight Focus from its setup (Fight hub, FIGHT FOCUS, START SESSION: its own
// 3 rounds of 3 minutes) run to its end: for a state with a session paused,
// where Home's card is that session's Continue.
async function finishFightFocusFromSetup(page, w) {
  await home(page, w);
  await page.locator('button[aria-label="FIGHT MODE"]').click({ timeout: 5000 }); await wait(page, 1200);
  await page.locator('.fb', { hasText: 'FIGHT FOCUS' }).first().click({ timeout: 4000 }); await wait(page, 1500);
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 500);
  await page.getByRole('button', { name: /START SESSION/ }).first().click({ timeout: 4000 });
  await runClock(page, (t) => /YOUR PROGRESS/.test(t), { stepMs: 2000, max: 600 });
  await page.clock.resume();
  await wait(page, 2500);
  if (!/MISSION COMPLETE/.test(await page.evaluate(() => document.body.innerText))) throw new Error('Fight Focus did not reach MISSION COMPLETE');
}
// Ended in round 1, before a round was done: the quiet SESSION ENDED card.
async function endFightFocusAtOnce(page, w) {
  await home(page, w);
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 500);
  await page.locator('[data-guide="home-continue"] button.hm-go').first().click({ timeout: 4000 });
  await endTimer(page, 3 + 15);
}
// Combat Conditioning (GAS TANK) started and ended at once: its summary.
async function endCombatConditioning(page, w) {
  await home(page, w);
  await page.locator('button[aria-label="FIGHT MODE"]').click({ timeout: 5000 }); await wait(page, 1200);
  await page.locator('.ft.cond').click({ timeout: 4000 }); await wait(page, 1500);
  await page.locator('text=GAS TANK').first().click({ timeout: 4000 }); await wait(page, 600);
  await page.getByRole('button', { name: /START CIRCUIT/ }).first().click({ timeout: 4000 }); await wait(page, 4000);
  await page.locator('[data-guide="cca-stop"]').first().click({ timeout: 4000 }); await wait(page, 500);
  await page.getByRole('button', { name: /^END SESSION$/ }).first().click({ timeout: 4000 }); await wait(page, 2500);
  if (!/YOUR PROGRESS/.test(await page.evaluate(() => document.body.innerText))) throw new Error('Combat Conditioning did not reach its summary');
}
// Build Workout: one generated, all but two rows done (the live snapshot App
// keeps, seeded back the way the app comes back after the phone killed it),
// then FINISH WORKOUT → FINISH: the SESSION ENDED summary with its muscle chips.
async function finishBuildWorkoutEarly(page, w) {
  await home(page, w);
  await page.locator('button[aria-label="FIT MODE"]').click({ timeout: 5000 }); await wait(page, 1200);
  await page.locator('[data-guide="fit-builder"]').click({ timeout: 4000 }); await wait(page, 1200);
  await page.getByRole('button', { name: /GENERATE WORKOUT/ }).first().click({ timeout: 4000 }); await wait(page, 2000);
  await page.evaluate(() => {
    const slots = JSON.parse(localStorage.getItem('trainingModePausedSession') || '[]');
    const snap = slots.find((x) => x.screen === 'fit_workout');
    const st = snap.internalState;
    const done = st.exercises.length - 2;
    st.exercises.forEach((r, i) => { if (i < done) st.completed[r._uid] = true; });
    Object.assign(st, { skipped: {}, chainRounds: {}, activeIdx: null });
    Object.assign(snap, { reason: 'lifecycle', timestamp: Date.now() });
    sessionStorage.setItem('__rp_seed', JSON.stringify([snap]));
  });
  await page.goto(BASE, { waitUntil: 'networkidle' }); await wait(page, 2500);
  await page.getByRole('button', { name: /^FINISH WORKOUT$/ }).first().click({ timeout: 4000 }); await wait(page, 400);
  await page.getByRole('alertdialog', { name: 'Finish workout' }).getByRole('button', { name: /^FINISH$/ }).click({ timeout: 4000 }); await wait(page, 3000);
  if (!/SESSION ENDED/.test(await page.evaluate(() => document.body.innerText))) throw new Error('Build Workout did not reach its summary');
}

const scrollTo = (sel) => async (page) => { await page.locator(sel).first().scrollIntoViewIfNeeded({ timeout: 4000 }); await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center' }), sel); await wait(page, 400); };

// ── the states ─────────────────────────────────────────────────────────────
// { name, note, seed(), open(page, w), check: [selectors], apart?: [[selA, selB]], expect: RegExp,
//   absent?: RegExp (must not be on screen), clear?: [[selA, selB]] (no element of A over any of B),
//   inView?: [selectors] (whole inside the screen), oneLine?: [selectors] (text that never breaks in two),
//   same?: [selectors] (every element of each the same width and height: the panel's two buttons),
//   align?: [[selA, selB]] (the first A and the first B share their left and right edges: the banner and the cards),
//   bottom?: true (the scroll chevron, the BETA pill and a paused session's RESUME pill over no
//     text, button, picture or card and 4 px apart, as the screen opens and again scrolled to
//     its end, saved as <state>-<size>-end.png),
//   owner?: false (the owner preview off: every retention switch off, what everyone sees),
//   once?: true, clock?: true, after?(page), shot?: selector (photograph that element whole) }
// `once`: open the screen once (at the first size) and resize for the others.
// `clock`: a state that drives the clock itself (pauses it, runs it on); every
// state starts on the fixed clock.
const HOME_CHECK = ['header[data-guide="home-level"]', '[data-guide="home-continue"]', '[role="status"]'];
const HOME_APART = [['[role="status"]', '[data-guide="home-continue"]']];
// The week streak's freeze notice sits under the header: clear of the header (its ? included) and of the card.
const NOTICE_APART = [...HOME_APART, ['[role="status"]', 'header[data-guide="home-level"]'], ['[role="status"]', '[data-guide="help-icon"]']];
// POWER's line under the header: clear of the header, the notice and the card.
const POWER_APART = [['[data-retention="power"]', 'header[data-guide="home-level"]'], ['[data-retention="power"]', '[role="status"]'], ['[data-retention="power"]', '[data-guide="home-continue"]']];
// Today's Bout's samples: a fighter's last session (one 3-minute Fight Focus
// round, which the end-screen states really run), and the bout held as done.
const BOUT_LAST = { kind: 'timer', cfg: { difficulty: 'Normal', mode: 'Technical', rounds: 1, roundMin: 3, restSec: 60, voiceOn: true, rushMode: false, rushPattern: 'endRound', rushMix: 'explosive', encouragement: 'normal', warmupMin: 0, ghostChallengeId: null }, disc: 'Boxing', at: NOW_MS - DAY };
const BOUT_LAST3 = { ...BOUT_LAST, cfg: { ...BOUT_LAST.cfg, rounds: 3 } };
// A session left by the tab bar 10 minutes ago (the RESUME pill shows on every page but Home).
const PAUSED = (screen, cfg = {}) => JSON.stringify([{ screen, disc: 'Boxing', cfg, reason: 'nav', timestamp: NOW_MS - 10 * 60 * 1000 }]);
const BOUT_SEED = (rows, xp, last = BOUT_LAST) => () => ({ tm_user_profile: JSON.stringify(FIGHTER), tm_user_stats: stats(rows, xp), tm_last_session_v1: JSON.stringify(last) });
// POWER: a fighter who trained twice a week for a month (never on the week
// target, so no 1UP news takes the notice slot), the last time `daysAgo` days
// before the fixed clock; the last session is Today's Bout's 3-minute round.
const dayAgo = (d, h = 18) => { const x = new Date(NOW); x.setDate(x.getDate() - d); x.setHours(h, 0, 0, 0); return x; };
const POWER_SEED = (daysAgo, profile = {}) => () => {
  const rows = [24, 21, 17, 14, 10, 7, 3, 0].map((k) => row(dayAgo(daysAgo + k)));
  return {
    tm_user_profile: JSON.stringify({ ...FIGHTER, ...profile }), tm_user_stats: stats(rows, 2650),
    tm_last_session_v1: JSON.stringify({ ...BOUT_LAST, at: dayAgo(daysAgo).getTime() }),
  };
};
// LATER on the RUSTY pop-up (its click after is eaten for a moment).
async function rustyLater(page) {
  await page.locator('[data-retention="rusty-card"] button', { hasText: 'LATER' }).first().click({ timeout: 4000 });
  await wait(page, 900);
}
// REVIVE on the RUSTY pop-up for real, on a fake clock: TODAY'S BOUT's START
// runs the 3-minute round to its end screen.
async function reviveFromPopup(page, w) {
  await home(page, w);
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 500);
  await page.locator('[data-retention="rusty-card"] button', { hasText: 'REVIVE' }).first().click({ timeout: 4000 });
  await runClock(page, (t) => /YOUR PROGRESS/.test(t), { max: 400 });
  await page.clock.resume();
  await wait(page, 2500);
}
// REVIVE tapped and caught mid-play: the clock is held, so the bout does not
// start; the picture is taken as the dust blows off (the animation runs on
// real time).
async function reviveMoment(page, w) {
  await home(page, w);
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 500);
  await page.locator('[data-retention="rusty-card"] button', { hasText: 'REVIVE' }).first().click({ timeout: 4000 });
  await page.waitForTimeout(420);
}
// Today's Bout takes turns (the owner, 2026-11-23): yesterday's box says which
// turn yesterday was, so today is the other one.
const YESTERDAY = (() => { const d = new Date(NOW); d.setDate(d.getDate() - 1); return iso(d); })();
const HELD_BOX = (bout) => JSON.stringify({ v: 3, date: bout.date, bout, done: false, doneAt: null, xp: 0 });
const HELD_REPEAT = { date: YESTERDAY, bonusXp: 25, kind: 'last', turn: 'repeat', side: 'fight', title: 'Fight Focus', parts: ['Boxing · 3 rounds', 'Normal'], cta: 'START', minutes: 11, why: 'Same as last time', run: { type: 'replay', last: BOUT_LAST3 } };
const HELD_FRESH = { date: YESTERDAY, bonusXp: 25, kind: 'fresh', turn: 'fresh', side: 'fight', title: 'One Round: Boxing', parts: ['Fight Focus', 'Hard'], cta: 'START', minutes: 3, why: 'Something new today', run: { type: 'replay', last: { ...BOUT_LAST, cfg: { ...BOUT_LAST.cfg, difficulty: 'Hard', freshBout: YESTERDAY }, at: null } } };
const FIT_LAST = { kind: 'quick_mission', cfg: { workoutType: 'Bodyweight', duration: 12, difficulty: 'Normal', focus: 'Core', format: 'Auto', cardioFinisher: false, cadenceCount: true, cadencePreset: 'moderate', cadenceMs: 1000, voiceOn: true, cardioAddon: null }, disc: null, at: NOW_MS - DAY };
// A fresh day for real (fake clock): START runs the dealt 3-minute round to its
// end screen; the last session seeded (BOUT_LAST3) is still the one stored after.
async function runFreshBout(page, w) {
  await runDailyMission(page, w);
  const lastAfter = await page.evaluate(() => localStorage.getItem('tm_last_session_v1'));
  if (lastAfter !== JSON.stringify(BOUT_LAST3)) throw new Error(`the fresh session was stored as the last session: ${lastAfter}`);
}
// The end screen's SHARE YOUR WIN, then SHARE: the share card sheet with the rendered card.
async function openShareCard(page, w) {
  await runDailyMission(page, w);
  await page.getByRole('button', { name: /^SHARE$/ }).first().click({ timeout: 8000 });
  await page.locator('img[alt="Share card preview"]').first().waitFor({ timeout: 8000 });
  await wait(page, 800);
}
const STATES = [
  {
    name: 'f1-home-mission-ready',
    note: 'Home: the week chip (9-week streak, 3 of 4 days, 1UP ×2) and the one TODAY\'S BOUT card, ready: the last session again, its length, +25 XP beside START.',
    seed: () => BOUT_SEED(history({ onTarget: 9, thisWeek: Math.min(3, todayIdx) }), 6750, BOUT_LAST3)(),
    open: home, check: HOME_CHECK, apart: HOME_APART,
    expect: /1UP\s*×2[\s\S]*TODAY'S BOUT[\s\S]*Fight Focus[\s\S]*Boxing · 3 rounds · Normal\s+11 MIN\s*·\s*SAME AS LAST TIME[\s\S]*START[\s\S]*\+25 XP[\s\S]*SURPRISE ME/, absent: /DAILY MISSION|[Ff]reeze|❄|POWER/,
  },
  {
    name: 'f1-home-mission-fit-new',
    note: 'Home: a new, fit-leaning athlete: no streak yet, the starting 1UP (1UP ×1), no POWER line (nothing to drain yet); TODAY\'S BOUT is the setup\'s first pick, a 12-minute Quick Mission on their level.',
    seed: () => ({ tm_user_profile: JSON.stringify(FITTER), tm_user_stats: stats([], 0) }),
    open: home, check: HOME_CHECK, apart: HOME_APART,
    expect: /1UP\s*×1[\s\S]*TODAY'S BOUT[\s\S]*FIT MODE[\s\S]*Quick Mission — 12 Min Starter[\s\S]*FITS YOUR LEVEL[\s\S]*START[\s\S]*\+25 XP/, absent: /DAILY MISSION|POWER|RUSTY/,
  },
  {
    name: 'f1-home-mission-done',
    note: 'Home: today\'s bout done (its bonus paid): the card turns green, says +25 XP earned and a new bout tomorrow, TRAIN AGAIN; today\'s dot is filled.',
    seed: () => {
      const date = iso(NOW);
      const paidAt = new Date(NOW_MS - 3600000);
      const rows = [...history({ onTarget: 3, thisWeek: Math.min(2, todayIdx) }), row(paidAt), { id: 'pbonus', type: 'Mission of the Day', completedAt: paidAt.toISOString(), completedCount: 1, totalCount: 1, xpEarned: 25, bout: date }];
      const bout = { date, bonusXp: 25, kind: 'last', side: 'fight', title: 'Fight Focus', parts: ['Boxing · 3 rounds', 'Normal'], cta: 'START', minutes: 11, why: 'Same as last time', run: { type: 'replay', last: BOUT_LAST3 } };
      return {
        tm_user_profile: JSON.stringify(FIGHTER), tm_user_stats: stats(rows, 4200),
        tm_last_session_v1: JSON.stringify(BOUT_LAST3),
        tm_daily_mission_v2: JSON.stringify({ v: 3, date, bout, done: true, doneAt: paidAt.toISOString(), xp: 25 }),
        tm_week_moments_v1: JSON.stringify({ day: date, seen: [] }),
      };
    },
    open: home, check: HOME_CHECK, apart: HOME_APART,
    expect: /TODAY'S BOUT[\s\S]*Fight Focus[\s\S]*\+25 XP earned\. A new bout tomorrow\.[\s\S]*TRAIN AGAIN/, absent: /DAILY MISSION|SAME AS LAST TIME/,
  },
  {
    name: 'f1-home-bout-surprise',
    note: 'Home after SURPRISE ME: today\'s bout re-rolled in place into a Surprise Mission (its length and level), still +25 XP; held for the rest of the day.',
    seed: () => BOUT_SEED(history({ onTarget: 9, thisWeek: Math.min(3, todayIdx) }), 6750, BOUT_LAST3)(),
    open: async (page, w) => {
      await home(page, w);
      await page.getByRole('button', { name: /SURPRISE ME/ }).first().click({ timeout: 4000 });
      await wait(page, 700);
    },
    check: HOME_CHECK, apart: HOME_APART,
    expect: /TODAY'S BOUT[\s\S]*FIT MODE[\s\S]*Surprise Mission[\s\S]*\d+ MIN[\s\S]*START[\s\S]*\+25 XP[\s\S]*ADJUST/, absent: /DAILY MISSION|Fight Focus/,
  },
  {
    name: 'f1-home-guide-bout',
    note: 'Home\'s ? guide on its TODAY\'S BOUT step: the one card (the last session one day, something new the next), its daily bonus and its done state (no DAILY MISSION step).',
    seed: () => BOUT_SEED(history({ onTarget: 9, thisWeek: Math.min(3, todayIdx) }), 6750, BOUT_LAST3)(),
    open: async (page, w) => {
      await home(page, w);
      await page.locator('[data-guide="help-icon"]').first().click({ timeout: 4000 }); await wait(page, 900);
      // Past the intro, the header and (POWER switch on) the POWER step.
      for (let i = 0; i < 3; i++) { await page.getByRole('button', { name: /NEXT/ }).first().click({ timeout: 4000 }); await wait(page, 900); }
    },
    check: ['div:has(> button[aria-label="Close guide"])'],
    expect: /TODAY'S BOUT[\s\S]*your last session one\s+day, something new the next\.[\s\S]*\+25 XP, once a day[\s\S]*TRAIN AGAIN[\s\S]*ADJUST opens its settings/, absent: /DAILY MISSION|AT YOUR PACE/,
  },
  {
    name: 'f1-home-freeze-used',
    note: 'Home, the week after a short one: the quiet 1UP-used notice under the header (the level, the week chip and the ? stay in view). Trained once in 9 days: POWER is draining, so its slim line shows too (its own notice waits: one a visit).',
    seed: () => ({ tm_user_profile: JSON.stringify(FIGHTER), tm_user_stats: stats(history({ onTarget: 9, gapWeeks: [1], thisWeek: 0 }), 6100) }),
    open: home, check: HOME_CHECK, apart: [...NOTICE_APART, ...POWER_APART], expect: /LV \d+[\s\S]*1UP\s*×1[\s\S]*POWER[\s\S]*A 1UP covered last week: your 9-week streak is safe\./, absent: /[Ff]reeze|❄/,
  },
  {
    name: 'f1-home-freeze-earned',
    note: 'Home: a 1UP earned last week on a screen with no strip (shown once here, under the header). Last trained 5 days ago: the POWER line shows.',
    seed: () => ({ tm_user_profile: JSON.stringify(FIGHTER), tm_user_stats: stats(history({ onTarget: 4, thisWeek: 0 }), 3000) }),
    open: home, check: HOME_CHECK, apart: [...NOTICE_APART, ...POWER_APART], expect: /LV \d+[\s\S]*1UP\s*×2[\s\S]*1UP earned: 4 weeks on target\. You hold 2\s+of\s+2\./, absent: /[Ff]reeze|❄/,
  },
  {
    name: 'f1-home-header-long',
    note: 'Home header at its widest: a secret rank name, a 2-digit level and streak, and the compact 1UP mark (1UP over ×2); the rank always on its own line under the level, so the header keeps one height.',
    seed: () => {
      const rows = history({ onTarget: 12, thisWeek: Math.min(3, todayIdx) }).map((r) => ({ ...r, xpEarned: 700 }));
      return { tm_user_profile: JSON.stringify(FIGHTER), tm_user_stats: stats(rows, 33500) };
    },
    open: home, check: HOME_CHECK, apart: HOME_APART, expect: /LV \d\d[\s\S]*1UP\s*×2/, absent: /[Ff]reeze|❄/,
    // The longest rank name never breaks in two (it may sit under the level, as at HEAD).
    oneLine: ['header[data-guide="home-level"] [aria-label^="Level"] > span:last-child'],
  },
  {
    name: 'f1-profile-target',
    note: 'Profile → edit → Game Plan: the weekly target 2 to 6, a change pending for Monday, the 1UPs (1UP 2 OF 2).',
    seed: () => ({
      tm_user_profile: JSON.stringify(FIGHTER), tm_user_stats: stats(history({ onTarget: 2, thisWeek: Math.min(2, todayIdx) }), 2000),
      tm_game_plan_v1: JSON.stringify({ setup: true, hurdle: 'time', daysPerWeek: 5, sessionMinutes: 20, preferredTime: 'varies', restDays: [], weekTargets: [{ from: '', days: 4 }, { from: iso(monday(-1)), days: 5 }] }),
    }),
    open: profileEditor, check: ['[data-retention="week-target"]'], expect: /Keeps your streak[\s\S]*1UP \d OF 2/, absent: /FREEZE|❄|1UPS/,
  },
  {
    name: 'f1-gallery',
    note: 'The design gallery (/retention-looks), feature 1: every card renders the real components with sample data.',
    seed: () => ({}),
    open: async (page) => { await page.goto(`${BASE}retention-looks`, { waitUntil: 'networkidle' }); await wait(page, 2500); },
    check: ['#f1'], shot: '#f1', expect: /TODAY'S BOUT \+ 1UP[\s\S]*TRAIN AGAIN[\s\S]*1UP used[\s\S]*1UP EARNED/, absent: /DAILY MISSION|FREEZE|Freeze used|❄/,
  },
  {
    name: 'f1-end-day-kept',
    note: 'Today\'s Bout for real (fake clock) → its end screen: TRAINING DAY n OF 4 · STREAK KEPT, the new dot pops, TODAY\'S BOUT · +25 XP.',
    clock: true, once: true, bottom: true,
    seed: () => BOUT_SEED(history({ onTarget: 9, thisWeek: Math.min(2, todayIdx) }), 6750)(),
    open: runDailyMission, after: scrollTo('[data-retention="week-moment"]'), check: ['[data-retention="week-moment"]'], expect: /TRAINING DAY[\s\S]*TODAY'S BOUT · \+25 XP/, absent: /DAILY MISSION/,
  },
  {
    name: 'f1-end-week-complete',
    note: 'Today\'s Bout lands the 4th day of the 4th week on target: WEEK COMPLETE, a 1UP earned, TODAY\'S BOUT · +25 XP.',
    clock: true, once: true, bottom: true, needsDays: 3,
    seed: () => BOUT_SEED(history({ onTarget: 3, thisWeek: 3 }), 3300)(),
    open: runDailyMission, after: scrollTo('[data-retention="week-moment"]'), check: ['[data-retention="week-moment"]'], expect: /WEEK COMPLETE[\s\S]*1UP EARNED · YOU HOLD 2 OF 2[\s\S]*TODAY'S BOUT · \+25 XP/, absent: /DAILY MISSION|FREEZE|❄|REVIVED/,
  },
  // ── Today's Bout takes turns: a fresh day after a repeat day (owner, 2026-11-23) ──
  {
    name: 'f1-home-bout-fresh',
    note: 'Home on a fresh day (yesterday\'s bout was the last session again): something new, dealt like the old Daily Mission: one 3-minute Fight Focus round of the fighter\'s discipline on their level, "3 MIN · SOMETHING NEW TODAY", +25 XP beside START.',
    seed: () => ({ ...BOUT_SEED(history({ onTarget: 9, thisWeek: Math.min(3, todayIdx) }), 6750, BOUT_LAST3)(), tm_daily_mission_v2: HELD_BOX(HELD_REPEAT) }),
    open: home, check: HOME_CHECK, apart: HOME_APART,
    expect: /TODAY'S BOUT[\s\S]*FIGHT MODE[\s\S]*One Round: Boxing[\s\S]*Fight Focus · Hard\s+3 MIN\s*·\s*SOMETHING NEW TODAY[\s\S]*START[\s\S]*\+25 XP[\s\S]*SURPRISE ME[\s\S]*ADJUST/, absent: /SAME AS LAST TIME|DAILY MISSION/,
  },
  {
    name: 'f1-home-bout-fresh-fit',
    note: 'Home on a fresh day for a fit athlete (last session a 12-minute Quick Mission): a 3-minute Quick Mission dealt from the date, on their level, one step easier after yesterday\'s session.',
    seed: () => ({
      tm_user_profile: JSON.stringify(FITTER), tm_user_stats: stats(history({ onTarget: 3, thisWeek: Math.min(3, todayIdx), type: 'Quick Mission' }), 2600),
      tm_last_session_v1: JSON.stringify(FIT_LAST), tm_daily_mission_v2: HELD_BOX({ ...HELD_REPEAT, side: 'fit', title: 'Quick Mission', parts: ['Core', 'Medium'], minutes: 12 }),
    }),
    open: home, check: HOME_CHECK, apart: HOME_APART,
    expect: /TODAY'S BOUT[\s\S]*FIT MODE[\s\S]*Quick Mission: (Full Body|Upper|Lower|Core|Combat)[\s\S]*No gear · \w+[\s\S]*3 MIN\s*·\s*SOMETHING NEW TODAY[\s\S]*START[\s\S]*\+25 XP/, absent: /SAME AS LAST TIME|DAILY MISSION/,
  },
  {
    name: 'f1-home-bout-repeat',
    note: 'Home on a repeat day (yesterday was a fresh day): the fighter\'s own last session again, "SAME AS LAST TIME". The fresh round was never stored as the last session, so this is their own 3-round Fight Focus.',
    seed: () => ({ ...BOUT_SEED(history({ onTarget: 9, thisWeek: Math.min(3, todayIdx) }), 6750, BOUT_LAST3)(), tm_daily_mission_v2: HELD_BOX(HELD_FRESH) }),
    open: home, check: HOME_CHECK, apart: HOME_APART,
    expect: /TODAY'S BOUT[\s\S]*Fight Focus[\s\S]*Boxing · 3 rounds · Normal\s+11 MIN\s*·\s*SAME AS LAST TIME[\s\S]*START[\s\S]*\+25 XP/, absent: /SOMETHING NEW TODAY|One Round/,
  },
  {
    name: 'f1-end-fresh',
    note: 'A fresh day for real (fake clock): START runs the dealt 3-minute round to its end screen, the strip and TODAY\'S BOUT · +25 XP; the athlete\'s own last session is still the one stored.',
    clock: true, once: true,
    seed: () => ({ ...BOUT_SEED(history({ onTarget: 9, thisWeek: Math.min(2, todayIdx) }), 6750, BOUT_LAST3)(), tm_daily_mission_v2: HELD_BOX(HELD_REPEAT) }),
    open: runFreshBout, after: scrollTo('[data-retention="week-moment"]'), check: ['[data-retention="week-moment"]'], expect: /TRAINING DAY[\s\S]*TODAY'S BOUT · \+25 XP/,
  },
  // ── the week streak where the day streak was (owner, 2026-11-23) ──
  {
    name: 'f1-profile-week-streak',
    note: 'Profile: the streak tile is the week streak (🔥9, WEEK STREAK), the same number as Home\'s chip; it was the day count.',
    seed: () => BOUT_SEED(history({ onTarget: 9, thisWeek: Math.min(3, todayIdx) }), 6750, BOUT_LAST3)(),
    open: async (page, w) => { await home(page, w); await page.getByRole('button', { name: /^PROFILE$/ }).first().click({ timeout: 4000 }); await wait(page, 1200); },
    check: ['[data-guide="pr-avatar"]', '[data-retention="profile-week-streak"]'], expect: /🔥9\s*WEEK STREAK[\s\S]*SESSIONS[\s\S]*TROPHIES/,
  },
  {
    name: 'f1-progress-week-streak',
    note: 'Progress: the rank card\'s streak is the week streak, labelled (🔥12 over WEEK STREAK), beside the longest rank name and a 2-digit level.',
    seed: () => {
      const rows = history({ onTarget: 12, thisWeek: Math.min(3, todayIdx) }).map((r) => ({ ...r, xpEarned: 700 }));
      return { tm_user_profile: JSON.stringify(FIGHTER), tm_user_stats: stats(rows, 33500) };
    },
    open: async (page, w) => { await home(page, w); await page.getByRole('button', { name: /^PROGRESS$/ }).first().click({ timeout: 4000 }); await wait(page, 1200); },
    check: ['[data-tour="rank-card"]', '[data-retention="progress-week-streak"]'], expect: /LV\s\d\d[\s\S]*🔥12\s*WEEK STREAK/,
    clear: [['[data-retention="progress-week-streak"]', '[data-tour="rank-card"] > div:nth-child(2)']],
  },
  {
    name: 'f1-level-week-streak',
    note: 'The Level page: the streak fact is WEEK STREAK 9 (was DAY STREAK).',
    seed: () => BOUT_SEED(history({ onTarget: 9, thisWeek: Math.min(3, todayIdx) }), 6750, BOUT_LAST3)(),
    open: async (page, w) => {
      await home(page, w);
      await page.getByRole('button', { name: /^PROFILE$/ }).first().click({ timeout: 4000 }); await wait(page, 1200);
      await page.getByRole('button', { name: /View your level/ }).first().click({ timeout: 4000 }); await wait(page, 1200);
      await page.getByText('WEEK STREAK').first().scrollIntoViewIfNeeded({ timeout: 4000 }); await wait(page, 400);
    },
    check: ['[aria-label="Your level"]'], expect: /WEEK STREAK\s*9/, absent: /DAY STREAK/,
  },
  {
    name: 'f1-share-week-streak',
    note: 'The share card from the end screen (SHARE YOUR WIN → SHARE): its stat reads WEEK STREAK with the weeks (the card is a picture: look at the photo); the share text says "Streak: 9 weeks".',
    clock: true, once: true,
    seed: () => BOUT_SEED(history({ onTarget: 9, thisWeek: Math.min(2, todayIdx) }), 6750)(),
    open: openShareCard, check: ['[data-streak-label="WEEK STREAK"]'], expect: /SHARE YOUR WIN[\s\S]*SHARE IMAGE/,
  },
  {
    name: 'f1-home-reminder-week',
    note: 'Home\'s come-back reminder (trained yesterday, this week 3 of 4): its streak case is the week streak\'s, "9-week streak: 1 more day this week.", KEEP STREAK.',
    seed: () => ({ ...BOUT_SEED(history({ onTarget: 9, thisWeek: Math.min(3, todayIdx) }), 6750, BOUT_LAST3)(), tm_reminder_card_dismissed: '' }),
    open: home, check: HOME_CHECK, apart: HOME_APART,
    expect: /9-week streak: 1 more day this week\.[\s\S]*KEEP STREAK/,
  },
  // ── 1UP, POWER, RUSTY and REVIVE (switch `power`) ──
  {
    name: 'f4-home-power-draining',
    note: 'Home, last trained 10 days ago: POWER is draining, one slim line under the header in line with the level (72%). No notice yet.',
    seed: () => POWER_SEED(10)(),
    open: home, check: [...HOME_CHECK, '[data-retention="power"]'], apart: [...HOME_APART, ...POWER_APART],
    expect: /LV \d+[\s\S]*POWER\s*72%[\s\S]*TODAY'S BOUT/, absent: /RUSTY|running\slow/,
  },
  {
    name: 'f4-home-power-low',
    note: 'Home, last trained 19 days ago: POWER is low (36%, amber), and its one quiet notice under it, once per drain.',
    seed: () => POWER_SEED(19)(),
    open: home, check: [...HOME_CHECK, '[data-retention="power"]'], apart: [...NOTICE_APART, ...POWER_APART],
    expect: /POWER\s*36%[\s\S]*Your\sPOWER\sis\srunning\slow\.\sOne\ssession\srevives\sit\.[\s\S]*TODAY'S BOUT/, absent: /RUSTY|1UP covered|\(36%\)/,
  },
  {
    name: 'f4-rusty-popup-male',
    note: 'Opening the app 34 days after the last session (a male profile): the RUSTY pop-up, once per rusty spell, with the owner\'s RUSTY art and dust drifting over it. REVIVE runs TODAY\'S BOUT\'s START; LATER closes it.',
    seed: () => POWER_SEED(34)(),
    open: home, check: ['[data-retention="rusty-card"]'], inView: ['[data-retention="rusty-card"]'],
    expect: /RUSTY\s+34 days since your last session\.\s+Your level, XP, streak and badges are all still here\.\s+REVIVE\s+LATER/,
  },
  {
    name: 'f4-rusty-popup-female',
    note: 'The same for a female profile, with her RUSTY art.',
    seed: () => POWER_SEED(34, { sex: 'female' })(),
    open: home, check: ['[data-retention="rusty-card"]'], inView: ['[data-retention="rusty-card"]'],
    expect: /RUSTY\s+34 days since your last session\.[\s\S]*REVIVE[\s\S]*LATER/,
  },
  {
    name: 'f4-rusty-paused',
    note: 'Opening the app RUSTY with a session paused 10 minutes ago: no RUSTY pop-up over the paused session (it waits for a later open), and the open\'s one turn passes down the queue, so its next pop-up (here the concept drop) shows, as with the switch off.',
    seed: () => ({ ...POWER_SEED(34)(), trainingModePausedSession: JSON.stringify([{ screen: 'timer', disc: 'Boxing', cfg: BOUT_LAST.cfg, reason: 'nav', timestamp: NOW_MS - 10 * 60 * 1000 }]) }),
    open: async (page, w) => {
      await page.goto(BASE, { waitUntil: 'networkidle' }); await wait(page, 1800);
      await page.mouse.click(Math.round(w / 2), 120); await wait(page, 2200);
    },
    check: ['[role="dialog"][aria-label^="New concept drop"]'], inView: ['[role="dialog"][aria-label^="New concept drop"]'],
    expect: /NEW CONCEPT DROP/, absent: /days since your last session/,
  },
  {
    name: 'f4-rusty-revive-male',
    note: 'REVIVE tapped (a male profile): the revive art (wiping the dust off) fades in over the rusty one, the dust and rust blow off in one burst, and the title turns violet. The bout starts as it settles, about 1.35 s after the tap.',
    seed: () => POWER_SEED(34)(),
    open: reviveMoment, check: ['[data-retention="rusty-card"]', '[data-retention="dust-burst"]'], inView: ['[data-retention="rusty-card"]'],
    expect: /REVIVE\s+Shaking off the rust\.\s+Your level, XP, streak and badges are all still here\./, absent: /days since your last session/,
  },
  {
    name: 'f4-rusty-revive-female',
    note: 'The same for a female profile.',
    seed: () => POWER_SEED(34, { sex: 'female' })(),
    open: reviveMoment, check: ['[data-retention="rusty-card"]', '[data-retention="dust-burst"]'], inView: ['[data-retention="rusty-card"]'],
    expect: /REVIVE\s+Shaking off the rust\./,
  },
  {
    name: 'f4-home-rusty',
    note: 'Home after LATER: the POWER line reads RUSTY; the pop-up does not come back this spell.',
    seed: () => POWER_SEED(34)(),
    open: async (page, w) => { await home(page, w); await rustyLater(page); },
    check: [...HOME_CHECK, '[data-retention="power"]'], apart: [...HOME_APART, ...POWER_APART],
    expect: /POWER\s*RUSTY[\s\S]*TODAY'S BOUT/, absent: /days since your last session/,
  },
  {
    name: 'f4-end-revived',
    note: 'REVIVE on the RUSTY pop-up for real (fake clock): TODAY\'S BOUT\'s START runs the 3-minute round, and its end screen says REVIVED · POWER 100% in YOUR PROGRESS (once), beside the week strip and the bout\'s +25 XP.',
    clock: true, once: true, bottom: true,
    seed: () => POWER_SEED(34)(),
    open: reviveFromPopup, after: scrollTo('[data-retention="revive"]'),
    check: ['[data-retention="revive"]', '[data-retention="week-moment"]'],
    expect: /REVIVED · POWER 100%[\s\S]*TRAINING DAY 1 OF 4[\s\S]*TODAY'S BOUT · \+25 XP/,
  },
  {
    name: 'f4-profile-rusty',
    note: 'Profile while RUSTY: the portrait greyed with dust and rust; the name, LVL line and XP stay as they are.',
    seed: () => POWER_SEED(34)(),
    open: async (page, w) => {
      await home(page, w); await rustyLater(page);
      await page.getByRole('button', { name: /^PROFILE$/ }).first().click({ timeout: 4000 }); await wait(page, 1200);
    },
    check: ['[data-guide="pr-avatar"]', '[data-retention="rusty-look"]'], expect: /LVL \d+ · [\s\S]*XP to next/,
  },
  {
    name: 'f4-level-rusty',
    note: 'The Level page while RUSTY: the big portrait rusty, the level and the XP bar as they are.',
    seed: () => POWER_SEED(34)(),
    open: async (page, w) => {
      await home(page, w); await rustyLater(page);
      await page.getByRole('button', { name: /^PROFILE$/ }).first().click({ timeout: 4000 }); await wait(page, 1200);
      await page.getByRole('button', { name: /View your level/ }).first().click({ timeout: 4000 }); await wait(page, 1200);
    },
    check: ['[aria-label="Your level"]', '[data-retention="rusty-look"]'], expect: /YOUR LEVEL[\s\S]*LEVEL \d+/i,
  },
  {
    name: 'f4-home-guide-power',
    note: 'Home\'s ? guide with the switches on: the header step names the 1UP, and the next step explains POWER, RUSTY and REVIVE in plain words.',
    seed: () => POWER_SEED(10)(),
    open: async (page, w) => {
      await home(page, w);
      await page.locator('[data-guide="help-icon"]').first().click({ timeout: 4000 }); await wait(page, 900);
      for (let i = 0; i < 2; i++) { await page.getByRole('button', { name: /NEXT/ }).first().click({ timeout: 4000 }); await wait(page, 900); }
    },
    check: ['div:has(> button[aria-label="Close guide"])'],
    expect: /POWER · RUSTY · REVIVE[\s\S]*full for 3 days[\s\S]*RUSTY[\s\S]*REVIVES it to 100%[\s\S]*Nothing you earned is ever taken away/, absent: /TODAY'S BOUT\s+Today's one pick/,
  },
  {
    name: 'f4-gallery',
    note: 'The design gallery (/retention-looks), POWER: the real POWER line, notice, RUSTY card, rusty portrait and REVIVED line with sample data.',
    seed: () => ({}),
    open: async (page) => { await page.goto(`${BASE}retention-looks`, { waitUntil: 'networkidle' }); await wait(page, 3000); },
    check: ['#f8'], shot: '#f8', expect: /POWER, RUSTY \+ REVIVE[\s\S]*72%[\s\S]*running\slow[\s\S]*REVIVE[\s\S]*REVIVED · POWER 100%/,
  },
  {
    name: 'f2-home-next-up',
    note: 'Home: NEXT UP folded into Today\'s Bout (the last session is that saga): One Hundred, stage 6, one card.',
    seed: OP_SEED, open: home, after: scrollTo('[data-retention="next-up"]'),
    check: ['[data-retention="next-up"]'], expect: /TODAY'S BOUT[\s\S]*One Hundred\s+Stage 6 · The Standard Hundred[\s\S]*CONTINUE[\s\S]*\+25 XP/, absent: /NEXT UP · ONE HUNDRED|Arcade · Stage 5/,
  },
  {
    name: 'f2-home-next-up-camp',
    note: 'Home: NEXT UP for Training Camp folded into Today\'s Bout: the current level (5), one card.',
    seed: CAMP_SEED, open: home, after: scrollTo('[data-retention="next-up"]'),
    check: ['[data-retention="next-up"]'], expect: /TODAY'S BOUT[\s\S]*Training Camp\s+Boxing · Level 5 · Volume[\s\S]*CONTINUE[\s\S]*\+25 XP/, absent: /NEXT UP · TRAINING CAMP|Level 5 · Normal/,
  },
  {
    name: 'f2-saga-path',
    note: 'The classic saga as a path: stages 1-5 cleared with their stars, stage 6 pulsing with START, the boss at the top; ★ 12/30 in the header.',
    seed: OP_SEED, open: continueLast,
    check: ['[data-retention="path-map"]', 'header'], expect: /★ 12\/30/,
  },
  {
    name: 'f2-saga-popup',
    note: 'NEXT UP opens the saga on the current node\'s own pop-up (ENTER STAGE: the existing start flow).',
    seed: OP_SEED, open: nextUp,
    check: ['.stage-modal'], expect: /ENTER STAGE/,
  },
  {
    name: 'f2-saga-replay',
    note: 'A cleared node\'s replay sheet: 2 of 3 stars, the best time, what the third star needs and how far off.',
    seed: OP_SEED, open: tapNode('[aria-label^="Stage 3,"]'),
    check: ['[data-retention="replay-sheet"]'], expect: /STAGE 3 · CLEARED[\s\S]*YOUR BEST[\s\S]*NEEDS[\s\S]*off the third star/,
  },
  {
    name: 'f2-saga-replay-one-star',
    note: 'A 1-star clear, best time over every tier: the second star\'s time and the gap.',
    seed: OP_SEED, open: tapNode('[aria-label^="Stage 4,"]'),
    check: ['[data-retention="replay-sheet"]'], expect: /off the second star/,
  },
  {
    name: 'f2-saga-path-v2',
    note: 'A multi-path v2 saga (The Grappler): one star per path, stage 4 current.',
    seed: GRAP_SEED, open: continueLast,
    check: ['[data-retention="path-map"]', 'header'], expect: /★ 6\/30/,
  },
  {
    name: 'f2-saga-replay-paths',
    note: 'The Grappler\'s replay sheet: one star per path, says so; the path to replay (a missing one picked).',
    seed: GRAP_SEED, open: tapNode('[aria-label^="Stage 1,"]'),
    check: ['[data-retention="replay-sheet"]'], expect: /One star per path cleared[\s\S]*PATH TO REPLAY/,
  },
  {
    name: 'f2-saga-locked',
    note: 'A locked node: the ladder\'s own hint, hung under the node that was tapped (never over another node).',
    seed: OP_SEED, open: tapNode('[aria-label^="Stage 8,"]'),
    check: ['[data-retention="path-map"]'], expect: /CLEAR STAGE 7 TO UNLOCK/,
    clear: [['[data-retention="path-hint"]', '[data-retention="path-map"] button']],
  },
  {
    name: 'f2-camp-path',
    note: 'Training Camp as a path with its stars: level 1 three (every round to the bell), level 2 two (a round cut short), level 3 one (cleared before stars were kept), level 4 two; level 5 current with S1 done, the title fight at the top. Opening, the road climbs from level 1 to level 5 (with the climb sound once its file exists).',
    seed: CAMP_SEED, open: continueLast,
    check: ['[data-retention="path-map"]'], expect: /TRAINING CAMP · BOXING[\s\S]*START/,
    stars: { 'Level 1,': '3 of 3', 'Level 2,': '2 of 3', 'Level 3,': '1 of 3', 'Level 4,': '2 of 3' },
  },
  {
    name: 'f2-camp-replay',
    note: 'A cleared camp level\'s replay sheet: two stars (Session 2 came two and a half hours after Session 1) and what the third needs. Level 4 itself sits whole above the sheet (the owner: "make sure the model is not cut off in the bottom").',
    seed: CAMP_SEED, open: tapNode('[aria-label^="Level 4,"]'), after: async (page) => { await wait(page, 900); },
    check: ['[data-retention="replay-sheet"]'], expect: /LEVEL 4 · [\s\S]*CLEARED[\s\S]*CONDITIONING[\s\S]*Third star: Session 2 four to eight hours after Session 1, no round cut short\./,
    clear: [['[data-retention="replay-sheet"]', '[aria-label^="Level 4,"]']],
    inView: ['[aria-label^="Level 4,"]'], whole: [['[aria-label^="Level 4,"]', '[data-retention="path-map"]']],
  },
  {
    name: 'f2-camp-replay-older',
    note: 'A level cleared before camp stars were kept (its row cannot say how it went): one star, and what the second needs.',
    seed: CAMP_SEED, open: tapNode('[aria-label^="Level 3,"]'), after: async (page) => { await wait(page, 900); },
    check: ['[data-retention="replay-sheet"]'], expect: /LEVEL 3 · [\s\S]*CLEARED[\s\S]*Cleared before camp stars were kept\. Second star: every round done and verified\./,
    clear: [['[data-retention="replay-sheet"]', '[aria-label^="Level 3,"]']], inView: ['[aria-label^="Level 3,"]'], whole: [['[aria-label^="Level 3,"]', '[data-retention="path-map"]']],
  },
  {
    name: 'f2-camp-replay-start',
    note: 'REPLAY on level 4 opens its own card; a replay runs as a run does, Session 1 first, and the card says so: "replay" (not "unlocks L5"), Session 1 UP NEXT, Session 2 PENDING, and "Replay: Session 1, then Session 2 four to eight hours later, for the stars." in place of "level clears at ✓✓".',
    seed: CAMP_SEED, open: openCampReplayCard(4),
    check: ['[data-retention="camp-card"]'], expect: /BASE[\s\S]*· replay[\s\S]*SESSION 1\s*▶ UP NEXT[\s\S]*SESSION 2\s*PENDING[\s\S]*Replay: Session 1, then Session 2 four to eight hours later, for the stars\.[\s\S]*START SESSION 1/,
    absent: /unlocks L5|level clears|COMPLETE/,
  },
  {
    name: 'f2-camp-replay-s2',
    note: 'Level 4\'s Session 1 replayed two hours ago: REPLAY opens the card on Session 2 (Session 1 ✓ REPLAYED, Session 2 UP NEXT), and the line says Session 2 counts four to eight hours after Session 1.',
    seed: CAMP_S1_SEED(todayIdx, 8), open: openCampReplayCard(4),
    check: ['[data-retention="camp-card"]'], expect: /BASE[\s\S]*· replay[\s\S]*SESSION 1\s*✓ REPLAYED[\s\S]*SESSION 2\s*▶ UP NEXT[\s\S]*Replay: Session 2 four to eight hours after Session 1, for the stars\.[\s\S]*START SESSION 2/,
    absent: /unlocks L5|level clears|COMPLETE/,
  },
  {
    name: 'f2-camp-replay-lapsed',
    note: 'Level 4\'s Session 1 replayed on Monday with no Session 2 since: more than eight hours have passed, so the run has lapsed. The sheet asks for the third star again (not "Session 1 replayed") and REPLAY opens Session 1, not a Session 2 that could earn two stars at most.',
    seed: CAMP_S1_SEED(0, 9), open: async (page, w) => {
      await tapNode('[aria-label^="Level 4,"]')(page, w);
      const t = await page.locator('[data-retention="replay-sheet"]').first().innerText();
      if (!/Third star: Session 2 four to eight hours after Session 1/.test(t) || /Session 1 replayed/.test(t)) throw new Error(`the sheet still counts on the lapsed Session 1: ${t}`);
      await page.locator('[data-retention="replay-sheet"] button', { hasText: 'REPLAY' }).first().click({ timeout: 4000 }); await wait(page, 900);
    },
    check: ['[data-retention="camp-card"]'], expect: /BASE[\s\S]*SESSION 1\s*▶ UP NEXT[\s\S]*Replay: Session 1, then Session 2 four to eight hours later, for the stars\.[\s\S]*START SESSION 1/,
    absent: /REPLAYED|START SESSION 2|unlocks L5|level clears/,
  },
  {
    name: 'f2-camp-end-stars',
    note: 'Level 2 (two stars) replayed for real on a fake clock, every round to the bell: the end screen\'s LEVEL STARS row, now three of three, landing.',
    clock: true, once: true,
    seed: CAMP_SEED, open: (page, w) => replayCampLevel(page, w, 2), after: scrollTo('[data-retention="stage-stars"]'),
    check: ['[data-retention="stage-stars"]'], expect: /LEVEL 2 CLEAR[\s\S]*LEVEL STARS · 3 OF 3[\s\S]*All three stars\./,
  },
  {
    name: 'f2-camp-end-s1',
    note: 'Level 4\'s replay starts with Session 1 (fake clock, every round to the bell): its end screen says SESSION 1 COMPLETE (not LEVEL 4 CLEAR), and the stars row says when Session 2 counts for the third star.',
    clock: true, once: true,
    seed: CAMP_SEED, open: (page, w) => replayCampLevel(page, w, 4), after: scrollTo('[data-retention="stage-stars"]'),
    check: ['[data-retention="stage-stars"]'], expect: /SESSION 1 COMPLETE[\s\S]*LEVEL STARS · 2 OF 3[\s\S]*Session 2 four to eight hours from now, no round cut short: all three stars\./, absent: /LEVEL 4 CLEAR/,
  },
  {
    name: 'f2-camp-next-up',
    note: 'NEXT UP opens the camp on the current level\'s own card (START → readiness → gear).',
    seed: CAMP_SEED, open: nextUp,
    check: ['[data-retention="path-map"]'], expect: /START SESSION 2/,
  },
  {
    name: 'f2-end-v2-stars',
    note: 'A real v2 stage replayed from the path (fake clock): The Grappler stage 1 on FIGHT → the end screen\'s stars row, 2 of 3, landing.',
    clock: true, once: true, bottom: true,
    seed: GRAP_SEED, open: replayV2Stage, after: scrollTo('[data-retention="stage-stars"]'),
    check: ['[data-retention="stage-stars"]'], expect: /STAGE STARS · 2 OF 3/,
  },
  {
    name: 'f3-ff-partial',
    note: 'A real Fight Focus stopped in round 2 (fake clock): the panel under the stats, 2 ROUNDS TO GO, RETRY and COME BACK FRESH TOMORROW the same size.',
    clock: true, once: true, bottom: true,
    seed: FF_SEED(0), open: stopFightFocus, after: scrollTo('[data-retention="near-miss"]'),
    check: ['[data-retention="near-miss"]'], same: ['[data-retention="near-miss"] button'], align: [['[data-ui="integrity-banner"]', '[data-ui="mc-stats"]']],
    expect: /2 ROUNDS TO GO[\s\S]*1 OF 3 ROUNDS[\s\S]*RETRY[\s\S]*COME BACK FRESH TOMORROW/i,
  },
  {
    name: 'f3-ff-load',
    note: 'The same stop as the third finished session today: no RETRY, the line says when to come back, DONE FOR TODAY.',
    clock: true, once: true, bottom: true,
    seed: FF_SEED(2), open: stopFightFocus, after: scrollTo('[data-retention="near-miss"]'),
    check: ['[data-retention="near-miss"]'], expect: /Three sessions done today\. Come back fresh tomorrow\.[\s\S]*DONE FOR TODAY/i,
  },
  {
    name: 'f3-v2-partial',
    note: 'A real v2 stage (The Grappler stage 1 on FIGHT, from the path) stopped after its first round: the arcade end screen\'s panel.',
    clock: true, once: true, bottom: true,
    seed: GRAP_SEED, open: stopV2Stage, after: scrollTo('[data-retention="near-miss"]'),
    check: ['[data-retention="near-miss"]'], expect: /TO GO[\s\S]*RETRY[\s\S]*COME BACK FRESH TOMORROW/i,
  },
  {
    name: 'f3-v2-second-go',
    note: 'The same v2 stage retried from its panel and stopped again: the second go today, no RETRY; "Two goes at this one today", DONE FOR TODAY.',
    clock: true, once: true, bottom: true,
    seed: GRAP_SEED, open: stopV2StageTwice, after: scrollTo('[data-retention="near-miss"]'),
    check: ['[data-retention="near-miss"]'], expect: /Two goes at this one today\. Come back fresh tomorrow\.[\s\S]*DONE FOR TODAY/i,
  },
  {
    name: 'f3-camp-retry',
    note: 'A real camp session (level 5, S1) stopped after round 1; its RETRY opens the camp map on level 5\'s card, so readiness and gear run again.',
    clock: true, once: true,
    seed: CAMP_FRESH_SEED, open: stopCampAndRetry,
    check: ['[data-retention="path-map"]'], expect: /VOLUME[\s\S]*START SESSION 1/,
  },
  {
    name: 'f3-camp-retry-parq',
    note: 'The same camp stop with the health check (PAR-Q) still to take: RETRY lands on the map and the sheet comes first.',
    clock: true, once: true,
    seed: CAMP_FRESH_SEED, open: stopCampAndRetryParqSheet,
    check: ['div[style*="z-index: 60"]'], expect: /HEALTH CHECK/, absent: /START SESSION 1/,
  },
  {
    name: 'f3-camp-retry-parq-done',
    note: 'The health check answered: level 5\'s card opens all the same (the retry was kept), START → readiness → gear.',
    clock: true, once: true,
    seed: CAMP_FRESH_SEED, open: stopCampAndRetryParq,
    check: ['[data-retention="path-map"]'], expect: /VOLUME[\s\S]*START SESSION 1/, absent: /HEALTH CHECK/,
  },
  {
    name: 'f3-camp-parq-break',
    note: 'The health check after a long break: away 35 days (past the RUSTY line), the check taken long ago and nothing flagged. Opening the camp asks it again, saying why.',
    seed: CAMP_BREAK_SEED(35), open: campAfterBreak,
    check: ['div[style*="z-index: 60"]'], expect: /HEALTH CHECK[\s\S]*Welcome back\. After a long break, a quick check before you train again\./,
  },
  {
    name: 'f3-camp-parq-recent',
    note: 'Away 10 days, the check taken long ago: no health check (asked once at the start, and again only after a long break). The camp opens on its path.',
    seed: CAMP_BREAK_SEED(10), open: campAfterBreak,
    check: ['[data-retention="path-map"]'], expect: /TRAINING CAMP · BOXING/, absent: /HEALTH CHECK/,
  },
  {
    name: 'f3-camp-parq-flagged',
    note: 'Away 35 days, but the saved answers flagged a yes: as before, no new check, and the camp keeps its EASY RECOMMENDED advice and Easy default.',
    seed: CAMP_BREAK_SEED(35, true), open: campAfterBreak,
    check: ['[data-retention="path-map"]'], expect: /EASY RECOMMENDED/, absent: /HEALTH CHECK/,
  },
  {
    name: 'f3-ff-nothing',
    note: 'A real Fight Focus ended in round 1, before a round was done (fake clock): the quiet SESSION ENDED card now shows what was left too, WHAT\'S LEFT · 3 ROUNDS TO GO, RETRY and COME BACK FRESH TOMORROW the same size. Still no try.',
    clock: true, once: true, bottom: true,
    seed: FF_SEED(0), open: endFightFocusAtOnce, after: scrollTo('[data-retention="near-miss"]'),
    check: ['[data-retention="near-miss"]'], same: ['[data-retention="near-miss"] button'],
    expect: /SESSION ENDED[\s\S]*ENDED EARLY[\s\S]*WHAT'S LEFT[\s\S]*3 ROUNDS TO GO[\s\S]*0 OF 3 ROUNDS[\s\S]*RETRY[\s\S]*COME BACK FRESH TOMORROW/, absent: /HOW CLOSE|ROUNDS SHORT/,
  },
  {
    name: 'f3-ff-nothing-load',
    note: 'The same nothing-done end after three finished sessions today: no RETRY, the line says when to come back, DONE FOR TODAY.',
    clock: true, once: true, bottom: true,
    seed: FF_SEED(3), open: endFightFocusAtOnce, after: scrollTo('[data-retention="near-miss"]'),
    check: ['[data-retention="near-miss"]'],
    expect: /SESSION ENDED[\s\S]*WHAT'S LEFT[\s\S]*3 ROUNDS TO GO[\s\S]*Three sessions done today\. Come back fresh tomorrow\.[\s\S]*DONE FOR TODAY/, absent: /\bRETRY\b/,
  },
  {
    name: 'f3-ff-nothing-off',
    note: 'Switch off (what everyone sees until launch): the same nothing-done end is the quiet SESSION ENDED card as before, no panel.',
    clock: true, once: true, bottom: true, owner: false,
    seed: FF_SEED(0), open: endFightFocusAtOnce,
    check: ['body'], expect: /SESSION ENDED[\s\S]*ENDED EARLY[\s\S]*YOUR PROGRESS/, absent: /WHAT'S LEFT|HOW CLOSE|COME BACK FRESH/,
  },
  // ── the old UI fixed app-wide (for everyone): the end screens with every switch off ──
  {
    name: 'o-end-ff-clear',
    note: 'For everyone (switches off): a real Fight Focus run to its end. The banner as wide as the cards, the round recap on every phone height, and the scroll chevron and BETA pill over nothing (as it opens, and scrolled to its end: -end).',
    clock: true, once: true, owner: false, bottom: true,
    seed: FF_SEED(0), open: finishFightFocus,
    check: ['body'], align: [['[data-ui="integrity-banner"]', '[data-ui="mc-stats"]']],
    expect: /MISSION COMPLETE[\s\S]*ROUND RECAP[\s\S]*YOUR PROGRESS/,
  },
  {
    name: 'o-end-ff-stopped',
    note: 'For everyone: Fight Focus stopped in round 2: GOOD EFFORT, the PARTIAL COMPLETION banner as wide as the cards, its 1-round recap.',
    clock: true, once: true, owner: false, bottom: true,
    seed: FF_SEED(0), open: stopFightFocus,
    check: ['body'], align: [['[data-ui="integrity-banner"]', '[data-ui="mc-stats"]']],
    expect: /PARTIAL COMPLETION[\s\S]*ROUND RECAP[\s\S]*YOUR PROGRESS/, absent: /HOW CLOSE/,
  },
  {
    name: 'o-end-cc',
    note: 'For everyone: Combat Conditioning ended at once: its summary.',
    once: true, owner: false, bottom: true,
    seed: FF_SEED(0), open: endCombatConditioning,
    check: ['body'], expect: /YOUR PROGRESS[\s\S]*RETURN HOME/,
  },
  {
    name: 'o-end-fit',
    note: 'For everyone: Build Workout finished with two exercises left: SESSION ENDED with its SESSION SUMMARY chips (dropped under 812 px tall before, shown now).',
    once: true, owner: false, bottom: true,
    seed: FF_SEED(0), open: finishBuildWorkoutEarly,
    check: ['body'], expect: /SESSION ENDED[\s\S]*SESSION SUMMARY[\s\S]*YOUR PROGRESS/,
  },
  // Other screens, for everyone: the BETA pill (and, where the page scrolls,
  // the chevron on its shelf) over no text, button, picture or card.
  ...[
    ['o-home', 'Home', async (page, w) => { await home(page, w); }, /FIT MODE/],
    ['o-fight-hub', 'the Fight hub', async (page, w) => { await home(page, w); await page.locator('button[aria-label="FIGHT MODE"]').click({ timeout: 5000 }); await wait(page, 1500); }, /FIGHT FOCUS/],
    ['o-fit-hub', 'the Fit hub', async (page, w) => { await home(page, w); await page.locator('button[aria-label="FIT MODE"]').click({ timeout: 5000 }); await wait(page, 1500); }, /Quick Mission/i],
    ['o-ff-setup', 'Fight Focus setup', async (page, w) => { await home(page, w); await page.locator('button[aria-label="FIGHT MODE"]').click({ timeout: 5000 }); await wait(page, 1200); await page.locator('.fb', { hasText: 'FIGHT FOCUS' }).first().click({ timeout: 4000 }); await wait(page, 1500); }, /START SESSION/],
    ['o-combo-setup', 'Combo Coach setup', async (page, w) => { await home(page, w); await page.locator('button[aria-label="FIGHT MODE"]').click({ timeout: 5000 }); await wait(page, 1200); await page.locator('.fb', { hasText: 'COMBO COACH' }).first().click({ timeout: 4000 }); await wait(page, 1500); }, /START COMBOS/],
    ['o-cc-setup', 'Combat Conditioning setup', async (page, w) => { await home(page, w); await page.locator('button[aria-label="FIGHT MODE"]').click({ timeout: 5000 }); await wait(page, 1200); await page.locator('.ft.cond').click({ timeout: 4000 }); await wait(page, 1500); }, /PICK A CIRCUIT/],
    ['o-qm-setup', 'Quick Mission', async (page, w) => { await home(page, w); await page.locator('button[aria-label="FIT MODE"]').click({ timeout: 5000 }); await wait(page, 1200); await page.locator('[data-guide="fit-quick"]').click({ timeout: 4000 }); await wait(page, 1500); }, /START/],
    ['o-builder-setup', 'Build Workout setup', async (page, w) => { await home(page, w); await page.locator('button[aria-label="FIT MODE"]').click({ timeout: 5000 }); await wait(page, 1200); await page.locator('[data-guide="fit-builder"]').click({ timeout: 4000 }); await wait(page, 1500); }, /GENERATE WORKOUT/],
    ['o-camp', 'the Training Camp map', async (page, w) => { await home(page, w); await page.locator('button[aria-label="FIGHT MODE"]').click({ timeout: 5000 }); await wait(page, 1200); await page.locator('.fb', { hasText: 'TRAINING CAMP' }).first().click({ timeout: 4000 }); await wait(page, 2000); }, /TRAINING CAMP/],
    ['o-arcade', 'the Training Arcade', async (page, w) => { await home(page, w); await page.locator('[data-guide="home-arcade"]').first().click({ timeout: 5000 }); await wait(page, 3000); }, /TRAINING ARCADE/],
    ['o-jt-setup', 'Just Train setup', async (page, w) => { await home(page, w); await page.locator('button[aria-label="FIGHT MODE"]').click({ timeout: 5000 }); await wait(page, 1200); await page.locator('.fb', { hasText: 'JUST TRAIN' }).first().click({ timeout: 4000 }); await wait(page, 1500); }, /START/],
    ['o-practice', 'Practice', async (page, w) => { await home(page, w); await page.locator('button[aria-label="FIGHT MODE"]').click({ timeout: 5000 }); await wait(page, 1200); await page.locator('[data-guide="fh-practice"]').first().click({ timeout: 4000 }); await wait(page, 2000); }, /PRACTICE/],
    ['o-programs', 'Programs', async (page, w) => { await home(page, w); await page.locator('button[aria-label="FIT MODE"]').click({ timeout: 5000 }); await wait(page, 1200); await page.locator('[data-guide="fit-programs"]').click({ timeout: 4000 }); await wait(page, 1500); }, /PROGRAM/i],
    ['o-cardio', 'Cardio setup', async (page, w) => { await home(page, w); await page.locator('button[aria-label="FIT MODE"]').click({ timeout: 5000 }); await wait(page, 1200); await page.locator('[data-guide="fit-cardio"]').click({ timeout: 4000 }); await wait(page, 1800); }, /START/],
    ['o-saga', 'a saga\'s ladder (the first playable saga)', async (page, w) => {
      await home(page, w); await page.locator('[data-guide="home-arcade"]').first().click({ timeout: 5000 }); await wait(page, 2500);
      let hit = false;
      for (let i = 0; i < 8 && !hit; i++) {
        hit = await page.evaluate(() => { const b = [...document.querySelectorAll('button,[role="button"]')].find((x) => /\bSTART\b[\s\S]*CLEARED/.test(x.innerText)); if (b) b.click(); return !!b; });
        if (!hit) { await page.locator('button[aria-label="Next saga"]').click({ force: true, timeout: 3000 }); await wait(page, 900); }
      }
      await wait(page, 2500);
    }, /STAGE|CLIMB/i],
    ['o-level', 'the Level page', async (page, w) => { await home(page, w); await page.getByRole('button', { name: /^PROFILE$/ }).first().click({ timeout: 4000 }); await wait(page, 1200); await page.getByRole('button', { name: /View your level/ }).first().click({ timeout: 4000 }); await wait(page, 1500); }, /YOUR LEVEL/i],
    ['o-progress', 'Progress', async (page, w) => { await home(page, w); await page.getByRole('button', { name: /^PROGRESS$/ }).first().click({ timeout: 4000 }); await wait(page, 1500); }, /PROGRESS|XP/i],
    ['o-profile', 'Profile', async (page, w) => { await home(page, w); await page.getByRole('button', { name: /^PROFILE$/ }).first().click({ timeout: 4000 }); await wait(page, 1500); }, /PROFILE/],
  ].map(([name, what, open, expect]) => ({
    name, note: `For everyone (switches off): ${what}. The BETA pill over nothing, and on a page that scrolls the chevron on the shelf over the tab bar (-end: scrolled to its end).`,
    // The bottom check is the point here; text cut elsewhere (a carousel's
    // cards off to the side) is printed as a warning, as on the other states.
    owner: false, bottom: true, seed: FF_SEED(0), open, check: ['[data-guide="nav-tabs"]'], expect,
  })),
  // A session paused (left by the tab bar) while another page scrolls: its
  // RESUME pill on the right of the shelf reaches past the middle, so the
  // scroll chevron stays off; the BETA pill, the RESUME pill and (with nothing
  // paused) the chevron each cover nothing and keep apart.
  {
    name: 'o-paused-end-ff',
    note: 'For everyone (switches off): a Combat Conditioning circuit paused 10 minutes ago (left by the tab bar), then a Fight Focus run from its setup to the end: MISSION COMPLETE, a page that scrolls on every phone, with the longest RESUME pill (RESUME · COMBAT CONDITIONING, past the middle of the row at every width). No scroll chevron while the pill is on the row (it went under the pill); the BETA and RESUME pills over nothing and apart (-end: scrolled to its end).',
    clock: true, once: true, owner: false, bottom: true,
    seed: () => ({ ...FF_SEED(0)(), trainingModePausedSession: PAUSED('cc_active') }), open: finishFightFocusFromSetup,
    check: ['body'], inView: ['[data-ui="resume-pill"]'], expect: /MISSION COMPLETE[\s\S]*YOUR PROGRESS[\s\S]*RESUME · COMBAT CONDITIONING/,
  },
  {
    name: 'o-paused-trophies',
    note: 'For everyone (switches off): Progress, TROPHIES (a page that scrolls on every phone) with a Quick Mission paused: RESUME · QUICK MISSION on the shelf, no scroll chevron under it, the BETA and RESUME pills over nothing and apart (-end: scrolled to its end).',
    owner: false, bottom: true,
    seed: () => ({ ...FF_SEED(0)(), trainingModePausedSession: PAUSED('qm_active') }),
    open: async (page, w) => {
      await home(page, w);
      await page.getByRole('button', { name: /^PROGRESS$/ }).first().click({ timeout: 4000 }); await wait(page, 1200);
      await page.getByRole('button', { name: /^TROPHIES$/ }).first().click({ timeout: 4000 }); await wait(page, 1500);
    },
    check: ['[data-guide="nav-tabs"]'], inView: ['[data-ui="resume-pill"]'], expect: /RESUME · QUICK MISSION/,
  },
  {
    name: 'o-paused-fight-hub',
    note: 'For everyone (switches off): the Fight hub (a one-screen page: no shelf, it keeps the row above the tab bar clear) with a Combat Conditioning circuit paused: the RESUME pill (5 px lower than before, as on the shelf) and the BETA pill over nothing and apart.',
    owner: false, bottom: true,
    seed: () => ({ ...FF_SEED(0)(), trainingModePausedSession: PAUSED('cc_active') }),
    open: async (page, w) => { await home(page, w); await page.locator('button[aria-label="FIGHT MODE"]').click({ timeout: 5000 }); await wait(page, 1500); },
    check: ['[data-guide="nav-tabs"]'], inView: ['[data-ui="resume-pill"]'], expect: /FIGHT FOCUS[\s\S]*RESUME · COMBAT CONDITIONING/,
  },
  {
    name: 'o-concept',
    note: 'A concept drop\'s page (owner preview: drops show only with it): its fixed START bar keeps above the shelf, the BETA pill and the chevron on the shelf.',
    bottom: true, seed: FF_SEED(0),
    open: async (page, w) => {
      await page.goto(BASE, { waitUntil: 'networkidle' }); await wait(page, 1800);
      await page.mouse.click(Math.round(w / 2), 120); await wait(page, 1800);
      await page.getByRole('button', { name: /START THE REGIME/ }).first().click({ timeout: 5000 }); await wait(page, 1800);
    },
    check: ['[data-guide="nav-tabs"]'], expect: /WEEK 1 OF 4/,
  },
  {
    name: 'f3-gallery',
    note: 'The design gallery (/retention-looks), feature 3: the real panel and the real classic stage screens (third star, no replay today: the gap over the next stage with no come-back line, partial) with sample data.',
    seed: () => ({}),
    open: async (page) => { await page.goto(`${BASE}retention-looks`, { waitUntil: 'networkidle' }); await wait(page, 4000); },
    check: ['#f3'], shot: '#f3', expect: /NEAR-MISS RETRY[\s\S]*GO FOR THE THIRD STAR[\s\S]*no replay today[\s\S]*11 s OFF[^]*?UNDER \d+:\d\d\s*START STAGE 6/i,
  },
  {
    name: 'f2-gallery',
    note: 'The design gallery (/retention-looks), feature 2: every card renders the real components with sample data.',
    seed: () => ({}),
    open: async (page) => { await page.goto(`${BASE}retention-looks`, { waitUntil: 'networkidle' }); await wait(page, 4000); },
    check: ['#f2'], shot: '#f2', expect: /THE PATH \+ STARS/,
  },
];

// ── the checks ─────────────────────────────────────────────────────────────
// Runs in the page. Returns { fails: [...], warns: [...] }.
function measure({ checkSelectors, apart, clear, inView = [], oneLine = [], whole = [], same = [], align = [], bottom = false, atEnd = false }) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const fails = [], warns = [];
  const name = (el) => {
    const t = (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 50);
    return `${el.tagName.toLowerCase()}${el.dataset?.guide ? `[${el.dataset.guide}]` : ''} "${t}"`;
  };
  const shown = (el) => {
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) return false;
    }
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const clips = (cs) => cs.overflowX !== 'visible' || cs.overflowY !== 'visible';
  const clippers = (el) => { const out = []; for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) if (clips(getComputedStyle(e))) out.push(e); return out; };
  const ownText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());

  if (document.documentElement.scrollWidth > vw + 1) fails.push(`the page scrolls sideways (${document.documentElement.scrollWidth} > ${vw})`);
  for (const el of document.querySelectorAll('body *')) {
    if (!shown(el)) continue;
    const r = el.getBoundingClientRect();
    if ((r.right > vw + 1 || r.left < -1) && !clippers(el).length && getComputedStyle(el).position !== 'fixed') fails.push(`past the viewport: ${name(el)} (${Math.round(r.left)}..${Math.round(r.right)} of ${vw})`);
  }
  const roots = checkSelectors.flatMap((s) => [...document.querySelectorAll(s)]).filter(shown);
  const inScope = (el) => roots.some((root) => root.contains(el));
  for (const el of document.querySelectorAll('body *')) {
    if (!shown(el) || !ownText(el)) continue;
    const out = inScope(el) ? fails : warns;
    const cs = getComputedStyle(el);
    if (clips(cs) && el.scrollWidth > el.clientWidth + 1) out.push(`text cut sideways: ${name(el)} (${el.scrollWidth} > ${el.clientWidth})`);
    // A clamp hides a line when what is cut is at least half a line (the
    // font's glyph box can stand a pixel or two past a tight line height).
    const lineH = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
    if (cs.webkitLineClamp && cs.webkitLineClamp !== 'none' && el.scrollHeight > el.clientHeight + Math.max(1, lineH / 2)) out.push(`lines hidden: ${name(el)}`);
    // Sideways, every box that clips counts; up and down, only those inside
    // the nearest scroller (beyond it, the text is just scrolled out of view).
    const r = el.getBoundingClientRect();
    let pastScroller = false;
    for (const c of clippers(el)) {
      const cr = c.getBoundingClientRect(), ccs = getComputedStyle(c);
      const scrollsY = ccs.overflowY === 'auto' || ccs.overflowY === 'scroll';
      const outX = r.left < cr.left - 1 || r.right > cr.right + 1;
      const outY = !pastScroller && !scrollsY && (r.top < cr.top - 1 || r.bottom > cr.bottom + 1);
      if (outX || outY) { out.push(`text outside the box that clips it: ${name(el)}`); break; }
      if (scrollsY) pastScroller = true;
    }
  }
  if (!roots.length) fails.push(`none of ${checkSelectors.join(', ')} is on screen`);
  // Pairs that must not overlap (a toast over the header must not reach the card below it).
  for (const [a, b] of apart) {
    const ea = document.querySelector(a), eb = document.querySelector(b);
    if (!ea || !eb || !shown(ea) || !shown(eb)) continue;
    const ra = ea.getBoundingClientRect(), rb = eb.getBoundingClientRect();
    const overlap = ra.left < rb.right - 1 && rb.left < ra.right - 1 && ra.top < rb.bottom - 1 && rb.top < ra.bottom - 1;
    if (overlap) fails.push(`overlap: ${name(ea)} over ${name(eb)}`);
  }
  // Every element of A clear of every element of B (a hint over the path's nodes).
  for (const [a, b] of clear) {
    const as = [...document.querySelectorAll(a)].filter(shown), bs = [...document.querySelectorAll(b)].filter(shown);
    if (!as.length) fails.push(`${a} is not on screen`);
    for (const ea of as) for (const eb of bs) {
      if (ea.contains(eb) || eb.contains(ea)) continue;
      const ra = ea.getBoundingClientRect(), rb = eb.getBoundingClientRect();
      if (ra.left < rb.right - 1 && rb.left < ra.right - 1 && ra.top < rb.bottom - 1 && rb.top < ra.bottom - 1) fails.push(`overlap: ${name(ea)} over ${name(eb)}`);
    }
  }
  // Whole inside the screen (a pop-up card: nothing above, below or beside the viewport).
  for (const sel of inView) {
    const els = [...document.querySelectorAll(sel)].filter(shown);
    if (!els.length) fails.push(`${sel} is not on screen`);
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.top < -1 || r.left < -1 || r.bottom > vh + 1 || r.right > vw + 1) fails.push(`not all on screen: ${name(el)} (${Math.round(r.top)}..${Math.round(r.bottom)} of ${vh})`);
    }
  }
  // Whole inside a box (a path's node inside the path's box, past its faded edges).
  for (const [a, b] of whole) {
    const ea = [...document.querySelectorAll(a)].find(shown), eb = [...document.querySelectorAll(b)].find(shown);
    if (!ea || !eb) { fails.push(`${!ea ? a : b} is not on screen`); continue; }
    const ra = ea.getBoundingClientRect(), rb = eb.getBoundingClientRect();
    if (ra.top < rb.top + 20 || ra.bottom > rb.bottom - 1 || ra.left < rb.left - 1 || ra.right > rb.right + 1) fails.push(`not whole inside ${b}: ${name(ea)} (${Math.round(ra.top)}..${Math.round(ra.bottom)} of ${Math.round(rb.top)}..${Math.round(rb.bottom)})`);
  }
  // A text kept on one line (a long rank name: it may sit under the level, but never breaks in two).
  for (const sel of oneLine) {
    const els = [...document.querySelectorAll(sel)].filter(shown);
    if (!els.length) fails.push(`${sel} is not on screen`);
    for (const el of els) {
      const range = document.createRange(); range.selectNodeContents(el);
      const tops = [...range.getClientRects()].map((r) => Math.round(r.top));
      if (tops.length && Math.max(...tops) - Math.min(...tops) > 4) fails.push(`breaks onto a second line: ${name(el)}`);
    }
  }
  // One size for all (the near-miss panel's RETRY and its way out).
  for (const sel of same) {
    const rs = [...document.querySelectorAll(sel)].filter(shown).map((el) => el.getBoundingClientRect());
    if (rs.length > 1 && rs.some((r) => Math.abs(r.width - rs[0].width) > 1 || Math.abs(r.height - rs[0].height) > 1)) fails.push(`not one size: ${sel} (${rs.map((r) => `${Math.round(r.width)}x${Math.round(r.height)}`).join(', ')})`);
  }
  for (const [a, b] of align) {
    const ea = [...document.querySelectorAll(a)].find(shown), eb = [...document.querySelectorAll(b)].find(shown);
    if (!ea || !eb) { fails.push(`${ea ? b : a} is not on screen`); continue; }
    const ra = ea.getBoundingClientRect(), rb = eb.getBoundingClientRect();
    if (Math.abs(ra.left - rb.left) > 1 || Math.abs(ra.right - rb.right) > 1) fails.push(`not lined up: ${name(ea)} ${Math.round(ra.left)}..${Math.round(ra.right)} vs ${name(eb)} ${Math.round(rb.left)}..${Math.round(rb.right)}`);
  }
  // The scroll chevron, the BETA pill and the RESUME pill (fixed over the
  // page) cover no text, button, picture or card (a box with its own fill or
  // border), and none touches another. On a screen that scrolls they sit on
  // the shelf over the tab bar (the page passes under it, as under the tab
  // bar): each must be inside its solid part. Scrolled to the end, nothing of
  // the page is left under the shelf.
  if (bottom) {
    const floaters = [...document.querySelectorAll('[data-ui="scroll-chevron"], button[aria-label="Report beta feedback"], [data-ui="resume-pill"]')].filter(shown);
    const floater = (f) => (f.dataset.ui === 'scroll-chevron' ? 'the scroll chevron' : f.dataset.ui === 'resume-pill' ? 'the RESUME pill' : 'the BETA pill');
    // The row's pieces keep apart: at least 4 px between any two (the chevron
    // in the middle went under a paused session's RESUME pill).
    for (let i = 0; i < floaters.length; i++) {
      for (let j = i + 1; j < floaters.length; j++) {
        const a = floaters[i].getBoundingClientRect(), b = floaters[j].getBoundingClientRect();
        if (a.left < b.right + 4 && b.left < a.right + 4 && a.top < b.bottom + 4 && b.top < a.bottom + 4) {
          fails.push(`${floater(floaters[i])} and ${floater(floaters[j])} touch (${Math.round(a.left)}..${Math.round(a.right)} and ${Math.round(b.left)}..${Math.round(b.right)})`);
        }
      }
    }
    const fixedChain = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) if (getComputedStyle(e).position === 'fixed') return true; return false; };
    const shelf = [...document.querySelectorAll('[data-ui="nav-shelf"]')].find(shown);
    const sr = shelf?.getBoundingClientRect();
    const onShelf = (rf) => !!sr && rf.top >= sr.top + (Number(shelf.dataset.fade) || 0) - 1 && rf.bottom <= sr.bottom + 1 && rf.left >= sr.left - 1 && rf.right <= sr.right + 1;
    const filled = (cs) => (cs.backgroundImage && cs.backgroundImage !== 'none') || !/rgba\(\d+, \d+, \d+, 0\)|transparent/.test(cs.backgroundColor) || (parseFloat(cs.borderTopWidth) > 0 && !/rgba\(\d+, \d+, \d+, 0\)|transparent/.test(cs.borderTopColor));
    const quiet = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) if (e.getAttribute('aria-hidden') === 'true' || getComputedStyle(e).pointerEvents === 'none') return true; return false; };
    const content = (el) => {
      const cs = getComputedStyle(el), r = el.getBoundingClientRect();
      return ownText(el) ? 'text' : el.tagName === 'BUTTON' ? 'button' : el.tagName === 'IMG' && r.width * r.height < 0.6 * vw * vh ? 'picture'
        : filled(cs) && r.width * r.height < 0.6 * vw * vh ? 'card' : null;
    };
    if (sr && atEnd) {
      for (const el of document.querySelectorAll('body *')) {
        if (!shown(el) || shelf.contains(el) || fixedChain(el) || quiet(el)) continue;
        const kind = content(el); if (!kind) continue;
        let r = el.getBoundingClientRect();
        for (const c of clippers(el)) { const cr = c.getBoundingClientRect(); r = { left: Math.max(r.left, cr.left), top: Math.max(r.top, cr.top), right: Math.min(r.right, cr.right), bottom: Math.min(r.bottom, cr.bottom) }; }
        if (r.right > r.left && r.bottom > r.top && r.left < sr.right - 1 && sr.left < r.right - 1 && r.top < sr.bottom - 1 && sr.top < r.bottom - 1) fails.push(`a ${kind} left under the shelf at the end: ${name(el)}`);
      }
    }
    for (const f of floaters) {
      const rf = f.getBoundingClientRect();
      if (onShelf(rf)) continue; // the page under it is hidden by the shelf
      // Text by its glyphs (a centred line in a wide box is not under a pill
      // at the side); buttons, pictures and cards by their boxes.
      // Each by the part of it that shows: cut to the boxes that clip it (a
      // row scrolled out of its list is not under the pill).
      const glyphs = (el) => [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).flatMap((n) => { const rg = document.createRange(); rg.selectNodeContents(n); return [...rg.getClientRects()]; });
      const cut = (r, el) => {
        let x = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
        for (const c of clippers(el)) { const cr = c.getBoundingClientRect(); x = { left: Math.max(x.left, cr.left), top: Math.max(x.top, cr.top), right: Math.min(x.right, cr.right), bottom: Math.min(x.bottom, cr.bottom) }; }
        return x;
      };
      const hit = (r) => r.left < rf.right - 1 && rf.left < r.right - 1 && r.top < rf.bottom - 1 && rf.top < r.bottom - 1 && r.right > r.left && r.bottom > r.top;
      for (const el of document.querySelectorAll('body *')) {
        if (!shown(el) || f.contains(el) || el.contains(f) || fixedChain(el) || quiet(el)) continue;
        const r = el.getBoundingClientRect();
        const kind = content(el);
        if (!kind) continue;
        if (kind === 'text' ? glyphs(el).some((g) => hit(cut(g, el))) : hit(cut(r, el))) {
          fails.push(`${floater(f)} over a ${kind}: ${name(el)}`);
        }
      }
    }
  }
  return { fails: [...new Set(fails)], warns: [...new Set(warns)] };
}

// ── run ────────────────────────────────────────────────────────────────────
const launchOpts = { headless: true, args: ['--autoplay-policy=no-user-gesture-required'] };
let browser;
const tries = process.env.CHROME_PATH ? [{ executablePath: process.env.CHROME_PATH }] : [{ channel: 'chrome' }, { executablePath: '/usr/bin/google-chrome' }];
for (const t of tries) { try { browser = await chromium.launch({ ...launchOpts, ...t }); break; } catch (e) { if (t === tries.at(-1)) throw e; } }

let failures = 0;
const report = [];
for (const st of STATES) {
  if (ONLY && !ONLY.test(st.name)) continue;
  if (st.needsDays && todayIdx < st.needsDays) { console.log(`skip ${st.name}: needs ${st.needsDays} days of this week before today (today is weekday ${todayIdx})`); continue; }
  const runAt = async (page, [w, h], first) => {
    if (!st.once || first) await st.open(page, w);
    else { await page.setViewportSize({ width: w, height: h }); await wait(page, 700); }
    if (st.after) await st.after(page);
    await wait(page, 600);
    const t = await page.evaluate(() => document.body.innerText);
    const mOpts = { checkSelectors: st.check || [], apart: st.apart || [], clear: st.clear || [], inView: st.inView || [], oneLine: st.oneLine || [], whole: st.whole || [], same: st.same || [], align: st.align || [], bottom: !!st.bottom };
    const res = await page.evaluate(measure, mOpts);
    // Stars a node must say it holds (its aria-label: "Level 2, cleared, 2 of 3 stars").
    for (const [pre, want] of Object.entries(st.stars || {})) {
      const lab = await page.locator(`[aria-label^="${pre}"]`).first().getAttribute('aria-label', { timeout: 2000 }).catch(() => null);
      if (!lab || !lab.includes(want)) res.fails.push(`${pre} should hold ${want} stars (it reads: ${lab})`);
    }
    if (st.expect && !st.expect.test(t)) res.fails.unshift(`expected ${st.expect} on screen`);
    if (st.absent && st.absent.test(t)) res.fails.unshift(`not expected on screen: ${st.absent} (${t.match(st.absent)[0]})`);
    const tag = sizeTag([w, h]);
    const file = path.join(OUT, `${st.name}-${tag}.png`);
    if (st.shot) {
      // A whole element taller than the screen: the app scrolls inside its own
      // box, so the window is made as tall as the element for the photo (in
      // CSS pixels), then put back.
      const tall = await page.locator(st.shot).first().evaluate((el) => Math.ceil(el.getBoundingClientRect().height));
      await page.setViewportSize({ width: w, height: Math.min(16000, Math.max(h, tall + 200)) }); await wait(page, 800);
      await page.locator(st.shot).first().screenshot({ path: file, scale: 'css' });
      // Each card (a Look's section, not one nested in another) as its own
      // crop at the phone's scale, so its text can be read.
      const cards = await page.locator(st.shot).first().evaluate((root) => [...root.querySelectorAll('section')]
        .map((el, i) => { const outer = el.parentElement?.closest('section'); return outer && root.contains(outer) ? -1 : i; }).filter((i) => i >= 0));
      for (let k = 0; k < cards.length; k++) {
        const crop = path.join(OUT, `${st.name}-${tag}-card${String(k + 1).padStart(2, '0')}.png`);
        await page.locator(`${st.shot} section`).nth(cards[k]).screenshot({ path: crop, scale: 'device' });
      }
      await page.setViewportSize({ width: w, height: h });
    } else await page.screenshot({ path: file });
    if (st.bottom) {
      // The same screen scrolled to its end: the last card clear of the BETA
      // pill (and the chevron gone), then back to the top for the next size.
      const scrollEnd = (top) => page.evaluate((t) => { for (const el of document.querySelectorAll('*')) { const cs = getComputedStyle(el); if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1) el.scrollTop = t ? 0 : el.scrollHeight; } }, top);
      await scrollEnd(false); await wait(page, 1000);
      const endRes = await page.evaluate(measure, { ...mOpts, atEnd: true });
      res.fails.push(...endRes.fails.map((f) => `scrolled to the end: ${f}`));
      await page.screenshot({ path: path.join(OUT, `${st.name}-${tag}-end.png`) });
      await scrollEnd(true); await wait(page, 600);
    }
    const ok = !res.fails.length;
    if (!ok) failures++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${st.name} @${w}x${h}  → ${file}`);
    for (const f of res.fails) console.log(`       ✗ ${f}`);
    for (const f of res.warns.slice(0, 6)) console.log(`       · warn (not new): ${f}`);
    report.push({ state: st.name, size: `${w}x${h}`, file, fails: res.fails, warns: res.warns });
  };
  const contextFor = async ([w, h]) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const seed = { ...BASE_KEYS, ...st.seed() };
    if (st.owner === false) delete seed.tm_owner_preview;
    await ctx.addInitScript((s) => {
      try { Object.defineProperty(window, 'speechSynthesis', { value: undefined }); } catch { /* read-only */ }
      try {
        const snap = sessionStorage.getItem('__rp_seed');
        if (snap) { sessionStorage.removeItem('__rp_seed'); localStorage.setItem('trainingModePausedSession', snap); }
      } catch { /* no session storage */ }
      if (localStorage.getItem('__rp')) return;
      localStorage.clear();
      // The come-back reminder shares the slot over the header: dismissed for
      // today, so the header itself is seen (a state can seed its own toast).
      localStorage.setItem('tm_reminder_card_dismissed', s.today);
      for (const [k, v] of Object.entries(s.seed)) localStorage.setItem(k, v);
      localStorage.setItem('__rp', '1');
    }, { seed, today: NOW.toDateString() });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
    // Every state on the same fixed day and time (see the header).
    await page.clock.install({ time: NOW_MS });
    return { ctx, page, errors };
  };
  try {
    if (st.once) {
      const { ctx, page, errors } = await contextFor(SIZES[0]);
      for (let i = 0; i < SIZES.length; i++) await runAt(page, SIZES[i], i === 0);
      if (errors.length) { failures++; console.log(`FAIL ${st.name}: page errors: ${errors.join(' | ')}`); }
      await ctx.close();
    } else {
      for (const size of SIZES) {
        const { ctx, page, errors } = await contextFor(size);
        await runAt(page, size, true);
        if (errors.length) { failures++; console.log(`FAIL ${st.name}: page errors: ${errors.join(' | ')}`); }
        await ctx.close();
      }
    }
  } catch (e) {
    failures++;
    console.log(`FAIL ${st.name}: ${e.message}`);
  }
}
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ base: BASE, at: new Date().toISOString(), states: STATES.map((s) => ({ name: s.name, note: s.note })), results: report }, null, 2));
await browser.close();
console.log(failures ? `\n${failures} failed` : '\nall states fit');
process.exit(failures ? 1 : 0);

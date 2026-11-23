// Retention preview: every new screen state of the retention features, seeded
// with sample data, opened on the web dev server and photographed at three
// phone sizes. Fails when anything overflows the viewport or any text is cut
// off (the owner's visual rule, RETENTION-PLAN.md).
//
//   node scripts/retention-preview.mjs <out-dir> [--base http://localhost:8081] [--only <regex>]
//
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
// Features 2 and 3 add their states to STATES (f1-, f2-, f3- names).
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
const OUT = args.find((a, i) => !a.startsWith('--') && !['--base', '--only'].includes(args[i - 1]));
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const BASE = (opt('--base') || 'http://localhost:8081').replace(/\/$/, '') + '/';
const ONLY = opt('--only') ? new RegExp(opt('--only')) : null;
if (!OUT) { console.error('usage: node scripts/retention-preview.mjs <out-dir> [--base URL] [--only regex]'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });

const SIZES = [[360, 780], [390, 844], [430, 932]];

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
// The real daily mission on a fake clock: START on the card, the round runs,
// the end screen opens with its strip.
async function runDailyMission(page, w) {
  await home(page, w);
  const now = () => page.evaluate(() => Date.now());
  await page.clock.pauseAt((await now()) + 500);
  await page.locator('[data-guide="home-daily-mission"] button').first().click({ timeout: 4000 });
  for (let i = 0; i < 400; i++) {
    await page.clock.runFor(1000);
    const t = await page.evaluate(() => document.body.innerText);
    if (/YOUR PROGRESS/.test(t)) break;
    const cont = page.getByRole('button', { name: /^CONTINUE$/ });
    if (/LEVEL UP/i.test(t) && await cont.count()) await cont.first().click({ timeout: 2000 }).catch(() => {});
  }
  await page.clock.resume();
  await wait(page, 2500);
  if (!/YOUR PROGRESS/.test(await page.evaluate(() => document.body.innerText))) throw new Error('the daily mission did not reach its end screen');
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
// Training Camp: levels 1-4 cleared, level 5 current with S1 done.
const CAMP_SEED = () => ({
  tm_user_profile: JSON.stringify(FIGHTER), tm_user_stats: stats(history({ onTarget: 2, thisWeek: Math.min(1, todayIdx) }), 3000),
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

const scrollTo = (sel) => async (page) => { await page.locator(sel).first().scrollIntoViewIfNeeded({ timeout: 4000 }); await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center' }), sel); await wait(page, 400); };

// ── the states ─────────────────────────────────────────────────────────────
// { name, note, seed(), open(page, w), check: [selectors], apart?: [[selA, selB]], expect: RegExp,
//   absent?: RegExp (must not be on screen), clear?: [[selA, selB]] (no element of A over any of B),
//   once?: true, clock?: true, after?(page), shot?: selector (photograph that element whole) }
// `once`: open the screen once (at the first size) and resize for the others.
// `clock`: a state that drives the clock itself (pauses it, runs it on); every
// state starts on the fixed clock.
const HOME_CHECK = ['header[data-guide="home-level"]', '[data-guide="home-daily-mission"]', '[role="status"]'];
const HOME_APART = [['[role="status"]', '[data-guide="home-daily-mission"]']];
const STATES = [
  {
    name: 'f1-home-mission-ready',
    note: 'Home: the week chip (9-week streak, 3 of 4 days, 2 freezes) and the DAILY MISSION card, ready.',
    seed: () => ({ tm_user_profile: JSON.stringify(FIGHTER), tm_user_stats: stats(history({ onTarget: 9, thisWeek: Math.min(3, todayIdx) }), 6750) }),
    open: home, check: HOME_CHECK, apart: HOME_APART, expect: /DAILY MISSION[\s\S]*START/,
  },
  {
    name: 'f1-home-mission-fit-new',
    note: 'Home: a new, fit-leaning athlete: no streak yet, the starting freeze, a 3-minute Quick Mission.',
    seed: () => ({ tm_user_profile: JSON.stringify(FITTER), tm_user_stats: stats([], 0) }),
    open: home, check: HOME_CHECK, apart: HOME_APART, expect: /Quick Mission:/,
  },
  {
    name: 'f1-home-mission-done',
    note: 'Home: the mission done today; the card says so until tomorrow, today\'s dot is filled.',
    seed: () => {
      const rows = [...history({ onTarget: 3, thisWeek: Math.min(2, todayIdx) }), row(new Date(NOW_MS - 3600000))];
      const date = iso(NOW);
      const mission = { date, side: 'fight', minutes: 3, bonusXp: 25, tier: 'NORMAL', lighter: false, id: `${date}:fight`, discipline: 'Boxing', difficulty: 'Normal', title: 'One Round: Boxing', line: 'Fight Focus · Normal · fits your level' };
      return {
        tm_user_profile: JSON.stringify(FIGHTER), tm_user_stats: stats(rows, 4200),
        tm_daily_mission_v2: JSON.stringify({ date, mission, done: true, doneAt: new Date(NOW_MS - 3600000).toISOString(), xp: 25 }),
        tm_week_moments_v1: JSON.stringify({ day: date, seen: [] }),
      };
    },
    open: home, check: HOME_CHECK, apart: HOME_APART, expect: /DAILY MISSION DONE/,
  },
  {
    name: 'f1-home-freeze-used',
    note: 'Home, the week after a short one: the quiet freeze-used notice in the nudge slot.',
    seed: () => ({ tm_user_profile: JSON.stringify(FIGHTER), tm_user_stats: stats(history({ onTarget: 9, gapWeeks: [1], thisWeek: 0 }), 6100) }),
    open: home, check: HOME_CHECK, apart: HOME_APART, expect: /A freeze covered last week/,
  },
  {
    name: 'f1-home-freeze-earned',
    note: 'Home: a freeze earned last week on a screen with no strip (shown once here).',
    seed: () => ({ tm_user_profile: JSON.stringify(FIGHTER), tm_user_stats: stats(history({ onTarget: 4, thisWeek: 0 }), 3000) }),
    open: home, check: HOME_CHECK, apart: HOME_APART, expect: /Freeze earned/,
  },
  {
    name: 'f1-home-header-long',
    note: 'Home header at its widest: a secret rank name, a 2-digit level and streak.',
    seed: () => {
      const rows = history({ onTarget: 12, thisWeek: Math.min(3, todayIdx) }).map((r) => ({ ...r, xpEarned: 700 }));
      return { tm_user_profile: JSON.stringify(FIGHTER), tm_user_stats: stats(rows, 33500) };
    },
    open: home, check: HOME_CHECK, apart: HOME_APART, expect: /LV \d\d/,
  },
  {
    name: 'f1-profile-target',
    note: 'Profile → edit → Game Plan: the weekly target 2 to 6, a change pending for Monday, the freezes.',
    seed: () => ({
      tm_user_profile: JSON.stringify(FIGHTER), tm_user_stats: stats(history({ onTarget: 2, thisWeek: Math.min(2, todayIdx) }), 2000),
      tm_game_plan_v1: JSON.stringify({ setup: true, hurdle: 'time', daysPerWeek: 5, sessionMinutes: 20, preferredTime: 'varies', restDays: [], weekTargets: [{ from: '', days: 4 }, { from: iso(monday(-1)), days: 5 }] }),
    }),
    open: profileEditor, check: ['[data-retention="week-target"]'], expect: /Keeps your streak/,
  },
  {
    name: 'f1-gallery',
    note: 'The design gallery (/retention-looks), feature 1: every card renders the real components with sample data.',
    seed: () => ({}),
    open: async (page) => { await page.goto(`${BASE}retention-looks`, { waitUntil: 'networkidle' }); await wait(page, 2500); },
    check: ['#f1'], shot: '#f1', expect: /DAILY MISSION \+ STREAK FREEZE/,
  },
  {
    name: 'f1-end-day-kept',
    note: 'The real daily mission (fake clock) → its end screen: TRAINING DAY n OF 4 · STREAK KEPT, the new dot pops, +25 XP.',
    clock: true, once: true,
    seed: () => ({ tm_user_profile: JSON.stringify(FIGHTER), tm_user_stats: stats(history({ onTarget: 9, thisWeek: Math.min(2, todayIdx) }), 6750) }),
    open: runDailyMission, after: scrollTo('[data-retention="week-moment"]'), check: ['[data-retention="week-moment"]'], expect: /TRAINING DAY|WEEK COMPLETE/,
  },
  {
    name: 'f1-end-week-complete',
    note: 'The daily mission lands the 4th day of the 4th week on target: WEEK COMPLETE, a freeze earned.',
    clock: true, once: true, needsDays: 3,
    seed: () => ({ tm_user_profile: JSON.stringify(FIGHTER), tm_user_stats: stats(history({ onTarget: 3, thisWeek: 3 }), 3300) }),
    open: runDailyMission, after: scrollTo('[data-retention="week-moment"]'), check: ['[data-retention="week-moment"]'], expect: /WEEK COMPLETE[\s\S]*FREEZE EARNED/,
  },
  {
    name: 'f2-home-next-up',
    note: 'Home: NEXT UP folded into the Continue card (the last session is that saga): One Hundred, stage 6, one card.',
    seed: OP_SEED, open: home, after: scrollTo('[data-retention="next-up"]'),
    check: ['[data-retention="next-up"]'], expect: /NEXT UP[\s\S]*One Hundred\s+Stage 6 · The Standard Hundred[\s\S]*CONTINUE/, absent: /NEXT UP · ONE HUNDRED|Arcade · Stage 5/,
  },
  {
    name: 'f2-home-next-up-camp',
    note: 'Home: NEXT UP for Training Camp folded into the Continue card: the current level (5), one card.',
    seed: CAMP_SEED, open: home, after: scrollTo('[data-retention="next-up"]'),
    check: ['[data-retention="next-up"]'], expect: /NEXT UP[\s\S]*Training Camp\s+Boxing · Level 5 · Volume[\s\S]*CONTINUE/, absent: /NEXT UP · TRAINING CAMP|Level 5 · Normal/,
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
    note: 'Training Camp as a path: levels 1-4 checked, level 5 current with S1 done, the title fight at the top.',
    seed: CAMP_SEED, open: continueLast,
    check: ['[data-retention="path-map"]'], expect: /TRAINING CAMP · BOXING[\s\S]*START/,
  },
  {
    name: 'f2-camp-replay',
    note: 'A cleared camp level\'s replay sheet: a check (camp has no stars yet), both sessions done.',
    seed: CAMP_SEED, open: tapNode('[aria-label^="Level 4,"]'),
    check: ['[data-retention="replay-sheet"]'], expect: /LEVEL 4 · [\s\S]*CLEARED[\s\S]*CONDITIONING/,
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
    clock: true, once: true,
    seed: GRAP_SEED, open: replayV2Stage, after: scrollTo('[data-retention="stage-stars"]'),
    check: ['[data-retention="stage-stars"]'], expect: /STAGE STARS · 2 OF 3/,
  },
  {
    name: 'f3-ff-partial',
    note: 'A real Fight Focus stopped in round 2 (fake clock): the panel under the stats, 2 ROUNDS TO GO, RETRY and COME BACK FRESH TOMORROW the same size.',
    clock: true, once: true,
    seed: FF_SEED(0), open: stopFightFocus, after: scrollTo('[data-retention="near-miss"]'),
    check: ['[data-retention="near-miss"]'], expect: /2 ROUNDS TO GO[\s\S]*1 OF 3 ROUNDS[\s\S]*RETRY[\s\S]*COME BACK FRESH TOMORROW/i,
  },
  {
    name: 'f3-ff-load',
    note: 'The same stop as the third finished session today: no RETRY, the line says when to come back, DONE FOR TODAY.',
    clock: true, once: true,
    seed: FF_SEED(2), open: stopFightFocus, after: scrollTo('[data-retention="near-miss"]'),
    check: ['[data-retention="near-miss"]'], expect: /Three sessions done today\. Come back fresh tomorrow\.[\s\S]*DONE FOR TODAY/i,
  },
  {
    name: 'f3-v2-partial',
    note: 'A real v2 stage (The Grappler stage 1 on FIGHT, from the path) stopped after its first round: the arcade end screen\'s panel.',
    clock: true, once: true,
    seed: GRAP_SEED, open: stopV2Stage, after: scrollTo('[data-retention="near-miss"]'),
    check: ['[data-retention="near-miss"]'], expect: /TO GO[\s\S]*RETRY[\s\S]*COME BACK FRESH TOMORROW/i,
  },
  {
    name: 'f3-v2-second-go',
    note: 'The same v2 stage retried from its panel and stopped again: the second go today, no RETRY; "Two goes at this one today", DONE FOR TODAY.',
    clock: true, once: true,
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
function measure({ checkSelectors, apart, clear }) {
  const vw = window.innerWidth;
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
    const res = await page.evaluate(measure, { checkSelectors: st.check || [], apart: st.apart || [], clear: st.clear || [] });
    if (st.expect && !st.expect.test(t)) res.fails.unshift(`expected ${st.expect} on screen`);
    if (st.absent && st.absent.test(t)) res.fails.unshift(`not expected on screen: ${st.absent} (${t.match(st.absent)[0]})`);
    const file = path.join(OUT, `${st.name}-${w}.png`);
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
        const crop = path.join(OUT, `${st.name}-${w}-card${String(k + 1).padStart(2, '0')}.png`);
        await page.locator(`${st.shot} section`).nth(cards[k]).screenshot({ path: crop, scale: 'device' });
      }
      await page.setViewportSize({ width: w, height: h });
    } else await page.screenshot({ path: file });
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
    await ctx.addInitScript((s) => {
      try { Object.defineProperty(window, 'speechSynthesis', { value: undefined }); } catch { /* read-only */ }
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

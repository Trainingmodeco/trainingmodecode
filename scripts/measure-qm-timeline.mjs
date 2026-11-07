// Measure the REAL guided timeline of a generated Quick Mission, on a fake
// clock, against the model the generator fits to (data/quickMissionTiming).
//
// It serves dist/ (run `npm run build:web` first), opens the Quick Mission
// page of the production bundle in headless Chrome, installs Playwright's fake
// clock, taps START (GUIDED) and runs the clock on one second at a time until
// the complete screen shows. The browser has no speech engine, so the coach's
// lines take no time: the measured run is the timers alone, which the model
// reproduces with `voice: false`. A loaded set is the athlete's own pace, so
// the script plays the athlete: it taps DONE after the pick-up and a
// controlled rep each, the numbers the model assumes (QM_LOADED_*).
//
// Not part of check:all (a 60 minute run takes minutes of wall time); the
// smoke test runs one short mission through the same path.
//
//   node --import ./scripts/extensionless-loader-register.mjs scripts/measure-qm-timeline.mjs \
//     [--types Bodyweight,Weighted,Hybrid] [--levels EASY,NORMAL,HARD,ADVANCED] \
//     [--mins 5,8,10,15,20,30,45,60] [--step 1000] [--dist dist] [--out results.jsonl]
//
// One line of JSON per mission: the minutes asked, what the run really took
// (`measured`), the model with the voice off (`modelOff`, what this run is
// comparable to) and with it on (`modelOn`, what the card promises), and their
// differences. `lag` is the seconds the script itself waited before tapping DONE.
//
// Chrome: set CHROME_PATH (e.g. /opt/pw-browsers/chromium), or it uses the
// Playwright "chrome" channel.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const store = new Map();
globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
const T = await import('../components/training-mode/data/quickMissionTiming.js');

const arg = (name, dflt) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : dflt; };
const TYPES_ARG = arg('types', 'Bodyweight,Weighted,Hybrid').split(',');
const LEVELS_ARG = arg('levels', 'EASY,NORMAL,HARD,ADVANCED').split(',');
const MINS_ARG = arg('mins', '5,8,10,15,20,30,45,60').split(',').map(Number);
const STEP = Number(arg('step', '1000'));
const ROOT = path.resolve(arg('dist', path.join(REPO, 'dist')));
if (!fs.existsSync(path.join(ROOT, 'index.html'))) { console.error(`measure-qm-timeline: ${ROOT}/index.html missing, run build:web first`); process.exit(1); }
const OUT = arg('out', null);

// The athlete's XP for each level, so the page opens on it (Fit side).
const XP_FOR = { EASY: 0, NORMAL: 1500, HARD: 3000, ADVANCED: 4600 };

const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.mp4': 'video/mp4' };
const server = http.createServer((req, res) => {
  let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(ROOT, 'index.html');
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}/`;
const launch = { headless: true, args: ['--autoplay-policy=no-user-gesture-required'] };
if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH; else launch.channel = 'chrome';
const browser = await chromium.launch(launch);

async function run(type, level, mins) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 811 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(([type, level, mins, xp]) => {
    try { Object.defineProperty(window, 'speechSynthesis', { value: undefined }); } catch { /* none to hide */ }
    if (location.search.includes('__reset')) { try { localStorage.clear(); sessionStorage.clear(); } catch { /* blocked */ } history.replaceState(null, '', location.pathname); }
    if (localStorage.getItem('__smoke')) return;
    localStorage.setItem('trainingModeOnboardingComplete', 'true'); localStorage.setItem('trainingModeTourComplete', 'true');
    localStorage.setItem('tm_user_profile', JSON.stringify({ name: 'SMOKE', sex: 'male', age: '', heightVal: '', heightUnit: 'FT/IN', weightVal: '', weightUnit: 'LBS', experience: 'Some Training', goal: 'Train Like a Fighter', specialty: '', voiceCoach: 'FEMALE', coachStyle: 'STANDARD', encouragement: 'normal', callStyle: 'names', discipline: 'Boxing' }));
    localStorage.setItem('tm_arcade_intro_seen', '{}'); localStorage.setItem('tm_camp_parq', JSON.stringify({ done: true, anyYes: false, ts: Date.now() })); localStorage.setItem('tm_practice_invite_v1', JSON.stringify({ introShownAt: new Date().toISOString() }));
    // The page opens on the athlete's own level (their Fit XP); an older build read the stored key.
    localStorage.setItem('tm_user_stats', JSON.stringify({ xp, sessions: xp ? [{ id: 'a', type: 'Fit Mode', xpEarned: xp, completedAt: '2026-11-01T10:00:00.000Z' }] : [] }));
    localStorage.setItem('tm_qm_keys_v1', JSON.stringify({ workoutType: type, difficulty: level, duration: Number(mins), focus: 'FULL BODY' }));
    localStorage.setItem('tm_qm_shelf_v1', JSON.stringify({ mode: 'guided' }));
    localStorage.setItem('__smoke', '1');
  }, [type, level, mins, XP_FOR[level]]);
  const page = await ctx.newPage();
  await page.clock.install({ time: Date.now() });
  const S = (ms) => page.waitForTimeout(ms);
  const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 120)));
  await page.goto(BASE + '?__reset=1', { waitUntil: 'networkidle' }); await S(2000);
  await page.mouse.click(195, 120); await S(1800);
  await page.locator('button[aria-label="Close"]').first().click({ force: true, timeout: 1500 }).catch(() => {}); await S(400);
  await page.locator('button[aria-label="FIT MODE"]').click({ timeout: 5000 }); await S(1200);
  await page.locator('[data-guide="fit-quick"]').click({ timeout: 4000 }); await S(1500);
  const now = () => page.evaluate(() => Date.now());
  await page.clock.pauseAt((await now()) + 500);
  const t0 = await now();
  await page.getByRole('button', { name: /^START$/ }).first().click({ timeout: 4000 });
  // The app saves a live session every 5 s: after 6 s the mission it is running can be read back.
  for (let i = 0; i < 6; i += 1) await page.clock.runFor(1000);
  await S(50);
  const saved = JSON.parse(await page.evaluate(() => localStorage.getItem('trainingModePausedSession')));
  const mission = saved[0].qmCfg.mission;
  const slots = [...mission.exercises, ...mission.finisherExercises];
  const modelOff = T.quickMissionTimeline(mission, { voice: false });
  const modelOn = T.quickMissionTimeline(mission, { voice: true });
  let taps = 0, lag = 0, seenAt = null, tapKey = null, finishAt = null;
  for (let guard = 0; guard < 400000; guard += 1) {
    const info = await page.evaluate(() => {
      const text = document.body.innerText;
      const done = [...document.querySelectorAll('button')].some(b => b.innerText.trim() === 'DONE' && b.offsetParent !== null);
      const ex = text.match(/EXERCISE (\d+)\/(\d+)/), rd = text.match(/ROUND (\d+)\/(\d+)/);
      return { complete: /SESSION COMPLETE|GOOD WORK|MISSION COMPLETE/.test(text), done, ex: ex && +ex[1], rd: rd && +rd[1], now: Date.now() };
    });
    if (info.complete) { finishAt = info.now - T.QM_FINISH_BELL_MS; break; }
    let step = STEP;
    if (info.done) {
      const key = `${info.rd}:${info.ex}`;
      if (tapKey !== key) { tapKey = key; seenAt = info.now; }
      const slot = slots[(info.ex || 1) - 1];
      const need = (T.QM_LOADED_SETUP_SEC + slot.reps * T.QM_LOADED_REP_SEC) * 1000;
      const waited = info.now - seenAt;
      if (waited >= need) {
        await page.getByRole('button', { name: /^DONE$/ }).first().click({ timeout: 2000 });
        taps += 1; lag += (waited - need) / 1000;
        await page.clock.runFor(1);
        continue;
      }
      step = Math.max(1, Math.min(STEP, need - waited));
    }
    await page.clock.runFor(step);
  }
  await ctx.close();
  const measured = finishAt == null ? null : (finishAt - t0) / 1000;
  const r = (x) => Math.round(x * 10) / 10;
  return {
    type, level, mins, rounds: mission.rounds, moves: slots.length, level_on_card: mission.difficulty,
    measured: measured == null ? null : r(measured), modelOff: r(modelOff.totalSec), modelOn: r(modelOn.totalSec), asked: mins * 60,
    measuredVsModelOff: measured == null ? null : r(measured - modelOff.totalSec), modelOnVsAsked: r(modelOn.totalSec - mins * 60),
    taps, lag: r(lag), errs,
  };
}

for (const type of TYPES_ARG) for (const level of LEVELS_ARG) for (const mins of MINS_ARG) {
  const t = Date.now();
  let row;
  try { row = await run(type, level, mins); } catch (e) { row = { type, level, mins, error: String(e.message).split('\n')[0] }; }
  row.wallSec = Math.round((Date.now() - t) / 1000);
  const line = JSON.stringify(row);
  console.log(line);
  if (OUT) fs.appendFileSync(OUT, line + '\n');
}
await browser.close();
server.close();

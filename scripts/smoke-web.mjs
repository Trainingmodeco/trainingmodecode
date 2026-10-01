// Runtime smoke test of the PRODUCTION build: serves dist/, opens it in a
// real headless Chrome, and starts a session in every mode. Fails on the
// "Training Mode runtime error" screen or any uncaught page error.
//
// Why: tsc does not check .jsx, lint cannot see every ordering bug, and the
// unit tests never mount a screen — a `const` read above its declaration in
// RunPlayer took every GPS run down in production while CI stayed green.
//
// Run: npm run smoke:web   (after npm run build:web)
// Chrome: Playwright's "chrome" channel (installed on GitHub runners and
// most dev machines), or set CHROME_PATH.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
if (!fs.existsSync(path.join(ROOT, 'index.html'))) { console.error('smoke-web: dist/index.html missing — run build:web first'); process.exit(1); }

const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(ROOT, 'index.html');
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}/`;

const launchOpts = { headless: true, args: ['--autoplay-policy=no-user-gesture-required'] };
if (process.env.CHROME_PATH) launchOpts.executablePath = process.env.CHROME_PATH;
else launchOpts.channel = 'chrome';
let browser;
try { browser = await chromium.launch(launchOpts); } catch (e) {
  if (process.env.CHROME_PATH) throw e;
  const guess = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((g) => fs.existsSync(g));
  if (!guess) throw e;
  browser = await chromium.launch({ ...launchOpts, channel: undefined, executablePath: guess });
}

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ['geolocation'], geolocation: { latitude: 40, longitude: -74, accuracy: 8 } });
await ctx.addInitScript(() => {
  // A reset flag on the URL wipes storage at document start — AFTER the
  // previous page unloaded (the app re-saves its live session on unload, so
  // clearing before navigation is undone) and BEFORE the app boots.
  if (location.search.includes('__reset')) {
    try { localStorage.clear(); sessionStorage.clear(); } catch {}
    history.replaceState(null, '', location.pathname);
  }
  if (localStorage.getItem('__smoke')) return;
  localStorage.setItem('trainingModeOnboardingComplete', 'true');
  localStorage.setItem('trainingModeTourComplete', 'true');
  // A finished questionnaire, like every real user: without a profile the
  // app treats the visitor as a brand-new learner and routes Fight Focus and
  // Combo Coach into the Practice invite instead of the setup screens.
  localStorage.setItem('tm_user_profile', JSON.stringify({ name: 'SMOKE', sex: 'male', age: '', heightVal: '', heightUnit: 'FT/IN', weightVal: '', weightUnit: 'LBS', experience: 'Some Training', goal: 'Train Like a Fighter', specialty: '', voiceCoach: 'FEMALE', coachStyle: 'STANDARD', encouragement: 'normal', callStyle: 'names', discipline: 'Boxing' }));
  localStorage.setItem('tm_arcade_intro_seen', '{}');
  localStorage.setItem('tm_camp_parq', JSON.stringify({ done: true, anyYes: false, ts: Date.now() }));
  localStorage.setItem('tm_practice_invite_v1', JSON.stringify({ introShownAt: new Date().toISOString() }));
  localStorage.setItem('__smoke', '1');
});
const page = await ctx.newPage();
let step = 'boot';
const failures = [];
page.on('pageerror', (e) => failures.push(`${step}: uncaught ${String(e.message).slice(0, 200)}`));

const S = (ms) => page.waitForTimeout(ms);
const text = () => page.evaluate(() => document.body.innerText);
const btn = (re) => page.getByRole('button', { name: re }).first();
// Every check starts from a clean slate: the previous check's live session
// would otherwise be restored on reload and land the app inside it.
const boot = async () => {
  await page.goto(BASE + '?__reset=1', { waitUntil: 'networkidle' }); await S(2000);
  await page.mouse.click(195, 120); await S(1800);
};
const home = async () => { await boot(); };
const fit = async () => { await home(); await page.locator('button[aria-label="FIT MODE"]').click({ timeout: 5000 }); await S(1200); };
const fight = async () => { await home(); await page.locator('button[aria-label="FIGHT MODE"]').click({ timeout: 5000 }); await S(1200); };

async function check(name, fn, expectRe) {
  step = name;
  try { await fn(); } catch (e) { failures.push(`${name}: could not drive the screen — ${String(e.message).split('\n')[0].slice(0, 160)}`); return; }
  const t = await text();
  const m = t.match(/Training Mode runtime error\s*\n+([^\n]*)/);
  if (m) failures.push(`${name}: CRASH SCREEN — ${m[1] || '(no message)'}`);
  else if (expectRe && !expectRe.test(t)) failures.push(`${name}: expected ${expectRe} on screen`);
  else console.log(`ok   ${name}`);
}

await check('home', async () => { await home(); }, /FIT MODE/);
await check('fit hub', async () => { await fit(); }, /Quick Mission/);
await check('quick mission start', async () => { await fit(); await page.locator('[data-guide="fit-quick"]').click(); await S(1200); await btn(/^START$/).click({ timeout: 4000 }); await S(4000); }, /ROUND|WORK|EXERCISE/);
await check('build workout generate + start', async () => { await fit(); await page.locator('[data-guide="fit-builder"]').click(); await S(1200); await btn(/GENERATE WORKOUT/).click({ timeout: 4000 }); await S(2000); await btn(/^START$/).click({ timeout: 4000 }); await S(4000); }, /EXERCISE|SET|REPS/i);
await check('programs', async () => { await fit(); await page.locator('[data-guide="fit-programs"]').click(); await S(1500); }, /PROGRAM/i);
await check('cardio setup', async () => { await fit(); await page.locator('[data-guide="fit-cardio"]').click(); await S(1800); }, /START/);
await check('cardio GPS run start', async () => { await btn(/START RUN|^START$/).click({ timeout: 4000 }); for (let i = 0; i < 25; i++) { await S(1000); if (/ELAPSED|LOCKING GPS/.test(await text())) break; } }, /GPS LIVE|GPS ACQUIRING|LOCKING GPS|ELAPSED/);
await check('just train start', async () => { await fight(); await page.locator('.fb', { hasText: 'JUST TRAIN' }).first().click(); await S(1200); await btn(/START/).click({ timeout: 4000 }); await S(4000); }, /ROUND|WARM/i);
await check('fight focus start', async () => { await fight(); await page.locator('.fb', { hasText: 'FIGHT FOCUS' }).first().click(); await S(1200); await btn(/START SESSION/).click({ timeout: 4000 }); await S(4000); }, /ROUND|WARM/i);
await check('combo coach start', async () => { await fight(); await page.locator('.fb', { hasText: 'COMBO COACH' }).first().click(); await S(1200); await btn(/START COMBOS/).click({ timeout: 4000 }); await S(4000); }, /ROUND|WARM/i);
await check('training camp map', async () => { await fight(); await page.locator('.fb', { hasText: 'TRAINING CAMP' }).first().click(); await S(1800); }, /TRAINING CAMP/);
await check('practice mode', async () => { await fight(); await page.locator('.ft.prac').click(); await S(1500); }, /PRACTICE MODE/);
await check('combat conditioning start', async () => { await fight(); await page.locator('.ft.cond').click(); await S(1500); await page.locator('text=GAS TANK').first().click(); await S(600); await btn(/START CIRCUIT/).click({ timeout: 4000 }); await S(4000); }, /ROUND|DRILL|WARM/i);
await check('arcade', async () => { await home(); await page.locator('text=ARCADE').first().click({ timeout: 5000 }); await S(3000); }, /TRAINING ARCADE/);
// The START badge lives inside a scroll-snapping carousel card; a real-mouse
// click can time out on actionability, and this test is about mounting, so
// the element is clicked directly.
await check('arcade saga', async () => { const hit = await page.evaluate(() => { const b = [...document.querySelectorAll('button,[role="button"]')].find((x) => /\bSTART\b[\s\S]*CLEARED/.test(x.innerText)); if (b) b.click(); return !!b; }); if (!hit) throw new Error('no START badge on the carousel'); await S(2500); }, /STAGE|CLIMB/i);
// Concept drops are hidden from users until their window, so these run with
// the owner's preview flag on.
const preview = async () => { await home(); await page.evaluate(() => localStorage.setItem('tm_owner_preview', '1')); await page.goto(BASE, { waitUntil: 'networkidle' }); await S(2000); await page.mouse.click(195, 120); await S(1800); };
await check('concept drop pop-up + page', async () => { await preview(); await btn(/START THE REGIME/).click({ timeout: 5000 }); await S(1500); }, /WEEK 1 OF 4/);
await check('concept fit day start', async () => { await btn(/^▶ START /).click({ timeout: 4000 }); await S(2500); }, /NECK CURLS|SQUAT JUMP/i);
await check('concept fight day start', async () => { await preview(); await page.locator('button[aria-label="Close"]').first().click({ timeout: 3000 }).catch(() => {}); await page.locator('button[aria-label="FIGHT MODE"]').click({ timeout: 5000 }); await S(1200); await page.locator('button', { hasText: 'CONCEPT PROGRAM' }).first().click({ timeout: 4000 }); await S(1500); await btn(/START DAY 1/).click({ timeout: 4000 }); await S(4000); }, /ROUND|WARM/i);
await check('concept gauntlet stage start', async () => { await preview(); await page.locator('button[aria-label="Close"]').first().click({ timeout: 3000 }).catch(() => {}); await page.locator('[data-guide="home-arcade"]').first().click({ timeout: 5000 }); await S(2500); await page.locator('button', { hasText: 'GAUNTLET' }).first().click({ timeout: 4000 }); await S(1500); await page.locator('button', { hasText: /AWAKENING|STANCE & STRIKE/ }).first().click({ timeout: 4000 }); await S(800); await page.locator('button', { hasText: 'FINAL ARC' }).first().click({ timeout: 4000 }); await S(4000); }, /ROUND|WARM/i);
await check('progress', async () => { await home(); await btn(/^PROGRESS$/).click({ timeout: 4000 }); await S(1500); }, /PROGRESS|XP/i);
await check('profile', async () => { await home(); await btn(/^PROFILE$/).click({ timeout: 4000 }); await S(1500); }, /PROFILE/);

await browser.close();
server.close();
if (failures.length) { console.log(`\nsmoke-web: ${failures.length} failure(s)`); failures.forEach((f) => console.log('FAIL ' + f)); process.exit(1); }
console.log(`\nsmoke-web: every screen mounted and ran — no crash screen, no uncaught errors`);

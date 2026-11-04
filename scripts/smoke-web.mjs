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

const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.mp4': 'video/mp4' };
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
  // A live concept drop greets Home with its pop-up; it would sit over every
  // button the checks tap.
  await page.locator('button[aria-label="Close"]').first().click({ force: true, timeout: 1500 }).catch(() => {});
  await S(400);
};
const home = async () => { await boot(); };
const fit = async () => { await home(); await page.locator('button[aria-label="FIT MODE"]').click({ timeout: 5000 }); await S(1200); };
const fight = async () => { await home(); await page.locator('button[aria-label="FIGHT MODE"]').click({ timeout: 5000 }); await S(1200); };
// The owner's preview flag (Strike Lab): concept drops, Coach's Tapes and
// Quick Mission v2 show only with it on. boot() closed the concept pop-up
// (which marks it seen), so the drop's progress is reset to bring it back.
const preview = async () => { await home(); await page.evaluate(() => { localStorage.setItem('tm_owner_preview', '1'); localStorage.removeItem('tm_concepts_v1'); }); await page.goto(BASE, { waitUntil: 'networkidle' }); await S(2000); await page.mouse.click(195, 120); await S(1800); };

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

// Quick Mission v2 ships behind data/qmV2 (owner preview until the flag
// flips). The library check reads the flag, so it never needs editing when
// the owner turns v2 on for everyone.
const V2_PUBLIC = /QM_V2_FOR_EVERYONE\s*=\s*true/.test(
  fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'components', 'training-mode', 'data', 'qmV2.js'), 'utf8'));
const quick = async () => { await fit(); await page.locator('[data-guide="fit-quick"]').click({ timeout: 4000 }); await S(1200); };
// Every owner check starts clean: preview() boots with wiped storage.
const ownerQuick = async () => {
  await preview();
  await page.locator('button[aria-label="Close"]').first().click({ force: true, timeout: 3000 }).catch(() => {});
  await page.locator('button[aria-label="FIT MODE"]').click({ timeout: 5000 }); await S(1200);
  await page.locator('[data-guide="fit-quick"]').click({ timeout: 4000 }); await S(1200);
};
// The MISSION LIBRARY sheet (MissionLibrarySheet). Its rows are role="radio"
// named by the title, plus a SOLO or PRO pill, so the patterns are anchored
// at the start only. A row tap only highlights it; PUT ON CARD brings it to
// the page card, the sheet's own START runs it.
const sheet = () => page.getByRole('dialog', { name: 'Mission library' });
const library = async () => { await page.locator('[data-guide="qm-library"]').click({ timeout: 4000 }); await S(700); };
const pickRow = async (re) => { await library(); await sheet().getByRole('radio', { name: re }).click({ timeout: 4000 }); await S(300); };
const putOnCard = async (re) => { await pickRow(re); await sheet().getByRole('button', { name: 'PUT ON CARD' }).click({ timeout: 4000 }); await S(600); };
// The Quick Mission rows the stats bank holds (one per run banked).
const qmRows = () => page.evaluate(() => { try { return (JSON.parse(localStorage.getItem('tm_user_stats') || '{}').sessions || []).filter(s => s.type === 'Quick Mission'); } catch { return []; } });
// A tap that may find its button disabled or gone (the finish bell): it must not end the run again.
const tryTap = (loc) => loc.click({ timeout: 800 }).catch(() => {});
// The page: the card (▾ SEE ALL opens it in place, ADJUST sits on the open
// card), GEAR (a radio strip) and TIME (a range input, 10 to 60 by 5).
const card = () => page.locator('[data-guide="qm-card"]');
const gearKey = (name) => page.locator('[data-guide="qm-gear"]').getByRole('radio', { name, exact: true });
const slider = () => page.locator('[data-guide="qm-time"] input[type="range"]');
const expand = async () => { if (await page.locator('[data-guide="qm-expand"]').getAttribute('aria-expanded') !== 'true') { await page.locator('[data-guide="qm-expand"]').click({ timeout: 4000 }); await S(600); } };
const adjustSheet = () => page.getByRole('dialog', { name: 'Adjust' });
const adjust = async () => { await expand(); await page.locator('[data-guide="qm-adjust"]').click({ timeout: 4000 }); await S(500); };
const done = async () => { await adjustSheet().getByRole('button', { name: /DONE/ }).click({ timeout: 4000 }); await S(400); };
const timeTo = async (mins) => {
  await slider().focus();
  for (let i = 0; i < 12; i++) {
    const v = Number(await slider().inputValue());
    if (v === mins) return;
    await page.keyboard.press(v < mins ? 'ArrowRight' : 'ArrowLeft'); await S(80);
  }
  throw new Error(`TIME never reached ${mins}`);
};
await check('quick mission: library matches the flag', async () => {
  await quick(); await library();
  const t = await sheet().innerText();
  if (V2_PUBLIC !== /MISSIONS\s*\d+/.test(t)) throw new Error(V2_PUBLIC ? 'no MISSIONS in the library' : 'v2 missions in the library while QM_V2_FOR_EVERYONE is false');
  if (!/MISSION LIBRARY · \d+/.test(t) || !/Ready-made workouts\./.test(t)) throw new Error('the library header is not MISSION LIBRARY · n with its line');
}, /CLASSICS/);
await check('quick mission: back closes the library first', async () => {
  await quick(); await library();
  // A modal: Tab never reaches the page behind it, and closing hands focus
  // back to the folder row.
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Tab');
    if (!await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))) throw new Error(`Tab ${i + 1} left the library`);
  }
  await page.keyboard.press('Escape'); await S(400);
  if (await sheet().count()) throw new Error('Escape left the library open');
  if (await page.evaluate(() => document.activeElement?.getAttribute('data-guide')) !== 'qm-library') throw new Error('focus did not come back to MISSION LIBRARY');
  // The header's back arrow sits under the sheet's backdrop: call it directly.
  await library(); await page.evaluate(() => document.querySelector('button[aria-label="Back"]').click()); await S(500);
  if (await sheet().count()) throw new Error('Back left the library open');
}, /MISSION LIBRARY/);
await check('quick mission: the first page is the card, GEAR, TIME and the library', async () => {
  await quick();
  const t = await page.evaluate(() => document.querySelector('.no-scrollbar').innerText);
  if (/BUILD YOUR OWN|ADD CARDIO|FOCUS|LEVEL/.test(t)) throw new Error('the old keys or ADD CARDIO are still on the page');
  if (await card().locator('ol > li').count() !== 3) throw new Error('the closed card does not list 3 moves');
  if (await slider().getAttribute('aria-valuetext') !== '20 minutes') throw new Error('TIME does not open on 20 minutes');
  if ((await slider().boundingBox()).height < 44) throw new Error('the TIME slider is under 44px tall');
}, /SEE ALL \d+ MOVES|SEE MORE/);
await check('quick mission: ▾ opens the card, ADJUST is a sheet', async () => {
  await quick();
  const n = Number((await page.locator('[data-guide="qm-expand"]').innerText()).match(/\d+/)?.[0] || 3);
  await expand();
  if (await card().locator('ol > li').count() !== n) throw new Error(`the open card does not list all ${n} moves`);
  if (!/about \d+ min/.test(await card().innerText())) throw new Error('no "about N min" line on the open card');
  await adjust();
  if (!await adjustSheet().count()) throw new Error('ADJUST did not open its sheet');
  for (let i = 0; i < 16; i++) {
    await page.keyboard.press('Tab');
    if (!await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))) throw new Error(`Tab ${i + 1} left ADJUST`);
  }
  await adjustSheet().getByRole('radiogroup', { name: 'Focus' }).getByRole('radio', { name: 'UPPER', exact: true }).click({ timeout: 4000 });
  await adjustSheet().getByRole('radiogroup', { name: 'Level' }).getByRole('radio', { name: 'HARD', exact: true }).click({ timeout: 4000 }); await S(300);
  await done();
  if (await adjustSheet().count()) throw new Error('DONE left ADJUST open');
  if (await page.evaluate(() => document.activeElement?.getAttribute('data-guide')) !== 'qm-adjust') throw new Error('focus did not come back to ADJUST');
  const c = await card().innerText();
  if (!/UPPER/i.test(c) || !/HARD/.test(c)) throw new Error('the card did not rebuild for UPPER · HARD');
  await page.locator('[data-guide="qm-expand"]').click({ timeout: 4000 }); await S(400);
  if (await card().locator('ol > li').count() !== 3) throw new Error('SHOW LESS did not fold the card');
}, /SEE ALL|SEE MORE/);
await check('quick mission: TIME 45 and WEIGHTED start a weighted mission', async () => {
  await quick(); await timeTo(45); await gearKey('WEIGHTED').click({ timeout: 4000 }); await S(400);
  const c = await card().innerText();
  if (!/45 MIN/i.test(c) || !/WEIGHTED/.test(c)) throw new Error('the card is not a 45-minute weighted mission');
  if (await slider().getAttribute('aria-valuetext') !== '45 minutes') throw new Error('TIME does not say 45 minutes');
  await btn(/^START$/).click({ timeout: 4000 }); await S(4000);
  if (!/WEIGHTED/.test(await text())) throw new Error('no WEIGHTED on the status strip');
}, /ROUND|GET READY|PREPARING|WORK/);
// TIME on a touch screen: a swipe up or down that starts on the slider is a
// page scroll and changes nothing (not the minutes, the saved keys or a
// library mission on the card); a sideways drag from the knob sets it.
await check('quick mission: a scroll on TIME stays a scroll, a sideways drag sets it', async () => {
  await quick(); await putOnCard(V2_PUBLIC ? /^ONE-BELL 300/ : /^HALF MURPH/);
  const picked = await card().locator('h1').innerText();
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const gesture = async (x0, y0, x1, y1) => {
    await touch('touchStart', x0, y0);
    for (let i = 1; i <= 10; i++) { await touch('touchMove', x0 + (x1 - x0) * i / 10, y0 + (y1 - y0) * i / 10); await S(16); }
    await touch('touchEnd'); await S(500);
  };
  const minute = async (v) => { const b = await slider().boundingBox(); return { x: b.x + 14 + (v - 10) / 50 * (b.width - 28), y: b.y + b.height / 2 }; };
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('tm_qm_keys_v1') || '{}').duration);
  let p = await minute(50);
  await gesture(p.x, p.y, p.x, p.y - 160);
  if (await slider().inputValue() !== '20' || (await saved()) !== undefined) throw new Error('a swipe up on TIME changed or saved it');
  if (await card().locator('h1').innerText() !== picked) throw new Error('a swipe up on TIME dropped the library mission');
  p = await minute(50);
  await gesture(p.x, p.y, p.x, p.y + 160);
  if (await slider().inputValue() !== '20' || await card().locator('h1').innerText() !== picked) throw new Error('a swipe down on TIME changed it');
  const from = await minute(20), to = await minute(45);
  await gesture(from.x, from.y, to.x, to.y);
  if (await slider().inputValue() !== '45' || (await saved()) !== 45) throw new Error('a sideways drag did not set and save 45');
  if (await card().locator('h1').innerText() === picked) throw new Error('a new TIME kept the library mission');
}, /45 MIN/);
// ADD CARDIO runs after the mission, so switching it on keeps the card's moves.
await check('quick mission: ADD CARDIO keeps the moves', async () => {
  await quick(); await expand();
  const before = await card().locator('ol').innerText();
  await adjust();
  await adjustSheet().getByRole('switch', { name: 'Add cardio' }).click({ timeout: 4000 }); await S(600);
  await btn(/ADD TO WORKOUT/).click({ timeout: 4000 }); await S(600);
  if (await adjustSheet().getByRole('switch', { name: 'Add cardio' }).getAttribute('aria-checked') !== 'true') throw new Error('ADD CARDIO did not switch on');
  await done();
  if (await card().locator('ol').innerText() !== before) throw new Error('ADD CARDIO dealt new moves');
}, /\+ CARDIO/);
await check('quick mission: choices are remembered, SURPRISE is not', async () => {
  await quick(); await timeTo(30);
  await adjust(); await adjustSheet().getByRole('radiogroup', { name: 'Level' }).getByRole('radio', { name: 'HARD', exact: true }).click({ timeout: 4000 }); await done();
  // SURPRISE keeps GEAR and TIME and is not a choice: a choice made after it
  // saves only itself.
  await page.locator('[data-guide="qm-surprise"]').click({ timeout: 3000 }); await S(300);
  if (!/30 MIN/i.test(await card().innerText())) throw new Error('SURPRISE changed the TIME');
  await gearKey('HYBRID').click({ timeout: 4000 }); await S(300);
  await page.locator('button[aria-label="Back"]').click({ timeout: 3000 }); await S(800);
  await page.locator('[data-guide="fit-quick"]').click({ timeout: 4000 }); await S(1200);
  if (await slider().inputValue() !== '30' || await gearKey('HYBRID').getAttribute('aria-checked') !== 'true') throw new Error('GEAR or TIME came back as the defaults');
  if (await page.locator('[data-guide="qm-expand"]').getAttribute('aria-expanded') !== 'true') throw new Error('the open card came back closed');
  await adjust();
  if (await adjustSheet().getByRole('radio', { name: 'HARD', exact: true }).getAttribute('aria-checked') !== 'true') throw new Error('LEVEL came back as the default or the SURPRISE roll');
}, /HARD/);
await check('quick mission: weighted classic starts weighted', async () => { await quick(); await pickRow(/^CHAOS ENGINE/); await sheet().getByRole('button', { name: /^START$/ }).click({ timeout: 4000 }); await S(4000); }, /WEIGHTED/);
await check('quick mission: murph starts', async () => { await quick(); await putOnCard(/^MURPH$/); await btn(/^START$/).click({ timeout: 4000 }); await S(4000); }, /ROUND|EXERCISE|MILE/);
await check('quick mission: library pick + START', async () => {
  await quick(); await pickRow(V2_PUBLIC ? /^BEST OF 3/ : /^HALF MURPH/);
  if (!/ON TOP/.test(await sheet().innerText())) throw new Error('the picked row is not on top');
  await sheet().getByRole('button', { name: /^START$/ }).click({ timeout: 4000 }); await S(4500);
}, /ROUND|GET READY|PREPARING|EXERCISE/);
await check('owner: quick mission library filters', async () => {
  await ownerQuick(); await library();
  if (!await sheet().getByRole('radiogroup', { name: 'Loadout' }).count()) throw new Error('no LOADOUT chips');
}, /MISSIONS/);
await check('owner: quick mission swap sheet', async () => {
  await ownerQuick(); await putOnCard(/^TUTORIAL STAGE/);
  if (await page.locator('button[aria-label="Swap Sprawls"]').count()) throw new Error('a swap on the closed card');
  await expand();
  await page.locator('button[aria-label="Swap Sprawls"]').click({ timeout: 4000 }); await S(800);
}, /SWAP: SPRAWLS/);
await page.locator('button[aria-label="Close"]').first().click({ timeout: 1500 }).catch(() => {});
await check('owner: one-bell guided start', async () => { await ownerQuick(); await putOnCard(/^ONE-BELL 300/); await btn(/^START$/).click({ timeout: 4000 }); await S(5000); }, /ROUND|GET READY|PREPARING/);
await check('owner: turbo solo start', async () => {
  await ownerQuick(); await putOnCard(/^TURBO BUTTON/);
  await adjust();
  await adjustSheet().getByRole('radiogroup', { name: 'How' }).getByRole('radio', { name: 'SOLO', exact: true }).click({ timeout: 4000 }); await S(300);
  await done();
  await btn(/^START$/).click({ timeout: 4000 }); await S(7000);
  if (!/STOP/.test(await text())) throw new Error('no STOP on the SOLO screen');
}, /SOLO/);
// The owner's own workouts. BAR FIGHT runs GUIDED (the clean slate's mode):
// SKIP the brief, and GET READY names its first bar drill.
await check('owner: BAR FIGHT guided start', async () => {
  await ownerQuick(); await putOnCard(/^BAR FIGHT/);
  await btn(/^START$/).click({ timeout: 4000 }); await S(3000);
  await page.locator('[data-guide="qma-skip"]').click({ timeout: 4000 }); await S(1500);
  const t = await text();
  if (!/BAR FIGHT/.test(t) || !/GET READY/.test(t) || !/Explosive Front Presses/i.test(t)) throw new Error('GET READY does not lead into the explosive front presses');
}, /ROUND 1\/4/);
// NO CONTINUES in SOLO: a count-up clock to the 30:00 cap, the safety line,
// + SET, and I PUT IT DOWN ends it as a finish that saves sets + reps.
await check('owner: NO CONTINUES solo, I PUT IT DOWN saves the score', async () => {
  await ownerQuick(); await putOnCard(/^NO CONTINUES/);
  if (!/Park the bell between your feet/.test(await card().innerText())) throw new Error('no safety line on the card');
  await adjust();
  await adjustSheet().getByRole('radiogroup', { name: 'How' }).getByRole('radio', { name: 'SOLO', exact: true }).click({ timeout: 4000 }); await S(300);
  await done();
  await btn(/^START$/).click({ timeout: 4000 }); await S(7000);
  let t = await text();
  if (!/CAP 30:00 · SET 1 · BOTH HANDS/.test(t) || !/I PUT IT DOWN/.test(t) || !/Park the bell between your feet/.test(t)) throw new Error('not the until-down SOLO screen');
  await btn(/^SET$/).click({ timeout: 4000 }); await S(400);
  if (!/SETS 1/.test(await text()) || !/SET 2 · LEFT ARM/.test(await text())) throw new Error('SET did not count a set');
  await S(10000); // past one set's honest floor, so the set pays
  await btn(/^I PUT IT DOWN$/).click({ timeout: 4000 }); await S(800);
  t = await text();
  if (!/YOUR SCORE/.test(t) || !/SETS\s*\n?\s*1/.test(t) || !/NOT YET/.test(t)) throw new Error('I PUT IT DOWN did not open the sets score');
  await btn(/^SAVE$/).click({ timeout: 4000 }); await S(3000);
  t = await text();
  if (!/1 \+ 0/.test(t)) throw new Error('the saved score is not 1 + 0');
}, /SESSION COMPLETE/);
// NO CONTINUES SOLO, STOP then END with no SET tap: no score and no taps,
// so no recap box (it read 'No round taps' on a mission that taps SET).
await check('owner: NO CONTINUES solo END with no taps shows no recap', async () => {
  await ownerQuick(); await putOnCard(/^NO CONTINUES/);
  await adjust();
  await adjustSheet().getByRole('radiogroup', { name: 'How' }).getByRole('radio', { name: 'SOLO', exact: true }).click({ timeout: 4000 }); await S(300);
  await done();
  await btn(/^START$/).click({ timeout: 4000 }); await S(7000);
  await btn(/^STOP$/).click({ timeout: 4000 }); await S(400);
  await btn(/^END$/).click({ timeout: 4000 }); await S(3000);
  const t = await text();
  if (/taps this run/.test(t) || await page.locator('[data-guide="qm-splits"]').count()) throw new Error('a recap box on a run with no taps and no score');
}, /MISSION FAILED/);
// UPPER LOWER DIPS in SOLO: the same until-failure engine counting ROUNDS.
// Two ROUND taps take two splits, I'M DONE ends it as a finish, and the
// complete screen shows the rounds, each round's time and the total.
await check('owner: UPPER LOWER DIPS solo, two ROUND taps and I\'M DONE', async () => {
  await ownerQuick(); await putOnCard(/^UPPER LOWER DIPS/);
  if (!/elbows reach 90°/.test(await card().innerText())) throw new Error('no safety line on the card');
  await adjust();
  await adjustSheet().getByRole('radiogroup', { name: 'How' }).getByRole('radio', { name: 'SOLO', exact: true }).click({ timeout: 4000 }); await S(300);
  await done();
  await btn(/^START$/).click({ timeout: 4000 }); await S(7000);
  let t = await text();
  if (!/CAP 30:00 · ROUND 1/.test(t) || !/I'M DONE/.test(t) || !/elbows reach 90°/.test(t)) throw new Error('not the until-failure SOLO screen');
  await btn(/^ROUND$/).click({ timeout: 4000 }); await S(1500);
  await btn(/^ROUND$/).click({ timeout: 4000 }); await S(400);
  t = await text();
  if (!/ROUND 3/.test(t) || !/ROUNDS 2/.test(t) || !/R1 0:0\d · R2 0:0\d/.test(t)) throw new Error('ROUND did not take two splits');
  await S(38000); // past two rounds' honest floor (19 s each), so both pay
  await btn(/^I'M DONE$/).click({ timeout: 4000 }); await S(800);
  t = await text();
  if (!/YOUR SCORE/.test(t) || !/ROUNDS\s*\n?\s*2/.test(t) || !/NOT YET/.test(t)) throw new Error("I'M DONE did not open the rounds score");
  await btn(/^SAVE$/).click({ timeout: 4000 }); await S(3000);
  t = await text();
  if (!/2 \+ 0/.test(t) || !/ROUNDS 2/.test(t) || !/R1 0:0\d · R2 0:0\d/.test(t) || !/TOTAL 0:[3-5]\d/.test(t)) throw new Error('the complete screen does not show the score and the splits');
}, /SESSION COMPLETE/);
// GUIDED: the coach calls round 1, and I'M DONE sits on screen.
await check('owner: UPPER LOWER DIPS guided start', async () => {
  await ownerQuick(); await putOnCard(/^UPPER LOWER DIPS/);
  await btn(/^START$/).click({ timeout: 4000 }); await S(3000);
  await page.locator('[data-guide="qma-skip"]').click({ timeout: 4000 }); await S(1500);
  const t = await text();
  if (!/GET READY/.test(t) || !/ROUND 1/.test(t) || !/I'M DONE/.test(t) || !/elbows reach 90°/.test(t)) throw new Error('GET READY does not lead into round 1');
}, /UPPER LOWER DIPS/);
// NO CONTINUES GUIDED: STOP then END is a quit, as in SOLO. A full cycle
// (3 sets) counted, and the complete screen pays nothing, shows no rounds out
// of the hidden 30-round backstop and no integrity banner beside the verdict
// (it read PARTIAL COMPLETION next to MISSION FAILED). A quit that pays
// nothing leaves the Mission of the Day to do, as in SOLO.
await check('owner: NO CONTINUES guided END saves nothing, like SOLO', async () => {
  await ownerQuick(); await putOnCard(/^NO CONTINUES/);
  await page.evaluate(() => {
    localStorage.setItem('dailyMissionActive', 'true'); localStorage.setItem('dailyMissionDate', new Date().toISOString().slice(0, 10));
    localStorage.setItem('dailyMissionActiveData', JSON.stringify({ action: 'quickMission' })); localStorage.removeItem('dailyMissionCompleted');
  });
  await btn(/^START$/).click({ timeout: 4000 }); await S(3000);
  await page.locator('[data-guide="qma-skip"]').click({ timeout: 4000 }); await S(1500);
  for (let i = 0; i < 60 && !/SET 4/.test(await text()); i += 1) await S(2000); // the coach counts sets 1-3
  if (!/SET 4/.test(await text())) throw new Error('the first cycle never finished');
  await page.locator('[data-guide="qma-stop"]').click({ timeout: 4000 }); await S(500);
  if (!/END saves nothing/.test(await text())) throw new Error('the END confirm does not say END saves nothing');
  await btn(/^END MISSION$/).click({ timeout: 4000 }); await S(3000);
  const t = await text();
  if (!/Ended with no score\. I PUT IT DOWN saves your sets\./.test(t) || /\/30/.test(t) || /EXERCISES/.test(t)) throw new Error('GUIDED END paid or showed the backstop');
  if (/PARTIAL COMPLETION|All rounds verified/.test(t)) throw new Error('an integrity banner contradicts the verdict');
  const daily = await page.evaluate(() => localStorage.getItem('dailyMissionCompleted'));
  const rows = await qmRows();
  if (daily === 'true' || rows.length !== 1 || rows[0].xpEarned !== 0) throw new Error(`a quit completed the Mission of the Day or paid (${daily}, ${JSON.stringify(rows.map(r => r.xpEarned))})`);
}, /MISSION FAILED/);
// NO CONTINUES GUIDED: a SKIP undone by REWIND takes back the skip, not the
// set before it. Set 1, SKIP, REWIND, set 2, I PUT IT DOWN: two clean sets
// and the bonus (it saved 1 set, skipped 1 and SESSION STOPPED). Inside the
// finish bell REWIND, STOP and END MISSION do nothing: one row, 2 + 0.
await check('owner: NO CONTINUES guided SKIP then REWIND keeps the sets', async () => {
  await ownerQuick(); await putOnCard(/^NO CONTINUES/);
  await btn(/^START$/).click({ timeout: 4000 }); await S(3000);
  await page.locator('[data-guide="qma-skip"]').click({ timeout: 4000 }); await S(1500);
  for (let i = 0; i < 60 && !/SET 2/.test(await text()); i += 1) await S(1000); // the coach counts set 1
  if (!/SET 2/.test(await text()) || !/BLOCK 2\/3/.test(await text())) throw new Error(`set 1 never finished: ${(await text()).replace(/\s+/g, ' ').slice(0, 300)}`);
  await page.locator('[data-guide="qma-skip"]').click({ timeout: 4000 }); await S(800);
  if (!/BLOCK 3\/3/.test(await text())) throw new Error('SKIP did not move on to block 3');
  await page.locator('[data-guide="qma-rewind"]').click({ timeout: 4000 }); await S(800);
  if (!/SET 2/.test(await text())) throw new Error('REWIND took back set 1');
  for (let i = 0; i < 60 && !/SET 3/.test(await text()); i += 1) await S(1000); // block 2 again
  if (!/SET 3/.test(await text())) throw new Error('block 2 never finished after REWIND');
  await btn(/^I PUT IT DOWN$/).click({ timeout: 4000 }); await S(500);
  if (!/That ends the run with 2 sets/.test(await text())) throw new Error('the BELL DOWN? dialog does not count 2 sets');
  await btn(/^SAVE$/).click({ timeout: 4000 }); await S(300);
  await tryTap(page.locator('[data-guide="qma-rewind"]'));
  await tryTap(page.locator('[data-guide="qma-stop"]'));
  await tryTap(btn(/^END MISSION$/));
  await S(3500);
  const t = await text();
  const rows = await qmRows();
  if (rows.length !== 1) throw new Error(`the run banked ${rows.length} times`);
  if (rows[0].score?.sets !== 2 || rows[0].score?.skipped || !(rows[0].xpEarned > 30)) throw new Error(`the saved score is not 2 clean sets with the bonus: ${JSON.stringify([rows[0].score, rows[0].xpEarned])}`);
  if (!/2 \+ 0/.test(t) || /SESSION STOPPED|PARTIAL COMPLETION|All rounds verified/.test(t)) throw new Error('the complete screen does not read 2 + 0, complete');
}, /SESSION COMPLETE/);
// GUIDED, a clock: an End Mission? left open while the last slot runs out
// closes with the finish, so END MISSION after 00:00 never banks it twice.
// TURBO BUTTON: every slot but the last is SKIPped (each rest jumps to its
// last seconds), STOP opens on the last one and stays open past 00:00.
await check('quick mission: GUIDED STOP left open as the clock ends banks once', async () => {
  await ownerQuick(); await putOnCard(/^TURBO BUTTON/);
  await btn(/^START$/).click({ timeout: 4000 }); await S(3000);
  await page.locator('[data-guide="qma-skip"]').click({ timeout: 4000 }); await S(1200); // the brief
  let t = '';
  for (let i = 0; i < 220; i += 1) {
    t = await text();
    if (/EXERCISE 16\/16/.test(t) && /WORK/.test(t)) break;
    await page.locator('[data-guide="qma-skip"]').click({ timeout: 2000 }); await S(700);
  }
  if (!/EXERCISE 16\/16/.test(t)) throw new Error('never reached the last slot');
  await page.locator('[data-guide="qma-stop"]').click({ timeout: 2000 }); await S(300);
  if (!/End Mission\?/.test(await text())) throw new Error('STOP did not open End Mission?');
  for (let i = 0; i < 200 && !/\b00:00\b/.test(await text()); i += 1) await S(150); // the clock runs under the dialog
  await S(300);
  await tryTap(btn(/^END MISSION$/));
  await S(4000);
  const rows = await qmRows();
  if (rows.length !== 1) throw new Error(`the run banked ${rows.length} times: ${JSON.stringify(rows.map(r => r.xpEarned))}`);
}, /TURBO BUTTON/);
// TOUCH THE SKY SOLO: not a race. ROUND starts the timed 2:00 rest, FINISH
// is the last ROUND tap, and the score is the rounds held with the bar never down.
await check('owner: TOUCH THE SKY solo, the timed rest and rounds held', async () => {
  await ownerQuick(); await putOnCard(/^TOUCH THE SKY/);
  await expand();
  const c = await card().innerText();
  if (!/45 reps a round, bar never down/i.test(c) || !/The bar is already in the rack\./.test(c)) throw new Error('not the bar-never-down card');
  await adjust();
  await adjustSheet().getByRole('radiogroup', { name: 'How' }).getByRole('radio', { name: 'SOLO', exact: true }).click({ timeout: 4000 }); await S(300);
  await done();
  await btn(/^START$/).click({ timeout: 4000 }); await S(7000);
  let t = await text();
  if (!/COMPLEX · STANDARD/.test(t) || !/CAP 20:00 · ROUND 1\/3/.test(t) || !/3\/3 rounds/.test(t)) throw new Error('not the rounds-held SOLO screen');
  // FINISH sits under the round timer, on screen above the tab bar without a scroll.
  const fin = await btn(/^FINISH$/).boundingBox();
  if (!fin || fin.y + fin.height > 760) throw new Error(`FINISH is off screen or under the tab bar (${fin && Math.round(fin.y)})`);
  await btn(/^ROUND$/).click({ timeout: 4000 }); await S(1500);
  if (!/REST 1:5\d/.test(await text())) throw new Error('ROUND did not start the 2:00 rest');
  // ROUND rests with the athlete: a tap in the timed rest is no round.
  if (!(await btn(/^ROUND$/).isDisabled())) throw new Error('ROUND is live during the timed rest');
  await btn(/^FINISH$/).click({ timeout: 4000 }); await S(800);
  t = await text();
  // One ROUND tap of three: FINISH cannot know where rounds 2 and 3 split, so only R1 is timed.
  if (!/YOUR SCORE/.test(t) || !/ROUNDS, BAR NEVER DOWN\s*3/.test(t) || !/R1 0:0\d/.test(t) || /R2 \d/.test(t)) throw new Error('FINISH did not open rounds held with only the tapped round timed');
  await btn(/^SAVE$/).click({ timeout: 4000 }); await S(3000);
  t = await text();
  if (!/3\/3/.test(t) || !/ROUNDS 3/.test(t) || !/R2–R3 not timed/.test(t)) throw new Error('the complete screen does not show rounds held and the splits');
}, /COMPLEX · STANDARD/);
// OVERTIME 20: GUIDED like the other AMRAPs, and SOLO has the round timer.
await check('quick mission: OVERTIME 20 guided start', async () => {
  await ownerQuick(); await putOnCard(/^OVERTIME 20/);
  await btn(/^START$/).click({ timeout: 4000 }); await S(3000);
  await page.locator('[data-guide="qma-skip"]').click({ timeout: 4000 }); await S(1500);
  if (!/GET READY/.test(await text())) throw new Error('no GET READY');
}, /OVERTIME 20/);
await check('quick mission: OVERTIME 20 solo shows the ROUND button', async () => {
  await ownerQuick(); await putOnCard(/^OVERTIME 20/);
  await adjust();
  await adjustSheet().getByRole('radiogroup', { name: 'How' }).getByRole('radio', { name: 'SOLO', exact: true }).click({ timeout: 4000 }); await S(300);
  await done();
  await btn(/^START$/).click({ timeout: 4000 }); await S(7000);
  let t = await text();
  if (!/OVERTIME 20/.test(t) || !/AMRAP 20/.test(t) || !/ROUND 1/.test(t) || !(await btn(/^ROUND$/).isVisible())) throw new Error('no ROUND button on the SOLO screen');
  await btn(/^ROUND$/).click({ timeout: 4000 }); await S(400);
  t = await text();
  if (!/ROUND 2/.test(t) || !/R1 0:0\d/.test(t) || !/ROUNDS 1/.test(t)) throw new Error('ROUND did not take a split');
}, /SOLO/);
// A SOLO-only library mission starts SOLO from the sheet's own START, whatever
// the remembered run mode (GUIDED on a clean slate).
await check('quick mission: library BARBELL → HONOR ROUNDS starts SOLO', async () => {
  await ownerQuick(); await library();
  await sheet().getByRole('radiogroup', { name: 'Loadout' }).getByRole('radio', { name: /^BARBELL/ }).click({ timeout: 4000 }); await S(400);
  if (await sheet().getByRole('radio', { name: /^IRON CLOCK 16/ }).count() !== 1 || await sheet().getByRole('radio', { name: /^BEST OF 3/ }).count()) throw new Error('BARBELL did not filter the list');
  await sheet().getByRole('radio', { name: /^HONOR ROUNDS SOLO$/ }).click({ timeout: 4000 }); await S(300);
  if (!/HONOR ROUNDS/.test(await sheet().locator('[aria-live="polite"]').innerText())) throw new Error('HONOR ROUNDS is not on top');
  await sheet().getByRole('button', { name: /^START$/ }).click({ timeout: 4000 }); await S(7000);
  const t = await text();
  if (!/HONOR ROUNDS/.test(t) || !/FINISH/.test(t) || !/STOP/.test(t) || !/CAP 20:00/.test(t)) throw new Error('not the SOLO screen for HONOR ROUNDS');
}, /SOLO/);
// START opens the ring warm-up (5 MIN until the athlete picks). Its SKIP is
// clicked for real, so the check fails if anything covers it: the old warm-up's
// SKIP sat under the tab bar, and this check still passed because the workout
// list stayed rendered beneath the overlay.
await check('build workout generate + start', async () => {
  await fit(); await page.locator('[data-guide="fit-builder"]').click(); await S(1200);
  await btn(/GENERATE WORKOUT/).click({ timeout: 4000 }); await S(2000);
  // START primes the voice first (a couple of seconds headless), then opens it.
  await btn(/^START/).click({ timeout: 4000 });
  await page.getByText('WARM UP · WORKOUT').first().waitFor({ timeout: 8000 }).catch(() => { throw new Error('START did not open the ring warm-up'); });
  await btn(/^SKIP → START WORKOUT$/).click({ timeout: 4000 }); await S(3000);
}, /GUIDED WORKOUT/);
await check('programs', async () => { await fit(); await page.locator('[data-guide="fit-programs"]').click(); await S(1500); }, /PROGRAM/i);
await check('cardio setup', async () => { await fit(); await page.locator('[data-guide="fit-cardio"]').click(); await S(1800); }, /START/);
await check('cardio GPS run start', async () => { await btn(/START RUN|^START$/).click({ timeout: 4000 }); for (let i = 0; i < 25; i++) { await S(1000); if (/ELAPSED|LOCKING GPS/.test(await text())) break; } }, /GPS LIVE|GPS ACQUIRING|LOCKING GPS|ELAPSED/);
await check('just train start', async () => { await fight(); await page.locator('.fb', { hasText: 'JUST TRAIN' }).first().click(); await S(1200); await btn(/START/).click({ timeout: 4000 }); await S(4000); }, /ROUND|WARM/i);
await check('fight focus start', async () => { await fight(); await page.locator('.fb', { hasText: 'FIGHT FOCUS' }).first().click(); await S(1200); await btn(/START SESSION/).click({ timeout: 4000 }); await S(4000); }, /ROUND|WARM/i);
await check('combo coach start', async () => { await fight(); await page.locator('.fb', { hasText: 'COMBO COACH' }).first().click(); await S(1200); await btn(/START COMBOS/).click({ timeout: 4000 }); await S(4000); }, /ROUND|WARM/i);
await check('training camp map', async () => { await fight(); await page.locator('.fb', { hasText: 'TRAINING CAMP' }).first().click(); await S(1800); }, /TRAINING CAMP/);
await check('practice mode', async () => { await fight(); await page.locator('.ft.prac').click(); await S(1500); }, /PRACTICE MODE/);
// A move with a tutorial (practiceData videoUrl) plays it on its card: Muay
// Thai › Rear Knee is past the first six tiles, so SEE ALL opens the grid.
await check('practice tutorial plays', async () => {
  await fight(); await page.locator('.ft.prac').click(); await S(1500);
  await page.getByRole('tab', { name: /MUAY THAI/i }).click({ timeout: 4000 }); await S(600);
  await btn(/^SEE ALL/).click({ timeout: 4000 }); await S(400);
  await page.locator('.pm-tile', { hasText: /^RK?\s*Rear Knee/ }).first().click({ timeout: 4000 }).catch(async () => {
    await page.locator('.pm-tile', { hasText: 'Rear Knee' }).first().click({ timeout: 4000 });
  });
  await S(600);
  await page.getByRole('button', { name: /Watch the Rear Knee tutorial/ }).click({ timeout: 4000 });
  await S(2500);
  const t = await page.evaluate(() => { const v = document.querySelector('video'); return v ? v.currentTime : -1; });
  if (!(t > 0.5)) throw new Error(`the tutorial did not play (currentTime ${t})`);
}, /KEY POINTS/);
await check('combat conditioning start', async () => { await fight(); await page.locator('.ft.cond').click(); await S(1500); await page.locator('text=GAS TANK').first().click(); await S(600); await btn(/START CIRCUIT/).click({ timeout: 4000 }); await S(4000); }, /ROUND|DRILL|WARM/i);
// The hub's Arcade tile by its guide anchor: a live concept drop's card also says ARCADE.
await check('arcade', async () => { await home(); await page.locator('[data-guide="home-arcade"]').first().click({ timeout: 5000 }); await S(3000); }, /TRAINING ARCADE/);
// The START badge lives inside a scroll-snapping carousel card; a real-mouse
// click can time out on actionability, and this test is about mounting, so
// the element is clicked directly.
// A live concept drop's gauntlet can sit first in the carousel, locked until
// its first week is done — page past it to a saga that can START.
await check('arcade saga', async () => {
  let hit = false;
  for (let i = 0; i < 8 && !hit; i++) {
    hit = await page.evaluate(() => { const b = [...document.querySelectorAll('button,[role="button"]')].find((x) => /\bSTART\b[\s\S]*CLEARED/.test(x.innerText)); if (b) b.click(); return !!b; });
    if (!hit) { await page.locator('button[aria-label="Next saga"]').click({ force: true, timeout: 3000 }); await S(900); }
  }
  if (!hit) throw new Error('no START badge on the carousel'); await S(2500);
}, /STAGE|CLIMB/i);
// Concept drops are hidden from users until their window, so these run with
// the owner's preview flag on.
await check('concept drop pop-up + page', async () => { await preview(); await btn(/START THE REGIME/).click({ timeout: 5000 }); await S(1500); }, /WEEK 1 OF 4/);
await check('concept fit day start', async () => { await btn(/^▶ START /).click({ timeout: 4000 }); await S(2500); }, /NECK CURLS|SQUAT JUMP/i);
await check('concept fight day start', async () => { await preview(); await page.locator('button[aria-label="Close"]').first().click({ timeout: 3000 }).catch(() => {}); await page.locator('button[aria-label="FIGHT MODE"]').click({ timeout: 5000 }); await S(1200); await page.locator('button', { hasText: 'CONCEPT PROGRAM' }).first().click({ timeout: 4000 }); await S(1500); await btn(/START DAY 1/).click({ timeout: 4000 }); await S(4000); }, /ROUND|WARM/i);
await check("coach's tapes shelf (owner-only)", async () => { await preview(); await page.locator('button[aria-label="Close"]').first().click({ force: true, timeout: 3000 }).catch(() => {}); await page.locator('button[aria-label="FIT MODE"]').click({ timeout: 5000 }); await S(1200); await page.locator('[data-guide="fit-tapes"]').click({ timeout: 4000 }); await S(1500); }, /COACH'S TAPES/);
await check('concept gauntlet stage start', async () => { await preview(); await page.evaluate(() => localStorage.setItem('tm_concepts_v1', JSON.stringify({ shoto: { fitDone: 16, popupSeen: true } }))); await page.reload({ waitUntil: 'networkidle' }); await S(2000); await page.mouse.click(195, 120); await S(1500); await page.locator('button[aria-label="Close"]').first().click({ force: true, timeout: 1500 }).catch(() => {}); await page.locator('[data-guide="home-arcade"]').first().click({ force: true, timeout: 5000 }); await S(2500); await page.evaluate(() => { const s = [...document.querySelectorAll('.saga-slide')].find((x) => x.style.opacity === '1'); s && s.click(); }); await S(2500); await page.locator('button').filter({ hasText: /GOT IT|LET'S GO|CLOSE/ }).first().click({ force: true, timeout: 1500 }).catch(() => {}); await S(600); await page.locator('.ladder-node').last().click({ force: true, timeout: 4000 }); await S(800); await page.locator('button').filter({ hasText: 'BOTH' }).last().click({ force: true, timeout: 3000 }); await page.locator('button').filter({ hasText: 'ENTER STAGE' }).first().click({ force: true, timeout: 4000 }); await S(4000); }, /ROUND|WARM/i);
await check('progress', async () => { await home(); await btn(/^PROGRESS$/).click({ timeout: 4000 }); await S(1500); }, /PROGRESS|XP/i);
await check('profile', async () => { await home(); await btn(/^PROFILE$/).click({ timeout: 4000 }); await S(1500); }, /PROFILE/);

await browser.close();
server.close();
if (failures.length) { console.log(`\nsmoke-web: ${failures.length} failure(s)`); failures.forEach((f) => console.log('FAIL ' + f)); process.exit(1); }
console.log(`\nsmoke-web: every screen mounted and ran — no crash screen, no uncaught errors`);

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
const seedStorage = () => {
  // A reset flag on the URL wipes storage at document start — AFTER the
  // previous page unloaded (the app re-saves its live session on unload, so
  // clearing before navigation is undone) and BEFORE the app boots.
  if (location.search.includes('__reset')) {
    try { localStorage.clear(); sessionStorage.clear(); } catch {}
    history.replaceState(null, '', location.pathname);
  }
  // A check can hand the next page load a session to come back into (see
  // builderAt). Written here, at document start: after the previous page's
  // unload re-saved its own live session over the key, before the app boots.
  try {
    const seed = sessionStorage.getItem('__smoke_seed');
    if (seed) { sessionStorage.removeItem('__smoke_seed'); localStorage.setItem('trainingModePausedSession', seed); }
  } catch {}
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
};
await ctx.addInitScript(seedStorage);
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

// SMOKE_ONLY=<regex> runs just the checks whose names match (for working on one).
const ONLY = process.env.SMOKE_ONLY ? new RegExp(process.env.SMOKE_ONLY) : null;
async function check(name, fn, expectRe) {
  if (ONLY && !ONLY.test(name)) return;
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

// The Fit hub on the fullest day it gets: a run ghost waiting (GHOST ACTIVE
// makes the card's label row taller), Coach's Tapes on (a fourth row), a drop
// featured (the concept card) and the long Recovery Circuit title (it wraps to
// two lines on a narrow phone). On a real 412x811 phone the title was drawn
// with its bottom chopped off and the Cardio row was cut under the tab bar, so
// the stack has to FIT, not scroll: every block above the tab bar, none on top
// of another, the title whole. Boots once; the next checks only resize.
const FIT_BLOCKS = ['fit-today', 'fit-concept', 'fit-quick', 'fit-builder', 'fit-programs', 'fit-tapes', 'fit-cardio'];
// atYourPace: the saved AT YOUR PACE choice puts "· At your pace" on the card's
// line, so the day uses the Quick Mission pick (no earlier session, which would
// make today's pick the long Recovery Circuit) with its two-line title.
const fullFitHub = async ({ atYourPace = false } = {}) => {
  await preview();
  await page.evaluate((solo) => {
    localStorage.setItem('tm_run_ghosts_v1', JSON.stringify({ v: 1, best: {}, last: { 'mi|3|gps': { v: 1, ghostId: 'smoke', ownerId: 'me', ownerName: 'SMOKE', gender: 'male', unit: 'mi', goal: 3, surface: 'gps', totalSec: 1800, trace: [{ t: 0, d: 0 }, { t: 1800, d: 3 }], splits: [], verified: true, createdAt: Date.now() } } }));
    if (solo) localStorage.setItem('tm_qm_shelf_v1', JSON.stringify({ mode: 'solo' }));
    else localStorage.setItem('tm_user_stats', JSON.stringify({ xp: 0, sessions: [{ type: 'Fit Mode', date: new Date().toISOString(), xp: 50 }] }));
  }, atYourPace);
  await page.goto(BASE, { waitUntil: 'networkidle' }); await S(2000); await page.mouse.click(195, 120); await S(1500);
  await page.locator('button[aria-label="Close"]').first().click({ force: true, timeout: 1500 }).catch(() => {});
  await page.locator('button[aria-label="FIT MODE"]').click({ timeout: 5000 }); await S(1200);
  if (!/GHOST ACTIVE/.test(await text()) || !(atYourPace ? /At\s+your\s+pace/ : /Recovery Circuit/).test(await text())) throw new Error('the full hub did not come up (ghost badge or long title missing)');
};
const hubMetrics = () => page.evaluate((blocks) => {
  const rect = (k) => { const e = document.querySelector(`[data-guide="${k}"]`); return e ? e.getBoundingClientRect() : null; };
  const hero = document.querySelector('[data-guide="fit-today"]');
  const h1 = hero.querySelector('h1');
  const stack = hero.parentElement;
  const hb = hero.getBoundingClientRect();
  const sb = hero.querySelector('button.fm-go').getBoundingClientRect();
  const sub = [...document.querySelectorAll('[data-guide="fit-concept"] div')].find(d => d.style.whiteSpace === 'nowrap');
  const out = { cardSub: sub ? [sub.scrollWidth, sub.clientWidth] : null, navTop: rect('nav-tabs').top, h1: [h1.scrollHeight, h1.clientHeight], stack: [stack.scrollHeight, stack.clientHeight], stackBottom: stack.getBoundingClientRect().bottom, startInside: sb.top >= hb.top - 0.5 && sb.bottom <= hb.bottom + 0.5, blocks: {} };
  for (const k of blocks) { const b = rect(k); if (b) out.blocks[k] = { top: b.top, bottom: b.bottom, h: b.height }; }
  return out;
}, FIT_BLOCKS);
const resizeTo = async (w, h) => { await page.setViewportSize({ width: w, height: h }); await S(500); };
const fitsHub = (m, label) => {
  if (m.h1[0] > m.h1[1]) throw new Error(`${label}: the mission title is clipped (${m.h1[0]} > ${m.h1[1]})`);
  if (!m.startInside) throw new Error(`${label}: START sits outside the mission card`);
  if (m.cardSub && m.cardSub[0] > m.cardSub[1]) throw new Error(`${label}: the drop card's line is cut off with an ellipsis (${m.cardSub[0]} > ${m.cardSub[1]})`);
  let prev = null;
  for (const k of FIT_BLOCKS) {
    const b = m.blocks[k];
    if (!b) throw new Error(`${label}: ${k} is not on the hub`);
    if (b.bottom > m.navTop) throw new Error(`${label}: ${k} ends at ${Math.round(b.bottom)}, under the tab bar at ${Math.round(m.navTop)}`);
    if (prev && b.top < prev.bottom - 0.5) throw new Error(`${label}: ${k} overlaps the block above it`);
    if (k !== 'fit-today' && k !== 'fit-concept' && b.h < 43.5) throw new Error(`${label}: ${k} is squashed to ${Math.round(b.h)}px`);
    prev = b;
  }
  if (m.stack[0] > m.stack[1] + 1) throw new Error(`${label}: the stack needs scrolling (${m.stack[0]} > ${m.stack[1]})`);
};
await check('fit hub fits 412x811 with a ghost, Coach\'s Tapes and a drop', async () => { await fullFitHub(); await resizeTo(412, 811); fitsHub(await hubMetrics(), '412x811'); }, /Quick Mission/);
await check('fit hub fits 412x790, 360x740 and 390x844 (the title wraps on the narrow one)', async () => {
  try { for (const [w, h] of [[412, 790], [360, 740], [390, 844]]) { await resizeTo(w, h); fitsHub(await hubMetrics(), `${w}x${h}`); } } finally { await resizeTo(390, 844); }
}, /Quick Mission/);
// Under about 700px tall even the floors cannot fit, so the stack scrolls; the
// last row has to scroll fully clear of the tab bar and the fade above it.
await check('fit hub at 375x667 scrolls the Cardio row fully clear of the tab bar', async () => {
  try {
    await resizeTo(375, 667);
    await page.evaluate(() => { const st = document.querySelector('[data-guide="fit-today"]').parentElement; st.scrollTop = st.scrollHeight; });
    await S(400);
    const m = await hubMetrics();
    const c = m.blocks['fit-cardio'];
    if (!c || c.bottom > m.navTop || c.bottom > m.stackBottom + 1 || c.top < 0) throw new Error(`Cardio sits at ${Math.round(c?.top)}-${Math.round(c?.bottom)} after scrolling to the end; tab bar at ${Math.round(m.navTop)}`);
    const clear = await page.evaluate(() => {
      const el = document.querySelector('[data-guide="fit-cardio"]'); const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      const st = document.querySelector('[data-guide="fit-today"]').parentElement;
      return { hit: !!hit && el.contains(hit), mask: getComputedStyle(st).webkitMaskImage || getComputedStyle(st).maskImage };
    });
    if (!clear.hit) throw new Error('something sits on top of the Cardio row at the end of the scroll');
    if (clear.mask && clear.mask !== 'none') throw new Error('the scroll fade is still on at the end of the scroll');
  } finally { await resizeTo(390, 844); }
}, /Quick Mission/);
// A 320px phone is the narrowest one in use: no row subtitle may be cut off.
await check('fit hub at 320x640: no row subtitle is cut off', async () => {
  try {
    await resizeTo(320, 640);
    const cut = await page.evaluate(() => [...document.querySelectorAll('.fm-s')].filter(e => e.scrollWidth > e.clientWidth + 0.5).map(e => e.textContent));
    if (cut.length) throw new Error(`cut off at 320 wide: ${cut.join(' | ')}`);
  } finally { await resizeTo(390, 844); }
}, /Quick Mission/);
// The gold ring ScreenGuide draws on the highlighted element (null on a step with none).
const guideRing = () => page.evaluate(() => {
  const el = [...document.querySelectorAll('body div')].find(d => d.style.position === 'fixed' && d.style.pointerEvents === 'none' && /2px solid/.test(d.style.border));
  if (!el) return null;
  const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom };
});
// The "?" ends on the concept card, and the last NEXT closes the guide.
await check('fit hub guide ends on the concept step, and GOT IT closes it', async () => {
  await page.locator('[data-guide="help-icon"]').click({ timeout: 4000 }); await S(600);
  const title = () => page.evaluate(() => document.querySelector('[aria-label="Close guide"]')?.nextElementSibling?.textContent || '');
  const titles = [];
  for (let i = 0; i < 12; i += 1) {
    titles.push(await title());
    if (await btn(/^GOT IT/).count()) break;
    await btn(/^NEXT/).click({ timeout: 3000 }); await S(450);
  }
  if (!/CONCEPT PROGRAMS/.test(titles[titles.length - 1])) throw new Error(`the guide ends on "${titles[titles.length - 1]}", not the concept step`);
  // The step has a spotlight, and it is on the card (a missing anchor shows a full dim).
  const ring = await guideRing();
  const card = await page.evaluate(() => { const r = document.querySelector('[data-guide="fit-concept"]').getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; });
  if (!ring || Math.abs(ring.top - card.top) > 14 || Math.abs(ring.bottom - card.bottom) > 14) throw new Error(`the concept step's ring is not on the card (ring ${JSON.stringify(ring)}, card ${JSON.stringify(card)})`);
  if (!/^CARDIO/.test(titles[titles.length - 2] || '')) throw new Error(`the step before the end is "${titles[titles.length - 2]}", not Cardio`);
  await btn(/^‹ BACK/).click({ timeout: 3000 }); await S(450);
  if (!/^CARDIO/.test(await title())) throw new Error('BACK from the concept step did not land on Cardio');
  await btn(/^NEXT/).click({ timeout: 3000 }); await S(450);
  await btn(/^GOT IT/).click({ timeout: 3000 }); await S(500);
  if (await page.locator('[aria-label="Close guide"]').count()) throw new Error('GOT IT did not close the guide');
}, /Quick Mission/);
// (Runs last on the Fit hub: tapping SURPRISE ME swaps the long title for a short one.)
// Every tap on the hub is a real 44px one. SURPRISE ME and ADJUST are 44px
// buttons that overlap the card above and the spacer below, so the browser's own
// hit test has to hand every point of them to the button (down to 40px of the
// 44: the last few px belong to the card below, whose own edge starts there);
// the three header controls are 44px taps too (four points 16px / 20px off each
// one's centre).
const hitsFor = (selector, pointsFor) => page.evaluate(({ selector, pointsFor }) => {
  const b = [...document.querySelectorAll(selector)][0];
  if (!b) return 'missing';
  const r = b.getBoundingClientRect(); const vis = b.querySelector('svg')?.getBoundingClientRect() || r;
  const pts = pointsFor === 'column'
    ? [1, 6, 11, 22, 33, 40].map(dy => [r.left + r.width / 2, r.top + dy])
    : [[-16, -20], [16, -20], [-16, 20], [16, 20]].map(([dx, dy]) => [vis.left + vis.width / 2 + dx, vis.top + vis.height / 2 + dy]);
  return pts.map(([x, y]) => { const e = document.elementFromPoint(x, y); return e && b.contains(e) ? 1 : 0; }).join('');
}, { selector, pointsFor });
await check('fit hub taps: SURPRISE ME, ADJUST and the header buttons reach 44px', async () => {
  try {
  await resizeTo(412, 811);
  for (const [name, sel] of [['SURPRISE ME', 'button.fm-quiet:nth-of-type(1)'], ['ADJUST', 'button.fm-quiet:nth-of-type(2)']]) {
    const hit = await hitsFor(sel, 'column');
    if (hit !== '111111') throw new Error(`${name} only answers some of its 44px (top to bottom: ${hit})`);
  }
  for (const [name, sel] of [['Back', 'button[aria-label="Back"]'], ['help', '[data-guide="help-icon"]'], ['Home', 'button[aria-label="Home"]']]) {
    const hit = await hitsFor(sel, 'corners');
    if (hit !== '1111') throw new Error(`the ${name} button is under 44px to tap (${hit})`);
  }
  // A tap 4px inside the top edge of SURPRISE ME, the part the card used to cover.
  const before = await page.evaluate(() => document.querySelector('[data-guide="fit-today"] h1').textContent);
  const at = await page.evaluate(() => { const r = document.querySelector('button.fm-quiet').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 4 }; });
  await page.mouse.click(at.x, at.y); await S(500);
  if (await page.evaluate(() => document.querySelector('[data-guide="fit-today"] h1').textContent) === before) throw new Error('a tap 4px inside the top of SURPRISE ME did nothing');
  } finally { await resizeTo(390, 844); }
}, /Surprise Mission/);

// The Fight hub on its fullest day (owner preview: Coach's Tapes row plus the
// drop card). Same rule as the Fit hub: it sizes to the phone, so nothing sits
// under the tab bar and nothing is on top of anything; on a very short phone it
// scrolls, fully clear of the bar, with a fade as the hint.
const FIGHT_BLOCKS = ['fight-concept', 'fh-just-train', 'fh-fight-focus', 'fh-combo', 'fh-camp', 'fh-tapes', 'fh-practice', 'fh-conditioning'];
const fightMetrics = () => page.evaluate((blocks) => {
  const rect = (k) => { const e = document.querySelector(`[data-guide="${k}"]`); return e ? e.getBoundingClientRect() : null; };
  const stack = document.querySelector('[data-guide="fh-disciplines"]').parentElement;
  const sub = [...document.querySelectorAll('[data-guide="fight-concept"] div')].find(d => d.style.whiteSpace === 'nowrap');
  const out = { navTop: rect('nav-tabs').top, stack: [stack.scrollHeight, stack.clientHeight], stackTop: stack.getBoundingClientRect().top, stackBottom: stack.getBoundingClientRect().bottom, cardSub: sub ? [sub.scrollWidth, sub.clientWidth] : null, mask: getComputedStyle(stack).webkitMaskImage, blocks: {} };
  for (const k of blocks) { const b = rect(k); if (b) out.blocks[k] = { top: b.top, bottom: b.bottom, h: b.height }; }
  return out;
}, FIGHT_BLOCKS);
const fightFits = (m, label) => {
  let prev = null;
  for (const k of FIGHT_BLOCKS) {
    const b = m.blocks[k];
    if (!b) throw new Error(`${label}: ${k} is not on the Fight hub`);
    if (b.bottom > m.navTop) throw new Error(`${label}: ${k} ends at ${Math.round(b.bottom)}, under the tab bar at ${Math.round(m.navTop)}`);
    if (prev && b.top < prev.bottom - 0.5 && k !== 'fh-conditioning') throw new Error(`${label}: ${k} overlaps the block above it`);
    const floor = k === 'fight-concept' ? 75.5 : k === 'fh-camp' ? 55.5 : /^fh-(practice|conditioning)$/.test(k) ? 83.5 : 47.5;
    if (b.h < floor) throw new Error(`${label}: ${k} is squashed to ${Math.round(b.h)}px`);
    prev = b;
  }
  if (m.stack[0] > m.stack[1] + 1) throw new Error(`${label}: the stack needs scrolling (${m.stack[0]} > ${m.stack[1]})`);
  if (m.cardSub && m.cardSub[0] > m.cardSub[1]) throw new Error(`${label}: the drop card's line is cut off with an ellipsis`);
};
await check('fight hub fits 412x811, 390x844 and 360x740 with Coach\'s Tapes and a drop', async () => {
  try {
    await page.locator('[data-guide="mode-fight"]').click({ timeout: 4000 }); await S(1200);
    for (const [w, h] of [[412, 811], [390, 844], [360, 740]]) { await resizeTo(w, h); fightFits(await fightMetrics(), `${w}x${h}`); }
  } finally { await resizeTo(390, 844); }
}, /FIGHT MODE/);
await check('fight hub at 375x667 scrolls the tiles fully clear of the tab bar, with a fade hint', async () => {
  try {
    await resizeTo(375, 667);
    const rest = await fightMetrics();
    if (rest.stack[0] <= rest.stack[1] || !rest.mask || rest.mask === 'none') throw new Error('a stack that scrolls shows no fade hint');
    await page.evaluate(() => { const st = document.querySelector('[data-guide="fh-disciplines"]').parentElement; st.scrollTop = st.scrollHeight; });
    await S(400);
    const m = await fightMetrics();
    const t = m.blocks['fh-conditioning'];
    if (!t || t.bottom > m.navTop || t.bottom > m.stackBottom + 1) throw new Error(`the tiles end at ${Math.round(t?.bottom)} after scrolling to the end; stack ends ${Math.round(m.stackBottom)}, tab bar at ${Math.round(m.navTop)}`);
    if (m.mask && m.mask !== 'none') throw new Error('the scroll fade is still on at the end of the scroll');
  } finally { await resizeTo(390, 844); }
}, /FIGHT MODE/);
// The Fight "?" lights the concept card last, and on a phone where the stack
// scrolls every ring must still sit on the stack, not over the header or under
// the tab bar (the guide scrolls each target into the stack first).
const walkFightGuide = async (label) => {
  await page.locator('button[aria-label="How this screen works"]').click({ timeout: 4000 }); await S(700);
  const title = () => page.evaluate(() => document.querySelector('[aria-label="Close guide"]')?.nextElementSibling?.textContent || '');
  const titles = [];
  for (let i = 0; i < 14; i += 1) {
    const t = await title(); titles.push(t);
    const m = await fightMetrics(); const ring = await guideRing();
    if (i > 0) {
      if (!ring) throw new Error(`${label}: "${t}" has no spotlight`);
      if (ring.top < m.stackTop - 12 || ring.bottom > Math.min(m.stackBottom, m.navTop) + 12) throw new Error(`${label}: "${t}" is lit at ${Math.round(ring.top)}-${Math.round(ring.bottom)}, outside the stack ${Math.round(m.stackTop)}-${Math.round(m.stackBottom)}`);
    }
    if (await btn(/^GOT IT/).count()) break;
    await btn(/^NEXT/).click({ timeout: 3000 }); await S(700);
  }
  if (!/CONCEPT PROGRAMS/.test(titles[titles.length - 1])) throw new Error(`${label}: the guide ends on "${titles[titles.length - 1]}", not the concept step`);
  const ring = await guideRing(); const card = await page.evaluate(() => { const r = document.querySelector('[data-guide="fight-concept"]').getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; });
  if (!ring || Math.abs(ring.top - card.top) > 14 || Math.abs(ring.bottom - card.bottom) > 14) throw new Error(`${label}: the concept step's ring is not on the card`);
  await btn(/^GOT IT/).click({ timeout: 3000 }); await S(500);
  if (await page.locator('[aria-label="Close guide"]').count()) throw new Error(`${label}: GOT IT did not close the guide`);
};
await check('fight hub guide: every ring on the stack at 375x667 (scrolling) and 360x740, ending on the concept card', async () => {
  try { for (const [w, h] of [[375, 667], [360, 740]]) { await resizeTo(w, h); await walkFightGuide(`${w}x${h}`); } } finally { await resizeTo(390, 844); }
}, /FIGHT MODE/);

// A drop that ends while a hub is open (the last window closes at midnight on
// 2027-09-30): card, gap and the guide's last step have to go together. The
// hub is on screen across midnight, then anything re-renders it.
const overMidnight = async (mode, rerender, lastTitle) => {
  // Its own context: a page's clock is the whole context's, and every check
  // after this one has to run on today's date.
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx2.addInitScript(seedStorage);
  const p2 = await ctx2.newPage();
  try {
    await p2.clock.install({ time: new Date('2027-09-30T23:59:40') });
    await p2.goto(BASE + '?__reset=1', { waitUntil: 'networkidle' }); await p2.waitForTimeout(2000);
    await p2.mouse.click(195, 120); await p2.waitForTimeout(1500);
    await p2.locator('button[aria-label="Close"]').first().click({ force: true, timeout: 1500 }).catch(() => {});
    await p2.locator(`button[aria-label="${mode === 'fit' ? 'FIT MODE' : 'FIGHT MODE'}"]`).click({ timeout: 5000 }); await p2.waitForTimeout(1200);
    const card = `[data-guide="${mode}-concept"]`;
    if (!(await p2.locator(card).count())) throw new Error('the drop card is not on the hub before midnight');
    await p2.clock.fastForward(30000); await p2.waitForTimeout(300);
    await rerender(p2); await p2.waitForTimeout(500);
    if (await p2.locator(card).count()) throw new Error('the drop card is still on the hub after the drop ended');
    await p2.locator('button[aria-label="How this screen works"]').click({ timeout: 4000 }); await p2.waitForTimeout(700);
    const title = () => p2.evaluate(() => document.querySelector('[aria-label="Close guide"]')?.nextElementSibling?.textContent || '');
    const titles = [];
    for (let i = 0; i < 14; i += 1) {
      titles.push(await title());
      if (await p2.getByRole('button', { name: /^GOT IT/ }).count()) break;
      await p2.getByRole('button', { name: /^NEXT/ }).first().click({ timeout: 3000 }); await p2.waitForTimeout(450);
    }
    if (titles.some(t => /CONCEPT PROGRAMS/.test(t)) || !new RegExp(`^${lastTitle}`).test(titles[titles.length - 1])) throw new Error(`the guide ends on "${titles[titles.length - 1]}" after the drop ended, not ${lastTitle}`);
  } finally { await ctx2.close(); }
};
await check('fit hub: a drop ending while it is open leaves no card and a guide that ends on Cardio', async () => {
  await overMidnight('fit', (p2) => p2.locator('button.fm-quiet').first().click(), 'CARDIO');
}, /FIGHT MODE|FIT MODE/);
await check('fight hub: a drop ending while it is open leaves no card and a guide that ends on Combat Conditioning', async () => {
  await overMidnight('fight', (p2) => p2.locator('[aria-label="Discipline"] [role="tab"]').nth(1).click(), 'COMBAT CONDITIONING');
}, /FIGHT MODE|FIT MODE/);

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
// named by the title, plus a YOUR PACE ONLY or PRO pill, so the patterns are anchored
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
// card), GEAR (a radio strip) and TIME (a range input, 5 to 60 by 1).
const card = () => page.locator('[data-guide="qm-card"]');
const gearKey = (name) => page.locator('[data-guide="qm-gear"]').getByRole('radio', { name, exact: true });
const slider = () => page.locator('[data-guide="qm-time"] input[type="range"]');
const expand = async () => { if (await page.locator('[data-guide="qm-expand"]').getAttribute('aria-expanded') !== 'true') { await page.locator('[data-guide="qm-expand"]').click({ timeout: 4000 }); await S(600); } };
const adjustSheet = () => page.getByRole('dialog', { name: 'Adjust' });
const adjust = async () => { await expand(); await page.locator('[data-guide="qm-adjust"]').click({ timeout: 4000 }); await S(500); };
const done = async () => { await adjustSheet().getByRole('button', { name: /DONE/ }).click({ timeout: 4000 }); await S(400); };
const timeTo = async (mins) => {
  await slider().focus();
  for (let i = 0; i < 70; i++) {
    const v = Number(await slider().inputValue());
    if (v === mins) return;
    await page.keyboard.press(v < mins ? 'ArrowRight' : 'ArrowLeft'); await S(30);
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
// GUIDED | AT YOUR PACE (data/soloFromGenerated). The choice sits on the first
// page, right above START: GUIDED is the coach, AT YOUR PACE the moves and a
// timer. It is remembered, ADJUST keeps in step with it, today's mission runs
// both ways, a classic stays with the coach and a your-pace-only mission shows
// AT YOUR PACE selected. Stored and routed as 'solo' (the words on screen are
// AT YOUR PACE).
const modeSwitch = () => page.getByRole('radiogroup', { name: 'Run mode' });
const modeKey = (name) => modeSwitch().getByRole('radio', { name, exact: true });
const modeHelp = () => page.locator('#qm-how-help').innerText();
const GUIDED_LINE = 'The coach calls every move and keeps time.';
const PACE_LINE = 'The moves and a timer. Beeps, no coach voice.';
// The move names on the card, after ▾ SEE ALL opens it.
const cardMoves = async () => { await expand(); return card().locator('ol > li > span:nth-child(2)').allInnerTexts(); };
// The moves the run screen lists (its rows are 01, 02… then a name).
const runMoves = (t) => [...t.matchAll(/\n\d\d\n([^\n]+)\n/g)].map(m => m[1]);
// Move the app's clock on without waiting: the run screen counts Date.now().
const jump = (ms) => page.evaluate((d) => { if (window.__off === undefined) { const r = Date.now.bind(Date); window.__off = 0; Date.now = () => r() + window.__off; } window.__off += d; }, ms);
const nav = () => page.evaluate(() => document.querySelector('[data-guide="nav-tabs"]').getBoundingClientRect().top);
await check('quick mission: GUIDED | AT YOUR PACE is on the first page and the whole page stays above the tab bar', async () => {
  await quick();
  try {
    for (const [w, h] of [[412, 811], [390, 844], [360, 740]]) {
      await resizeTo(w, h);
      for (const m of ['GUIDED', 'AT YOUR PACE']) {
        await modeKey(m).click({ timeout: 4000 }); await S(300);
        const g = await page.evaluate(() => {
          const r = (e) => e.getBoundingClientRect();
          const sw = document.querySelector('[role="radiogroup"][aria-label="Run mode"]');
          const start = [...document.querySelectorAll('button')].find(b => /^START$/.test(b.textContent.trim()));
          return {
            nav: r(document.querySelector('[data-guide="nav-tabs"]')).top, start: r(start), lib: r(document.querySelector('[data-guide="qm-library"]')),
            sw: r(sw), segs: [...sw.querySelectorAll('[role="radio"]')].map(b => r(b).height), how: r(document.querySelector('[data-guide="qm-how"]')),
            gear: r(document.querySelector('[data-guide="qm-gear"]')), time: r(document.querySelector('[data-guide="qm-time"]')),
            chip: r([...document.querySelectorAll('button')].find(b => /BETA/.test(b.textContent))),
            help: r(document.querySelector('#qm-how-help')),
          };
        });
        const at = `${w}x${h} ${m}`;
        if (g.sw.height < 43.5 || g.segs.some(s => s < 43.5)) throw new Error(`${at}: the switch is ${g.sw.height}px tall (segments ${g.segs})`);
        if (g.start.bottom > g.nav || g.start.height < 43.5) throw new Error(`${at}: START ends at ${Math.round(g.start.bottom)}, the tab bar starts at ${Math.round(g.nav)}`);
        if (g.sw.bottom > g.start.top) throw new Error(`${at}: the switch is not above START`);
        if (g.lib.bottom > g.nav + 0.5) throw new Error(`${at}: the library row ends at ${Math.round(g.lib.bottom)}, under the tab bar at ${Math.round(g.nav)}`);
        if (g.gear.bottom > g.time.top + 0.5 || g.time.bottom > g.lib.top + 0.5) throw new Error(`${at}: GEAR, TIME and the library overlap`);
        // The floating BETA chip (left edge, 37px over the tab bar) must not sit on the library row.
        if (g.chip.right > g.lib.left && g.chip.left < g.lib.right && g.chip.bottom > g.lib.top && g.chip.top < g.lib.bottom - 0.5) throw new Error(`${at}: the BETA chip (${Math.round(g.chip.top)}-${Math.round(g.chip.bottom)}) sits on the library row (${Math.round(g.lib.top)}-${Math.round(g.lib.bottom)})`);
        if (g.help.height > 20) throw new Error(`${at}: the line under the switch wraps to ${Math.round(g.help.height)}px`);
        if (await modeHelp() !== (m === 'GUIDED' ? GUIDED_LINE : PACE_LINE)) throw new Error(`${at}: the line under the switch is not the ${m} one`);
      }
    }
  } finally { await resizeTo(390, 844); }
}, /GUIDED/);
await check('quick mission: a closed card with exactly three moves says SEE ALL 3 MOVES where a short phone hides one', async () => {
  await quick(); await putOnCard(V2_PUBLIC ? /^BEST OF 3/ : /^HALF MURPH/);
  const moves = () => page.evaluate(() => ({ all: document.querySelectorAll('#qm-moves > li').length, shown: [...document.querySelectorAll('#qm-moves > li')].filter(li => li.offsetParent !== null).length }));
  if ((await moves()).all !== 3) return; // the mission has changed; the rule is held for three moves only
  try {
    await resizeTo(360, 740);
    const small = await moves(); const smallLabel = await page.locator('[data-guide="qm-expand"]').innerText();
    if (small.shown < 3 && !/SEE ALL 3 MOVES/.test(smallLabel)) throw new Error(`360x740 shows ${small.shown} of 3 moves under "${smallLabel}"`);
    await resizeTo(412, 811);
    const tall = await moves(); const tallLabel = await page.locator('[data-guide="qm-expand"]').innerText();
    if (tall.shown !== 3 || !/SEE MORE/.test(tallLabel)) throw new Error(`412x811 shows ${tall.shown} of 3 moves under "${tallLabel}"`);
  } finally { await resizeTo(390, 844); }
}, /SEE ALL \d+ MOVES|SEE MORE/);
await check('quick mission: GUIDED is the default, and the choice is remembered, with ADJUST in step', async () => {
  await quick();
  if (await modeKey('GUIDED').getAttribute('aria-checked') !== 'true' || await modeKey('AT YOUR PACE').getAttribute('aria-checked') !== 'false') throw new Error('GUIDED is not the default');
  await modeKey('AT YOUR PACE').click({ timeout: 4000 }); await S(300);
  if (await page.evaluate(() => JSON.parse(localStorage.getItem('tm_qm_shelf_v1') || '{}').mode) !== 'solo') throw new Error('AT YOUR PACE was not saved (stored as solo)');
  await adjust();
  const how = adjustSheet().getByRole('radiogroup', { name: 'Run mode' });
  if (await how.getByRole('radio', { name: 'AT YOUR PACE', exact: true }).getAttribute('aria-checked') !== 'true') throw new Error('ADJUST does not show AT YOUR PACE');
  if (!(await adjustSheet().innerText()).includes(PACE_LINE)) throw new Error('ADJUST does not say what AT YOUR PACE does');
  await how.getByRole('radio', { name: 'GUIDED', exact: true }).click({ timeout: 4000 }); await S(300); await done();
  if (await modeKey('GUIDED').getAttribute('aria-checked') !== 'true' || await modeHelp() !== GUIDED_LINE) throw new Error('GUIDED in ADJUST did not reach the page');
  await modeKey('AT YOUR PACE').click({ timeout: 4000 }); await S(300);
  await page.locator('button[aria-label="Back"]').click({ timeout: 3000 }); await S(800);
  await page.locator('[data-guide="fit-quick"]').click({ timeout: 4000 }); await S(1200);
  if (await modeKey('AT YOUR PACE').getAttribute('aria-checked') !== 'true' || await modeHelp() !== PACE_LINE) throw new Error('AT YOUR PACE did not come back on the next visit');
}, /AT YOUR PACE/);
await check('quick mission: a classic stays with the coach, and says why', async () => {
  await quick(); await modeKey('AT YOUR PACE').click({ timeout: 4000 }); await S(300);
  await putOnCard(/^MURPH$/);
  if (await modeKey('GUIDED').getAttribute('aria-checked') !== 'true' || await modeKey('AT YOUR PACE').getAttribute('aria-disabled') !== 'true') throw new Error('Murph is not GUIDED with AT YOUR PACE dimmed');
  if (await modeHelp() !== 'This classic runs with the coach.') throw new Error('no reason under the dimmed switch');
  await modeKey('AT YOUR PACE').click({ force: true, timeout: 4000 }); await S(300);
  if (await modeKey('GUIDED').getAttribute('aria-checked') !== 'true' || await page.evaluate(() => JSON.parse(localStorage.getItem('tm_qm_shelf_v1') || '{}').mode) !== 'solo') throw new Error('tapping the dimmed segment changed something');
  await btn(/^START$/).click({ timeout: 4000 }); await S(4000);
  if (/AT YOUR PACE/.test(await text())) throw new Error('a classic ran at your pace');
}, /ROUND|EXERCISE|MILE|PREPARING|GET READY/);
await check('quick mission: the library says how START will run the highlighted mission', async () => {
  await quick();
  const lineOf = async () => (await sheet().locator('#ml-sub').innerText()).replace(/\s+/g, ' ');
  await pickRow(V2_PUBLIC ? /^ONE-BELL 300/ : /^HALF MURPH/);
  if (V2_PUBLIC && !/START runs it GUIDED\./.test(await lineOf())) throw new Error(`GUIDED saved: the library says "${await lineOf()}"`);
  await sheet().getByRole('button', { name: 'Close' }).click({ timeout: 4000 }); await S(500);
  await modeKey('AT YOUR PACE').click({ timeout: 4000 }); await S(300);
  await pickRow(V2_PUBLIC ? /^ONE-BELL 300/ : /^HALF MURPH/);
  if (V2_PUBLIC && !/START runs it AT YOUR PACE\./.test(await lineOf())) throw new Error(`AT YOUR PACE saved: the library says "${await lineOf()}"`);
  await sheet().getByRole('radio', { name: /^MURPH|^HALF MURPH/ }).first().click({ timeout: 4000 }); await S(300);
  if (!/START runs this one with the coach\./.test(await lineOf())) throw new Error(`a classic: the library says "${await lineOf()}"`);
}, /CLASSICS|MISSION LIBRARY/);
await check('owner: a mission only offered at your pace shows AT YOUR PACE selected and GUIDED dimmed', async () => {
  await ownerQuick(); await putOnCard(/^HONOR ROUNDS/);
  if (await modeKey('AT YOUR PACE').getAttribute('aria-checked') !== 'true' || await modeKey('GUIDED').getAttribute('aria-disabled') !== 'true') throw new Error('HONOR ROUNDS is not AT YOUR PACE with GUIDED dimmed');
  if (await modeHelp() !== 'Only at your pace for now. Guided is coming.') throw new Error('no your-pace-only note');
  if (!/YOUR PACE ONLY/.test(await card().innerText())) throw new Error('no YOUR PACE ONLY tag on the card');
}, /YOUR PACE/);
await check('quick mission: AT YOUR PACE then START runs the moves and a timer; the XP is the guided XP, banked once', async () => {
  await quick();
  const moves = await cardMoves();
  // Today's mission pays its minutes at its level's rate (15 a minute at EASY and MEDIUM, 16 HARD, 18 ADVANCED), plus the 30 finish bonus.
  const cardText = await card().innerText();
  const askedMin = Number((cardText.match(/(\d+) MIN/i) || [])[1]);
  const perMin = { EASY: 15, MEDIUM: 15, HARD: 16, ADVANCED: 18 }[(cardText.match(/\b(EASY|MEDIUM|HARD|ADVANCED)\b/) || [])[1]];
  if (!(askedMin >= 5) || !perMin) throw new Error(`could not read the minutes and level off the card: ${cardText.replace(/\n/g, ' / ').slice(0, 120)}`);
  await modeKey('AT YOUR PACE').click({ timeout: 4000 }); await S(300);
  await btn(/^START$/).click({ timeout: 4000 }); await S(7500);
  let t = await text();
  if (!/AT YOUR PACE/.test(t) || !/CIRCUIT/.test(t)) throw new Error('not the at-your-pace screen');
  if (await page.locator('[data-guide="qma-ring"]').count() || /PREPARING/.test(t)) throw new Error('the coach runner opened');
  const shown = runMoves(t);
  if (JSON.stringify(shown) !== JSON.stringify(moves)) throw new Error(`the list is ${shown.join(', ')}, the card said ${moves.join(', ')}`);
  const rounds = Number((t.match(/ROUND 1\/(\d+)/) || [])[1]);
  if (!(rounds >= 2) || !/CAP \d+:\d\d/.test(t) || !/ROUND 1\b/.test(t) || !(await btn(/^ROUND$/).isVisible()) || !(await btn(/^FINISH$/).isVisible()) || !(await page.getByRole('button', { name: 'Undo round' }).count())) throw new Error('no timer, round count, ROUND, UNDO or FINISH');
  const tier = (n) => { const m = t.match(new RegExp(`${n}\\s*\\n?\\s*≤ (\\d+):(\\d\\d)`)); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };
  const [elite, standard, beginner] = ['ELITE', 'STANDARD', 'BEGINNER'].map(tier);
  if (!(elite < standard && standard < beginner)) throw new Error(`the pace targets are ${elite} / ${standard} / ${beginner}`);
  if (/SOLO/i.test(t)) throw new Error('the screen says SOLO');
  // Round 1, a round tap, the rest of the rounds, FINISH, SAVE: the clock is moved on, not waited for.
  for (let r = 1; r < rounds; r += 1) { await jump(Math.round(standard / rounds) * 1000); await S(700); await btn(/^ROUND$/).click({ timeout: 4000 }); await S(300); }
  await jump(Math.round(standard / rounds) * 1000); await S(700);
  if (!new RegExp(`ROUNDS ${rounds - 1}\\b`).test(await text())) throw new Error('ROUND did not count the rounds');
  await btn(/^FINISH$/).click({ timeout: 4000 }); await S(600);
  t = await text();
  if (!/YOUR SCORE/.test(t) || !/NOT YET/.test(t)) throw new Error('FINISH did not open the score');
  await btn(/^SAVE$/).click({ timeout: 4000 }); await S(3500);
  t = await text();
  const xp = Math.round(askedMin * perMin) + 30;
  if (!new RegExp(`\\+${xp}\\b`).test(t) || !/At your pace/.test(t)) throw new Error(`the complete screen does not show +${xp} XP at your pace`);
  const rows = await qmRows();
  if (rows.length !== 1 || rows[0].xpEarned !== xp || rows[0].mode !== 'solo' || rows[0].completed !== true || rows[0].completedCount !== moves.length * rounds || rows[0].totalCount !== moves.length * rounds) throw new Error(`the bank holds ${JSON.stringify(rows)}`);
  await page.waitForTimeout(500);
  if ((await qmRows()).length !== 1) throw new Error('the run banked twice');
}, /SESSION COMPLETE/);
await check('quick mission: a finish far faster than the moves could be done pays nothing', async () => {
  await quick(); await modeKey('AT YOUR PACE').click({ timeout: 4000 }); await S(300);
  await btn(/^START$/).click({ timeout: 4000 }); await S(7500);
  await btn(/^FINISH$/).click({ timeout: 4000 }); await S(500);
  await btn(/^SAVE$/).click({ timeout: 4000 }); await S(3500);
  const t = await text(); const rows = await qmRows();
  if (!/Under half the elite time/.test(t) || !/\+?0\s*\n?\s*XP/.test(t) || rows.length !== 1 || rows[0].xpEarned !== 0) throw new Error(`a quick tap paid: ${JSON.stringify(rows)}`);
}, /VALIDATION FAILED|FAILED|COMPLETE/);
// The pace targets on the run screen, in seconds ("≤ 10:15" under STANDARD).
const paceTier = (t, n) => { const m = t.match(new RegExp(`${n}\\s*\\n?\\s*≤ (\\d+):(\\d\\d)`)); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };
await check('quick mission: on an Easy mission a finish at a third of STANDARD still pays the full XP (the floor sits under what the moves take)', async () => {
  await fit();
  await page.evaluate(() => localStorage.setItem('tm_qm_keys_v1', JSON.stringify({ workoutType: 'Bodyweight', difficulty: 'EASY', duration: 10, focus: 'FULL BODY' })));
  await page.locator('[data-guide="fit-quick"]').click({ timeout: 4000 }); await S(1200);
  await modeKey('AT YOUR PACE').click({ timeout: 4000 }); await S(300);
  await btn(/^START$/).click({ timeout: 4000 }); await S(7500);
  let t = await text();
  const moves = runMoves(t).length;
  const rounds = Number((t.match(/ROUND 1\/(\d+)/) || [])[1]) || 1;
  const standard = paceTier(t, 'STANDARD');
  if (!moves || !(standard > 0)) throw new Error('no moves or STANDARD target on the at-your-pace screen');
  await jump(Math.round(standard * 0.33) * 1000); await S(700);
  await btn(/^FINISH$/).click({ timeout: 4000 }); await S(500);
  await btn(/^SAVE$/).click({ timeout: 4000 }); await S(3500);
  t = await text();
  const xp = 15 * moves * rounds + 30; const bank = await qmRows();
  if (!new RegExp(`\\+${xp}\\b`).test(t) || bank.length !== 1 || bank[0].xpEarned !== xp) throw new Error(`a finish at a third of STANDARD paid ${JSON.stringify(bank.map(r => r.xpEarned))}, not ${xp}`);
}, /SESSION COMPLETE/);
await check('home: a one-round run (the 5 minute mission) has FINISH only, and its score panel repeats no "R1" split', async () => {
  await home();
  await page.evaluate(() => localStorage.setItem('tm_last_session_v1', JSON.stringify({ kind: 'quick_mission', at: Date.now(), disc: null, cfg: {
    workoutType: 'Bodyweight', duration: 5, difficulty: 'Easy', focus: 'Core', format: 'Auto', cardioFinisher: false, cadenceCount: true,
    cadencePreset: 'moderate', cadenceMs: 2000, voiceOn: true, cardioAddon: null, mode: 'solo' } })));
  await page.goto(BASE, { waitUntil: 'networkidle' }); await S(2000); await page.mouse.click(195, 120); await S(1500);
  await page.locator('button[aria-label="Close"]').first().click({ force: true, timeout: 1500 }).catch(() => {});
  await page.locator('[data-guide="home-continue"] button.hm-go').click({ timeout: 4000 }); await S(7500);
  let t = await text();
  if (!/^AT YOUR PACE\n/.test(t) || !runMoves(t).length) throw new Error('the replay did not open the at-your-pace screen');
  if (await btn(/^ROUND$/).count() || !(await btn(/^FINISH$/).isVisible())) throw new Error('a one-round run should have FINISH and no ROUND');
  if (!/Tap FINISH when the list is done\./.test(t)) throw new Error('no line saying what FINISH does');
  await jump(90000); await S(700);
  await btn(/^FINISH$/).click({ timeout: 4000 }); await S(600);
  t = await text();
  if (!/YOUR SCORE/.test(t) || /\bR1 \d+:\d\d/.test(t)) throw new Error(`the score panel repeats the time as a split: ${t.replace(/\n/g, ' | ').slice(0, 220)}`);
}, /YOUR SCORE/);
await check('home: the card says AT YOUR PACE when that is saved and START runs it that way; with GUIDED saved it says nothing', async () => {
  const goHome = async () => {
    await page.goto(BASE, { waitUntil: 'networkidle' }); await S(2000); await page.mouse.click(195, 120); await S(1500);
    await page.locator('button[aria-label="Close"]').first().click({ force: true, timeout: 1500 }).catch(() => {});
  };
  const cardText = () => page.evaluate(() => document.querySelector('[data-guide="home-continue"]').innerText);
  await home();
  await page.evaluate(() => localStorage.setItem('tm_qm_shelf_v1', JSON.stringify({ mode: 'solo' })));
  await goHome();
  await page.getByRole('button', { name: /SURPRISE ME/ }).click({ timeout: 4000 }); await S(400);
  const c = await cardText();
  if (!/Surprise Mission/.test(c) || !/AT YOUR PACE/.test(c)) throw new Error(`the Home card does not say AT YOUR PACE: ${c.replace(/\n/g, ' | ')}`);
  await page.locator('[data-guide="home-continue"] button.hm-go').click({ timeout: 4000 }); await S(7500);
  const t = await text();
  if (!/^AT YOUR PACE\n/.test(t) || !runMoves(t).length || await page.locator('[data-guide="qma-ring"]').count()) throw new Error('the Home START did not run the moves and a timer');
  await home();
  await page.evaluate(() => localStorage.setItem('tm_qm_shelf_v1', JSON.stringify({ mode: 'guided' })));
  await goHome();
  await page.getByRole('button', { name: /SURPRISE ME/ }).click({ timeout: 4000 }); await S(400);
  if (/AT YOUR PACE/.test(await cardText())) throw new Error('the Home card says AT YOUR PACE on GUIDED');
}, /Surprise Mission/);
await check('home: a guided start is remembered as guided, so CONTINUE stays guided even after AT YOUR PACE is saved', async () => {
  await fit();
  await page.locator('[data-guide="fit-today"] button.fm-go').click({ timeout: 4000 }); await S(2500);
  if (!await page.locator('[data-guide="qma-ring"]').count()) throw new Error('the hub START did not run the coach');
  const mode = await page.evaluate(() => JSON.parse(localStorage.getItem('tm_last_session_v1') || '{}').cfg?.mode);
  if (mode !== 'guided') throw new Error(`the last session is remembered as "${mode}", not guided`);
  // Later the athlete saves AT YOUR PACE; CONTINUE still repeats the guided run it remembers.
  await home();
  await page.evaluate(() => {
    localStorage.setItem('tm_last_session_v1', JSON.stringify({ kind: 'quick_mission', at: Date.now(), disc: null, cfg: {
      workoutType: 'Bodyweight', duration: 15, difficulty: 'Normal', focus: 'Full Body', format: 'Auto', cardioFinisher: false, cadenceCount: true,
      cadencePreset: 'moderate', cadenceMs: 2000, voiceOn: true, cardioAddon: null, mode: 'guided' } }));
    localStorage.setItem('tm_qm_shelf_v1', JSON.stringify({ mode: 'solo' }));
  });
  await page.goto(BASE, { waitUntil: 'networkidle' }); await S(2000); await page.mouse.click(195, 120); await S(1500);
  await page.locator('button[aria-label="Close"]').first().click({ force: true, timeout: 1500 }).catch(() => {});
  const c = await page.evaluate(() => document.querySelector('[data-guide="home-continue"]').innerText);
  if (!/Quick Mission/.test(c) || /AT YOUR PACE/.test(c)) throw new Error(`the Continue card is wrong: ${c.replace(/\n/g, ' | ')}`);
  await page.locator('[data-guide="home-continue"] button.hm-go').click({ timeout: 4000 }); await S(2500);
  if (!await page.locator('[data-guide="qma-ring"]').count() || /^AT YOUR PACE\n/.test(await text())) throw new Error('CONTINUE did not repeat the guided run');
}, /PREPARING|ROUND|GET READY/);
await check('quick mission: GUIDED still starts the coach, and its brief offers AT YOUR PACE INSTEAD for the same mission', async () => {
  await quick(); await modeKey('AT YOUR PACE').click({ timeout: 4000 }); await S(300);
  await modeKey('GUIDED').click({ timeout: 4000 }); await S(300);
  const moves = await cardMoves();
  // Count the analytics events: one session_start for the attempt, the switch is its own event.
  await page.evaluate(() => { window.__ev = []; window.plausible = (n, o) => window.__ev.push([n, o?.props]); });
  await btn(/^START$/).click({ timeout: 4000 }); await S(1500);
  let t = await text();
  if (!/PREPARING/.test(t) || !await page.locator('[data-guide="qma-ring"]').count()) throw new Error('GUIDED did not open the coach runner');
  // The link keeps clear of the pause / skip / stop row under it (a late tap must not hit STOP).
  const gap = await page.evaluate(() => {
    const link = [...document.querySelectorAll('button')].find(b => /^AT YOUR PACE INSTEAD$/.test(b.textContent.trim()));
    const next = document.querySelector('[data-guide="qma-pause"]');
    return link && next ? Math.round(next.getBoundingClientRect().top - link.getBoundingClientRect().bottom) : null;
  });
  if (gap === null || gap < 8) throw new Error(`AT YOUR PACE INSTEAD sits ${gap}px above the pause row`);
  await btn(/^AT YOUR PACE INSTEAD$/).click({ timeout: 4000 }); await S(7500);
  const ev = await page.evaluate(() => window.__ev || []);
  if (ev.filter(e => e[0] === 'session_start').length !== 1 || ev.filter(e => e[0] === 'session_switch').length !== 1) throw new Error(`the switch counted as another start: ${JSON.stringify(ev)}`);
  t = await text();
  if (!/^AT YOUR PACE\n/.test(t) || JSON.stringify(runMoves(t)) !== JSON.stringify(moves)) throw new Error('the switch did not restart the same mission at your pace');
  if ((await qmRows()).length) throw new Error('the switch banked something');
}, /AT YOUR PACE/);
await check('quick mission: a paused at-your-pace run, and one killed and reloaded, come back with the same moves', async () => {
  await quick(); await modeKey('AT YOUR PACE').click({ timeout: 4000 }); await S(300);
  const moves = await cardMoves();
  await btn(/^START$/).click({ timeout: 4000 }); await S(7500);
  await page.locator('[data-guide="nav-tabs"] button').first().click({ timeout: 4000 }); await S(1800);
  await page.getByRole('button', { name: /RESUME/ }).first().click({ timeout: 4000 }); await S(2500);
  let t = await text();
  if (!/^AT YOUR PACE\n/.test(t) || !/PAUSED/.test(t) || JSON.stringify(runMoves(t)) !== JSON.stringify(moves)) throw new Error('the pause did not bring back the same run');
  await page.reload({ waitUntil: 'networkidle' }); await S(2500);
  t = await text();
  if (!/^AT YOUR PACE\n/.test(t) || JSON.stringify(runMoves(t)) !== JSON.stringify(moves)) throw new Error('the reload did not bring back the same run');
}, /AT YOUR PACE/);
await check('fit hub: START runs today\'s mission AT YOUR PACE when that is the saved choice, and says so', async () => {
  await home();
  await page.evaluate(() => localStorage.setItem('tm_qm_shelf_v1', JSON.stringify({ mode: 'solo' })));
  await page.locator('button[aria-label="FIT MODE"]').click({ timeout: 5000 }); await S(1200);
  await page.getByRole('button', { name: /SURPRISE ME/ }).click({ timeout: 4000 }); await S(400);
  const hero = await page.evaluate(() => document.querySelector('[data-guide="fit-today"]').innerText);
  if (!/Surprise Mission/.test(hero) || !/\s·\s+At\s+your\s+pace/.test(hero)) throw new Error(`the card does not say At your pace: ${hero.replace(/\n/g, ' | ')}`);
  await page.locator('[data-guide="fit-today"] button.fm-go').click({ timeout: 4000 }); await S(7500);
  const t = await text();
  if (!/^AT YOUR PACE\n/.test(t) || !runMoves(t).length || await page.locator('[data-guide="qma-ring"]').count()) throw new Error('the hub START did not run the moves and a timer');
}, /AT YOUR PACE/);
await check('fit hub: START still runs the coach when GUIDED is saved (no "At your pace" on the card)', async () => {
  await fit();
  await page.getByRole('button', { name: /SURPRISE ME/ }).click({ timeout: 4000 }); await S(400);
  if (/At\s+your\s+pace/.test(await page.evaluate(() => document.querySelector('[data-guide="fit-today"]').innerText))) throw new Error('the card says At your pace on GUIDED');
  await page.locator('[data-guide="fit-today"] button.fm-go').click({ timeout: 4000 }); await S(2500);
  if (!await page.locator('[data-guide="qma-ring"]').count() || /^AT YOUR PACE\n/.test(await text())) throw new Error('the hub START did not run the coach');
}, /PREPARING|ROUND|GET READY/);
await check('fit hub: on the fullest day, with "At your pace" saved, the card still fits 412x811 and 360x740', async () => {
  await fullFitHub({ atYourPace: true });
  try { for (const [w, h] of [[412, 811], [360, 740]]) { await resizeTo(w, h); fitsHub(await hubMetrics(), `${w}x${h} At your pace`); } } finally { await resizeTo(390, 844); }
  if (!/\s·\s+At\s+your\s+pace/.test(await page.evaluate(() => document.querySelector('[data-guide="fit-today"]').innerText))) throw new Error('the card does not say At your pace');
}, /Quick Mission/);
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
await check('quick mission: the ADJUST row on the open card shows its whole hint (cardio included) at 412x811 and 360x740', async () => {
  await quick(); await expand();
  try {
    for (const [w, h] of [[412, 811], [360, 740]]) {
      await resizeTo(w, h);
      const hint = await page.evaluate(() => {
        const sp = [...document.querySelectorAll('[data-guide="qm-adjust"] span')].find(x => /^·/.test(x.textContent));
        return { text: sp.textContent, cut: sp.scrollWidth > sp.clientWidth + 0.5 };
      });
      if (hint.cut || !/cardio/.test(hint.text)) throw new Error(`${w}x${h}: the ADJUST hint is cut off: "${hint.text}"`);
    }
  } finally { await resizeTo(390, 844); }
}, /SHOW LESS/);
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
  const minute = async (v) => { const b = await slider().boundingBox(); return { x: b.x + 14 + (v - 5) / 55 * (b.width - 28), y: b.y + b.height / 2 }; };
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
await check('quick mission: GEAR, TIME and the open card are remembered; LEVEL and SURPRISE are not', async () => {
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
  // LEVEL is the athlete's own on every visit (a new athlete: EASY), so a pick, like a SURPRISE roll, does not come back.
  await adjust();
  if (await adjustSheet().getByRole('radio', { name: /^EASY/ }).getAttribute('aria-checked') !== 'true' || await adjustSheet().getByRole('radio', { name: 'HARD', exact: true }).getAttribute('aria-checked') === 'true') throw new Error('LEVEL came back as the pick or the SURPRISE roll, not as the athlete\'s own');
}, /EASY|YOUR LEVEL/);

// ── Quick Mission is for short notice, and starts at the athlete's level ─────
// TIME runs 5 to 60 by the minute and the card is built for the minutes asked
// (and follows the knob while it is held, saving only when it is let go); LEVEL
// opens on the athlete's own (level 1 EASY, level 5 MEDIUM, level 10 ADVANCED),
// marks it YOUR LEVEL in ADJUST, lets any be picked for the visit, and START
// stays above the tab bar with the slider and the four levels.
const minutesOnCard = async () => (await card().innerText()).match(/(\d+) MIN/)?.[1];
const bubbleText = () => page.locator('[data-qm-bubble]').innerText();
const tagLines = async () => (await card().innerText()).split('\n').map(l => l.trim());
const savedTime = () => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('tm_qm_keys_v1') || '{}').duration; } catch { return undefined; } });
// The Quick Mission page as an athlete with this much Fit XP (the page reads their level on open).
const quickAs = async (xp) => {
  await home();
  await page.evaluate((x) => localStorage.setItem('tm_user_stats', JSON.stringify({ xp: x, sessions: [{ id: 'lv1', type: 'Fit Mode', xpEarned: x, completedAt: new Date().toISOString(), completedCount: 1, totalCount: 1 }] })), xp);
  await page.goto(BASE, { waitUntil: 'networkidle' }); await S(2000);
  await page.mouse.click(195, 120); await S(1500);
  await page.locator('button[aria-label="Close"]').first().click({ force: true, timeout: 1500 }).catch(() => {});
  await btn(/REMIND ME NEXT WEEK|EXPLORE ON MY OWN/).click({ timeout: 1200 }).catch(() => {});
  await page.locator('button[aria-label="FIT MODE"]').click({ timeout: 5000 }); await S(1200);
  await page.locator('[data-guide="fit-quick"]').click({ timeout: 4000 }); await S(1200);
};
await check('quick mission: TIME runs 5 to 60 by the minute and the card is built for the minutes asked', async () => {
  await quick();
  if (await slider().getAttribute('min') !== '5' || await slider().getAttribute('max') !== '60' || await slider().getAttribute('step') !== '1') throw new Error('TIME is not a 5 to 60 slider in 1-minute steps');
  const ticks = await page.locator('[data-guide="qm-time"]').evaluate(el => [...el.querySelectorAll('span')].map(x => x.textContent.trim()).filter(t => /^\d+$/.test(t)));
  if (ticks.join() !== '5,10,15,20,30,45,60') throw new Error(`the marks are ${ticks.join()}`);
  const at20 = await card().locator('ol').innerText();
  await timeTo(8);
  if (await slider().getAttribute('aria-valuetext') !== '8 minutes' || await bubbleText() !== '8 MIN') throw new Error('the knob and the bubble do not read 8 minutes');
  if (await minutesOnCard() !== '8' || !(await tagLines()).includes('8 MIN')) throw new Error('the card does not read 8 MIN');
  if (await card().locator('ol').innerText() === at20) throw new Error('the moves did not change from 20 to 8 minutes');
  if (await savedTime() !== 8) throw new Error('a key press did not save the time');
  // The open card says how long it really takes, and it is the minutes asked, at every length.
  await expand();
  for (const m of [5, 8, 13, 20, 37, 60]) {
    await timeTo(m); await S(150);
    const c = await card().innerText();
    if (!new RegExp(`about ${m} min`).test(c)) throw new Error(`asked for ${m} minutes, the card says "${(c.match(/about \d+ min/) || ['nothing'])[0]}"`);
    const n = await card().locator('ol > li').count();
    if (n < 3 || (m === 5 && !/1 round\b/.test(c))) throw new Error(`${m} minutes deals ${n} moves, ${(c.match(/\d+ rounds?/) || ['no rounds'])[0]}`);
  }
  if (await page.locator('[data-guide="qm-expand"]').getAttribute('aria-expanded') !== 'true') throw new Error('SEE ALL did not keep its state as TIME moved');
  // The bubble stays on screen with the knob at either end.
  for (const m of [5, 60]) {
    await timeTo(m); await S(150);
    const b = await page.locator('[data-qm-bubble]').evaluate(e => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, w: window.innerWidth }; });
    if (b.l < 4 || b.r > b.w - 4) throw new Error(`at ${m} minutes the bubble runs from ${Math.round(b.l)} to ${Math.round(b.r)} on a ${b.w}px screen`);
  }
}, /60 MIN/);
await check('quick mission: the card follows the knob while it is held, saves only on release, and the layout does not jump', async () => {
  await quick();
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const at = async (v) => { const b = await slider().boundingBox(); return { x: b.x + 14 + (v - 5) / 55 * (b.width - 28), y: b.y + b.height / 2 }; };
  const probe = async () => ({ bubble: await bubbleText(), tag: await minutesOnCard(), h: (await card().boundingBox()).height, y: (await slider().boundingBox()).y, saved: await savedTime() });
  const rest = await probe();
  const from = await at(20), to = await at(47);
  await touch('touchStart', from.x, from.y);
  const seen = new Set();
  for (let i = 1; i <= 10; i++) {
    await touch('touchMove', from.x + (to.x - from.x) * i / 10, from.y); await S(50);
    const p = await probe(); seen.add(p.tag);
    if (`${p.tag} MIN` !== p.bubble) throw new Error(`held: the knob says ${p.bubble}, the card ${p.tag} MIN`);
    if (p.saved !== undefined) throw new Error('held: the time was saved before the knob was let go');
    if (Math.abs(p.h - rest.h) > 0.6 || Math.abs(p.y - rest.y) > 0.6) throw new Error(`held: the card is ${p.h}px tall (was ${rest.h}) and TIME moved ${p.y - rest.y}px`);
  }
  if (seen.size < 6) throw new Error(`the card showed only ${seen.size} different minutes while the knob moved`);
  const held = await probe();
  await touch('touchEnd'); await S(500);
  const after = await probe();
  if (after.saved !== Number(held.tag) || after.tag !== held.tag) throw new Error(`let go at ${held.tag} but saved ${after.saved} and the card says ${after.tag}`);
  if (Math.abs(after.h - rest.h) > 0.6) throw new Error('the card jumped when the knob was let go');
  // A second drag, back down: it saves where it is let go too.
  const c0 = await at(47), c1 = await at(12);
  await touch('touchStart', c0.x, c0.y);
  for (let i = 1; i <= 4; i++) { await touch('touchMove', c0.x + (c1.x - c0.x) * i / 4, c0.y); await S(40); }
  await touch('touchEnd'); await S(400);
  if (await savedTime() !== Number(await minutesOnCard())) throw new Error('the second drag did not save where it was let go');
  // With the card open the list holds its height while the knob is held, so TIME stays under the finger.
  await expand();
  await page.evaluate(() => { const sc = document.querySelector('[data-guide="qm-card"]').closest('.no-scrollbar'); sc.scrollTo({ top: sc.scrollHeight }); }); await S(400);
  const cur = Number(await slider().inputValue());
  const o0 = await at(cur), o1 = await at(cur < 30 ? 55 : 8);
  const y0 = (await slider().boundingBox()).y;
  await touch('touchStart', o0.x, o0.y);
  for (let i = 1; i <= 8; i++) {
    await touch('touchMove', o0.x + (o1.x - o0.x) * i / 8, o0.y); await S(50);
    if (Math.abs((await slider().boundingBox()).y - y0) > 0.6) throw new Error('open card: TIME moved under the finger as the list changed');
  }
  await touch('touchEnd'); await S(500);
  if (await page.locator('[data-guide="qm-expand"]').getAttribute('aria-expanded') !== 'true') throw new Error('the open card closed during a drag');
}, /MIN/);
await check('quick mission: level 1, 5 and 10 athletes open on EASY, MEDIUM and ADVANCED, ADJUST marks YOUR LEVEL, and a pick does not survive leaving the page', async () => {
  for (const [xp, word] of [[300, 'EASY'], [2200, 'MEDIUM'], [4600, 'ADVANCED']]) {
    await quickAs(xp);
    if (!(await tagLines()).includes(word)) throw new Error(`a ${word} athlete: the card does not open on ${word} (${(await tagLines()).slice(2, 6).join(' / ')})`);
    await adjust();
    const group = adjustSheet().getByRole('radiogroup', { name: 'Level' });
    const names = await group.getByRole('radio').evaluateAll(els => els.map(e => ({ label: e.textContent.trim(), on: e.getAttribute('aria-checked') === 'true', x: e.getBoundingClientRect().left + e.getBoundingClientRect().width / 2, h: e.getBoundingClientRect().height, cut: e.scrollWidth > e.clientWidth + 0.5 })));
    if (names.map(n => n.label).join() !== 'EASY,MEDIUM,HARD,ADVANCED') throw new Error(`LEVEL offers ${names.map(n => n.label).join()}`);
    if (names.filter(n => n.on).map(n => n.label).join() !== word || names.some(n => n.h < 43.5 || n.cut)) throw new Error(`LEVEL shows ${names.filter(n => n.on).map(n => n.label)} for a ${word} athlete (or a segment is short or cut)`);
    const marks = await adjustSheet().locator('[data-your-level]').evaluateAll(els => els.map(e => ({ t: e.textContent.trim(), x: e.getBoundingClientRect().left + e.getBoundingClientRect().width / 2 })));
    const own = names.find(n => n.label === word);
    if (marks.length !== 1 || marks[0].t !== 'YOUR LEVEL' || Math.abs(marks[0].x - own.x) > 4) throw new Error(`YOUR LEVEL is not marked once, under ${word}: ${JSON.stringify(marks)}`);
    // Any level can be picked; the card follows it.
    const pick = word === 'EASY' ? 'HARD' : 'EASY';
    await group.getByRole('radio', { name: pick, exact: true }).click({ timeout: 4000 }); await S(300);
    await done();
    if (!(await tagLines()).includes(pick)) throw new Error(`a ${pick} pick did not reach the card`);
    // Leaving the page drops it: the next visit is the athlete's own level again.
    await page.locator('button[aria-label="Back"]').click({ timeout: 3000 }); await S(800);
    await page.locator('[data-guide="fit-quick"]').click({ timeout: 4000 }); await S(1200);
    if (!(await tagLines()).includes(word)) throw new Error(`a ${pick} pick survived leaving the page for a ${word} athlete`);
    await adjust();
    if (await adjustSheet().getByRole('radiogroup', { name: 'Level' }).getByRole('radio', { name: pick, exact: true }).getAttribute('aria-checked') === 'true') throw new Error('ADJUST still shows the old pick');
  }
}, /MIN/);
await check('quick mission: SURPRISE never deals a level 1 athlete a HARD workout', async () => {
  await quickAs(300);
  for (let i = 0; i < 12; i++) {
    await page.locator('[data-guide="qm-surprise"]').click({ timeout: 3000 }); await S(120);
    const tag = (await tagLines()).filter(l => ['EASY', 'MEDIUM', 'HARD', 'ADVANCED'].includes(l)).join();
    if (tag !== 'EASY' && tag !== 'MEDIUM') throw new Error(`SURPRISE dealt ${tag} to a level 1 athlete`);
  }
}, /MIN/);
await check('quick mission: START stays above the tab bar at 412x811, 360x740 and 375x667 with the slider and the four levels', async () => {
  await quickAs(4600); // ADVANCED: the longest word on the level strip
  try {
    for (const [w, h] of [[412, 811], [360, 740], [375, 667]]) {
      await resizeTo(w, h);
      const g = await page.evaluate(() => {
        const r = (e) => e.getBoundingClientRect();
        const start = [...document.querySelectorAll('button')].find(b => /^START$/.test(b.textContent.trim()));
        const ticks = [...document.querySelectorAll('[data-guide="qm-time"] span')].filter(x => /^\d+$/.test(x.textContent.trim())).map(x => r(x));
        const bub = r(document.querySelector('[data-qm-bubble]'));
        return { nav: r(document.querySelector('[data-guide="nav-tabs"]')).top, start: r(start), input: r(document.querySelector('[data-guide="qm-time"] input')), ticks, bub, vw: window.innerWidth };
      });
      const at = `${w}x${h}`;
      if (g.start.bottom > g.nav || g.start.height < 43.5) throw new Error(`${at}: START ends at ${Math.round(g.start.bottom)}, the tab bar starts at ${Math.round(g.nav)}`);
      if (g.input.height < 43.5) throw new Error(`${at}: the TIME slider is ${g.input.height}px tall`);
      if (g.ticks.length !== 7 || g.ticks.some((t, i) => i && t.left < g.ticks[i - 1].right + 2) || g.ticks[0].left < 0 || g.ticks[6].right > g.vw) throw new Error(`${at}: the TIME marks overlap or leave the screen`);
      if (g.bub.left < 0 || g.bub.right > g.vw) throw new Error(`${at}: the bubble leaves the screen`);
      await adjust();
      const sheet = await adjustSheet().evaluate((el) => {
        const r = (e) => e.getBoundingClientRect();
        const segs = [...el.querySelectorAll('[role="radiogroup"][aria-label="Level"] [role="radio"]')].map(b => ({ h: r(b).height, cut: b.scrollWidth > b.clientWidth + 0.5, l: r(b).left, rr: r(b).right }));
        const mark = el.querySelector('[data-your-level]');
        const doneB = [...el.querySelectorAll('button')].find(b => /DONE/.test(b.textContent));
        return { segs, mark: r(mark), panel: r(el.querySelector('[role="dialog"]') || el), done: r(doneB) };
      });
      if (sheet.segs.length !== 4 || sheet.segs.some(s => s.h < 43.5 || s.cut)) throw new Error(`${at}: the four-level strip is short or cut off ${JSON.stringify(sheet.segs)}`);
      if (sheet.mark.left < sheet.panel.left || sheet.mark.right > sheet.panel.right) throw new Error(`${at}: YOUR LEVEL leaves the sheet`);
      if (sheet.done.bottom > g.nav + 0.5 || sheet.done.height < 43.5) throw new Error(`${at}: DONE ends at ${Math.round(sheet.done.bottom)}, under the tab bar at ${Math.round(g.nav)}`);
      await done();
      // Fold the card again: the next size is measured closed, as the page opens.
      if (await page.locator('[data-guide="qm-expand"]').getAttribute('aria-expanded') === 'true') { await page.locator('[data-guide="qm-expand"]').click({ timeout: 4000 }); await S(400); }
    }
  } finally { await resizeTo(390, 844); }
}, /MIN/);
// TIME on a touch screen, the small cases: a swipe that starts ON the knob is a
// scroll (it must not drop a library mission from the card), a tap a few minutes
// from the knob is a nudge that jumps there (it used to count as a grab and do
// nothing), and a second finger on the band never takes the drag over, so the
// bubble, the card and what is saved agree once every finger is up.
await check('quick mission: a swipe that starts on the knob stays a scroll, a tap 3 minutes away jumps, and a second finger does not break the drag', async () => {
  await quick(); await putOnCard(V2_PUBLIC ? /^ONE-BELL 300/ : /^HALF MURPH/);
  const picked = await card().locator('h1').innerText();
  const cdp = await page.context().newCDPSession(page);
  const send = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([id, x, y]) => ({ x, y, id, radiusX: 4, radiusY: 4, force: 1 })) });
  const b = await slider().boundingBox();
  const y = b.y + b.height / 2, X = (v) => b.x + 14 + (v - 5) / 55 * (b.width - 28);
  // A swipe straight up from the knob (minute 20): nothing changes, the library mission stays, nothing is saved.
  await send('touchStart', [[1, X(20), y]]);
  for (let i = 1; i <= 10; i++) { await send('touchMove', [[1, X(20), y - 16 * i]]); await S(16); }
  await send('touchEnd', []); await S(500);
  if (await slider().inputValue() !== '20' || (await savedTime()) !== undefined) throw new Error('a swipe up from the knob changed or saved the time');
  if (await card().locator('h1').innerText() !== picked) throw new Error('a swipe up from the knob dropped the library mission');
  // A tap 3 minutes from the knob jumps there and brings today's mission back.
  await send('touchStart', [[1, X(23), y]]); await send('touchEnd', []); await S(500);
  if (await slider().inputValue() !== '23' || (await savedTime()) !== 23) throw new Error(`a tap on the 23 mark left TIME at ${await slider().inputValue()}, saved ${await savedTime()}`);
  if (await card().locator('h1').innerText() === picked) throw new Error('a tap on TIME kept the library mission');
  // A tap on the knob itself keeps its minute.
  await send('touchStart', [[1, X(23) + 3, y]]); await send('touchEnd', []); await S(500);
  if (await slider().inputValue() !== '23') throw new Error('a tap on the knob moved it');
  // Drag, add a second finger, lift the first, lift all: the bubble, the card and the saved minute agree, and the next key moves on from there.
  await send('touchStart', [[1, X(23), y]]);
  for (let i = 1; i <= 6; i++) { await send('touchMove', [[1, X(23) + (X(40) - X(23)) * i / 6, y]]); await S(20); }
  await send('touchStart', [[1, X(40), y], [2, X(10), y]]); await S(50);
  await send('touchMove', [[1, X(40), y], [2, X(12), y]]); await S(50);
  await send('touchEnd', [[2, X(12), y]]); await S(50);
  await send('touchEnd', []); await S(500);
  const v = await slider().inputValue();
  if (await bubbleText() !== `${v} MIN` || await minutesOnCard() !== v || (await savedTime()) !== Number(v)) throw new Error(`after two fingers the knob says ${await bubbleText()}, the card ${await minutesOnCard()}, saved ${await savedTime()}, TIME ${v}`);
  await slider().focus(); await page.keyboard.press('ArrowRight'); await S(300);
  if (await slider().inputValue() !== String(Number(v) + 1) || await bubbleText() !== `${Number(v) + 1} MIN`) throw new Error(`the next arrow key went to ${await slider().inputValue()}, the bubble says ${await bubbleText()}`);
}, /MIN/);
// At 360x740 the closed card's four tags (20 MIN, ADVANCED, FULL BODY, WEIGHTED) stay on one line
// and the first page does not scroll; with the card open WEIGHTED says its rest.
await check('quick mission: at 360x740 ADVANCED with WEIGHTED gear keeps the tag row on one line and the page does not scroll; the open card says the rest', async () => {
  await quickAs(4600);
  try {
    await resizeTo(360, 740);
    await gearKey('WEIGHTED').click({ timeout: 4000 }); await S(500);
    const g = await page.evaluate(() => {
      const row = document.querySelector('.qm-tags');
      const sc = document.querySelector('[data-guide="qm-card"]').closest('.no-scrollbar');
      return { tagH: row.getBoundingClientRect().height, sh: sc.scrollHeight, ch: sc.clientHeight, tags: [...row.children].map(c => c.textContent.trim()) };
    });
    if (g.tagH > 30) throw new Error(`the tag row is ${Math.round(g.tagH)}px tall (it wraps): ${g.tags.join(' / ')}`);
    if (g.sh > g.ch + 1) throw new Error(`the first page scrolls (${g.sh} on ${g.ch})`);
    await expand();
    if (!/about \d+ min · \d+ s rest\. Pick a safe weight/.test(await card().innerText())) throw new Error(`the open WEIGHTED card does not say its rest: ${(await card().innerText()).replace(/\n/g, ' / ').slice(0, 200)}`);
  } finally { await resizeTo(390, 844); }
}, /ADVANCED/);
// The Fit hub's Today's Mission starts on the athlete's level (a level 1 athlete
// EASY, a level 10 athlete ADVANCED); only a recovery pick stays EASY.
await check('fit hub: Today\'s Mission starts on the athlete\'s level, and a recovery pick stays EASY', async () => {
  const hubLine = async (stats) => {
    await home();
    await page.evaluate((v) => localStorage.setItem('tm_user_stats', JSON.stringify(v)), stats);
    await page.goto(BASE, { waitUntil: 'networkidle' }); await S(2000);
    await page.mouse.click(195, 120); await S(1500);
    await page.locator('button[aria-label="Close"]').first().click({ force: true, timeout: 1500 }).catch(() => {});
    await btn(/REMIND ME NEXT WEEK|EXPLORE ON MY OWN/).click({ timeout: 1200 }).catch(() => {});
    await page.locator('button[aria-label="FIT MODE"]').click({ timeout: 5000 }); await S(1500);
    return page.locator('[data-guide="fit-today"]').innerText();
  };
  const row = (type, xp) => ({ xp, sessions: [{ id: 'h1', type, xpEarned: xp, completedAt: new Date().toISOString(), completedCount: 1, totalCount: 1 }] });
  const l10 = await hubLine(row('Cardio', 4600));
  if (!/12 min · Advanced · Full Body/.test(l10)) throw new Error(`a level 10 athlete's card reads: ${l10.replace(/\n/g, ' / ')}`);
  const l1 = await hubLine(row('Cardio', 300));
  if (!/12 min · Easy · Full Body/.test(l1)) throw new Error(`a level 1 athlete's card reads: ${l1.replace(/\n/g, ' / ')}`);
  const rec = await hubLine(row('Fit Mode', 4600));
  if (!/Recovery/i.test(rec) || !/10 min · Easy · Full Body/.test(rec)) throw new Error(`a recovery pick reads: ${rec.replace(/\n/g, ' / ')}`);
}, /./);
// A loaded set ends on DONE, at the athlete's own pace, and the run still lands on the minutes on the card:
// DONE early and the rest after the set is longer, DONE late and it is shorter. A 10 minute WEIGHTED mission
// on a fake clock, DONE tapped a quick or a slow time after each set begins, finishes within 30 s of 10 minutes.
for (const [name, tapSec] of [['quick', 28], ['slow', 62]]) {
  await check(`quick mission: a ${name} lifter (DONE ${tapSec} s into every set) still finishes a 10 minute weighted mission on time (fake clock)`, async () => {
    const ctx3 = await browser.newContext({ viewport: { width: 412, height: 811 }, isMobile: true, hasTouch: true });
    await ctx3.addInitScript(seedStorage);
    await ctx3.addInitScript(() => {
      try { Object.defineProperty(window, 'speechSynthesis', { value: undefined }); } catch {}
      if (localStorage.getItem('__qmw')) return;
      localStorage.setItem('tm_qm_keys_v1', JSON.stringify({ workoutType: 'Weighted', duration: 10, focus: 'FULL BODY' }));
      localStorage.setItem('tm_user_stats', JSON.stringify({ xp: 3000, sessions: [{ id: 'w1', type: 'Fit Mode', xpEarned: 3000, completedAt: new Date().toISOString(), completedCount: 1, totalCount: 1 }] }));
      localStorage.setItem('tm_qm_shelf_v1', JSON.stringify({ mode: 'guided' }));
      localStorage.setItem('__qmw', '1');
    });
    const p3 = await ctx3.newPage();
    try {
      await p3.clock.install({ time: Date.now() });
      await p3.goto(BASE + '?__reset=1', { waitUntil: 'networkidle' }); await p3.waitForTimeout(2000);
      await p3.mouse.click(206, 120); await p3.waitForTimeout(1800);
      await p3.locator('button[aria-label="Close"]').first().click({ force: true, timeout: 1500 }).catch(() => {});
      await p3.locator('button[aria-label="FIT MODE"]').click({ timeout: 5000 }); await p3.waitForTimeout(1200);
      await p3.locator('[data-guide="fit-quick"]').click({ timeout: 4000 }); await p3.waitForTimeout(1500);
      const c = await p3.locator('[data-guide="qm-card"]').innerText();
      if (!/10 MIN/.test(c) || !/WEIGHTED/.test(c)) throw new Error(`the card is not a 10 minute weighted mission: ${c.replace(/\n/g, ' / ').slice(0, 120)}`);
      const now = () => p3.evaluate(() => Date.now());
      await p3.clock.pauseAt((await now()) + 500);
      const t0 = await now();
      await p3.getByRole('button', { name: /^START$/ }).first().click({ timeout: 4000 });
      let finishAt = null, since = null, taps = 0;
      for (let i = 0; i < 1500 && finishAt === null; i++) {
        await p3.clock.runFor(1000);
        const info = await p3.evaluate(() => ({ t: document.body.innerText, now: Date.now(), done: [...document.querySelectorAll('button')].some(x => x.innerText.trim() === 'DONE' && x.offsetParent !== null) }));
        if (/SESSION COMPLETE|GOOD WORK/.test(info.t)) { finishAt = info.now - 1800; break; } // the finish bell rings 1.8 s before the result
        if (!info.done) { since = null; continue; }
        if (since === null) since = info.now;
        else if (info.now - since >= tapSec * 1000) { await p3.getByRole('button', { name: /^DONE$/ }).first().click({ timeout: 2000 }); taps += 1; since = null; }
      }
      if (finishAt === null) throw new Error('the mission did not finish inside 25 minutes of fake time');
      const took = (finishAt - t0) / 1000;
      if (taps < 4 || Math.abs(took - 600) > 30) throw new Error(`a ${name} lifter (${taps} sets) took ${Math.round(took)} s for a 10 minute mission (within 30 s of 600)`);
    } finally { await ctx3.close(); }
  }, /./);
}
// The real guided run, on a fake clock: a 5 minute mission has to run 5 minutes
// (within 30 seconds), start to its last set. The browser has no speech, so the
// coach's lines take no time and this is the timers alone; the minutes asked
// are what the card promises. (scripts/measure-qm-timeline.mjs runs the whole
// grid of lengths, gear and levels against the generator's model.)
await check('quick mission: a 5 minute guided mission really runs 5 minutes (fake clock)', async () => {
  const ctx3 = await browser.newContext({ viewport: { width: 412, height: 811 }, isMobile: true, hasTouch: true });
  await ctx3.addInitScript(seedStorage);
  await ctx3.addInitScript(() => {
    try { Object.defineProperty(window, 'speechSynthesis', { value: undefined }); } catch {}
    if (localStorage.getItem('__qm5')) return;
    localStorage.setItem('tm_qm_keys_v1', JSON.stringify({ workoutType: 'Bodyweight', difficulty: 'NORMAL', duration: 5, focus: 'FULL BODY' }));
    localStorage.setItem('tm_qm_shelf_v1', JSON.stringify({ mode: 'guided' }));
    localStorage.setItem('__qm5', '1');
  });
  const p3 = await ctx3.newPage();
  try {
    await p3.clock.install({ time: Date.now() });
    await p3.goto(BASE + '?__reset=1', { waitUntil: 'networkidle' }); await p3.waitForTimeout(2000);
    await p3.mouse.click(206, 120); await p3.waitForTimeout(1800);
    await p3.locator('button[aria-label="Close"]').first().click({ force: true, timeout: 1500 }).catch(() => {});
    await p3.locator('button[aria-label="FIT MODE"]').click({ timeout: 5000 }); await p3.waitForTimeout(1200);
    await p3.locator('[data-guide="fit-quick"]').click({ timeout: 4000 }); await p3.waitForTimeout(1500);
    if (!/5 MIN/.test(await p3.locator('[data-guide="qm-card"]').innerText())) throw new Error('the card is not a 5 minute mission');
    const now = () => p3.evaluate(() => Date.now());
    await p3.clock.pauseAt((await now()) + 500);
    const t0 = await now();
    await p3.getByRole('button', { name: /^START$/ }).first().click({ timeout: 4000 });
    let finishAt = null;
    for (let i = 0; i < 600 && finishAt === null; i++) {
      await p3.clock.runFor(1000);
      const info = await p3.evaluate(() => ({ t: document.body.innerText, now: Date.now() }));
      if (/SESSION COMPLETE|GOOD WORK/.test(info.t)) finishAt = info.now - 1800; // the finish bell rings 1.8 s before the result
    }
    if (finishAt === null) throw new Error('the 5 minute mission did not finish inside 10 minutes of fake time');
    const took = (finishAt - t0) / 1000;
    if (Math.abs(took - 300) > 30) throw new Error(`a 5 minute mission took ${Math.round(took)} s, not 300 (within 30)`);
  } finally { await ctx3.close(); }
}, /./);
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
  await adjustSheet().getByRole('radiogroup', { name: 'Run mode' }).getByRole('radio', { name: 'AT YOUR PACE', exact: true }).click({ timeout: 4000 }); await S(300);
  await done();
  await btn(/^START$/).click({ timeout: 4000 }); await S(7000);
  if (!/STOP/.test(await text())) throw new Error('no STOP on the SOLO screen');
}, /AT YOUR PACE/);
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
  await adjustSheet().getByRole('radiogroup', { name: 'Run mode' }).getByRole('radio', { name: 'AT YOUR PACE', exact: true }).click({ timeout: 4000 }); await S(300);
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
  await adjustSheet().getByRole('radiogroup', { name: 'Run mode' }).getByRole('radio', { name: 'AT YOUR PACE', exact: true }).click({ timeout: 4000 }); await S(300);
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
  await adjustSheet().getByRole('radiogroup', { name: 'Run mode' }).getByRole('radio', { name: 'AT YOUR PACE', exact: true }).click({ timeout: 4000 }); await S(300);
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
  await adjustSheet().getByRole('radiogroup', { name: 'Run mode' }).getByRole('radio', { name: 'AT YOUR PACE', exact: true }).click({ timeout: 4000 }); await S(300);
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
}, /Complex · Standard/);
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
  await adjustSheet().getByRole('radiogroup', { name: 'Run mode' }).getByRole('radio', { name: 'AT YOUR PACE', exact: true }).click({ timeout: 4000 }); await S(300);
  await done();
  await btn(/^START$/).click({ timeout: 4000 }); await S(7000);
  let t = await text();
  if (!/OVERTIME 20/.test(t) || !/AMRAP 20/.test(t) || !/ROUND 1/.test(t) || !(await btn(/^ROUND$/).isVisible())) throw new Error('no ROUND button on the SOLO screen');
  await btn(/^ROUND$/).click({ timeout: 4000 }); await S(400);
  t = await text();
  if (!/ROUND 2/.test(t) || !/R1 0:0\d/.test(t) || !/ROUNDS 1/.test(t)) throw new Error('ROUND did not take a split');
}, /AT YOUR PACE/);
// A SOLO-only library mission starts SOLO from the sheet's own START, whatever
// the remembered run mode (GUIDED on a clean slate).
await check('quick mission: library BARBELL → HONOR ROUNDS starts SOLO', async () => {
  await ownerQuick(); await library();
  await sheet().getByRole('radiogroup', { name: 'Loadout' }).getByRole('radio', { name: /^BARBELL/ }).click({ timeout: 4000 }); await S(400);
  if (await sheet().getByRole('radio', { name: /^IRON CLOCK 16/ }).count() !== 1 || await sheet().getByRole('radio', { name: /^BEST OF 3/ }).count()) throw new Error('BARBELL did not filter the list');
  await sheet().getByRole('radio', { name: /^HONOR ROUNDS YOUR PACE ONLY$/ }).click({ timeout: 4000 }); await S(300);
  if (!/HONOR ROUNDS/.test(await sheet().locator('[aria-live="polite"]').innerText())) throw new Error('HONOR ROUNDS is not on top');
  await sheet().getByRole('button', { name: /^START$/ }).click({ timeout: 4000 }); await S(7000);
  const t = await text();
  if (!/HONOR ROUNDS/.test(t) || !/FINISH/.test(t) || !/STOP/.test(t) || !/CAP 20:00/.test(t)) throw new Error('not the SOLO screen for HONOR ROUNDS');
}, /AT YOUR PACE/);
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
// Build Workout part-way through, without lifting every set: generate one,
// take the live snapshot App keeps for the boot restore, mark all but `left`
// rows done (the open ones trimmed to one set of one rep, so a check can
// finish one for real in seconds), and reload. The app comes straight back
// into the list, the way it does after the OS kills it mid-session. With
// `chain` the open rows are one superset (one round: their single set).
// `activeIdx` is the row the snapshot was on ('last' for the last row);
// `list: false` when the app is not expected to come back to the list.
const builderAt = async (left, { chain = false, activeIdx = null, list = true } = {}) => {
  await fit(); await page.locator('[data-guide="fit-builder"]').click(); await S(1200);
  await btn(/GENERATE WORKOUT/).click({ timeout: 4000 }); await S(2000);
  const slots = JSON.parse(await page.evaluate(() => localStorage.getItem('trainingModePausedSession')) || '[]');
  const snap = slots.find((x) => x.screen === 'fit_workout');
  const st = snap?.internalState;
  if (!st?.exercises?.length) throw new Error('no live Build Workout snapshot to seed');
  const total = st.exercises.length;
  const done = total - left;
  st.exercises.forEach((r, i) => {
    delete r._chain;
    if (i < done) st.completed[r._uid] = true;
    else Object.assign(r, { sets: 1, reps: '1', equipment: 'Bodyweight' }, chain ? { _chain: 'c1' } : null);
  });
  Object.assign(st, { skipped: {}, chainRounds: {}, activeIdx: activeIdx === 'last' ? total - 1 : activeIdx });
  Object.assign(snap, { reason: 'lifecycle', timestamp: Date.now() });
  await page.evaluate((v) => sessionStorage.setItem('__smoke_seed', v), JSON.stringify([snap]));
  await page.goto(BASE, { waitUntil: 'networkidle' }); await S(2500);
  if (list && !(await text()).includes(`${done}/${total} exercises`)) throw new Error(`the seeded list does not read ${done}/${total}`);
  return { total, done };
};
const finishDialog = () => page.getByRole('alertdialog', { name: 'Finish workout' });
// What the finish banked: exactly one Fit Mode row, with this XP.
const bankedOnce = async (xp) => {
  const stats = JSON.parse(await page.evaluate(() => localStorage.getItem('tm_user_stats')) || '{}');
  const fits = (stats.sessions || []).filter((s) => s.type === 'Fit Mode');
  if (fits.length !== 1 || fits[0].xpEarned !== xp || stats.xp !== xp) throw new Error(`banked ${JSON.stringify(fits.map((s) => s.xpEarned))} (total ${stats.xp}), not ${xp} once`);
};
// The owner's report: 6 of 8 done, two left open, and START was the only way
// on. FINISH WORKOUT under it asks first (KEEP GOING stays on the list);
// FINISH goes to the SESSION ENDED summary with n/total, banking 15 per
// exercise done and no +30, once.
await check('build workout: FINISH WORKOUT with rows left ends to the summary', async () => {
  const { total, done } = await builderAt(2);
  if (!await btn(/^START$/).isVisible()) throw new Error('START is not on the list');
  await btn(/^FINISH WORKOUT$/).click({ timeout: 4000 }); await S(400);
  const d = await finishDialog().innerText();
  if (!d.includes(`Finish with ${done} of ${total} done?`) || !d.includes("The 2 left won't count.")) throw new Error(`the confirm reads "${d.replace(/\n+/g, ' / ')}"`);
  await finishDialog().getByRole('button', { name: 'KEEP GOING' }).click({ timeout: 4000 }); await S(400);
  if (await finishDialog().count() || !(await text()).includes(`${done}/${total} exercises`)) throw new Error('KEEP GOING did not stay on the list');
  await btn(/^FINISH WORKOUT$/).click({ timeout: 4000 }); await S(400);
  await finishDialog().getByRole('button', { name: /^FINISH$/ }).click({ timeout: 4000 }); await S(3000);
  const t = await text();
  if (!/SESSION ENDED/.test(t) || !t.includes(`${done}/${total}`) || !t.includes(`+${done * 15}`)) throw new Error(`not the SESSION ENDED summary with ${done}/${total} and +${done * 15}`);
  await bankedOnce(done * 15);
}, /SESSION ENDED/);
// The last open exercise finishing goes straight to the summary after the
// done toast. It used to drop back on the list, where only COMPLETE WORKOUT
// reached the summary. The same for a superset that is the last of it.
const lastOneToSummary = async (left, opts) => {
  const { total } = await builderAt(left, opts);
  await btn(/^START$/).click({ timeout: 4000 });
  for (let i = 0; i < 60; i += 1) {
    await S(500);
    const t = await text();
    if (/COMPLETE WORKOUT/.test(t)) throw new Error('landed back on the list');
    if (/WORKOUT COMPLETE/.test(t)) break;
  }
  await S(1500);
  const t = await text();
  if (!/WORKOUT COMPLETE/.test(t) || !t.includes(`${total}/${total}`) || !t.includes(`+${total * 15 + 30}`)) throw new Error(`not the WORKOUT COMPLETE summary with ${total}/${total} and +${total * 15 + 30}`);
  await bankedOnce(total * 15 + 30);
};
await check('build workout: the last exercise done goes straight to the summary', () => lastOneToSummary(1), /WORKOUT COMPLETE/);
await check('build workout: the last superset done goes straight to the summary', () => lastOneToSummary(2, { chain: true }), /WORKOUT COMPLETE/);
// The map that slides up after an exercise, with the next one glowing, can
// end the session too: FINISH WORKOUT, the same confirm (KEEP GOING leaves
// the glow up), then the summary.
await check('build workout: FINISH WORKOUT on the completion map', async () => {
  const { total, done } = await builderAt(2);
  await btn(/^START$/).click({ timeout: 4000 });
  const glowStart = page.locator('button[aria-label^="Start "]').first();
  await glowStart.waitFor({ timeout: 30000 }).catch(() => { throw new Error('the completion map never slid up'); });
  await btn(/^FINISH WORKOUT$/).click({ timeout: 4000 }); await S(400);
  const d = await finishDialog().innerText();
  if (!d.includes(`Finish with ${done + 1} of ${total} done?`) || !d.includes("The 1 left won't count.")) throw new Error(`the confirm reads "${d.replace(/\n+/g, ' / ')}"`);
  await finishDialog().getByRole('button', { name: 'KEEP GOING' }).click({ timeout: 4000 }); await S(400);
  if (await finishDialog().count() || !await glowStart.isVisible()) throw new Error('KEEP GOING did not leave the map with the next one glowing');
  await btn(/^FINISH WORKOUT$/).click({ timeout: 4000 }); await S(400);
  await finishDialog().getByRole('button', { name: /^FINISH$/ }).click({ timeout: 4000 }); await S(3000);
  const t = await text();
  if (!/SESSION ENDED/.test(t) || !t.includes(`${done + 1}/${total}`) || !t.includes(`+${(done + 1) * 15}`)) throw new Error(`not the SESSION ENDED summary with ${done + 1}/${total}`);
  await bankedOnce((done + 1) * 15);
}, /SESSION ENDED/);
// Two quick taps, the way a thumb does it. FINISH swaps in the summary at
// once, and its RETURN HOME sits right under the confirm's FINISH: the second
// tap used to land there and skip the summary. On FINISH WORKOUT the second
// tap used to land on the confirm's backdrop and close it again.
const tapTwice = async (loc) => {
  const b = await loc.boundingBox();
  if (!b) throw new Error('nothing to tap');
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  await page.touchscreen.tap(x, y); await S(150); await page.touchscreen.tap(x, y);
};
await check('build workout: double taps on FINISH WORKOUT and FINISH still end on the summary', async () => {
  const { total, done } = await builderAt(2);
  await tapTwice(btn(/^FINISH WORKOUT$/)); await S(500);
  if (!await finishDialog().count()) throw new Error('a double tap on FINISH WORKOUT closed its own confirm');
  await tapTwice(finishDialog().getByRole('button', { name: /^FINISH$/ })); await S(2500);
  const t = await text();
  if (!/SESSION ENDED/.test(t) || !t.includes(`${done}/${total}`)) throw new Error('the second tap on FINISH left the summary');
  await bankedOnce(done * 15);
}, /SESSION ENDED/);
// A list scrolled down to reach FINISH WORKOUT hands its scroll container to
// the summary unless the summary mounts its own: it opened with its top cut
// off. A short phone, so the list has to scroll.
await check('build workout: the summary opens at its top after a scrolled list', async () => {
  await page.setViewportSize({ width: 390, height: 640 });
  try {
    const { total, done } = await builderAt(2);
    const fin = btn(/^FINISH WORKOUT$/);
    // The athlete scrolls the list right down, past the button.
    const listTop = await fin.evaluate((b) => {
      let el = b.parentElement;
      while (el && !(el.scrollHeight > el.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(el).overflowY))) el = el.parentElement;
      if (!el) return 0;
      el.scrollTop = el.scrollHeight;
      return el.scrollTop;
    });
    if (!listTop) throw new Error('the list did not scroll at 390x640');
    await fin.click({ timeout: 4000 }); await S(400);
    await finishDialog().getByRole('button', { name: /^FINISH$/ }).click({ timeout: 4000 }); await S(2500);
    const t = await text();
    if (!/SESSION ENDED/.test(t) || !t.includes(`${done}/${total}`)) throw new Error('not the SESSION ENDED summary');
    const off = await page.getByText('SESSION ENDED').first().evaluate((e) => {
      let n = 0;
      for (let el = e; el; el = el.parentElement) n += el.scrollTop || 0;
      return n;
    });
    if (off) throw new Error(`the summary opened ${off}px down`);
  } finally { await page.setViewportSize({ width: 390, height: 844 }); }
}, /SESSION ENDED/);
// The completion map on a short phone: the FINISH WORKOUT footer takes room
// from its list, and the glowing next exercise (the last row here) used to
// open hidden under it. Then Back during the map's 3-2-1: the start it was
// counting into used to fire anyway, a second later, pulling the athlete off
// the list and its open FINISH confirm into that exercise.
await check('build workout: the completion map shows the glow; Back in its count-in stays on the list', async () => {
  const { total, done } = await builderAt(2);
  await btn(/^START$/).click({ timeout: 4000 });
  await page.setViewportSize({ width: 360, height: 480 });
  try {
    const glowStart = page.locator('button[aria-label^="Start "]').first();
    await glowStart.waitFor({ timeout: 30000 }).catch(() => { throw new Error('the completion map never slid up'); });
    await S(500);
    const seen = await glowStart.evaluate((b) => {
      const r = b.getBoundingClientRect();
      const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!e && b.contains(e);
    });
    if (!seen) throw new Error('the glowing next exercise is hidden on the completion map');
  } finally { await page.setViewportSize({ width: 390, height: 844 }); }
  await S(400);
  await page.locator('button[aria-label="Close map"]').click({ timeout: 3000 }); await S(250);
  await page.locator('button[aria-label="Back"]').first().click({ timeout: 3000 }); await S(400);
  await btn(/^FINISH WORKOUT$/).click({ timeout: 4000 }); await S(2800);
  const t = await text();
  if (!await finishDialog().count() || t.includes(`Exercise ${total} of ${total}`)) throw new Error('the count-in started the next exercise after Back');
  if (!t.includes(`${done + 1}/${total} exercises`)) throw new Error('not on the list after Back');
  await finishDialog().getByRole('button', { name: 'KEEP GOING' }).click({ timeout: 4000 }); await S(300);
}, /exercises ·/);
// Killed in the done toast's beat after the last move: the session comes
// back with every row done, and goes to the summary, not to the list that
// only offers COMPLETE WORKOUT.
await check('build workout: a session back with every row done opens the summary', async () => {
  const { total } = await builderAt(0, { activeIdx: 'last', list: false });
  await S(1500);
  const t = await text();
  if (/COMPLETE WORKOUT/.test(t)) throw new Error('came back to the list');
  if (!/WORKOUT COMPLETE/.test(t) || !t.includes(`${total}/${total}`) || !t.includes(`+${total * 15 + 30}`)) throw new Error(`not the WORKOUT COMPLETE summary with ${total}/${total}`);
  await bankedOnce(total * 15 + 30);
}, /WORKOUT COMPLETE/);
// A finish that throws (the stats write on a full storage) on the automatic
// path used to take the app down to the crash screen, and left every finish
// button dead. Now it lands on the list, and COMPLETE WORKOUT tries again.
await check('build workout: a finish that fails stays on the list and can be retried', async () => {
  const { total } = await builderAt(1);
  await page.evaluate(() => {
    window.__failStats = true;
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k === 'tm_user_stats' && window.__failStats) throw new DOMException('quota', 'QuotaExceededError');
      return set.call(this, k, v);
    };
  });
  await btn(/^START$/).click({ timeout: 4000 });
  for (let i = 0; i < 60; i += 1) {
    await S(500);
    const t = await text();
    if (/Training Mode runtime error/.test(t)) throw new Error('the failed finish crashed the app');
    if (/WORKOUT COMPLETE/.test(t)) throw new Error('reached the summary with the stats write failing');
    if (/COMPLETE WORKOUT/.test(t)) break;
  }
  if (!await btn(/COMPLETE WORKOUT/).isVisible()) throw new Error('not back on the list with COMPLETE WORKOUT');
  await page.evaluate(() => { window.__failStats = false; });
  await btn(/COMPLETE WORKOUT/).click({ timeout: 4000 }); await S(2500);
  const t = await text();
  if (!/WORKOUT COMPLETE/.test(t) || !t.includes(`${total}/${total}`)) throw new Error('COMPLETE WORKOUT did not retry the finish');
  await bankedOnce(total * 15 + 30);
}, /WORKOUT COMPLETE/);
await check('programs', async () => { await fit(); await page.locator('[data-guide="fit-programs"]').click(); await S(1500); }, /PROGRAM/i);
await check('cardio setup', async () => { await fit(); await page.locator('[data-guide="fit-cardio"]').click(); await S(1800); }, /START/);
await check('cardio GPS run start', async () => { await btn(/START RUN|^START$/).click({ timeout: 4000 }); for (let i = 0; i < 25; i++) { await S(1000); if (/ELAPSED|LOCKING GPS/.test(await text())) break; } }, /GPS LIVE|GPS ACQUIRING|LOCKING GPS|ELAPSED/);
await check('just train start', async () => { await fight(); await page.locator('.fb', { hasText: 'JUST TRAIN' }).first().click(); await S(1200); await btn(/START/).click({ timeout: 4000 }); await S(4000); }, /ROUND|WARM/i);
await check('fight focus start', async () => { await fight(); await page.locator('.fb', { hasText: 'FIGHT FOCUS' }).first().click(); await S(1200); await btn(/START SESSION/).click({ timeout: 4000 }); await S(4000); }, /ROUND|WARM/i);
await check('combo coach start', async () => { await fight(); await page.locator('.fb', { hasText: 'COMBO COACH' }).first().click(); await S(1200); await btn(/START COMBOS/).click({ timeout: 4000 }); await S(4000); }, /ROUND|WARM/i);

// ── Shared by the Combo Coach and Level page checks: seeded athletes and the Profile › Level page walk ──
// Seeded athletes: the stats go in after boot() wiped storage and before the
// next load, so the app boots with them. Every session is dated past the combo
// engine's 60-day replay window (so Home grants no streak-milestone XP and the
// numbers stay exactly what was seeded), except the `recent` ones, which sit
// on today and yesterday for a 2-day streak.
const seedStats = (spec, xp, recent = 0) => {
  const sessions = []; let n = 0;
  for (const [type, count, each] of spec) for (let k = 0; k < count; k += 1) sessions.push({ id: `seed${n++}`, type, xpEarned: each, completedCount: 1, totalCount: 1 });
  sessions.forEach((row, i) => {
    const fromEnd = sessions.length - 1 - i;
    const d = new Date(); d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - (fromEnd < recent ? fromEnd : 65 + (fromEnd % 30)));
    row.completedAt = d.toISOString();
  });
  return { xp, sessions };
};
const profileFor = async (stats) => {
  await home();
  await page.evaluate((v) => localStorage.setItem('tm_user_stats', JSON.stringify(v)), stats);
  await page.goto(BASE, { waitUntil: 'networkidle' }); await S(2000);
  await page.mouse.click(195, 120); await S(1500);
  await page.locator('button[aria-label="Close"]').first().click({ force: true, timeout: 1500 }).catch(() => {});
  // Many sessions and no Practice yet: Home offers the Practice invite first.
  await btn(/REMIND ME NEXT WEEK|EXPLORE ON MY OWN/).click({ timeout: 1200 }).catch(() => {});
  await btn(/^PROFILE$/).click({ timeout: 4000 }); await S(1500);
};
const mustSee = async (re, what) => { const t = await text(); if (!re.test(t)) throw new Error(`${what}: expected ${re} on screen`); };
const mustNotSee = async (re, what) => { const t = await text(); if (re.test(t)) throw new Error(`${what}: ${re} should not be on screen`); };
const openLevel = async () => { await page.locator('button[aria-label="Avatar and level"]').click({ timeout: 4000 }); await S(1200); };
const backToOverview = async () => { await page.locator('button[aria-label="Back"]').first().click({ timeout: 4000 }); await S(900); await mustSee(/YOUR STATS/, 'back from the Level page'); await mustNotSee(/YOUR LEVEL/, 'back from the Level page'); };

// A level-3 athlete: 11 sessions, 8 Fit (Fit Mode, Quick Mission, Cardio) and 3 Fight.
const L3 = seedStats([['Fit Mode', 5, 95], ['Fight Focus', 3, 110], ['Quick Mission', 2, 80], ['Cardio', 1, 70]], 1260);
// The owner's athlete: level 10, 57 sessions, 34 Fit and 23 Fight, a 2-day streak.
const L10 = seedStats([['Fit Mode', 20, 90], ['Quick Mission', 10, 85], ['Cardio', 4, 100], ['Fight Focus', 13, 88], ['Combo Coach', 10, 80]], 4960, 2);

// ── Combo Coach by level, and the Level page's AT YOUR LEVEL ─────────────────
// Combo Coach opens on the athlete's own level (Fight progress): level 1 EASY,
// level 10 ADVANCED, marked YOUR LEVEL under its chip. Any level can be picked,
// for this visit only, and the cadence follows the pick. The Level page shows
// what the level does (Quick Missions start at, Combo Coach deals), read from the
// same rules the app runs on.
const L1_FIGHT = seedStats([['Fight Focus', 4, 75]], 300);       // Fight level 1
const L10_FIGHT = seedStats([['Fight Focus', 4, 1150]], 4600);   // Fight level 10
// The Combo Coach setup as an athlete with these stats (the page reads their level on open).
const comboAs = async (stats) => {
  await home();
  await page.evaluate((v) => localStorage.setItem('tm_user_stats', JSON.stringify(v)), stats);
  await page.goto(BASE, { waitUntil: 'networkidle' }); await S(2000);
  await page.mouse.click(195, 120); await S(1500);
  await page.locator('button[aria-label="Close"]').first().click({ force: true, timeout: 1500 }).catch(() => {});
  await btn(/REMIND ME NEXT WEEK|EXPLORE ON MY OWN/).click({ timeout: 1200 }).catch(() => {});
  await page.locator('button[aria-label="FIGHT MODE"]').click({ timeout: 5000 }); await S(1200);
  await page.locator('.fb', { hasText: 'COMBO COACH' }).first().click({ timeout: 4000 });
  await btn(/START COMBOS/).waitFor({ timeout: 12000 }); await S(500);
};
const diffState = () => page.evaluate(() => {
  const r = (e) => { const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, l: b.left, r: b.right, h: b.height }; };
  const chips = [...document.querySelectorAll('[role="radiogroup"][aria-label="Difficulty"] [role="radio"]')].map((e) => ({ label: e.textContent.replace('YOUR LEVEL', '').trim(), on: e.getAttribute('aria-checked') === 'true', cut: e.scrollWidth > e.clientWidth + 0.5, ...r(e) }));
  const marks = [...document.querySelectorAll('[data-your-level]')].map((e) => ({ t: e.textContent.trim(), ...r(e) }));
  const g = document.querySelector('[data-guide="cc-difficulty"]');
  const cad = document.querySelector('input[aria-label="CADENCE"]');
  return { chips, marks, text: g ? g.innerText : '', cadence: cad ? cad.value : undefined };
});
await check('combo coach: level 1 and level 10 athletes open on EASY and ADVANCED, YOUR LEVEL marks theirs, a pick lasts for the visit and the cadence follows it', async () => {
  for (const [stats, word, cadence, pick, pickCadence] of [[L1_FIGHT, 'EASY', '4.0', 'ADVANCED', '2.5'], [L10_FIGHT, 'ADVANCED', '2.5', 'EASY', '4.0']]) {
    await comboAs(stats);
    let s = await diffState();
    if (s.chips.map((c) => c.label).join() !== 'EASY,NORMAL,HARD,ADVANCED') throw new Error(`DIFFICULTY offers ${s.chips.map((c) => c.label)}`);
    if (s.chips.filter((c) => c.on).map((c) => c.label).join() !== word) throw new Error(`a ${word} athlete opens on ${s.chips.filter((c) => c.on).map((c) => c.label)}`);
    const own = s.chips.find((c) => c.label === word);
    if (s.marks.length !== 1 || s.marks[0].t !== 'YOUR LEVEL' || Math.abs(s.marks[0].x - own.x) > 4) throw new Error(`YOUR LEVEL is not marked once, under ${word}: ${JSON.stringify(s.marks)}`);
    if (s.chips.some((c) => c.h < 43.5 || c.cut)) throw new Error(`a difficulty chip is short or its word is cut off: ${JSON.stringify(s.chips.map((c) => [c.label, c.h, c.cut]))}`);
    if (!/STARTS AT YOUR LEVEL/.test(s.text) || !new RegExp(`^${word}:`, 'm').test(s.text)) throw new Error(`the line under the chips says: ${s.text.replace(/\n/g, ' / ')}`);
    if (s.cadence !== cadence) throw new Error(`a ${word} athlete opens on a ${s.cadence}s cadence, not ${cadence}s`);
    // Any level can be picked: the description, the hint and the cadence follow, and the mark stays on their own.
    await page.locator('[role="radiogroup"][aria-label="Difficulty"]').getByRole('radio', { name: new RegExp(`^${pick}`, 'i') }).click({ timeout: 4000 }); await S(300);
    s = await diffState();
    if (s.chips.filter((c) => c.on).map((c) => c.label).join() !== pick || !new RegExp(`^${pick}:`, 'm').test(s.text) || !/FOR TODAY ONLY/.test(s.text)) throw new Error(`a ${pick} pick did not take: ${s.text.replace(/\n/g, ' / ')}`);
    if (s.cadence !== pickCadence) throw new Error(`picking ${pick} left the cadence at ${s.cadence}s, not ${pickCadence}s`);
    if (s.marks.length !== 1 || Math.abs(s.marks[0].x - s.chips.find((c) => c.label === word).x) > 4) throw new Error('YOUR LEVEL moved off their own level');
    // Leaving the setup drops the pick: the next visit is the athlete's own level again.
    await page.locator('button[aria-label="Back to Fight Mode"]').click({ timeout: 4000 }); await S(900);
    await page.locator('.fb', { hasText: 'COMBO COACH' }).first().click({ timeout: 4000 });
    await btn(/START COMBOS/).waitFor({ timeout: 12000 }); await S(400);
    s = await diffState();
    if (s.chips.filter((c) => c.on).map((c) => c.label).join() !== word || s.cadence !== cadence) throw new Error(`a ${pick} pick survived leaving the setup for a ${word} athlete`);
  }
}, /START COMBOS/);
await check('combo coach: START stays above the tab bar at 412x811, 360x740 and 375x667, and ADVANCED fits its chip', async () => {
  await comboAs(L10_FIGHT);
  try {
    for (const [w, h] of [[412, 811], [360, 740], [375, 667]]) {
      await resizeTo(w, h);
      const g = await page.evaluate(() => {
        const r = (e) => e.getBoundingClientRect();
        const start = [...document.querySelectorAll('button')].find((b) => /START COMBOS/.test(b.textContent));
        const chips = [...document.querySelectorAll('[role="radiogroup"][aria-label="Difficulty"] [role="radio"]')].map((e) => ({ h: r(e).height, cut: e.scrollWidth > e.clientWidth + 0.5, w: r(e).width }));
        const mark = r(document.querySelector('[data-your-level]'));
        const adv = r([...document.querySelectorAll('[role="radiogroup"][aria-label="Difficulty"] [role="radio"]')].pop());
        return { nav: r(document.querySelector('[data-guide="nav-tabs"]')).top, start: r(start), chips, markIn: mark.left >= adv.left && mark.right <= adv.right };
      });
      const at = `${w}x${h}`;
      if (g.start.bottom > g.nav || g.start.height < 43.5) throw new Error(`${at}: START COMBOS ends at ${Math.round(g.start.bottom)}, the tab bar starts at ${Math.round(g.nav)}`);
      if (g.chips.length !== 4 || g.chips.some((c) => c.h < 43.5 || c.cut)) throw new Error(`${at}: a difficulty chip is short or cut off ${JSON.stringify(g.chips)}`);
      if (!g.markIn) throw new Error(`${at}: YOUR LEVEL leaves the ADVANCED chip`);
    }
  } finally { await resizeTo(390, 844); }
}, /START COMBOS/);
await check('combo coach: an ADVANCED run starts', async () => {
  await comboAs(L10_FIGHT);
  await btn(/START COMBOS/).click({ timeout: 4000 }); await S(4000);
}, /ROUND|WARM/i);
await check('combo coach: a TECHNICAL run at EASY starts', async () => {
  await comboAs(L1_FIGHT);
  await page.locator('[role="radiogroup"][aria-label="MODE"]').getByRole('radio', { name: /TECHNICAL/i }).click({ timeout: 4000 }); await S(300);
  await btn(/START COMBOS/).click({ timeout: 4000 }); await S(4000);
}, /ROUND|WARM/i);
await check('level page: AT YOUR LEVEL for a level 3 and a level 10 athlete (Quick Mission start, Combo Coach mix, NEXT UNLOCK)', async () => {
  await profileFor(L3);
  await openLevel();
  await mustSee(/AT YOUR LEVEL/, 'level 3 block');
  await mustSee(/QUICK MISSION\s*\n\s*FIT LEVEL 2\s*\n\s*Quick Missions start at EASY\./, 'level 3: Quick Mission row');
  await mustSee(/COMBO COACH\s*\n\s*FIGHT LEVEL 2\s*\n\s*Combo Coach deals up to 3-strike combos, with no hard kicks\.\s*\n\s*You get single strikes and short combos\./, 'level 3: Combo Coach row');
  await mustSee(/NEXT UNLOCK\s*\n\s*One more Fit level, and Quick Missions start at MEDIUM\./, 'level 3: next unlock');
  await mustSee(/Your own side counts in full and the other side at half, so these can sit below your level\./, 'level 3: which work counts');
  await mustNotSee(/NEXT TIER|top tier|difficult kicks/, 'level 3: no tier or difficult kicks wording');
  await backToOverview();
  await profileFor(L10);
  await openLevel();
  await mustSee(/AT YOUR LEVEL/, 'level 10 block');
  await mustSee(/QUICK MISSION\s*\n\s*FIT LEVEL 8\s*\n\s*Quick Missions start at HARD\./, 'level 10: Quick Mission row');
  await mustSee(/COMBO COACH\s*\n\s*FIGHT LEVEL 7\s*\n\s*Combo Coach deals mostly hard combos, with no limit on hard kicks\.\s*\n\s*About 2 in 10 combos are advanced\./, 'level 10: Combo Coach row');
  await mustSee(/NEXT UNLOCK\s*\n\s*Two more Fit levels, and Quick Missions start at ADVANCED\./, 'level 10: next unlock');
  await mustNotSee(/secret|Peak Physique|Fight Ascendant|Final Form/i, 'no secret tier for a Max athlete');
  // The page still scrolls to the end and fits at both phone sizes: the last button clears the tab bar, nothing runs sideways.
  for (const [w, h] of [[412, 811], [360, 740]]) {
    await resizeTo(w, h);
    const g = await page.evaluate(() => {
      const sc = document.querySelector('[data-screen="level"]');
      sc.scrollTo({ top: sc.scrollHeight });
      const last = [...sc.querySelectorAll('button')].pop().getBoundingClientRect();
      const rows = [...sc.querySelectorAll('[data-at-level]')].map((e) => { const b = e.getBoundingClientRect(); return { l: b.left, r: b.right }; });
      return { nav: document.querySelector('[data-guide="nav-tabs"]').getBoundingClientRect().top, lastBottom: last.bottom, wide: sc.scrollWidth > sc.clientWidth + 1, rows, vw: window.innerWidth, h2: [...sc.querySelectorAll('h2')].map((x) => x.textContent).join('|') };
    });
    if (g.lastBottom > g.nav + 0.5) throw new Error(`${w}x${h}: the page ends at ${Math.round(g.lastBottom)}, under the tab bar at ${Math.round(g.nav)}`);
    if (g.wide || g.rows.length !== 3 || g.rows.some((x) => x.l < 0 || x.r > g.vw)) throw new Error(`${w}x${h}: the block runs sideways ${JSON.stringify(g.rows)}`);
    if (g.h2 !== "THE LADDER|WHAT LEVEL 10 MEANS|AT YOUR LEVEL|WHAT YOU'VE DONE|NEXT") throw new Error(`${w}x${h}: headings ${g.h2}`);
  }
  await resizeTo(390, 844);
}, /AT YOUR LEVEL/);

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

// ── Profile › the avatar opens the Level page ───────────────────────────────
// (the seeded athletes and helpers are defined above, with the Combo Coach checks)
await check('level page: the AVATAR button opens it (level 3)', async () => {
  await profileFor(L3);
  await mustSee(/LVL 3 · COMBAT ROOKIE/, 'overview');
  // The overview is still one screen: nothing in the avatar card pushed it past the fold.
  const over = await page.evaluate(() => { let e = document.querySelector('[data-guide="pr-avatar"]'); while (e && !/(auto|scroll)/.test(getComputedStyle(e).overflowY)) e = e.parentElement; return e ? e.scrollHeight - e.clientHeight : 999; });
  if (over > 1) throw new Error(`the Profile overview scrolls by ${over}px`);
  await openLevel();
  await mustSee(/YOUR LEVEL/, 'level page');
  await mustSee(/LEVEL 3\b/, 'level page'); await mustSee(/Rookie/i, 'level page');
  await mustSee(/240 XP to LEVEL 4/, 'xp bar');
  await mustSee(/Level 3 is the last step of Rookie: XP 1,000 to 1,499\./, 'what level 3 means');
  await mustSee(/You have finished 11 sessions: 8 in Fit Mode and 3 in Fight Mode\./, 'the recap matches the seed');
  await mustSee(/SESSIONS\s*\n\s*11/, 'sessions fact'); await mustSee(/TOTAL XP\s*\n\s*1,260/, 'xp fact');
  await mustSee(/THE LADDER/, 'ladder'); await mustSee(/NOVICE/, 'ladder'); await mustSee(/CHAMPION/, 'ladder');
  const states = await page.evaluate(() => [...document.querySelectorAll('[data-tier]')].map((n) => n.getAttribute('data-state')).join());
  if (states !== 'current,ahead,ahead,ahead,ahead') throw new Error(`ladder states ${states}`);
  await mustSee(/NEXT/, 'next'); await mustSee(/Level 4 is your first step into Novice\./, 'next tier');
  await mustNotSee(/secret|Peak Physique|Fight Ascendant|Final Form/i, 'no secret tier for a Rookie');
  await backToOverview();
}, /LVL 3/);
await check('level page: the portrait and the level line open the same page', async () => {
  await profileFor(L3);
  await page.locator('button[aria-label="View your level"]').click({ timeout: 4000 }); await S(1200);
  await mustSee(/YOUR LEVEL/, 'portrait tap'); await mustSee(/Level 3 is the last step of Rookie/, 'portrait tap');
  await backToOverview();
  // The level line is named by its own text, so a screen reader and voice control hear what is on screen.
  await btn(/^LVL 3 · COMBAT ROOKIE$/).click({ timeout: 4000 }); await S(1200);
  await mustSee(/YOUR LEVEL/, 'level line tap'); await mustSee(/LEVEL 3\b/, 'level line tap');
}, /YOUR LEVEL/);
await check('level page: CHANGE AVATAR opens the editor, and the stats tile still does too', async () => {
  await profileFor(L3);
  await openLevel();
  await btn(/CHANGE AVATAR/).click({ timeout: 4000 }); await S(1000);
  await mustSee(/EDIT PROFILE/, 'CHANGE AVATAR');
  // Back from the editor returns to where it was opened: the Level page.
  await page.locator('button[aria-label="Back"]').first().click({ timeout: 4000 }); await S(900);
  await mustSee(/YOUR LEVEL/, 'back from the editor lands on the Level page');
  await backToOverview();
  // Opened from the stats tile, Back goes to the overview, and stays so after a Level trip.
  await btn(/^AVATAR\s+MALE/).click({ timeout: 4000 }); await S(1000);
  await mustSee(/EDIT PROFILE/, 'the stats tile');
  await page.locator('button[aria-label="Back"]').first().click({ timeout: 4000 }); await S(900);
  await mustSee(/YOUR STATS/, 'back from the editor (stats tile)'); await mustNotSee(/YOUR LEVEL/, 'back from the editor (stats tile)');
  await btn(/^AVATAR\s+MALE/).click({ timeout: 4000 }); await S(1000);
}, /EDIT PROFILE/);

await check('level page: tap areas, focus and structure', async () => {
  await profileFor(L3);
  // The three controls that open the page are each about a finger tall, and the card did not grow.
  const sizes = await page.evaluate(() => {
    const r = (el) => { const b = el.getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height)]; };
    const lvl = [...document.querySelectorAll('button')].find((b) => /^LVL 3/.test(b.textContent.trim()));
    return { portrait: r(document.querySelector('button[aria-label="View your level"]')), avatar: r(document.querySelector('button[aria-label="Avatar and level"]')), line: lvl ? r(lvl) : null };
  });
  for (const [k, [w, h]] of Object.entries({ ...sizes, line: sizes.line || [0, 0] })) if (h < 36 || w < 36) throw new Error(`${k} tap area is ${w}x${h}`);
  await openLevel();
  const focus1 = await page.evaluate(() => document.activeElement && document.activeElement.tagName);
  if (focus1 !== 'H1') throw new Error(`focus lands on ${focus1}, not the page heading`);
  const shape = await page.evaluate(() => ({
    h1: document.querySelectorAll('h1').length, h2: [...document.querySelectorAll('h2')].map((h) => h.textContent),
    items: [...document.querySelectorAll('ol li[data-tier]')].map((li) => li.textContent.match(/^[^.]*\./)?.[0] || ''),
    named: [...document.querySelectorAll('[data-screen="level"] section')].filter((x) => !x.getAttribute('aria-labelledby') && !x.getAttribute('aria-label')).length,
  }));
  if (shape.h1 !== 1) throw new Error(`${shape.h1} h1 on the Level page`);
  if (shape.h2.join('|') !== "THE LADDER|WHAT LEVEL 3 MEANS|AT YOUR LEVEL|WHAT YOU'VE DONE|NEXT") throw new Error(`h2s: ${shape.h2.join('|')}`);
  if (shape.named) throw new Error(`${shape.named} unnamed sections`);
  const cut = await page.evaluate(() => [...document.querySelectorAll('[data-screen="level"] [aria-hidden="true"]')].filter((e) => e.children.length === 0 && e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent));
  if (cut.length) throw new Error(`cut off on the Level page: ${cut.join(', ')}`);
  if (shape.items.length !== 5 || shape.items[0] !== 'Rookie, levels 1 to 3, you are here at level 3.' || shape.items[1] !== 'Novice, levels 4 to 6, still ahead.') throw new Error(`ladder says: ${shape.items.join(' / ')}`);
  await page.locator('button[aria-label="Back"]').first().click({ timeout: 4000 }); await S(900);
  const focus2 = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('aria-label'));
  if (focus2 !== 'View your level') throw new Error(`after Back focus is on ${focus2}`);
}, /YOUR STATS/);

await check('level page: level 10 athlete (Max, 57 sessions)', async () => {
  await profileFor(L10);
  await openLevel();
  await mustSee(/LEVEL 10\b/, 'level 10'); await mustSee(/COMBAT MAX/, 'level 10');
  await mustSee(/40 XP to LEVEL 11/, 'level 10 xp bar');
  await mustSee(/Level 10 is the first step of Max: XP 4,500 to 4,999\./, 'what level 10 means');
  await mustSee(/You have finished 57 sessions: 34 in Fit Mode and 23 in Fight Mode\./, 'level 10 recap');
  await mustSee(/DAY STREAK\s*\n\s*2/, 'streak'); await mustSee(/MOST SESSIONS\s*\n\s*Fit Mode/, 'most sessions');
  await mustSee(/Champion starts at Level 13, 3 levels away\./, 'next tier');
  const states = await page.evaluate(() => [...document.querySelectorAll('[data-tier]')].map((n) => n.getAttribute('data-state')).join());
  if (states !== 'passed,passed,passed,current,ahead') throw new Error(`ladder states ${states}`);
  await backToOverview();
}, /LVL 10/);
await check('level page: a brand-new athlete sees no fake numbers', async () => {
  await profileFor({ xp: 0, sessions: [] });
  await openLevel();
  await mustSee(/LEVEL 1\b/, 'level 1'); await mustSee(/Rookie/i, 'level 1');
  await mustSee(/You have not trained yet\. Your first session is the first step\./, 'empty recap');
  await mustNotSee(/TOTAL XP|DAY STREAK|MOST SESSIONS|You have finished|building the habit/, 'empty recap shows no numbers or claims');
  await mustSee(/500 XP to LEVEL 2/, 'level 1 xp bar');
  await backToOverview();
}, /LVL 1/);

// Review fixes: one rank everywhere, award rows are not sessions, the portrait is whole.
const toProgress = async () => { await btn(/^PROGRESS$/).click({ timeout: 4000 }); await S(1500); };
for (const [xp, lv, label] of [[1260, 3, 'COMBAT ROOKIE'], [1520, 4, 'COMBAT NOVICE'], [4300, 9, 'COMBAT WARRIOR']]) {
  await check(`progress tab ranks like the level page (level ${lv} is ${label})`, async () => {
    await profileFor(seedStats([['Fit Mode', 5, 90]], xp));
    await mustSee(new RegExp(`LVL ${lv} · ${label}`), 'profile');
    await openLevel(); await mustSee(new RegExp(`LEVEL ${lv}\\b`), 'level page'); await mustSee(new RegExp(label), 'level page');
    await backToOverview();
    await toProgress();
    await mustSee(new RegExp(`${label} · LV ${lv}`), 'progress rank');
  }, new RegExp(`${label} · LV ${lv}`));
}
await check('level page: award rows are not sessions (Profile and the Level page count the same)', async () => {
  const st = seedStats([['Fit Mode', 5, 95], ['Mission of the Day', 3, 25], ['Hybrid Training Bonus', 1, 40], ['Start Here', 2, 20]], 1260);
  await profileFor(st);
  await mustSee(/(^|\n)5\s*\nSESSIONS/, 'profile counter shows 5');
  await openLevel();
  await mustSee(/You have finished 5 sessions, all in Fit Mode\./, 'level page recap');
  await mustSee(/SESSIONS\s*\n\s*5\b/, 'level page sessions fact'); await mustSee(/TOTAL XP\s*\n\s*1,260/, 'xp still counts the awards');
}, /YOUR LEVEL/);
await check('level page: a secret-tier portrait is shown whole, not cropped', async () => {
  await profileFor(seedStats([['Fit Mode', 30, 300], ['Fight Focus', 10, 200]], 13000));
  await mustSee(/Peak Physique/i, 'secret tier on profile');
  await openLevel();
  await mustSee(/PEAK PHYSIQUE/, 'level page'); await mustSee(/Secret tier · LVL 25\+/, 'secret row');
  await mustSee(/passed Champion|XP leans toward Fit Mode/, 'secret meaning');
  await page.waitForFunction(() => { const i = document.querySelector('[data-screen="level"] img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 5000 });
  const m = await page.evaluate(() => { const i = document.querySelector('[data-screen="level"] img'); const b = i.getBoundingClientRect(); const c = i.parentElement.getBoundingClientRect(); return { shown: b.width / b.height, art: i.naturalWidth / i.naturalHeight, h: b.height, boxH: c.height }; });
  if (Math.abs(m.shown - m.art) / m.art > 0.02) throw new Error(`portrait drawn ${m.shown.toFixed(3)} but the art is ${m.art.toFixed(3)}`);
  if (m.h > m.boxH + 1) throw new Error(`portrait ${m.h}px in a ${m.boxH}px box`);
}, /PEAK PHYSIQUE/);

await browser.close();
server.close();
if (failures.length) { console.log(`\nsmoke-web: ${failures.length} failure(s)`); failures.forEach((f) => console.log('FAIL ' + f)); process.exit(1); }
console.log(`\nsmoke-web: every screen mounted and ran — no crash screen, no uncaught errors`);

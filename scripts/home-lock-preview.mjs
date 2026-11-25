// Home lock preview: the Home hub must fit one screen and never slide (owner,
// 2026-11-24). Every state below is seeded, opened on the web dev server at
// every phone size, photographed, and checked:
//   - nothing on the page can scroll: every scroller has scrollHeight <=
//     clientHeight + 1, and a mouse wheel and a finger swipe leave it at 0;
//   - every block of the hub is whole, inside the screen and above the BETA
//     pill's row and the tab bar (96px from the bottom);
//   - no two blocks overlap;
//   - every tap target on the hub is at least 44px high (40px on a screen
//     under 640px tall); a button's tap area counts its hit-slop child;
//   - a notice or toast never covers the gold START button.
//
//   node scripts/home-lock-preview.mjs <out-dir> [--base http://localhost:8081] [--only <regex>] [--sizes 360x640,390x844]
//
// Needs the dev server (CI=1 EXPO_NO_TELEMETRY=1 npx expo start --web --port 8081;
// restart it after an edit) and Chrome (CHROME_PATH, or Playwright's "chrome").
// Exits 1 when any state fails at any size. See docs/HOME-LOCK.md.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const OUT = args.find((a, i) => !a.startsWith('--') && !['--base', '--only', '--sizes'].includes(args[i - 1]));
if (!OUT) { console.error('usage: node scripts/home-lock-preview.mjs <out-dir> [--base URL] [--only regex] [--sizes WxH,...]'); process.exit(2); }
const BASE = (opt('--base') || 'http://localhost:8081').replace(/\/$/, '') + '/';
const ONLY = opt('--only') ? new RegExp(opt('--only')) : null;
const SIZES = (opt('--sizes') || '320x568,360x640,360x696,375x667,390x844,412x915,430x932,600x960,768x1024')
  .split(',').map((x) => x.split('x').map(Number));
fs.mkdirSync(OUT, { recursive: true });

// ── sample data (the same shapes as scripts/retention-preview.mjs) ─────────
const DAY = 86400000;
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const LIVE_DROP = new Date(2026, 10, 19, 10, 0, 0, 0); // a Thursday; the SHOTO drop is live
const NO_DROP = new Date(2026, 9, 15, 10, 0, 0, 0); // a Thursday before the first drop

function sample(NOW) {
  const NOW_MS = NOW.getTime();
  const todayIdx = (NOW.getDay() + 6) % 7;
  const monday = (wb) => { const d = new Date(NOW); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - todayIdx - 7 * wb); return d; };
  let n = 0;
  const row = (date, type = 'Fight Focus') => ({ id: `p${++n}`, type, completedAt: date.toISOString(), completedCount: 3, totalCount: 3, xpEarned: 90 });
  const trainWeek = (wb, idxs) => idxs.flatMap((i) => { const d = monday(wb); d.setDate(d.getDate() + i); return wb === 0 && i >= todayIdx ? [] : [row(d)]; });
  const history = (onTarget, thisWeek) => { const r = []; for (let w = onTarget; w >= 1; w--) r.push(...trainWeek(w, [0, 2, 4, 5])); r.push(...trainWeek(0, [0, 1, 2, 3].slice(0, thisWeek))); return r; };
  const stats = (rows, xp) => JSON.stringify({ xp, sessions: rows });
  const dayAgo = (d) => { const x = new Date(NOW); x.setDate(x.getDate() - d); x.setHours(18, 0, 0, 0); return x; };
  const FIGHTER = { name: 'TRAINEE', sex: 'male', experience: 'Some Training', goal: 'Train Like a Fighter', discipline: 'Boxing', voiceCoach: 'FEMALE', coachStyle: 'STANDARD', encouragement: 'normal', callStyle: 'names' };
  const FF = { kind: 'timer', cfg: { difficulty: 'Normal', mode: 'Technical', rounds: 3, roundMin: 3, restSec: 60, voiceOn: true, rushMode: false, encouragement: 'normal', warmupMin: 0, ghostChallengeId: null }, disc: 'Boxing', at: NOW_MS - DAY };
  const QM = { kind: 'quick_mission', cfg: { workoutType: 'Bodyweight', duration: 12, difficulty: 'Normal', focus: 'Core', format: 'Auto', cardioFinisher: false, cadenceCount: true, cadencePreset: 'moderate', cadenceMs: 1000, voiceOn: true, cardioAddon: null }, disc: null, at: NOW_MS - DAY };
  const ARCADE = { kind: 'arcade', cfg: { seriesId: 'one-punch-protocol', title: 'One Hundred', stageNumber: 5, mode: 'fit', settings: null }, disc: null, at: NOW_MS - DAY };
  const opProgress = JSON.stringify({ 'one-punch-protocol': { completedStages: Object.fromEntries([3, 3, 2, 1, 3].map((st, i) => [`op-stage-${i + 1}`, { fit: true, fight: true, completed: true, completedAt: NOW_MS - (8 - i) * DAY, stars: st }])), unlockedStages: [1], currentStage: 6, xpEarned: 0, badges: [], statXp: {}, attempts: [] } });
  const paused = (...screens) => JSON.stringify(screens.map((screen, i) => ({ screen, disc: 'Boxing', cfg: {}, reason: 'nav', timestamp: NOW_MS - (10 + i) * 60000 })));
  const held = (bout, done = false) => JSON.stringify({ v: 3, date: bout.date, bout, done, doneAt: done ? new Date(NOW_MS - 3600000).toISOString() : null, xp: done ? 25 : 0 });
  const today = iso(NOW);
  const yesterday = iso(new Date(NOW_MS - DAY));
  const repeat = (date) => ({ date, bonusXp: 25, kind: 'last', turn: 'repeat', side: 'fight', title: 'Fight Focus', parts: ['Boxing · 3 rounds', 'Normal'], cta: 'START', minutes: 11, why: 'Same as last time', run: { type: 'replay', last: FF } });
  const fresh = { date: yesterday, bonusXp: 25, kind: 'fresh', turn: 'fresh', side: 'fight', title: 'One Round: Boxing', parts: ['Fight Focus', 'Hard'], cta: 'START', minutes: 3, why: 'Something new today', run: { type: 'replay', last: { ...FF, cfg: { ...FF.cfg, rounds: 1, difficulty: 'Hard', freshBout: yesterday }, at: null } } };
  const base = (last = FF, rows = history(3, 2), xp = 3200) => ({ tm_user_profile: JSON.stringify(FIGHTER), tm_user_stats: stats(rows, xp), tm_last_session_v1: JSON.stringify(last) });
  const powerRows = (daysAgo) => [24, 21, 17, 14, 10, 7, 3, 0].map((k) => row(dayAgo(daysAgo + k)));
  const ghost = (toast) => JSON.stringify({ active: { id: 'g1', kind: 'beat', seen: true, offeredAt: NOW_MS - 2 * DAY, declinedAt: toast ? NOW_MS - DAY : undefined }, lastOffered: {}, beaten: 0, toast: toast ? 'declined' : null });
  return { NOW_MS, today, yesterday, history, row, stats, base, FF, QM, ARCADE, opProgress, paused, held, repeat, fresh, powerRows, ghost };
}

const wait = (page, ms) => page.waitForTimeout(ms);
async function home(page, w) {
  await page.goto(BASE, { waitUntil: 'networkidle' }); await wait(page, 1800);
  await page.mouse.click(Math.round(w / 2), 120); await wait(page, 1800);
  await page.locator('button[aria-label="Close"]').first().click({ force: true, timeout: 1200 }).catch(() => {});
  // The weekly coach interstitial some sample weeks bring up: put off.
  await page.getByRole('button', { name: /REMIND ME NEXT WEEK/i }).first().click({ timeout: 800 }).then(() => wait(page, 900)).catch(() => {});
  await wait(page, 900);
}
async function rustyLater(page) {
  await page.locator('[data-retention="rusty-card"] button', { hasText: 'LATER' }).first().click({ timeout: 4000 });
  await wait(page, 900);
}

// { name, owner (preview on), at (clock), seed(s), open?, expect?: RegExp }
const S = (at) => sample(at);
const STATES = [
  // ── the public app (owner preview off) ──
  { name: 'off-continue', owner: false, at: LIVE_DROP, seed: (s) => s.base(s.QM), expect: /CONTINUE[\s\S]*START[\s\S]*SURPRISE ME/i },
  { name: 'off-continue-long', owner: false, at: LIVE_DROP, seed: (s) => s.base(s.FF), expect: /CONTINUE[\s\S]*START/i },
  { name: 'off-continue-nodrop', owner: false, at: NO_DROP, seed: (s) => s.base(s.FF), absent: /NEW DROP/ },
  { name: 'off-paused', owner: false, at: LIVE_DROP, seed: (s) => ({ ...s.base(s.FF), trainingModePausedSession: s.paused('timer') }) },
  { name: 'off-paused-alt', owner: false, at: LIVE_DROP, seed: (s) => ({ ...s.base(s.FF), trainingModePausedSession: s.paused('timer', 'qm_active') }), expect: /Also paused/i },
  { name: 'off-paused-alt-nodrop', owner: false, at: NO_DROP, seed: (s) => ({ ...s.base(s.FF), trainingModePausedSession: s.paused('timer', 'qm_active') }), expect: /Also paused/i },
  { name: 'off-ghost-toast', owner: false, at: LIVE_DROP, seed: (s) => ({ ...s.base(s.FF), tm_ghost_challenge_v1: s.ghost(true) }) },
  { name: 'off-reminder', owner: false, at: LIVE_DROP, seed: (s) => ({ ...s.base(s.FF), tm_reminder_card_dismissed: '' }) },
  // ── owner preview on ──
  { name: 'on-bout-fresh', at: LIVE_DROP, seed: (s) => ({ ...s.base(s.FF, s.history(9, 3), 6750), tm_daily_mission_v2: s.held(s.repeat(s.yesterday)) }), expect: /TODAY'S BOUT/ },
  { name: 'on-bout-repeat', at: LIVE_DROP, seed: (s) => ({ ...s.base(s.FF, s.history(9, 3), 6750), tm_daily_mission_v2: s.held(s.fresh) }), expect: /TODAY'S BOUT/ },
  { name: 'on-bout-done', at: LIVE_DROP, seed: (s) => ({ ...s.base(s.FF, [...s.history(3, 2), { ...s.row(new Date(s.NOW_MS - 3600000)), id: 'pd' }, { id: 'pbonus', type: 'Mission of the Day', completedAt: new Date(s.NOW_MS - 3600000).toISOString(), completedCount: 1, totalCount: 1, xpEarned: 25, bout: s.today }], 4200), tm_daily_mission_v2: s.held(s.repeat(s.today), true), tm_week_moments_v1: JSON.stringify({ day: s.today, seen: [] }) }), expect: /TRAIN AGAIN/ },
  { name: 'on-1up-notice', at: LIVE_DROP, seed: (s) => s.base(s.FF, s.history(4, 0), 3000), expect: /1UP earned/ },
  { name: 'on-power-draining', at: LIVE_DROP, seed: (s) => s.base({ ...s.FF, at: s.NOW_MS - 10 * DAY }, s.powerRows(10), 2650), expect: /POWER/ },
  { name: 'on-power-low', at: LIVE_DROP, seed: (s) => s.base({ ...s.FF, at: s.NOW_MS - 19 * DAY }, s.powerRows(19), 2650), expect: /running\slow/ },
  { name: 'on-next-up', at: LIVE_DROP, seed: (s) => ({ ...s.base(s.ARCADE), tm_arcade_progress: s.opProgress, tm_daily_mission_v2: s.held(s.repeat(s.today)) }), expect: /NEXT UP/ },
  // The fullest the hub gets: POWER low with its notice, NEXT UP, a ghost, the drop.
  { name: 'on-fullest', at: LIVE_DROP, seed: (s) => ({ ...s.base({ ...s.ARCADE, at: s.NOW_MS - 19 * DAY }, s.powerRows(19), 2650), tm_arcade_progress: s.opProgress, tm_daily_mission_v2: s.held({ ...s.repeat(s.today), title: 'Fight Focus — 3 Round Starter' }), tm_ghost_challenge_v1: s.ghost(false) }), expect: /running\slow[\s\S]*NEXT UP/ },
  { name: 'on-rusty', at: LIVE_DROP, seed: (s) => s.base({ ...s.FF, at: s.NOW_MS - 34 * DAY }, s.powerRows(34), 2650), open: async (page, w) => { await home(page, w); await rustyLater(page); }, expect: /RUSTY/ },
];

// ── the checks, run in the page ────────────────────────────────────────────
function measure() {
  const fails = [];
  const H = window.innerHeight; const W = window.innerWidth;
  const shown = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  // 1. nothing can scroll
  const scrollers = [document.scrollingElement, ...document.querySelectorAll('*')].filter((el) => {
    if (!el) return false;
    const cs = getComputedStyle(el);
    return el === document.scrollingElement || cs.overflowY === 'auto' || cs.overflowY === 'scroll';
  });
  for (const el of scrollers) {
    if (el.scrollHeight > el.clientHeight + 1 && (el === document.scrollingElement || shown(el))) fails.push(`scrolls: ${el.className || el.tagName} (${el.scrollHeight} > ${el.clientHeight})`);
  }
  // 2. the blocks
  const col = document.querySelector('.hm-col');
  if (!col) return { fails: ['no .hm-col on screen (not Home?)'], blocks: [] };
  const pick = (sel, name) => [...col.querySelectorAll(sel)].filter(shown).map((el, i, a) => ({ el, name: a.length > 1 ? `${name}#${i + 1}` : name }));
  const blocks = [
    ...pick('header[data-guide="home-level"]', 'header'),
    ...pick('[data-retention="power"]', 'power line'),
    ...pick('[data-lock="alt"]', 'also paused'),
    ...pick('section[data-guide="home-continue"]', 'top card'),
    ...pick('[data-lock="pick"]', 'surprise/adjust'),
    ...pick('button[data-retention="next-up"]', 'next up'),
    ...pick('[data-guide="home-concept"]', 'drop'),
    ...pick('.mc', 'mode tile'),
    ...pick('[data-guide="home-arcade"]', 'arcade'),
    ...pick('.hm-quick-tile', 'quick tile'),
  ];
  const LIMIT = H - 96; // the BETA pill's top (72 + 24) and the tab bar under it
  for (const b of blocks) {
    const r = b.el.getBoundingClientRect();
    if (r.top < -0.5 || r.left < -0.5 || r.right > W + 0.5) fails.push(`${b.name} off the screen (${Math.round(r.left)},${Math.round(r.top)})`);
    if (r.bottom > LIMIT + 0.5) fails.push(`${b.name} reaches the BETA row / tab bar (bottom ${Math.round(r.bottom)} > ${LIMIT})`);
  }
  for (const must of ['header', 'top card', 'mode tile#1', 'mode tile#2', 'arcade', 'quick tile#1', 'quick tile#2', 'quick tile#3']) {
    if (!blocks.some((b) => b.name === must)) fails.push(`missing block: ${must}`);
  }
  // 3. no overlap
  for (let i = 0; i < blocks.length; i++) for (let j = i + 1; j < blocks.length; j++) {
    const a = blocks[i].el.getBoundingClientRect(); const c = blocks[j].el.getBoundingClientRect();
    if (blocks[i].el.contains(blocks[j].el) || blocks[j].el.contains(blocks[i].el)) continue;
    const ox = Math.min(a.right, c.right) - Math.max(a.left, c.left); const oy = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top);
    if (ox > 0.5 && oy > 0.5) fails.push(`${blocks[i].name} overlaps ${blocks[j].name}`);
  }
  // 3b. a 1UP / POWER notice never covers the top card (its eyebrow and title
  // name what START will run)
  const card = blocks.find((b) => b.name === 'top card');
  for (const n of col.querySelectorAll('.hm-under > *')) {
    if (!card || !shown(n)) continue;
    const a = n.getBoundingClientRect(); const c = card.el.getBoundingClientRect();
    const oy = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top);
    if (oy > 0.5 && Math.min(a.right, c.right) > Math.max(a.left, c.left)) fails.push(`notice covers the top card by ${Math.round(oy)}px`);
  }
  // 4. tap targets (the hub's own; a toast or notice is transient and its own component)
  const minTap = H < 640 ? 40 : 44;
  for (const btn of col.querySelectorAll('button')) {
    if (!shown(btn) || btn.closest('[role="status"], .hm-under')) continue;
    let top = Infinity; let bottom = -Infinity;
    for (const el of [btn, ...btn.querySelectorAll('*')]) {
      if (el !== btn && getComputedStyle(el).position !== 'absolute') continue;
      const r = el.getBoundingClientRect(); top = Math.min(top, r.top); bottom = Math.max(bottom, r.bottom);
    }
    const h = bottom - top;
    if (h < minTap - 0.5) fails.push(`tap target ${Math.round(h)}px high (< ${minTap}): ${(btn.getAttribute('aria-label') || btn.innerText || btn.className).trim().slice(0, 30)}`);
  }
  // 5. START never covered
  const go = [...col.querySelectorAll('.hm-go, .rt-go')].find((el) => shown(el) && el.closest('section[data-guide="home-continue"]'));
  if (go) {
    const r = go.getBoundingClientRect();
    for (const [x, y] of [[r.left + 6, r.top + 4], [r.right - 6, r.top + 4], [(r.left + r.right) / 2, (r.top + r.bottom) / 2]]) {
      const hit = document.elementFromPoint(x, y);
      if (hit && !go.contains(hit) && !go.parentElement.contains(hit)) { fails.push(`START covered at (${Math.round(x)},${Math.round(y)}) by ${hit.tagName}.${hit.className}`); break; }
    }
  } else fails.push('no START button in the top card');
  return { fails, blocks: blocks.map((b) => { const r = b.el.getBoundingClientRect(); return `${b.name}:${Math.round(r.top)}-${Math.round(r.bottom)}`; }) };
}
const scrollTops = () => [document.scrollingElement, ...document.querySelectorAll('*')].filter((el) => el && el.scrollTop > 0).map((el) => `${el.className || el.tagName}=${el.scrollTop}`);

// ── run ────────────────────────────────────────────────────────────────────
const tries = process.env.CHROME_PATH ? [{ executablePath: process.env.CHROME_PATH }] : [{ channel: 'chrome' }, { executablePath: '/usr/bin/google-chrome' }];
let browser;
for (const t of tries) { try { browser = await chromium.launch({ headless: true, ...t }); break; } catch (e) { if (t === tries.at(-1)) throw e; } }

let failures = 0;
const report = [];
for (const st of STATES) {
  if (ONLY && !ONLY.test(st.name)) continue;
  for (const [w, h] of SIZES) {
    const s = S(st.at);
    const seed = { trainingModeOnboardingComplete: 'true', trainingModeTourComplete: 'true', tm_arcade_intro_seen: '{}', tm_reminder_card_dismissed: st.at.toDateString(), ...(st.owner === false ? {} : { tm_owner_preview: '1' }), ...st.seed(s) };
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await ctx.addInitScript((sd) => {
      try { Object.defineProperty(window, 'speechSynthesis', { value: undefined }); } catch { /* read-only */ }
      if (localStorage.getItem('__hl')) return;
      localStorage.clear();
      for (const [k, v] of Object.entries(sd)) localStorage.setItem(k, v);
      localStorage.setItem('__hl', '1');
    }, seed);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 160)));
    await page.clock.install({ time: st.at.getTime() });
    let res;
    try {
      await (st.open || home)(page, w);
      await wait(page, 500);
      res = await page.evaluate(measure);
      const text = await page.evaluate(() => document.body.innerText);
      if (st.expect && !st.expect.test(text)) res.fails.push(`expected ${st.expect} on screen`);
      if (st.absent && st.absent.test(text)) res.fails.push(`not expected on screen: ${st.absent}`);
      // A wheel and a finger swipe must not move anything.
      await page.mouse.move(w / 2, h / 2); await page.mouse.wheel(0, 800); await wait(page, 300);
      const cdp = await ctx.newCDPSession(page);
      const pt = (y) => [{ x: w / 2, y }];
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(h * 0.7) });
      for (let k = 1; k <= 8; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(h * 0.7 - k * h * 0.06) });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await wait(page, 500);
      const moved = await page.evaluate(scrollTops);
      if (moved.length) res.fails.push(`moved by wheel/swipe: ${moved.join(', ')}`);
      if (moved.length) await page.evaluate(() => { for (const el of document.querySelectorAll('*')) el.scrollTop = 0; });
    } catch (e) { res = { fails: [`could not open: ${e.message.split('\n')[0]}`], blocks: [] }; }
    if (errors.length) res.fails.push(`page errors: ${errors.join(' | ')}`);
    const file = path.join(OUT, `${st.name}-${w}x${h}.png`);
    await page.screenshot({ path: file }).catch(() => {});
    const ok = !res.fails.length;
    if (!ok) failures++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${st.name} @${w}x${h}`);
    for (const f of res.fails) console.log(`       ✗ ${f}`);
    report.push({ state: st.name, size: `${w}x${h}`, file, fails: res.fails, blocks: res.blocks });
    await ctx.close();
  }
}
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ base: BASE, at: new Date().toISOString(), results: report }, null, 2));
await browser.close();
console.log(failures ? `\n${failures} failed` : '\nall states locked');
process.exit(failures ? 1 : 0);

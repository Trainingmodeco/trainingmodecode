// Fit looks preview: every state of the simplified workout card (the hidden
// /fit-looks page, sample data), opened on the web dev server and photographed
// at three phone sizes, device scale 2, the whole page. Fails when anything
// overflows the viewport sideways, any text is cut off, a state's own words are
// missing, or a page's content runs under the tab bar (the owner's visual
// rule: everything fits in frame, nothing cut or mushed).
//
//   node scripts/fit-looks-preview.mjs <out-dir> [--base http://localhost:8081] [--only <regex>]
//
// Needs the dev server: CI=1 EXPO_NO_TELEMETRY=1 npx expo start --web --port 8081
// (CI mode does not reload: restart it after an edit). Chrome: CHROME_PATH, or
// Playwright's "chrome" channel, or /usr/bin/google-chrome.
//
// A page state is checked at the phone's own size, then the window is made as
// tall as the page (the app scrolls inside its own box, so this is how the
// whole page fits one photo) and checked again: there, the last of the content
// must end above the tab bar. A sheet or a dialog (`overlay`) is photographed
// at the phone's own size, over the page as it sits. The text checks are
// scripts/retention-preview.mjs's: no box clips its text sideways, no clamp
// hides a line, no text sits outside a box that clips it. `today` is the real
// Quick Mission page for comparison: what it shows is reported, never failed.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const OUT = args.find((a, i) => !a.startsWith('--') && !['--base', '--only'].includes(args[i - 1]));
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const BASE = (opt('--base') || 'http://localhost:8081').replace(/\/$/, '') + '/';
const ONLY = opt('--only') ? new RegExp(opt('--only')) : null;
if (!OUT) { console.error('usage: node scripts/fit-looks-preview.mjs <out-dir> [--base URL] [--only regex]'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });

const SIZES = [[360, 780], [390, 844], [430, 932]];

// Every state on one fixed local day and time, the sample's own: Monday 23
// November 2026, 10:00 (YOUR WORKOUTS' dates count back from it). The athlete
// is a sample too: the workouts YOUR WORKOUTS lists, and this morning's FULL
// BODY WARRIOR (the results state), banked as Quick Mission rows, so the end
// screen's YOUR PROGRESS and the LV badge read like a real athlete's.
const NOW = new Date(2026, 10, 23, 10, 0, 0, 0);
const at = (day, h, m) => new Date(2026, 10, day, h, m, 0, 0).toISOString();
const row = (id, day, h, m, xp, done = 8, of = 8) => ({ id, type: 'Quick Mission', completedAt: at(day, h, m), completedCount: done, totalCount: of, xpEarned: xp, mode: 'solo', level: 'Normal' });
const SESSIONS = [
  row('s6', 11, 18, 10, 480), row('s5', 13, 7, 40, 255), row('s4', 15, 9, 5, 435),
  row('s3', 17, 18, 30, 300, 6, 8), row('s2', 19, 7, 15, 300), row('s1', 21, 9, 0, 555), row('s0', 23, 9, 20, 555),
];
const SEED = {
  trainingModeOnboardingComplete: 'true',
  trainingModeTourComplete: 'true',
  tm_user_stats: JSON.stringify({ xp: SESSIONS.reduce((a, r) => a + r.xpEarned, 0), sessions: SESSIONS }),
};

// { s, expect, absent?, overlay?, report?, url? }: `expect` is matched against
// the page's text and `absent` must not match it; `url` opens another page than
// ?s=<s> (the gallery: no state).
const STATES = [
  { s: 'select', expect: /FULL BODY WARRIOR[\s\S]*SHUFFLE[\s\S]*CHOOSE[\s\S]*ROUNDS[\s\S]*99[\s\S]*396[\s\S]*About 27 min[\s\S]*Dive Bomber Push-Ups[\s\S]*Reverse Curls[\s\S]*BALANCED[\s\S]*PULL-UP BAR[\s\S]*START[\s\S]*BONUS TRAINING[\s\S]*YOUR WORKOUTS/i },
  { s: 'rounds5', expect: /99[\s\S]*5[\s\S]*495[\s\S]*About 35 min/ },
  { s: 'choose', overlay: true, expect: /CHOOSE A WORKOUT[\s\S]*FULL BODY[\s\S]*ON CARD[\s\S]*UPPER BODY[\s\S]*LOWER BODY[\s\S]*CORE & ABS[\s\S]*COMBAT CONDITIONING[\s\S]*SURPRISE ME/i },
  { s: 'swap', overlay: true, expect: /SWAP: PULL-UPS[\s\S]*NOW[\s\S]*EASIER[\s\S]*SIMILAR[\s\S]*HARDER[\s\S]*NO GEAR[\s\S]*4 rounds stay/ },
  { s: 'nobar', expect: /103[\s\S]*412[\s\S]*Reverse Snow Angels[\s\S]*NO BAR[\s\S]*for Pull-Ups[\s\S]*Leg Raises[\s\S]*NO BAR[\s\S]*for Hanging Knee Raises[\s\S]*2 moves swapped/ },
  { s: 'shuffled', expect: /CALISTHENICS CIRCUIT[\s\S]*Shuffled: new moves[\s\S]*80[\s\S]*\+ 30s hold[\s\S]*320[\s\S]*\+ 2:00 hold[\s\S]*PUSH[\s\S]*PULL[\s\S]*Hollow Body Hold[\s\S]*30s/ },
  { s: 'bonus', expect: /BONUS TRAINING[\s\S]*Morning Run[\s\S]*CARDIO[\s\S]*L-Sit Hold[\s\S]*Handstand Hold[\s\S]*Mobility[\s\S]*Farmer Carries[\s\S]*WEIGHTS[\s\S]*Shadowboxing[\s\S]*FIGHT[\s\S]*never changes the rounds/ },
  { s: 'program', expect: /PULL DAY[\s\S]*PUSH \/ PULL \/ LEGS[\s\S]*Day 2 of 3[\s\S]*SHUFFLE THIS DAY[\s\S]*52[\s\S]*208/ },
  { s: 'tracker', expect: /AT YOUR PACE[\s\S]*FULL BODY WARRIOR[\s\S]*17:47[\s\S]*ROUND 3 OF 5[\s\S]*2 OF 5 ROUNDS[\s\S]*50%[\s\S]*250[\s\S]*reps done[\s\S]*245[\s\S]*ROUND 1 DONE[\s\S]*ROUND 2 DONE[\s\S]*ROUND 3[\s\S]*IN PROGRESS[\s\S]*4 OF 8[\s\S]*ROUND 4[\s\S]*ROUND 5[\s\S]*SHUFFLE[\s\S]*STOP/ },
  { s: 'confirm', overlay: true, expect: /START OVER\?[\s\S]*So far: 2 rounds and 4 moves[\s\S]*KEEP GOING/ },
  { s: 'results', expect: /MISSION COMPLETE[\s\S]*FULL BODY WARRIOR[\s\S]*5\/5[\s\S]*495[\s\S]*38:12[\s\S]*100% COMPLETE[\s\S]*REPEAT[\s\S]*NEW CHALLENGE[\s\S]*SAVE WORKOUT/, absent: /Saved|SAVED/ },
  { s: 'saved', expect: /100% COMPLETE[\s\S]*Saved\. Find it in CHOOSE\.[\s\S]*REPEAT[\s\S]*NEW CHALLENGE[\s\S]*SAVED/, absent: /SAVE WORKOUT/ },
  { s: 'history', expect: /YOUR WORKOUTS[\s\S]*LAST 7 DAYS[\s\S]*1,000[\s\S]*SAT[\s\S]*21[\s\S]*FULL BODY WARRIOR[\s\S]*5 rounds · 495 reps[\s\S]*38:12[\s\S]*100%[\s\S]*3 of 4 rounds/ },
  { s: 'today', report: true, expect: /QUICK MISSION[\s\S]*START/ },
  { s: 'gallery', url: 'fit-looks', expect: /THE WORKOUT CARD[\s\S]*SELECT · select[\s\S]*TODAY · today/ },
];

// ── the checks (scripts/retention-preview.mjs's measure, plus the tab bar) ──
// Runs in the page. Returns { fails: [...], warns: [...] }.
function measure({ checkSelectors, navClear }) {
  const vw = window.innerWidth;
  const fails = [], warns = [];
  const name = (el) => {
    const t = (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 50);
    return `${el.tagName.toLowerCase()} "${t}"`;
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
    const lineH = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
    if (cs.webkitLineClamp && cs.webkitLineClamp !== 'none' && el.scrollHeight > el.clientHeight + Math.max(1, lineH / 2)) out.push(`lines hidden: ${name(el)}`);
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
  // The whole page in one window: its last text or button ends above the tab bar.
  if (navClear) {
    const nav = document.querySelector('[data-guide="nav-tabs"]');
    const root = document.querySelector('[data-fl-state]');
    if (nav && root) {
      const top = nav.getBoundingClientRect().top;
      for (const el of root.querySelectorAll('button, a, h1, span, div')) {
        if (nav.contains(el) || !shown(el) || !(ownText(el) || el.tagName === 'BUTTON')) continue;
        const r = el.getBoundingClientRect();
        if (r.bottom > top + 1 && r.top < window.innerHeight) { fails.push(`under the tab bar: ${name(el)} (ends ${Math.round(r.bottom)}, bar at ${Math.round(top)})`); break; }
      }
    }
  }
  return { fails: [...new Set(fails)], warns: [...new Set(warns)] };
}

// The most any box on the page can still scroll down.
const overflowY = () => Math.max(0, ...[...document.querySelectorAll('body *')].map((el) => {
  const cs = getComputedStyle(el);
  return cs.overflowY === 'auto' || cs.overflowY === 'scroll' ? el.scrollHeight - el.clientHeight : 0;
}));

// ── run ────────────────────────────────────────────────────────────────────
const launchOpts = { headless: true, args: ['--autoplay-policy=no-user-gesture-required'] };
let browser;
const tries = process.env.CHROME_PATH ? [{ executablePath: process.env.CHROME_PATH }] : [{ channel: 'chrome' }, { executablePath: '/usr/bin/google-chrome' }];
for (const t of tries) { try { browser = await chromium.launch({ ...launchOpts, ...t }); break; } catch (e) { if (t === tries.at(-1)) throw e; } }

const wait = (page, ms) => page.waitForTimeout(ms);
let failures = 0;
const report = [];
for (const st of STATES) {
  if (ONLY && !ONLY.test(st.s)) continue;
  for (const [w, h] of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await ctx.addInitScript((seed) => {
      try { Object.defineProperty(window, 'speechSynthesis', { value: undefined }); } catch { /* read-only */ }
      if (localStorage.getItem('__fl')) return;
      localStorage.clear();
      for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
      localStorage.setItem('__fl', '1');
    }, SEED);
    const page = await ctx.newPage();
    await page.clock.install({ time: NOW.getTime() });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
    const file = path.join(OUT, `${st.s}-${w}.png`);
    let res = { fails: [], warns: [] };
    try {
      await page.goto(`${BASE}${st.url || `fit-looks?s=${st.s}`}`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts?.ready);
      await wait(page, 1400);
      const check = ['[data-fl-state]', ...(st.overlay ? ['[data-look]'] : [])];
      res = await page.evaluate(measure, { checkSelectors: check, navClear: false });
      const t = await page.evaluate(() => document.body.innerText);
      if (st.expect && !st.expect.test(t)) res.fails.unshift(`expected ${st.expect} on screen`);
      if (st.absent && st.absent.test(t)) res.fails.unshift(`expected no ${st.absent} on screen`);
      const more = st.overlay || st.report ? 0 : await page.evaluate(overflowY);
      if (more > 0) {
        await page.setViewportSize({ width: w, height: Math.min(9000, h + more) });
        await wait(page, 700);
        const tall = await page.evaluate(measure, { checkSelectors: check, navClear: true });
        res.fails.push(...tall.fails.filter((f) => !res.fails.includes(f)));
        res.warns.push(...tall.warns.filter((f) => !res.warns.includes(f)));
      }
      await page.screenshot({ path: file, fullPage: true });
    } catch (e) {
      res.fails.push(`could not open: ${e.message.split('\n')[0]}`);
    }
    if (errors.length) res.fails.push(`page errors: ${errors.join(' | ')}`);
    // The real page of today is reported, never failed.
    if (st.report) { res.warns.unshift(...res.fails.map((f) => `(today's page) ${f}`)); res.fails = []; }
    const ok = !res.fails.length;
    if (!ok) failures++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${st.s} @${w}x${h}  → ${file}`);
    for (const f of res.fails) console.log(`       ✗ ${f}`);
    for (const f of res.warns.slice(0, 6)) console.log(`       · warn: ${f}`);
    report.push({ state: st.s, size: `${w}x${h}`, file, fails: res.fails, warns: res.warns });
    await ctx.close();
  }
}
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ base: BASE, at: new Date().toISOString(), results: report }, null, 2));
await browser.close();
console.log(failures ? `\n${failures} failed` : '\nall states fit');
process.exit(failures ? 1 : 0);

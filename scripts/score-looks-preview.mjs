// Score looks preview: every state of the game-over score board (the hidden
// /score-looks page, sample data), opened on the web dev server and
// photographed at three phone sizes, device scale 2, the whole page. Fails
// when anything overflows the viewport sideways, any text is cut off, a board
// row takes more than one line, a state's own words or rows are missing, or a
// page's content runs under the tab bar (the owner's visual rule: everything
// fits in frame, nothing cut or squeezed). Also photographs the retention
// gallery's section 4 (/retention-looks#f4), which draws the same components.
//
//   node scripts/score-looks-preview.mjs <out-dir> [--base http://localhost:8081] [--only <regex>]
//
// Needs the dev server: CI=1 EXPO_NO_TELEMETRY=1 npx expo start --web --port 8081
// (CI mode does not reload: restart it with --clear after an edit). Chrome:
// CHROME_PATH, or Playwright's "chrome" channel, or /usr/bin/google-chrome.
//
// A state is checked at the phone's own size, then the window is made as tall
// as the page (the app scrolls inside its own box, so this is how the whole
// page fits one photo) and checked again: there, the last of the content must
// end above the tab bar. The text checks are scripts/fit-looks-preview.mjs's.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const OUT = args.find((a, i) => !a.startsWith('--') && !['--base', '--only'].includes(args[i - 1]));
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const BASE = (opt('--base') || 'http://localhost:8081').replace(/\/$/, '') + '/';
const ONLY = opt('--only') ? new RegExp(opt('--only')) : null;
if (!OUT) { console.error('usage: node scripts/score-looks-preview.mjs <out-dir> [--base URL] [--only regex]'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });

const SIZES = [[360, 780], [390, 844], [430, 932]];

// One fixed local day and time (Monday 23 November 2026, 10:00), and a sample
// athlete at level 14 with this week's Fight Focus sessions, so the end
// screen's YOUR PROGRESS reads like a real athlete's.
const NOW = new Date(2026, 10, 23, 10, 0, 0, 0);
const at = (day, h, m) => new Date(2026, 10, day, h, m, 0, 0).toISOString();
const row = (id, day, h, m, xp) => ({ id, type: 'Fight Focus', completedAt: at(day, h, m), completedCount: 3, totalCount: 3, xpEarned: xp });
const SESSIONS = [row('s3', 17, 18, 30, 125), row('s2', 19, 7, 15, 110), row('s1', 21, 9, 0, 125), row('s0', 23, 9, 20, 125)];
const SEED = {
  trainingModeOnboardingComplete: 'true',
  trainingModeTourComplete: 'true',
  tm_user_stats: JSON.stringify({ xp: 6620, sessions: SESSIONS }),
};

// { s, expect, absent?, rows?, input?, url?, shot? }: `expect` is matched
// against the page's text and `absent` must not match it; `rows` counts the
// board's rows by kind ({ cpu, you, player }) and, with `fade`, checks no CPU
// row sits above a real one; `input` is a text box's expected value; `url`
// opens another page than ?s=<s>, and `shot` photographs one element of it.
const STATES = [
  {
    s: 'board-top10',
    expect: /GAME OVER[\s\S]*HIGH SCORES[\s\S]*FIGHT FOCUS · BOXING[\s\S]*3 ROUNDS × 3 MIN · NORMAL[\s\S]*YOUR SCORE[\s\S]*812[\s\S]*STRIKES ✓[\s\S]*6TH PLACE · 4 PLAYERS SO FAR[\s\S]*NEW\s*BEST[\s\S]*WAS 744[\s\S]*RANK[\s\S]*LEVEL[\s\S]*STRIKES[\s\S]*1ST[\s\S]*HEAVY BAG[\s\S]*CPU[\s\S]*1,008[\s\S]*2ND[\s\S]*Rafa_K[\s\S]*BR[\s\S]*6TH[\s\S]*YOU[\s\S]*NEW BEST[\s\S]*10TH[\s\S]*A house score, not a player[\s\S]*CONTINUE/,
    rows: { cpu: 6, you: 1, player: 3 },
  },
  {
    s: 'board-early',
    expect: /MAX OUT · BOSS RUSH[\s\S]*STANDARD · 3 ROUNDS[\s\S]*214[\s\S]*TOTAL REPS[\s\S]*FIRST PLAYER ON THIS BOARD[\s\S]*1ST[\s\S]*KETTLEBELL[\s\S]*CPU[\s\S]*4TH[\s\S]*YOU[\s\S]*10TH[\s\S]*A house score, not a player[\s\S]*CONTINUE/,
    rows: { cpu: 9, you: 1, player: 0 },
  },
  {
    s: 'board-fade',
    expect: /CARDIO · RUN[\s\S]*5 KM · GPS[\s\S]*22:48[\s\S]*RUN TIME[\s\S]*1ST[\s\S]*Ola[\s\S]*3RD[\s\S]*YOU[\s\S]*6TH[\s\S]*Dre[\s\S]*26:40[\s\S]*7TH[\s\S]*STEP BOX[\s\S]*CPU[\s\S]*28:00[\s\S]*10TH[\s\S]*LANE LINE[\s\S]*35:00[\s\S]*CONTINUE/,
    rows: { cpu: 4, you: 1, player: 5 }, fade: true,
  },
  {
    s: 'board-busy',
    expect: /QUICK MISSION · ROOM 12[\s\S]*10 \+ 18[\s\S]*ROUNDS \+ REPS[\s\S]*7 REPS SHORT OF YOUR BEST[\s\S]*YOUR BEST[\s\S]*10 \+ 25[\s\S]*SCORE[\s\S]*1ST[\s\S]*Kenji\.T[\s\S]*14 \+ 6[\s\S]*10TH[\s\S]*#143[\s\S]*YOU[\s\S]*10 \+ 25[\s\S]*of 2,310 players[\s\S]*Next place: 3 more reps[\s\S]*CONTINUE/,
    absent: /CPU|NEW BEST/,
    rows: { cpu: 0, you: 1, player: 10 },
  },
  {
    s: 'board-time',
    expect: /ARCADE · ONE HUNDRED[\s\S]*STAGE 3 · FIT[\s\S]*13:05[\s\S]*STAGE TIME[\s\S]*LESS TIME RANKS HIGHER[\s\S]*NEW\s*BEST[\s\S]*WAS 13:48[\s\S]*TIME[\s\S]*1ST[\s\S]*11:40[\s\S]*Noor[\s\S]*12:12[\s\S]*4TH[\s\S]*YOU[\s\S]*13:05[\s\S]*Kenji\.T[\s\S]*16:30[\s\S]*CONTINUE/,
    rows: { cpu: 7, you: 1, player: 2 },
  },
  {
    s: 'endcard',
    expect: /SESSION COMPLETE[\s\S]*GOOD WORK[\s\S]*3\/3[\s\S]*812[\s\S]*STRIKES ✓[\s\S]*HIGH SCORES[\s\S]*3 ROUNDS × 3 MIN · NORMAL[\s\S]*RANK[\s\S]*STRIKES[\s\S]*1ST[\s\S]*HEAVY BAG[\s\S]*2ND[\s\S]*Rafa_K[\s\S]*3RD[\s\S]*SPEED BAG[\s\S]*6TH[\s\S]*YOU[\s\S]*NEW BEST[\s\S]*VIEW BOARD[\s\S]*YOUR PROGRESS[\s\S]*LEVEL 14[\s\S]*TRAIN AGAIN[\s\S]*BACK TO START/,
    rows: { cpu: 2, you: 1, player: 1 },
  },
  {
    s: 'optin',
    expect: /NEW[\s\S]*HIGH SCORES[\s\S]*WORLD BOARD[\s\S]*Put your best scores on the world board\?[\s\S]*display name and level[\s\S]*Never your email, photo or location[\s\S]*DISPLAY NAME[\s\S]*Everyone sees it[\s\S]*Show my country \(US\)[\s\S]*NOT NOW[\s\S]*JOIN[\s\S]*Leave any time in Profile/,
    input: 'Trainee',
  },
  { s: 'gallery', url: 'score-looks', expect: /THE SCORE BOARD[\s\S]*NEW BEST, TOP 10 · board-top10[\s\S]*OUTSIDE THE TOP 10 · board-busy[\s\S]*HIGH SCORES CARD · endcard[\s\S]*JOIN THE WORLD BOARD · optin/ },
  {
    s: 'retention-f4', url: 'retention-looks', shot: '#f4',
    expect: /GAME-OVER SCORE BOARD[\s\S]*A · New best, in the top 10[\s\S]*HIGH SCORES[\s\S]*B · On the end screen[\s\S]*VIEW BOARD[\s\S]*First time[\s\S]*JOIN/,
    absent: /WEEKLY LEAGUES|4 LEAGUES/,
  },
];

// ── the checks (fit-looks-preview's measure, plus one line a board row) ─────
// Runs in the page. Returns { fails: [...], warns: [...] }.
function measure({ checkSelectors, navClear, rootSel }) {
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
  // A board row is one line: every piece inside the row's box, none wrapped,
  // and the pieces side by side with no overlap.
  for (const rowEl of document.querySelectorAll('[data-sb-row]')) {
    if (!shown(rowEl)) continue;
    const rr = rowEl.getBoundingClientRect();
    const parts = [...rowEl.querySelectorAll('span')].filter((el) => shown(el) && ownText(el));
    for (const el of parts) {
      const r = el.getBoundingClientRect();
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (r.left < rr.left - 1 || r.right > rr.right + 1 || r.top < rr.top - 1 || r.bottom > rr.bottom + 1) fails.push(`row piece outside its row: ${name(el)} in ${name(rowEl)}`);
      if (r.height > fs * 1.9) fails.push(`row piece on two lines: ${name(el)}`);
    }
    const cells = [...rowEl.children].filter(shown).map((c) => c.getBoundingClientRect());
    for (let i = 1; i < cells.length; i++) if (cells[i].left < cells[i - 1].right - 1) fails.push(`row cells overlap: ${name(rowEl)}`);
    const nameCell = rowEl.children[1];
    if (nameCell) {
      const kids = [...nameCell.children].filter(shown);
      const used = kids.reduce((a, k) => a + k.getBoundingClientRect().width, 0) + Math.max(0, kids.length - 1) * 5;
      if (used > nameCell.getBoundingClientRect().width + 1) fails.push(`name and tags do not fit: ${name(rowEl)} (${Math.round(used)} > ${Math.round(nameCell.getBoundingClientRect().width)})`);
    }
  }
  // The whole page in one window: its last text or button ends above the tab bar.
  if (navClear) {
    const nav = document.querySelector('[data-guide="nav-tabs"]');
    const root = document.querySelector(rootSel);
    if (nav && root) {
      const top = nav.getBoundingClientRect().top;
      for (const el of root.querySelectorAll('button, a, h1, h2, span, div, p, input')) {
        if (nav.contains(el) || !shown(el) || !(ownText(el) || el.tagName === 'BUTTON' || el.tagName === 'INPUT')) continue;
        const r = el.getBoundingClientRect();
        if (r.bottom > top + 1 && r.top < window.innerHeight) { fails.push(`under the tab bar: ${name(el)} (ends ${Math.round(r.bottom)}, bar at ${Math.round(top)})`); break; }
      }
    }
  }
  return { fails: [...new Set(fails)], warns: [...new Set(warns)] };
}

// The board's rows by kind, in order.
const boardRows = () => [...document.querySelectorAll('[data-sb-row]')].map((el) => el.getAttribute('data-sb-row'));

// Where the state's content ends (its last text, button or box with text),
// in page pixels, the tab bar left out.
const contentEnd = () => {
  const root = document.querySelector('[data-sl-state]');
  const nav = document.querySelector('[data-guide="nav-tabs"]');
  if (!root) return 0;
  const scroller = [...root.querySelectorAll('*')].find((el) => ['auto', 'scroll'].includes(getComputedStyle(el).overflowY));
  const off = scroller ? scroller.scrollTop : 0;
  let end = 0;
  for (const el of root.querySelectorAll('button, input, span, div, p, h1, h2, a')) {
    if (nav && nav.contains(el)) continue;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) || el.tagName === 'BUTTON' || el.tagName === 'INPUT';
    if (!own) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden') end = Math.max(end, r.bottom + off);
  }
  return end;
};

// ── run ────────────────────────────────────────────────────────────────────
const launchOpts = { headless: true };
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
      if (localStorage.getItem('__sl')) return;
      localStorage.clear();
      for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
      localStorage.setItem('__sl', '1');
    }, SEED);
    const page = await ctx.newPage();
    await page.clock.install({ time: NOW.getTime() });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
    const file = path.join(OUT, `${st.s}-${w}.png`);
    let res = { fails: [], warns: [] };
    try {
      await page.goto(`${BASE}${st.url || `score-looks?s=${st.s}`}`, { waitUntil: 'networkidle', timeout: 180000 });
      await page.evaluate(() => document.fonts?.ready);
      await wait(page, st.shot ? 2500 : 1600);
      const check = st.shot ? [st.shot] : ['[data-sl-state]'];
      res = await page.evaluate(measure, { checkSelectors: check, navClear: false, rootSel: '[data-sl-state]' });
      const text = await page.evaluate((sel) => (sel ? document.querySelector(sel)?.innerText || '' : document.body.innerText), st.shot || null);
      if (st.expect && !st.expect.test(text)) res.fails.unshift(`expected ${st.expect} on screen`);
      if (st.absent && st.absent.test(text)) res.fails.unshift(`expected no ${st.absent} on screen`);
      if (st.rows) {
        const kinds = await page.evaluate(boardRows);
        const n = (k) => kinds.filter((x) => x === k).length;
        for (const k of ['cpu', 'you', 'player']) if (n(k) !== st.rows[k]) res.fails.push(`expected ${st.rows[k]} ${k} rows, found ${n(k)}`);
        if (st.fade) {
          const lastReal = Math.max(kinds.lastIndexOf('player'), kinds.lastIndexOf('you'));
          if (kinds.slice(0, lastReal).includes('cpu')) res.fails.push('a CPU row sits above a real player on a board with 5 or more players');
        }
      }
      if (st.input != null) {
        const v = await page.evaluate(() => document.querySelector('[data-retention="board-optin"] input')?.value);
        if (v !== st.input) res.fails.push(`expected the name box to hold "${st.input}", found "${v}"`);
      }
      if (st.shot) {
        // A window as tall as the section, so all of it is painted; then the
        // section, and each of its looks on its own (readable at phone size).
        const tallH = await page.evaluate((sel) => Math.ceil(document.querySelector(sel).getBoundingClientRect().height) + 40, st.shot);
        await page.setViewportSize({ width: w, height: Math.min(12000, tallH) });
        await page.locator(st.shot).scrollIntoViewIfNeeded();
        await wait(page, 1500);
        const tall = await page.evaluate(measure, { checkSelectors: check, navClear: false, rootSel: st.shot });
        res.fails.push(...tall.fails.filter((f) => !res.fails.includes(f)));
        await page.locator(st.shot).screenshot({ path: file });
        const looks = page.locator(`${st.shot} .rl-grid > section`);
        const n = await looks.count();
        for (let i = 0; i < n; i++) await looks.nth(i).screenshot({ path: path.join(OUT, `${st.s}-look${i + 1}-${w}.png`) });
      } else {
        // The window is made as tall as the content needs (where the content
        // ends, plus the 110 px the app keeps clear over the tab bar). Not by
        // the column's scroll height: the phone frame is at least a screen
        // tall, so that would grow forever. A taller window can show more (the
        // end screen keeps its recap and feedback link for phones over 812 px
        // tall), so it is measured again until it settles. The whole page must
        // then end above the tab bar.
        let tallH = h;
        {
          for (let k = 0; k < 4; k++) {
            const need = Math.min(9000, Math.ceil((await page.evaluate(contentEnd)) + 110));
            if (need <= tallH) break;
            tallH = need;
            await page.setViewportSize({ width: w, height: tallH });
            await wait(page, 500);
          }
          await wait(page, 200);
          const tall = await page.evaluate(measure, { checkSelectors: check, navClear: st.s !== 'gallery', rootSel: '[data-sl-state]' });
          res.fails.push(...tall.fails.filter((f) => !res.fails.includes(f)));
          res.warns.push(...tall.warns.filter((f) => !res.warns.includes(f)));
        }
        await page.screenshot({ path: file, fullPage: true });
      }
    } catch (e) {
      res.fails.push(`could not open: ${e.message.split('\n')[0]}`);
    }
    if (errors.length) res.fails.push(`page errors: ${errors.join(' | ')}`);
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

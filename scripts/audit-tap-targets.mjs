#!/usr/bin/env node
/**
 * Tap-target audit.
 *
 * Finds controls the athlete can SEE but cannot TAP — the class of bug where an
 * APPLY / START / EXECUTE button renders underneath the bottom tab bar (or any
 * other overlay) because its z-index is trapped inside a stacking context. That
 * is what happened to the workout builder's EDIT sheet: APPLY was rendered,
 * looked fine in the DOM, and was physically unpressable.
 *
 * How it decides: for every clickable element in every reachable app state it
 * runs document.elementFromPoint() at the element's centre. If the browser
 * hands back something that is NOT that element (nor an ancestor/descendant of
 * it), a real finger press would land on whatever is on top instead. This is
 * the same hit test the browser performs on a touch, so it cannot be fooled by
 * an element that merely looks visible.
 *
 * Note this app builds most of its controls from <div onClick> rather than
 * <button>, so "clickable" is detected by computed cursor:pointer as well as by
 * tag. Crawl steps click through in-page element.click() (React's delegated
 * listener picks up the synthetic MouseEvent) so a step never depends on a
 * selector staying stable between replays.
 *
 * Exploration is breadth-first. There is no reliable global back in this app,
 * so each state is reached by replaying its click path from a fresh load —
 * slower than clicking around, but it never gets lost mid-session.
 *
 *   node scripts/audit-tap-targets.mjs [--url http://localhost:4599]
 *                                      [--depth 4] [--budget 240] [--shots DIR]
 *
 * Exits 1 if any ACTION control (a verb that commits training — start, apply,
 * save, execute…) is unreachable, so CI can gate on it.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// playwright-core is a dev-only tool, deliberately NOT a package.json
// dependency — nothing in the shipped app imports it.
const require_ = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require_(process.env.PLAYWRIGHT_CORE || 'playwright-core'));
} catch {
  console.error(
    'playwright-core not found.\n' +
    '  npm i --no-save playwright-core\n' +
    '  # or point at an existing copy:\n' +
    '  PLAYWRIGHT_CORE=/path/to/playwright-core node scripts/audit-tap-targets.mjs',
  );
  process.exit(2);
}

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const URL_ = arg('url', 'http://localhost:4599');
const MAX_DEPTH = Number(arg('depth', 4));
const BUDGET_S = Number(arg('budget', 240));
const SHOTS = arg('shots', null);
const EXEC = process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium';

// Controls whose label commits training. These MUST be reachable — a buried
// APPLY silently discards the athlete's edit, which is exactly the reported bug.
const ACTION = /\b(APPLY|EXECUTE|START|BEGIN|SAVE|GENERATE|CONFIRM|COMPLETE|FINISH|DONE|CONTINUE|NEXT|LOCK ?IN|ACCEPT|RESUME|REMATCH|CLAIM|SUBMIT|LAUNCH|ANSWER THE BELL|BEAT THIS RUN)\b/i;

// Never crawl into these: they leave the flow or destroy state.
const NO_CRAWL = /^(HOME|TRAIN|PROGRESS|PROFILE)$|\b(STOP|QUIT|EXIT|DELETE|RESET|LOG ?OUT|SIGN OUT)\b/i;

// A small phone is where a tall sheet runs out of room; a tall phone is where a
// fixed footer sits furthest from its content.
const VIEWPORTS = [
  { name: 'iphone-se', width: 375, height: 667 },
  { name: 'pixel-7', width: 412, height: 883 },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Injected into every page: the single definition of "a thing a finger can
// press", shared by the hit test and the crawler so they never disagree.
const INIT = `
window.__tmCands = function () {
  const out = [];
  const seen = new Set();
  const tagged = document.querySelectorAll('button, [role="button"], a[href], input, select, textarea');
  const pointered = [...document.querySelectorAll('div, span, li, label')].filter((el) => {
    if (getComputedStyle(el).cursor !== 'pointer') return false;
    // A pointer container whose child is also pointer is chrome, not the target.
    return ![...el.children].some((c) => getComputedStyle(c).cursor === 'pointer');
  });
  for (const el of [...tagged, ...pointered]) {
    if (seen.has(el)) continue;
    seen.add(el);
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) continue;
    if (s.pointerEvents === 'none') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    // textContent swallows any <style>/<script> a wrapper happens to contain,
    // which turns a card's label into a CSS dump. Read visible text only.
    let text = el.getAttribute('aria-label');
    if (!text) {
      const clone = el.cloneNode(true);
      clone.querySelectorAll('style, script').forEach((n) => n.remove());
      text = clone.textContent || '';
    }
    const label = text.trim().replace(/\\s+/g, ' ').slice(0, 60);
    out.push({ el, label, r, s });
  }
  return out;
};
window.__tmProbe = function () {
  return window.__tmCands().map((c, idx) => {
    const { el, label, r } = c;
    const offscreen = r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth;
    const cx = Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1);
    const cy = Math.min(Math.max(r.top + r.height / 2, 1), innerHeight - 1);
    let blockedBy = null;
    if (!offscreen) {
      const hit = document.elementFromPoint(cx, cy);
      if (!hit) blockedBy = '(no element at centre)';
      else if (hit !== el && !el.contains(hit) && !hit.contains(el)) {
        const hs = getComputedStyle(hit);
        const cls = typeof hit.className === 'string' && hit.className ? '.' + hit.className.split(' ')[0] : '';
        blockedBy = hit.tagName.toLowerCase() + cls + ' z=' + hs.zIndex +
          ' "' + (hit.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 30) + '"';
      }
    }
    // Off-screen is only a defect if nothing can bring it into view. A saga
    // carousel slide sitting at x=-494 is one swipe away, not a bug — so check
    // horizontal scrollers too, not just vertical ones.
    let scrollable = false;
    if (offscreen) {
      let a = el.parentElement;
      while (a) {
        const as = getComputedStyle(a);
        if (/(auto|scroll)/.test(as.overflowY) && a.scrollHeight > a.clientHeight + 4) { scrollable = true; break; }
        if (/(auto|scroll)/.test(as.overflowX) && a.scrollWidth > a.clientWidth + 4) { scrollable = true; break; }
        a = a.parentElement;
      }
      if (!scrollable && document.documentElement.scrollHeight > innerHeight + 4) scrollable = true;
    }
    return {
      idx, label,
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      offscreen, scrollable, blockedBy,
      tiny: r.width < 28 || r.height < 28,
    };
  });
};
// Drive every scrollable region to one end. A control covered by the fixed tab
// bar at rest may be perfectly tappable once the athlete scrolls — only a
// control that stays buried at BOTH ends of the scroll is actually lost.
window.__tmScrollAll = function (where) {
  const regions = [document.scrollingElement, ...document.querySelectorAll('*')].filter((el) => {
    if (!el || el === document.scrollingElement) return true;
    const s = getComputedStyle(el);
    return /(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 4;
  });
  for (const el of regions) {
    try { el.scrollTop = where === 'bottom' ? el.scrollHeight : 0; } catch (e) {}
  }
};
window.__tmClick = function (idx) {
  const c = window.__tmCands()[idx];
  if (!c) return false;
  c.el.click();
  return true;
};
window.__tmSig = function () {
  return (document.body.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 220);
};
`;

async function land(page) {
  // A dev server hiccup should cost one state, not the whole run.
  for (let attempt = 0; ; attempt++) {
    try { await page.goto(URL_, { waitUntil: 'domcontentloaded' }); break; }
    catch (e) {
      if (attempt >= 2) throw e;
      await sleep(1200);
    }
  }
  await sleep(1800);
  // Splash is "TAP ANYWHERE TO ENTER" — a full-bleed handler, not a button.
  for (let i = 0; i < 3; i++) {
    const sig = await page.evaluate(() => window.__tmSig()).catch(() => '');
    if (!/TAP ANYWHERE|TACTICAL COMBAT FITNESS SYSTEM/i.test(sig)) break;
    await page.mouse.click(Math.round(page.viewportSize().width / 2), Math.round(page.viewportSize().height / 2));
    await sleep(1100);
  }
}

async function replay(page, path) {
  await land(page);
  for (const step of path) {
    const ok = await page.evaluate((i) => window.__tmClick(i), step).catch(() => false);
    if (!ok) return false;
    await sleep(850);
  }
  return true;
}

async function auditViewport(browser, vp) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  // Seeded before any app code runs, so the app never sees the onboarding gate.
  await ctx.addInitScript(`
    try {
      localStorage.setItem('trainingModeOnboardingComplete', 'true');
      localStorage.setItem('trainingModeTourComplete', 'true');
    } catch (e) {}
    ${INIT}
  `);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  const findings = [];
  const visited = new Set();
  const queue = [[]];
  const started = Date.now();
  const screens = [];

  while (queue.length && (Date.now() - started) / 1000 < BUDGET_S) {
    const path = queue.shift();
    if (path.length > MAX_DEPTH) continue;
    if (!(await replay(page, path))) continue;

    const sig = await page.evaluate(() => window.__tmSig()).catch(() => '');
    if (!sig || visited.has(sig)) continue;
    visited.add(sig);
    screens.push(sig.slice(0, 60));

    // Probe at both ends of the scroll. A control is only reported when it is
    // unreachable in BOTH — otherwise a scroll would have freed it.
    await page.evaluate(() => window.__tmScrollAll('top')).catch(() => {});
    await sleep(220);
    const atTop = await page.evaluate(() => window.__tmProbe()).catch(() => []);
    await page.evaluate(() => window.__tmScrollAll('bottom')).catch(() => {});
    await sleep(320);
    const atBottom = await page.evaluate(() => window.__tmProbe()).catch(() => []);

    const bad = (it) => it.blockedBy || (it.offscreen && !it.scrollable);
    const bottomByLabel = new Map();
    for (const it of atBottom) if (it.label) bottomByLabel.set(it.label, it);

    for (const it of atTop) {
      if (!it.label || !bad(it)) continue;
      const other = bottomByLabel.get(it.label);
      // Gone after scrolling (unmounted) or freed — not a defect.
      if (!other || !bad(other)) continue;
      findings.push({
        viewport: vp.name,
        screen: sig.slice(0, 60),
        label: it.label,
        rect: other.rect,
        reason: other.blockedBy ? `covered by ${other.blockedBy}` : 'off-screen, nothing scrolls it into view',
        action: ACTION.test(it.label),
      });
      if (SHOTS && ACTION.test(it.label)) {
        mkdirSync(SHOTS, { recursive: true });
        await page.screenshot({ path: `${SHOTS}/${vp.name}-${findings.length}.png` }).catch(() => {});
      }
    }

    if (path.length < MAX_DEPTH) {
      await page.evaluate(() => window.__tmScrollAll('top')).catch(() => {});
      await sleep(200);
      for (const it of atTop) {
        if (!it.label || NO_CRAWL.test(it.label)) continue;
        if (it.blockedBy || it.offscreen) continue;
        queue.push([...path, it.idx]);
      }
    }
  }

  await ctx.close();
  return { findings, screens, errors: [...new Set(errors)] };
}

const browser = await chromium.launch({ executablePath: EXEC });
const all = [];
const allScreens = new Set();
const pageErrors = new Set();

for (const vp of VIEWPORTS) {
  process.stdout.write(`▸ ${vp.name} (${vp.width}x${vp.height}) … `);
  const { findings, screens, errors } = await auditViewport(browser, vp);
  console.log(`${screens.length} states, ${findings.length} unreachable`);
  screens.forEach((s) => allScreens.add(s));
  errors.forEach((e) => pageErrors.add(e));
  all.push(...findings);
}
await browser.close();

// Collapse one control appearing across many states.
const byKey = new Map();
for (const f of all) {
  const k = `${f.label}|${f.reason}`;
  if (!byKey.has(k)) byKey.set(k, { ...f, screens: new Set([f.screen]) });
  else byKey.get(k).screens.add(f.screen);
}
const uniq = [...byKey.values()].sort((a, b) => Number(b.action) - Number(a.action));
const critical = uniq.filter((f) => f.action);

console.log('\n' + '─'.repeat(66));
console.log(`Crawled ${allScreens.size} distinct states across ${VIEWPORTS.length} viewports.`);
console.log(`${critical.length} ACTION control(s) unreachable · ${uniq.length - critical.length} other.`);
for (const f of uniq) {
  console.log(`\n${f.action ? '✗ ACTION' : '·       '} "${f.label}"`);
  console.log(`          ${f.reason}`);
  console.log(`          rect ${JSON.stringify(f.rect)} · ${f.viewport} · ${f.screens.size} state(s)`);
  console.log(`          e.g. ${[...f.screens][0].slice(0, 66)}`);
}
if (pageErrors.size) {
  console.log('\nPage errors seen while crawling:');
  pageErrors.forEach((e) => console.log('  !', e.slice(0, 160)));
}
if (SHOTS) {
  mkdirSync(SHOTS, { recursive: true });
  writeFileSync(`${SHOTS}/findings.json`, JSON.stringify({
    states: [...allScreens],
    findings: uniq.map((f) => ({ ...f, screens: [...f.screens] })),
  }, null, 2));
  console.log(`\nWrote ${SHOTS}/findings.json`);
}

process.exit(critical.length ? 1 : 0);

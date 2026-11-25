// Button looks preview: the hidden /button-looks page, every look (NOW and
// LOOKS 1 to 4) and panel (setup, library, end, kit) photographed at 360x780
// and 390x844, device scale 2, then ONE comparison sheet per panel and size
// (NOW and LOOK 1 to 4 side by side, labelled; needs ImageMagick's montage).
// Fails when a page overflows sideways, a look's button is under 44 px, a
// drawn button is cut off by the screen edge, or a label is under 4.5:1.
//
//   node scripts/button-looks-preview.mjs <out-dir> [--base http://localhost:8081] [--only <regex>]
//
// Needs the dev server: CI=1 EXPO_NO_TELEMETRY=1 npx expo start --web --port 8081
// Chrome: CHROME_PATH, or Playwright's chromium (/opt/pw-browsers/chromium).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { LOOKS, contrastPairs } from '../components/training-mode/button-looks/looks.js';

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const OUT = args.find((a, i) => !a.startsWith('--') && !['--base', '--only'].includes(args[i - 1]));
const BASE = (opt('--base') || 'http://localhost:8081').replace(/\/$/, '') + '/';
const ONLY = opt('--only') ? new RegExp(opt('--only')) : null;
if (!OUT) { console.error('usage: node scripts/button-looks-preview.mjs <out-dir> [--base URL] [--only regex]'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });

const SIZES = [[360, 780], [390, 844]];
// 'applied' is the app as it is now, with the picked look built in (no look scope).
const IDS = ['now', 'applied', ...LOOKS.map((l) => l.id)];
const LABEL = { now: 'BEFORE (old buttons)', applied: 'APPLIED (the app)', raised: 'LOOK 1 · RAISED CUT', round: 'LOOK 2 · RAISED ROUND', neon: 'LOOK 3 · NEON COLOUR' };
const PANELS = ['setup', 'library', 'end', 'kit'];
const PANEL_WORD = { setup: 'Quick Mission setup', library: 'Library sheet', end: 'End screen', kit: 'Every kind' };

// ── contrast, from the palettes ────────────────────────────────────────────
const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const x = lum(a); const y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
let failures = 0;
for (const l of LOOKS) {
  let min = 99;
  for (const p of contrastPairs(l)) if (p.fg.startsWith('#') && p.bg.startsWith('#')) min = Math.min(min, ratio(p.fg, p.bg));
  const ok = min >= 4.5;
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} contrast ${l.id}: lowest label ${min.toFixed(2)}:1 (needs 4.5)`);
}

// ── in-page measure ────────────────────────────────────────────────────────
const TARGETS = '.fk-seg,.fk-chip,.fk-ghost,.bl-quiet,.bl-danger,.qm-lib,[data-guide="qm-adjust"],[aria-controls^="ml-drop-"],.fk-end2,.fk-home';
function measure({ look, TARGETS }) {
  const fails = [];
  const W = window.innerWidth;
  const de = document.documentElement;
  if (de.scrollWidth > W + 1) fails.push(`page is ${de.scrollWidth}px wide at ${W}`);
  const seen = new Set();
  for (const el of document.querySelectorAll(TARGETS)) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const name = (el.getAttribute('aria-label') || el.textContent || el.className).trim().slice(0, 24);
    if (look !== 'now' && (r.height < 43.5 || r.width < 43.5) && !seen.has(name)) { seen.add(name); fails.push(`tap target "${name}" is ${Math.round(r.width)}x${Math.round(r.height)}`); }
    if (r.right > W + 0.5 || r.left < -0.5) fails.push(`"${name}" runs off the screen (${Math.round(r.left)}..${Math.round(r.right)})`);
  }
  // A drawn layer is clipped when its own box is cut by the parent's overflow.
  let n = 0;
  for (const el of document.querySelectorAll(TARGETS)) { if (getComputedStyle(el).filter !== 'none') n++; }
  return { fails, styled: n };
}

// ── run ────────────────────────────────────────────────────────────────────
const SEED = { trainingModeOnboardingComplete: 'true', trainingModeTourComplete: 'true' };
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { executablePath: '/opt/pw-browsers/chromium' }) });
const files = {};
for (const panel of PANELS) {
  for (const id of IDS) {
    if (ONLY && !ONLY.test(`${id}-${panel}`)) continue;
    for (const [w, h] of SIZES) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
      await ctx.addInitScript((seed) => {
        try { Object.defineProperty(window, 'speechSynthesis', { value: undefined }); } catch { /* read-only */ }
        // One fixed pseudo-random run, so the sample mission is the same in every photo.
        let s = 12345; Math.random = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
        if (localStorage.getItem('__bl')) return;
        localStorage.clear();
        for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
        localStorage.setItem('tm_equipment', JSON.stringify(['KETTLEBELL', 'DUMBBELL']));
        localStorage.setItem('__bl', '1');
      }, SEED);
      const page = await ctx.newPage();
      await page.clock.install({ time: new Date(2026, 10, 24, 10, 0, 0).getTime() });
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 160)));
      const file = path.join(OUT, `${panel}-${id}-${w}.png`);
      const fails = [];
      try {
        await page.goto(`${BASE}button-looks?look=${id}&panel=${panel}`, { waitUntil: 'networkidle', timeout: 240000 });
        await page.evaluate(() => document.fonts?.ready);
        await page.waitForTimeout(1800);
        if (panel === 'library') {
          // The second row's + dropped open: a closed and an open one in the photo.
          const drops = page.locator('button[aria-controls^="ml-drop-"]');
          await drops.nth(1).click().catch(() => {});
          await page.waitForTimeout(600);
        }
        if (panel === 'end') await page.waitForTimeout(1200);
        const m = await page.evaluate(measure, { look: id, TARGETS });
        fails.push(...m.fails);
        if (id !== 'now' && id !== 'applied' && !m.styled && panel !== 'kit') fails.push('the look styled no button on this panel');
        await page.screenshot({ path: file });
        (files[`${panel}-${w}`] ||= {})[id] = file;
      } catch (e) {
        fails.push(`could not open: ${e.message.split('\n')[0]}`);
      }
      if (errors.length) fails.push(`page errors: ${errors.join(' | ')}`);
      if (fails.length) failures++;
      console.log(`${fails.length ? 'FAIL' : 'ok  '} ${panel} ${id} @${w}x${h}`);
      for (const f of [...new Set(fails)].slice(0, 8)) console.log(`       ✗ ${f}`);
      await ctx.close();
    }
  }
}
await browser.close();

// ── one comparison sheet per panel and size ────────────────────────────────
for (const [key, byLook] of Object.entries(files)) {
  const [panel, w] = key.split('-');
  const ordered = IDS.filter((id) => byLook[id]);
  if (ordered.length < 2) continue;
  const labelled = ordered.map((id) => {
    const out = path.join(OUT, `.lab-${panel}-${id}-${w}.png`);
    execFileSync('convert', [byLook[id], '-background', '#120a24', '-fill', id === 'now' ? '#cbc6e0' : '#F2BE45', '-font', 'DejaVu-Sans-Bold', '-pointsize', '30', '-gravity', 'center', `label:${LABEL[id]}`, '+swap', '-append', out]);
    return out;
  });
  const sheet = path.join(OUT, `sheet-${panel}-${w}.png`);
  execFileSync('montage', [...labelled, '-tile', `${ordered.length}x1`, '-geometry', '+14+14', '-background', '#080012', sheet]);
  for (const f of labelled) fs.unlinkSync(f);
  console.log(`sheet ${PANEL_WORD[panel]} @${w} → ${sheet}`);
}
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);

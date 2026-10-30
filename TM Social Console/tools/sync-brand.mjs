// Pulls the app's facts and art into the console so videos and captions never
// drift from what the app shows. Source: ../content-kit/content-kit.json (made
// by `npm run content:kit` in the app) and the app's ../public art.
//
//   brand/brand.json   committed; what the video templates and copy checks read
//   public/tm/...      art copies (git-ignored; re-run this after `git pull`)
import fs from 'node:fs';
import path from 'node:path';
import { REPO, ROOT, BRAND, writeJson } from './lib.mjs';

const KIT = path.join(REPO, 'content-kit', 'content-kit.json');
if (!fs.existsSync(KIT)) {
  console.error(`Missing ${KIT}. The console must sit inside the Training Mode app folder (next to content-kit/).`);
  process.exit(1);
}
const kit = JSON.parse(fs.readFileSync(KIT, 'utf8'));

// Copies an app asset into public/tm/<to> and returns the staticFile() path.
const copied = [];
const missing = [];
function art(a, to) {
  if (!a) return null;
  const from = path.join(REPO, 'public', a.path);
  if (!fs.existsSync(from)) { missing.push(a.path); return null; }
  const rel = `tm/${to}${path.extname(a.path)}`;
  const dest = path.join(ROOT, 'public', rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(from, dest);
  copied.push(rel);
  return rel;
}

const logoName = (p) => path.basename(p, path.extname(p)).replace(/^logo-/, '');
const brand = {
  syncedAt: new Date().toISOString().slice(0, 10),
  source: 'npm run sync (tools/sync-brand.mjs) from ../content-kit — do not edit by hand',
  name: kit.brand.name,
  coach: kit.brand.coach,
  appUrl: kit.brand.appUrl,
  siteUrl: kit.brand.siteUrl,
  socials: kit.brand.socials,
  colors: kit.brand.colors,
  // Two typefaces only: Orbitron for titles, Rajdhani for everything else.
  fonts: { display: 'Orbitron', body: 'Rajdhani' },
  logos: Object.fromEntries(kit.brand.logos.map((l) => [logoName(l.path), art(l, `logos/${logoName(l.path)}`)])),
  rules: kit.rules,
  modes: kit.modes,
  pro: kit.pro,
  ranks: kit.ranks.map((r) => ({ id: r.id, name: r.name, label: r.label, xpFrom: r.xpFrom, color: r.color, art: art(r.art, `ranks/${r.id}`) })),
  drops: kit.drops.map((d) => ({
    id: d.id, title: d.title, tagline: d.tagline, start: d.start, end: d.end, status: d.status,
    reward: d.reward, tierLabels: d.tierLabels,
    fitWeeks: d.fit.weeks, fitMinutesPerDay: d.fit.minutesPerDay, fightDiscipline: d.fight.discipline,
    arcadeStages: d.arcade.map((s) => s.title),
    art: Object.fromEntries(Object.entries(d.art).map(([k, v]) => [k, art(v, `drops/${d.id}/${k}`)])),
  })),
  sagas: kit.sagas.map((s) => ({ id: s.id, title: s.title, subtitle: s.subtitle, status: s.status, retires: s.retires, stages: s.stages })),
  tapes: kit.tapes.map((t) => ({ number: t.number, title: t.title, shelf: t.shelf, minutes: t.minutes, gear: t.gear, youtubeId: t.youtubeId })),
  workouts: kit.workouts.map((w) => ({ title: w.title, focus: w.focus, minutes: w.minutes, pro: w.pro })),
  programs: kit.programs.map((p) => ({ title: p.title, meta: p.meta, pro: p.pro })),
};

// The Fight Focus timer's own art, for videos that recreate the app's screen.
art({ path: '/static/ring-fight.webp' }, 'ui/ring-fight');
art({ path: '/static/brand/background-w-logo.webp' }, 'ui/brand-bg');

// The app's boxing bell (single, double and triple ring; see src/parts/Bell.tsx).
art({ path: '/audio/boxing-bell-signals.mp3' }, 'audio/bell-signals');

// HyperFrames serves only its own folder, so it gets its own copies.
const hfAssets = path.join(ROOT, 'hyperframes', 'assets');
fs.mkdirSync(path.join(hfAssets, 'ranks'), { recursive: true });
for (const r of brand.ranks) if (r.art) fs.copyFileSync(path.join(ROOT, 'public', r.art), path.join(hfAssets, 'ranks', path.basename(r.art)));
fs.cpSync(path.join(ROOT, 'public', 'fonts'), path.join(hfAssets, 'fonts'), { recursive: true });
fs.cpSync(path.join(ROOT, 'public', 'tm', 'audio'), path.join(hfAssets, 'audio'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'public', brand.logos.mark), path.join(hfAssets, 'mark.webp'));
// GSAP served locally so renders work offline.
fs.copyFileSync(path.join(ROOT, 'node_modules', 'gsap', 'dist', 'gsap.min.js'), path.join(hfAssets, 'gsap.min.js'));
const ranks = brand.ranks.map((r) => ({ name: r.name, label: r.label, xpFrom: r.xpFrom, color: r.color, art: r.art && `assets/ranks/${path.basename(r.art)}` }));
fs.writeFileSync(path.join(ROOT, 'hyperframes', 'ranks.js'), `// Written by npm run sync from the app's ranks. Do not edit.\nwindow.TM_RANKS = ${JSON.stringify(ranks, null, 2)};\n`);

fs.mkdirSync(path.dirname(BRAND), { recursive: true });
writeJson(BRAND, brand);
const live = brand.drops.find((d) => d.status === 'live');
console.log(`brand synced from content kit (${kit.generatedAt}): ${copied.length} art files, live drop ${live ? live.title : 'none'}`);
if (missing.length) console.warn(`missing in app public/: ${missing.join(', ')}`);

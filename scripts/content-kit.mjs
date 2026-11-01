// Content kit: every fact a post, reel, caption or thumbnail needs, pulled
// straight from the app's data so the social media project never drifts from
// what the app actually shows. Writes content-kit/content-kit.json and a
// readable content-kit/README.md. Run with `npm run content:kit` after any
// change to drops, tapes, sagas, tiers, workouts or prices.
//
// Asset paths are the app's public paths; `url` is where the live app serves
// them, so another project can fetch art without copying files around.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TM = path.join(ROOT, 'components', 'training-mode');
const OUT = path.join(ROOT, 'content-kit');
const APP_URL = 'https://apptrainingmode.com';
const SITE_URL = 'https://trainingmode.co';
const asset = (p) => (p ? { path: p, url: APP_URL + p } : null);
const exists = (p) => !!p && fs.existsSync(path.join(ROOT, 'public', p));

const C = await import(path.join(TM, 'data/concepts/index.js'));
const { TAPES, tapeXp } = await import(path.join(TM, 'data/tapes.js'));
const A = await import(path.join(TM, 'data/trainingArcadeData.js'));
const { VISIBLE_TIERS, tierImage } = await import(path.join(TM, 'data/tiers.js'));
const { NAMED_WORKOUTS } = await import(path.join(TM, 'data/namedWorkouts.js'));
const { PLAN_PROGRAMS } = await import(path.join(TM, 'data/workoutLibrary.js'));
const LM = await import(path.join(TM, 'data/loadoutMissions.js'));
const { C: COLORS } = await import(path.join(TM, 'Styles.js'));

// Values that live inside components (not exported); read from source so they
// stay in step with the app.
const src = (f) => fs.readFileSync(path.join(TM, f), 'utf8');
const posterMap = Object.fromEntries([...src('TrainingArcade.jsx').matchAll(/'([a-z0-9-]+)':\s*'(\/static\/series\/posters\/[^']+)'/g)].map(m => [m[1], m[2]]));
const proBenefits = [...(src('Paywall.jsx').match(/const BENEFITS = \[([\s\S]*?)\];/)?.[1] || '').matchAll(/'([^']+)'/g)].map(m => m[1]);
const prices = [...src('data/stripe.js').matchAll(/(\w+): \{ id: '\w+', label: '([^']+)', price: '([^']+)', cadence: '([^']+)', sub: '([^']+)'/g)]
  .map(m => ({ id: m[1], label: m[2], price: m[3], cadence: m[4], note: m[5] }));
const replaces = Object.fromEntries([...src('data/concepts/saga.js').matchAll(/'([a-z-]+)': '([a-z-]+-protocol)'/g)].map(m => [m[2], m[1]]));

const dropFor = (conceptId) => C.CONCEPT_SCHEDULE.find(e => e.concept.id === conceptId);
const today = new Date();
const iso = (d) => d.toISOString().slice(0, 10);

const drops = C.CONCEPT_SCHEDULE.map(({ concept: c, start, end }) => ({
  id: c.id, title: c.title, tagline: c.tagline, start, end,
  status: C.windowState({ start, end }, today.getTime()),
  reward: { title: c.reward.title, xp: c.reward.xp },
  tierLabels: c.tierLabels || { easy: 'ROOKIE', normal: 'NORMAL', hard: 'ELITE' },
  art: Object.fromEntries(Object.entries(c.art || {}).map(([k, v]) => [k, asset(v)])),
  fit: {
    weeks: c.fit.weeks, minutesPerDay: c.fit.minutes,
    days: c.fit.days.map(d => (d.rest ? { label: d.label, rest: true } : { label: d.label, focus: d.focus, run: !!d.run, moves: (d.exercises || []).map(x => x.name) })),
  },
  fight: {
    discipline: c.fight.discipline, weeks: c.fight.weeks || 1, roundMin: c.fight.roundMin,
    days: c.fight.days.map(d => ({ label: d.label, focus: d.focus, rounds: d.rounds.map(r => r.title) })),
  },
  arcade: c.arcade.stages.map((s, i) => ({ stage: i + 1, title: s.title, boss: !!s.boss, format: s.format || null })),
}));

const sagas = A.VISIBLE_ARCADE_SERIES.map(s => {
  const drop = replaces[s.id] ? dropFor(replaces[s.id]) : null;
  return {
    id: s.id, title: s.title, subtitle: s.subtitle,
    playable: s.status === 'active',
    status: s.status === 'active' ? 'open' : (s.stages || []).length ? 'locked' : 'coming soon',
    retires: drop ? { on: drop.start, replacedBy: drop.concept.title } : null,
    stages: (s.stages || []).map(st => st.title),
    poster: posterMap[s.id] && exists(posterMap[s.id]) ? asset(posterMap[s.id]) : (posterMap[s.id] ? asset(posterMap[s.id]) : null),
  };
});

const kit = {
  generatedAt: iso(today),
  source: 'npm run content:kit (scripts/content-kit.mjs) — do not edit by hand',
  brand: {
    name: 'Training Mode', coach: 'Coach TM',
    appUrl: APP_URL, siteUrl: SITE_URL,
    socials: { instagram: 'https://www.instagram.com/trainingmode.co/', tiktok: 'https://www.tiktok.com/@trainingmode.co', youtube: 'https://www.youtube.com/@trainingmode.co', facebook: 'https://www.facebook.com/trainingmode.co' },
    colors: { background: COLORS.bg, panel: COLORS.panel, violet: COLORS.violet, gold: COLORS.gold, red: COLORS.red, green: COLORS.green, text: COLORS.text, muted: COLORS.muted },
    fonts: { display: 'Orbitron', ui: 'Chakra Petch', body: 'Rajdhani', pixel: 'Press Start 2P' },
    logos: ['/static/logo-title-full.webp', '/static/logo-wordmark-full.webp', '/static/logo-mark.webp', '/static/app-icon.webp'].filter(exists).map(asset),
  },
  rules: {
    naming: 'App names only. No franchise or character names, and no film references, in titles, on-screen text, captions or thumbnails.',
    neverSay: ['Ryu', 'Ken', 'Akuma', 'Street Fighter', 'Goku', 'Vegeta', 'Dragon Ball', 'Ultra Instinct', 'Saitama', 'One Punch Man', 'Batman', 'Dark Knight', 'Gotham', 'Wonder Woman', 'Baki', 'Hanma', 'Sonic', 'Spider-Man', 'Guts', 'Berserk', 'Sparta'],
    xp: 'The app rewards the workout, never views, likes, follows or subscribes. CTA: "open the app and hit CLEARED".',
  },
  modes: {
    fit: ['Quick Mission', 'Build Workout', 'Programs', 'Cardio (GPS + machines)'],
    fight: ['Just Train', 'Fight Focus', 'Combo Coach', 'Training Camp (12 levels)', 'Practice', 'Combat Conditioning'],
    arcade: '10-stage sagas with a boss; pick FIT, FIGHT or BOTH on every stage.',
  },
  pro: { benefits: proBenefits, prices, freeAlways: 'The current concept drop is always free.' },
  ranks: VISIBLE_TIERS.map(t => ({ id: t.id, name: t.name, label: t.label, xpFrom: t.xp, color: t.color, art: asset(tierImage(t.id, 'male')) })),
  drops,
  tapes: TAPES.map(t => ({ number: t.num, id: t.id, title: t.title, shelf: t.kind, meta: t.meta, minutes: t.minutes, gear: t.gear, xp: tapeXp(t), liveVersionOf: t.live || null, youtubeId: t.youtubeId || null, art: asset(t.art) })),
  sagas,
  workouts: NAMED_WORKOUTS.map(w => ({ id: w.id, title: w.title, tag: w.tag, focus: w.focus, minutes: w.estMin, needs: w.needs || null, lines: (w.lines || []).map(([a, b]) => (b ? `${a} — ${b}` : a)), pro: !!w.pro })),
  // Quick Mission's loadout missions, as the card shows them at STANDARD with
  // no swaps. `captionAka` is the well-known name: captions only, never on screen.
  missions: LM.LOADOUT_MISSIONS.map((d) => {
    const c = LM.missionCardModel(LM.buildLoadoutMission(d.id, { gear: null }), { gear: null });
    return { id: d.id, title: c.title, loadout: c.loadoutLine, format: LM.FORMAT_LABEL[d.format] || d.format, mission: c.missionLine, score: c.scoreLine, tags: c.tags, themes: d.themes || [], moves: c.rows.map(r => `${r.dose} ${r.name}`.trim()), levels: LM.levelsOf(d), guided: d.guided !== false, captionAka: d.knownAs || null };
  }),
  programs: PLAN_PROGRAMS.map(p => ({ id: p.id, title: p.title, shelf: p.category, meta: p.meta, blurb: p.blurb, days: (p.days || []).map(d => d.label), pro: !!p.pro })),
};

// ── readable summary ────────────────────────────────────────────────────────
const md = [];
md.push('# Training Mode content kit', '', `Generated ${kit.generatedAt} from the app's own data by \`npm run content:kit\`. Don't edit by hand; the JSON next to this file has every field.`, '');
md.push('## Rules', '', `- ${kit.rules.naming}`, `- ${kit.rules.xp}`, '');
md.push('## Concept drops', '', '| Drop | Window | Status | Tagline | Limited title |', '|---|---|---|---|---|');
for (const d of drops) md.push(`| ${d.title} | ${d.start} → ${d.end} | ${d.status} | ${d.tagline} | ${d.reward.title} (+${d.reward.xp} XP) |`);
md.push('', "## Coach's Tapes", '', '| # | Title | Shelf | Length | Gear | Video |', '|---|---|---|---|---|---|');
for (const t of kit.tapes) md.push(`| ${t.number} | ${t.title} | ${t.shelf} | ${t.minutes} min | ${t.gear} | ${t.youtubeId ? `youtu.be/${t.youtubeId}` : 'not up yet'} |`);
md.push('', '## Training Arcade sagas', '', '| Saga | Subtitle | Status | Retires |', '|---|---|---|---|');
for (const s of sagas) md.push(`| ${s.title} | ${s.subtitle} | ${s.status} | ${s.retires ? `${s.retires.on} → ${s.retires.replacedBy}` : '—'} |`);
md.push('', '## Pro', '', ...kit.pro.prices.map(p => `- ${p.label}: ${p.price} ${p.cadence} (${p.note})`), '', ...kit.pro.benefits.map(b => `- ${b}`), `- ${kit.pro.freeAlways}`);
md.push('', '## Ranks', '', ...kit.ranks.map(r => `- ${r.name} (${r.label}) from ${r.xpFrom} XP`));
md.push('', '## Named workouts', '', ...kit.workouts.map(w => `- ${w.title} · ${w.focus} · ~${w.minutes} min${w.pro ? ' · Pro' : ''}`));
md.push('', '## Quick Mission loadout missions', '', '| Mission | Loadout | Mission line | Score | Themes |', '|---|---|---|---|---|', ...kit.missions.map(m => `| ${m.title} | ${m.loadout} | ${m.mission} | ${m.score} | ${m.themes.join(', ') || '—'} |`));
md.push('', '## Programs', '', ...kit.programs.map(p => `- ${p.title} · ${p.meta}${p.pro ? ' · Pro' : ''}`), '');

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'content-kit.json'), JSON.stringify(kit, null, 2) + '\n');
fs.writeFileSync(path.join(OUT, 'README.md'), md.join('\n'));
const missing = [...drops.flatMap(d => Object.values(d.art)), ...kit.tapes.map(t => t.art), ...sagas.map(s => s.poster), ...kit.ranks.map(r => r.art)].filter(a => a && !exists(a.path));
console.log(`content kit: ${drops.length} drops · ${kit.tapes.length} tapes · ${sagas.length} sagas · ${kit.workouts.length} workouts · ${kit.missions.length} missions · ${kit.programs.length} programs${missing.length ? ` · ${missing.length} missing asset(s): ${missing.map(a => a.path).join(', ')}` : ''}`);

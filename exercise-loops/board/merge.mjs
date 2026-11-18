import fs from 'fs';
const L = new URL('../', import.meta.url).pathname; // the exercise-loops folder
const OUT = new URL('./', import.meta.url).pathname; // the board folder
const rd = (f) => JSON.parse(fs.readFileSync(L + f, 'utf8'));
const cat = rd('catalog.json'), loopsMeta = rd('loops.json'), usage = rd('usage.json'), unmatched = rd('usage-unmatched.json');

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim().split(' ').map((w) => w.replace(/s$/, '')).join(' ');
const kebab = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// The 16 loops the owner asked to add as new exercises.
const NEW16 = ['seated-cable-rows', 'straight-arm-pulldowns', 'alternate-arm-dead-hang', 'hanging-knee-raises', 'heel-touches', 'barbell-clean', 'pull-up-hold', 'landmine-rows', 'zercher-squats', 'reverse-lunge-knee-drives', 'front-barbell-squats', 'pull-up-negatives', 'wide-grip-pull-ups', 'decline-pike-push-ups', 'seated-knee-tucks', 'tuck-ups'];
const SQUAT_LOOPS = ['squats', 'narrow-squats', 'barbell-back-squats', 'front-barbell-squats', 'zercher-squats', 'pistol-squats', 'hack-squat-deadlift', 'snatch-to-zercher-squat'];

// Strikes, kicks, shadowboxing and cardio machines: Practice Mode and the cardio screens cover them, so they are not asked for here.
const NONEX = new Set(['quick:shadowbox-sprint', 'quick:knee-strikes', 'quick:squat-to-front-kick', 'quick:sprawl-to-jab-cross', 'quick:elbow-strikes', 'quick:slip-and-rip', 'quick:speed-punches', 'quick:weighted-punches', 'quick:shuttle-runs', 'mission:lunge-to-teep', 'mission:rear-teep', 'mission:lunge-teep-chamber', 'mission:one-two', 'mission:seated-one-two', 'mission:one-two-slip', 'mission:heavy-bag-one-two', 'mission:standing-knee-drive', 'mission:windshield-wiper-punches', 'mission:half-arc-wiper-punches', 'mission:seated-wiper-punches', 'mission:v-sit-cross-punches', 'mission:bag-speed-punches', 'mission:switch-kick', 'mission:alt-roundhouse', 'mission:alt-low-kick', 'mission:bag-switch-kick', 'mission:row-cal', 'mission:run', 'mission:plate-punch-out', 'mission:bb-uppercut', 'mission:plate-uppercut', 'mission:alt-uppercut', 'mission:explosive-shadowbox']);

// Reviewed corrections to the first pass of the matching.
const SET_MATCH = {
  'mission:bb-dead-stop-row': ['direct', 'barbell-bent-over-rows', ''],
  'triceps_triceps_dips_core': ['direct', 'dips', ''],
  'shoulders_pike_push_ups_core': ['close', 'decline-pike-push-ups', 'Harder variant, feet raised on a box.'],
  'chest_wide_push_ups_core': ['close', 'cross-push-ups', 'Very wide arm placement.'],
  'chest_diamond_push_ups_core': ['close', 'clasped-hand-push-ups', 'Hands together under the chest, not the thumbs-and-fingers diamond.'],
  'biceps_chin_up_hold_core': ['close', 'pull-up-hold', 'Overhand hold at the top, not palms facing you.'],
  'mission:bb-hang-power-clean': ['close', 'barbell-clean', 'Hang clean caught in the rack, no power or full distinction.'],
  'mission:bb-power-clean': ['close', 'barbell-clean', 'Same lift, but this move starts from the knees, not the floor.'],
  'program:cross-legged-crunches': ['close', 'cross-leg-sit-ups', 'Cross-leg sit-up variation.'],
};
const NOTE_FIX = { 'quick:bent-over-rows': 'Shows the barbell version.', 'quick:front-squats': 'Shows the barbell version.', 'back_deadlifts_core': 'Loop shows a deadlift with a low-hip set-up. The bar position is not clear from the loop.' };
const GROUP_FIX = { 'quick:skater-hops': 'Quads', 'quick:tuck-jumps': 'Full Body', 'mission:bb-front-squat-push-press': 'Full Body' };
const DUP_EXPLICIT = { 'mission:dive-bomber': 'program:dive-bomber-push-ups', 'mission:bb-push-press': 'program:push-press', 'mission:kb-american-swing': 'program:american-swings', 'program:chair-dips': 'triceps_bench_dips_easy_1008', 'mission:bench-dip': 'triceps_bench_dips_easy_1008', 'triceps_bench_or_step_triceps_dips_0534': 'triceps_bench_dips_easy_1008', 'quick:hollow-hold': 'core_hollow_body_hold_core' };
const NEW_NOTES = {
  'pull-up-hold': 'The library already has Chin-Up Hold (palms facing you). Approve this only if you want the overhand version too.',
  'barbell-clean': 'Also covers Hang Power Cleans. Clean and Press is a different move.',
  'seated-knee-tucks': 'Looks very close to the Tuck-Ups loop. Check you want both.',
  'tuck-ups': 'Looks very close to the Seated Knee Tucks loop. Check you want both.',
};

const entries = cat.entries.map((e) => {
  const u = usage.byId[e.id];
  return { id: e.id, name: e.name, kind: e.kind, group: GROUP_FIX[e.id] || e.group, equipment: e.equipment, movementType: e.movementType, loop: e.loop || null, match: e.match, matchNote: NOTE_FIX[e.id] || e.matchNote || '', alsoIn: e.alsoIn || [], score: u ? u.score : 0, where: u ? u.where : null, draftId: e.draftId || null, nonExercise: NONEX.has(e.id) };
});
const byId = new Map(entries.map((e) => [e.id, e]));

// per-loop view of what each loop serves: slug -> Map(entryId -> {match, note})
const serves = new Map();
for (const l of cat.loops) { const m = new Map(); for (const s of l.serves || []) { const e = byId.get(s.id); if (e) m.set(s.id, { match: s.match, note: s.match === 'close' ? (NOTE_FIX[s.id] || e.matchNote || '') : '' }); } serves.set(l.slug, m); }

// The three of the 16 that already exist as a Quick or mission move get a library row of their own too.
for (const slug of NEW16) {
  if (byId.has('new:' + slug)) continue;
  const l = cat.loops.find((x) => x.slug === slug);
  const sv = [...(serves.get(slug) || new Map()).keys()].map((id) => byId.get(id)).filter(Boolean)[0];
  const e = { id: 'new:' + slug, name: l.name, kind: 'new', group: sv ? sv.group : 'Full Body', equipment: sv ? sv.equipment : 'Weighted', movementType: sv ? sv.movementType : 'Compound', loop: slug, match: 'new', matchNote: '', alsoIn: sv ? [sv.kind] : [], score: 0, where: null, draftId: null, nonExercise: false, alsoNote: sv ? 'Already a ' + (sv.kind === 'quick' ? 'Quick Mission' : 'mission') + ' move called "' + sv.name + '". Not in the library yet.' : '' };
  entries.push(e); byId.set(e.id, e);
}
for (const [slug, note] of Object.entries(NEW_NOTES)) { const e = byId.get('new:' + slug); if (e) e.alsoNote = [e.alsoNote, note].filter(Boolean).join(' '); }

// Moves the programs show that are neither in the library nor the Quick pool: the most used ones.
const DENY = /freestyle|jab|slip|guard|duck|check kick|teep|rear |footwork|shuffle|step to|hooks|simple and fast|in and out|counter|bounce|burpees with/i;
const loopNames = new Map(cat.loops.map((l) => [norm(l.name), l.slug]));
const prog = unmatched.list.filter((x) => !x.likelyLabelNotAMove && !DENY.test(x.name)).slice(0, 60);
for (const x of prog) {
  const slug = loopNames.get(norm(x.name)) || null;
  const e = { id: 'program:' + kebab(x.name), name: x.name, kind: 'program', group: 'Program-only', equipment: '', movementType: '', loop: slug, match: slug ? 'direct' : 'none', matchNote: '', alsoIn: [], score: x.weighted, where: { programs: x.units.programs, camp: x.units.camp || 0, missions: x.units.missions || 0 }, draftId: null, nonExercise: false };
  entries.push(e); byId.set(e.id, e);
  if (slug) serves.get(slug).set(e.id, { match: 'direct', note: '' });
}

// Apply the reviewed match corrections.
for (const [id, [match, slug, note]] of Object.entries(SET_MATCH)) {
  const e = byId.get(id); if (!e) continue;
  e.match = match; e.loop = slug; e.matchNote = note;
  serves.get(slug).set(id, { match, note });
}

// Rows that are the same move under two names: keep one, point the rest at it.
const PRI = { library: 0, quick: 1, program: 2, mission: 3, new: 9 };
const seen = new Map();
for (const e of [...entries].filter((x) => x.kind !== 'new').sort((a, b) => PRI[a.kind] - PRI[b.kind])) {
  const k = norm(e.name);
  if (seen.has(k)) e.dupOf = seen.get(k); else seen.set(k, e.id);
}
for (const [a, b] of Object.entries(DUP_EXPLICIT)) { const ea = byId.get(a), eb = byId.get(b); if (ea && eb && !ea.dupOf) ea.dupOf = b; }
for (const e of entries) if (e.dupOf && !byId.has(e.dupOf)) delete e.dupOf;

const nameOf = (slug) => (byId.get('new:' + slug) || {}).name || cat.loops.find((l) => l.slug === slug).name;
const loops = {};
for (const m of loopsMeta) {
  const slug = m.id, c = cat.loops.find((l) => l.slug === slug), isNew = NEW16.includes(slug);
  const ids = [...(serves.get(slug) || new Map()).keys()];
  if (isNew) { const i = ids.indexOf('new:' + slug); if (i >= 0) ids.splice(i, 1); ids.unshift('new:' + slug); if (!serves.get(slug).has('new:' + slug)) serves.get(slug).set('new:' + slug, { match: 'new', note: '' }); }
  const list = []; const names = new Set();
  for (const id of ids) {
    const e = byId.get(id); if (!e) continue;
    const s = serves.get(slug).get(id) || { match: e.match, note: '' };
    const key = e.name.toLowerCase();
    if (names.has(key)) continue; names.add(key);
    list.push({ id, name: e.name, kind: e.kind, match: s.match, note: s.note || '' });
  }
  const warn = [];
  if (slug === 'reclined-leg-raises') warn.push('Shorter than the others, under one second.');
  if (slug === 'wide-grip-pull-ups') warn.push('Two versions exist. This is the newest one, from your latest clip.');
  if (slug === 'pistol-squats') warn.push('Slight judder in the fast part. Needs a smoother re-render.');
  loops[slug] = { name: isNew ? nameOf(slug) : c.name, file: m.file, poster: m.poster, bytes: m.bytes, durationSec: m.durationSec, serves: list, isNew, warn: warn.join(' '), alsoNote: (byId.get('new:' + slug) || {}).alsoNote || '' };
}

const SQUAT_INFO = {
  'squats': 'Bodyweight, arms folded. Feet about shoulder width, toes forward. Goes below parallel. A quick rep.',
  'narrow-squats': 'Bodyweight, arms folded. Feet close together, toes forward. The deepest squat of the set.',
  'barbell-back-squats': 'Barbell on the upper back with a plate at each end, seen from the side, so the stance width is hard to read. About parallel depth.',
  'front-barbell-squats': 'Barbell in the front rack with crossed arms, seen from the front. Hip to shoulder width, toes turned out. Below parallel.',
  'zercher-squats': 'Barbell held in the crooks of the elbows. Hip width, below parallel, leans forward a little.',
  'pistol-squats': 'Bodyweight, one leg. The other leg is held out in front and the arms reach forward. A deep rep.',
  'hack-squat-deadlift': 'Loaded barbell, hips low at the start. Stands to lockout and lowers. A hip hinge, not a deep squat. The bar position is unclear.',
  'snatch-to-zercher-squat': 'A complex: pull from the floor, snatch overhead, lower to the elbows, squat, stand.',
};
for (const [s, t] of Object.entries(SQUAT_INFO)) if (loops[s]) loops[s].desc = t;

// Guards the page relies on.
const keys = new Set();
for (const e of entries) { const k = 'ex.' + kebab(e.id); if (keys.has(k)) throw new Error('doc key collision ' + k); keys.add(k); }
if (entries.length + Object.keys(loops).length * 2 >= 1000) throw new Error('too many docs for one snapshot');
for (const s of SQUAT_LOOPS) if (!loops[s]) throw new Error('missing squat loop ' + s);

const groups = [...new Set(entries.map((e) => e.group))].filter((g) => g !== 'Fight and conditioning' && g !== 'Program-only').sort();
groups.push('Fight and conditioning', 'Program-only');
const board = {
  generatedAt: '2026-11-17', groups, equipment: ['Bodyweight', 'Weighted', 'Band', 'Cable', 'Machine'],
  squatLoops: SQUAT_LOOPS,
  squatNames: ['Regular squat', 'Narrow squat', 'Wide squat', 'Back squat', 'Front barbell squat', 'Pistol squat', 'Zercher squat', 'Snatch to Zercher squat', 'Hack squat'],
  loops, entries,
};
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(OUT + 'board.json', JSON.stringify(board));
const counts = {}; for (const e of entries) counts[e.kind] = (counts[e.kind] || 0) + 1;
const live = (e) => e.kind !== 'new' && e.match !== 'direct' && !e.nonExercise && !e.dupOf;
const need = entries.filter(live);
const by = need.reduce((a, e) => (a[e.kind] = (a[e.kind] || 0) + 1, a), {});
console.log('entries', entries.length, JSON.stringify(counts), '| needVideo', need.length, JSON.stringify(by), '| excluded nonExercise', entries.filter((e) => e.nonExercise).length, 'dup', entries.filter((e) => e.dupOf).length, '| new', entries.filter((e) => e.kind === 'new').length);
console.log('KB', (fs.statSync(OUT + 'board.json').size / 1024).toFixed(0));

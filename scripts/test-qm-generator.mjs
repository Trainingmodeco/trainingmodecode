// The Quick Mission generator behind the setup screen's keys: every GEAR ×
// LEVEL × TIME the screen offers, dealt many times, against the shape the
// timer runs, the doses a loaded move may get and the minutes asked for.
// Also the config the keys build and the keys' own storage. Run with
// `npm run test:qm`.
import { register } from 'node:module';

// data/quickMissionConfig takes CADENCE_PRESETS from shared/CadenceSlider.jsx,
// which node cannot parse. The hook serves just that export, read from the
// real file, so the test still sees the app's own numbers.
register('data:text/javascript,' + encodeURIComponent(`
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
export async function load(url, context, next) {
  if (!url.endsWith('/shared/CadenceSlider.jsx')) return next(url, context);
  const src = readFileSync(fileURLToPath(url), 'utf8');
  const block = src.match(/export const CADENCE_PRESETS = \\{[^}]*\\};/);
  if (!block) throw new Error('CADENCE_PRESETS not found in CadenceSlider.jsx');
  return { format: 'module', source: block[0], shortCircuit: true };
}`));

const store = new Map();
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
};
const Q = await import('../components/training-mode/fit-mode/quickMissionGenerator.js');
const C = await import('../components/training-mode/data/quickMissionConfig.js');

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}  ${extra}`); } };

const TYPES = ['Bodyweight', 'Weighted', 'Hybrid'];
const LEVELS = ['EASY', 'NORMAL', 'HARD'];
const DEALS = 40; // per combination: the generator is random
const isInt = (n) => Number.isInteger(n);

// ── config ──────────────────────────────────────────────────────────────────
const plain = C.quickMissionConfig({ duration: 12, difficulty: 'Easy', focus: 'Full Body' });
check('1 config defaults to Bodyweight (hub, Home, Programs unchanged)', plain.workoutType === 'Bodyweight' && plain.difficulty === 'Easy' && plain.focus === 'Full Body');
check('2 config takes the GEAR key', C.quickMissionConfig({ workoutType: 'Weighted' }).workoutType === 'Weighted' && C.quickMissionConfig({ workoutType: 'Hybrid' }).workoutType === 'Hybrid');
check('3 an unknown type falls back to Bodyweight', C.quickMissionConfig({ workoutType: 'Cables' }).workoutType === 'Bodyweight');
check('4 screen labels map to display forms', (() => { const c = C.quickMissionConfig({ duration: 15, difficulty: 'NORMAL', focus: 'FULL BODY', workoutType: 'Hybrid' }); return c.difficulty === 'Normal' && c.focus === 'Full Body'; })());
check('5 the hub line prints the type', C.quickMissionLine(plain) === '12 min · Easy · Full Body · Bodyweight'
  && C.quickMissionLine(plain, { v2: true }) === '12 min · Easy · Full Body · No gear'
  && C.quickMissionLine(C.quickMissionConfig({ duration: 15, workoutType: 'Weighted' }), { v2: true }) === '15 min · Normal · Full Body · Weighted');

// ── keys storage ────────────────────────────────────────────────────────────
store.clear();
const def = C.loadQuickMissionKeys();
check('6 no stored keys: the defaults', def.workoutType === 'Bodyweight' && def.difficulty === 'NORMAL' && def.duration === 10 && def.focus === 'FULL BODY');
C.saveQuickMissionKeys({ workoutType: 'Weighted', difficulty: 'HARD', duration: 20, focus: 'UPPER' });
const back = C.loadQuickMissionKeys();
check('7 saved keys come back', back.workoutType === 'Weighted' && back.difficulty === 'HARD' && back.duration === 20 && back.focus === 'UPPER');
store.set(C.QM_KEYS_KEY, JSON.stringify({ workoutType: 'Cables', difficulty: 'MEDIUM', duration: 7, focus: 'LEGS' }));
const junk = C.loadQuickMissionKeys();
check('8 unreadable values fall back one by one', junk.workoutType === 'Bodyweight' && junk.difficulty === 'NORMAL' && junk.duration === 10 && junk.focus === 'FULL BODY');
store.set(C.QM_KEYS_KEY, '{not json');
check('9 corrupt storage falls back to the defaults', C.loadQuickMissionKeys().duration === 10);
const realLS = globalThis.localStorage;
globalThis.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
let threw = false;
try { C.loadQuickMissionKeys(); C.saveQuickMissionKeys({ duration: 5 }); } catch { threw = true; }
check('10 blocked storage never throws', !threw);
globalThis.localStorage = realLS;

// ── every key combination ───────────────────────────────────────────────────
const problems = { shape: [], repeats: [], loaded: [], length: [], flags: [], cadence: [] };
let worst = { off: 0, at: '' };
for (const type of TYPES) for (const level of LEVELS) for (const mins of C.QM_LENGTHS) for (const focus of C.QM_FOCI) {
  const cfg = C.quickMissionConfig({ duration: mins, difficulty: level, focus, workoutType: type });
  for (let i = 0; i < DEALS; i++) {
    const m = Q.generateQuickMission(cfg);
    const at = `${type}/${level}/${mins}/${focus}`;
    const ex = m.exercises || [];
    // Shape: what QuickMissionActive reads.
    const shapeOk = typeof m.title === 'string' && m.title.length > 0 && m.workoutType === type && m.duration === mins
      && Array.isArray(m.finisherExercises) && isInt(m.rounds) && m.rounds >= 1 && m.rounds <= 4
      && ex.length >= 3 && ex.length <= 8
      && ex.every(e => typeof e.name === 'string' && e.name && isInt(e.rest) && e.rest >= 15 && e.rest <= 120 && e.rest % 5 === 0
        && (e.mode === 'timed' ? isInt(e.work) && e.work >= 20 && e.work <= 60 : e.mode === 'reps' && isInt(e.reps) && e.reps >= 6 && e.reps <= 20));
    if (!shapeOk) problems.shape.push(`${at} ${JSON.stringify(m).slice(0, 160)}`);
    if (new Set(ex.map(e => e.name)).size !== ex.length) problems.repeats.push(`${at} ${ex.map(e => e.name).join(', ')}`);
    // Loaded moves: their own doses, never the bodyweight HARD table.
    ex.filter(e => e.isWeighted).forEach(e => {
      const ok = e.mode === 'reps' ? e.reps >= 8 && e.reps <= 15 && e.rest >= 30 : e.work <= 50 && e.rest >= 30;
      if (!ok) problems.loaded.push(`${at} ${e.name} ${e.reps ?? e.work}/${e.rest}`);
    });
    // Who is flagged: Weighted = every move, Bodyweight = none, Hybrid = some
    // of each.
    const flagged = ex.filter(e => e.isWeighted).length;
    const flagOk = type === 'Weighted' ? flagged === ex.length : type === 'Bodyweight' ? flagged === 0 : flagged >= 1 && flagged < ex.length;
    if (!flagOk) problems.flags.push(`${at} ${flagged}/${ex.length}`);
    // The runner counts by workoutType, then isWeighted (QuickMissionActive's
    // isCadenceEligible): a loaded rep set must not be counted, so it ends on
    // DONE.
    const counted = ex.filter(e => e.mode === 'reps' && cfg.cadenceCount !== false && cfg.workoutType !== 'Weighted' && !(cfg.workoutType === 'Hybrid' && e.isWeighted));
    if (counted.some(e => e.isWeighted)) problems.cadence.push(`${at} ${counted.filter(e => e.isWeighted).map(e => e.name).join(', ')}`);
    // Length: the card's "About N min" against the TIME asked for.
    const secs = Q.estimateQuickMissionSeconds(m);
    const off = Math.abs(secs - mins * 60) / (mins * 60);
    if (off > worst.off) worst = { off, at: `${at} ${Math.round(secs)}s` };
    if (off > 0.3) problems.length.push(`${at} ${Math.round(secs)}s for ${mins * 60}s`);
  }
}
const first = (list) => list.slice(0, 3).join(' | ');
check('11 every mission has the shape the timer runs', problems.shape.length === 0, first(problems.shape));
check('12 no move repeats within a round', problems.repeats.length === 0, first(problems.repeats));
check('13 loaded rep ranges and rests are sane (8-15 reps, 30 s+ rest)', problems.loaded.length === 0, first(problems.loaded));
check('14 Weighted flags every move, Hybrid some, Bodyweight none', problems.flags.length === 0, first(problems.flags));
check('15 no loaded set is cadence-counted (it ends on DONE)', problems.cadence.length === 0, first(problems.cadence));
check('16 estimated length within ±30% of TIME', problems.length.length === 0, first(problems.length));
console.log(`       worst length: ${Math.round(worst.off * 100)}% off (${worst.at})`);

// ── a few specifics ─────────────────────────────────────────────────────────
const many = (cfg, n = 200) => Array.from({ length: n }, () => Q.generateQuickMission(C.quickMissionConfig(cfg)));
const hardWeighted = many({ duration: 15, difficulty: 'HARD', workoutType: 'Weighted' }).flatMap(m => m.exercises);
check('17 HARD weighted never gets the bodyweight 14-20 reps on 20 s', hardWeighted.every(e => e.mode !== 'reps' || (e.reps <= 15 && e.rest >= 30)));
const hybrids = many({ duration: 20, difficulty: 'NORMAL', workoutType: 'Hybrid' });
check('18 a hybrid opens on a loaded move and alternates', hybrids.every(m => m.exercises[0].isWeighted && m.exercises.every((e, i) => i === 0 || !!e.isWeighted !== !!m.exercises[i - 1].isWeighted)),
  hybrids.find(m => !m.exercises[0].isWeighted)?.exercises.map(e => e.name).join(', ') || '');
check('19 a hybrid never pairs a move with its weighted version', hybrids.every(m => !m.exercises.some(a => m.exercises.some(b => a !== b && a.name !== b.name && b.name.includes(a.name)))));
const upperTitles = new Set(many({ duration: 10, focus: 'UPPER', workoutType: 'Weighted' }, 60).map(m => m.title));
const fullTitles = new Set(many({ duration: 10, focus: 'FULL BODY', workoutType: 'Weighted' }, 60).map(m => m.title));
check('20 weighted titles follow the focus', [...upperTitles].every(t => !fullTitles.has(t)), [...upperTitles].join(', '));
const bwUpper = many({ duration: 10, focus: 'UPPER' }, 60);
check('21 bodyweight UPPER still opens on an upper move (unchanged)', bwUpper.every(m => ['Push-Ups', 'Diamond Push-Ups', 'Pike Push-Ups', 'Dips', 'Shoulder Taps', 'Superman Hold', 'Inchworms'].includes(m.exercises[0].name)));
const dose = Q.quickMissionDose({ mode: 'reps', reps: 10, isWeighted: true });
check('22 the card dose reads the same for a loaded move', dose === '10 reps');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

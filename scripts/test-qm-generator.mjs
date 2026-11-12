// The Quick Mission generator behind the setup screen: every GEAR × LEVEL ×
// TIME × FOCUS the screen offers (TIME is the 5 to 60 minute slider in
// 1-minute steps; LEVEL is EASY, NORMAL, HARD and ADVANCED), dealt many times,
// against the shape the timer runs, the doses a loaded move may get and the
// minutes asked for: the real guided run must land within 30 seconds of the
// minutes at every minute. Also the timing model pinned to the runner's own
// constants, the config the screen builds, the level tables and the
// remembered choices. Run with `npm run test:qm`.
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
const T = await import('../components/training-mode/data/quickMissionTiming.js');
const M = await import('../components/training-mode/data/missionMoves.js');
const A = await import('../components/training-mode/data/athleteLevel.js');
const SG = await import('../components/training-mode/data/soloFromGenerated.js');
const U = await import('../components/training-mode/data/userStats.js');
const QX = await import('../components/training-mode/data/quickMissionXp.js');
const RC = await import('../components/training-mode/data/recommendations.js');
const LS = await import('../components/training-mode/data/lastSession.js');
const MS = await import('../components/training-mode/data/missionSolo.js');
import fs from 'node:fs';

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}  ${extra}`); } };

const TYPES = ['Bodyweight', 'Weighted', 'Hybrid'];
const LEVELS = ['EASY', 'NORMAL', 'HARD', 'ADVANCED'];
const DEALS = 8; // per combination (seeded): 3 x 4 x 56 x 5 x 8 = 27k missions
const isInt = (n) => Number.isInteger(n);

// ── config ──────────────────────────────────────────────────────────────────
const plain = C.quickMissionConfig({ duration: 12, difficulty: 'Easy', focus: 'Full Body' });
check('1 config defaults to Bodyweight (hub, Home, Programs unchanged)', plain.workoutType === 'Bodyweight' && plain.difficulty === 'Easy' && plain.focus === 'Full Body');
check('2 config takes the GEAR key', C.quickMissionConfig({ workoutType: 'Weighted' }).workoutType === 'Weighted' && C.quickMissionConfig({ workoutType: 'Hybrid' }).workoutType === 'Hybrid');
check('3 an unknown type falls back to Bodyweight', C.quickMissionConfig({ workoutType: 'Cables' }).workoutType === 'Bodyweight');
check('4 screen labels map to display forms', (() => { const c = C.quickMissionConfig({ duration: 15, difficulty: 'NORMAL', focus: 'FULL BODY', workoutType: 'Hybrid' }); return c.difficulty === 'Normal' && c.focus === 'Full Body'; })());
check('5 the hub line prints the type', C.quickMissionLine(plain) === '12 min · Easy · Full Body · Bodyweight'
  && C.quickMissionLine(plain, { v2: true }) === '12 min · Easy · Full Body · No gear'
  && C.quickMissionLine(C.quickMissionConfig({ duration: 15, workoutType: 'Weighted', difficulty: 'Normal' }), { v2: true }) === '15 min · Medium · Full Body · Weighted'
  && C.quickMissionLine(C.quickMissionConfig({ duration: 30, difficulty: 'ADVANCED' })) === '30 min · Advanced · Full Body · Bodyweight');

// ── keys storage ────────────────────────────────────────────────────────────
store.clear();
const def = C.loadQuickMissionKeys();
check('6 no stored keys: the defaults (20 min, the mock-up)', def.workoutType === 'Bodyweight' && def.difficulty === 'NORMAL' && def.duration === 20 && def.focus === 'FULL BODY');
C.saveQuickMissionKeys({ workoutType: 'Weighted', difficulty: 'HARD', duration: 45, focus: 'UPPER' });
const back = C.loadQuickMissionKeys();
check('7 saved keys come back', back.workoutType === 'Weighted' && back.difficulty === 'HARD' && back.duration === 45 && back.focus === 'UPPER');
store.set(C.QM_KEYS_KEY, JSON.stringify({ workoutType: 'Cables', difficulty: 'MEDIUM', duration: 'long', focus: 'LEGS' }));
const junk = C.loadQuickMissionKeys();
check('8 unreadable values fall back one by one', junk.workoutType === 'Bodyweight' && junk.difficulty === 'NORMAL' && junk.duration === 20 && junk.focus === 'FULL BODY');
store.set(C.QM_KEYS_KEY, '{not json');
check('9 corrupt storage falls back to the defaults', C.loadQuickMissionKeys().duration === 20);
// A length lands on the nearest slider step, inside 5 to 60.
const snapped = [3, 5, 7, 12, 30, 61, 90].map(d => { store.set(C.QM_KEYS_KEY, JSON.stringify({ duration: d })); return C.loadQuickMissionKeys().duration; });
check('9b a stored length snaps onto the slider (5 to 60, steps of 1)', snapped.join() === '5,5,7,12,30,60,60', snapped.join());
// What the old 5-minute-step slider stored (10 to 60 by 5) still loads as it was.
check('9b2 every length the old slider stored loads unchanged', [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60].every(d => { store.set(C.QM_KEYS_KEY, JSON.stringify({ duration: d })); return C.loadQuickMissionKeys().duration === d; }));
check('9c the slider runs 5 to 60 in 1-minute steps, labelled 5, 10, 15, 20, 30, 45, 60', C.QM_TIMES.length === 56 && C.QM_TIMES[0] === 5 && C.QM_TIMES[55] === 60 && C.QM_TIMES.every((t, i) => i === 0 || t - C.QM_TIMES[i - 1] === 1)
  && C.QM_TIME_MIN === 5 && C.QM_TIME_STEP === 1 && C.QM_TIME_TICKS.join() === '5,10,15,20,30,45,60' && C.QM_TIME_TICKS.every(t => C.QM_TIMES.includes(t)));
const realLS = globalThis.localStorage;
globalThis.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
let threw = false;
try { C.loadQuickMissionKeys(); C.saveQuickMissionKeys({ duration: 5 }); } catch { threw = true; }
check('10 blocked storage never throws', !threw);
globalThis.localStorage = realLS;

// ── every combination ───────────────────────────────────────────────────────
// The slider's every step, and the 5 minutes the hub and Home may deal.
const MINUTES = [...new Set([...C.QM_LENGTHS, ...C.QM_TIMES])].sort((a, b) => a - b); // every slider minute
const problems = { shape: [], repeats: [], loaded: [], length: [], flags: [], cadence: [], pace: [], five: [] };
const restAt = {}; // average rest per type at each length
let worst = { off: 0, at: '' }; // seconds
let combos = 0;
for (const type of TYPES) for (const level of LEVELS) for (const mins of MINUTES) for (const focus of C.QM_FOCI) {
  combos++;
  const cfg = C.quickMissionConfig({ duration: mins, difficulty: level, focus, workoutType: type });
  for (let i = 0; i < DEALS; i++) {
    const m = Q.generateQuickMission({ ...cfg, rng: Q.seededRng(Q.seedFrom(`${type}|${level}|${mins}|${focus}|${i}`)) });
    const at = `${type}/${level}/${mins}/${focus}`;
    const ex = m.exercises || [];
    // Shape: what QuickMissionActive reads.
    const shapeOk = typeof m.title === 'string' && m.title.length > 0 && m.workoutType === type && m.duration === mins
      && Array.isArray(m.finisherExercises) && isInt(m.rounds) && m.rounds >= 1 && m.rounds <= 6
      && ex.length >= 3 && ex.length <= 10
      && ex.every(e => typeof e.name === 'string' && e.name && isInt(e.rest) && e.rest >= 15 && e.rest <= 120 && e.rest % 5 === 0
        && (e.mode === 'timed' ? isInt(e.work) && e.work >= 20 && e.work <= 60 : e.mode === 'reps' && isInt(e.reps) && e.reps >= 6 && e.reps <= 25));
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
    // Length: the real guided run (the timing model, pinned below) against the
    // TIME asked for, and the AT YOUR PACE STANDARD target that follows it.
    const secs = Q.estimateQuickMissionSeconds(m);
    const off = Math.abs(secs - mins * 60);
    if (off > worst.off) worst = { off, at: `${at} ${Math.round(secs)}s` };
    if (off > 30) problems.length.push(`${at} ${Math.round(secs)}s for ${mins * 60}s`);
    const standard = SG.paceTiersFor(m).standard;
    if (Math.abs(standard - mins * 60) > 30) problems.pace.push(`${at} STANDARD ${standard}s for ${mins * 60}s`);
    if (mins === 5 && (ex.length < 3 || m.rounds !== 1)) problems.five.push(`${at} ${ex.length} moves, ${m.rounds} rounds`);
    const ra = (restAt[`${type}/${mins}`] ||= { sum: 0, n: 0 });
    ex.forEach(e => { ra.sum += e.rest; ra.n++; });
  }
}
check(`10b every combination dealt: ${combos} (3 types × 4 levels × ${MINUTES.length} minutes × 5 focuses), every minute 5 to 60`, combos === 3 * 4 * MINUTES.length * 5 && MINUTES.length === 56 && MINUTES[0] === 5 && MINUTES[55] === 60);
const first = (list) => list.slice(0, 3).join(' | ');
const many0 = (cfg, n) => Array.from({ length: n }, () => Q.generateQuickMission(C.quickMissionConfig(cfg)));
check('11 every mission has the shape the timer runs', problems.shape.length === 0, first(problems.shape));
check('12 no move repeats within a round', problems.repeats.length === 0, first(problems.repeats));
check('13 loaded rep ranges and rests are sane (8-15 reps, 30 s+ rest)', problems.loaded.length === 0, first(problems.loaded));
check('14 Weighted flags every move, Hybrid some, Bodyweight none', problems.flags.length === 0, first(problems.flags));
check('15 no loaded set is cadence-counted (it ends on DONE)', problems.cadence.length === 0, first(problems.cadence));
check('16 the real guided run is within 30 s of the minutes asked, at every minute from 5 to 60', problems.length.length === 0, first(problems.length));
console.log(`       worst length: ${Math.round(worst.off)} s off (${worst.at})`);
check('16a the AT YOUR PACE STANDARD target is within 30 s of the minutes asked too', problems.pace.length === 0, first(problems.pace));
check('16a2 a 5 minute mission is one round of at least 3 moves', problems.five.length === 0, first(problems.five));
// 45 to 60 minutes is more rounds and more moves, not long rests: the
// average rest stays near the level's own (bodyweight 20-40 s, loaded
// 40-60 s), never stretched to fill the time.
const avgRest = (type, mins) => { const r = restAt[`${type}/${mins}`]; return r.sum / r.n; };
const restOk = TYPES.every(type => [45, 50, 55, 60].every(mins => avgRest(type, mins) <= (type === 'Bodyweight' ? 45 : 60)));
check('16b long missions keep sensible rests (45-60 min)', restOk,
  TYPES.map(type => `${type} ${[45, 60].map(mins => Math.round(avgRest(type, mins))).join('/')}s`).join(' · '));
const long = many0({ duration: 60, difficulty: 'NORMAL' }, 80);
check('16c 60 minutes is more rounds and more moves than 30', long.every(m => m.rounds > 4) && Math.max(...long.map(m => m.exercises.length)) > 8);

// ── a few specifics ─────────────────────────────────────────────────────────
const many = (cfg, n = 200) => Array.from({ length: n }, () => Q.generateQuickMission(C.quickMissionConfig(cfg)));
const hardWeighted = [...many({ duration: 15, difficulty: 'HARD', workoutType: 'Weighted' }), ...many({ duration: 15, difficulty: 'ADVANCED', workoutType: 'Weighted' })].flatMap(m => m.exercises);
check('17 HARD and ADVANCED weighted never get the bodyweight 14-25 reps on 15-20 s', hardWeighted.every(e => e.mode !== 'reps' || (e.reps <= 15 && e.rest >= 30)));
const hybrids = many({ duration: 20, difficulty: 'NORMAL', workoutType: 'Hybrid' });
check('18 a hybrid opens on a loaded move and alternates', hybrids.every(m => m.exercises[0].isWeighted && m.exercises.every((e, i) => i === 0 || !!e.isWeighted !== !!m.exercises[i - 1].isWeighted)),
  hybrids.find(m => !m.exercises[0].isWeighted)?.exercises.map(e => e.name).join(', ') || '');
// Only a bodyweight move beside a loaded one counts: 'Push-Ups' with 'Pike
// Push-Ups' is two bodyweight moves, not a move and its weighted version.
check('19 a hybrid never pairs a move with its weighted version', hybrids.every(m => !m.exercises.some(a => !a.isWeighted && m.exercises.some(b => b.isWeighted && b.name.includes(a.name)))));
const upperTitles = new Set(many({ duration: 10, focus: 'UPPER', workoutType: 'Weighted' }, 60).map(m => m.title));
const fullTitles = new Set(many({ duration: 10, focus: 'FULL BODY', workoutType: 'Weighted' }, 60).map(m => m.title));
check('20 weighted titles follow the focus', [...upperTitles].every(t => !fullTitles.has(t)), [...upperTitles].join(', '));
const bwUpper = many({ duration: 10, focus: 'UPPER' }, 60);
check('21 bodyweight UPPER still opens on an upper move (unchanged)', bwUpper.every(m => ['Push-Ups', 'Diamond Push-Ups', 'Pike Push-Ups', 'Dips', 'Shoulder Taps', 'Superman Hold', 'Inchworms'].includes(m.exercises[0].name)));
const dose = Q.quickMissionDose({ mode: 'reps', reps: 10, isWeighted: true });
check('22 the card dose reads the same for a loaded move', dose === '10 reps');


// ── the level: ADVANCED, and where the page starts ─────────────────────────
check('23 QM_INTENSITY is EASY, NORMAL, HARD, ADVANCED and ADVANCED has its own word', C.QM_INTENSITY.join() === 'EASY,NORMAL,HARD,ADVANCED' && C.QM_LEVEL_WORD.ADVANCED === 'ADVANCED' && C.levelWord('Advanced') === 'ADVANCED' && C.levelWord('Normal') === 'MEDIUM'
  && C.QM_INTENSITY.join() === A.TIERS.join());
const LV = ['Easy', 'Normal', 'Hard', 'Advanced'];
const bodyT = LV.map(l => Q.DIFFICULTY_CONFIG[l]), loadT = LV.map(l => Q.LOADED_CONFIG[l]);
const climbs = (t, key, dir) => t.every((x, i) => i === 0 || (dir > 0 ? x[key] >= t[i - 1][key] : x[key] <= t[i - 1][key]));
check('24 each level asks at least as much as the one below: more reps, longer work, shorter rest (bodyweight and loaded)',
  [bodyT, loadT].every(t => climbs(t, 'repsMin', 1) && climbs(t, 'repsMax', 1) && climbs(t, 'workMin', 1) && climbs(t, 'workMax', 1) && climbs(t, 'rest', -1)));
check('24b ADVANCED is more reps, longer work and a shorter rest than HARD on the bodyweight table', Q.DIFFICULTY_CONFIG.Advanced.repsMin > Q.DIFFICULTY_CONFIG.Hard.repsMin && Q.DIFFICULTY_CONFIG.Advanced.repsMax > Q.DIFFICULTY_CONFIG.Hard.repsMax
  && Q.DIFFICULTY_CONFIG.Advanced.workMin > Q.DIFFICULTY_CONFIG.Hard.workMin && Q.DIFFICULTY_CONFIG.Advanced.workMax > Q.DIFFICULTY_CONFIG.Hard.workMax && Q.DIFFICULTY_CONFIG.Advanced.rest < Q.DIFFICULTY_CONFIG.Hard.rest);
check('24c ... and on the loaded table (the 15 rep and 50 s caps stay): reps never past 15, rest never under 30', Q.LOADED_CONFIG.Advanced.repsMin > Q.LOADED_CONFIG.Hard.repsMin && Q.LOADED_CONFIG.Advanced.workMax > Q.LOADED_CONFIG.Hard.workMax
  && Q.LOADED_CONFIG.Advanced.rest < Q.LOADED_CONFIG.Hard.rest && loadT.every(t => t.repsMax <= 15 && t.workMax <= 50 && t.rest >= 30));
const avg = (list, f) => list.reduce((a, x) => a + f(x), 0) / list.length;
// 120 seeded 20-minute missions per level: how much of the run is work (the rest of it is rest and the intro).
const density = (level, type = 'Bodyweight', mins = 20) => avg(Array.from({ length: 120 }, (_, i) => {
  const tl = T.quickMissionTimeline(Q.generateQuickMission({ workoutType: type, duration: mins, difficulty: level, rng: Q.seededRng(i + 1) }));
  return tl.workSec / tl.totalSec;
}), x => x);
const repsOf = (level) => avg(Array.from({ length: 120 }, (_, i) => Q.generateQuickMission({ duration: 20, difficulty: level, rng: Q.seededRng(i + 1) })).flatMap(m => m.exercises).filter(e => e.mode === 'reps'), e => e.reps);
check('25 at the same minutes, each level up is more work and less rest (work share of the run, bodyweight, loaded and hybrid), and ADVANCED has more reps than HARD',
  ['Bodyweight', 'Weighted', 'Hybrid'].every(type => [5, 20, 45].every(mins => { const d = LV.map(l => density(l, type, mins)); return d.every((x, i) => i === 0 || x > d[i - 1] - 0.005); }))
  && repsOf('Advanced') > repsOf('Hard') && repsOf('Hard') > repsOf('Normal') && repsOf('Normal') > repsOf('Easy'),
  ['Bodyweight', 'Weighted', 'Hybrid'].map(type => `${type} ${LV.map(l => density(l, type, 10).toFixed(2)).join('/')}`).join(' '));
// Where the page starts: no difficulty given means the athlete's own level.
const statsAt = (xp) => ({ xp, sessions: [{ type: 'Fit Mode', xpEarned: xp }] });
check('26 no difficulty = the athlete\'s level (Fit side): level 1 EASY, level 4 NORMAL, level 7 HARD, level 10+ ADVANCED',
  [[0, 'Easy'], [1600, 'Normal'], [3100, 'Hard'], [4600, 'Advanced'], [20000, 'Advanced']].every(([xp, want]) => C.quickMissionConfig({ stats: statsAt(xp) }).difficulty === want),
  [0, 1600, 3100, 4600].map(xp => C.quickMissionConfig({ stats: statsAt(xp) }).difficulty).join());
check('26b an explicit difficulty always wins (the hub\'s Recovery stays Easy for a level 10 athlete), and MEDIUM reads as Normal', C.quickMissionConfig({ difficulty: 'Easy', stats: statsAt(20000) }).difficulty === 'Easy'
  && C.quickMissionConfig({ difficulty: 'MEDIUM' }).difficulty === 'Normal' && C.quickMissionConfig({ difficulty: 'HARD' }).difficulty === 'Hard' && C.quickMissionConfig({ difficulty: 'ADVANCED' }).difficulty === 'Advanced');
store.clear();
check('26c with nothing stored (a new athlete) the default is Easy', C.quickMissionConfig({}).difficulty === 'Easy' && C.quickMissionConfig().difficulty === 'Easy');
// loadStats caches what it read; a save drops the cache (here, and on a storage event in a browser).
const US = await import('../components/training-mode/data/userStats.js');
US.addBonusXp(1);
store.set('tm_user_stats', JSON.stringify(statsAt(4600)));
check('26d it reads the stored stats when none are handed in', US.loadStats().xp === 4600 && C.quickMissionConfig({}).difficulty === 'Advanced');
store.clear();
const surprise = (xp) => { const out = new Set(); for (let i = 0; i < 200; i++) out.add(C.surpriseQuickMission({ stats: statsAt(xp), rng: () => i / 200 }).difficulty); return [...out].sort().join(); };
check('27 SURPRISE rolls one step either side of the athlete: level 1 only Easy or Normal; level 4 Easy to Hard; level 7 Normal to Advanced; level 10 Hard or Advanced',
  surprise(0) === 'Easy,Normal' && surprise(1600) === 'Easy,Hard,Normal' && surprise(3100) === 'Advanced,Hard,Normal' && surprise(4600) === 'Advanced,Hard', [0, 1600, 3100, 4600].map(surprise).join(' | '));
check('27b a surprise config is a full config (length from the hub\'s lengths, a focus, Bodyweight)', (() => {
  const c = C.surpriseQuickMission({ stats: statsAt(0) });
  return C.QM_LENGTHS.includes(c.duration) && ['Full Body', 'Upper', 'Lower', 'Core', 'Combat'].includes(c.focus) && c.workoutType === 'Bodyweight' && c.cadenceCount === true;
})());

// ── the minutes are the real guided run: the model pinned to the runner ────
// The runner (QuickMissionActive) and the generator read the same constants
// (data/quickMissionTiming). Nothing below is retyped from the runner: it is
// read from the module and from the runner's own source.
const runnerSrc = fs.readFileSync(new URL('../components/training-mode/QuickMissionActive.jsx', import.meta.url), 'utf8');
const cadenceSrc = fs.readFileSync(new URL('../components/training-mode/shared/CadenceSlider.jsx', import.meta.url), 'utf8');
const presets = Function(`return (${cadenceSrc.match(/export const CADENCE_PRESETS = (\{[^}]*\})/)[1]})`)();
check('28 the model\'s beat is the setup config\'s beat (CADENCE_PRESETS.moderate) and the runner counts at it', T.QM_CADENCE_MS === presets.moderate && C.quickMissionConfig({ difficulty: 'Easy' }).cadenceMs === T.QM_CADENCE_MS
  && /missionCfg\.cadenceMs \|\| CADENCE_PRESETS\.moderate/.test(runnerSrc));
const intro = runnerSrc.slice(runnerSrc.indexOf('const runIntroV2'), runnerSrc.indexOf('const skipIntroV2'));
check('28b the runner\'s v2 intro takes its pauses and the safe-weight brief from the timing module (no retyped numbers)',
  /hold\(QM_WEIGHT_BRIEF_HOLD_MS\)/.test(intro) && /hold\(QM_INTRO_HOLD_MS\)/.test(intro) && /hold\(QM_INTRO_BELL_MS\)/.test(intro) && /say\(QM_WEIGHT_BRIEF\)/.test(intro)
  && !/hold\(\d+\)/.test(intro) && /setTimeout\(run, QM_FINISH_BELL_MS\)/.test(runnerSrc)
  && /from '\.\/data\/quickMissionTiming'/.test(runnerSrc) && !/const CADENCE_SAFE_NAMES/.test(runnerSrc), intro.match(/hold\([^)]*\)/g)?.join(' '));
check('28c the intro of a v2 run is GET READY after the start line: the runner calls getReadySeconds(lead) and a rest runs its seconds with the lines inside it', /getReadySeconds\(lead\)/.test(runnerSrc)
  && /startRestV2\(null, \{ kind: 'lead'/.test(runnerSrc) && /introRunRef/.test(runnerSrc));
// A hand-built mission, worked out from the constants one piece at a time.
const hand = {
  workoutType: 'Bodyweight', rounds: 2, format: 'Auto',
  exercises: [
    { name: 'Push-Ups', mode: 'reps', reps: 10, rest: 20 },           // counted: 10 beats + the last number
    { name: 'Plank Hold', mode: 'timed', work: 40, rest: 30 },         // a timer
  ],
  finisherExercises: [],
};
const beat = T.QM_CADENCE_MS / 1000;
const leadHand = M.leadLine(hand.exercises[0], { round: 1, idx: 0, rounds: 2, slotsPerRound: 2, legacyCounted: true });
const introHand = M.speechSeconds('Quick Mission started.') + (T.QM_INTRO_HOLD_MS + T.QM_INTRO_BELL_MS) / 1000 + M.getReadySeconds(leadHand);
const wantHand = introHand
  + 2 * ((10 * beat + T.QM_LAST_NUMBER_SEC) + 40)       // the work, twice
  + (20 + 30) * 2 - 30;                                  // the rests, and none after the last set
check('29 the estimate of a hand-built mission is exactly the runner\'s pieces: intro, counted set, timer, rests, no rest after the last set',
  Math.abs(T.quickMissionTimeline(hand).totalSec - wantHand) < 1e-9 && Q.estimateQuickMissionSeconds(hand) === Math.round(wantHand), `${T.quickMissionTimeline(hand).totalSec} vs ${wantHand}`);
check('29b the coach\'s voice off drops the speech and nothing else (timers only)', (() => {
  const on = T.quickMissionTimeline(hand), off = T.quickMissionTimeline(hand, { voice: false });
  const speech = M.speechSeconds('Quick Mission started.') + T.QM_INTRO_HOLD_MS / 1000 + 2 * 2 * 0 + 2 * T.QM_LAST_NUMBER_SEC;
  return Math.abs((on.totalSec - off.totalSec) - speech) < 1e-9;
})());
check('29c a loaded set is the athlete\'s pace (pick-up + a controlled rep each) and Weighted/Hybrid add the safe-weight brief to the intro', (() => {
  const w = { workoutType: 'Weighted', rounds: 1, exercises: [{ name: 'Goblet Squats', mode: 'reps', reps: 10, rest: 45, isWeighted: true }], finisherExercises: [] };
  const lead = M.leadLine(w.exercises[0], { round: 1, idx: 0, rounds: 1, slotsPerRound: 1, legacyCounted: false });
  const want = M.speechSeconds(T.QM_WEIGHT_BRIEF) + T.QM_WEIGHT_BRIEF_HOLD_MS / 1000 + M.speechSeconds('Quick Mission started.') + (T.QM_INTRO_HOLD_MS + T.QM_INTRO_BELL_MS) / 1000
    + M.getReadySeconds(lead) + T.QM_LOADED_SETUP_SEC + 10 * T.QM_LOADED_REP_SEC;
  return Math.abs(T.quickMissionTimeline(w).totalSec - want) < 1e-9 && T.quickMissionTimeline(w).slots[0].work === T.QM_LOADED_SETUP_SEC + 10 * T.QM_LOADED_REP_SEC;
})());
check('29d the coach counts exactly the moves the runner\'s whitelist names, and never a loaded set', T.isCadenceEligible({ name: 'Push-Ups', mode: 'reps' }, { workoutType: 'Bodyweight' })
  && !T.isCadenceEligible({ name: 'Goblet Squats', mode: 'reps' }, { workoutType: 'Bodyweight' }) && !T.isCadenceEligible({ name: 'Squats', mode: 'reps', isWeighted: true }, { workoutType: 'Hybrid' })
  && !T.isCadenceEligible({ name: 'Squats', mode: 'reps' }, { workoutType: 'Weighted' }) && !T.isCadenceEligible({ name: 'Squats', mode: 'timed' }, { workoutType: 'Bodyweight' }) && !T.isCadenceEligible({ name: 'Squats', mode: 'reps' }, { workoutType: 'Bodyweight', cadenceCount: false }));
// Every bodyweight rep move the generator can deal is counted by the runner, so
// a bodyweight set never waits on a DONE tap the timeline cannot see.
const genSrc = fs.readFileSync(new URL('../components/training-mode/fit-mode/quickMissionGenerator.js', import.meta.url), 'utf8');
const bwPool = genSrc.slice(genSrc.indexOf('const BODYWEIGHT_POOL'), genSrc.indexOf('const WEIGHTED_POOL'));
const bwRepMoves = [...bwPool.matchAll(/name: '([^']+)', tags: \[[^\]]*\](, timed: true)?/g)].filter(m => !m[2]).map(m => m[1]);
check('29e every bodyweight rep move in the pool is on the runner\'s counted list', bwRepMoves.length > 15 && bwRepMoves.every(n => T.CADENCE_SAFE_NAMES.has(n.toLowerCase())), bwRepMoves.filter(n => !T.CADENCE_SAFE_NAMES.has(n.toLowerCase())).join());
// The fit's own estimate and the timeline are one number.
check('29f the generator\'s estimate IS the timeline\'s total (rounded), and the work-only estimate leaves out the intro, the voice and every rest', (() => {
  const m = Q.generateQuickMission({ workoutType: 'Hybrid', duration: 25, difficulty: 'Hard', rng: Q.seededRng(3) });
  const tl = T.quickMissionTimeline(m);
  const moves = [...m.exercises, ...m.finisherExercises].reduce((a, e) => a + T.moveSeconds(e, { workoutType: m.workoutType }), 0) * m.rounds;
  return Q.estimateQuickMissionSeconds(m) === Math.round(tl.totalSec) && Q.estimateQuickMissionWorkSeconds(m) === Math.round(moves) && moves < tl.totalSec - tl.restSec - tl.introSec + 1e-9;
})());

// ── the fit: finishers, a timed format, and a scrub that grows one workout ─
const fin = [];
for (const type of TYPES) for (const level of ['Easy', 'Hard', 'Advanced']) for (const mins of [5, 8, 12, 20, 33, 47, 60]) for (const format of ['Auto', 'Timed']) {
  const m = Q.generateQuickMission({ workoutType: type, difficulty: level, duration: mins, format, cardioFinisher: true, rng: Q.seededRng(mins * 7) });
  const secs = Q.estimateQuickMissionSeconds(m);
  // A finisher takes two timed moves of every round; the first page never asks for it, and a 5 minute mission with
  // one cannot always keep three main moves, so only the longer ones are held to the 30 s rule.
  if (mins >= 12 && Math.abs(secs - mins * 60) > 30) fin.push(`${type}/${level}/${mins}/${format} ${secs}s`);
  if (m.finisherExercises.length !== 2 || m.exercises.length < 3) fin.push(`${type}/${level}/${mins}/${format} shape ${m.exercises.length}+${m.finisherExercises.length}`);
}
check('30 a cardio finisher and the Timed format fit the minutes too (from 12 minutes)', fin.length === 0, first(fin));
const stable = [];
for (const [type, focus] of [['Bodyweight', 'FULL BODY'], ['Hybrid', 'UPPER'], ['Weighted', 'LOWER']]) {
  const cfg = (mins) => ({ ...C.quickMissionConfig({ duration: mins, difficulty: 'NORMAL', focus, workoutType: type }), rng: Q.seededRng(99) });
  const at = (mins) => Q.generateQuickMission(cfg(mins));
  const base = at(30).exercises.slice(0, 3).map(e => e.name).join();
  for (const mins of [5, 8, 12, 20, 45, 60]) if (at(mins).exercises.slice(0, 3).map(e => e.name).join() !== base) stable.push(`${type} ${mins}`);
  if (JSON.stringify(at(20)) !== JSON.stringify(at(20))) stable.push(`${type} not repeatable`);
}
check('31 the same seed gives the same first moves at every minute, and the same mission twice (a slider scrub grows one workout)', stable.length === 0, stable.join());
// The setup screen's seed (quickMissionSeed): inside one shape of workout (the rounds the minutes make) a scrub keeps the same moves, and where the
// shape changes the workout is a new one, so the card visibly changes at 8, 16, 26, 36 and 46 minutes and never flickers between.
{
  const shapes = [[5, 7], [8, 15], [16, 25], [26, 35], [36, 45], [46, 60]];
  const bad = [];
  const firstMoves = (nonce, reroll, mins, type = 'Bodyweight') => Q.generateQuickMission({ ...C.quickMissionConfig({ duration: mins, difficulty: 'NORMAL', workoutType: type }), rng: Q.seededRng(Q.quickMissionSeed(nonce, reroll, mins)) }).exercises.slice(0, 3).map(e => e.name).join();
  for (const nonce of [11, 4242, 987654]) for (const type of TYPES) {
    const per = shapes.map(([lo, hi]) => { const names = new Set(); for (let m = lo; m <= hi; m++) names.add(firstMoves(nonce, 0, m, type)); if (names.size !== 1) bad.push(`${type} ${lo}-${hi} changed within a shape`); return [...names][0]; });
    if (new Set(per).size < 5) bad.push(`${type} nonce ${nonce}: only ${new Set(per).size} different openings across six shapes`);
    if (firstMoves(nonce, 1, 20, type) === firstMoves(nonce, 0, 20, type) && firstMoves(nonce, 2, 20, type) === firstMoves(nonce, 0, 20, type)) bad.push(`${type} SURPRISE did not re-deal`);
  }
  check('31a the setup seed: one workout inside a shape of minutes, a new one where the shape changes, a new one on SURPRISE', bad.length === 0, bad.slice(0, 3).join(' | '));
  check('31a2 quickMissionRounds: 1 round up to 7 minutes, 2 to 15, 3 to 25, 4 to 35, 5 to 45, 6 to 60', [[5, 1], [7, 1], [8, 2], [15, 2], [16, 3], [25, 3], [26, 4], [35, 4], [36, 5], [45, 5], [46, 6], [60, 6]].every(([m, r]) => Q.roundsFor(m) === r));
}
check('31b without a seed the deal still varies (Math.random)', new Set(Array.from({ length: 12 }, () => Q.generateQuickMission({ duration: 20 }).exercises.map(e => e.name).join())).size > 3);
check('31c seededRng is deterministic and spread over [0, 1)', (() => { const a = Q.seededRng(5), b = Q.seededRng(5); const xs = Array.from({ length: 200 }, () => a()); return xs.every((x, i) => x === b() && x >= 0 && x < 1) && new Set(xs.map(x => Math.floor(x * 10))).size === 10; })());

// ── a set that ends on DONE keeps to its slot, at any pace ─────────────────
// The runner (QuickMissionActive advanceV2) gives a loaded set's unused seconds
// to the rest after it and takes a late set's overrun from that rest
// (manualRestSeconds). Replayed here from the same module at four tempos, a
// Weighted or Hybrid mission still lands within 30 s of the minutes asked.
{
  const ex = (o) => ({ mode: 'reps', reps: 12, rest: 40, isWeighted: true, ...o });
  const ctx = { workoutType: 'Weighted' };
  const budget = T.QM_LOADED_SETUP_SEC + 12 * T.QM_LOADED_REP_SEC;
  check('29g manualSetSeconds: a loaded set is budgeted (pick-up + a rep each), a counted set or a timed move has no budget', T.manualSetSeconds(ex(), ctx) === budget
    && T.manualSetSeconds({ name: 'Push-Ups', mode: 'reps', reps: 12, rest: 20 }, { workoutType: 'Bodyweight' }) === null
    && T.manualSetSeconds({ name: 'Wall Sit', mode: 'timed', work: 40, rest: 20 }, { workoutType: 'Bodyweight' }) === null
    && T.manualSetSeconds(ex(), { workoutType: 'Hybrid' }) === budget);
  check('29h manualRestSeconds: on time keeps the rest, early adds the unused seconds, late takes the overrun, never below the floor', T.manualRestSeconds(ex(), budget, ctx) === 40
    && T.manualRestSeconds(ex(), budget - 12, ctx) === 52 && T.manualRestSeconds(ex(), budget + 12, ctx) === 28
    && T.manualRestSeconds(ex(), budget + 200, ctx) === T.QM_MANUAL_REST_FLOOR_SEC && T.manualRestSeconds(ex({ rest: 6 }), budget + 200, ctx) === 6
    && T.manualRestSeconds(ex(), undefined, ctx) === 40 && T.manualRestSeconds({ name: 'Push-Ups', mode: 'reps', reps: 12, rest: 20 }, 5, { workoutType: 'Bodyweight' }) === 20
    && Number.isInteger(T.manualRestSeconds(ex(), budget + 4.4, ctx)));
  check('29i the last number waits at most QM_LAST_NUMBER_WAIT_MS, never less than the model\'s own allowance', T.QM_LAST_NUMBER_WAIT_MS >= T.QM_LAST_NUMBER_SEC * 1000 && T.QM_LAST_NUMBER_WAIT_MS <= 1000);
  // The runner's rule, replayed: counted sets and timers as modelled, a loaded set at the athlete's pace (pick-up seconds, then secPerRep), every rest as manualRestSeconds.
  const replay = (m, setup, perRep) => {
    const tl = T.quickMissionTimeline(m, { voice: true });
    const c = { workoutType: m.workoutType };
    const slots = [...m.exercises, ...m.finisherExercises];
    let total = tl.introSec;
    for (let r = 1; r <= m.rounds; r++) slots.forEach((e, i) => {
      const manual = T.manualSetSeconds(e, c) !== null;
      const worked = manual ? setup + e.reps * perRep : T.workSeconds(e, { workoutType: m.workoutType, voice: true });
      total += worked;
      if (r === m.rounds && i === slots.length - 1) return;
      total += manual ? T.manualRestSeconds(e, worked, c) : e.rest;
    });
    return total;
  };
  const worst = {};
  const bad = [];
  for (const type of ['Weighted', 'Hybrid']) for (const level of ['Easy', 'Normal', 'Hard', 'Advanced']) for (let mins = 5; mins <= 60; mins += 5) for (const seed of [1, 2, 3]) {
    const m = Q.generateQuickMission({ workoutType: type, difficulty: level, duration: mins, rng: Q.seededRng(seed * 977 + mins) });
    for (const [setup, perRep] of [[3, 2], [5, 3], [8, 4], [4, 3.5]]) {
      const miss = replay(m, setup, perRep) - mins * 60;
      const key = `${setup},${perRep}`;
      worst[key] = Math.max(worst[key] || 0, Math.abs(miss));
      if (Math.abs(miss) > 30) bad.push(`${type}/${level}/${mins} (${setup} s + ${perRep} s a rep) ${Math.round(miss)}s`);
    }
  }
  check('29j Weighted and Hybrid missions land within 30 s of the minutes at a quick, the model\'s, a slow and a heavy tempo', bad.length === 0, `${bad.length} off, first ${bad.slice(0, 3).join(' | ')}; worst by tempo ${JSON.stringify(worst)}`);
  // Without the hold (every rest as dealt) a slow lifter drifts far past 30 s, which is what the hold is for.
  const mSlow = Q.generateQuickMission({ workoutType: 'Weighted', difficulty: 'Hard', duration: 10, rng: Q.seededRng(7) });
  const driftNoHold = [...mSlow.exercises].reduce((a, e) => a + (8 + e.reps * 4 - T.manualSetSeconds(e, { workoutType: 'Weighted' })), 0) * mSlow.rounds;
  check('29k the hold is doing work: at a slow tempo the unheld run would be more than 30 s long', driftNoHold > 30, String(driftNoHold));
}

// ── XP: the same minutes never pay less at a harder level ───────────────────
// Today's generated mission pays minutes x the level's rate (data/quickMissionXp),
// the sets splitting it, so ADVANCED (fewer, longer sets in the same minutes)
// never pays less than HARD, and no level pays less than EASY, whatever the
// seed dealt. GUIDED (userStats quickMissionXp) and AT YOUR PACE (missionSolo
// missionXp) read the same figure.
{
  const bad = [];
  const xpFull = (m) => { const n = ([...m.exercises, ...m.finisherExercises]).length * m.rounds; return U.quickMissionXp(n, n, true, m); };
  let rows = 0;
  for (const type of TYPES) for (let mins = 5; mins <= 60; mins++) for (const seed of [1, 2, 3, 4]) {
    const xp = {};
    for (const level of ['Easy', 'Normal', 'Hard', 'Advanced']) xp[level] = xpFull(Q.generateQuickMission({ workoutType: type, difficulty: level, duration: mins, rng: Q.seededRng(seed * 131 + mins * 7) }));
    rows++;
    if (!(xp.Advanced >= xp.Hard && xp.Hard >= xp.Normal && xp.Normal >= xp.Easy && xp.Advanced > xp.Easy)) bad.push(`${type}/${mins}/${seed} ${JSON.stringify(xp)}`);
  }
  check('32 the same minutes pay EASY <= MEDIUM <= HARD <= ADVANCED XP, on every seed, type and minute from 5 to 60', bad.length === 0 && rows > 600, bad.slice(0, 3).join(' | '));
  const m20 = Q.generateQuickMission({ workoutType: 'Bodyweight', difficulty: 'Advanced', duration: 20, rng: Q.seededRng(5) });
  const n20 = m20.exercises.length * m20.rounds;
  check('33 a full finish pays minutes x the rate + 30; a stopped run keeps its share of the minutes, no finish bonus', U.quickMissionXp(n20, n20, true, m20) === 20 * QX.QM_XP_PER_MIN.advanced + 30
    && U.quickMissionXp(Math.round(n20 / 2), n20, false, m20) === Math.round(20 * QX.QM_XP_PER_MIN.advanced * Math.round(n20 / 2) / n20)
    && U.quickMissionXp(0, n20, false, m20) === 0 && U.quickMissionXp(n20, n20, false, m20) === 20 * QX.QM_XP_PER_MIN.advanced);
  check('34 a classic, a plan day and a library mission keep 15 a set (and no mission at all is the old rule)', U.quickMissionXp(10, 10, true) === 180
    && U.quickMissionXp(10, 10, true, { ...m20, named: 'murph' }) === 180 && U.quickMissionXp(4, 10, false, { ...m20, planId: 'p' }) === 60 && U.quickMissionXp(10, 10, true, { ...m20, v2: true }) === 180
    && QX.generatedMissionXp({ ...m20, difficulty: 'Savage' }) === null && QX.generatedMissionXp({ ...m20, duration: 0 }) === null && QX.generatedMissionXp(null) === null);
  check('35 AT YOUR PACE pays the same figure as guided for a full finish and a share for a stopped run', (() => {
    const a = SG.soloFromGenerated(m20);
    const full = MS.missionXp(a, { slots: MS.totalSlots(a), workedSec: 0, full: true });
    const half = MS.missionXp(a, { slots: MS.totalSlots(a), ratio: 0.5 });
    return full === U.quickMissionXp(n20, n20, true, m20) && half === Math.round(20 * QX.QM_XP_PER_MIN.advanced * 0.5);
  })());
}

// ── the Fit hub's and Home's START begins on the athlete's level ────────────
// The suggestion cards used to carry a fixed Easy or Normal, so a level 10
// athlete's START ran MEDIUM. Now only the two recovery picks fix EASY; every
// other Quick Mission pick names no level and starts on the athlete's own.
{
  // XP earned on one kind of session ('Cardio' counts as Fit XP but is none of the sessions the recommender avoids repeating).
  const statsOf = (xp, last = 'Cardio') => ({ xp, sessions: xp ? [{ id: 'a', type: last, xpEarned: xp, completedAt: '2026-01-01T00:00:00.000Z' }] : [] });
  const level = (xp, profile, last) => {
    const stats = statsOf(xp, last);
    const pick = RC.getFitMiniSuggestion({ profile, stats, dailyMission: null });
    return { title: pick.title, payload: pick.actionPayload, difficulty: pick.actionType === 'quickMission' ? C.quickMissionConfig({ ...pick.actionPayload, stats }).difficulty : null };
  };
  const starter = { goal: 'Get Fit', experience: 'Beginner' };
  const bad = [];
  // The beginner Starter and the fallback follow the level: EASY at level 1, ADVANCED at level 10.
  for (const [xp, want] of [[0, 'Easy'], [300, 'Easy'], [2200, 'Normal'], [3200, 'Hard'], [4600, 'Advanced']]) {
    const a = level(xp, starter), f = level(xp, { goal: 'Improve Health', experience: 'Advanced' });
    if (a.difficulty !== want || 'difficulty' in a.payload) bad.push(`Starter at ${xp} XP: ${a.difficulty}`);
    if (f.difficulty !== want || 'difficulty' in f.payload) bad.push(`fallback at ${xp} XP: ${f.difficulty} ${JSON.stringify(f.payload)}`);
    // After a Quick Mission the next pick (New Challenge) follows the level too.
    const n = level(xp, { goal: 'Improve Health', experience: 'Advanced' }, 'Quick Mission');
    if (n.difficulty !== want || /Recovery/.test(n.title)) bad.push(`New Challenge at ${xp} XP: ${n.difficulty} ${n.title}`);
    // The two recovery picks stay EASY at every level, on purpose.
    for (const last of xp ? ['Fit Mode', 'Combat Conditioning'] : []) {
      const r = level(xp, { goal: 'Improve Health', experience: 'Advanced' }, last);
      if (!/Recovery/.test(r.title) || r.difficulty !== 'Easy') bad.push(`${last} recovery at ${xp} XP: ${r.title} ${r.difficulty}`);
    }
  }
  check('36 the Fit hub and Home picks start on the athlete\'s level (the recovery picks stay EASY)', bad.length === 0, bad.slice(0, 3).join(' | '));
  check('37 Home\'s Continue card words a Quick Mission\'s level as the page does (MEDIUM for the stored Normal)', ['Easy', 'Normal', 'Hard', 'Advanced'].map(d => LS.describeSession({ kind: 'quick_mission', cfg: { focus: 'Full Body', difficulty: d, duration: 15 } }).diff).join() === 'Easy,Medium,Hard,Advanced');
}

// ── the Workout Builder: the minutes on the card are the minutes it runs ────
// The Builder's generator (fit-mode/fitModeGenerator) fits its list to the
// DURATION by the guided player's own timeline (data/builderTiming). Every
// DURATION x DIFFICULTY x EQUIPMENT the setup offers, over every muscle pick,
// lands within 15% of the minutes; a set scheme lands within 15% wherever its
// fixed sets can, and otherwise as close as eight rows allow.
{
  const G = await import('../components/training-mode/fit-mode/fitModeGenerator.js');
  const BT = await import('../components/training-mode/data/builderTiming.js');
  const WP = await import('../components/training-mode/data/workoutPrograms.js');
  const { FIT_MODE_EXERCISES } = await import('../components/training-mode/fit-mode/fitModeExerciseData.js');
  const byName = new Map(FIT_MODE_EXERCISES.map(e => [e.name, e]));
  const player = fs.readFileSync(new URL('../components/training-mode/FitBuilderGuidedPlayer.jsx', import.meta.url), 'utf8');

  // The model reads the player's own numbers.
  const pins = [
    ['cadence 2 s a rep', /useState\(2\);\s*\n/.test(player) && BT.BUILDER_CADENCE_SEC === 2],
    ['rep intro 2.6 s, tail 0.7 s', /On my count\.`\);\s*\n\s*await delay\(2600\)/.test(player) && /await delay\(700\);\s*\n\s*live\.current\.finishSet/.test(player) && BT.BUILDER_REP_INTRO_SEC === 2.6 && BT.BUILDER_REP_TAIL_SEC === 0.7],
    ['weighted window', player.includes('Math.max(60, Math.ceil((reps * 12) / 30) * 30)') && BT.builderSetKind({ reps: 10, equipment: 'Dumbbell' }).windowSec === 120],
    ['weighted later set 2.8 + 5 + 1.2 s', /Get into position\.`\);\s*\n\s*setPhase\('position'\);\s*\n\s*await delay\(2800\)/.test(player) && /waitSec\(version, 5, \(r\) => setDisplay\(r\)\)/.test(player) && /Get ready\. Lift\.'\);\s*\n\s*await delay\(1200\)/.test(player) && BT.BUILDER_POSITION_SEC === 9],
    ['hold 2.4 + 5 + 1 s', /await delay\(2400\)/.test(player) && /say\('Get ready\. Go\.'\);\s*\n\s*await delay\(1000\)/.test(player) && Math.abs(BT.BUILDER_HOLD_INTRO_SEC - 8.4) < 1e-9],
    ['row done 0.9 s, map 1.2 s, count-in 3 x 650 ms', /complete\.`\);\s*\n\s*await delay\(900\)/.test(player) && player.includes("setMapMode('complete'); setMapOpen(true); }, 1200)") && player.includes('await delay(650)') && BT.BUILDER_ROW_DONE_SEC === 0.9],
    ['loaded pace = the Quick Mission\'s', BT.BUILDER_LOADED_REP_SEC === T.QM_LOADED_REP_SEC && BT.BUILDER_LOADED_SETUP_SEC === T.QM_LOADED_SETUP_SEC],
  ].filter(([, ok]) => !ok).map(([n]) => n);
  check('38 the Builder timing model is pinned to the guided player\'s own numbers', pins.length === 0, pins.join(', '));

  // A hand-sized row, worked by hand: 3 x 10 bodyweight reps, 60 s rest.
  const bwRow = { reps: '6-10', equipment: 'Bodyweight', sets: 3, restSeconds: 60 };
  const dbRow = { reps: '6-10', equipment: 'Dumbbell', sets: 2, restSeconds: 75 };
  check('39 the Builder timeline adds up by hand', Math.abs(BT.builderRowSeconds(bwRow) - (3 * (2.6 + 20 + 0.7) + 2 * 60 + 0.9)) < 1e-9
    && Math.abs(BT.builderRowSeconds(dbRow) - ((5 + 35) + (9 + 35) + 75 + 0.9)) < 1e-9
    && Math.abs(BT.builderWorkoutSeconds([bwRow, dbRow]) - (BT.BUILDER_START_SEC + BT.builderRowSeconds(bwRow) + BT.builderRowSeconds(dbRow) + BT.BUILDER_NEXT_ROW_SEC)) < 1e-9);

  const chips = Object.keys(WP.CHIP_GROUPS);
  const subsets = [];
  for (let m = 1; m < 1 << chips.length; m++) subsets.push(chips.filter((_, i) => m & (1 << i)));
  const build = (cfg) => { store.clear(); return BT.applySetScheme(G.generateFitModeWorkout(cfg), cfg.setScheme); };
  const offAuto = [], gear = [], hardInEasy = [], empty = [];
  for (const duration of WP.DURATIONS) for (const difficulty of ['Easy', 'Normal', 'Hard']) for (const equipment of TYPES) for (const sub of subsets) {
    const w = build({ muscleGroups: sub.flatMap(c => WP.CHIP_GROUPS[c]), equipment, difficulty, focus: 'Strength', duration, addCardio: false, setScheme: null });
    const tag = `${duration} min ${difficulty} ${equipment} ${sub.join('+')}`;
    if (!w.length) { empty.push(tag); continue; }
    const err = BT.builderWorkoutSeconds(w) / (duration * 60) - 1;
    if (Math.abs(err) > 0.15) offAuto.push(`${tag}: ${Math.round(err * 100)}%`);
    for (const ex of w) {
      const src = byName.get(ex.name);
      if (/^(Cable|Machine)$/.test(ex.equipment) || (equipment === 'Bodyweight' && ex.equipment !== 'Bodyweight') || (equipment === 'Weighted' && ex.equipment === 'Bodyweight')) gear.push(`${tag}: ${ex.name} (${ex.equipment})`);
      if (difficulty === 'Easy' && /^(Hard|Advanced)$/.test(src?.difficulty || '')) hardInEasy.push(`${tag}: ${ex.name}`);
    }
    if (w.length > G.MAX_EXERCISES) empty.push(`${tag}: ${w.length} rows`);
  }
  check('40 every Builder pick (AUTO) runs within 15% of its DURATION, 15 to 60 min, every level, gear and muscle pick', offAuto.length === 0, `${offAuto.length} off: ${offAuto.slice(0, 4).join(' | ')}`);
  check('41 a Builder workout keeps to its gear (no cable or machine, no loaded move at BODYWEIGHT)', gear.length === 0, gear.slice(0, 4).join(' | '));
  check('42 an Easy Builder workout never gets a Hard move', hardInEasy.length === 0, `${hardInEasy.length}: ${hardInEasy.slice(0, 4).join(' | ')}`);
  check('43 every Builder pick builds 1 to 8 rows', empty.length === 0, empty.slice(0, 4).join(' | '));

  // Set schemes fix every loaded lift's sets, reps and rest, so the row count
  // (and the bodyweight rows' sets) is all the fit can move.
  const schemes = WP.SET_SCHEMES.filter(x => x.sets).map(x => ({ id: x.id, sets: x.sets, reps: x.reps, restSeconds: x.restSeconds }));
  const offScheme = [];
  for (const duration of WP.DURATIONS) for (const difficulty of ['Easy', 'Normal', 'Hard']) for (const equipment of TYPES) for (const setScheme of schemes) for (const sub of subsets.filter((_, i) => i % 9 === 0)) {
    const w = build({ muscleGroups: sub.flatMap(c => WP.CHIP_GROUPS[c]), equipment, difficulty, focus: 'Strength', duration, addCardio: false, setScheme });
    const target = duration * 60, got = BT.builderWorkoutSeconds(w);
    const longest = Math.max(...w.map(BT.builderRowSeconds));
    const ok = Math.abs(got - target) <= 0.15 * target || (got < target && w.length === G.MAX_EXERCISES) || Math.abs(got - target) <= longest / 2 + BT.BUILDER_NEXT_ROW_SEC;
    if (!ok) offScheme.push(`${duration} ${difficulty} ${equipment} ${setScheme.id} ${sub.join('+')}: ${Math.round((got / target - 1) * 100)}% ${w.length} rows`);
  }
  check('44 a set scheme fits the DURATION as closely as its fixed sets and eight rows allow', offScheme.length === 0, offScheme.slice(0, 4).join(' | '));

  // The swap list's rule: the generator's gear rule and one difficulty step.
  const swapBad = [];
  for (const equipment of TYPES) for (const difficulty of ['Easy', 'Normal', 'Hard']) for (const ex of FIT_MODE_EXERCISES) {
    if (!G.fitsBuilderSlot(ex, { equipment, difficulty })) continue;
    if (/^(Cable|Machine)$/.test(ex.equipment) || !ex.active) swapBad.push(`${equipment}: ${ex.name} (${ex.equipment})`);
    if ((difficulty === 'Easy' && /^(Hard|Advanced)$/.test(ex.difficulty)) || (difficulty === 'Hard' && ex.difficulty === 'Easy')) swapBad.push(`${difficulty}: ${ex.name} (${ex.difficulty})`);
    if ((equipment === 'Bodyweight') !== (ex.equipment === 'Bodyweight') && equipment !== 'Hybrid') swapBad.push(`${equipment}: ${ex.name} (${ex.equipment})`);
  }
  const offered = TYPES.every(equipment => ['Easy', 'Normal', 'Hard'].every(difficulty => FIT_MODE_EXERCISES.some(ex => G.fitsBuilderSlot(ex, { equipment, difficulty }))));
  check('45 a Builder swap never offers cable or machine moves, other gear, or a move two levels away', swapBad.length === 0 && offered, swapBad.slice(0, 4).join(' | '));

  // A program card prints programMinutes for the gear picked: every day, at
  // every gear and level the Programs screen launches, builds that. (FULL
  // BODY's card printed a fixed ~40 min; WEIGHTED builds about 34.)
  const offProg = [];
  for (const p of WP.PROGRAMS) for (let d = 0; d < p.days.length; d++) for (const equipment of TYPES) for (const difficulty of ['Easy', 'Normal', 'Hard']) for (let i = 0; i < 4; i++) {
    store.clear(); if (p.rotateKey) store.set(p.rotateKey, String(d));
    const cfg = WP.startProgramDay(p, { equipment, difficulty });
    const err = BT.builderWorkoutSeconds(BT.applySetScheme(G.generateFitModeWorkout(cfg), cfg.setScheme)) / (WP.programMinutes(p, equipment) * 60) - 1;
    if (Math.abs(err) > 0.15) offProg.push(`${p.id} ${p.days[d].label} ${equipment} ${difficulty}: ${Math.round(err * 100)}%`);
  }
  check('46 every program day builds within 15% of the minutes on its card', offProg.length === 0 && WP.PROGRAMS.every(p => !/min/.test(p.meta)) && WP.programMinutes(WP.PROGRAMS[0], 'Weighted') === 34 && WP.programMinutes(WP.PROGRAMS[0], 'Bodyweight') === 40, offProg.slice(0, 4).join(' | '));
}

// ── plan days and classics launch at their own level ────────────────────────
{
  const WL = await import('../components/training-mode/data/workoutLibrary.js');
  const NW = await import('../components/training-mode/data/namedWorkouts.js');
  const MM = await import('../components/training-mode/data/missionMoves.js');
  const want = { beginner: 'Easy', intermediate: 'Normal', advanced: 'Advanced' };
  const bad = [];
  for (const p of WL.PLAN_PROGRAMS) {
    store.clear();
    const lvl = p.meta.split('·')[0].trim().toLowerCase();
    const m = WL.startPlanDay(p);
    if (m.difficulty !== (want[lvl] || 'Normal')) bad.push(`${p.id}: ${m.difficulty}`);
  }
  const beginner = WL.startPlanDay(WL.planById('shadowbox_mini'));
  const cfg = C.quickMissionConfig({ duration: beginner.duration, focus: beginner.focus, difficulty: beginner.difficulty });
  check('47 a plan day launches at its plan\'s level (7-DAY SHADOWBOX MINI is EASY, not HARD)', bad.length === 0 && beginner.difficulty === 'Easy' && cfg.difficulty === 'Easy', bad.slice(0, 4).join(' | '));
  const sf = ['strike_fitness_easy', 'strike_fitness_mid', 'strike_fitness_adv'].map(id => NW.buildNamedMission(id).difficulty).join();
  check('48 a classic with a stated level launches at it; the others stay HARD', sf === 'Easy,Normal,Advanced' && NW.buildNamedMission('murph').difficulty === 'Hard', sf);
  // A bodyweight plan day asks for no load: no move the catalog lists with a
  // kettlebell, dumbbell, barbell or plate.
  const byName = new Map(MM.MOVES.map(x => [x.name.toLowerCase(), x]));
  const loaded = [];
  for (const p of WL.PLAN_PROGRAMS) p.days.forEach((d, i) => {
    if ((d.workoutType || 'Bodyweight') !== 'Bodyweight') return;
    for (const e of d.build()) { const mv = byName.get(e.name.toLowerCase()); if (mv && ['bell', 'db', 'barbell', 'plate'].includes(mv.gear)) loaded.push(`${p.id} day ${i + 1}: ${e.name}`); }
  });
  check('49 a bodyweight plan day holds no loaded move', loaded.length === 0, loaded.join(' | '));
}

// ── camp session cards state the rounds the timer runs ──────────────────────
{
  const CC = await import('../components/training-mode/protocol/content.ts');
  const map = fs.readFileSync(new URL('../components/training-mode/TrainingCampMap.jsx', import.meta.url), 'utf8');
  const bad = [];
  for (const d of ['boxing', 'kickboxing', 'muay_thai', 'mma']) for (let level = 1; level <= 12; level++) for (const diff of ['easy', 'normal', 'hard']) {
    const p = CC.campRoundPlan(d, level, diff);
    const mins = p.rounds * p.roundMin + (p.rounds - 1) * p.restSec / 60;
    if (CC.campSessionMinutes(d, level, diff) !== Math.max(1, Math.round(mins)) || !(p.rounds >= 1 && p.roundMin > 0)) bad.push(`${d} L${level} ${diff}`);
  }
  // The card prints the plan's minutes and the timer's cfg is built from the
  // same plan, not the module's duration_min.
  const wired = /campSessionMinutes\(discKey, open\.level, difficulty\)/.test(map) && /campRoundPlan\(discKey, level, diff\)/.test(map) && !/durationMin/.test(map);
  check('50 a camp session card states the rounds and rests the timer runs (boxing L4 Normal: ~16m, not ~26m)', bad.length === 0 && wired && CC.campSessionMinutes('boxing', 4, 'normal') === 16, `${bad.slice(0, 4).join(', ')} wired=${wired} L4=${CC.campSessionMinutes('boxing', 4, 'normal')}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

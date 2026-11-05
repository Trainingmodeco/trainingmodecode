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
check('31b without a seed the deal still varies (Math.random)', new Set(Array.from({ length: 12 }, () => Q.generateQuickMission({ duration: 20 }).exercises.map(e => e.name).join())).size > 3);
check('31c seededRng is deterministic and spread over [0, 1)', (() => { const a = Q.seededRng(5), b = Q.seededRng(5); const xs = Array.from({ length: 200 }, () => a()); return xs.every((x, i) => x === b() && x >= 0 && x < 1) && new Set(xs.map(x => Math.floor(x * 10))).size === 10; })());

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

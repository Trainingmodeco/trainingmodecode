// Quick Mission · AT YOUR PACE for today's (generated) mission: the adapter
// (data/soloFromGenerated) that turns a generated mission into the list-and-
// timer run, the one place a start with no choice screen decides its run, the
// pace tiers, the XP it pays (the guided XP, never more or less), the floors,
// the words (no 'SOLO' on screen) and the hub's detail line.
// Run with `npm run test:ayp`.
import { register } from 'node:module';

// data/quickMissionConfig takes CADENCE_PRESETS from shared/CadenceSlider.jsx,
// which node cannot parse. The hook serves just that export, read from the
// real file (the same one test-qm-generator uses).
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
const A = await import('../components/training-mode/data/soloFromGenerated.js');
const S = await import('../components/training-mode/data/missionSolo.js');
const L = await import('../components/training-mode/data/loadoutMissions.js');
const C = await import('../components/training-mode/data/quickMissionConfig.js');
const US = await import('../components/training-mode/data/userStats.js');
const N = await import('../components/training-mode/data/namedWorkouts.js');
const G = await import('../components/training-mode/shared/screenGuides.js');

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}  ${extra}`); } };
const show = (v) => JSON.stringify(v);
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

const TYPES = ['Bodyweight', 'Weighted', 'Hybrid'];
const LEVELS = ['Easy', 'Normal', 'Hard'];
const FOCI = ['Full Body', 'Upper', 'Lower', 'Core', 'Combat'];
const MINUTES = [3, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];
const FORMATS = ['Auto', 'Timed'];
const DEALS = 2;

// Every number in an object is finite (no NaN, no Infinity, anywhere).
const finite = (v) => (typeof v === 'number' ? Number.isFinite(v) : Array.isArray(v) ? v.every(finite) : v && typeof v === 'object' ? Object.values(v).every(finite) : true);

// Deal the whole grid once: type x level x focus x length x format x finisher.
const cases = [];
for (const workoutType of TYPES) for (const difficulty of LEVELS) for (const focus of FOCI) for (const duration of MINUTES) for (const format of FORMATS) {
  for (let k = 0; k < DEALS; k += 1) {
    const gen = Q.generateQuickMission({ workoutType, difficulty, focus, duration, format, cardioFinisher: k === 1 });
    cases.push({ gen, tag: `${workoutType}/${difficulty}/${focus}/${duration}/${format}/${k}` });
  }
}

const problems = (name, test) => {
  const out = [];
  for (const c of cases) {
    let why = null;
    try { why = test(c); } catch (e) { why = `threw ${e.message}`; }
    if (why) out.push(`${c.tag}: ${why}`);
  }
  check(`${name} (${cases.length} missions)`, out.length === 0, out.slice(0, 4).join(' | '));
};

const adapt = (gen) => A.soloFromGenerated(gen);
const movesOf = (gen) => [...gen.exercises, ...gen.finisherExercises];

// ── the shape ───────────────────────────────────────────────────────────────
problems('1 every generated mission adapts, with its moves listed once, in order, with the same doses', ({ gen }) => {
  const a = adapt(gen);
  if (!a) return 'null';
  const moves = movesOf(gen);
  if (a.exercises.length !== moves.length) return `${a.exercises.length} slots for ${moves.length} moves`;
  for (let i = 0; i < moves.length; i += 1) {
    const s = a.exercises[i];
    if (s.name !== moves[i].name) return `slot ${i} is ${s.name}, not ${moves[i].name}`;
    if (moves[i].mode === 'timed' ? s.mode !== 'timed' || s.work !== moves[i].work : s.mode !== 'reps' || s.reps !== moves[i].reps) return `slot ${i} dose differs`;
    if (s.rest !== 0) return `slot ${i} has its own rest`;
  }
  if (new Set(a.exercises.map(s => s.swapKey)).size !== a.exercises.length) return 'swapKeys repeat';
  if (a.format !== 'forTime' || a.rounds !== gen.rounds || a.title !== gen.title || a.focus !== gen.focus || a.workoutType !== gen.workoutType || a.duration !== gen.duration) return 'header differs';
  if (a.finisherExercises.length !== 0 || a.v2 || a.named || a.planId) return 'flags';
  return null;
});
problems('2 no NaN or Infinity anywhere in the adapted mission', ({ gen }) => (finite(adapt(gen)) ? null : 'a number is not finite'));
problems('3 the adapter is pure: the generated mission is untouched and a second run is equal', ({ gen }) => {
  const before = show(gen);
  const a = adapt(gen);
  const b = adapt(gen);
  return show(gen) === before && show(a) === show(b) ? null : 'mutated or not repeatable';
});

// ── pace and the clock ──────────────────────────────────────────────────────
problems('4 tiers: whole 15-second marks, ELITE < STANDARD < BEGINNER, STANDARD about the guided estimate', ({ gen }) => {
  const { pace } = adapt(gen);
  const est = Q.estimateQuickMissionSeconds(gen);
  if (![pace.elite, pace.standard, pace.beginner].every(n => Number.isInteger(n) && n > 0 && n % 15 === 0)) return `marks ${show(pace)}`;
  if (!(pace.elite < pace.standard && pace.standard < pace.beginner)) return `order ${show(pace)}`;
  if (Math.abs(pace.standard - est) > 7.5 + 1e-9) return `standard ${pace.standard} vs estimate ${est}`;
  return null;
});
problems('5 ELITE is never under 1.2 x the moves\' own seconds (unless STANDARD itself is that close) and never over 1.6 x, BEGINNER about 1.4 x', ({ gen }) => {
  const { pace } = adapt(gen);
  const work = Q.estimateQuickMissionWorkSeconds(gen);
  const est = Q.estimateQuickMissionSeconds(gen);
  if (pace.elite < Math.min(pace.standard - 15, 1.2 * work - 7.5)) return `elite ${pace.elite} work ${work}`;
  if (pace.elite > 1.6 * work + 7.5 && pace.elite > 15) return `elite ${pace.elite} work ${work} (over 1.6 x)`;
  if (pace.beginner < 1.4 * est - 7.5 || pace.beginner > 1.4 * est + 15 + 7.5) return `beginner ${pace.beginner} est ${est}`;
  return null;
});
problems('6 the cap is whole minutes, past every tier, and is the run clock; there is no timeline (it counts up)', ({ gen }) => {
  const a = adapt(gen);
  if (a.capSec % 60 !== 0 || a.capSec <= a.pace.beginner) return `cap ${a.capSec} beginner ${a.pace.beginner}`;
  if (S.missionClockSec(a) !== a.capSec || S.soloTimeline(a).length !== 0 || S.isFixedClock(a.format)) return 'clock';
  if (S.soloExpectedSec(a) !== a.pace.standard) return `expected ${S.soloExpectedSec(a)}`;
  return null;
});
problems('7 the PACE box reads three "≤ m:ss" targets, fastest first', ({ gen }) => {
  const a = adapt(gen);
  const t = S.paceTargets(a);
  const want = [a.pace.elite, a.pace.standard, a.pace.beginner].map(s => `≤ ${mmss(s)}`);
  return show(t.map(x => x.text)) === show(want) && show(t.map(x => x.label)) === show(['ELITE', 'STANDARD', 'BEGINNER']) ? null : show(t);
});

// ── the rounds and the ROUND button ─────────────────────────────────────────
problems('8 ROUND once per round with two or more, FINISH alone with one; no timed rest between rounds', ({ gen }) => {
  const a = adapt(gen);
  if (S.hasRoundTimer(a) !== (a.rounds >= 2)) return `hasRoundTimer ${S.hasRoundTimer(a)} for ${a.rounds} rounds`;
  if (S.soloRounds(a) !== a.rounds) return `soloRounds ${S.soloRounds(a)}`;
  for (let t = 1; t <= a.rounds; t += 1) if (S.roundRestSec(a, t) !== 0) return `rest after tap ${t}`;
  if (S.totalSlots(a) !== movesOf(gen).length * gen.rounds) return `totalSlots ${S.totalSlots(a)}`;
  return null;
});
problems('9 the splits close on FINISH: every round has a lap, and the laps add up to the finish', ({ gen }) => {
  const a = adapt(gen);
  if (a.rounds < 2) return null;
  const finish = a.pace.standard;
  // The athlete taps ROUND at the end of every round but the last, FINISH ends it.
  const taps = Array.from({ length: a.rounds - 1 }, (_, i) => ({ at: Math.round(((i + 1) * finish) / a.rounds) * 1000, block: 0 }));
  const closed = S.roundSplits(a, S.closeSplits(a, taps, finish));
  if (closed.length !== a.rounds) return `${closed.length} splits for ${a.rounds} rounds`;
  if (closed.reduce((n, r) => n + r.lapSec, 0) !== finish) return `laps add to ${closed.reduce((n, r) => n + r.lapSec, 0)}, not ${finish}`;
  return null;
});

// ── the XP: the guided XP, with the existing floors ─────────────────────────
const settle = (a, o) => S.settleSoloXp({ mode: 'solo', mission: a, format: a.format, totalSlots: S.totalSlots(a), completed: false, stopped: false, capped: false, ...o });
const guidedFull = (gen) => US.quickMissionXp(movesOf(gen).length * gen.rounds, movesOf(gen).length * gen.rounds, true);
problems('10 a full finish at STANDARD pays exactly what the same mission pays guided (15 a slot + 30)', ({ gen }) => {
  const a = adapt(gen);
  const r = settle(a, { completed: true, elapsedSec: a.pace.standard });
  return r.outcome === 'pass' && r.xp === guidedFull(gen) && r.xp === 15 * S.totalSlots(a) + 30 && S.fullRunXp(a) === r.xp ? null : `${show(r)} vs guided ${guidedFull(gen)}`;
});
problems('11 any believable finish pays the same: ELITE, BEGINNER and well past the cap\'s tiers', ({ gen }) => {
  const a = adapt(gen);
  const want = guidedFull(gen);
  const bad = [a.pace.elite, a.pace.beginner, a.pace.beginner * 2].filter(sec => settle(a, { completed: true, elapsedSec: sec }).xp !== want);
  return bad.length ? `no full XP at ${bad.join(', ')}` : null;
});
problems('12 the floor is half of ELITE: one second under pays 0 (too fast), at it pays in full', ({ gen }) => {
  const a = adapt(gen);
  const floor = S.soloFloorSec(a);
  if (floor !== Math.ceil(0.5 * a.pace.elite)) return `floor ${floor}`;
  const under = settle(a, { completed: true, elapsedSec: floor - 1 });
  const at = settle(a, { completed: true, elapsedSec: floor });
  return under.xp === 0 && under.outcome === 'too_fast' && at.xp === guidedFull(gen) ? null : `${show(under)} / ${show(at)}`;
});
problems('13 the floor is a believable lower bound: at least 0.6 x the moves\' own seconds, or half of ELITE when STANDARD is that close', ({ gen }) => {
  const a = adapt(gen);
  const work = Q.estimateQuickMissionWorkSeconds(gen);
  const floor = S.soloFloorSec(a);
  return floor >= Math.min(0.5 * (a.pace.standard - 15), 0.6 * work - 7.5) && floor >= 8 ? null : `floor ${floor} work ${work} standard ${a.pace.standard}`;
});
// Two-sided: the floor is a believable lower bound AND never above what the moves
// take with no rest at all, so an honest no-rest finish is paid (an Easy mission's
// rests are most of its estimate; half of 70% of it alone sat above the work).
problems('13b the floor is never above 0.9 x the moves\' own seconds: a no-rest finish at the coach\'s cadence pays the full XP', ({ gen }) => {
  const a = adapt(gen);
  const work = Q.estimateQuickMissionWorkSeconds(gen);
  const floor = S.soloFloorSec(a);
  if (floor > 0.9 * work) return `floor ${floor} work ${work}`;
  const r = settle(a, { completed: true, elapsedSec: work });
  return r.outcome === 'pass' && r.xp === guidedFull(gen) ? null : `no-rest finish at ${work}s: ${show(r)}`;
});
check('13c an Easy 10 minute bodyweight mission: a no-rest finish at its own seconds pays, a tap-and-done at 0 does not', (() => {
  const gen = Q.generateQuickMission({ workoutType: 'Bodyweight', difficulty: 'Easy', focus: 'Full Body', duration: 10 });
  const a = adapt(gen);
  const work = Q.estimateQuickMissionWorkSeconds(gen);
  return settle(a, { completed: true, elapsedSec: work }).xp === guidedFull(gen) && settle(a, { completed: true, elapsedSec: 0 }).xp === 0
    && settle(a, { completed: true, elapsedSec: 0 }).message === S.TOO_FAST_TIME_MESSAGE && /half the elite time/.test(S.TOO_FAST_TIME_MESSAGE);
})());
problems('14 a stopped run pays by the share of STANDARD it ran: none under a quarter, less than a finish after it', ({ gen }) => {
  const a = adapt(gen);
  const early = settle(a, { stopped: true, elapsedSec: Math.floor(a.pace.standard * 0.2) });
  const half = settle(a, { stopped: true, elapsedSec: Math.floor(a.pace.standard * 0.5) });
  const nearly = settle(a, { stopped: true, elapsedSec: Math.floor(a.pace.standard * 0.95) });
  if (early.xp !== 0 || early.outcome !== 'none') return `early ${show(early)}`;
  if (half.outcome !== 'partial' || !(half.xp > 0 && half.xp < guidedFull(gen))) return `half ${show(half)}`;
  if (!(nearly.xp >= half.xp && nearly.xp < guidedFull(gen))) return `nearly ${show(nearly)}`;
  return null;
});
problems('15 reaching the cap pays the finish, a quit before the quarter pays 0', ({ gen }) => {
  const a = adapt(gen);
  const capped = settle(a, { completed: true, capped: true, elapsedSec: a.capSec });
  return capped.xp === guidedFull(gen) && capped.outcome === 'pass' ? null : show(capped);
});

// ── the list the screen shows ───────────────────────────────────────────────
problems('16 every move is a row: its name, "12 reps" or "40s", no swap', ({ gen }) => {
  const a = adapt(gen);
  const rows = L.cardRows(a, { gear: new Set(['none']) });
  const moves = movesOf(gen);
  if (rows.length !== moves.length) return `${rows.length} rows for ${moves.length} moves`;
  for (let i = 0; i < moves.length; i += 1) {
    const want = moves[i].mode === 'timed' ? `${moves[i].work}s` : `${moves[i].reps} reps`;
    const wantDose = moves[i].mode === 'timed' && moves[i].work >= 60 ? mmss(moves[i].work) : want;
    if (rows[i].name !== moves[i].name || rows[i].dose !== wantDose || rows[i].canSwap || rows[i].undoable) return `row ${i} ${show(rows[i])}`;
    if (moves[i].isFinisher && rows[i].prefix !== 'FINISHER') return `finisher row ${i} has no tag`;
  }
  return null;
});
problems('17 the words on the screen: the line names the rounds, no franchise or SOLO jargon, loaded work gets a safe-weight note', ({ gen }) => {
  const a = adapt(gen);
  const text = [a.missionLine, a.note, a.paceBasis, a.formatLabel, a.levelLabel, a.title].filter(Boolean).join(' | ');
  if (/solo/i.test(text)) return `jargon in ${text}`;
  if (!new RegExp(`^${a.rounds} ROUNDS?\\b`).test(a.missionLine)) return `line ${a.missionLine}`;
  const loaded = movesOf(gen).some(ex => ex.isWeighted);
  if (loaded !== /safe weight/.test(a.note || '')) return `note ${a.note}`;
  if (!['EASY', 'MEDIUM', 'HARD'].includes(a.levelLabel)) return `level ${a.levelLabel}`;
  return null;
});

// ── the cardio finisher ─────────────────────────────────────────────────────
{
  const gen = Q.generateQuickMission({ workoutType: 'Bodyweight', difficulty: 'Normal', focus: 'Full Body', duration: 20, cardioFinisher: true });
  const a = adapt(gen);
  const fin = a.exercises.filter(s => s.isFinisher);
  check('18 a cardio finisher is part of every round\'s list, last, timed, and counted in the slots as guided counts them',
    gen.finisherExercises.length === 2 && fin.length === 2 && a.exercises.slice(-2).every(s => s.isFinisher && s.mode === 'timed')
    && S.totalSlots(a) === (gen.exercises.length + 2) * gen.rounds);
}

// ── the first-page 5-minute mission (one round) ─────────────────────────────
{
  const gen = Q.generateQuickMission({ workoutType: 'Bodyweight', difficulty: 'Easy', focus: 'Core', duration: 5 });
  const a = adapt(gen);
  check('19 a one-round mission has FINISH only (no round timer, no ROUND splits kept) and says "1 ROUND"',
    gen.rounds === 1 && a.noRoundTimer === true && !S.hasRoundTimer(a) && S.soloRounds(a) === 1 && a.missionLine === '1 ROUND · THE WHOLE LIST');
  const two = adapt(Q.generateQuickMission({ workoutType: 'Bodyweight', difficulty: 'Easy', focus: 'Core', duration: 20 }));
  check('20 a several-round mission has the round timer and no noRoundTimer flag', two.rounds >= 2 && S.hasRoundTimer(two) && !('noRoundTimer' in two));
}
check('21 nothing to run: null for empty, missing and move-less missions', adapt(null) === null && adapt({}) === null && adapt({ exercises: [] }) === null && adapt({ exercises: [{ mode: 'reps' }] }) === null);

// ── which missions are generated, and which can run at your pace ────────────
{
  const gen = Q.generateQuickMission({ duration: 20 });
  const lib = L.buildLoadoutMission('iron_clock_16', {});
  const only = L.buildLoadoutMission('honor_rounds', {});
  const classic = N.buildNamedMission('murph');
  check('22 isGeneratedMission: the generator\'s mission yes; a library mission, a classic and an adapted one no',
    A.isGeneratedMission(gen) && !A.isGeneratedMission(lib) && !A.isGeneratedMission(classic) && !A.isGeneratedMission(adapt(gen)) && !A.isGeneratedMission(null) && !A.isGeneratedMission({ exercises: [] }));
  check('23 missionRunsAtYourPace: a generated mission and a guided library mission; not a your-pace-only one, a classic or one already adapted',
    A.missionRunsAtYourPace(gen) && A.missionRunsAtYourPace(lib) && lib.guided === true && !A.missionRunsAtYourPace(only) && only.guided === false && !A.missionRunsAtYourPace(classic) && !A.missionRunsAtYourPace(adapt(gen)));
}

// ── the one place a start decides its run ───────────────────────────────────
{
  const hubCfg = C.quickMissionConfig({ duration: 20, difficulty: 'Normal', focus: 'Upper', workoutType: 'Hybrid', cardioAddon: { enabled: true, minutes: 5 } });
  const plain = A.resolveQuickMissionRun(hubCfg, 'guided');
  check('24 no mode and the saved choice GUIDED: the config is returned as it was (the same object)', plain === hubCfg && !('mode' in plain));
  const junk = A.resolveQuickMissionRun(hubCfg, undefined);
  check('25 no mode and no saved choice: also as it was', junk === hubCfg);

  const run = A.resolveQuickMissionRun(hubCfg, 'solo');
  check('26 no mode and the saved choice AT YOUR PACE: today\'s mission is dealt and adapted, mode solo, the rest of the config kept (cardio add-on, focus, gear)',
    run.mode === 'solo' && run.mission?.atYourPace === true && run.mission.format === 'forTime' && run.mission.workoutType === 'Hybrid' && run.mission.focus === 'Upper'
    && run.focus === 'Upper' && run.workoutType === 'Hybrid' && show(run.cardioAddon) === show(hubCfg.cardioAddon) && run.duration === 20 && run !== hubCfg && !('mode' in hubCfg) && !('mission' in hubCfg));

  const gen = Q.generateQuickMission(hubCfg);
  const given = A.resolveQuickMissionRun({ ...hubCfg, mission: gen, mode: 'solo' }, 'guided');
  check('27 an explicit solo with the card\'s mission adapts that very mission (what the card showed is what runs), whatever the saved choice',
    given.mode === 'solo' && show(given.mission.exercises.map(s => s.name)) === show(movesOf(gen).map(m => m.name)) && given.mission.title === gen.title);

  const guided = { ...hubCfg, mission: gen, mode: 'guided' };
  check('28 an explicit guided is honoured, even when the saved choice is AT YOUR PACE', A.resolveQuickMissionRun(guided, 'solo') === guided);

  const lib = { ...hubCfg, mission: L.buildLoadoutMission('iron_clock_16', {}), v2: true, mode: 'guided' };
  const libSolo = { ...lib, mode: 'solo' };
  const libBare = { ...lib }; delete libBare.mode;
  check('29 a library mission is never touched (guided, at your pace, or no mode with the choice saved)',
    A.resolveQuickMissionRun(lib, 'solo') === lib && A.resolveQuickMissionRun(libSolo, 'guided') === libSolo && A.resolveQuickMissionRun(libBare, 'solo') === libBare);

  const classic = { ...hubCfg, mission: N.buildNamedMission('half_murph') };
  check('30 a classic is never touched, whatever is saved', A.resolveQuickMissionRun(classic, 'solo') === classic && A.resolveQuickMissionRun(classic, 'guided') === classic);

  const planMission = { ...Q.generateQuickMission({ duration: 10 }), named: 'plan:0', planId: 'plan', planDay: 0 };
  const planCfg = { ...hubCfg, mission: planMission };
  check('31 a plan day (Programs) is never touched', A.resolveQuickMissionRun(planCfg, 'solo') === planCfg);

  check('32 a replay of an adapted run is the same run (same moves, same object)', A.resolveQuickMissionRun(run, 'guided') === run && A.resolveQuickMissionRun(run, 'solo') === run);
  check('33 junk never throws: null, undefined, a string and an empty object come back as they were',
    A.resolveQuickMissionRun(null, 'solo') === null && A.resolveQuickMissionRun(undefined, 'solo') === undefined && A.resolveQuickMissionRun('x', 'solo') === 'x' && show(A.resolveQuickMissionRun({}, 'guided')) === '{}');
}

// ── a guided start is written down as guided (Continue and replay repeat it) ──
{
  const hubCfg = C.quickMissionConfig({ duration: 20, difficulty: 'Normal', focus: 'Upper' });
  const stamped = A.resolveQuickMissionRun(hubCfg, 'guided', { stamp: true });
  check('33b a guided start with no mode is stamped mode "guided" (the config otherwise kept, the original untouched)',
    stamped.mode === 'guided' && stamped !== hubCfg && !('mode' in hubCfg) && stamped.focus === 'Upper' && stamped.duration === 20 && !('mission' in stamped));
  // The replay: saved AT YOUR PACE since, the stamped guided run is still guided.
  check('33c ...and a replay of it after AT YOUR PACE is saved is still guided (the same object), where an unstamped one would flip', A.resolveQuickMissionRun(stamped, 'solo', { stamp: true }) === stamped
    && A.resolveQuickMissionRun(hubCfg, 'solo', { stamp: true }).mode === 'solo');
  const gen = Q.generateQuickMission(hubCfg);
  const cardCfg = { ...hubCfg, mission: gen };
  check('33d a stamp reaches a generated mission with no mode too; a library mission, a classic and a plan day are never stamped, and a stamp is off by default',
    A.resolveQuickMissionRun(cardCfg, 'guided', { stamp: true }).mode === 'guided' && A.resolveQuickMissionRun(cardCfg, 'guided') === cardCfg
    && A.resolveQuickMissionRun({ ...cardCfg, mission: N.buildNamedMission('half_murph') }, 'guided', { stamp: true }).mode === undefined
    && !('mode' in A.resolveQuickMissionRun({ ...hubCfg, mission: { ...gen, named: 'plan:0', planId: 'p' } }, 'guided', { stamp: true }))
    && !('mode' in A.resolveQuickMissionRun({ ...hubCfg, v2: true, mission: L.buildLoadoutMission('iron_clock_16', {}) }, 'guided', { stamp: true })));
  const solo = A.resolveQuickMissionRun(hubCfg, 'solo', { stamp: true });
  check('33e what is remembered is what ran: an AT YOUR PACE start stays mode solo (with its adapted mission) through a replay', solo.mode === 'solo' && A.resolveQuickMissionRun(solo, 'guided', { stamp: true }) === solo);

  // startsAtYourPace: what the Home cards say before START.
  const libSoloCfg = { ...hubCfg, v2: true, mode: 'solo', mission: L.buildLoadoutMission('honor_rounds', {}) };
  check('33f startsAtYourPace: a bare config follows the saved choice; an explicit mode wins; a classic, a plan day and a library mission on the coach never say it; junk is false',
    A.startsAtYourPace(hubCfg, 'solo') === true && A.startsAtYourPace(hubCfg, 'guided') === false && A.startsAtYourPace(hubCfg, undefined) === false
    && A.startsAtYourPace({ ...hubCfg, mode: 'guided' }, 'solo') === false && A.startsAtYourPace({ ...hubCfg, mode: 'solo' }, 'guided') === true
    && A.startsAtYourPace({ ...hubCfg, mission: N.buildNamedMission('half_murph') }, 'solo') === false
    && A.startsAtYourPace({ ...hubCfg, mission: { ...gen, named: 'plan:0', planId: 'p' } }, 'solo') === false
    && A.startsAtYourPace({ ...hubCfg, v2: true, mode: 'guided', mission: L.buildLoadoutMission('iron_clock_16', {}) }, 'solo') === false
    && A.startsAtYourPace(libSoloCfg, 'guided') === true && A.startsAtYourPace(null, 'solo') === false && A.startsAtYourPace('x', 'solo') === false);
}

// ── one round: no ROUND, so no split line either ────────────────────────────
{
  const a = adapt(Q.generateQuickMission({ workoutType: 'Bodyweight', difficulty: 'Easy', focus: 'Core', duration: 5 }));
  const many = adapt(Q.generateQuickMission({ workoutType: 'Bodyweight', difficulty: 'Easy', focus: 'Core', duration: 20 }));
  check('33g a one-round run closes no split on FINISH (no "R1" line repeating the TIME); a several-round run still does',
    a.noRoundTimer === true && S.closeSplits(a, [], 180).length === 0 && S.roundSplits(a, S.closeSplits(a, [], 180)).length === 0
    && S.closeSplits(many, Array.from({ length: many.rounds - 1 }, (_, i) => ({ at: (i + 1) * 1000, block: 0 })), 600).length === many.rounds);
  check('33h the line under the clock says what the taps do', a.tapHint === 'Tap FINISH when the list is done.' && many.tapHint === 'Tap ROUND when a round is done. FINISH after the last.');
}

// ── the saved choice ────────────────────────────────────────────────────────
{
  store.clear();
  check('34 the saved choice starts as GUIDED', L.loadShelfPrefs().mode === 'guided');
  L.saveShelfPrefs({ mode: 'solo' });
  check('35 AT YOUR PACE is remembered (stored as solo) and comes back', L.loadShelfPrefs().mode === 'solo' && JSON.parse(store.get(L.SHELF_PREFS_KEY)).mode === 'solo');
  L.saveShelfPrefs({ level: 'x', loadout: 'barbell' });
  check('36 another pref saved later keeps it', L.loadShelfPrefs().mode === 'solo' && L.loadShelfPrefs().loadout === 'barbell');
  store.set(L.SHELF_PREFS_KEY, '{"mode":"flying"}');
  check('37 junk falls back to GUIDED', L.loadShelfPrefs().mode === 'guided');
  store.clear();
}

// ── the hub's detail line ───────────────────────────────────────────────────
{
  const cfg = C.quickMissionConfig({ duration: 12, difficulty: 'Easy', focus: 'Full Body' });
  const plain = (s) => s.replace(/\u00A0/g, ' ');
  const held = C.quickMissionLine(cfg, { v2: true, atYourPace: true });
  check('38 the hub line ends "· At your pace" only when asked, and never changes otherwise',
    C.quickMissionLine(cfg, { v2: true }) === '12 min · Easy · Full Body · No gear'
    && plain(held) === '12 min · Easy · Full Body · No gear · At your pace'
    && C.quickMissionLine(cfg) === '12 min · Easy · Full Body · Bodyweight'
    && // (a config with no level now starts on the athlete's own level, so this one names it)
    && plain(C.quickMissionLine(C.quickMissionConfig({ duration: 15, workoutType: 'Weighted', difficulty: 'Normal' }), { atYourPace: true })) === '15 min · Medium · Full Body · Weighted · At your pace');
  // The dot is bound FORWARD: a normal space before it, no-break spaces after, so a
  // wrap leaves "· At your pace" on the next line and never a dangling "·".
  check('38b the last words are held together: a narrow card wraps before the dot, so "· At your pace" arrives whole',
    held.endsWith(' \u00B7\u00A0At\u00A0your\u00A0pace') && !/\u00A0\u00B7/.test(held) && !/ At | your | gear/.test(held.slice(held.indexOf('No') + 2).replace(/^ \u00B7/, '')));
  check('38c the level reads MEDIUM everywhere: Normal becomes Medium on the hub line, levelWord gives the capitals, anything else is as it was',
    plain(C.quickMissionLine(C.quickMissionConfig({ duration: 15, difficulty: 'NORMAL' }))).includes(' · Medium · ') && C.levelWord('Normal') === 'MEDIUM' && C.levelWord('NORMAL') === 'MEDIUM'
    && C.levelWord('Easy') === 'EASY' && C.levelWord('Hard') === 'HARD' && C.levelWord('Advanced') === 'ADVANCED' && C.levelWord(undefined) === '');
}

// ── the words: nobody reads "SOLO" on screen ────────────────────────────────
{
  const jargon = (s) => /\bsolo\b/i.test(String(s));
  check('39 the helper lines and the switch labels say AT YOUR PACE, not SOLO',
    L.RUN_MODES.map(m => m.label).join('|') === 'GUIDED|AT YOUR PACE' && [L.GUIDED_HELP, L.SOLO_HELP, L.SOLO_ONLY_HELP, L.CLASSIC_HELP].every(t => !jargon(t) && t.length > 10 && t.length < 80)
    && L.GUIDED_HELP === 'The coach calls every move and keeps time.' && L.SOLO_HELP === 'The moves and a timer. Beeps, no coach voice.'
    // One line each under the switch on a 360px phone (about 55 characters at 11px).
    && L.GUIDED_HELP.length <= 50 && L.SOLO_HELP.length <= 50);
  check('40 the stored values are unchanged: run mode ids are guided and solo', L.RUN_MODES.map(m => m.id).join('|') === 'guided|solo');
  const guideText = Object.entries(G.SCREEN_GUIDES).filter(([k]) => k.startsWith('quick_mission') || k.startsWith('qm')).flatMap(([, steps]) => steps.flatMap(s => [s.title, s.body]));
  check('41 the Quick Mission guides never say SOLO, and the v2 setup guide has the GUIDED OR AT YOUR PACE step', guideText.length > 10 && !guideText.some(jargon)
    && G.SCREEN_GUIDES.quick_mission_setup_v2.some(s => s.target === 'qm-how' && /AT YOUR PACE/.test(s.title)) && !G.SCREEN_GUIDES.quick_mission_setup.some(s => s.target === 'qm-how'));
  const tags = ['honor_rounds', 'hit_combo_21'].map(id => L.missionCardModel(L.buildLoadoutMission(id, {})).tags.join(' '));
  check('42 the library badge reads YOUR PACE ONLY', tags.every(t => /YOUR PACE ONLY/.test(t) && !jargon(t)));
  const shown = [L.shelfEntryLine(L.shelfEntries().find(e => e.id === 'honor_rounds')), L.shelfEntryLine(L.shelfEntries().find(e => e.id === 'murph'))];
  check('43 a library row line has no jargon', shown.every(t => !jargon(t)));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

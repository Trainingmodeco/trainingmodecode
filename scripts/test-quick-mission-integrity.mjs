// Quick Mission anti-cheat over whole workouts: every named classic, every
// Program day and the generated missions finish VALID at an honest pace
// (coach's pace, elite, slow), a tapped-through run still fails, and the XP
// the stats bank credits is the XP the complete screen shows.
// Run with `npm run test:qm`.
//
// The runner below drives IntegritySession in the order QuickMissionActive
// does: startUnit at the bell, recordAction + claimWork + (last slot)
// completeUnit on DONE, skipUnit on a round's last SKIP, startUnit before the
// rest that opens the next round, finalize at the end.
const store = new Map();
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
};
let now = Date.parse('2026-11-01T18:00:00Z');
Date.now = () => now;
const tick = (sec) => { now += Math.round(sec * 1000); };

const { IntegritySession, MODE_RULES, quickMissionRules } = await import('../components/training-mode/utils/missionIntegrity.js');
const { generateQuickMission, estimateQuickMissionSeconds, slotFloorSeconds } = await import('../components/training-mode/fit-mode/quickMissionGenerator.js');
const { NAMED_WORKOUTS, buildNamedMission } = await import('../components/training-mode/data/namedWorkouts.js');
const { PLAN_PROGRAMS, startPlanDay } = await import('../components/training-mode/data/workoutLibrary.js');
const { settleQuickMissionXp } = await import('../components/training-mode/data/quickMissionXp.js');
const { addQuickMissionSession, loadStats, quickMissionXp } = await import('../components/training-mode/data/userStats.js');
// The setup screen's choices (data/quickMissionConfig QM_*; that module pulls
// in a .jsx, which plain node can't load) and the config it hands the generator.
const QM_LENGTHS = [5, 10, 15, 20, 30];
const QM_FOCI = ['Full Body', 'Upper', 'Lower', 'Core', 'Combat'];
const QM_INTENSITY = ['Easy', 'Normal', 'Hard'];
const quickMissionConfig = ({ duration, focus, difficulty }) => ({ workoutType: 'Bodyweight', duration, difficulty, focus, format: 'Auto', cardioFinisher: false });

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}  ${extra}`); } };

// ── paces: what one slot costs ─────────────────────────────────────────────
// sec = time from the slot's start to DONE (or SKIP); rest = rest taken after.
const workAt = (ex, perRep, distShare) => (ex.mode === 'timed' ? ex.work : ex.estSec ? ex.estSec * distShare : (ex.reps || 1) * perRep);
const PACES = {
  // The coach's own count, every rest taken.
  coach: (ex) => ({ sec: 4 + workAt(ex, 2, 1), rest: ex.rest || 0 }),
  // A quick athlete: taps DONE the moment the reps are done, 6-minute miles,
  // skips every rest.
  elite: (ex) => ({ sec: 1 + workAt(ex, 0.8, 0.6), rest: 0 }),
  // A beginner: 4 s a rep, a breather on every move, 16-minute miles.
  slow: (ex) => ({ sec: 15 + workAt(ex, 4, 1.6), rest: ex.rest || 0 }),
  // A cheater: DONE on every counted move a second in, SKIP on every timed
  // one (the clock can't be hurried), no rest.
  tap: (ex) => (ex.mode === 'timed' ? { sec: 1, skip: true, rest: 0 } : { sec: 1, rest: 0 }),
};

function runMission(mission, pace, { endAfterSlot = null, skip = () => false, pausedBeforeStart = 0 } = {}) {
  const rounds = mission.rounds || 1;
  const all = [...mission.exercises, ...(mission.finisherExercises || [])];
  const session = new IntegritySession('quickMission', rounds, quickMissionRules(mission));
  tick(4); // intro + bell
  session.startUnit('rounds');
  if (pausedBeforeStart) { session.pauseSession(); tick(pausedBeforeStart); session.resumeSession(); }
  let exercisesCompleted = 0;
  let slots = 0;
  let completed = false;
  outer: for (let round = 1; round <= rounds; round += 1) {
    for (let idx = 0; idx < all.length; idx += 1) {
      if (endAfterSlot !== null && slots >= endAfterSlot) break outer;
      slots += 1;
      const ex = all[idx];
      const last = idx === all.length - 1;
      const step = pace(ex);
      tick(step.sec);
      if (step.skip || skip(ex)) {
        session.recordAction('skip');
        if (last) {
          session.skipUnit();
          if (round === rounds) { completed = true; break outer; }
          session.startUnit('rounds');
        }
      } else {
        exercisesCompleted += 1;
        session.recordAction('complete');
        session.claimWork(`${round}:${idx}`, slotFloorSeconds(ex));
        if (last) {
          session.completeUnit();
          if (round === rounds) { completed = true; break outer; }
          session.startUnit('rounds');
        }
      }
      tick(step.rest);
    }
  }
  const integrityResult = session.finalize();
  const totalExercises = all.length * rounds;
  const result = { completed, exercisesCompleted, totalExercises, mission, integrityResult };
  // App.jsx banks, QuickMissionComplete shows: both through settleQuickMissionXp.
  const before = loadStats().xp;
  const banked = settleQuickMissionXp({ ...result, difficulty: mission.difficulty }).xp;
  addQuickMissionSession(exercisesCompleted, totalExercises, completed, { xp: banked });
  const bankedDelta = loadStats().xp - before;
  const shown = settleQuickMissionXp({ exercisesCompleted, totalExercises, completed, difficulty: mission.difficulty, integrityResult });
  return { ...result, outcome: shown.verdict.outcome, shownXp: shown.xp, bankedDelta, activeSec: session.units.reduce((s, u) => s + u.activeElapsedSeconds, 0) };
}

const fullXp = (m) => quickMissionXp([...m.exercises, ...(m.finisherExercises || [])].length * (m.rounds || 1), true);
const valid = (r) => r.integrityResult.validityStatus === 'complete' && r.integrityResult.awardXp && r.outcome === 'pass'
  && r.shownXp === fullXp(r.mission) && r.bankedDelta === r.shownXp;
const refused = (r) => r.outcome === 'validation_failed' && r.shownXp === 0 && r.bankedDelta === 0;
const why = (r) => `${r.integrityResult.validityStatus} ${r.outcome} shown=${r.shownXp} banked=${r.bankedDelta} active=${Math.round(r.activeSec)}s units=${r.integrityResult.validCompletedUnits}/${r.integrityResult.totalRequiredUnits}`;

const murph = buildNamedMission('murph');
const halfMurph = buildNamedMission('half_murph');
const deadly7 = buildNamedMission('deadly_seven');

// ── the bug ────────────────────────────────────────────────────────────────
{
  // The issue's repro: the flat rules expire a 24-minute round. Quick Mission
  // no longer runs on the flat rules for exactly this reason.
  const s = new IntegritySession('quickMission', 1, MODE_RULES.quickMission);
  s.startUnit('rounds'); tick(24 * 60); s.completeUnit();
  check('flat 600 s rules expire a 24-min round (why missions get their own)', s.finalize().validityStatus === 'expired');
  const r = runMission(murph, PACES.coach);
  check('Murph at the coach\'s pace is VALID and pays in full', valid(r), why(r));
  check('...and it really ran long (over 40 min active)', r.activeSec > 40 * 60, `${Math.round(r.activeSec / 60)} min`);
  check('Murph cap is sized to Murph, not 600 s', quickMissionRules(murph).maxValidSeconds >= 2 * 55 * 60, String(quickMissionRules(murph).maxValidSeconds));
  check('Murph estimate counts the miles (not two 2-second reps)', estimateQuickMissionSeconds(murph) > 45 * 60, `${Math.round(estimateQuickMissionSeconds(murph) / 60)} min`);
}

// ── honest runs: every named classic and every Program day ─────────────────
const named = NAMED_WORKOUTS.map(w => ({ label: w.title, mission: buildNamedMission(w.id) }));
const planDays = PLAN_PROGRAMS.flatMap(p => p.days.map((d, idx) => {
  store.set(`tm_plan_day_${p.id}`, String(idx));
  return { label: `${p.title} · ${d.label}`, mission: startPlanDay(p) };
}));
for (const [paceName, pace] of [['coach', PACES.coach], ['elite', PACES.elite], ['slow', PACES.slow]]) {
  const bad = [...named, ...planDays].map(w => ({ w, r: runMission(w.mission, pace) })).filter(({ r }) => !valid(r));
  check(`${paceName} pace: all ${named.length} classics + ${planDays.length} Program days finish VALID, shown XP = banked XP`,
    bad.length === 0, bad.slice(0, 4).map(({ w, r }) => `${w.label}: ${why(r)}`).join(' | '));
}
{
  const longest = planDays.map(d => ({ ...d, est: estimateQuickMissionSeconds(d.mission) })).sort((a, b) => b.est - a.est)[0];
  const r = runMission(longest.mission, PACES.slow);
  check(`longest Program day (${longest.label}, ~${Math.round(longest.est / 60)} min) at a slow pace is VALID`, valid(r), why(r));
}

// ── generated missions, every length × focus × intensity, several deals ───
{
  const bad = [];
  let n = 0;
  for (const duration of QM_LENGTHS) for (const focus of QM_FOCI) for (const difficulty of QM_INTENSITY) {
    for (let deal = 0; deal < 4; deal += 1) {
      const mission = generateQuickMission(quickMissionConfig({ duration, focus, difficulty }));
      for (const pace of [PACES.coach, PACES.elite, PACES.slow]) {
        n += 1;
        const r = runMission(mission, pace);
        if (!valid(r)) bad.push(`${duration}m ${focus} ${difficulty}: ${why(r)}`);
      }
    }
  }
  check(`generated missions (${n} runs) finish VALID at every honest pace`, bad.length === 0, bad.slice(0, 3).join(' | '));
  const m = generateQuickMission(quickMissionConfig({ duration: 30, focus: 'Full Body', difficulty: 'Normal' }));
  check('a generated mission validates every round, not just one', runMission(m, PACES.coach).integrityResult.totalRequiredUnits === m.rounds && m.rounds > 1, String(m.rounds));
}

// ── honest skips never read as cheating ────────────────────────────────────
{
  const noBar = runMission(murph, PACES.coach, { skip: ex => ex.name === 'Pull-Ups' });
  // Fewer exercises done reads PARTIAL; the point is it is never flagged.
  const unflagged = (r, done) => r.integrityResult.validityStatus === 'complete' && r.outcome !== 'validation_failed'
    && r.shownXp === quickMissionXp(done, true) && r.bankedDelta === r.shownXp;
  check('Murph with no pull-up bar (every pull-up set skipped) is not flagged', unflagged(noBar, 62 - 20), why(noBar));
  const recovery = planDays.find(d => /CARDIO RECOVERY/.test(d.label));
  const r = runMission(recovery.mission, PACES.coach, { skip: ex => /Jog/.test(ex.name) });
  check('Program day with its 30-min jog skipped is not flagged', unflagged(r, 1), why(r));
  const quitter = runMission(deadly7, PACES.coach, { endAfterSlot: 20 });
  check('an honest early END keeps its completed work', quitter.outcome === 'partial' && quitter.shownXp === quickMissionXp(20, false) && quitter.bankedDelta === quitter.shownXp, why(quitter));
  const resumed = runMission(halfMurph, PACES.coach, { pausedBeforeStart: 3600 });
  check('an hour paused does not expire the round', valid(resumed), why(resumed));
}

// ── a genuinely too-fast run still fails ───────────────────────────────────
for (const m of [murph, halfMurph, deadly7]) {
  const r = runMission(m, PACES.tap);
  check(`${m.title} tapped through: VALIDATION FAILED, 0 XP shown, 0 banked`, refused(r), why(r));
}
{
  // Paced to dodge the rapid-tap detector and still two minutes for Murph.
  const r = runMission(murph, (ex) => ({ sec: 2, rest: 0 }));
  check('Murph tapped through at a steady 2 s a slot still fails', refused(r), why(r));
  const lastSkipped = runMission(murph, PACES.tap, { skip: (ex) => ex.name === 'Mile Run' });
  check('tap through, then SKIP the final mile: still fails (skip is checked too)', refused(lastSkipped), why(lastSkipped));
  const ended = runMission(murph, PACES.tap, { endAfterSlot: 50 });
  check('tap through 50 slots, then END: still fails (end is checked too)', refused(ended), why(ended));
  const repsDays = planDays.filter(d => d.mission.exercises.filter(e => e.mode === 'reps').length >= 6);
  const leaks = repsDays.map(d => ({ d, r: runMission(d.mission, PACES.tap) })).filter(({ r }) => r.bankedDelta > 0);
  check(`tapping through any of the ${repsDays.length} rep-based Program days banks nothing`, leaks.length === 0, leaks.slice(0, 3).map(({ d, r }) => `${d.label}: ${why(r)}`).join(' | '));
  const gen = generateQuickMission(quickMissionConfig({ duration: 10, focus: 'Upper', difficulty: 'Hard' }));
  const reps = { ...gen, exercises: gen.exercises.map(e => ({ name: e.name, mode: 'reps', reps: 14, rest: e.rest })) };
  check('a generated rep circuit tapped through fails', refused(runMission(reps, PACES.tap)), why(runMission(reps, PACES.tap)));
  const left = runMission(murph, (ex) => ({ sec: 4 + workAt(ex, 2, 1) + (ex.name === 'Mile Run' ? 4 * 3600 : 0), rest: ex.rest || 0 }));
  check('the cap still bites: a round left running for hours expires', left.integrityResult.validityStatus === 'expired' && left.outcome === 'validation_failed', why(left));
}

// ── other modes: no claims, same behaviour as before ───────────────────────
{
  const s = new IntegritySession('fightFocus', 3);
  s.startUnit('rounds'); tick(2); s.skipUnit();
  s.startUnit('rounds'); tick(2);
  const r = s.finalize();
  check('modes without claims: skip is SKIPPED, end is INCOMPLETE, as before', s.units[0].validityStatus === 'skipped' && s.units[1].validityStatus === 'incomplete' && r.validityStatus === 'incomplete');
  const f = new IntegritySession('fightFocus', 1);
  f.startUnit('rounds'); tick(5); f.completeUnit();
  check('modes without claims: the flat floor still applies', f.units[0].validityStatus === 'tooFast');
}
{
  const s = new IntegritySession('quickMission', 1, quickMissionRules(deadly7));
  s.startUnit('rounds');
  s.claimWork('1:0', 30); s.claimWork('1:0', 30); // rewound and redone
  tick(40); s.completeUnit();
  check('a rewound-and-redone slot is claimed once', s.units[0].claimedSeconds === 30 && s.units[0].validityStatus === 'valid');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

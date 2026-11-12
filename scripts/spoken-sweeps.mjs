// The lines the coach builds at runtime, made the way the app makes them,
// over the values the screens can really produce. Used by test:spoken (every
// line must plan from recorded clips) and by voice:coverage (what to record).
//
// Each sweep is { feature, name, lines }. Keep the value ranges in step with
// the screens they name: a range here that is narrower than the UI is a line
// nobody checked.
import fs from 'node:fs';

const TM = new URL('../components/training-mode/', import.meta.url);

const range = (lo, hi, step = 1) => { const out = []; for (let v = lo; v <= hi + 1e-9; v += step) out.push(Math.round(v * 100) / 100); return out; };

export async function spokenSweeps() {
  if (typeof globalThis.localStorage === 'undefined') {
    const store = new Map();
    globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), clear: () => store.clear(), key: () => null, length: 0 };
  }
  const rc = await import('../components/training-mode/data/runCoach.js');
  const ip = await import('../components/training-mode/data/intervalPrograms.js');
  const { CADENCE_CUES } = await import('../components/training-mode/data/cadence.js');
  const { CARDIO_EQUIPMENT } = await import('../components/training-mode/data/cardioEquipment.js');
  const { cardioMovePool } = await import('../components/training-mode/data/cardioGenerator.js');
  const { CHASE_THRESHOLD, CHASE_WINDOW_MIN_SEC, CHASE_WINDOW_MAX_SEC, chaseXp } = await import('../components/training-mode/data/chase.js');
  const { XP_STAKES_BY_TIER } = await import('../components/training-mode/data/xpStakes.js');
  const mm = await import('../components/training-mode/data/missionMoves.js');

  const out = [];
  const sweep = (feature, name, lines) => out.push({ feature, name, lines: lines.filter((l) => typeof l === 'string' && l.trim()) });
  const CARDIO = 'Cardio Mode';
  const UNITS = ['mi', 'km'];
  const TIERS = Object.keys(XP_STAKES_BY_TIER);
  // Every elapsed time a run can show, 30 s to 6 h (every second to an hour,
  // then every minute), and every pace from 3:00 to 20:00 per unit.
  const ELAPSED = [...range(1, 3600), ...range(3660, 21600, 60)];
  const PACES = range(180, 1200);

  // ── Run intro (RunPlayer brief) ────────────────────────────────────────
  // Method labels: the equipment list, JOG for a GPS jog, MACHINE and the
  // category name. GPS only where the equipment tracks by GPS.
  const methods = [
    ...CARDIO_EQUIPMENT.map((e) => ({ label: e.methodLabel, gps: e.tracking === 'gps' })),
    { label: 'Jog', gps: true }, { label: 'Machine', gps: false }, { label: 'Running', gps: false },
  ];
  // Distances: the DISTANCE popup's slider and quick picks, and typed tenths
  // (the field steps 0.1) up to a marathon.
  const dists = { mi: [...range(0.5, 15, 0.5), 13.1, ...range(0.1, 26.2, 0.1)], km: [...range(1, 24, 0.5), 21.1, ...range(0.1, 42.2, 0.1)] };
  const intro = [];
  for (const unit of UNITS) for (const m of methods) {
    for (const distance of dists[unit]) {
      const pace = 540;
      intro.push(...rc.buildRunIntro({ methodLabel: m.label, useGps: m.gps, distance, unit, targetSec: Math.round(distance * pace), eliteSec: Math.round(distance * pace * 2 / 3) }).lines);
    }
    for (const p of PACES) intro.push(...rc.buildRunIntro({ methodLabel: m.label, useGps: m.gps, freeRun: true, unit, targetPaceSec: p }).lines);
  }
  // Target and elite times: auto (any second) or typed whole minutes.
  for (const t of ELAPSED) intro.push(`Target time, ${rc.speakDuration(t)}.`, `Elite time, ${rc.speakDuration(t)}.`);
  sweep(CARDIO, 'run intro: methods, units, distances, times, free-run paces', intro);

  sweep(CARDIO, 'machine speed line (treadmill dial, both units)', [
    ...range(0.5, 16, 0.1).map((v) => rc.machineSpeedLine(v, 'mi')),
    ...range(0.8, 25, 0.1).map((v) => rc.machineSpeedLine(v, 'km')),
  ]);
  sweep(CARDIO, 'chase intro, start and result per effort tier', [
    ...TIERS.map((t) => rc.chaseIntroLine({ threshold: CHASE_THRESHOLD, ...chaseXp(t) })),
    ...range(CHASE_WINDOW_MIN_SEC, CHASE_WINDOW_MAX_SEC).map(rc.chaseStartLine),
    ...TIERS.flatMap((t) => [rc.chaseResultLine(true, chaseXp(t)), rc.chaseResultLine(false, chaseXp(t))]),
    'Sprint in five. Get ready.',
  ]);
  sweep(CARDIO, 'ghost intro (own run, every ghost time)', ELAPSED.filter((t) => t >= 60).map((t) => rc.ghostIntroLine({ ownerId: 'me', ownerName: 'MARCUS', totalSec: t })));

  // ── Splits ───────────────────────────────────────────────────────────────
  const goals = { mi: [1, 3, 5, 6.2, 10, 13.1, 26.2], km: [5, 10, 21.1, 42.2] };
  const paceSet = [180, 240, 299, 305, 342, 400, 459, 540, 600, 723, 900, 1200];
  const offsets = [-300, -61, -30, -10, 0, 9, 10, 45, 61, 300];
  const splits = [], ghostSplits = [];
  for (const unit of UNITS) for (const goal of goals[unit]) {
    for (let marker = 0.5; marker < goal - 1e-9; marker += 0.5) for (const pace of paceSet) for (const off of offsets) {
      const targetPaceSec = pace + off;
      const elapsedSec = Math.round(marker * pace);
      const targetSec = Math.round(goal * targetPaceSec);
      splits.push(rc.splitScript({ marker, unit, elapsedSec, paceSec: pace, targetPaceSec, goal, targetSec, eliteSec: Math.round(targetSec * 2 / 3) }));
      ghostSplits.push(rc.ghostSplitLine({ marker, elapsedSec, ghostTimeAtMarker: elapsedSec + off }));
    }
  }
  // The clock and the pace of a split, over their whole ranges.
  for (const unit of UNITS) for (const p of PACES) splits.push(`Pace ${rc.speakPace(p, unit)}.`);
  for (const t of ELAPSED) splits.push(`${rc.speakDuration(t)}.`, `${rc.speakDuration(t)} ahead of target.`, `${rc.speakDuration(t)} behind target. Pick it up.`);
  for (const unit of UNITS) for (const r of range(0.01, 0.5, 0.01)) splits.push(`${rc.speakDistance(r, unit)} to go. Empty the tank.`);
  sweep(CARDIO, 'split: markers to a marathon, pace 3:00-20:00, ahead and behind', splits);
  sweep(CARDIO, 'ghost split line', [...ghostSplits, ...range(-600, 600).map((d) => rc.ghostSplitLine({ marker: 1, elapsedSec: 600 + d, ghostTimeAtMarker: 600 }))]);

  const free = [];
  for (const unit of UNITS) for (let marker = 0.5; marker <= 20; marker += 0.5) for (const pace of paceSet) for (const ratio of [0.9, 1, 1.1]) {
    free.push(rc.freeRunSplitScript({ marker, unit, elapsedSec: Math.round(marker * pace), paceSec: pace, targetPaceSec: Math.round(pace / ratio) }));
  }
  sweep(CARDIO, 'free-run split', free);

  // ── Finish, end, resume ─────────────────────────────────────────────────
  const finish = [];
  for (const unit of UNITS) for (const dist of goals[unit].concat(dists[unit].filter((d) => d <= 15))) for (const pace of [240, 342, 540, 900]) {
    const targetSec = Math.round(dist * pace);
    for (const el of [targetSec - 900, targetSec - 61, targetSec - 5, targetSec, targetSec + 1, targetSec + 75, targetSec + 1800]) {
      if (el > 0) finish.push(rc.finishScript({ dist, unit, elapsedSec: el, targetSec, eliteSec: Math.round(targetSec * 2 / 3) }));
    }
  }
  for (const t of ELAPSED) finish.push(`Under target by ${rc.speakDuration(t)}. Good work.`, `${rc.speakDuration(t)} over target. Next time we take it.`);
  sweep(CARDIO, 'finish', finish);
  sweep(CARDIO, 'ghost finish (own ghost)', range(-900, 900).map((d) => rc.ghostFinishLine({ elapsedSec: 1800 + d, ghostTotalSec: 1800, ownerName: 'MARCUS', ownerId: 'me' })));

  const ends = [];
  const chases = [null];
  for (let attempts = 1; attempts <= 12; attempts++) for (let passes = 0; passes <= attempts; passes++) for (const t of TIERS) {
    const s = chaseXp(t);
    chases.push({ attempts, passes, xp: passes * s.win - (attempts - passes) * s.loss });
  }
  for (const c of chases) ends.push(rc.chaseSummaryLine(c).trim());
  const endDists = { mi: [0, 0.03, 0.3, ...range(0.5, 26.2, 0.1)], km: [0, 0.05, ...range(0.5, 42.2, 0.1)] };
  for (const unit of UNITS) for (const d of endDists[unit]) {
    const el = Math.round(Math.max(1, d) * 540);
    ends.push(rc.runEndedLine({ dist: d, unit, elapsedSec: el }), rc.freeRunEndLine({ dist: d, unit, elapsedSec: el }));
    ends.push(rc.runResumedLine(el, d, unit));
    for (const completed of [true, false]) ends.push(rc.programmeEndLine({ completed, noDistance: false, dist: d, unit, elapsedSec: el }));
  }
  for (const t of ELAPSED) {
    ends.push(rc.runResumedLine(t, 0, 'mi'), `Average pace ${rc.speakPace(t % 1021 + 180, 'mi')}.`);
    for (const completed of [true, false]) ends.push(rc.programmeEndLine({ completed, noDistance: true, dist: 0, unit: 'mi', elapsedSec: t }));
  }
  for (const unit of UNITS) for (const p of PACES) ends.push(`Average pace ${rc.speakPace(p, unit)}.`);
  sweep(CARDIO, 'run end, free-run end, programme end, resume, chase summary', ends);

  // ── Pace, form, cadence and ghost cues ───────────────────────────────────
  sweep(CARDIO, 'pace cues and form tips', [...Object.values(rc.PACE_CUES).flat(), ...rc.RUN_TIPS]);
  sweep(CARDIO, 'cadence cues (run, bike, row, stairs)', Object.values(CADENCE_CUES).flatMap((k) => Object.values(k).flat()));
  const ghostCues = [];
  for (const unit of UNITS) for (const verdict of Object.keys(rc.GHOST_CUES)) {
    const pool = rc.GHOST_CUES[verdict];
    for (let i = 0; i < pool.length; i++) {
      const pick = (dSec, dDist) => rc.ghostCue(verdict, { dSec, dDist }, unit, -1, () => (i + 0.01) / pool.length).text;
      for (const s of range(5, 900)) ghostCues.push(pick(s, 1), pick(-s, -1));
      for (const m of range(10, 100, 10)) ghostCues.push(pick(null, m / (unit === 'km' ? 1000 : 1609.344)));
    }
  }
  sweep(CARDIO, 'ghost cues with every gap', ghostCues);

  // ── Guided machine programmes ─────────────────────────────────────────
  const prog = [];
  for (const p of ip.PROGRAMS) for (const machine of ['treadmill', 'bike', 'row']) for (const tier of ['easy', 'normal', 'hard']) for (const unit of UNITS) {
    const x = ip.expandProgram(p, { machine, tier, unit });
    prog.push(...ip.programIntro(x).lines);
    for (const s of x.segments) prog.push(s.pre, s.start);
  }
  sweep(CARDIO, 'guided programmes: intro, every pre-call and start, every machine and tier', prog);

  sweep(CARDIO, 'run player fixed lines', [
    'Ready.', 'Go!', 'Paused.', 'Resume. Go!', 'Locking GPS. You start the moment it is ready.', 'Warm up first.',
    'Surge! Push the pace. Hold it until I call it off.', 'Surge over. Settle back into your pace.',
  ]);

  // ── Interval / steady protocol player ─────────────────────────────────
  // Style labels as CardioMode passes them, and the bare format a finisher
  // passes. Formats: CardioMode ROUND_FORMATS and CFG_DEFAULTS, then the
  // ConfigModal ranges (warm-up 0-15 min, work 5-300 s, rest 0-180 s, rounds 1-30).
  const styles = ['Steady Pace', 'Free Run', 'Random Intervals', 'Target Intervals', 'Tabata', 'Intervals', 'interval', 'tabata'];
  const intervals = [];
  const library = [
    { warmupMin: 3, workSec: 180, restSec: 60, rounds: 12 }, { warmupMin: 0, workSec: 20, restSec: 10, rounds: 8 },
    { warmupMin: 3, workSec: 60, restSec: 60, rounds: 8 },
  ];
  for (const st of styles) for (const c of library) intervals.push(...rc.buildIntervalIntro({ styleLabel: st, rounds: c.rounds, workSec: c.workSec, restSec: c.restSec, warmupSec: c.warmupMin * 60 }).lines);
  for (const w of range(5, 300, 5)) for (const r of range(0, 180, 5)) intervals.push(...rc.buildIntervalIntro({ styleLabel: 'intervals', rounds: 8, workSec: w, restSec: r }).lines);
  for (const n of range(1, 100)) intervals.push(...rc.buildIntervalIntro({ styleLabel: 'intervals', rounds: n, workSec: 30, restSec: 15 }).lines);
  for (const wm of range(0, 15)) intervals.push(...rc.buildIntervalIntro({ styleLabel: 'intervals', rounds: 8, workSec: 30, restSec: 15, warmupSec: wm * 60 }).lines);
  sweep(CARDIO, 'interval intro over the format library and the config ranges', intervals);

  const steadyLabels = [...new Set([...CARDIO_EQUIPMENT.map((e) => e.methodLabel), 'Jog', 'Machine', 'Rounds', null])];
  const steady = [];
  for (const m of steadyLabels) for (const sec of [...range(60, 7200, 60), 90, 150, 600, 1234]) {
    steady.push(...rc.buildSteadyIntro({ methodLabel: m, durationSeconds: sec }).lines, rc.steadyBrief({ methodLabel: m, durationSeconds: sec }));
  }
  sweep(CARDIO, 'steady intro and brief per method and duration', steady);

  const segs = [];
  const moves = cardioMovePool().map((m) => m.name);
  for (let r = 1; r <= 100; r++) {
    segs.push(rc.protocolSegmentLine({ kind: 'work', round: r, label: 'HARD' }), rc.protocolSegmentLine({ kind: 'work', round: r, label: 'WORK' }));
    segs.push(rc.protocolSegmentLine({ kind: 'work', round: r, label: 'WORK' }, [moves[r % moves.length]]));
  }
  for (const n of moves) segs.push(rc.protocolSegmentLine({ kind: 'work', round: 1, label: 'WORK' }, [n]));
  for (const label of ['REST', 'RECOVER']) segs.push(rc.protocolSegmentLine({ kind: 'rest', label }));
  for (const wm of range(1, 15)) segs.push(rc.protocolSegmentLine({ kind: 'warmup', seconds: wm * 60 }));
  segs.push(rc.protocolSegmentLine({ kind: 'cooldown' }), 'Complete. Great work.');
  sweep(CARDIO, 'interval player segment calls (rounds 1-100, every cardio move)', segs);

  // ── Outside Cardio: cheap and real ──────────────────────────────────────
  // Fight Mode encouragement: every line of the pool.
  const enc = fs.readFileSync(new URL('data/coachEncouragement.js', TM), 'utf8');
  sweep('Fight Mode', 'Fight Mode encouragement pool', [...enc.matchAll(/\btext:\s*(['"])((?:(?!\1).)+)\1/g)].map((m) => m[2]));
  sweep('Fight Mode', 'Rush XP for the stakes the game pays', TIERS.map((t) => `Rush held. Plus ${XP_STAKES_BY_TIER[t].win} X P.`));

  // Quick Mission rest calls (QuickMissionActive): rest 1-300 s, every catalog
  // move as the next one, the three prep lines.
  const preps = ['Grab your weight and prepare.', 'Prepare your setup.', 'Get in position.'];
  const names = [...new Set(mm.MOVES.map((m) => m.name).filter(Boolean))];
  const qm = [];
  for (const s of range(1, 300)) for (const prep of preps) qm.push(`Rest. ${mm.secondsPhrase(s)}. Up next: ${names[s % names.length]}. ${prep}`);
  for (const n of names) qm.push(`Rest. ${mm.secondsPhrase(30)}. Up next: ${n}. Get in position.`);
  for (let r = 1; r <= 20; r++) qm.push(`Round ${r} complete. Rest. ${mm.secondsPhrase(60)}. Up next: Round ${r + 1}. ${names[r]}. Get in position.`, `Round ${r} complete. Rest.`);
  sweep('Quick Mission', 'Quick Mission rest and round calls', qm);

  return out;
}

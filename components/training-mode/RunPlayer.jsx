import { useState, useEffect, useRef, useCallback } from 'react';
import { Flag } from 'lucide-react';
import { C } from './Styles';
import { ARCADE } from './ArcadeUI';
import TrainingCTA from './shared/TrainingCTA';
import useWakeLock from './hooks/useWakeLock';
import { waitForGpsLock } from './data/gpsLock';
import PocketMode, { PocketModeChip } from './shared/PocketMode';
import useMiniPlayer from './hooks/useMiniPlayer';
import FloatOnLeave from './shared/FloatOnLeave';
import { speakAsync, primeSpeech, stopVoiceSession, delay } from './voiceCoach';
import { playBell, playBeep, playRiser, playPowerDown, playRingChime, unlockAudio } from './data/audioEngine';
import {
  newChaseState, firstChaseAt, nextChaseAt, chaseWindow, canStartChase,
  chasePaceFromWindow, evaluateChase, chaseBeepAt, chaseSummary,
  CHASE_LEAD_IN_SEC, CHASE_BASELINE_WINDOW_SEC, CHASE_THRESHOLD, CHASE_XP,
} from './data/chase';
import { segmentAt } from './data/intervalPrograms';
import { saveLiveRun, clearLiveRun, liveRunElapsedSec } from './data/liveRun';
import { recordRunGhost, ghostDistanceAt, ghostTimeAt, ghostArt } from './data/runGhosts';
import { thinRoute } from './data/geoRoute';
import { estimateCalories } from './data/runLog';
import RouteMap from './shared/RouteMap';
import SpeedDial from './shared/SpeedDial';
import SafeImage from './SafeImage';
import useCadence from './hooks/useCadence';
import { cadenceCue, strideFromSpeedAndCadence } from './data/cadence';
import {
  newSpeedTrack, setSpeedAt, distanceFromSpeed, speedAt, paceFromSpeed,
  defaultSpeed, fmtSpeed, speedUnitLabel, applyMachineCorrection,
} from './data/machineSpeed';
import {
  metersPerUnit, fmtClock, fmtPace, fmtSignedDelta, speakDuration, speakDistance, speakPace,
  buildRunIntro, crossedMarkers, crossedTenths, splitScript, freeRunSplitScript, finishScript,
  paceVerdict, PACE_CUES, RUN_TIPS, pickCue, shouldCue, nextCueGap,
  evaluateFix, GPS_MAX_ACCURACY_M, GPS_WEAK_SIGNAL_MS, rollingPaceSec, projectedFinish,
  ghostGap, ghostVerdict, ghostCue, ghostSplitLine, ghostFinishLine,
} from './data/runCoach';

// The GPS / distance run player — the "run app" half of Cardio Mode.
//
// What it is built around, in order of importance:
//  1. DISTANCE is the hero number and the clock counts UP from zero. A run has
//     no countdown; it has how far you have gone and how long it took.
//  2. The clock is wall time (see data/liveRun.js). Leave the player, leave the
//     app, take a call — the run is still running when you come back.
//  3. The coach TALKS: an intro with the target and the elite time, then a
//     split call at every half and whole unit, pace verdicts between them, and
//     form tips. The pure scripts live in data/runCoach.js.
//  4. Every change is persisted, so the OS killing the PWA loses nothing but
//     the GPS meters covered while it was away.
//
// WHERE DISTANCE COMES FROM, in order of preference:
//
//  1. GPS, outdoors, when there is a fix.
//  2. The MACHINE'S OWN SPEED indoors — the athlete matches the dial to the
//     console and distance is that speed integrated over elapsed time. As
//     accurate as the belt's calibration, which is the number they would check
//     us against anyway, and it makes everything downstream real: exact pace,
//     honest splits, and a pace coach that can finally disagree with them.
//  3. Only if neither exists, an ESTIMATE at the target pace, labelled EST.
//     This is the one that cannot teach you anything — it is the goal played
//     back, so it always finishes exactly on target — so it never becomes a
//     ghost and the pace coach stays quiet under it.
//
// Cadence rides alongside all three, from the accelerometer (data/cadence.js).
// It is a FORM metric, never a distance source; see that file for why.

const GOLD = C.yellow;
const GREEN = '#22c55e';

const STYLES = `
@keyframes run-tick { 0% { color: ${GOLD}; text-shadow: 0 0 22px rgba(253,224,71,0.9); } 100% { color: #fff; text-shadow: 0 0 16px rgba(168,85,247,0.4); } }
@keyframes run-pulse { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }
`;

const TICK_MS = 250;
const PERSIST_EVERY_MS = 4000;
// The route is SIMPLIFIED, never truncated. The old cap shifted the OLDEST fix
// off the front, so by mile two the first streets of the run had silently
// vanished from the map. Now, when the raw track passes ROUTE_SOFT_MAX, RDP
// thins it back to ROUTE_KEEP points that draw the same shape — corners kept,
// straights dropped, start and finish always there.
const ROUTE_SOFT_MAX = 600;
const ROUTE_KEEP = 300;
const SAMPLES_MAX = 90;

function newRun(cfg) {
  return {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    kind: 'distance',
    cfg,
    startedAt: null,
    pauseAccumMs: 0,
    pausedAt: null,
    offsetMs: 0,
    meters: 0,
    // Indoor only: the machine's speed over time, keyed on ELAPSED seconds so
    // pauses need no special handling.
    speedSegs: cfg?.speedSource === 'machine'
      ? newSpeedTrack(cfg.startSpeed || defaultSpeed(cfg.targetPaceSec, cfg.unit || 'mi'))
      : null,
    route: [],
    samples: [],
    trace: [],          // (t, d) every few seconds — becomes this run's ghost
    lastFix: null,
    markersDone: [],
    splits: [],
    tenth: 0,
    lastCueSec: 0,
    lastSplitSec: -999,
    cueGap: 50,
    cueIdx: {},
    tipCounter: 0,
    nextSurgeSec: null,
    surgeEndSec: null,
    hiddenGapNoted: false,
    // Data only. Every time the tab goes hidden mid-run for more than the
    // gap threshold, one entry lands here on visibility return. The summary
    // reads totalGapMs to print a whispered footnote; no live UI shows.
    gaps: [],
    totalGapMs: 0,
    // INTERVALS on an outdoor run: the chase engine's state (data/chase.js).
    chase: newChaseState(),
    // A guided machine programme: which segment the announcer is on, and the
    // last segment it pre-called five seconds early.
    programIdx: -1,
    programPreSaid: -1,
  };
}

export default function RunPlayer({ cfg, restore = null, autoStart = true, onState, onGpsDenied, onComplete, onCaption }) {
  const runRef = useRef(null);
  if (!runRef.current) runRef.current = restore ? { ...newRun(cfg), ...restore, cfg: restore.cfg || cfg } : newRun(cfg);
  const run = runRef.current;
  const unit = run.cfg.unit || 'mi';
  // A null goal is a FREE RUN: no finish line, the athlete ends it when they
  // are done. `goal` is only ever a number where a finish exists.
  const goal = run.cfg.goal > 0 ? run.cfg.goal : null;
  const freeRun = !goal;
  // A guided machine programme (data/intervalPrograms.js, already expanded
  // for this machine and effort tier). The announcer is the coach for it.
  const program = run.cfg.program || null;
  // INTERVALS on an outdoor run — the chase. Never on top of a programme.
  const chaseMode = !!run.cfg.chaseMode && !program;
  // The rower: a guided programme with no distance we can stand behind. Time
  // is the hero; the console's metres are typed in at the end.
  const noDistance = !!run.cfg.noDistance;
  const useGps = !!run.cfg.useGps;
  const ghost = run.cfg.ghost || null;

  const [phase, setPhase] = useState(restore ? 'run' : (autoStart ? 'intro' : 'ready'));
  const [running, setRunning] = useState(restore ? !restore.pausedAt : false);
  const [now, setNow] = useState(Date.now());
  const [meters, setMeters] = useState(run.meters || 0);
  const [route, setRoute] = useState(run.route || []);
  const [gpsStatus, setGpsStatus] = useState(useGps ? 'acquiring' : 'off');
  // START waits for GPS (up to GPS_LOCK_MAX_MS) so the first stretch isn't
  // lost to a cold chip; true while that wait is on screen.
  const [lockingGps, setLockingGps] = useState(false);
  const [pocket, setPocket] = useState(false);
  const [caption, setCaption] = useState(restore ? 'Welcome back. The clock kept running.' : 'Get set.');
  const [surge, setSurge] = useState(false);
  const [tickKey, setTickKey] = useState(0);
  const [result, setResult] = useState(null);
  const [consoleDist, setConsoleDist] = useState('');
  // The live chase: { until, windowSec, requiredPaceSec, baselinePaceSec } while
  // a sprint window is open; a 4-second pass/fail flash after it closes.
  const [chaseUi, setChaseUi] = useState(null);
  const [chaseFlash, setChaseFlash] = useState(null);
  const [progIdx, setProgIdx] = useState(restore?.programIdx ?? -1);
  const aliveRef = useRef(true);
  const runningRef = useRef(running);
  const phaseRef = useRef(phase);
  const lastPersistRef = useRef(0);
  useEffect(() => { runningRef.current = running; }, [running]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => () => { aliveRef.current = false; }, []);

  // Keep the screen on while the run is live — a sleeping screen is a frozen
  // page, and a frozen page cannot read GPS.
  useWakeLock(running && phase === 'run');

  const say = useCallback((text, opts) => {
    if (!text) return Promise.resolve();
    setCaption(text);
    onCaption?.(text);
    return speakAsync(text, opts).catch(() => {});
  }, [onCaption]);

  const persist = useCallback((force = false) => {
    const t = Date.now();
    if (!force && t - lastPersistRef.current < PERSIST_EVERY_MS) return;
    lastPersistRef.current = t;
    const r = runRef.current;
    saveLiveRun({
      ...r,
      route: thinRoute(r.route, ROUTE_KEEP),
      samples: r.samples.slice(-SAMPLES_MAX),
      trace: r.trace.slice(-2400),
    });
  }, []);

  const report = useCallback((extra = {}) => {
    const r = runRef.current;
    onState?.({ live: phaseRef.current === 'run', running: runningRef.current, elapsedSec: liveRunElapsedSec(r), meters: r.meters, ...extra });
  }, [onState]);

  const elapsedSec = liveRunElapsedSec(run, now);
  const gpsDist = meters / metersPerUnit(unit);
  const usingGps = useGps && gpsStatus === 'live';
  const machine = run.cfg.speedSource === 'machine';
  const speedNow = machine ? speedAt(run.speedSegs, elapsedSec) : 0;
  const machineDist = machine ? distanceFromSpeed(run.speedSegs, elapsedSec) : 0;
  // Estimating is now the LAST resort, not the indoor default.
  const estimating = !noDistance && !machine && (!useGps || (gpsStatus !== 'live' && meters === 0));
  // Distance is MEASURED when it came from satellites or from the machine —
  // the distinction everything downstream keys off: whether the pace coach may
  // speak, whether splits mean anything, whether this becomes a ghost.
  const measuring = !noDistance && (machine || usingGps);
  const estDist = elapsedSec / (run.cfg.targetPaceSec || 600);
  const dist = noDistance ? 0
    : machine ? machineDist
      : (estimating ? (freeRun ? estDist : Math.min(goal, estDist)) : gpsDist);

  // Cadence, from the accelerometer. The speed is handed over for the stride
  // cross-check — a rate that implies an impossible stride is not shown.
  const cadence = useCadence({
    active: phase === 'run' && running,
    kind: run.cfg.cadenceKind || 'run',
    speed: machine ? speedNow : 0,
    unit,
  });

  // Changing the belt speed starts a new segment from this instant. Everything
  // already covered stays covered — the integral is over segments, so the past
  // is never recomputed at the new rate.
  const changeSpeed = useCallback((next) => {
    const r = runRef.current;
    r.speedSegs = setSpeedAt(r.speedSegs, liveRunElapsedSec(r), next);
    setNow(Date.now());
    persist(true);
  }, [persist]);

  // ── Start / pause / resume / end ──────────────────────────────────────────
  const startRun = useCallback(() => {
    const r = runRef.current;
    r.startedAt = Date.now();
    r.pausedAt = null;
    r.nextSurgeSec = r.cfg.randomSurges ? 45 + Math.round(Math.random() * 45) : null;
    if (chaseMode) {
      if (!r.chase || !Array.isArray(r.chase.results)) r.chase = newChaseState();
      r.chase.nextAtSec = firstChaseAt();
    }
    if (program) {
      // The intro already spoke segment 0's line, so the tick must not repeat it.
      r.programIdx = 0;
      r.programPreSaid = -1;
      setProgIdx(0);
    }
    setPhase('run');
    setRunning(true);
    setNow(Date.now());
    persist(true);
    report({ live: true, running: true });
  }, [persist, report, chaseMode, program]);

  const pauseRun = useCallback(() => {
    const r = runRef.current;
    if (r.pausedAt) return;
    r.pausedAt = Date.now();
    setRunning(false);
    persist(true);
    report({ running: false });
    say('Paused.');
  }, [persist, report, say]);

  const resumeRun = useCallback(() => {
    const r = runRef.current;
    if (!r.pausedAt) return;
    r.pauseAccumMs += Date.now() - r.pausedAt;
    r.pausedAt = null;
    // Distance resumes from wherever the athlete is now, no phantom jump.
    r.lastFix = null;
    setRunning(true);
    persist(true);
    report({ running: true });
    say('Resume. Go!');
  }, [persist, report, say]);

  const finishRun = useCallback((completed) => {
    const r = runRef.current;
    if (phaseRef.current === 'done') return;
    const el = liveRunElapsedSec(r);
    const rawEst = el / (r.cfg.targetPaceSec || 600);
    const finalDist = noDistance ? 0
      : machine ? distanceFromSpeed(r.speedSegs, el)
        : (estimating ? (freeRun ? rawEst : Math.min(goal, rawEst)) : r.meters / metersPerUnit(unit));
    // A targeted run that finished is credited its goal; a free run has no
    // goal to credit, and the athlete ending it IS completing it.
    const d = (completed && !freeRun) ? Math.max(finalDist, goal) : finalDist;
    const isComplete = completed || freeRun;
    const chase = chaseMode ? { ...chaseSummary(r.chase), results: (r.chase?.results || []).slice() } : null;
    const res = {
      completed: isComplete,
      freeRun,
      effortMode: r.cfg.effortMode || null,
      effortTier: r.cfg.effortTier || null,
      completedTimeSeconds: Math.round(el),
      completedDistance: +d.toFixed(2),
      distanceUnit: unit,
      gps: !noDistance && !machine && !estimating,
      measured: measuring,
      surface: machine ? 'machine' : 'gps',
      machineSpeed: machine ? speedAt(r.speedSegs, el) : null,
      avgPaceSec: d > 0.05 ? el / d : null,
      targetPaceSec: r.cfg.targetPaceSec || null,
      targetSec: r.cfg.targetSec ?? null,
      eliteSec: r.cfg.eliteSec ?? null,
      beatTarget: isComplete && r.cfg.targetSec != null && el <= r.cfg.targetSec,
      beatElite: isComplete && !!r.cfg.eliteSec && el <= r.cfg.eliteSec,
      splits: r.splits.slice(),
      goal,
      trace: r.trace.slice(),
      // The ground covered, thinned once for storage. This is the track the
      // finish card, the manual log and the run history all draw.
      id: r.id,
      route: thinRoute(r.route, 200),
      calories: estimateCalories({ meters: d * metersPerUnit(unit), seconds: el }),
      // Data-only bookkeeping for the summary's whispered footnote.
      gaps: r.gaps.slice(),
      totalGapMs: r.totalGapMs,
      chase,
      program: program ? {
        id: program.id, label: program.label, machine: program.machine, tier: program.tier,
        totalSec: program.totalSec, completedSec: Math.min(Math.round(el), program.totalSec), completed,
      } : null,
    };
    if (ghost && completed && !freeRun) {
      const delta = Math.round(el - ghost.totalSec);
      res.ghost = { ownerName: ghost.ownerName, ghostTotalSec: ghost.totalSec, delta, outcome: Math.abs(delta) < 2 ? 'draw' : delta < 0 ? 'victory' : 'defeat' };
    }
    // Every MEASURED finish at a set distance becomes a ghost for next time
    // (MY LAST, and MY BEST when it is the fastest at this distance) —
    // bucketed by surface, so an indoor run never overwrites an outdoor best.
    // A free run has no distance bucket, so it is logged but never a ghost.
    if (completed && measuring && !freeRun) {
      const rec = recordRunGhost(res);
      res.ghostRecorded = !!rec.ghost;
      res.newBest = rec.newBest;
    }
    setPhase('done');
    setRunning(false);
    setResult(res);
    setChaseUi(null);
    clearLiveRun();
    report({ live: false, running: false });
    const chaseLine = chase && chase.attempts > 0
      ? ` ${chase.passes} of ${chase.attempts} chases escaped${chase.xp > 0 ? `, ${chase.xp} bonus X P` : ''}.`
      : '';
    if (program) {
      playBell(3);
      say(completed
        ? `Programme complete. ${noDistance ? speakDuration(el) : `${speakDistance(d, unit)} in ${speakDuration(el)}`}. Good work.`
        : `Programme ended at ${speakDuration(el)}.${noDistance ? '' : ` ${speakDistance(d, unit)}.`}`);
    } else if (freeRun) {
      playBell(3);
      const avg = d > 0.05 ? ` Average pace ${speakPace(el / d, unit)}.` : '';
      say(`Run complete. ${speakDistance(d, unit)} in ${speakDuration(el)}.${avg}${chaseLine}`);
    } else if (completed) {
      playBell(3);
      const lines = [finishScript({ dist: d, unit, elapsedSec: el, targetSec: r.cfg.targetSec, eliteSec: r.cfg.eliteSec })];
      if (res.ghost) lines.push(ghostFinishLine({ elapsedSec: el, ghostTotalSec: ghost.totalSec, ownerName: ghost.ownerName }));
      if (chaseLine) lines.push(chaseLine.trim());
      say(lines.join(' '));
    } else {
      say(`Run ended. ${speakDistance(d, unit)} in ${speakDuration(el)}.${chaseLine}`);
    }
  }, [estimating, machine, measuring, goal, unit, report, say, ghost, freeRun, chaseMode, program, noDistance]);

  // ── Intro: speak the brief, then GO ───────────────────────────────────────
  useEffect(() => {
    if (phase !== 'intro') return undefined;
    let cancelled = false;
    // Whatever the speech engine does — no voices, a throw, a permission
    // refusal — the run STARTS. The brief is a courtesy, not a gate.
    (async () => {
      try {
        unlockAudio();
        await primeSpeech();
        let intro;
        if (program) {
          // A guided programme briefs itself: what it is, how long, and the
          // first segment's own instruction (the belt speed on a treadmill).
          const where = program.machine === 'row' ? 'Rower' : program.machine === 'bike' ? 'Bike' : 'Treadmill';
          intro = {
            lines: [
              'Cardio mode.',
              `${where} intervals. ${String(program.label).toLowerCase()}, ${speakDuration(program.totalSec)}.`,
              program.segments[0]?.start || 'Warm up first.',
            ],
            ready: 'Ready.', go: 'Go!',
          };
        } else {
          intro = buildRunIntro({
            methodLabel: run.cfg.methodLabel, useGps, distance: goal, unit,
            targetSec: run.cfg.targetSec, eliteSec: run.cfg.eliteSec,
            freeRun, targetPaceSec: run.cfg.targetPaceSec,
          });
          if (machine) intro.lines.push(`Set the machine to ${fmtSpeed(speedAt(run.speedSegs, 0))} ${speedUnitLabel(unit).toLowerCase()} and match the dial if you change it.`);
          if (chaseMode) intro.lines.push(`Intervals are on. When I call a sprint, beat your own pace by ${Math.round(CHASE_THRESHOLD * 100)} percent to escape and bank ${CHASE_XP} X P.`);
        }
        if (ghost) intro.lines.push(`Ghost mode. You are racing ${ghost.ownerId === 'me' ? 'your' : ghost.ownerName + "'s"} ${ghost.ownerId === 'me' ? 'own run' : 'run'}, ${speakDuration(ghost.totalSec)}. Beat it.`);
        for (const line of intro.lines) {
          if (cancelled) return;
          await say(line, { rate: 1.0 });
        }
        if (cancelled) return;
        await say(intro.ready);
        await delay(700);
      } catch { /* start anyway */ }
      if (cancelled) return;
      // Automatic GPS gate (owner call: no second tap): the run starts the
      // moment GPS locks, or after GPS_LOCK_MAX_MS at most. A quick lock is
      // invisible; a slow one says so.
      if (useGps) {
        const lock = waitForGpsLock({ isCancelled: () => cancelled });
        const quick = await Promise.race([lock, delay(1500).then(() => 'slow')]);
        if (quick === 'slow') {
          setLockingGps(true);
          try { say('Locking GPS. You start the moment it is ready.')?.catch?.(() => {}); } catch { /* ignore */ }
          await lock;
          setLockingGps(false);
        }
        if (cancelled) return;
      }
      try { playBell(1); say('Go!', { rate: 1.1 }); } catch { /* ignore */ }
      startRun();
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Restored run: say where we are.
  useEffect(() => {
    if (!restore) return;
    const r = runRef.current;
    const el = liveRunElapsedSec(r);
    const d = r.meters / metersPerUnit(unit);
    // Only worth saying if the run was actually away (a call, a reload) —
    // tapping back and straight in again does not need a re-brief.
    const awayMs = Date.now() - (restore.updatedAt || 0);
    const t = setTimeout(() => {
      if (awayMs > 15000) say(`Run resumed. ${speakDuration(el)} on the clock. ${d > 0.05 ? `${speakDistance(+d.toFixed(2), unit)} so far.` : ''}`);
      else setCaption(`Back in. ${fmtClock(el)} on the clock.`);
    }, 400);
    report({ live: true, running: !r.pausedAt });
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Clock: wall time, sampled 4x a second ─────────────────────────────────
  useEffect(() => {
    if (phase !== 'run') return undefined;
    const t = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(t);
  }, [phase]);

  // ── GPS: watch for the life of the player, accrue only while running ──────
  //
  // A phone that locks or backgrounds mid-run stops delivering fixes — the
  // PWA is at the mercy of the browser's page-visibility rules. Two
  // defences layered here:
  //  (1) Screen wake-lock: request one for the life of the player. If the
  //      screen stays on, GPS keeps firing. This is the single biggest fix
  //      for "I ran a mile and it registered a quarter."
  //  (2) On the tab becoming visible again, re-acquire the wake-lock the
  //      OS revoked on hide, and re-arm watchPosition. Some browsers keep
  //      the watch registered but stop firing while hidden.
  useEffect(() => {
    if (!useGps || phase === 'done') return undefined;
    if (typeof navigator === 'undefined' || !navigator.geolocation) { setGpsStatus('denied'); onGpsDenied?.(); return undefined; }

    let wakeLock = null;
    const acquireWakeLock = async () => {
      try {
        if ('wakeLock' in navigator && !wakeLock) {
          wakeLock = await navigator.wakeLock.request('screen');
        }
      } catch { /* best effort */ }
    };
    const releaseWakeLock = () => {
      if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
    };

    // Weak-signal fallback: after GPS_WEAK_SIGNAL_MS without a fix inside
    // the normal accuracy cap, accept looser fixes so the run keeps counting.
    let lastGoodAt = Date.now();
    let staleTimer = null;
    const armStale = () => {
      clearTimeout(staleTimer);
      staleTimer = setTimeout(() => { if (aliveRef.current) setGpsStatus(s => (s === 'live' ? 'acquiring' : s)); }, 20000);
    };
    const onFix = (pos) => {
      if (!aliveRef.current) return;
      const r = runRef.current;
      const fix = { lat: pos.coords.latitude, lng: pos.coords.longitude, t: pos.timestamp || Date.now(), accuracy: pos.coords.accuracy };
      const relaxed = Date.now() - lastGoodAt > GPS_WEAK_SIGNAL_MS;
      if (!Number.isFinite(fix.accuracy) || fix.accuracy <= GPS_MAX_ACCURACY_M) lastGoodAt = Date.now();
      const verdict = evaluateFix(r.lastFix, fix, { relaxed });
      if (verdict.reason === 'accuracy') { armStale(); return; }
      setGpsStatus('live');
      armStale();
      if (!verdict.accept) return;
      const accrue = runningRef.current && phaseRef.current === 'run';
      if (accrue && verdict.meters > 0) {
        r.meters += verdict.meters;
        const el = liveRunElapsedSec(r);
        r.samples.push({ t: el, m: r.meters });
        if (r.samples.length > SAMPLES_MAX) r.samples.shift();
        const last = r.trace[r.trace.length - 1];
        if (!last || el - last.t >= 3) r.trace.push({ t: Math.round(el * 10) / 10, d: +(r.meters / metersPerUnit(unit)).toFixed(4) });
        r.route.push({ lat: fix.lat, lng: fix.lng, t: Math.round(el), m: Math.round(r.meters) });
        if (r.route.length > ROUTE_SOFT_MAX) r.route = thinRoute(r.route, ROUTE_KEEP);
        setMeters(r.meters);
        setRoute(r.route.slice());
        persist();
      } else if (r.route.length === 0) {
        r.route.push({ lat: fix.lat, lng: fix.lng, t: 0, m: 0 });
      }
      r.lastFix = fix;
    };
    const onErr = (err) => {
      if (!aliveRef.current) return;
      if (err && err.code === 1) { setGpsStatus('denied'); onGpsDenied?.(); }
      else setGpsStatus('acquiring');
    };
    const watchOpts = { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 };

    let id = null;
    const startWatch = () => {
      if (id != null) return;
      id = navigator.geolocation.watchPosition(onFix, onErr, watchOpts);
    };
    const stopWatch = () => {
      if (id != null && navigator.geolocation) navigator.geolocation.clearWatch(id);
      id = null;
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        acquireWakeLock();
        stopWatch();
        startWatch();
      }
    };

    acquireWakeLock();
    startWatch();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      clearTimeout(staleTimer);
      stopWatch();
      releaseWakeLock();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useGps, phase === 'done']);

  const cadenceRef = useRef(cadence);
  useEffect(() => { cadenceRef.current = cadence; }, [cadence]);

  // ── The coach: splits, tenths, pace cues, tips, surges, finish ────────────
  const prevDistRef = useRef(restore ? (restore.meters || 0) / metersPerUnit(unit) : 0);
  useEffect(() => {
    if (phase !== 'run' || !running) return;
    const r = runRef.current;
    const prev = prevDistRef.current;
    if (dist <= prev) return;
    prevDistRef.current = dist;

    // Tenths: a visual tick + a short buzz. No voice — thirty calls in a 5K
    // would be noise.
    const tenths = crossedTenths(prev, dist);
    if (tenths.length) {
      r.tenth = tenths[tenths.length - 1];
      setTickKey(k => k + 1);
      try { navigator.vibrate?.(30); } catch { /* ignore */ }
    }

    // Goal first — the finish call outranks a split on the same tick. A free
    // run has no goal; it ends when the athlete says so.
    if (!freeRun && dist >= goal - 1e-9) { finishRun(true); return; }

    const markers = crossedMarkers(prev, dist, 0.5).filter(m => (freeRun || m < goal - 1e-9) && !r.markersDone.includes(m));
    if (markers.length) {
      const marker = markers[markers.length - 1];
      const pace = machine
        ? (paceFromSpeed(speedNow) || r.cfg.targetPaceSec)
        : usingGps ? (rollingPaceSec(r.samples, elapsedSec, unit, 60) || (dist > 0.05 ? elapsedSec / dist : 0))
          : r.cfg.targetPaceSec;
      markers.forEach(m => { r.markersDone.push(m); r.splits.push({ marker: m, elapsedSec: Math.round(elapsedSec) }); });
      r.lastSplitSec = elapsedSec;
      playBell(1);
      persist(true);
      // Mid-chase the countdown owns the voice; the split is banked, not spoken.
      if (r.chase?.activeUntilSec != null) return;
      const split = freeRun
        ? freeRunSplitScript({ marker, unit, elapsedSec, paceSec: pace, targetPaceSec: r.cfg.targetPaceSec })
        : splitScript({ marker, unit, elapsedSec, paceSec: pace, targetPaceSec: r.cfg.targetPaceSec, goal, targetSec: r.cfg.targetSec, eliteSec: r.cfg.eliteSec });
      const gl = ghost && measuring && !freeRun ? ghostSplitLine({ marker, elapsedSec, ghostTimeAtMarker: ghostTimeAt(ghost, marker) }) : '';
      say(gl ? `${split} ${gl}` : split);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dist, phase, running]);

  // Once a second: pace verdicts, form tips, surges, periodic persistence.
  const lastSecRef = useRef(-1);
  useEffect(() => {
    if (phase !== 'run' || !running) return;
    const sec = Math.floor(elapsedSec);
    if (sec === lastSecRef.current) return;
    lastSecRef.current = sec;
    const r = runRef.current;
    persist();
    report();

    // Indoors there is no GPS callback to build the ghost trace, so it is
    // sampled here, on the same every-three-seconds cadence the GPS path uses.
    if (machine) {
      const last = r.trace[r.trace.length - 1];
      if (!last || sec - last.t >= 3) r.trace.push({ t: sec, d: +machineDist.toFixed(4) });
    }

    // ── Guided programme: the announcer IS the coach ────────────────────────
    // Every change is pre-called five seconds early ("Sprint coming. Set
    // 10.0. Five seconds.") and then called on the second ("Go. 40
    // seconds."). The athlete moves the belt themselves. Sprints get a
    // double bell and a three-beep countdown out. When the last segment
    // ends the run is complete. The generic pace coach stays quiet
    // underneath — two voices telling you what to do is one too many.
    if (program) {
      const idx = segmentAt(program, sec);
      if (idx === -1) { finishRun(true); return; }
      const cur = program.segments[idx];
      const next = program.segments[idx + 1];
      if (idx !== r.programIdx) {
        r.programIdx = idx;
        setProgIdx(idx);
        playBell(cur.kind === 'sprint' ? 2 : 1);
        say(cur.start);
        r.lastCueSec = sec;
        persist(true);
        return;
      }
      if (next && next.pre && r.programPreSaid !== next.index && sec >= next.startSec - CHASE_LEAD_IN_SEC) {
        r.programPreSaid = next.index;
        playBeep();
        say(next.pre);
        r.lastCueSec = sec;
        return;
      }
      const left = cur.endSec - sec;
      if (cur.kind === 'sprint' && left > 0 && left <= 3) playBeep();
      return;
    }

    // ── The chase (INTERVALS on an outdoor run) ─────────────────────────────
    // Zombies-Run shape: a random call every few minutes, a 40–60 s window,
    // and you escape by running 15% faster than your own last minute. Escape
    // banks bonus XP; getting caught forfeits it — nothing is taken away.
    if (chaseMode) {
      const c = r.chase;
      if (c.activeUntilSec != null) {
        const left = c.activeUntilSec - sec;
        if (left > 0) {
          const b = chaseBeepAt(left);
          if (b) playBeep();
          return;
        }
        // Window closed — judge it against the minute before the call.
        const chasePaceSec = chasePaceFromWindow({
          startMeters: c.startMeters, endMeters: r.meters, seconds: c.windowSec, metersPerUnitValue: metersPerUnit(unit),
        });
        const v = evaluateChase({ baselinePaceSec: c.baselinePaceSec, chasePaceSec });
        c.results.push({
          atSec: c.startSec, windowSec: c.windowSec,
          baselinePaceSec: Math.round(c.baselinePaceSec), chasePaceSec: chasePaceSec ? Math.round(chasePaceSec) : null,
          pass: v.pass,
        });
        if (v.pass) {
          c.passes += 1;
          playRingChime();
          say(`Escaped. ${CHASE_XP} X P banked. Ease back.`);
        } else {
          c.fails += 1;
          playPowerDown();
          say("Chase lost. No bonus this time. Next one's yours. Ease back.");
        }
        setChaseFlash(v.pass ? 'pass' : 'fail');
        setTimeout(() => setChaseFlash(null), 4000);
        c.activeUntilSec = null;
        c.leadInAtSec = null;
        c.nextAtSec = nextChaseAt(sec);
        setChaseUi(null);
        r.lastCueSec = sec;
        persist(true);
        return;
      }
      if (c.nextAtSec != null) {
        const baseline = rollingPaceSec(r.samples, elapsedSec, unit, CHASE_BASELINE_WINDOW_SEC);
        const remainingSec = freeRun ? null : Math.max(0, goal - dist) * (baseline || r.cfg.targetPaceSec || 600);
        if (!c.pendingWindowSec) c.pendingWindowSec = chaseWindow();
        const windowSec = c.pendingWindowSec;
        // "Sprint in five" — only once we know there will be a sprint.
        if (c.leadInAtSec == null && baseline > 0 && sec >= c.nextAtSec - CHASE_LEAD_IN_SEC && sec < c.nextAtSec
          && canStartChase({ nowSec: c.nextAtSec, nextAtSec: c.nextAtSec, baselinePaceSec: baseline, remainingSec, windowSec })) {
          c.leadInAtSec = sec;
          playRiser();
          say('Sprint in five. Get ready.');
          r.lastCueSec = sec;
          return;
        }
        if (canStartChase({ nowSec: sec, nextAtSec: c.nextAtSec, baselinePaceSec: baseline, remainingSec, windowSec })) {
          c.windowSec = windowSec;
          c.pendingWindowSec = null;
          c.activeUntilSec = sec + windowSec;
          c.startSec = sec;
          c.startMeters = r.meters;
          c.baselinePaceSec = baseline;
          c.leadInAtSec = null;
          setChaseUi({ until: c.activeUntilSec, windowSec, requiredPaceSec: baseline * (1 - CHASE_THRESHOLD), baselinePaceSec: baseline });
          playBell(1);
          say(`Sprint! ${windowSec} seconds. Go!`);
          r.lastCueSec = sec;
          persist(true);
          return;
        }
        if (sec >= c.nextAtSec) {
          if (!(baseline > 0)) {
            // No minute of GPS to judge against yet — try again shortly.
            c.nextAtSec = sec + 30;
            c.leadInAtSec = null;
          } else {
            // Too close to the finish for a window plus the tail guard: the
            // chases are over for this run.
            c.nextAtSec = null;
            c.leadInAtSec = null;
          }
        }
      }
    }

    // Surges (random intervals): call it, hold it, call it off.
    if (r.nextSurgeSec != null && sec >= r.nextSurgeSec && r.surgeEndSec == null) {
      r.surgeEndSec = sec + 20 + Math.round(Math.random() * 10);
      r.nextSurgeSec = null;
      setSurge(true);
      playBell(2);
      say('Surge! Push the pace. Hold it until I call it off.');
      r.lastCueSec = sec;
      return;
    }
    if (r.surgeEndSec != null && sec >= r.surgeEndSec) {
      r.surgeEndSec = null;
      r.nextSurgeSec = sec + 45 + Math.round(Math.random() * 45);
      setSurge(false);
      say('Surge over. Settle back into your pace.');
      r.lastCueSec = sec;
      return;
    }

    // Pace coaching needs a real number to judge, and indoors it now has one —
    // the machine's speed. So a treadmill gets the whole coach rather than tips
    // only, including the call that only ever made sense against a real pace:
    // you are under the target, pick it up.
    if (dist < 0.08) return;
    if (!shouldCue({ nowSec: sec, lastCueSec: r.lastCueSec, lastSplitSec: r.lastSplitSec, gapSec: r.cueGap })) return;
    r.tipCounter += 1;
    const livePace = machine
      ? paceFromSpeed(speedNow)
      : (rollingPaceSec(r.samples, elapsedSec, unit, 30) || (dist > 0.1 ? elapsedSec / dist : null));
    let text = '';
    // Rotation: with a ghost, every other slot is the race call; every fourth a
    // tip; the rest the pace coach. Without one: pace, pace, tip.
    const slot = r.tipCounter % (ghost && measuring ? 4 : 3);
    const wantTip = !measuring || slot === 0;
    const wantGhost = ghost && measuring && (slot === 1 || slot === 3);
    const cad = cadenceRef.current;
    if (wantGhost) {
      const gap = ghostGap({ myDist: dist, ghostDist: ghostDistanceAt(ghost, elapsedSec), paceSec: livePace });
      const verdict = ghostVerdict(gap, unit);
      const pick = ghostCue(verdict, gap, unit, r.cueIdx[`ghost_${verdict}`] ?? -1);
      r.cueIdx[`ghost_${verdict}`] = pick.index; text = pick.text;
    } else if (wantTip && cad.rate && cad.verdict) {
      // A cadence the meter is actually confident about beats a generic tip:
      // it is about THIS athlete, right now, and it is the one thing they can
      // change instantly without changing pace.
      const pick = cadenceCue(cad.verdict, run.cfg.cadenceKind || 'run', r.cueIdx[`cad_${cad.verdict}`] ?? -1);
      r.cueIdx[`cad_${cad.verdict}`] = pick.index; text = pick.text;
    } else if (wantTip) {
      const pick = pickCue(RUN_TIPS, r.cueIdx.tip ?? -1);
      r.cueIdx.tip = pick.index; text = pick.text;
    } else {
      const verdict = paceVerdict(livePace, r.cfg.targetPaceSec);
      if (verdict === 'unknown') return;
      const pick = pickCue(PACE_CUES[verdict], r.cueIdx[verdict] ?? -1);
      r.cueIdx[verdict] = pick.index; text = pick.text;
    }
    r.lastCueSec = sec;
    r.cueGap = nextCueGap();
    say(text);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsedSec, phase, running]);

  // Coming back from being hidden: the clock ran, GPS did not. Say so once,
  // and record the gap so the summary can whisper it later. Any gap of at
  // least 15 s counts — shorter than that is not a real backgrounded run,
  // it is a notification or a quick tab switch.
  useEffect(() => {
    if (typeof document === 'undefined' || !useGps) return undefined;
    let hiddenAt = null;
    const onVis = () => {
      if (document.hidden) { hiddenAt = Date.now(); return; }
      if (hiddenAt && runningRef.current && phaseRef.current === 'run') {
        const gapMs = Date.now() - hiddenAt;
        if (gapMs >= 15000) {
          const r = runRef.current;
          r.gaps.push({ atSec: Math.round(liveRunElapsedSec(r)), durationMs: gapMs });
          r.totalGapMs += gapMs;
          r.lastFix = null;
          setCaption('Clock kept running while the app was away. GPS distance resumes from here.');
          persist(true);
        }
      }
      hiddenAt = null;
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [useGps, persist]);

  // Unmount mid-run (the athlete tapped back, or navigated away): the run stays
  // live in storage with the clock running. Only a finished run stops the voice.
  useEffect(() => () => {
    if (phaseRef.current === 'run') persist(true);
    if (phaseRef.current === 'done') stopVoiceSession();
  }, [persist]);

  // ── Derived numbers for the HUD ───────────────────────────────────────────
  const curPace = machine ? paceFromSpeed(speedNow)
    : usingGps ? (rollingPaceSec(run.samples, elapsedSec, unit, 30) || (dist > 0.1 ? elapsedSec / dist : null))
      : (running ? run.cfg.targetPaceSec : null);
  // A projected finish needs a finish. Free runs and programmes have none.
  const projected = (!freeRun && !program) ? projectedFinish(dist, elapsedSec, goal) : null;
  const vsTarget = projected != null && run.cfg.targetSec != null ? projected - run.cfg.targetSec : null;
  const vsElite = projected != null && run.cfg.eliteSec ? projected - run.cfg.eliteSec : null;
  // Programme position, the live chase, and the running chase tally.
  const progSeg = program && progIdx >= 0 ? program.segments[progIdx] : null;
  const progNext = program && progIdx >= 0 ? program.segments[progIdx + 1] : null;
  const progLeft = progSeg ? Math.max(0, progSeg.endSec - elapsedSec) : 0;
  const chaseLeft = chaseUi ? Math.max(0, chaseUi.until - elapsedSec) : 0;
  const chaseTally = chaseMode ? chaseSummary(run.chase) : null;
  // The bar: progress to the goal; on a free run, progress to the next split
  // (every half unit); on a programme, progress through the programme.
  const pct = program ? Math.min(100, (elapsedSec / program.totalSec) * 100)
    : freeRun ? Math.min(100, ((dist % 0.5) / 0.5) * 100)
      : Math.min(100, (dist / goal) * 100);
  const ghostDistNow = ghost && goal && phase === 'run' ? ghostDistanceAt(ghost, elapsedSec) : null;
  const ghostGapNow = ghost && goal && phase === 'run' ? ghostGap({ myDist: dist, ghostDist: ghostDistNow, paceSec: curPace }) : null;
  const ghostState = ghostGapNow ? ghostVerdict(ghostGapNow, unit) : null;
  // On a programme the pace verdict is against THIS segment's target, not the
  // session's effort pace — a recovery jog is "on" at recovery speed.
  const paceRef = progSeg?.speed ? 3600 / progSeg.speed : run.cfg.targetPaceSec;
  const verdictNow = measuring ? paceVerdict(curPace, paceRef) : 'unknown';
  const paceColor = verdictNow === 'on' ? '#8fe8ac' : verdictNow === 'fast' ? '#c9a6ff' : verdictNow === 'unknown' ? '#fff' : '#ff9a52';
  const gpsLabel = machine ? `${fmtSpeed(speedNow)} ${speedUnitLabel(unit)}`
    : !useGps ? 'PACE TRACK'
      : gpsStatus === 'live' ? 'GPS LIVE' : gpsStatus === 'denied' ? 'GPS DENIED' : 'GPS ACQUIRING…';
  const gpsDot = machine ? GREEN
    : gpsStatus === 'live' ? GREEN : gpsStatus === 'denied' ? '#ef4444' : useGps ? '#f5b942' : '#b06aff';

  // Floating mini-player: distance in the ring (WORK swaps the clock for a
  // number), elapsed and pace on the right, tenths as the segmented row.
  const miniFrame = useCallback(() => {
    // A free run's ring fills to the next whole unit; a programme's fills to
    // its end.
    const goalUnits = goal || Math.max(1, Math.ceil(dist + 1e-9));
    const tenths = Math.max(1, Math.round(goalUnits * 10));
    const doneTenths = Math.min(tenths, Math.floor(dist * 10 + 1e-9));
    const head = program ? program.label : `${String(run.cfg.methodLabel || 'RUN').toUpperCase()} ${goal ? `${goal} ${unit.toUpperCase()}` : 'FREE RUN'}`;
    return {
      phase: phase === 'run' && running ? 'work' : 'paused',
      clock: fmtClock(elapsedSec),
      reps: +dist.toFixed(2),
      repsLabel: unit.toUpperCase(),
      progress: program ? Math.min(1, elapsedSec / program.totalSec) : Math.min(1, dist / goalUnits),
      exIdx: Math.min(tenths, doneTenths + 1),
      exTotal: tenths,
      name: `${fmtClock(elapsedSec)} · ${head}`,
      prescription: program && progSeg
        ? `${progSeg.label} · ${progSeg.target} · ${fmtClock(progLeft)} LEFT`
        : `PACE ${curPace ? fmtClock(curPace) : '--:--'} /${unit} · TARGET ${run.cfg.targetSec != null ? fmtClock(run.cfg.targetSec) : fmtPace(run.cfg.targetPaceSec, unit)}`,
      nextName: program ? (progNext ? `NEXT ${progNext.label}` : null) : run.cfg.eliteSec ? `ELITE ${fmtClock(run.cfg.eliteSec)}` : null,
      segments: Array.from({ length: tenths }, (_, i) => (i < doneTenths ? 'done' : i === doneTenths ? 'current' : 'todo')),
    };
  }, [phase, running, elapsedSec, dist, goal, unit, curPace, run.cfg, program, progSeg, progNext, progLeft]);
  const mini = useMiniPlayer(miniFrame, phase !== 'done');

  // Calories burned so far. An estimate from mass, distance and time — no heart
  // rate is involved, so every screen that shows it says EST.
  const kcal = estimateCalories({ meters: dist * metersPerUnit(unit), seconds: elapsedSec });

  // Stride length, which is only trustworthy because BOTH halves are measured:
  // the speed from the machine and the cadence from the accelerometer. Nothing
  // here is estimated from the athlete's height.
  const stride = machine && cadence.rate ? strideFromSpeedAndCadence(speedNow, cadence.rate, unit) : null;

  const mono = "'Orbitron',sans-serif";
  const label = { fontFamily: mono, fontSize: 7.5, fontWeight: 700, color: '#8b83a8', letterSpacing: '0.12em' };

  // ── Done card ─────────────────────────────────────────────────────────────
  if (phase === 'done' && result) {
    const avg = result.avgPaceSec;
    return (
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '6px 0' }}>
        <div style={{ fontFamily: mono, fontSize: 9, color: GOLD, fontWeight: 700, letterSpacing: '0.22em', marginBottom: 6 }}>
          {result.program ? (result.completed ? 'PROGRAMME COMPLETE' : 'PROGRAMME ENDED') : result.freeRun ? 'RUN COMPLETE' : result.completed ? 'GOAL REACHED' : 'RUN ENDED'}
        </div>
        {!noDistance && (
          <div style={{ fontFamily: mono, fontSize: 52, fontWeight: 900, color: '#fff', lineHeight: 1, textShadow: '0 0 18px rgba(253,224,71,0.35)' }}>{result.completedDistance.toFixed(2)}<span style={{ fontSize: 14, color: GOLD, marginLeft: 6 }}>{unit.toUpperCase()}</span></div>
        )}
        <div style={{ fontFamily: mono, fontSize: noDistance ? 52 : 28, fontWeight: 900, color: GOLD, marginTop: 8 }}>{fmtClock(result.completedTimeSeconds)}</div>
        {result.program && (
          <div style={{ marginTop: 6, fontFamily: mono, fontSize: 8.5, fontWeight: 700, color: '#c9a6ff', letterSpacing: '0.12em' }}>
            {result.program.label} · {String(result.program.machine).toUpperCase()} · {String(result.program.tier).toUpperCase()} · {fmtClock(result.program.completedSec)} OF {fmtClock(result.program.totalSec)}
          </div>
        )}
        <div style={{ display: 'flex', gap: 14, marginTop: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          {!noDistance && <Stat label="AVG PACE" value={avg ? fmtPace(avg, unit) : '--'} />}
          {result.targetSec != null ? (
            <Stat label="VS TARGET" value={fmtSignedDelta(result.completedTimeSeconds - result.targetSec)} color={result.beatTarget ? '#8fe8ac' : '#ff9a52'} />
          ) : (!noDistance && avg && result.targetPaceSec ? (
            <Stat label="VS TARGET PACE" value={fmtSignedDelta(avg - result.targetPaceSec)} color={avg <= result.targetPaceSec ? '#8fe8ac' : '#ff9a52'} />
          ) : null)}
          {result.eliteSec ? <Stat label="VS ELITE" value={fmtSignedDelta(result.completedTimeSeconds - result.eliteSec)} color={result.beatElite ? '#8fe8ac' : '#c9a6ff'} /> : null}
          {result.chase?.attempts > 0 ? <Stat label="CHASES" value={`${result.chase.passes}/${result.chase.attempts}`} color={result.chase.passes > 0 ? GOLD : '#ff9a52'} /> : null}
          {result.calories ? <Stat label="KCAL EST" value={result.calories} color="#ff9a52" /> : null}
        </div>
        {result.beatElite && <div style={{ marginTop: 10, fontFamily: mono, fontSize: 10, fontWeight: 900, color: GOLD, letterSpacing: '0.16em', textShadow: '0 0 12px rgba(253,224,71,0.6)' }}>★ ELITE TIME ★</div>}
        {result.chase?.xp > 0 && <div style={{ marginTop: 8, fontFamily: mono, fontSize: 9.5, fontWeight: 900, color: '#ffd27a', letterSpacing: '0.14em' }}>⚡ +{result.chase.xp} XP CHASE BONUS</div>}
        {result.route?.length >= 2 && (
          <div style={{ width: '100%', marginTop: 12 }}>
            <RouteMap route={result.route} height={160} unit={unit} targetPaceSec={run.cfg.targetPaceSec} label="WHERE YOU RAN" />
          </div>
        )}
        {result.ghost && (
          <div style={{ width: '100%', marginTop: 12, borderRadius: 12, border: `1.5px solid ${result.ghost.outcome === 'victory' ? 'rgba(34,197,94,0.7)' : result.ghost.outcome === 'defeat' ? 'rgba(239,68,68,0.7)' : 'rgba(253,224,71,0.6)'}`, background: 'rgba(14,4,28,0.9)', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <SafeImage src={ghostArt(ghost)} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', objectPosition: 'center 20%', opacity: 0.9 }}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: mono, fontSize: 8, fontWeight: 700, color: '#9a90b8', letterSpacing: '0.14em' }}>GHOST · {ghost?.ownerId === 'me' ? 'YOUR RUN' : result.ghost.ownerName}</div>
              <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 900, color: result.ghost.outcome === 'victory' ? '#8fe8ac' : result.ghost.outcome === 'defeat' ? '#ff8a8a' : GOLD, marginTop: 2 }}>
                {result.ghost.outcome === 'victory' ? `👻 GHOST DEFEATED · ${fmtSignedDelta(result.ghost.delta)}` : result.ghost.outcome === 'defeat' ? `👻 GHOST WINS · ${fmtSignedDelta(result.ghost.delta)}` : '🤝 DEAD HEAT'}
              </div>
            </div>
          </div>
        )}
        {result.ghostRecorded && (
          <div style={{ marginTop: 10, fontFamily: mono, fontSize: 8.5, fontWeight: 700, color: '#c9a6ff', letterSpacing: '0.12em' }}>👻 {result.newBest ? 'NEW BEST — SAVED AS YOUR GHOST' : 'SAVED AS YOUR LAST-RUN GHOST'}</div>
        )}
        {result.totalGapMs > 0 && (
          // Whispered footnote — the athlete asked for this to be barely
          // there. Only appears when there was a real off-screen gap, and
          // even then it is 7 px, muted violet, one line, no icon.
          <div style={{ marginTop: 6, fontFamily: mono, fontSize: 7, fontWeight: 500, color: '#6b6483', letterSpacing: '0.14em' }}>
            {`off-screen ${Math.max(1, Math.round(result.totalGapMs / 1000))}s`}
          </div>
        )}
        {result.splits.length > 0 && (
          <div style={{ width: '100%', marginTop: 12, borderRadius: 10, border: '1px solid rgba(168,85,247,0.25)', background: 'rgba(8,2,18,0.6)', padding: '8px 12px' }}>
            <div style={{ ...label, marginBottom: 5 }}>SPLITS</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
              {result.splits.map(s => (
                <span key={s.marker} style={{ fontFamily: mono, fontSize: 9.5, color: '#d6c2ff' }}>{s.marker} {unit} · <span style={{ color: '#fff' }}>{fmtClock(s.elapsedSec)}</span></span>
              ))}
            </div>
          </div>
        )}
        {/* The finish-line correction. Whatever we integrated, the console is the
            ground truth an athlete will compare us against, so let them hand it
            over in one tap and log THAT. A belt reads slightly differently from
            its own dial and a speed change always lands a second or two late;
            this is the only way the logged number is exactly right. */}
        {result.surface === 'machine' && (
          <div style={{ width: '100%', marginTop: 12, borderRadius: 12, border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(8,2,18,0.6)', padding: '10px 12px' }}>
            <div style={{ ...label, marginBottom: 6 }}>WHAT DOES THE MACHINE SAY?</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={consoleDist}
                onChange={(e) => setConsoleDist(e.target.value)}
                placeholder={result.completedDistance.toFixed(2)}
                aria-label={`Distance from the machine in ${unit}`}
                style={{ flex: 1, minWidth: 0, height: 44, borderRadius: 10, border: '1px solid rgba(168,85,247,0.35)', background: 'rgba(14,4,28,0.9)', color: '#fff', fontFamily: mono, fontSize: 18, fontWeight: 900, textAlign: 'center' }}
              />
              <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: GOLD }}>{unit.toUpperCase()}</span>
            </div>
            <div style={{ fontFamily: ARCADE.fontBody, fontSize: 9, color: C.muted, marginTop: 6, lineHeight: 1.35 }}>
              Optional. Leave it blank to keep {result.completedDistance.toFixed(2)} {unit}.
            </div>
          </div>
        )}
        <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 11, color: '#c9f5d6', marginTop: 10, textAlign: 'center', minHeight: 16 }}>{caption}</div>
        <TrainingCTA
          variant="gold"
          label="CONTINUE"
          icon="✓"
          height={50}
          onClick={() => {
            stopVoiceSession();
            const typed = parseFloat(consoleDist);
            if (result.surface === 'machine' && Number.isFinite(typed) && typed > 0) {
              const c = applyMachineCorrection(result.completedDistance, typed);
              const el = result.completedTimeSeconds;
              onComplete({
                ...result,
                completedDistance: +c.distance.toFixed(2),
                machineCorrected: true,
                machineDriftFactor: +c.factor.toFixed(4),
                avgPaceSec: c.distance > 0.05 ? el / c.distance : result.avgPaceSec,
                calories: estimateCalories({ meters: c.distance * metersPerUnit(unit), seconds: el }),
              });
              return;
            }
            onComplete(result);
          }}
          style={{ width: '100%', marginTop: 12, fontSize: 14 }}
        />
      </div>
    );
  }

  // ── Live HUD ──────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2px 0' }}>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <FloatOnLeave {...mini}/>

      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: gpsDot, boxShadow: `0 0 8px ${gpsDot}`, animation: gpsStatus === 'acquiring' ? 'run-pulse 1.2s ease-in-out infinite' : 'none' }}/>
        <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 700, color: gpsStatus === 'live' ? '#8fe8ac' : '#ffd27a', letterSpacing: '0.1em' }}>
          {gpsLabel} · {program ? program.label : `${String(run.cfg.methodLabel || 'RUN').toUpperCase()} · ${goal ? `${goal} ${unit}` : 'FREE RUN'}`}
        </span>
        {useGps && <PocketModeChip onClick={() => setPocket(true)}/>}
      </div>
      <PocketMode open={pocket} onClose={() => setPocket(false)}/>

      {surge && (
        <div style={{ width: '100%', borderRadius: 10, background: 'rgba(255,138,74,0.14)', border: '1px solid rgba(255,138,74,0.5)', padding: '6px 12px', marginBottom: 8, textAlign: 'center', animation: 'run-pulse 0.9s ease-in-out infinite' }}>
          <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 900, color: '#ff8a4a', letterSpacing: '0.1em' }}>🔥 SURGE — PUSH THE PACE</span>
        </div>
      )}

      {/* THE CHASE — the sprint window with its countdown and the pace to beat,
          then a four-second verdict. */}
      {chaseUi && (
        <div style={{ width: '100%', borderRadius: 12, background: 'rgba(255,138,74,0.16)', border: '1.5px solid rgba(255,138,74,0.7)', padding: '8px 12px', marginBottom: 8, textAlign: 'center', animation: 'run-pulse 0.7s ease-in-out infinite', boxShadow: '0 0 18px rgba(255,138,74,0.25)' }}>
          <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 900, color: '#ff8a4a', letterSpacing: '0.12em' }}>⚡ SPRINT — {Math.ceil(chaseLeft)}s</div>
          <div style={{ fontFamily: mono, fontSize: 8.5, fontWeight: 700, color: '#ffd0b0', letterSpacing: '0.1em', marginTop: 3 }}>BEAT {fmtPace(chaseUi.requiredPaceSec, unit)} · YOU WERE {fmtPace(chaseUi.baselinePaceSec, unit)}</div>
        </div>
      )}
      {!chaseUi && chaseFlash && (
        <div style={{ width: '100%', borderRadius: 12, background: chaseFlash === 'pass' ? 'rgba(34,197,94,0.14)' : 'rgba(239,68,68,0.14)', border: `1.5px solid ${chaseFlash === 'pass' ? 'rgba(34,197,94,0.65)' : 'rgba(239,68,68,0.6)'}`, padding: '8px 12px', marginBottom: 8, textAlign: 'center' }}>
          <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 900, color: chaseFlash === 'pass' ? '#8fe8ac' : '#ff8a8a', letterSpacing: '0.12em' }}>
            {chaseFlash === 'pass' ? `ESCAPED · +${CHASE_XP} XP` : 'CAUGHT · NO BONUS'}
          </span>
        </div>
      )}

      {/* THE PROGRAMME — what to set now, how long it lasts, what comes next. */}
      {program && progSeg && (
        <div style={{ width: '100%', borderRadius: 12, background: progSeg.kind === 'sprint' ? 'rgba(253,224,71,0.1)' : progSeg.kind === 'hard' ? 'rgba(255,138,74,0.1)' : 'rgba(176,106,255,0.1)', border: `1.5px solid ${progSeg.kind === 'sprint' ? 'rgba(253,224,71,0.6)' : progSeg.kind === 'hard' ? 'rgba(255,138,74,0.55)' : 'rgba(176,106,255,0.5)'}`, padding: '8px 12px', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 900, color: progSeg.kind === 'sprint' ? GOLD : '#fff', letterSpacing: '0.1em' }}>{progSeg.label}</span>
            <span style={{ fontFamily: mono, fontSize: 18, fontWeight: 900, color: progSeg.kind === 'sprint' ? GOLD : '#c9a6ff', lineHeight: 1 }}>{fmtClock(progLeft)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 3 }}>
            <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 800, color: '#e6d4ff', letterSpacing: '0.06em' }}>{progSeg.speed ? `SET ${progSeg.target}` : String(progSeg.target).toUpperCase()}</span>
            <span style={{ fontFamily: mono, fontSize: 7.5, fontWeight: 700, color: '#8b83a8', letterSpacing: '0.1em' }}>{progNext ? `NEXT · ${progNext.label} ${progNext.speed ? fmtSpeed(progNext.speed) : ''}` : 'LAST SEGMENT'} · {progIdx + 1}/{program.segments.length}</span>
          </div>
        </div>
      )}

      {/* DISTANCE — the hero. Ticks gold at every tenth. The rower has no
          distance to show, so the clock takes its place. */}
      {!noDistance && (
        <>
          <div style={{ ...label, marginBottom: 2 }}>{estimating ? 'DISTANCE · EST' : machine ? 'DISTANCE · MACHINE' : 'DISTANCE'}</div>
          <div key={tickKey} style={{ fontFamily: mono, fontSize: 66, fontWeight: 900, color: '#fff', lineHeight: 1, letterSpacing: '-0.01em', animation: tickKey ? 'run-tick 0.7s ease-out' : 'none', textShadow: '0 0 16px rgba(168,85,247,0.4)' }}>
            {dist.toFixed(2)}<span style={{ fontSize: 16, color: GOLD, marginLeft: 6, letterSpacing: '0.08em' }}>{unit.toUpperCase()}</span>
          </div>
        </>
      )}

      {/* TIME — counts up from zero. */}
      <div style={{ fontFamily: mono, fontSize: noDistance ? 66 : 34, fontWeight: 900, color: running ? GOLD : '#c4b5fd', marginTop: 6, lineHeight: 1, textShadow: '0 0 12px rgba(253,224,71,0.3)' }}>{fmtClock(elapsedSec)}</div>
      <div style={{ ...label, marginTop: 3 }}>{phase === 'intro' ? (lockingGps ? 'LOCKING GPS…' : 'STARTING…') : running ? 'ELAPSED' : phase === 'ready' ? 'READY' : 'PAUSED'}</div>

      {/* Pace + targets */}
      <div style={{ display: 'flex', gap: 8, width: '100%', marginTop: 12 }}>
        {!noDistance && <Chip label="PACE" value={curPace ? fmtClock(curPace) : '--:--'} sub={`/${unit}`} color={paceColor} />}
        {program && progSeg ? (
          <>
            <Chip label="SET" value={progSeg.speed ? fmtSpeed(progSeg.speed) : progSeg.label} sub={progSeg.speed ? `${speedUnitLabel(unit)}${progSeg.incline ? ` · ${progSeg.incline}%` : ''}` : String(progSeg.target).toUpperCase()} color={progSeg.kind === 'sprint' ? GOLD : '#fff'} />
            <Chip label="LEFT" value={fmtClock(progLeft)} sub={progNext ? `NEXT ${progNext.label}` : 'LAST ONE'} color="#c9a6ff" />
          </>
        ) : freeRun ? (
          <Chip label="TARGET PACE" value={fmtPace(run.cfg.targetPaceSec, unit)} sub={run.cfg.effortTier ? `${String(run.cfg.effortMode || 'run').toUpperCase()} · ${String(run.cfg.effortTier).toUpperCase()}` : 'HOLD IT'} color="#fff" />
        ) : (
          <>
            <Chip label="TARGET" value={fmtClock(run.cfg.targetSec)} sub={fmtPace(run.cfg.targetPaceSec, unit)} color="#fff" />
            {run.cfg.eliteSec ? <Chip label="ELITE" value={fmtClock(run.cfg.eliteSec)} sub={fmtPace(run.cfg.elitePaceSec, unit)} color={GOLD} /> : null}
          </>
        )}
      </div>
      {cadence.rate != null && (
        <div style={{ display: 'flex', gap: 8, width: '100%', marginTop: 6 }}>
          <Chip
            label={cadence.band.label}
            value={String(cadence.rate)}
            sub={`${cadence.band.unit}${cadence.verdict === 'good' ? ' · GOOD' : cadence.verdict === 'low' ? ' · LOW' : cadence.verdict === 'high' ? ' · HIGH' : ''}`}
            color={cadence.verdict === 'good' ? '#8fe8ac' : cadence.verdict === 'low' ? '#ff9a52' : '#c9a6ff'}
          />
          {stride != null && <Chip label="STRIDE" value={stride.toFixed(2)} sub="METRES" color="#fff" />}
        </div>
      )}
      {(vsTarget != null || kcal != null || (chaseTally && chaseTally.attempts > 0)) && (
        <div style={{ display: 'flex', gap: 14, marginTop: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
          {vsTarget != null && <span style={{ fontFamily: mono, fontSize: 8.5, fontWeight: 700, color: vsTarget <= 0 ? '#8fe8ac' : '#ff9a52' }}>{fmtSignedDelta(vsTarget)} VS TARGET</span>}
          {vsTarget != null && vsElite != null && <span style={{ fontFamily: mono, fontSize: 8.5, fontWeight: 700, color: vsElite <= 0 ? GOLD : '#9a90b8' }}>{fmtSignedDelta(vsElite)} VS ELITE</span>}
          {chaseTally && chaseTally.attempts > 0 && <span style={{ fontFamily: mono, fontSize: 8.5, fontWeight: 700, color: '#ffd27a' }}>⚡ CHASES {chaseTally.passes}/{chaseTally.attempts} · +{chaseTally.xp} XP</span>}
          {kcal != null && !noDistance && <span style={{ fontFamily: mono, fontSize: 8.5, fontWeight: 700, color: '#ff9a52' }}>🔥 {kcal} KCAL EST</span>}
        </div>
      )}

      {/* Ghost race strip: who is ahead, by how much, and the ghost's art */}
      {ghost && goal && phase === 'run' && (
        <div style={{ width: '100%', marginTop: 10, borderRadius: 12, border: `1.5px solid ${ghostState === 'lead' ? 'rgba(34,197,94,0.6)' : ghostState === 'trail' ? 'rgba(239,68,68,0.6)' : 'rgba(253,224,71,0.5)'}`, background: 'rgba(14,4,28,0.85)', padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <SafeImage src={ghostArt(ghost)} alt="" style={{ width: 38, height: 38, borderRadius: 9, objectFit: 'cover', objectPosition: 'center 20%', opacity: 0.85, filter: 'saturate(0.7)' }}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontFamily: mono, fontSize: 8, fontWeight: 700, color: '#9a90b8', letterSpacing: '0.14em' }}>👻 {ghost.ownerId === 'me' ? 'YOUR GHOST' : ghost.ownerName} · {fmtClock(ghost.totalSec)}</span>
              <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 900, color: ghostState === 'lead' ? '#8fe8ac' : ghostState === 'trail' ? '#ff8a8a' : GOLD }}>
                {ghostState === 'lead' ? 'YOU LEAD' : ghostState === 'trail' ? 'GHOST LEADS' : 'LEVEL'}{ghostGapNow?.dSec != null ? ` · ${fmtClock(Math.abs(ghostGapNow.dSec))}` : ''}
              </span>
            </div>
            <div style={{ position: 'relative', height: 6, borderRadius: 99, background: 'rgba(255,255,255,0.06)', marginTop: 5 }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, (ghostDistNow / goal) * 100)}%`, borderRadius: 99, background: 'rgba(168,85,247,0.45)' }}/>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, borderRadius: 99, background: ghostState === 'trail' ? 'linear-gradient(90deg,#f59e0b,#ff8a8a)' : 'linear-gradient(90deg,#22c55e,#8fe8ac)' }}/>
              <span style={{ position: 'absolute', left: `calc(${Math.min(100, (ghostDistNow / goal) * 100)}% - 5px)`, top: -3, fontSize: 9, lineHeight: '12px' }}>👻</span>
            </div>
          </div>
        </div>
      )}

      {/* Progress: to the goal with tenth ticks; through the programme with a
          tick per segment (gold for sprints); to the next split on a free run. */}
      {(program || !noDistance) && (
        <div style={{ width: '100%', marginTop: 10 }}>
          <div style={{ position: 'relative', height: 8, borderRadius: 99, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <div style={{ width: `${Math.max(2, pct)}%`, height: '100%', background: (surge || chaseUi) ? 'linear-gradient(90deg,#f59e0b,#ff8a4a)' : 'linear-gradient(90deg,#7c3aed,#c9a6ff)', transition: 'width 0.5s linear' }}/>
            {program
              ? program.segments.slice(1).map(s => (
                <span key={s.index} style={{ position: 'absolute', left: `${(s.startSec / program.totalSec) * 100}%`, top: 0, bottom: 0, width: 1, background: s.kind === 'sprint' ? 'rgba(253,224,71,0.7)' : s.kind === 'hard' ? 'rgba(255,138,74,0.55)' : 'rgba(255,255,255,0.14)' }}/>
              ))
              : freeRun
                ? [20, 40, 60, 80].map(p => <span key={p} style={{ position: 'absolute', left: `${p}%`, top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.14)' }}/>)
                : Array.from({ length: Math.max(0, Math.round(goal * 10) - 1) }, (_, i) => (i + 1) / 10).map(m => (
                  <span key={m} style={{ position: 'absolute', left: `${(m / goal) * 100}%`, top: 0, bottom: 0, width: 1, background: Number.isInteger(Math.round(m * 10) / 10 * 2) ? 'rgba(253,224,71,0.55)' : 'rgba(255,255,255,0.14)' }}/>
                ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
            <span style={label}>{program ? fmtClock(elapsedSec) : '0'}</span>
            <span style={label}>{program ? fmtClock(program.totalSec) : freeRun ? `NEXT SPLIT · ${((Math.floor(dist / 0.5 + 1e-9) + 1) * 0.5).toFixed(1)} ${unit.toUpperCase()}` : `${goal} ${unit.toUpperCase()}`}</span>
          </div>
        </div>
      )}

      {/* The map — the ground actually covered, drawn to scale and coloured by
          the pace run on each stretch. */}
      {useGps && (
        <div style={{ width: '100%', marginTop: 9 }}>
          <RouteMap
            route={route}
            height={124}
            unit={unit}
            targetPaceSec={run.cfg.targetPaceSec}
            live
            label="YOUR ROUTE"
          />
        </div>
      )}

      {/* Coach line — the last thing the voice said */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, borderRadius: 99, background: (surge || chaseUi) ? 'rgba(255,138,74,0.12)' : 'rgba(34,197,94,0.1)', border: `1px solid ${(surge || chaseUi) ? 'rgba(255,138,74,0.4)' : 'rgba(34,197,94,0.3)'}`, padding: '6px 14px', marginTop: 10, marginBottom: 12, maxWidth: '100%' }}>
        <span style={{ fontSize: 11 }}>{chaseUi ? '⚡' : surge ? '🔥' : '🗣'}</span>
        <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 11, fontWeight: 600, color: (surge || chaseUi) ? '#ffd0b0' : '#c9f5d6', lineHeight: 1.3 }}>{caption}</span>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, width: '100%' }}>
        {phase === 'ready' ? (
          <TrainingCTA variant="gold" label="START" icon="▶" height={52} onClick={() => setPhase('intro')} style={{ flex: '2 1 0', width: 'auto', fontSize: 14, letterSpacing: '0.08em' }} />
        ) : (
          <TrainingCTA
            variant={running ? 'violet' : 'gold'}
            label={phase === 'intro' ? (lockingGps ? 'LOCKING GPS…' : 'STARTING…') : running ? 'PAUSE' : 'RESUME'}
            icon={running ? '❚❚' : '▶'}
            height={52}
            onClick={() => { if (phase !== 'run') return; if (running) pauseRun(); else resumeRun(); }}
            style={{ flex: '2 1 0', width: 'auto', fontSize: 14, letterSpacing: '0.08em', opacity: phase === 'intro' ? 0.6 : 1 }}
          />
        )}
        <button onClick={() => finishRun(false)} disabled={phase === 'intro' || phase === 'ready'} style={{ flex: 1, height: 52, borderRadius: 14, cursor: 'pointer', border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.1)', color: '#ff8a8a', fontFamily: mono, fontWeight: 800, fontSize: 12, letterSpacing: '0.06em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: phase === 'intro' || phase === 'ready' ? 0.5 : 1 }}>
          <Flag size={14}/> END
        </button>
      </div>

      {machine && phase !== 'ready' && (
        <div style={{ width: '100%', marginTop: 10, borderRadius: 12, border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(8,2,18,0.6)', padding: '8px 10px' }}>
          <SpeedDial speed={speedNow} unit={unit} onChange={changeSpeed} compact />
          {program && progSeg?.speed && Math.abs(speedNow - progSeg.speed) > 0.15 ? (
            <div style={{ fontFamily: ARCADE.fontBody, fontSize: 9.5, color: '#ffd27a', marginTop: 6, textAlign: 'center', lineHeight: 1.35, fontWeight: 700 }}>
              Belt at {fmtSpeed(speedNow)} — the programme says {fmtSpeed(progSeg.speed)}. Set it, then match the dial.
            </div>
          ) : (
            <div style={{ fontFamily: ARCADE.fontBody, fontSize: 9, color: C.muted, marginTop: 6, textAlign: 'center', lineHeight: 1.35 }}>
              Match this to the machine. Distance is tracked from it.
            </div>
          )}
        </div>
      )}

      {machine && phase === 'run' && cadence.supported && cadence.permission === 'prompt' && (
        <button
          type="button"
          onClick={cadence.requestPermission}
          style={{ marginTop: 8, borderRadius: 10, border: '1px solid rgba(168,85,247,0.4)', background: 'rgba(124,58,237,0.14)', color: '#d6c2ff', fontFamily: ARCADE.fontBody, fontSize: 10, padding: '8px 14px', cursor: 'pointer' }}
        >
          TRACK MY CADENCE — allow motion
        </button>
      )}
      {machine && phase === 'run' && cadence.permission === 'granted' && cadence.rate == null && (
        <div style={{ fontFamily: ARCADE.fontBody, fontSize: 9, color: C.muted, marginTop: 8, textAlign: 'center', lineHeight: 1.35 }}>
          Reading your cadence… keep the phone on you, or resting on the machine.
        </div>
      )}

      {estimating && !noDistance && phase === 'run' && (
        <div style={{ fontFamily: ARCADE.fontBody, fontSize: 9.5, color: C.muted, marginTop: 8, textAlign: 'center', lineHeight: 1.35 }}>
          {useGps ? 'No GPS fix yet — distance is estimated at your target pace until one arrives.' : 'No GPS on this method — distance is estimated at your target pace.'}
        </div>
      )}
    </div>
  );
}

function Chip({ label, value, sub, color }) {
  return (
    <div style={{ flex: 1, borderRadius: 10, border: '1px solid rgba(168,85,247,0.25)', background: 'rgba(8,2,18,0.6)', padding: '6px 6px 5px', textAlign: 'center', minWidth: 0 }}>
      <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 7, fontWeight: 700, color: '#8b83a8', letterSpacing: '0.14em' }}>{label}</div>
      <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 15, fontWeight: 900, color, marginTop: 2, whiteSpace: 'nowrap' }}>{value}</div>
      <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 7, fontWeight: 700, color: '#6f6790', marginTop: 1, whiteSpace: 'nowrap' }}>{sub}</div>
    </div>
  );
}

function Stat({ label, value, color = '#fff' }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 7, fontWeight: 700, color: '#8b83a8', letterSpacing: '0.14em' }}>{label}</div>
      <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 13, fontWeight: 900, color, marginTop: 2 }}>{value}</div>
    </div>
  );
}

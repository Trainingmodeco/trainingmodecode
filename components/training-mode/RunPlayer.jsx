import { useState, useEffect, useRef, useCallback } from 'react';
import { Flag } from 'lucide-react';
import { C } from './Styles';
import { ARCADE } from './ArcadeUI';
import TrainingCTA from './shared/TrainingCTA';
import useWakeLock from './hooks/useWakeLock';
import useMiniPlayer from './hooks/useMiniPlayer';
import MiniPlayerButton from './shared/MiniPlayerButton';
import { speakAsync, primeSpeech, stopVoiceSession, delay } from './voiceCoach';
import { playBell, unlockAudio } from './data/audioEngine';
import { saveLiveRun, clearLiveRun, liveRunElapsedSec } from './data/liveRun';
import {
  metersPerUnit, fmtClock, fmtPace, fmtSignedDelta, speakDuration, speakDistance,
  buildRunIntro, crossedMarkers, crossedTenths, splitScript, finishScript,
  paceVerdict, PACE_CUES, RUN_TIPS, pickCue, shouldCue, nextCueGap,
  evaluateFix, rollingPaceSec, projectedFinish,
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
// Distance comes from GPS when there is a fix. Without GPS (treadmill, denied
// permission) it is ESTIMATED at the target pace and labelled as such — the
// splits still fire so a treadmill run still gets its mile calls, but the pace
// coach stays quiet because it would have nothing real to judge.

const GOLD = C.yellow;
const VIOLET = '#a855f7';
const GREEN = '#22c55e';

const STYLES = `
@keyframes run-tick { 0% { color: ${GOLD}; text-shadow: 0 0 22px rgba(253,224,71,0.9); } 100% { color: #fff; text-shadow: 0 0 16px rgba(168,85,247,0.4); } }
@keyframes run-pulse { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }
`;

const TICK_MS = 250;
const PERSIST_EVERY_MS = 4000;
const ROUTE_MAX = 240;
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
    route: [],
    samples: [],
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
  };
}

export default function RunPlayer({ cfg, restore = null, autoStart = true, onState, onGpsDenied, onComplete, onCaption }) {
  const runRef = useRef(null);
  if (!runRef.current) runRef.current = restore ? { ...newRun(cfg), ...restore, cfg: restore.cfg || cfg } : newRun(cfg);
  const run = runRef.current;
  const unit = run.cfg.unit || 'mi';
  const goal = run.cfg.goal || 3;
  const useGps = !!run.cfg.useGps;

  const [phase, setPhase] = useState(restore ? 'run' : (autoStart ? 'intro' : 'ready'));
  const [running, setRunning] = useState(restore ? !restore.pausedAt : false);
  const [now, setNow] = useState(Date.now());
  const [meters, setMeters] = useState(run.meters || 0);
  const [route, setRoute] = useState(run.route || []);
  const [gpsStatus, setGpsStatus] = useState(useGps ? 'acquiring' : 'off');
  const [caption, setCaption] = useState(restore ? 'Welcome back. The clock kept running.' : 'Get set.');
  const [surge, setSurge] = useState(false);
  const [tickKey, setTickKey] = useState(0);
  const [result, setResult] = useState(null);
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
      route: r.route.slice(-ROUTE_MAX),
      samples: r.samples.slice(-SAMPLES_MAX),
    });
  }, []);

  const report = useCallback((extra = {}) => {
    const r = runRef.current;
    onState?.({ live: phaseRef.current === 'run', running: runningRef.current, elapsedSec: liveRunElapsedSec(r), meters: r.meters, ...extra });
  }, [onState]);

  const elapsedSec = liveRunElapsedSec(run, now);
  const gpsDist = meters / metersPerUnit(unit);
  const usingGps = useGps && gpsStatus === 'live';
  // No GPS: an estimate at the target pace, labelled EST on screen.
  const estimating = !useGps || (gpsStatus !== 'live' && meters === 0);
  const dist = estimating ? Math.min(goal, elapsedSec / (run.cfg.targetPaceSec || 600)) : gpsDist;

  // ── Start / pause / resume / end ──────────────────────────────────────────
  const startRun = useCallback(() => {
    const r = runRef.current;
    r.startedAt = Date.now();
    r.pausedAt = null;
    r.nextSurgeSec = r.cfg.randomSurges ? 45 + Math.round(Math.random() * 45) : null;
    setPhase('run');
    setRunning(true);
    setNow(Date.now());
    persist(true);
    report({ live: true, running: true });
  }, [persist, report]);

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
    const finalDist = estimating ? Math.min(goal, el / (r.cfg.targetPaceSec || 600)) : r.meters / metersPerUnit(unit);
    const d = completed ? Math.max(finalDist, goal) : finalDist;
    const res = {
      completed,
      completedTimeSeconds: Math.round(el),
      completedDistance: +d.toFixed(2),
      distanceUnit: unit,
      gps: !estimating,
      avgPaceSec: d > 0.05 ? el / d : null,
      targetSec: r.cfg.targetSec,
      eliteSec: r.cfg.eliteSec,
      beatTarget: completed && el <= r.cfg.targetSec,
      beatElite: completed && !!r.cfg.eliteSec && el <= r.cfg.eliteSec,
      splits: r.splits.slice(),
    };
    setPhase('done');
    setRunning(false);
    setResult(res);
    clearLiveRun();
    report({ live: false, running: false });
    if (completed) {
      playBell(3);
      say(finishScript({ dist: d, unit, elapsedSec: el, targetSec: r.cfg.targetSec, eliteSec: r.cfg.eliteSec }));
    } else {
      say(`Run ended. ${speakDistance(d, unit)} in ${speakDuration(el)}.`);
    }
  }, [estimating, goal, unit, report, say]);

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
        const intro = buildRunIntro({ methodLabel: run.cfg.methodLabel, useGps, distance: goal, unit, targetSec: run.cfg.targetSec, eliteSec: run.cfg.eliteSec });
        for (const line of intro.lines) {
          if (cancelled) return;
          await say(line, { rate: 1.0 });
        }
        if (cancelled) return;
        await say(intro.ready);
        await delay(700);
      } catch { /* start anyway */ }
      if (cancelled) return;
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
  useEffect(() => {
    if (!useGps || phase === 'done') return undefined;
    if (typeof navigator === 'undefined' || !navigator.geolocation) { setGpsStatus('denied'); onGpsDenied?.(); return undefined; }
    let staleTimer = null;
    const armStale = () => {
      clearTimeout(staleTimer);
      staleTimer = setTimeout(() => { if (aliveRef.current) setGpsStatus(s => (s === 'live' ? 'acquiring' : s)); }, 20000);
    };
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        if (!aliveRef.current) return;
        const r = runRef.current;
        const fix = { lat: pos.coords.latitude, lng: pos.coords.longitude, t: pos.timestamp || Date.now(), accuracy: pos.coords.accuracy };
        const verdict = evaluateFix(r.lastFix, fix);
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
          r.route.push({ lat: fix.lat, lng: fix.lng });
          if (r.route.length > ROUTE_MAX) r.route.shift();
          setMeters(r.meters);
          setRoute(r.route.slice());
          persist();
        } else if (r.route.length === 0) {
          r.route.push({ lat: fix.lat, lng: fix.lng });
        }
        r.lastFix = fix;
      },
      (err) => {
        if (!aliveRef.current) return;
        if (err && err.code === 1) { setGpsStatus('denied'); onGpsDenied?.(); }
        else setGpsStatus('acquiring');
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
    return () => { clearTimeout(staleTimer); navigator.geolocation.clearWatch(id); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useGps, phase === 'done']);

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

    // Goal first — the finish call outranks a split on the same tick.
    if (dist >= goal - 1e-9) { finishRun(true); return; }

    const markers = crossedMarkers(prev, dist, 0.5).filter(m => m < goal - 1e-9 && !r.markersDone.includes(m));
    if (markers.length) {
      const marker = markers[markers.length - 1];
      const pace = usingGps ? (rollingPaceSec(r.samples, elapsedSec, unit, 60) || (dist > 0.05 ? elapsedSec / dist : 0)) : r.cfg.targetPaceSec;
      markers.forEach(m => { r.markersDone.push(m); r.splits.push({ marker: m, elapsedSec: Math.round(elapsedSec) }); });
      r.lastSplitSec = elapsedSec;
      playBell(1);
      say(splitScript({ marker, unit, elapsedSec, paceSec: pace, targetPaceSec: r.cfg.targetPaceSec, goal, targetSec: r.cfg.targetSec, eliteSec: r.cfg.eliteSec }));
      persist(true);
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

    // Pace coaching needs real movement to judge; a treadmill gets tips only.
    if (dist < 0.08) return;
    if (!shouldCue({ nowSec: sec, lastCueSec: r.lastCueSec, lastSplitSec: r.lastSplitSec, gapSec: r.cueGap })) return;
    r.tipCounter += 1;
    let text = '';
    const wantTip = !usingGps || r.tipCounter % 3 === 0;
    if (wantTip) {
      const pick = pickCue(RUN_TIPS, r.cueIdx.tip ?? -1);
      r.cueIdx.tip = pick.index; text = pick.text;
    } else {
      const pace = rollingPaceSec(r.samples, elapsedSec, unit, 30) || (dist > 0.1 ? elapsedSec / dist : null);
      const verdict = paceVerdict(pace, r.cfg.targetPaceSec);
      if (verdict === 'unknown') return;
      const pick = pickCue(PACE_CUES[verdict], r.cueIdx[verdict] ?? -1);
      r.cueIdx[verdict] = pick.index; text = pick.text;
    }
    r.lastCueSec = sec;
    r.cueGap = nextCueGap();
    say(text);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsedSec, phase, running]);

  // Coming back from being hidden: the clock ran, GPS did not. Say so once.
  useEffect(() => {
    if (typeof document === 'undefined' || !useGps) return undefined;
    let hiddenAt = null;
    const onVis = () => {
      if (document.hidden) { hiddenAt = Date.now(); return; }
      if (hiddenAt && runningRef.current && phaseRef.current === 'run' && Date.now() - hiddenAt > 15000) {
        setCaption('Clock kept running while the app was away. GPS distance resumes from here.');
        runRef.current.lastFix = null;
      }
      hiddenAt = null;
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [useGps]);

  // Unmount mid-run (the athlete tapped back, or navigated away): the run stays
  // live in storage with the clock running. Only a finished run stops the voice.
  useEffect(() => () => {
    if (phaseRef.current === 'run') persist(true);
    if (phaseRef.current === 'done') stopVoiceSession();
  }, [persist]);

  // ── Derived numbers for the HUD ───────────────────────────────────────────
  const curPace = usingGps ? rollingPaceSec(run.samples, elapsedSec, unit, 30) || (dist > 0.1 ? elapsedSec / dist : null) : (running ? run.cfg.targetPaceSec : null);
  const projected = projectedFinish(dist, elapsedSec, goal);
  const vsTarget = projected != null ? projected - run.cfg.targetSec : null;
  const vsElite = projected != null && run.cfg.eliteSec ? projected - run.cfg.eliteSec : null;
  const pct = Math.min(100, (dist / goal) * 100);
  const verdictNow = usingGps ? paceVerdict(curPace, run.cfg.targetPaceSec) : 'unknown';
  const paceColor = verdictNow === 'on' ? '#8fe8ac' : verdictNow === 'fast' ? '#c9a6ff' : verdictNow === 'unknown' ? '#fff' : '#ff9a52';
  const gpsLabel = !useGps ? 'PACE TRACK' : gpsStatus === 'live' ? 'GPS LIVE' : gpsStatus === 'denied' ? 'GPS DENIED' : 'GPS ACQUIRING…';
  const gpsDot = gpsStatus === 'live' ? GREEN : gpsStatus === 'denied' ? '#ef4444' : useGps ? '#f5b942' : '#b06aff';

  // Floating mini-player: distance in the ring (WORK swaps the clock for a
  // number), elapsed and pace on the right, tenths as the segmented row.
  const miniFrame = useCallback(() => {
    const tenths = Math.max(1, Math.round(goal * 10));
    const doneTenths = Math.min(tenths, Math.floor(dist * 10 + 1e-9));
    return {
      phase: phase === 'run' && running ? 'work' : 'paused',
      clock: fmtClock(elapsedSec),
      reps: +dist.toFixed(2),
      repsLabel: unit.toUpperCase(),
      progress: Math.min(1, dist / goal),
      exIdx: Math.min(tenths, doneTenths + 1),
      exTotal: tenths,
      name: `${fmtClock(elapsedSec)} · ${String(run.cfg.methodLabel || 'RUN').toUpperCase()} ${goal} ${unit.toUpperCase()}`,
      prescription: `PACE ${curPace ? fmtClock(curPace) : '--:--'} /${unit} · TARGET ${fmtClock(run.cfg.targetSec)}`,
      nextName: run.cfg.eliteSec ? `ELITE ${fmtClock(run.cfg.eliteSec)}` : null,
      segments: Array.from({ length: tenths }, (_, i) => (i < doneTenths ? 'done' : i === doneTenths ? 'current' : 'todo')),
    };
  }, [phase, running, elapsedSec, dist, goal, unit, curPace, run.cfg]);
  const mini = useMiniPlayer(miniFrame, phase !== 'done');

  const routePts = (() => {
    if (route.length >= 2) {
      const lats = route.map(p => p.lat), lngs = route.map(p => p.lng);
      const minLat = Math.min(...lats), maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
      const spanLat = Math.max(1e-6, maxLat - minLat), spanLng = Math.max(1e-6, maxLng - minLng);
      const pad = 6;
      return route.map(p => `${(pad + ((p.lng - minLng) / spanLng) * (300 - pad * 2)).toFixed(1)},${(58 - ((p.lat - minLat) / spanLat) * 52).toFixed(1)}`).join(' ');
    }
    return null;
  })();

  const mono = "'Orbitron',sans-serif";
  const label = { fontFamily: mono, fontSize: 7.5, fontWeight: 700, color: '#8b83a8', letterSpacing: '0.12em' };

  // ── Done card ─────────────────────────────────────────────────────────────
  if (phase === 'done' && result) {
    const avg = result.avgPaceSec;
    return (
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '6px 0' }}>
        <div style={{ fontFamily: mono, fontSize: 9, color: GOLD, fontWeight: 700, letterSpacing: '0.22em', marginBottom: 6 }}>{result.completed ? 'GOAL REACHED' : 'RUN ENDED'}</div>
        <div style={{ fontFamily: mono, fontSize: 52, fontWeight: 900, color: '#fff', lineHeight: 1, textShadow: '0 0 18px rgba(253,224,71,0.35)' }}>{result.completedDistance.toFixed(2)}<span style={{ fontSize: 14, color: GOLD, marginLeft: 6 }}>{unit.toUpperCase()}</span></div>
        <div style={{ fontFamily: mono, fontSize: 28, fontWeight: 900, color: GOLD, marginTop: 8 }}>{fmtClock(result.completedTimeSeconds)}</div>
        <div style={{ display: 'flex', gap: 14, marginTop: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Stat label="AVG PACE" value={avg ? fmtPace(avg, unit) : '--'} />
          <Stat label="VS TARGET" value={fmtSignedDelta(result.completedTimeSeconds - result.targetSec)} color={result.beatTarget ? '#8fe8ac' : '#ff9a52'} />
          {result.eliteSec ? <Stat label="VS ELITE" value={fmtSignedDelta(result.completedTimeSeconds - result.eliteSec)} color={result.beatElite ? '#8fe8ac' : '#c9a6ff'} /> : null}
        </div>
        {result.beatElite && <div style={{ marginTop: 10, fontFamily: mono, fontSize: 10, fontWeight: 900, color: GOLD, letterSpacing: '0.16em', textShadow: '0 0 12px rgba(253,224,71,0.6)' }}>★ ELITE TIME ★</div>}
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
        <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 11, color: '#c9f5d6', marginTop: 10, textAlign: 'center', minHeight: 16 }}>{caption}</div>
        <TrainingCTA variant="gold" label="CONTINUE" icon="✓" height={50} onClick={() => { stopVoiceSession(); onComplete(result); }} style={{ width: '100%', marginTop: 12, fontSize: 14 }} />
      </div>
    );
  }

  // ── Live HUD ──────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2px 0' }}>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <MiniPlayerButton {...mini} top={0} right={8}/>

      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: gpsDot, boxShadow: `0 0 8px ${gpsDot}`, animation: gpsStatus === 'acquiring' ? 'run-pulse 1.2s ease-in-out infinite' : 'none' }}/>
        <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 700, color: gpsStatus === 'live' ? '#8fe8ac' : '#ffd27a', letterSpacing: '0.1em' }}>
          {gpsLabel} · {String(run.cfg.methodLabel || 'RUN').toUpperCase()} · {goal} {unit}
        </span>
      </div>

      {surge && (
        <div style={{ width: '100%', borderRadius: 10, background: 'rgba(255,138,74,0.14)', border: '1px solid rgba(255,138,74,0.5)', padding: '6px 12px', marginBottom: 8, textAlign: 'center', animation: 'run-pulse 0.9s ease-in-out infinite' }}>
          <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 900, color: '#ff8a4a', letterSpacing: '0.1em' }}>🔥 SURGE — PUSH THE PACE</span>
        </div>
      )}

      {/* DISTANCE — the hero. Ticks gold at every tenth. */}
      <div style={{ ...label, marginBottom: 2 }}>{estimating ? 'DISTANCE · EST' : 'DISTANCE'}</div>
      <div key={tickKey} style={{ fontFamily: mono, fontSize: 66, fontWeight: 900, color: '#fff', lineHeight: 1, letterSpacing: '-0.01em', animation: tickKey ? 'run-tick 0.7s ease-out' : 'none', textShadow: '0 0 16px rgba(168,85,247,0.4)' }}>
        {dist.toFixed(2)}<span style={{ fontSize: 16, color: GOLD, marginLeft: 6, letterSpacing: '0.08em' }}>{unit.toUpperCase()}</span>
      </div>

      {/* TIME — counts up from zero. */}
      <div style={{ fontFamily: mono, fontSize: 34, fontWeight: 900, color: running ? GOLD : '#c4b5fd', marginTop: 6, lineHeight: 1, textShadow: '0 0 12px rgba(253,224,71,0.3)' }}>{fmtClock(elapsedSec)}</div>
      <div style={{ ...label, marginTop: 3 }}>{phase === 'intro' ? 'STARTING…' : running ? 'ELAPSED' : phase === 'ready' ? 'READY' : 'PAUSED'}</div>

      {/* Pace + targets */}
      <div style={{ display: 'flex', gap: 8, width: '100%', marginTop: 12 }}>
        <Chip label="PACE" value={curPace ? fmtClock(curPace) : '--:--'} sub={`/${unit}`} color={paceColor} />
        <Chip label="TARGET" value={fmtClock(run.cfg.targetSec)} sub={fmtPace(run.cfg.targetPaceSec, unit)} color="#fff" />
        {run.cfg.eliteSec ? <Chip label="ELITE" value={fmtClock(run.cfg.eliteSec)} sub={fmtPace(run.cfg.elitePaceSec, unit)} color={GOLD} /> : null}
      </div>
      {projected != null && (
        <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
          <span style={{ fontFamily: mono, fontSize: 8.5, fontWeight: 700, color: vsTarget <= 0 ? '#8fe8ac' : '#ff9a52' }}>{fmtSignedDelta(vsTarget)} VS TARGET</span>
          {vsElite != null && <span style={{ fontFamily: mono, fontSize: 8.5, fontWeight: 700, color: vsElite <= 0 ? GOLD : '#9a90b8' }}>{fmtSignedDelta(vsElite)} VS ELITE</span>}
        </div>
      )}

      {/* Progress to goal with tenth ticks */}
      <div style={{ width: '100%', marginTop: 10 }}>
        <div style={{ position: 'relative', height: 8, borderRadius: 99, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
          <div style={{ width: `${Math.max(2, pct)}%`, height: '100%', background: surge ? 'linear-gradient(90deg,#f59e0b,#ff8a4a)' : 'linear-gradient(90deg,#7c3aed,#c9a6ff)', transition: 'width 0.5s linear' }}/>
          {Array.from({ length: Math.max(0, Math.round(goal * 10) - 1) }, (_, i) => (i + 1) / 10).map(m => (
            <span key={m} style={{ position: 'absolute', left: `${(m / goal) * 100}%`, top: 0, bottom: 0, width: 1, background: Number.isInteger(Math.round(m * 10) / 10 * 2) ? 'rgba(253,224,71,0.55)' : 'rgba(255,255,255,0.14)' }}/>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
          <span style={label}>0</span>
          <span style={label}>{goal} {unit.toUpperCase()}</span>
        </div>
      </div>

      {/* Route trail */}
      {useGps && (
        <div style={{ width: '100%', borderRadius: 10, border: '1px solid rgba(34,197,94,0.22)', background: 'rgba(8,2,18,0.6)', padding: '6px 10px', marginTop: 8, position: 'relative' }}>
          <svg viewBox="0 0 300 64" style={{ width: '100%', height: 34, display: 'block' }}>
            {routePts
              ? <polyline points={routePts} fill="none" stroke={GREEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 3px rgba(34,197,94,0.5))' }}/>
              : <text x="150" y="38" textAnchor="middle" fill="#5f5880" style={{ font: `700 9px ${mono}`, letterSpacing: '0.1em' }}>ROUTE DRAWS AS YOU MOVE</text>}
          </svg>
        </div>
      )}

      {/* Coach line — the last thing the voice said */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, borderRadius: 99, background: surge ? 'rgba(255,138,74,0.12)' : 'rgba(34,197,94,0.1)', border: `1px solid ${surge ? 'rgba(255,138,74,0.4)' : 'rgba(34,197,94,0.3)'}`, padding: '6px 14px', marginTop: 10, marginBottom: 12, maxWidth: '100%' }}>
        <span style={{ fontSize: 11 }}>{surge ? '🔥' : '🗣'}</span>
        <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 11, fontWeight: 600, color: surge ? '#ffd0b0' : '#c9f5d6', lineHeight: 1.3 }}>{caption}</span>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, width: '100%' }}>
        {phase === 'ready' ? (
          <TrainingCTA variant="gold" label="START" icon="▶" height={52} onClick={() => setPhase('intro')} style={{ flex: '2 1 0', width: 'auto', fontSize: 14, letterSpacing: '0.08em' }} />
        ) : (
          <TrainingCTA
            variant={running ? 'violet' : 'gold'}
            label={phase === 'intro' ? 'STARTING…' : running ? 'PAUSE' : 'RESUME'}
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

      {estimating && phase === 'run' && (
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

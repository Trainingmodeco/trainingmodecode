import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import PhoneFrame from './PhoneFrame';
import TrainingHeader from './TrainingHeader';
import Embers from './Embers';
import { Play, Pause, SkipForward, Check, Square, ChevronsRight, RotateCcw, X } from 'lucide-react';
import { C, fixedColumnBar } from './Styles';
import { speakAsync, cancelSpeech, delay } from './voiceCoach';
import { playBeep } from './data/audioEngine';
import { logSetWeight, getLastWeight, defaultWeight, exerciseWeight, stepFor } from './data/weightLog';
import { rowProgression } from './data/builderProgression';
import { loadProfile } from './data/userProfile';
import { XP_PER_FIT_EXERCISE } from './data/userStats';
import VoiceMixer from './shared/VoiceMixer';
import useAutoPauseOnHidden from './hooks/useAutoPauseOnHidden';
import { waitUnpaused, awaitResume } from './shared/pausableWait';
import { encouragementIntervalSec } from './data/coachEncouragement';

// Design 34 — voice-guided Workout Builder player (Quick Mission style).
// Cycles through the generated list one set at a time:
//   • Bodyweight reps  → counted out loud on a cadence (speed adjustable).
//   • Weighted reps    → a completion window ("10 reps, 2 minutes to complete")
//                        with "Get into position … Get ready. Lift." — no count.
//   • Timed holds      → same announcer intro, then a timer with 30-second
//                        call-outs and short motivational lines.
//
// Spec 10 (workout map · free select) adds the navigation layer:
//   • a binder tab pinned above the tab bar opens the WORKOUT MAP and pauses;
//   • the map is a full-height sheet where any non-done exercise can be
//     started with press-and-hold (charge fill), skipped with hold+swipe,
//     and reordered with hold+drag — one status model drives every surface;
//   • closing the map auto-resumes with a 3-2-1 count; finishing an
//     exercise toasts the XP and auto-opens the map with the next one glowing.
const GOLD = C.gold;
const VIOLET = '#a855f7';

// Gesture constants (spec 8) — one hold, three outcomes.
const HOLD_MS = 250;      // press this long to start the charge
const CHARGE_MS = 700;    // full charge starts the exercise
const MOVE_SLOP = 8;      // px of movement that picks an axis
const SKIP_FRACTION = 0.4; // horizontal travel (of row width) that commits a skip

const QUOTES = [
  'Stay strong. Control the breath.',
  'Lock in. You own this.',
  'Hold the line.',
  'Strong to the finish.',
];

const fmtClock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const sayWindow = (sec) => (sec % 60 === 0 ? `${sec / 60} minute${sec >= 120 ? 's' : ''}` : `${sec} seconds`);

// Classify a generated exercise into one of the three guided modes.
function classify(ex) {
  const repsStr = String(ex.reps || '');
  const hold = repsStr.match(/^(\d+)\s*s$/i);
  if (hold) return { kind: 'hold', seconds: parseInt(hold[1], 10) };
  const nums = repsStr.match(/\d+/g);
  const reps = nums ? parseInt(nums[nums.length - 1], 10) : 10; // top of "4-8"
  if (String(ex.equipment || '').toLowerCase().includes('bodyweight')) {
    return { kind: 'reps', reps };
  }
  // Weighted: time-to-complete window instead of a count (~12s per rep,
  // rounded up to 30s — 10 reps → 2 minutes, as specced).
  const windowSec = Math.max(60, Math.ceil((reps * 12) / 30) * 30);
  return { kind: 'weighted', reps, windowSec };
}

// Spec 7 — weave a reorder around pinned rows: done/skipped rows keep their
// absolute positions; `from` moves to `slot` within the movable subsequence.
// Returns the full list of OLD indices in their NEW order.
function weaveOrder(n, isLocked, from, slot) {
  const movable = [];
  for (let i = 0; i < n; i++) if (!isLocked(i)) movable.push(i);
  const seq = movable.filter(i => i !== from);
  seq.splice(Math.max(0, Math.min(slot, seq.length)), 0, from);
  const order = [];
  let p = 0;
  for (let i = 0; i < n; i++) order.push(isLocked(i) ? i : seq[p++]);
  return order;
}

export default function FitBuilderGuidedPlayer({ exercises, exerciseIdx, completed = {}, skipped = {}, onCompleteExercise, onJumpExercise, onMarkSkipped, onReorder, onFinishWorkout, onBack, onStop, onSkipExercise, onRewindExercise, voiceOn = true }) {
  const ex = exercises[exerciseIdx];
  const plan = useMemo(() => classify(ex), [ex]);
  const totalSets = ex?.sets || 3;
  const restMax = ex?.restSeconds || parseInt(ex?.rest) || 60;
  const nextExercise = exerciseIdx < exercises.length - 1 ? exercises[exerciseIdx + 1] : null;

  const [set, setSet] = useState(1);
  const [phase, setPhase] = useState('intro'); // intro | position | active | rest | getready | done
  const [display, setDisplay] = useState(0);   // rep count OR seconds remaining OR position countdown
  const [announcer, setAnnouncer] = useState('Get ready…');
  const [paused, setPaused] = useState(false);
  const [cadenceSec, setCadenceSec] = useState(2);
  const [confirmEnd, setConfirmEnd] = useState(false); // STOP → shared confirm modal
  // WORKOUT MAP sheet: 'complete' mode is the auto slide-up after an exercise
  // finishes — the just-done row flips ✓ and the next one glows.
  const [mapOpen, setMapOpen] = useState(false);
  const [mapMode, setMapMode] = useState('normal'); // 'normal' | 'complete'
  const [glowIdx, setGlowIdx] = useState(null);
  const [justDoneIdx, setJustDoneIdx] = useState(null);
  const [toast, setToast] = useState(null);           // { name, xp }
  const wasRunningRef = useRef(false);                // resume after map close?
  const flowTimers = useRef([]);

  // One status model for every surface (spec: DONE · SKIPPED · NOW · QUEUED).
  // `done` outranks `now` so the just-finished exercise reads ✓ the moment its
  // last set lands, even while it is still the mounted index.
  const statusOf = useCallback((i) => (
    completed[i] || (i === exerciseIdx && phase === 'done') ? 'done'
      : i === exerciseIdx ? 'now'
      : skipped[i] ? 'skipped'
      : 'todo'
  ), [exerciseIdx, completed, skipped, phase]);
  const doneCount = exercises.reduce((a, _, i) => a + (statusOf(i) === 'done' ? 1 : 0), 0);

  // Keep the current card centred in the up-next strip as the workout moves.
  const curCardRef = useRef(null);
  useEffect(() => {
    curCardRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [exerciseIdx]);

  // Rest-time weight logger (design 38a) — weighted exercises only.
  const exId = ex?.id || ex?.name || 'exercise';
  const weightUnit = String(loadProfile()?.weightUnit || 'LBS').toUpperCase() === 'KG' ? 'KG' : 'LB';
  // Honour the athlete's MID-ROUND ENCOURAGEMENT setting during timed holds.
  const encourageEvery = encouragementIntervalSec(loadProfile()?.encouragement);
  const [logWeight, setLogWeight] = useState(0);
  const [logSaved, setLogSaved] = useState(false);

  // Design 39 — "get ready" load callout before a weighted exercise's first set.
  const prevWeight = getLastWeight(exId);   // last logged session (the "last time")
  // Spec 11 — the progression suggestion PRE-LOADS the big number (acceptance:
  // "the get-ready number equals the suggested load").
  const progRef = useRef(plan.kind === 'weighted' ? rowProgression(ex) : null);
  const [readyWeight, setReadyWeight] = useState(() => progRef.current?.suggested || exerciseWeight(ex)?.weight || defaultWeight(weightUnit));
  const [changeWtOpen, setChangeWtOpen] = useState(false);
  const readyWeightRef = useRef(readyWeight);
  const startLiftRef = useRef(null);
  const wStep = stepFor(weightUnit);
  useEffect(() => { readyWeightRef.current = readyWeight; }, [readyWeight]);
  // The working weight is one value shared by get-ready + the rest logger.
  useEffect(() => { if (logWeight > 0) readyWeightRef.current = logWeight; }, [logWeight]);
  const waitForStart = (version) => new Promise(res => { startLiftRef.current = { version, res }; });

  const versionRef = useRef(0);
  // True while the final set's completion sequence is in flight — blocks
  // repeated SET DONE / SKIP taps from re-firing it (see finishSet).
  const finishingRef = useRef(false);
  const pausedRef = useRef(false);
  const cadenceRef = useRef(cadenceSec);
  const logWeightRef = useRef(0);
  const logSavedRef = useRef(false);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { cadenceRef.current = cadenceSec; }, [cadenceSec]);
  useEffect(() => { logWeightRef.current = logWeight; }, [logWeight]);
  useEffect(() => { logSavedRef.current = logSaved; }, [logSaved]);

  const saveLoggedWeight = useCallback((setIndex) => {
    if (logSavedRef.current || !Number.isFinite(logWeightRef.current) || logWeightRef.current <= 0) return;
    logSetWeight({ exerciseId: exId, setIndex, weight: logWeightRef.current, unit: weightUnit, reps: plan.reps || null });
    setLogSaved(true);
  }, [exId, weightUnit, plan]);

  const say = useCallback((text, opts) => {
    setAnnouncer(text);
    if (voiceOn) speakAsync(text, opts);
  }, [voiceOn]);

  // 3-2-1 count-in — the map closes into this before the workout resumes or a
  // freely-selected exercise starts (spec 2 + 4).
  const countIn = useCallback(async () => {
    for (const n of ['3', '2', '1']) {
      setAnnouncer(n);
      playBeep();
      if (voiceOn) speakAsync(n, { rate: 1.35 });
      await delay(650);
    }
  }, [voiceOn]);

  // Wait helper that respects pause and version-cancellation.
  const waitSec = useCallback(async (version, seconds, onTick) => {
    let remaining = seconds;
    while (remaining > 0) {
      if (versionRef.current !== version) return false;
      if (pausedRef.current) { await delay(120); continue; }
      onTick?.(remaining);
      await delay(1000);
      remaining -= 1;
    }
    onTick?.(0);
    return versionRef.current === version;
  }, []);

  // Spec 6 — an exercise's LAST set just landed: mark it done (no auto-advance;
  // the map owns navigation now), toast the exact XP the summary will bank,
  // then auto-slide the map up with the next exercise glowing.
  const finishExercise = useCallback(() => {
    versionRef.current += 1;      // stop the runner cleanly
    setPhase('done');
    setDisplay(0);
    onCompleteExercise?.();
    setJustDoneIdx(exerciseIdx);
    setToast({ name: ex.name, xp: XP_PER_FIT_EXERCISE });
    // Next glow target: first queued after this one (wrapping); if the only
    // rows left were skipped, offer the first of those. Only DONE is permanent.
    const n = exercises.length;
    const doneAfter = (i) => i === exerciseIdx || completed[i];
    let target = null;
    for (let d = 1; d < n && target === null; d++) { const i = (exerciseIdx + d) % n; if (!doneAfter(i) && !skipped[i]) target = i; }
    for (let d = 1; d < n && target === null; d++) { const i = (exerciseIdx + d) % n; if (!doneAfter(i)) target = i; }
    flowTimers.current.forEach(clearTimeout);
    if (target === null) {
      flowTimers.current = [setTimeout(() => onFinishWorkout?.(), 1600)];
      return;
    }
    flowTimers.current = [
      setTimeout(() => { setGlowIdx(target); setMapMode('complete'); setMapOpen(true); }, 1200),
      setTimeout(() => setToast(null), 2600),
    ];
  }, [exerciseIdx, ex, exercises.length, completed, skipped, onCompleteExercise, onFinishWorkout]);

  const finishSet = useCallback(async (version) => {
    if (versionRef.current !== version) return;
    // Beta find: rapid SET DONE taps on the FINAL set each re-entered this
    // path during the 900ms completion delay — every tap wrote another
    // weight-log entry and restarted (so postponed) the completion. Once the
    // final set's finish sequence starts, further taps are ignored.
    if (finishingRef.current) return;
    if (set >= totalSets) finishingRef.current = true;
    const finishedSet = set;
    // Arm the rest-time weight logger for weighted lifts: auto-fill from the
    // last logged load (this session or a previous one), else a placeholder.
    if (plan.kind === 'weighted') {
      // Prefer the working weight already set (get-ready or a prior set) so it
      // carries across sets; else the last logged load, else a placeholder.
      const w = logWeightRef.current > 0 ? logWeightRef.current : (getLastWeight(exId)?.weight || defaultWeight(weightUnit));
      // Set refs directly too — the last-set path saves before effects flush.
      setLogWeight(w); logWeightRef.current = w;
      setLogSaved(false); logSavedRef.current = false;
    }
    if (set < totalSets) {
      setPhase('rest');
      say(`Set complete. Rest ${sayWindow(restMax)}.`);
      const ok = await waitSec(version, restMax, (r) => setDisplay(r));
      // Rest ran out without an explicit save → auto-save the shown value.
      if (plan.kind === 'weighted') saveLoggedWeight(finishedSet);
      if (!ok) return;
      setSet(s => s + 1);
      setPhase('intro');
    } else {
      if (plan.kind === 'weighted') saveLoggedWeight(finishedSet);
      say(`${ex.name} complete.`);
      await delay(900);
      if (versionRef.current !== version) return;
      finishExercise();
    }
  }, [set, totalSets, restMax, ex, plan, exId, weightUnit, finishExercise, say, waitSec, saveLoggedWeight]);

  // Stable invalidator so effect cleanups don't read the ref directly.
  const invalidate = useCallback(() => { versionRef.current += 1; }, []);

  // Per-set runner — announces the intro, then drives the mode. Keyed on the
  // set/exercise only: `phase` is pure UI state, so mid-set phase changes
  // (intro → active) must NOT restart or invalidate the running loop.
  // A reorder changes `exerciseIdx` (same exercise, new position) while the
  // map holds the player paused — so the runner FIRST waits out the pause,
  // keeping any restart silent until the 3-2-1 releases it.
  useEffect(() => {
    const version = ++versionRef.current;
    finishingRef.current = false; // a new set/exercise re-arms SET DONE

    const run = async () => {
      if (pausedRef.current) {
        const ok = await awaitResume({ isPaused: () => pausedRef.current, isStale: () => versionRef.current !== version });
        if (!ok) return;
      }
      setPhase('intro');
      setDisplay(0);
      if (plan.kind === 'reps') {
        say(`${ex.name}. Set ${set} of ${totalSets}. ${plan.reps} reps. On my count.`);
        await delay(2600);
        if (versionRef.current !== version) return;
        setPhase('active');
        setDisplay(0);
        const stale = () => versionRef.current !== version;
        const isPaused = () => pausedRef.current;
        for (let i = 1; i <= plan.reps; i++) {
          // Counts only unpaused time — a wall-clock deadline expires during a
          // pause and fires the rep anyway. See shared/pausableWait.js.
          if (!await waitUnpaused(cadenceRef.current * 1000, { isPaused, isStale: stale })) return;
          if (!await awaitResume({ isPaused, isStale: stale })) return;
          setDisplay(i);
          playBeep();
          if (voiceOn) speakAsync(String(i), { rate: 1.4 });
        }
        await delay(700);
        finishSet(version);
      } else if (plan.kind === 'weighted') {
        // Design 39 — a "get ready" load callout gates the FIRST set: show the
        // load, let the athlete change it, and wait for START — LIFT. Later sets
        // flow straight through the usual "get into position" countdown.
        if (set === 1) {
          setPhase('getready');
          say(readyWeightRef.current > 0 ? `Load ${readyWeightRef.current}. Get ready. Lift.` : 'Get ready. Lift.');
          const started = await waitForStart(version);
          if (!started || versionRef.current !== version) return;
          // Seed the working weight so the rest logger pre-fills what was lifted.
          setLogWeight(readyWeightRef.current); logWeightRef.current = readyWeightRef.current;
          setPhase('active');
          setDisplay(0);
          let a30 = false;
          const okW = await waitSec(version, plan.windowSec, (r) => { setDisplay(r); if (r === 30 && !a30) { a30 = true; say('30 seconds.'); } });
          if (!okW) return;
          finishSet(version);
          return;
        }
        say(`${ex.name}. Set ${set} of ${totalSets}. ${plan.reps} reps. ${sayWindow(plan.windowSec)} to complete, with ${sayWindow(restMax)} rest. Get into position.`);
        setPhase('position');
        await delay(2800);
        if (versionRef.current !== version) return;
        const okPos = await waitSec(version, 5, (r) => setDisplay(r));
        if (!okPos) return;
        // Announce the load from the working weight (get-ready / prior set).
        say(readyWeightRef.current > 0 ? `Load ${readyWeightRef.current}. Get ready. Lift.` : 'Get ready. Lift.');
        await delay(1200);
        if (versionRef.current !== version) return;
        setPhase('active');
        let announced30 = false;
        const ok = await waitSec(version, plan.windowSec, (r) => {
          setDisplay(r);
          if (r === 30 && !announced30) { announced30 = true; say('30 seconds.'); }
        });
        if (!ok) return;
        finishSet(version);
      } else { // hold
        say(`${ex.name}. Set ${set} of ${totalSets}. ${plan.seconds} seconds. Get into position.`);
        setPhase('position');
        await delay(2400);
        if (versionRef.current !== version) return;
        const okPos = await waitSec(version, 5, (r) => setDisplay(r));
        if (!okPos) return;
        say('Get ready. Go.');
        await delay(1000);
        if (versionRef.current !== version) return;
        setPhase('active');
        let quoteIdx = 0;
        const ok = await waitSec(version, plan.seconds, (r) => {
          setDisplay(r);
          const elapsed = plan.seconds - r;
          if (elapsed <= 0 || r <= 5) return;
          // A time call-out is information, so it always fires. Encouragement
          // is the athlete's choice — this hold used to hard-code a line every
          // 60s and ignore the setting completely, so OFF was never silent and
          // EVERY 20s changed nothing here.
          if (elapsed % 30 === 0) { say(`${elapsed} seconds down.`); return; }
          if (encourageEvery > 0 && (elapsed + Math.round(encourageEvery / 2)) % encourageEvery === 0) {
            say(QUOTES[quoteIdx++ % QUOTES.length]);
          }
        });
        if (!ok) return;
        finishSet(version);
      }
    };

    run();
    return () => {
      invalidate(); cancelSpeech();
      // Release a pending get-ready gate so the async runner can unwind.
      const s = startLiftRef.current;
      if (s) { startLiftRef.current = null; s.res(false); }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set, exerciseIdx]);

  useEffect(() => () => flowTimers.current.forEach(clearTimeout), []);

  const handlePauseToggle = () => {
    setPaused(p => {
      const next = !p;
      if (next) { cancelSpeech(); setAnnouncer('Paused'); }
      else setAnnouncer('Go!');
      return next;
    });
  };

  // Auto-pause when the app is backgrounded (honest pause). No integrity session
  // in the builder, so nothing to un-flag.
  useAutoPauseOnHidden(!paused, () => { if (!paused) handlePauseToggle(); });

  const handleDoneEarly = () => {
    // Weighted / hold sets can be finished before the window runs out —
    // goes through the normal set-complete path (including the rest).
    // Gate BEFORE the version bump: a repeat tap must be a pure no-op, or it
    // would invalidate the in-flight completion it is impatiently waiting on.
    if (finishingRef.current) return;
    const version = ++versionRef.current;
    cancelSpeech();
    finishSet(version);
  };

  const handleSkipSet = () => {
    if (finishingRef.current) return;
    // Jump straight to the next set (also serves as SKIP REST) — no rest replay.
    // Skipping a weighted rest still banks the shown weight (fully skippable
    // means the logger never blocks — not that the number is lost).
    if (phase === 'rest' && plan.kind === 'weighted') saveLoggedWeight(set);
    if (set >= totalSets) finishingRef.current = true;
    invalidate();
    cancelSpeech();
    if (set < totalSets) {
      setSet(s => s + 1);
      setPhase('intro');
      setDisplay(0);
    } else {
      finishExercise();
    }
  };

  const handleBack = () => {
    versionRef.current++;
    cancelSpeech();
    onBack();
  };

  // SKIP the whole exercise → next one, WITHOUT completing it (never counts as
  // done). Voice announces the skip target.
  const handleSkipExercise = () => {
    versionRef.current++;
    cancelSpeech();
    if (voiceOn) speakAsync(nextExercise ? `Skipping to ${nextExercise.name}.` : 'Skipping.');
    onSkipExercise?.();
  };

  // 3b REWIND — mirror of SKIP: step BACK. Within an exercise it replays the
  // previous SET; on set 1 it goes back to the previous EXERCISE (re-announced
  // on arrival). A rewound exercise that's then finished still counts normally.
  const handleRewind = () => {
    versionRef.current++;
    cancelSpeech();
    if (set > 1) {
      setSet(s => s - 1);
      setPhase('intro');
      setDisplay(0);
      return;
    }
    const prev = exercises[exerciseIdx - 1];
    if (voiceOn && prev) speakAsync(`Back to ${prev.name}.`);
    onRewindExercise?.();
  };

  // STOP → shared "End session?" confirm (matches FightFocusTimer /
  // CampFitSetRunner). Confirm ends the whole workout to the summary; cancel
  // closes and the session keeps running.
  const handleStopConfirm = () => {
    versionRef.current++;
    cancelSpeech();
    setConfirmEnd(false);
    onStop?.();
  };

  // Design 39 — START — LIFT dismisses the get-ready gate.
  const handleStartLift = () => {
    const s = startLiftRef.current;
    if (s) { startLiftRef.current = null; s.res(true); }
  };
  const bumpReady = (d) => { setChangeWtOpen(true); setReadyWeight(w => Math.max(wStep, w + d)); };

  // ── WORKOUT MAP open / close (spec 2) ─────────────────────────────────────
  const openMap = useCallback(() => {
    if (mapOpen) return;
    // Opening pauses the workout; remember whether it was actually running so
    // closing only auto-resumes what the map itself paused.
    wasRunningRef.current = !pausedRef.current && phase !== 'done';
    if (!pausedRef.current) { cancelSpeech(); setPaused(true); }
    setAnnouncer('Paused — map open');
    setMapMode('normal');
    setMapOpen(true);
  }, [mapOpen, phase]);

  const clearGesture = useCallback(() => {
    const g = gestRef.current;
    if (g) { clearTimeout(g.holdTimer); clearTimeout(g.chargeTimer); }
    gestRef.current = null;
    setGest(null);
  }, []);

  // Closing the sheet. Normal mode: auto-resume with a 3-2-1 count (spec 2).
  // Complete mode: any close starts the glowing exercise — swipe down, ✕ or
  // backdrop all mean "go" (spec 6).
  const closeMap = useCallback(async () => {
    setMapOpen(false);
    clearGesture();
    if (mapMode === 'complete') {
      const target = glowIdx;
      setMapMode('normal');
      if (target == null) { onFinishWorkout?.(); return; }
      await countIn();
      onJumpExercise?.(target);
      return;
    }
    if (wasRunningRef.current) {
      wasRunningRef.current = false;
      await countIn();
      setPaused(false);
      setAnnouncer('Go!');
    }
  }, [mapMode, glowIdx, countIn, onJumpExercise, onFinishWorkout, clearGesture]);

  // Hold-to-start success (spec 4): haptic, collapse, 3-2-1, start. Holding the
  // CURRENT row is simply "resume here".
  const startFromRow = useCallback(async (idx) => {
    try { navigator.vibrate?.(30); } catch { /* no haptics */ }
    setMapOpen(false);
    setMapMode('normal');
    clearGesture();
    await countIn();
    if (idx === exerciseIdx && phase !== 'done') {
      wasRunningRef.current = false;
      setPaused(false);
      setAnnouncer('Go!');
      return;
    }
    onJumpExercise?.(idx);
  }, [exerciseIdx, phase, countIn, onJumpExercise, clearGesture]);

  // ── Row gesture engine (spec 8) — one hold, three outcomes ────────────────
  // pointerdown arms a 250ms hold. Movement before it fires = native scroll.
  // Once charging: full 700ms = start · horizontal >8px = skip-swipe ·
  // vertical >8px = reorder drag. First axis to win owns the gesture.
  const [gest, setGest] = useState(null); // {idx, mode, dx, dy, slot, width}
  const gestRef = useRef(null);
  const rowRefs = useRef({});
  const listRef = useRef(null);
  const dragMeta = useRef(null); // {centers:[{idx,cy}], startTop, height, from}

  // Native scroll must keep working when idle, so rows stay `touch-action:
  // pan-y` and we only block scrolling while a gesture is engaged.
  useEffect(() => {
    const el = listRef.current;
    if (!el || !mapOpen) return undefined;
    const h = (e) => { const g = gestRef.current; if (g && g.mode !== 'pending') e.preventDefault(); };
    el.addEventListener('touchmove', h, { passive: false });
    return () => el.removeEventListener('touchmove', h);
  }, [mapOpen]);

  const engageCharge = useCallback((idx) => {
    const row = rowRefs.current[idx];
    const g = gestRef.current;
    if (!g) return;
    g.mode = 'charge';
    g.chargeTimer = setTimeout(() => {
      const cur = gestRef.current;
      if (cur && cur.idx === idx && cur.mode === 'charge') startFromRow(idx);
    }, CHARGE_MS);
    setGest({ idx, mode: 'charge', dx: 0, dy: 0, width: row?.offsetWidth || 300 });
  }, [startFromRow]);

  const beginDrag = useCallback((idx) => {
    const g = gestRef.current;
    if (!g) return;
    clearTimeout(g.chargeTimer);
    g.mode = 'drag';
    const list = listRef.current;
    const row = rowRefs.current[idx];
    const listTop = list?.getBoundingClientRect().top || 0;
    const r = row?.getBoundingClientRect();
    const centers = [];
    exercises.forEach((_, i) => {
      const st = statusOf(i);
      if (i !== idx && (st === 'now' || st === 'todo')) {
        const rr = rowRefs.current[i]?.getBoundingClientRect();
        if (rr) centers.push({ idx: i, cy: rr.top + rr.height / 2 });
      }
    });
    centers.sort((a, b) => a.cy - b.cy);
    dragMeta.current = {
      centers,
      startTop: (r?.top || 0) - listTop + (list?.scrollTop || 0),
      startCenter: (r?.top || 0) + (r?.height || 52) / 2,
      height: r?.height || 52,
      from: idx,
    };
    const initSlot = centers.filter(c => c.cy < (r?.top || 0) + (r?.height || 52) / 2).length;
    g.dy = 0; g.slot = initSlot;
    setGest({ idx, mode: 'drag', dx: 0, dy: 0, slot: initSlot, width: row?.offsetWidth || 300 });
  }, [exercises, statusOf]);

  const rowPointerDown = useCallback((e, idx) => {
    const st = statusOf(idx);
    if (st === 'done') return;               // locked — no gestures at all
    if (gestRef.current) clearGesture();
    const g = { idx, mode: 'pending', x0: e.clientX, y0: e.clientY, pointerId: e.pointerId };
    g.holdTimer = setTimeout(() => {
      if (gestRef.current === g && g.mode === 'pending') engageCharge(idx);
    }, HOLD_MS);
    gestRef.current = g;
  }, [statusOf, engageCharge, clearGesture]);

  const rowPointerMove = useCallback((e, idx) => {
    const g = gestRef.current;
    if (!g || g.idx !== idx) return;
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    if (g.mode === 'pending') {
      // Moved before the hold matured → this is a scroll, not a gesture.
      if (Math.abs(dx) > MOVE_SLOP || Math.abs(dy) > MOVE_SLOP) { clearTimeout(g.holdTimer); gestRef.current = null; }
      return;
    }
    if (g.mode === 'charge') {
      if (Math.abs(dx) > MOVE_SLOP && Math.abs(dx) > Math.abs(dy)) {
        // Horizontal wins → skip-swipe (skipped rows are already skipped).
        clearTimeout(g.chargeTimer);
        if (statusOf(idx) === 'skipped') { clearGesture(); return; }
        g.mode = 'swipe';
        g.dx = dx;
        setGest({ idx, mode: 'swipe', dx, dy: 0, width: rowRefs.current[idx]?.offsetWidth || 300 });
      } else if (Math.abs(dy) > MOVE_SLOP) {
        // Vertical wins → reorder drag; skipped rows are pinned (spec 7).
        const st = statusOf(idx);
        if (st !== 'now' && st !== 'todo') { clearTimeout(g.chargeTimer); clearGesture(); return; }
        beginDrag(idx);
      }
      return;
    }
    if (g.mode === 'swipe') { g.dx = dx; setGest(s => (s ? { ...s, dx } : s)); return; }
    if (g.mode === 'drag') {
      const m = dragMeta.current;
      if (!m) return;
      const cy = m.startCenter + dy;
      const slot = m.centers.filter(c => c.cy < cy).length;
      g.dy = dy; g.slot = slot;
      setGest(s => (s ? { ...s, dy, slot } : s));
    }
  }, [statusOf, beginDrag, clearGesture]);

  const rowPointerUp = useCallback((idx) => {
    const g = gestRef.current;
    if (!g || g.idx !== idx) return;
    if (g.mode === 'pending') { clearTimeout(g.holdTimer); gestRef.current = null; return; }
    if (g.mode === 'charge') {
      // Released early — the charge drains back (spec 4).
      clearTimeout(g.chargeTimer);
      gestRef.current = null;
      setGest({ idx, mode: 'drain' });
      setTimeout(() => setGest(s => (s?.mode === 'drain' ? null : s)), 260);
      return;
    }
    if (g.mode === 'swipe') {
      const width = rowRefs.current[idx]?.offsetWidth || 300;
      // Commit reads the REF, not state — the state closure can trail the
      // final pointermove by one event.
      const commit = Math.abs(g.dx ?? 0) > width * SKIP_FRACTION;
      clearGesture();
      if (commit) {
        try { navigator.vibrate?.(20); } catch { /* no haptics */ }
        onMarkSkipped?.(idx);
      }
      return;
    }
    if (g.mode === 'drag') {
      const slot = g.slot ?? 0;
      const from = idx;
      clearGesture();
      const order = weaveOrder(exercises.length, (i) => { const st = statusOf(i); return st === 'done' || st === 'skipped'; }, from, slot);
      // No-op drops don't round-trip through the parent.
      if (order.some((o, i2) => o !== i2)) onReorder?.(order);
    }
  }, [statusOf, exercises.length, onMarkSkipped, onReorder, clearGesture]);

  // Move/up are delegated to window while the map is open: a drag re-renders
  // its row as the DROP placeholder, which would destroy per-row handlers
  // mid-gesture (the drag froze exactly like that in testing). The window
  // listeners survive any re-render; pointerId keeps them on our gesture.
  useEffect(() => {
    if (!mapOpen) return undefined;
    const move = (e) => { const g = gestRef.current; if (g && e.pointerId === g.pointerId) rowPointerMove(e, g.idx); };
    const up = (e) => { const g = gestRef.current; if (g && e.pointerId === g.pointerId) rowPointerUp(g.idx); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [mapOpen, rowPointerMove, rowPointerUp]);

  const kindLabel = plan.kind === 'reps' ? `${plan.reps} REPS · ON THE COUNT`
    : plan.kind === 'weighted' ? `${plan.reps} REPS · ${fmtClock(plan.windowSec)} WINDOW`
    : `${plan.seconds}s HOLD`;

  const controls = (
    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 360 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {/* 3b — REWIND: previous set, or previous exercise from set 1 */}
        <button onClick={handleRewind} disabled={set === 1 && exerciseIdx === 0} aria-label="Previous" style={{ width: 52, height: 48, borderRadius: 11, cursor: (set === 1 && exerciseIdx === 0) ? 'not-allowed' : 'pointer', background: 'rgba(16,4,30,0.85)', border: '1.5px solid rgba(168,85,247,0.4)', opacity: (set === 1 && exerciseIdx === 0) ? 0.4 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <RotateCcw size={17} color={VIOLET}/>
        </button>
        <button onClick={handlePauseToggle} aria-label={paused ? 'Resume' : 'Pause'} style={{ width: 52, height: 48, borderRadius: 11, cursor: 'pointer', background: paused ? 'rgba(253,224,71,0.14)' : 'rgba(16,4,30,0.85)', border: `1.5px solid ${paused ? GOLD : 'rgba(168,85,247,0.4)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {paused ? <Play size={18} color={GOLD}/> : <Pause size={18} color="#e6d4ff"/>}
        </button>
        {(plan.kind !== 'reps' && phase === 'active') ? (
          <button onClick={handleDoneEarly} style={{ flex: 1, height: 48, borderRadius: 11, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg, ${GOLD}, #f59e0b)`, color: '#0a0014', fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 12, letterSpacing: '0.1em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: '0 0 16px rgba(253,224,71,0.35)' }}>
            <Check size={16} strokeWidth={3}/> SET DONE
          </button>
        ) : (
          <button onClick={handleSkipSet} style={{ flex: 1, height: 48, borderRadius: 11, cursor: 'pointer', background: 'rgba(16,4,30,0.85)', border: '1px solid rgba(168,85,247,0.35)', color: '#d9d1ef', fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 11, letterSpacing: '0.1em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
            <SkipForward size={15} color={VIOLET}/> {phase === 'rest' ? 'SKIP REST' : 'SKIP SET'}
          </button>
        )}
      </div>
      {/* Item 3 SKIP EXERCISE (never completes it) · Item 2 STOP (confirm → end) */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handleSkipExercise} style={{ flex: 1, height: 40, borderRadius: 11, cursor: 'pointer', background: 'rgba(16,4,30,0.7)', border: '1px solid rgba(168,85,247,0.3)', color: '#c9a6ff', fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 10, letterSpacing: '0.08em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <ChevronsRight size={15} color={VIOLET}/> SKIP EXERCISE
        </button>
        <button onClick={() => setConfirmEnd(true)} style={{ flex: 1, height: 40, borderRadius: 11, cursor: 'pointer', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.4)', color: '#ff8a8a', fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 10, letterSpacing: '0.08em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Square size={12}/> STOP
        </button>
      </div>
    </div>
  );

  // ── Map sheet rendering ───────────────────────────────────────────────────
  // During a drag the list renders in the PREVIEW order with a dashed gold
  // "DROP HERE · SLOT n" placeholder where the row will land (spec 7).
  const dragging = gest?.mode === 'drag';
  const previewOrder = dragging
    ? weaveOrder(exercises.length, (i) => { const st = statusOf(i); return st === 'done' || st === 'skipped'; }, gest.idx, gest.slot ?? 0)
    : exercises.map((_, i) => i);
  const dropSlotNumber = dragging ? previewOrder.indexOf(gest.idx) + 1 : 0;

  const mapRow = (i) => {
    const e2 = exercises[i];
    const st = statusOf(i);
    const nSets = e2.sets || 3;
    const isGlow = mapMode === 'complete' && i === glowIdx;
    const locked = st === 'done' || st === 'skipped';
    const g = gest && gest.idx === i ? gest : null;
    const charging = g?.mode === 'charge';
    const draining = g?.mode === 'drain';
    const swiping = g?.mode === 'swipe';

    // The dragged row renders as the drop placeholder in its preview slot.
    if (dragging && i === gest.idx) {
      return (
        <div key={`drop-${i}`} style={{ boxSizing: 'border-box', height: 52, borderRadius: 9, border: `2px dashed ${GOLD}`, background: 'rgba(253,224,71,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 8.5, fontWeight: 800, color: GOLD, letterSpacing: '0.14em' }}>DROP HERE · SLOT {dropSlotNumber}</span>
        </div>
      );
    }

    return (
      <div key={e2._uid || i} style={{ position: 'relative', borderRadius: 9, overflow: 'hidden' }}>
        {/* Red SKIP backing revealed by the swipe (spec 5) */}
        {swiping && (
          <div style={{ position: 'absolute', inset: 0, borderRadius: 9, background: 'rgba(239,68,68,0.22)', border: '1px solid rgba(239,68,68,0.5)', display: 'flex', alignItems: 'center', justifyContent: (gest.dx ?? 0) < 0 ? 'flex-end' : 'flex-start', padding: '0 14px' }}>
            <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 9, fontWeight: 900, color: '#ff8a8a', letterSpacing: '0.14em' }}>SKIP ⇥</span>
          </div>
        )}
        <div
          ref={(el) => { rowRefs.current[i] = el; }}
          onPointerDown={(e) => rowPointerDown(e, i)}
          className={isGlow ? 'wm-glow' : undefined}
          style={{
            position: 'relative', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', borderRadius: 9,
            boxSizing: 'border-box', minHeight: 52, touchAction: 'pan-y', userSelect: 'none', WebkitUserSelect: 'none',
            background: isGlow ? 'linear-gradient(135deg, rgba(253,224,71,0.12), rgba(168,85,247,0.08))' : st === 'now' ? 'rgba(168,85,247,0.13)' : '#1a0a2e',
            border: isGlow ? `2px solid ${GOLD}` : st === 'now' ? `1.5px solid ${VIOLET}` : '1px solid rgba(255,255,255,0.06)',
            opacity: dragging && locked ? 0.55 : locked && !isGlow ? 0.78 : 1,
            transform: swiping ? `translateX(${gest.dx}px)` : 'none',
            transition: swiping ? 'none' : 'transform 0.2s ease, opacity 0.2s ease',
            cursor: st === 'done' ? 'default' : 'grab',
          }}
        >
          {/* Charge fill — violet→gold sweep with a glowing leading edge (spec 4) */}
          {(charging || draining) && (
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: charging ? '100%' : '0%', transition: `width ${charging ? CHARGE_MS : 220}ms linear`, background: `linear-gradient(90deg, ${VIOLET}55, ${GOLD}66)`, boxShadow: `inset -6px 0 12px ${GOLD}80`, pointerEvents: 'none' }}/>
          )}
          <span style={{ width: 22, textAlign: 'right', flexShrink: 0, fontFamily: "'Orbitron',sans-serif", fontSize: 9, fontWeight: 800, color: st === 'now' ? '#c9a6ff' : C.faint, position: 'relative' }}>
            {locked ? '🔒' : (st === 'now' || st === 'todo') ? '≡' : ''}{previewOrder.indexOf(i) + 1}
          </span>
          <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
            <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '0.03em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: st === 'now' || isGlow ? '#fff' : st === 'done' ? '#e8dcc8' : C.muted, textDecoration: st === 'skipped' ? 'line-through' : 'none' }}>{e2.name}</div>
            <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 10, fontWeight: 600, color: C.faint, marginTop: 1 }}>{nSets}×{e2.reps} · rest {e2.restSeconds || parseInt(e2.rest) || 60}s</div>
          </div>
          <div style={{ position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
            {charging ? (
              <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 8, fontWeight: 900, color: GOLD, letterSpacing: '0.1em' }}>HOLD… ⚡</span>
            ) : isGlow ? (
              <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 8, fontWeight: 900, color: '#0a0014', letterSpacing: '0.08em', background: GOLD, borderRadius: 6, padding: '4px 8px', boxShadow: '0 0 12px rgba(253,224,71,0.5)' }}>▶ NEXT</span>
            ) : st === 'now' ? (
              <>
                {Array.from({ length: nSets }, (_, s2) => (
                  <span key={s2} style={{ width: 7, height: 7, borderRadius: 4, background: s2 < set - 1 ? GOLD : 'transparent', border: `1.5px solid ${s2 === set - 1 ? GOLD : 'rgba(255,255,255,0.25)'}` }}/>
                ))}
                <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 7.5, fontWeight: 800, color: GOLD, marginLeft: 3, letterSpacing: '0.08em' }}>SET {set}/{nSets}</span>
              </>
            ) : st === 'done' ? (
              <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 8, fontWeight: 800, color: GOLD, letterSpacing: '0.1em' }}>✓ DONE{justDoneIdx === i ? ' · just now' : ''}</span>
            ) : st === 'skipped' ? (
              <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 8, fontWeight: 800, color: '#ff8a8a', letterSpacing: '0.1em' }}>SKIPPED</span>
            ) : (
              <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 8, fontWeight: 700, color: C.faint, letterSpacing: '0.1em' }}>{i === exerciseIdx + 1 ? 'UP NEXT' : 'QUEUED'}</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Floating copy of the dragged row (lifted look: gold border, tilt, shadow).
  const dragFloat = dragging && dragMeta.current ? (
    <div style={{ position: 'absolute', left: 12, right: 12, top: dragMeta.current.startTop + (gest.dy ?? 0), zIndex: 5, pointerEvents: 'none', borderRadius: 9, border: `2px solid ${GOLD}`, background: '#241640', boxShadow: '0 14px 34px rgba(0,0,0,0.7)', transform: 'rotate(1.5deg)', padding: '9px 11px', display: 'flex', alignItems: 'center', gap: 10, minHeight: 52, boxSizing: 'border-box' }}>
      <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 9, fontWeight: 800, color: GOLD }}>≡</span>
      <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 10, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{exercises[gest.idx]?.name}</div>
    </div>
  ) : null;

  // Sheet header swipe-down → close (grab handle region).
  const sheetDown = useRef(null);
  const headerPointerDown = (e) => { sheetDown.current = { y0: e.clientY }; };
  const headerPointerMove = (e) => {
    const s = sheetDown.current;
    if (s && e.clientY - s.y0 > 80) { sheetDown.current = null; closeMap(); }
  };
  const headerPointerUp = () => { sheetDown.current = null; };

  // Binder tab swipe-up → open.
  const tabDown = useRef(null);
  const tabPointerDown = (e) => { tabDown.current = { y0: e.clientY }; };
  const tabPointerMove = (e) => {
    const t = tabDown.current;
    if (t && t.y0 - e.clientY > 18) { tabDown.current = null; openMap(); }
  };
  const tabPointerUp = () => { tabDown.current = null; };

  return (
    <PhoneFrame useBrandBg>
      <Embers count={2}/>
      <VoiceMixer top={10} right={10}/>
      <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', height: '100dvh', boxSizing: 'border-box', overflow: 'hidden' }}>
        {/* Training Mode logo header — back arrow returns to the list */}
        <TrainingHeader
          title="GUIDED WORKOUT"
          subtitle={`Exercise ${exerciseIdx + 1} of ${exercises.length} · any order — open the map`}
          showBack
          onBack={handleBack}
          onHome={handleBack}
        />

        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '8px 16px calc(max(120px, 18dvh) + env(safe-area-inset-bottom, 0px))' }}>
          {/* Progress — one segment per exercise (✓ gold, skipped red, current
              fills set by set), tappable to open the workout map. */}
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 8, color: C.faint, letterSpacing: '0.12em' }}>EXERCISE {exerciseIdx + 1}/{exercises.length}</span>
            <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 8, color: GOLD, letterSpacing: '0.1em' }}>SET {set}/{totalSets}</span>
          </div>
          <div role="button" aria-label="Open workout map" onClick={openMap} style={{ flexShrink: 0, display: 'flex', gap: 3, marginBottom: 12, cursor: 'pointer', padding: '2px 0' }}>
            {exercises.map((_, i) => {
              const st = statusOf(i);
              const setFill = Math.max(0.08, (set - 1 + (phase === 'rest' ? 1 : 0)) / totalSets);
              return (
                <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, overflow: 'hidden', background: st === 'done' ? GOLD : st === 'skipped' ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.08)', boxShadow: st === 'now' ? '0 0 8px rgba(168,85,247,0.6)' : 'none' }}>
                  {st === 'now' && (
                    <div style={{ width: `${setFill * 100}%`, height: '100%', background: `linear-gradient(90deg, ${VIOLET}, ${GOLD})`, transition: 'width 0.4s ease' }}/>
                  )}
                </div>
              );
            })}
          </div>

          {/* Centre: display + announcer + controls (kept high, no scroll) */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, textAlign: 'center' }}>
            <div>
              <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 19, color: '#fff', letterSpacing: '0.04em', marginBottom: 4 }}>{ex.name}</div>
              <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 8.5, color: VIOLET, letterSpacing: '0.14em' }}>{ex.muscle} · {kindLabel}</div>
            </div>

            {phase === 'done' ? (
              <div>
                <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 54, color: GOLD, lineHeight: 1, textShadow: '0 0 24px rgba(253,224,71,0.55)' }}>✓</div>
                <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 10, color: GOLD, letterSpacing: '0.18em', marginTop: 10 }}>EXERCISE COMPLETE</div>
              </div>
            ) : phase === 'getready' ? (
              <div>
                <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 10, color: '#c9a6ff', letterSpacing: '0.22em', marginBottom: 8 }}>NEXT UP · SET 1 OF {totalSets}</div>
                <div style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 13, color: '#c4a4d8', marginBottom: 14 }}>{totalSets} sets · {plan.reps} reps</div>
                <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 9, color: GOLD, letterSpacing: '0.2em', marginBottom: 2 }}>LOAD</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: changeWtOpen ? 14 : 0 }}>
                  {changeWtOpen && <button onClick={() => bumpReady(-wStep)} aria-label="Less weight" style={{ width: 44, height: 44, borderRadius: '50%', cursor: 'pointer', background: 'rgba(168,85,247,0.08)', border: '1.5px solid rgba(168,85,247,0.5)', color: '#c9a6ff', fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 18 }}>−</button>}
                  <div style={{ lineHeight: 1 }}>
                    <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 44, color: GOLD, textShadow: '0 0 24px rgba(253,224,71,0.55)' }}>{readyWeight}</span>
                    <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 18, color: '#fff', marginLeft: 6 }}>{weightUnit}</span>
                  </div>
                  {changeWtOpen && <button onClick={() => bumpReady(wStep)} aria-label="More weight" style={{ width: 44, height: 44, borderRadius: '50%', cursor: 'pointer', background: 'rgba(168,85,247,0.08)', border: '1.5px solid rgba(168,85,247,0.5)', color: '#c9a6ff', fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 18 }}>＋</button>}
                </div>
                {/* Spec 11 — the progression story under the number. */}
                {prevWeight && progRef.current?.state === 'nudge' && progRef.current.suggested > prevWeight.weight ? (
                  <div style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 9.5, marginTop: 8 }}>
                    <span style={{ color: '#c4a4d8' }}>LAST TIME </span>
                    <span style={{ color: '#fff', fontWeight: 700 }}>{prevWeight.weight} {weightUnit}</span>
                    <span style={{ color: GOLD, fontWeight: 800 }}> → SUGGESTED {progRef.current.suggested}</span>
                    <span style={{ color: '#9a90b8' }}> · pre-loaded above</span>
                  </div>
                ) : prevWeight ? (
                  <div style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 11, color: '#9a90b8', marginTop: 8 }}>last time: {prevWeight.weight} {weightUnit}</div>
                ) : null}
                {progRef.current?.isPR && (
                  <div style={{
                    marginTop: 8, width: 264, maxWidth: '86vw', marginLeft: 'auto', marginRight: 'auto',
                    borderRadius: 10, border: '1px solid rgba(253,224,71,0.55)',
                    background: 'linear-gradient(90deg, rgba(253,224,71,0.16), rgba(245,158,11,0.12))',
                    padding: '7px 10px', fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 9, color: GOLD, letterSpacing: '0.06em',
                  }}>🏆 PR ATTEMPT — YOUR BEST IS {progRef.current.best}</div>
                )}
              </div>
            ) : phase === 'position' ? (
              <div>
                <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 10, color: '#f97316', letterSpacing: '0.18em', marginBottom: 6 }}>GET INTO POSITION</div>
                <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 54, color: '#f97316', lineHeight: 1, textShadow: '0 0 18px rgba(249,115,22,0.5)' }}>{display || 5}</div>
              </div>
            ) : phase === 'rest' ? (
              <div>
                <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 10, color: '#4a7dff', letterSpacing: '0.18em', marginBottom: 6 }}>REST</div>
                <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 54, color: '#fff', lineHeight: 1, textShadow: '0 0 14px rgba(74,125,255,0.4)' }}>{fmtClock(display)}</div>

                {/* 38a — optional weight logger for the set that just finished.
                    Never blocks rest: save it, tweak it, or ignore it (the
                    shown value auto-saves when rest runs out). */}
                {plan.kind === 'weighted' && (
                  <div style={{ marginTop: 14, width: 264, maxWidth: '86vw', marginLeft: 'auto', marginRight: 'auto', borderRadius: 12, border: `1px solid ${logSaved ? 'rgba(34,197,94,0.5)' : 'rgba(168,85,247,0.35)'}`, background: 'rgba(10,2,20,0.82)', padding: '9px 11px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 8, color: GOLD, letterSpacing: '0.12em' }}>LOG SET {set} · WEIGHT USED</span>
                      <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 9, color: 'rgba(200,170,255,0.55)' }}>optional</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                      <button onClick={() => { setLogWeight(w => Math.max(0, w - 5)); setLogSaved(false); }} aria-label="Decrease weight" style={{ width: 34, height: 34, borderRadius: 8, cursor: 'pointer', background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.35)', color: VIOLET, fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 15 }}>−</button>
                      <div style={{ minWidth: 92, textAlign: 'center' }}>
                        <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 27, color: '#fff' }}>{logWeight}</span>
                        <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 11, color: GOLD, marginLeft: 4 }}>{weightUnit}</span>
                      </div>
                      <button onClick={() => { setLogWeight(w => w + 5); setLogSaved(false); }} aria-label="Increase weight" style={{ width: 34, height: 34, borderRadius: 8, cursor: 'pointer', background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.35)', color: VIOLET, fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 15 }}>＋</button>
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      {[-5, 5, 10].map(d => (
                        <button key={d} onClick={() => { setLogWeight(w => Math.max(0, w + d)); setLogSaved(false); }} style={{ flex: 1, padding: '6px 0', borderRadius: 7, cursor: 'pointer', background: 'rgba(16,4,30,0.85)', border: '1px solid rgba(168,85,247,0.3)', color: '#d9d1ef', fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 9 }}>{d > 0 ? `+${d}` : d}</button>
                      ))}
                      <button onClick={() => { setLogSaved(false); saveLoggedWeight(set); }} style={{ flex: 1.4, padding: '6px 0', borderRadius: 7, cursor: 'pointer', background: logSaved ? 'rgba(34,197,94,0.16)' : `linear-gradient(135deg, ${GOLD}, #f59e0b)`, border: logSaved ? '1px solid rgba(34,197,94,0.55)' : 'none', color: logSaved ? '#4ade80' : '#0a0014', fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 9, letterSpacing: '0.06em' }}>{logSaved ? '✓ SAVED' : '✓ SAVE'}</button>
                    </div>
                  </div>
                )}
              </div>
            ) : plan.kind === 'reps' ? (
              <div style={{ lineHeight: 1 }}>
                <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 62, color: GOLD, textShadow: '0 0 20px rgba(253,224,71,0.5)' }}>{display}</span>
                <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 24, color: 'rgba(230,215,255,0.45)' }}>/{plan.reps}</span>
              </div>
            ) : (
              <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 54, color: phase === 'active' ? GOLD : '#fff', lineHeight: 1, textShadow: '0 0 20px rgba(253,224,71,0.45)' }}>
                {fmtClock(display)}
              </div>
            )}

            {/* Announcer */}
            <div style={{ minHeight: 28, maxWidth: 320, padding: '6px 14px', borderRadius: 9, background: 'rgba(10,0,20,0.72)', border: '1px solid rgba(168,85,247,0.2)', fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 12, color: paused ? GOLD : '#e7ddf7' }}>
              {announcer}
            </div>

            {/* Controls — get-ready shows CHANGE WT + START — LIFT (design 39) */}
            {phase === 'done' ? null : phase === 'getready' ? (
              <div style={{ flexShrink: 0, display: 'flex', gap: 8, width: '100%', maxWidth: 360 }}>
                <button onClick={() => setChangeWtOpen(o => !o)} style={{ flex: '0 0 124px', height: 48, borderRadius: 11, cursor: 'pointer', background: changeWtOpen ? 'rgba(168,85,247,0.16)' : 'rgba(16,4,30,0.85)', border: `1.5px solid ${changeWtOpen ? '#a855f7' : 'rgba(168,85,247,0.4)'}`, color: '#c9a6ff', fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 11, letterSpacing: '0.08em' }}>CHANGE WT</button>
                <button onClick={handleStartLift} style={{ flex: 1, height: 48, borderRadius: 11, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg, ${GOLD}, #f59e0b)`, color: '#0a0014', fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 12, letterSpacing: '0.08em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: '0 0 16px rgba(253,224,71,0.35)' }}>
                  <Play size={15}/> START — LIFT
                </button>
              </div>
            ) : controls}
          </div>

          {/* Cadence slider (rep-counted sets only) */}
          {plan.kind === 'reps' && phase !== 'done' && (
            <div style={{ flexShrink: 0, marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 7, fontWeight: 700, color: C.faint, letterSpacing: '0.14em' }}>CADENCE</span>
                <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 8.5, fontWeight: 700, color: GOLD }}>{cadenceSec.toFixed(2)}s / rep</span>
              </div>
              <input type="range" min={1} max={4} step={0.25} value={cadenceSec} onChange={e => setCadenceSec(Number(e.target.value))}
                style={{ width: '100%', height: 5, borderRadius: 999, outline: 'none', background: `linear-gradient(90deg, ${VIOLET} 0%, ${GOLD} ${((cadenceSec - 1) / 3) * 100}%, rgba(255,255,255,0.08) ${((cadenceSec - 1) / 3) * 100}%)`, cursor: 'pointer' }}/>
            </div>
          )}

          {/* Workout strip — every exercise as a swipeable card (browse back and
              ahead without leaving the workout); the current one stays centred. */}
          <div style={{ flexShrink: 0, marginTop: 8, display: 'flex', gap: 6, overflowX: 'auto', scrollSnapType: 'x proximity', WebkitOverflowScrolling: 'touch', paddingBottom: 2, scrollbarWidth: 'none' }}>
            {exercises.map((e2, i) => {
              const st = statusOf(i);
              const label = st === 'now' ? `● SET ${set}/${totalSets}`
                : st === 'done' ? '✓ DONE'
                : st === 'skipped' ? 'SKIPPED'
                : i === exerciseIdx + 1 ? 'UP NEXT ▶' : `#${i + 1}`;
              return (
                <div key={e2._uid || i} ref={st === 'now' ? curCardRef : null} onClick={openMap} style={{
                  flexShrink: 0, scrollSnapAlign: 'center', width: 124, boxSizing: 'border-box', padding: '6px 9px', borderRadius: 9, cursor: 'pointer',
                  background: st === 'now' ? 'rgba(168,85,247,0.14)' : 'rgba(10,0,20,0.6)',
                  border: st === 'now' ? `1.5px solid ${VIOLET}` : st === 'done' ? '1px solid rgba(253,224,71,0.4)' : st === 'skipped' ? '1px solid rgba(239,68,68,0.35)' : '1px solid rgba(255,255,255,0.07)',
                  opacity: st === 'done' || st === 'skipped' ? 0.72 : 1,
                }}>
                  <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 6.5, fontWeight: 800, letterSpacing: '0.12em', marginBottom: 2, color: st === 'now' ? '#c9a6ff' : st === 'done' ? GOLD : st === 'skipped' ? '#ff8a8a' : C.faint }}>{label}</div>
                  <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 8.5, fontWeight: 700, color: st === 'now' ? '#fff' : C.muted, letterSpacing: '0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e2.name}</div>
                  <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 9, fontWeight: 600, color: C.faint, marginTop: 1 }}>{e2.sets}×{e2.reps}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Spec 6 — per-exercise DONE toast with the exact XP the summary banks */}
      {toast && (
        <div style={{ position: 'fixed', ...fixedColumnBar, top: 66, zIndex: 130, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ borderRadius: 11, border: `1.5px solid ${GOLD}`, background: 'rgba(14,5,26,0.97)', boxShadow: '0 0 24px rgba(253,224,71,0.35)', padding: '10px 16px', fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 10, color: GOLD, letterSpacing: '0.08em' }}>
            ✓ {toast.name.toUpperCase()} — DONE · +{toast.xp} XP
          </div>
        </div>
      )}

      {/* Spec 2 — binder tab: the map's permanent handle above the tab bar */}
      {!mapOpen && (
        <div
          role="button"
          aria-label="Open workout map"
          onClick={openMap}
          onPointerDown={tabPointerDown}
          onPointerMove={tabPointerMove}
          onPointerUp={tabPointerUp}
          style={{
            position: 'fixed', ...fixedColumnBar, bottom: 'calc(58px + env(safe-area-inset-bottom, 0px))', zIndex: 110,
            height: 52, boxSizing: 'border-box', cursor: 'pointer', touchAction: 'none',
            background: 'rgba(14,5,26,0.97)', border: `1.5px solid ${VIOLET}66`, borderBottom: 'none',
            borderRadius: '14px 14px 0 0', boxShadow: '0 -6px 22px rgba(88,28,135,0.35)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}
        >
          <div style={{ width: 44, height: 4, borderRadius: 999, background: 'rgba(168,85,247,0.55)' }}/>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 8.5, color: '#c9a6ff', letterSpacing: '0.1em' }}>
            ≡ WORKOUT MAP · <span style={{ color: C.faint, fontWeight: 700 }}>swipe up · pauses the workout</span> · <span style={{ color: GOLD }}>{doneCount}/{exercises.length}</span>
          </div>
        </div>
      )}

      {/* Spec 3 — the WORKOUT MAP sheet. Portalled to body so it genuinely
          covers the tab bar (PhoneFrame's isolation caps in-frame z-indexes). */}
      {mapOpen && typeof document !== 'undefined' && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes wmSlideUp { from { transform: translateY(28px); opacity: 0.4; } to { transform: translateY(0); opacity: 1; } }
            @keyframes wmGlowPulse { 0%,100% { box-shadow: 0 0 10px rgba(253,224,71,0.35); } 50% { box-shadow: 0 0 22px rgba(253,224,71,0.7); } }
            .wm-glow { animation: wmGlowPulse 1.6s ease-in-out infinite; }
          ` }}/>
          <div onClick={closeMap} style={{ flex: 1, background: 'rgba(0,0,0,0.7)' }}/>
          <div style={{
            width: '100%', maxWidth: 440, margin: '0 auto', boxSizing: 'border-box', height: '90dvh',
            background: 'rgba(14,5,26,0.97)', borderRadius: '16px 16px 0 0',
            border: `1px solid ${VIOLET}66`, borderBottom: 'none',
            display: 'flex', flexDirection: 'column', animation: 'wmSlideUp 0.28s ease',
          }}>
            {/* Header: grab handle (swipe down closes → resume / start-next) */}
            <div
              onPointerDown={headerPointerDown}
              onPointerMove={headerPointerMove}
              onPointerUp={headerPointerUp}
              style={{ flexShrink: 0, padding: '8px 14px 6px', touchAction: 'none', cursor: 'grab' }}
            >
              <div style={{ width: 44, height: 4, borderRadius: 999, background: 'rgba(168,85,247,0.55)', margin: '0 auto 8px' }}/>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 13, color: '#fff', letterSpacing: '0.08em' }}>WORKOUT MAP</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 9, color: GOLD, letterSpacing: '0.08em' }}>{doneCount}/{exercises.length}</span>
                  <button onClick={closeMap} aria-label="Close map" style={{ background: 'none', border: 'none', color: '#c9a6ff', cursor: 'pointer', display: 'flex', padding: 6, margin: -6 }}>
                    <X size={18}/>
                  </button>
                </div>
              </div>
              <div style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 10.5, color: C.faint, marginTop: 4 }}>
                {mapMode === 'complete'
                  ? 'swipe down to start the glowing exercise · or hold any other row'
                  : 'any order · hold to start · hold + swipe to skip · hold + drag ↕ to reorder · done rows lock.'}
              </div>
            </div>

            {/* Rows — scrolls at 6 and at 10+ (spec 3) */}
            <div ref={listRef} data-wm-gestures="delegated" className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '6px 12px calc(16px + env(safe-area-inset-bottom, 0px))', position: 'relative' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {previewOrder.map((i) => mapRow(i))}
              </div>
              {dragFloat}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Item 2 — shared END-session confirm (matches FightFocusTimer / CampFitSetRunner) */}
      {confirmEnd && (
        <div onClick={() => setConfirmEnd(false)} style={{ position: 'absolute', inset: 0, zIndex: 200, background: 'rgba(4,0,10,0.72)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 290, background: 'rgba(16,7,32,0.96)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 15, padding: 18, textAlign: 'center' }}>
            <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 14, color: '#fff', letterSpacing: '0.06em', marginBottom: 6 }}>END SESSION?</div>
            <div style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 11, color: '#c4a4d8', marginBottom: 14 }}>You&apos;ll get credit for the exercises you finished.</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setConfirmEnd(false)} style={{ flex: 1, height: 40, borderRadius: 10, border: '1px solid rgba(168,85,247,0.35)', background: 'transparent', color: '#c9a6ff', fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 11, cursor: 'pointer' }}>KEEP GOING</button>
              <button onClick={handleStopConfirm} style={{ flex: 1, height: 40, borderRadius: 10, border: 'none', background: '#ef4444', color: '#fff', fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 11, cursor: 'pointer' }}>END</button>
            </div>
          </div>
        </div>
      )}
    </PhoneFrame>
  );
}

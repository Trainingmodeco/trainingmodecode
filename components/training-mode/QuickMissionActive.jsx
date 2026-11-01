import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import SafeImage from './SafeImage';
import PhoneFrame from './PhoneFrame';
import CornerHUD from './CornerHUD';
import VoiceMixer from './shared/VoiceMixer';
import { ChevronLeft, Pause, Play, SkipForward, Square, RotateCcw } from 'lucide-react';
import { C } from './Styles';
import useWakeLock from './hooks/useWakeLock';
import useIntegritySession from './hooks/useIntegritySession';
import useAutoPauseOnHidden from './hooks/useAutoPauseOnHidden';
import useMiniPlayer from './hooks/useMiniPlayer';
import FloatOnLeave from './shared/FloatOnLeave';
import { waitUnpaused, awaitResume } from './shared/pausableWait';
import { speakAsync, cancelSpeech, primeSpeech, stopVoiceSession, delay, setVoiceGender } from './voiceCoach';
import { playBell, playBeep, unlockAudio } from './data/audioEngine';
import { generateQuickMission } from './fit-mode/quickMissionGenerator';
import { getCoachCopy } from './data/coachCopy';
import CadenceSlider, { CADENCE_PRESETS } from './shared/CadenceSlider';
import { HelpButton } from './shared/WorkoutHelpPanel';
import ScreenGuide from './shared/ScreenGuide';
import { SCREEN_GUIDES } from './shared/screenGuides';
import { HEAD, BODY, GOLD as KIT_GOLD, MUTED as KIT_MUTED } from './shared/FitSetupKit';
import { qmV2Enabled } from './data/qmV2';
import { qmTotalUnits, qmIntegrityRules } from './data/missionSolo';
import {
  secondsPhrase, legacyDose, slotDose, isCatalogSlot, isCounted, spokenMove, speechSeconds,
  leadLine, shortRestLine, restScript, getReadySeconds, workStartLine, skipRestTarget,
  countBeats, paceBeats, nearEndUpNextAt, windowRest, swappedInLine,
} from './data/missionMoves';

const GOLD = C.yellow;

const CADENCE_SAFE_NAMES = new Set([
  'push-ups', 'pushups', 'push ups',
  'squats', 'bodyweight squats', 'air squats',
  'lunges', 'forward lunges', 'reverse lunges', 'lateral lunges', 'walking lunges',
  'sit-ups', 'situps', 'sit ups',
  'crunches', 'bicycle crunches',
  'dips', 'tricep dips',
  'jump squats', 'jumping squats', 'squat jumps',
  'glute bridges', 'hip bridges',
  'burpees',
  'sprawls',
  'mountain climbers',
  'knee push-ups',
  'explosive push-ups',
  'superman push-ups',
  'diamond push-ups',
  'wide push-ups',
  'pike push-ups',
  'decline push-ups',
  'calf raises',
  'leg raises',
  'flutter kicks',
  'high knees',
  'jumping jacks',
  'step-ups',
  'box jumps',
  'tuck jumps',
  // The focus-tagged Quick Mission pool (fit-mode/quickMissionGenerator).
  'shoulder taps', 'inchworms', 'squat thrusts', 'skater hops',
  'russian twists', 'knee strikes', 'squat to front kick', 'sprawl to jab-cross',
  'elbow strikes', 'slip and rip', 'reverse lunges', 'plank jacks',
]);

function isCadenceEligible(exercise, missionCfg) {
  if (missionCfg.cadenceCount === false) return false;
  if (exercise.mode !== 'reps') return false;
  if (missionCfg.workoutType === 'Weighted') return false;
  if (missionCfg.workoutType === 'Hybrid' && exercise.isWeighted) return false;
  const name = (exercise.name || '').toLowerCase().trim();
  return CADENCE_SAFE_NAMES.has(name);
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getNextExerciseInfo(allExercises, exIdx, round, totalRounds) {
  const nextIdx = exIdx + 1;
  if (nextIdx < allExercises.length) {
    return { exercise: allExercises[nextIdx], isNewRound: false, nextRound: round };
  }
  if (round < totalRounds) {
    return { exercise: allExercises[0], isNewRound: true, nextRound: round + 1 };
  }
  return null;
}

// What the coach says the target is: "40 seconds", "12 reps", or a named
// workout's own unit ("1 mile").
function spokenTarget(ex) {
  if (ex.mode === 'timed') return secondsPhrase(ex.work);
  if (ex.unit) return `${ex.reps} ${String(ex.unit).toLowerCase()}`;
  return `${ex.reps} reps`;
}

function getPrepMessage(workoutType) {
  if (workoutType === 'Weighted') return 'Grab your weight and prepare.';
  if (workoutType === 'Hybrid') return 'Prepare your setup.';
  return 'Get in position.';
}

export default function QuickMissionActive({ missionCfg, profile, onEnd, initialPaused, onStateChange, initialResumeData }) {
  useWakeLock(true);
  // Quick Mission v2 (owner preview until it ships): lead lines and a spoken
  // 3-2-1 before every move, per-move counting, up-next calls and minute
  // windows. Read once per mount. With it off, every path below is today's.
  const v2 = useState(() => qmV2Enabled())[0];
  // The mission is generated ONCE and travels with the session: a resume used
  // to regenerate from the config and come back as a different workout at the
  // old position. The setup screen may also hand over the exact mission it
  // previewed, so what you saw is what you run.
  const [mission] = useState(() => initialResumeData?.mission || missionCfg.mission || generateQuickMission(missionCfg));
  const allExercises = useMemo(() => [...mission.exercises, ...mission.finisherExercises], [mission]);

  // Sized to the mission, not the config (which never set rounds): one unit a
  // round, and a time limit from the unit-aware estimate, so a 55-minute Murph
  // is not VALIDATION FAILED. A resume never reopens the current round's unit,
  // so it expects one fewer. A v2 intro restored from the stash still opens
  // the first unit when it goes on to GET READY, so it counts as fresh. The
  // legacy runner mounted paused with nothing stashed (a new run started
  // while another Quick Mission waited paused) skips its intro, so round 1's
  // unit never opens: it is sized like a resume of round 1.
  const integrityResume = v2
    ? (initialResumeData?.phase === 'intro' ? null : initialResumeData)
    : (initialResumeData || (initialPaused ? { round: 1 } : null));
  const integrity = useIntegritySession('quickMission', qmTotalUnits(mission, integrityResume), qmIntegrityRules(mission));
  const integrityStartedRef = useRef(false);
  const [rapidWarning, setRapidWarning] = useState(null);

  // v2: a restored intro, or a start stashed before its first report, comes
  // back as a paused intro. RESUME then goes straight to GET READY.
  const [phase, setPhase] = useState(initialResumeData?.phase ?? (initialPaused ? (v2 ? 'intro' : 'work') : 'intro'));
  const [round, setRound] = useState(initialResumeData?.round ?? 1);
  const [exIdx, setExIdx] = useState(initialResumeData?.exIdx ?? 0);
  const [remaining, setRemaining] = useState(() => {
    if (initialResumeData?.remaining != null) return initialResumeData.remaining;
    if (initialPaused && !v2) {
      const firstEx = [...mission.exercises, ...mission.finisherExercises][0];
      if (firstEx && firstEx.mode === 'timed') return firstEx.work || 0;
    }
    return 0;
  });
  const [paused, setPaused] = useState(!!initialPaused);
  const [done, setDone] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [exercisesCompleted, setExercisesCompleted] = useState(initialResumeData?.exercisesCompleted ?? 0);
  const [roundsCompleted, setRoundsCompleted] = useState(initialResumeData?.roundsCompleted ?? 0);
  const [cadenceRep, setCadenceRep] = useState(0);
  const [cadenceActive, setCadenceActive] = useState(false);
  const [cadenceMs, setCadenceMs] = useState(missionCfg.cadenceMs || CADENCE_PRESETS.moderate);
  const [cadencePreset, setCadencePreset] = useState(missionCfg.cadencePreset || 'moderate');
  const [helpOpen, setHelpOpen] = useState(false);
  // The rest on screen: its full length (the ring and the mini-player) and
  // whether it is the intro's GET READY. Both travel in the resume stash.
  const [restTotal, setRestTotal] = useState(initialResumeData?.restTotal ?? initialResumeData?.remaining ?? 0);
  const [restKind, setRestKind] = useState(initialResumeData?.restKind ?? 'rest');
  // v2: the list step the count is on (a complex lights its current step).
  const [cadenceStep, setCadenceStep] = useState(null);
  // v2: bumped whenever a rest or a work clock (re)starts, so the 1 s tick
  // restarts with it. Otherwise a SKIP or REWIND that lands mid-second keeps
  // the old tick, the next second comes early and the spoken "3" cuts the
  // short line. Never changes in today's runner.
  const [tickEpoch, setTickEpoch] = useState(0);

  const versionRef = useRef(0);
  const cadenceVersionRef = useRef(0);
  const restWarningRef = useRef(false);
  // v2 timing state. moveVersionRef guards a work start against a SKIP,
  // REWIND or STOP that lands first; introRunRef is the version of the intro
  // that is still running (0 = none); restScriptRef is the current rest's
  // script and announcedByRef the line that named the next move during it
  // ('lead' | 'short' | null). The work clock (minute windows) counts
  // unpaused time from workStartRef.
  const moveVersionRef = useRef(0);
  const introRunRef = useRef(0);
  const restScriptRef = useRef(null);
  const announcedByRef = useRef(null);
  const workStartRef = useRef(null);
  const workPausedMsRef = useRef(0);
  const pauseStartRef = useRef(null);
  const cadenceMsRef = useRef(cadenceMs);
  useEffect(() => { cadenceMsRef.current = cadenceMs; }, [cadenceMs]);

  // Refs to keep state fresh for async callbacks (Fix 2)
  const exIdxRef = useRef(0);
  const roundRef = useRef(1);
  const roundsCompletedRef = useRef(0);
  const phaseRef = useRef('intro');
  const doneRef = useRef(false);
  const exercisesCompletedRef = useRef(0);
  const pausedRef = useRef(false);

  useEffect(() => { exIdxRef.current = exIdx; }, [exIdx]);
  useEffect(() => { roundRef.current = round; }, [round]);
  useEffect(() => { roundsCompletedRef.current = roundsCompleted; }, [roundsCompleted]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { doneRef.current = done; }, [done]);
  useEffect(() => { exercisesCompletedRef.current = exercisesCompleted; }, [exercisesCompleted]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  useEffect(() => {
    if (typeof onStateChange === 'function') {
      onStateChange({ phase, exIdx, round, remaining, exercisesCompleted, roundsCompleted, mission, restTotal, restKind });
    }
  }, [phase, exIdx, round, remaining, exercisesCompleted, roundsCompleted, onStateChange, mission, restTotal, restKind]);

  // Fix 4: voice from config, not profile
  const voiceOn = missionCfg.voiceOn !== false;
  const currentEx = allExercises[exIdx] || allExercises[0];
  // A named classic carries its own workoutType (CHAOS ENGINE is Weighted): the
  // safe-weight brief, the prep lines and the strip follow it. The count keeps
  // today's inputs through countType, so what is counted never changes.
  const workoutType = mission.workoutType || missionCfg.workoutType || 'Bodyweight';
  const countCfg = missionCfg.countType ? { ...missionCfg, workoutType: missionCfg.countType } : missionCfg;
  const isWeighted = workoutType === 'Weighted' || workoutType === 'Hybrid';
  const currentCadenceEligible = isCadenceEligible(currentEx, countCfg);
  // v2: a catalog move is counted when it has beats (a manual move has none);
  // anything else keeps today's whitelist.
  const currentCounted = v2 && isCatalogSlot(currentEx) ? isCounted(currentEx) : currentCadenceEligible;

  // Floating mini-player (shared/miniPlayer). Declared AFTER every const it
  // reads - see the trap noted in PROMPT MP-2.
  const miniFrame = useCallback(() => {
    const resting = phase === 'rest';
    const working = phase === 'work';
    const timed = currentEx?.mode === 'timed';
    const secs = Math.max(0, Number(remaining) || 0);
    const total = resting ? (v2 ? restTotal : (currentEx?.rest || 0)) : (currentEx?.work || 0);
    const next = allExercises[exIdx + 1] || (round < (mission.rounds || 1) ? allExercises[0] : null);
    return {
      phase: paused ? 'paused' : working ? 'work' : 'rest',
      clock: timed || resting ? (Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0')) : String(cadenceRep),
      reps: working && !timed ? cadenceRep : null,
      repsLabel: 'REPS',
      progress: total ? 1 - secs / total : 0,
      exIdx: exIdx + 1,
      exTotal: allExercises.length,
      setIdx: round,
      setTotal: mission.rounds || 1,
      name: resting ? (v2 && restKind === 'lead' ? 'GET READY' : 'REST') : (currentEx?.name || 'QUICK MISSION'),
      prescription: 'ROUND ' + round + '/' + (mission.rounds || 1),
      nextName: next?.name || null,
      segments: allExercises.map((_, i) => (i < exIdx ? 'done' : i === exIdx ? 'current' : 'todo')),
    };
  }, [phase, paused, remaining, cadenceRep, exIdx, round, allExercises, currentEx, mission.rounds, v2, restTotal, restKind]);
  const mini = useMiniPlayer(miniFrame, !done);

  // Fix 1: Refs for action functions to prevent stale closures in cadence loops
  const completeExerciseRef = useRef(null);
  const moveToNextRef = useRef(null);
  const skipExerciseRef = useRef(null);

  const stopCadence = () => {
    cadenceVersionRef.current++;
    setCadenceActive(false);
  };

  const startRestWithUpNext = (restDuration, completedRound, isRoundEnd, nextExIdx) => {
    // At least 1 s: a rest of 0 never changed `remaining`, so nothing moved on
    // until SKIP.
    const restSec = Math.max(1, Number(restDuration) || 0);
    restWarningRef.current = false;
    setPhase('rest');
    setRemaining(restSec);
    setRestTotal(restSec);
    setRestKind('rest');

    if (!voiceOn) return;

    if (isRoundEnd) {
      // Fix 5: use allExercises.length - 1 so getNextExerciseInfo finds round+1's first exercise
      const nextExInfo = getNextExerciseInfo(allExercises, allExercises.length - 1, completedRound, mission.rounds);
      if (nextExInfo) {
        const prep = getPrepMessage(workoutType);
        speakAsync(`Round ${completedRound} complete. Rest. ${secondsPhrase(restSec)}. Up next: Round ${completedRound + 1}. ${nextExInfo.exercise.name}. ${prep}`);
      } else {
        speakAsync(`Round ${completedRound} complete. Rest.`);
      }
    } else {
      const nextEx = allExercises[nextExIdx];
      if (nextEx) {
        const prep = getPrepMessage(workoutType);
        speakAsync(`Rest. ${secondsPhrase(restSec)}. Up next: ${nextEx.name}. ${prep}`);
      } else {
        speakAsync('Rest.');
      }
    }
  };

  // ── v2: the rest and lead-in timeline ──────────────────────────────────────
  // Every rest follows one script from data/missionMoves (restScript): a long
  // rest speaks its opener, then the next move's lead line at leadAt, then a
  // spoken 3-2-1; a short rest says "Next: …" at once; a 1-2 s rest is silent.
  // The remaining-second effect further down plays the script. All the timing
  // lives in the data helpers; this file only runs them.
  const nextSlotOf = (idx, r) => getNextExerciseInfo(allExercises, idx, r, mission.rounds)?.exercise || null;
  // The whitelist count, for slots that are not catalog moves.
  const legacyCountedFor = (ex) => !!ex && !isCatalogSlot(ex) && isCadenceEligible(ex, countCfg);

  // Build the script for a rest before slot `nextIdx` of round `nextRound`,
  // without speaking. kind 'lead' is the intro's GET READY, sized to its lead.
  const planRest = (restSec, { kind = 'rest', roundEnd = false, completedRound = 0, nextIdx, nextRound }) => {
    const next = allExercises[nextIdx];
    const lead = leadLine(next, {
      round: nextRound, idx: nextIdx, rounds: mission.rounds, slotsPerRound: allExercises.length,
      format: mission.format, legacyCounted: legacyCountedFor(next),
    });
    const sec = kind === 'lead' ? getReadySeconds(lead) : restSec;
    restScriptRef.current = restScript({
      restSec: sec, kind, roundEnd, completedRound, format: mission.format, tips: mission.tips || [],
      lead, short: shortRestLine(next),
    });
    announcedByRef.current = null;
    return { sec, script: restScriptRef.current };
  };

  // opts.afterTime: a minute window just ran out and the coach said "Time.",
  // so the short line queues behind it instead of cutting it.
  const startRestV2 = (restSec, opts) => {
    restWarningRef.current = false;
    const { sec, script } = planRest(restSec, opts);
    phaseRef.current = 'rest';
    setPhase('rest');
    setRemaining(sec);
    setRestTotal(sec);
    setRestKind(opts.kind || 'rest');
    setTickEpoch(e => e + 1);
    // Paused (a SKIP or REWIND mid-pause): RESUME says what is needed.
    if (!voiceOn || pausedRef.current) return;
    if (script.opener) {
      speakAsync(script.opener);
    } else if (script.plan === 'short' && script.short) {
      speakAsync(script.short, opts.afterTime ? { priority: 2 } : { preempt: true, priority: 2 });
      announcedByRef.current = 'short';
    }
  };

  // The intro's last steps: open the run's first integrity unit (once, however
  // the intro ended), then GET READY for slot 1.
  const beginRunV2 = () => {
    if (!integrityStartedRef.current) {
      integrityStartedRef.current = true;
      integrity.startUnit('rounds');
    }
    startRestV2(null, { kind: 'lead', nextIdx: exIdxRef.current, nextRound: roundRef.current });
  };

  // The count for a slot that is starting or resuming: beats for counted reps,
  // a pace count for a timed catalog move, nothing for a manual move (DONE) or
  // a plain clock. fromRep / fromMs: how far the slot already got.
  const startWorkCount = (ex, { fromRep = 0, fromMs = 0 } = {}) => {
    if (!ex) return;
    if (ex.mode === 'reps') {
      if (!isCatalogSlot(ex) && !isCadenceEligible(ex, countCfg)) return;
      const beats = countBeats(ex, { next: nextSlotOf(exIdxRef.current, roundRef.current) });
      if (beats) runCount(beats, fromRep);
      return;
    }
    const pace = paceBeats(ex);
    if (pace && voiceOn) runPace(pace, fromMs);
  };

  // v2 work start. After a rest the lead or short line already named the
  // move, so this says only "Go." (or nothing: a count, or a call at 0 s);
  // after a chain or a silent rest it says the move.
  const moveToNextV2 = () => {
    const version = ++moveVersionRef.current;
    restWarningRef.current = false;
    const ex = allExercises[exIdxRef.current];
    const announcedBy = announcedByRef.current;
    announcedByRef.current = null;
    restScriptRef.current = null;
    stopCadence();
    phaseRef.current = 'work';
    setPhase('work');
    workStartRef.current = Date.now();
    workPausedMsRef.current = 0;
    pauseStartRef.current = pausedRef.current ? Date.now() : null;
    setCadenceRep(0);
    setCadenceStep(null);
    if (ex.mode === 'timed') setRemaining(ex.work);
    setTickEpoch(e => e + 1);
    // Paused (a SKIP mid-pause chained in): RESUME starts the count.
    if (pausedRef.current) return;
    if (voiceOn) {
      const line = workStartLine(ex, { announcedBy, legacyCounted: legacyCountedFor(ex) });
      if (line) speakAsync(line);
    }
    if (moveVersionRef.current !== version) return;
    startWorkCount(ex);
  };

  // Unpaused seconds since this slot's work began, or null when unknown (a
  // run restored into work).
  const workElapsedSec = () => {
    if (workStartRef.current == null) return null;
    const pausedNow = pauseStartRef.current != null ? Date.now() - pauseStartRef.current : 0;
    return (Date.now() - workStartRef.current - workPausedMsRef.current - pausedNow) / 1000;
  };

  // v2: leave the current slot, done or skipped. A minute window rests for
  // what is left of its minute (round ends too, so the clock holds); a rest of
  // 0 chains straight into the next move with no rest phase.
  const advanceV2 = (how, { afterTime = false } = {}) => {
    moveVersionRef.current++;
    const idx = exIdxRef.current;
    const currentRound = roundRef.current;
    const ex = allExercises[idx];
    const nextIdx = idx + 1;
    const worked = workElapsedSec();
    const rest = ex.window && worked != null ? windowRest(ex, worked) : (ex.rest || 0);
    workStartRef.current = null;
    pauseStartRef.current = null;

    const goOn = (opts) => (rest > 0 ? startRestV2(rest, { ...opts, afterTime }) : moveToNextV2());
    if (nextIdx >= allExercises.length) {
      if (how === 'skip') integrity.skipUnit(); else integrity.completeUnit();
      const newRoundsCompleted = roundsCompletedRef.current + 1;
      setRoundsCompleted(newRoundsCompleted);
      if (currentRound >= mission.rounds) {
        finishMission(newRoundsCompleted);
        return;
      }
      roundRef.current = currentRound + 1;
      exIdxRef.current = 0;
      setRound(currentRound + 1);
      setExIdx(0);
      integrity.startUnit('rounds');
      goOn({ roundEnd: true, completedRound: currentRound, nextIdx: 0, nextRound: currentRound + 1 });
    } else {
      exIdxRef.current = nextIdx;
      setExIdx(nextIdx);
      goOn({ roundEnd: false, completedRound: currentRound, nextIdx, nextRound: currentRound });
    }
  };

  // opts (v2 only): { afterTime } from a minute window that ran out.
  const completeExercise = (opts) => {
    stopCadence();
    const idx = exIdxRef.current;
    const currentRound = roundRef.current;
    const ex = allExercises[idx];
    const nextIdx = idx + 1;

    setExercisesCompleted(c => c + 1);
    integrity.recordAction('complete');

    if (v2) {
      advanceV2('complete', opts);
      return;
    }

    if (nextIdx >= allExercises.length) {
      integrity.completeUnit();
      const newRoundsCompleted = roundsCompletedRef.current + 1;
      setRoundsCompleted(newRoundsCompleted);

      if (currentRound >= mission.rounds) {
        finishMission(newRoundsCompleted);
        return;
      }
      setRound(r => r + 1);
      setExIdx(0);
      integrity.startUnit('rounds');
      startRestWithUpNext(ex.rest, currentRound, true, 0);
    } else {
      const restDur = ex.rest;
      setExIdx(nextIdx);
      startRestWithUpNext(restDur, currentRound, false, nextIdx);
    }
  };

  const moveToNext = () => {
    restWarningRef.current = false;
    const idx = exIdxRef.current;
    const ex = allExercises[idx];
    const exCadence = isCadenceEligible(ex, countCfg);
    setPhase('work');

    if (ex.mode === 'timed') {
      setRemaining(ex.work);
    }

    if (voiceOn) {
      const target = spokenTarget(ex);
      const cadenceIntro = exCadence ? ' On my count.' : '';
      // A move with its own calls (Sally Up) starts on the first call, not
      // on "Ready. Begin." — the calls ARE the start.
      const line = ex.calls?.length ? `${ex.name}.` : `${ex.name}. ${target}.${cadenceIntro} Ready. Begin.`;
      speakAsync(line).then(() => {
        // Fix 3: use refs to check current state, not stale closure
        if (exCadence && phaseRef.current === 'work' && !doneRef.current && !pausedRef.current) {
          startCadence(ex);
        }
      });
    } else if (exCadence) {
      startCadence(ex);
    }
  };

  const skipExercise = () => {
    stopCadence();
    cancelSpeech();
    const actionResult = integrity.recordAction('skip');
    if (actionResult.suspicious) {
      setRapidWarning(actionResult.message);
      setTimeout(() => setRapidWarning(null), 2500);
    }
    if (v2) {
      advanceV2('skip');
      return;
    }
    const idx = exIdxRef.current;
    const currentRound = roundRef.current;
    const ex = allExercises[idx];
    const nextIdx = idx + 1;

    if (nextIdx >= allExercises.length) {
      integrity.skipUnit();
      const newRoundsCompleted = roundsCompletedRef.current + 1;
      setRoundsCompleted(newRoundsCompleted);
      if (currentRound >= mission.rounds) {
        finishMission(newRoundsCompleted);
        return;
      }
      setRound(r => r + 1);
      setExIdx(0);
      integrity.startUnit('rounds');
      startRestWithUpNext(ex.rest, currentRound, true, 0);
    } else {
      const restDur = ex.rest;
      setExIdx(nextIdx);
      startRestWithUpNext(restDur, currentRound, false, nextIdx);
    }
  };

  // 3b REWIND — the mirror of SKIP: step BACK to the previous exercise (or the
  // last exercise of the previous round) and run it again, re-announced. The
  // completion counter steps back with it so a rewound-then-completed exercise
  // counts once, never twice.
  // v2: disabled during the intro (there is nothing to go back to), and the
  // move restarts after a 5 s rest, so it gets its short line and the 3-2-1.
  const rewindExercise = () => {
    if (v2 && phaseRef.current === 'intro') return;
    cancelSpeech();
    stopCadence();
    restWarningRef.current = false;
    integrity.recordAction('rewind');

    const idx = exIdxRef.current;
    const currentRound = roundRef.current;

    if (idx > 0) {
      const prev = idx - 1;
      exIdxRef.current = prev;
      setExIdx(prev);
    } else if (currentRound > 1) {
      const last = allExercises.length - 1;
      roundRef.current = currentRound - 1;
      exIdxRef.current = last;
      setRound(currentRound - 1);
      setExIdx(last);
      setRoundsCompleted(c => Math.max(0, c - 1));
    }
    // else: already on the very first exercise — just restart it.

    setExercisesCompleted(c => Math.max(0, c - 1));
    if (v2) {
      moveVersionRef.current++;
      workStartRef.current = null;
      startRestV2(5, { kind: 'rest', nextIdx: exIdxRef.current, nextRound: roundRef.current });
      return;
    }
    moveToNextRef.current?.();
  };

  // Keep action refs fresh (Fix 1)
  useEffect(() => { completeExerciseRef.current = completeExercise; });
  useEffect(() => { moveToNextRef.current = v2 ? moveToNextV2 : moveToNext; });
  useEffect(() => { skipExerciseRef.current = skipExercise; });

  const startCadence = (exercise) => {
    const version = ++cadenceVersionRef.current;
    setCadenceActive(true);
    setCadenceRep(0);
    const targetReps = exercise.reps;

    const stale = () => cadenceVersionRef.current !== version;
    const isPaused = () => pausedRef.current;

    const runCadenceLoop = async () => {
      // The count is spoken INSIDE the cadence, not on top of it: a "2 s"
      // cadence measured 3.5 s per rep because the wait only began once the
      // voice had finished. Subtract what the last number cost.
      let spokenMs = 0;
      for (let i = 1; i <= targetReps; i++) {
        if (stale()) return;

        // A plain delay ignores PAUSE, so reps kept being counted and spoken
        // while the session was paused. Wait unpaused time, then hold at the
        // gate so a rep can never fire mid-pause.
        if (!await waitUnpaused(Math.max(250, cadenceMsRef.current - spokenMs), { isPaused, isStale: stale })) return;
        if (!await awaitResume({ isPaused, isStale: stale })) return;

        setCadenceRep(i);
        if (voiceOn) {
          const t0 = Date.now();
          await speakAsync(String(i));
          spokenMs = Date.now() - t0;
        }

        if (cadenceVersionRef.current !== version) return;
      }

      if (cadenceVersionRef.current !== version) return;
      setCadenceActive(false);
      setCadenceRep(0);
      // Fix 1: use ref to get fresh completeExercise
      completeExerciseRef.current?.();
    };

    runCadenceLoop();
  };

  const resumeCadence = () => {
    const version = ++cadenceVersionRef.current;
    setCadenceActive(true);
    const startFrom = cadenceRep;
    const ex = allExercises[exIdxRef.current];
    const targetReps = ex.reps;

    const stale = () => cadenceVersionRef.current !== version;
    const isPaused = () => pausedRef.current;

    const runCadenceLoop = async () => {
      let spokenMs = 0;
      for (let i = startFrom + 1; i <= targetReps; i++) {
        if (stale()) return;

        if (!await waitUnpaused(Math.max(250, cadenceMsRef.current - spokenMs), { isPaused, isStale: stale })) return;
        if (!await awaitResume({ isPaused, isStale: stale })) return;

        setCadenceRep(i);
        if (voiceOn) {
          const t0 = Date.now();
          await speakAsync(String(i));
          spokenMs = Date.now() - t0;
        }

        if (cadenceVersionRef.current !== version) return;
      }

      if (cadenceVersionRef.current !== version) return;
      setCadenceActive(false);
      setCadenceRep(0);
      // Fix 1: use ref to get fresh completeExercise
      completeExerciseRef.current?.();
    };

    runCadenceLoop();
  };

  // v2: one count for every counted slot (startCadence + resumeCadence in
  // one). It runs on an absolute clock: each beat is due a fixed time after
  // the one before, measured from the start, so a long line ("8. Two more. Up
  // next: 10 cleans.") never pushes the later numbers back. The screen moves
  // on time; a number that would talk over the coach is dropped. The last
  // number always waits its turn, then the slot completes. beat.ms already
  // holds setupMs (beat 1) and switchMs (the beat after "Switch."); a legacy
  // beat has ms null and follows the slider.
  const runCount = (beats, startFrom = 0) => {
    const version = ++cadenceVersionRef.current;
    const stale = () => cadenceVersionRef.current !== version;
    const isPaused = () => pausedRef.current;
    setCadenceActive(true);
    if (startFrom === 0) { setCadenceRep(0); setCadenceStep(null); }

    const runCountLoop = async () => {
      let due = Date.now();
      for (let i = startFrom; i < beats.length; i += 1) {
        if (stale()) return;
        const beat = beats[i];
        due += beat.ms ?? cadenceMsRef.current;
        if (!await waitUnpaused(Math.max(0, due - Date.now()), { isPaused, isStale: stale })) return;
        if (!await awaitResume({ isPaused, isStale: stale })) return;

        setCadenceRep(beat.n);
        setCadenceStep(beat.step ?? null);
        if (!voiceOn) continue;
        if (i < beats.length - 1) {
          speakAsync(beat.say, { dropIfBusy: true });
        } else {
          await speakAsync(beat.say);
          if (stale()) return;
        }
      }

      if (stale()) return;
      setCadenceActive(false);
      setCadenceRep(0);
      setCadenceStep(null);
      completeExerciseRef.current?.();
    };

    runCountLoop();
  };

  // v2: the pace count on a timed catalog move. Number i lands at
  // (i - 0.5) x ms into the work, so every number falls inside it and the last
  // one spoken is the score SOLO would prefill. It never ends the slot; the
  // clock does. fromMs: work already done (a resume).
  const runPace = ({ ms, n }, fromMs = 0) => {
    const version = ++cadenceVersionRef.current;
    const stale = () => cadenceVersionRef.current !== version;
    const isPaused = () => pausedRef.current;
    const t0 = Date.now() - fromMs;

    const runPaceLoop = async () => {
      for (let i = 1; i <= n; i += 1) {
        const at = (i - 0.5) * ms;
        if (at < fromMs) continue;
        if (!await waitUnpaused(Math.max(0, t0 + at - Date.now()), { isPaused, isStale: stale })) return;
        if (!await awaitResume({ isPaused, isStale: stale })) return;
        speakAsync(String(i), { dropIfBusy: true });
      }
    };

    runPaceLoop();
  };

  const runIntro = useCallback(async () => {
    const version = ++versionRef.current;
    const aborted = () => version !== versionRef.current;

    unlockAudio();
    setVoiceGender(profile?.voiceCoach || 'FEMALE');
    if (voiceOn) await primeSpeech();
    if (aborted()) return;

    if (isWeighted && voiceOn) {
      await speakAsync('Choose a safe weight before starting. Form first. Control every rep.');
      if (aborted()) return;
      await delay(800);
      if (aborted()) return;
    }

    if (voiceOn) {
      await speakAsync(getCoachCopy('sessionStart'));
      if (aborted()) return;
      await delay(400);
      if (aborted()) return;
    }

    playBell(1);
    await delay(600);
    if (aborted()) return;

    if (!integrityStartedRef.current) {
      integrityStartedRef.current = true;
      integrity.startUnit('rounds');
    }

    setPhase('work');
    const firstEx = allExercises[0];
    const firstCadence = isCadenceEligible(firstEx, countCfg);

    if (firstEx.mode === 'timed') {
      setRemaining(firstEx.work);
    }

    if (voiceOn) {
      const target = spokenTarget(firstEx);
      const cadenceIntro = firstCadence ? ' On my count.' : '';
      const line = firstEx.calls?.length ? `${firstEx.name}.` : `Round 1. ${firstEx.name}. ${target}.${cadenceIntro} Ready. Begin.`;
      await speakAsync(line);
      if (aborted()) return;
    }

    if (firstCadence) {
      startCadence(firstEx);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceOn, isWeighted]);

  // v2 intro: the brief (what was swapped in, the start line, the mission's
  // own line), the bell, then GET READY for slot 1. PAUSE holds it between
  // lines; SKIP (or a version change) ends it, and it never opens a second
  // unit or a second rest.
  const runIntroV2 = async () => {
    const version = ++versionRef.current;
    const aborted = () => version !== versionRef.current;
    const isPaused = () => pausedRef.current;
    // Wait `ms` of unpaused time, then hold while paused. false = aborted.
    const hold = async (ms = 0) => {
      if (ms > 0 && !await waitUnpaused(ms, { isPaused, isStale: aborted })) return false;
      return awaitResume({ isPaused, isStale: aborted });
    };
    const say = async (line) => {
      if (!line) return !aborted();
      await speakAsync(line);
      return !aborted() && hold();
    };
    introRunRef.current = version;
    try {
      unlockAudio();
      setVoiceGender(profile?.voiceCoach || 'FEMALE');
      if (voiceOn) await primeSpeech();
      if (aborted() || !await hold()) return;

      if (isWeighted && voiceOn) {
        if (!await say('Choose a safe weight before starting. Form first. Control every rep.')) return;
        if (!await hold(800)) return;
      }

      if (voiceOn) {
        if (mission.v2 && !await say(swappedInLine(mission))) return;
        if (!await say(getCoachCopy('sessionStart'))) return;
        if (!await say(mission.introSay)) return;
        if (!await hold(400)) return;
      }

      playBell(1);
      if (!await hold(600)) return;
      beginRunV2();
    } finally {
      if (introRunRef.current === version) introRunRef.current = 0;
    }
  };

  // SKIP in the v2 intro: stop the brief and go straight to GET READY (no bell).
  const skipIntroV2 = () => {
    versionRef.current++;
    cancelSpeech();
    unlockAudio();
    setVoiceGender(profile?.voiceCoach || 'FEMALE');
    beginRunV2();
  };

  useEffect(() => {
    // v2: a rest restored from the stash rebuilds its script (nothing is
    // re-spoken; RESUME decides what the athlete still needs to hear).
    if (v2 && initialResumeData?.phase === 'rest') {
      const nextIdx = initialResumeData.exIdx ?? 0;
      const nextRound = initialResumeData.round ?? 1;
      const roundEnd = nextIdx === 0 && nextRound > 1;
      planRest(restTotal, { kind: restKind, roundEnd, completedRound: roundEnd ? nextRound - 1 : nextRound, nextIdx, nextRound });
    }
    if (!initialPaused) (v2 ? runIntroV2 : runIntro)();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { versionRef.current++; cadenceVersionRef.current++; moveVersionRef.current++; cancelSpeech(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timer for timed exercises and rest
  useEffect(() => {
    if (paused || done || phase === 'intro') return;
    if (phase === 'work' && currentEx.mode === 'reps') return;

    const id = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) return 0;
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [paused, done, phase, currentEx?.mode, tickEpoch]);

  // Fix 9: Phase transition using refs to avoid stale closures
  useEffect(() => {
    if (remaining > 0 || phaseRef.current === 'intro' || doneRef.current) return;
    const currentPhase = phaseRef.current;
    const idx = exIdxRef.current;
    const ex = allExercises[idx];

    if (currentPhase === 'work' && ex && ex.mode === 'timed') {
      completeExerciseRef.current?.();
    } else if (currentPhase === 'rest') {
      moveToNextRef.current?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  // Scripted calls on a timed move (Sally Up's DOWN / UP): spoken on the
  // second they are due, and the latest one shown under the clock.
  const [liveCall, setLiveCall] = useState(null);
  useEffect(() => {
    const ex = allExercises[exIdxRef.current];
    if (phase !== 'work' || paused || done || !ex?.calls?.length || ex.mode !== 'timed') { if (phase !== 'work') setLiveCall(null); return; }
    const elapsed = ex.work - remaining;
    const due = ex.calls.find(c => c.t === elapsed);
    if (due) {
      setLiveCall(due.say.replace(/\.\s*Done\.?$/, '').toUpperCase());
      if (voiceOn) speakAsync(due.say, { preempt: true, priority: 3 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, phase, paused, done]);

  // Beeps at 3, 2, 1
  useEffect(() => {
    if (phase === 'intro' || done || paused) return;
    if (remaining >= 1 && remaining <= 3) {
      playBeep();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  // 10-second rest warning (v2: gone, the lead or short line names the move)
  useEffect(() => {
    if (v2 || phase !== 'rest' || done || paused) return;
    if (remaining === 10 && !restWarningRef.current) {
      restWarningRef.current = true;
      if (voiceOn) speakAsync('10 seconds. Get ready.');
    }
  }, [remaining, phase, done, paused, voiceOn, v2]);

  // v2: the rest script and the near-end call, each on the second it is due.
  // The lead and the numbers take the mic (a lead always ends before the "3");
  // near the end of a timed move the coach calls what is next, and the pace
  // count drops the numbers it would talk over.
  useEffect(() => {
    if (!v2 || !voiceOn || paused || done) return;
    if (phase === 'rest') {
      const sc = restScriptRef.current;
      if (!sc) return;
      if (sc.leadAt != null && remaining === sc.leadAt && sc.lead) {
        speakAsync(sc.lead, { preempt: true, priority: 2 });
        announcedByRef.current = 'lead';
      } else if (sc.countdown && remaining >= 1 && remaining <= 3) {
        speakAsync(String(remaining), { preempt: true, priority: 2 });
      }
    } else if (phase === 'work') {
      const ex = allExercises[exIdxRef.current];
      if (ex?.mode !== 'timed' || !(remaining > 0)) return;
      const next = nextSlotOf(exIdxRef.current, roundRef.current);
      if (remaining === nearEndUpNextAt(ex, next)) {
        speakAsync(`Up next: ${spokenMove(next)}.`, { preempt: true, priority: 2 });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  // v2 minute windows: a set still going 5 s before the minute is up ends on
  // its own ("Time."), so its 5 s rest still starts the next minute on time.
  useEffect(() => {
    if (!v2 || phase !== 'work' || paused || done) return undefined;
    const ex = allExercises[exIdx];
    if (!ex?.window || ex.mode !== 'reps') return undefined;
    const id = setInterval(() => {
      const worked = workElapsedSec();
      if (worked == null || phaseRef.current !== 'work' || worked < ex.window - 5) return;
      clearInterval(id);
      stopCadence();
      if (voiceOn) speakAsync('Time.', { preempt: true, priority: 2 });
      completeExerciseRef.current?.({ afterTime: true });
    }, 250);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v2, phase, paused, done, exIdx, round]);

  const handleCompleteRep = () => {
    if (phaseRef.current !== 'work' || currentEx.mode !== 'reps') return;
    // v2 minute windows keep DONE through the count: finishing early buys rest.
    if (!cadenceActive || (v2 && currentEx.window != null)) {
      completeExerciseRef.current?.();
    }
  };

  // v2 SKIP in a rest jumps to its last seconds rather than cutting it: room
  // for "Next: …" and the 3-2-1. Already that close, it does nothing, so the
  // countdown that is running keeps its voice.
  const skipRestV2 = () => {
    const next = allExercises[exIdxRef.current];
    const target = skipRestTarget(next);
    if (!(remaining > target)) return;
    const short = shortRestLine(next);
    restScriptRef.current = { ...(restScriptRef.current || {}), plan: 'short', opener: null, leadAt: null, lead: null, short, countdown: true };
    setRemaining(target);
    setTickEpoch(e => e + 1);
    announcedByRef.current = null;
    if (voiceOn && !pausedRef.current) {
      speakAsync(short, { preempt: true, priority: 2 });
      announcedByRef.current = 'short';
    }
  };

  const handleSkip = () => {
    // v2: the intro and rest branches come first, so a SKIP in a rest no
    // longer cancels the countdown that is speaking.
    if (v2 && phaseRef.current === 'intro') { skipIntroV2(); return; }
    if (v2 && phaseRef.current === 'rest') { skipRestV2(); return; }
    cancelSpeech();
    stopCadence();
    if (phaseRef.current === 'rest') {
      moveToNextRef.current?.();
    } else {
      skipExerciseRef.current?.();
    }
  };

  const handlePause = () => {
    cancelSpeech();
    stopCadence();
    setPaused(true);
    integrity.pause();
    if (v2) {
      pausedRef.current = true;
      // The minute window counts only unpaused work.
      if (phaseRef.current === 'work' && pauseStartRef.current == null) pauseStartRef.current = Date.now();
    }
  };

  // v2 RESUME in a rest: the athlete hears the next move unless under ~5 s
  // are left. A lead still ahead is left to the script.
  const resumeRestVoice = () => {
    const sc = restScriptRef.current;
    if (!voiceOn || !sc) return;
    if (sc.leadAt != null && remaining > sc.leadAt) return;
    const short = shortRestLine(allExercises[exIdxRef.current]);
    if (remaining >= 3 + speechSeconds(short)) {
      speakAsync(short, { preempt: true, priority: 2 });
      announcedByRef.current = 'short';
    } else {
      // Voice resumed cold: the work start names the move instead.
      announcedByRef.current = null;
    }
  };

  // v2 RESUME of an intro that is not running (restored from the stash, or a
  // start stashed before its first report): the SKIP path, after the audio
  // unlock the intro would have done on this tap.
  const resumeColdIntro = () => {
    const version = ++versionRef.current;
    cancelSpeech();
    unlockAudio();
    setVoiceGender(profile?.voiceCoach || 'FEMALE');
    const go = async () => {
      if (voiceOn) await primeSpeech();
      if (version !== versionRef.current) return;
      beginRunV2();
    };
    go();
  };

  const handleResume = () => {
    setPaused(false);
    integrity.resume();
    if (v2) {
      pausedRef.current = false;
      if (pauseStartRef.current != null) {
        if (phaseRef.current === 'work') workPausedMsRef.current += Date.now() - pauseStartRef.current;
        pauseStartRef.current = null;
      }
      const ex = allExercises[exIdxRef.current];
      if (phaseRef.current === 'intro') {
        // A running brief picks up where it held.
        if (!introRunRef.current || introRunRef.current !== versionRef.current) resumeColdIntro();
      } else if (phaseRef.current === 'rest') {
        resumeRestVoice();
      } else if (phaseRef.current === 'work' && ex) {
        // Counted reps restart from the last number shown, even 0 (paused
        // before rep 1 used to leave only a manual DONE); a pace count from
        // the next number still ahead.
        startWorkCount(ex, { fromRep: cadenceRep, fromMs: ex.mode === 'timed' ? Math.max(0, (ex.work - remaining) * 1000) : 0 });
      }
      return;
    }
    const idx = exIdxRef.current;
    const ex = allExercises[idx];
    if (phaseRef.current === 'work' && isCadenceEligible(ex, countCfg) && ex.mode === 'reps' && cadenceRep > 0 && cadenceRep < ex.reps) {
      resumeCadence();
    }
  };

  const handlePauseToggle = () => {
    if (paused) {
      handleResume();
    } else {
      handlePause();
    }
  };

  // Auto-pause when the app is backgrounded (honest pause, not a cheat flag).
  useAutoPauseOnHidden(!paused && !done, handlePauseToggle, integrity);

  const finishMission = (finalRounds) => {
    stopCadence();
    setDone(true);
    playBell(3);
    if (voiceOn) {
      setTimeout(() => speakAsync(getCoachCopy('sessionComplete')), 400);
    }
    const integrityResult = integrity.finalize();
    setTimeout(() => {
      stopVoiceSession();
      onEnd({
        completed: true,
        roundsCompleted: finalRounds,
        totalRounds: mission.rounds,
        // Read after the 1.8 s bell: the last completion has rendered and the
        // ref already counts it (a skipped last move was never counted).
        // The old "+ 1" paid every finished run one exercise (15 XP) extra.
        exercisesCompleted: exercisesCompletedRef.current,
        totalExercises: allExercises.length * mission.rounds,
        mission,
        integrityResult,
      });
    }, 1800);
  };

  const handleEndConfirm = () => {
    stopCadence();
    cancelSpeech();
    stopVoiceSession();
    versionRef.current++;
    moveVersionRef.current++;
    const integrityResult = integrity.finalize();
    // Beta ND-05 — ONE authoritative counter. The summary screen reports
    // exercises, the integrity layer counts rounds, and rewinds decrement the
    // exercise tally — so an early exit could show "1/2 ROUNDS" beside
    // "0 EXERCISES" on the same screen. Rounds are now DERIVED from the
    // exercise counter, so the two can never disagree again.
    const exDone = exercisesCompletedRef.current;
    onEnd({
      completed: false,
      roundsCompleted: Math.min(mission.rounds, Math.floor(exDone / Math.max(1, allExercises.length))),
      totalRounds: mission.rounds,
      exercisesCompleted: exDone,
      totalExercises: allExercises.length * mission.rounds,
      mission,
      integrityResult,
    });
  };

  // The ring is drawn in a fixed 380-unit SVG coordinate space but RENDERED
  // responsively (same pattern as FightFocusTimer) so it never eats the screen
  // on a phone — it used to render at a hard 380px, which pushed the exercise
  // card and controls off the bottom.
  const ringSize = 380;
  const ringR = (ringSize - 20) / 2;
  const ringBox = {
    position: 'relative', width: 'min(54vw, 208px)', maxWidth: '100%',
    aspectRatio: '1 / 1', marginBottom: 14,
  };
  const maxTime = phase === 'rest' ? (v2 ? (restTotal || 1) : (currentEx?.rest || 60)) : (currentEx?.work || 30);
  const pct = maxTime > 0 ? remaining / maxTime : 0;
  const ringColor = phase === 'rest' ? '#4f8cff' : GOLD;

  const upNextExercise = phase === 'rest' ? allExercises[exIdx] : null;
  const showDoneButton = phase === 'work' && currentEx.mode === 'reps' && !cadenceActive && !currentCadenceEligible;
  const showManualDone = phase === 'work' && currentEx.mode === 'reps' && !cadenceActive && currentCadenceEligible && cadenceRep === 0 && !paused;
  // v2: a manual move always shows DONE; a minute window keeps it through the
  // count (done early = more rest); elsewhere it hides once counting starts.
  const showDoneV2 = phase === 'work' && currentEx.mode === 'reps' && (!currentCounted
    || (currentEx.window != null ? !paused : (!cadenceActive && cadenceRep === 0 && !paused)));
  const showDone = v2 ? showDoneV2 : (showDoneButton || showManualDone);

  // v2 on-screen extras. A catalog slot prints its card dose ('10 (5/side)',
  // '3:00', '2 + 1 + 3'); anything else today's dose plus its unit.
  const doseOf = (ex) => (isCatalogSlot(ex) ? slotDose(ex) : legacyDose(ex));
  const upNextInWork = v2 && phase === 'work' ? getNextExerciseInfo(allExercises, exIdx, round, mission.rounds)?.exercise || null : null;
  const v2Mission = v2 && !!mission.v2;
  const minuteLabel = v2Mission && mission.format === 'emom'
    ? `MINUTE ${(round - 1) * allExercises.length + exIdx + 1}/${(mission.rounds || 1) * allExercises.length}`
    : null;
  const rewindOff = v2 && phase === 'intro';

  return (
    <PhoneFrame useBrandBg>
      {/* Themed background art */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1, opacity: 0.1,
        backgroundImage: 'url(/static/ring-conditioning.png)',
        backgroundSize: 'cover', backgroundPosition: 'center',
        filter: 'blur(2px) saturate(0.6)',
        pointerEvents: 'none',
      }}/>
      <CornerHUD color="rgba(253,224,71,0.3)" size={20} inset={10}/>
      {/* Universal layout: How-to (O) sits top-right in the header row below;
          Volume sits directly under it so the two never overlap. */}
      <VoiceMixer top={58} right={14} dataGuide="qma-volume"/>
      <FloatOnLeave {...mini}/>

      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
        alignItems: 'center', minHeight: '100dvh',
        // ~22% of the viewport kept clear under the controls (over the tab bar).
        padding: '16px 16px calc(max(150px, 22dvh) + env(safe-area-inset-bottom, 0px))',
        overflowX: 'hidden',
      }}>

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 12 }}>
          <button data-guide="qma-back" onClick={() => setConfirmEnd(true)} style={{ background: 'none', border: 'none', color: C.text, padding: 4 }}>
            <ChevronLeft size={24}/>
          </button>
          <div data-guide="qma-title" style={{
            fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 16,
            color: GOLD, letterSpacing: '0.15em',
            textShadow: '0 0 12px rgba(253,224,71,0.4)',
          }}>QUICK MISSION</div>
          <HelpButton onClick={() => setHelpOpen(true)} size={18}/>
        </div>

        {/* Mission title */}
        {/* Named programs carry long titles ("7-DAY SHADOWBOX MINI · JAB +
            FOOTWORK"); keep them on one line, clear of the floating
            mini-player and voice buttons in the top-right corner. */}
        <div style={{
          fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 12,
          color: C.text, letterSpacing: '0.1em', marginBottom: 4,
          maxWidth: 'calc(100% - 120px)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'center',
        }}>{mission.title}</div>
        {v2Mission && mission.load && (
          <div style={{
            font: `500 11px ${BODY}`, color: KIT_MUTED, letterSpacing: '0.04em', marginBottom: 6,
            maxWidth: 'calc(100% - 120px)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'center',
          }}>LOAD · {mission.load}</div>
        )}

        {/* Status strip. v2 missions: MINUTE m/N for an EMOM, and the level
            in place of the difficulty. */}
        <div data-guide="qma-status" style={{
          display: 'flex', gap: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 16,
          padding: '7px 16px', borderRadius: 8,
          background: 'rgba(15,5,30,0.7)', border: '1px solid rgba(253,224,71,0.15)',
        }}>
          <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 11, fontWeight: 700, color: GOLD, letterSpacing: '0.1em' }}>
            {minuteLabel || <>ROUND {round}/{mission.rounds}</>}
          </span>
          <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 10, fontWeight: 600, color: C.muted }}>
            {workoutType.toUpperCase()}
          </span>
          <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 10, fontWeight: 600, color: C.muted }}>
            {v2Mission && mission.levelLabel ? mission.levelLabel : missionCfg.difficulty.toUpperCase()}
          </span>
        </div>

        {/* Timer ring / Cadence display / Reps display */}
        {(phase === 'work' && currentEx.mode === 'timed') || phase === 'rest' ? (
          <div data-guide="qma-ring" style={ringBox}>
            {/* The ring's own art, dimmed behind the arc (matches Fight Focus) */}
            <SafeImage src="/static/ring-conditioning.png" alt="" style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'cover', borderRadius: '50%', opacity: 0.2, pointerEvents: 'none',
            }}/>
            <svg width="100%" height="100%" viewBox={`0 0 ${ringSize} ${ringSize}`} style={{ display: 'block' }}>
              <circle cx={ringSize/2} cy={ringSize/2} r={ringR} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={12}/>
              <circle cx={ringSize/2} cy={ringSize/2} r={ringR} fill="none"
                stroke={ringColor} strokeWidth={12} strokeLinecap="round"
                strokeDasharray={2 * Math.PI * ringR}
                strokeDashoffset={(1 - pct) * 2 * Math.PI * ringR}
                transform={`rotate(-90 ${ringSize/2} ${ringSize/2})`}
                style={{ transition: 'stroke-dashoffset 0.9s linear', filter: `drop-shadow(0 0 12px ${ringColor})` }}
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{
                fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 36,
                color: '#fff', textShadow: `0 0 20px ${ringColor}`,
              }}>{formatTime(remaining)}</div>
              <div style={{
                fontFamily: "'Orbitron',sans-serif", fontSize: 10, fontWeight: 700,
                color: ringColor, letterSpacing: '0.2em', marginTop: 6,
              }}>{phase === 'rest' ? (v2 && restKind === 'lead' ? 'GET READY' : 'REST') : 'WORK'}</div>
              {phase === 'work' && liveCall && (
                <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 20, color: GOLD, letterSpacing: '0.12em', marginTop: 6, textShadow: '0 0 14px rgba(253,224,71,0.5)' }}>{liveCall}</div>
              )}
            </div>
          </div>
        ) : phase === 'work' && cadenceActive ? (
          <div data-guide="qma-ring" style={{
            ...ringBox,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            borderRadius: '50%', border: `4px solid ${GOLD}55`,
            background: 'rgba(10,0,20,0.4)',
            boxShadow: '0 0 30px rgba(253,224,71,0.15)',
          }}>
            <div style={{
              fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 44,
              color: GOLD, textShadow: '0 0 20px rgba(253,224,71,0.5)',
            }}>{cadenceRep}</div>
            <div style={{
              fontFamily: "'Orbitron',sans-serif", fontSize: 10, fontWeight: 700,
              color: C.muted, letterSpacing: '0.15em', marginTop: 6,
            }}>REP {cadenceRep} / {currentEx.reps}</div>
          </div>
        ) : (
          <div data-guide="qma-ring" style={{
            ...ringBox,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            borderRadius: '50%', border: `4px solid ${GOLD}33`,
            background: 'rgba(10,0,20,0.4)',
          }}>
            {phase === 'intro' ? (
              /* Beta ND-08 — this state can hold 8s+ while the coach reads the
                 brief; a static label read as a hang. Pulse it and say why. */
              <>
                <style>{'@keyframes qm-prep{0%,100%{opacity:.4}50%{opacity:1}}'}</style>
                <div style={{
                  fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 15,
                  color: GOLD, letterSpacing: '0.1em', animation: 'qm-prep 1.2s ease-in-out infinite',
                }}>PREPARING...</div>
                <div style={{
                  fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 11,
                  color: C.muted, marginTop: 6,
                }}>Your coach is reading the mission brief</div>
              </>
            ) : (
              <>
                <div style={{
                  fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 40,
                  color: GOLD,
                }}>{currentEx.reps}</div>
                <div style={{
                  fontFamily: "'Orbitron',sans-serif", fontSize: 11, fontWeight: 700,
                  color: C.muted, letterSpacing: '0.15em', marginTop: 6,
                }}>{currentEx.unit || 'REPS'}</div>
              </>
            )}
          </div>
        )}

        {/* Current exercise / Up Next card */}
        {phase !== 'intro' && (
          <div data-guide="qma-exercisecard" style={{
            width: '100%', maxWidth: 360, padding: '16px 18px', borderRadius: 12,
            background: 'rgba(10,0,20,0.8)', border: `1px solid ${ringColor}33`,
            textAlign: 'center', marginBottom: 14,
          }}>
            {phase === 'rest' && upNextExercise ? (
              <>
                <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 7, color: '#4f8cff', letterSpacing: '0.15em', marginBottom: 6 }}>
                  UP NEXT
                </div>
                <div style={{
                  fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 20,
                  color: '#fff', letterSpacing: '0.06em',
                }}>
                  {upNextExercise.name}
                </div>
                <div style={{
                  fontFamily: "'Rajdhani',sans-serif", fontSize: 13, fontWeight: 500,
                  color: C.muted, marginTop: 8,
                }}>
                  {v2 ? doseOf(upNextExercise) : legacyDose(upNextExercise)}
                </div>
                <div style={{
                  fontFamily: "'Rajdhani',sans-serif", fontSize: 12, fontWeight: 500,
                  color: workoutType === 'Bodyweight' ? 'rgba(79,140,255,0.7)' : GOLD,
                  marginTop: 6,
                }}>
                  {workoutType === 'Weighted' ? 'Grab your weight.' : workoutType === 'Hybrid' ? 'Prepare your setup.' : 'Get in position.'}
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 7, color: C.muted, letterSpacing: '0.15em' }}>
                    {minuteLabel || <>EXERCISE {exIdx + 1}/{allExercises.length}</>}
                  </span>
                  {phase === 'work' && currentEx.mode === 'reps' && (
                    <span style={{
                      fontFamily: "'Orbitron',sans-serif", fontSize: 7, fontWeight: 700,
                      color: cadenceActive ? '#22c55e' : 'rgba(255,255,255,0.62)',
                      letterSpacing: '0.08em',
                      padding: '2px 6px', borderRadius: 4,
                      background: cadenceActive ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${cadenceActive ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)'}`,
                    }}>
                      {cadenceActive ? 'CADENCE ON' : v2 ? (currentCounted ? 'CADENCE ON' : 'YOUR PACE') : 'MANUAL REPS'}
                    </span>
                  )}
                </div>
                <div style={{
                  fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 20,
                  color: GOLD, letterSpacing: '0.06em',
                  textShadow: '0 0 12px rgba(253,224,71,0.4)',
                }}>
                  {currentEx.name}
                </div>
                {/* v2 list slots: an AMRAP block keeps its moves on screen; a
                    complex lights the step the count is on. */}
                {v2 && Array.isArray(currentEx.list) && (
                  <div style={{ marginTop: 8 }}>
                    {currentEx.list.map((step, i) => {
                      const on = currentEx.mode === 'reps' && cadenceActive && cadenceStep === i;
                      return (
                        <div key={`${step.swapKey || step.name}-${i}`} style={{
                          font: `600 13px ${BODY}`, lineHeight: 1.45, color: on ? KIT_GOLD : C.text,
                        }}>{slotDose(step)} {step.name}</div>
                      );
                    })}
                  </div>
                )}
                {currentEx.isFinisher && (
                  <div style={{
                    display: 'inline-block', marginTop: 6,
                    padding: '2px 8px', borderRadius: 4,
                    background: 'rgba(255,107,0,0.1)', border: '1px solid rgba(255,107,0,0.3)',
                    fontFamily: "'Orbitron',sans-serif", fontSize: 8, fontWeight: 700,
                    color: C.rush, letterSpacing: '0.1em',
                  }}>FINISHER</div>
                )}
              </>
            )}
          </div>
        )}

        {/* v2: what comes after this move, under its card */}
        {upNextInWork && (
          <div style={{
            width: '100%', maxWidth: 360, marginTop: -6, marginBottom: 14, textAlign: 'center',
            font: `600 11px ${HEAD}`, letterSpacing: '0.08em', color: '#4f8cff',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>UP NEXT · {String(upNextInWork.name || '').toUpperCase()} · {doseOf(upNextInWork)}</div>
        )}

        {/* Controls */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          {showDone && (
            <button onClick={handleCompleteRep} style={{
              width: 64, height: 64, borderRadius: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.4)',
              color: '#22c55e', fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 10,
              letterSpacing: '0.05em', cursor: 'pointer',
            }}>
              DONE
            </button>
          )}
          {/* 3b — REWIND: back to the previous exercise (symmetric to SKIP) */}
          <button data-guide="qma-rewind" onClick={rewindExercise} aria-label="Previous exercise" aria-disabled={rewindOff ? 'true' : undefined} style={{
            width: 56, height: 56, borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(20,5,40,0.8)', border: '1px solid rgba(168,85,247,0.3)',
            color: C.neon, cursor: rewindOff ? 'default' : 'pointer',
            ...(rewindOff ? { opacity: 0.45 } : null),
          }}>
            <RotateCcw size={22}/>
          </button>
          <button data-guide="qma-pause" onClick={handlePauseToggle} style={{
            width: 70, height: 70, borderRadius: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: paused ? 'rgba(253,224,71,0.12)' : 'linear-gradient(135deg, rgba(253,224,71,0.3), rgba(253,224,71,0.15))',
            border: `1.5px solid ${paused ? GOLD : 'rgba(253,224,71,0.4)'}`,
            color: '#fff', cursor: 'pointer',
            boxShadow: paused ? 'none' : '0 0 20px rgba(253,224,71,0.2)',
          }}>
            {paused ? <Play size={28}/> : <Pause size={28}/>}
          </button>
          <button data-guide="qma-skip" onClick={handleSkip} style={{
            width: 56, height: 56, borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(20,5,40,0.8)', border: '1px solid rgba(168,85,247,0.3)',
            color: C.neon, cursor: 'pointer',
          }}>
            <SkipForward size={22}/>
          </button>
          <button data-guide="qma-stop" onClick={() => setConfirmEnd(true)} style={{
            width: 56, height: 56, borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)',
            color: '#ef4444', cursor: 'pointer',
          }}>
            <Square size={20}/>
          </button>
        </div>

        {/* Cadence speed control — only during rep/cadence sections (v2: only
            on a whitelist-counted slot; a catalog move has its own cadence) */}
        {phase === 'work' && currentCadenceEligible && (!v2 || !isCatalogSlot(currentEx)) && (
          <div style={{ width: '100%', maxWidth: 360, marginTop: 16 }}>
            <div style={{
              fontFamily: "'Orbitron',sans-serif", fontWeight: 700, color: GOLD,
              fontSize: 9, letterSpacing: '0.2em', marginBottom: 6, textAlign: 'center',
            }}>CADENCE SPEED</div>
            <CadenceSlider
              value={cadenceMs}
              onChange={setCadenceMs}
              preset={cadencePreset}
              onPresetChange={setCadencePreset}
            />
          </div>
        )}
      </div>

      {/* Rapid action warning */}
      {rapidWarning && (
        <div style={{
          position: 'absolute', top: 80, left: '50%', transform: 'translateX(-50%)',
          zIndex: 150, padding: '10px 18px', borderRadius: 10,
          background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)',
          backdropFilter: 'blur(6px)',
        }}>
          <div style={{
            fontFamily: "'Orbitron',sans-serif", fontSize: 9, fontWeight: 700,
            color: '#f59e0b', letterSpacing: '0.1em', textAlign: 'center',
          }}>{rapidWarning}</div>
        </div>
      )}

      {/* Confirm End Modal */}
      {confirmEnd && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 200,
          background: 'rgba(5,0,15,0.88)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(6px)',
        }}>
          <div style={{
            background: 'rgba(15,5,30,0.95)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 16, padding: '32px 28px', textAlign: 'center',
            maxWidth: 300, width: '85%',
          }}>
            <div style={{
              fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 16,
              color: '#fff', letterSpacing: '0.12em', marginBottom: 12,
            }}>End Mission?</div>
            <div style={{
              fontFamily: "'Rajdhani',sans-serif", fontSize: 14, fontWeight: 500,
              color: C.muted, lineHeight: 1.5, marginBottom: 24,
            }}>Only completed exercises will count toward your stats.</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setConfirmEnd(false)} style={{
                flex: 1, padding: '12px 0', borderRadius: 10,
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                color: C.text, fontFamily: "'Orbitron',sans-serif", fontWeight: 700,
                fontSize: 11, letterSpacing: '0.1em', cursor: 'pointer',
              }}>CANCEL</button>
              <button onClick={handleEndConfirm} style={{
                flex: 1, padding: '12px 0', borderRadius: 10,
                background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.5)',
                color: '#ef4444', fontFamily: "'Orbitron',sans-serif", fontWeight: 700,
                fontSize: 11, letterSpacing: '0.1em', cursor: 'pointer',
              }}>END MISSION</button>
            </div>
          </div>
        </div>
      )}
      {helpOpen && <ScreenGuide steps={SCREEN_GUIDES.quick_mission_active} onClose={() => setHelpOpen(false)}/>}
    </PhoneFrame>
  );
}

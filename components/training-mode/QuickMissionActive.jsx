import { useState, useEffect, useRef, useCallback } from 'react';
import PhoneFrame from './PhoneFrame';
import CornerHUD from './CornerHUD';
import { ChevronLeft, Pause, Play, SkipForward, Square } from 'lucide-react';
import { C } from './Styles';
import useWakeLock from './hooks/useWakeLock';
import useIntegritySession from './hooks/useIntegritySession';
import { speakAsync, cancelSpeech, primeSpeech, stopVoiceSession, delay, setVoiceGender } from './voiceCoach';
import { playBell, playBeep, unlockAudio } from './data/audioEngine';
import { generateQuickMission } from './fit-mode/quickMissionGenerator';
import { getCoachCopy } from './data/coachCopy';
import CadenceSlider, { CADENCE_PRESETS } from './shared/CadenceSlider';
import WorkoutHelpPanel, { HelpButton } from './shared/WorkoutHelpPanel';

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

function getPrepMessage(workoutType) {
  if (workoutType === 'Weighted') return 'Grab your weight and prepare.';
  if (workoutType === 'Hybrid') return 'Prepare your setup.';
  return 'Get in position.';
}

export default function QuickMissionActive({ missionCfg, profile, onEnd, initialPaused, onStateChange, initialResumeData }) {
  useWakeLock(true);
  const [mission] = useState(() => generateQuickMission(missionCfg));
  const allExercises = [...mission.exercises, ...mission.finisherExercises];

  const integrity = useIntegritySession('quickMission', missionCfg.rounds || 1);
  const integrityStartedRef = useRef(false);
  const [rapidWarning, setRapidWarning] = useState(null);

  const [phase, setPhase] = useState(initialResumeData?.phase ?? (initialPaused ? 'work' : 'intro'));
  const [round, setRound] = useState(initialResumeData?.round ?? 1);
  const [exIdx, setExIdx] = useState(initialResumeData?.exIdx ?? 0);
  const [remaining, setRemaining] = useState(() => {
    if (initialResumeData?.remaining != null) return initialResumeData.remaining;
    if (initialPaused) {
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

  const versionRef = useRef(0);
  const cadenceVersionRef = useRef(0);
  const restWarningRef = useRef(false);
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
      onStateChange({ phase, exIdx, round, remaining, exercisesCompleted, roundsCompleted });
    }
  }, [phase, exIdx, round, remaining, exercisesCompleted, roundsCompleted, onStateChange]);

  // Fix 4: voice from config, not profile
  const voiceOn = missionCfg.voiceOn !== false;
  const currentEx = allExercises[exIdx] || allExercises[0];
  const isWeighted = missionCfg.workoutType === 'Weighted' || missionCfg.workoutType === 'Hybrid';
  const currentCadenceEligible = isCadenceEligible(currentEx, missionCfg);

  // Fix 1: Refs for action functions to prevent stale closures in cadence loops
  const completeExerciseRef = useRef(null);
  const moveToNextRef = useRef(null);
  const skipExerciseRef = useRef(null);

  const stopCadence = () => {
    cadenceVersionRef.current++;
    setCadenceActive(false);
  };

  const startRestWithUpNext = (restDuration, completedRound, isRoundEnd, nextExIdx) => {
    restWarningRef.current = false;
    setPhase('rest');
    setRemaining(restDuration);

    if (!voiceOn) return;

    if (isRoundEnd) {
      // Fix 5: use allExercises.length - 1 so getNextExerciseInfo finds round+1's first exercise
      const nextExInfo = getNextExerciseInfo(allExercises, allExercises.length - 1, completedRound, mission.rounds);
      if (nextExInfo) {
        const prep = getPrepMessage(missionCfg.workoutType);
        speakAsync(`Round ${completedRound} complete. Rest. ${restDuration} seconds. Up next: Round ${completedRound + 1}. ${nextExInfo.exercise.name}. ${prep}`);
      } else {
        speakAsync(`Round ${completedRound} complete. Rest.`);
      }
    } else {
      const nextEx = allExercises[nextExIdx];
      if (nextEx) {
        const prep = getPrepMessage(missionCfg.workoutType);
        speakAsync(`Rest. ${restDuration} seconds. Up next: ${nextEx.name}. ${prep}`);
      } else {
        speakAsync('Rest.');
      }
    }
  };

  const completeExercise = () => {
    stopCadence();
    const idx = exIdxRef.current;
    const currentRound = roundRef.current;
    const ex = allExercises[idx];
    const nextIdx = idx + 1;

    setExercisesCompleted(c => c + 1);
    integrity.recordAction('complete');

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
    const exCadence = isCadenceEligible(ex, missionCfg);
    setPhase('work');

    if (ex.mode === 'timed') {
      setRemaining(ex.work);
    }

    if (voiceOn) {
      const target = ex.mode === 'timed' ? `${ex.work} seconds` : `${ex.reps} reps`;
      const cadenceIntro = exCadence ? ' On my count.' : '';
      speakAsync(`${ex.name}. ${target}.${cadenceIntro} Ready. Begin.`).then(() => {
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

  // Keep action refs fresh (Fix 1)
  useEffect(() => { completeExerciseRef.current = completeExercise; });
  useEffect(() => { moveToNextRef.current = moveToNext; });
  useEffect(() => { skipExerciseRef.current = skipExercise; });

  const startCadence = (exercise) => {
    const version = ++cadenceVersionRef.current;
    setCadenceActive(true);
    setCadenceRep(0);
    const targetReps = exercise.reps;

    const runCadenceLoop = async () => {
      for (let i = 1; i <= targetReps; i++) {
        if (cadenceVersionRef.current !== version) return;

        await delay(cadenceMsRef.current);

        if (cadenceVersionRef.current !== version) return;

        setCadenceRep(i);
        if (voiceOn) {
          await speakAsync(String(i));
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

    const runCadenceLoop = async () => {
      for (let i = startFrom + 1; i <= targetReps; i++) {
        if (cadenceVersionRef.current !== version) return;

        await delay(cadenceMsRef.current);

        if (cadenceVersionRef.current !== version) return;

        setCadenceRep(i);
        if (voiceOn) {
          await speakAsync(String(i));
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
    const firstCadence = isCadenceEligible(firstEx, missionCfg);

    if (firstEx.mode === 'timed') {
      setRemaining(firstEx.work);
    }

    if (voiceOn) {
      const target = firstEx.mode === 'timed'
        ? `${firstEx.work} seconds`
        : `${firstEx.reps} reps`;
      const cadenceIntro = firstCadence ? ' On my count.' : '';
      await speakAsync(`Round 1. ${firstEx.name}. ${target}.${cadenceIntro} Ready. Begin.`);
      if (aborted()) return;
    }

    if (firstCadence) {
      startCadence(firstEx);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceOn, isWeighted]);

  useEffect(() => {
    if (!initialPaused) runIntro();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { versionRef.current++; cadenceVersionRef.current++; cancelSpeech(); };
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
  }, [paused, done, phase, currentEx?.mode]);

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

  // Beeps at 3, 2, 1
  useEffect(() => {
    if (phase === 'intro' || done || paused) return;
    if (remaining >= 1 && remaining <= 3) {
      playBeep();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  // 10-second rest warning
  useEffect(() => {
    if (phase !== 'rest' || done || paused) return;
    if (remaining === 10 && !restWarningRef.current) {
      restWarningRef.current = true;
      if (voiceOn) speakAsync('10 seconds. Get ready.');
    }
  }, [remaining, phase, done, paused, voiceOn]);

  const handleCompleteRep = () => {
    if (phaseRef.current === 'work' && currentEx.mode === 'reps' && !cadenceActive) {
      completeExerciseRef.current?.();
    }
  };

  const handleSkip = () => {
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
  };

  const handleResume = () => {
    setPaused(false);
    integrity.resume();
    const idx = exIdxRef.current;
    const ex = allExercises[idx];
    if (phaseRef.current === 'work' && isCadenceEligible(ex, missionCfg) && ex.mode === 'reps' && cadenceRep > 0 && cadenceRep < ex.reps) {
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
        exercisesCompleted: exercisesCompletedRef.current + 1,
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
    const integrityResult = integrity.finalize();
    onEnd({
      completed: false,
      roundsCompleted: roundsCompletedRef.current,
      totalRounds: mission.rounds,
      exercisesCompleted: exercisesCompletedRef.current,
      totalExercises: allExercises.length * mission.rounds,
      mission,
      integrityResult,
    });
  };

  const ringSize = 380;
  const ringR = (ringSize - 20) / 2;
  const maxTime = phase === 'rest' ? (currentEx?.rest || 60) : (currentEx?.work || 30);
  const pct = maxTime > 0 ? remaining / maxTime : 0;
  const ringColor = phase === 'rest' ? '#4f8cff' : GOLD;

  const upNextExercise = phase === 'rest' ? allExercises[exIdx] : null;
  const showDoneButton = phase === 'work' && currentEx.mode === 'reps' && !cadenceActive && !currentCadenceEligible;
  const showManualDone = phase === 'work' && currentEx.mode === 'reps' && !cadenceActive && currentCadenceEligible && cadenceRep === 0 && !paused;

  return (
    <PhoneFrame useBrandBg>
      {/* Themed background art */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1, opacity: 0.1,
        backgroundImage: 'url(/assets/ring-conditioning.png)',
        backgroundSize: 'cover', backgroundPosition: 'center',
        filter: 'blur(2px) saturate(0.6)',
        pointerEvents: 'none',
      }}/>
      <CornerHUD color="rgba(253,224,71,0.3)" size={20} inset={10}/>

      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
        alignItems: 'center', minHeight: '100dvh',
        padding: '20px 16px calc(160px + env(safe-area-inset-bottom, 0px))',
        overflowX: 'hidden',
      }}>

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 12 }}>
          <button onClick={() => setConfirmEnd(true)} style={{ background: 'none', border: 'none', color: C.text, padding: 4 }}>
            <ChevronLeft size={24}/>
          </button>
          <div style={{
            fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 16,
            color: GOLD, letterSpacing: '0.15em',
            textShadow: '0 0 12px rgba(253,224,71,0.4)',
          }}>QUICK MISSION</div>
          <HelpButton onClick={() => setHelpOpen(true)} size={18}/>
        </div>

        {/* Mission title */}
        <div style={{
          fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 12,
          color: C.text, letterSpacing: '0.1em', marginBottom: 4,
        }}>{mission.title}</div>

        {/* Status strip */}
        <div style={{
          display: 'flex', gap: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 16,
          padding: '7px 16px', borderRadius: 8,
          background: 'rgba(15,5,30,0.7)', border: '1px solid rgba(253,224,71,0.15)',
        }}>
          <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 11, fontWeight: 700, color: GOLD, letterSpacing: '0.1em' }}>
            ROUND {round}/{mission.rounds}
          </span>
          <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 10, fontWeight: 600, color: C.muted }}>
            {missionCfg.workoutType.toUpperCase()}
          </span>
          <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 10, fontWeight: 600, color: C.muted }}>
            {missionCfg.difficulty.toUpperCase()}
          </span>
        </div>

        {/* Timer ring / Cadence display / Reps display */}
        {(phase === 'work' && currentEx.mode === 'timed') || phase === 'rest' ? (
          <div style={{ position: 'relative', width: ringSize, height: ringSize, marginBottom: 18 }}>
            <svg width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`}>
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
                fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 56,
                color: '#fff', textShadow: `0 0 20px ${ringColor}`,
              }}>{formatTime(remaining)}</div>
              <div style={{
                fontFamily: "'Orbitron',sans-serif", fontSize: 12, fontWeight: 700,
                color: ringColor, letterSpacing: '0.2em', marginTop: 8,
              }}>{phase === 'rest' ? 'REST' : 'WORK'}</div>
            </div>
          </div>
        ) : phase === 'work' && cadenceActive ? (
          <div style={{
            width: ringSize, height: ringSize, marginBottom: 18,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            borderRadius: '50%', border: `4px solid ${GOLD}55`,
            background: 'rgba(10,0,20,0.4)',
            boxShadow: '0 0 30px rgba(253,224,71,0.15)',
          }}>
            <div style={{
              fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 64,
              color: GOLD, textShadow: '0 0 20px rgba(253,224,71,0.5)',
            }}>{cadenceRep}</div>
            <div style={{
              fontFamily: "'Orbitron',sans-serif", fontSize: 12, fontWeight: 700,
              color: C.muted, letterSpacing: '0.15em', marginTop: 8,
            }}>REP {cadenceRep} / {currentEx.reps}</div>
          </div>
        ) : (
          <div style={{
            width: ringSize, height: ringSize, marginBottom: 18,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            borderRadius: '50%', border: `4px solid ${GOLD}33`,
            background: 'rgba(10,0,20,0.4)',
          }}>
            {phase === 'intro' ? (
              <div style={{
                fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 22,
                color: GOLD, letterSpacing: '0.1em',
              }}>PREPARING...</div>
            ) : (
              <>
                <div style={{
                  fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 52,
                  color: GOLD,
                }}>{currentEx.reps}</div>
                <div style={{
                  fontFamily: "'Orbitron',sans-serif", fontSize: 13, fontWeight: 700,
                  color: C.muted, letterSpacing: '0.15em', marginTop: 8,
                }}>REPS</div>
              </>
            )}
          </div>
        )}

        {/* Current exercise / Up Next card */}
        {phase !== 'intro' && (
          <div style={{
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
                  {upNextExercise.mode === 'timed'
                    ? `${upNextExercise.work}s`
                    : `${upNextExercise.reps} reps`}
                </div>
                <div style={{
                  fontFamily: "'Rajdhani',sans-serif", fontSize: 12, fontWeight: 500,
                  color: missionCfg.workoutType === 'Bodyweight' ? 'rgba(79,140,255,0.7)' : GOLD,
                  marginTop: 6,
                }}>
                  {missionCfg.workoutType === 'Weighted' ? 'Grab your weight.' : missionCfg.workoutType === 'Hybrid' ? 'Prepare your setup.' : 'Get in position.'}
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 7, color: C.muted, letterSpacing: '0.15em' }}>
                    EXERCISE {exIdx + 1}/{allExercises.length}
                  </span>
                  {phase === 'work' && currentEx.mode === 'reps' && (
                    <span style={{
                      fontFamily: "'Orbitron',sans-serif", fontSize: 7, fontWeight: 700,
                      color: cadenceActive ? '#22c55e' : 'rgba(255,255,255,0.4)',
                      letterSpacing: '0.08em',
                      padding: '2px 6px', borderRadius: 4,
                      background: cadenceActive ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${cadenceActive ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)'}`,
                    }}>
                      {cadenceActive ? 'CADENCE ON' : 'MANUAL REPS'}
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

        {/* Controls */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          {(showDoneButton || showManualDone) && (
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
          <button onClick={handlePauseToggle} style={{
            width: 70, height: 70, borderRadius: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: paused ? 'rgba(253,224,71,0.12)' : 'linear-gradient(135deg, rgba(253,224,71,0.3), rgba(253,224,71,0.15))',
            border: `1.5px solid ${paused ? GOLD : 'rgba(253,224,71,0.4)'}`,
            color: '#fff', cursor: 'pointer',
            boxShadow: paused ? 'none' : '0 0 20px rgba(253,224,71,0.2)',
          }}>
            {paused ? <Play size={28}/> : <Pause size={28}/>}
          </button>
          <button onClick={handleSkip} style={{
            width: 56, height: 56, borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(20,5,40,0.8)', border: '1px solid rgba(168,85,247,0.3)',
            color: C.neon, cursor: 'pointer',
          }}>
            <SkipForward size={22}/>
          </button>
          <button onClick={() => setConfirmEnd(true)} style={{
            width: 56, height: 56, borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)',
            color: '#ef4444', cursor: 'pointer',
          }}>
            <Square size={20}/>
          </button>
        </div>

        {/* Cadence speed control — only during rep/cadence sections */}
        {phase === 'work' && currentCadenceEligible && (
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
      <WorkoutHelpPanel contentKey="quick_mission_active" open={helpOpen} onClose={() => setHelpOpen(false)}/>
    </PhoneFrame>
  );
}

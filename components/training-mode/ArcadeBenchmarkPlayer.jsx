import { useState, useEffect, useRef, useCallback } from 'react';
import PhoneFrame from './PhoneFrame';
import BattleHUD from './shared/BattleHUD';
import { RotateCcw, MoveHorizontal as MoreHorizontal, Zap } from 'lucide-react';
import { C } from './Styles';
import { markBlockComplete, completeStage, recordInvalidAttempt } from './data/arcadeProgress';
import { addFitModeSession } from './data/userStats';
import { speakAsync, cancelSpeech, delay } from './voiceCoach';
import { playBeep } from './data/audioEngine';

const GOLD = C.yellow;
const MIN_CADENCE_MS = 750;
const MAX_CADENCE_MS = 4000;
const CADENCE_STEP = 250;

const BENCHMARK_STYLES = `
@keyframes bm-ring-pulse {
  0%, 100% { filter: drop-shadow(0 0 8px rgba(253,224,71,0.25)); }
  50% { filter: drop-shadow(0 0 18px rgba(253,224,71,0.5)); }
}
@keyframes bm-rep-pop {
  0% { transform: scale(1); }
  50% { transform: scale(1.12); }
  100% { transform: scale(1); }
}
@keyframes bm-rest-glow {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
}
@keyframes bm-fade-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes bm-countdown-pop {
  0% { opacity: 0; transform: scale(0.5); }
  50% { opacity: 1; transform: scale(1.2); }
  100% { opacity: 1; transform: scale(1); }
}
`;

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getCurrentRank(elapsedSec, tiers) {
  const minutes = elapsedSec / 60;
  for (const tier of tiers) {
    if (minutes <= tier.maxMinutes) return tier;
  }
  return tiers[tiers.length - 1] || { rank: 'Clear', label: 'Clear', points: 100 };
}

function getRankColor(rank) {
  if (rank === 'S') return '#fde047';
  if (rank === 'A') return '#22c55e';
  if (rank === 'B') return '#3b82f6';
  if (rank === 'C') return '#f59e0b';
  return C.muted;
}

function CircularProgress({ progress, size = 200, strokeWidth = 10, color, bgColor, children }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(progress, 1));

  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', animation: 'bm-ring-pulse 3s ease-in-out infinite' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={bgColor || 'rgba(253,224,71,0.08)'} strokeWidth={strokeWidth}/>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color || GOLD} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.3s ease', filter: `drop-shadow(0 0 6px ${color || GOLD})` }}/>
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>{children}</div>
    </div>
  );
}

function formatCadenceCount(num) {
  const ones = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
  const teens = {
    10: "ten", 11: "eleven", 12: "twelve", 13: "thirteen", 14: "fourteen",
    15: "fifteen", 16: "sixteen", 17: "seventeen", 18: "eighteen", 19: "nineteen"
  };
  const tens = {
    20: "twenty", 30: "thirty", 40: "forty", 50: "fifty",
    60: "sixty", 70: "seventy", 80: "eighty", 90: "ninety"
  };

  function twoDigit(n) {
    if (n < 10) return ones[n];
    if (n < 20) return teens[n];
    const t = Math.floor(n / 10) * 10;
    const o = n % 10;
    return o === 0 ? tens[t] : `${tens[t]} ${ones[o]}`;
  }

  if (num < 100) return twoDigit(num);

  const h = Math.floor(num / 100);
  const rest = num % 100;

  if (rest === 0) return `${ones[h]} hundred`;
  if (rest < 10) return `${ones[h]} oh ${ones[rest]}`;
  return `${ones[h]} ${twoDigit(rest)}`;
}

export default function ArcadeBenchmarkPlayer({ series, stage, arcadeSettings, onComplete, onExit, onStateChange }) {
  const tasks = stage?.fitBlock?.tasks || [];
  const tiers = stage?.scoringTiers || [];
  const minValid = stage?.minValidSeconds || 180;
  const cadenceLocked = stage?.cadenceLocked || false;
  const selectedRestSeconds = arcadeSettings?.restSeconds || tasks[0]?.restSeconds || 30;
  const voiceEnabled = arcadeSettings?.voiceCoach !== false && arcadeSettings?.sound !== 'off';
  const cadenceCountEnabled = arcadeSettings?.cadenceCount !== false;

  function announce(text) {
    setAnnouncerText(text);
    if (voiceEnabled) speakAsync(text);
  }

  const [taskIdx, setTaskIdx] = useState(0);
  const [currentRep, setCurrentRep] = useState(0);
  const [phase, setPhase] = useState('intro'); // intro | countdown | active | rest | complete
  const [countdownVal, setCountdownVal] = useState(3);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [restTimer, setRestTimer] = useState(0);
  const [cadenceMs, setCadenceMs] = useState(() => arcadeSettings?.cadenceMs || tasks[0]?.cadenceMs || 2000);
  const [announcerText, setAnnouncerText] = useState('');
  const [confirmStop, setConfirmStop] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [showBackup, setShowBackup] = useState(false);

  const cadenceVersionRef = useRef(0);
  const elapsedRef = useRef(null);
  const restRef = useRef(null);
  const repRef = useRef(0);
  const pausedRef = useRef(false);
  const phaseRef = useRef('intro');
  const taskIdxRef = useRef(0);
  const cadenceMsRef = useRef(cadenceMs);
  const voiceEnabledRef = useRef(voiceEnabled);
  const cadenceCountEnabledRef = useRef(cadenceCountEnabled);
  const benchmarkStartedAtRef = useRef(null);
  const totalPausedMsRef = useRef(0);
  const pauseStartedAtRef = useRef(null);
  const elapsedValueRef = useRef(0);

  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { taskIdxRef.current = taskIdx; }, [taskIdx]);
  useEffect(() => { cadenceMsRef.current = cadenceMs; }, [cadenceMs]);
  useEffect(() => { voiceEnabledRef.current = voiceEnabled; }, [voiceEnabled]);
  useEffect(() => { cadenceCountEnabledRef.current = cadenceCountEnabled; }, [cadenceCountEnabled]);
  useEffect(() => { elapsedValueRef.current = elapsed; }, [elapsed]);

  const task = tasks[taskIdx];
  const targetReps = task?.reps || 100;
  const totalTasks = tasks.length;
  const nextTask = taskIdx + 1 < totalTasks ? tasks[taskIdx + 1] : null;

  // Total elapsed timer - runs from intro completion to end
  useEffect(() => {
    if (phase === 'intro') return;
    if (phase === 'complete') { clearInterval(elapsedRef.current); return; }
    if (paused) { clearInterval(elapsedRef.current); return; }
    elapsedRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(elapsedRef.current);
  }, [phase, paused]);

  // State change reporting
  useEffect(() => {
    if (typeof onStateChange === 'function') {
      onStateChange({ taskIdx, currentRep, elapsed, phase });
    }
  }, [taskIdx, currentRep, elapsed, phase, onStateChange]);

  // Intro phase
  useEffect(() => {
    if (phase !== 'intro') return;
    announce('Stage 1. Hero Entry Test. Push-ups, squats, and sit-ups. Complete 100 reps each. Get ready.');
    const t = setTimeout(() => {
      benchmarkStartedAtRef.current = Date.now();
      totalPausedMsRef.current = 0;
      pauseStartedAtRef.current = null;
      setPhase('countdown');
      setCountdownVal(3);
    }, 4000);
    return () => { clearTimeout(t); cancelSpeech(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Countdown phase
  useEffect(() => {
    if (phase !== 'countdown') return;
    if (countdownVal <= 0) {
      setPhase('active');
      announceExerciseStart();
      startCadenceLoop();
      return;
    }
    const t = setTimeout(() => {
      setCountdownVal(v => v - 1);
      if (countdownVal === 3) {
        const taskTitle = tasks[taskIdxRef.current]?.title || 'Exercise';
        const reps = tasks[taskIdxRef.current]?.reps || 100;
        announce(`${taskTitle}. ${reps} reps. Follow the count.`);
      }
    }, 900);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, countdownVal]);

  // Rest countdown
  useEffect(() => {
    if (phase !== 'rest') { clearInterval(restRef.current); return; }
    setRestTimer(0);
    const nextTitle = nextTask?.title || 'the next exercise';
    announce(`Rest. Next workout is ${nextTitle}. If you need more rest, pause before the next session.`);
    restRef.current = setInterval(() => {
      setRestTimer(t => {
        if (t + 1 >= selectedRestSeconds) {
          clearInterval(restRef.current);
          advanceToNextExercise();
          return selectedRestSeconds;
        }
        return t + 1;
      });
    }, 1000);
    return () => clearInterval(restRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function announceExerciseStart() {
    const t = tasks[taskIdxRef.current];
    if (t) {
      setAnnouncerText(`${t.title}. ${t.reps} reps.`);
    }
  }

  function advanceToNextExercise() {
    const nextIdx = taskIdxRef.current + 1;
    if (nextIdx >= totalTasks) {
      handleBenchmarkComplete();
      return;
    }
    setTaskIdx(nextIdx);
    repRef.current = 0;
    setCurrentRep(0);
    setPhase('countdown');
    setCountdownVal(3);
  }

  const startCadenceLoop = useCallback(() => {
    const version = ++cadenceVersionRef.current;
    repRef.current = 0;
    setCurrentRep(0);
    setAnnouncerText('Begin!');

    const runLoop = async () => {
      await delay(400);
      if (cadenceVersionRef.current !== version) return;

      const target = tasks[taskIdxRef.current]?.reps || 100;

      for (let i = 1; i <= target; i++) {
        if (cadenceVersionRef.current !== version) return;

        const waitStart = Date.now();
        const targetWait = cadenceMsRef.current;
        while (Date.now() - waitStart < targetWait) {
          if (cadenceVersionRef.current !== version) return;
          if (pausedRef.current) {
            await delay(100);
            continue;
          }
          const remaining = targetWait - (Date.now() - waitStart);
          if (remaining > 50) {
            await delay(Math.min(50, remaining));
          } else {
            break;
          }
        }

        if (cadenceVersionRef.current !== version) return;
        if (pausedRef.current) {
          while (pausedRef.current) {
            if (cadenceVersionRef.current !== version) return;
            await delay(100);
          }
        }

        repRef.current = i;
        setCurrentRep(i);
        const countText = formatCadenceCount(i);
        setAnnouncerText(countText);
        playBeep();
        if (cadenceCountEnabledRef.current && voiceEnabledRef.current) {
          speakAsync(countText, { rate: 1.45 });
        }

        if (cadenceVersionRef.current !== version) return;
      }

      if (cadenceVersionRef.current !== version) return;
      const taskTitle = tasks[taskIdxRef.current]?.title || 'Exercise';
      announce(`${taskTitle} complete!`);
      await delay(800);
      if (cadenceVersionRef.current !== version) return;

      // Check if there's a next exercise
      if (taskIdxRef.current + 1 < totalTasks) {
        setPhase('rest');
      } else {
        handleBenchmarkComplete();
      }
    };

    runLoop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalTasks]);

  const resumeCadenceLoop = useCallback(() => {
    const version = ++cadenceVersionRef.current;
    const startFrom = repRef.current;
    const target = tasks[taskIdxRef.current]?.reps || 100;

    const runLoop = async () => {
      for (let i = startFrom + 1; i <= target; i++) {
        if (cadenceVersionRef.current !== version) return;

        const waitStart = Date.now();
        const targetWait = cadenceMsRef.current;
        while (Date.now() - waitStart < targetWait) {
          if (cadenceVersionRef.current !== version) return;
          if (pausedRef.current) {
            await delay(100);
            continue;
          }
          const remaining = targetWait - (Date.now() - waitStart);
          if (remaining > 50) {
            await delay(Math.min(50, remaining));
          } else {
            break;
          }
        }

        if (cadenceVersionRef.current !== version) return;

        repRef.current = i;
        setCurrentRep(i);
        const countText = formatCadenceCount(i);
        setAnnouncerText(countText);
        playBeep();
        if (cadenceCountEnabledRef.current && voiceEnabledRef.current) {
          speakAsync(countText, { rate: 1.45 });
        }

        if (cadenceVersionRef.current !== version) return;
      }

      if (cadenceVersionRef.current !== version) return;
      const taskTitle = tasks[taskIdxRef.current]?.title || 'Exercise';
      announce(`${taskTitle} complete!`);
      await delay(800);
      if (cadenceVersionRef.current !== version) return;

      if (taskIdxRef.current + 1 < totalTasks) {
        setPhase('rest');
      } else {
        handleBenchmarkComplete();
      }
    };

    runLoop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalTasks]);

  function handleBenchmarkComplete() {
    cadenceVersionRef.current++;
    cancelSpeech();
    clearInterval(elapsedRef.current);
    clearInterval(restRef.current);
    setPhase('complete');
    announce('Benchmark complete.');

    let pausedMs = totalPausedMsRef.current;
    if (pauseStartedAtRef.current != null) {
      pausedMs += Date.now() - pauseStartedAtRef.current;
      pauseStartedAtRef.current = null;
    }
    const wallElapsed = benchmarkStartedAtRef.current
      ? Math.floor((Date.now() - benchmarkStartedAtRef.current - pausedMs) / 1000)
      : 0;
    const elapsedSeconds = Math.max(elapsedValueRef.current || 0, wallElapsed, 0);

    setTimeout(() => {
      if (elapsedSeconds < minValid) {
        recordInvalidAttempt(series.id, stage.id, 'tooFast');
        onComplete({
          invalid: true,
          reason: `Too Fast to Verify \u2014 No XP Awarded. Completed in ${formatTime(elapsedSeconds)}. Minimum valid time is ${Math.floor(minValid / 60)} minutes.`,
          elapsed: elapsedSeconds,
          elapsedSeconds,
          validationTimeSeconds: elapsedSeconds,
        });
        return;
      }

      markBlockComplete(series.id, stage.id, 'fit');
      addFitModeSession(3, 3);

      const rank = getCurrentRank(elapsedSeconds, tiers);
      const xpToAward = rank.points || stage?.basePoints || stage?.rewards?.xp || 100;
      completeStage(series.id, stage.id, xpToAward, stage?.rewards?.badge, stage?.rewards?.title, stage?.rewards?.statRewards);

      onComplete({
        invalid: false,
        rank: rank.rank,
        rankLabel: rank.label,
        points: xpToAward,
        xpEarned: xpToAward,
        elapsed: elapsedSeconds,
        elapsedSeconds,
        validationTimeSeconds: elapsedSeconds,
        statRewards: stage?.rewards?.statRewards || null,
      });
    }, 1500);
  }

  const handlePause = useCallback(() => {
    cancelSpeech();
    if (pauseStartedAtRef.current == null) pauseStartedAtRef.current = Date.now();
    setPaused(true);
    setAnnouncerText('Paused');
  }, []);

  const handleResume = useCallback(() => {
    if (pauseStartedAtRef.current != null) {
      totalPausedMsRef.current += Date.now() - pauseStartedAtRef.current;
      pauseStartedAtRef.current = null;
    }
    setPaused(false);
    setAnnouncerText('Resume!');
  }, []);

  const handlePauseToggle = useCallback(() => {
    if (paused) handleResume();
    else handlePause();
  }, [paused, handlePause, handleResume]);

  const handleRewind = useCallback(() => {
    cancelSpeech();
    const newRep = Math.max(0, repRef.current - 5);
    repRef.current = newRep;
    setCurrentRep(newRep);
    setAnnouncerText(newRep === 0 ? 'Restarting exercise...' : `Back to rep ${newRep}`);
    cadenceVersionRef.current++;
    if (!paused && phase === 'active') {
      resumeCadenceLoop();
    }
  }, [paused, phase, resumeCadenceLoop]);

  const handleResetExercise = useCallback(() => {
    setConfirmReset(true);
  }, []);

  const handleResetConfirm = useCallback(() => {
    setConfirmReset(false);
    cancelSpeech();
    cadenceVersionRef.current++;
    repRef.current = 0;
    setCurrentRep(0);
    setPaused(false);
    setPhase('countdown');
    setCountdownVal(3);
    setAnnouncerText('Restarting exercise...');
  }, []);

  const handleStop = useCallback(() => {
    setConfirmStop(true);
  }, []);

  const handleStopConfirm = useCallback(() => {
    cadenceVersionRef.current++;
    cancelSpeech();
    clearInterval(elapsedRef.current);
    clearInterval(restRef.current);
    onExit();
  }, [onExit]);

  const handleCadenceChange = useCallback((e) => {
    if (cadenceLocked) return;
    setCadenceMs(Number(e.target.value));
  }, [cadenceLocked]);

  const handleSkipRest = useCallback(() => {
    clearInterval(restRef.current);
    advanceToNextExercise();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Battle HUD "SET COMPLETE": user finished the movement ahead of the count —
  // jump reps to target, stop the cadence loop, and advance (rest or finish).
  const handleSetComplete = useCallback(() => {
    if (phaseRef.current !== 'active') return;
    cadenceVersionRef.current++;
    cancelSpeech();
    const t = tasks[taskIdxRef.current];
    const target = t?.reps || 100;
    repRef.current = target;
    setCurrentRep(target);
    announce(`${t?.title || 'Exercise'} complete!`);
    setTimeout(() => {
      if (phaseRef.current !== 'active') return;
      if (taskIdxRef.current + 1 < totalTasks) setPhase('rest');
      else handleBenchmarkComplete();
    }, 700);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalTasks]);

  // Backup manual controls
  const handleManualAdd = useCallback((n) => {
    const target = tasks[taskIdxRef.current]?.reps || 100;
    const newRep = Math.min(repRef.current + n, target);
    repRef.current = newRep;
    setCurrentRep(newRep);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      cadenceVersionRef.current++;
      cancelSpeech();
      clearInterval(elapsedRef.current);
      clearInterval(restRef.current);
    };
  }, []);

  const currentRank = getCurrentRank(elapsed, tiers);
  const cadenceLabel = cadenceMs <= 1000 ? 'FAST' : cadenceMs <= 1500 ? 'QUICK' : cadenceMs <= 2500 ? 'MODERATE' : 'SLOW';

  // Intro screen
  if (phase === 'intro') {
    return (
      <PhoneFrame useBrandBg>
        <style dangerouslySetInnerHTML={{ __html: BENCHMARK_STYLES }}/>
        <div style={{
          position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          minHeight: '100dvh', padding: '20px 16px', textAlign: 'center',
          animation: 'bm-fade-in 0.4s ease',
        }}>
          <div style={{
            fontFamily: "'Orbitron',sans-serif", fontSize: 9, fontWeight: 700,
            color: GOLD, letterSpacing: '0.2em', marginBottom: 8,
          }}>ONE PUNCH PROTOCOL</div>
          <div style={{
            fontFamily: "'Orbitron',sans-serif", fontSize: 20, fontWeight: 900,
            color: C.text, letterSpacing: '0.08em', marginBottom: 6,
          }}>HERO ENTRY TEST</div>
          <div style={{
            fontFamily: "'Rajdhani',sans-serif", fontSize: 12, color: C.muted, marginBottom: 20,
          }}>Push-ups, Squats, Sit-ups. 100 reps each.</div>
          <CircularProgress progress={0} size={160} color="rgba(253,224,71,0.3)" bgColor="rgba(253,224,71,0.06)">
            <Zap size={32} color={GOLD}/>
          </CircularProgress>
          <div style={{
            marginTop: 16, padding: '8px 14px', borderRadius: 8,
            background: 'rgba(10,0,20,0.7)', border: '1px solid rgba(253,224,71,0.15)',
          }}>
            <p style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 12, color: C.muted, margin: 0 }}>
              {announcerText}
            </p>
          </div>
        </div>
      </PhoneFrame>
    );
  }

  // Countdown phase
  if (phase === 'countdown') {
    return (
      <PhoneFrame useBrandBg>
        <style dangerouslySetInnerHTML={{ __html: BENCHMARK_STYLES }}/>
        <div style={{
          position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          minHeight: '100dvh', padding: '20px 16px', textAlign: 'center',
          animation: 'bm-fade-in 0.3s ease',
        }}>
          {/* Benchmark timer */}
          <div style={{
            position: 'absolute', top: 20, right: 20,
            fontFamily: "'Orbitron',sans-serif", fontSize: 11, fontWeight: 700, color: C.muted,
          }}>{formatTime(elapsed)}</div>

          <div style={{
            fontFamily: "'Orbitron',sans-serif", fontSize: 9, fontWeight: 700,
            color: GOLD, letterSpacing: '0.15em', marginBottom: 8,
          }}>EXERCISE {taskIdx + 1}/{totalTasks}</div>
          <div style={{
            fontFamily: "'Orbitron',sans-serif", fontSize: 14, fontWeight: 900,
            color: C.text, marginBottom: 16,
          }}>{task?.title}</div>

          <CircularProgress progress={0} size={180} color="rgba(253,224,71,0.4)" bgColor="rgba(253,224,71,0.06)">
            <div style={{
              fontFamily: "'Orbitron',sans-serif", fontSize: 52, fontWeight: 900,
              color: GOLD, animation: 'bm-countdown-pop 0.6s ease-in-out',
              textShadow: '0 0 16px rgba(253,224,71,0.5)',
            }}>{countdownVal || 'GO'}</div>
          </CircularProgress>

          <div style={{
            marginTop: 16, padding: '8px 14px', borderRadius: 8,
            background: 'rgba(10,0,20,0.7)', border: '1px solid rgba(253,224,71,0.15)',
          }}>
            <p style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 12, color: C.muted, margin: 0 }}>
              {announcerText}
            </p>
          </div>
        </div>
      </PhoneFrame>
    );
  }

  // Rest phase
  if (phase === 'rest') {
    const restProgress = restTimer / selectedRestSeconds;
    const nextTitle = nextTask?.title || 'Next';
    return (
      <PhoneFrame useBrandBg>
        <style dangerouslySetInnerHTML={{ __html: BENCHMARK_STYLES }}/>
        <div style={{
          position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          minHeight: '100dvh', padding: '20px 16px', textAlign: 'center',
          animation: 'bm-fade-in 0.3s ease',
        }}>
          {/* Benchmark timer */}
          <div style={{
            position: 'absolute', top: 20, right: 20,
            padding: '4px 10px', borderRadius: 6,
            background: 'rgba(253,224,71,0.06)', border: '1px solid rgba(253,224,71,0.15)',
          }}>
            <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 11, fontWeight: 700, color: GOLD }}>
              {formatTime(elapsed)}
            </span>
          </div>

          <div style={{
            fontFamily: "'Orbitron',sans-serif", fontSize: 10, fontWeight: 700, color: '#4f8cff',
            letterSpacing: '0.2em', marginBottom: 14, animation: 'bm-rest-glow 1.5s ease-in-out infinite',
          }}>REST</div>

          <CircularProgress progress={restProgress} size={170} color="#4f8cff" bgColor="rgba(79,140,255,0.08)">
            <div style={{
              fontFamily: "'Orbitron',sans-serif", fontSize: 38, fontWeight: 900, color: C.text,
              textShadow: '0 0 12px rgba(79,140,255,0.4)',
            }}>{selectedRestSeconds - restTimer}</div>
            <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 11, color: C.muted, marginTop: 2 }}>seconds</div>
          </CircularProgress>

          {/* Next exercise preview */}
          <div style={{
            marginTop: 14, padding: '8px 14px', borderRadius: 8,
            background: 'rgba(253,224,71,0.04)', border: '1px solid rgba(253,224,71,0.12)',
          }}>
            <span style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 6, color: C.muted, letterSpacing: '0.15em' }}>
              NEXT UP
            </span>
            <p style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 11, fontWeight: 700, color: GOLD, margin: '4px 0 0' }}>
              {nextTitle} ({nextTask?.reps || 100} reps)
            </p>
          </div>

          {/* Announcer */}
          <div style={{
            marginTop: 10, padding: '8px 14px', borderRadius: 8,
            background: 'rgba(10,0,20,0.7)', border: '1px solid rgba(79,140,255,0.15)',
          }}>
            <p style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 12, color: C.muted, margin: 0 }}>
              {announcerText}
            </p>
          </div>

          {/* Skip rest */}
          <button onClick={handleSkipRest} style={{
            marginTop: 12, padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: 'rgba(79,140,255,0.12)', fontFamily: "'Orbitron',sans-serif",
            fontWeight: 700, fontSize: 9, color: '#4f8cff', letterSpacing: '0.1em',
          }}>SKIP REST</button>

          {/* Rank window */}
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: getRankColor(currentRank.rank),
              boxShadow: `0 0 6px ${getRankColor(currentRank.rank)}`,
            }}/>
            <span style={{
              fontFamily: "'Orbitron',sans-serif", fontSize: 8, fontWeight: 700,
              color: getRankColor(currentRank.rank), letterSpacing: '0.1em',
            }}>{currentRank.label} WINDOW</span>
          </div>
        </div>
      </PhoneFrame>
    );
  }

  // Complete phase (brief transition)
  if (phase === 'complete') {
    return (
      <PhoneFrame useBrandBg>
        <style dangerouslySetInnerHTML={{ __html: BENCHMARK_STYLES }}/>
        <div style={{
          position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          minHeight: '100dvh', padding: '20px 16px', textAlign: 'center',
          animation: 'bm-fade-in 0.3s ease',
        }}>
          <div style={{
            fontFamily: "'Orbitron',sans-serif", fontSize: 22, fontWeight: 900,
            color: GOLD, letterSpacing: '0.12em',
            textShadow: '0 0 16px rgba(253,224,71,0.5)',
          }}>BENCHMARK COMPLETE</div>
          <div style={{
            marginTop: 12, fontFamily: "'Orbitron',sans-serif", fontSize: 32, fontWeight: 900, color: C.text,
          }}>{formatTime(elapsed)}</div>
          <div style={{
            marginTop: 8, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: getRankColor(currentRank.rank),
              boxShadow: `0 0 8px ${getRankColor(currentRank.rank)}`,
            }}/>
            <span style={{
              fontFamily: "'Orbitron',sans-serif", fontSize: 12, fontWeight: 700,
              color: getRankColor(currentRank.rank),
            }}>{currentRank.label}</span>
          </div>
        </div>
      </PhoneFrame>
    );
  }

  // Active phase — 31a Battle HUD (stage-as-boss). All counting/voice logic
  // above is unchanged; this is a presentational skin over it.
  const totalRepsAll = tasks.reduce((s, t) => s + (t.reps || 0), 0) || 1;
  const doneReps = tasks.slice(0, taskIdx).reduce((s, t) => s + (t.reps || 0), 0) + currentRep;
  const targetTier = tiers.find(t => Number.isFinite(t.maxMinutes));
  const targetSec = targetTier ? targetTier.maxMinutes * 60 : null;
  const ahead = targetSec ? (doneReps / totalRepsAll) >= (elapsed / targetSec) : true;
  const paceLabel = ({ S: 'PERFECT PACE', A: 'GREAT PACE', B: 'ON PACE', C: 'GRIND IT OUT' })[currentRank.rank] || 'FINISH STRONG';
  const starsInReach = ({ S: '★★★', A: '★★', B: '★' })[currentRank.rank] || null;

  const hudExtras = (
    <div style={{ flexShrink: 0 }}>
      {/* Slim cadence slider */}
      <div style={{ padding: '0 4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
          <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 7, fontWeight: 700, color: C.muted, letterSpacing: '0.14em' }}>CADENCE · {cadenceLabel}</span>
          <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 8.5, fontWeight: 700, color: cadenceLocked ? 'rgba(239,68,68,0.7)' : GOLD }}>
            {cadenceLocked ? 'LOCKED' : `${(cadenceMs / 1000).toFixed(2)}s`}
          </span>
        </div>
        <input
          type="range"
          min={MIN_CADENCE_MS}
          max={MAX_CADENCE_MS}
          step={CADENCE_STEP}
          value={cadenceMs}
          onChange={handleCadenceChange}
          disabled={cadenceLocked}
          style={{
            width: '100%', height: 5, borderRadius: 999, outline: 'none',
            background: cadenceLocked
              ? 'rgba(239,68,68,0.15)'
              : `linear-gradient(90deg, #a855f7 0%, ${GOLD} ${((cadenceMs - MIN_CADENCE_MS) / (MAX_CADENCE_MS - MIN_CADENCE_MS)) * 100}%, rgba(255,255,255,0.08) ${((cadenceMs - MIN_CADENCE_MS) / (MAX_CADENCE_MS - MIN_CADENCE_MS)) * 100}%, rgba(255,255,255,0.08) 100%)`,
            opacity: cadenceLocked ? 0.5 : 1,
            cursor: cadenceLocked ? 'not-allowed' : 'pointer',
          }}
        />
      </div>

      {/* Backup controls toggle */}
      <button onClick={() => setShowBackup(!showBackup)} style={{
        marginTop: 4, background: 'none', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, width: '100%',
      }}>
        <MoreHorizontal size={13} color={C.muted}/>
        <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 9.5, color: C.muted }}>
          {showBackup ? 'Hide Backup' : 'Backup Controls'}
        </span>
      </button>

      {showBackup && (
        <div style={{
          marginTop: 4, padding: '8px 10px', borderRadius: 10,
          background: 'rgba(10,0,20,0.6)', border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={handleRewind} style={{
              flex: 1, padding: '7px 0', borderRadius: 6, border: '1px solid rgba(168,85,247,0.3)', cursor: 'pointer',
              background: 'rgba(10,0,20,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 8, color: C.neon,
            }}><RotateCcw size={11} color={C.neon}/> -5</button>
            <button onClick={() => handleManualAdd(1)} style={{
              flex: 1, padding: '7px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: 'rgba(253,224,71,0.06)', fontFamily: "'Orbitron',sans-serif",
              fontWeight: 700, fontSize: 9, color: GOLD,
            }}>+1</button>
            <button onClick={() => handleManualAdd(5)} style={{
              flex: 1, padding: '7px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: 'rgba(168,85,247,0.06)', fontFamily: "'Orbitron',sans-serif",
              fontWeight: 700, fontSize: 9, color: '#a855f7',
            }}>+5</button>
            <button onClick={() => handleManualAdd(10)} style={{
              flex: 1, padding: '7px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: 'rgba(59,130,246,0.06)', fontFamily: "'Orbitron',sans-serif",
              fontWeight: 700, fontSize: 9, color: '#3b82f6',
            }}>+10</button>
            <button onClick={handleResetExercise} style={{
              flex: 1, padding: '7px 0', borderRadius: 6, border: '1px solid rgba(245,158,11,0.3)', cursor: 'pointer',
              background: 'rgba(10,0,20,0.7)', fontFamily: "'Orbitron',sans-serif",
              fontWeight: 900, fontSize: 8, color: '#f59e0b',
            }}>RST</button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <PhoneFrame useBrandBg>
      <style dangerouslySetInnerHTML={{ __html: BENCHMARK_STYLES }}/>
      <BattleHUD
        stageNumber={stage?.stageNumber || 1}
        stageTitle={stage?.title}
        hp={Math.max(0, 1 - doneReps / totalRepsAll)}
        move={task?.title}
        rep={currentRep}
        target={targetReps}
        combo={currentRep}
        paceLabel={paceLabel}
        elapsedLabel={formatTime(elapsed)}
        targetLabel={targetSec ? formatTime(targetSec) : null}
        barFrac={doneReps / totalRepsAll}
        ahead={ahead}
        starsInReach={starsInReach}
        nextLabel={nextTask ? `${nextTask.title.toUpperCase()} ×${nextTask.reps}` : 'FINAL SET — STAGE CLEAR'}
        nextSub={nextTask ? `after ${selectedRestSeconds}s rest` : null}
        announcerText={announcerText}
        paused={paused}
        onSetComplete={handleSetComplete}
        onPauseToggle={handlePauseToggle}
        onStop={handleStop}
        extras={hudExtras}
      />

      {/* Stop confirmation modal */}
      {confirmStop && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(5,0,15,0.88)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(6px)',
        }}>
          <div style={{
            background: 'rgba(15,5,30,0.95)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 16, padding: '28px 24px', textAlign: 'center',
            maxWidth: 280, width: '85%',
          }}>
            <div style={{
              fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 14,
              color: '#fff', letterSpacing: '0.1em', marginBottom: 10,
            }}>End Benchmark?</div>
            <div style={{
              fontFamily: "'Rajdhani',sans-serif", fontSize: 13, fontWeight: 500,
              color: C.muted, lineHeight: 1.5, marginBottom: 20,
            }}>Progress may not be saved.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmStop(false)} style={{
                flex: 1, padding: '11px 0', borderRadius: 10,
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                color: C.text, fontFamily: "'Orbitron',sans-serif", fontWeight: 700,
                fontSize: 10, letterSpacing: '0.1em', cursor: 'pointer',
              }}>CANCEL</button>
              <button onClick={handleStopConfirm} style={{
                flex: 1, padding: '11px 0', borderRadius: 10,
                background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.5)',
                color: '#ef4444', fontFamily: "'Orbitron',sans-serif", fontWeight: 700,
                fontSize: 10, letterSpacing: '0.1em', cursor: 'pointer',
              }}>END</button>
            </div>
          </div>
        </div>
      )}

      {/* Reset exercise confirmation modal */}
      {confirmReset && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(5,0,15,0.88)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(6px)',
        }}>
          <div style={{
            background: 'rgba(15,5,30,0.95)', border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: 16, padding: '28px 24px', textAlign: 'center',
            maxWidth: 280, width: '85%',
          }}>
            <div style={{
              fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 14,
              color: '#fff', letterSpacing: '0.1em', marginBottom: 10,
            }}>Reset Exercise?</div>
            <div style={{
              fontFamily: "'Rajdhani',sans-serif", fontSize: 13, fontWeight: 500,
              color: C.muted, lineHeight: 1.5, marginBottom: 20,
            }}>This will restart {task?.title} from 0 reps.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmReset(false)} style={{
                flex: 1, padding: '11px 0', borderRadius: 10,
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                color: C.text, fontFamily: "'Orbitron',sans-serif", fontWeight: 700,
                fontSize: 10, letterSpacing: '0.1em', cursor: 'pointer',
              }}>CANCEL</button>
              <button onClick={handleResetConfirm} style={{
                flex: 1, padding: '11px 0', borderRadius: 10,
                background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.5)',
                color: '#f59e0b', fontFamily: "'Orbitron',sans-serif", fontWeight: 700,
                fontSize: 10, letterSpacing: '0.1em', cursor: 'pointer',
              }}>RESET</button>
            </div>
          </div>
        </div>
      )}
    </PhoneFrame>
  );
}

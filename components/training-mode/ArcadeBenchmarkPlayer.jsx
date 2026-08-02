import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PhoneFrame from './PhoneFrame';
import StageChrome from './shared/StageChrome';
import { RotateCcw, MoveHorizontal as MoreHorizontal, Zap, Play, Pause } from 'lucide-react';
import { C } from './Styles';
import { markBlockComplete, completeStage, recordInvalidAttempt } from './data/arcadeProgress';
import { getStarsForTime } from './data/trainingArcadeData';
import { addFitModeSession } from './data/userStats';
import { logBenchmark, CATEGORY_TO_BASELINE_KEY } from './data/benchmarkLog';
import { speakAsync, cancelSpeech, delay } from './voiceCoach';
import { playBeep } from './data/audioEngine';
import { waitUnpaused, awaitResume } from './shared/pausableWait';

// OP-1 — stage 1 is a MAX-OUT TESTER, not a 100-rep wall. Per exercise the
// athlete picks COUNT FOR ME (cadence counts UP from zero, no target) or ON MY
// OWN (free timer, they enter the number at the end), hits I'M MAXED when
// done, and the three results are logged as their baseline
// (data/benchmarkLog.js). The stage ALWAYS clears — completion means tested.
// Athletes who do reach 100/100/100 still earn the original S/A/B time ranks;
// everyone else gets the baseline path with no rank shown.

const GOLD = C.yellow;
const MIN_CADENCE_MS = 750;
const MAX_CADENCE_MS = 4000;
const CADENCE_STEP = 250;
// Count-up safety cap — nobody is cadence-counting a thousand reps.
const MAXOUT_CAP = 999;
const RANK_TARGET = 100;

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

const btnPrimary = {
  width: '100%', padding: '13px 0', borderRadius: 11, border: 'none', cursor: 'pointer',
  background: 'linear-gradient(135deg,#fde047,#f59e0b)', color: '#0a0014',
  fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 12, letterSpacing: '0.08em',
  boxShadow: '0 0 18px rgba(253,224,71,0.35)',
};
const btnSecondary = {
  width: '100%', padding: '13px 0', borderRadius: 11, cursor: 'pointer',
  background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.45)',
  color: '#c9a6ff', fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 12, letterSpacing: '0.08em',
};

export default function ArcadeBenchmarkPlayer({ series, stage, arcadeSettings, onComplete, onExit, onStateChange, onHome, skipIntro = false }) {
  const tasks = stage?.fitBlock?.tasks || [];
  const tiers = useMemo(() => stage?.scoringTiers || [], [stage]);
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
  // intro | choice | countdown | active | own | entry | rest | summary
  // (choice → COUNT FOR ME runs countdown+active; ON MY OWN runs own+entry)
  const [phase, setPhase] = useState(skipIntro ? 'choice' : 'intro');
  const [countdownVal, setCountdownVal] = useState(3);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [restTimer, setRestTimer] = useState(0);
  const [cadenceMs, setCadenceMs] = useState(() => arcadeSettings?.cadenceMs || tasks[0]?.cadenceMs || 2000);
  const [announcerText, setAnnouncerText] = useState('');
  const [confirmStop, setConfirmStop] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  // One result per exercise: { key, title, reps, mode }
  const [results, setResults] = useState([]);
  const [entryVal, setEntryVal] = useState(10);

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
  const resultsRef = useRef([]);
  const finishedRef = useRef(false);

  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { taskIdxRef.current = taskIdx; }, [taskIdx]);
  useEffect(() => { cadenceMsRef.current = cadenceMs; }, [cadenceMs]);
  useEffect(() => { voiceEnabledRef.current = voiceEnabled; }, [voiceEnabled]);
  useEffect(() => { cadenceCountEnabledRef.current = cadenceCountEnabled; }, [cadenceCountEnabled]);
  useEffect(() => { elapsedValueRef.current = elapsed; }, [elapsed]);
  useEffect(() => { resultsRef.current = results; }, [results]);

  const task = tasks[taskIdx];
  const totalTasks = tasks.length;
  const nextTask = taskIdx + 1 < totalTasks ? tasks[taskIdx + 1] : null;
  const stageBg = `/static/series/stage-bg/stage-${Math.min(Math.max(stage?.stageNumber || 1, 1), 10)}.webp`;

  // Total elapsed timer — runs from intro completion to the summary.
  useEffect(() => {
    if (phase === 'intro' || phase === 'summary') { clearInterval(elapsedRef.current); return; }
    if (paused) { clearInterval(elapsedRef.current); return; }
    elapsedRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(elapsedRef.current);
  }, [phase, paused]);

  useEffect(() => {
    if (typeof onStateChange === 'function') {
      onStateChange({ taskIdx, currentRep, elapsed, phase });
    }
  }, [taskIdx, currentRep, elapsed, phase, onStateChange]);

  // When the upstream briefing intro already ran, start the wall-clock now.
  useEffect(() => {
    if (skipIntro && benchmarkStartedAtRef.current == null) {
      benchmarkStartedAtRef.current = Date.now();
      totalPausedMsRef.current = 0;
      pauseStartedAtRef.current = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Intro phase (only when the shared briefing overlay did not run upstream)
  useEffect(() => {
    if (phase !== 'intro') return;
    announce('Stage 1. Hero Entry Test. Push-ups, squats, and sit-ups. As many as you can, your pace. This sets your baseline.');
    const t = setTimeout(() => {
      benchmarkStartedAtRef.current = Date.now();
      totalPausedMsRef.current = 0;
      pauseStartedAtRef.current = null;
      setPhase('choice');
    }, 4000);
    return () => { clearTimeout(t); cancelSpeech(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Choice card — the no-shame brief, once per exercise.
  useEffect(() => {
    if (phase !== 'choice') return;
    const t = tasks[taskIdxRef.current];
    announce(`${t?.title || 'Exercise'}. As many as you can. When you're done, you're done.`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, taskIdx]);

  // Countdown phase (COUNT FOR ME path)
  useEffect(() => {
    if (phase !== 'countdown') return;
    if (countdownVal <= 0) {
      setPhase('active');
      startCadenceLoop();
      return;
    }
    const t = setTimeout(() => setCountdownVal(v => v - 1), 900);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, countdownVal]);

  // Rest countdown between exercises
  useEffect(() => {
    if (phase !== 'rest') { clearInterval(restRef.current); return; }
    setRestTimer(0);
    const nextTitle = nextTask?.title || 'the next exercise';
    announce(`Logged. Rest. Next up is ${nextTitle}. As many as you can.`);
    restRef.current = setInterval(() => {
      if (pausedRef.current) return; // rest can be paused too
      setRestTimer(t => {
        const next = t + 1;
        if (next >= selectedRestSeconds) {
          clearInterval(restRef.current);
          setTimeout(() => advanceToNextExercise(), 0);
          return selectedRestSeconds;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(restRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function advanceToNextExercise() {
    const nextIdx = taskIdxRef.current + 1;
    if (nextIdx >= totalTasks) {
      setPhase('summary');
      return;
    }
    setTaskIdx(nextIdx);
    repRef.current = 0;
    setCurrentRep(0);
    setPhase('choice');
  }

  // Record one tested exercise, then move on (rest or summary).
  const recordResult = useCallback((reps, mode) => {
    cadenceVersionRef.current++;
    cancelSpeech();
    const t = tasks[taskIdxRef.current];
    const key = CATEGORY_TO_BASELINE_KEY[t?.category] || t?.category || `ex${taskIdxRef.current}`;
    const capped = Math.min(MAXOUT_CAP, Math.max(1, Math.round(reps)));
    setResults(prev => [...prev.filter(r => r.key !== key), { key, title: t?.title || 'Exercise', reps: capped, mode }]);
    announce(`${t?.title || 'Exercise'}: ${capped} reps. Logged.`);
    setTimeout(() => {
      if (taskIdxRef.current + 1 < totalTasks) setPhase('rest');
      else setPhase('summary');
    }, 700);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalTasks]);

  // ONE cadence loop for the COUNT FOR ME path — counts UP from zero with no
  // target and never auto-completes; only I'M MAXED ends the exercise.
  const runCadenceFrom = useCallback((startFrom, { intro }) => {
    const version = ++cadenceVersionRef.current;
    if (intro) {
      repRef.current = 0;
      setCurrentRep(0);
      setAnnouncerText("As many as you can. When you're done, you're done.");
    }

    const stale = () => cadenceVersionRef.current !== version;
    const pausedNow = () => pausedRef.current;

    const runLoop = async () => {
      if (intro) {
        await delay(400);
        if (stale()) return;
      }

      for (let i = startFrom + 1; i <= MAXOUT_CAP; i++) {
        if (stale()) return;

        // Only unpaused time counts — a wall-clock deadline would keep
        // expiring during a pause and count reps the athlete never did.
        if (!await waitUnpaused(cadenceMsRef.current, { isPaused: pausedNow, isStale: stale })) return;
        if (!await awaitResume({ isPaused: pausedNow, isStale: stale })) return;

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
    };

    runLoop();
  }, []);

  const startCadenceLoop = useCallback(
    () => runCadenceFrom(0, { intro: true }),
    [runCadenceFrom],
  );

  const resumeCadenceLoop = useCallback(
    () => runCadenceFrom(repRef.current, { intro: false }),
    [runCadenceFrom],
  );

  // The summary's CONTINUE: log the baseline, clear the stage, hand off.
  const finalize = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    cadenceVersionRef.current++;
    cancelSpeech();
    clearInterval(elapsedRef.current);
    clearInterval(restRef.current);

    let pausedMs = totalPausedMsRef.current;
    if (pauseStartedAtRef.current != null) {
      pausedMs += Date.now() - pauseStartedAtRef.current;
      pauseStartedAtRef.current = null;
    }
    const wallElapsed = benchmarkStartedAtRef.current
      ? Math.floor((Date.now() - benchmarkStartedAtRef.current - pausedMs) / 1000)
      : 0;
    const elapsedSeconds = Math.max(elapsedValueRef.current || 0, wallElapsed, 0);

    const res = resultsRef.current;
    for (const r of res) {
      logBenchmark({ campaignId: series.id, exercise: r.key, reps: r.reps, mode: r.mode });
    }
    const baseline = Object.fromEntries(res.map(r => [r.key, r.reps]));

    // Rank path only for a genuine full-volume run: every exercise at 100+.
    const hitAll100 = res.length >= totalTasks && res.every(r => r.reps >= RANK_TARGET);

    if (hitAll100 && elapsedSeconds < minValid) {
      recordInvalidAttempt(series.id, stage.id, 'tooFast');
      onComplete({
        invalid: true,
        reason: `Too Fast to Verify — No XP Awarded. Completed in ${formatTime(elapsedSeconds)}. Minimum valid time is ${Math.floor(minValid / 60)} minutes.`,
        elapsed: elapsedSeconds,
        elapsedSeconds,
        validationTimeSeconds: elapsedSeconds,
      });
      return;
    }

    markBlockComplete(series.id, stage.id, 'fit');
    addFitModeSession(3, 3);

    const rank = hitAll100 ? getCurrentRank(elapsedSeconds, tiers) : null;
    const xpToAward = rank ? (rank.points || stage?.basePoints || 100) : (stage?.rewards?.xp || 200);
    completeStage(series.id, stage.id, xpToAward, stage?.rewards?.badge, stage?.rewards?.title, stage?.rewards?.statRewards,
      { timeSeconds: elapsedSeconds, stars: getStarsForTime(stage, elapsedSeconds) });

    onComplete({
      invalid: false,
      rank: rank ? rank.rank : null,
      rankLabel: rank ? rank.label : null,
      points: xpToAward,
      xpEarned: xpToAward,
      elapsed: elapsedSeconds,
      elapsedSeconds,
      validationTimeSeconds: elapsedSeconds,
      statRewards: stage?.rewards?.statRewards || null,
      // The clear overlay judges via resolveOutcome(completed/total) — without
      // these it sees 0/1 and stamps MISSION FAILED on a tested baseline.
      // Completion for a tester = exercises tested, and testing all of them
      // is a full clear regardless of the counts.
      completedTasks: res.length,
      totalTasks,
      baseline,
    });
  }, [series, stage, tiers, minValid, totalTasks, onComplete]);

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
    setPhase('choice');
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

  // Backup manual add (COUNT FOR ME path)
  const handleManualAdd = useCallback((n) => {
    const newRep = Math.min(repRef.current + n, MAXOUT_CAP);
    repRef.current = newRep;
    setCurrentRep(newRep);
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

  const chrome = (children) => (
    <StageChrome title={(series?.title || 'ONE PUNCH PROTOCOL').toUpperCase()} subtitle={`Stage ${stage?.stageNumber || 1} · ${stage?.title || ''}`} onHome={onHome} onBack={handleStop} bgImage={stageBg}>
      <style dangerouslySetInnerHTML={{ __html: BENCHMARK_STYLES }}/>
      {children}
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
            }}>End Test?</div>
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
    </StageChrome>
  );

  const timerChip = (
    <div style={{
      position: 'absolute', top: 12, right: 12,
      padding: '4px 10px', borderRadius: 6,
      background: 'rgba(253,224,71,0.06)', border: '1px solid rgba(253,224,71,0.15)',
    }}>
      <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 11, fontWeight: 700, color: GOLD }}>
        {formatTime(elapsed)}
      </span>
    </div>
  );

  const announcerBox = (
    <div style={{
      marginTop: 12, padding: '8px 14px', borderRadius: 8,
      background: 'rgba(10,0,20,0.7)', border: '1px solid rgba(253,224,71,0.15)',
    }}>
      <p style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 12, color: C.muted, margin: 0 }}>
        {announcerText}
      </p>
    </div>
  );

  // Intro screen (only without the upstream briefing)
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
          }}>Max-out tester. As many as you can — this sets your baseline.</div>
          <CircularProgress progress={0} size={160} color="rgba(253,224,71,0.3)" bgColor="rgba(253,224,71,0.06)">
            <Zap size={32} color={GOLD}/>
          </CircularProgress>
          {announcerBox}
        </div>
      </PhoneFrame>
    );
  }

  // Choice card — COUNT FOR ME vs ON MY OWN, before every exercise.
  if (phase === 'choice') {
    return chrome(
      <div style={{
        position: 'relative', zIndex: 10, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '16px', textAlign: 'center',
        animation: 'bm-fade-in 0.3s ease',
      }}>
        {timerChip}
        <div style={{
          fontFamily: "'Orbitron',sans-serif", fontSize: 9, fontWeight: 700,
          color: GOLD, letterSpacing: '0.15em', marginBottom: 8,
        }}>EXERCISE {taskIdx + 1}/{totalTasks} · MAX-OUT</div>
        <div style={{
          fontFamily: "'Orbitron',sans-serif", fontSize: 18, fontWeight: 900,
          color: C.text, marginBottom: 6,
        }}>{task?.title}</div>
        <div style={{
          fontFamily: "'Rajdhani',sans-serif", fontSize: 12.5, fontWeight: 600, color: C.muted,
          maxWidth: 260, lineHeight: 1.45, marginBottom: 20,
        }}>As many as you can. When you&apos;re done, you&apos;re done.</div>

        <div style={{ width: '100%', maxWidth: 280, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button data-testid="bm-count-for-me" onClick={() => { setCountdownVal(3); setPhase('countdown'); }} style={btnPrimary}>
            🔊 COUNT FOR ME
            <div style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 10.5, marginTop: 3, letterSpacing: 0, textTransform: 'none' }}>
              the coach counts every rep out loud
            </div>
          </button>
          <button data-testid="bm-on-my-own" onClick={() => { repRef.current = 0; setCurrentRep(0); setPhase('own'); setAnnouncerText('Your pace. Tap I’M MAXED when you’re done.'); }} style={btnSecondary}>
            🕐 ON MY OWN
            <div style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 10.5, marginTop: 3, letterSpacing: 0, textTransform: 'none', color: '#b9a9d8' }}>
              free timer — enter your number at the end
            </div>
          </button>
        </div>
        {announcerBox}
      </div>
    );
  }

  // Countdown (COUNT FOR ME)
  if (phase === 'countdown') {
    return chrome(
      <div style={{
        position: 'relative', zIndex: 10, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '16px', textAlign: 'center',
        animation: 'bm-fade-in 0.3s ease',
      }}>
        {timerChip}
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
        {announcerBox}
      </div>
    );
  }

  // Rest between exercises
  if (phase === 'rest') {
    const restProgress = restTimer / selectedRestSeconds;
    const nextTitle = nextTask?.title || 'Next';
    return chrome(
      <div style={{
        position: 'relative', zIndex: 10, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '16px', textAlign: 'center',
        animation: 'bm-fade-in 0.3s ease',
      }}>
        {timerChip}
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
        <div style={{
          marginTop: 14, padding: '8px 14px', borderRadius: 8,
          background: 'rgba(253,224,71,0.04)', border: '1px solid rgba(253,224,71,0.12)',
        }}>
          <span style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 6, color: C.muted, letterSpacing: '0.15em' }}>
            NEXT UP
          </span>
          <p style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 11, fontWeight: 700, color: GOLD, margin: '4px 0 0' }}>
            {nextTitle} — as many as you can
          </p>
        </div>
        {announcerBox}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
          <button onClick={handlePauseToggle} aria-label={paused ? 'Resume rest' : 'Pause rest'} style={{
            width: 38, height: 34, borderRadius: 8, cursor: 'pointer',
            background: paused ? 'rgba(253,224,71,0.14)' : 'rgba(16,4,30,0.85)',
            border: `1px solid ${paused ? GOLD : 'rgba(168,85,247,0.4)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {paused ? <Play size={14} color={GOLD}/> : <Pause size={14} color="#e6d4ff"/>}
          </button>
          <button onClick={handleSkipRest} style={{
            padding: '9px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: 'rgba(79,140,255,0.12)', fontFamily: "'Orbitron',sans-serif",
            fontWeight: 700, fontSize: 9, color: '#4f8cff', letterSpacing: '0.1em',
          }}>SKIP REST</button>
        </div>
      </div>
    );
  }

  // ON MY OWN — free timer, self-paced set.
  if (phase === 'own') {
    return chrome(
      <div style={{
        position: 'relative', zIndex: 10, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '16px', textAlign: 'center',
        animation: 'bm-fade-in 0.3s ease',
      }}>
        <div style={{
          fontFamily: "'Orbitron',sans-serif", fontSize: 9, fontWeight: 700,
          color: GOLD, letterSpacing: '0.15em', marginBottom: 8,
        }}>EXERCISE {taskIdx + 1}/{totalTasks} · ON MY OWN</div>
        <div style={{
          fontFamily: "'Orbitron',sans-serif", fontSize: 16, fontWeight: 900,
          color: C.text, marginBottom: 14,
        }}>{task?.title}</div>
        <CircularProgress progress={1} size={180} color="rgba(168,85,247,0.6)" bgColor="rgba(168,85,247,0.08)">
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 34, fontWeight: 900, color: C.text }}>
            {formatTime(elapsed)}
          </div>
          <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 11, color: C.muted, marginTop: 2 }}>your pace</div>
        </CircularProgress>
        <div style={{ width: '100%', maxWidth: 280, marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button data-testid="bm-im-maxed" onClick={() => { setEntryVal(10); setPhase('entry'); setAnnouncerText('How many did you get?'); }} style={btnPrimary}>
            ⚡ I&apos;M MAXED
          </button>
          <button onClick={handlePauseToggle} style={{ ...btnSecondary, padding: '10px 0', fontSize: 10 }}>
            {paused ? '▶ RESUME TIMER' : '⏸ PAUSE TIMER'}
          </button>
        </div>
        {announcerBox}
      </div>
    );
  }

  // Number entry after ON MY OWN — big +/− stepper.
  if (phase === 'entry') {
    const step = (n) => setEntryVal(v => Math.min(MAXOUT_CAP, Math.max(1, v + n)));
    const stepBtn = (label, n, big) => (
      <button key={label} onClick={() => step(n)} style={{
        width: big ? 64 : 52, height: big ? 64 : 52, borderRadius: 14, cursor: 'pointer',
        background: n > 0 ? 'rgba(253,224,71,0.1)' : 'rgba(168,85,247,0.1)',
        border: `1.5px solid ${n > 0 ? 'rgba(253,224,71,0.55)' : 'rgba(168,85,247,0.5)'}`,
        color: n > 0 ? GOLD : '#c9a6ff',
        fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: big ? 22 : 13,
      }}>{label}</button>
    );
    return chrome(
      <div style={{
        position: 'relative', zIndex: 10, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '16px', textAlign: 'center',
        animation: 'bm-fade-in 0.3s ease',
      }}>
        <div style={{
          fontFamily: "'Orbitron',sans-serif", fontSize: 9, fontWeight: 700,
          color: GOLD, letterSpacing: '0.15em', marginBottom: 6,
        }}>{task?.title} · HOW MANY?</div>
        <div style={{
          fontFamily: "'Rajdhani',sans-serif", fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 16,
        }}>Every rep counts — log what you actually got.</div>

        <div data-testid="bm-entry-value" style={{
          fontFamily: "'Orbitron',sans-serif", fontSize: 56, fontWeight: 900, color: C.text,
          textShadow: '0 0 18px rgba(253,224,71,0.35)', marginBottom: 18,
        }}>{entryVal}</div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 22 }}>
          {stepBtn('−10', -10, false)}
          {stepBtn('−', -1, true)}
          {stepBtn('+', +1, true)}
          {stepBtn('+10', +10, false)}
        </div>

        <div style={{ width: '100%', maxWidth: 280 }}>
          <button data-testid="bm-log-it" onClick={() => recordResult(entryVal, 'own')} style={btnPrimary}>✓ LOG IT</button>
        </div>
      </div>
    );
  }

  // Summary — YOUR BASELINE.
  if (phase === 'summary') {
    const label = { pushUps: 'Push-ups', squats: 'Squats', sitUps: 'Sit-ups' };
    const ordered = ['pushUps', 'squats', 'sitUps'].map(k => results.find(r => r.key === k)).filter(Boolean);
    const hitAll100 = results.length >= totalTasks && results.every(r => r.reps >= RANK_TARGET);
    const xpPreview = hitAll100 ? (getCurrentRank(elapsed, tiers).points || stage?.basePoints || 100) : (stage?.rewards?.xp || 200);
    return chrome(
      <div style={{
        position: 'relative', zIndex: 10, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '16px', textAlign: 'center',
        animation: 'bm-fade-in 0.35s ease',
      }}>
        <div style={{
          fontFamily: "'Orbitron',sans-serif", fontSize: 20, fontWeight: 900,
          color: GOLD, letterSpacing: '0.1em', textShadow: '0 0 16px rgba(253,224,71,0.5)', marginBottom: 4,
        }}>YOUR BASELINE</div>
        <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 12, color: C.muted, marginBottom: 16 }}>
          Tested in {formatTime(elapsed)} — stage cleared.
        </div>

        <div style={{ width: '100%', maxWidth: 280, display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {ordered.map(r => (
            <div key={r.key} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', borderRadius: 10,
              background: 'rgba(10,0,20,0.65)', border: '1px solid rgba(253,224,71,0.22)',
            }}>
              <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 11, color: C.text }}>
                {label[r.key] || r.title}
              </span>
              <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 16, color: GOLD }}>
                {r.reps}
                <span style={{ fontSize: 8, color: C.muted, marginLeft: 5 }}>{r.mode === 'own' ? 'SELF' : 'COUNTED'}</span>
              </span>
            </div>
          ))}
        </div>

        {hitAll100 && (
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 10, fontWeight: 700, color: '#22c55e', marginBottom: 8 }}>
            FULL 100s — TIME RANK: {getCurrentRank(elapsed, tiers).label}
          </div>
        )}
        <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 12, fontWeight: 900, color: '#facc15', marginBottom: 6 }}>
          +{xpPreview} XP
        </div>
        <div style={{
          fontFamily: "'Rajdhani',sans-serif", fontSize: 11.5, fontWeight: 600, color: C.muted,
          maxWidth: 270, lineHeight: 1.45, marginBottom: 16,
        }}>
          Stages 2–9 now build from these numbers toward the full 100s.
          Retest anytime — re-running this stage updates your baseline.
        </div>

        <div style={{ width: '100%', maxWidth: 280 }}>
          <button data-testid="bm-continue" onClick={finalize} style={btnPrimary}>▶ CONTINUE</button>
        </div>
      </div>
    );
  }

  // Active — COUNT FOR ME max-out: counting UP, no target, I'M MAXED ends it.
  const cadenceLabel = cadenceMs <= 1000 ? 'FAST' : cadenceMs <= 1500 ? 'QUICK' : cadenceMs <= 2500 ? 'MODERATE' : 'SLOW';
  return chrome(
    <div style={{
      position: 'relative', zIndex: 10, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '12px 16px', textAlign: 'center',
      animation: 'bm-fade-in 0.3s ease',
    }}>
      {timerChip}
      <div style={{
        fontFamily: "'Orbitron',sans-serif", fontSize: 9, fontWeight: 700,
        color: GOLD, letterSpacing: '0.15em', marginBottom: 6,
      }}>EXERCISE {taskIdx + 1}/{totalTasks} · COUNTING UP</div>
      <div style={{
        fontFamily: "'Orbitron',sans-serif", fontSize: 15, fontWeight: 900,
        color: C.text, marginBottom: 10,
      }}>{task?.title}</div>

      <CircularProgress progress={1} size={190} color={GOLD} bgColor="rgba(253,224,71,0.08)">
        <div key={currentRep} style={{
          fontFamily: "'Orbitron',sans-serif", fontSize: 58, fontWeight: 900, color: C.text,
          textShadow: '0 0 18px rgba(253,224,71,0.4)', animation: 'bm-rep-pop 0.3s ease',
        }}>{currentRep}</div>
        <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 11, color: C.muted }}>reps</div>
      </CircularProgress>

      {announcerBox}

      <div style={{ width: '100%', maxWidth: 300, marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button data-testid="bm-im-maxed" onClick={() => recordResult(Math.max(1, repRef.current), 'count')} style={btnPrimary}>
          ⚡ I&apos;M MAXED
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handlePauseToggle} style={{ ...btnSecondary, flex: 1, padding: '10px 0', fontSize: 10 }}>
            {paused ? '▶ RESUME' : '⏸ PAUSE'}
          </button>
          <button onClick={handleRewind} style={{ ...btnSecondary, flex: 1, padding: '10px 0', fontSize: 10 }}>
            <RotateCcw size={10} color="#c9a6ff" style={{ marginRight: 4, verticalAlign: -1 }}/>−5
          </button>
        </div>

        {/* Cadence slider */}
        <div style={{ padding: '2px 4px 0' }}>
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

        {/* Backup manual controls */}
        <button onClick={() => setShowBackup(!showBackup)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, width: '100%',
        }}>
          <MoreHorizontal size={13} color={C.muted}/>
          <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 9.5, color: C.muted }}>
            {showBackup ? 'Hide Backup' : 'Backup Controls'}
          </span>
        </button>
        {showBackup && (
          <div style={{
            padding: '8px 10px', borderRadius: 10,
            background: 'rgba(10,0,20,0.6)', border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ display: 'flex', gap: 6 }}>
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
    </div>
  );
}

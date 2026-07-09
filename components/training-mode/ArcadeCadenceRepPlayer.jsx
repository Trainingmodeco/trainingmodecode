import { useState, useEffect, useRef, useCallback } from 'react';
import { C } from './Styles';
import SafeImage from './SafeImage';
import { Play, Pause, SkipForward, Square, RotateCcw, MoveHorizontal as MoreHorizontal } from 'lucide-react';
import { speakAsync, cancelSpeech, delay } from './voiceCoach';
import { playBeep } from './data/audioEngine';
import { getStageBanner } from './data/arcadeVisualAssets';

const CADENCE_STYLES = `
@keyframes cadence-ring-pulse {
  0%, 100% { filter: drop-shadow(0 0 8px rgba(253,224,71,0.25)); }
  50% { filter: drop-shadow(0 0 18px rgba(253,224,71,0.5)); }
}
@keyframes cadence-rep-pop {
  0% { transform: scale(1); }
  50% { transform: scale(1.12); }
  100% { transform: scale(1); }
}
@keyframes cadence-rest-glow {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
}
@keyframes cadence-fade-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
`;

const GOLD = C.yellow;
const MIN_CADENCE_MS = 750;
const MAX_CADENCE_MS = 4000;
const CADENCE_STEP = 250;

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
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

function CircularProgress({ progress, size = 200, strokeWidth = 10, color, bgColor, children }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(progress, 1));

  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', animation: 'cadence-ring-pulse 3s ease-in-out infinite' }}>
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

export default function ArcadeCadenceRepPlayer({
  task, taskIdx, totalTasks, stage, arcadeSettings, nextTaskTitle, onComplete, onSkip, onExit,
}) {
  const targetReps = task?.reps || 10;
  const baseCadenceMs = arcadeSettings?.cadenceMs || task?.cadenceMs || 2000;
  const restSeconds = task?.restSeconds || 20;
  const cadenceLocked = task?.cadenceLocked || arcadeSettings?.cadenceLocked || false;

  const [cadenceMs, setCadenceMs] = useState(baseCadenceMs);
  const [currentRep, setCurrentRep] = useState(0);
  const [phase, setPhase] = useState('countdown'); // countdown | active | rest | paused | done
  const [countdownVal, setCountdownVal] = useState(3);
  const [paused, setPaused] = useState(false);
  const [restTimer, setRestTimer] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [announcerText, setAnnouncerText] = useState('Get ready...');
  const [confirmStop, setConfirmStop] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const cadenceVersionRef = useRef(0);
  const elapsedRef = useRef(null);
  const restRef = useRef(null);
  const repRef = useRef(0);
  const pausedRef = useRef(false);
  const phaseRef = useRef('countdown');
  const cadenceMsRef = useRef(cadenceMs);
  const voiceEnabledRef = useRef(arcadeSettings?.voiceCoach !== false && arcadeSettings?.sound !== 'off');
  const cadenceCountEnabledRef = useRef(arcadeSettings?.cadenceCount !== false);

  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { cadenceMsRef.current = cadenceMs; }, [cadenceMs]);
  useEffect(() => {
    voiceEnabledRef.current =
      arcadeSettings?.voiceCoach !== false &&
      arcadeSettings?.sound !== 'off';
  }, [arcadeSettings?.voiceCoach, arcadeSettings?.sound]);
  useEffect(() => {
    cadenceCountEnabledRef.current = arcadeSettings?.cadenceCount !== false;
  }, [arcadeSettings?.cadenceCount]);

  // Elapsed time tracker
  useEffect(() => {
    if (phase === 'countdown' || phase === 'done') return;
    if (paused) { clearInterval(elapsedRef.current); return; }
    elapsedRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(elapsedRef.current);
  }, [phase, paused]);

  // Countdown phase
  useEffect(() => {
    if (phase !== 'countdown') return;
    if (countdownVal <= 0) {
      setPhase('active');
      startCadenceLoop();
      return;
    }
    const t = setTimeout(() => {
      setCountdownVal(v => v - 1);
      if (countdownVal === 3) {
        const introText = `${task?.title || 'Exercise'}. ${targetReps} reps. On my count.`;
        setAnnouncerText(introText);
        if (voiceEnabledRef.current) speakAsync(introText);
      }
    }, 900);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, countdownVal]);

  // Rest countdown
  useEffect(() => {
    if (phase !== 'rest') { clearInterval(restRef.current); return; }
    setRestTimer(0);
    const nextLabel = nextTaskTitle || 'the next exercise';
    setAnnouncerText(`Rest ${restSeconds}s. Next: ${nextLabel}`);
    if (voiceEnabledRef.current) speakAsync(`Rest for ${restSeconds} seconds. Next workout is ${nextLabel}. If you need more rest, pause before the next session.`);
    restRef.current = setInterval(() => {
      setRestTimer(t => {
        if (t + 1 >= restSeconds) {
          clearInterval(restRef.current);
          onComplete({ valid: true, elapsed });
          return restSeconds;
        }
        return t + 1;
      });
    }, 1000);
    return () => clearInterval(restRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, restSeconds]);

  const startCadenceLoop = useCallback(() => {
    const version = ++cadenceVersionRef.current;
    repRef.current = 0;
    setCurrentRep(0);
    setAnnouncerText('Begin!');

    const runLoop = async () => {
      await delay(400);
      if (cadenceVersionRef.current !== version) return;

      for (let i = 1; i <= targetReps; i++) {
        if (cadenceVersionRef.current !== version) return;

        // Wait for cadence interval, respecting pause
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
          // Wait until unpaused
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
      setAnnouncerText('Set complete!');
      if (voiceEnabledRef.current) speakAsync('Done. Rest.');
      await delay(600);
      if (cadenceVersionRef.current !== version) return;
      setPhase('rest');
    };

    runLoop();
  }, [targetReps]);

  const resumeCadenceLoop = useCallback(() => {
    const version = ++cadenceVersionRef.current;
    const startFrom = repRef.current;

    const runLoop = async () => {
      for (let i = startFrom + 1; i <= targetReps; i++) {
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
      setAnnouncerText('Set complete!');
      if (voiceEnabledRef.current) speakAsync('Done. Rest.');
      await delay(600);
      if (cadenceVersionRef.current !== version) return;
      setPhase('rest');
    };

    runLoop();
  }, [targetReps]);

  const handlePause = useCallback(() => {
    cancelSpeech();
    setPaused(true);
    setAnnouncerText('Paused');
  }, []);

  const handleResume = useCallback(() => {
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
    setAnnouncerText(newRep === 0 ? 'Restarting...' : `Back to rep ${newRep}`);
    // Restart cadence from new position
    cadenceVersionRef.current++;
    if (!paused && phase === 'active') {
      resumeCadenceLoop();
    }
  }, [paused, phase, resumeCadenceLoop]);

  const handleReset = useCallback(() => {
    cancelSpeech();
    cadenceVersionRef.current++;
    repRef.current = 0;
    setCurrentRep(0);
    setElapsed(0);
    setPaused(false);
    setPhase('countdown');
    setCountdownVal(3);
    setAnnouncerText('Resetting...');
    setShowMore(false);
  }, []);

  const handleStop = useCallback(() => {
    setConfirmStop(true);
  }, []);

  const handleStopConfirm = useCallback(() => {
    cadenceVersionRef.current++;
    cancelSpeech();
    clearInterval(restRef.current);
    clearInterval(elapsedRef.current);
    onExit?.() || onSkip?.();
  }, [onExit, onSkip]);

  const handleSkip = useCallback(() => {
    cadenceVersionRef.current++;
    cancelSpeech();
    clearInterval(restRef.current);
    onSkip();
  }, [onSkip]);

  const handleManualComplete = useCallback(() => {
    cadenceVersionRef.current++;
    cancelSpeech();
    clearInterval(restRef.current);
    onComplete({ valid: true, elapsed });
    setShowMore(false);
  }, [onComplete, elapsed]);

  const handleCadenceChange = useCallback((e) => {
    if (cadenceLocked) return;
    setCadenceMs(Number(e.target.value));
  }, [cadenceLocked]);

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

  const cadenceLabel = cadenceMs <= 1000 ? 'FAST' : cadenceMs <= 1500 ? 'QUICK' : cadenceMs <= 2500 ? 'MODERATE' : 'SLOW';
  const cadenceBpm = Math.round(60000 / cadenceMs);

  // Countdown phase
  if (phase === 'countdown') {
    return (
      <div style={{ textAlign: 'center', padding: '24px 16px', animation: 'cadence-fade-in 0.3s ease' }}>
        <style dangerouslySetInnerHTML={{ __html: CADENCE_STYLES }}/>
        <CircularProgress progress={0} size={180} color="rgba(253,224,71,0.4)" bgColor="rgba(253,224,71,0.06)">
          <div style={{
            fontFamily: "'Orbitron',sans-serif", fontSize: 52, fontWeight: 900,
            color: GOLD, animation: 'cadence-rep-pop 0.6s ease-in-out',
            textShadow: '0 0 16px rgba(253,224,71,0.5)',
          }}>{countdownVal || 'GO'}</div>
        </CircularProgress>
        <div style={{
          marginTop: 16, padding: '8px 14px', borderRadius: 8,
          background: 'rgba(10,0,20,0.7)', border: '1px solid rgba(253,224,71,0.15)',
          display: 'inline-block',
        }}>
          <p style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 12, color: C.muted, margin: 0 }}>
            {announcerText}
          </p>
        </div>
      </div>
    );
  }

  // Rest phase
  if (phase === 'rest') {
    const restProgress = restTimer / restSeconds;
    const nextLabel = nextTaskTitle || null;
    return (
      <div style={{ textAlign: 'center', padding: '20px 16px', animation: 'cadence-fade-in 0.3s ease' }}>
        <style dangerouslySetInnerHTML={{ __html: CADENCE_STYLES }}/>
        <div style={{
          fontFamily: "'Orbitron',sans-serif", fontSize: 10, fontWeight: 700, color: '#4f8cff',
          letterSpacing: '0.2em', marginBottom: 14, animation: 'cadence-rest-glow 1.5s ease-in-out infinite',
        }}>REST</div>
        <CircularProgress progress={restProgress} size={170} color="#4f8cff" bgColor="rgba(79,140,255,0.08)">
          <div style={{
            fontFamily: "'Orbitron',sans-serif", fontSize: 38, fontWeight: 900, color: C.text,
            textShadow: '0 0 12px rgba(79,140,255,0.4)',
          }}>{restSeconds - restTimer}</div>
          <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 11, color: C.muted, marginTop: 2 }}>seconds</div>
        </CircularProgress>
        {/* Next exercise preview */}
        {nextLabel && (
          <div style={{
            marginTop: 14, padding: '8px 14px', borderRadius: 8,
            background: 'rgba(253,224,71,0.04)', border: '1px solid rgba(253,224,71,0.12)',
          }}>
            <span style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 6, color: C.muted, letterSpacing: '0.15em' }}>
              NEXT UP
            </span>
            <p style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 11, fontWeight: 700, color: GOLD, margin: '4px 0 0' }}>
              {nextLabel}
            </p>
          </div>
        )}
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
        <button onClick={() => onComplete({ valid: true, elapsed })} style={{
          marginTop: 12, padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
          background: 'rgba(79,140,255,0.12)', fontFamily: "'Orbitron',sans-serif",
          fontWeight: 700, fontSize: 9, color: '#4f8cff', letterSpacing: '0.1em',
        }}>SKIP REST</button>
      </div>
    );
  }

  // Active cadence phase
  const repProgress = currentRep / targetReps;

  return (
    <div style={{ textAlign: 'center', padding: '12px 16px', animation: 'cadence-fade-in 0.3s ease' }}>
      <style dangerouslySetInnerHTML={{ __html: CADENCE_STYLES }}/>

      {/* Task header */}
      <div style={{ marginBottom: 10 }}>
        {getStageBanner(stage?.stageNumber) && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
            <SafeImage
              src={getStageBanner(stage?.stageNumber)}
              alt={`STAGE ${stage?.stageNumber}`}
              preferWebp={false}
              style={{
                display: 'block', width: 'auto', maxWidth: '100%', maxHeight: 36,
                objectFit: 'contain', background: 'transparent',
              }}
            />
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{
            fontFamily: "'Press Start 2P',monospace", fontSize: 7, color: C.muted, letterSpacing: '0.15em',
          }}>EXERCISE {taskIdx + 1}/{totalTasks}</span>
          {task?._round && (
            <span style={{
              fontFamily: "'Orbitron',sans-serif", fontSize: 8, fontWeight: 700,
              padding: '2px 7px', borderRadius: 4,
              background: 'rgba(79,140,255,0.08)', border: '1px solid rgba(79,140,255,0.25)',
              color: '#4f8cff',
            }}>R{task._round}</span>
          )}
        </div>
        <h3 style={{
          fontFamily: "'Orbitron',sans-serif", fontSize: 16, fontWeight: 900, color: GOLD,
          margin: '0 0 4px', letterSpacing: '0.06em',
          textShadow: '0 0 12px rgba(253,224,71,0.4)',
        }}>{task?.title}</h3>
        {task?.instructions && (
          <p style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 11, color: C.muted, margin: 0, lineHeight: 1.4 }}>
            {task.instructions}
          </p>
        )}
      </div>

      {/* Cadence badge */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{
          fontFamily: "'Orbitron',sans-serif", fontSize: 8, fontWeight: 700,
          padding: '3px 9px', borderRadius: 4,
          background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)',
          color: '#22c55e',
        }}>CADENCE ON</span>
        <span style={{
          fontFamily: "'Orbitron',sans-serif", fontSize: 8, fontWeight: 700,
          padding: '3px 9px', borderRadius: 4,
          background: 'rgba(253,224,71,0.06)', border: '1px solid rgba(253,224,71,0.2)',
          color: GOLD,
        }}>{cadenceLabel} ({cadenceBpm} BPM)</span>
      </div>

      {/* Circular rep counter */}
      <CircularProgress
        progress={repProgress}
        size={200}
        strokeWidth={10}
        color={currentRep >= targetReps ? '#22c55e' : '#a855f7'}
        bgColor={currentRep >= targetReps ? 'rgba(34,197,94,0.08)' : 'rgba(168,85,247,0.1)'}
      >
        <div style={{
          fontFamily: "'Orbitron',sans-serif", fontSize: 48, fontWeight: 900, color: GOLD,
          animation: currentRep > 0 ? 'cadence-rep-pop 0.2s ease-out' : 'none',
          textShadow: '0 0 16px rgba(253,224,71,0.5)',
        }}>{currentRep}</div>
        <div style={{
          fontFamily: "'Orbitron',sans-serif", fontSize: 11, fontWeight: 700,
          color: C.muted, letterSpacing: '0.15em', marginTop: 4,
        }}>REP {currentRep} / {targetReps}</div>
      </CircularProgress>

      {/* Announcer text */}
      <div style={{
        marginTop: 12, padding: '8px 16px', borderRadius: 8,
        background: 'rgba(10,0,20,0.7)', border: '1px solid rgba(253,224,71,0.12)',
        minHeight: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{
          fontFamily: "'Rajdhani',sans-serif", fontSize: 13, fontWeight: 600,
          color: paused ? GOLD : C.text,
        }}>{announcerText}</span>
      </div>

      {/* Elapsed */}
      <div style={{ marginTop: 8, fontFamily: "'Orbitron',sans-serif", fontSize: 11, color: C.muted }}>
        {formatTime(elapsed)}
      </div>

      {/* Cadence slider */}
      <div style={{ marginTop: 12, padding: '0 8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 6, color: C.muted, letterSpacing: '0.1em' }}>
            CADENCE SPEED
          </span>
          <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 9, fontWeight: 700, color: cadenceLocked ? 'rgba(239,68,68,0.7)' : GOLD }}>
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
            width: '100%', height: 6, borderRadius: 999, outline: 'none',
            background: cadenceLocked
              ? 'rgba(239,68,68,0.15)'
              : `linear-gradient(90deg, #a855f7 0%, ${GOLD} ${((cadenceMs - MIN_CADENCE_MS) / (MAX_CADENCE_MS - MIN_CADENCE_MS)) * 100}%, rgba(255,255,255,0.08) ${((cadenceMs - MIN_CADENCE_MS) / (MAX_CADENCE_MS - MIN_CADENCE_MS)) * 100}%, rgba(255,255,255,0.08) 100%)`,
            opacity: cadenceLocked ? 0.5 : 1,
            cursor: cadenceLocked ? 'not-allowed' : 'pointer',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
          <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 9, color: C.muted }}>Fast (0.75s)</span>
          <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 9, color: C.muted }}>Slow (4s)</span>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 14, alignItems: 'center' }}>
        {/* Rewind */}
        <button onClick={handleRewind} style={{
          width: 48, height: 48, borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(10,0,20,0.7)', border: '1px solid rgba(168,85,247,0.3)',
          cursor: 'pointer',
        }}>
          <RotateCcw size={18} color={C.neon}/>
        </button>

        {/* Pause/Resume */}
        <button onClick={handlePauseToggle} style={{
          width: 62, height: 62, borderRadius: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: paused
            ? 'rgba(253,224,71,0.12)'
            : 'linear-gradient(135deg, rgba(253,224,71,0.25), rgba(253,224,71,0.12))',
          border: `1.5px solid ${paused ? GOLD : 'rgba(253,224,71,0.4)'}`,
          cursor: 'pointer',
          boxShadow: paused ? 'none' : '0 0 16px rgba(253,224,71,0.15)',
        }}>
          {paused ? <Play size={24} color={GOLD}/> : <Pause size={24} color="#fff"/>}
        </button>

        {/* Skip */}
        <button onClick={handleSkip} style={{
          width: 48, height: 48, borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(10,0,20,0.7)', border: '1px solid rgba(168,85,247,0.3)',
          cursor: 'pointer',
        }}>
          <SkipForward size={18} color={C.neon}/>
        </button>

        {/* Stop */}
        <button onClick={handleStop} style={{
          width: 48, height: 48, borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
          cursor: 'pointer',
        }}>
          <Square size={16} color="#ef4444"/>
        </button>
      </div>

      {/* More options toggle */}
      <button onClick={() => setShowMore(!showMore)} style={{
        marginTop: 10, background: 'none', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, width: '100%',
      }}>
        <MoreHorizontal size={14} color={C.muted}/>
        <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 10, color: C.muted }}>
          {showMore ? 'Less' : 'More'}
        </span>
      </button>

      {/* More section (manual complete, reset) */}
      {showMore && (
        <div style={{
          marginTop: 8, padding: '10px 12px', borderRadius: 10,
          background: 'rgba(10,0,20,0.6)', border: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap',
        }}>
          <button onClick={handleManualComplete} style={{
            padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: 'rgba(34,197,94,0.1)', fontFamily: "'Orbitron',sans-serif",
            fontWeight: 700, fontSize: 9, color: '#22c55e', letterSpacing: '0.08em',
          }}>MARK DONE</button>
          <button onClick={handleReset} style={{
            padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: 'rgba(245,158,11,0.1)', fontFamily: "'Orbitron',sans-serif",
            fontWeight: 700, fontSize: 9, color: '#f59e0b', letterSpacing: '0.08em',
          }}>RESET</button>
        </div>
      )}

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
            }}>End Exercise?</div>
            <div style={{
              fontFamily: "'Rajdhani',sans-serif", fontSize: 13, fontWeight: 500,
              color: C.muted, lineHeight: 1.5, marginBottom: 20,
            }}>Progress on this exercise will not be saved.</div>
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
    </div>
  );
}

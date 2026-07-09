import { useState, useEffect, useRef, useCallback } from 'react';
import { C } from './Styles';
import { Play, Pause, Square, RotateCcw, MoveHorizontal as MoreHorizontal, Zap } from 'lucide-react';
import { speakAsync, cancelSpeech } from './voiceCoach';
import { playBeep } from './data/audioEngine';
import { ARCADE, ArcadeStatusChip } from './ArcadeUI';

const CARDIO_STYLES = `
@keyframes cardio-ring-pulse {
  0%, 100% { filter: drop-shadow(0 0 8px rgba(168,85,247,0.3)); }
  50% { filter: drop-shadow(0 0 18px rgba(168,85,247,0.55)); }
}
@keyframes cardio-boost-flash {
  0%, 100% { background: rgba(255,107,0,0.08); }
  50% { background: rgba(255,107,0,0.18); }
}
@keyframes cardio-fade-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes cardio-boost-pulse {
  0%, 100% { transform: scale(1); opacity: 0.8; }
  50% { transform: scale(1.08); opacity: 1; }
}
`;

const GOLD = C.yellow;
const VIOLET = '#a855f7';
const ORANGE = '#ff6b00';

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function generateSpeedBoosts(totalDurationSec, config) {
  if (!config || !config.enabled) return [];
  const { minBoosts = 3, maxBoosts = 6, minDurationSeconds = 20, maxDurationSeconds = 60 } = config;
  const boostCount = minBoosts + Math.floor(Math.random() * (maxBoosts - minBoosts + 1));
  const boosts = [];
  const minStartSec = 60;
  const maxEndSec = totalDurationSec - 30;
  const availableWindow = maxEndSec - minStartSec;
  if (availableWindow < boostCount * (maxDurationSeconds + 30)) {
    return [];
  }

  const spacing = Math.floor(availableWindow / (boostCount + 1));
  for (let i = 0; i < boostCount; i++) {
    const baseStart = minStartSec + spacing * (i + 1);
    const jitter = Math.floor(Math.random() * 20) - 10;
    const startAt = Math.max(minStartSec, baseStart + jitter);
    const duration = minDurationSeconds + Math.floor(Math.random() * (maxDurationSeconds - minDurationSeconds + 1));
    boosts.push({ startAt, duration });
  }

  return boosts.sort((a, b) => a.startAt - b.startAt);
}

function CircularTimer({ progress, size = 200, strokeWidth = 10, color, bgColor, children }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(progress, 1));

  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', animation: 'cardio-ring-pulse 3s ease-in-out infinite' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={bgColor || 'rgba(168,85,247,0.1)'} strokeWidth={strokeWidth}/>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color || VIOLET} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.9s linear', filter: `drop-shadow(0 0 6px ${color || VIOLET})` }}/>
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>{children}</div>
    </div>
  );
}

export default function ArcadeCardioPlayer({
  method, methodLabel, durationSeconds, distanceLabel, speedBoosts: speedBoostConfig,
  onComplete, onSkip, onExit,
}) {
  const totalDuration = durationSeconds || 1800;
  const minValidSeconds = Math.floor(totalDuration * 0.6);

  const [phase, setPhase] = useState('countdown'); // countdown | active | done
  const [countdownVal, setCountdownVal] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [announcerText, setAnnouncerText] = useState('Get ready...');
  const [confirmStop, setConfirmStop] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [boostActive, setBoostActive] = useState(false);
  const [boostRemaining, setBoostRemaining] = useState(0);
  const [boostsCompleted, setBoostsCompleted] = useState(0);

  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const activeTimeRef = useRef(0);
  const pausedRef = useRef(false);
  const elapsedRef = useRef(0);
  const boostsRef = useRef([]);
  const boostIdxRef = useRef(0);
  const boostTimerRef = useRef(null);
  const announcedBoostRef = useRef(-1);

  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { elapsedRef.current = elapsed; }, [elapsed]);

  // Generate speed boosts on mount
  useEffect(() => {
    const config = speedBoostConfig || { enabled: true, minBoosts: 3, maxBoosts: 6, minDurationSeconds: 20, maxDurationSeconds: 60 };
    boostsRef.current = generateSpeedBoosts(totalDuration, config);
  }, [totalDuration, speedBoostConfig]);

  // Countdown
  useEffect(() => {
    if (phase !== 'countdown') return;
    if (countdownVal <= 0) {
      setPhase('active');
      startTimeRef.current = Date.now();
      setAnnouncerText('Go! Steady pace.');
      speakAsync('Begin cardio. Steady pace.');
      return;
    }
    const t = setTimeout(() => setCountdownVal(v => v - 1), 900);
    return () => clearTimeout(t);
  }, [phase, countdownVal]);

  // Main timer
  useEffect(() => {
    if (phase !== 'active') { clearInterval(timerRef.current); return; }
    if (paused) { clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => {
      setElapsed(e => {
        const next = e + 1;
        activeTimeRef.current = next;
        if (next >= totalDuration) {
          clearInterval(timerRef.current);
          handleAutoComplete();
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, paused, totalDuration]);

  // Check for speed boost triggers
  useEffect(() => {
    if (phase !== 'active' || paused) return;
    const boosts = boostsRef.current;
    if (boosts.length === 0) return;

    const currentBoostIdx = boostIdxRef.current;
    if (currentBoostIdx >= boosts.length) return;

    const nextBoost = boosts[currentBoostIdx];
    if (elapsed >= nextBoost.startAt && !boostActive && announcedBoostRef.current !== currentBoostIdx) {
      announcedBoostRef.current = currentBoostIdx;
      triggerSpeedBoost(nextBoost.duration);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, phase, paused, boostActive]);

  const triggerSpeedBoost = useCallback((duration) => {
    setBoostActive(true);
    setBoostRemaining(duration);
    setAnnouncerText(`SPEED BOOST! Push the pace for ${duration} seconds.`);
    speakAsync(`Speed boost. Push the pace for ${duration} seconds.`);
    playBeep();

    let remaining = duration;
    clearInterval(boostTimerRef.current);
    boostTimerRef.current = setInterval(() => {
      if (pausedRef.current) return;
      remaining--;
      setBoostRemaining(remaining);
      if (remaining <= 0) {
        clearInterval(boostTimerRef.current);
        setBoostActive(false);
        setBoostRemaining(0);
        setBoostsCompleted(c => c + 1);
        boostIdxRef.current++;
        setAnnouncerText('Recover. Return to steady pace.');
        speakAsync('Recover. Return to steady pace.');
      }
    }, 1000);
  }, []);

  const handleAutoComplete = useCallback(() => {
    clearInterval(timerRef.current);
    clearInterval(boostTimerRef.current);
    setPhase('done');
    setBoostActive(false);
    setAnnouncerText('Cardio complete!');
    speakAsync('Cardio complete. Great work.');
    setTimeout(() => {
      onComplete({ valid: true, elapsed: activeTimeRef.current, partial: false });
    }, 1500);
  }, [onComplete]);

  const handlePauseToggle = useCallback(() => {
    if (paused) {
      setPaused(false);
      setAnnouncerText('Resume! Keep going.');
    } else {
      cancelSpeech();
      setPaused(true);
      setAnnouncerText('Paused');
    }
  }, [paused]);

  const handleRewind = useCallback(() => {
    const newElapsed = Math.max(0, elapsed - 60);
    setElapsed(newElapsed);
    activeTimeRef.current = newElapsed;
    setAnnouncerText('Rewound 1 minute.');
  }, [elapsed]);

  const handleReset = useCallback(() => {
    cancelSpeech();
    clearInterval(timerRef.current);
    clearInterval(boostTimerRef.current);
    setElapsed(0);
    activeTimeRef.current = 0;
    setPaused(false);
    setBoostActive(false);
    setBoostRemaining(0);
    setBoostsCompleted(0);
    boostIdxRef.current = 0;
    announcedBoostRef.current = -1;
    setPhase('countdown');
    setCountdownVal(3);
    setAnnouncerText('Resetting...');
    setShowMore(false);
  }, []);

  const handleEndCardio = useCallback(() => {
    const activeTime = activeTimeRef.current;
    clearInterval(timerRef.current);
    clearInterval(boostTimerRef.current);
    cancelSpeech();
    setBoostActive(false);

    if (activeTime < minValidSeconds) {
      setAnnouncerText('Too fast to verify. Partial credit only.');
      speakAsync('Too fast to verify.');
      setTimeout(() => {
        onComplete({ valid: false, elapsed: activeTime, partial: true, reason: 'too_fast' });
      }, 1500);
    } else {
      setAnnouncerText('Cardio complete!');
      speakAsync('Cardio complete.');
      setTimeout(() => {
        onComplete({ valid: true, elapsed: activeTime, partial: false });
      }, 1200);
    }
  }, [onComplete, minValidSeconds]);

  const handleStopConfirm = useCallback(() => {
    clearInterval(timerRef.current);
    clearInterval(boostTimerRef.current);
    cancelSpeech();
    onExit?.() || onSkip?.();
  }, [onExit, onSkip]);

  // Cleanup
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      clearInterval(boostTimerRef.current);
      cancelSpeech();
    };
  }, []);

  const remaining = Math.max(0, totalDuration - elapsed);
  const progress = elapsed / totalDuration;
  const ringColor = boostActive ? ORANGE : VIOLET;

  // Countdown
  if (phase === 'countdown') {
    return (
      <div style={{ textAlign: 'center', padding: '24px 16px', animation: 'cardio-fade-in 0.3s ease' }}>
        <style dangerouslySetInnerHTML={{ __html: CARDIO_STYLES }}/>
        <div style={{
          fontFamily: ARCADE.fontHead, fontSize: 11, fontWeight: 700, color: ARCADE.gold,
          letterSpacing: '0.22em', marginBottom: 14,
        }}>CARDIO PHASE</div>
        <CircularTimer progress={0} size={180} color="rgba(168,85,247,0.45)" bgColor="rgba(168,85,247,0.08)">
          <div style={{
            fontFamily: ARCADE.fontHead, fontSize: 52, fontWeight: 900,
            color: GOLD, textShadow: '0 0 16px rgba(253,224,71,0.5)',
          }}>{countdownVal || 'GO'}</div>
        </CircularTimer>
        <div style={{
          marginTop: 16, padding: '8px 14px', borderRadius: ARCADE.radius.sm,
          background: ARCADE.panelBg, border: `1px solid ${ARCADE.violetBorderSoft}`,
          display: 'inline-block',
        }}>
          <p style={{ fontFamily: ARCADE.fontBody, fontSize: 12, color: C.muted, margin: 0 }}>
            {methodLabel || 'Cardio'} — {distanceLabel || `${Math.round(totalDuration / 60)} min`}
          </p>
        </div>
      </div>
    );
  }

  // Active / Done
  return (
    <div style={{ textAlign: 'center', padding: '12px 16px', animation: 'cardio-fade-in 0.3s ease' }}>
      <style dangerouslySetInnerHTML={{ __html: CARDIO_STYLES }}/>

      {/* Header */}
      <div style={{ marginBottom: 10 }}>
        <div style={{
          fontFamily: ARCADE.fontHead, fontSize: 10, color: ARCADE.gold, fontWeight: 700,
          letterSpacing: '0.22em', marginBottom: 4,
        }}>CARDIO PHASE</div>
        <h3 style={{
          fontFamily: ARCADE.fontHead, fontSize: 16, fontWeight: 900,
          color: '#c4b5fd', margin: '0 0 4px', letterSpacing: '0.06em',
          textShadow: '0 0 12px rgba(168,85,247,0.45)',
        }}>{methodLabel || 'Cardio'}</h3>
        {distanceLabel && (
          <p style={{ fontFamily: ARCADE.fontBody, fontSize: 11, color: C.muted, margin: 0 }}>
            Target: {distanceLabel}
          </p>
        )}
      </div>

      {/* Badges */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <ArcadeStatusChip tone="violet">{Math.round(totalDuration / 60)} MIN</ArcadeStatusChip>
        {boostsRef.current.length > 0 && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontFamily: ARCADE.fontHead, fontSize: 8, fontWeight: 700,
            padding: '3px 10px', borderRadius: ARCADE.radius.pill,
            background: boostActive ? 'rgba(255,107,0,0.14)' : 'rgba(255,107,0,0.06)',
            border: `1px solid ${boostActive ? 'rgba(255,107,0,0.55)' : 'rgba(255,107,0,0.25)'}`,
            color: ORANGE, letterSpacing: '0.1em',
          }}>
            <Zap size={9}/>
            {boostsCompleted}/{boostsRef.current.length} BOOSTS
          </span>
        )}
      </div>

      {/* Speed boost banner */}
      {boostActive && (
        <div style={{
          padding: '10px 14px', borderRadius: ARCADE.radius.md, marginBottom: 12,
          border: '1.5px solid rgba(255,107,0,0.5)',
          animation: 'cardio-boost-flash 1s ease-in-out infinite',
        }}>
          <div style={{
            fontFamily: ARCADE.fontHead, fontSize: 12, fontWeight: 900,
            color: ORANGE, letterSpacing: '0.1em',
            animation: 'cardio-boost-pulse 1.2s ease-in-out infinite',
          }}>
            <Zap size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }}/>
            SPEED BOOST!
          </div>
          <div style={{
            fontFamily: ARCADE.fontBody, fontSize: 11, color: C.text, marginTop: 4,
          }}>Push the pace — {boostRemaining}s remaining</div>
        </div>
      )}

      {/* Circular timer */}
      <CircularTimer
        progress={progress}
        size={200}
        strokeWidth={10}
        color={ringColor}
        bgColor={boostActive ? 'rgba(255,107,0,0.06)' : 'rgba(168,85,247,0.1)'}
      >
        <div style={{
          fontFamily: ARCADE.fontHead, fontSize: 40, fontWeight: 900,
          color: boostActive ? ORANGE : GOLD, textShadow: `0 0 16px ${boostActive ? ORANGE : 'rgba(253,224,71,0.5)'}`,
        }}>{formatTime(remaining)}</div>
        <div style={{
          fontFamily: ARCADE.fontHead, fontSize: 10, fontWeight: 700,
          color: boostActive ? ORANGE : '#c4b5fd', letterSpacing: '0.15em', marginTop: 4,
        }}>{boostActive ? 'PUSH IT' : 'REMAINING'}</div>
      </CircularTimer>

      {/* Announcer text */}
      <div style={{
        marginTop: 12, padding: '8px 16px', borderRadius: ARCADE.radius.sm,
        background: ARCADE.panelBg,
        border: `1px solid ${boostActive ? 'rgba(255,107,0,0.2)' : ARCADE.violetBorderSoft}`,
        minHeight: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{
          fontFamily: ARCADE.fontBody, fontSize: 12, fontWeight: 600,
          color: paused ? GOLD : boostActive ? ORANGE : C.text,
        }}>{announcerText}</span>
      </div>

      {/* Elapsed */}
      <div style={{ marginTop: 8, fontFamily: "'Orbitron',sans-serif", fontSize: 11, color: C.muted }}>
        Elapsed: {formatTime(elapsed)}
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
            : `linear-gradient(135deg, rgba(168,85,247,0.28), rgba(168,85,247,0.12))`,
          border: `1.5px solid ${paused ? GOLD : 'rgba(168,85,247,0.5)'}`,
          cursor: 'pointer',
          boxShadow: paused ? 'none' : '0 0 16px rgba(168,85,247,0.2)',
        }}>
          {paused ? <Play size={24} color={GOLD}/> : <Pause size={24} color="#fff"/>}
        </button>

        {/* Stop */}
        <button onClick={() => setConfirmStop(true)} style={{
          width: 48, height: 48, borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
          cursor: 'pointer',
        }}>
          <Square size={16} color="#ef4444"/>
        </button>
      </div>

      {/* End Cardio button */}
      <button onClick={handleEndCardio} style={{
        marginTop: 14, width: '100%', maxWidth: 280, padding: '14px 0', borderRadius: ARCADE.radius.lg,
        border: 'none', cursor: 'pointer',
        background: elapsed >= minValidSeconds
          ? `linear-gradient(135deg, ${GOLD}, ${ARCADE.gold})`
          : 'rgba(255,255,255,0.04)',
        fontFamily: ARCADE.fontHead, fontWeight: 900, fontSize: 13,
        color: elapsed >= minValidSeconds ? '#0a0014' : C.muted,
        opacity: elapsed >= minValidSeconds ? 1 : 0.6,
        letterSpacing: '0.16em',
        boxShadow: elapsed >= minValidSeconds ? '0 0 28px rgba(253,224,71,0.5), 0 0 8px rgba(253,224,71,0.3)' : 'none',
      }}>END CARDIO</button>
      {elapsed < minValidSeconds && (
        <div style={{
          marginTop: 4, fontFamily: "'Rajdhani',sans-serif", fontSize: 9, color: C.muted,
        }}>
          Min {Math.ceil(minValidSeconds / 60)} min for full credit
        </div>
      )}

      {/* More section */}
      <button onClick={() => setShowMore(!showMore)} style={{
        marginTop: 10, background: 'none', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, width: '100%',
      }}>
        <MoreHorizontal size={14} color={C.muted}/>
        <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 10, color: C.muted }}>
          {showMore ? 'Less' : 'More'}
        </span>
      </button>

      {showMore && (
        <div style={{
          marginTop: 8, padding: '10px 12px', borderRadius: 10,
          background: 'rgba(10,0,20,0.6)', border: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap',
        }}>
          <button onClick={handleReset} style={{
            padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: 'rgba(245,158,11,0.1)', fontFamily: "'Orbitron',sans-serif",
            fontWeight: 700, fontSize: 9, color: '#f59e0b', letterSpacing: '0.08em',
          }}>RESET</button>
          {onSkip && (
            <button onClick={onSkip} style={{
              padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'rgba(168,85,247,0.1)', fontFamily: "'Orbitron',sans-serif",
              fontWeight: 700, fontSize: 9, color: C.neon, letterSpacing: '0.08em',
            }}>SKIP CARDIO</button>
          )}
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
            }}>End Cardio?</div>
            <div style={{
              fontFamily: "'Rajdhani',sans-serif", fontSize: 13, fontWeight: 500,
              color: C.muted, lineHeight: 1.5, marginBottom: 20,
            }}>
              {elapsed < minValidSeconds
                ? 'You have not reached minimum time. No cardio credit will be awarded.'
                : 'Your cardio time will be recorded.'}
            </div>
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

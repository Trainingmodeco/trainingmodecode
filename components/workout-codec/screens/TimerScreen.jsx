import React, { useState, useEffect, useRef } from 'react';
import { CC } from '../CodecStyles';

export default function TimerScreen({ blocks, onComplete, onBack }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [phase, setPhase] = useState('exercise');
  const [timeLeft, setTimeLeft] = useState(null);
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const startTimeRef = useRef(null);
  const intervalRef = useRef(null);
  const timerEndRef = useRef(null);

  const current = blocks[currentIdx];
  const isLastSet = currentSet >= (current?.sets || 1);
  const isLastExercise = currentIdx >= blocks.length - 1;
  const hasDuration = current?.durationSeconds && current.durationSeconds > 0;

  timerEndRef.current = () => {
    if (phase === 'exercise') {
      if (isLastSet && isLastExercise) {
        finishMission();
      } else {
        startRest();
      }
    } else {
      advanceAfterRest();
    }
  };

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  useEffect(() => {
    if (!running || timeLeft === null || timeLeft <= 0) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          setTimeout(() => timerEndRef.current?.(), 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, phase, currentIdx, currentSet]);

  const startRest = () => {
    const restTime = current?.restSeconds || 0;
    if (restTime <= 0) {
      advanceAfterRest();
      return;
    }
    setPhase('rest');
    setTimeLeft(restTime);
    setRunning(true);
  };

  const advanceAfterRest = () => {
    if (!isLastSet) {
      setCurrentSet(prev => prev + 1);
      setPhase('exercise');
      if (hasDuration) {
        setTimeLeft(current.durationSeconds);
        setRunning(true);
      } else {
        setTimeLeft(null);
        setRunning(false);
      }
    } else {
      setCompletedCount(prev => prev + 1);
      if (!isLastExercise) {
        const nextIdx = currentIdx + 1;
        const next = blocks[nextIdx];
        setCurrentIdx(nextIdx);
        setCurrentSet(1);
        setPhase('exercise');
        if (next?.durationSeconds && next.durationSeconds > 0) {
          setTimeLeft(next.durationSeconds);
          setRunning(true);
        } else {
          setTimeLeft(null);
          setRunning(false);
        }
      } else {
        finishMission();
      }
    }
  };

  const handleMarkComplete = () => {
    if (isLastSet && isLastExercise) {
      setCompletedCount(prev => prev + 1);
      finishMission();
    } else if (isLastSet) {
      startRest();
    } else if (current?.restSeconds > 0) {
      startRest();
    } else {
      setCurrentSet(prev => prev + 1);
    }
  };

  const handleStart = () => {
    setStarted(true);
    startTimeRef.current = Date.now();
    setPhase('exercise');
    if (hasDuration) {
      setTimeLeft(current.durationSeconds);
      setRunning(true);
    } else {
      setTimeLeft(null);
      setRunning(false);
    }
  };

  const handlePause = () => setRunning(false);
  const handleResume = () => setRunning(true);

  const handleSkip = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setCompletedCount(prev => prev + 1);
    if (isLastExercise) {
      finishMission();
    } else {
      const nextIdx = currentIdx + 1;
      const next = blocks[nextIdx];
      setCurrentIdx(nextIdx);
      setCurrentSet(1);
      setPhase('exercise');
      if (next?.durationSeconds && next.durationSeconds > 0) {
        setTimeLeft(next.durationSeconds);
        setRunning(true);
      } else {
        setTimeLeft(null);
        setRunning(false);
      }
    }
  };

  const handlePrev = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (currentIdx > 0) {
      const prevIdx = currentIdx - 1;
      const prev = blocks[prevIdx];
      setCurrentIdx(prevIdx);
      setCurrentSet(1);
      setPhase('exercise');
      if (prev?.durationSeconds && prev.durationSeconds > 0) {
        setTimeLeft(prev.durationSeconds);
        setRunning(false);
      } else {
        setTimeLeft(null);
        setRunning(false);
      }
    }
  };

  const finishMission = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRunning(false);
    const totalTime = startTimeRef.current ? Math.round((Date.now() - startTimeRef.current) / 1000) : 0;
    const finalCount = completedCount + (phase === 'exercise' ? 1 : 0);
    onComplete(Math.min(finalCount, blocks.length), totalTime);
  };

  const formatTime = (sec) => {
    if (sec === null || sec === undefined) return '--:--';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const progress = blocks.length > 0 ? ((currentIdx + (currentSet - 1) / (current?.sets || 1)) / blocks.length) : 0;

  // --- Pre-start screen ---
  if (!started) {
    return (
      <div className="no-scrollbar" style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '40px 0 20px', minHeight: '100dvh', overflowY: 'auto',
        overflowX: 'hidden', WebkitOverflowScrolling: 'touch', gap: 24,
      }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{
            fontFamily: "'Orbitron', sans-serif", fontSize: 10,
            color: CC.muted, letterSpacing: '0.12em', marginBottom: 8,
          }}>MISSION READY</p>
          <h2 style={{
            fontFamily: "'Orbitron', sans-serif", fontWeight: 900,
            fontSize: 20, color: CC.gold, marginBottom: 8,
          }}>
            {blocks.length} EXERCISE{blocks.length !== 1 ? 'S' : ''}
          </h2>
          <p style={{ fontSize: 14, color: CC.muted }}>
            Tap Start to begin your decoded mission
          </p>
        </div>

        <div className="codec-panel" style={{ padding: '16px 20px', width: '100%', maxWidth: 320 }}>
          {blocks.slice(0, 5).map((b, i) => (
            <div key={b.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 0', borderBottom: i < Math.min(blocks.length, 5) - 1 ? '1px solid rgba(168,85,247,0.1)' : 'none',
            }}>
              <span style={{ fontSize: 10, color: CC.muted, fontFamily: "'Orbitron'", minWidth: 20 }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span style={{ fontSize: 14, color: CC.text, flex: 1 }}>{b.exercise}</span>
              <span style={{ fontSize: 11, color: CC.muted }}>
                {b.sets > 1 ? `${b.sets}x` : ''}{b.reps || (b.durationSeconds ? `${b.durationSeconds}s` : '')}
              </span>
            </div>
          ))}
          {blocks.length > 5 && (
            <p style={{ fontSize: 12, color: CC.muted, textAlign: 'center', marginTop: 8 }}>
              +{blocks.length - 5} more
            </p>
          )}
        </div>

        <button className="codec-btn-gold anim-codec-glow" onClick={handleStart} style={{ padding: '18px 48px', fontSize: 14 }}>
          START
        </button>
        <button onClick={onBack} style={{
          background: 'none', border: 'none', color: CC.muted,
          fontSize: 12, fontFamily: "'Orbitron'", cursor: 'pointer',
        }}>
          BACK TO REVIEW
        </button>
      </div>
    );
  }

  // --- Active timer screen ---
  return (
    <div className="no-scrollbar" style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      padding: '24px 0 20px', minHeight: '100dvh', overflowY: 'auto',
      overflowX: 'hidden', WebkitOverflowScrolling: 'touch',
    }}>
      {/* Progress Bar */}
      <div style={{
        height: 3,
        background: 'rgba(168,85,247,0.15)',
        borderRadius: 2,
        overflow: 'hidden',
        marginBottom: 20,
      }}>
        <div style={{
          height: '100%',
          width: `${progress * 100}%`,
          background: `linear-gradient(90deg, ${CC.neon}, ${CC.gold})`,
          transition: 'width 0.4s ease',
          borderRadius: 2,
        }} />
      </div>

      {/* Phase Indicator */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <span style={{
          fontFamily: "'Orbitron', sans-serif",
          fontSize: 10,
          letterSpacing: '0.12em',
          fontWeight: 700,
          color: phase === 'rest' ? '#60a5fa' : CC.gold,
          background: phase === 'rest' ? 'rgba(96,165,250,0.1)' : 'rgba(250,204,21,0.08)',
          padding: '4px 12px',
          borderRadius: 4,
          border: `1px solid ${phase === 'rest' ? 'rgba(96,165,250,0.3)' : 'rgba(250,204,21,0.25)'}`,
        }}>
          {phase === 'rest' ? 'REST' : 'EXERCISE'}
        </span>
      </div>

      {/* Timer Display */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h1 style={{
          fontFamily: "'Orbitron', sans-serif",
          fontWeight: 900,
          fontSize: timeLeft !== null ? 56 : 36,
          color: phase === 'rest' ? '#60a5fa' : CC.text,
          textShadow: phase === 'rest'
            ? '0 0 20px rgba(96,165,250,0.4)'
            : '0 0 20px rgba(250,204,21,0.2)',
          letterSpacing: '0.04em',
        }}>
          {timeLeft !== null ? formatTime(timeLeft) : (current?.reps ? `${current.reps} REPS` : 'COMPLETE')}
        </h1>
      </div>

      {/* Current Exercise Info */}
      <div className="codec-panel" style={{ padding: '20px', marginBottom: 16 }}>
        <p style={{
          fontFamily: "'Orbitron', sans-serif",
          fontSize: 9, color: CC.muted,
          letterSpacing: '0.1em', marginBottom: 6,
        }}>
          EXERCISE {currentIdx + 1} OF {blocks.length}
        </p>
        <h2 style={{
          fontSize: 22, fontWeight: 700, color: CC.text, marginBottom: 8,
        }}>
          {current?.exercise || 'Exercise'}
        </h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <InfoChip label="SET" value={`${currentSet}/${current?.sets || 1}`} />
          {current?.reps && <InfoChip label="REPS" value={current.reps} />}
          {current?.durationSeconds > 0 && <InfoChip label="TIME" value={`${current.durationSeconds}s`} />}
          {current?.restSeconds > 0 && <InfoChip label="REST" value={`${current.restSeconds}s`} />}
          {current?.equipment && <InfoChip label="EQUIP" value={current.equipment} />}
        </div>
        {current?.notes && (
          <p style={{ fontSize: 12, color: CC.muted, marginTop: 10, fontStyle: 'italic' }}>
            {current.notes}
          </p>
        )}
      </div>

      {/* Next Up */}
      {!isLastExercise && phase === 'exercise' && (
        <div style={{
          background: 'rgba(168,85,247,0.05)',
          border: '1px solid rgba(168,85,247,0.12)',
          borderRadius: 8,
          padding: '10px 14px',
          marginBottom: 16,
        }}>
          <p style={{ fontSize: 10, color: CC.muted, fontFamily: "'Orbitron'", letterSpacing: '0.08em' }}>
            NEXT UP
          </p>
          <p style={{ fontSize: 14, color: CC.text, marginTop: 4 }}>
            {blocks[currentIdx + 1]?.exercise}
          </p>
        </div>
      )}

      {/* Control Buttons */}
      <div style={{ marginTop: 'auto', paddingTop: 24 }}>
        {/* Mark Complete (for rep-based or no-duration exercises) */}
        {phase === 'exercise' && !hasDuration && (
          <button
            className="codec-btn-gold"
            onClick={handleMarkComplete}
            style={{ width: '100%', marginBottom: 12, fontSize: 13 }}
          >
            {isLastSet && isLastExercise ? 'FINISH MISSION' : 'MARK SET COMPLETE'}
          </button>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
          <button className="codec-btn" onClick={handlePrev} disabled={currentIdx === 0} style={{ ...ctrlStyle, opacity: currentIdx === 0 ? 0.35 : 1 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="19 20 9 12 19 4"/>
              <line x1="5" y1="19" x2="5" y2="5"/>
            </svg>
          </button>

          <button
            className="codec-btn"
            onClick={running ? handlePause : handleResume}
            disabled={timeLeft === null}
            style={{ ...ctrlStyle, opacity: timeLeft === null ? 0.35 : 1 }}
          >
            {running ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="6" y="4" width="4" height="16"/>
                <rect x="14" y="4" width="4" height="16"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5 3 19 12 5 21"/>
              </svg>
            )}
          </button>

          <button className="codec-btn" onClick={handleSkip} style={ctrlStyle}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="5 4 15 12 5 20"/>
              <line x1="19" y1="5" x2="19" y2="19"/>
            </svg>
          </button>

          <button className="codec-btn-danger" onClick={finishMission} style={{ ...ctrlStyle, padding: '12px 8px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoChip({ label, value }) {
  return (
    <div style={{
      background: 'rgba(168,85,247,0.08)',
      border: '1px solid rgba(168,85,247,0.2)',
      borderRadius: 6,
      padding: '6px 10px',
    }}>
      <p style={{ fontSize: 9, color: CC.muted, fontFamily: "'Orbitron'", letterSpacing: '0.08em' }}>{label}</p>
      <p style={{ fontSize: 15, color: CC.text, fontWeight: 600 }}>{value}</p>
    </div>
  );
}

const ctrlStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '14px 8px',
};

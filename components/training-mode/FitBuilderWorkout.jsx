import { useState, useEffect, useRef } from 'react';
import PhoneFrame from './PhoneFrame';
import TrainingHeader from './TrainingHeader';
import Embers from './Embers';
import { Check, Dumbbell, RotateCcw, Trophy, Play, ArrowRightLeft, X, SkipForward, ChevronRight } from 'lucide-react';
import { C } from './Styles';
import { generateFitModeWorkout } from './fit-mode/fitModeGenerator';
import { FIT_MODE_EXERCISES } from './fit-mode/fitModeExerciseData';
import FitRepCoach from './FitRepCoach';
import useWakeLock from './hooks/useWakeLock';

const GOLD = C.gold;

const workoutCSS = `
@keyframes fadeSlideUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
.wo-row { transition: all 0.2s ease; }
.wo-row:hover { background: rgba(253,224,71,0.04) !important; }
.wo-regen { transition: all 0.2s ease; }
.wo-regen:hover { transform: scale(1.03); filter: brightness(1.1); }
.wo-regen:active { transform: scale(0.95); }
.wo-cta { transition: all 0.2s ease; }
.wo-cta:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.1); }
.wo-cta:active:not(:disabled) { transform: scale(0.97); }
.wo-swap-item { transition: all 0.15s ease; cursor: pointer; }
.wo-swap-item:hover { background: rgba(168,85,247,0.12) !important; }
`;

const MUSCLE_COLORS = {
  Chest: '#ef4444', Back: '#3b82f6', Shoulders: '#f59e0b',
  Biceps: '#22c55e', Triceps: '#8b5cf6', Core: '#ec4899',
  Quads: '#06b6d4', Hamstrings: '#14b8a6', Glutes: '#f97316',
};

function buildTitle(cfg) {
  const mg = cfg.muscleGroups;
  const upper = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps'];
  const lower = ['Quads', 'Hamstrings', 'Glutes'];
  const hasUpper = mg.some(g => upper.includes(g));
  const hasLower = mg.some(g => lower.includes(g));
  const hasCore = mg.includes('Core');

  let focus = 'CUSTOM';
  if (hasUpper && hasLower) focus = 'FULL BODY';
  else if (hasUpper && !hasLower && !hasCore) focus = 'UPPER BODY';
  else if (hasLower && !hasUpper && !hasCore) focus = 'LOWER BODY';
  else if (hasCore && !hasUpper && !hasLower) focus = 'CORE';
  else if (hasUpper && hasCore) focus = 'UPPER + CORE';
  else if (hasLower && hasCore) focus = 'LOWER + CORE';

  return `${focus} ${cfg.equipment.toUpperCase()}`;
}

function getAlternates(exercise, cfg) {
  // Generated items carry `muscle` in UPPERCASE while the exercise DB uses
  // title case in `primaryMuscle` — compare case-insensitively or the list
  // always comes back empty.
  const muscle = String(exercise.primaryMuscle || exercise.muscle || '').toLowerCase();
  return FIT_MODE_EXERCISES.filter(ex =>
    ex.active &&
    String(ex.primaryMuscle || '').toLowerCase() === muscle &&
    ex.name !== exercise.name &&
    (cfg.equipment === 'Hybrid' || ex.equipment.toLowerCase() === cfg.equipment.toLowerCase() || ex.equipment === 'Bodyweight')
  ).slice(0, 8);
}

function SwapSheet({ exercise, alternates, onSelect, onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
    }}>
      <div onClick={onClose} style={{ flex: 1, background: 'rgba(0,0,0,0.7)' }}/>
      <div style={{
        background: '#0a0014', borderRadius: '16px 16px 0 0',
        padding: '16px 14px calc(20px + env(safe-area-inset-bottom, 0px))',
        border: '1px solid rgba(168,85,247,0.3)', borderBottom: 'none',
        maxHeight: '60vh', overflowY: 'auto',
        animation: 'fadeSlideUp 0.2s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 11, color: C.violet, letterSpacing: '0.08em' }}>
            SWAP: {exercise.name.toUpperCase()}
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={18} color={C.muted}/>
          </button>
        </div>
        {alternates.length === 0 ? (
          <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 12, color: C.faint, textAlign: 'center', padding: 20 }}>
            No alternates available for this muscle/equipment.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {alternates.map(alt => (
              <button key={alt.id} className="wo-swap-item" onClick={() => onSelect(alt)} style={{
                width: '100%', padding: '10px 12px', borderRadius: 8, textAlign: 'left',
                background: 'rgba(10,0,20,0.6)', border: '1px solid rgba(168,85,247,0.12)',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: 3,
                  background: MUSCLE_COLORS[alt.primaryMuscle] || C.violet, flexShrink: 0,
                }}/>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 10, color: '#fff', letterSpacing: '0.03em' }}>
                    {alt.name}
                  </div>
                  <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 10, color: C.faint, marginTop: 1 }}>
                    {alt.sets}x{alt.reps} &middot; {alt.equipment}
                  </div>
                </div>
                <ChevronRight size={12} color={C.faint}/>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function GuidedActiveScreen({ exercises, exerciseIdx, onComplete, onBack, profile }) {
  const ex = exercises[exerciseIdx];
  const [currentSet, setCurrentSet] = useState(1);
  const totalSets = ex.sets || 3;
  const [resting, setResting] = useState(false);
  const [restTime, setRestTime] = useState(0);
  const restMax = ex.restSeconds || parseInt(ex.rest) || 60;
  const timerRef = useRef(null);
  const progress = exerciseIdx / exercises.length;

  const nextExercise = exerciseIdx < exercises.length - 1 ? exercises[exerciseIdx + 1] : null;

  useEffect(() => {
    if (resting) {
      setRestTime(restMax);
      timerRef.current = setInterval(() => {
        setRestTime(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setResting(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timerRef.current);
    }
  }, [resting, restMax]);

  const confirmSet = () => {
    if (currentSet < totalSets) {
      setCurrentSet(s => s + 1);
      setResting(true);
    } else {
      onComplete();
    }
  };

  const skipRest = () => {
    clearInterval(timerRef.current);
    setResting(false);
    setRestTime(0);
  };

  return (
    <PhoneFrame useBrandBg>
      <Embers count={2}/>
      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
        minHeight: '100dvh', padding: '16px',
      }}>
        {/* Back */}
        <button onClick={onBack} style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 9,
          color: C.faint, letterSpacing: '0.1em', marginBottom: 12, alignSelf: 'flex-start',
        }}>&#x2190; BACK TO LIST</button>

        {/* Progress bar */}
        <div style={{ width: '100%', height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', marginBottom: 20 }}>
          <div style={{
            width: `${progress * 100}%`, height: '100%', borderRadius: 2,
            background: `linear-gradient(90deg, ${GOLD}, ${C.cardio})`,
            transition: 'width 0.4s ease',
          }}/>
        </div>

        {/* Exercise info */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          {/* Form demo placeholder */}
          <div style={{
            width: 140, height: 140, borderRadius: 12, marginBottom: 20,
            background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Dumbbell size={36} color="rgba(168,85,247,0.3)"/>
          </div>

          <div style={{
            fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 18,
            color: '#fff', letterSpacing: '0.06em', textAlign: 'center', marginBottom: 6,
          }}>{ex.name}</div>

          <div style={{
            fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 12,
            color: C.faint, marginBottom: 20,
          }}>{ex.muscle} &middot; {ex.sets}x{ex.reps}</div>

          {resting ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 48,
                color: C.cardio, marginBottom: 6,
              }}>{restTime}</div>
              <div style={{
                fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 10,
                color: C.faint, letterSpacing: '0.12em', marginBottom: 16,
              }}>REST</div>
              <button onClick={skipRest} className="wo-cta" style={{
                padding: '10px 24px', borderRadius: 8, cursor: 'pointer',
                background: 'rgba(255,138,74,0.15)', border: '1px solid rgba(255,138,74,0.4)',
                fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 10,
                color: C.cardio, letterSpacing: '0.08em',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <SkipForward size={13}/> SKIP REST
              </button>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 13,
                color: GOLD, letterSpacing: '0.08em', marginBottom: 16,
              }}>SET {currentSet} / {totalSets}</div>
              <button onClick={confirmSet} className="wo-cta" style={{
                padding: '16px 40px', borderRadius: 12, border: 'none', cursor: 'pointer',
                background: `linear-gradient(135deg, ${GOLD}, #f59e0b)`,
                color: '#0a0014', fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 13,
                letterSpacing: '0.12em',
                boxShadow: '0 0 20px rgba(253,224,71,0.35)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <Check size={16} strokeWidth={3}/> DONE
              </button>
            </div>
          )}
        </div>

        {/* Next exercise preview */}
        {nextExercise && !resting && (
          <div style={{
            borderRadius: 8, padding: '8px 12px', marginTop: 16,
            background: 'rgba(10,0,20,0.6)', border: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <div style={{
              fontFamily: "'Orbitron',sans-serif", fontSize: 7, fontWeight: 700,
              color: C.faint, letterSpacing: '0.1em',
            }}>NEXT:</div>
            <div style={{
              fontFamily: "'Orbitron',sans-serif", fontSize: 10, fontWeight: 700,
              color: C.muted, letterSpacing: '0.04em',
            }}>{nextExercise.name}</div>
          </div>
        )}
      </div>
    </PhoneFrame>
  );
}

export default function FitBuilderWorkout({ cfg, onDone, profile, initialPaused, onStateChange, initialResumeData }) {
  useWakeLock(true);
  const [exercises, setExercises] = useState(() => generateFitModeWorkout(cfg));
  const [completed, setCompleted] = useState(initialResumeData?.completed ?? {});
  const [repCoachIdx, setRepCoachIdx] = useState(null);
  const [activeIdx, setActiveIdx] = useState(null);
  const [swapIdx, setSwapIdx] = useState(null);

  const toggle = (i) => setCompleted(prev => ({ ...prev, [i]: !prev[i] }));
  const doneCount = Object.values(completed).filter(Boolean).length;
  const pct = exercises.length > 0 ? Math.round((doneCount / exercises.length) * 100) : 0;
  const allDone = doneCount === exercises.length && exercises.length > 0;
  const title = buildTitle(cfg);

  const regenerate = () => {
    setExercises(generateFitModeWorkout(cfg));
    setCompleted({});
    setActiveIdx(null);
    setSwapIdx(null);
  };

  const handleSwapSelect = (alt) => {
    setExercises(prev => prev.map((ex, i) => i === swapIdx ? {
      ...ex,
      name: alt.name,
      sets: alt.sets,
      reps: alt.reps,
      rest: `${alt.restSeconds}s`,
      restSeconds: alt.restSeconds,
      // Keep the UPPERCASE convention the generator uses (display + colours).
      muscle: String(alt.primaryMuscle || '').toUpperCase(),
      primaryMuscle: alt.primaryMuscle,
      equipment: alt.equipment,
      coachNote: alt.coachNote,
    } : ex));
    setSwapIdx(null);
  };

  useEffect(() => {
    if (typeof onStateChange === 'function') {
      onStateChange({ completed });
    }
  }, [completed, onStateChange]);

  // Guided active screen
  if (activeIdx !== null) {
    return (
      <GuidedActiveScreen
        exercises={exercises}
        exerciseIdx={activeIdx}
        profile={profile}
        onBack={() => setActiveIdx(null)}
        onComplete={() => {
          setCompleted(prev => ({ ...prev, [activeIdx]: true }));
          if (activeIdx < exercises.length - 1) {
            setActiveIdx(activeIdx + 1);
          } else {
            setActiveIdx(null);
          }
        }}
      />
    );
  }

  // Rep coach fallback for bodyweight
  if (repCoachIdx !== null) {
    const ex = exercises[repCoachIdx];
    return (
      <FitRepCoach
        exercise={ex}
        profile={profile}
        onBack={() => setRepCoachIdx(null)}
        onComplete={() => {
          setCompleted(prev => ({ ...prev, [repCoachIdx]: true }));
          setRepCoachIdx(null);
        }}
      />
    );
  }

  return (
    <PhoneFrame useBrandBg>
      <style dangerouslySetInnerHTML={{ __html: workoutCSS }}/>
      <Embers count={2}/>

      <TrainingHeader
        title={title}
        subtitle={`${cfg.difficulty} \u00B7 ${cfg.equipment}`}
        showBack
        onBack={() => onDone(doneCount, exercises.length)}
        onHome={() => onDone(doneCount, exercises.length)}
      />

      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
        padding: '10px 14px 0',
        paddingBottom: 'calc(140px + env(safe-area-inset-bottom, 0px))',
      }}>

        {/* Muscle tags */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
          {cfg.muscleGroups.map(g => (
            <span key={g} style={{
              fontFamily: "'Orbitron',sans-serif", fontSize: 7.5, fontWeight: 700,
              color: MUSCLE_COLORS[g] || GOLD, letterSpacing: '0.06em',
              padding: '2px 7px', borderRadius: 4,
              background: `${MUSCLE_COLORS[g] || GOLD}12`, border: `1px solid ${MUSCLE_COLORS[g] || GOLD}40`,
            }}>{g.toUpperCase()}</span>
          ))}
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <div style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 11, color: C.faint }}>
              {doneCount}/{exercises.length} exercises
            </div>
            <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 11, color: GOLD }}>{pct}%</div>
          </div>
          <div style={{ width: '100%', height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
            <div style={{
              width: `${pct}%`, height: '100%', borderRadius: 2,
              background: `linear-gradient(90deg, ${GOLD}, #f59e0b)`,
              boxShadow: '0 0 6px rgba(253,224,71,0.3)',
              transition: 'width 0.4s ease',
            }}/>
          </div>
        </div>

        {/* Regenerate button */}
        <button onClick={regenerate} className="wo-regen" style={{
          width: '100%', padding: '10px 0', borderRadius: 8, marginBottom: 12,
          cursor: 'pointer',
          background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.35)',
          fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 11,
          color: C.violet, letterSpacing: '0.1em',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <RotateCcw size={14}/> REGENERATE
        </button>

        {/* Exercise rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {exercises.map((ex, i) => {
            const done = !!completed[i];
            const muscleColor = MUSCLE_COLORS[ex.muscle] || C.faint;
            return (
              <div key={`${ex.name}-${i}`} className="wo-row" style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 10px', borderRadius: 8,
                background: done ? 'rgba(253,224,71,0.04)' : 'rgba(10,0,20,0.5)',
                border: done ? '1px solid rgba(253,224,71,0.2)' : '1px solid rgba(255,255,255,0.04)',
              }}>
                {/* Color initial square */}
                <div style={{
                  width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                  background: done ? GOLD : `${muscleColor}18`,
                  border: done ? 'none' : `1.5px solid ${muscleColor}50`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {done
                    ? <Check size={14} color="#0a0014" strokeWidth={3}/>
                    : <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 10, color: muscleColor }}>{ex.name[0]}</span>
                  }
                </div>

                {/* Name + details */}
                <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => toggle(i)}>
                  <div style={{
                    fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 10.5,
                    color: done ? 'rgba(253,224,71,0.7)' : '#fff',
                    letterSpacing: '0.03em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    textDecoration: done ? 'line-through' : 'none',
                  }}>{ex.name}</div>
                  <div style={{
                    fontFamily: "'Rajdhani',sans-serif", fontSize: 10, fontWeight: 600, color: C.faint, marginTop: 1,
                  }}>{ex.sets}x{ex.reps} &middot; {ex.rest} rest</div>
                </div>

                {/* Swap button */}
                {!done && (
                  <button onClick={(e) => { e.stopPropagation(); setSwapIdx(i); }} style={{
                    width: 24, height: 24, borderRadius: 5, cursor: 'pointer',
                    background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <ArrowRightLeft size={11} color={C.violet}/>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom CTA */}
      <div style={{
        position: 'fixed', left: 0, right: 0,
        bottom: 'calc(70px + env(safe-area-inset-bottom, 0px))',
        padding: '14px 14px 16px',
        background: 'linear-gradient(to top, rgba(10,0,20,0.98) 70%, transparent)',
        zIndex: 20,
      }}>
        <button
          className="wo-cta"
          onClick={() => {
            if (allDone) {
              onDone(doneCount, exercises.length);
            } else {
              const firstIncomplete = exercises.findIndex((_, i) => !completed[i]);
              setActiveIdx(firstIncomplete >= 0 ? firstIncomplete : 0);
            }
          }}
          style={{
            width: '100%', padding: '15px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
            background: allDone
              ? `linear-gradient(135deg, ${GOLD}, #f59e0b)`
              : `linear-gradient(135deg, ${GOLD}, #f59e0b)`,
            color: '#0a0014',
            fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 13,
            letterSpacing: '0.14em',
            boxShadow: `0 0 20px rgba(253,224,71,${allDone ? '0.5' : '0.3'})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {allDone ? <Trophy size={17}/> : <Play size={15}/>}
          {allDone ? 'COMPLETE WORKOUT' : 'START'}
        </button>
      </div>

      {/* Swap bottom sheet */}
      {swapIdx !== null && (
        <SwapSheet
          exercise={exercises[swapIdx]}
          alternates={getAlternates(exercises[swapIdx], cfg)}
          onSelect={handleSwapSelect}
          onClose={() => setSwapIdx(null)}
        />
      )}
    </PhoneFrame>
  );
}

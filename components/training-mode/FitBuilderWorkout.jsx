import { useState, useEffect } from 'react';
import PhoneFrame from './PhoneFrame';
import TrainingHeader from './TrainingHeader';
import Embers from './Embers';
import { Check, RotateCcw, Trophy, Play, ArrowRightLeft, X, ChevronRight, Minus, Plus, Bookmark } from 'lucide-react';
import { C } from './Styles';
import { generateFitModeWorkout } from './fit-mode/fitModeGenerator';
import { FIT_MODE_EXERCISES } from './fit-mode/fitModeExerciseData';
import FitBuilderGuidedPlayer from './FitBuilderGuidedPlayer';
import { saveRoutine } from './data/savedRoutines';
import { primeSpeech, setVoiceGender } from './voiceCoach';
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
  const pool = FIT_MODE_EXERCISES.filter(ex =>
    ex.active &&
    String(ex.primaryMuscle || '').toLowerCase() === muscle &&
    ex.name !== exercise.name
  );
  const isBw = (ex) => ex.equipment === 'Bodyweight';

  // Weighted workouts swap to weighted work: ~80% loaded alternatives —
  // 5 weighted (incl. cable/machine/band) + 2 bodyweight fallbacks.
  if (cfg.equipment === 'Weighted') {
    return [...pool.filter(ex => !isBw(ex)).slice(0, 5), ...pool.filter(isBw).slice(0, 2)];
  }
  if (cfg.equipment === 'Hybrid') return pool.slice(0, 8);
  // Bodyweight config: bodyweight alternates only.
  return pool.filter(isBw).slice(0, 8);
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

function Stepper({ label, value, display, onDec, onInc }) {
  const btn = {
    width: 34, height: 34, borderRadius: 8, cursor: 'pointer',
    background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.35)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0' }}>
      <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 9, color: C.faint, letterSpacing: '0.12em' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onDec} aria-label={`Decrease ${label}`} style={btn}><Minus size={14} color={C.violet}/></button>
        <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 15, color: '#fff', minWidth: 52, textAlign: 'center' }}>{display ?? value}</span>
        <button onClick={onInc} aria-label={`Increase ${label}`} style={btn}><Plus size={14} color={C.violet}/></button>
      </div>
    </div>
  );
}

// Edit sets / reps / rest for one exercise before the workout starts.
function EditSheet({ exercise, onSave, onClose }) {
  const isHold = /^\d+\s*s$/i.test(String(exercise.reps).trim());
  const repsInit = parseInt(String(exercise.reps).split('-').pop(), 10) || 10;
  const [sets, setSets] = useState(exercise.sets || 3);
  const [reps, setReps] = useState(repsInit);
  const [rest, setRest] = useState(exercise.restSeconds || parseInt(exercise.rest) || 60);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ flex: 1, background: 'rgba(0,0,0,0.7)' }}/>
      <div style={{
        background: '#0a0014', borderRadius: '16px 16px 0 0',
        padding: '16px 16px calc(20px + env(safe-area-inset-bottom, 0px))',
        border: '1px solid rgba(168,85,247,0.3)', borderBottom: 'none',
        animation: 'fadeSlideUp 0.2s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 11, color: GOLD, letterSpacing: '0.08em' }}>
            EDIT: {exercise.name.toUpperCase()}
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={18} color={C.muted}/>
          </button>
        </div>
        <Stepper label="SETS" value={sets} onDec={() => setSets(s => clamp(s - 1, 1, 8))} onInc={() => setSets(s => clamp(s + 1, 1, 8))}/>
        <Stepper label={isHold ? 'HOLD TIME' : 'REPS'} value={reps} display={isHold ? `${reps}s` : reps}
          onDec={() => setReps(r => clamp(r - (isHold ? 5 : 1), isHold ? 10 : 1, isHold ? 180 : 60))}
          onInc={() => setReps(r => clamp(r + (isHold ? 5 : 1), isHold ? 10 : 1, isHold ? 180 : 60))}/>
        <Stepper label="REST" value={rest} display={`${rest}s`}
          onDec={() => setRest(r => clamp(r - 15, 15, 300))} onInc={() => setRest(r => clamp(r + 15, 15, 300))}/>
        <button className="wo-cta" onClick={() => onSave({ sets, reps: isHold ? `${reps}s` : reps, restSeconds: rest, rest: `${rest}s` })} style={{
          width: '100%', padding: '13px 0', borderRadius: 10, border: 'none', cursor: 'pointer', marginTop: 10,
          background: `linear-gradient(135deg, ${GOLD}, #f59e0b)`, color: '#0a0014',
          fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 12, letterSpacing: '0.1em',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        }}>
          <Check size={15} strokeWidth={3}/> APPLY
        </button>
      </div>
    </div>
  );
}

export default function FitBuilderWorkout({ cfg, onDone, profile, initialPaused, onStateChange, initialResumeData }) {
  useWakeLock(true);
  // A saved routine loads its exact (possibly hand-tuned) exercise list.
  const [exercises, setExercises] = useState(() => cfg.savedExercises || generateFitModeWorkout(cfg));
  const [completed, setCompleted] = useState(initialResumeData?.completed ?? {});
  const [activeIdx, setActiveIdx] = useState(null);
  const [swapIdx, setSwapIdx] = useState(null);
  const [editIdx, setEditIdx] = useState(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [routineName, setRoutineName] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);

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

  const handleEditSave = (vals) => {
    setExercises(prev => prev.map((ex, i) => i === editIdx ? { ...ex, ...vals } : ex));
    setEditIdx(null);
  };

  const handleSaveRoutine = () => {
    const name = routineName.trim() || buildTitle(cfg);
    saveRoutine(name, cfg, exercises);
    setSaveOpen(false);
    setRoutineName('');
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1800);
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

  // Voice-guided player (design 34) — cycles sets/exercises like Quick
  // Mission; BACK returns to the list mid-workout for review + swaps.
  if (activeIdx !== null) {
    return (
      <FitBuilderGuidedPlayer
        key={`guided-${activeIdx}`}
        exercises={exercises}
        exerciseIdx={activeIdx}
        voiceOn
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

        {/* Workout header — exercises can only be swapped, never checked off
            by hand; the guided player crosses them out itself. */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 7 }}>
          <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 10.5, color: '#fff', letterSpacing: '0.1em' }}>WORKOUT</span>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.25 }}>
            <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 10.5, color: C.violet, letterSpacing: '0.1em' }}>SWAP WORKOUT</span>
            <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 9.5, color: C.faint }}>tap name to swap &middot; tap sets to edit</span>
          </div>
        </div>

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

                {/* Name taps open the swap sheet; the sets/reps/rest line taps
                    open the editor (rows are never checked off by hand) */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div onClick={() => !done && setSwapIdx(i)} style={{
                    fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 10.5,
                    color: done ? 'rgba(253,224,71,0.7)' : '#fff',
                    letterSpacing: '0.03em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    textDecoration: done ? 'line-through' : 'none',
                    cursor: done ? 'default' : 'pointer',
                  }}>{ex.name}</div>
                  <div onClick={() => !done && setEditIdx(i)} style={{
                    fontFamily: "'Rajdhani',sans-serif", fontSize: 10, fontWeight: 600, marginTop: 1,
                    color: done ? C.faint : '#c9b8e8', cursor: done ? 'default' : 'pointer',
                    textDecoration: done ? 'none' : 'underline dotted rgba(168,85,247,0.5)',
                    textUnderlineOffset: 2,
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

        {/* Regenerate + save routine — under the workout list */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={regenerate} className="wo-regen" style={{
            flex: 1, padding: '10px 0', borderRadius: 8, cursor: 'pointer',
            background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.35)',
            fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 11,
            color: C.violet, letterSpacing: '0.1em',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <RotateCcw size={14}/> REGENERATE
          </button>
          <button onClick={() => setSaveOpen(true)} className="wo-regen" style={{
            flex: 1, padding: '10px 0', borderRadius: 8, cursor: 'pointer',
            background: savedFlash ? 'rgba(34,197,94,0.14)' : 'rgba(253,224,71,0.08)',
            border: `1px solid ${savedFlash ? 'rgba(34,197,94,0.5)' : 'rgba(253,224,71,0.35)'}`,
            fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 11,
            color: savedFlash ? '#22c55e' : GOLD, letterSpacing: '0.1em',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <Bookmark size={14}/> {savedFlash ? 'SAVED ✓' : 'SAVE ROUTINE'}
          </button>
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
          onClick={async () => {
            if (allDone) {
              onDone(doneCount, exercises.length);
            } else {
              // Prime speech on the user gesture so the guided coach can talk.
              setVoiceGender(profile?.voiceCoach || 'FEMALE');
              await primeSpeech();
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

      {/* Sets/reps/rest editor */}
      {editIdx !== null && (
        <EditSheet
          exercise={exercises[editIdx]}
          onSave={handleEditSave}
          onClose={() => setEditIdx(null)}
        />
      )}

      {/* Save-routine sheet */}
      {saveOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setSaveOpen(false)} style={{ flex: 1, background: 'rgba(0,0,0,0.7)' }}/>
          <div style={{
            background: '#0a0014', borderRadius: '16px 16px 0 0',
            padding: '16px 16px calc(20px + env(safe-area-inset-bottom, 0px))',
            border: '1px solid rgba(253,224,71,0.3)', borderBottom: 'none',
            animation: 'fadeSlideUp 0.2s ease',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 11, color: GOLD, letterSpacing: '0.08em' }}>SAVE ROUTINE</div>
              <button onClick={() => setSaveOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4 }}>
                <X size={18} color={C.muted}/>
              </button>
            </div>
            <input
              value={routineName}
              onChange={e => setRoutineName(e.target.value)}
              placeholder={buildTitle(cfg)}
              maxLength={40}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '11px 12px', borderRadius: 9,
                background: 'rgba(20,8,38,0.9)', border: '1px solid rgba(168,85,247,0.35)',
                color: '#fff', fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 14,
                outline: 'none', marginBottom: 10,
              }}
            />
            <button className="wo-cta" onClick={handleSaveRoutine} style={{
              width: '100%', padding: '13px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: `linear-gradient(135deg, ${GOLD}, #f59e0b)`, color: '#0a0014',
              fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 12, letterSpacing: '0.1em',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}>
              <Bookmark size={15}/> SAVE
            </button>
          </div>
        </div>
      )}
    </PhoneFrame>
  );
}

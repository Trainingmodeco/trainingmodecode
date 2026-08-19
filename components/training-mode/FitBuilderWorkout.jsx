import { useState, useEffect, useRef } from 'react';
import PhoneFrame from './PhoneFrame';
import TrainingHeader from './TrainingHeader';
import Embers from './Embers';
import { Check, RotateCcw, Trophy, Play, ArrowRightLeft, ChevronRight, Minus, Plus, Bookmark } from 'lucide-react';
import { C } from './Styles';
import BottomSheet from './shared/BottomSheet';
import { generateFitModeWorkout } from './fit-mode/fitModeGenerator';
import { FIT_MODE_EXERCISES } from './fit-mode/fitModeExerciseData';
import FitBuilderGuidedPlayer from './FitBuilderGuidedPlayer';
import { saveRoutine, loadRoutines, MAX_ROUTINES } from './data/savedRoutines';
import { routineSlotLimit } from './data/entitlements';
import { primeSpeech, setVoiceGender } from './voiceCoach';
import useWakeLock from './hooks/useWakeLock';
import { loadProfile } from './data/userProfile';
import { classifyType, exerciseWeight, unitLabel, normUnit, stepFor, convertWeight, defaultWeight } from './data/weightLog';
import { recordBuilderWorkout, rowProgression, loadLastBuilderWorkout } from './data/builderProgression';

const GOLD = C.gold;

// −/＋ button in the working-weight stepper (design 39).
const weightBtn = {
  width: 34, height: 34, borderRadius: 9, flexShrink: 0, cursor: 'pointer',
  background: 'rgba(253,224,71,0.1)', border: '1px solid rgba(253,224,71,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

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

// Seeded shuffle so every session deals a fresh hand of alternates. The
// exercise DB is in a fixed order, so slicing it unshuffled surfaced the same
// few names (Alligator Push-Ups first among them) in every single swap sheet.
function seededShuffle(list, seed) {
  let s = 0;
  const str = String(seed);
  for (let i = 0; i < str.length; i++) s = (s * 31 + str.charCodeAt(i)) >>> 0;
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function getAlternates(exercise, cfg, takenNames, seed) {
  // Generated items carry `muscle` in UPPERCASE while the exercise DB uses
  // title case in `primaryMuscle` — compare case-insensitively or the list
  // always comes back empty.
  const muscle = String(exercise.primaryMuscle || exercise.muscle || '').toLowerCase();
  const pool = seededShuffle(FIT_MODE_EXERCISES.filter(ex =>
    ex.active &&
    String(ex.primaryMuscle || '').toLowerCase() === muscle &&
    // Never offer a movement the workout already contains (in ANY slot) —
    // swapping to it would put the same exercise in twice.
    !takenNames.has(String(ex.name).toLowerCase())
  ), seed);
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
    <BottomSheet title={`SWAP: ${exercise.name.toUpperCase()}`} accent={C.violet} onClose={onClose} maxHeight="70dvh">
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
    </BottomSheet>
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

  // Design 39 — optional WORKING WEIGHT (weighted lifts only).
  const isWeighted = classifyType(exercise) === 'weighted';
  const existing = exerciseWeight(exercise);
  const initUnit = existing?.unit || normUnit(loadProfile()?.weightUnit);
  const [unit, setUnit] = useState(initUnit);
  const [weight, setWeight] = useState(existing?.weight || defaultWeight(initUnit));
  const [hasWeight, setHasWeight] = useState(!!existing);
  const toggleUnit = (u) => { if (u !== unit) { setWeight(w => convertWeight(w, unit, u)); setUnit(u); } };
  const wStep = stepFor(unit);

  const save = () => onSave({
    sets, reps: isHold ? `${reps}s` : reps, restSeconds: rest, rest: `${rest}s`,
    ...(isWeighted ? { weight: hasWeight ? weight : null, unit } : {}),
  });

  return (
    <BottomSheet
      title={`EDIT: ${exercise.name.toUpperCase()}`}
      accent={GOLD}
      onClose={onClose}
      footer={(
        <button className="wo-cta" onClick={save} style={{
          width: '100%', padding: '13px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
          background: `linear-gradient(135deg, ${GOLD}, #f59e0b)`, color: '#0a0014',
          fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 12, letterSpacing: '0.1em',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        }}>
          <Check size={15} strokeWidth={3}/> APPLY
        </button>
      )}
    >
      <Stepper label="SETS" value={sets} onDec={() => setSets(s => clamp(s - 1, 1, 8))} onInc={() => setSets(s => clamp(s + 1, 1, 8))}/>
      <Stepper label={isHold ? 'HOLD TIME' : 'REPS'} value={reps} display={isHold ? `${reps}s` : reps}
        onDec={() => setReps(r => clamp(r - (isHold ? 5 : 1), isHold ? 10 : 1, isHold ? 180 : 60))}
        onInc={() => setReps(r => clamp(r + (isHold ? 5 : 1), isHold ? 10 : 1, isHold ? 180 : 60))}/>
      <Stepper label="REST" value={rest} display={`${rest}s`}
        onDec={() => setRest(r => clamp(r - 15, 15, 300))} onInc={() => setRest(r => clamp(r + 15, 15, 300))}/>

      {/* Design 39 — WORKING WEIGHT (optional, weighted lifts only) */}
      {isWeighted && (
          <div style={{ marginTop: 10, borderRadius: 12, border: '1px solid rgba(253,224,71,0.55)', background: 'rgba(253,224,71,0.05)', boxShadow: '0 0 14px rgba(253,224,71,0.14)', padding: '10px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: hasWeight ? 8 : 0 }}>
              <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 9, color: GOLD, letterSpacing: '0.1em' }}>WORKING WEIGHT</span>
              <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 6.5, color: '#0a0014', background: GOLD, borderRadius: 3, padding: '2px 5px', letterSpacing: '0.08em' }}>· NEW</span>
              <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 9, color: C.muted, marginLeft: 'auto' }}>optional</span>
            </div>
            {!hasWeight ? (
              <button onClick={() => setHasWeight(true)} style={{ width: '100%', padding: '9px 0', borderRadius: 9, cursor: 'pointer', background: 'rgba(253,224,71,0.1)', border: '1px dashed rgba(253,224,71,0.5)', color: GOLD, fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 10, letterSpacing: '0.06em' }}>+ ADD WEIGHT</button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button onClick={() => setWeight(w => Math.max(wStep, w - wStep))} style={weightBtn}><Minus size={15} color={GOLD}/></button>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 26, color: '#fff' }}>{weight}</span>
                  <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 11, color: GOLD, marginLeft: 4 }}>{unitLabel(unit)}</span>
                </div>
                <button onClick={() => setWeight(w => Math.min(2000, w + wStep))} style={weightBtn}><Plus size={15} color={GOLD}/></button>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginLeft: 2 }}>
                  {['lb', 'kg'].map(u => (
                    <button key={u} onClick={() => toggleUnit(u)} style={{ padding: '3px 8px', borderRadius: 6, cursor: 'pointer', fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 8, letterSpacing: '0.05em', color: unit === u ? '#0a0014' : '#c9b8e8', background: unit === u ? GOLD : 'rgba(16,4,30,0.8)', border: unit === u ? 'none' : '1px solid rgba(168,85,247,0.3)' }}>{u.toUpperCase()}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
      )}
    </BottomSheet>
  );
}

// 38b — a selected set scheme (3×10 / 5×5 / …) becomes the default for every
// WEIGHTED lift in the generated list; bodyweight rows keep the generator's
// numbers, and a per-row edit afterwards still overrides just that row.
function applyScheme(list, scheme) {
  if (!scheme?.sets) return list;
  return list.map(ex =>
    String(ex.equipment || '').toLowerCase() === 'bodyweight'
      ? ex
      : { ...ex, sets: scheme.sets, reps: scheme.reps, rest: `${scheme.restSeconds}s`, restSeconds: scheme.restSeconds }
  );
}

// Spec 10 (free-select map) — every row carries a stable uid so the guided
// player can key on the EXERCISE rather than its position: reordering the
// workout mid-session must not remount the player (that would wipe the
// current exercise's set progress). Swaps keep the uid (same slot, new move).
let uidCounter = 0;
function withUids(list) {
  return list.map(ex => (ex._uid ? ex : { ...ex, _uid: `x${++uidCounter}_${Math.random().toString(36).slice(2, 7)}` }));
}

export default function FitBuilderWorkout({ cfg, onDone, onBack, onHome, profile, onPaywall, initialPaused, onStateChange, initialResumeData }) {
  useWakeLock(true);
  // A saved routine loads its exact (possibly hand-tuned) exercise list.
  const [exercises, setExercises] = useState(() => withUids(cfg.savedExercises || applyScheme(generateFitModeWorkout(cfg), cfg.setScheme)));
  const [completed, setCompleted] = useState(initialResumeData?.completed ?? {});
  // Exercises passed over with SKIP EXERCISE — shown as skipped (not done) in
  // the player's workout map, cleared if the exercise is later completed.
  const [skipped, setSkipped] = useState(initialResumeData?.skipped ?? {});
  const [activeIdx, setActiveIdx] = useState(null);
  const [swapIdx, setSwapIdx] = useState(null);
  // One deal of swap alternates per session — reopening a sheet keeps its
  // order, a fresh workout reshuffles (see seededShuffle above).
  const swapSeed = useRef(Math.random().toString(36).slice(2)).current;
  const [editIdx, setEditIdx] = useState(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [routineName, setRoutineName] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);
  const [saveErr, setSaveErr] = useState('');

  const doneCount = Object.values(completed).filter(Boolean).length;
  const pct = exercises.length > 0 ? Math.round((doneCount / exercises.length) * 100) : 0;
  const allDone = doneCount === exercises.length && exercises.length > 0;
  const title = buildTitle(cfg);
  // Spec 11 — the record as it stood BEFORE this session starts writing its
  // own completions, so every row's last-time comparison stays stable.
  const prevRecRef = useRef(loadLastBuilderWorkout());

  const regenerate = () => {
    setExercises(withUids(applyScheme(generateFitModeWorkout(cfg), cfg.setScheme)));
    setCompleted({});
    setSkipped({});
    setActiveIdx(null);
    setSwapIdx(null);
  };

  const handleEditSave = (vals) => {
    setExercises(prev => prev.map((ex, i) => i === editIdx ? { ...ex, ...vals } : ex));
    setEditIdx(null);
  };

  const handleSaveRoutine = () => {
    const name = routineName.trim() || buildTitle(cfg);
    // Free tier: one saved-routine slot. Overwriting a same-named routine is
    // always allowed; saving a NEW one past the limit routes to the paywall.
    const list = loadRoutines();
    const isReplace = list.some(r => r.name.toLowerCase() === name.toLowerCase());
    if (!isReplace && list.length >= routineSlotLimit()) {
      setSaveOpen(false);
      setRoutineName('');
      onPaywall?.();
      return;
    }
    // Hard shelf cap (Pro included): 10 named routines. A full shelf keeps
    // the sheet open with a message instead of silently dropping anything.
    if (!isReplace && list.length >= MAX_ROUTINES) {
      setSaveErr(`Shelf full — ${MAX_ROUTINES}/${MAX_ROUTINES} routines saved. Delete one in WORKOUT PROGRAMS to make room.`);
      return;
    }
    saveRoutine(name, cfg, exercises);
    setSaveOpen(false);
    setRoutineName('');
    setSaveErr('');
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
      onStateChange({ completed, skipped });
    }
    // Spec 11 — remember this workout for TRAIN AGAIN. Skips silently until
    // at least one exercise is completed, so an untouched generate never
    // clobbers the last real session's progression history.
    recordBuilderWorkout({ title, cfg, exercises, completed });
  }, [completed, skipped, onStateChange, title, cfg, exercises]);

  // Spec 10 — reorder from the map. `orderOld` is the full list of OLD indices
  // in their NEW order (the player computes the weave so done/skipped rows stay
  // pinned in place). Remap the index-keyed completed/skipped maps and follow
  // the active exercise to its new position.
  const handleReorder = (orderOld) => {
    if (!Array.isArray(orderOld) || orderOld.length !== exercises.length) return;
    const newIdxOf = {};
    orderOld.forEach((oldI, newI) => { newIdxOf[oldI] = newI; });
    setExercises(prev => orderOld.map(o => prev[o]));
    const remap = (m) => {
      const next = {};
      Object.keys(m).forEach(k => { if (m[k]) next[newIdxOf[k]] = true; });
      return next;
    };
    setCompleted(remap);
    setSkipped(remap);
    setActiveIdx(a => (a === null ? null : newIdxOf[a]));
  };

  // Voice-guided player (design 34 + spec 10 free-select map). Keyed on the
  // exercise's stable uid, NOT its index: a reorder moves the current exercise
  // to a new index without remounting the player (set progress survives);
  // jumping to a DIFFERENT exercise changes the uid and remounts fresh.
  if (activeIdx !== null) {
    return (
      <FitBuilderGuidedPlayer
        key={`guided-${exercises[activeIdx]?._uid ?? activeIdx}`}
        exercises={exercises}
        exerciseIdx={activeIdx}
        completed={completed}
        skipped={skipped}
        voiceOn
        onBack={() => setActiveIdx(null)}
        onStop={() => onDone(doneCount, exercises.length)}
        onSkipExercise={() => {
          // Advance to the next exercise WITHOUT marking this one complete —
          // it shows as SKIPPED in the map until it's redone.
          setSkipped(s => ({ ...s, [activeIdx]: true }));
          if (activeIdx < exercises.length - 1) setActiveIdx(activeIdx + 1);
          else setActiveIdx(null);
        }}
        onRewindExercise={() => {
          // 3b — step back to the previous exercise and clear its completed
          // mark, so redoing it counts once (never leaves a stale ✓).
          if (activeIdx > 0) {
            const prev = activeIdx - 1;
            setCompleted(c => { const next = { ...c }; delete next[prev]; return next; });
            setSkipped(s => { const next = { ...s }; delete next[prev]; return next; });
            setActiveIdx(prev);
          }
        }}
        // Spec 10 — the exercise finished its last set. Mark it done but do NOT
        // advance: the player owns navigation now (completion map → glow → next).
        onCompleteExercise={() => {
          setCompleted(prev => ({ ...prev, [activeIdx]: true }));
          setSkipped(s => { if (!s[activeIdx]) return s; const next = { ...s }; delete next[activeIdx]; return next; });
        }}
        // Free select: start ANY non-done exercise. Re-entering a skipped one
        // clears its skip — only DONE is permanent.
        onJumpExercise={(idx) => {
          setSkipped(s => { if (!s[idx]) return s; const next = { ...s }; delete next[idx]; return next; });
          setActiveIdx(idx);
        }}
        // Hold + swipe on a map row. Skipping the CURRENT exercise behaves like
        // the SKIP EXERCISE button (advance); others just flip to SKIPPED.
        onMarkSkipped={(idx) => {
          setSkipped(s => ({ ...s, [idx]: true }));
          if (idx === activeIdx) {
            if (activeIdx < exercises.length - 1) setActiveIdx(activeIdx + 1);
            else setActiveIdx(null);
          }
        }}
        onReorder={handleReorder}
        onFinishWorkout={() => setActiveIdx(null)}
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
        onBack={onBack || (() => onDone(doneCount, exercises.length))}
        onHome={onHome || (() => onDone(doneCount, exercises.length))}
      />

      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
        padding: '10px 14px 0',
        // Clears the bottom nav only — the START CTA lives in the flow now.
        paddingBottom: 'calc(100px + env(safe-area-inset-bottom, 0px))',
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
            // Design 39 — weight only shows on weighted lifts.
            const wLog = classifyType(ex) === 'weighted' ? exerciseWeight(ex) : null;
            // Spec 11 — last-time progression verdict for this row.
            const prog = rowProgression(ex, prevRecRef.current);
            const isPR = !!prog?.isPR;
            return (
              <div key={`${ex.name}-${i}`} className="wo-row" style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 11px', borderRadius: 11,
                background: done ? 'rgba(253,224,71,0.04)' : 'rgba(8,2,18,0.85)',
                border: done ? '1px solid rgba(253,224,71,0.2)' : isPR ? '1px solid rgba(253,224,71,0.4)' : '1px solid rgba(168,85,247,0.22)',
              }}>
                {/* Color initial square (PR rows go gold-tinted) */}
                <div style={{
                  width: 24, height: 24, borderRadius: 7, flexShrink: 0,
                  background: done ? GOLD : isPR ? 'rgba(253,224,71,0.12)' : `${muscleColor}18`,
                  border: done ? 'none' : isPR ? '1.5px solid rgba(253,224,71,0.5)' : `1.5px solid ${muscleColor}50`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {done
                    ? <Check size={13} color="#0a0014" strokeWidth={3}/>
                    : <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 10, color: isPR ? GOLD : muscleColor }}>{ex.name[0]}</span>
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
                  }}>{ex.name}{prog?.state === 'new' && !done && (
                    <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 7, color: '#6d5a8f', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 4, padding: '1px 4px', marginLeft: 6, letterSpacing: '0.1em', verticalAlign: 'middle' }}>NEW</span>
                  )}</div>
                  <div onClick={() => !done && setEditIdx(i)} style={{
                    fontFamily: "'Rajdhani',sans-serif", fontSize: 10, fontWeight: 600, marginTop: 1,
                    color: done ? C.faint : '#9a90b8', cursor: done ? 'default' : 'pointer',
                    textDecoration: done ? 'none' : 'underline dotted rgba(168,85,247,0.5)',
                    textUnderlineOffset: 2,
                  }}>{ex.sets}x{ex.reps} &middot; {ex.rest} rest
                    {wLog
                      ? <span style={{ color: GOLD }}> &middot; {wLog.weight} {unitLabel(wLog.unit)}</span>
                      : classifyType(ex) === 'weighted' && !done
                        ? <span style={{ color: '#9a90b8' }}> &middot; + add weight</span>
                        : null}
                  </div>
                  {/* Spec 11 — the last-time line: what happened, what to try.
                      Gold = nudge · faint = hold · never red. */}
                  {!done && prog && prog.state !== 'new' && (prog.line || prog.state === 'nudge' || prog.state === 'hold') && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, minWidth: 0 }}>
                      {prog.line && (
                        <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 8.5, fontWeight: 600, color: '#c4a4d8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{prog.line}</span>
                      )}
                      {prog.state === 'nudge' ? (
                        <span style={{
                          flexShrink: 0, fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 6.5, letterSpacing: '0.06em',
                          color: '#0a0014', borderRadius: 5, padding: '2px 6px',
                          background: isPR ? `linear-gradient(135deg, ${GOLD}, #f59e0b)` : GOLD,
                          boxShadow: isPR ? '0 0 8px rgba(253,224,71,0.45)' : 'none',
                        }}>
                          → TRY {prog.kind === 'weighted' ? prog.suggested : `${prog.suggestedReps} REPS`}{isPR ? ' 🏆 PR' : ''}
                        </span>
                      ) : (
                        <span style={{ flexShrink: 0, fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 6.5, letterSpacing: '0.06em', color: '#9a90b8', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 5, padding: '2px 6px' }}>
                          = HOLD{prog.kind === 'weighted' && prog.lastWeight ? ` ${prog.lastWeight}` : ''}
                        </span>
                      )}
                    </div>
                  )}
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

        {/* START CTA — in flow, an inch below the regenerate/save row (was a
            fixed bottom bar; the floating placement covered list rows and sat
            detached from the content it acts on). */}
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
            width: '100%', marginTop: 96, padding: '15px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
            background: `linear-gradient(135deg, ${GOLD}, #f59e0b)`,
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
          alternates={getAlternates(
            exercises[swapIdx], cfg,
            new Set(exercises.map(e => String(e.name).toLowerCase())),
            `${swapSeed}:${swapIdx}`
          )}
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
        <BottomSheet
          title="SAVE ROUTINE"
          accent={GOLD}
          onClose={() => { setSaveOpen(false); setSaveErr(''); }}
          footer={(
            <button className="wo-cta" onClick={handleSaveRoutine} style={{
              width: '100%', padding: '13px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: `linear-gradient(135deg, ${GOLD}, #f59e0b)`, color: '#0a0014',
              fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 12, letterSpacing: '0.1em',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}>
              <Bookmark size={15}/> SAVE
            </button>
          )}
        >
          <input
            value={routineName}
            onChange={e => setRoutineName(e.target.value)}
            placeholder={buildTitle(cfg)}
            maxLength={40}
            style={{
              width: '100%', boxSizing: 'border-box', padding: '11px 12px', borderRadius: 9,
              background: 'rgba(20,8,38,0.9)', border: '1px solid rgba(168,85,247,0.35)',
              color: '#fff', fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 14,
              outline: 'none',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 7 }}>
            <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 10.5, color: saveErr ? '#f87171' : 'transparent' }}>
              {saveErr || '.'}
            </span>
            <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 8, letterSpacing: '0.1em', color: loadRoutines().length >= MAX_ROUTINES ? '#f87171' : C.faint }}>
              {loadRoutines().length}/{MAX_ROUTINES} SLOTS
            </span>
          </div>
        </BottomSheet>
      )}
    </PhoneFrame>
  );
}

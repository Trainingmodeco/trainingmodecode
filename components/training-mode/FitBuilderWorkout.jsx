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
import BuilderWarmup from './shared/BuilderWarmup';
import ExerciseHistorySheet from './shared/ExerciseHistorySheet';
import ExerciseInfoSheet from './shared/ExerciseInfoSheet';

const GOLD = C.gold;

// The ⇄ and ⛓ in the list legend — the only two symbols you have to go FIND
// on a row, so they carry their own weight against the 8.5px caption text.
const LEGEND_GLYPH = {
  fontSize: 13, lineHeight: 1, color: '#dcc0ff',
  textShadow: '0 0 9px rgba(168,85,247,0.9)',
};

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
@keyframes wo-link-pulse {
  0%,100% { box-shadow: 0 0 0 0 rgba(168,85,247,0.55); }
  50%     { box-shadow: 0 0 0 5px rgba(168,85,247,0); }
}
.wo-linking { animation: wo-link-pulse 1.2s ease-in-out infinite; }
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

function SwapSheet({ exercise, alternates, onSelect, onInfo, onClose }) {
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
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Spec 13 — preview before committing: the name opens the
                    info sheet, which carries USE THIS EXERCISE. */}
                <div
                  onClick={(e) => { e.stopPropagation(); onInfo?.(alt); }}
                  style={{
                    fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 10, color: '#fff', letterSpacing: '0.03em',
                    textDecoration: 'underline dotted rgba(196,164,216,0.45)', textUnderlineOffset: 2, cursor: 'pointer',
                  }}
                >
                  {alt.name} <span style={{ color: C.violet, fontSize: 9 }}>ⓘ</span>
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
  // 90s warm-up gate before a FRESH session only — resuming or re-entering a
  // half-done workout skips it (you already warmed up).
  const [warmupOpen, setWarmupOpen] = useState(false);
  const warmupTargetRef = useRef(0);
  // Spec 12 — tapping a row's LAST line opens that exercise's history sheet.
  const [historyIdx, setHistoryIdx] = useState(null);
  // Spec 13 — "what IS this exercise?". `infoIdx` is a row of the workout;
  // `infoAlt` is a swap-sheet candidate being previewed before committing.
  const [infoIdx, setInfoIdx] = useState(null);
  const [infoAlt, setInfoAlt] = useState(null);
  // List gestures: swipe a row away to delete (with undo), hold + drag to
  // reorder. Same engine as the in-workout map, tuned for this screen —
  // here a horizontal swipe deletes immediately (no hold), because there is
  // no set in progress to protect.
  const [gest, setGest] = useState(null);      // { idx, mode, dx, dy, slot }
  const gestRef = useRef(null);
  const rowRefs = useRef({});
  const listRef = useRef(null);
  const tapBlockedRef = useRef(false);         // a gesture just ran — eat the click
  const [undoInfo, setUndoInfo] = useState(null); // { index, exercise, wasDone, wasSkipped }
  // Exercise chains (supersets & circuits). A row carries `_chain` = chain id;
  // members are kept CONTIGUOUS in the list so a chain is always one bracket.
  // Rounds only apply to circuits (3+ moves); a 2-move superset runs the
  // exercises' own set count.
  const [linkingIdx, setLinkingIdx] = useState(null);   // row whose ⛓ is glowing
  const [chainRounds, setChainRounds] = useState({});   // chainId -> rounds (2–5)
  const chainSeq = useRef(0);
  const lastChainTap = useRef({ idx: -1, at: 0 });
  // Which round of the running chain we're on (a superset's rounds are the
  // exercises' own sets; a circuit's come from the header stepper).
  const [chainRound, setChainRound] = useState(1);

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

  // One swap path for every entry point: the swap sheet, and the EASIER /
  // HARDER chips on the exercise-info sheet.
  //
  // `id` is copied deliberately. It used to be left behind, which meant a
  // swapped row kept the OLD exercise's id — and the weight log, the history
  // sheet and the demo art all key off that id, so a swap would have logged
  // sets and shown demos under the exercise you swapped AWAY from.
  const applySwapAt = (idx, alt) => {
    if (idx === null || idx === undefined || !alt) return;
    setExercises(prev => prev.map((ex, i) => i === idx ? {
      ...ex,
      id: alt.id || ex.id,
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
      difficulty: alt.difficulty || ex.difficulty,
      tempo: alt.tempo || ex.tempo,
      // A different movement carries no memory of the old one's load.
      weight: undefined,
    } : ex));
  };

  const handleSwapSelect = (alt) => {
    applySwapAt(swapIdx, alt);
    setSwapIdx(null);
  };

  // ── List gestures: delete (with undo) + drag to reorder ──────────────────
  // completed/skipped are INDEX-keyed, so any structural change has to move
  // their keys with the rows or a finished exercise would follow the slot
  // instead of the movement.
  const shiftMap = (m, from, delta) => {
    const next = {};
    Object.keys(m).forEach(k => {
      if (!m[k]) return;
      const n = Number(k);
      if (n === from && delta < 0) return;                 // the removed row
      next[n > from ? n + delta : n] = true;
    });
    return next;
  };

  const deleteAt = (idx) => {
    if (exercises.length <= 1) return;   // never leave an empty workout
    const victim = exercises[idx];
    // The undo holds the gap it left and does NOT time out — the offer is
    // only withdrawn when a neighbouring row moves and the slot stops
    // meaning anything (see moveRow).
    setUndoInfo({ index: idx, exercise: victim, wasDone: !!completed[idx], wasSkipped: !!skipped[idx] });
    setExercises(prev => dissolveSingletons(prev.filter((_, i) => i !== idx)));
    setCompleted(m => shiftMap(m, idx, -1));
    setSkipped(m => shiftMap(m, idx, -1));
  };

  const undoDelete = () => {
    if (!undoInfo) return;
    const { index, exercise, wasDone, wasSkipped } = undoInfo;
    setExercises(prev => { const next = [...prev]; next.splice(index, 0, exercise); return next; });
    setCompleted(m => { const n = shiftMap(m, index - 1, +1); if (wasDone) n[index] = true; return n; });
    setSkipped(m => { const n = shiftMap(m, index - 1, +1); if (wasSkipped) n[index] = true; return n; });
    setUndoInfo(null);
  };

  const moveRow = (from, to) => {
    if (from === to || to < 0 || to >= exercises.length) return;
    // A reorder involving the rows either side of the undo slot moves the
    // gap out from under it, so the offer is withdrawn.
    if (undoInfo) {
      const touchesSlot = (p) => p === undoInfo.index - 1 || p === undoInfo.index;
      if (touchesSlot(from) || touchesSlot(to)) setUndoInfo(null);
    }
    setExercises(prev => {
      const next = [...prev];
      const [row] = next.splice(from, 1);
      next.splice(to, 0, row);
      // Dragged out of its bracket? Then it has left the chain.
      const above = next[to - 1]?._chain;
      const below = next[to + 1]?._chain;
      if (row._chain && above !== row._chain && below !== row._chain) next[to] = { ...row, _chain: undefined };
      return dissolveSingletons(next);
    });
    const remap = (m) => {
      const order = exercises.map((_, i) => i);
      const [moved] = order.splice(from, 1);
      order.splice(to, 0, moved);
      const next = {};
      order.forEach((oldI, newI) => { if (m[oldI]) next[newI] = true; });
      return next;
    };
    setCompleted(remap);
    setSkipped(remap);
  };

  // ── Exercise chains ─────────────────────────────────────────────────────
  // One hue per link index, spectrum order. Chains are violet STRUCTURE; the
  // ramp only tints the member chips so a long circuit stays readable.
  const CHAIN_COLORS = ['#8b3dff', '#6366f1', '#3b82f6', '#22d3ee', '#14b8a6', '#22c55e', '#fde047', '#ff8a3a', '#ff5733', '#ef4444'];

  // A chain of one is not a chain — any structural edit dissolves them.
  const dissolveSingletons = (list) => {
    const counts = {};
    list.forEach(e => { if (e._chain) counts[e._chain] = (counts[e._chain] || 0) + 1; });
    return list.map(e => (e._chain && counts[e._chain] < 2 ? { ...e, _chain: undefined } : e));
  };

  // Double-tap the ⛓ to enter linking mode; tap the glowing one to leave.
  const handleChainTap = (i) => {
    if (linkingIdx === i) { setLinkingIdx(null); return; }
    const now = Date.now();
    const prev = lastChainTap.current;
    lastChainTap.current = { idx: i, at: now };
    if (prev.idx === i && now - prev.at < 400) {
      setLinkingIdx(i);
      lastChainTap.current = { idx: -1, at: 0 };
    }
  };

  // While linking, ANY row can be tapped to join — it moves in beside the
  // chain so the bracket is always contiguous.
  const addToChain = (target) => {
    if (linkingIdx === null || target === linkingIdx) return;
    const anchor = exercises[linkingIdx];
    if (!anchor || exercises[target]?._chain === anchor._chain && anchor._chain) return;
    const cid = anchor._chain || `c${++chainSeq.current}`;
    const tagged = exercises.map((e, i) => (i === linkingIdx || i === target) ? { ...e, _chain: cid } : e);
    const others = tagged.map((e, i) => (e._chain === cid && i !== target ? i : -1)).filter(i => i >= 0);
    const lastMember = Math.max(...others);
    const to = target > lastMember ? lastMember + 1 : lastMember;
    const order = tagged.map((_, i) => i);
    const [movedIdx] = order.splice(target, 1);
    order.splice(to, 0, movedIdx);
    setExercises(order.map(o => tagged[o]));
    const remap = (m) => { const out = {}; order.forEach((oldI, newI) => { if (m[oldI]) out[newI] = true; }); return out; };
    setCompleted(remap);
    setSkipped(remap);
    if (others.length + 1 >= 3) setChainRounds(r => ({ ...r, [cid]: r[cid] || 3 }));
    setUndoInfo(null);            // the list moved; the gap no longer means anything
  };

  const breakChain = (cid) => {
    setExercises(prev => prev.map(e => (e._chain === cid ? { ...e, _chain: undefined } : e)));
    setChainRounds(r => { const n = { ...r }; delete n[cid]; return n; });
    setLinkingIdx(null);
  };

  const bumpRounds = (cid, delta) => {
    setChainRounds(r => ({ ...r, [cid]: Math.max(2, Math.min(5, (r[cid] || 3) + delta)) }));
  };

  const clearGesture = () => {
    const g = gestRef.current;
    if (g) clearTimeout(g.holdTimer);
    gestRef.current = null;
    setGest(null);
  };

  // A gesture and a tap share the same pointerdown, so a row's onClick has to
  // stand down once a gesture has actually engaged.
  const tapAllowed = () => !tapBlockedRef.current;

  const rowPointerDown = (e, i) => {
    if (gestRef.current) clearGesture();
    const g = { idx: i, mode: 'pending', x0: e.clientX, y0: e.clientY, pointerId: e.pointerId, dx: 0, dy: 0 };
    // Held still for 250ms with no swipe → this is a reorder drag.
    g.holdTimer = setTimeout(() => {
      if (gestRef.current !== g || g.mode !== 'pending') return;
      g.mode = 'drag';
      g.startTop = rowRefs.current[i]?.getBoundingClientRect().top || 0;
      g.height = (rowRefs.current[i]?.getBoundingClientRect().height || 56) + 4;
      tapBlockedRef.current = true;
      try { navigator.vibrate?.(20); } catch { /* no haptics */ }
      setGest({ idx: i, mode: 'drag', dx: 0, dy: 0, slot: i });
    }, 250);
    gestRef.current = g;
  };

  const rowPointerMove = (e) => {
    const g = gestRef.current;
    if (!g) return;
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    if (g.mode === 'pending') {
      // Horizontal first → swipe to delete. Vertical first → the list is
      // scrolling; let it, and drop the gesture.
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
        clearTimeout(g.holdTimer);
        g.mode = 'swipe'; g.dx = dx;
        tapBlockedRef.current = true;
        setGest({ idx: g.idx, mode: 'swipe', dx, dy: 0 });
      } else if (Math.abs(dy) > 8) {
        clearTimeout(g.holdTimer);
        gestRef.current = null;
      }
      return;
    }
    if (g.mode === 'swipe') { g.dx = dx; setGest(s => (s ? { ...s, dx } : s)); return; }
    if (g.mode === 'drag') {
      const slot = Math.max(0, Math.min(exercises.length - 1, g.idx + Math.round(dy / (g.height || 56))));
      g.dy = dy; g.slot = slot;
      setGest(s => (s ? { ...s, dy, slot } : s));
    }
  };

  const rowPointerUp = () => {
    const g = gestRef.current;
    if (!g) return;
    const { mode, idx } = g;
    // Read the commit values off the REF: the state closure can trail the
    // final pointermove by one event.
    const dx = g.dx || 0;
    const slot = g.slot ?? idx;
    clearGesture();
    if (mode === 'swipe') {
      const width = rowRefs.current[idx]?.offsetWidth || 320;
      if (Math.abs(dx) > width * 0.4) deleteAt(idx);
    } else if (mode === 'drag') {
      moveRow(idx, slot);
    }
    // Release the tap block after the click that ends this gesture.
    setTimeout(() => { tapBlockedRef.current = false; }, 0);
  };

  // Move/up on WINDOW: a dragged row re-renders (it becomes the lifted copy),
  // which would destroy per-row handlers mid-gesture. Learned the hard way on
  // the workout map.
  useEffect(() => {
    const move = (e) => { const g = gestRef.current; if (g && e.pointerId === g.pointerId) rowPointerMove(e); };
    const up = (e) => { const g = gestRef.current; if (g && e.pointerId === g.pointerId) rowPointerUp(); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  });

  // Rows stay pan-y so the list scrolls normally; only an engaged gesture
  // blocks the scroll.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return undefined;
    const h = (e) => { const g = gestRef.current; if (g && g.mode !== 'pending') e.preventDefault(); };
    el.addEventListener('touchmove', h, { passive: false });
    return () => el.removeEventListener('touchmove', h);
  }, []);

  // While dragging, the list renders in the PREVIEW order so the other rows
  // part to show where this one will land.
  const dragging = gest?.mode === 'drag';
  const previewOrder = (() => {
    const order = exercises.map((_, i) => i);
    if (!dragging) return order;
    const [moved] = order.splice(gest.idx, 1);
    order.splice(Math.max(0, Math.min(gest.slot, order.length)), 0, moved);
    return order;
  })();

  // The undo offer holds the deleted exercise's OWN slot in the list, so the
  // gap it left is what you tap to bring it back — not a message parked at
  // the bottom of the screen. UNDO sits far right, where the swap arrow was.
  const undoSlotNode = undoInfo ? (
    <div key="undo-slot" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      padding: '8px 11px', borderRadius: 11, minHeight: 41, boxSizing: 'border-box',
      border: '1px dashed rgba(168,85,247,0.3)', background: 'rgba(8,2,18,0.45)',
    }}>
      <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 10, fontWeight: 600, color: '#9a90b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {undoInfo.exercise.name} removed
      </span>
      <button onClick={undoDelete} style={{
        background: 'none', border: 'none', padding: '2px 2px', cursor: 'pointer', flexShrink: 0,
        fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 9.5, color: GOLD, letterSpacing: '0.12em',
      }}>UNDO</button>
    </div>
  ) : null;
  const withUndo = (pos, node) => (undoInfo && undoInfo.index === pos ? [undoSlotNode, node] : [node]);

  // Chain membership for a display position. Members are kept contiguous, so
  // the "bracket" is a header strip before the first member plus a violet
  // left edge down each member row — rows stay siblings, so every gesture
  // (swipe, drag) keeps working on them individually.
  const chainAt = (pos) => {
    const i = previewOrder[pos];
    const cid = exercises[i]?._chain;
    if (!cid) return null;
    const members = previewOrder.filter(x => exercises[x]?._chain === cid);
    const prevI = pos > 0 ? previewOrder[pos - 1] : null;
    return {
      cid, members, count: members.length,
      linkIndex: members.indexOf(i),
      isFirst: prevI === null || exercises[prevI]?._chain !== cid,
    };
  };

  const chainHeaderNode = (info) => {
    const circuit = info.count >= 3;
    const rounds = chainRounds[info.cid] || 3;
    const first = exercises[info.members[0]];
    const restLabel = first?.rest || `${first?.restSeconds || 60}s`;
    const stepBtn = (label, delta) => (
      <button onClick={(e) => { e.stopPropagation(); bumpRounds(info.cid, delta); }} style={{
        width: 18, height: 18, borderRadius: 5, cursor: 'pointer', flexShrink: 0,
        background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.4)',
        color: '#c9a6ff', font: "900 10px 'Orbitron',sans-serif", lineHeight: 1, padding: 0,
      }}>{label}</button>
    );
    return (
      <div key={`chain-h-${info.cid}`} style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '5px 10px', borderRadius: '9px 9px 0 0',
        borderLeft: `3px solid ${C.violet}`,
        border: '1px solid rgba(168,85,247,0.35)', borderBottom: 'none',
        background: 'rgba(168,85,247,0.12)', marginBottom: -4,
      }}>
        <span style={{ font: "800 7.5px 'Orbitron',sans-serif", color: '#c9a6ff', letterSpacing: '0.12em', whiteSpace: 'nowrap' }}>
          ⛓ {circuit ? `CIRCUIT · ${info.count} MOVES ×` : `SUPERSET · ${info.members.map((_, n) => `A${n + 1}`).join(' ')}`}
        </span>
        {circuit && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            {stepBtn('−', -1)}
            <span style={{ font: "900 8px 'Orbitron',sans-serif", color: '#fff', minWidth: 34, textAlign: 'center' }}>{rounds} RDS</span>
            {stepBtn('＋', +1)}
          </span>
        )}
        <span style={{ flex: 1 }}/>
        <span style={{ font: "600 8px 'Rajdhani',sans-serif", color: '#9a90b8', whiteSpace: 'nowrap' }}>rest {restLabel} at end</span>
        <button onClick={(e) => { e.stopPropagation(); breakChain(info.cid); }} aria-label="Break chain" style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 2, margin: -2,
          color: '#9a90b8', font: "700 11px 'Rajdhani',sans-serif", flexShrink: 0,
        }}>✕</button>
      </div>
    );
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

  // The chain the running exercise belongs to, if any. The player uses this
  // to run the members back-to-back with rest only at the end of a round.
  const activeChain = (() => {
    if (activeIdx === null) return null;
    const cid = exercises[activeIdx]?._chain;
    if (!cid) return null;
    const members = exercises.reduce((a, e, i) => (e._chain === cid ? [...a, i] : a), []);
    if (members.length < 2) return null;
    const circuit = members.length >= 3;
    const rounds = circuit ? (chainRounds[cid] || 3) : (exercises[members[0]]?.sets || 3);
    return { id: cid, members, position: members.indexOf(activeIdx), rounds, round: chainRound, circuit };
  })();

  // Move to the next member with NO rest (the whole point of a chain).
  const chainNext = () => {
    if (!activeChain) return;
    const nextIdx = activeChain.members[activeChain.position + 1];
    if (nextIdx !== undefined) setActiveIdx(nextIdx);
  };

  // A round finished. Either loop back to the first move, or the chain is
  // done — mark every member complete and move past it.
  const chainRoundDone = () => {
    if (!activeChain) return;
    if (activeChain.round < activeChain.rounds) {
      setChainRound(r => r + 1);
      setActiveIdx(activeChain.members[0]);
      return;
    }
    setCompleted(prev => { const n = { ...prev }; activeChain.members.forEach(m => { n[m] = true; }); return n; });
    setSkipped(prev => { const n = { ...prev }; activeChain.members.forEach(m => { delete n[m]; }); return n; });
    setChainRound(1);
    const after = exercises.findIndex((e, i) => i > Math.max(...activeChain.members) && !completed[i]);
    setActiveIdx(after >= 0 ? after : null);
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
          // it shows as SKIPPED in the map until it's redone. A chain bails
          // whole: landing on the next member would be a half-superset.
          const cid = exercises[activeIdx]?._chain;
          const group = cid ? exercises.reduce((a, e, i) => (e._chain === cid ? [...a, i] : a), []) : [activeIdx];
          setSkipped(s => { const n = { ...s }; group.forEach(m => { n[m] = true; }); return n; });
          if (cid) setChainRound(1);
          const after = Math.max(...group) + 1;
          setActiveIdx(after < exercises.length ? after : null);
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
          // Re-entering any member un-skips the whole chain — you're running
          // the bracket again, not one move out of it.
          const cid = exercises[idx]?._chain;
          const group = cid ? exercises.reduce((a, e, i) => (e._chain === cid ? [...a, i] : a), []) : [idx];
          setSkipped(s => { const next = { ...s }; group.forEach(m => delete next[m]); return next; });
          if (cid) setChainRound(1);
          setActiveIdx(idx);
        }}
        // Hold + swipe on a map row. Skipping the CURRENT exercise behaves like
        // the SKIP EXERCISE button (advance); others just flip to SKIPPED.
        // A chain skips whole: mark every member and land past the bracket,
        // never on a member we just skipped.
        onMarkSkipped={(idx) => {
          const cid = exercises[idx]?._chain;
          const group = cid ? exercises.reduce((a, e, i) => (e._chain === cid ? [...a, i] : a), []) : [idx];
          setSkipped(s => { const n = { ...s }; group.forEach(m => { n[m] = true; }); return n; });
          if (group.includes(activeIdx)) {
            const after = Math.max(...group) + 1;
            setChainRound(1);
            setActiveIdx(after < exercises.length ? after : null);
          }
        }}
        onReorder={handleReorder}
        onFinishWorkout={() => setActiveIdx(null)}
        chainCtx={activeChain}
        chainRoundsMap={chainRounds}
        onChainNext={chainNext}
        onChainRound={chainRoundDone}
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
        {/* Three titles, each sitting over what it explains: WORKOUT over the
            gestures, and the two glyphs over their own captions — so a symbol
            you have to FIND on a row is itself the heading you read. */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto auto auto',
          columnGap: 9, rowGap: 4, alignItems: 'center', marginBottom: 7,
          fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 8.5, color: C.faint, lineHeight: 1,
        }}>
          {/* titles */}
          <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 10.5, color: '#fff', letterSpacing: '0.1em', justifySelf: 'start' }}>WORKOUT</span>
          <span style={{ ...LEGEND_GLYPH, justifySelf: 'center' }}>⇄</span>
          <span/>
          <span style={{ ...LEGEND_GLYPH, justifySelf: 'center' }}>⛓</span>

          {/* captions */}
          <span style={{ justifySelf: 'start' }}>hold ↕ move&nbsp;&nbsp;·&nbsp;&nbsp;swipe ↔ remove</span>
          <span style={{ justifySelf: 'center' }}>swap workout</span>
          <span style={{ opacity: 0.5 }}>·</span>
          <span style={{ justifySelf: 'center' }}>superset/circuit link</span>

          {/* second line of the ⛓ caption */}
          <span/><span/><span/>
          <span style={{ justifySelf: 'center' }}>double-tap</span>
        </div>

        {/* Exercise rows — swipe one away to delete, hold + drag to reorder */}
        <div ref={listRef} style={{ display: 'flex', flexDirection: 'column', gap: 4, position: 'relative' }}>
          {previewOrder.flatMap((i, pos) => {
            const ex = exercises[i];
            if (!ex) return [];
            const done = !!completed[i];
            const muscleColor = MUSCLE_COLORS[ex.muscle] || C.faint;
            // Design 39 — weight only shows on weighted lifts.
            const wLog = classifyType(ex) === 'weighted' ? exerciseWeight(ex) : null;
            // Spec 11 — last-time progression verdict for this row.
            const prog = rowProgression(ex, prevRecRef.current);
            const isPR = !!prog?.isPR;
            const swiping = gest?.mode === 'swipe' && gest.idx === i;
            const swipeDx = swiping ? gest.dx : 0;
            const rowW = rowRefs.current[i]?.offsetWidth || 320;
            const willDelete = swiping && Math.abs(swipeDx) > rowW * 0.4;
            const chain = chainAt(pos);
            const linkColor = chain ? CHAIN_COLORS[chain.linkIndex % CHAIN_COLORS.length] : null;
            const linking = linkingIdx !== null;
            const isLinkAnchor = linkingIdx === i;
            const joinable = linking && !isLinkAnchor;

            // The dragged row leaves a dashed slot behind and floats above.
            if (dragging && i === gest.idx) {
              return withUndo(pos,
                <div key={`drop-${i}`} style={{
                  height: 52, borderRadius: 11, boxSizing: 'border-box',
                  border: `2px dashed ${C.violet}`, background: 'rgba(168,85,247,0.06)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 8, fontWeight: 800, color: C.violet, letterSpacing: '0.14em' }}>
                    DROP HERE · SLOT {previewOrder.indexOf(i) + 1}
                  </span>
                </div>
              );
            }

            const rowNode = (
              <div key={`${ex.name}-${i}`} style={{ position: 'relative', borderRadius: 11, overflow: 'hidden' }}>
                {/* Red backing revealed by the swipe */}
                {swiping && (
                  <div style={{
                    position: 'absolute', inset: 0, borderRadius: 11,
                    background: willDelete ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.16)',
                    border: '1px solid rgba(239,68,68,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: swipeDx < 0 ? 'flex-end' : 'flex-start',
                    padding: '0 16px',
                  }}>
                    <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 9, fontWeight: 900, color: '#ff8a8a', letterSpacing: '0.14em' }}>
                      {willDelete ? 'RELEASE TO DELETE' : 'DELETE'}
                    </span>
                  </div>
                )}
                <div
                  ref={(el) => { rowRefs.current[i] = el; }}
                  onPointerDown={(e) => rowPointerDown(e, i)}
                  onClick={() => { if (joinable) addToChain(i); }}
                  className="wo-row" style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 11px',
                  // Chained rows square off into the bracket and carry its
                  // violet left edge; the last member keeps a rounded foot.
                  borderRadius: chain ? (chain.linkIndex === chain.count - 1 ? '0 0 11px 11px' : 0) : 11,
                  position: 'relative', touchAction: 'pan-y', userSelect: 'none', WebkitUserSelect: 'none',
                  transform: swiping ? `translateX(${swipeDx}px)` : 'none',
                  transition: swiping ? 'none' : 'transform 0.18s ease',
                  cursor: joinable ? 'copy' : 'default',
                  background: joinable ? 'rgba(168,85,247,0.14)'
                    : chain ? 'rgba(168,85,247,0.07)'
                    : done ? 'rgba(253,224,71,0.04)' : 'rgba(8,2,18,0.85)',
                  borderLeft: chain ? `3px solid ${C.violet}` : undefined,
                  border: chain ? '1px solid rgba(168,85,247,0.35)'
                    : done ? '1px solid rgba(253,224,71,0.2)' : isPR ? '1px solid rgba(253,224,71,0.4)' : '1px solid rgba(168,85,247,0.22)',
                  ...(chain ? { borderLeft: `3px solid ${C.violet}`, borderTop: 'none' } : null),
                }}>
                {/* Color initial square (PR rows go gold-tinted) */}
                {/* Member chips carry the chain's colour ramp — one hue per
                    link index, so a long circuit stays readable at a glance. */}
                <div style={{
                  width: 24, height: 24, borderRadius: 7, flexShrink: 0,
                  background: done ? GOLD : chain ? `${linkColor}26` : isPR ? 'rgba(253,224,71,0.12)' : `${muscleColor}18`,
                  border: done ? 'none' : chain ? `1.5px solid ${linkColor}` : isPR ? '1.5px solid rgba(253,224,71,0.5)' : `1.5px solid ${muscleColor}50`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {done
                    ? <Check size={13} color="#0a0014" strokeWidth={3}/>
                    : <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: chain ? 8.5 : 10, color: chain ? linkColor : isPR ? GOLD : muscleColor }}>
                        {chain ? `A${chain.linkIndex + 1}` : ex.name[0]}
                      </span>
                  }
                </div>

                {/* Name taps open the swap sheet; the sets/reps/rest line taps
                    open the editor (rows are never checked off by hand) */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Spec 13 — the NAME now opens the info sheet ("what IS
                      this?"); the ⇄ button is the swap. */}
                  <div onClick={() => { if (!done && tapAllowed()) setInfoIdx(i); }} style={{
                    fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 10.5,
                    color: done ? 'rgba(253,224,71,0.7)' : '#fff',
                    letterSpacing: '0.03em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    textDecoration: done ? 'line-through' : 'underline dotted rgba(196,164,216,0.4)',
                    textUnderlineOffset: 2,
                    cursor: done ? 'default' : 'pointer',
                  }}>{ex.name}{!done && <span style={{ color: C.violet, fontSize: 9 }}> ⓘ</span>}{prog?.state === 'new' && !done && (
                    <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 7, color: '#6d5a8f', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 4, padding: '1px 4px', marginLeft: 6, letterSpacing: '0.1em', verticalAlign: 'middle' }}>NEW</span>
                  )}</div>
                  <div onClick={() => { if (!done && tapAllowed()) setEditIdx(i); }} style={{
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
                        /* Spec 12 — the LAST line is the door to this
                           exercise's history sheet (dotted underline + ⟩). */
                        <span
                          onClick={(e) => { e.stopPropagation(); if (tapAllowed()) setHistoryIdx(i); }}
                          style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 8.5, fontWeight: 600, color: '#c4a4d8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer', textDecoration: 'underline dotted rgba(196,164,216,0.5)', textUnderlineOffset: 2 }}
                        >{prog.line} ⟩</span>
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

                {/* Swap (single tap) and chain (double tap) — separate hit
                    targets, kept well apart so neither is a mis-tap. */}
                {!done && (
                  <button onClick={(e) => { e.stopPropagation(); if (tapAllowed() && !linking) setSwapIdx(i); }} style={{
                    width: 24, height: 24, borderRadius: 5, cursor: 'pointer', flexShrink: 0,
                    background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <ArrowRightLeft size={11} color={C.violet}/>
                  </button>
                )}
                {!done && (
                  <button
                    onClick={(e) => { e.stopPropagation(); if (tapAllowed()) handleChainTap(i); }}
                    aria-label="Chain to another exercise"
                    className={isLinkAnchor ? 'wo-linking' : undefined}
                    style={{
                      width: 26, height: 26, borderRadius: 6, cursor: 'pointer', flexShrink: 0, marginLeft: 14,
                      background: isLinkAnchor ? 'rgba(168,85,247,0.28)' : 'rgba(168,85,247,0.08)',
                      border: `1px solid ${isLinkAnchor ? C.violet : 'rgba(168,85,247,0.3)'}`,
                      color: isLinkAnchor ? '#fff' : '#c9a6ff', fontSize: 12, lineHeight: 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                    }}
                  >⛓</button>
                )}
                </div>
              </div>
            );
            // A chain's bracket is its header strip plus the violet left edge
            // on each member row.
            const nodes = [];
            if (undoInfo && undoInfo.index === pos) nodes.push(undoSlotNode);
            if (chain?.isFirst) nodes.push(chainHeaderNode(chain));
            nodes.push(rowNode);
            return nodes;
          })}

          {/* Deleted the last row? Its slot is past the end of the list. */}
          {undoInfo && undoInfo.index >= previewOrder.length && undoSlotNode}

          {/* The lifted copy of the row being dragged */}
          {dragging && exercises[gest.idx] && (
            <div style={{
              position: 'absolute', left: 0, right: 0, top: (gest.idx * 56) + (gest.dy || 0), zIndex: 5,
              pointerEvents: 'none', borderRadius: 11, border: `2px solid ${C.violet}`,
              background: '#241640', boxShadow: '0 14px 34px rgba(0,0,0,0.7)', transform: 'rotate(1deg)',
              padding: '8px 11px', display: 'flex', alignItems: 'center', gap: 8, minHeight: 52, boxSizing: 'border-box',
            }}>
              <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 10, fontWeight: 800, color: C.violet }}>≡</span>
              <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 10.5, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {exercises[gest.idx].name}
              </span>
            </div>
          )}
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
              const target = firstIncomplete >= 0 ? firstIncomplete : 0;
              // Fresh session → 90s warm-up gate first. Anything already done
              // (or a resume) means the athlete is warm — go straight in.
              if (doneCount === 0 && !initialResumeData) {
                warmupTargetRef.current = target;
                setWarmupOpen(true);
              } else {
                setActiveIdx(target);
              }
            }
          }}
          style={{
            width: '100%', marginTop: 34, padding: '15px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
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

      {/* Spec 12 — exercise history sheet (display-only) */}
      {historyIdx !== null && exercises[historyIdx] && (
        <ExerciseHistorySheet exercise={exercises[historyIdx]} onClose={() => setHistoryIdx(null)}/>
      )}

      {/* Spec 13 — exercise info, from a workout row */}
      {infoIdx !== null && exercises[infoIdx] && (
        <ExerciseInfoSheet
          exercise={exercises[infoIdx]}
          onSwapTo={(target) => { applySwapAt(infoIdx, target); setInfoIdx(null); }}
          onClose={() => setInfoIdx(null)}
        />
      )}

      {/* Spec 13 — exercise info previewing a SWAP candidate: this one
          carries the commit action and closes both sheets. */}
      {infoAlt && (
        <ExerciseInfoSheet
          exercise={infoAlt}
          fromSwap
          onUse={(alt) => { handleSwapSelect(alt); setInfoAlt(null); }}
          onSwapTo={(target) => setInfoAlt(target)}
          onClose={() => setInfoAlt(null)}
        />
      )}

      {/* 90s warm-up gate (spec: follow-along counted moves or freestyle) */}
      {warmupOpen && (
        <BuilderWarmup
          muscleGroups={cfg.muscleGroups}
          onDone={() => { setWarmupOpen(false); setActiveIdx(warmupTargetRef.current); }}
          onSkip={() => { setWarmupOpen(false); setActiveIdx(warmupTargetRef.current); }}
        />
      )}

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
          onInfo={(alt) => setInfoAlt(alt)}
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

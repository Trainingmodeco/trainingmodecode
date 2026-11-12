import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import PhoneFrame from './PhoneFrame';
import TrainingHeader from './TrainingHeader';
import Embers from './Embers';
import { Check, RotateCcw, Trophy, Play, ArrowRightLeft, ChevronRight, Bookmark, Link2, Flag } from 'lucide-react';
import { C, NAV_H, fixedColumnBar } from './Styles';
import BottomSheet from './shared/BottomSheet';
import { generateFitModeWorkout } from './fit-mode/fitModeGenerator';
import { FIT_MODE_EXERCISES } from './fit-mode/fitModeExerciseData';
import FitBuilderGuidedPlayer, { nextOpenIdx } from './FitBuilderGuidedPlayer';
import { saveRoutine, loadRoutines, MAX_ROUTINES } from './data/savedRoutines';
import { routineSlotLimit } from './data/entitlements';
import { primeSpeech, setVoiceGender } from './voiceCoach';
import { waitUpTo, START_PRIME_CAP_MS } from './shared/tapGate';
import useWakeLock from './hooks/useWakeLock';
import { recordBuilderWorkout, rowProgression, loadLastBuilderWorkout } from './data/builderProgression';
import WarmupTimer from './shared/WarmupTimer';
import { loadWarmup, saveWarmup, loadWarmupPick, saveWarmupPick } from './shared/WarmupRow';
import { SegRow } from './shared/FitSetupKit';
import OverlayPortal, { OVERLAY_Z } from './shared/OverlayPortal';
import { warmupSuggestionsFor } from './data/warmupSuggestions';
import ExerciseEditSheet from './shared/ExerciseEditSheet';
import ExerciseHistorySheet from './shared/ExerciseHistorySheet';
import ExerciseInfoSheet from './shared/ExerciseInfoSheet';
import { sideSuffix } from './fit-mode/sideRule';
import { equipmentLabel } from './fit-mode/gearNote';
import ScreenGuide from './shared/ScreenGuide';
import { SCREEN_GUIDES } from './shared/screenGuides';
import { HelpButton } from './shared/WorkoutHelpPanel';
import FinishWorkoutConfirm from './shared/FinishWorkoutConfirm';
import { canFinishEarly, finishOnResume } from './data/builderFinish';
import { reportError } from './data/analytics';

const GOLD = C.gold;
const TEAL = '#2dd4bf';   // the warm-up's colour, same as the ring timer

// The warm-up START runs first on a fresh workout. One timed block on the ring
// timer (shared/WarmupTimer), remembered on this phone like the Fight setups.
const WARMUP_OPTIONS = [{ id: 0, label: 'OFF' }, { id: 5, label: '5 MIN' }, { id: 10, label: '10 MIN' }];
const SKIP_UNDO_MS = 4000;   // how long a skip can be taken back
// Where the athlete is in a chain: which chain, which round, and how many sets
// were actually lifted in it so far. Kept WITH its chain id, so leaving a
// chain and coming back (the list's back arrow, then START) picks up the round
// you were on, and a different chain always starts at round 1.
const NO_CHAIN = { cid: null, round: 1, lifted: 0 };

// 58a — every gesture the list understands, in one strip. Four cells, equal
// width, so none of them reads as the important one. This is the ONLY place
// gestures are explained: nothing labels the buttons on the rows themselves.
const GESTURE_LEGEND = [
  ['↕', 'hold · move'],
  ['↔', 'swipe · remove'],
  ['⇄', 'tap · swap'],
  ['⛓', '2×tap · link'],
];

const HEAD = "'Chakra Petch', system-ui, sans-serif";
const BODY = "'Barlow', system-ui, sans-serif";
const CHF = { clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)' };

const workoutCSS = `
.wo-gold { transition: filter .18s ease, box-shadow .18s ease, transform .1s ease; }
.wo-gold:hover:not(:disabled), .wo-gold:focus-visible { filter: brightness(1.12); box-shadow: 0 0 30px rgba(242,190,69,.55) !important; }
.wo-gold:active { transform: scale(.98); }
.wo-ghost { transition: border-color .2s, background .2s, color .2s; }
.wo-ghost:hover, .wo-ghost:focus-visible { background: rgba(157,108,255,.14) !important; border-color: #9D6CFF !important; color: #fff !important; }
.wo-finish { transition: border-color .2s, background .2s; }
.wo-finish:hover, .wo-finish:focus-visible { background: rgba(242,190,69,.1) !important; border-color: #F2BE45 !important; }
.wo-dose { transition: border-color .18s, color .18s; }
.wo-dose:hover, .wo-dose:focus-visible { border-color: #F2BE45 !important; color: #F2BE45 !important; }
.wo-ib { transition: border-color .18s, background .18s; }
.wo-ib:hover, .wo-ib:focus-visible { border-color: #9D6CFF !important; background: rgba(157,108,255,.16) !important; }
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
.fk-seg { transition: color .18s ease, background .18s ease; }
.fk-seg:not([aria-checked="true"]):hover, .fk-seg:not([aria-checked="true"]):focus-visible { color: #fff; background: rgba(45,212,191,.12); }
`;

const MUSCLE_COLORS = {
  Chest: '#ef4444', Back: '#3b82f6', Shoulders: '#f59e0b',
  Biceps: '#22c55e', Triceps: '#8b5cf6', Core: '#ec4899',
  Quads: '#06b6d4', Hamstrings: '#14b8a6', Glutes: '#f97316',
};

// "Chest" in the muscle's colour, for a row's second line.
function muscleLabel(ex, color) {
  const m = String(ex.primaryMuscle || ex.muscle || '');
  return <span style={{ color }}>{m ? m.charAt(0).toUpperCase() + m.slice(1).toLowerCase() : ''}</span>;
}

function buildTitle(cfg) {
  // A concept day names itself ("THE DESTROYER · LEGS").
  if (cfg.conceptTitle) return cfg.conceptTitle;
  const mg = cfg.muscleGroups || [];
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
    <BottomSheet wide title={`SWAP: ${exercise.name.toUpperCase()}`} accent={C.violet} onClose={onClose} maxHeight="70dvh">
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
                  {alt.sets}x{alt.reps}{sideSuffix(alt.name)} &middot; {equipmentLabel(alt)}
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

// The per-exercise sets / reps / rest editor is shared/ExerciseEditSheet now:
// the guided player opens the same sheet from its ADJUST pill.

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

// Chain ids are `c<n>`. A restored or saved list already holds some, so new
// links count on from the highest one instead of minting a duplicate.
function lastChainSeq(list) {
  return list.reduce((n, e) => Math.max(n, Number(/^c(\d+)$/.exec(e._chain || '')?.[1]) || 0), 0);
}

// Where a session starts: fresh, or from the lifecycle snapshot (App.jsx
// stashes whatever onStateChange last reported).
//
// The snapshot carries the EXERCISE LIST itself. It used to carry only the
// statuses, keyed by position, and the list was regenerated on the way back —
// the generator deliberately never deals the same workout twice, so a reload
// mid-session came back with different exercises wearing the old ✓ DONE and
// SKIPPED flags. Statuses are keyed by each row's stable _uid now, so they
// can only ever belong to the row they were earned on.
//
// A snapshot written before this change (no `exercises`, index-keyed flags)
// is carried over by position once, which is what it meant at the time.
function initialWorkout(cfg, resume) {
  const stashed = Array.isArray(resume?.exercises) && resume.exercises.length ? resume.exercises : null;
  const exercises = withUids(stashed || cfg.savedExercises || applyScheme(generateFitModeWorkout(cfg), cfg.setScheme));
  const byUid = (m) => {
    if (!m) return {};
    if (stashed) return { ...m };
    const out = {};
    Object.keys(m).forEach(k => { const row = exercises[Number(k)]; if (m[k] && row) out[row._uid] = true; });
    return out;
  };
  const completed = byUid(resume?.completed);
  // Back into the exercise that was running — unless it had just finished
  // (the completion map was up), which would run it a second time.
  const a = stashed ? resume.activeIdx : null;
  const activeIdx = Number.isInteger(a) && a >= 0 && a < exercises.length && !completed[exercises[a]._uid] ? a : null;
  return {
    exercises,
    completed,
    skipped: byUid(resume?.skipped),
    chainRounds: (stashed && resume.chainRounds) || cfg.chainRounds || {},
    chainPos: stashed && resume.chainPos?.cid ? { ...NO_CHAIN, ...resume.chainPos } : NO_CHAIN,
    activeIdx,
  };
}

export default function FitBuilderWorkout({ cfg, onDone, onBack, onHome, profile, onPaywall, initialPaused, onStateChange, initialResumeData }) {
  useWakeLock(true);
  // A saved routine loads its exact (possibly hand-tuned) exercise list; a
  // resumed session loads the list it was running (see initialWorkout).
  const [init] = useState(() => initialWorkout(cfg, initialResumeData));
  const [exercises, setExercises] = useState(init.exercises);
  // Both maps are keyed by the row's _uid, so a reorder, delete or chain move
  // never has to carry them along.
  const [completed, setCompleted] = useState(init.completed);
  // Exercises passed over with SKIP EXERCISE (or hold + swipe on the map) —
  // shown as skipped (not done) in the player's workout map, cleared if the
  // exercise is later started again or completed.
  const [skipped, setSkipped] = useState(init.skipped);
  const [activeIdx, setActiveIdx] = useState(init.activeIdx);
  // A resumed session lands back in the player paused, as the lifecycle
  // restore promises (App.jsx); only that first exercise, not the next one.
  const resumeUidRef = useRef(initialPaused && init.activeIdx !== null ? init.exercises[init.activeIdx]._uid : null);
  const [swapIdx, setSwapIdx] = useState(null);
  const [helpOpen, setHelpOpen] = useState(false);   // the "?" walkthrough for this list
  // One deal of swap alternates per session — reopening a sheet keeps its
  // order, a fresh workout reshuffles (see seededShuffle above).
  const swapSeed = useRef(Math.random().toString(36).slice(2)).current;
  const [editIdx, setEditIdx] = useState(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [routineName, setRoutineName] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);
  const [saveErr, setSaveErr] = useState('');
  // Ring-timer warm-up before a FRESH session only — resuming, re-entering a
  // half-done workout or coming back to the list after the player skips it
  // (you already warmed up). OFF / 5 / 10, 5 until the athlete picks.
  const [warmupOpen, setWarmupOpen] = useState(false);
  const [starting, setStarting] = useState(false);   // START tapped, speech unlock still in its beat
  const [warmedUp, setWarmedUp] = useState(!!initialResumeData);
  const [warmupMin, setWarmupMin] = useState(() => {
    const v = loadWarmup('fitBuilder', 5);
    return WARMUP_OPTIONS.some(o => o.id === v) ? v : 5;
  });
  const warmupIdeas = useMemo(() => warmupSuggestionsFor(cfg.muscleGroups), [cfg.muscleGroups]);
  const warmupTargetRef = useRef(0);
  // The last skip, for the few seconds it can be taken back.
  const [skipUndo, setSkipUndo] = useState(null); // { uids, name, backTo, round }
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
  const [undoInfo, setUndoInfo] = useState(null); // { index, exercise }
  // Exercise chains (supersets & circuits). A row carries `_chain` = chain id;
  // members are kept CONTIGUOUS in the list so a chain is always one bracket.
  // Rounds only apply to circuits (3+ moves); a 2-move superset runs the
  // exercises' own set count.
  const [linkingIdx, setLinkingIdx] = useState(null);   // row whose ⛓ is glowing
  // A concept day can arrive with its circuits already chained (cfg.chainRounds).
  const [chainRounds, setChainRounds] = useState(init.chainRounds);   // chainId -> rounds (2–5)
  const chainSeq = useRef(lastChainSeq(init.exercises));
  const lastChainTap = useRef({ idx: -1, at: 0 });
  // Which round of the running chain we're on (a superset's rounds are the
  // exercises' own sets; a circuit's come from the header stepper) and what
  // was lifted in it — see NO_CHAIN.
  const [chainPos, setChainPos] = useState(init.chainPos);
  const posIn = (cid) => (chainPos.cid === cid ? chainPos : { ...NO_CHAIN, cid });
  // An UNDONE skip remounts the player on the set it left: { uid, set, lifted, weight }.
  const [resumeAt, setResumeAt] = useState(null);
  // FINISH WORKOUT's confirm, on this list ("Finish with 6 of 8 done?").
  const [finishAsk, setFinishAsk] = useState(false);
  // Raised when the last exercise (or chain) finishes with nothing open or
  // skipped left: the session goes to the summary instead of back to this
  // list. See the effect below. A session that comes back with every row
  // done (the app was killed in the done toast's beat, after the last move)
  // starts raised, so it lands on the summary, not on COMPLETE WORKOUT.
  const [finishDue, setFinishDue] = useState(() => finishOnResume(!!initialResumeData, init.exercises, init.completed));
  const endedRef = useRef(false);

  // The statuses by POSITION, for everything that walks the list (the
  // rows, the player, the progression record).
  const doneAt = useMemo(() => exercises.map(e => !!completed[e._uid]), [exercises, completed]);
  const skippedAt = useMemo(() => exercises.map(e => !!skipped[e._uid]), [exercises, skipped]);
  const doneCount = doneAt.filter(Boolean).length;
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
    setChainPos(NO_CHAIN);
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
      // The slot keeps ITS sets and rest (the scheme the workout was built
      // with); a swapped-in move used to arrive with the library's own
      // 2×8-12 / 75 s next to everyone else's 4×8 / 120 s. Reps only follow
      // the new move when one of the two is a timed hold.
      sets: ex.sets,
      reps: /\d\s*s$/i.test(String(alt.reps)) || /\d\s*s$/i.test(String(ex.reps)) ? alt.reps : ex.reps,
      rest: ex.rest,
      restSeconds: ex.restSeconds,
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
  // completed/skipped are keyed by the row's _uid, so a structural change
  // moves the rows and the statuses simply go with them. A deleted row's
  // status waits under its uid and is back the moment UNDO puts the row back.
  const deleteAt = (idx) => {
    if (exercises.length <= 1) return;   // never leave an empty workout
    const victim = exercises[idx];
    // The undo holds the gap it left and does NOT time out — the offer is
    // only withdrawn when a neighbouring row moves and the slot stops
    // meaning anything (see moveRow).
    setUndoInfo({ index: idx, exercise: victim });
    setExercises(prev => dissolveSingletons(prev.filter((_, i) => i !== idx)));
  };

  const undoDelete = () => {
    if (!undoInfo) return;
    const { index, exercise } = undoInfo;
    setExercises(prev => { const next = [...prev]; next.splice(index, 0, exercise); return next; });
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
  // Re-attached whenever the list comes back on screen: a resumed session
  // mounts straight into the player, and the warm-up or the player replace
  // the list's DOM while they run.
  const listShown = activeIdx === null && !warmupOpen;
  // List ↔ warm-up ↔ player is not a route change, so App's scroll reset
  // never runs, and the route's scroller (ScreenRouter's WithNav) kept the
  // list's scroll: a list scrolled down to reach START opened the warm-up and
  // the player with their tops cut off. Each view starts at the top.
  const view = warmupOpen ? 'warmup' : activeIdx !== null ? 'player' : 'list';
  const topRef = useRef(null);
  useLayoutEffect(() => {
    for (let el = topRef.current?.parentElement; el && el !== document.body; el = el.parentElement) {
      if (el.scrollTop) el.scrollTop = 0;
    }
  }, [view]);
  const topMark = <span ref={topRef} aria-hidden="true" style={{ display: 'block', height: 0 }}/>;
  useEffect(() => {
    const el = listRef.current;
    if (!el || !listShown) return undefined;
    const h = (e) => { const g = gestRef.current; if (g && g.mode !== 'pending') e.preventDefault(); };
    el.addEventListener('touchmove', h, { passive: false });
    return () => el.removeEventListener('touchmove', h);
  }, [listShown]);

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

  // Everything the lifecycle snapshot needs to bring THIS session back: the
  // list itself, its statuses, the chains and where the athlete was.
  useEffect(() => {
    if (typeof onStateChange === 'function') {
      onStateChange({ completed, skipped, exercises, chainRounds, chainPos, activeIdx });
    }
  }, [completed, skipped, exercises, chainRounds, chainPos, activeIdx, onStateChange]);

  // Spec 11 — remember this workout for TRAIN AGAIN. Skips silently until
  // at least one exercise is completed, so an untouched generate never
  // clobbers the last real session's progression history. The record reads
  // its statuses by position (builderProgression.rowProgression).
  useEffect(() => {
    const byIdx = {};
    doneAt.forEach((d, i) => { if (d) byIdx[i] = true; });
    recordBuilderWorkout({ title, cfg, exercises, completed: byIdx });
  }, [doneAt, title, cfg, exercises]);

  // The resume hold is for the exercise the session came back into only.
  useEffect(() => {
    if (resumeUidRef.current && exercises[activeIdx]?._uid !== resumeUidRef.current) resumeUidRef.current = null;
  }, [activeIdx, exercises]);
  // So is an UNDO's set: once the player has moved off it, it is spent.
  useEffect(() => {
    if (resumeAt && exercises[activeIdx]?._uid !== resumeAt.uid) setResumeAt(null);
  }, [activeIdx, exercises, resumeAt]);

  // A skip's UNDO lasts a few seconds, then the row just reads SKIPPED (still
  // a tap away on the map).
  useEffect(() => {
    if (!skipUndo) return undefined;
    const t = setTimeout(() => setSkipUndo(null), SKIP_UNDO_MS);
    return () => clearTimeout(t);
  }, [skipUndo]);

  // Every way out to the summary goes through here: STOP, FINISH WORKOUT,
  // COMPLETE WORKOUT, and the last exercise finishing. onDone banks the XP
  // (App's goFitComplete), so it runs once per session: a double tap, a
  // timer racing a button, or a StrictMode re-run never pays twice.
  // A finish that throws (App's stats write on a full storage, say) leaves
  // the session open, so COMPLETE WORKOUT or FINISH can try again; and it
  // is caught here because the automatic finish runs in an effect, where a
  // throw would take the whole app down to the crash screen. False when the
  // finish failed.
  const endSession = useCallback((done, total) => {
    if (endedRef.current) return true;
    endedRef.current = true;
    try {
      onDone(done, total);
      return true;
    } catch (err) {
      endedRef.current = false;
      reportError(err, 'fit-finish');
      return false;
    }
  }, [onDone]);

  // The workout has nowhere left to go (the player's onFinishWorkout, or the
  // last chain finishing). The player calls from a timer that holds whatever
  // callback it captured renders ago, so it only raises the flag: the count
  // is read here, from a render that already holds the move just finished.
  // Everything done → the summary. Rows left (the completion map closed with
  // the last one skipped), or a finish that failed → this list, where
  // FINISH WORKOUT, COMPLETE WORKOUT or START picks it up.
  useEffect(() => {
    if (!finishDue) return;
    if (allDone && endSession(doneCount, exercises.length)) return;
    setFinishDue(false);
    setActiveIdx(null);
  }, [finishDue, allDone, doneCount, exercises.length, endSession]);

  const enterWorkout = useCallback(() => {
    setWarmupOpen(false);
    setWarmedUp(true);
    setActiveIdx(warmupTargetRef.current);
  }, []);

  // Spec 10 — reorder from the map. `orderOld` is the full list of OLD indices
  // in their NEW order (the player computes the weave so done/skipped rows stay
  // pinned in place). The statuses ride along on the uids; only the active
  // exercise has to be followed to its new position.
  const handleReorder = (orderOld) => {
    if (!Array.isArray(orderOld) || orderOld.length !== exercises.length) return;
    const newIdxOf = {};
    orderOld.forEach((oldI, newI) => { newIdxOf[oldI] = newI; });
    setExercises(prev => orderOld.map(o => prev[o]));
    setActiveIdx(a => (a === null ? null : newIdxOf[a]));
  };

  // A row and, if it is in a chain, the rest of its bracket — a chain is
  // started, skipped and un-skipped as one.
  const groupOf = (idx) => {
    const cid = exercises[idx]?._chain;
    return cid ? exercises.reduce((a, e, i) => (e._chain === cid ? [...a, i] : a), []) : [idx];
  };

  // Where a skip lands: the next OPEN exercise after the skipped one (or its
  // whole bracket), wrapping round — never a finished row, never one already
  // skipped. null when nothing open is left: the workout ends on this list.
  // It used to be blindly index + 1, which re-ran a finished exercise and left
  // the map with no NOW row.
  const skipLanding = (idx) => {
    const group = groupOf(idx);
    return nextOpenIdx(exercises.length, Math.max(...group), i => doneAt[i] || group.includes(i), i => skippedAt[i]);
  };

  // Start (or restart) an exercise. Starting a skipped one clears its skip —
  // only DONE is permanent — and re-entering any chain member un-skips the
  // whole bracket: you're running the chain again, not one move out of it.
  // The round is left alone: it belongs to its chain (chainPos), so coming
  // back into a chain picks up where it was, and any other chain — or one
  // that was skipped or finished — starts at round 1.
  const jumpTo = (idx) => {
    const uids = groupOf(idx).map(i => exercises[i]._uid);
    setSkipped(s => { const next = { ...s }; uids.forEach(u => { delete next[u]; }); return next; });
    setActiveIdx(idx);
  };

  // The one skip path (SKIP EXERCISE, the last SKIP SET with nothing lifted,
  // and hold + swipe on the map). Every skip can be taken back for a few
  // seconds: one tap with no confirm is too easy to do by accident.
  // `advance` = the skipped row is the one running, so the player moves on;
  // `progress` is where it stood (the player's progressNow), for the UNDO.
  const markSkipped = (idx, advance, progress = null) => {
    const group = groupOf(idx);
    const first = exercises[group[0]];
    const cid = exercises[idx]?._chain;
    setSkipUndo({
      uids: group.map(i => exercises[i]._uid),
      name: group.length > 1 ? `${first.name} ${group.length >= 3 ? 'circuit' : 'superset'}` : exercises[idx].name,
      backTo: advance ? exercises[activeIdx]?._uid : null,
      progress,
      chainPos,
    });
    setSkipped(s => { const n = { ...s }; group.forEach(m => { n[exercises[m]._uid] = true; }); return n; });
    // A skipped chain is over: started again, it starts at round 1.
    if (cid && chainPos.cid === cid) setChainPos(NO_CHAIN);
    if (advance) setActiveIdx(skipLanding(idx));
  };

  const undoSkip = () => {
    const u = skipUndo;
    if (!u) return;
    setSkipUndo(null);
    setSkipped(s => { const n = { ...s }; u.uids.forEach(x => { delete n[x]; }); return n; });
    setChainPos(u.chainPos);
    // A skip that moved the player on puts the athlete back where they were:
    // the same exercise, on the same set, with the same weight (resumeAt).
    const back = u.backTo ? exercises.findIndex(e => e._uid === u.backTo) : -1;
    if (back >= 0 && !completed[u.backTo]) {
      setResumeAt(u.progress ? { uid: u.backTo, ...u.progress } : null);
      setActiveIdx(back);
    }
  };

  // Shown over whichever screen is up — the player, its map, or this list
  // when the skip ended the workout. Portalled, so the tab bar can't cover it.
  const skipSnack = skipUndo ? (
    <OverlayPortal>
      <div role="status" style={{
        position: 'fixed', ...fixedColumnBar, bottom: `calc(${NAV_H} + 62px)`, zIndex: OVERLAY_Z + 1,
        display: 'flex', justifyContent: 'center', padding: '0 14px', boxSizing: 'border-box', pointerEvents: 'none',
      }}>
        <div style={{
          pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, maxWidth: '100%',
          padding: '5px 5px 5px 14px', borderRadius: 12, boxSizing: 'border-box',
          background: 'rgba(14,5,26,0.97)', border: '1px solid rgba(168,85,247,0.5)', boxShadow: '0 8px 26px rgba(0,0,0,0.6)',
        }}>
          <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 13, color: '#e7ddf7', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
            Skipped {skipUndo.name} ·
          </span>
          <button type="button" onClick={undoSkip} style={{
            flexShrink: 0, height: 44, padding: '0 16px', borderRadius: 9, cursor: 'pointer',
            background: 'rgba(253,224,71,0.1)', border: `1px solid ${GOLD}88`, color: GOLD,
            fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 10.5, letterSpacing: '0.12em',
          }}>UNDO</button>
        </div>
      </div>
    </OverlayPortal>
  ) : null;

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
    const pos = posIn(cid);
    return { id: cid, members, position: members.indexOf(activeIdx), rounds, round: pos.round, lifted: pos.lifted, circuit };
  })();

  // Move to the next member with NO rest (the whole point of a chain).
  const chainNext = () => {
    if (!activeChain) return;
    const nextIdx = activeChain.members[activeChain.position + 1];
    if (nextIdx !== undefined) setActiveIdx(nextIdx);
  };

  // A round finished. Either loop back to the first move, or the chain is
  // done — mark every member complete and move past it.
  // (The last round with nothing lifted never gets here: the player sends
  // that through the skip path, like a single exercise's last SKIP SET.)
  const chainRoundDone = () => {
    if (!activeChain) return;
    const { id: cid, round, lifted } = activeChain;
    if (round < activeChain.rounds) {
      setChainPos({ cid, round: round + 1, lifted });
      setActiveIdx(activeChain.members[0]);
      return;
    }
    const members = activeChain.members;
    setCompleted(prev => { const n = { ...prev }; members.forEach(m => { n[exercises[m]._uid] = true; }); return n; });
    setSkipped(prev => { const n = { ...prev }; members.forEach(m => { delete n[exercises[m]._uid]; }); return n; });
    setChainPos(NO_CHAIN);
    // On to the next OPEN exercise — not a finished one, and not one the
    // athlete chose to skip.
    const next = nextOpenIdx(exercises.length, Math.max(...members), i => doneAt[i] || members.includes(i), i => skippedAt[i]);
    // The chain was the last of it (nothing open, nothing skipped): straight
    // to the summary, like the last single exercise. Skipped rows left → the
    // list, as before.
    if (next === null && exercises.every((_, i) => doneAt[i] || members.includes(i))) { setFinishDue(true); return; }
    setActiveIdx(next);
  };

  // The warm-up is its own screen, in place of the list — not an overlay on
  // top of it. The old 90s gate was drawn inside the list's PhoneFrame, whose
  // `isolation: isolate` capped its z-index under the app's tab bar, so its
  // SKIP button sat behind HOME / TRAIN / PROGRESS and a tap on it left the
  // workout (see shared/OverlayPortal). WarmupTimer is a full screen with the
  // nav's clearance built in, the same way Fight Mode runs its warm-ups.
  if (warmupOpen) {
    return (
      <>
        {topMark}
        <WarmupTimer
          minutes={warmupMin}
          title="WARM UP · WORKOUT"
          suggestions={warmupIdeas}
          initialPick={loadWarmupPick('fitBuilder')}
          onPick={(id) => saveWarmupPick('fitBuilder', id)}
          skipLabel="SKIP → START WORKOUT"
          intro={`Warm up. ${warmupMin} minutes, at your own pace.`}
          miniPlayer
          onDone={enterWorkout}
          onSkip={enterWorkout}
        />
        {skipSnack}
      </>
    );
  }

  // Voice-guided player (design 34 + spec 10 free-select map). Keyed on the
  // exercise's stable uid, NOT its index: a reorder moves the current exercise
  // to a new index without remounting the player (set progress survives);
  // jumping to a DIFFERENT exercise changes the uid and remounts fresh.
  if (activeIdx !== null) {
    const activeUid = exercises[activeIdx]?._uid;
    return (
      <>
        {topMark}
        <FitBuilderGuidedPlayer
          key={`guided-${activeUid ?? activeIdx}`}
          exercises={exercises}
          exerciseIdx={activeIdx}
          completed={doneAt}
          skipped={skippedAt}
          voiceOn
          initialPaused={!!resumeUidRef.current && activeUid === resumeUidRef.current}
          initialProgress={resumeAt?.uid === activeUid ? resumeAt : null}
          onBack={() => setActiveIdx(null)}
          // STOP's END, and FINISH on the completion map: the summary.
          onStop={() => endSession(doneCount, exercises.length)}
          // Advance to the next OPEN exercise WITHOUT marking this one
          // complete — it shows as SKIPPED in the map until it's redone. A
          // chain bails whole: landing on the next member would be a
          // half-superset.
          onSkipExercise={(progress) => markSkipped(activeIdx, true, progress)}
          // Where that skip will land, so the coach names the real
          // destination before it happens.
          skipTargetOf={skipLanding}
          onRewindExercise={() => {
            // 3b — step back to the previous exercise and clear its completed
            // mark, so redoing it counts once (never leaves a stale ✓).
            if (activeIdx > 0) {
              const prev = activeIdx - 1;
              const uid = exercises[prev]._uid;
              setCompleted(c => { const next = { ...c }; delete next[uid]; return next; });
              setSkipped(sk => { const next = { ...sk }; delete next[uid]; return next; });
              setActiveIdx(prev);
            }
          }}
          // Spec 10 — the exercise finished its last set. Mark it done but do NOT
          // advance: the player owns navigation now (completion map → glow → next).
          onCompleteExercise={() => {
            setCompleted(prev => ({ ...prev, [activeUid]: true }));
            setSkipped(sk => { if (!sk[activeUid]) return sk; const next = { ...sk }; delete next[activeUid]; return next; });
          }}
          // Free select: start ANY non-done exercise (see jumpTo).
          onJumpExercise={jumpTo}
          // Hold + swipe on a map row. Skipping the CURRENT exercise behaves like
          // the SKIP EXERCISE button (advance); others just flip to SKIPPED.
          // A chain skips whole: mark every member and land past the bracket,
          // never on a member we just skipped.
          onMarkSkipped={(idx, progress) => markSkipped(idx, groupOf(idx).includes(activeIdx), progress)}
          onReorder={handleReorder}
          // Nowhere left to go: the summary if it's all done, else the list
          // (see the finishDue effect).
          onFinishWorkout={() => setFinishDue(true)}
          chainCtx={activeChain}
          chainRoundsMap={chainRounds}
          onChainNext={chainNext}
          onChainRound={chainRoundDone}
          // A set actually lifted inside the running chain (see NO_CHAIN).
          onSetLifted={() => {
            const cid = activeChain?.id;
            if (cid) setChainPos(p => (p.cid === cid ? { ...p, lifted: p.lifted + 1 } : { ...NO_CHAIN, cid, lifted: 1 }));
          }}
          // The player's ADJUST pill: sets / reps / rest edited in place, before
          // a set starts. Same sheet as the list rows.
          onEditExercise={(idx, vals) => setExercises(prev => prev.map((ex, i) => (i === idx ? { ...ex, ...vals } : ex)))}
        />
        {skipSnack}
      </>
    );
  }

  // START runs the warm-up first only on a fresh workout with it switched on.
  const warmupFresh = !warmedUp && doneCount === 0;
  const warmupDue = warmupFresh && warmupMin > 0;

  return (
    <PhoneFrame useBrandBg>
      {topMark}
      <style dangerouslySetInnerHTML={{ __html: workoutCSS }}/>
      <Embers count={2}/>

      <TrainingHeader
        title={title}
        subtitle={`${cfg.difficulty} \u00B7 ${cfg.equipment}`}
        showBack
        onBack={onBack || (() => endSession(doneCount, exercises.length))}
        onHome={onHome || (() => endSession(doneCount, exercises.length))}
        rightSlot={<HelpButton onClick={() => setHelpOpen(true)}/>}
      />

      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
        padding: '10px 14px 0',
        // Clears the bottom nav only — the START CTA lives in the flow now.
        paddingBottom: 'calc(100px + env(safe-area-inset-bottom, 0px))',
      }}>

        {/* The session at a glance — the design's tag row: length, difficulty,
            gear, count. The muscle groups are in the title already. */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {[
            cfg.duration ? `${cfg.duration} min` : null,
            cfg.difficulty,
            { label: cfg.equipment, accent: true },
            `${exercises.length} exercises`,
          ].filter(Boolean).map((t, i) => {
            const tag = typeof t === 'string' ? { label: t } : t;
            return (
              <span key={i} style={{
                font: `600 10px ${HEAD}`, letterSpacing: '0.16em', textTransform: 'uppercase', padding: '5px 8px',
                background: tag.accent ? 'rgba(157,108,255,0.2)' : 'rgba(255,255,255,0.07)', color: tag.accent ? '#C4A8FF' : '#fff',
              }}>{tag.label}</span>
            );
          })}
        </div>

        {/* Progress bar — the count that used to label it now rides the
            WORKOUT title row below, so the title and the legend strip stay
            adjacent (58a). */}
        <div style={{ width: '100%', height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', marginBottom: 10 }}>
          <div style={{
            width: `${pct}%`, height: '100%', borderRadius: 2,
            background: `linear-gradient(90deg, ${GOLD}, #f59e0b)`,
            boxShadow: '0 0 6px rgba(253,224,71,0.3)',
            transition: 'width 0.4s ease',
          }}/>
        </div>

        {/* 58a — title row: the list's name on the left, where it stands, and
            the count it used to sit above on the right. */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
          <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 15, color: GOLD, letterSpacing: '0.08em' }}>WORKOUT</span>
          <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 9, color: C.faint, whiteSpace: 'nowrap' }}>
            {doneCount}/{exercises.length} exercises · <span style={{ color: GOLD, fontWeight: 700 }}>{pct}%</span>
          </span>
        </div>

        {/* 58a — one legend strip, and the only place gestures are explained.
            Four equal cells so no gesture reads as the important one, and it
            is deliberately inert: the row underneath is what you touch. */}
        <div data-guide="fw-legend" style={{
          display: 'flex', alignItems: 'center', minHeight: 24, boxSizing: 'border-box',
          padding: '6px 8px', marginBottom: 11, borderRadius: 9,
          background: 'rgba(16,4,30,0.7)', border: '1px solid rgba(168,85,247,0.25)',
        }}>
          {GESTURE_LEGEND.map(([glyph, text], n) => (
            <span key={glyph} style={{
              flex: 1, minWidth: 0, textAlign: 'center', whiteSpace: 'nowrap',
              fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 9, color: '#c4a4d8', lineHeight: 1,
              borderLeft: n ? '1px solid rgba(168,85,247,0.25)' : 'none',
            }}>
              <span style={{ color: '#c9a6ff', fontSize: 10 }}>{glyph}</span> {text}
            </span>
          ))}
        </div>

        {/* Exercise rows — swipe one away to delete, hold + drag to reorder */}
        <div ref={listRef} style={{ display: 'flex', flexDirection: 'column', gap: 4, position: 'relative' }}>
          {previewOrder.flatMap((i, pos) => {
            const ex = exercises[i];
            if (!ex) return [];
            const done = doneAt[i];
            const muscleColor = MUSCLE_COLORS[ex.muscle] || C.faint;
            // Spec 11 — last-time progression verdict for this row.
            const prog = rowProgression(ex, prevRecRef.current);
            // The dose, the way the design prints it: "4 × 8" or "3 × 40s".
            const dose = `${ex.sets} × ${ex.reps}${sideSuffix(ex.name)}`;
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
                  // The "?" walkthrough spotlights the FIRST row when it talks
                  // about what you can do to an exercise.
                  data-guide={pos === 0 ? 'fw-row' : undefined}
                  className="wo-row" style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 9px',
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
                {/* Position number (the design's "01"). Chain members carry
                    the chain's colour ramp — one hue per link index — and a
                    finished row shows the check. */}
                <div style={{
                  width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                  background: done ? GOLD : chain ? `${linkColor}26` : 'transparent',
                  border: done ? 'none' : chain ? `1.5px solid ${linkColor}` : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {done
                    ? <Check size={13} color="#0a0014" strokeWidth={3}/>
                    : <span style={{ font: `700 ${chain ? 9 : 12}px ${HEAD}`, color: chain ? linkColor : isPR ? GOLD : '#9D6CFF' }}>
                        {chain ? `A${chain.linkIndex + 1}` : String(pos + 1).padStart(2, '0')}
                      </span>
                  }
                </div>

                {/* Name (tap: what IS this?) over the last-time line. The
                    sets · reps · rest · weight line the rows used to print
                    is the dose pill on the right now — one number, tappable
                    to change, and the player can change it too. */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div onClick={() => { if (!done && tapAllowed()) setInfoIdx(i); }} style={{
                    font: `600 14px ${BODY}`, color: done ? 'rgba(253,224,71,0.7)' : '#fff',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    textDecoration: done ? 'line-through' : 'none', cursor: done ? 'default' : 'pointer',
                  }}>{ex.name}{!done && <span style={{ color: C.violet, fontSize: 12 }}> ⓘ</span>}{prog?.state === 'new' && !done && (
                    <span style={{ font: `700 8px ${HEAD}`, color: '#8E88A8', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 4, padding: '1px 5px', marginLeft: 6, letterSpacing: '0.1em', verticalAlign: 'middle' }}>NEW</span>
                  )}</div>
                  {/* Spec 11 — the last-time line: what happened, what to try.
                      Gold = nudge · faint = hold · never red. */}
                  {!done && prog && prog.state !== 'new' && (prog.line || prog.state === 'nudge' || prog.state === 'hold') ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, minWidth: 0 }}>
                      {prog.line && (
                        /* Spec 12 — the LAST line is the door to this
                           exercise's history sheet (dotted underline + ⟩). */
                        <span
                          onClick={(e) => { e.stopPropagation(); if (tapAllowed()) setHistoryIdx(i); }}
                          style={{ font: `500 11.5px ${BODY}`, color: '#8E88A8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer', textDecoration: 'underline dotted rgba(196,164,216,0.5)', textUnderlineOffset: 2 }}
                        >Last · {prog.line} ⟩</span>
                      )}
                      {prog.state === 'nudge' ? (
                        <span style={{
                          flexShrink: 0, font: `700 8px ${HEAD}`, letterSpacing: '0.06em',
                          color: '#0a0014', borderRadius: 5, padding: '2px 6px',
                          background: isPR ? `linear-gradient(135deg, ${GOLD}, #f59e0b)` : GOLD,
                          boxShadow: isPR ? '0 0 8px rgba(253,224,71,0.45)' : 'none',
                        }}>
                          TRY {prog.kind === 'weighted' ? prog.suggested : `${prog.suggestedReps} REPS`}{isPR ? ' 🏆 PR' : ''}
                        </span>
                      ) : (
                        <span style={{ flexShrink: 0, font: `700 8px ${HEAD}`, letterSpacing: '0.06em', color: '#9a90b8', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 5, padding: '2px 6px' }}>
                          HOLD{prog.kind === 'weighted' && prog.lastWeight ? ` ${prog.lastWeight}` : ''}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div style={{ font: `500 11.5px ${BODY}`, color: '#8E88A8', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {done ? 'Done' : <>{muscleLabel(ex, muscleColor)} · {String(ex.equipment || '').toLowerCase()}</>}
                    </div>
                  )}
                </div>

                {/* The dose. Tap to change sets / reps / rest for this row. */}
                <button
                  onClick={(e) => { e.stopPropagation(); if (!done && tapAllowed()) setEditIdx(i); }}
                  aria-label={`${ex.name}: ${dose}, tap to change sets, reps and rest`}
                  className="wo-dose"
                  disabled={done}
                  style={{
                    flexShrink: 0, height: 28, padding: '0 6px', borderRadius: 7, cursor: done ? 'default' : 'pointer',
                    background: 'transparent', border: `1px solid ${done ? 'transparent' : 'rgba(255,255,255,0.14)'}`,
                    font: `700 12px ${HEAD}`, color: done ? C.faint : '#fff', whiteSpace: 'nowrap',
                  }}
                >{dose}</button>

                {/* Swap (single tap) and chain (double tap). What they do is
                    the legend strip's job (58a); the labels are for readers. */}
                {!done && (
                  <button onClick={(e) => { e.stopPropagation(); if (tapAllowed() && !linking) setSwapIdx(i); }} aria-label="Swap exercise" className="wo-ib" style={{
                    width: 28, height: 28, borderRadius: 7, cursor: 'pointer', flexShrink: 0,
                    background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                  }}>
                    <ArrowRightLeft size={13} color={C.violet}/>
                  </button>
                )}
                {!done && (
                  <button
                    onClick={(e) => { e.stopPropagation(); if (tapAllowed()) handleChainTap(i); }}
                    aria-label="Chain to another exercise"
                    className={`wo-ib${isLinkAnchor ? ' wo-linking' : ''}`}
                    style={{
                      width: 28, height: 28, borderRadius: 7, cursor: 'pointer', flexShrink: 0, marginLeft: 2,
                      background: isLinkAnchor ? 'rgba(168,85,247,0.28)' : 'rgba(168,85,247,0.08)',
                      border: `1px solid ${isLinkAnchor ? C.violet : 'rgba(168,85,247,0.3)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                    }}
                  ><Link2 size={13} color={isLinkAnchor ? '#fff' : '#c9a6ff'}/></button>
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

        {/* WARM-UP · OFF / 5 MIN / 10 MIN — what START runs first. One row
            on this screen covers every way in (builder, programs, saved
            routines, concept days, TRAIN AGAIN): they all land here. Gone once
            the athlete is warm. */}
        {warmupFresh && !allDone && (
          <div style={{ marginTop: 16 }}>
            <SegRow
              guide="fw-warmup"
              label="Warm-up"
              right={<span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 11, color: '#7fe3d4' }}>ring timer · skip anytime · no XP</span>}
              options={WARMUP_OPTIONS}
              value={warmupMin}
              onPick={(v) => { saveWarmup('fitBuilder', v); setWarmupMin(v); }}
              accent={TEAL}
              height={44}
              gap={6}
            />
          </div>
        )}

        {/* START, then the two quiet actions under it — the design's order. */}
        <button
          className="wo-gold"
          onClick={async () => {
            if (allDone) {
              endSession(doneCount, exercises.length);
            } else {
              // Prime speech on the user gesture so the guided coach can talk.
              setVoiceGender(profile?.voiceCoach || 'FEMALE');
              // Pressed at once; the speech unlock gets a beat, not the whole
              // wait (see shared/tapGate).
              if (starting) return;
              setStarting(true);
              await waitUpTo(primeSpeech(), START_PRIME_CAP_MS);
              setStarting(false);
              // The first open exercise; if only skipped ones are left, the
              // first of those (starting it clears its skip).
              const n = exercises.length;
              const target = nextOpenIdx(n, n - 1, i => doneAt[i], i => skippedAt[i], true) ?? 0;
              // Fresh session → the warm-up first, if it's on. Anything
              // already done (or a resume) means the athlete is warm — go
              // straight in.
              if (warmupDue) {
                warmupTargetRef.current = target;
                setWarmupOpen(true);
              } else {
                setWarmedUp(true);
                jumpTo(target);
              }
            }
          }}
          data-guide="fw-start"
          style={{
            ...CHF, width: '100%', marginTop: warmupFresh && !allDone ? 12 : 16, height: 54, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(180deg,#FFE9A8 0%,#F2BE45 50%,#C98A1C 100%)', color: '#1A1204',
            font: `700 20px ${HEAD}`, letterSpacing: '0.2em',
            boxShadow: `0 0 28px rgba(242,190,69,${allDone ? '0.55' : '0.35'})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}
        >
          {allDone ? <Trophy size={18}/> : <Play size={18} fill="currentColor" strokeWidth={0}/>}
          {allDone ? 'COMPLETE WORKOUT' : starting ? 'STARTING…' : 'START'}
          {!allDone && warmupDue && (
            <span style={{ font: `600 11px ${HEAD}`, letterSpacing: '0.12em', opacity: 0.7, marginLeft: -2 }}>· {warmupMin} MIN WARM-UP</span>
          )}
        </button>

        {/* Done with some of it: end here, to the summary, with what's done.
            Outlined, so START stays the main action; asks first. With
            everything done START is COMPLETE WORKOUT and this goes. */}
        {canFinishEarly(doneCount, exercises.length) && (
          <button
            type="button"
            className="wo-finish"
            onClick={() => setFinishAsk(true)}
            style={{
              ...CHF, width: '100%', marginTop: 10, height: 44, cursor: 'pointer',
              background: '#110E1C', border: '1px solid rgba(242,190,69,0.45)', color: GOLD,
              font: `600 13px ${HEAD}`, letterSpacing: '0.14em',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <Flag size={15}/> FINISH WORKOUT
          </button>
        )}

        <div data-guide="fw-actions" style={{ display: 'grid', gridTemplateColumns: cfg.conceptId ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 10, marginTop: 10 }}>
          {/* A concept day is a set program — no regenerating it into something else. */}
          {!cfg.conceptId && <button onClick={regenerate} className="wo-ghost" style={{
            ...CHF, height: 44, cursor: 'pointer', background: '#110E1C', border: '1px solid rgba(255,255,255,0.12)', color: '#fff',
            font: `600 13px ${HEAD}`, letterSpacing: '0.12em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <RotateCcw size={16} color={GOLD}/> REGENERATE
          </button>}
          <button onClick={() => setSaveOpen(true)} className="wo-ghost" style={{
            ...CHF, height: 44, cursor: 'pointer', background: '#110E1C', color: savedFlash ? '#4ade80' : '#fff',
            border: `1px solid ${savedFlash ? 'rgba(34,197,94,0.6)' : 'rgba(255,255,255,0.12)'}`,
            font: `600 13px ${HEAD}`, letterSpacing: '0.12em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <Bookmark size={16} color={savedFlash ? '#4ade80' : '#C4A8FF'}/> {savedFlash ? 'SAVED ✓' : 'SAVE ROUTINE'}
          </button>
        </div>
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

      {/* The "?" walkthrough — the gestures on this list are discoverable but
          not obvious, so they get a proper spotlight tour of their own. */}
      {/* The WARM-UP step only while its row is on screen: an unanchored card
          describing a control that isn't there, which then moves on by
          itself, is worse than no step. */}
      {helpOpen && (
        <ScreenGuide
          steps={SCREEN_GUIDES.fit_workout.filter(st => st.target !== 'fw-warmup' || (warmupFresh && !allDone))}
          onClose={() => setHelpOpen(false)}
        />
      )}

      {/* A skip that ended the workout lands here — still undoable. */}
      {skipSnack}

      {/* FINISH WORKOUT → "Finish with 6 of 8 done?" → the summary. */}
      {finishAsk && (
        <FinishWorkoutConfirm
          done={doneCount}
          total={exercises.length}
          onCancel={() => setFinishAsk(false)}
          onFinish={() => { setFinishAsk(false); endSession(doneCount, exercises.length); }}
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
        <ExerciseEditSheet
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

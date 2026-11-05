import { useState, useMemo, useRef, useEffect, Fragment } from 'react';
import PhoneFrame from './PhoneFrame';
import SafeImage from './SafeImage';
import Embers from './Embers';
import ModeTabs from './shared/ModeTabs';
import ScreenGuide from './shared/ScreenGuide';
import { SCREEN_GUIDES } from './shared/screenGuides';
import MoveSwapSheet, { MoveRow } from './shared/MoveSwapSheet';
import MissionLibrarySheet, { CountPill } from './MissionLibrarySheet';
import QuickMissionAdjustSheet from './QuickMissionAdjustSheet';
import { Folder, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  QM_FOCI, QM_INTENSITY, QM_TYPES, QM_LEVEL_WORD, QM_TIME_MIN, QM_TIME_MAX, QM_TIME_STEP, QM_TIME_TICKS,
  quickMissionConfig, loadQuickMissionKeys, saveQuickMissionKeys,
} from './data/quickMissionConfig';
import { generateQuickMission, estimateQuickMissionSeconds, quickMissionDose, seededRng, quickMissionSeed } from './fit-mode/quickMissionGenerator';
import { loadStats } from './data/userStats';
import { athleteTier, rollSurpriseTier } from './data/athleteLevel';
import AddCardioSheet from './AddCardioSheet';
import { namedWorkoutById, buildNamedMission } from './data/namedWorkouts';
import { isPro } from './data/entitlements';
import { summarizeCardioAddon } from './data/cardioAddon';
import { qmV2Enabled } from './data/qmV2';
import {
  RUN_MODES, GUIDED_HELP, SOLO_HELP, SOLO_ONLY_HELP, CLASSIC_HELP,
  missionDefById, levelsOf, gearProfile, buildLoadoutMission, missionCardModel,
  classicMeta, shelfEntries, loadShelfPrefs, saveShelfPrefs,
} from './data/loadoutMissions';
import {
  fitKitCSS, SetupHeader, SetupPage, GoldButton, Tag, Label,
  HEAD, BODY, MUTED, VIOLET, VIOLET_TEXT, GOLD, CARD, CARD_BORDER, chf,
} from './shared/FitSetupKit';

// Quick Mission: a quick workout without having to think too much (Build
// Workout is for the specifics). Top to bottom, the page is:
//
//   TODAY'S QUICK MISSION  the card START runs: its name, its tags, the first
//                          three moves, ▾ SEE ALL, START and a small SURPRISE
//   GEAR                   bodyweight / weighted / hybrid
//   TIME                   a slider, 5 to 60 minutes in 1-minute steps
//   MISSION LIBRARY        one row that opens the library sheet
//
// ▾ SEE ALL opens the card where it is: every move (with a swap on a library
// mission's), how long it really takes, an ADJUST row and ▴ SHOW LESS. The
// page scrolls just enough to bring the open card into view, and the card
// stays open or closed for the next visit. ADJUST is a sheet
// (QuickMissionAdjustSheet) with LEVEL, FOCUS, GUIDED or AT YOUR PACE, ADD
// CARDIO and a library mission's notes (loadout, score, scale and the coach's
// note), so its open card stays the moves and one line. GEAR, TIME and FOCUS
// are remembered per viewer (tm_qm_keys_v1). LEVEL is not: the page opens on
// the athlete's own level (data/athleteLevel, from their Fit progress) so it
// keeps tracking them, ADJUST can scale it to EASY, MEDIUM, HARD or ADVANCED
// (the athlete's own is marked YOUR LEVEL) and a pick lasts for the visit.
// SURPRISE re-rolls the level (one step either side of the athlete's own), the
// focus and the moves with the same GEAR and TIME, and saves nothing. What the
// card shows is exactly what runs: the previewed mission travels with the
// config.
//
// TIME is for short notice: 5 to 60 minutes and the workout is built for
// exactly that (fit-mode/quickMissionGenerator fits the real guided run to the
// minute). The card follows the knob live; only the end of the gesture saves.
//
// The MISSION LIBRARY sheet (MissionLibrarySheet) holds the launch missions
// and the classics. PUT ON CARD brings one here, onto the same card: the
// first moves, ▾ SEE ALL, ADJUST (its level, GUIDED or AT YOUR PACE, cardio) and a
// small ‹ TODAY back to today's mission; touching GEAR or TIME goes back too.
// Everything on a library card comes from data/loadoutMissions; this screen
// only holds the choices. With the v2 gate off (data/qmV2) the library holds
// only the classics.
//
// GUIDED | AT YOUR PACE sits right above START, always on the page: GUIDED is
// the coach (the runner that counts every move), AT YOUR PACE is the moves and
// one timer (QuickMissionSolo; stored and routed as 'solo'). The choice is
// remembered (the shelf prefs' mode) and works for today's mission and for
// library missions; a mission only offered at your pace shows it selected with
// GUIDED dimmed, and a classic (built around the coach's calls) stays GUIDED
// with AT YOUR PACE dimmed and the reason under it.
const cap = (s) => s.charAt(0) + s.slice(1).toLowerCase();
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const focusLabel = (f) => (f === 'FULL BODY' ? 'Full Body' : cap(f));
const GENERATED = { kind: 'generated' };
// The owner's words: MEDIUM for the stored 'NORMAL', on ADJUST and on every
// card's tags.
const LEVEL_WORD = QM_LEVEL_WORD;
const levelTag = (t) => LEVEL_WORD[t] || t;
const GEAR_TAG = { Weighted: 'WEIGHTED', Hybrid: 'HYBRID' };
const CARD_MOVES = 3; // the closed card's moves; ▾ SEE ALL shows the rest
const THUMB = 28;     // the TIME slider's knob, px
const notes = (a) => /^[+×]\s/.test(a); // a classic's "+ 3 more" / "× 2 rounds" lines are notes, not moves
// A library card's one summary line, in the generated card's sentence case:
// "300 REPS · 5 ROUNDS FOR TIME · CAP 30:00" reads "300 reps · 5 rounds for
// time · cap 30:00". The clock words stay capitals.
const CAPS = new Set(['AMRAP', 'EMOM', 'DB']);
const PROPER = { HINDU: 'Hindu' };
function sentence(line) {
  const s = String(line || '').split(' ').map(w => (CAPS.has(w) ? w : PROPER[w] || w.toLowerCase())).join(' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// The card stays open or closed for the next visit, per viewer.
const OPEN_KEY = 'tm_qm_card_open_v1';
function loadCardOpen() { try { return localStorage.getItem(OPEN_KEY) === '1'; } catch { return false; } }
function saveCardOpen(open) { try { localStorage.setItem(OPEN_KEY, open ? '1' : '0'); } catch { /* storage full or blocked */ } }
const reducedMotion = () => { try { return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

// The page's own CSS: the TIME slider (a native range input, so it is a real
// slider to a screen reader and the arrow keys; 44px tall for the thumb) and
// the card's ▾ toggle. The slider's rules name input[type=range] so they
// outrank the app-wide range style in Styles.js.
const QM_CSS = `
.qm-dice { display: flex; align-items: flex-end; justify-content: center; height: 22px; }
.qm-die { display: inline-block; font-size: 18px; line-height: 1; }
.qm-die.a { transform: rotate(-14deg); }
.qm-die.b { transform: rotate(16deg); margin-left: -3px; }
@keyframes qm-roll-a { 0% { transform: rotate(-14deg); } 45% { transform: translate(-3px, -7px) rotate(-200deg); } 100% { transform: rotate(346deg); } }
@keyframes qm-roll-b { 0% { transform: rotate(16deg); } 50% { transform: translate(3px, -9px) rotate(220deg); } 100% { transform: rotate(-344deg); } }
.qm-rolling .qm-die.a { animation: qm-roll-a .55s cubic-bezier(.3,.7,.4,1); }
.qm-rolling .qm-die.b { animation: qm-roll-b .62s cubic-bezier(.3,.7,.4,1); }
@media (prefers-reduced-motion: reduce) { .qm-rolling .qm-die { animation: none; } }
input[type=range].qm-range { -webkit-appearance: none; appearance: none; display: block; width: 100%; height: 44px; margin: 0; padding: 0; background: transparent; pointer-events: none; }
input[type=range].qm-range::-webkit-slider-runnable-track { height: 8px; border-radius: 4px; background: linear-gradient(90deg, ${VIOLET}, ${GOLD}) 0 0 / calc(${THUMB / 2}px + var(--p) * (100% - ${THUMB}px)) 100% no-repeat, #1D1636; }
input[type=range].qm-range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: ${THUMB}px; height: ${THUMB}px; margin-top: -10px; border-radius: 50%; background: ${GOLD}; border: 3px solid #1A1204; box-shadow: 0 0 14px rgba(242,190,69,.7); }
input[type=range].qm-range::-moz-range-track { height: 8px; border-radius: 4px; background: #1D1636; }
input[type=range].qm-range::-moz-range-progress { height: 8px; border-radius: 4px; background: linear-gradient(90deg, ${VIOLET}, ${GOLD}); }
input[type=range].qm-range::-moz-range-thumb { width: ${THUMB - 6}px; height: ${THUMB - 6}px; border-radius: 50%; background: ${GOLD}; border: 3px solid #1A1204; box-shadow: 0 0 14px rgba(242,190,69,.7); }
input[type=range].qm-range:focus-visible { outline: none; }
input[type=range].qm-range:focus-visible::-webkit-slider-thumb { box-shadow: 0 0 0 3px #fff, 0 0 18px rgba(242,190,69,.9); }
input[type=range].qm-range:focus-visible::-moz-range-thumb { box-shadow: 0 0 0 3px #fff, 0 0 18px rgba(242,190,69,.9); }
.qm-toggle { transition: color .18s ease; }
/* A closed card with exactly three moves reads SEE MORE, until the short phone
   hides its third move: then the same button says SEE ALL 3 MOVES. */
.qm-see-all { display: none; }
.qm-toggle:hover, .qm-toggle:focus-visible { color: #fff !important; }
/* The GUIDED | AT YOUR PACE switch and its line sit in the card, so on a
   phone under about 860px tall (412 x 811, 390 x 844) the whole first page
   packs a little tighter to stay above the tab bar. */
@media (max-height: 860px) {
  .qm-stack { gap: 8px !important; padding-top: 12px !important; }
  .qm-stack > .qm-mt { margin-top: 0 !important; }
  .qm-card-in { padding: 10px 14px 10px !important; gap: 6px !important; }
  .qm-card-in > .qm-toggle { margin: -2px 0 -4px !important; }
  .qm-time-band { padding-top: 14px !important; }
}
/* A short phone (360 x 740) keeps the whole first page above the tab bar AND
   above the floating BETA chip (it sits 37px over the bar, at the left edge, so
   the library row has to end above it): the card, GEAR, TIME and the library row
   pack tighter, the closed card shows its first two moves (SEE ALL still counts
   every move) and START is 44px. */
@media (max-height: 760px) {
  .qm-stack { gap: 6px !important; padding-top: 10px !important; }
  .qm-stack > .qm-mt { margin-top: 0 !important; }
  .qm-stack > div.qm-mt { gap: 6px !important; }
  .qm-card-in { padding: 8px 14px 10px !important; gap: 3px !important; }
  .qm-card-in h1 { font-size: 21px !important; }
  .qm-card-in > .qm-toggle { margin: -2px 0 -6px !important; }
  .qm-moves-closed > li:nth-child(n+3) { display: none !important; }
  .qm-see-more { display: none; }
  .qm-see-all { display: inline; }
  .qm-how { gap: 4px !important; }
  .qm-how > div:last-child { line-height: 1.25 !important; }
  .qm-start button, .qm-surprise { height: 44px !important; }
  .qm-time-band { padding-top: 14px !important; }
  .qm-lib { min-height: 48px !important; padding: 4px 12px !important; }
}
`;

// LOADOUT · value rows: the classic card's one LOADOUT line.
function HeaderLines({ lines }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(64px, auto) 1fr', gap: '2px 10px', alignItems: 'baseline' }}>
      {lines.filter(([, v]) => v).map(([k, v]) => (
        <Fragment key={k}>
          <span style={{ font: `600 10px ${HEAD}`, letterSpacing: '0.16em', color: MUTED }}>{k}</span>
          <span style={{ font: `600 12px ${HEAD}`, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#fff' }}>{v}</span>
        </Fragment>
      ))}
    </div>
  );
}

// One quiet move row: number, name, dose. (A library mission's open card
// uses MoveRow instead, for its swap; its closed card numbers in MoveRow's
// gold, so opening it does not change the colour.)
function PlainMove({ index, name, dose, finisher, gold }) {
  return (
    <li style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 22, font: `500 14px ${BODY}`, color: finisher ? GOLD : '#fff' }}>
      <span style={{ width: 18, flexShrink: 0, font: `700 11px ${HEAD}`, color: finisher || gold ? GOLD : VIOLET }}>{finisher ? '❤' : String(index + 1).padStart(2, '0')}</span>
      <span style={{ flex: 1, minWidth: 0, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
      {dose && <span style={{ flexShrink: 0, font: `600 12px ${HEAD}`, color: finisher ? GOLD : '#CFC9E4', whiteSpace: 'nowrap' }}>{dose}</span>}
    </li>
  );
}

// GEAR: the kit's chamfered radio strip (SegRow's look, 44px). value null
// lights none (a library mission is on the card).
function GearRow({ value, onPick }) {
  return (
    <div role="radiogroup" aria-label="Gear" style={{ ...chf, display: 'flex', padding: 3, gap: 3, background: CARD, border: `1px solid ${CARD_BORDER}` }}>
      {QM_TYPES.map(t => {
        const on = t === value;
        return (
          <button key={t} type="button" role="radio" aria-checked={on ? 'true' : 'false'} className="fk-seg" onClick={() => onPick(t)} style={{
            flex: '1 1 0', minWidth: 0, height: 44, border: 'none', cursor: 'pointer', padding: '0 3px', whiteSpace: 'nowrap',
            font: `600 12px ${HEAD}`, letterSpacing: '0.1em',
            color: on ? '#fff' : MUTED, background: on ? 'rgba(157,108,255,0.24)' : 'transparent',
            boxShadow: on ? `inset 0 0 0 1px ${VIOLET}` : 'none',
          }}>{t.toUpperCase()}</button>
        );
      })}
    </div>
  );
}

// GUIDED | AT YOUR PACE: how START runs the mission on the card. Two 44px
// segments in the kit's chamfered strip, the chosen one in gold. `guidedOff`
// dims GUIDED (a mission only offered at your pace), `soloOff` dims AT YOUR
// PACE (a classic); a dimmed segment does nothing and the line under the strip
// says why.
function RunModeSwitch({ value, guidedOff, soloOff, onPick }) {
  return (
    <div role="radiogroup" aria-label="Run mode" aria-describedby="qm-how-help" style={{ ...chf, display: 'flex', height: 44, flexShrink: 0, background: CARD, boxShadow: `inset 0 0 0 1px ${CARD_BORDER}` }}>
      {RUN_MODES.map(({ id, label }) => {
        const on = id === value;
        const off = id === 'guided' ? guidedOff : soloOff;
        return (
          <button key={id} type="button" role="radio" aria-checked={on ? 'true' : 'false'} aria-disabled={off ? 'true' : undefined} className="fk-seg"
            onClick={off ? undefined : () => onPick(id)} style={{
              flex: '1 1 0', minWidth: 0, height: 44, border: 'none', padding: '0 4px', whiteSpace: 'nowrap', cursor: off ? 'default' : 'pointer',
              font: `700 12px ${HEAD}`, letterSpacing: '0.12em', opacity: off ? 0.4 : 1,
              color: on ? '#1A1204' : MUTED, background: on ? GOLD : 'transparent',
            }}>{label}</button>
        );
      })}
    </div>
  );
}

// TIME: 5 to 60 minutes, a minute a step. The bubble rides the knob and the
// marks sit where their minutes are on the track (the knob's centre runs from
// half a knob in to half a knob short of the end).
//
// A scroll that starts on the slider stays a scroll. The band handles the
// pointer itself (touch-action: pan-y, so the browser keeps every vertical
// swipe): a finger on the knob drags it (it moves with the finger, from where
// it was grabbed, so it never jumps), a finger anywhere else drags only once
// it has gone sideways (more than SLOP px, and more than up or down), and a tap
// jumps to that minute. A swipe the browser takes for a scroll (pointercancel)
// puts the knob back. The mouse drags from any press, as a slider does. The
// native range input underneath takes no pointer and stays the slider for the
// keyboard and screen readers.
//
// While the knob is held the card follows it: onLive(minutes) is called at most
// once a frame (requestAnimationFrame) with the minute under the knob, and
// onLive(null) when the gesture is cancelled. Only a finished gesture or a key
// commits the minutes: onCommit saves them (and the live card is already the
// card for them).
const SLOP = 8;
function TimeSlider({ value, onLive, onCommit, dim }) {
  const inputRef = useRef(null);
  const gesture = useRef(null); // { id, x, y, dragging, grab }
  const skipClick = useRef(false);
  const [draft, setDraft] = useState(null);
  const shown = draft ?? value;
  const at = (v) => (v - QM_TIME_MIN) / (QM_TIME_MAX - QM_TIME_MIN);
  const left = (v) => `calc(${THUMB / 2}px + ${at(v)} * (100% - ${THUMB}px))`;
  // The live card: the latest minute, sent once a frame; a minute already sent
  // is not sent again.
  const frame = useRef(0);
  const pending = useRef(null);
  const sent = useRef(null);
  const onLiveRef = useRef(onLive);
  useEffect(() => { onLiveRef.current = onLive; });
  const follow = (v) => {
    pending.current = v;
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      if (pending.current !== null && pending.current !== sent.current) { sent.current = pending.current; onLiveRef.current?.(pending.current); }
    });
  };
  const stopFollowing = () => {
    if (frame.current) { cancelAnimationFrame(frame.current); frame.current = 0; }
    pending.current = null; sent.current = null;
  };
  useEffect(() => stopFollowing, []);
  // The minute under a pointer, and whether it is on the knob, from the
  // track's own box.
  const track = () => inputRef.current.getBoundingClientRect();
  const minuteAt = (clientX) => {
    const r = track();
    const p = Math.min(1, Math.max(0, (clientX - r.left - THUMB / 2) / Math.max(1, r.width - THUMB)));
    return QM_TIME_MIN + Math.round(p * (QM_TIME_MAX - QM_TIME_MIN) / QM_TIME_STEP) * QM_TIME_STEP;
  };
  const knobX = () => { const r = track(); return r.left + THUMB / 2 + at(value) * (r.width - THUMB); };
  const onKnob = (clientX) => Math.abs(clientX - knobX()) <= THUMB / 2 + SLOP;
  const drag = (e) => {
    gesture.current.dragging = true;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* already gone */ }
    if (e.pointerType === 'mouse') inputRef.current?.focus({ preventScroll: true }); // the arrow keys carry on from here
  };
  const move = (clientX) => { const m = minuteAt(clientX - (gesture.current?.grab || 0)); setDraft(m); follow(m); };
  const reset = () => {
    const wasDragging = !!gesture.current?.dragging;
    gesture.current = null; setDraft(null); stopFollowing();
    if (wasDragging) onLiveRef.current?.(null);
  };
  const band = {
    onPointerDown: (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      gesture.current = { id: e.pointerId, x: e.clientX, y: e.clientY, dragging: false, grab: 0 };
      skipClick.current = false;
      if (e.pointerType === 'mouse') { e.preventDefault(); drag(e); move(e.clientX); }
      else if (onKnob(e.clientX)) { gesture.current.grab = e.clientX - knobX(); drag(e); }
    },
    onPointerMove: (e) => {
      const g = gesture.current;
      if (!g || g.id !== e.pointerId) return;
      if (e.pointerType === 'mouse' && e.buttons === 0) { reset(); return; }
      if (!g.dragging) {
        const dx = Math.abs(e.clientX - g.x), dy = Math.abs(e.clientY - g.y);
        if (dx > SLOP && dx > dy) drag(e); else return;
      }
      move(e.clientX);
    },
    onPointerUp: (e) => {
      const g = gesture.current;
      if (!g || g.id !== e.pointerId) return;
      gesture.current = null;
      if (!g.dragging) return; // a tap: the click below
      skipClick.current = true;
      const m = minuteAt(e.clientX - g.grab);
      stopFollowing(); setDraft(null);
      onCommit(m);
    },
    onPointerCancel: reset,
    onLostPointerCapture: (e) => { if (gesture.current?.id === e.pointerId) reset(); },
    // A tap (no drag) jumps to its minute. The browser sends no click for a
    // swipe, a long press or a touch that only stops a fling. A click with no
    // pointer behind it (detail 0: a screen reader activating the slider) has
    // no minute to jump to.
    onClick: (e) => {
      if (skipClick.current) { skipClick.current = false; return; }
      if (e.detail === 0 || e.target === inputRef.current) return;
      onCommit(minuteAt(e.clientX));
    },
  };
  return (
    <div {...band} className="qm-time-band" style={{
      position: 'relative', paddingTop: 18, opacity: dim ? 0.55 : 1, transition: 'opacity .2s ease',
      touchAction: 'pan-y', cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none', WebkitTapHighlightColor: 'transparent',
    }}>
      <span aria-hidden="true" data-qm-bubble="" style={{
        position: 'absolute', top: 0, left: left(shown), transform: 'translateX(-50%)', whiteSpace: 'nowrap',
        padding: '3px 8px', borderRadius: 6, background: GOLD, color: '#1A1204', font: `700 12px ${HEAD}`, letterSpacing: '0.04em',
      }}>{shown} MIN</span>
      <input ref={inputRef} type="range" className="qm-range" aria-label="Time" aria-valuetext={`${shown} minutes`}
        min={QM_TIME_MIN} max={QM_TIME_MAX} step={QM_TIME_STEP} value={shown}
        onChange={(e) => onCommit(Number(e.target.value))} style={{ '--p': at(shown) }}/>
      <div aria-hidden="true" style={{ position: 'relative', height: 14, marginTop: -8 }}>
        {QM_TIME_TICKS.map(t => (
          <span key={t} style={{ position: 'absolute', top: 0, left: left(t), transform: 'translateX(-50%)', font: `600 11px ${HEAD}`, color: t === shown ? '#fff' : '#7D7799' }}>{t}</span>
        ))}
      </div>
    </div>
  );
}

export default function QuickMissionSetup({ onBack, onHome, onFightMode, onStart, onCardioOnly, onPaywall }) {
  const [helpOpen, setHelpOpen] = useState(false);
  // GEAR · TIME (on the page) and FOCUS (behind ADJUST), back from the last
  // visit. LEVEL is the athlete's own on every visit (their Fit progress, so it
  // keeps tracking them); a pick in ADJUST or a SURPRISE roll lasts for this
  // visit only and is never saved.
  const [keys, setKeys] = useState(() => loadQuickMissionKeys());
  const { workoutType, duration: savedDuration, focus } = keys;
  const start = useState(() => athleteTier(loadStats(), 'fit'))[0];
  const [picked, setPicked] = useState(null);
  const difficulty = picked ?? start;
  // The minutes under the knob while it is held (null otherwise): the card is
  // built for them live, and only the end of the gesture saves them.
  const [live, setLive] = useState(null);
  const duration = live ?? savedDuration;
  // While the knob is held the open card's move list keeps the height it had,
  // so the slider under the finger never moves as the list grows or shrinks.
  const [frozenH, setFrozenH] = useState(null);
  const listRef = useRef(null);
  // One seed per visit (and per SURPRISE): inside one shape of workout (the
  // rounds the minutes make) the same moves, so scrubbing the minutes grows and
  // shrinks one workout instead of dealing a new one at every step; where the
  // shape changes, a new workout (quickMissionSeed).
  const [nonce] = useState(() => Math.floor(Math.random() * 2147483647));
  const [seed, setSeed] = useState(0);
  const [cardioAddon, setCardioAddon] = useState(null);
  const [cardioSheetOpen, setCardioSheetOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [open, setOpen] = useState(() => loadCardOpen());
  // What the card shows: the generated mission, a named classic (Murph,
  // Sally Up…) or a v2 launch mission. A library pick replaces the generated
  // mission until GEAR, TIME, SURPRISE or the card's way back hands it back
  // to the generator.
  const [sel, setSel] = useState(GENERATED);
  const named = sel.kind === 'classic' ? namedWorkoutById(sel.id) : null;
  void onHome; void onCardioOnly;

  // Quick Mission v2 — read once per mount. Its choices: the run mode comes
  // back from the last visit, the level per mission (the library keeps its
  // own LOADOUT / THEME); the selected mission and its swaps never do.
  const v2 = useState(() => qmV2Enabled())[0];
  const [prefs, setPrefs] = useState(() => loadShelfPrefs());
  const [mode, setMode] = useState(() => prefs.mode || 'guided');
  const [level, setLevel] = useState('standard');
  const [swaps, setSwaps] = useState({}); // { [swapKey]: moveId }, the athlete's own picks only
  const [swapKeyOpen, setSwapKeyOpen] = useState(null);
  // Captured once, so the card, its rows, the swap sheet and the library all
  // filter alike.
  const gear = useState(() => (v2 ? gearProfile() : null))[0];
  const [shelf] = useState(() => shelfEntries().filter(e => v2 || e.kind === 'classic'));

  // The mission on the card. Regenerated whenever a choice changes, or when
  // SURPRISE bumps the seed. The cardio add-on is not one of them: it runs
  // after the mission and joins the config only at START, so turning it on
  // or off in ADJUST keeps the moves on the card.
  const cfg = useMemo(() => quickMissionConfig({ duration, focus, difficulty, workoutType }), [duration, focus, difficulty, workoutType]);
  const mission = useMemo(() => generateQuickMission({ ...cfg, rng: seededRng(quickMissionSeed(nonce, seed, duration)) }), [cfg, seed, nonce, duration]);
  const estMin = Math.max(1, Math.round(estimateQuickMissionSeconds(mission) / 60));

  // A v2 card is rebuilt from the authored mission on every choice, so a
  // level change drops any swap that no longer applies.
  const v2Mission = useMemo(() => (v2 && sel.kind === 'v2' ? buildLoadoutMission(sel.id, { level, swaps, gear }) : null), [v2, sel, level, swaps, gear]);
  const card = useMemo(() => (v2Mission ? missionCardModel(v2Mission, { gear }) : null), [v2Mission, gear]);
  const levels = useMemo(() => (v2Mission ? levelsOf(missionDefById(v2Mission.id)) : []), [v2Mission]);
  // How START runs what is on the card: a mission only offered at your pace
  // always, a classic always GUIDED (the coach's calls are its point), else the
  // saved choice.
  const runMode = card?.soloOnly ? 'solo' : named ? 'guided' : mode;
  const onLibrary = sel.kind !== 'generated';
  // RESET SWAPS shows while one of the athlete's picks is on the card. A pick
  // the current level dropped stays in the map (it comes back with its level)
  // but has nothing to reset.
  const hasSwaps = Object.keys(swaps).length > 0 && !!card?.rows.some(r => r.undoable);

  const clearPick = () => { setSel(GENERATED); setSwaps({}); };
  // A choice is saved, and GEAR or TIME always brings today's mission back to
  // the card. Only the changed choice joins the stored ones, so a SURPRISE
  // roll still on screen is never saved with it.
  const pickKey = (patch) => {
    saveQuickMissionKeys({ ...loadQuickMissionKeys(), ...patch });
    setKeys(k => ({ ...k, ...patch }));
  };
  const pickPage = (patch) => { clearPick(); pickKey(patch); };
  // A finished TIME gesture or key. The same minutes change nothing, except
  // that a deliberate touch on TIME with a library mission on the card brings
  // today's mission back.
  const pickTime = (v) => {
    setLive(null); setFrozenH(null);
    if (v !== savedDuration || sel.kind !== 'generated') pickPage({ duration: v });
  };
  // The knob is moving: build the card for the minute under it (null = the
  // gesture was cancelled, back to the saved minutes). The first move of a
  // drag brings today's mission back if a library mission was on the card.
  const latest = useRef({});
  useEffect(() => { latest.current = { live, sel, open }; });
  const followTime = (v) => {
    if (v == null) { setLive(null); setFrozenH(null); return; }
    const { live: was, sel: on, open: isOpen } = latest.current;
    if (was == null) {
      if (on.kind !== 'generated') clearPick();
      else if (isOpen && listRef.current) setFrozenH(Math.round(listRef.current.getBoundingClientRect().height));
    }
    setLive(v);
  };
  // SURPRISE keeps GEAR and TIME (the two choices on the page) and deals a
  // new level (one step either side of the athlete's own), focus and moves. It
  // is not a choice, so it is not saved: the next visit opens on the athlete's
  // level and what they picked.
  // The two dice on SURPRISE roll on every tap (remounted by key).
  const [roll, setRoll] = useState(0);
  const surprise = () => {
    setRoll(r => r + 1);
    clearPick();
    let f = focus, i = difficulty, guard = 0;
    while (f === focus && i === difficulty && guard++ < 40) { f = rand(QM_FOCI); i = rollSurpriseTier(start); }
    setKeys(k => ({ ...k, focus: f })); setPicked(i); setSeed(n => n + 1);
  };

  // ▾ SEE ALL / ▴ SHOW LESS. Opening scrolls the page just enough to bring
  // the whole card into view (never past its top), smoothly unless the
  // viewer asked for less motion.
  const cardRef = useRef(null);
  const adjustRef = useRef(null);
  const scrollOnOpen = useRef(false);
  const toggleOpen = () => {
    const next = !open;
    scrollOnOpen.current = next;
    setOpen(next);
    saveCardOpen(next);
  };
  useEffect(() => {
    if (!open || !scrollOnOpen.current) return;
    scrollOnOpen.current = false;
    const el = cardRef.current;
    const scroller = el?.closest('.no-scrollbar');
    if (!el || !scroller) return;
    const r = el.getBoundingClientRect();
    const s = scroller.getBoundingClientRect();
    const bottom = s.bottom - (parseFloat(getComputedStyle(scroller).paddingBottom) || 0);
    const over = r.bottom + 12 - bottom;
    const room = r.top - s.top - 8;
    const by = Math.min(over, room);
    if (by > 0) scroller.scrollBy({ top: by, behavior: reducedMotion() ? 'auto' : 'smooth' });
  }, [open]);

  const savePrefs = (patch) => setPrefs(saveShelfPrefs(patch));
  // The level a launch mission's card opens on: the athlete's last pick for
  // it, else its default. (The library's START runs the default.)
  const levelFor = (id) => {
    const def = missionDefById(id);
    const stored = prefs.levels?.[id];
    return stored && def?.levels?.[stored] ? stored : def?.defaultLevel;
  };
  const pickClassic = (id) => { setSel({ kind: 'classic', id }); setSwaps({}); };
  const pickV2 = (id) => {
    if (!missionDefById(id)) return;
    setLevel(levelFor(id));
    setSwaps({});
    setSel({ kind: 'v2', id });
  };
  const pickLevel = (l) => { setLevel(l); if (v2Mission) savePrefs({ levels: { [v2Mission.id]: l } }); };
  // A mission only offered at your pace, or a classic, shows its own mode
  // without overwriting the stored choice.
  const pickMode = (m) => { if (card?.soloOnly || named || m === mode) return; setMode(m); savePrefs({ mode: m }); };
  // The sheet only offers moves reachable from the authored base, and the
  // build derives the dose from the base, so a chained pick needs nothing
  // special. Picking the card's own default is the same as UNDO.
  const pickSwap = (swapKey, moveId) => {
    const row = card?.rows.find(r => r.swapKey === swapKey);
    setSwaps(s => {
      const n = { ...s };
      if (row && moveId === row.defaultMoveId) delete n[swapKey]; else n[swapKey] = moveId;
      return n;
    });
    setSwapKeyOpen(null);
  };
  const undoSwap = (row) => setSwaps(s => { const n = { ...s }; delete n[row.swapKey]; return n; });

  const startV2 = (m, runAs) => {
    onStart?.({
      ...cfg, cardioAddon,
      workoutType: m.workoutType, duration: m.duration, difficulty: m.difficulty, focus: m.focus,
      mission: m, v2: true, mode: m.guided ? runAs : 'solo',
      missionId: m.id, level: m.level, scaled: m.scaled, swaps: m.swaps,
    });
  };
  const startClassic = (w) => {
    // Pro classics: only enforced once the paywall is on (isPro() is true
    // for everyone until then).
    if (w.pro && !isPro()) { onPaywall?.(); return; }
    const m = buildNamedMission(w.id);
    // The classic's own workoutType drives the brief, the prep lines and the
    // status strip; countType keeps the count exactly as before (bodyweight,
    // whatever GEAR says).
    onStart?.({ ...cfg, cardioAddon, workoutType: m.workoutType, countType: 'Bodyweight', duration: m.duration, difficulty: 'Hard', focus: m.focus, mission: m });
  };
  const handleStart = () => {
    if (v2Mission) { startV2(v2Mission, runMode); return; }
    if (named) { startClassic(named); return; }
    // The run is asked for explicitly (and only when v2 is on), so App's start
    // never has to guess for a mission started from this page.
    onStart?.({ ...cfg, cardioAddon, mission, ...(v2 ? { mode: runMode } : {}) });
  };

  // The library's two actions. Both close it first, so a sheet never opens
  // on top of it. PUT ON CARD also scrolls the page back up, so a short phone
  // shows the card from its top. START runs the mission's default level, the
  // one the sheet's preview shows.
  const putOnCard = (entry) => {
    setLibraryOpen(false);
    if (entry.kind === 'v2') pickV2(entry.id); else pickClassic(entry.id);
    cardRef.current?.closest('.no-scrollbar')?.scrollTo({ top: 0 });
  };
  const startFromLibrary = (entry) => {
    setLibraryOpen(false);
    if (entry.kind === 'v2') {
      const m = buildLoadoutMission(entry.id, { gear });
      if (m) startV2(m, mode);
      return;
    }
    const w = namedWorkoutById(entry.id);
    if (w) startClassic(w);
  };
  // Back closes a sheet before it leaves the screen.
  const back = () => {
    if (adjustOpen) setAdjustOpen(false);
    else if (libraryOpen) setLibraryOpen(false);
    else onBack?.();
  };

  // ADD CARDIO lives in ADJUST. Its editor is a sheet of its own, so ADJUST
  // steps aside while it is up and comes back when it closes.
  const cardioFromAdjust = useRef(false);
  const openCardio = () => { cardioFromAdjust.current = adjustOpen; setAdjustOpen(false); setCardioSheetOpen(true); };
  const closeCardio = () => { setCardioSheetOpen(false); if (cardioFromAdjust.current) setAdjustOpen(true); cardioFromAdjust.current = false; };
  const cardio = {
    on: !!cardioAddon,
    summary: cardioAddon ? summarizeCardioAddon(cardioAddon) : 'Finish with a run',
    onToggle: () => { if (cardioAddon) setCardioAddon(null); else openCardio(); },
    onEdit: openCardio,
  };

  const classic = v2 && named ? classicMeta(named) : null;
  const movesAll = [...mission.exercises, ...mission.finisherExercises];
  const roundsWord = `${mission.rounds} ${mission.rounds === 1 ? 'round' : 'rounds'}`;
  const classicMoves = named ? named.lines.filter(([a]) => !notes(a)) : [];
  const moveCount = card ? card.rows.length : named ? classicMoves.length : movesAll.length;
  const hidden = moveCount > CARD_MOVES;

  // The one line under the switch (and under HOW in ADJUST): what the choice
  // does, or why it is not offered.
  const runHelp = card
    ? (card.soloOnly ? SOLO_ONLY_HELP : runMode === 'solo' ? SOLO_HELP : card.guidedHelp || GUIDED_HELP)
    : named ? CLASSIC_HELP : runMode === 'solo' ? SOLO_HELP : GUIDED_HELP;

  // ADJUST: what this mission lets you change.
  const adjust = card
    ? {
      words: levels.length > 1 ? 'level, run mode, cardio' : 'run mode, cardio',
      level: levels.length > 1 ? { options: levels.map(l => ({ id: l.id, label: l.label })), value: v2Mission.level, onPick: pickLevel, detail: v2Mission.levelDetail } : null,
      focus: null,
      how: { value: runMode, soloOnly: card.soloOnly, onPick: pickMode, help: runHelp },
      // The mission's brief, off the card so the open card stays the moves
      // and one line.
      notes: { lines: [['LOADOUT', card.loadoutLine], ['SCORE', card.scoreLine]], scale: card.scale, note: card.note },
    }
    : named
      ? { words: 'add cardio', level: null, focus: null, how: null, notes: null }
      : {
        words: v2 ? 'level, focus, run mode, cardio' : 'level, focus, cardio',
        // The athlete's own level is marked YOUR LEVEL; any can be picked, for this visit.
        level: { options: QM_INTENSITY.map(d => ({ id: d, label: LEVEL_WORD[d] })), value: difficulty, onPick: setPicked, mark: start, markLabel: 'YOUR LEVEL', detail: 'Starts at your level. Your pick lasts for this visit.' },
        focus: { options: QM_FOCI.map(f => ({ id: f, label: f === 'FULL BODY' ? 'FULL' : f })), value: focus, onPick: (v) => pickKey({ focus: v }) },
        how: v2 ? { value: runMode, soloOnly: false, onPick: pickMode, help: runHelp } : null, notes: null,
      };
  const title = card ? card.title : named ? named.title : mission.title;

  // Steps whose anchor is not on screen are skipped (a missing anchor stalls
  // the guide): ADJUST needs the card open, SURPRISE today's mission.
  const guideSteps = useMemo(() => {
    const steps = v2 ? SCREEN_GUIDES.quick_mission_setup_v2 : SCREEN_GUIDES.quick_mission_setup;
    return steps.filter(s => (s.target !== 'qm-adjust' || open) && (s.target !== 'qm-surprise' || !onLibrary));
  }, [v2, open, onLibrary]);

  // How long it really takes, and how it runs: a loaded set is never counted,
  // so it ends on DONE (the runner's safe-weight brief says the same).
  const atPace = v2 && runMode === 'solo';
  const summary = atPace
    ? `${roundsWord} · about ${estMin} min. The clock counts up; rest as you need.${workoutType === 'Bodyweight' ? '' : ' Pick a safe weight.'}`
    : workoutType === 'Weighted'
      ? `${roundsWord} · about ${estMin} min. Pick a safe weight; tap DONE after each set.`
      : workoutType === 'Hybrid'
        ? `${roundsWord} · about ${estMin} min. Pick a safe weight; tap DONE after a loaded set.`
        : `${roundsWord} · about ${estMin} min with the coach's count and rest`;
  // One short line: the count is the pill beside it, and the row stays one
  // line tall on a 360px phone.
  const librarySub = 'Ready-made workouts. Pick one.';

  const muted = (children) => <div style={{ font: `500 12px ${BODY}`, color: MUTED, lineHeight: 1.4 }}>{children}</div>;
  // An open library card's rows are MoveRow's 44px (the swap's target), so
  // they need no gap of their own.
  const listStyle = {
    listStyle: 'none', margin: '2px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: card && open ? 0 : open ? 4 : 3,
    // While the knob is held: the height the list had, never more, never less.
    ...(frozenH != null && open && !card && !named ? { height: frozenH, overflow: 'hidden', flexShrink: 0 } : {}),
  };

  // The eyebrow: TODAY'S QUICK MISSION, or a library mission's with the small
  // way back to today's mission (short words, a 44px target; its margins keep
  // the row 20px tall).
  const eyebrow = onLibrary ? (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 20 }}>
      <span style={{ minWidth: 0, font: `600 10px ${HEAD}`, letterSpacing: '0.16em', textTransform: 'uppercase', color: GOLD, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {card ? card.eyebrow : `Classic · ${named.tag}`}
      </span>
      <button type="button" className="fk-quiet" onClick={clearPick} aria-label="Back to today's mission" style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 2, height: 44, padding: '0 10px', margin: '-12px -10px -12px 0',
        background: 'transparent', border: 'none', cursor: 'pointer', font: `700 10px ${HEAD}`, letterSpacing: '0.12em', color: VIOLET_TEXT,
      }}><ChevronLeft size={14}/>TODAY</button>
    </div>
  ) : (
    <span style={{ font: `600 10px ${HEAD}`, letterSpacing: '0.18em', textTransform: 'uppercase', color: GOLD }}>Today’s Quick Mission</span>
  );

  // A library card's level tag is the level picked in ADJUST (BEGINNER /
  // STANDARD / ELITE), so it follows ADJUST as today's MEDIUM or HARD does; a
  // one-level mission shows its own difficulty.
  const cardLevel = card ? (levels.length > 1 ? v2Mission.levelLabel : levelTag(card.tags[1])) : null;
  const tags = card ? (
    <>
      <Tag>{card.tags[0]}</Tag>
      {card.accentTag && <Tag accent>{card.accentTag}</Tag>}
      {cardLevel && <Tag>{cardLevel}</Tag>}
      {card.tags.slice(2).map(t => <Tag key={t} accent={t === 'SCALED'}>{t}</Tag>)}
    </>
  ) : named ? (
    <>
      <Tag>~{named.estMin} min</Tag>
      <Tag accent>{named.focus}</Tag>
      {classic?.accentTag && <Tag accent>{classic.accentTag}</Tag>}
      {named.needs && <Tag>{named.needs}</Tag>}
      {named.pro && <Tag>PRO</Tag>}
    </>
  ) : (
    <>
      <Tag>{duration} min</Tag>
      <Tag>{LEVEL_WORD[difficulty]}</Tag>
      <Tag accent>{focusLabel(focus)}</Tag>
      {GEAR_TAG[workoutType] && <Tag>{GEAR_TAG[workoutType]}</Tag>}
      {open && <Tag>{roundsWord}</Tag>}
    </>
  );

  // The moves: the first three, or (open) all of them.
  const moves = card ? (
    open
      ? card.rows.map((row, i) => <MoveRow key={row.swapKey} row={row} index={i} onSwap={(r) => setSwapKeyOpen(r.swapKey)} onUndo={undoSwap}/>)
      : card.rows.slice(0, CARD_MOVES).map((row, i) => <PlainMove key={row.swapKey} index={i} name={row.name} dose={row.dose} gold/>)
  ) : named ? (
    open
      ? named.lines.map(([a, b], i) => (notes(a)
        ? <li key={i} style={{ paddingLeft: 28, font: `600 12px ${HEAD}`, letterSpacing: '0.06em', color: MUTED }}>{a}</li>
        : <PlainMove key={i} index={named.lines.slice(0, i).filter(([x]) => !notes(x)).length} name={a} dose={b} gold/>))
      : classicMoves.slice(0, CARD_MOVES).map(([a, b], i) => <PlainMove key={i} index={i} name={a} dose={b} gold/>)
  ) : (
    (open ? movesAll : movesAll.slice(0, CARD_MOVES)).map((ex, i) => (
      <PlainMove key={`${ex.name}-${i}`} index={i} name={ex.name} finisher={ex.isFinisher}
        dose={open || ex.mode === 'timed' ? quickMissionDose(ex) : String(ex.reps)}/>
    ))
  );

  // The open card's lines under the moves.
  const details = card ? (
    <>
      {card.banner && (
        <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(157,108,255,0.12)', border: '1px solid rgba(157,108,255,0.4)', font: `500 12px ${BODY}`, color: '#fff', lineHeight: 1.4 }}>{card.banner}</div>
      )}
      {hasSwaps && (
        <button type="button" className="fk-quiet" onClick={() => setSwaps({})} style={{
          alignSelf: 'flex-start', height: 32, padding: 0, marginTop: -2, background: 'transparent', border: 'none', cursor: 'pointer',
          font: `700 11px ${HEAD}`, letterSpacing: '0.14em', color: VIOLET_TEXT,
        }}>RESET SWAPS</button>
      )}
      {card.missionLine && muted(sentence(card.missionLine))}
    </>
  ) : named ? (
    <>
      {classic && <HeaderLines lines={[['LOADOUT', classic.loadoutLabel]]}/>}
      {muted(named.note)}
    </>
  ) : muted(summary);

  return (
    <PhoneFrame useBrandBg>
      <style dangerouslySetInnerHTML={{ __html: fitKitCSS + QM_CSS }}/>
      <Embers count={2}/>
      <SetupPage scroll>
        <SetupHeader title="QUICK MISSION" onBack={back} onHelp={() => setHelpOpen(true)}/>
        <div style={{ flexShrink: 0, padding: '0 16px' }}>
          <ModeTabs active="fit" onFight={onFightMode}/>
        </div>

        <div className="qm-stack" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 16px 0' }}>
          {/* The mission card — what START runs. */}
          <section ref={cardRef} className="fk-hero" data-guide="qm-card" aria-label={title} style={{
            position: 'relative', borderRadius: 16, overflow: 'hidden', flexShrink: 0,
            border: '1px solid rgba(242,190,69,0.35)', background: '#0D0A18',
          }}>
            <SafeImage src="/static/fitmode/banner-gym-quick.webp" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: '55% 50%' }}/>
            {/* An open card is long and carries doses and swap icons on its
                right edge, so its scrim stays darker across the whole card. */}
            <div style={{ position: 'absolute', inset: 0, background: open
              ? 'linear-gradient(90deg, rgba(7,6,12,0.96) 0%, rgba(7,6,12,0.9) 55%, rgba(7,6,12,0.78) 100%)'
              : 'linear-gradient(90deg, rgba(7,6,12,0.96) 0%, rgba(7,6,12,0.86) 55%, rgba(7,6,12,0.55) 100%)' }}/>
            <div className="qm-card-in" style={{ position: 'relative', padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {eyebrow}
              <h1 style={{ margin: 0, font: `700 23px ${HEAD}`, lineHeight: 1.05, textTransform: 'uppercase', color: '#fff', maxWidth: 320 }}>{title}</h1>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{tags}</div>
              <ol id="qm-moves" ref={listRef} className={open ? undefined : 'qm-moves-closed'} style={listStyle}>{moves}</ol>
              {/* A mission's safety line (NO CONTINUES), big, open or closed. */}
              {card?.safety && (
                <div role="note" style={{
                  padding: '9px 11px', borderRadius: 10, background: 'rgba(242,190,69,0.12)', border: '1.5px solid rgba(242,190,69,0.6)',
                  font: `700 13px ${BODY}`, color: '#fff', lineHeight: 1.35,
                }}>{card.safety}</div>
              )}

              {open && (
                <>
                  {details}
                  {/* ADJUST — level, focus, guided or at your pace, cardio: a sheet. */}
                  <button ref={adjustRef} type="button" data-guide="qm-adjust" className="fk-row" onClick={() => setAdjustOpen(true)} aria-haspopup="dialog" aria-expanded={adjustOpen ? 'true' : 'false'} style={{
                    display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, padding: '0 12px', width: '100%', boxSizing: 'border-box', marginTop: 2,
                    borderRadius: 10, background: 'rgba(18,13,36,0.9)', border: '1px solid rgba(157,108,255,0.35)', textAlign: 'left', cursor: 'pointer',
                  }}>
                    <span style={{ flexShrink: 0, font: `700 12px ${HEAD}`, letterSpacing: '0.14em', color: VIOLET_TEXT }}>ADJUST</span>
                    <span style={{ flex: 1, minWidth: 0, font: `500 12px ${BODY}`, color: MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>· {adjust.words}</span>
                    {cardioAddon && <span style={{ flexShrink: 0, font: `700 9px ${HEAD}`, letterSpacing: '0.12em', color: GOLD }}>+ CARDIO</span>}
                    <ChevronRight size={16} color={VIOLET_TEXT} style={{ flexShrink: 0 }}/>
                  </button>
                </>
              )}

              {/* ▾ SEE ALL / ▴ SHOW LESS — one button, so focus stays on it. */}
              <button type="button" data-guide="qm-expand" className="qm-toggle" onClick={toggleOpen} aria-expanded={open ? 'true' : 'false'} aria-controls="qm-moves" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, margin: '0 0 -4px', padding: 0, width: '100%',
                background: 'transparent', border: 'none', borderTop: '1px dashed rgba(255,255,255,0.12)', cursor: 'pointer',
                font: `700 12px ${HEAD}`, letterSpacing: '0.14em', color: VIOLET_TEXT,
              }}>
                <span aria-hidden="true" style={{ width: 24, height: 24, borderRadius: '50%', border: '1px solid rgba(157,108,255,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {open ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                </span>
                {open ? 'SHOW LESS' : hidden ? `SEE ALL ${moveCount} MOVES` : moveCount === CARD_MOVES
                  ? <><span className="qm-see-more">SEE MORE</span><span className="qm-see-all">SEE ALL {moveCount} MOVES</span></>
                  : 'SEE MORE'}
              </button>

              {/* GUIDED | AT YOUR PACE — always here, right above START. */}
              {v2 && (
                <div data-guide="qm-how" className="qm-how" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <RunModeSwitch value={runMode} guidedOff={!!card?.soloOnly} soloOff={!!named} onPick={pickMode}/>
                  <div id="qm-how-help" style={{ font: `500 11px ${BODY}`, color: MUTED, lineHeight: 1.35 }}>{runHelp}</div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <div data-guide="qm-start" className="qm-start" style={{ flex: 1, minWidth: 0 }}>
                  <GoldButton label="START" icon="play" onClick={handleStart} height={50} style={{ fontSize: 18, letterSpacing: '0.22em' }}/>
                </div>
                {/* SURPRISE — a different workout with the same GEAR and TIME. */}
                {!onLibrary && (
                  <button type="button" data-guide="qm-surprise" className="fk-ghost qm-surprise" onClick={surprise} style={{
                    ...chf, width: 64, height: 50, flexShrink: 0, padding: 0, cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
                    background: CARD, border: '1px solid rgba(157,108,255,0.5)', color: '#fff', font: `700 8px ${HEAD}`, letterSpacing: '0.12em',
                  }}><span key={roll} aria-hidden="true" className={roll ? 'qm-dice qm-rolling' : 'qm-dice'}><span className="qm-die a">🎲</span><span className="qm-die b">🎲</span></span>SURPRISE</button>
                )}
              </div>
            </div>
          </section>

          {/* GEAR and TIME — the page's two choices. With a library mission
              on the card GEAR lights nothing and TIME dims: they describe
              today's mission, and a tap or a sideways drag brings it back
              (a scroll that starts on TIME does not). */}
          <div data-guide="qm-gear" className="qm-mt" style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
            <Label right={onLibrary ? <span style={{ font: `500 12px ${BODY}`, color: MUTED }}>for today’s mission</span> : null}>Gear</Label>
            <GearRow value={onLibrary ? null : workoutType} onPick={(v) => pickPage({ workoutType: v })}/>
          </div>
          <div data-guide="qm-time" className="qm-mt" style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
            <Label>Time</Label>
            <TimeSlider value={duration} dim={onLibrary} onLive={followTime} onCommit={pickTime}/>
          </div>

          {/* MISSION LIBRARY — the folder: every launch mission and classic,
              in a sheet. */}
          <button type="button" data-guide="qm-library" className="fk-row qm-mt qm-lib" onClick={() => setLibraryOpen(true)} aria-haspopup="dialog" aria-expanded={libraryOpen ? 'true' : 'false'} style={{
            flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, minHeight: 56, padding: '8px 12px', width: '100%', boxSizing: 'border-box', marginTop: 4,
            borderRadius: 14, background: '#0F0B1E', border: '1px solid rgba(157,108,255,0.4)', color: '#fff', textAlign: 'left', cursor: 'pointer',
          }}>
            <span style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 10, background: 'rgba(157,108,255,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Folder size={18} color={VIOLET_TEXT}/>
            </span>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ font: `700 15px ${HEAD}`, letterSpacing: '0.1em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>MISSION LIBRARY</span>
              <span style={{ font: `500 12px ${BODY}`, color: MUTED, lineHeight: 1.35 }}>{librarySub}</span>
            </span>
            <CountPill n={shelf.length}/>
            <ChevronDown size={18} color={VIOLET_TEXT} style={{ flexShrink: 0 }}/>
          </button>
        </div>
      </SetupPage>

      {libraryOpen && (
        <MissionLibrarySheet
          shelf={shelf} onTop={onLibrary ? sel : null} gear={gear}
          onPutOnCard={putOnCard} onStart={startFromLibrary} onClose={() => setLibraryOpen(false)}
        />
      )}
      {adjustOpen && (
        <QuickMissionAdjustSheet
          title={title} level={adjust.level} focus={adjust.focus} how={adjust.how} notes={adjust.notes} cardio={cardio}
          returnFocus={adjustRef} onClose={() => setAdjustOpen(false)}
        />
      )}
      {cardioSheetOpen && (
        <AddCardioSheet
          context={{ source: 'Quick Mission', difficulty: cap(difficulty), durationMin: duration }}
          initialAddon={cardioAddon}
          onAdd={(addon) => { setCardioAddon(addon); closeCardio(); }}
          onClose={closeCardio}
        />
      )}
      {v2Mission && swapKeyOpen && (
        <MoveSwapSheet
          mission={v2Mission} swapKey={swapKeyOpen} gear={gear}
          onPick={(moveId) => pickSwap(swapKeyOpen, moveId)}
          onClose={() => setSwapKeyOpen(null)}
        />
      )}
      {helpOpen && <ScreenGuide steps={guideSteps} onClose={() => setHelpOpen(false)}/>}
    </PhoneFrame>
  );
}

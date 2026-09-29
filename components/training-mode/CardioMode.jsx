import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import PhoneFrame from './PhoneFrame';
import VoiceMixer from './shared/VoiceMixer';
import IntroLogo from './IntroLogo';
import Embers from './Embers';
import CornerHUD from './CornerHUD';
import { ChevronLeft, Minus, Plus, X } from 'lucide-react';
import { C } from './Styles';
import { ARCADE } from './ArcadeUI';
import { CARDIO_ADDON_TYPES, cardioAddonToPlayer } from './data/cardioAddon';
import CardioProtocolPlayer from './CardioProtocolPlayer';
import RunPlayer from './RunPlayer';
import { loadLiveRun, liveRunElapsedSec } from './data/liveRun';
import { computeRunTargets, metersPerUnit, fmtClock as fmtRunClock } from './data/runCoach';
import { getRunGhost, ghostArt } from './data/runGhosts';
import SafeImage from './SafeImage';
import { unlockAudio } from './data/audioEngine';
import CardioSummary from './CardioSummary';
import EmptyState from './EmptyState';
import { equipmentById, equipmentInGroup, defaultEquipment, tracksDistance } from './data/cardioEquipment';
import { defaultSpeed, clampSpeed, speedUnitLabel } from './data/machineSpeed';
import SpeedDial from './shared/SpeedDial';
import IntervalQuickSet from './shared/IntervalQuickSet';
import CardioSessionCard from './shared/CardioSessionCard';
import { generateCardioSession, swapMove, reorderMove, removeMove, sessionToIntervalConfig, canSwap } from './data/cardioGenerator';
import ProgressionNudgeCard from './shared/ProgressionNudgeCard';
import ScreenGuide from './shared/ScreenGuide';
import { SCREEN_GUIDES } from './shared/screenGuides';
import TrainingCTA from './shared/TrainingCTA';
import { loadStats, getLevel } from './data/userStats';
import ModeTabs from './shared/ModeTabs';
import { fitKitCSS, SetupHeader, SetupPage, GoldButton, HEAD, BODY, MUTED } from './shared/FitSetupKit';

const GOLD = C.yellow;
const VIOLET = '#b06aff';

// Hover states for the Revamp setup (activity cards, presets, the option rows).
const cardioCSS = `
.cm-act { transition: border-color .18s, background .18s, color .18s; }
.cm-act[aria-checked="false"]:hover, .cm-act[aria-checked="false"]:focus-visible { border-color: #9D6CFF !important; background: rgba(157,108,255,.14) !important; color: #fff !important; }
.cm-opt { transition: border-color .18s, background .18s; }
.cm-opt:hover, .cm-opt:focus-visible { border-color: #F2BE45 !important; }
.cm-preset { transition: border-color .2s, box-shadow .2s; }
.cm-preset:hover, .cm-preset:focus-visible { border-color: #F2BE45 !important; box-shadow: 0 0 0 1px rgba(242,190,69,.3), 0 0 22px rgba(157,108,255,.55); }
.cm-preset img { opacity: .55; filter: brightness(.8); transition: opacity .25s, filter .25s, transform .3s; }
.cm-preset:hover img, .cm-preset:focus-visible img { opacity: .95; filter: brightness(1.08) saturate(1.15); transform: scale(1.03); }
.cm-banner img { opacity: .6; filter: brightness(.85); }
`;

// Seconds a whole interval config takes — the timer ring's number.
const intervalTotal = (ic) => (ic?.warmupSeconds || 0) + (ic?.rounds || 0) * ((ic?.workSeconds || 0) + (ic?.restSeconds || 0)) + (ic?.cooldownSeconds || 0);

// 'interval', SINGULAR. buildSegments() in CardioProtocolPlayer tests
// `format === 'interval' || format === 'tabata'`, and data/cardioAddon.js has
// always produced the singular. A generated ROUNDS session was being handed the
// plural, which matched neither branch and fell through to steady — so five
// movements over four rounds ran as one flat block, and the coach never reached
// a WORK segment to name a movement on. moveNames still arrived, so UP NEXT
// looked correct while nothing behind it was.
const ROUNDS_PLAYER_FORMAT = 'interval';

const fmtClock = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

// Target + elite time for a distance run. The target defaults from the goal
// distance and the athlete's level (10:00/mi at level 1, ~18s/level faster,
// floored at 6:30/mi) and is editable; the elite time is the number to chase —
// two thirds of the target, never faster than 6:00/mi. All in data/runCoach.js
// so the setup screen and the run player agree to the second.
function computeAutoPace(distance, unit, level, targetSeconds) {
  const t = computeRunTargets({ distance, unit, level, targetSeconds });
  return {
    totalSec: t.targetSec, autoTotalSec: t.autoTargetSec, eliteSec: t.eliteSec,
    paceSecPerUnit: t.targetPaceSec, elitePaceSecPerUnit: t.elitePaceSec,
    paceLabel: `${fmtClock(t.targetPaceSec)} /${unit}`, timeLabel: fmtClock(t.targetSec), eliteLabel: fmtClock(t.eliteSec),
    goalLabel: `${distance} ${unit}`,
  };
}

// Four categories. RUNNING and MACHINE are now GROUPS that open an equipment
// screen rather than being the selection themselves — a park and a belt need
// opposite tracking, and a bike and an elliptical differ in whether a distance
// can honestly be produced at all. See data/cardioEquipment.js. ALTERNATE and
// EXERCISE are still selected directly; there is no equipment to disambiguate.
const EQUIPMENT_GROUPS = ['running', 'machine'];
const METHOD_CATEGORIES = [
  { id: 'running', label: 'RUNNING', icon: '🏃', sub: 'Outdoor GPS · Treadmill', type: 'outdoor-run', methodLabel: 'Running' },
  { id: 'machine', label: 'OTHER EQUIPMENT', icon: '⚙️', sub: 'Bike · Rower · Elliptical · Stairs', type: 'bike', methodLabel: 'Machine' },
  // ALTERNATE and EXERCISE were the same product wearing two hats: pick a
  // bodyweight movement, run a clock. The only difference was which movements
  // each listed, which is not worth a card. They are one card now, and the
  // movement is chosen inside it — or generated.
  { id: 'rounds', label: 'ROUNDS', icon: '🔔', sub: 'Fight rounds · Tabata · custom', type: 'mountain-climbers', methodLabel: 'Rounds', wide: true },
];

// Old saved setups still name the two cards that merged.
const LEGACY_CATEGORIES = { alternate: 'rounds', exercise: 'rounds' };

// The formats, kept to four so the row fits one line. The timings live in the
// note UNDER the chips rather than inside them — a chip reading
// "FIGHT ROUNDS 3:00 / 1:00 × 12" pushed the other three onto a second row and
// made the one selected option the widest thing on the screen.
const ROUND_FORMATS = [
  {
    id: 'fight', label: 'FIGHT ROUNDS',
    cfg: { warmupMin: 3, workSec: 180, restSec: 60, rounds: 12, cooldownMin: 0 },
    blurb: 'Three minutes on, one minute off, twelve rounds. A championship fight: long rounds, real recovery.',
  },
  {
    id: 'tabata', label: 'TABATA',
    cfg: { warmupMin: 0, workSec: 20, restSec: 10, rounds: 8, cooldownMin: 0 },
    blurb: 'Twenty seconds flat out, ten off, eight times. Four minutes total, and brutal.',
  },
  { id: 'custom', label: 'CUSTOM', cfg: null, blurb: 'Your numbers. Set the warm-up, work, rest and rounds below.' },
];
const formatById = (id) => ROUND_FORMATS.find(f => f.id === id) || ROUND_FORMATS[0];

const PROTOCOLS = [
  { id: 'steady', label: 'STEADY' },
  { id: 'intervals', label: 'INTERVALS' },
  { id: 'tabata', label: 'TABATA' },
];

// Default work/rest structures per protocol; the config modal edits copies of these.
const CFG_DEFAULTS = {
  intervals: { warmupMin: 3, workSec: 60, restSec: 60, rounds: 8, cooldownMin: 0 },
  tabata: { warmupMin: 0, workSec: 20, restSec: 10, rounds: 8, cooldownMin: 0 },
};

const cfgTargetSeconds = (c) => Math.round((c.warmupMin || 0) * 60) + c.rounds * (c.workSec + c.restSec) + Math.round((c.cooldownMin || 0) * 60);
const cfgToIntervals = (c) => ({
  warmupSeconds: Math.round((c.warmupMin || 0) * 60),
  workSeconds: c.workSec,
  restSeconds: c.restSec,
  rounds: c.rounds,
  cooldownSeconds: Math.round((c.cooldownMin || 0) * 60),
});

function getMethod(id) {
  return CARDIO_ADDON_TYPES.find(m => m.id === id) || CARDIO_ADDON_TYPES[0];
}

const sectionLabel = { fontFamily: ARCADE.fontHead, fontWeight: 700, color: GOLD, fontSize: 9, letterSpacing: '0.2em', marginBottom: 5 };

// One editable row in the interval config: label · typeable value · − · + .
function NumRow({ label, value, unit, min, max, step, onChange }) {
  const set = (v) => { const n = Number.isFinite(v) ? v : min; onChange(Math.max(min, Math.min(max, n))); };
  const stepBtn = {
    width: 30, height: 30, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(176,106,255,0.14)', border: `1px solid ${ARCADE.violetBorderSoft}`, color: '#d6c2ff', flexShrink: 0,
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 0', borderBottom: '1px solid rgba(176,106,255,0.12)' }}>
      <span style={{ flex: 1, fontFamily: ARCADE.fontHead, fontWeight: 700, fontSize: 10, letterSpacing: '0.1em', color: '#c4a4d8' }}>{label}</span>
      <input
        type="number" inputMode="numeric" value={value}
        onChange={e => set(parseInt(e.target.value, 10))}
        style={{ width: 48, textAlign: 'center', padding: '5px 2px', borderRadius: 7, background: 'rgba(6,0,16,0.85)', border: `1px solid ${ARCADE.violetBorderSoft}`, color: '#fff', fontFamily: ARCADE.fontHead, fontWeight: 800, fontSize: 14, outline: 'none' }}
      />
      <span style={{ width: 20, fontFamily: ARCADE.fontBody, fontSize: 9, color: C.muted, textAlign: 'left' }}>{unit}</span>
      <button onClick={() => set(value - step)} style={stepBtn}><Minus size={13} /></button>
      <button onClick={() => set(value + step)} style={stepBtn}><Plus size={13} /></button>
    </div>
  );
}

// Narrow, centered config modal for Target Intervals / Tabata (design 12a).
function ConfigModal({ styleId, cfg, onChange, onClose }) {
  const titleMap = { intervals: 'TARGET INTERVALS', tabata: 'TABATA' };
  const total = cfgTargetSeconds(cfg);
  return createPortal(
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 18, background: 'rgba(4,0,10,0.8)', backdropFilter: 'blur(3px)',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 300, marginBottom: '6vh',
        background: 'linear-gradient(180deg,#140425,#0a0116)',
        borderRadius: 18, border: `1px solid ${ARCADE.goldBorder}`,
        boxShadow: '0 0 40px rgba(124,58,237,0.35), 0 20px 50px rgba(0,0,0,0.55)',
        padding: '15px 16px 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontFamily: ARCADE.fontHead, fontWeight: 900, fontSize: 13, color: GOLD, letterSpacing: '0.1em' }}>{titleMap[styleId]} SETUP</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', padding: 4 }}><X size={18} /></button>
        </div>
        <NumRow label="WARM-UP" value={cfg.warmupMin} unit="min" min={0} max={15} step={1} onChange={v => onChange({ ...cfg, warmupMin: v })} />
        <NumRow label="ACTIVE WORK" value={cfg.workSec} unit="sec" min={5} max={300} step={5} onChange={v => onChange({ ...cfg, workSec: v })} />
        <NumRow label="REST" value={cfg.restSec} unit="sec" min={0} max={180} step={5} onChange={v => onChange({ ...cfg, restSec: v })} />
        <NumRow label="ROUNDS" value={cfg.rounds} unit="" min={1} max={30} step={1} onChange={v => onChange({ ...cfg, rounds: v })} />
        <NumRow label="COOL DOWN" value={cfg.cooldownMin} unit="min" min={0} max={15} step={1} onChange={v => onChange({ ...cfg, cooldownMin: v })} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0 13px' }}>
          <span style={{ fontFamily: ARCADE.fontHead, fontWeight: 900, fontSize: 11, color: '#c4a4d8', letterSpacing: '0.16em' }}>TOTAL</span>
          <span style={{ fontFamily: ARCADE.fontHead, fontWeight: 900, fontSize: 21, color: GOLD, textShadow: '0 0 12px rgba(253,224,71,0.4)' }}>{fmtClock(total)}</span>
        </div>
        <TrainingCTA label="DONE" icon="✓" height={48} depth onClick={onClose} />
      </div>
    </div>,
    document.body,
  );
}

// Standalone Cardio Mode (design 12a). Compact, breathable options with the START
// pinned high; awards normal cardio XP once (via CardioSummary), never the bonus.
export default function CardioMode({ onBack, onFightMode, onSessionState, entry = null, resumeData = null }) {
  // A restored INTERVAL/TABATA/HIIT session. Distance runs have their own live
  // store (data/liveRun.js); the protocol player had nothing, so a Tabata lost
  // to a phone call was simply gone. The stash carries the whole setup, because
  // the player is rebuilt from it and cfg lives in this component.
  const rs = resumeData?.setup || null;
  // A run that is still live (the athlete left the player, the app, or the
  // OS took it) comes straight back into the player. See data/liveRun.js.
  const [liveRestore, setLiveRestore] = useState(() => loadLiveRun());
  const [phase, setPhase] = useState(() => (loadLiveRun() || resumeData?.protocol ? 'player' : 'setup'));
  // A ghost-run challenge (data/ghostChallenges) arrives with the ghost's own
  // distance, unit and surface, so the race is the same run.
  const [categoryId, setCategoryId] = useState(() => {
    const saved = rs?.categoryId ?? (entry?.surface === 'machine' ? 'machine' : 'running');
    return LEGACY_CATEGORIES[saved] || saved;
  });
  const [style, setStyle] = useState(rs?.style ?? 'steady');
  const [intervalMode, setIntervalMode] = useState(rs?.intervalMode ?? 'target'); // 'random' | 'target'
  const [cfgByStyle, setCfgByStyle] = useState(rs?.cfgByStyle ?? CFG_DEFAULTS);
  const [configOpen, setConfigOpen] = useState(false);
  // 3 miles rather than 5 kilometres — the same run, named the way it is named
  // here. A 5 in a miles field would be a much longer session than intended.
  const [goalDistance, setGoalDistance] = useState(rs?.goalDistance ?? (entry?.goal > 0 ? Number(entry.goal) : 3));
  // Miles is the default and the dominant unit — the athletes using this are in
  // the US. Kilometres stay one tap away, not the other way round.
  const [distanceUnit, setDistanceUnit] = useState(rs?.distanceUnit ?? (entry?.unit === 'km' ? 'km' : 'mi'));
  const [customDistance, setCustomDistance] = useState(rs?.customDistance ?? '');
  const [goalTimeSeconds, setGoalTimeSeconds] = useState(rs?.goalTimeSeconds ?? 1200);
  const [customTimeMin, setCustomTimeMin] = useState(rs?.customTimeMin ?? '');
  const [customTargetMin, setCustomTargetMin] = useState(rs?.customTargetMin ?? '');
  // Ghost mode: 'off' | 'last' | 'best'. A hub entry can preselect it.
  const [ghostChoice, setGhostChoice] = useState(() => (entry?.ghost === 'last' || entry?.ghost === 'best') ? entry.ghost : 'off');
  // The chosen equipment, remembered per group: switching to MACHINE and back
  // should not forget that you were on a treadmill.
  const [eqByGroup, setEqByGroup] = useState(rs?.eqByGroup ?? { running: defaultEquipment('running'), machine: defaultEquipment('machine') });
  // Which group's equipment screen is open, or null for the setup screen.
  const [pickerGroup, setPickerGroup] = useState(null);
  // An explicit starting speed for the machines that have one. null means "use
  // whatever holds the target pace", which is right until the athlete says
  // otherwise — so it resets whenever they change equipment.
  const [startSpeed, setStartSpeed] = useState(null);
  // ROUNDS: which format, and the generated session if one has been built.
  const [roundFormat, setRoundFormat] = useState(rs?.roundFormat ?? 'fight');
  const [genSession, setGenSession] = useState(null);
  const [playerResult, setPlayerResult] = useState(null);
  const [helpOpen, setHelpOpen] = useState(false);
  // WALK is a run at a walking pace: same GPS, same map, a slower target.
  const [walkMode, setWalkMode] = useState(!!rs?.walkMode);
  // CUSTOMIZE — the protocol / goal / ghost / interval controls, collapsed.
  const [optionsOpen, setOptionsOpen] = useState(false);
  // A quick-start preset applies its setup, then starts on the next render
  // (startCardio reads the setup from the render it was created in).
  const [pendingStart, setPendingStart] = useState(false);

  const category = METHOD_CATEGORIES.find(c => c.id === categoryId) || METHOD_CATEGORIES[0];
  const hasEquipment = EQUIPMENT_GROUPS.includes(categoryId);
  const equipment = hasEquipment ? equipmentById(eqByGroup[categoryId]) : null;
  const cardioType = equipment ? equipment.cardioType : category.type;
  const method = getMethod(cardioType);
  const methodLabel = walkMode && equipment?.tracking !== 'speed' ? 'Walk' : equipment ? equipment.methodLabel : category.methodLabel;
  const level = getLevel(loadStats().xp);

  // Whether a distance can be shown is now the EQUIPMENT's claim, not the
  // method table's. A rower's console does hold a real distance, but nothing
  // feeds it to us live, so it is timed on screen and its metres are taken at
  // the end — the method table's `supportsDistance: true` would have produced a
  // distance we could not stand behind for the whole session.
  const distanceCapable = equipment ? tracksDistance(equipment) : method.supportsDistance;
  const goalPhase = style === 'steady' || (style === 'intervals' && intervalMode === 'random');
  const useDistanceGauge = distanceCapable && goalPhase;
  const showTimeGoal = !distanceCapable && goalPhase;
  // In ROUNDS the format chips ARE the timings and the session card states
  // the result, so the four steppers only repeated what was already on
  // screen — and they were the tallest block on it. CUSTOM is the one format
  // that exists to set those numbers, so it keeps them.
  const showConfigCard = categoryId === 'rounds'
    ? roundFormat === 'custom'
    : (style === 'tabata' || (style === 'intervals' && intervalMode === 'target'));
  // In ROUNDS the generated session supplies work, rest and rounds; only the
  // warm-up still comes from cfg, so only the warm-up is shown.
  const warmupOnly = categoryId === 'rounds' && !!genSession;
  const usesGps = equipment?.tracking === 'gps' && useDistanceGauge;
  // Indoors, distance comes from the machine's own speed instead of being
  // estimated at the target pace. That was circular: it replayed the goal, so
  // the run always finished exactly on time and the coach had to stay silent.
  const usesMachine = equipment?.tracking === 'speed' && useDistanceGauge;
  const surface = usesMachine ? 'machine' : 'gps';
  // Which rhythm the cadence meter should look for. The bands do not overlap,
  // and looking for the wrong one finds nothing.
  const cadenceKind = equipment?.cadenceKind || 'run';
  // Equipment with a console distance we cannot read live (the rower): timed on
  // screen, real number typed in at the end.
  const consoleUnit = equipment?.tracking === 'console' ? equipment.consoleUnit : null;
  const isRounds = categoryId === 'rounds';
  const activeFormat = formatById(roundFormat);


  const sliderMax = distanceUnit === 'km' ? 10 : 6.5;
  const parsedCustomDist = parseFloat(customDistance);
  const effGoalDistance = Number.isFinite(parsedCustomDist) && parsedCustomDist > 0 ? parsedCustomDist : goalDistance;
  const parsedCustomMin = parseFloat(customTimeMin);
  const effGoalTime = Number.isFinite(parsedCustomMin) && parsedCustomMin > 0 ? Math.round(parsedCustomMin * 60) : goalTimeSeconds;

  const parsedTargetMin = parseFloat(customTargetMin);
  const customTargetSec = Number.isFinite(parsedTargetMin) && parsedTargetMin > 0 ? Math.round(parsedTargetMin * 60) : null;
  // A brisk walk: 15:00 a mile (9:20 a kilometre) unless the athlete typed a target.
  const walkTargetSec = walkMode ? Math.round(effGoalDistance * (distanceUnit === 'km' ? 560 : 900)) : null;
  const autoPace = useDistanceGauge ? computeAutoPace(effGoalDistance, distanceUnit, level, customTargetSec ?? walkTargetSec) : null;
  // The dial opens on whatever speed holds the target pace, so the common case
  // is zero taps — on the setup screen AND during the run.
  const effStartSpeed = usesMachine
    ? clampSpeed(startSpeed ?? defaultSpeed(autoPace?.paceSecPerUnit, distanceUnit), distanceUnit)
    : null;
  // Ghosts are bucketed by surface, so the treadmill ladder and the outdoor
  // ladder are separate. An indoor mile must never overwrite an outdoor best.
  const ghostLast = useDistanceGauge ? getRunGhost(distanceUnit, effGoalDistance, 'last', surface) : null;
  const ghostBest = useDistanceGauge ? getRunGhost(distanceUnit, effGoalDistance, 'best', surface) : null;
  const ghostPick = !(usesGps || usesMachine) ? null : ghostChoice === 'best' ? ghostBest : ghostChoice === 'last' ? ghostLast : null;

  const displayStyleLabel = style === 'steady' ? 'Steady Pace'
    : style === 'intervals' ? (intervalMode === 'random' ? 'Random Intervals' : 'Target Intervals')
      : 'Tabata';

  // Tapping RUNNING or MACHINE opens its equipment screen; the other two select
  // directly, because there is nothing to disambiguate.
  const applyFormat = (fid) => {
    setRoundFormat(fid);
    const f = formatById(fid);
    if (f.cfg) setCfgByStyle(prev => ({ ...prev, intervals: { ...f.cfg } }));
  };

  const selectCategory = (catId) => {
    setCategoryId(catId);
    if (EQUIPMENT_GROUPS.includes(catId)) { setPickerGroup(catId); return; }
    if (catId === 'rounds') {
      setStyle('intervals'); setIntervalMode('target');
      applyFormat(roundFormat);
      return;
    }
    // ALTERNATE and EXERCISE are bodyweight work: there is no distance and no
    // equipment to configure, so the timer IS the session. Landing them on
    // STEADY meant a screen offering a goal the category cannot measure, and
    // one more tap before they saw the only controls that matter.
    if (style === 'steady') { setStyle('intervals'); setIntervalMode('target'); }
  };
  const genOpts = () => ({ level, rng: Math.random });
  const regenerate = () => setGenSession(generateCardioSession({ level, moveCount: 5 }));
  const onSwapMove = (i) => setGenSession(prev => swapMove(prev, i, genOpts()));
  const onMoveUp = (i) => setGenSession(prev => reorderMove(prev, i, 'up'));
  const onMoveDown = (i) => setGenSession(prev => reorderMove(prev, i, 'down'));
  const onRemoveMove = (i) => setGenSession(prev => removeMove(prev, i));

  const chooseEquipment = (eqId) => {
    setEqByGroup(prev => ({ ...prev, [pickerGroup]: eqId }));
    setStartSpeed(null);
    setPickerGroup(null);
  };

  const pickProtocol = (id) => {
    setStyle(id);
    if (id === 'tabata') setConfigOpen(true);
  };
  const pickIntervalMode = (mode) => {
    setIntervalMode(mode);
    if (mode === 'target') setConfigOpen(true);
  };

  const cfg = cfgByStyle[style === 'intervals' ? 'intervals' : style] || CFG_DEFAULTS.intervals;
  const setCfg = (next) => setCfgByStyle(prev => ({ ...prev, [style === 'intervals' ? 'intervals' : style]: next }));

  const buildAddon = () => {
    let addonStyle = 'steady';
    let intervals = null;
    let randomSurges = false;
    if (style === 'intervals') {
      if (intervalMode === 'random') { addonStyle = 'steady'; randomSurges = true; }
      else { addonStyle = 'intervals'; intervals = cfgToIntervals(cfgByStyle.intervals); }
    } else if (style === 'tabata') { addonStyle = 'tabata'; intervals = cfgToIntervals(cfgByStyle.tabata); }

    const dist = useDistanceGauge ? { value: effGoalDistance, unit: distanceUnit } : null;
    return {
      enabled: true,
      sourceMode: 'Cardio Mode',
      placement: 'standalone',
      cardioType,
      cardioLabel: methodLabel,
      targetType: useDistanceGauge ? 'distance' : 'time',
      targetTimeSeconds: effGoalTime,
      targetDistance: dist ? dist.value : null,
      distanceUnit: dist ? dist.unit : 'mi',
      paceTargetSeconds: autoPace ? autoPace.paceSecPerUnit : null,
      paceTargetLabel: autoPace ? autoPace.paceLabel : null,
      targetSeconds: autoPace ? autoPace.totalSec : null,
      eliteSeconds: autoPace ? autoPace.eliteSec : null,
      elitePaceSeconds: autoPace ? autoPace.elitePaceSecPerUnit : null,
      style: addonStyle,
      intervals,
      randomSurges,
      bonusEligible: false,
    };
  };

  const addon = buildAddon();

  // The protocol player reports its clock upward so App.jsx stashes it, and the
  // whole setup rides along because the player cannot be rebuilt without it.
  // Assigning the ref during render is deliberate: it always holds THIS render's
  // values, so the report never stashes a stale setup.
  const setupSnapRef = useRef(null);
  setupSnapRef.current = {
    categoryId, style, intervalMode, cfgByStyle, goalDistance, distanceUnit,
    customDistance, goalTimeSeconds, customTimeMin, customTargetMin, eqByGroup, walkMode,
  };
  const reportProtocol = useCallback((st) => {
    onSessionState?.({ live: true, protocol: st, setup: setupSnapRef.current });
  }, [onSessionState]);

  // START goes straight into the player, which speaks the brief and starts the
  // clock itself. It used to probe getCurrentPosition first with an 8-second
  // timeout — a silent wait on a fresh run, and the player then needed a
  // SECOND start tap. The run player opens the GPS watch immediately (that is
  // what raises the permission prompt) and reports a denial back here.
  const startCardio = () => {
    setPlayerResult(null);
    setLiveRestore(null);
    unlockAudio();
    if (usesGps && (typeof navigator === 'undefined' || !navigator.geolocation)) { setPhase('gps'); return; }
    setPhase('player');
  };

  useEffect(() => {
    if (!pendingStart) return;
    setPendingStart(false);
    startCardio();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingStart]);

  // Leaving the player does NOT end the run. The clock is wall time, the run
  // is in storage; the setup screen shows a RETURN banner until it finishes.
  const leavePlayer = () => { setLiveRestore(loadLiveRun()); setPhase('setup'); };
  useEffect(() => {
    if (phase !== 'setup') return undefined;
    const t = setInterval(() => setLiveRestore(loadLiveRun()), 1000);
    return () => clearInterval(t);
  }, [phase]);

  // ── EQUIPMENT SCREEN ──────────────────────────────────────────────────────
  // Reached by tapping RUNNING or MACHINE. What you are standing on decides how
  // the session can honestly be measured, so each card states its own tracking
  // rather than leaving the athlete to find out mid-run.
  if (pickerGroup) {
    const options = equipmentInGroup(pickerGroup);
    const groupCat = METHOD_CATEGORIES.find(c => c.id === pickerGroup);
    const currentId = eqByGroup[pickerGroup];
    return (
      <PhoneFrame useBrandBg>
        <Embers count={2}/>
        <CornerHUD color="rgba(253,224,71,0.2)" size={18} inset={8}/>
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', minHeight: '100dvh', padding: '12px 16px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <button onClick={() => setPickerGroup(null)} aria-label="Back" style={{ background: 'transparent', border: 'none', padding: 6, color: C.text, display: 'flex', alignItems: 'center' }}>
              <ChevronLeft size={22}/>
            </button>
            <IntroLogo size={26}/>
          </div>

          <div style={{ fontFamily: ARCADE.fontHead, fontSize: 13, fontWeight: 900, color: GOLD, letterSpacing: '0.12em', marginBottom: 3 }}>
            {groupCat?.label || 'EQUIPMENT'}
          </div>
          <div style={{ fontFamily: ARCADE.fontBody, fontSize: 10.5, color: C.muted, marginBottom: 14, lineHeight: 1.35 }}>
            What are you on? Each one is tracked differently.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {options.map(eq => {
              const active = currentId === eq.id;
              return (
                <button key={eq.id} onClick={() => chooseEquipment(eq.id)} style={{
                  textAlign: 'left', padding: '12px 13px', borderRadius: ARCADE.radius.md, cursor: 'pointer',
                  background: active ? 'rgba(253,224,71,0.1)' : 'rgba(14,2,28,0.62)',
                  border: active ? `1.5px solid ${ARCADE.goldBorder}` : `1px solid ${ARCADE.violetBorderSoft}`,
                  boxShadow: active ? '0 0 16px rgba(253,224,71,0.16)' : 'none',
                  display: 'flex', alignItems: 'flex-start', gap: 11,
                }}>
                  <span style={{ fontSize: 20, lineHeight: 1.1, flexShrink: 0 }}>{eq.icon}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ fontFamily: ARCADE.fontHead, fontSize: 11, fontWeight: 900, letterSpacing: '0.06em', color: active ? GOLD : '#e6d4ff' }}>{eq.label}</span>
                      {active && <span style={{ fontFamily: ARCADE.fontHead, fontSize: 7.5, fontWeight: 800, color: GOLD, letterSpacing: '0.1em' }}>SELECTED</span>}
                    </span>
                    <span style={{ display: 'block', fontFamily: ARCADE.fontBody, fontSize: 9.5, color: C.muted, marginTop: 3, lineHeight: 1.35 }}>{eq.blurb}</span>
                    <span style={{
                      display: 'inline-block', marginTop: 6, padding: '3px 8px', borderRadius: 99,
                      background: tracksDistance(eq) ? 'rgba(34,197,94,0.12)' : 'rgba(176,106,255,0.14)',
                      border: `1px solid ${tracksDistance(eq) ? 'rgba(34,197,94,0.4)' : 'rgba(176,106,255,0.4)'}`,
                      fontFamily: ARCADE.fontHead, fontSize: 7.5, fontWeight: 800, letterSpacing: '0.08em',
                      color: tracksDistance(eq) ? '#8fe8ac' : '#d6c2ff',
                    }}>
                      {tracksDistance(eq) ? 'DISTANCE GOAL' : 'TIME GOAL'}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Pinned to the bottom so a two-item list does not leave a hole in
              the middle of the screen. */}
          <div style={{ fontFamily: ARCADE.fontBody, fontSize: 9, color: C.muted, marginTop: 'auto', paddingTop: 18, lineHeight: 1.4 }}>
            Machines without a distance we can trust are timed instead. We would
            rather show you no distance than one we made up.
          </div>
        </div>
      </PhoneFrame>
    );
  }

  if (phase === 'gps') {
    return (
      <PhoneFrame useBrandBg>
        <CornerHUD color="rgba(253,224,71,0.2)" size={18} inset={8}/>
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
          <div style={{ padding: '12px 16px' }}>
            <button onClick={() => setPhase('setup')} aria-label="Back" style={{ background: 'transparent', border: 'none', padding: 6, color: C.text, display: 'flex', alignItems: 'center' }}><ChevronLeft size={22}/></button>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            <EmptyState
              preset="gps"
              onPrimary={startCardio}
              onSecondary={() => { setEqByGroup(prev => ({ ...prev, running: 'treadmill' })); setPhase('setup'); }}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </PhoneFrame>
    );
  }

  if (phase === 'player') {
    const player = cardioAddonToPlayer(addon);
    // A restored run carries its own config; a fresh one takes the setup's.
    const runCfg = liveRestore?.cfg || {
      goal: addon.targetDistance, unit: addon.distanceUnit,
      targetSec: addon.targetSeconds, eliteSec: addon.eliteSeconds,
      targetPaceSec: addon.paceTargetSeconds, elitePaceSec: addon.elitePaceSeconds,
      methodLabel, useGps: usesGps, randomSurges: addon.randomSurges,
      speedSource: usesMachine ? 'machine' : null,
      startSpeed: effStartSpeed,
      cadenceKind,
      ghost: ghostPick,
    };
    const isRun = liveRestore ? true : useDistanceGauge;
    return (
      <PhoneFrame useBrandBg>
        <Embers count={2}/>
        <CornerHUD color="rgba(253,224,71,0.2)" size={18} inset={8}/>
        {/* Item 4 fix: this is the actual active cardio player — the previous
            VoiceMixer placement was on the GPS-permission fallback screen. */}
        <VoiceMixer top={10} right={10}/>
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', minHeight: '100dvh', padding: '12px 16px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <button onClick={leavePlayer} aria-label="Back" style={{ background: 'transparent', border: 'none', padding: 6, color: C.text, display: 'flex', alignItems: 'center' }}>
              <ChevronLeft size={22}/>
            </button>
            <IntroLogo size={26}/>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', paddingTop: 4 }}>
            {isRun ? (
              <RunPlayer
                cfg={runCfg}
                restore={liveRestore}
                autoStart
                onState={onSessionState}
                onGpsDenied={() => { if (!liveRestore) setPhase('gps'); }}
                onComplete={(result) => { onSessionState?.(null); setLiveRestore(null); setPlayerResult(result); setPhase('summary'); }}
              />
            ) : (
            <CardioProtocolPlayer
              autoStart
              format={isRounds && genSession ? ROUNDS_PLAYER_FORMAT : player.format}
              durationSeconds={player.durationSeconds}
              intervalConfig={isRounds && genSession
                ? sessionToIntervalConfig(genSession, cfg.warmupMin)
                : player.intervalConfig}
              headerLabel="CARDIO MODE"
              methodLabel={methodLabel}
              styleLabel={displayStyleLabel}
              cadenceKind={cadenceKind}
              moveNames={isRounds && genSession ? genSession.moves.map(m => m.name) : null}
              distanceLabel={useDistanceGauge ? player.distanceLabel : null}
              distanceMode={useDistanceGauge}
              useGps={usesGps}
              randomSurges={addon.randomSurges}
              distanceTargetLabel={player.distanceLabel}
              paceTargetLabel={addon.paceTargetLabel}
              paceTargetSeconds={addon.paceTargetSeconds}
              goalDistance={addon.targetDistance}
              initialDistanceUnit={addon.distanceUnit}
              deferManualLog={useDistanceGauge}
              onStateChange={reportProtocol}
              initialResumeData={resumeData?.protocol || null}
              onComplete={(result) => { onSessionState?.(null); setPlayerResult(result); setPhase('summary'); }}
            />
            )}
          </div>
        </div>
      </PhoneFrame>
    );
  }

  if (phase === 'summary') {
    const player = cardioAddonToPlayer(addon);
    const fallbackTime = addon.targetType === 'time' && addon.style === 'steady' ? addon.targetTimeSeconds : 0;
    return (
      <PhoneFrame useBrandBg>
        <Embers count={2}/>
        <CornerHUD color="rgba(253,224,71,0.2)" size={18} inset={8}/>
        <div className="no-scrollbar" style={{ position: 'relative', zIndex: 10, minHeight: '100dvh', overflowY: 'auto', padding: '14px 0 40px' }}>
          <CardioSummary
            sourceMode="Cardio Mode"
            method={cardioType}
            methodLabel={methodLabel}
            cardioType={cardioType}
            targetType={addon.targetType}
            targetTimeSeconds={addon.targetType === 'time' ? addon.targetTimeSeconds : null}
            targetDistance={addon.targetType === 'distance' ? player.distanceLabel : null}
            initialTimeSeconds={playerResult?.completedTimeSeconds ?? fallbackTime}
            consoleUnit={consoleUnit}
            initialDistance={typeof playerResult?.completedDistance === 'number' ? playerResult.completedDistance : null}
            initialDistanceUnit={playerResult?.distanceUnit || addon.distanceUnit || 'mi'}
            runResult={playerResult?.splits ? playerResult : null}
            awardXp
            onDone={onBack}
          />
        </div>
      </PhoneFrame>
    );
  }

  // ── SETUP ────────────────────────────────────────────────────────────────
  // The Revamp layout (Cardio.dc.html): banner, four activities, a preview
  // panel (route map for a GPS run, a timer ring for everything else) with
  // the stat row under it, START, and three quick-start presets. Every
  // control the old screen stacked in the open — protocol, goal distance,
  // target pace, ghost, interval setup — is still here, under CUSTOMIZE,
  // collapsed until asked for.
  const act = isRounds ? 'intervals' : categoryId === 'machine' ? 'machine' : walkMode ? 'walk' : 'run';
  const ACTS = [
    { id: 'run', label: 'RUN', icon: <path d="M11 4a2 2 0 1 0 4 0a2 2 0 1 0-4 0M9 21l3-6 3 2v4M6 12l3-4 4 1 3 3 3 1M12 15l-2-4"/> },
    { id: 'walk', label: 'WALK', icon: <path d="M11 4a2 2 0 1 0 4 0a2 2 0 1 0-4 0M10 21l2-7 3 3v4M8 11l3-3 3 2 2 3M12 14l-1-4"/> },
    { id: 'machine', label: 'MACHINE', icon: <path d="M3 18h18M5 18l3-9h7l2 4h2M8 9V5h3M17 13v5"/> },
    { id: 'intervals', label: 'INTERVALS', icon: <path d="M5 20V14M10 20V8M15 20V11M20 20V4"/> },
  ];
  const selectAct = (id) => {
    if (id === 'intervals') { setWalkMode(false); selectCategory('rounds'); return; }
    setWalkMode(id === 'walk');
    setCategoryId(id === 'machine' ? 'machine' : 'running');
    if (id === 'walk') setStyle('steady');
    else if (style === 'intervals' && intervalMode === 'target' && isRounds) setStyle('steady');
  };
  const actLabel = ACTS.find(a => a.id === act)?.label || 'CARDIO';
  const showMap = usesGps;
  const timerTotal = isRounds
    ? (genSession ? intervalTotal(sessionToIntervalConfig(genSession, cfg.warmupMin)) : cfgTargetSeconds(cfg))
    : useDistanceGauge ? (autoPace?.totalSec || effGoalTime) : showConfigCard ? cfgTargetSeconds(cfg) : effGoalTime;
  const optionsSummary = isRounds
    ? `${activeFormat.label}${genSession ? ' · session built' : ''}`
    : `${displayStyleLabel} · ${useDistanceGauge ? `${effGoalDistance} ${distanceUnit}` : `${Math.round(effGoalTime / 60)} min`}${equipment ? ` · ${equipment.label}` : ''}${ghostPick ? ' · 👻 ghost' : ''}`;

  // Quick-start presets: apply the setup, then the effect below starts it.
  const runPreset = (id) => {
    setGenSession(null);
    if (id === 'treadmill') {
      setWalkMode(false); setCategoryId('running');
      setEqByGroup(prev => ({ ...prev, running: 'treadmill' }));
      setStyle('intervals'); setIntervalMode('target');
      setCfgByStyle(prev => ({ ...prev, intervals: { warmupMin: 3, workSec: 60, restSec: 60, rounds: 8, cooldownMin: 0 } }));
    } else if (id === 'outdoor') {
      setWalkMode(false); setCategoryId('running');
      setEqByGroup(prev => ({ ...prev, running: 'gps-run' }));
      setStyle('steady'); setDistanceUnit('mi'); setGoalDistance(3); setCustomDistance('');
    } else {
      setWalkMode(false); setCategoryId('rounds');
      setStyle('intervals'); setIntervalMode('target');
      setRoundFormat('tabata'); applyFormat('tabata');
      setGenSession(generateCardioSession({ level, moveCount: 5 }));
    }
    setPendingStart(true);
  };

  const stat = (label, value, unit) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 8px 8px 10px', minWidth: 0 }}>
      <span style={{ font: `600 9px ${HEAD}`, letterSpacing: '0.16em', textTransform: 'uppercase', color: MUTED }}>{label}</span>
      <span style={{ font: `700 16px ${HEAD}`, color: '#fff', whiteSpace: 'nowrap' }}>{value}{unit && <span style={{ fontSize: 10, color: MUTED }}> {unit}</span>}</span>
    </div>
  );

  return (
    <PhoneFrame useBrandBg>
      <style dangerouslySetInnerHTML={{ __html: fitKitCSS + cardioCSS }}/>
      <Embers count={2}/>
      <SetupPage scroll>
        <SetupHeader title="CARDIO" onBack={onBack} onHelp={() => { setOptionsOpen(true); setHelpOpen(true); }}/>
        <div style={{ flexShrink: 0, padding: '0 16px' }}>
          <ModeTabs active="fit" onFight={onFightMode}/>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 16px 0' }}>
          {liveRestore && (
            <button onClick={() => setPhase('player')} style={{
              width: '100%', textAlign: 'left', cursor: 'pointer', padding: '10px 12px', borderRadius: 12,
              background: 'rgba(34,197,94,0.1)', border: '1.5px solid rgba(34,197,94,0.55)', boxShadow: '0 0 16px rgba(34,197,94,0.18)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e', flexShrink: 0 }}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: `700 10px ${HEAD}`, color: '#8fe8ac', letterSpacing: '0.12em' }}>RUN IN PROGRESS · {liveRestore.pausedAt ? 'PAUSED' : 'CLOCK RUNNING'}</div>
                <div style={{ font: `700 13px ${HEAD}`, color: '#fff', marginTop: 2 }}>
                  {fmtClock(liveRunElapsedSec(liveRestore))} · {((liveRestore.meters || 0) / metersPerUnit(liveRestore.cfg?.unit || 'mi')).toFixed(2)} {liveRestore.cfg?.unit || 'mi'} of {liveRestore.cfg?.goal}
                </div>
              </div>
              <span style={{ font: `700 11px ${HEAD}`, color: GOLD, letterSpacing: '0.1em', flexShrink: 0 }}>RETURN ▶</span>
            </button>
          )}
          <ProgressionNudgeCard lane="cardio"/>

          {/* Banner */}
          <div className="cm-banner" style={{ position: 'relative', flexShrink: 0, height: 108, borderRadius: 10, overflow: 'hidden', background: '#07060C', border: '1px solid rgba(176,140,255,0.6)', boxShadow: '0 0 18px rgba(157,108,255,0.35)' }}>
            <SafeImage src="/static/revamp/cardio-banner.webp" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: '70% 30%' }}/>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(8,6,16,0.92) 0%, rgba(8,6,16,0.7) 45%, rgba(8,6,16,0) 75%)' }}/>
            <div style={{ position: 'absolute', left: 14, top: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, font: `700 22px ${HEAD}`, lineHeight: 1, letterSpacing: '0.06em', color: '#D2BCFF', textShadow: '0 0 14px rgba(157,108,255,0.5)' }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#C4A8FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h4l2-6 4 12 2-6h6"/></svg>CARDIO
              </div>
              <div style={{ font: `600 9.5px ${HEAD}`, lineHeight: 1.45, letterSpacing: '0.12em', color: '#D9D4EC', textTransform: 'uppercase' }}>Build endurance<br/>Burn calories<br/>Improve fight conditioning</div>
            </div>
          </div>

          {/* Activity */}
          <div role="radiogroup" aria-label="Activity" data-guide="cm-method" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
            {ACTS.map(a => {
              const on = act === a.id;
              return (
                <button key={a.id} type="button" role="radio" aria-checked={on ? 'true' : 'false'} className="cm-act" onClick={() => selectAct(a.id)} style={{
                  height: 56, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer',
                  background: on ? 'rgba(157,108,255,0.2)' : '#110E1C', border: on ? '1.5px solid #9D6CFF' : '1px solid rgba(255,255,255,0.09)', borderRadius: 10,
                  color: on ? '#fff' : '#CFC9E4', font: `600 11px ${HEAD}`, letterSpacing: '0.08em', boxShadow: on ? '0 0 14px rgba(157,108,255,0.4)' : 'none', padding: 0,
                }}>
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#C4A8FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{a.icon}</svg>
                  {a.label}
                </button>
              );
            })}
          </div>

          {/* Preview panel + stats */}
          <div style={{ flexShrink: 0, borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(157,108,255,0.45)', background: '#0B0916' }}>
            <div style={{ position: 'relative', height: 140 }}>
              {showMap ? (
                <>
                  <svg viewBox="0 0 358 150" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-hidden="true">
                    <path d="M-10 36 L380 18 M-10 92 L380 74 M-10 140 L380 132 M50 -10 L74 170 M160 -10 L176 170 M280 -10 L272 170" stroke="rgba(255,255,255,.07)" strokeWidth="9" fill="none"/>
                    <path d="M-10 62 L380 48 M110 -10 L124 170 M220 -10 L228 170" stroke="rgba(255,255,255,.04)" strokeWidth="4" fill="none"/>
                    <path d="M92 104 C 104 70, 130 50, 168 46 C 200 42, 214 30, 240 36 C 262 42, 268 70, 256 92 C 244 112, 200 118, 170 112 C 140 106, 118 118, 92 104" fill="none" stroke="#B794FF" strokeWidth="4" strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 6px rgba(157,108,255,.9))' }}/>
                    <circle cx="92" cy="104" r="9" fill="rgba(61,123,255,.3)"/>
                    <circle cx="92" cy="104" r="5" fill="#3D7BFF" stroke="#FFFFFF" strokeWidth="2"/>
                  </svg>
                  <div style={{ position: 'absolute', left: 10, top: 10, display: 'flex', alignItems: 'center', gap: 6, height: 28, padding: '0 10px', borderRadius: 8, background: 'rgba(7,6,12,0.85)', border: '1px solid rgba(255,255,255,0.14)' }}>
                    <span style={{ font: `700 12px ${HEAD}`, letterSpacing: '0.08em', color: '#fff' }}>GPS</span>
                    <svg viewBox="0 0 14 10" width="14" height="10" aria-hidden="true"><path d="M1 9V7M5 9V5M9 9V3M13 9V1" stroke="#4ADE80" strokeWidth="2" strokeLinecap="round"/></svg>
                  </div>
                  {ghostPick && (
                    <div style={{ position: 'absolute', right: 10, top: 10, height: 28, display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px 0 6px', borderRadius: 14, background: 'rgba(157,108,255,0.22)', border: '1px solid rgba(196,168,255,0.6)', color: '#D2BCFF', font: `700 10px ${HEAD}`, letterSpacing: '0.14em', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: 15, lineHeight: 1 }}>👻</span>GHOST RUN · {fmtRunClock(ghostPick.totalSec)}
                    </div>
                  )}
                  <div style={{ position: 'absolute', right: 10, bottom: 8, font: `600 9px ${HEAD}`, letterSpacing: '0.16em', color: '#7D7799' }}>{autoPace ? `TARGET ${autoPace.paceLabel}` : 'ROUTE MAP'}</div>
                </>
              ) : (
                <>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, background: 'radial-gradient(60% 80% at 50% 50%, rgba(107,61,240,.22), rgba(11,9,22,0) 70%)' }}>
                    <div style={{ position: 'relative', width: 116, height: 116, flexShrink: 0 }}>
                      <svg viewBox="0 0 124 124" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: 'rotate(-90deg)' }} aria-hidden="true">
                        <circle cx="62" cy="62" r="54" fill="none" stroke="rgba(157,108,255,.18)" strokeWidth="8"/>
                        <circle cx="62" cy="62" r="54" fill="none" stroke="#B794FF" strokeWidth="8" strokeLinecap="round" strokeDasharray="339.3" strokeDashoffset="0" style={{ filter: 'drop-shadow(0 0 6px rgba(157,108,255,.9))' }}/>
                        <circle cx="62" cy="62" r="44" fill="none" stroke="rgba(242,190,69,.55)" strokeWidth="1.5" strokeDasharray="2 6"/>
                      </svg>
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                        <span style={{ font: `700 26px ${HEAD}`, lineHeight: 1, color: '#fff' }}>{fmtClock(timerTotal)}</span>
                        <span style={{ font: `600 9px ${HEAD}`, letterSpacing: '0.16em', color: '#C4A8FF' }}>{isRounds ? (genSession ? 'SESSION' : 'ROUNDS') : 'COUNTDOWN'}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                      <span style={{ font: `600 9px ${HEAD}`, letterSpacing: '0.16em', color: GOLD }}>{actLabel} · TIMER</span>
                      <span style={{ font: `700 14px ${HEAD}`, lineHeight: 1.2, color: '#fff', maxWidth: 150 }}>
                        {isRounds
                          ? (genSession ? `${genSession.moves.length} moves · ${activeFormat.label}` : `${activeFormat.label}`)
                          : `${equipment?.label || 'Machine'} · ${useDistanceGauge ? `${effGoalDistance} ${distanceUnit}` : `${Math.round(effGoalTime / 60)} min`}`}
                      </span>
                      <span style={{ font: `500 12px ${BODY}`, color: MUTED, maxWidth: 150, lineHeight: 1.3 }}>
                        {isRounds ? 'The coach calls every switch.' : 'No GPS needed. Log the console at the end.'}
                      </span>
                    </div>
                  </div>
                  <div style={{ position: 'absolute', left: 10, top: 10, height: 28, padding: '0 10px', display: 'flex', alignItems: 'center', borderRadius: 8, background: 'rgba(7,6,12,0.85)', border: '1px solid rgba(255,255,255,0.14)', font: `700 12px ${HEAD}`, letterSpacing: '0.08em', color: '#fff' }}>TIMER</div>
                </>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              {stat('Time', '00:00')}
              {stat('Distance', '0.00', distanceUnit)}
              {showMap || usesMachine ? stat('Pace', '--:--', `/${distanceUnit}`) : stat('Heart rate', '--', 'bpm')}
              {stat('Calories', '0')}
            </div>
          </div>

          <div data-guide="cm-start">
            <GoldButton label={`START ${actLabel}`} icon="play" onClick={startCardio} height={50} style={{ fontSize: 19, letterSpacing: '0.2em' }}/>
          </div>

          {/* CUSTOMIZE — everything the old screen kept in the open. */}
          <button type="button" className="cm-opt" data-guide="cm-options" aria-expanded={optionsOpen ? 'true' : 'false'} onClick={() => setOptionsOpen(o => !o)} style={{
            minHeight: 46, display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', borderRadius: 10, cursor: 'pointer', textAlign: 'left', width: '100%',
            background: '#0F0C1C', border: `1px solid ${optionsOpen ? 'rgba(157,108,255,0.55)' : 'rgba(255,255,255,0.1)'}`, color: '#fff',
          }}>
            <span style={{ font: `700 12px ${HEAD}`, letterSpacing: '0.14em', flexShrink: 0 }}>CUSTOMIZE</span>
            <span style={{ flex: 1, minWidth: 0, font: `500 12px ${BODY}`, color: MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{optionsSummary}</span>
            <span style={{ font: `700 12px ${HEAD}`, color: '#C4A8FF', transform: optionsOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>⌄</span>
          </button>

          {optionsOpen && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {/* Where you are: Outdoor GPS or a treadmill for a run, which
                  machine for MACHINE. Opens the equipment screen. */}
              {hasEquipment && (
                <button type="button" className="cm-opt" onClick={() => setPickerGroup(categoryId)} style={{
                  minHeight: 44, display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', marginBottom: 8, borderRadius: 10, cursor: 'pointer', textAlign: 'left', width: '100%',
                  background: '#110E1C', border: '1px solid rgba(255,255,255,0.09)', color: '#fff',
                }}>
                  <span style={{ font: `600 11px ${HEAD}`, letterSpacing: '0.16em', color: MUTED, width: 92, flexShrink: 0 }}>{categoryId === 'machine' ? 'MACHINE' : 'WHERE'}</span>
                  <span style={{ flex: 1, font: `600 15px ${BODY}` }}>{equipment?.icon} {equipment?.label}</span>
                  <span style={{ font: `700 14px ${HEAD}`, color: '#7D7799' }}>›</span>
                </button>
              )}
          {/* WHAT THIS EQUIPMENT GIVES YOU. The setup screen now changes with
              the equipment rather than looking identical for a park and a belt:
              an outdoor run advertises the route map, a treadmill and a bike get
              the speed control up front so the run needs no taps, and the timed
              machines say plainly that there will be no distance. */}
          {equipment && (
            <div style={{
              borderRadius: ARCADE.radius.md, border: `1px solid ${ARCADE.violetBorderSoft}`,
              background: 'rgba(10,2,22,0.7)', padding: '8px 10px', marginBottom: 8,
            }}>
              {equipment.tracking === 'speed' ? (
                <>
                  <div style={{ ...sectionLabel, marginBottom: 7 }}>
                    STARTING {speedUnitLabel(distanceUnit)}
                  </div>
                  <SpeedDial speed={effStartSpeed} unit={distanceUnit} onChange={setStartSpeed} compact />
                  <div style={{ fontFamily: ARCADE.fontBody, fontSize: 9, color: C.muted, marginTop: 5, lineHeight: 1.3 }}>
                    Match the {equipment.id === 'treadmill' ? 'belt' : 'console'}. Distance is tracked from it, and you can change it mid-run.
                  </div>
                </>
              ) : (
                <>
                  <div style={{ ...sectionLabel, marginBottom: 6 }}>
                    {equipment.tracking === 'gps' ? 'THIS RUN GIVES YOU' : 'THIS SESSION GIVES YOU'}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {(equipment.tracking === 'gps'
                      ? ['GPS DISTANCE', 'ROUTE MAP', 'PACE COACH', 'GHOST RACE']
                      : equipment.tracking === 'console'
                        ? ['TIMED GOAL', 'STROKE RATE', 'CALORIES', 'METRES AT THE END']
                        : ['TIMED GOAL', equipment.cadenceKind === 'stairs' ? 'STEP RATE' : 'CADENCE', 'CALORIES']
                    ).map(chip => (
                      <span key={chip} style={{
                        padding: '3px 8px', borderRadius: 99,
                        background: 'rgba(176,106,255,0.12)', border: '1px solid rgba(176,106,255,0.32)',
                        fontFamily: ARCADE.fontHead, fontSize: 7.5, fontWeight: 800,
                        letterSpacing: '0.08em', color: '#d6c2ff',
                      }}>{chip}</span>
                    ))}
                  </div>
                  {!tracksDistance(equipment) && (
                    <div style={{ fontFamily: ARCADE.fontBody, fontSize: 9, color: C.muted, marginTop: 7, lineHeight: 1.35 }}>
                      No distance on this one — its console does not give us a number we
                      would stand behind, so the goal is time.
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ROUNDS — format, then what that format actually means, then the
              generated session. The chips carry only their names so all four
              fit one line; the timings are in the note below, where there is
              room to explain the difference rather than just state it. */}
          {isRounds && (
            <>
              <div style={sectionLabel}>FORMAT</div>
              <div style={{ display: 'flex', gap: 5, marginBottom: 5 }}>
                {ROUND_FORMATS.map(f => (
                  <button key={f.id} onClick={() => applyFormat(f.id)} style={{
                    flex: 1, padding: '6px 4px', borderRadius: ARCADE.radius.sm, cursor: 'pointer',
                    fontFamily: ARCADE.fontHead, fontWeight: 800, fontSize: 8.5, letterSpacing: '0.03em',
                    background: roundFormat === f.id ? 'rgba(253,224,71,0.12)' : 'rgba(14,2,28,0.6)',
                    border: roundFormat === f.id ? `1.5px solid ${ARCADE.goldBorder}` : `1px solid ${ARCADE.violetBorderSoft}`,
                    color: roundFormat === f.id ? GOLD : C.muted, whiteSpace: 'nowrap',
                  }}>{f.label}</button>
                ))}
              </div>
              {roundFormat !== 'custom' && (
              <div style={{
                borderRadius: ARCADE.radius.sm, border: '1px solid rgba(34,197,94,0.28)',
                background: 'rgba(34,197,94,0.07)', padding: '6px 10px', marginBottom: 6,
                fontFamily: ARCADE.fontBody, fontSize: 9.5, color: '#c9f5d6', lineHeight: 1.35,
              }}>
                {activeFormat.blurb}
              </div>
              )}

              {genSession ? (
                <CardioSessionCard
                  session={genSession}
                  level={level}
                  onSwap={onSwapMove}
                  onMoveUp={onMoveUp}
                  onMoveDown={onMoveDown}
                  onRemove={onRemoveMove}
                  onRegenerate={regenerate}
                  canSwapAt={(i) => canSwap(genSession, i, { level })}
                />
              ) : (
                <button onClick={regenerate} style={{
                  width: '100%', padding: '10px 12px', borderRadius: ARCADE.radius.md, cursor: 'pointer',
                  textAlign: 'left', marginBottom: 12,
                  background: 'linear-gradient(180deg, rgba(88,28,135,0.3), rgba(16,4,30,0.8))',
                  border: '1px solid rgba(176,106,255,0.5)',
                }}>
                  <div style={{ fontFamily: ARCADE.fontHead, fontSize: 10, fontWeight: 900, color: '#e6d4ff', letterSpacing: '0.06em' }}>
                    ⟳ BUILD ME A SESSION
                  </div>
                  <div style={{ fontFamily: ARCADE.fontBody, fontSize: 9.5, color: C.muted, marginTop: 3, lineHeight: 1.35 }}>
                    Five movements for your level, and the coach calls each one as it lands.
                    Reorder or swap any of them, or just run the clock without one.
                  </div>
                </button>
              )}
            </>
          )}

          <div data-guide="cm-protocol" style={{ display: isRounds ? 'none' : 'block' }}>
          <div style={sectionLabel}>PROTOCOL</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: style === 'intervals' ? 8 : 14 }}>
            {PROTOCOLS.map(p => (
              <button key={p.id} onClick={() => pickProtocol(p.id)} style={{
                padding: '6px 13px', borderRadius: ARCADE.radius.sm, cursor: 'pointer',
                fontFamily: ARCADE.fontHead, fontWeight: 700, fontSize: 9.5, letterSpacing: '0.05em',
                background: style === p.id ? 'rgba(253,224,71,0.12)' : 'rgba(14,2,28,0.6)',
                border: style === p.id ? `1.5px solid ${ARCADE.goldBorder}` : `1px solid ${ARCADE.violetBorderSoft}`,
                color: style === p.id ? GOLD : C.muted,
              }}>{p.label}</button>
            ))}
          </div>

          {/* Intervals sub-choice: Random vs Target */}
          {style === 'intervals' && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {[
                { id: 'random', label: 'RANDOM', sub: 'Surprise pace surges' },
                { id: 'target', label: 'TARGET', sub: 'Set work / rest / rounds' },
              ].map(m => {
                const active = intervalMode === m.id;
                return (
                  <button key={m.id} onClick={() => pickIntervalMode(m.id)} style={{
                    flex: 1, textAlign: 'left', padding: '8px 11px', borderRadius: ARCADE.radius.md, cursor: 'pointer',
                    background: active ? 'rgba(176,106,255,0.14)' : 'rgba(8,2,18,0.55)',
                    border: active ? '1.5px solid rgba(176,106,255,0.7)' : `1px solid ${ARCADE.violetBorderSoft}`,
                  }}>
                    <div style={{ fontFamily: ARCADE.fontHead, fontWeight: 700, fontSize: 10, letterSpacing: '0.05em', color: active ? '#e6d4ff' : '#c4b5fd' }}>{m.label}</div>
                    <div style={{ fontFamily: ARCADE.fontBody, fontSize: 9, color: C.muted, marginTop: 1 }}>{m.sub}</div>
                  </button>
                );
              })}
            </div>
          )}

          </div>

          {/* GOAL — distance slider (design 12a) */}
          {useDistanceGauge && (
            <>
              <div data-guide="cm-goal">
              <div style={sectionLabel}>GOAL DISTANCE</div>
              <div style={{ borderRadius: 11, border: `1px solid ${ARCADE.violetBorderSoft}`, background: 'rgba(8,2,18,0.5)', padding: '8px 12px 9px', marginBottom: 9 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
                  <div style={{ fontFamily: ARCADE.fontHead, fontWeight: 900, fontSize: 19, color: '#fff', flexShrink: 0 }}>
                    {customDistance ? parsedCustomDist : goalDistance}<span style={{ fontSize: 11, color: GOLD, marginLeft: 3 }}>{distanceUnit}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ display: 'flex', gap: 3 }}>
                      {['mi', 'km'].map(u => (
                        <button key={u} onClick={() => { setDistanceUnit(u); setGoalDistance(u === 'km' ? 5 : 3); setCustomDistance(''); }} style={{
                          padding: '3px 10px', borderRadius: 7, cursor: 'pointer',
                          background: distanceUnit === u ? 'rgba(253,224,71,0.12)' : 'rgba(6,0,16,0.7)',
                          border: distanceUnit === u ? `1.5px solid ${ARCADE.goldBorder}` : `1px solid ${ARCADE.violetBorderSoft}`,
                          color: distanceUnit === u ? GOLD : C.muted, fontFamily: ARCADE.fontHead, fontSize: 9, fontWeight: 700,
                        }}>{u.toUpperCase()}</button>
                      ))}
                    </div>
                    <input
                      type="number" inputMode="decimal" min="0" step="0.1" placeholder={`+${distanceUnit}`}
                      value={customDistance} onChange={e => setCustomDistance(e.target.value)}
                      style={{ width: 60, padding: '4px 8px', borderRadius: 7, background: 'rgba(6,0,16,0.7)', border: `1px solid ${ARCADE.violetBorderSoft}`, color: C.text, fontFamily: ARCADE.fontBody, fontSize: 11, fontWeight: 600, outline: 'none' }}
                    />
                  </div>
                </div>
                <input
                  type="range" min={distanceUnit === 'km' ? 1 : 0.5} max={sliderMax} step={distanceUnit === 'km' ? 0.5 : 0.25}
                  value={Math.min(goalDistance, sliderMax)}
                  onChange={e => { setGoalDistance(parseFloat(e.target.value)); setCustomDistance(''); }}
                  style={{ width: '100%', accentColor: GOLD, cursor: 'pointer', display: 'block' }}
                />
              </div>

              {autoPace && (
                <div style={{ borderRadius: 10, border: '1px solid rgba(176,106,255,0.35)', background: 'rgba(176,106,255,0.06)', padding: '8px 12px', marginBottom: 9 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: ARCADE.fontHead, fontWeight: 700, fontSize: 8, color: VIOLET, letterSpacing: '0.1em', flexShrink: 0 }}>TARGET</span>
                    <span style={{ fontFamily: ARCADE.fontHead, fontWeight: 900, fontSize: 13, color: '#fff' }}>{autoPace.timeLabel}</span>
                    <span style={{ fontFamily: ARCADE.fontHead, fontWeight: 700, fontSize: 10, color: '#c4b5fd' }}>{autoPace.paceLabel}</span>
                    <input
                      type="number" inputMode="numeric" min="1" step="1" placeholder="min"
                      value={customTargetMin} onChange={e => setCustomTargetMin(e.target.value)}
                      aria-label="Target time in minutes"
                      style={{ width: 52, marginLeft: 'auto', padding: '3px 6px', borderRadius: 7, background: 'rgba(6,0,16,0.7)', border: `1px solid ${ARCADE.violetBorderSoft}`, color: C.text, fontFamily: ARCADE.fontBody, fontSize: 11, fontWeight: 600, outline: 'none' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                    <span style={{ fontFamily: ARCADE.fontHead, fontWeight: 700, fontSize: 8, color: GOLD, letterSpacing: '0.1em', flexShrink: 0 }}>ELITE</span>
                    <span style={{ fontFamily: ARCADE.fontHead, fontWeight: 900, fontSize: 13, color: GOLD, textShadow: '0 0 10px rgba(253,224,71,0.4)' }}>{autoPace.eliteLabel}</span>
                    <span style={{ fontFamily: ARCADE.fontBody, fontSize: 9, color: C.muted, marginLeft: 'auto' }}>{customTargetSec ? 'your target' : `auto · Lvl ${level}`}</span>
                  </div>
                </div>
              )}

              {/* GHOST MODE — race your own recorded run over this distance. A
                  selector, not a code: pick it here or from the hub. Available
                  indoors too now that a machine run is measured rather than
                  estimated, but against INDOOR ghosts only — see runGhosts.js. */}
              {(usesGps || usesMachine) && (
                <div data-guide="cm-ghost" style={{ borderRadius: 10, border: `1px solid ${ghostPick ? 'rgba(176,106,255,0.65)' : 'rgba(168,85,247,0.28)'}`, background: ghostPick ? 'linear-gradient(90deg,rgba(88,28,135,0.35),rgba(16,4,30,0.85))' : 'rgba(16,4,30,0.8)', padding: '8px 12px', marginBottom: 9 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {ghostPick ? (
                      <SafeImage src={ghostArt(ghostPick)} alt="" style={{ width: 40, height: 40, borderRadius: 9, objectFit: 'cover', objectPosition: 'center 20%', flexShrink: 0 }}/>
                    ) : (
                      <div style={{ width: 40, height: 40, borderRadius: 9, background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>👻</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: ARCADE.fontHead, fontWeight: 900, fontSize: 10, color: ghostPick ? '#e6d4ff' : '#c4b5fd', letterSpacing: '0.1em' }}>
                        {ghostPick ? `GHOST MODE · VS ${ghostPick.ownerId === 'me' ? `YOUR ${ghostChoice === 'best' ? 'BEST' : 'LAST'} RUN` : ghostPick.ownerName} · ${fmtRunClock(ghostPick.totalSec)}` : `GHOST MODE · ${usesMachine ? 'INDOOR' : 'OUTDOOR'}`}
                      </div>
                      <div style={{ fontFamily: ARCADE.fontBody, fontSize: 9.5, color: C.muted, marginTop: 2, lineHeight: 1.3 }}>
                        {ghostPick
                          ? `Race the replay. The coach calls who leads. ${usesMachine ? 'Indoor runs race indoor ghosts.' : ''}`
                          : (ghostLast || ghostBest)
                            ? `Beat your last ${usesMachine ? 'indoor' : 'outdoor'} run or your best at this distance.`
                            : `Finish ${usesMachine ? 'a machine' : 'a GPS'} run at ${effGoalDistance} ${distanceUnit} to create your ${usesMachine ? 'indoor' : 'outdoor'} ghost.`}
                      </div>
                    </div>
                  </div>
                  {(ghostLast || ghostBest) && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      {[
                        { id: 'off', label: 'OFF' },
                        ghostLast ? { id: 'last', label: `MY LAST · ${fmtRunClock(ghostLast.totalSec)}` } : null,
                        ghostBest ? { id: 'best', label: `MY BEST · ${fmtRunClock(ghostBest.totalSec)}` } : null,
                      ].filter(Boolean).map(o => (
                        <button key={o.id} onClick={() => setGhostChoice(o.id)} style={{
                          flex: o.id === 'off' ? '0 0 auto' : 1, padding: '6px 10px', borderRadius: 8, cursor: 'pointer',
                          fontFamily: ARCADE.fontHead, fontWeight: 800, fontSize: 8.5, letterSpacing: '0.06em', whiteSpace: 'nowrap',
                          background: ghostChoice === o.id ? 'rgba(176,106,255,0.18)' : 'rgba(8,2,18,0.55)',
                          border: ghostChoice === o.id ? '1.5px solid rgba(176,106,255,0.75)' : `1px solid ${ARCADE.violetBorderSoft}`,
                          color: ghostChoice === o.id ? '#e6d4ff' : C.muted,
                        }}>{o.label}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              </div>
            </>
          )}

          {/* GOAL — time slider for non-distance methods */}
          {showTimeGoal && (
            <>
              <div style={sectionLabel}>TARGET TIME</div>
              <div style={{ borderRadius: 11, border: `1px solid ${ARCADE.violetBorderSoft}`, background: 'rgba(8,2,18,0.5)', padding: '8px 12px 9px', marginBottom: 9 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
                  <div style={{ fontFamily: ARCADE.fontHead, fontWeight: 900, fontSize: 19, color: '#fff' }}>
                    {Math.round(effGoalTime / 60)}<span style={{ fontSize: 11, color: GOLD, marginLeft: 3 }}>min</span>
                  </div>
                  <input
                    type="number" inputMode="numeric" min="0" step="1" placeholder="+min"
                    value={customTimeMin} onChange={e => setCustomTimeMin(e.target.value)}
                    style={{ width: 64, padding: '4px 8px', borderRadius: 7, background: 'rgba(6,0,16,0.7)', border: `1px solid ${ARCADE.violetBorderSoft}`, color: C.text, fontFamily: ARCADE.fontBody, fontSize: 11, fontWeight: 600, outline: 'none' }}
                  />
                </div>
                <input
                  type="range" min={5} max={60} step={5}
                  value={Math.min(Math.round(goalTimeSeconds / 60), 60)}
                  onChange={e => { setGoalTimeSeconds(parseInt(e.target.value, 10) * 60); setCustomTimeMin(''); }}
                  style={{ width: '100%', accentColor: GOLD, cursor: 'pointer', display: 'block' }}
                />
              </div>
            </>
          )}

          {/* Interval / Tabata config summary card */}
          {showConfigCard && (
            <>
              {!isRounds && <div style={sectionLabel}>INTERVAL SETUP</div>}
              <div style={{ borderRadius: 12, border: '1px solid rgba(176,106,255,0.4)', background: 'rgba(176,106,255,0.06)', padding: '8px 11px', marginBottom: 6 }}>
                {/* The total used to sit in its own bordered row underneath,
                    which cost 33px to say one number. It reads better up here
                    beside the label it is the total OF. */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: warmupOnly ? 0 : 6 }}>
                  <div style={{ fontFamily: ARCADE.fontHead, fontWeight: 700, fontSize: 10, color: '#e6d4ff', letterSpacing: '0.04em', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{warmupOnly ? 'WARM-UP' : displayStyleLabel}</div>
                  {/* One field does not need a row of its own. Inlined here the
                      whole card is a single line instead of three, which is the
                      last of what a 375x667 phone needed. */}
                  {warmupOnly && (
                    <div style={{ flexShrink: 0 }}>
                      <IntervalQuickSet cfg={cfg} onChange={setCfg} only={['warmupMin']} inline />
                    </div>
                  )}
                  <span style={{ fontFamily: ARCADE.fontHead, fontWeight: 900, fontSize: 15, color: GOLD, marginLeft: 'auto' }}>{fmtClock(cfgTargetSeconds(cfg))}</span>
                  <button onClick={() => setConfigOpen(true)} style={{
                    padding: '3px 10px', borderRadius: 8, cursor: 'pointer', background: 'rgba(253,224,71,0.12)',
                    border: `1px solid ${ARCADE.goldBorder}`, color: GOLD, fontFamily: ARCADE.fontHead, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.08em', flexShrink: 0,
                  }}>EDIT</button>
                </div>
                {/* Editable in place. These four numbers ARE the workout for a
                    bodyweight session, and they used to live behind the EDIT
                    button in a modal. */}
                {!warmupOnly && <IntervalQuickSet cfg={cfg} onChange={setCfg} />}
              </div>
            </>
          )}

          {/* Random-intervals note */}
          {style === 'intervals' && intervalMode === 'random' && (
            <div style={{ fontFamily: ARCADE.fontBody, fontSize: 10.5, color: C.muted, marginBottom: 8, lineHeight: 1.4 }}>
              We&apos;ll throw in surprise pace surges a few times — hold each surge until the coach calls it off.
            </div>
          )}
            </div>
          )}

          {/* Quick start presets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 4 }}>
            <span style={{ font: `600 10px ${HEAD}`, letterSpacing: '0.16em', textTransform: 'uppercase', color: MUTED }}>Quick start presets</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
              {[
                { id: 'treadmill', title: 'TREADMILL INTERVALS', sub: '20 min · 8 × 1:00', img: '/static/fitmode/cardio-mode-banner.webp', pos: '12% 50%', border: 'rgba(157,108,255,0.45)' },
                { id: 'outdoor', title: 'OUTDOOR RUN', sub: '3 mi · GPS', img: '/static/revamp/cardio-banner.webp', pos: '78% 40%', border: 'rgba(61,123,255,0.5)' },
                { id: 'blast', title: 'CARDIO BLAST', sub: 'Tabata · 5 moves', img: '/static/revamp/cardio-blast.webp', pos: '100% 0%', border: 'rgba(242,190,69,0.55)' },
              ].map(p => (
                <button key={p.id} type="button" className="cm-preset" onClick={() => runPreset(p.id)} style={{ position: 'relative', height: 76, borderRadius: 10, overflow: 'hidden', border: `1px solid ${p.border}`, background: '#0B0916', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
                  <SafeImage src={p.img} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: p.pos }}/>
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(8,6,16,.1) 0%, rgba(8,6,16,.92) 70%)' }}/>
                  <div style={{ position: 'absolute', left: 8, right: 6, bottom: 7, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <span style={{ font: `700 11px ${HEAD}`, lineHeight: 1.1, color: '#fff' }}>{p.title}</span>
                    <span style={{ font: `500 10px ${BODY}`, color: MUTED }}>{p.sub}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </SetupPage>
      {configOpen && (
        <ConfigModal styleId={style} cfg={cfg} onChange={setCfg} onClose={() => setConfigOpen(false)}/>
      )}
      {helpOpen && <ScreenGuide steps={SCREEN_GUIDES.cardio_mode} onClose={() => setHelpOpen(false)}/>}
    </PhoneFrame>
  );
}

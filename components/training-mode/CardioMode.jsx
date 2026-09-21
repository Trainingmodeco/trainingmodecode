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
import { equipmentById, equipmentInGroup, defaultEquipment, tracksDistance, trackingLabel } from './data/cardioEquipment';
import { defaultSpeed, clampSpeed, speedUnitLabel } from './data/machineSpeed';
import SpeedDial from './shared/SpeedDial';
import IntervalQuickSet from './shared/IntervalQuickSet';
import CardioSessionCard from './shared/CardioSessionCard';
import { generateCardioSession, swapMove, reorderMove, removeMove, sessionToIntervalConfig, canSwap } from './data/cardioGenerator';
import { HelpButton } from './shared/WorkoutHelpPanel';
import ProgressionNudgeCard from './shared/ProgressionNudgeCard';
import ScreenGuide from './shared/ScreenGuide';
import { SCREEN_GUIDES } from './shared/screenGuides';
import TrainingCTA from './shared/TrainingCTA';
import { loadStats, getLevel } from './data/userStats';

const GOLD = C.yellow;
const VIOLET = '#b06aff';

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
    blurb: 'Three minutes on, one minute off, twelve rounds — a championship fight. Long rounds, real recovery. Builds the gas tank to last.',
  },
  {
    id: 'tabata', label: 'TABATA',
    cfg: { warmupMin: 0, workSec: 20, restSec: 10, rounds: 8, cooldownMin: 0 },
    blurb: 'Twenty seconds flat out, ten seconds off, eight times. Four minutes total. Brutally short — go as hard as you can hold.',
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
export default function CardioMode({ onBack, onSessionState, entry = null, resumeData = null }) {
  // A restored INTERVAL/TABATA/HIIT session. Distance runs have their own live
  // store (data/liveRun.js); the protocol player had nothing, so a Tabata lost
  // to a phone call was simply gone. The stash carries the whole setup, because
  // the player is rebuilt from it and cfg lives in this component.
  const rs = resumeData?.setup || null;
  // A run that is still live (the athlete left the player, the app, or the
  // OS took it) comes straight back into the player. See data/liveRun.js.
  const [liveRestore, setLiveRestore] = useState(() => loadLiveRun());
  const [phase, setPhase] = useState(() => (loadLiveRun() || resumeData?.protocol ? 'player' : 'setup'));
  const [categoryId, setCategoryId] = useState(() => {
    const saved = rs?.categoryId ?? 'running';
    return LEGACY_CATEGORIES[saved] || saved;
  });
  const [style, setStyle] = useState(rs?.style ?? 'steady');
  const [intervalMode, setIntervalMode] = useState(rs?.intervalMode ?? 'target'); // 'random' | 'target'
  const [cfgByStyle, setCfgByStyle] = useState(rs?.cfgByStyle ?? CFG_DEFAULTS);
  const [configOpen, setConfigOpen] = useState(false);
  // 3 miles rather than 5 kilometres — the same run, named the way it is named
  // here. A 5 in a miles field would be a much longer session than intended.
  const [goalDistance, setGoalDistance] = useState(rs?.goalDistance ?? 3);
  // Miles is the default and the dominant unit — the athletes using this are in
  // the US. Kilometres stay one tap away, not the other way round.
  const [distanceUnit, setDistanceUnit] = useState(rs?.distanceUnit ?? 'mi');
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

  const category = METHOD_CATEGORIES.find(c => c.id === categoryId) || METHOD_CATEGORIES[0];
  const hasEquipment = EQUIPMENT_GROUPS.includes(categoryId);
  const equipment = hasEquipment ? equipmentById(eqByGroup[categoryId]) : null;
  const cardioType = equipment ? equipment.cardioType : category.type;
  const method = getMethod(cardioType);
  const methodLabel = equipment ? equipment.methodLabel : category.methodLabel;
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
  const autoPace = useDistanceGauge ? computeAutoPace(effGoalDistance, distanceUnit, level, customTargetSec) : null;
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
    customDistance, goalTimeSeconds, customTimeMin, customTargetMin, eqByGroup,
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

  return (
    <PhoneFrame useBrandBg>
      <Embers count={2}/>
      <CornerHUD color="rgba(253,224,71,0.25)" size={20} inset={10}/>
      <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', height: '100dvh', padding: '12px 16px calc(78px + env(safe-area-inset-bottom, 0px))' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={onBack} aria-label="Back" style={{ background: 'transparent', border: 'none', padding: 6, color: C.text, display: 'flex', alignItems: 'center' }}>
              <ChevronLeft size={22}/>
            </button>
            <IntroLogo size={26}/>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* START lives in the header now. The old footer button plus the
                9vh of air beneath it cost 127px of a 494px options window,
                which is most of the reason the screen had to scroll. Up here
                it is on screen whatever the options are doing, and never
                needs scrolling to reach. */}
            <div data-guide="cm-start">
              <button onClick={startCardio} style={{
                padding: '7px 15px', borderRadius: 999, cursor: 'pointer',
                background: 'linear-gradient(180deg,#fde047,#f0a92a)', border: 'none',
                color: '#1a0b02', fontFamily: ARCADE.fontHead, fontWeight: 900,
                fontSize: 10.5, letterSpacing: '0.1em', whiteSpace: 'nowrap',
                boxShadow: '0 0 14px rgba(253,224,71,0.45)',
              }}>▶ START</button>
            </div>
            <HelpButton onClick={() => setHelpOpen(true)}/>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 7, flexShrink: 0 }}>
          <h1 style={{
            fontFamily: ARCADE.fontHead, fontWeight: 900, color: GOLD, fontSize: 15,
            letterSpacing: '0.12em', textShadow: '0 0 14px rgba(253,224,71,0.4)',
          }}>CARDIO MODE</h1>
        </div>

        {/* Options — top-aligned; this region fills, so the open space lands below the controls */}
        <div className="no-scrollbar" style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>

          {liveRestore && (
            <button onClick={() => setPhase('player')} style={{
              width: '100%', textAlign: 'left', cursor: 'pointer', marginBottom: 12, padding: '10px 12px', borderRadius: 12,
              background: 'rgba(34,197,94,0.1)', border: '1.5px solid rgba(34,197,94,0.55)', boxShadow: '0 0 16px rgba(34,197,94,0.18)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e', flexShrink: 0 }}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: ARCADE.fontHead, fontWeight: 900, fontSize: 10, color: '#8fe8ac', letterSpacing: '0.12em' }}>RUN IN PROGRESS · {liveRestore.pausedAt ? 'PAUSED' : 'CLOCK RUNNING'}</div>
                <div style={{ fontFamily: ARCADE.fontHead, fontWeight: 700, fontSize: 12, color: '#fff', marginTop: 2 }}>
                  {fmtClock(liveRunElapsedSec(liveRestore))} · {((liveRestore.meters || 0) / metersPerUnit(liveRestore.cfg?.unit || 'mi')).toFixed(2)} {liveRestore.cfg?.unit || 'mi'} of {liveRestore.cfg?.goal}
                </div>
              </div>
              <span style={{ fontFamily: ARCADE.fontHead, fontWeight: 900, fontSize: 10, color: GOLD, letterSpacing: '0.1em', flexShrink: 0 }}>RETURN ▶</span>
            </button>
          )}
          {/* METHOD — 4 compact category cards (the category is the selection) */}
          <ProgressionNudgeCard lane="cardio"/>
          <div data-guide="cm-method">
          <div style={sectionLabel}>METHOD</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
            {METHOD_CATEGORIES.map(cat => {
              const active = categoryId === cat.id;
              const group = EQUIPMENT_GROUPS.includes(cat.id);
              // An active group card shows the equipment you are actually on,
              // so the choice is legible from the setup screen without opening
              // anything. Tapping it goes back to the picker.
              const chosen = group && active ? equipmentById(eqByGroup[cat.id]) : null;
              return (
                <button key={cat.id} onClick={() => selectCategory(cat.id)} style={{
                  // ROUNDS sits on its own row: it is one of three cards in a
                  // two-column grid, and left dangling it reads as an orphan.
                  gridColumn: cat.wide ? '1 / -1' : 'auto',
                  textAlign: 'left', padding: '6px 9px', borderRadius: ARCADE.radius.md, cursor: 'pointer',
                  background: active ? 'rgba(253,224,71,0.1)' : 'rgba(14,2,28,0.6)',
                  border: active ? `1.5px solid ${ARCADE.goldBorder}` : `1px solid ${ARCADE.violetBorderSoft}`,
                  boxShadow: active ? '0 0 14px rgba(253,224,71,0.16)' : 'none', transition: 'all 0.15s',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 10 }}>{chosen ? chosen.icon : cat.icon}</span>
                    <span style={{ fontFamily: ARCADE.fontHead, fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', color: active ? GOLD : '#c4b5fd' }}>
                      {chosen ? chosen.label : cat.label}
                    </span>
                    {group && active && <span style={{ marginLeft: 'auto', fontSize: 9, color: GOLD }}>⌄</span>}
                  </div>
                  <div style={{ fontFamily: ARCADE.fontBody, fontSize: 9, color: C.muted, lineHeight: 1.25 }}>
                    {chosen ? trackingLabel(chosen) : cat.sub}
                  </div>
                </button>
              );
            })}
          </div>

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
                  <div style={{ fontFamily: ARCADE.fontBody, fontSize: 9, color: C.muted, marginTop: 7, lineHeight: 1.35 }}>
                    Set this to the {equipment.id === 'treadmill' ? 'belt' : 'console'} speed you will start on —
                    you can change it mid-run too. Distance is tracked from it.
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
              <div style={{ display: 'flex', gap: 5, marginBottom: 6 }}>
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
                background: 'rgba(34,197,94,0.07)', padding: '7px 10px', marginBottom: 8,
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
                    Five movements picked for your level — plyo, sprints, rope, shadowbox.
                    Reorder or swap any of them. Or just run the clock without one.
                  </div>
                </button>
              )}
            </>
          )}

          {/* PROTOCOL */}
          </div>
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
              <div style={{ borderRadius: 12, border: '1px solid rgba(176,106,255,0.4)', background: 'rgba(176,106,255,0.06)', padding: '9px 11px', marginBottom: 8 }}>
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


      </div>
      {configOpen && (
        <ConfigModal styleId={style} cfg={cfg} onChange={setCfg} onClose={() => setConfigOpen(false)}/>
      )}
      {helpOpen && <ScreenGuide steps={SCREEN_GUIDES.cardio_mode} onClose={() => setHelpOpen(false)}/>}
    </PhoneFrame>
  );
}

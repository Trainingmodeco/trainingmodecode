import { useState } from 'react';
import { createPortal } from 'react-dom';
import PhoneFrame from './PhoneFrame';
import IntroLogo from './IntroLogo';
import Embers from './Embers';
import CornerHUD from './CornerHUD';
import { ChevronLeft, TriangleAlert as AlertTriangle, Minus, Plus, X } from 'lucide-react';
import { C } from './Styles';
import { ARCADE } from './ArcadeUI';
import { CARDIO_SAFETY_COPY } from './data/cardioProtocolData';
import { CARDIO_ADDON_TYPES, cardioAddonToPlayer } from './data/cardioAddon';
import CardioProtocolPlayer from './CardioProtocolPlayer';
import CardioSummary from './CardioSummary';
import EmptyState from './EmptyState';
import WorkoutHelpPanel, { HelpButton } from './shared/WorkoutHelpPanel';
import TrainingCTA from './shared/TrainingCTA';
import { loadStats, getLevel } from './data/userStats';
import { loadProfile } from './data/userProfile';

const GOLD = C.yellow;
const VIOLET = '#b06aff';

const fmtClock = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

// Auto pace target (design 12a): from the goal distance + the athlete's level we
// set a target pace the voice coach holds them to. Base 10:00/mi at level 1,
// ~18s/level faster, floored at 6:30/mi.
function computeAutoPace(distance, unit, level) {
  const paceSecPerMile = Math.max(390, 600 - (Math.max(1, level) - 1) * 18);
  const miles = unit === 'km' ? distance * 0.621371 : distance;
  const totalSec = Math.round(miles * paceSecPerMile);
  const paceSecPerUnit = unit === 'km' ? paceSecPerMile * 0.621371 : paceSecPerMile;
  return { totalSec, paceSecPerUnit, paceLabel: `${fmtClock(paceSecPerUnit)} /${unit}`, timeLabel: fmtClock(totalSec), goalLabel: `${distance} ${unit}` };
}

// Simplified method taxonomy (design 12a). Four top-level categories; picking one
// reveals a compact "expander" row of the specific modalities. IDs map to the
// shared CARDIO_ADDON_TYPES so the player/summary keep working unchanged.
const METHOD_CATEGORIES = [
  {
    id: 'running', label: 'RUNNING', icon: '🏃', sub: 'Outdoor GPS · Treadmill',
    options: [
      { id: 'outdoor-run', label: 'Outdoor · GPS' },
      { id: 'treadmill', label: 'Treadmill' },
    ],
  },
  {
    id: 'machine', label: 'MACHINE', icon: '⚙️', sub: 'Elliptical · Row · Stairs · Bike',
    options: [
      { id: 'elliptical', label: 'Elliptical' },
      { id: 'row-machine', label: 'Row' },
      { id: 'stair-climber', label: 'Stairs' },
      { id: 'bike', label: 'Bike' },
      { id: 'assault-bike', label: 'Air Bike' },
    ],
  },
  {
    id: 'alternate', label: 'ALTERNATE', icon: '🥊', sub: 'Rope · Burpees · Swim · Shadowbox',
    options: [
      { id: 'jump-rope', label: 'Jump Rope' },
      { id: 'burpees', label: 'Burpees' },
      { id: 'swimming', label: 'Swimming' },
      { id: 'shadowbox-footwork', label: 'Shadowbox' },
      { id: 'low-impact', label: 'Jumping Jacks' },
    ],
  },
  {
    id: 'exercise', label: 'EXERCISE', icon: '💪', sub: 'Climbers · Knees · Squats · KB',
    options: [
      { id: 'mountain-climbers', label: 'Mountain Climbers' },
      { id: 'high-knees', label: 'High Knees' },
      { id: 'squat-jumps', label: 'Squat Jumps' },
      { id: 'kettlebell-swings', label: 'Kettlebell Swings' },
    ],
  },
];

const PROTOCOLS = [
  { id: 'steady', label: 'STEADY' },
  { id: 'intervals', label: 'INTERVALS' },
  { id: 'tabata', label: 'TABATA' },
  { id: 'hiit', label: 'HIIT' },
];

// Default work/rest structures per protocol; the config modal edits copies of these.
const CFG_DEFAULTS = {
  intervals: { warmupMin: 3, workSec: 60, restSec: 60, rounds: 8 },
  tabata: { warmupMin: 2, workSec: 20, restSec: 10, rounds: 8 },
  hiit: { warmupMin: 3, workSec: 45, restSec: 15, rounds: 10 },
};

const cfgTargetSeconds = (c) => Math.round((c.warmupMin || 0) * 60) + c.rounds * (c.workSec + c.restSec);
const cfgToIntervals = (c) => ({
  warmupSeconds: Math.round((c.warmupMin || 0) * 60),
  workSeconds: c.workSec,
  restSeconds: c.restSec,
  rounds: c.rounds,
});

function getMethod(id) {
  return CARDIO_ADDON_TYPES.find(m => m.id === id) || CARDIO_ADDON_TYPES[0];
}
function findOption(catId, typeId) {
  const cat = METHOD_CATEGORIES.find(c => c.id === catId) || METHOD_CATEGORIES[0];
  return cat.options.find(o => o.id === typeId) || cat.options[0];
}

const sectionLabel = { fontFamily: ARCADE.fontHead, fontWeight: 700, color: GOLD, fontSize: 9, letterSpacing: '0.2em', marginBottom: 5 };

function Stepper({ label, value, unit, min, max, step, onChange }) {
  const dec = () => onChange(Math.max(min, +(value - step).toFixed(2)));
  const inc = () => onChange(Math.min(max, +(value + step).toFixed(2)));
  const btn = {
    width: 36, height: 36, borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(176,106,255,0.12)', border: `1px solid ${ARCADE.violetBorderSoft}`, color: '#d6c2ff',
  };
  return (
    <div style={{ marginBottom: 11 }}>
      <div style={{ fontFamily: ARCADE.fontHead, fontWeight: 700, fontSize: 9, color: '#c4a4d8', letterSpacing: '0.14em', marginBottom: 5 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={dec} style={btn}><Minus size={15} /></button>
        <div style={{ flex: 1, textAlign: 'center', fontFamily: ARCADE.fontHead, fontWeight: 900, fontSize: 19, color: '#fff' }}>
          {value}<span style={{ fontSize: 12, color: C.muted, marginLeft: 2 }}>{unit}</span>
        </div>
        <button onClick={inc} style={btn}><Plus size={15} /></button>
      </div>
    </div>
  );
}

// Centered config modal for Target Intervals / Tabata / HIIT (design 12a).
function ConfigModal({ styleId, cfg, onChange, onClose }) {
  const titleMap = { intervals: 'TARGET INTERVALS', tabata: 'TABATA', hiit: 'HIIT' };
  const target = cfgTargetSeconds(cfg);
  return createPortal(
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 18, background: 'rgba(4,0,10,0.8)', backdropFilter: 'blur(3px)',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 372, marginBottom: '8vh',
        background: 'linear-gradient(180deg,#140425,#0a0116)',
        borderRadius: 18, border: `1px solid ${ARCADE.goldBorder}`,
        boxShadow: '0 0 40px rgba(124,58,237,0.35), 0 20px 50px rgba(0,0,0,0.55)',
        padding: '16px 18px 18px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontFamily: ARCADE.fontHead, fontWeight: 900, fontSize: 13, color: GOLD, letterSpacing: '0.1em' }}>{titleMap[styleId]} SETUP</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', padding: 4 }}><X size={19} /></button>
        </div>
        <Stepper label="WARM-UP" value={cfg.warmupMin} unit="min" min={0} max={15} step={1} onChange={v => onChange({ ...cfg, warmupMin: v })} />
        <Stepper label="ACTIVE WORK" value={cfg.workSec} unit="sec" min={5} max={300} step={5} onChange={v => onChange({ ...cfg, workSec: v })} />
        <Stepper label="REST" value={cfg.restSec} unit="sec" min={0} max={180} step={5} onChange={v => onChange({ ...cfg, restSec: v })} />
        <Stepper label="ROUNDS" value={cfg.rounds} unit="" min={1} max={30} step={1} onChange={v => onChange({ ...cfg, rounds: v })} />
        <div style={{ borderRadius: 11, border: '1px solid rgba(253,224,71,0.35)', background: 'rgba(253,224,71,0.07)', padding: '10px 13px', margin: '3px 0 15px', textAlign: 'center' }}>
          <div style={{ fontFamily: ARCADE.fontHead, fontWeight: 700, fontSize: 8, color: VIOLET, letterSpacing: '0.14em', marginBottom: 3 }}>GENERATED TARGET TIME</div>
          <div style={{ fontFamily: ARCADE.fontHead, fontWeight: 900, fontSize: 23, color: GOLD }}>{fmtClock(target)}</div>
        </div>
        <TrainingCTA label="DONE" icon="✓" height={48} onClick={onClose} />
      </div>
    </div>,
    document.body,
  );
}

// Standalone Cardio Mode (design 12a). Compact, breathable options with the START
// pinned low; awards normal cardio XP once (via CardioSummary), never the bonus.
export default function CardioMode({ onBack }) {
  const [phase, setPhase] = useState('setup');
  const [categoryId, setCategoryId] = useState('running');
  const [cardioType, setCardioType] = useState('outdoor-run');
  const [style, setStyle] = useState('steady');
  const [intervalMode, setIntervalMode] = useState('target'); // 'random' | 'target'
  const [cfgByStyle, setCfgByStyle] = useState(CFG_DEFAULTS);
  const [configOpen, setConfigOpen] = useState(false);
  const [goalDistance, setGoalDistance] = useState(5);
  const [distanceUnit, setDistanceUnit] = useState('km');
  const [customDistance, setCustomDistance] = useState('');
  const [goalTimeSeconds, setGoalTimeSeconds] = useState(1200);
  const [customTimeMin, setCustomTimeMin] = useState('');
  const [playerResult, setPlayerResult] = useState(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const method = getMethod(cardioType);
  const supportsDistance = method.supportsDistance;
  const option = findOption(categoryId, cardioType);
  const optionLabel = option.label;
  const level = getLevel(loadStats().xp);
  const profile = loadProfile();

  const useDistanceGauge = supportsDistance && (style === 'steady' || (style === 'intervals' && intervalMode === 'random'));
  const showTimeGoal = !supportsDistance && (style === 'steady' || (style === 'intervals' && intervalMode === 'random'));
  const showConfigCard = style === 'tabata' || style === 'hiit' || (style === 'intervals' && intervalMode === 'target');
  const usesGps = cardioType === 'outdoor-run' && useDistanceGauge;

  const sliderMax = distanceUnit === 'km' ? 10 : 6.5;
  const parsedCustomDist = parseFloat(customDistance);
  const effGoalDistance = Number.isFinite(parsedCustomDist) && parsedCustomDist > 0 ? parsedCustomDist : goalDistance;
  const parsedCustomMin = parseFloat(customTimeMin);
  const effGoalTime = Number.isFinite(parsedCustomMin) && parsedCustomMin > 0 ? Math.round(parsedCustomMin * 60) : goalTimeSeconds;

  const autoPace = useDistanceGauge ? computeAutoPace(effGoalDistance, distanceUnit, level) : null;

  const displayStyleLabel = style === 'steady' ? 'Steady Pace'
    : style === 'intervals' ? (intervalMode === 'random' ? 'Random Intervals' : 'Target Intervals')
      : style === 'tabata' ? 'Tabata' : 'HIIT';

  const selectCategory = (catId) => {
    setCategoryId(catId);
    const first = (METHOD_CATEGORIES.find(c => c.id === catId) || METHOD_CATEGORIES[0]).options[0];
    setCardioType(first.id);
  };

  const pickProtocol = (id) => {
    setStyle(id);
    if (id === 'tabata' || id === 'hiit') setConfigOpen(true);
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
    else if (style === 'hiit') { addonStyle = 'hiit'; intervals = cfgToIntervals(cfgByStyle.hiit); }

    const dist = useDistanceGauge ? { value: effGoalDistance, unit: distanceUnit } : null;
    return {
      enabled: true,
      sourceMode: 'Cardio Mode',
      placement: 'standalone',
      cardioType,
      cardioLabel: optionLabel,
      targetType: useDistanceGauge ? 'distance' : 'time',
      targetTimeSeconds: effGoalTime,
      targetDistance: dist ? dist.value : null,
      distanceUnit: dist ? dist.unit : 'mi',
      paceTargetSeconds: autoPace ? autoPace.paceSecPerUnit : null,
      paceTargetLabel: autoPace ? autoPace.paceLabel : null,
      style: addonStyle,
      intervals,
      randomSurges,
      bonusEligible: false,
    };
  };

  const addon = buildAddon();
  const goalText = useDistanceGauge ? `${effGoalDistance} ${distanceUnit}` : showTimeGoal ? `${Math.round(effGoalTime / 60)} min` : fmtClock(cfgTargetSeconds(cfg));
  const summary = `${optionLabel} · ${displayStyleLabel} · ${goalText}`;

  // Outdoor runs need GPS; probe real permission and route to the GPS empty
  // state (25d) if it's unavailable / denied.
  const startCardio = () => {
    setPlayerResult(null);
    if (usesGps) {
      if (typeof navigator === 'undefined' || !navigator.geolocation) { setPhase('gps'); return; }
      navigator.geolocation.getCurrentPosition(() => setPhase('player'), () => setPhase('gps'), { timeout: 8000, maximumAge: 60000 });
      return;
    }
    setPhase('player');
  };

  if (phase === 'gps') {
    return (
      <PhoneFrame useBrandBg>
        <CornerHUD color="rgba(253,224,71,0.2)" size={18} inset={8}/>
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
          <div style={{ padding: '12px 16px' }}>
            <button onClick={() => setPhase('setup')} style={{ background: 'transparent', border: 'none', padding: 6, color: C.text, display: 'flex', alignItems: 'center' }}><ChevronLeft size={22}/></button>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            <EmptyState preset="gps" onPrimary={startCardio} onSecondary={() => { selectCategory('running'); setCardioType('treadmill'); setPhase('player'); }} style={{ width: '100%' }}/>
          </div>
        </div>
      </PhoneFrame>
    );
  }

  if (phase === 'player') {
    const player = cardioAddonToPlayer(addon);
    return (
      <PhoneFrame useBrandBg>
        <Embers count={2}/>
        <CornerHUD color="rgba(253,224,71,0.2)" size={18} inset={8}/>
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', minHeight: '100dvh', padding: '12px 16px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <button onClick={() => setPhase('setup')} style={{ background: 'transparent', border: 'none', padding: 6, color: C.text, display: 'flex', alignItems: 'center' }}>
              <ChevronLeft size={22}/>
            </button>
            <IntroLogo size={26}/>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <CardioProtocolPlayer
              format={player.format}
              durationSeconds={player.durationSeconds}
              intervalConfig={player.intervalConfig}
              headerLabel="CARDIO MODE"
              methodLabel={optionLabel}
              styleLabel={displayStyleLabel}
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
              onComplete={(result) => { setPlayerResult(result); setPhase('summary'); }}
            />
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
            methodLabel={optionLabel}
            cardioType={cardioType}
            targetType={addon.targetType}
            targetTimeSeconds={addon.targetType === 'time' ? addon.targetTimeSeconds : null}
            targetDistance={addon.targetType === 'distance' ? player.distanceLabel : null}
            initialTimeSeconds={playerResult?.completedTimeSeconds ?? fallbackTime}
            initialDistanceUnit={addon.distanceUnit || 'mi'}
            awardXp
            onDone={onBack}
          />
        </div>
      </PhoneFrame>
    );
  }

  const categoryOptions = (METHOD_CATEGORIES.find(c => c.id === categoryId) || METHOD_CATEGORIES[0]).options;

  return (
    <PhoneFrame useBrandBg>
      <Embers count={2}/>
      <CornerHUD color="rgba(253,224,71,0.25)" size={20} inset={10}/>
      <style dangerouslySetInnerHTML={{ __html: '@keyframes tm-subpop{0%{opacity:0;transform:translateY(-5px) scale(0.97)}100%{opacity:1;transform:none}}' }} />
      <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', height: '100dvh', padding: '12px 16px calc(78px + env(safe-area-inset-bottom, 0px))' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={onBack} style={{ background: 'transparent', border: 'none', padding: 6, color: C.text, display: 'flex', alignItems: 'center' }}>
              <ChevronLeft size={22}/>
            </button>
            <IntroLogo size={26}/>
          </div>
          <HelpButton onClick={() => setHelpOpen(true)}/>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 12, flexShrink: 0 }}>
          <h1 style={{
            fontFamily: ARCADE.fontHead, fontWeight: 900, color: GOLD, fontSize: 19,
            letterSpacing: '0.12em', textShadow: '0 0 14px rgba(253,224,71,0.4)',
          }}>CARDIO MODE</h1>
          <div style={{ fontFamily: ARCADE.fontBody, fontSize: 11, color: C.muted, marginTop: 2 }}>
            Pick method + goal. We set your pace.
          </div>
        </div>

        {/* Options — top-aligned; this region fills, so the open space lands below the controls */}
        <div className="no-scrollbar" style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>

          {/* METHOD — 4 compact category cards + specific-type expander */}
          <div style={sectionLabel}>METHOD</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 8 }}>
            {METHOD_CATEGORIES.map(cat => {
              const active = categoryId === cat.id;
              return (
                <button key={cat.id} onClick={() => selectCategory(cat.id)} style={{
                  textAlign: 'left', padding: '8px 10px', borderRadius: ARCADE.radius.md, cursor: 'pointer',
                  background: active ? 'rgba(253,224,71,0.1)' : 'rgba(14,2,28,0.6)',
                  border: active ? `1.5px solid ${ARCADE.goldBorder}` : `1px solid ${ARCADE.violetBorderSoft}`,
                  boxShadow: active ? '0 0 14px rgba(253,224,71,0.16)' : 'none', transition: 'all 0.15s',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 10 }}>{cat.icon}</span>
                    <span style={{ fontFamily: ARCADE.fontHead, fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', color: active ? GOLD : '#c4b5fd' }}>{cat.label}</span>
                  </div>
                  <div style={{ fontFamily: ARCADE.fontBody, fontSize: 9, color: C.muted, lineHeight: 1.25 }}>{cat.sub}</div>
                </button>
              );
            })}
          </div>
          <div key={categoryId} style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14, animation: 'tm-subpop 0.24s ease' }}>
            {categoryOptions.map(opt => {
              const active = cardioType === opt.id;
              return (
                <button key={opt.id} onClick={() => setCardioType(opt.id)} style={{
                  padding: '5px 11px', borderRadius: 99, cursor: 'pointer',
                  fontFamily: ARCADE.fontHead, fontWeight: 700, fontSize: 9, letterSpacing: '0.03em',
                  background: active ? 'rgba(176,106,255,0.18)' : 'rgba(8,2,18,0.55)',
                  border: active ? '1.5px solid rgba(176,106,255,0.7)' : `1px solid ${ARCADE.violetBorderSoft}`,
                  color: active ? '#e6d4ff' : C.muted,
                }}>{opt.label.toUpperCase()}</button>
              );
            })}
          </div>

          {/* PROTOCOL */}
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

          {/* GOAL — distance slider (design 12a) */}
          {useDistanceGauge && (
            <>
              <div style={sectionLabel}>GOAL DISTANCE</div>
              <div style={{ borderRadius: 11, border: `1px solid ${ARCADE.violetBorderSoft}`, background: 'rgba(8,2,18,0.5)', padding: '8px 12px 9px', marginBottom: 9 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
                  <div style={{ fontFamily: ARCADE.fontHead, fontWeight: 900, fontSize: 19, color: '#fff', flexShrink: 0 }}>
                    {customDistance ? parsedCustomDist : goalDistance}<span style={{ fontSize: 11, color: GOLD, marginLeft: 3 }}>{distanceUnit}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ display: 'flex', gap: 3 }}>
                      {['km', 'mi'].map(u => (
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

          {/* Interval / Tabata / HIIT config summary card */}
          {showConfigCard && (
            <>
              <div style={sectionLabel}>INTERVAL SETUP</div>
              <div style={{ borderRadius: 12, border: '1px solid rgba(176,106,255,0.4)', background: 'rgba(176,106,255,0.06)', padding: '11px 13px', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                  <div style={{ fontFamily: ARCADE.fontHead, fontWeight: 700, fontSize: 10.5, color: '#e6d4ff', letterSpacing: '0.04em' }}>{displayStyleLabel} · {cfg.rounds} ROUNDS</div>
                  <button onClick={() => setConfigOpen(true)} style={{
                    padding: '4px 12px', borderRadius: 8, cursor: 'pointer', background: 'rgba(253,224,71,0.12)',
                    border: `1px solid ${ARCADE.goldBorder}`, color: GOLD, fontFamily: ARCADE.fontHead, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                  }}>EDIT</button>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                  <span style={{ fontFamily: ARCADE.fontBody, fontSize: 10.5, color: C.muted }}>🔥 {cfg.warmupMin}m warm-up</span>
                  <span style={{ fontFamily: ARCADE.fontBody, fontSize: 10.5, color: '#ff9a8a' }}>💪 {cfg.workSec}s work</span>
                  <span style={{ fontFamily: ARCADE.fontBody, fontSize: 10.5, color: '#8fe8ac' }}>😮‍💨 {cfg.restSec}s rest</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, paddingTop: 7, borderTop: '1px solid rgba(176,106,255,0.15)' }}>
                  <span style={{ fontFamily: ARCADE.fontHead, fontWeight: 700, fontSize: 8, color: VIOLET, letterSpacing: '0.12em' }}>TARGET TIME</span>
                  <span style={{ fontFamily: ARCADE.fontHead, fontWeight: 900, fontSize: 17, color: GOLD }}>{fmtClock(cfgTargetSeconds(cfg))}</span>
                </div>
              </div>
            </>
          )}

          {/* Auto pace target — compact (design 12a) */}
          {autoPace && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 10, border: '1px solid rgba(176,106,255,0.35)', background: 'rgba(176,106,255,0.06)', padding: '8px 12px', marginBottom: 8 }}>
              <span style={{ fontFamily: ARCADE.fontHead, fontWeight: 700, fontSize: 8, color: VIOLET, letterSpacing: '0.1em', flexShrink: 0 }}>AUTO PACE</span>
              <span style={{ fontFamily: ARCADE.fontHead, fontWeight: 900, fontSize: 13, color: '#fff' }}>{autoPace.timeLabel}</span>
              <span style={{ fontFamily: ARCADE.fontHead, fontWeight: 700, fontSize: 11, color: GOLD }}>{autoPace.paceLabel}</span>
              <span style={{ fontFamily: ARCADE.fontBody, fontSize: 9, color: C.muted, marginLeft: 'auto' }}>Lvl {level}</span>
            </div>
          )}

          {/* Random-intervals note */}
          {style === 'intervals' && intervalMode === 'random' && (
            <div style={{ fontFamily: ARCADE.fontBody, fontSize: 10.5, color: C.muted, marginBottom: 8, lineHeight: 1.4 }}>
              We&apos;ll throw in surprise pace surges a few times — hold each surge until the coach calls it off.
            </div>
          )}
        </div>

        {/* Footer — the CTA sits high, with open space above (in the options fill) and below */}
        <div style={{ flexShrink: 0, paddingTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: ARCADE.fontBody, fontWeight: 600, fontSize: 11.5, color: GOLD }}>{summary}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: ARCADE.fontHead, fontWeight: 700, fontSize: 8, color: '#c4a4d8', letterSpacing: '0.04em' }}>
              🔊 {String(profile?.voiceCoach || 'FEMALE').toUpperCase()}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center', marginBottom: 11 }}>
            <AlertTriangle size={10} color="#ef4444" style={{ flexShrink: 0 }}/>
            <span style={{ fontFamily: ARCADE.fontBody, fontSize: 8.5, color: 'rgba(239,68,68,0.8)', lineHeight: 1.3, textAlign: 'center' }}>{CARDIO_SAFETY_COPY}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <TrainingCTA variant="gold" label="START CARDIO" onClick={startCardio} height={46} style={{ width: 'auto', minWidth: 264, paddingLeft: 42, paddingRight: 42, fontSize: 13.5, letterSpacing: '0.12em' }} />
          </div>
        </div>

        {/* Open space below the CTA — keeps it lifted off the nav */}
        <div style={{ flexShrink: 0, height: '6vh' }} />
      </div>
      {configOpen && (
        <ConfigModal styleId={style} cfg={cfg} onChange={setCfg} onClose={() => setConfigOpen(false)}/>
      )}
      <WorkoutHelpPanel contentKey="cardio_mode" open={helpOpen} onClose={() => setHelpOpen(false)}/>
    </PhoneFrame>
  );
}

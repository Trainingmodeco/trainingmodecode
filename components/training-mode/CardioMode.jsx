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
// reveals a small "expander" row of the specific modalities underneath. IDs map to
// the shared CARDIO_ADDON_TYPES so the player/summary keep working unchanged.
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
    id: 'exercise', label: 'EXERCISE', icon: '💪', sub: 'Box jumps · Step-ups · Sprints',
    options: [
      { id: 'step-ups', label: 'Box / Step-Ups' },
      { id: 'sprint-intervals', label: 'Sprints' },
      { id: 'jump-rope', label: 'Jump Rope' },
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

const sectionLabel = { fontFamily: ARCADE.fontHead, fontWeight: 700, color: GOLD, fontSize: 10, letterSpacing: '0.2em', marginBottom: 6 };

function Stepper({ label, value, unit, min, max, step, onChange }) {
  const dec = () => onChange(Math.max(min, +(value - step).toFixed(2)));
  const inc = () => onChange(Math.min(max, +(value + step).toFixed(2)));
  const btn = {
    width: 38, height: 38, borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(176,106,255,0.12)', border: `1px solid ${ARCADE.violetBorderSoft}`, color: '#d6c2ff',
  };
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontFamily: ARCADE.fontHead, fontWeight: 700, fontSize: 9, color: '#c4a4d8', letterSpacing: '0.14em', marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={dec} style={btn}><Minus size={16} /></button>
        <div style={{ flex: 1, textAlign: 'center', fontFamily: ARCADE.fontHead, fontWeight: 900, fontSize: 20, color: '#fff' }}>
          {value}<span style={{ fontSize: 12, color: C.muted, marginLeft: 2 }}>{unit}</span>
        </div>
        <button onClick={inc} style={btn}><Plus size={16} /></button>
      </div>
    </div>
  );
}

// Full-screen config modal for Target Intervals / Tabata / HIIT (design 12a).
function ConfigModal({ styleId, cfg, onChange, onClose }) {
  const titleMap = { intervals: 'TARGET INTERVALS', tabata: 'TABATA', hiit: 'HIIT' };
  const target = cfgTargetSeconds(cfg);
  return createPortal(
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      background: 'rgba(4,0,10,0.78)', backdropFilter: 'blur(3px)',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 440, background: 'linear-gradient(180deg,#120322,#0a0116)',
        borderTopLeftRadius: 20, borderTopRightRadius: 20, border: `1px solid ${ARCADE.violetBorderSoft}`, borderBottom: 'none',
        padding: '18px 18px calc(20px + env(safe-area-inset-bottom,0px))', boxShadow: '0 -12px 40px rgba(0,0,0,0.5)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontFamily: ARCADE.fontHead, fontWeight: 900, fontSize: 14, color: GOLD, letterSpacing: '0.08em' }}>{titleMap[styleId]} SETUP</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', padding: 4 }}><X size={20} /></button>
        </div>
        <Stepper label="WARM-UP" value={cfg.warmupMin} unit="min" min={0} max={15} step={1} onChange={v => onChange({ ...cfg, warmupMin: v })} />
        <Stepper label="ACTIVE WORK" value={cfg.workSec} unit="sec" min={5} max={300} step={5} onChange={v => onChange({ ...cfg, workSec: v })} />
        <Stepper label="REST" value={cfg.restSec} unit="sec" min={0} max={180} step={5} onChange={v => onChange({ ...cfg, restSec: v })} />
        <Stepper label="ROUNDS" value={cfg.rounds} unit="" min={1} max={30} step={1} onChange={v => onChange({ ...cfg, rounds: v })} />
        <div style={{ borderRadius: 11, border: '1px solid rgba(253,224,71,0.35)', background: 'rgba(253,224,71,0.07)', padding: '11px 13px', margin: '4px 0 16px', textAlign: 'center' }}>
          <div style={{ fontFamily: ARCADE.fontHead, fontWeight: 700, fontSize: 8, color: VIOLET, letterSpacing: '0.14em', marginBottom: 3 }}>GENERATED TARGET TIME</div>
          <div style={{ fontFamily: ARCADE.fontHead, fontWeight: 900, fontSize: 24, color: GOLD }}>{fmtClock(target)}</div>
        </div>
        <button onClick={onClose} style={{
          width: '100%', height: 50, border: 'none', borderRadius: 12, cursor: 'pointer',
          background: 'linear-gradient(135deg,#b975ff,#a855f7)', color: '#fff',
          fontFamily: ARCADE.fontHead, fontWeight: 900, fontSize: 13, letterSpacing: '0.08em', boxShadow: '0 0 20px rgba(168,85,247,0.4)',
        }}>DONE</button>
      </div>
    </div>,
    document.body,
  );
}

// Standalone Cardio Mode (design 12a). Simplified method categories, a Steady /
// Intervals / Tabata / HIIT protocol with configurable intervals, and a goal slider.
// Awards normal cardio XP once (via CardioSummary); never the Hybrid Training Bonus.
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

  // When distance/GPS applies vs. an interval-structured session.
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
  const summary = `${optionLabel} · ${displayStyleLabel} · ${useDistanceGauge ? `${effGoalDistance} ${distanceUnit}` : showTimeGoal ? `${Math.round(effGoalTime / 60)} min` : fmtClock(cfgTargetSeconds(cfg))}`;

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

  return (
    <PhoneFrame useBrandBg>
      <Embers count={3}/>
      <CornerHUD color="rgba(253,224,71,0.25)" size={20} inset={10}/>
      <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', minHeight: '100dvh', padding: '12px 16px 0' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={onBack} style={{ background: 'transparent', border: 'none', padding: 6, color: C.text, display: 'flex', alignItems: 'center' }}>
              <ChevronLeft size={22}/>
            </button>
            <IntroLogo size={30}/>
          </div>
          <HelpButton onClick={() => setHelpOpen(true)}/>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <h1 style={{
            fontFamily: ARCADE.fontHead, fontWeight: 900, color: GOLD, fontSize: 22,
            letterSpacing: '0.12em', textShadow: '0 0 14px rgba(253,224,71,0.4)',
          }}>CARDIO MODE</h1>
          <div style={{ fontFamily: ARCADE.fontBody, fontSize: 12, color: C.muted, marginTop: 3 }}>
            Pick method + goal. We set your pace.
          </div>
        </div>

        <div className="no-scrollbar" style={{ flex: 1, overflowX: 'hidden', WebkitOverflowScrolling: 'touch', paddingBottom: 'calc(120px + env(safe-area-inset-bottom, 0px))' }}>

          {/* METHOD — 4 category cards + specific-type expander */}
          <div style={sectionLabel}>METHOD</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            {METHOD_CATEGORIES.map(cat => {
              const active = categoryId === cat.id;
              return (
                <button key={cat.id} onClick={() => selectCategory(cat.id)} style={{
                  textAlign: 'left', padding: '11px 12px', borderRadius: ARCADE.radius.md, cursor: 'pointer',
                  background: active ? 'rgba(253,224,71,0.1)' : 'rgba(14,2,28,0.65)',
                  border: active ? `1.5px solid ${ARCADE.goldBorder}` : `1px solid ${ARCADE.violetBorderSoft}`,
                  boxShadow: active ? '0 0 16px rgba(253,224,71,0.16)' : 'none', transition: 'all 0.15s',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                    <span style={{ fontSize: 15 }}>{cat.icon}</span>
                    <span style={{ fontFamily: ARCADE.fontHead, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: active ? GOLD : '#c4b5fd' }}>{cat.label}</span>
                  </div>
                  <div style={{ fontFamily: ARCADE.fontBody, fontSize: 9.5, color: C.muted, lineHeight: 1.3 }}>{cat.sub}</div>
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {(METHOD_CATEGORIES.find(c => c.id === categoryId) || METHOD_CATEGORIES[0]).options.map(opt => {
              const active = cardioType === opt.id;
              return (
                <button key={opt.id} onClick={() => setCardioType(opt.id)} style={{
                  padding: '6px 12px', borderRadius: 99, cursor: 'pointer',
                  fontFamily: ARCADE.fontHead, fontWeight: 700, fontSize: 9.5, letterSpacing: '0.03em',
                  background: active ? 'rgba(176,106,255,0.18)' : 'rgba(8,2,18,0.6)',
                  border: active ? '1.5px solid rgba(176,106,255,0.7)' : `1px solid ${ARCADE.violetBorderSoft}`,
                  color: active ? '#e6d4ff' : C.muted,
                }}>{opt.label.toUpperCase()}</button>
              );
            })}
          </div>

          {/* PROTOCOL */}
          <div style={sectionLabel}>PROTOCOL</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: style === 'intervals' ? 10 : 16 }}>
            {PROTOCOLS.map(p => (
              <button key={p.id} onClick={() => pickProtocol(p.id)} style={{
                padding: '8px 15px', borderRadius: ARCADE.radius.sm, cursor: 'pointer',
                fontFamily: ARCADE.fontHead, fontWeight: 700, fontSize: 10, letterSpacing: '0.05em',
                background: style === p.id ? 'rgba(253,224,71,0.12)' : 'rgba(14,2,28,0.65)',
                border: style === p.id ? `1.5px solid ${ARCADE.goldBorder}` : `1px solid ${ARCADE.violetBorderSoft}`,
                color: style === p.id ? GOLD : C.muted,
              }}>{p.label}</button>
            ))}
          </div>

          {/* Intervals sub-choice: Random vs Target */}
          {style === 'intervals' && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {[
                { id: 'random', label: 'RANDOM', sub: 'Surprise pace surges' },
                { id: 'target', label: 'TARGET', sub: 'Set work / rest / rounds' },
              ].map(m => {
                const active = intervalMode === m.id;
                return (
                  <button key={m.id} onClick={() => pickIntervalMode(m.id)} style={{
                    flex: 1, textAlign: 'left', padding: '9px 12px', borderRadius: ARCADE.radius.md, cursor: 'pointer',
                    background: active ? 'rgba(176,106,255,0.14)' : 'rgba(8,2,18,0.6)',
                    border: active ? '1.5px solid rgba(176,106,255,0.7)' : `1px solid ${ARCADE.violetBorderSoft}`,
                  }}>
                    <div style={{ fontFamily: ARCADE.fontHead, fontWeight: 700, fontSize: 10.5, letterSpacing: '0.05em', color: active ? '#e6d4ff' : '#c4b5fd' }}>{m.label}</div>
                    <div style={{ fontFamily: ARCADE.fontBody, fontSize: 9.5, color: C.muted, marginTop: 2 }}>{m.sub}</div>
                  </button>
                );
              })}
            </div>
          )}

          {/* GOAL — distance slider (design 12a) */}
          {useDistanceGauge && (
            <>
              <div style={sectionLabel}>GOAL DISTANCE</div>
              <div style={{ borderRadius: 12, border: `1px solid ${ARCADE.violetBorderSoft}`, background: 'rgba(8,2,18,0.55)', padding: '13px 14px', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ fontFamily: ARCADE.fontHead, fontWeight: 900, fontSize: 26, color: '#fff' }}>
                    {customDistance ? parsedCustomDist : goalDistance}<span style={{ fontSize: 13, color: GOLD, marginLeft: 4 }}>{distanceUnit}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {['km', 'mi'].map(u => (
                      <button key={u} onClick={() => { setDistanceUnit(u); setGoalDistance(u === 'km' ? 5 : 3); setCustomDistance(''); }} style={{
                        padding: '5px 12px', borderRadius: 8, cursor: 'pointer',
                        background: distanceUnit === u ? 'rgba(253,224,71,0.12)' : 'rgba(6,0,16,0.7)',
                        border: distanceUnit === u ? `1.5px solid ${ARCADE.goldBorder}` : `1px solid ${ARCADE.violetBorderSoft}`,
                        color: distanceUnit === u ? GOLD : C.muted, fontFamily: ARCADE.fontHead, fontSize: 10, fontWeight: 700,
                      }}>{u.toUpperCase()}</button>
                    ))}
                  </div>
                </div>
                <input
                  type="range" min={distanceUnit === 'km' ? 1 : 0.5} max={sliderMax} step={distanceUnit === 'km' ? 0.5 : 0.25}
                  value={Math.min(goalDistance, sliderMax)}
                  onChange={e => { setGoalDistance(parseFloat(e.target.value)); setCustomDistance(''); }}
                  style={{ width: '100%', accentColor: GOLD, cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: ARCADE.fontHead, fontSize: 8, color: '#6f6690', letterSpacing: '0.06em', marginTop: 2 }}>
                  <span>{distanceUnit === 'km' ? '1' : '0.5'} {distanceUnit}</span>
                  <span>{sliderMax}{distanceUnit === 'km' ? 'K' : ` ${distanceUnit}`}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(176,106,255,0.15)' }}>
                  <span style={{ fontFamily: ARCADE.fontBody, fontSize: 10.5, color: C.muted, flexShrink: 0 }}>Going longer?</span>
                  <input
                    type="number" inputMode="decimal" min="0" step="0.1" placeholder={`Type ${distanceUnit}`}
                    value={customDistance} onChange={e => setCustomDistance(e.target.value)}
                    style={{ flex: 1, padding: '8px 10px', borderRadius: 8, background: 'rgba(6,0,16,0.7)', border: `1px solid ${ARCADE.violetBorderSoft}`, color: C.text, fontFamily: ARCADE.fontBody, fontSize: 13, fontWeight: 600, outline: 'none' }}
                  />
                </div>
              </div>

              {autoPace && (
                <div style={{ borderRadius: 11, border: '1px solid rgba(176,106,255,0.4)', background: 'rgba(176,106,255,0.06)', padding: '11px 13px', marginBottom: 16 }}>
                  <div style={{ fontFamily: ARCADE.fontHead, fontWeight: 700, fontSize: 8, color: VIOLET, letterSpacing: '0.12em', marginBottom: 3 }}>AUTO PACE TARGET</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: ARCADE.fontHead, fontWeight: 900, fontSize: 17, color: '#fff' }}>{autoPace.goalLabel} · {autoPace.timeLabel}</span>
                    <span style={{ fontFamily: ARCADE.fontHead, fontWeight: 700, fontSize: 11, color: GOLD }}>= {autoPace.paceLabel}</span>
                  </div>
                  <div style={{ fontFamily: ARCADE.fontBody, fontSize: 10, color: C.muted, marginTop: 2 }}>Set from your goal &amp; level {level}. Voice coaches you to hold it.</div>
                </div>
              )}
            </>
          )}

          {/* GOAL — time slider for non-distance methods */}
          {showTimeGoal && (
            <>
              <div style={sectionLabel}>TARGET TIME</div>
              <div style={{ borderRadius: 12, border: `1px solid ${ARCADE.violetBorderSoft}`, background: 'rgba(8,2,18,0.55)', padding: '13px 14px', marginBottom: 16 }}>
                <div style={{ fontFamily: ARCADE.fontHead, fontWeight: 900, fontSize: 26, color: '#fff', marginBottom: 10 }}>
                  {Math.round(effGoalTime / 60)}<span style={{ fontSize: 13, color: GOLD, marginLeft: 4 }}>min</span>
                </div>
                <input
                  type="range" min={5} max={60} step={5}
                  value={Math.min(Math.round(goalTimeSeconds / 60), 60)}
                  onChange={e => { setGoalTimeSeconds(parseInt(e.target.value, 10) * 60); setCustomTimeMin(''); }}
                  style={{ width: '100%', accentColor: GOLD, cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: ARCADE.fontHead, fontSize: 8, color: '#6f6690', letterSpacing: '0.06em', marginTop: 2 }}>
                  <span>5 min</span><span>60 min</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(176,106,255,0.15)' }}>
                  <span style={{ fontFamily: ARCADE.fontBody, fontSize: 10.5, color: C.muted, flexShrink: 0 }}>Going longer?</span>
                  <input
                    type="number" inputMode="numeric" min="0" step="1" placeholder="Type min"
                    value={customTimeMin} onChange={e => setCustomTimeMin(e.target.value)}
                    style={{ flex: 1, padding: '8px 10px', borderRadius: 8, background: 'rgba(6,0,16,0.7)', border: `1px solid ${ARCADE.violetBorderSoft}`, color: C.text, fontFamily: ARCADE.fontBody, fontSize: 13, fontWeight: 600, outline: 'none' }}
                  />
                </div>
              </div>
            </>
          )}

          {/* Interval / Tabata / HIIT config summary card */}
          {showConfigCard && (
            <>
              <div style={sectionLabel}>INTERVAL SETUP</div>
              <div style={{ borderRadius: 12, border: '1px solid rgba(176,106,255,0.4)', background: 'rgba(176,106,255,0.06)', padding: '13px 14px', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontFamily: ARCADE.fontHead, fontWeight: 700, fontSize: 11, color: '#e6d4ff', letterSpacing: '0.04em' }}>{displayStyleLabel} · {cfg.rounds} ROUNDS</div>
                  <button onClick={() => setConfigOpen(true)} style={{
                    padding: '5px 13px', borderRadius: 8, cursor: 'pointer', background: 'rgba(253,224,71,0.12)',
                    border: `1px solid ${ARCADE.goldBorder}`, color: GOLD, fontFamily: ARCADE.fontHead, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                  }}>EDIT</button>
                </div>
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 10 }}>
                  <span style={{ fontFamily: ARCADE.fontBody, fontSize: 11, color: C.muted }}>🔥 {cfg.warmupMin}m warm-up</span>
                  <span style={{ fontFamily: ARCADE.fontBody, fontSize: 11, color: '#ff9a8a' }}>💪 {cfg.workSec}s work</span>
                  <span style={{ fontFamily: ARCADE.fontBody, fontSize: 11, color: '#8fe8ac' }}>😮‍💨 {cfg.restSec}s rest</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, paddingTop: 8, borderTop: '1px solid rgba(176,106,255,0.15)' }}>
                  <span style={{ fontFamily: ARCADE.fontHead, fontWeight: 700, fontSize: 8, color: VIOLET, letterSpacing: '0.12em' }}>TARGET TIME</span>
                  <span style={{ fontFamily: ARCADE.fontHead, fontWeight: 900, fontSize: 18, color: GOLD }}>{fmtClock(cfgTargetSeconds(cfg))}</span>
                </div>
              </div>
            </>
          )}

          {/* Random-intervals note */}
          {style === 'intervals' && intervalMode === 'random' && (
            <div style={{ fontFamily: ARCADE.fontBody, fontSize: 11, color: C.muted, marginTop: -6, marginBottom: 14, lineHeight: 1.4 }}>
              We&apos;ll throw in surprise pace surges a few times during the session — hold the surge until the coach calls it off.
            </div>
          )}

          <div style={{
            display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12,
            fontFamily: ARCADE.fontBody, fontWeight: 600, fontSize: 12.5, color: GOLD, justifyContent: 'center', textAlign: 'center',
          }}>{summary}</div>

          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 6, padding: '8px 10px', borderRadius: ARCADE.radius.sm,
            background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', marginBottom: 16,
          }}>
            <AlertTriangle size={12} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }}/>
            <span style={{ fontFamily: ARCADE.fontBody, fontSize: 9.5, color: 'rgba(239,68,68,0.85)', lineHeight: 1.4 }}>{CARDIO_SAFETY_COPY}</span>
          </div>

          {/* Voice coach row (design 12a) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 10, border: '1px solid rgba(168,85,247,0.25)', background: 'rgba(8,2,18,0.7)', padding: '9px 12px', marginBottom: 12 }}>
            <span style={{ fontSize: 14 }}>🔊</span>
            <span style={{ flex: 1, fontFamily: ARCADE.fontHead, fontWeight: 700, fontSize: 9, color: '#c4a4d8', letterSpacing: '0.04em' }}>
              VOICE COACH · {String(profile?.voiceCoach || 'FEMALE').toUpperCase()} · {String(profile?.encouragement || 'HYPE').toUpperCase()}
            </span>
          </div>

          <button onClick={startCardio} style={{
            width: '100%', height: 52, border: 'none', borderRadius: 12, cursor: 'pointer',
            background: 'linear-gradient(135deg,#b975ff,#a855f7)', color: '#fff',
            fontFamily: ARCADE.fontHead, fontWeight: 900, fontSize: 14, letterSpacing: '0.06em',
            boxShadow: '0 0 22px rgba(168,85,247,0.45)',
          }}>▶ START CARDIO</button>
        </div>
      </div>
      {configOpen && (
        <ConfigModal styleId={style} cfg={cfg} onChange={setCfg} onClose={() => setConfigOpen(false)}/>
      )}
      <WorkoutHelpPanel contentKey="cardio_mode" open={helpOpen} onClose={() => setHelpOpen(false)}/>
    </PhoneFrame>
  );
}

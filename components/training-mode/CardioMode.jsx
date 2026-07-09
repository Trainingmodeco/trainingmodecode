import { useState } from 'react';
import { createPortal } from 'react-dom';
import PhoneFrame from './PhoneFrame';
import IntroLogo from './IntroLogo';
import Embers from './Embers';
import CornerHUD from './CornerHUD';
import { ChevronLeft, Minus, Plus, X } from 'lucide-react';
import { C } from './Styles';
import { ARCADE } from './ArcadeUI';
import { CARDIO_ADDON_TYPES, cardioAddonToPlayer } from './data/cardioAddon';
import CardioProtocolPlayer from './CardioProtocolPlayer';
import CardioSummary from './CardioSummary';
import EmptyState from './EmptyState';
import WorkoutHelpPanel, { HelpButton } from './shared/WorkoutHelpPanel';
import TrainingCTA from './shared/TrainingCTA';
import { loadStats, getLevel } from './data/userStats';

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

// Simplified method taxonomy (design 12a). Four categories; the category IS the
// selection (no sub-method chips). Each maps to a representative CARDIO_ADDON_TYPE
// that decides distance-vs-time + whether GPS applies.
const METHOD_CATEGORIES = [
  { id: 'running', label: 'RUNNING', icon: '🏃', sub: 'Outdoor GPS · Treadmill', type: 'outdoor-run', methodLabel: 'Running' },
  { id: 'machine', label: 'MACHINE', icon: '⚙️', sub: 'Elliptical · Row · Stairs · Bike', type: 'bike', methodLabel: 'Machine' },
  { id: 'alternate', label: 'ALTERNATE', icon: '🥊', sub: 'Rope · Burpees · Swim · Shadowbox', type: 'jump-rope', methodLabel: 'Alternate' },
  { id: 'exercise', label: 'EXERCISE', icon: '💪', sub: 'Climbers · Knees · Squats · KB', type: 'mountain-climbers', methodLabel: 'Exercise' },
];

const PROTOCOLS = [
  { id: 'steady', label: 'STEADY' },
  { id: 'intervals', label: 'INTERVALS' },
  { id: 'tabata', label: 'TABATA' },
  { id: 'hiit', label: 'HIIT' },
];

// Default work/rest structures per protocol; the config modal edits copies of these.
const CFG_DEFAULTS = {
  intervals: { warmupMin: 3, workSec: 60, restSec: 60, rounds: 8, cooldownMin: 0 },
  tabata: { warmupMin: 0, workSec: 20, restSec: 10, rounds: 8, cooldownMin: 0 },
  hiit: { warmupMin: 2, workSec: 45, restSec: 15, rounds: 10, cooldownMin: 0 },
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

// Narrow, centered config modal for Target Intervals / Tabata / HIIT (design 12a).
function ConfigModal({ styleId, cfg, onChange, onClose }) {
  const titleMap = { intervals: 'TARGET INTERVALS', tabata: 'TABATA', hiit: 'HIIT' };
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
export default function CardioMode({ onBack }) {
  const [phase, setPhase] = useState('setup');
  const [categoryId, setCategoryId] = useState('running');
  const [style, setStyle] = useState('steady');
  const [intervalMode, setIntervalMode] = useState('target'); // 'random' | 'target'
  const [cfgByStyle, setCfgByStyle] = useState(CFG_DEFAULTS);
  const [configOpen, setConfigOpen] = useState(false);
  const [goalDistance, setGoalDistance] = useState(5);
  const [distanceUnit, setDistanceUnit] = useState('km');
  const [customDistance, setCustomDistance] = useState('');
  const [goalTimeSeconds, setGoalTimeSeconds] = useState(1200);
  const [customTimeMin, setCustomTimeMin] = useState('');
  const [noGps, setNoGps] = useState(false);
  const [playerResult, setPlayerResult] = useState(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const category = METHOD_CATEGORIES.find(c => c.id === categoryId) || METHOD_CATEGORIES[0];
  const cardioType = category.type;
  const method = getMethod(cardioType);
  const supportsDistance = method.supportsDistance;
  const methodLabel = category.methodLabel;
  const level = getLevel(loadStats().xp);

  const useDistanceGauge = supportsDistance && (style === 'steady' || (style === 'intervals' && intervalMode === 'random'));
  const showTimeGoal = !supportsDistance && (style === 'steady' || (style === 'intervals' && intervalMode === 'random'));
  const showConfigCard = style === 'tabata' || style === 'hiit' || (style === 'intervals' && intervalMode === 'target');
  const usesGps = cardioType === 'outdoor-run' && useDistanceGauge && !noGps;

  const sliderMax = distanceUnit === 'km' ? 10 : 6.5;
  const parsedCustomDist = parseFloat(customDistance);
  const effGoalDistance = Number.isFinite(parsedCustomDist) && parsedCustomDist > 0 ? parsedCustomDist : goalDistance;
  const parsedCustomMin = parseFloat(customTimeMin);
  const effGoalTime = Number.isFinite(parsedCustomMin) && parsedCustomMin > 0 ? Math.round(parsedCustomMin * 60) : goalTimeSeconds;

  const autoPace = useDistanceGauge ? computeAutoPace(effGoalDistance, distanceUnit, level) : null;

  const displayStyleLabel = style === 'steady' ? 'Steady Pace'
    : style === 'intervals' ? (intervalMode === 'random' ? 'Random Intervals' : 'Target Intervals')
      : style === 'tabata' ? 'Tabata' : 'HIIT';

  const selectCategory = (catId) => { setCategoryId(catId); setNoGps(false); };

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
      cardioLabel: methodLabel,
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
            <EmptyState preset="gps" onPrimary={startCardio} onSecondary={() => { setNoGps(true); setPhase('player'); }} style={{ width: '100%' }}/>
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
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', paddingTop: 4 }}>
            <CardioProtocolPlayer
              format={player.format}
              durationSeconds={player.durationSeconds}
              intervalConfig={player.intervalConfig}
              headerLabel="CARDIO MODE"
              methodLabel={methodLabel}
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
            methodLabel={methodLabel}
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
      <Embers count={2}/>
      <CornerHUD color="rgba(253,224,71,0.25)" size={20} inset={10}/>
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

          {/* METHOD — 4 compact category cards (the category is the selection) */}
          <div style={sectionLabel}>METHOD</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 14 }}>
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

              {autoPace && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 10, border: '1px solid rgba(176,106,255,0.35)', background: 'rgba(176,106,255,0.06)', padding: '8px 12px', marginBottom: 9 }}>
                  <span style={{ fontFamily: ARCADE.fontHead, fontWeight: 700, fontSize: 8, color: VIOLET, letterSpacing: '0.1em', flexShrink: 0 }}>AUTO PACE</span>
                  <span style={{ fontFamily: ARCADE.fontHead, fontWeight: 900, fontSize: 13, color: '#fff' }}>{autoPace.timeLabel}</span>
                  <span style={{ fontFamily: ARCADE.fontHead, fontWeight: 700, fontSize: 11, color: GOLD }}>{autoPace.paceLabel}</span>
                  <span style={{ fontFamily: ARCADE.fontBody, fontSize: 9, color: C.muted, marginLeft: 'auto' }}>Lvl {level}</span>
                </div>
              )}
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
              <div style={{ borderRadius: 12, border: '1px solid rgba(176,106,255,0.4)', background: 'rgba(176,106,255,0.06)', padding: '11px 13px', marginBottom: 9 }}>
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
                  <span style={{ fontFamily: ARCADE.fontHead, fontWeight: 700, fontSize: 8, color: VIOLET, letterSpacing: '0.12em' }}>TOTAL TIME</span>
                  <span style={{ fontFamily: ARCADE.fontHead, fontWeight: 900, fontSize: 17, color: GOLD }}>{fmtClock(cfgTargetSeconds(cfg))}</span>
                </div>
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

        {/* Footer — just the CTA, sitting high with open space above and below */}
        <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
          <TrainingCTA variant="gold" label="START CARDIO" onClick={startCardio} height={46} style={{ width: 'auto', minWidth: 264, paddingLeft: 42, paddingRight: 42, fontSize: 13.5, letterSpacing: '0.12em' }} />
        </div>

        {/* Open space below the CTA — keeps it lifted off the nav */}
        <div style={{ flexShrink: 0, height: '9vh' }} />
      </div>
      {configOpen && (
        <ConfigModal styleId={style} cfg={cfg} onChange={setCfg} onClose={() => setConfigOpen(false)}/>
      )}
      <WorkoutHelpPanel contentKey="cardio_mode" open={helpOpen} onClose={() => setHelpOpen(false)}/>
    </PhoneFrame>
  );
}

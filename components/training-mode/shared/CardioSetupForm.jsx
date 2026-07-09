import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Minus, Plus, X } from 'lucide-react';
import { C } from '../Styles';
import { ARCADE } from '../ArcadeUI';
import { CARDIO_ADDON_TYPES } from '../data/cardioAddon';
import TrainingCTA from './TrainingCTA';
import { loadStats, getLevel } from '../data/userStats';

const GOLD = C.yellow;
const VIOLET = '#b06aff';

const fmtClock = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

function computeAutoPace(distance, unit, level) {
  const paceSecPerMile = Math.max(390, 600 - (Math.max(1, level) - 1) * 18);
  const miles = unit === 'km' ? distance * 0.621371 : distance;
  const totalSec = Math.round(miles * paceSecPerMile);
  const paceSecPerUnit = unit === 'km' ? paceSecPerMile * 0.621371 : paceSecPerMile;
  return { totalSec, paceSecPerUnit, paceLabel: `${fmtClock(paceSecPerUnit)} /${unit}`, timeLabel: fmtClock(totalSec), goalLabel: `${distance} ${unit}` };
}

// Same simplified taxonomy as the Cardio Mode option screen (design 12a).
const METHOD_CATEGORIES = [
  { id: 'running', label: 'RUNNING', icon: '🏃', sub: 'Outdoor GPS · Treadmill', type: 'outdoor-run', methodLabel: 'Running' },
  { id: 'machine', label: 'MACHINE', icon: '⚙️', sub: 'Elliptical · Row · Stairs · Bike', type: 'bike', methodLabel: 'Machine' },
  { id: 'alternate', label: 'ALTERNATE', icon: '🥊', sub: 'Rope · Burpees · Swim · Shadowbox', type: 'jump-rope', methodLabel: 'Alternate' },
  { id: 'exercise', label: 'EXERCISE', icon: '💪', sub: 'Climbers · Knees · Squats · KB', type: 'mountain-climbers', methodLabel: 'Exercise' },
];
// Map an arbitrary saved cardioType back to its category (for editing a saved addon).
const CATEGORY_MEMBERS = {
  running: ['outdoor-run', 'treadmill'],
  machine: ['bike', 'assault-bike', 'row-machine', 'elliptical', 'stair-climber'],
  alternate: ['jump-rope', 'burpees', 'swimming', 'shadowbox-footwork', 'low-impact'],
  exercise: ['mountain-climbers', 'high-knees', 'squat-jumps', 'kettlebell-swings', 'step-ups', 'sprint-intervals'],
};
function categoryForType(type) {
  const hit = METHOD_CATEGORIES.find(c => c.type === type)
    || METHOD_CATEGORIES.find(c => (CATEGORY_MEMBERS[c.id] || []).includes(type));
  return hit ? hit.id : 'running';
}

const PROTOCOLS = [
  { id: 'steady', label: 'STEADY' },
  { id: 'intervals', label: 'INTERVALS' },
  { id: 'tabata', label: 'TABATA' },
  { id: 'hiit', label: 'HIIT' },
];

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

// Seed the form state from an existing addon (for editing a saved cardio finisher).
function seedFromAddon(initial) {
  const a = initial || {};
  const categoryId = a.cardioType ? categoryForType(a.cardioType) : 'running';
  let style = 'steady';
  let intervalMode = 'target';
  if (a.style === 'tabata') style = 'tabata';
  else if (a.style === 'hiit') style = 'hiit';
  else if (a.randomSurges) { style = 'intervals'; intervalMode = 'random'; }
  else if (a.style === 'intervals' || a.style === 'sprints' || a.style === 'roadwork') { style = 'intervals'; intervalMode = 'target'; }
  const cfgByStyle = { ...CFG_DEFAULTS };
  if (a.intervals && (style === 'intervals' || style === 'tabata' || style === 'hiit')) {
    const key = style === 'intervals' ? 'intervals' : style;
    const iv = a.intervals;
    cfgByStyle[key] = {
      warmupMin: Math.round((iv.warmupSeconds || 0) / 60),
      workSec: iv.workSeconds ?? iv.fastSeconds ?? iv.hardSeconds ?? cfgByStyle[key].workSec,
      restSec: iv.restSeconds ?? iv.easySeconds ?? cfgByStyle[key].restSec,
      rounds: iv.rounds ?? cfgByStyle[key].rounds,
      cooldownMin: Math.round((iv.cooldownSeconds || 0) / 60),
    };
  }
  return {
    categoryId, style, intervalMode, cfgByStyle,
    distanceUnit: a.distanceUnit || 'km',
    goalDistance: a.targetType === 'distance' && a.targetDistance ? a.targetDistance : (a.distanceUnit === 'mi' ? 3 : 5),
    goalTimeSeconds: a.targetType === 'time' && a.targetTimeSeconds ? a.targetTimeSeconds : 1200,
  };
}

// Shared cardio setup body — the exact Cardio Mode option-screen design. Renders
// the method/protocol/goal controls + config modal + a submit CTA. The parent
// supplies the surrounding frame/header and handles what happens on submit.
export default function CardioSetupForm({
  initial = null,
  sourceMode = 'Cardio Mode',
  placement = 'standalone',
  bonusEligible = false,
  submitLabel = 'START CARDIO',
  submitIcon = '▶',
  submitVariant = 'gold',
  bottomSpacer = 12,
  onSubmit,
}) {
  const seed = seedFromAddon(initial);
  const [categoryId, setCategoryId] = useState(seed.categoryId);
  const [style, setStyle] = useState(seed.style);
  const [intervalMode, setIntervalMode] = useState(seed.intervalMode);
  const [cfgByStyle, setCfgByStyle] = useState(seed.cfgByStyle);
  const [configOpen, setConfigOpen] = useState(false);
  const [goalDistance, setGoalDistance] = useState(seed.goalDistance);
  const [distanceUnit, setDistanceUnit] = useState(seed.distanceUnit);
  const [customDistance, setCustomDistance] = useState('');
  const [goalTimeSeconds, setGoalTimeSeconds] = useState(seed.goalTimeSeconds);
  const [customTimeMin, setCustomTimeMin] = useState('');

  const category = METHOD_CATEGORIES.find(c => c.id === categoryId) || METHOD_CATEGORIES[0];
  const cardioType = category.type;
  const method = getMethod(cardioType);
  const supportsDistance = method.supportsDistance;
  const methodLabel = category.methodLabel;
  const level = getLevel(loadStats().xp);

  const useDistanceGauge = supportsDistance && (style === 'steady' || (style === 'intervals' && intervalMode === 'random'));
  const showTimeGoal = !supportsDistance && (style === 'steady' || (style === 'intervals' && intervalMode === 'random'));
  const showConfigCard = style === 'tabata' || style === 'hiit' || (style === 'intervals' && intervalMode === 'target');

  const sliderMax = distanceUnit === 'km' ? 10 : 6.5;
  const parsedCustomDist = parseFloat(customDistance);
  const effGoalDistance = Number.isFinite(parsedCustomDist) && parsedCustomDist > 0 ? parsedCustomDist : goalDistance;
  const parsedCustomMin = parseFloat(customTimeMin);
  const effGoalTime = Number.isFinite(parsedCustomMin) && parsedCustomMin > 0 ? Math.round(parsedCustomMin * 60) : goalTimeSeconds;

  const autoPace = useDistanceGauge ? computeAutoPace(effGoalDistance, distanceUnit, level) : null;

  const displayStyleLabel = style === 'steady' ? 'Steady Pace'
    : style === 'intervals' ? (intervalMode === 'random' ? 'Random Intervals' : 'Target Intervals')
      : style === 'tabata' ? 'Tabata' : 'HIIT';

  const selectCategory = (catId) => setCategoryId(catId);
  const pickProtocol = (id) => { setStyle(id); if (id === 'tabata' || id === 'hiit') setConfigOpen(true); };
  const pickIntervalMode = (mode) => { setIntervalMode(mode); if (mode === 'target') setConfigOpen(true); };

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
      sourceMode,
      placement,
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
      bonusEligible,
    };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Options — top-aligned; this region fills, so the open space lands below the controls */}
      <div className="no-scrollbar" style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>

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

        {style === 'intervals' && intervalMode === 'random' && (
          <div style={{ fontFamily: ARCADE.fontBody, fontSize: 10.5, color: C.muted, marginBottom: 8, lineHeight: 1.4 }}>
            We&apos;ll throw in surprise pace surges a few times — hold each surge until the coach calls it off.
          </div>
        )}
      </div>

      {/* Footer — the CTA sits high with open space above (options fill) and below */}
      <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
        <TrainingCTA variant={submitVariant} label={submitLabel} icon={submitIcon} onClick={() => onSubmit(buildAddon())} height={46} style={{ width: 'auto', minWidth: 264, paddingLeft: 42, paddingRight: 42, fontSize: 13.5, letterSpacing: '0.12em' }} />
      </div>
      <div style={{ flexShrink: 0, height: bottomSpacer }} />

      {configOpen && (
        <ConfigModal styleId={style} cfg={cfg} onChange={setCfg} onClose={() => setConfigOpen(false)} />
      )}
    </div>
  );
}

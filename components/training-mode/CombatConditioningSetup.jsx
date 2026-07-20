import { useState } from 'react';
import PhoneFrame from './PhoneFrame';
import TrainingHeader from './TrainingHeader';
import { HelpButton } from './shared/WorkoutHelpPanel';
import ScreenGuide from './shared/ScreenGuide';
import { SCREEN_GUIDES } from './shared/screenGuides';
import Embers from './Embers';
import { C } from './Styles';
import { CADENCE_PRESETS } from './shared/CadenceSlider';
import { summarizeCardioAddon } from './data/cardioAddon';
import AddCardioSheet from './AddCardioSheet';
import TrainingCTA from './shared/TrainingCTA';
import AudioLevelRow from './shared/AudioLevelRow';
import WarmupRow, { loadWarmup } from './shared/WarmupRow';

const GOLD = C.gold;
const RED = '#ef4444';

const STYLES = [
  { id: 'Boxing', label: 'BOXING' },
  { id: 'Kickboxing / Muay Thai', label: 'KICKBOXING / MUAY THAI' },
  { id: 'MMA', label: 'MMA' },
];
// Circuit style (design 15b).
const FOCUS_OPTIONS = [
  { id: 'gas-tank', icon: '🔥', label: 'GAS TANK', sub: 'Bag work + bursts. Build fight endurance.' },
  { id: 'power', icon: '💥', label: 'POWER & EXPLOSION', sub: 'Plyo + strikes for knockout force.' },
  { id: 'strike-strength', icon: '🥊', label: 'STRIKE & STRENGTH', sub: 'Alternating combos + resistance.' },
];
const FOCUS_BLEND = { 'gas-tank': 50, power: 40, 'strike-strength': 65 };
// Intensity (design 15b): displayed MED/HARD/SAVAGE, stored as the difficulty value.
const INTENSITIES = [
  { id: 'Normal', label: 'MED' },
  { id: 'Hard', label: 'HARD' },
  { id: 'Advanced', label: 'SAVAGE' },
];
const EQUIPMENT = [
  { id: 'NONE', label: 'NONE' },
  { id: 'BAG', label: 'BAG' },
  { id: 'WEIGHTS', label: 'WEIGHTS' },
];
// Map the on-screen equipment choice to a generator equipment tier.
const EQUIPMENT_TIER = { NONE: 'Bodyweight', BAG: 'Bags & Combat Gear', WEIGHTS: 'Basic Gym' };

const setupCSS = `
.cc-pill { transition: all 0.2s ease; cursor: pointer; }
.cc-pill:hover { filter: brightness(1.1); }
.cc-pill:active { transform: scale(0.96); }
`;

function SectionLabel({ children }) {
  return (
    <div style={{
      fontFamily: "'Orbitron',sans-serif", fontWeight: 700, color: '#c4a4d8',
      fontSize: 8, letterSpacing: '0.16em', marginBottom: 5,
    }}>{children}</div>
  );
}

// − value + stepper (design 15b).
function Stepper({ label, value, unit, min, max, step, onChange }) {
  const btn = {
    width: 24, height: 24, borderRadius: 6, border: '1px solid rgba(168,85,247,0.4)', color: RED,
    fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 14, lineHeight: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'transparent', flexShrink: 0,
  };
  return (
    <div style={{ flex: 1 }}>
      <SectionLabel>{label}</SectionLabel>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(8,2,18,0.8)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 9, padding: '7px 11px' }}>
        <button className="cc-pill" onClick={() => onChange(Math.max(min, value - step))} style={btn}>−</button>
        <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 13, color: '#fff' }}>
          {value}{unit && <span style={{ fontSize: 8, color: C.faint, marginLeft: 1 }}>{unit}</span>}
        </span>
        <button className="cc-pill" onClick={() => onChange(Math.min(max, value + step))} style={btn}>+</button>
      </div>
    </div>
  );
}

// Segmented selector (design 15b) — intensity / equipment.
function Segmented({ label, options, value, onChange, accent }) {
  return (
    <div style={{ flex: 1 }}>
      <SectionLabel>{label}</SectionLabel>
      <div style={{ display: 'flex', gap: 4 }}>
        {options.map(o => {
          const active = o.id === value;
          return (
            <button key={o.id} className="cc-pill" onClick={() => onChange(o.id)} style={{
              flex: 1, textAlign: 'center', padding: '9px 0', borderRadius: 8, cursor: 'pointer',
              fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 8.5, letterSpacing: '0.03em',
              background: active ? accent : 'rgba(16,4,30,0.8)',
              border: active ? 'none' : '1px solid rgba(168,85,247,0.3)',
              color: active ? '#0a0014' : '#d9d1ef',
            }}>{o.label}</button>
          );
        })}
      </div>
    </div>
  );
}

export default function CombatConditioningSetup({ onBack, onStart, onCardioOnly, profile }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [style, setStyle] = useState('Boxing');
  const [difficulty, setDifficulty] = useState('Normal');
  const [rounds, setRounds] = useState(5);
  const [workSec, setWorkSec] = useState(40);
  const [restSec, setRestSec] = useState(15);
  const [focus, setFocus] = useState('gas-tank');
  const [equipment, setEquipment] = useState('NONE');
  const cadencePreset = 'moderate';
  const cadenceMs = CADENCE_PRESETS.moderate;
  const [cardioAddon, setCardioAddon] = useState(null);
  const [cardioSheetOpen, setCardioSheetOpen] = useState(false);
  const [warmupMin, setWarmupMin] = useState(() => loadWarmup('combatConditioning'));

  const duration = Math.round((rounds * (workSec + restSec)) / 60);
  const format = 'Auto';
  const focusLabel = (FOCUS_OPTIONS.find(f => f.id === focus) || FOCUS_OPTIONS[0]).label;
  const intensityLabel = (INTENSITIES.find(i => i.id === difficulty) || INTENSITIES[0]).label;

  const handleStart = () => {
    onStart({
      style, duration, difficulty, equipment: EQUIPMENT_TIER[equipment] || 'Any', format,
      voiceOn: true, formPreviewOn: true, cadenceCount: true, cadencePreset, cadenceMs, cardioAddon,
      rounds, workSec, restSec, focus, blend: FOCUS_BLEND[focus] ?? 50, warmupMin,
    });
  };

  return (
    <PhoneFrame useBrandBg>
      <style dangerouslySetInnerHTML={{ __html: setupCSS }}/>
      <Embers count={3}/>

      <TrainingHeader
        title="COMBAT CONDITIONING"
        subtitle="Fit × Fight · ring-ready circuits"
        onHome={onBack}
        showBack
        onBack={onBack}
        rightSlot={<HelpButton onClick={() => setHelpOpen(true)}/>}
      />

      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
        padding: '10px 14px 0',
        // ~30% of the viewport of clear space under START CIRCUIT so the CTA
        // never crowds the bottom nav.
        paddingBottom: 'calc(30dvh + env(safe-area-inset-bottom, 0px))',
      }}>

        {/* Status row (moved up into the space the banner used to take) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 7, color: '#ff9a9a', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 4, padding: '3px 7px', letterSpacing: '0.08em', flexShrink: 0 }}>HYBRID</span>
          <span style={{ flex: 1, fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 11, color: C.faint, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {focusLabel} · {rounds} rounds · {intensityLabel}
          </span>
          <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 9, color: GOLD, flexShrink: 0 }}>~{duration} MIN</span>
        </div>

        {/* Discipline — pills */}
        <div data-guide="ccs-discipline">
        <SectionLabel>DISCIPLINE</SectionLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
          {STYLES.map(s => {
            const active = s.id === style;
            return (
              <button key={s.id} className="cc-pill" onClick={() => setStyle(s.id)} style={{
                padding: '8px 13px', borderRadius: 9, cursor: 'pointer',
                fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 8.5, letterSpacing: '0.05em',
                background: active ? 'rgba(239,68,68,0.12)' : 'rgba(16,4,30,0.8)',
                border: active ? `1.5px solid ${RED}` : '1px solid rgba(168,85,247,0.3)',
                color: active ? '#ff8a8a' : '#d9d1ef',
                boxShadow: active ? '0 0 8px rgba(239,68,68,0.22)' : 'none',
              }}>{s.label}</button>
            );
          })}
        </div>

        {/* Circuit style (design 15b) */}
        </div>
        <div data-guide="ccs-style">
        <SectionLabel>CIRCUIT STYLE</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
          {FOCUS_OPTIONS.map(f => {
            const active = f.id === focus;
            return (
              <button key={f.id} className="cc-pill" onClick={() => setFocus(f.id)} style={{
                display: 'flex', alignItems: 'center', gap: 9, borderRadius: 11, padding: '8px 12px', cursor: 'pointer', textAlign: 'left',
                background: active ? 'rgba(239,68,68,0.06)' : 'rgba(16,4,30,0.8)',
                border: active ? '1.5px solid rgba(239,68,68,0.5)' : '1px solid rgba(168,85,247,0.3)',
              }}>
                <span style={{ fontSize: 15, flexShrink: 0 }}>{f.icon}</span>
                <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 11.5, color: active ? '#ff7a7a' : '#fff' }}>{f.label}</span>
                  <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 9, color: '#9a90b8', marginLeft: 7 }}>{f.sub}</span>
                </span>
                {active && (
                  <span style={{ width: 16, height: 16, borderRadius: '50%', background: RED, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 8, flexShrink: 0 }}>✓</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Rounds + Intensity (design 15b) — side by side to save a row */}
        <div data-guide="ccs-config">
          <div style={{ display: 'flex', gap: 11, marginBottom: 9 }}>
            <Stepper label="ROUNDS" value={rounds} min={2} max={12} step={1} onChange={setRounds}/>
            <Segmented label="INTENSITY" options={INTENSITIES} value={difficulty} onChange={setDifficulty} accent={RED}/>
          </div>
        </div>

        {/* Work + Rest steppers */}
        <div style={{ display: 'flex', gap: 11, marginBottom: 9 }}>
          <Stepper label="WORK" value={workSec} unit="s" min={10} max={120} step={5} onChange={setWorkSec}/>
          <Stepper label="REST" value={restSec} unit="s" min={0} max={90} step={5} onChange={setRestSec}/>
        </div>

        {/* Equipment (design 15b) */}
        <div style={{ marginBottom: 9 }}>
          <Segmented label="EQUIPMENT" options={EQUIPMENT} value={equipment} onChange={setEquipment} accent={GOLD}/>
        </div>
        </div>

        {/* Add cardio (design 15b) */}
        <div
          onClick={() => setCardioSheetOpen(true)}
          className="cc-pill"
          style={{
            display: 'flex', alignItems: 'center', gap: 12, borderRadius: 11, padding: '10px 13px', marginBottom: 10, cursor: 'pointer',
            border: '1px solid rgba(253,224,71,0.4)', background: 'linear-gradient(90deg,rgba(253,224,71,0.08),rgba(239,68,68,0.06))',
          }}
        >
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(253,224,71,0.1)', border: '1px solid rgba(253,224,71,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>❤</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 10, color: GOLD }}>{cardioAddon ? 'CARDIO ADDED' : 'ADD CARDIO'}</div>
            <div style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 8.5, color: '#9a90b8', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {cardioAddon ? summarizeCardioAddon(cardioAddon) : 'Finish with a run — bonus XP'}
            </div>
          </div>
          {cardioAddon ? (
            <button onClick={(e) => { e.stopPropagation(); setCardioAddon(null); }} style={{
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 6, padding: '4px 9px', cursor: 'pointer', flexShrink: 0,
              fontFamily: "'Orbitron',sans-serif", fontSize: 8, fontWeight: 700, color: C.red,
            }}>REMOVE</button>
          ) : (
            <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 14, color: GOLD, flexShrink: 0 }}>›</span>
          )}
        </div>

        {/* LT-3 — optional warm-up before round 1. */}
        <div style={{ marginBottom: 10 }}>
          <WarmupRow feature="combatConditioning" value={warmupMin} onChange={setWarmupMin}/>
        </div>

        {/* LT-1 — cue level before you start (also adjustable mid-round). */}
        <div style={{ marginBottom: 10 }}>
          <AudioLevelRow/>
        </div>

        {/* Start circuit — inline, just under Add Cardio */}
        <div data-guide="ccs-start">
        <TrainingCTA variant="red" label="START CIRCUIT" icon="⚔️" onClick={handleStart} height={50} style={{ width: '100%', fontSize: 13.5, letterSpacing: '0.1em' }} />
        </div>

      </div>

      {cardioSheetOpen && (
        <AddCardioSheet
          context={{ source: 'Combat Conditioning', difficulty, durationMin: duration }}
          initialAddon={cardioAddon}
          onAdd={(addon) => { setCardioAddon(addon); setCardioSheetOpen(false); }}
          onClose={() => setCardioSheetOpen(false)}
        />
      )}
      {helpOpen && <ScreenGuide steps={SCREEN_GUIDES.combat_conditioning_setup} onClose={() => setHelpOpen(false)}/>}
    </PhoneFrame>
  );
}

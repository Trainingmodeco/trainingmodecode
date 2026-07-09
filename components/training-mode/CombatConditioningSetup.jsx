import { useState } from 'react';
import PhoneFrame from './PhoneFrame';
import TrainingHeader from './TrainingHeader';
import Embers from './Embers';
import SafeImage from './SafeImage';
import { ChevronRight } from 'lucide-react';
import { C } from './Styles';
import { CADENCE_PRESETS } from './shared/CadenceSlider';
import { summarizeCardioAddon } from './data/cardioAddon';
import CardioFinisherSetup from './CardioFinisherSetup';
import TrainingCTA from './shared/TrainingCTA';

const GOLD = C.gold;
const RED = '#ef4444';

const STYLES = [
  { id: 'Boxing', label: 'BOXING', icon: '🥊' },
  { id: 'Kickboxing / Muay Thai', label: 'KICKBOX', icon: '🦵' },
  { id: 'MMA', label: 'MMA', icon: '🥋' },
];
// Conditioning focus (design 15b) — replaces the strength/striking slider.
const FOCUS_OPTIONS = [
  { id: 'gas-tank', label: 'GAS TANK', sub: 'Endurance & conditioning' },
  { id: 'power', label: 'POWER & EXPLOSIVE', sub: 'Fast-twitch power output' },
  { id: 'strike-strength', label: 'STRIKE & STRENGTH', sub: 'Striking + raw strength' },
];
const FOCUS_BLEND = { 'gas-tank': 50, power: 40, 'strike-strength': 65 };
const DIFFICULTIES = ['Easy', 'Normal', 'Hard', 'Advanced'];
const ROUNDS_OPTIONS = [3, 4, 5, 6, 8, 10];
const WORK_OPTIONS = [20, 30, 40, 45, 60];
const REST_OPTIONS = [10, 15, 20, 30, 45];

const setupCSS = `
.cc-pill { transition: all 0.2s ease; cursor: pointer; }
.cc-pill:hover { filter: brightness(1.1); }
.cc-pill:active { transform: scale(0.96); }
.cc-cta { transition: all 0.2s ease; }
.cc-cta:hover { transform: translateY(-1px); filter: brightness(1.1); }
.cc-cta:active { transform: scale(0.97); }
`;

export default function CombatConditioningSetup({ onBack, onStart, onCardioOnly, profile }) {
  const [style, setStyle] = useState('Boxing');
  const [difficulty, setDifficulty] = useState('Normal');
  const [rounds, setRounds] = useState(5);
  const [workSec, setWorkSec] = useState(40);
  const [restSec, setRestSec] = useState(15);
  const [focus, setFocus] = useState('gas-tank');
  const cadencePreset = 'moderate';
  const cadenceMs = CADENCE_PRESETS.moderate;
  const [cardioAddon, setCardioAddon] = useState(null);
  const [cardioSheetOpen, setCardioSheetOpen] = useState(false);

  const duration = Math.round((rounds * (workSec + restSec)) / 60);
  const format = 'Auto';
  const equipment = 'Any';

  const handleStart = () => {
    onStart({
      style, duration, difficulty, equipment, format,
      voiceOn: true, formPreviewOn: true, cadenceCount: true, cadencePreset, cadenceMs, cardioAddon,
      rounds, workSec, restSec, focus, blend: FOCUS_BLEND[focus] ?? 50,
    });
  };

  return (
    <PhoneFrame useBrandBg>
      <style dangerouslySetInnerHTML={{ __html: setupCSS }}/>
      <Embers count={3}/>

      <TrainingHeader
        title="COMBAT CONDITIONING"
        subtitle="Hybrid strength x striking circuits"
        onHome={onBack}
        showBack
        onBack={onBack}
      />

      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
        padding: '12px 14px 0',
        paddingBottom: 'calc(142px + env(safe-area-inset-bottom, 0px))',
      }}>

        {/* Banner */}
        <div style={{
          width: '100%', height: 56, borderRadius: 12, overflow: 'hidden',
          marginBottom: 10, position: 'relative',
          border: '1px solid rgba(239,68,68,0.2)',
        }}>
          <SafeImage
            src="/static/fitmode/combat-conditioning.webp"
            alt="Combat Conditioning"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(10,0,20,0.7), transparent)' }}/>
        </div>

        {/* Discipline — square tiles */}
        <SectionLabel>DISCIPLINE</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 9 }}>
          {STYLES.map(s => {
            const active = s.id === style;
            return (
              <button key={s.id} className="cc-pill" onClick={() => setStyle(s.id)} style={{
                aspectRatio: '1 / 0.82', borderRadius: 8, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5,
                background: active ? 'rgba(239,68,68,0.15)' : 'rgba(10,0,20,0.6)',
                border: active ? `1.5px solid ${RED}` : '1.5px solid rgba(239,68,68,0.12)',
                boxShadow: active ? '0 0 10px rgba(239,68,68,0.25)' : 'none',
              }}>
                <span style={{ fontSize: 20 }}>{s.icon}</span>
                <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 9, letterSpacing: '0.04em', color: active ? RED : C.faint }}>{s.label}</span>
              </button>
            );
          })}
        </div>

        {/* Rounds */}
        <SectionLabel>ROUNDS</SectionLabel>
        <div style={{ display: 'flex', gap: 5, marginBottom: 9 }}>
          {ROUNDS_OPTIONS.map(r => {
            const active = r === rounds;
            return (
              <button key={r} className="cc-pill" onClick={() => setRounds(r)} style={{
                flex: 1, padding: '9px 0', borderRadius: 8, textAlign: 'center',
                fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 12,
                background: active ? 'rgba(253,224,71,0.12)' : 'rgba(10,0,20,0.6)',
                border: active ? `1.5px solid ${GOLD}` : '1.5px solid rgba(255,255,255,0.05)',
                color: active ? GOLD : C.faint,
              }}>
                {r}
              </button>
            );
          })}
        </div>

        {/* Work / Rest */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 9 }}>
          <div style={{ flex: 1 }}>
            <SectionLabel>WORK (sec)</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {WORK_OPTIONS.map(w => {
                const active = w === workSec;
                return (
                  <button key={w} className="cc-pill" onClick={() => setWorkSec(w)} style={{
                    padding: '7px 10px', borderRadius: 6,
                    fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 10,
                    background: active ? 'rgba(253,224,71,0.12)' : 'rgba(10,0,20,0.6)',
                    border: active ? `1.5px solid ${GOLD}` : '1.5px solid rgba(255,255,255,0.05)',
                    color: active ? GOLD : C.faint,
                  }}>
                    {w}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <SectionLabel>REST (sec)</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {REST_OPTIONS.map(r => {
                const active = r === restSec;
                return (
                  <button key={r} className="cc-pill" onClick={() => setRestSec(r)} style={{
                    padding: '7px 10px', borderRadius: 6,
                    fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 10,
                    background: active ? 'rgba(79,140,255,0.12)' : 'rgba(10,0,20,0.6)',
                    border: active ? '1.5px solid #4f8cff' : '1.5px solid rgba(255,255,255,0.05)',
                    color: active ? '#4f8cff' : C.faint,
                  }}>
                    {r}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Estimated time */}
        <div style={{
          textAlign: 'center', marginBottom: 14, fontFamily: "'Rajdhani',sans-serif",
          fontSize: 11, fontWeight: 600, color: C.faint,
        }}>
          EST. {duration} MIN
        </div>

        {/* Conditioning focus (design 15b) */}
        <SectionLabel>FOCUS</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 9 }}>
          {FOCUS_OPTIONS.map(f => {
            const active = f.id === focus;
            return (
              <button key={f.id} className="cc-pill" onClick={() => setFocus(f.id)} style={{
                textAlign: 'left', padding: '9px 12px', borderRadius: 10, cursor: 'pointer',
                background: active ? 'rgba(239,68,68,0.14)' : 'rgba(10,0,20,0.55)',
                border: active ? `1.5px solid ${RED}` : '1.5px solid rgba(239,68,68,0.12)',
                boxShadow: active ? '0 0 12px rgba(239,68,68,0.22)' : 'none',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <span style={{
                  width: 9, height: 9, borderRadius: '50%', flexShrink: 0,
                  background: active ? RED : 'transparent', border: `1.5px solid ${active ? RED : 'rgba(239,68,68,0.4)'}`,
                  boxShadow: active ? '0 0 8px rgba(239,68,68,0.6)' : 'none',
                }}/>
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 10, letterSpacing: '0.05em', color: active ? '#ff8a8a' : C.muted }}>{f.label}</span>
                  <span style={{ display: 'block', fontFamily: "'Rajdhani',sans-serif", fontSize: 10, color: C.faint, marginTop: 1 }}>{f.sub}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Intensity */}
        <SectionLabel>INTENSITY</SectionLabel>
        <div style={{ display: 'flex', gap: 5, marginBottom: 9 }}>
          {DIFFICULTIES.map(d => {
            const active = d === difficulty;
            return (
              <button key={d} className="cc-pill" onClick={() => setDifficulty(d)} style={{
                flex: 1, padding: '8px 0', borderRadius: 8, textAlign: 'center',
                fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 9,
                background: active ? 'rgba(253,224,71,0.12)' : 'rgba(10,0,20,0.6)',
                border: active ? `1.5px solid ${GOLD}` : '1.5px solid rgba(255,255,255,0.05)',
                color: active ? GOLD : C.faint,
              }}>
                {d.toUpperCase()}
              </button>
            );
          })}
        </div>

        {/* Cardio finisher add-on (design 15b) */}
        <div
          onClick={() => setCardioSheetOpen(true)}
          style={{
            borderRadius: 12, padding: '12px 14px', marginBottom: 14,
            background: cardioAddon ? 'rgba(255,138,74,0.12)' : 'rgba(255,138,74,0.05)',
            border: `1.5px solid ${cardioAddon ? 'rgba(255,138,74,0.45)' : 'rgba(255,138,74,0.22)'}`,
            display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 22, lineHeight: 1 }}>&#127939;</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 11, color: C.cardio, letterSpacing: '0.05em' }}>
              {cardioAddon ? 'CARDIO FINISHER ADDED' : 'ADD CARDIO FINISHER'}
            </div>
            <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 11, color: C.faint, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {cardioAddon ? summarizeCardioAddon(cardioAddon) : 'Cap the circuit with a cardio burn'}
            </div>
          </div>
          {cardioAddon ? (
            <button onClick={(e) => { e.stopPropagation(); setCardioAddon(null); }} style={{
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 6, padding: '4px 9px', cursor: 'pointer', flexShrink: 0,
              fontFamily: "'Orbitron',sans-serif", fontSize: 8, fontWeight: 700, color: C.red,
            }}>REMOVE</button>
          ) : (
            <ChevronRight size={18} color={C.cardio} style={{ flexShrink: 0 }}/>
          )}
        </div>

      </div>

      {/* Pinned CTA — always visible above the nav */}
      {!cardioSheetOpen && (
        <div style={{ position: 'fixed', bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))', left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 440, zIndex: 35, display: 'flex', justifyContent: 'center', padding: '24px 14px 8px', background: 'linear-gradient(to top, #0a0116 58%, rgba(10,1,22,0) 100%)', pointerEvents: 'none' }}>
          <div style={{ pointerEvents: 'auto' }}>
            <TrainingCTA variant="red" label="START CIRCUIT" icon="⚔️" onClick={handleStart} height={46} style={{ width: 'auto', minWidth: 264, paddingLeft: 38, paddingRight: 38, fontSize: 12.5, letterSpacing: '0.1em' }} />
          </div>
        </div>
      )}

      {cardioSheetOpen && (
        <CardioFinisherSetup
          initialAddon={cardioAddon}
          sourceMode="Combat Conditioning"
          onSave={(addon) => { setCardioAddon(addon); setCardioSheetOpen(false); }}
          onClose={() => setCardioSheetOpen(false)}
        />
      )}
    </PhoneFrame>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontFamily: "'Orbitron',sans-serif", fontWeight: 700, color: C.faint,
      fontSize: 9, letterSpacing: '0.15em', marginBottom: 6,
    }}>{children}</div>
  );
}

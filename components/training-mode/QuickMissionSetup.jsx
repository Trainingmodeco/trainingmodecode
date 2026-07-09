import { useState } from 'react';
import PhoneFrame from './PhoneFrame';
import TrainingHeader from './TrainingHeader';
import Embers from './Embers';
import { Zap } from 'lucide-react';
import { C } from './Styles';
import { CADENCE_PRESETS } from './shared/CadenceSlider';
import CardioFinisherSetup from './CardioFinisherSetup';

const GOLD = C.gold;
const LENGTHS = [10, 20, 30];
const INTENSITIES = ['Easy', 'Normal', 'Hard', 'Advanced'];
const WORKOUT_TYPES = ['Bodyweight', 'Weighted', 'Hybrid'];

const setupCSS = `
.qm-pill { transition: all 0.2s ease; cursor: pointer; }
.qm-pill:hover { filter: brightness(1.1); transform: scale(1.03); }
.qm-pill:active { transform: scale(0.96); }
.qm-cta { transition: all 0.2s ease; }
.qm-cta:hover { transform: translateY(-1px); filter: brightness(1.1); }
.qm-cta:active { transform: scale(0.97); }
`;

export default function QuickMissionSetup({ onBack, onStart, onCardioOnly }) {
  const [duration, setDuration] = useState(20);
  const [difficulty, setDifficulty] = useState('Normal');
  const [workoutType, setWorkoutType] = useState('Bodyweight');
  const [voiceOn, setVoiceOn] = useState(true);
  const [cadenceCount, setCadenceCount] = useState(true);
  const cadencePreset = 'moderate';
  const cadenceMs = CADENCE_PRESETS.moderate;
  const [cardioAddon, setCardioAddon] = useState(null);
  const [cardioSheetOpen, setCardioSheetOpen] = useState(false);

  const handleStart = () => {
    onStart({
      workoutType, duration, difficulty, format: 'Auto',
      cardioFinisher: false, cadenceCount, cadencePreset, cadenceMs, voiceOn, cardioAddon,
    });
  };

  return (
    <PhoneFrame useBrandBg>
      <style dangerouslySetInnerHTML={{ __html: setupCSS }}/>
      <Embers count={3}/>

      <TrainingHeader
        title="QUICK MISSION"
        subtitle="No setup. Pick and go."
        onHome={onBack}
        showBack
        onBack={onBack}
      />

      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
        alignItems: 'center', padding: '20px 16px 0',
        paddingBottom: 'calc(170px + env(safe-area-inset-bottom, 0px))',
      }}>

        {/* Length pills */}
        <SectionLabel>LENGTH</SectionLabel>
        <div style={{ display: 'flex', gap: 10, marginBottom: 24, width: '100%', justifyContent: 'center' }}>
          {LENGTHS.map(len => {
            const active = len === duration;
            return (
              <button key={len} className="qm-pill" onClick={() => setDuration(len)} style={{
                width: 80, height: 80, borderRadius: 16,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                background: active ? 'rgba(168,85,247,0.15)' : 'rgba(10,0,20,0.6)',
                border: active ? `2px solid ${C.violet}` : '2px solid rgba(168,85,247,0.12)',
                boxShadow: active ? '0 0 18px rgba(168,85,247,0.3)' : 'none',
              }}>
                <span style={{
                  fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 22,
                  color: active ? '#fff' : C.faint,
                }}>{len}</span>
                <span style={{
                  fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 10,
                  color: active ? C.violet : C.faint, marginTop: 2,
                }}>MIN</span>
              </button>
            );
          })}
        </div>

        {/* Intensity */}
        <SectionLabel>INTENSITY</SectionLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20, justifyContent: 'center' }}>
          {INTENSITIES.map(d => {
            const active = d === difficulty;
            return (
              <button key={d} className="qm-pill" onClick={() => setDifficulty(d)} style={{
                padding: '9px 16px', borderRadius: 20,
                fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 9, letterSpacing: '0.06em',
                background: active ? 'rgba(253,224,71,0.15)' : 'rgba(10,0,20,0.6)',
                border: active ? `1.5px solid ${GOLD}` : '1.5px solid rgba(255,255,255,0.06)',
                color: active ? GOLD : C.faint,
                boxShadow: active ? '0 0 10px rgba(253,224,71,0.2)' : 'none',
              }}>
                {d.toUpperCase()}
              </button>
            );
          })}
        </div>

        {/* Equipment type */}
        <SectionLabel>EQUIPMENT</SectionLabel>
        <div style={{ display: 'flex', gap: 6, marginBottom: 20, justifyContent: 'center' }}>
          {WORKOUT_TYPES.map(t => {
            const active = t === workoutType;
            return (
              <button key={t} className="qm-pill" onClick={() => setWorkoutType(t)} style={{
                padding: '9px 14px', borderRadius: 8,
                fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 9, letterSpacing: '0.06em',
                background: active ? 'rgba(253,224,71,0.12)' : 'rgba(10,0,20,0.6)',
                border: active ? `1.5px solid ${GOLD}` : '1.5px solid rgba(255,255,255,0.06)',
                color: active ? GOLD : C.faint,
              }}>
                {t.toUpperCase()}
              </button>
            );
          })}
        </div>

        {/* Toggles */}
        <div style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          <ToggleRow label="VOICE COACH" value={voiceOn} onChange={setVoiceOn}/>
          <ToggleRow label="CADENCE COUNT" value={cadenceCount} onChange={setCadenceCount}/>
        </div>

        {/* Cardio addon banner */}
        <div
          onClick={() => setCardioSheetOpen(true)}
          style={{
            width: '100%', maxWidth: 340, borderRadius: 10, padding: '10px 14px', marginBottom: 20,
            background: cardioAddon ? 'rgba(255,138,74,0.1)' : 'rgba(255,138,74,0.04)',
            border: `1px solid ${cardioAddon ? 'rgba(255,138,74,0.4)' : 'rgba(255,138,74,0.2)'}`,
            display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 15 }}>&#127939;</span>
          <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 9, color: C.cardio, letterSpacing: '0.06em' }}>
            {cardioAddon ? 'CARDIO FINISHER ADDED' : 'ADD CARDIO FINISHER'}
          </span>
          {cardioAddon && (
            <button onClick={(e) => { e.stopPropagation(); setCardioAddon(null); }} style={{
              marginLeft: 'auto', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 5, padding: '3px 7px', cursor: 'pointer',
              fontFamily: "'Orbitron',sans-serif", fontSize: 7, fontWeight: 700, color: C.red,
            }}>REMOVE</button>
          )}
        </div>

        {/* CTA */}
        <button className="qm-cta" onClick={handleStart} style={{
          width: '100%', maxWidth: 340, padding: '15px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
          background: `linear-gradient(135deg, ${C.violet}, #7c3aed)`,
          color: '#fff', fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 14, letterSpacing: '0.14em',
          boxShadow: '0 0 22px rgba(168,85,247,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <Zap size={16}/> START MISSION
        </button>
      </div>

      {cardioSheetOpen && (
        <CardioFinisherSetup
          initialAddon={cardioAddon}
          sourceMode="Quick Mission"
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
      fontSize: 9, letterSpacing: '0.15em', marginBottom: 8, textAlign: 'center',
    }}>{children}</div>
  );
}

function ToggleRow({ label, value, onChange }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: 'rgba(10,0,20,0.5)', borderRadius: 8, padding: '10px 12px',
      border: '1px solid rgba(255,255,255,0.04)',
    }}>
      <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 10, color: C.muted, letterSpacing: '0.06em' }}>{label}</span>
      <button onClick={() => onChange(!value)} style={{ background: 'none', border: 'none', padding: 0 }}>
        <div className={`tm-toggle ${value ? 'on' : ''}`}><div className="tm-toggle-knob"/></div>
      </button>
    </div>
  );
}
